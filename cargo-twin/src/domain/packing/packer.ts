import { allowedXRange, boundsOf, footprintOverlap, sliceAt, type Box } from '../geometry';
import type { Orientation, Piece, Shipment } from '../cargo';
import type { UldType } from '../uld';

// Extreme-point 3D packer for one contoured ULD (after Crainic, Perboli & Tadei 2008),
// extended with: contour clipping, gravity drop, minimum support ratio, load-bearing
// propagation, orientation locks and strategy-specific placement scoring.

export type ScoreRule = 'wall' | 'layer' | 'contact' | 'balanced';

export interface PackParams {
  minSupport: number; // fraction of the base that must rest on something (0..1)
  score: ScoreRule;
  heavyLow: number; // penalty weight for lifting heavy pieces (kg*cm)
  maxGross: number; // gross cap for this build (<= type MGW)
}

export interface Placement extends Box {
  pieceId: string;
  shipmentId: string;
  weight: number;
  seq: number;
  supportRatio: number;
  supports: { idx: number; area: number }[];
  loadOnTop: number;
  maxTopLoad: number;
}

export interface PackerSnapshot {
  placements: Placement[];
  net: number;
  eps: [number, number, number][];
  cg: { x: number; z: number };
}

export interface Candidate extends Box {
  score: number;
  supports: { idx: number; area: number }[];
  supportRatio: number;
}

const TOL = 0.05; // cm tolerance for touching surfaces

