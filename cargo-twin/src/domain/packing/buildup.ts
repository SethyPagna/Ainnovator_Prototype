import { allPieces, chargeableWeight, type Piece, type Shc, type Shipment } from '../cargo';
import { typeLoadableOn, type Aircraft } from '../aircraft';
import {
  coloadConflict,
  isCao,
  needsActiveControl,
  preferredRegime,
  REGIME_SETPOINT,
  typeEligibility,
  type TempRegime,
} from '../rules';
import { ULD_BY_ID, usableVolumeM3, type UldType } from '../uld';
import { fitsType, UldPacker, type Placement, type ScoreRule } from './packer';
import { rectFitsProfile } from '../geometry';
import { sortByKeys, sortPieces, STRATEGY_BY_ID, type StrategyId } from './strategies';

export interface BuiltUld {
  id: string;
  typeId: string;
  regime: TempRegime;
  active: boolean;
  setpoint: number | null;
  placements: Placement[];
  net: number;
  tare: number;
  gross: number;
  cap: number;
  itemVolM3: number;
  usableM3: number;
  volUtil: number;
  wtUtil: number;
  cg: { x: number; y: number; z: number };
  cgOffsetPct: { x: number; z: number };
  heightUsed: number;
  shipmentIds: string[];
  shc: Shc[];
  dgClasses: string[];
  cao: boolean;
  deckHint: 'main' | 'lower';
  group: string;
}

export type UnplacedCode = 'temp' | 'dims' | 'weight' | 'capacity' | 'type' | 'stow';

export interface UnplacedPiece {
  pieceId: string;
  shipmentId: string;
  code: UnplacedCode;
  reason: string;
}

export interface BuildKpis {
  ulds: number;
  byType: Record<string, number>;
  pieces: number;
  placedPieces: number;
  unplacedPieces: number;
  unplacedKg: number;
  grossKg: number;
  netKg: number;
  tareKg: number;
  volUtil: number;
  wtUtil: number;
  chargeableKg: number;
  deckMetres: number;
  cgOffsetAvg: number;
  cost: number;
}

export interface BuildResult {
  strategy: StrategyId;
  aircraftId: string;
  ulds: BuiltUld[];
  unplaced: UnplacedPiece[];
  kpis: BuildKpis;
  ms: number;
  gaTrace?: number[];
}

export interface BuildOptions {
  strategy: StrategyId;
  minSupport: number;
  keys?: Map<string, number>;
  scoreOverride?: ScoreRule;
}

const DECK_METRES: Record<string, number> = {
  'PMC-Q6': 1.63, 'PAG-Q6': 1.63, 'PMC-Q7': 2.49,
  'PMC-LD': 1.63, 'PAG-LD': 1.63,
  AKE: 0.795, AKN: 0.795, RKN: 0.795, AKH: 0.795, DQF: 1.59,
};

// ---------------------------------------------------------------------------------------
// Capacity budget (approximate - the aircraft planner does the exact position assignment)
// ---------------------------------------------------------------------------------------

