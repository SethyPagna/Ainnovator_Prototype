import { useEffect, useState } from 'react';
import { useStore, type Tab } from '../app/store';
import { runSampleFlight, stopTour } from '../app/pipeline';
import { STRATEGIES } from '../domain/packing/strategies';
import { COLOR_MODES } from './colors';
import { TopBar } from './TopBar';
import { ManifestPanel } from './ManifestPanel';
import { ShipmentEditor } from './ShipmentEditor';
import { BuildStage } from './BuildStage';
import { UldStrip } from './UldStrip';
import { AircraftStage } from './AircraftStage';
import { CompareView } from './CompareView';
import { RightPanel } from './RightPanel';
import { HelpOverlay, LirSheet, Toasts, TourBanner } from './Overlays';
import { MobileView } from './MobileView';
import { Library } from './Library';
import { IconBars, IconBox, IconPlane } from './icons';

function useIsNarrow() {
  const q = '(max-width: 900px)';
  const [narrow, setNarrow] = useState(() => window.matchMedia(q).matches);
  useEffect(() => {
    const m = window.matchMedia(q);
    const on = () => setNarrow(m.matches);
    m.addEventListener('change', on);
    return () => m.removeEventListener('change', on);
  }, []);
  return narrow;
}

function StageTabs() {
  const tab = useStore((s) => s.tab);
  const set = useStore((s) => s.set);
  const strategy = useStore((s) => s.strategy);
  const setStrategy = useStore((s) => s.setStrategy);
  const runBuild = useStore((s) => s.runBuild);
  const busy = useStore((s) => s.busy);
  const progress = useStore((s) => s.progress);
  const manifest = useStore((s) => s.manifest);
  const build = useStore((s) => s.build);
  const stale = useStore((s) => s.buildStale);
  const tabs: { id: Tab; label: string; icon: React.ReactNode; key: string }[] = [
    { id: 'build', label: 'Build-up', icon: <IconBox size={14} />, key: '1' },
    { id: 'aircraft', label: 'Aircraft · W&B', icon: <IconPlane size={14} />, key: '2' },
    { id: 'compare', label: 'Compare', icon: <IconBars size={14} />, key: '3' },
  ];
  return (
    <div className="stage-tabs">
      <div className="seg" role="tablist" aria-label="Views">
        {tabs.map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} className={tab === t.id ? 'on' : ''} onClick={() => set({ tab: t.id })} title={`${t.label} (${t.key})`}>
            {t.icon}{t.label}
          </button>
        ))}
      </div>
      <span className="spacer" />
      {(busy.build || busy.compare) && progress && <span className="muted" style={{ fontSize: 11.5 }}>{progress.label}</span>}
      <label className="muted" style={{ fontSize: 11.5, display: 'flex', alignItems: 'center', gap: 6 }}>
        Strategy
        <select className="input" value={strategy} onChange={(e) => setStrategy(e.target.value as typeof strategy)} style={{ height: 28 }} aria-label="Packing strategy">
          {STRATEGIES.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </label>
      <button className={`btn ${!build || stale ? 'primary' : ''}`} disabled={!manifest?.shipments.length || busy.build} onClick={() => runBuild()} title="Pack ULDs (P)">
        <IconBox size={15} /> {busy.build ? 'Building…' : build ? 'Rebuild' : 'Build ULDs'}
      </button>
    </div>
  );
}

function useShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'SELECT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) {
        if (e.key === 'Escape') el.blur();
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const st = useStore.getState();
      const ulds = st.build?.ulds ?? [];
      const uld = ulds.find((u) => u.id === st.selectedUldId);
      const k = e.key;
      const stop = () => e.preventDefault();
      switch (k) {
        case 'Escape':
          if (st.tour.active) stopTour();
          st.set({ help: false, lir: false, library: false, editor: { open: false, shipment: null }, selectedPieceId: null });
          break;
        case '?':
          st.set({ help: !st.help });
          break;
        case 's': case 'S':
          runSampleFlight('HKG-LAX');
          break;
        case 'p': case 'P':
          st.runBuild();
          break;
        case 't': case 'T':
          if (uld && !st.physics.running) st.set({ tab: 'build', physicsRequest: st.physicsRequest + 1 });
          break;
        case 'a': case 'A':
          if (st.build) { st.set({ tab: 'aircraft' }); st.runPlan(true); }
          break;
        case '1': st.set({ tab: 'build' }); break;
        case '2': st.set({ tab: 'aircraft' }); break;
        case '3': st.set({ tab: 'compare' }); break;
        case 'x': case 'X': st.set({ xray: !st.xray }); break;
        case 'e': case 'E': if (!st.physics.running) st.set({ explode: !st.explode }); break;
        case 'c': case 'C': {
          const i = COLOR_MODES.findIndex((m) => m.id === st.colorMode);
          st.set({ colorMode: COLOR_MODES[(i + 1) % COLOR_MODES.length].id });
          break;
        }
        case 'r': case 'R': st.loadRandom(); break;
        case 'l': case 'L': if (st.wb?.loaded) st.set({ lir: true }); break;
        case 'u': case 'U': st.set({ library: !st.library }); break;
        case 'v': case 'V': window.dispatchEvent(new CustomEvent('cct-reset-view')); break;
        case '[': case ']': {
          if (!ulds.length) break;
          const i = Math.max(0, ulds.findIndex((u) => u.id === st.selectedUldId));
          const j = (i + (k === ']' ? 1 : -1) + ulds.length) % ulds.length;
          st.selectUld(ulds[j].id);
          break;
        }
        case ' ': {
          if (!uld || st.physics.running) break;
          stop();
          const n = uld.placements.length;
          st.set({ seq: st.seq.playing ? { step: st.seq.step, playing: false } : { step: st.seq.step === null || st.seq.step >= n ? 0 : st.seq.step, playing: true } });
          break;
        }
        case 'ArrowRight': case 'ArrowLeft': {
          if (!uld || st.physics.running) break;
          stop();
          const n = uld.placements.length;
          const cur = st.seq.step ?? n;
          const next = Math.max(0, Math.min(n, cur + (k === 'ArrowRight' ? 1 : -1)));
          st.set({ seq: { step: next >= n ? null : next, playing: false } });
          break;
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}

export function App() {
  const narrow = useIsNarrow();
  const tab = useStore((s) => s.tab);
  const editor = useStore((s) => s.editor);
  useShortcuts();
  if (narrow) return <><MobileView /><Toasts /></>;
  return (
    <>
      <div className="app">
        <TopBar />
        <main className="main">
          <ManifestPanel />
          <section className="stage" aria-label="Workspace">
            <StageTabs />
            <div style={{ position: 'relative', minHeight: 0, display: 'grid' }}>
              <TourBanner />
              {tab === 'build' && <BuildStage />}
              {tab === 'aircraft' && <AircraftStage />}
              {tab === 'compare' && <CompareView />}
            </div>
            {tab === 'build' ? <UldStrip /> : <div />}
          </section>
          <RightPanel />
        </main>
        <footer className="footer">
          <span>Cathay Cargo Twin v2 · originally a team hackathon prototype (Nov 2025) · rebuilt 2026 by Sethy Pagna UNG</span>
          <span>Portfolio prototype · not affiliated with any airline · representative data, not for operational use</span>
        </footer>
      </div>
      {editor.open && <ShipmentEditor key={editor.shipment?.id ?? 'new'} />}
      <HelpOverlay />
      <Library />
      <LirSheet />
      <Toasts />
    </>
  );
}
