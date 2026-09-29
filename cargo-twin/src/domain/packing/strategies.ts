import type { Piece, Shipment } from '../cargo';
import type { ScoreRule } from './packer';

export type StrategyId = 'wall' | 'layer' | 'contact' | 'balanced' | 'ga';

export interface StrategyDef {
  id: StrategyId;
  name: string;
  short: string;
  description: string;
  tagline: string;
  score: ScoreRule;
  order: 'heavy' | 'height' | 'volume' | 'density';
}

export const STRATEGIES: StrategyDef[] = [
  {
    id: 'wall',
    name: 'Wall builder',
    short: 'Wall',
    description: 'Heavy-first order; fills from the rear wall towards the door/net, floor to ceiling, the way ramp agents build a ULD by hand.',
    tagline: 'Heavy first · back wall to door',
    score: 'wall',
    order: 'heavy',
  },
  {
    id: 'layer',
    name: 'Layer builder',
    short: 'Layer',
    description: 'Tallest-first order; completes a flat floor layer before stacking, which keeps stacks level and stable.',
    tagline: 'Tallest first · floor layer first',
    score: 'layer',
    order: 'height',
  },
  {
    id: 'contact',
    name: 'Max-contact EP',
    short: 'Contact',
    description: 'Largest-volume-first; every extreme point is scored by contact area with walls, floor and neighbours for tight packing.',
    tagline: 'Largest first · max contact area',
    score: 'contact',
    order: 'volume',
  },
  {
    id: 'balanced',
    name: 'CG-balanced',
    short: 'Balanced',
    description: 'Densest-first; placement penalises drift of the ULD centre of gravity away from the base centre.',
    tagline: 'Densest first · CG-centred',
    score: 'balanced',
    order: 'density',
  },
  {
    id: 'ga',
    name: 'Hybrid GA refinement',
    short: 'GA',
    description: 'Biased random-key genetic search over shipment order and placement rule, seeded with the greedy results (time-boxed).',
    tagline: 'Random-key GA · seeded, time-boxed',
    score: 'wall',
    order: 'heavy',
  },
];

export const STRATEGY_BY_ID = Object.fromEntries(STRATEGIES.map((s) => [s.id, s])) as Record<StrategyId, StrategyDef>;

/** Pieces that must end up on top (fragile / non-stackable) always go last. */
function topOnly(s: Shipment): number {
  return s.maxTopLoad <= 0 || s.shc.includes('FRG') ? 1 : 0;
}

export function sortPieces(pieces: Piece[], ships: Map<string, Shipment>, order: StrategyDef['order']): Piece[] {
  const key = (p: Piece): number => {
    const vol = p.l * p.w * p.h;
    switch (order) {
      case 'heavy':
        return -p.weight * 1e3 - vol * 1e-6;
      case 'height':
        return -p.h * 1e6 - p.l * p.w;
      case 'volume':
        return -vol;
      case 'density':
        return -(p.weight / vol) * 1e9;
    }
  };
  return [...pieces].sort((a, b) => {
    const sa = ships.get(a.shipmentId)!;
    const sb = ships.get(b.shipmentId)!;
    const t = topOnly(sa) - topOnly(sb);
    if (t) return t;
    const k = key(a) - key(b);
    if (Math.abs(k) > 1e-9) return k;
    if (a.shipmentId !== b.shipmentId) return a.shipmentId < b.shipmentId ? -1 : 1;
    return a.index - b.index;
  });
}

/** Order pieces by per-shipment random keys (GA decoder), keeping pieces of a shipment together. */
export function sortByKeys(pieces: Piece[], ships: Map<string, Shipment>, keys: Map<string, number>): Piece[] {
  return [...pieces].sort((a, b) => {
    const t = topOnly(ships.get(a.shipmentId)!) - topOnly(ships.get(b.shipmentId)!);
    if (t) return t;
    const k = (keys.get(a.shipmentId) ?? 0) - (keys.get(b.shipmentId) ?? 0);
    if (k) return k;
    return a.index - b.index;
  });
}