/** Allowed orientations as [sx, sy, sz] (size along x, y (up), z). */
export function orientationsOf(p: Pick<Piece, 'l' | 'w' | 'h'>, mode: Orientation): [number, number, number][] {
  const { l, w, h } = p;
  let list: [number, number, number][];
  if (mode === 'fixed') list = [[l, h, w]];
  else if (mode === 'upright') list = [[l, h, w], [w, h, l]];
  else list = [[l, h, w], [w, h, l], [l, w, h], [h, w, l], [w, l, h], [h, l, w]];
  const seen = new Set<string>();
  return list.filter((o) => {
    const k = o.join('x');
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/** Can a piece physically fit an empty ULD of this type (standing on the floor) in some allowed orientation? */
export function fitsType(p: Pick<Piece, 'l' | 'w' | 'h'>, mode: Orientation, t: UldType): boolean {
  const b = boundsOf(t.profile);
  const depth = t.zRange[1] - t.zRange[0];
  for (const [sx, sy, sz] of orientationsOf(p, mode)) {
    if (sz > depth + 0.01) continue;
    const r = allowedXRange(t.profile, b.minY, b.minY + sy);
    if (r && r[1] - r[0] >= sx - 0.01) return true;
  }
  return false;
}

export class UldPacker {
  readonly type: UldType;
  readonly params: PackParams;
  placements: Placement[] = [];
  net = 0;
  private eps: [number, number, number][] = [];
  private floorY: number;
  private topY: number;
  private zMin: number;
  private zMax: number;
  private payload: number;
  private cgMoment = { x: 0, z: 0 };
  private centre: { x: number; z: number };

  constructor(type: UldType, params: PackParams) {
    this.type = type;
    this.params = params;
    const b = boundsOf(type.profile);
    this.floorY = b.minY;
    this.topY = b.maxY;
    this.zMin = type.zRange[0];
    this.zMax = type.zRange[1];
    this.payload = Math.min(params.maxGross, type.maxGross) - type.tare;
    const floor = sliceAt(type.profile, this.floorY + 0.01)!;
    this.eps.push([floor[0], this.floorY, this.zMin]);
    const ob = boundsOf(type.outline);
    this.centre = { x: (ob.minX + ob.maxX) / 2, z: (this.zMin + this.zMax) / 2 };
  }

  get remainingPayload(): number {
    return this.payload - this.net;
  }

  /** Try to place a piece; commits and returns true on success. */
  place(piece: Piece, ship: Shipment): boolean {
    const c = this.findBest(piece, ship);
    if (!c) return false;
    this.commit(piece, ship, c);
    return true;
  }

  findBest(piece: Piece, ship: Shipment): Candidate | null {
    if (piece.weight > this.remainingPayload + 1e-6) return null;
    const orients = orientationsOf(piece, ship.orientation);
    let best: Candidate | null = null;
    for (const ep of this.eps) {
      for (const [sx, sy, sz] of orients) {
        const cand = this.evaluate(ep, sx, sy, sz, piece.weight);
        if (cand && (!best || cand.score < best.score)) best = cand;
      }
    }
    return best;
  }

  private restingY(x: number, z: number, w: number, d: number, below: number): number {
    let y = this.floorY;
    for (const p of this.placements) {
      const top = p.y + p.h;
      if (top > below + TOL) continue;
      if (x < p.x + p.w - TOL && p.x < x + w - TOL && z < p.z + p.d - TOL && p.z < z + d - TOL) {
        if (top > y) y = top;
      }
    }
    return y;
  }

  private collides(b: Box): boolean {
    for (const p of this.placements) {
      if (
        b.x < p.x + p.w - TOL && p.x < b.x + b.w - TOL &&
        b.y < p.y + p.h - TOL && p.y < b.y + b.h - TOL &&
        b.z < p.z + p.d - TOL && p.z < b.z + b.d - TOL
      ) return true;
    }
    return false;
  }

  private evaluate(ep: [number, number, number], sx: number, sy: number, sz: number, weight: number): Candidate | null {
    let x = ep[0];
    const epY = ep[1];
    const z = ep[2];
    if (z < this.zMin - TOL || z + sz > this.zMax + TOL) return null;
    if (epY + sy > this.topY + TOL) return null;
    let y = this.restingY(x, z, sx, sz, epY);
    // contour clipping: slide laterally into the allowed band for [y, y+sy], re-drop, re-check
    let ok = false;
    for (let iter = 0; iter < 3; iter++) {
      const r = allowedXRange(this.type.profile, y, y + sy);
      if (!r || r[1] - r[0] < sx - TOL) return null;
      const nx = Math.min(Math.max(x, r[0]), r[1] - sx);
      if (Math.abs(nx - x) < 1e-6) {
        ok = true;
        break;
      }
      x = nx;
      y = this.restingY(x, z, sx, sz, epY);
    }
    if (!ok) return null;
    if (y + sy > this.topY + TOL) return null;
    const box: Box = { x, y, z, w: sx, h: sy, d: sz };
    if (this.collides(box)) return null;
    // support
    const area = sx * sz;
    let supported = 0;
    const supports: { idx: number; area: number }[] = [];
    if (y <= this.floorY + TOL) {
      supported = area;
    } else {
      for (let i = 0; i < this.placements.length; i++) {
        const p = this.placements[i];
        if (Math.abs(p.y + p.h - y) > TOL) continue;
        const a = footprintOverlap(box, p);
        if (a <= 0.01) continue;
        if (p.maxTopLoad <= 0) return null; // non-stackable piece underneath
        supports.push({ idx: i, area: a });
        supported += a;
      }
    }
    const ratio = supported / area;
    if (ratio < this.params.minSupport - 1e-9) return null;
    if (supports.length && !this.loadOk(supports, weight)) return null;
    return { ...box, supports, supportRatio: Math.min(1, ratio), score: this.score(box, weight, supports) };
  }

  /** Load-bearing check: distribute weight to supports by contact area, propagate downwards. */
  private loadOk(supports: { idx: number; area: number }[], weight: number): boolean {
    const delta = this.loadDelta(supports, weight);
    for (const [i, add] of delta) {
      const p = this.placements[i];
      if (p.loadOnTop + add > p.maxTopLoad + 1e-6) return false;
    }
    return true;
  }

  loadDelta(supports: { idx: number; area: number }[], weight: number): Map<number, number> {
    const delta = new Map<number, number>();
    const push = (sups: { idx: number; area: number }[], w: number) => {
      const tot = sups.reduce((s, q) => s + q.area, 0);
      if (tot <= 0) return;
      for (const s of sups) {
        const share = (w * s.area) / tot;
        delta.set(s.idx, (delta.get(s.idx) ?? 0) + share);
        const below = this.placements[s.idx].supports;
        if (below.length) push(below, share);
      }
    };
    push(supports, weight);
    return delta;
  }

  /**
   * Residual-space waste: gaps left to the next obstacle along +x and +z that are too narrow
   * for any remaining piece are counted as waste (best-fit merit, after Crainic et al.).
   */
  private waste(b: Box): number {
    const r = allowedXRange(this.type.profile, b.y, b.y + b.h);
    let gx = r ? r[1] - (b.x + b.w) : 0;
    let gz = this.zMax - (b.z + b.d);
    for (const p of this.placements) {
      if (p.y >= b.y + b.h - TOL || p.y + p.h <= b.y + TOL) continue;
      const zOver = p.z < b.z + b.d - TOL && p.z + p.d > b.z + TOL;
      const xOver = p.x < b.x + b.w - TOL && p.x + p.w > b.x + TOL;
      if (zOver && p.x >= b.x + b.w - TOL) gx = Math.min(gx, p.x - (b.x + b.w));
      if (xOver && p.z >= b.z + b.d - TOL) gz = Math.min(gz, p.z - (b.z + b.d));
    }
    const m = this.minDim;
    return (gx > TOL && gx < m ? gx : 0) + (gz > TOL && gz < m ? gz : 0);
  }

  /** Smallest dimension among pieces still to come (set by the build-up); used by the waste merit. */
  minDim = 30;

  private score(b: Box, weight: number, supports: { idx: number; area: number }[]): number {
    const heavy = this.params.heavyLow * weight * (b.y - this.floorY) * 1e-3;
    const waste = this.waste(b);
    switch (this.params.score) {
      case 'wall':
        return Math.round(b.z) * 1e4 + Math.round(b.y) * 1e2 + b.x + heavy + waste * 4;
      case 'layer':
        return Math.round(b.y) * 1e4 + Math.round(b.z) * 1e2 + b.x + heavy + waste * 4;
      case 'contact':
        return -this.contact(b, supports) * 0.02 + b.y * 3 + b.z * 0.5 + heavy + waste * 30;
      case 'balanced': {
        const nx = this.cgMoment.x + weight * (b.x + b.w / 2);
        const nz = this.cgMoment.z + weight * (b.z + b.d / 2);
        const m = this.net + weight;
        const dev = Math.hypot(nx / m - this.centre.x, nz / m - this.centre.z);
        return b.y * 60 + dev * 25 + b.z * 2 + heavy + waste * 20;
      }
    }
  }

  /** Contact area of the candidate with floor, walls and neighbours. */
  private contact(b: Box, supports: { idx: number; area: number }[]): number {
    let c = 0;
    if (b.y <= this.floorY + TOL) c += b.w * b.d;
    else c += supports.reduce((s, q) => s + q.area, 0);
    if (b.z <= this.zMin + TOL) c += b.w * b.h;
    if (b.z + b.d >= this.zMax - TOL) c += b.w * b.h;
    const r = allowedXRange(this.type.profile, b.y, b.y + b.h);
    if (r) {
      if (b.x <= r[0] + TOL) c += b.h * b.d;
      if (b.x + b.w >= r[1] - TOL) c += b.h * b.d;
    }
    for (const p of this.placements) {
      const oy = Math.min(b.y + b.h, p.y + p.h) - Math.max(b.y, p.y);
      if (oy <= 0) continue;
      if (Math.abs(p.x + p.w - b.x) < TOL || Math.abs(b.x + b.w - p.x) < TOL) {
        const oz = Math.min(b.z + b.d, p.z + p.d) - Math.max(b.z, p.z);
        if (oz > 0) c += oy * oz;
      }
      if (Math.abs(p.z + p.d - b.z) < TOL || Math.abs(b.z + b.d - p.z) < TOL) {
        const ox = Math.min(b.x + b.w, p.x + p.w) - Math.max(b.x, p.x);
        if (ox > 0) c += oy * ox;
      }
    }
    return c;
  }

  commit(piece: Piece, ship: Shipment, c: Candidate): Placement {
    const delta = this.loadDelta(c.supports, piece.weight);
    for (const [i, add] of delta) this.placements[i].loadOnTop += add;
    const pl: Placement = {
      x: c.x, y: c.y, z: c.z, w: c.w, h: c.h, d: c.d,
      pieceId: piece.id,
      shipmentId: ship.id,
      weight: piece.weight,
      seq: this.placements.length + 1,
      supportRatio: c.supportRatio,
      supports: c.supports,
      loadOnTop: 0,
      maxTopLoad: ship.maxTopLoad,
    };
    this.placements.push(pl);
    this.net += piece.weight;
    this.cgMoment.x += piece.weight * (c.x + c.w / 2);
    this.cgMoment.z += piece.weight * (c.z + c.d / 2);
    this.updateEps(pl);
    return pl;
  }

  private insideAny(x: number, y: number, z: number): boolean {
    for (const p of this.placements) {
      if (x >= p.x - TOL && x < p.x + p.w - TOL && y >= p.y - TOL && y < p.y + p.h - TOL && z >= p.z - TOL && z < p.z + p.d - TOL) return true;
    }
    return false;
  }

  private projDown(x: number, y: number, z: number): number {
    let best = this.floorY;
    for (const p of this.placements) {
      const top = p.y + p.h;
      if (top <= y + TOL && top > best && x >= p.x - TOL && x < p.x + p.w - TOL && z >= p.z - TOL && z < p.z + p.d - TOL) best = top;
    }
    return best;
  }

  private projBack(x: number, y: number, z: number): number {
    let best = this.zMin;
    for (const p of this.placements) {
      const f = p.z + p.d;
      if (f <= z + TOL && f > best && x >= p.x - TOL && x < p.x + p.w - TOL && y >= p.y - TOL && y < p.y + p.h - TOL) best = f;
    }
    return best;
  }

  private projLeft(x: number, y: number, z: number): number {
    const s = sliceAt(this.type.profile, Math.min(this.topY, y + 0.01));
    let best = s ? s[0] : 0;
    for (const p of this.placements) {
      const r = p.x + p.w;
      if (r <= x + TOL && r > best && y >= p.y - TOL && y < p.y + p.h - TOL && z >= p.z - TOL && z < p.z + p.d - TOL) best = r;
    }
    return best;
  }

  private updateEps(b: Placement) {
    const { x, y, z, w, h, d } = b;
    const pts: [number, number, number][] = [
      [x + w, y, z],
      [x + w, this.projDown(x + w, y, z), z],
      [x + w, y, this.projBack(x + w, y, z)],
      [x, y + h, z],
      [this.projLeft(x, y + h, z), y + h, z],
      [x, y + h, this.projBack(x, y + h, z)],
      [x, y, z + d],
      [this.projLeft(x, y, z + d), y, z + d],
      [x, this.projDown(x, y, z + d), z + d],
    ];
    const next: [number, number, number][] = [];
    const seen = new Set<string>();
    const add = (p: [number, number, number]) => {
      if (p[1] >= this.topY - 1 || p[2] >= this.zMax - 1) return;
      const s = sliceAt(this.type.profile, p[1] + 0.01);
      if (!s || p[0] >= s[1] - 1) return;
      if (this.insideAny(p[0], p[1], p[2])) return;
      const k = `${Math.round(p[0] * 10)}|${Math.round(p[1] * 10)}|${Math.round(p[2] * 10)}`;
      if (seen.has(k)) return;
      seen.add(k);
      next.push(p);
    };
    for (const p of this.eps) add(p);
    for (const p of pts) add(p);
    this.eps = next;
  }

  snapshot(): PackerSnapshot {
    return {
      placements: this.placements.map((p) => ({ ...p, supports: p.supports.map((q) => ({ ...q })) })),
      net: this.net,
      eps: this.eps.map((e) => [e[0], e[1], e[2]] as [number, number, number]),
      cg: { ...this.cgMoment },
    };
  }

  restore(s: PackerSnapshot) {
    this.placements = s.placements.map((p) => ({ ...p, supports: p.supports.map((q) => ({ ...q })) }));
    this.net = s.net;
    this.eps = s.eps.map((e) => [e[0], e[1], e[2]] as [number, number, number]);
    this.cgMoment = { ...s.cg };
  }

  get extremePointCount(): number {
    return this.eps.length;
  }
}
