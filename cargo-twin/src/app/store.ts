import { create } from 'zustand';
import { aircraftById } from '../domain/aircraft';
import { computeWb, loadSequence, type WbResult } from '../domain/balance';
import type { Manifest, Shipment } from '../domain/cargo';
import { randomManifest } from '../domain/generator';
import { sampleManifest } from '../domain/manifests';
import type { BuildResult, BuiltUld } from '../domain/packing/buildup';
import type { StrategyId } from '../domain/packing/strategies';
import type { StabilityResult } from '../physics/cases';
import type { ColorMode } from '../ui/colors';
import { callEngine } from './engine';

export type Tab = 'build' | 'aircraft' | 'compare';

export interface Toast {
  id: number;
  level: 'info' | 'good' | 'warn' | 'error';
  text: string;
}

export interface PhysicsState {
  running: boolean;
  uldId: string | null;
  caseIndex: number;
  phase: 'settle' | 'case' | 'done' | 'idle';
  t: number;
  results: Record<string, StabilityResult>;
}

export interface AppState {
  manifest: Manifest | null;
  ships: Map<string, Shipment>;
  aircraftId: string;
  strategy: StrategyId;
  minSupport: number;
  gaMs: number;
  build: BuildResult | null;
  buildStale: boolean;
  compare: BuildResult[] | null;
  progress: { label: string; frac: number } | null;
  busy: { build: boolean; plan: boolean; compare: boolean };
  tab: Tab;
  selectedUldId: string | null;
  selectedPieceId: string | null;
  colorMode: ColorMode;
  xray: boolean;
  explode: boolean;
  seq: { step: number | null; playing: boolean };
  plan: { assignments: Record<string, string>; fuel: number; targetMac: number; seqOrder: string[] | null; animateKey: number };
  wb: WbResult | null;
  physics: PhysicsState;
  toasts: Toast[];
  help: boolean;
  lir: boolean;
  library: boolean;
  editor: { open: boolean; shipment: Shipment | null };
  tour: { active: boolean; step: number; label: string };
  physicsRequest: number;
  gl: string;
  acColor: 'handling' | 'weight';

  loadManifest: (m: Manifest) => void;
  loadSample: (id: string) => void;
  loadRandom: (seed?: number) => void;
  setShipments: (s: Shipment[]) => void;
  upsertShipment: (s: Shipment) => void;
  deleteShipment: (id: string) => void;
  setAircraft: (id: string) => void;
  setStrategy: (s: StrategyId) => void;
  setMinSupport: (v: number) => void;
  runBuild: () => Promise<BuildResult | null>;
  runCompare: () => Promise<void>;
  applyResult: (r: BuildResult) => void;
  runPlan: (animate?: boolean) => Promise<void>;
  assign: (positionId: string, uldId: string | null) => void;
  clearPlan: () => void;
  setFuel: (kg: number) => void;
  setTargetMac: (v: number) => void;
  recomputeWb: () => void;
  selectUld: (id: string | null) => void;
  selectPiece: (id: string | null) => void;
  set: (p: Partial<AppState>) => void;
  toast: (text: string, level?: Toast['level']) => void;
  dismissToast: (id: number) => void;
}

let toastId = 1;

const emptyPhysics: PhysicsState = { running: false, uldId: null, caseIndex: -1, phase: 'idle', t: 0, results: {} };

function defaultFuel(m: Manifest | null, acId: string): number {
  if (!m) return Math.round(aircraftById(acId).maxFuel * 0.6);
  return m.blockFuel - 1000; // block minus taxi
}

/** Choose a ULD that shows the engine off: mixed shipments, decent fill, contour in play. */
export function showcaseUld(ulds: BuiltUld[]): BuiltUld | null {
  if (!ulds.length) return null;
  const score = (u: BuiltUld) =>
    u.shipmentIds.length * 3 + u.volUtil * 20 + Math.min(u.placements.length, 40) * 0.4 + (u.dgClasses.length ? 4 : 0) + (u.typeId === 'PMC-Q6' ? 3 : 0);
  return [...ulds].sort((a, b) => score(b) - score(a))[0];
}

