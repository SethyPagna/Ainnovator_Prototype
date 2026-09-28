import type { Aircraft, HoldId, Position } from './aircraft';
import { buildOverlapMap, positionsAdjacent } from './aircraft';
import type { Shipment } from './cargo';
import { adjacencyConflict, isCao } from './rules';
import { ULD_BY_ID } from './uld';
import type { BuiltUld } from './packing/buildup';

// Weight & balance (simplified): moments about a nose datum, %MAC from LEMAC/MAC.

export interface Warning {
  level: 'error' | 'warn' | 'info';
  code: string;
  text: string;
  ref?: string;
}

export interface WbInput {
  ac: Aircraft;
  ulds: BuiltUld[];
  assignments: Record<string, string>; // positionId -> uldId
  fuel: number; // take-off fuel (kg)
  tripFuel: number; // kg
  ships: Map<string, Shipment>;
}

export interface WbResult {
  payload: number;
  payloadArm: number;
  zfw: number;
  zfwArm: number;
  zfwMac: number;
  tow: number;
  towArm: number;
  towMac: number;
  lw: number;
  lwArm: number;
  lwMac: number;
  fuel: number;
  holdWeights: Record<HoldId, number>;
  lateralMoment: number;
  positionsUsed: { main: number; lower: number; mainTotal: number; lowerTotal: number };
  inEnvelope: { zfw: boolean; tow: boolean; lw: boolean };
  towLimits: [number, number] | null;
  zfwLimits: [number, number] | null;
  warnings: Warning[];
  loaded: number;
  unassigned: string[];
}

export function pctMac(ac: Aircraft, arm: number): number {
  return ((arm - ac.lemac) / ac.mac) * 100;
}

export function armFromMac(ac: Aircraft, mac: number): number {
  return ac.lemac + (mac / 100) * ac.mac;
}

