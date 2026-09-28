import type { Aircraft } from '../aircraft';
import type { Shipment } from '../cargo';
import { mulberry32 } from '../rng';
import { buildUp, type BuildResult } from './buildup';
import type { ScoreRule } from './packer';
import { sortPieces, STRATEGIES, type StrategyId } from './strategies';
import { allPieces } from '../cargo';

// Biased random-key GA (after Gonçalves & Resende) over shipment order + placement rule.
// Chromosome: one key per shipment (sort order) and one gene choosing the scoring rule.
// Decoder: the full multi-ULD build-up. Seeded with the greedy strategies so it never
// does worse than the best greedy result; time-boxed so it stays interactive.

interface Individual {
  keys: number[];
  rule: number;
  cost: number;
  result: BuildResult;
}

const RULES: ScoreRule[] = ['wall', 'layer', 'contact', 'balanced'];

export interface GaOptions {
  minSupport: number;
  timeMs: number;
  seed: number;
  popSize?: number;
  onGeneration?: (gen: number, best: number) => void;
}

export function runGa(manifest: { shipments: Shipment[] }, ac: Aircraft, opts: GaOptions, seeds?: BuildResult[]): BuildResult {
  const t0 = performance.now();
  const rnd = mulberry32(opts.seed);
  const ids = manifest.shipments.map((s) => s.id);
  const ships = new Map(manifest.shipments.map((s) => [s.id, s]));
  const pop = opts.popSize ?? 8;
  const elite = Math.max(2, Math.round(pop * 0.25));
  const mutants = Math.max(1, Math.round(pop * 0.15));

  const decode = (keys: number[], rule: number): Individual => {
    const map = new Map(ids.map((id, i) => [id, keys[i]]));
    const result = buildUp(manifest, ac, { strategy: 'ga', minSupport: opts.minSupport, keys: map, scoreOverride: RULES[rule] });
    return { keys, rule, cost: result.kpis.cost, result };
  };

  // seeds: the key vectors implied by each greedy ordering
  const population: Individual[] = [];
  const pieces = allPieces(manifest);
  for (const s of STRATEGIES.filter((x) => x.id !== 'ga')) {
    const order = sortPieces(pieces, ships, s.order);
    const rank = new Map<string, number>();
    order.forEach((p, i) => {
      if (!rank.has(p.shipmentId)) rank.set(p.shipmentId, i / order.length);
    });
    const keys = ids.map((id) => rank.get(id) ?? 1);
    const seeded = seeds?.find((r) => r.strategy === s.id);
    if (seeded) population.push({ keys, rule: RULES.indexOf(s.score), cost: seeded.kpis.cost, result: seeded });
    else population.push(decode(keys, RULES.indexOf(s.score)));
  }
  while (population.length < pop) population.push(decode(ids.map(() => rnd()), Math.floor(rnd() * RULES.length)));
  population.sort((a, b) => a.cost - b.cost);
  const trace = [population[0].cost];
  let gen = 0;
  while (performance.now() - t0 < opts.timeMs && gen < 60) {
    gen++;
    const next: Individual[] = population.slice(0, elite);
    for (let i = 0; i < mutants; i++) next.push(decode(ids.map(() => rnd()), Math.floor(rnd() * RULES.length)));
    while (next.length < pop && performance.now() - t0 < opts.timeMs * 1.1) {
      const a = population[Math.floor(rnd() * elite)];
      const b = population[elite + Math.floor(rnd() * (population.length - elite))] ?? population[population.length - 1];
      // biased crossover + small perturbation so ties between identical shipments can break
      const keys = ids.map((_, k) => (rnd() < 0.7 ? a.keys[k] : b.keys[k]) + (rnd() < 0.1 ? (rnd() - 0.5) * 0.1 : 0));
      next.push(decode(keys, rnd() < 0.8 ? a.rule : b.rule));
    }
    population.splice(0, population.length, ...next.sort((x, y) => x.cost - y.cost));
    trace.push(population[0].cost);
    opts.onGeneration?.(gen, population[0].cost);
  }
  const best = population[0].result;
  return { ...best, strategy: 'ga' as StrategyId, ms: Math.round(performance.now() - t0), gaTrace: trace };
}