class Budget {
  side: number; // two-abreast main-deck positions
  fixedCentre: number; // nose / tail centre positions (lower contour only)
  centre: number; // centre-line Q7 alternatives
  ld3: number;
  lowerPallets: number;
  constructor(private ac: Aircraft) {
    const ps = ac.positions;
    this.side = ps.filter((p) => p.kind === 'MDS').length;
    this.fixedCentre = ps.filter((p) => p.kind === 'MDC' && !p.alt).length;
    this.centre = ps.filter((p) => p.alt).length;
    this.ld3 = ps.filter((p) => p.kind === 'LD3').length;
    this.lowerPallets = ps.filter((p) => p.kind === 'LDP').length;
  }
  deckFor(typeId: string, prefer: 'main' | 'lower' | 'any', mustMain: boolean): 'main' | 'lower' | null {
    const ac = this.ac;
    const t = ULD_BY_ID[typeId];
    if (!t || !typeLoadableOn(ac, typeId)) return null;
    const mainOk = typeLoadableOn(ac, typeId, 'main');
    const lowerOk = typeLoadableOn(ac, typeId, 'lower') && !mustMain;
    if (typeId === 'PMC-Q7') return this.centre >= 1 && this.side >= 1.5 ? 'main' : null;
    if (t.kind === 'container') return lowerOk && this.ld3 >= 1 ? 'lower' : null;
    const lowContour = t.external.height <= 163;
    const lowerFree = lowerOk && this.ld3 >= 3.3 && this.lowerPallets >= 1;
    const mainFree = mainOk && (this.side >= 1 || (lowContour && this.fixedCentre >= 1));
    if (prefer === 'lower') return lowerFree ? 'lower' : mainFree ? 'main' : null;
    return mainFree ? 'main' : lowerFree ? 'lower' : null;
  }
  take(typeId: string, deck: 'main' | 'lower', sign = 1) {
    const t = ULD_BY_ID[typeId];
    if (typeId === 'PMC-Q7') {
      this.centre -= sign;
      this.side -= 1.5 * sign;
    } else if (t.kind === 'container') {
      this.ld3 -= sign;
    } else if (deck === 'main') {
      if (t.external.height <= 163 && (sign < 0 ? false : this.fixedCentre >= 1)) this.fixedCentre -= sign;
      else this.side -= sign;
    } else {
      this.ld3 -= 3.3 * sign;
      this.lowerPallets -= sign;
    }
  }
}

/** Planning gross cap for a type on a deck: what enough positions can actually accept. */
export function grossCap(ac: Aircraft, typeId: string, deck: 'main' | 'lower'): number {
  const t = ULD_BY_ID[typeId];
  const limits = ac.positions.filter((p) => p.deck === deck && p.accepts.includes(typeId)).map((p) => p.maxWeight).sort((a, b) => b - a);
  if (!limits.length) return 0;
  const pick = limits[Math.min(limits.length - 1, Math.floor(limits.length * 0.3))];
  return Math.min(t.maxGross, pick);
}

// ---------------------------------------------------------------------------------------

interface GroupCtx {
  key: string;
  regime: TempRegime;
  active: boolean;
  special: 'VAL' | 'AVI' | null;
  passiveTemp: boolean;
}

function groupOf(s: Shipment): GroupCtx | null {
  const regime = preferredRegime(s);
  if (!regime) return null;
  const active = needsActiveControl(s);
  const special = s.shc.includes('VAL') ? 'VAL' : s.shc.includes('AVI') ? 'AVI' : null;
  return { key: `${regime}|${active ? 'A' : 'P'}|${special ?? '-'}`, regime, active, special, passiveTemp: regime !== 'AMB' && !active };
}

function isSmall(p: Piece): boolean {
  return Math.max(p.l, p.w, p.h) <= 100 && p.weight <= 80;
}

function typePrefs(p: Piece, s: Shipment, g: GroupCtx): string[] {
  if (g.active) return ['RKN'];
  if (g.special === 'VAL') return ['AKE', 'AKN'];
  if (g.special === 'AVI') return ['PMC-Q6', 'PAG-Q6', 'PMC-LD'];
  if (g.passiveTemp) return ['AKE', 'PMC-LD', 'PAG-LD', 'PMC-Q6', 'PAG-Q6'];
  if (isSmall(p) && !isCao(s)) return ['AKE', 'AKN', 'PMC-Q6', 'PAG-Q6', 'PMC-LD', 'PAG-LD'];
  return ['PMC-Q6', 'PAG-Q6', 'PMC-LD', 'PAG-LD', 'PMC-Q7', 'AKE', 'AKN'];
}

function nextSerial(t: UldType, n: number): string {
  const base: Record<string, number> = { AKE: 12001, AKN: 45101, RKN: 70311, 'PMC-Q6': 31201, 'PMC-Q7': 36801, 'PMC-LD': 33401, 'PAG-LD': 22401, 'PAG-Q6': 24801, AKH: 50101, DQF: 60101 };
  return `${t.iata} ${String((base[t.id] ?? 10001) + n).padStart(5, '0')} XX`;
}

