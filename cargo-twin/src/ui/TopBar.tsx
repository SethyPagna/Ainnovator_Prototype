import { useEffect, useState } from 'react';
import { AIRCRAFT } from '../domain/aircraft';
import { useStore } from '../app/store';
import { runSampleFlight, stopTour } from '../app/pipeline';
import { IconKeyboard, IconLayers, IconSpark, IconStop, Mark } from './icons';

export function TopBar() {
  const manifest = useStore((s) => s.manifest);
  const aircraftId = useStore((s) => s.aircraftId);
  const build = useStore((s) => s.build);
  const physics = useStore((s) => s.physics);
  const wb = useStore((s) => s.wb);
  const tab = useStore((s) => s.tab);
  const tour = useStore((s) => s.tour);
  const lir = useStore((s) => s.lir);
  const [lirSeen, setLirSeen] = useState(false);
  useEffect(() => { if (lir) setLirSeen(true); }, [lir]);
  useEffect(() => setLirSeen(false), [wb?.loaded === 0]);
  const set = useStore((s) => s.set);
  const setAircraft = useStore((s) => s.setAircraft);

  const hasStability = Object.keys(physics.results).length > 0;
  const planned = !!wb && wb.loaded > 0;
  const steps = [
    { n: 1, label: 'Manifest', done: !!manifest?.shipments.length, active: !build, go: () => set({ tab: 'build' }) },
    { n: 2, label: 'Build-up', done: !!build, active: !!build && tab === 'build' && !physics.running && !hasStability, go: () => set({ tab: 'build' }) },
    { n: 3, label: 'Stability', done: hasStability, active: physics.running, go: () => set({ tab: 'build' }) },
    { n: 4, label: 'Load plan', done: planned, active: tab === 'aircraft', go: () => set({ tab: 'aircraft' }) },
    { n: 5, label: 'LIR', done: lirSeen && planned, active: false, go: () => planned && set({ lir: true }) },
  ];

  return (
    <header className="topbar">
      <div className="brand">
        <Mark />
        <div>
          <h1>Cargo Twin</h1>
          <small>AIRCRAFT WORKSPACE · v3</small>
        </div>
      </div>
      <a className="btn ghost" href="?workspace=studio" style={{ textDecoration: 'none' }}>← Cargo studio</a>
      <div className="flight-chip" title={manifest?.description ?? 'No flight loaded'}>
        {manifest ? (
          <>
            <b>{manifest.flight}</b>
            <span>{manifest.route.from} → {manifest.route.to}</span>
            <span className="sep" />
          </>
        ) : (
          <span className="muted">No flight loaded</span>
        )}
        <select
          className="input ac"
          aria-label="Aircraft type"
          value={aircraftId}
          onChange={(e) => setAircraft(e.target.value)}
          style={{ height: 24, border: 0, background: 'transparent', padding: 0 }}
        >
          {AIRCRAFT.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
      </div>
      <nav className="stepper" aria-label="Pipeline">
        {steps.map((s, i) => (
          <span key={s.n} style={{ display: 'contents' }}>
            {i > 0 && <span className="step-line" />}
            <button className={`step ${s.done ? 'done' : ''} ${s.active ? 'active' : ''}`} onClick={s.go}>
              <span className="n">{s.done ? '✓' : s.n}</span>
              <span className="lbl">{s.label}</span>
            </button>
          </span>
        ))}
      </nav>
      {tour.active ? (
        <button className="btn cta" onClick={stopTour}><IconStop /> Stop demo</button>
      ) : (
        <button className="btn primary cta" onClick={() => runSampleFlight('HKG-LAX')} title="Runs the whole pipeline on a sample flight (S)">
          <IconSpark /> Try a sample flight
        </button>
      )}
      <button className="btn icon ghost" aria-label="Equipment library" title="ULD & aircraft library (U)" onClick={() => set({ library: true })}>
        <IconLayers />
      </button>
      <button className="btn icon ghost" aria-label="Keyboard shortcuts" title="Keyboard shortcuts (?)" onClick={() => set({ help: true })}>
        <IconKeyboard />
      </button>
    </header>
  );
}
