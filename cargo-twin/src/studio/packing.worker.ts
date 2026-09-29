import type { CargoItem, PackingPlan, PackingStrategy, SpaceConfig } from './model';
import { comparePlans, packCargo } from './packing';

export interface StudioWorkerRequest {
  id: number;
  space: SpaceConfig;
  items: CargoItem[];
  strategy?: PackingStrategy;
  compare?: boolean;
}

export type StudioWorkerResponse = { id: number; type: 'result'; plan: PackingPlan; plans?: PackingPlan[] }
  | { id: number; type: 'error'; message: string };

const scope = self as unknown as {
  onmessage: ((event: MessageEvent<StudioWorkerRequest>) => void) | null;
  postMessage: (response: StudioWorkerResponse) => void;
};

scope.onmessage = ({ data }) => {
  if (!data || !Number.isSafeInteger(data.id) || data.id < 0) return;
  try {
    const strategy = data.strategy ?? 'max-fill';
    const plans = data.compare ? comparePlans(data.space, data.items) : undefined;
    const plan = plans?.find(candidate => candidate.strategy === strategy) ?? packCargo(data.space, data.items, strategy);
    scope.postMessage({ id: data.id, type: 'result', plan, ...(plans ? { plans } : {}) });
  } catch (error) {
    scope.postMessage({ id: data.id, type: 'error', message: error instanceof Error ? error.message : 'Packing could not finish. Check the cargo and space inputs.' });
  }
};