interface OpenUld {
  packer: UldPacker;
  type: UldType;
  group: GroupCtx;
  deck: 'main' | 'lower';
  cap: number;
  ships: Set<string>;
}

export function buildUp(
  manifest: { shipments: Shipment[] },
  ac: Aircraft,
  opts: BuildOptions,
): BuildResult {
  const t0 = performance.now();
  const strat = STRATEGY_BY_ID[opts.strategy];
  const score: ScoreRule = opts.scoreOverride ?? strat.score;
  const ships = new Map(manifest.shipments.map((s) => [s.id, s]));
  const pieces = allPieces(manifest);
  const budget = new Budget(ac);
  const unplaced: UnplacedPiece[] = [];
  const open: OpenUld[] = [];
  const conflictCache = new Map<string, string | null>();

  const conflicts = (a: Shipment, set: Set<string>): boolean => {
    for (const id of set) {
      const k = a.id < id ? `${a.id}|${id}` : `${id}|${a.id}`;
      let c = conflictCache.get(k);
      if (c === undefined) {
        c = coloadConflict(a, ships.get(id)!);
        conflictCache.set(k, c);
      }
      if (c) return true;
    }
    return false;
  };

  const eligCache = new Map<string, boolean>();
  const eligible = (s: Shipment, t: UldType, g: GroupCtx, deck: 'main' | 'lower', cap: number): boolean => {
    const k = `${s.id}|${t.id}|${deck}`;
    let e = eligCache.get(k);
    if (e === undefined) {
      e = typeEligibility(s, t, g.regime, g.active) === null
        && (!isCao(s) || deck === 'main')
        && (s.shc.includes('AVI') ? deck === 'main' : true)
        && fitsType(s, s.orientation, t)
        && s.weight <= cap - t.tare;
      eligCache.set(k, e);
    }
    return e;
  };

  // group pieces
  const groups = new Map<string, { ctx: GroupCtx; pieces: Piece[] }>();
  for (const p of pieces) {
    const s = ships.get(p.shipmentId)!;
    const g = groupOf(s);
    if (!g) {
      const r = s.temp ? `${s.temp.min}..${s.temp.max} °C` : 'unknown';
      unplaced.push({ pieceId: p.id, shipmentId: s.id, code: 'temp', reason: `Temperature range ${r} matches no supported regime (COL, CRT, FRO)` });
      continue;
    }
    if (!groups.has(g.key)) groups.set(g.key, { ctx: g, pieces: [] });
    groups.get(g.key)!.pieces.push(p);
  }
  const groupRank = (g: GroupCtx) => (g.active ? 0 : g.special ? 1 : g.passiveTemp ? 2 : 3);
  const orderedGroups = [...groups.values()].sort((a, b) => groupRank(a.ctx) - groupRank(b.ctx) || (a.ctx.key < b.ctx.key ? -1 : 1));

  const typeCount: Record<string, number> = {};

  const openUld = (typeId: string, g: GroupCtx, deck: 'main' | 'lower'): OpenUld => {
    const t = ULD_BY_ID[typeId];
    const cap = grossCap(ac, typeId, deck);
    const packer = new UldPacker(t, { minSupport: opts.minSupport, score, heavyLow: 1, maxGross: cap });
    return { packer, type: t, group: g, deck, cap, ships: new Set() };
  };

  const fill = (u: OpenUld, pool: Piece[], placed: Set<string>) => {
    const failedAt = new Map<string, number>();
    let md = Infinity;
    for (const p of pool) if (!placed.has(p.id)) md = Math.min(md, p.l, p.w, p.h);
    u.packer.minDim = Number.isFinite(md) ? md : 30;
    for (const p of pool) {
      if (placed.has(p.id)) continue;
      const s = ships.get(p.shipmentId)!;
      if (p.weight > u.packer.remainingPayload) continue;
      if (!eligible(s, u.type, u.group, u.deck, u.cap)) continue;
      if (!u.ships.has(s.id) && conflicts(s, u.ships)) continue;
      if (failedAt.get(s.id) === u.packer.placements.length) continue;
      if (u.packer.place(p, s)) {
        placed.add(p.id);
        u.ships.add(s.id);
      } else failedAt.set(s.id, u.packer.placements.length);
    }
  };

  const diagnose = (p: Piece, g: GroupCtx): UnplacedPiece => {
    const s = ships.get(p.shipmentId)!;
    const prefs = typePrefs(p, s, g).filter((id) => typeLoadableOn(ac, id));
    const base = { pieceId: p.id, shipmentId: s.id };
    if (!prefs.length) return { ...base, code: 'type', reason: g.active ? `Needs an active container; none loadable on ${ac.short}` : `No eligible ULD type on ${ac.short}` };
    const elig = prefs.filter((id) => typeEligibility(s, ULD_BY_ID[id], g.regime, g.active) === null);
    const fit = elig.filter((id) => fitsType(s, s.orientation, ULD_BY_ID[id]));
    if (!fit.length) return { ...base, code: 'dims', reason: `${s.l}×${s.w}×${s.h} cm exceeds every eligible ULD contour (${elig.join(', ') || 'none'})` };
    const maxPay = Math.max(...fit.map((id) => Math.max(grossCap(ac, id, 'main'), grossCap(ac, id, 'lower')) - ULD_BY_ID[id].tare));
    if (s.weight > maxPay) return { ...base, code: 'weight', reason: `${s.weight.toLocaleString('en-US')} kg per piece exceeds the heaviest buildable ULD / position (${Math.round(maxPay).toLocaleString('en-US')} kg net)` };
    if (isCao(s) && !fit.some((id) => typeLoadableOn(ac, id, 'main'))) return { ...base, code: 'type', reason: 'Cargo-aircraft-only DG must be on the main deck; no main-deck ULD fits' };
    return { ...base, code: 'capacity', reason: `No ${ac.short} position capacity left for another ${fit[0]}` };
  };

  for (const { ctx: g, pieces: gp } of orderedGroups) {
    const sorted = opts.keys ? sortByKeys(gp, ships, opts.keys) : sortPieces(gp, ships, strat.order);
    const placed = new Set<string>();
    const unplacedIds = new Set<string>();
    const mine: OpenUld[] = [];

    const buildFrom = (pool: Piece[], restrictTo?: (typeId: string) => boolean) => {
      const deferred = new Set<string>();
      let guard = 0;
      while (guard++ < 600) {
        const lead = pool.find((p) => !placed.has(p.id) && !unplacedIds.has(p.id) && !deferred.has(p.id));
        if (!lead) return;
        const s = ships.get(lead.shipmentId)!;
        const prefs = typePrefs(lead, s, g).filter((id) => !restrictTo || restrictTo(id));
        let done = false;
        for (const typeId of prefs) {
          const t = ULD_BY_ID[typeId];
          const deck = budget.deckFor(typeId, g.passiveTemp ? 'lower' : 'any', isCao(s) || s.shc.includes('AVI'));
          if (!deck) continue;
          const cap = grossCap(ac, typeId, deck);
          if (!eligible(s, t, g, deck, cap)) continue;
          const u = openUld(typeId, g, deck);
          fill(u, pool, placed);
          if (u.packer.placements.length) {
            budget.take(typeId, deck);
            mine.push(u);
            done = true;
            break;
          }
        }
        if (!done) {
          if (restrictTo) {
            // leave this shipment for the unrestricted pass
            for (const p of pool) if (p.shipmentId === lead.shipmentId) deferred.add(p.id);
            continue;
          }
          unplacedIds.add(lead.id);
          unplaced.push(diagnose(lead, g));
        }
      }
    };

    // Phase A: skids, crates and big pieces drive pallet builds
    const big = sorted.filter((p) => !isSmall(p));
    buildFrom(big);
    // Phase B: top-up - loose cartons fill the voids left on the ULDs already built (fullest first)
    const small = sorted.filter((p) => isSmall(p));
    if (small.length && mine.length) {
      const byFill = [...mine].sort((a, b) => b.packer.net - a.packer.net);
      for (const u of byFill) fill(u, small, placed);
    }
    // Phase C: remaining loose cartons are containerised while lower-deck positions remain
    buildFrom(small.filter((p) => !placed.has(p.id)), (id) => ULD_BY_ID[id].kind === 'container');
    // Phase D: remaining pieces open new ULDs of any preferred type
    buildFrom(sorted.filter((p) => !placed.has(p.id)));
    // Phase E: consolidation - try to empty lightly used ULDs into the others
    consolidate(mine, placed, fill, budget);
    open.push(...mine);
  }

  // Rebalance: a build whose CG stays off-centre after centring is re-packed with the
  // CG-balanced rule; the better-balanced layout wins if every piece still fits.
  for (const u of open) rebalance(u, ships, opts.minSupport);

  const ulds = open.map((u) => {
    typeCount[u.type.id] = (typeCount[u.type.id] ?? 0) + 1;
    return finalize(u, typeCount[u.type.id], ships);
  });
  const kpis = computeKpis(ulds, unplaced, pieces, ships);
  return { strategy: opts.strategy, aircraftId: ac.id, ulds, unplaced, kpis, ms: Math.round(performance.now() - t0) };
}

