import { buildOverlapMap, positionsAdjacent, type Aircraft, type Position } from './aircraft';
import { armFromMac, computeWb, inEnvelope, pctMac, positionIssue } from './balance';
import type { Shipment } from './cargo';
import { adjacencyConflict } from './rules';
import type { BuiltUld } from './packing/buildup';

// Aircraft load-plan optimiser: constraint-aware greedy construction around the target CG,
// followed by a deterministic move/swap local search on a weighted cost.

export interface PlanOptions {
  targetMac?: number;
  fuel: number;
  tripFuel: number;
  maxEvals?: number;
}

export interface PlanResult {
  assignments: Record<string, string>;
  unassigned: { uldId: string; reason: string }[];
  cost: number;
  evals: number;
  trace: number[];
}

export function feasiblePositions(u: BuiltUld, ac: Aircraft, ships: Map<string, Shipment>): Position[] {
  return ac.positions.filter((p) => positionIssue(p, u, ships) === null);
}

export function autoPlan(ulds: BuiltUld[], ac: Aircraft, ships: Map<string, Shipment>, opts: PlanOptions): PlanResult {
  const target = opts.targetMac ?? ac.targetMac;
  const overlaps = buildOverlapMap(ac);
  const feas = new Map(ulds.map((u) => [u.id, feasiblePositions(u, ac, ships)]));
  const occupied = new Map<string, string>(); // positionId -> uldId
  const where = new Map<string, string>(); // uldId -> positionId
  const blocked = (pid: string) => occupied.has(pid) || (overlaps.get(pid) ?? []).some((q) => occupied.has(q));

  const payload = ulds.reduce((s, u) => s + u.gross, 0);
  const targetArm = armFromMac(ac, target);
  const zfw = ac.dow + payload;
  // payload arm that puts the ZFW CG on target
  const wantArm = payload > 0 ? (targetArm * zfw - ac.dow * ac.dowArm) / payload : targetArm;

  // Tightly constrained ULDs first (few feasible positions), then heaviest first so heavy
  // builds can take the strong positions near the wing box.
  const tight = (u: BuiltUld) => Math.min(feas.get(u.id)!.length, 6);
  const order = [...ulds].sort((a, b) => tight(a) - tight(b) || b.gross - a.gross || (a.id < b.id ? -1 : 1));

  let m = 0, w = 0, latM = 0;
  const holdW: Record<string, number> = { MD: 0, FWD: 0, AFT: 0 };
  const holdLim = Object.fromEntries(ac.holds.map((h) => [h.id, h.maxWeight]));
  for (const u of order) {
    let best: Position | null = null;
    let bestScore = Infinity;
    for (const p of feas.get(u.id)!) {
      if (blocked(p.id)) continue;
      if (holdW[p.hold] + u.gross > holdLim[p.hold]) continue;
      const arm = (m + u.gross * p.arm) / (w + u.gross);
      // how many other positions this one would block (lower-deck pallets block 4 LD3s)
      const blocks = (overlaps.get(p.id) ?? []).filter((q) => !occupied.has(q)).length;
      const deckPref = u.deckHint === p.deck ? 0 : 3;
      const lateral = Math.abs(latM + u.gross * p.lat) / 1000;
      const score = Math.abs(arm - wantArm) * 10 + blocks * 1.2 + deckPref + lateral * 0.4;
      if (score < bestScore) {
        bestScore = score;
        best = p;
      }
    }
    if (best) {
      occupied.set(best.id, u.id);
      where.set(u.id, best.id);
      m += u.gross * best.arm;
      w += u.gross;
      latM += u.gross * best.lat;
      holdW[best.hold] += u.gross;
    }
  }

  // ---- local search ------------------------------------------------------------------
  const posById = new Map(ac.positions.map((p) => [p.id, p]));
  const uById = new Map(ulds.map((u) => [u.id, u]));
  const shipsOf = (u: BuiltUld) => u.shipmentIds.map((id) => ships.get(id)!).filter(Boolean);
  const adjPairs = new Map<string, string[]>();
  for (const p of ac.positions) adjPairs.set(p.id, ac.positions.filter((q) => positionsAdjacent(p, q)).map((q) => q.id));

  const inEnv = (mac: number, wt: number) => inEnvelope(ac.envelope, mac, wt);
  const cost = (): number => {
    let pay = 0, mom = 0, lat = 0;
    const hw: Record<string, number> = { MD: 0, FWD: 0, AFT: 0 };
    for (const [pid, uid] of occupied) {
      const p = posById.get(pid)!;
      const u = uById.get(uid)!;
      pay += u.gross;
      mom += u.gross * p.arm;
      lat += u.gross * p.lat;
      hw[p.hold] += u.gross;
    }
    const zw = ac.dow + pay;
    const zArm = (ac.dow * ac.dowArm + mom) / zw;
    const tw = zw + opts.fuel;
    const tArm = (zw * zArm + opts.fuel * ac.fuelArm) / tw;
    const zMac = pctMac(ac, zArm);
    const tMac = pctMac(ac, tArm);
    let c = (ulds.length - occupied.size) * 5000;
    c += (zMac - target) ** 2 * 40;
    c += (tMac - target) ** 2 * 10;
    if (pay > 0 && !inEnv(zMac, zw)) c += 20000;
    if (pay > 0 && !inEnv(tMac, tw)) c += 20000;
    c += (lat / ac.lateralLimit) ** 2 * 400;
    for (const h of ac.holds) if (hw[h.id] > h.maxWeight) c += (hw[h.id] - h.maxWeight) * 2;
    const special = (u: BuiltUld) => u.dgClasses.length > 0 || u.shc.includes('ICE') || u.shc.includes('AVI');
    for (const [pid, uid] of occupied) {
      const u = uById.get(uid)!;
      for (const q of adjPairs.get(pid) ?? []) {
        if (q <= pid) continue;
        const v = occupied.get(q);
        if (!v) continue;
        const uv = uById.get(v)!;
        if (!special(u) || !special(uv)) continue;
        if (adjacencyConflict(shipsOf(u), shipsOf(uv))) c += 800;
      }
    }
    return c;
  };

  let cur = cost();
  const trace = [cur];
  let evals = 1;
  const maxEvals = opts.maxEvals ?? 2500;
  let improved = true;
  while (improved && evals < maxEvals) {
    improved = false;
    // 1) insert unassigned / move to free positions
    for (const u of order) {
      if (evals >= maxEvals) break;
      const from = where.get(u.id);
      for (const p of feas.get(u.id)!) {
        if (p.id === from) continue;
        if (from) occupied.delete(from);
        const free = !blocked(p.id);
        if (!free) {
          if (from) occupied.set(from, u.id);
          continue;
        }
        occupied.set(p.id, u.id);
        const c = cost();
        evals++;
        if (c < cur - 1e-6) {
          cur = c;
          where.set(u.id, p.id);
          improved = true;
          break;
        }
        occupied.delete(p.id);
        if (from) occupied.set(from, u.id);
      }
    }
    // 2) swaps between loaded ULDs
    const loaded = order.filter((u) => where.has(u.id));
    for (let i = 0; i < loaded.length && evals < maxEvals; i++) {
      for (let j = i + 1; j < loaded.length && evals < maxEvals; j++) {
        const a = loaded[i], b = loaded[j];
        const pa = where.get(a.id)!, pb = where.get(b.id)!;
        if (a.typeId === b.typeId && Math.abs(a.gross - b.gross) < 50) continue;
        if (positionIssue(posById.get(pb)!, a, ships) || positionIssue(posById.get(pa)!, b, ships)) continue;
        occupied.set(pa, b.id);
        occupied.set(pb, a.id);
        const c = cost();
        evals++;
        if (c < cur - 1e-6) {
          cur = c;
          where.set(a.id, pb);
          where.set(b.id, pa);
          improved = true;
        } else {
          occupied.set(pa, a.id);
          occupied.set(pb, b.id);
        }
      }
    }
    trace.push(cur);
  }

  const assignments = Object.fromEntries(occupied);
  const unassigned = ulds
    .filter((u) => !where.has(u.id))
    .map((u) => ({
      uldId: u.id,
      reason: feas.get(u.id)!.length ? 'All compatible positions are taken or blocked' : `No ${ac.short} position accepts ${u.typeId} at ${Math.round(u.gross)} kg`,
    }));
  return { assignments, unassigned, cost: Math.round(cur), evals, trace };
}

export function planSummary(ac: Aircraft, ulds: BuiltUld[], assignments: Record<string, string>, ships: Map<string, Shipment>, fuel: number, trip: number) {
  const wb = computeWb({ ac, ulds, assignments, fuel, tripFuel: trip, ships });
  return { wb, zfwMac: pctMac(ac, wb.zfwArm) };
}
