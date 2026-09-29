/// <reference lib="webworker" />
import { aircraftById } from '../domain/aircraft';
import type { Manifest } from '../domain/cargo';
import { buildUp, type BuildResult } from '../domain/packing/buildup';
import { runGa } from '../domain/packing/ga';
import { STRATEGIES, type StrategyId } from '../domain/packing/strategies';
import { autoPlan } from '../domain/planner';
import type { BuiltUld } from '../domain/packing/buildup';

export type EngineRequest =
  | { type: 'build'; id: number; manifest: Manifest; aircraftId: string; strategy: StrategyId; minSupport: number; gaMs: number }
  | { type: 'compare'; id: number; manifest: Manifest; aircraftId: string; minSupport: number; gaMs: number }
  | { type: 'plan'; id: number; manifest: Manifest; aircraftId: string; ulds: BuiltUld[]; fuel: number; tripFuel: number; targetMac: number };

export type EngineResponse =
  | { type: 'build'; id: number; result: BuildResult }
  | { type: 'compare'; id: number; results: BuildResult[] }
  | { type: 'plan'; id: number; result: ReturnType<typeof autoPlan> }
  | { type: 'progress'; id: number; label: string; frac: number }
  | { type: 'error'; id: number; message: string };

const post = (m: EngineResponse) => (self as unknown as DedicatedWorkerGlobalScope).postMessage(m);

self.onmessage = (ev: MessageEvent<EngineRequest>) => {
  const req = ev.data;
  try {
    if (req.type === 'build') {
      const ac = aircraftById(req.aircraftId);
      let result: BuildResult;
      if (req.strategy === 'ga') {
        const seeds = STRATEGIES.filter((s) => s.id !== 'ga').map((s) => buildUp(req.manifest, ac, { strategy: s.id, minSupport: req.minSupport }));
        result = runGa(req.manifest, ac, { minSupport: req.minSupport, timeMs: req.gaMs, seed: 20251101, onGeneration: (g) => post({ type: 'progress', id: req.id, label: `GA generation ${g}`, frac: 0.5 }) }, seeds);
      } else {
        result = buildUp(req.manifest, ac, { strategy: req.strategy, minSupport: req.minSupport });
      }
      post({ type: 'build', id: req.id, result });
    } else if (req.type === 'compare') {
      const ac = aircraftById(req.aircraftId);
      const greedy: BuildResult[] = [];
      const list = STRATEGIES.filter((s) => s.id !== 'ga');
      list.forEach((s, i) => {
        post({ type: 'progress', id: req.id, label: `Packing with ${s.name}`, frac: i / (list.length + 2) });
        greedy.push(buildUp(req.manifest, ac, { strategy: s.id, minSupport: req.minSupport }));
      });
      const t0 = performance.now();
      const ga = runGa(req.manifest, ac, {
        minSupport: req.minSupport,
        timeMs: req.gaMs,
        seed: 20251101,
        onGeneration: (g) => post({ type: 'progress', id: req.id, label: `GA refinement — generation ${g}`, frac: (list.length + Math.min(1.5, (performance.now() - t0) / req.gaMs)) / (list.length + 2) }),
      }, greedy);
      post({ type: 'compare', id: req.id, results: [...greedy, ga] });
    } else if (req.type === 'plan') {
      const ac = aircraftById(req.aircraftId);
      const ships = new Map(req.manifest.shipments.map((s) => [s.id, s]));
      const result = autoPlan(req.ulds, ac, ships, { fuel: req.fuel, tripFuel: req.tripFuel, targetMac: req.targetMac });
      post({ type: 'plan', id: req.id, result });
    }
  } catch (e) {
    post({ type: 'error', id: req.id, message: e instanceof Error ? e.message : String(e) });
  }
};