export const useStore = create<AppState>((set, get) => ({
  manifest: null,
  ships: new Map(),
  aircraftId: 'B777F',
  strategy: 'wall',
  minSupport: 0.75,
  gaMs: 2500,
  build: null,
  buildStale: false,
  compare: null,
  progress: null,
  busy: { build: false, plan: false, compare: false },
  tab: 'build',
  selectedUldId: null,
  selectedPieceId: null,
  colorMode: 'handling',
  xray: false,
  explode: false,
  seq: { step: null, playing: false },
  plan: { assignments: {}, fuel: 100000, targetMac: 27, seqOrder: null, animateKey: 0 },
  wb: null,
  physics: emptyPhysics,
  toasts: [],
  help: false,
  lir: false,
  library: false,
  editor: { open: false, shipment: null },
  tour: { active: false, step: 0, label: '' },
  physicsRequest: 0,
  gl: '',
  acColor: 'weight',

  loadManifest: (m) => {
    const ac = aircraftById(m.aircraftId);
    set({
      manifest: m,
      ships: new Map(m.shipments.map((s) => [s.id, s])),
      aircraftId: ac.id,
      build: null,
      buildStale: false,
      compare: null,
      selectedUldId: null,
      selectedPieceId: null,
      seq: { step: null, playing: false },
      plan: { assignments: {}, fuel: defaultFuel(m, ac.id), targetMac: ac.targetMac, seqOrder: null, animateKey: 0 },
      wb: null,
      physics: emptyPhysics,
    });
  },
  loadSample: (id) => get().loadManifest(sampleManifest(id)),
  loadRandom: (seed) => get().loadManifest(randomManifest(seed ?? Math.floor(Math.random() * 1e6))),
  setShipments: (shipments) => {
    const m = get().manifest;
    const base: Manifest = m ?? { id: 'CUSTOM', name: 'Custom manifest', flight: 'TWN 100', route: { from: 'HKG', to: 'LAX' }, aircraftId: get().aircraftId, blockFuel: 100000, tripFuel: 88000, description: 'Imported shipments', shipments: [] };
    const next = { ...base, shipments };
    set({ manifest: next, ships: new Map(shipments.map((s) => [s.id, s])), buildStale: !!get().build });
    if (!m) get().loadManifest(next);
  },
  upsertShipment: (s) => {
    const list = get().manifest?.shipments ?? [];
    const i = list.findIndex((x) => x.id === s.id);
    get().setShipments(i >= 0 ? list.map((x) => (x.id === s.id ? s : x)) : [...list, s]);
  },
  deleteShipment: (id) => get().setShipments((get().manifest?.shipments ?? []).filter((s) => s.id !== id)),
  setAircraft: (id) => {
    const ac = aircraftById(id);
    const m = get().manifest;
    set({ aircraftId: id, build: null, compare: null, selectedUldId: null, plan: { assignments: {}, fuel: defaultFuel(m, id), targetMac: ac.targetMac, seqOrder: null, animateKey: 0 }, wb: null, physics: emptyPhysics, manifest: m ? { ...m, aircraftId: id } : m });
  },
  setStrategy: (strategy) => set({ strategy, buildStale: !!get().build }),
  setMinSupport: (minSupport) => set({ minSupport, buildStale: !!get().build }),

  runBuild: async () => {
    const { manifest, aircraftId, strategy, minSupport, gaMs } = get();
    if (!manifest || !manifest.shipments.length) {
      get().toast('Load or create a manifest first', 'warn');
      return null;
    }
    set({ busy: { ...get().busy, build: true }, progress: { label: 'Building ULDs…', frac: 0.1 } });
    try {
      const res = await callEngine<'build'>({ type: 'build', manifest, aircraftId, strategy, minSupport, gaMs }, (label, frac) => set({ progress: { label, frac } }));
      get().applyResult(res.result);
      return res.result;
    } catch (e) {
      get().toast(`Build failed: ${(e as Error).message}`, 'error');
      return null;
    } finally {
      set({ busy: { ...get().busy, build: false }, progress: null });
    }
  },

  applyResult: (r) => {
    const pick = showcaseUld(r.ulds);
    set({
      build: r,
      strategy: r.strategy,
      buildStale: false,
      selectedUldId: pick?.id ?? null,
      selectedPieceId: null,
      seq: { step: null, playing: false },
      plan: { ...get().plan, assignments: {}, seqOrder: null },
      physics: { ...emptyPhysics },
      wb: null,
    });
    get().recomputeWb();
  },

  runCompare: async () => {
    const { manifest, aircraftId, minSupport, gaMs } = get();
    if (!manifest) return;
    set({ busy: { ...get().busy, compare: true }, progress: { label: 'Comparing strategies…', frac: 0 } });
    try {
      const res = await callEngine<'compare'>({ type: 'compare', manifest, aircraftId, minSupport, gaMs }, (label, frac) => set({ progress: { label, frac } }));
      set({ compare: res.results });
    } catch (e) {
      get().toast(`Comparison failed: ${(e as Error).message}`, 'error');
    } finally {
      set({ busy: { ...get().busy, compare: false }, progress: null });
    }
  },

  runPlan: async (animate = true) => {
    const { manifest, build, aircraftId, plan } = get();
    if (!manifest || !build) return;
    set({ busy: { ...get().busy, plan: true } });
    try {
      const ac = aircraftById(aircraftId);
      const res = await callEngine<'plan'>({ type: 'plan', manifest, aircraftId, ulds: build.ulds, fuel: plan.fuel, tripFuel: manifest.tripFuel, targetMac: plan.targetMac });
      const assignments = res.result.assignments;
      set({ plan: { ...get().plan, assignments, seqOrder: animate ? loadSequence(ac, assignments) : null, animateKey: get().plan.animateKey + 1 } });
      get().recomputeWb();
      const wb = get().wb;
      if (wb) {
        const errs = wb.warnings.filter((w) => w.level === 'error').length;
        get().toast(
          errs ? `Load plan has ${errs} limit violation${errs > 1 ? 's' : ''}` : `Auto-plan: TOW CG ${wb.towMac.toFixed(1)} %MAC, ${wb.loaded}/${build.ulds.length} ULDs loaded`,
          errs ? 'warn' : 'good',
        );
      }
    } catch (e) {
      get().toast(`Planning failed: ${(e as Error).message}`, 'error');
    } finally {
      set({ busy: { ...get().busy, plan: false } });
    }
  },

  assign: (positionId, uldId) => {
    const a = { ...get().plan.assignments };
    // remove the ULD from wherever it was
    let from: string | null = null;
    if (uldId) for (const [k, v] of Object.entries(a)) if (v === uldId) { from = k; delete a[k]; }
    const displaced = a[positionId];
    if (uldId) a[positionId] = uldId;
    else delete a[positionId];
    if (displaced && from && displaced !== uldId) a[from] = displaced; // swap
    set({ plan: { ...get().plan, assignments: a, seqOrder: null } });
    get().recomputeWb();
  },
  clearPlan: () => {
    set({ plan: { ...get().plan, assignments: {}, seqOrder: null } });
    get().recomputeWb();
  },
  setFuel: (fuel) => {
    set({ plan: { ...get().plan, fuel, seqOrder: null } });
    get().recomputeWb();
  },
  setTargetMac: (targetMac) => set({ plan: { ...get().plan, targetMac } }),
  recomputeWb: () => {
    const { build, manifest, aircraftId, plan, ships } = get();
    if (!build || !manifest) return set({ wb: null });
    const ac = aircraftById(aircraftId);
    set({ wb: computeWb({ ac, ulds: build.ulds, assignments: plan.assignments, fuel: plan.fuel, tripFuel: manifest.tripFuel, ships }) });
  },
  selectUld: (id) => set({ selectedUldId: id, selectedPieceId: null, seq: { step: null, playing: false } }),
  selectPiece: (id) => set({ selectedPieceId: id }),
  set: (p) => set(p),
  toast: (text, level = 'info') => {
    const id = toastId++;
    set({ toasts: [...get().toasts.slice(-3), { id, level, text }] });
    setTimeout(() => get().dismissToast(id), level === 'error' ? 7000 : 4200);
  },
  dismissToast: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),
}));

export function selectedUld(s: AppState): BuiltUld | null {
  return s.build?.ulds.find((u) => u.id === s.selectedUldId) ?? null;
}
