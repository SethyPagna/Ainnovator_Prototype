import type { EngineRequest, EngineResponse } from '../workers/engine.worker';
import { aircraftById } from '../domain/aircraft';
import { buildUp } from '../domain/packing/buildup';
import { runGa } from '../domain/packing/ga';
import { STRATEGIES } from '../domain/packing/strategies';
import { autoPlan } from '../domain/planner';
import type { PhysicsRequest, PhysicsResponse } from '../workers/physics.worker';

type Pending = { resolve: (v: EngineResponse) => void; reject: (e: Error) => void; onProgress?: (label: string, frac: number) => void };

let engine: Worker | null = null;
let inline = false; // fall back to the main thread when workers are unavailable
const pending = new Map<number, Pending>();
const queued = new Map<number, EngineRequest>();
let nextId = 1;

function getEngine(): Worker | null {
  if (engine || inline) return engine;
  try {
    engine = new Worker(new URL('../workers/engine.worker.ts', import.meta.url), { type: 'module' });
  } catch {
    inline = true;
    return null;
  }
  engine.onmessage = (ev: MessageEvent<EngineResponse>) => {
    const msg = ev.data;
    const p = pending.get(msg.id);
    if (!p) return;
    if (msg.type === 'progress') return p.onProgress?.(msg.label, msg.frac);
    pending.delete(msg.id);
    queued.delete(msg.id);
    if (msg.type === 'error') p.reject(new Error(msg.message));
    else p.resolve(msg);
  };
  engine.onerror = (e) => {
    // module workers can fail to start (e.g. in some sandboxes): retry the queued jobs inline
    e.preventDefault?.();
    inline = true;
    engine?.terminate();
    engine = null;
    for (const [id, p] of pending) {
      const req = queued.get(id);
      if (req) runInline(req, p.onProgress).then(p.resolve, p.reject);
      else p.reject(new Error(e.message || 'Engine worker failed'));
    }
    pending.clear();
    queued.clear();
  };
  return engine;
}

type Req<T extends EngineRequest['type']> = Omit<Extract<EngineRequest, { type: T }>, 'id'>;

export function callEngine<T extends EngineRequest['type']>(req: Req<T>, onProgress?: (label: string, frac: number) => void): Promise<Extract<EngineResponse, { type: T }>> {
  const id = nextId++;
  const w = getEngine();
  if (!w) return runInline({ ...req, id } as unknown as EngineRequest, onProgress) as Promise<Extract<EngineResponse, { type: T }>>;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve: resolve as (v: EngineResponse) => void, reject, onProgress });
    const full = { ...req, id } as unknown as EngineRequest;
    queued.set(id, full);
    w.postMessage(full);
  });
}

/** Main-thread fallback (e.g. a sandboxed iframe that blocks module workers). */
async function runInline(req: EngineRequest, onProgress?: (label: string, frac: number) => void): Promise<EngineResponse> {
  await new Promise((r) => setTimeout(r, 0));
  const ac = aircraftById(req.aircraftId);
  if (req.type === 'build') {
    const result = req.strategy === 'ga'
      ? runGa(req.manifest, ac, { minSupport: req.minSupport, timeMs: Math.min(req.gaMs, 1200), seed: 20251101 })
      : buildUp(req.manifest, ac, { strategy: req.strategy, minSupport: req.minSupport });
    return { type: 'build', id: req.id, result };
  }
  if (req.type === 'compare') {
    const greedy = STRATEGIES.filter((s) => s.id !== 'ga').map((s) => {
      onProgress?.(`Packing with ${s.name}`, 0.5);
      return buildUp(req.manifest, ac, { strategy: s.id, minSupport: req.minSupport });
    });
    const ga = runGa(req.manifest, ac, { minSupport: req.minSupport, timeMs: Math.min(req.gaMs, 1200), seed: 20251101 }, greedy);
    return { type: 'compare', id: req.id, results: [...greedy, ga] };
  }
  const ships = new Map(req.manifest.shipments.map((s) => [s.id, s]));
  return { type: 'plan', id: req.id, result: autoPlan(req.ulds, ac, ships, { fuel: req.fuel, tripFuel: req.tripFuel, targetMac: req.targetMac }) };
}

// ---- physics ----------------------------------------------------------------------------
let physics: Worker | null = null;
let physicsInline = false;
let physicsListener: ((m: PhysicsResponse) => void) | null = null;
let inlineTimer: ReturnType<typeof setTimeout> | null = null;

export function getPhysics(): Worker | null {
  if (physics || physicsInline) return physics;
  try {
    physics = new Worker(new URL('../workers/physics.worker.ts', import.meta.url), { type: 'module' });
    physics.onmessage = (ev: MessageEvent<PhysicsResponse>) => physicsListener?.(ev.data);
    physics.onerror = (e) => {
      e.preventDefault?.();
      physicsInline = true;
      physics?.terminate();
      physics = null;
      if (lastStart) runPhysicsInline(lastStart);
    };
  } catch {
    physicsInline = true;
  }
  return physics;
}

let lastStart: Extract<PhysicsRequest, { type: 'start' }> | null = null;

/** Main-thread fallback with the same message protocol as the worker. */
async function runPhysicsInline(req: Extract<PhysicsRequest, { type: 'start' }>) {
  const { StabilitySim, CASES } = await import('../physics/stability');
  if (inlineTimer) clearTimeout(inlineTimer);
  const sim = new StabilitySim(req.uld);
  let lastCases = 0;
  const tick = () => {
    const done = sim.step(Math.max(1, Math.round(4 * req.speed)));
    const tr = sim.transforms();
    const buf = new Float32Array(tr.length * 7);
    tr.forEach((x, i) => buf.set([...x.p, ...x.q], i * 7));
    physicsListener?.({ type: 'frame', runId: req.runId, phase: sim.phase, caseIndex: Math.min(sim.caseIndex, CASES.length - 1), t: sim.t, g: sim.currentG(), transforms: buf });
    if (sim.results.length !== lastCases) {
      lastCases = sim.results.length;
      physicsListener?.({ type: 'case', runId: req.runId, caseIndex: lastCases - 1, movers: sim.results[lastCases - 1].movers.length });
    }
    if (done) {
      physicsListener?.({ type: 'done', runId: req.runId, result: sim.summary() });
      inlineTimer = null;
      return;
    }
    inlineTimer = setTimeout(tick, 16);
  };
  tick();
}

export function startPhysics(req: Extract<PhysicsRequest, { type: 'start' }>, listener: (m: PhysicsResponse) => void) {
  physicsListener = listener;
  lastStart = req;
  const w = getPhysics();
  if (w) w.postMessage(req);
  else runPhysicsInline(req);
}

export function stopPhysics() {
  physics?.postMessage({ type: 'stop' } satisfies PhysicsRequest);
  if (inlineTimer) clearTimeout(inlineTimer);
  inlineTimer = null;
  physicsListener = null;
}
