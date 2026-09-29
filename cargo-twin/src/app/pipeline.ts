import { useStore } from './store';

// "Try a sample flight": runs the whole pipeline with narration, cancellable at any step.

let token = 0;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function waitFor(cond: () => boolean, timeout: number, alive: () => boolean) {
  const t0 = performance.now();
  while (!cond() && alive() && performance.now() - t0 < timeout) await sleep(100);
}

export function stopTour() {
  token++;
  const st = useStore.getState();
  st.set({ tour: { active: false, step: 0, label: '' }, seq: { step: null, playing: false } });
}

export const TOUR_STEPS = 5;

export async function runSampleFlight(sampleId = 'HKG-LAX') {
  const my = ++token;
  const alive = () => my === token;
  const st = useStore.getState;
  const say = (step: number, label: string) => st().set({ tour: { active: true, step, label } });
  const end = () => {
    if (alive()) st().set({ tour: { active: false, step: 0, label: '' } });
  };

  say(1, 'Loading the sample manifest');
  st().loadSample(sampleId);
  st().set({ tab: 'build', explode: false, xray: false });
  await sleep(900);
  if (!alive()) return;

  say(2, 'Building ULDs with the contour-aware extreme-point packer');
  const r = await st().runBuild();
  if (!alive() || !r) return end();
  await sleep(500);
  if (!alive()) return;

  say(3, 'Replaying the build sequence of the showcase ULD');
  st().set({ seq: { step: 0, playing: true } });
  await waitFor(() => !st().seq.playing, 15000, alive);
  if (!alive()) return;
  st().set({ seq: { step: null, playing: false } });
  await sleep(400);

  say(4, 'Stress test: 1.5 g braking, 1.5 g lateral, vertical gust');
  st().set({ physicsRequest: st().physicsRequest + 1 });
  await sleep(300);
  await waitFor(() => st().physics.phase === 'done' && !st().physics.running, 30000, alive);
  if (!alive()) return;
  await sleep(1800);
  if (!alive()) return;

  say(5, 'Auto-planning positions for CG, position and hold limits');
  st().set({ tab: 'aircraft' });
  await sleep(500);
  await st().runPlan(true);
  if (!alive()) return;
  await sleep(4200);
  end();
  const wb = st().wb;
  if (wb) st().toast(`Sample flight ready — ${wb.loaded} ULDs, TOW ${(wb.tow / 1000).toFixed(1)} t at ${wb.towMac.toFixed(1)} %MAC. Try dragging ULDs on the deck plan.`, 'good');
}
