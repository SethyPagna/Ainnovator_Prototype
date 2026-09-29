import { createPortal } from 'react-dom';
import { useMemo } from 'react';
import { useStore } from '../app/store';
import { runSampleFlight, stopTour, TOUR_STEPS } from '../app/pipeline';
import { aircraftById } from '../domain/aircraft';
import { loadSequence } from '../domain/balance';
import { sampleList } from '../domain/manifests';
import { uldType } from '../domain/uld';
import { IconAlert, IconBox, IconCheck, IconInfo, IconPrint, IconSpark, IconX } from './icons';
import { num } from './format';

export function Welcome({ hasManifest }: { hasManifest: boolean }) {
  const runBuild = useStore((s) => s.runBuild);
  const loadSample = useStore((s) => s.loadSample);
  const busy = useStore((s) => s.busy.build);
  const tour = useStore((s) => s.tour.active);
  const samples = useMemo(() => sampleList(), []);
  if (tour) return null;
  return (
    <div className="welcome">
      <div className="glass welcome-card">
        {hasManifest ? (
          <>
            <h2>Manifest loaded — build the ULDs</h2>
            <p>The engine assigns every piece to a compatible ULD (temperature, DGR segregation, CAO, VAL/AVI), packs it against the real contour with support and load-bearing checks, and caps each build to what the aircraft positions can carry.</p>
            <div className="row">
              <button className="btn primary cta" onClick={() => runBuild()} disabled={busy}><IconBox /> {busy ? 'Building…' : 'Build ULDs'}</button>
              <span className="muted">or press <span className="kbd">P</span></span>
            </div>
          </>
        ) : (
          <>
            <h2>Plan a freighter, piece by piece</h2>
            <p>Cargo Twin’s aircraft workspace turns a cargo manifest into built ULDs, checks each stack with a rigid-body stress test, and places them on a 777F or 747-8F within position limits and the CG envelope.</p>
            <div className="row">
              <button className="btn primary cta" onClick={() => runSampleFlight('HKG-LAX')}><IconSpark /> Try a sample flight</button>
              <span className="muted">~25 s guided run · press <span className="kbd">S</span></span>
            </div>
            <div className="samples">
              {samples.map((s) => (
                <button key={s.id} className="sample" onClick={() => loadSample(s.id)}>
                  <b>{s.flight} · {s.route}</b>
                  <span>{s.name} · {aircraftById(s.aircraftId).short}</span>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export function TourBanner() {
  const tour = useStore((s) => s.tour);
  if (!tour.active) return null;
  return (
    <div className="glass tour" role="status" aria-live="polite">
      <span className="dots">{Array.from({ length: TOUR_STEPS }, (_, i) => <i key={i} className={i < tour.step ? 'on' : ''} />)}</span>
      <span><b>Step {tour.step}/{TOUR_STEPS}</b> · {tour.label}</span>
      <button className="btn sm ghost" onClick={stopTour}>Skip <span className="kbd">Esc</span></button>
    </div>
  );
}

export function Toasts() {
  const toasts = useStore((s) => s.toasts);
  const dismiss = useStore((s) => s.dismissToast);
  return (
    <div className="toasts" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`glass toast ${t.level}`} role="status">
          {t.level === 'good' ? <IconCheck /> : t.level === 'info' ? <IconInfo /> : <IconAlert />}
          <span style={{ flex: 1 }}>{t.text}</span>
          <button className="btn sm icon ghost" aria-label="Dismiss" onClick={() => dismiss(t.id)}><IconX size={13} /></button>
        </div>
      ))}
    </div>
  );
}

const SHORTCUTS: [string, string][] = [
  ['S', 'Run the guided sample flight'],
  ['P', 'Pack / rebuild ULDs'],
  ['T', 'Stress-test the selected ULD'],
  ['A', 'Auto-plan the aircraft'],
  ['1 · 2 · 3', 'Build-up · Aircraft · Compare'],
  ['[ · ]', 'Previous / next ULD'],
  ['Space', 'Play / pause the build sequence'],
  ['← · →', 'Step the build sequence'],
  ['X · E', 'X-ray · exploded view'],
  ['C', 'Cycle colour mode'],
  ['V', 'Reset camera'],
  ['R', 'Random manifest'],
  ['L', 'Loading instruction sheet'],
  ['U', 'ULD & aircraft equipment library'],
  ['Esc', 'Close dialogs / stop the demo'],
];

export function HelpOverlay() {
  const help = useStore((s) => s.help);
  const gl = useStore((s) => s.gl);
  const set = useStore((s) => s.set);
  if (!help) return null;
  return (
    <div className="modal-back" onMouseDown={(e) => e.target === e.currentTarget && set({ help: false })}>
      <div className="modal" role="dialog" aria-modal="true" aria-label="Keyboard shortcuts" style={{ width: 520 }}>
        <div className="modal-head"><h3>Keyboard shortcuts</h3><button className="btn icon ghost" aria-label="Close" onClick={() => set({ help: false })}><IconX /></button></div>
        <div className="modal-body">
          <div className="help-grid">
            {SHORTCUTS.map(([k, d]) => <span key={k} style={{ display: 'contents' }}><span><span className="kbd">{k}</span></span><span className="dim">{d}</span></span>)}
          </div>
          <p className="muted" style={{ fontSize: 12, marginBottom: 0 }}>Renderer: {gl || 'n/a'}.</p>
          <p className="muted" style={{ fontSize: 12, marginBottom: 0 }}>Mouse: drag to orbit, right-drag to pan, wheel to zoom; click a piece or ULD to inspect it. On the deck plan, drag ULDs between positions or back to the tray; double-click to offload.</p>
        </div>
      </div>
    </div>
  );
}

function LirContent() {
  const build = useStore((s) => s.build);
  const manifest = useStore((s) => s.manifest);
  const plan = useStore((s) => s.plan);
  const wb = useStore((s) => s.wb);
  const ships = useStore((s) => s.ships);
  const aircraftId = useStore((s) => s.aircraftId);
  const ac = aircraftById(aircraftId);
  if (!build || !manifest || !wb) return null;
  const seq = loadSequence(ac, plan.assignments);
  const byId = new Map(build.ulds.map((u) => [u.id, u]));
  const pos = new Map(ac.positions.map((p) => [p.id, p]));
  const date = new Date();
  return (
    <div className="lir">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <h2>Loading Instruction / Report (LIR)</h2>
        <span style={{ fontSize: 11 }}>DEMO DOCUMENT — generated by Cargo Twin · not for operational use</span>
      </div>
      <div className="meta">
        <div><b>Flight</b>{manifest.flight}</div>
        <div><b>Route</b>{manifest.route.from} → {manifest.route.to}</div>
        <div><b>Aircraft</b>{ac.name}</div>
        <div><b>Prepared</b>{date.toISOString().slice(0, 16).replace('T', ' ')} UTC</div>
        <div><b>ZFW</b>{num(wb.zfw)} kg · {wb.zfwMac.toFixed(1)} %MAC</div>
        <div><b>TOW</b>{num(wb.tow)} kg · {wb.towMac.toFixed(1)} %MAC</div>
        <div><b>LW</b>{num(wb.lw)} kg · {wb.lwMac.toFixed(1)} %MAC</div>
        <div><b>Take-off fuel</b>{num(plan.fuel)} kg</div>
      </div>
      <table>
        <thead>
          <tr><th>Seq</th><th>Pos</th><th>Deck</th><th>ULD</th><th>Type / contour</th><th>Gross kg</th><th>Pos limit</th><th>SHC</th><th>DG / NOTOC</th><th>Temp</th><th>AWBs</th></tr>
        </thead>
        <tbody>
          {seq.map((pid, i) => {
            const u = byId.get(plan.assignments[pid])!;
            const p = pos.get(pid)!;
            const t = uldType(u.typeId);
            const dg = u.shipmentIds.map((id) => ships.get(id)).filter((s) => s?.dg).map((s) => `${s!.dg!.un} cl.${s!.dg!.cls}${s!.dg!.cao ? ' CAO' : ''}`);
            return (
              <tr key={pid}>
                <td>{i + 1}</td><td><b>{pid}</b></td><td>{p.deck === 'main' ? 'MD' : p.hold}</td><td>{u.id}</td><td>{t.iata} · {t.contour}</td>
                <td>{num(u.gross)}</td><td>{num(p.maxWeight)}</td><td>{u.shc.filter((c) => c !== 'GEN').join(' ') || 'GEN'}</td><td>{dg.join(', ') || '—'}</td>
                <td>{u.active ? `${u.setpoint} °C active` : u.regime === 'AMB' ? '—' : u.regime}</td>
                <td>{u.shipmentIds.map((id) => ships.get(id)?.awb).join(', ')}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {wb.unassigned.length > 0 && <p><b>Offloaded ULDs:</b> {wb.unassigned.join(', ')}</p>}
      {build.unplaced.length > 0 && <p><b>Pieces not built:</b> {build.unplaced.length} ({[...new Set(build.unplaced.map((u) => ships.get(u.shipmentId)?.awb))].join(', ')})</p>}
      {wb.warnings.length > 0 && <p><b>Open warnings:</b> {wb.warnings.map((w) => w.text).join(' · ')}</p>}
      <div className="sign"><div>Load planner</div><div>Loading supervisor</div><div>Captain</div></div>
      <div className="disclaimer">Representative and simplified figures (arms, limits, envelope, contours). Portfolio prototype · not affiliated with any airline.</div>
    </div>
  );
}

export function LirSheet() {
  const lir = useStore((s) => s.lir);
  const set = useStore((s) => s.set);
  return (
    <>
      {lir && (
        <div className="modal-back" onMouseDown={(e) => e.target === e.currentTarget && set({ lir: false })}>
          <div className="modal" role="dialog" aria-modal="true" aria-label="Loading instruction" style={{ width: 'min(1100px, 100%)' }}>
            <div className="modal-head">
              <h3>Loading instruction sheet</h3>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn primary" onClick={() => window.print()}><IconPrint size={15} /> Print</button>
                <button className="btn icon ghost" aria-label="Close" onClick={() => set({ lir: false })}><IconX /></button>
              </div>
            </div>
            <LirContent />
          </div>
        </div>
      )}
      {createPortal(<div className="print-only"><LirContent /></div>, document.body)}
    </>
  );
}