function consolidate(
  mine: OpenUld[],
  placed: Set<string>,
  fill: (u: OpenUld, pool: Piece[], placed: Set<string>) => void,
  budget: Budget,
) {
  const util = (u: OpenUld) => Math.max(u.packer.net / (u.cap - u.type.tare), itemVol(u.packer.placements) / (usableVolumeM3(u.type) * 1e6));
  const candidates = [...mine].filter((u) => util(u) < 0.35).sort((a, b) => util(a) - util(b));
  for (const victim of candidates) {
    const others = mine.filter((u) => u !== victim);
    if (!others.length) continue;
    const snaps = others.map((u) => ({ u, s: u.packer.snapshot(), ships: new Set(u.ships) }));
    const pieces: Piece[] = victim.packer.placements.map((p) => ({ id: p.pieceId, shipmentId: p.shipmentId, index: 0, l: 0, w: 0, h: 0, weight: p.weight }));
    // rebuild piece dimensions from the placement boxes (orientation-free re-insertion)
    victim.packer.placements.forEach((p, i) => {
      pieces[i].l = p.w;
      pieces[i].w = p.d;
      pieces[i].h = p.h;
    });
    const tmpPlaced = new Set<string>();
    for (const u of others) fill(u, pieces, tmpPlaced);
    if (tmpPlaced.size === pieces.length) {
      const idx = mine.indexOf(victim);
      mine.splice(idx, 1);
      budget.take(victim.type.id, victim.deck, -1);
      for (const id of tmpPlaced) placed.add(id);
    } else {
      for (const { u, s, ships } of snaps) {
        u.packer.restore(s);
        u.ships = ships;
      }
    }
  }
}

