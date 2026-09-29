/// <reference lib="webworker" />
import type { BuiltUld } from '../domain/packing/buildup';
import { CASES, StabilitySim, type StabilityResult } from '../physics/stability';

export type PhysicsRequest = { type: 'start'; runId: number; uld: BuiltUld; speed: number } | { type: 'stop' };

export type PhysicsResponse =
  | { type: 'frame'; runId: number; phase: 'settle' | 'case' | 'done'; caseIndex: number; t: number; g: [number, number, number]; transforms: Float32Array }
  | { type: 'case'; runId: number; caseIndex: number; movers: number }
  | { type: 'done'; runId: number; result: StabilityResult }
  | { type: 'error'; runId: number; message: string };

const scope = self as unknown as DedicatedWorkerGlobalScope;
let timer: ReturnType<typeof setTimeout> | null = null;

function stop() {
  if (timer) clearTimeout(timer);
  timer = null;
}

scope.onmessage = (ev: MessageEvent<PhysicsRequest>) => {
  const req = ev.data;
  if (req.type === 'stop') return stop();
  stop();
  const { runId } = req;
  try {
    const sim = new StabilitySim(req.uld);
    const stepsPerTick = Math.max(1, Math.round(4 * req.speed)); // 4 x 1/240 s = one 60 Hz frame
    let lastCases = 0;
    const tick = () => {
      const t0 = performance.now();
      const done = sim.step(stepsPerTick);
      const tr = sim.transforms();
      const buf = new Float32Array(tr.length * 7);
      tr.forEach((x, i) => buf.set([...x.p, ...x.q], i * 7));
      scope.postMessage({ type: 'frame', runId, phase: sim.phase, caseIndex: Math.min(sim.caseIndex, CASES.length - 1), t: sim.t, g: sim.currentG(), transforms: buf } satisfies PhysicsResponse, [buf.buffer]);
      if (sim.results.length !== lastCases) {
        lastCases = sim.results.length;
        const r = sim.results[lastCases - 1];
        scope.postMessage({ type: 'case', runId, caseIndex: lastCases - 1, movers: r.movers.length } satisfies PhysicsResponse);
      }
      if (done) {
        scope.postMessage({ type: 'done', runId, result: sim.summary() } satisfies PhysicsResponse);
        timer = null;
        return;
      }
      const spent = performance.now() - t0;
      timer = setTimeout(tick, Math.max(0, 16 - spent));
    };
    tick();
  } catch (e) {
    scope.postMessage({ type: 'error', runId, message: e instanceof Error ? e.message : String(e) } satisfies PhysicsResponse);
  }
};