/** Ray-casting point-in-polygon for the (%MAC, weight) envelope. */
export function inEnvelope(env: [number, number][], mac: number, w: number): boolean {
  let inside = false;
  for (let i = 0, j = env.length - 1; i < env.length; j = i++) {
    const [xi, yi] = env[i];
    const [xj, yj] = env[j];
    if (yi > w !== yj > w && mac < ((xj - xi) * (w - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Forward and aft %MAC limits of the envelope at a given weight. */
export function envelopeLimitsAt(env: [number, number][], w: number): [number, number] | null {
  const xs: number[] = [];
  for (let i = 0; i < env.length; i++) {
    const [x1, y1] = env[i];
    const [x2, y2] = env[(i + 1) % env.length];
    if ((w >= Math.min(y1, y2) && w <= Math.max(y1, y2)) && y1 !== y2) xs.push(x1 + ((w - y1) / (y2 - y1)) * (x2 - x1));
  }
  if (xs.length < 2) return null;
  return [Math.min(...xs), Math.max(...xs)];
}

export function positionIssue(p: Position, u: BuiltUld, ships: Map<string, Shipment>): string | null {
  if (!p.accepts.includes(u.typeId)) return `${ULD_BY_ID[u.typeId].name} does not fit position ${p.id}`;
  if (u.gross > p.maxWeight + 0.5) return `${Math.round(u.gross).toLocaleString('en-US')} kg exceeds the ${p.maxWeight.toLocaleString('en-US')} kg limit of ${p.id}`;
  const sh = u.shipmentIds.map((id) => ships.get(id)!).filter(Boolean);
  if (p.deck !== 'main' && sh.some(isCao)) return 'Cargo-aircraft-only DG must be loaded on the main deck (accessible)';
  if (p.deck !== 'main' && sh.some((s) => s.shc.includes('AVI'))) return 'Live animals go on the ventilated main deck';
  return null;
}

export function computeWb(inp: WbInput): WbResult {
  const { ac, ulds, assignments, fuel, tripFuel, ships } = inp;
  const byId = new Map(ulds.map((u) => [u.id, u]));
  const posById = new Map(ac.positions.map((p) => [p.id, p]));
  const warnings: Warning[] = [];
  const holdWeights: Record<HoldId, number> = { MD: 0, FWD: 0, AFT: 0 };
  let payload = 0, moment = 0, lat = 0;
  const used = { main: 0, lower: 0, mainTotal: 0, lowerTotal: 0 };
  const loadedIds = new Set<string>();
  for (const [pid, uid] of Object.entries(assignments)) {
    const p = posById.get(pid);
    const u = byId.get(uid);
    if (!p || !u) continue;
    loadedIds.add(uid);
    payload += u.gross;
    moment += u.gross * p.arm;
    lat += u.gross * p.lat;
    holdWeights[p.hold] += u.gross;
    if (p.deck === 'main') used.main++;
    else used.lower++;
    const issue = positionIssue(p, u, ships);
    if (issue) warnings.push({ level: 'error', code: 'POS', text: `${u.id} in ${p.id}: ${issue}`, ref: uid });
  }
  // derive totals of physically usable positions (overlays counted once)
  used.mainTotal = ac.positions.filter((p) => p.deck === 'main' && !p.alt).length;
  used.lowerTotal = ac.positions.filter((p) => p.kind === 'LD3').length;

  // overlapping positions both occupied
  const overlaps = buildOverlapMap(ac);
  const occ = new Set(Object.keys(assignments).filter((k) => byId.has(assignments[k])));
  const seenPair = new Set<string>();
  for (const pid of occ) {
    for (const q of overlaps.get(pid) ?? []) {
      if (!occ.has(q)) continue;
      const k = [pid, q].sort().join('|');
      if (seenPair.has(k)) continue;
      seenPair.add(k);
      warnings.push({ level: 'error', code: 'OVERLAP', text: `Positions ${pid} and ${q} overlap and cannot both be loaded`, ref: assignments[pid] });
    }
  }
  // DG adjacency
  const occList = [...occ].map((id) => posById.get(id)!);
  for (let i = 0; i < occList.length; i++) {
    for (let j = i + 1; j < occList.length; j++) {
      const a = occList[i], b = occList[j];
      if (!positionsAdjacent(a, b)) continue;
      const ua = byId.get(assignments[a.id])!, ub = byId.get(assignments[b.id])!;
      if (!ua.dgClasses.length && !ub.shc.includes('ICE') && !ua.shc.includes('ICE')) continue;
      const c = adjacencyConflict(ua.shipmentIds.map((s) => ships.get(s)!), ub.shipmentIds.map((s) => ships.get(s)!));
      if (c) warnings.push({ level: 'warn', code: 'ADJ', text: `${a.id}/${b.id}: ${c}`, ref: ua.id });
    }
  }

  const zfw = ac.dow + payload;
  const zfwArm = (ac.dow * ac.dowArm + moment) / zfw;
  const tow = zfw + fuel;
  const towArm = (zfw * zfwArm + fuel * ac.fuelArm) / tow;
  const lwFuel = Math.max(0, fuel - tripFuel);
  const lw = zfw + lwFuel;
  const lwArm = (zfw * zfwArm + lwFuel * ac.fuelArm) / lw;
  const zfwMac = pctMac(ac, zfwArm);
  const towMac = pctMac(ac, towArm);
  const lwMac = pctMac(ac, lwArm);
  const env = {
    zfw: inEnvelope(ac.envelope, zfwMac, zfw),
    tow: inEnvelope(ac.envelope, towMac, tow),
    lw: inEnvelope(ac.envelope, lwMac, lw),
  };
  const kg = (v: number) => `${Math.round(v).toLocaleString('en-US')} kg`;
  if (zfw > ac.mzfw) warnings.push({ level: 'error', code: 'MZFW', text: `ZFW ${kg(zfw)} exceeds MZFW ${kg(ac.mzfw)}` });
  if (tow > ac.mtow) warnings.push({ level: 'error', code: 'MTOW', text: `TOW ${kg(tow)} exceeds MTOW ${kg(ac.mtow)}` });
  if (lw > ac.mlw) warnings.push({ level: 'error', code: 'MLW', text: `Landing weight ${kg(lw)} exceeds MLW ${kg(ac.mlw)}` });
  if (fuel > ac.maxFuel) warnings.push({ level: 'error', code: 'FUEL', text: `Fuel ${kg(fuel)} exceeds tank capacity ${kg(ac.maxFuel)}` });
  if (fuel < tripFuel) warnings.push({ level: 'error', code: 'TRIP', text: `Take-off fuel below trip fuel (${kg(tripFuel)})` });
  if (payload > 0) {
    if (!env.zfw) warnings.push({ level: 'error', code: 'CGZFW', text: `ZFW CG ${zfwMac.toFixed(1)} %MAC outside the envelope` });
    if (!env.tow) warnings.push({ level: 'error', code: 'CGTOW', text: `TOW CG ${towMac.toFixed(1)} %MAC outside the envelope` });
    if (!env.lw) warnings.push({ level: 'warn', code: 'CGLW', text: `Landing CG ${lwMac.toFixed(1)} %MAC outside the envelope` });
  }
  for (const h of ac.holds) {
    if (holdWeights[h.id] > h.maxWeight) warnings.push({ level: 'error', code: 'HOLD', text: `${h.label} ${kg(holdWeights[h.id])} exceeds limit ${kg(h.maxWeight)}` });
  }
  if (Math.abs(lat) > ac.lateralLimit) warnings.push({ level: 'warn', code: 'LAT', text: `Lateral imbalance ${Math.round(lat).toLocaleString('en-US')} kg·m exceeds ${ac.lateralLimit.toLocaleString('en-US')} kg·m` });
  const unassigned = ulds.filter((u) => !loadedIds.has(u.id)).map((u) => u.id);
  if (unassigned.length) warnings.push({ level: 'warn', code: 'OFFLOAD', text: `${unassigned.length} ULD${unassigned.length > 1 ? 's' : ''} not assigned to a position` });
  return {
    payload,
    payloadArm: payload ? moment / payload : 0,
    zfw, zfwArm, zfwMac,
    tow, towArm, towMac,
    lw, lwArm, lwMac,
    fuel,
    holdWeights,
    lateralMoment: lat,
    positionsUsed: used,
    inEnvelope: env,
    towLimits: envelopeLimitsAt(ac.envelope, tow),
    zfwLimits: envelopeLimitsAt(ac.envelope, zfw),
    warnings,
    loaded: loadedIds.size,
    unassigned,
  };
}

/** Loading sequence: forward of the main-deck door front-to-back, then aft of it back-to-front; lower holds front-to-back. */
export function loadSequence(ac: Aircraft, assignments: Record<string, string>): string[] {
  const door = (ac.body.doorX[0] + ac.body.doorX[1]) / 2;
  const occ = ac.positions.filter((p) => assignments[p.id]);
  const md = occ.filter((p) => p.deck === 'main');
  const fwd = md.filter((p) => p.arm < door).sort((a, b) => a.arm - b.arm || a.lat - b.lat);
  const aft = md.filter((p) => p.arm >= door).sort((a, b) => b.arm - a.arm || a.lat - b.lat);
  const lower = occ.filter((p) => p.deck === 'lower').sort((a, b) => (a.hold === b.hold ? a.arm - b.arm : a.hold === 'FWD' ? -1 : 1) || a.lat - b.lat);
  return [...fwd, ...aft, ...lower].map((p) => p.id);
}