function cgOffsetOf(t: UldType, pl: Placement[]): number {
  const W = pl.reduce((s, p) => s + p.weight, 0) + t.tare;
  const bottom = t.outline.filter((q) => q[1] === 0).map((q) => q[0]);
  const bx = (Math.min(...bottom) + Math.max(...bottom)) / 2;
  const cx = (pl.reduce((s, p) => s + p.weight * (p.x + p.w / 2), 0) + t.tare * bx) / W;
  const cz = (pl.reduce((s, p) => s + p.weight * (p.z + p.d / 2), 0) + (t.tare * t.external.depth) / 2) / W;
  return Math.max(Math.abs(cx - bx) / t.baseWidth, Math.abs(cz - t.external.depth / 2) / t.external.depth);
}

function rebalance(u: OpenUld, ships: Map<string, Shipment>, minSupport: number) {
  const t = u.type;
  const pl = u.packer.placements;
  if (!pl.length || pl.length > 40) return;
  const probe = pl.map((p) => ({ ...p }));
  centreLoad(t, probe);
  const before = cgOffsetOf(t, probe);
  if (before <= 0.08) return;
  const pieces: Piece[] = pl.map((p) => {
    const s = ships.get(p.shipmentId)!;
    return { id: p.pieceId, shipmentId: s.id, index: 0, l: s.l, w: s.w, h: s.h, weight: p.weight };
  });
  pieces.sort((a, b) => b.weight - a.weight || b.l * b.w * b.h - a.l * a.w * a.h);
  const alt = new UldPacker(t, { minSupport, score: 'balanced', heavyLow: 1, maxGross: u.cap });
  for (const p of pieces) if (!alt.place(p, ships.get(p.shipmentId)!)) return;
  const trial = alt.placements.map((p) => ({ ...p }));
  centreLoad(t, trial);
  if (cgOffsetOf(t, trial) < before - 0.01) u.packer = alt;
}

