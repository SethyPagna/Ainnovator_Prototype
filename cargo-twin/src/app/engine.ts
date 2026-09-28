import type { EngineRequest, EngineResponse } from '../workers/engine.worker';
import type { PhysicsRequest, PhysicsResponse } from '../workers/physics.worker';

type Pending = { resolve: (v: EngineResponse) => void; reject: (e: Error) => void; onProgress?: (label: string, frac: number) => void };

let engine: Worker | null = null;
const pending = new Map<number, Pending>();
let nextId = 1;

function getEngine(): Worker {
  if (engine) return engine;
  engine = new Worker(new URL('../workers/engine.worker.ts', import.meta.url), { type: 'module' });
  engine.onmessage = (ev: MessageEvent<EngineResponse>) => {
    const msg = ev.data;
    const p = pending.get(msg.id);
    if (!p) return;
    if (msg.type === 'progress') return p.onProgress?.(msg.label, msg.frac);
    pending.delete(msg.id);
    if (msg.type === 'error') p.reject(new Error(msg.message));
    else p.resolve(msg);
  };
  engine.onerror = (e) => {
    for (const p of pending.values()) p.reject(new Error(e.message || 'Engine worker failed'));
    pending.clear();
  };
  return engine;
}

type Req<T extends EngineRequest['type']> = Omit<Extract<EngineRequest, { type: T }>, 'id'>;

export function callEngine<T extends EngineRequest['type']>(req: Req<T>, onProgress?: (label: string, frac: number) => void): Promise<Extract<EngineResponse, { type: T }>> {
  const id = nextId++;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve: resolve as (v: EngineResponse) => void, reject, onProgress });
    getEngine().postMessage({ ...req, id } as unknown as EngineRequest);
  });
}

// ---- physics ----------------------------------------------------------------------------
let physics: Worker | null = null;
let physicsListener: ((m: PhysicsResponse) => void) | null = null;

export function getPhysics(): Worker {
  if (physics) return physics;
  physics = new Worker(new URL('../workers/physics.worker.ts', import.meta.url), { type: 'module' });
  physics.onmessage = (ev: MessageEvent<PhysicsResponse>) => physicsListener?.(ev.data);
  return physics;
}

export function startPhysics(req: Extract<PhysicsRequest, { type: 'start' }>, listener: (m: PhysicsResponse) => void) {
  physicsListener = listener;
  getPhysics().postMessage(req);
}

export function stopPhysics() {
  physics?.postMessage({ type: 'stop' } satisfies PhysicsRequest);
  physicsListener = null;
}