function itemVol(pl: Placement[]): number {
  return pl.reduce((s, p) => s + p.w * p.h * p.d, 0);
}

/**
 * Centre a partial load on its base: shift the whole block along z (always contour-safe, the
 * profile is extruded along z) and, where the contour allows, along x. A rigid translation keeps
 * every support and load-bearing relation intact.
 */
export function centreLoad(t: UldType, pl: Placement[]) {
  if (!pl.length) return;
  const W = pl.reduce((s, p) => s + p.weight, 0);
  const cgz = pl.reduce((s, p) => s + p.weight * (p.z + p.d / 2), 0) / W;
  const minZ = Math.min(...pl.map((p) => p.z)), maxZ = Math.max(...pl.map((p) => p.z + p.d));
  const cz = (t.zRange[0] + t.zRange[1]) / 2;
  const depth = t.zRange[1] - t.zRange[0];
  let dz = cz - cgz;
  if (t.kind === 'container') dz = Math.sign(dz) * Math.max(0, Math.abs(dz) - 0.06 * depth); // keep loads against the rear wall where possible
  dz = Math.min(Math.max(dz, t.zRange[0] - minZ), t.zRange[1] - maxZ);
  if (Math.abs(dz) > 0.5) for (const p of pl) p.z += dz;
  if (t.kind !== 'pallet') return;
  const cgx = pl.reduce((s, p) => s + p.weight * (p.x + p.w / 2), 0) / W;
  const bottom = t.outline.filter((q) => q[1] === 0).map((q) => q[0]);
  const bx = (Math.min(...bottom) + Math.max(...bottom)) / 2;
  const want = bx - cgx;
  const fits = (dx: number) => pl.every((p) => rectFitsProfile(t.profile, p.x + dx, p.x + p.w + dx, p.y, p.y + p.h, 0.05));
  let lo = 0, hi = 1;
  if (fits(want)) lo = 1;
  else for (let i = 0; i < 8; i++) { const mid = (lo + hi) / 2; if (fits(want * mid)) lo = mid; else hi = mid; }
  const dx = want * lo;
  if (Math.abs(dx) > 0.5) for (const p of pl) p.x += dx;
}

function finalize(u: OpenUld, n: number, ships: Map<string, Shipment>): BuiltUld {
  const t = u.type;
  const pl = u.packer.placements;
  centreLoad(t, pl);
  const net = pl.reduce((s, p) => s + p.weight, 0);
  // reference = centre of the ULD base (floor / pallet plate)
  const bottom = t.outline.filter((p) => p[1] === 0).map((p) => p[0]);
  const cx = (Math.min(...bottom) + Math.max(...bottom)) / 2;
  const cz = t.external.depth / 2;
  const tareY = t.kind === 'pallet' ? 1 : t.external.height * 0.45;
  let mx = t.tare * cx, my = t.tare * tareY, mz = t.tare * cz;
  for (const p of pl) {
    mx += p.weight * (p.x + p.w / 2);
    my += p.weight * (p.y + p.h / 2);
    mz += p.weight * (p.z + p.d / 2);
  }
  const gross = net + t.tare;
  const cg = { x: mx / gross, y: my / gross, z: mz / gross };
  const shipIds = [...new Set(pl.map((p) => p.shipmentId))];
  const shc = new Set<Shc>();
  const dg = new Set<string>();
  let cao = false;
  for (const id of shipIds) {
    const s = ships.get(id)!;
    s.shc.forEach((c) => shc.add(c));
    if (s.dg) dg.add(s.dg.cls);
    if (isCao(s)) cao = true;
  }
  const usable = usableVolumeM3(t);
  const vol = itemVol(pl) / 1e6;
  return {
    id: nextSerial(t, n),
    typeId: t.id,
    regime: u.group.regime,
    active: u.group.active,
    setpoint: u.group.active ? REGIME_SETPOINT[u.group.regime] : null,
    placements: pl,
    net,
    tare: t.tare,
    gross,
    cap: u.cap,
    itemVolM3: vol,
    usableM3: usable,
    volUtil: vol / usable,
    wtUtil: net / (u.cap - t.tare),
    cg,
    cgOffsetPct: { x: ((cg.x - cx) / t.baseWidth) * 100, z: ((cg.z - cz) / t.external.depth) * 100 },
    heightUsed: pl.reduce((m, p) => Math.max(m, p.y + p.h), 0),
    shipmentIds: shipIds,
    shc: [...shc],
    dgClasses: [...dg],
    cao,
    deckHint: u.deck,
    group: u.group.key,
  };
}

export function computeKpis(ulds: BuiltUld[], unplaced: UnplacedPiece[], pieces: Piece[], ships: Map<string, Shipment>): BuildKpis {
  const byType: Record<string, number> = {};
  let gross = 0, net = 0, tare = 0, vol = 0, usable = 0, payCap = 0, deck = 0, cgo = 0;
  for (const u of ulds) {
    byType[u.typeId] = (byType[u.typeId] ?? 0) + 1;
    gross += u.gross;
    net += u.net;
    tare += u.tare;
    vol += u.itemVolM3;
    usable += u.usableM3;
    payCap += u.cap - u.tare;
    deck += (DECK_METRES[u.typeId] ?? 1.6) * (u.deckHint === 'lower' && ULD_BY_ID[u.typeId].kind === 'pallet' ? 1.53 : 1);
    cgo += Math.hypot(u.cgOffsetPct.x, u.cgOffsetPct.z);
  }
  const placedIds = new Set(ulds.flatMap((u) => u.placements.map((p) => p.pieceId)));
  const unplacedKg = unplaced.reduce((s, u) => s + ships.get(u.shipmentId)!.weight, 0);
  // chargeable weight of what actually flies (pro-rata for split shipments)
  let chargeable = 0;
  for (const s of ships.values()) {
    const n = pieces.filter((p) => p.shipmentId === s.id && placedIds.has(p.id)).length;
    if (n) chargeable += (chargeableWeight(s) * n) / s.pieces;
  }
  const volUtil = usable ? vol / usable : 0;
  const cost = unplacedKg * 20 + deck * 600 + tare * 0.5 + (1 - volUtil) * 500;
  return {
    ulds: ulds.length,
    byType,
    pieces: pieces.length,
    placedPieces: placedIds.size,
    unplacedPieces: unplaced.length,
    unplacedKg,
    grossKg: gross,
    netKg: net,
    tareKg: tare,
    volUtil,
    wtUtil: payCap ? net / payCap : 0,
    chargeableKg: Math.round(chargeable),
    deckMetres: Math.round(deck * 100) / 100,
    cgOffsetAvg: ulds.length ? cgo / ulds.length : 0,
    cost: Math.round(cost),
  };
}
