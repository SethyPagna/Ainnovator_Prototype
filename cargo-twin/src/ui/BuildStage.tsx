import { useEffect, useMemo, useRef, useState } from 'react';
import { selectedUld, useStore } from '../app/store';
import { startPhysics, stopPhysics } from '../app/engine';
import { CASES } from '../physics/cases';
import { UldScene, type MoverKind } from '../three/UldScene';
import { uldType } from '../domain/uld';
import { aircraftById } from '../domain/aircraft';
import type { Shipment } from '../domain/cargo';
import { buildUp, type BuiltUld } from '../domain/packing/buildup';
import { REGIME_LABEL } from '../domain/rules';
import { COLOR_MODES, HANDLING, TEMP_CLASSES, WEIGHT_RAMP, handlingOf, shipmentColor as shipColor } from './colors';
import { DgChip, Meter, ShcChips } from './bits';
import { IconBack, IconEye, IconExplode, IconPause, IconPlay, IconReset, IconShake, IconStep, IconX } from './icons';
import { kg, num } from './format';
import { Welcome } from './Overlays';

let runSeq = 1;

export function BuildStage() {
  const hostRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<UldScene | null>(null);
  const [hover, setHover] = useState<{ id: string; x: number; y: number } | null>(null);
  const uld = useStore(selectedUld);
  const ships = useStore((s) => s.ships);
  const build = useStore((s) => s.build);
  const manifest = useStore((s) => s.manifest);
  const colorMode = useStore((s) => s.colorMode);
  const xray = useStore((s) => s.xray);
  const explode = useStore((s) => s.explode);
  const seq = useStore((s) => s.seq);
  const selectedPieceId = useStore((s) => s.selectedPieceId);
  const physics = useStore((s) => s.physics);
  const physicsRequest = useStore((s) => s.physicsRequest);
  const busy = useStore((s) => s.busy);
  const set = useStore((s) => s.set);

  useEffect(() => {
    const sc = new UldScene(hostRef.current!);
    sceneRef.current = sc;
    useStore.getState().set({ gl: `${sc.info.renderer}${sc.info.software ? ' (software — shadows off)' : ''}` });
    sc.onPick = (id) => useStore.getState().selectPiece(id);
    sc.onHover = (id, x, y) => setHover(id ? { id, x, y } : null);
    const reset = () => sc.resetView();
    window.addEventListener('cct-reset-view', reset);
    return () => {
      window.removeEventListener('cct-reset-view', reset);
      stopPhysics();
      sc.dispose();
      sceneRef.current = null;
    };
  }, []);

  // ULD change
  useEffect(() => {
    const sc = sceneRef.current;
    if (!sc) return;
    if (!useStore.getState().build) {
      const d = demoUld();
      if (d) {
        sc.setDemo(d.uld, d.ships);
        return;
      }
    }
    stopPhysics();
    sc.setPhysicsFrame(null, null);
    sc.setUld(uld, ships);
    sc.setColorMode(useStore.getState().colorMode);
    sc.setXray(useStore.getState().xray);
    sc.setExplode(useStore.getState().explode);
    const res = uld ? useStore.getState().physics.results[uld.id] : undefined;
    sc.setMovers(res ? moverMap(res.worst) : null);
    const st = useStore.getState();
    if (st.physics.running) set({ physics: { ...st.physics, running: false, phase: 'idle' } });
  }, [uld, ships, set, build]);

  useEffect(() => sceneRef.current?.setColorMode(colorMode), [colorMode]);
  useEffect(() => sceneRef.current?.setXray(xray), [xray]);
  useEffect(() => sceneRef.current?.setExplode(explode), [explode]);
  useEffect(() => sceneRef.current?.setSelected(selectedPieceId), [selectedPieceId]);
  useEffect(() => sceneRef.current?.setSequence(seq.step, true), [seq.step]);

  // build-sequence playback
  useEffect(() => {
    if (!seq.playing || !uld) return;
    const n = uld.placements.length;
    const interval = Math.max(45, Math.min(220, 4200 / Math.max(1, n)));
    const id = setInterval(() => {
      const s = useStore.getState().seq;
      const next = (s.step ?? 0) + 1;
      if (next > n) {
        clearInterval(id);
        set({ seq: { step: null, playing: false } });
      } else set({ seq: { step: next, playing: true } });
    }, interval);
    return () => clearInterval(id);
  }, [seq.playing, uld, set]);

  const runStress = () => {
    const sc = sceneRef.current;
    const u = selectedUld(useStore.getState());
    if (!sc || !u) return;
    const runId = runSeq++;
    set({ seq: { step: null, playing: false }, explode: false, physics: { ...useStore.getState().physics, running: true, uldId: u.id, caseIndex: -1, phase: 'settle', t: 0 } });
    sc.setSequence(null, false);
    sc.setExplode(false);
    sc.setMovers(null);
    let lastCase = -2;
    let lastPhase = '';
    startPhysics({ type: 'start', runId, uld: u, speed: sc.info.software ? 0.75 : 1 }, (m) => {
      if (m.runId !== runId) return;
      if (m.type === 'frame') {
        const c = CASES[m.caseIndex];
        sc.setPhysicsFrame(m.transforms, m.g, m.phase === 'case' && c ? c.short : '', m.phase === 'case' && c ? c.g(c.id === 'vert' ? 0.5 : 0.6) : undefined);
        if (m.caseIndex !== lastCase || m.phase !== lastPhase) {
          lastCase = m.caseIndex;
          lastPhase = m.phase;
          const st = useStore.getState();
          set({ physics: { ...st.physics, caseIndex: m.phase === 'settle' ? -1 : m.caseIndex, phase: m.phase } });
        }
      } else if (m.type === 'done') {
        const st = useStore.getState();
        set({ physics: { ...st.physics, running: false, phase: 'done', results: { ...st.physics.results, [u.id]: m.result } } });
        sc.setPhysicsFrame(null, null);
        sc.setMovers(moverMap(m.result.worst));
        const v = m.result.verdict;
        st.toast(
          v === 'stable' ? `${u.id}: stable under all load cases` : v === 'restrain' ? `${u.id}: ${m.result.worst.filter((x) => x.kind !== 'transient').length} piece(s) shift — add dunnage / straps` : `${u.id}: ${m.result.worst.filter((x) => x.kind === 'tip').length} piece(s) tip over — rework the stack`,
          v === 'stable' ? 'good' : 'warn',
        );
      } else if (m.type === 'error') {
        set({ physics: { ...useStore.getState().physics, running: false, phase: 'idle' } });
        useStore.getState().toast(`Physics failed: ${m.message}`, 'error');
      }
    });
  };

  useEffect(() => {
    if (physicsRequest > 0) runStress();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [physicsRequest]);

  const clearStress = () => {
    stopPhysics();
    sceneRef.current?.setPhysicsFrame(null, null);
    sceneRef.current?.setMovers(null);
    set({ physics: { ...physics, running: false, phase: 'idle' } });
  };

  const result = uld ? physics.results[uld.id] : undefined;
  const showHud = physics.running || (physics.phase === 'done' && physics.uldId === uld?.id && result);
  const t = uld ? uldType(uld.typeId) : null;

  return (
    <div className="viewport" aria-label="ULD build-up 3D view">
      <div className="gl" ref={hostRef} />
      {(busy.build || busy.compare) && <div className="progress"><i /></div>}
      {!build && <Welcome hasManifest={!!manifest?.shipments.length} />}
      {build && uld && t && (
        <>
          <div className="overlay-tl">
            <div className="glass toolbar" role="toolbar" aria-label="View options">
              <div className="seg" role="radiogroup" aria-label="Colour by">
                {COLOR_MODES.map((m) => (
                  <button key={m.id} className={colorMode === m.id ? 'on' : ''} onClick={() => set({ colorMode: m.id })} aria-pressed={colorMode === m.id}>{m.label}</button>
                ))}
              </div>
              <span className="div" />
              <button className={`btn sm ${xray ? 'on' : ''}`} onClick={() => set({ xray: !xray })} title="X-ray (X)"><IconEye size={14} /> <span className="lbl">X-ray</span></button>
              <button className={`btn sm ${explode ? 'on' : ''}`} onClick={() => set({ explode: !explode })} disabled={physics.running} title="Exploded view (E)"><IconExplode size={14} /> <span className="lbl">Explode</span></button>
              <button className="btn sm icon" onClick={() => sceneRef.current?.resetView()} title="Reset camera (V)" aria-label="Reset camera"><IconReset size={14} /></button>
              <span className="div" />
              <button className={`btn sm ${physics.running ? 'on' : ''}`} onClick={runStress} disabled={physics.running} title="Rigid-body stress test (T)"><IconShake size={14} /> <span className="lbl">Stress test</span></button>
            </div>
            {showHud && <StressHud onClear={clearStress} />}
          </div>
          <div className="overlay-bl">
            <Legend />
          </div>
          {selectedPieceId && <div className="overlay-tr"><Inspect /></div>}
          <div className="overlay-bc">
            <SequencePlayer n={uld.placements.length} />
          </div>
          {hover && hover.id !== selectedPieceId && <HoverTip id={hover.id} x={hover.x} y={hover.y} />}
        </>
      )}
      {build && !uld && (
        <div className="welcome"><div className="glass welcome-card"><h2>No ULDs were built</h2><p>Every piece was rejected — see the warnings panel for the reasons (temperature, dimensions, weight or capacity).</p></div></div>
      )}
    </div>
  );
}

let demoCache: { uld: BuiltUld; ships: Map<string, Shipment> } | null | undefined;
/** A small real build-up used as the idle hero visual (packed once, synchronously, ~10 ms). */
function demoUld() {
  if (demoCache !== undefined) return demoCache;
  const mk = (id: string, desc: string, pieces: number, l: number, w: number, h: number, weight: number, top: number, extra: Partial<Shipment> = {}): Shipment => ({
    id, awb: '', description: desc, origin: 'HKG', dest: 'LAX', pieces, l, w, h, weight, shc: ['GEN'], orientation: 'any', maxTopLoad: top, ...extra,
  });
  const shipments = [
    mk('D1', 'Parcels', 14, 60, 40, 40, 11, 60),
    mk('D2', 'Apparel', 8, 60, 50, 50, 16, 80),
    mk('D3', 'Documents', 10, 50, 40, 30, 12, 60),
    mk('D4', 'Electronics', 6, 80, 60, 50, 34, 120, { orientation: 'upright' }),
    mk('D5', 'Spare parts', 5, 40, 40, 40, 20, 90),
  ];
  try {
    const r = buildUp({ shipments }, aircraftById('B777F'), { strategy: 'contact', minSupport: 0.75 });
    const u = r.ulds.find((x) => x.typeId === 'AKE') ?? r.ulds[0];
    demoCache = u ? { uld: u, ships: new Map(shipments.map((s) => [s.id, s])) } : null;
  } catch {
    demoCache = null;
  }
  return demoCache;
}

function moverMap(list: { pieceId: string; kind: MoverKind }[]) {
  return new Map(list.map((m) => [m.pieceId, m.kind]));
}

function HoverTip({ id, x, y }: { id: string; x: number; y: number }) {
  const ships = useStore((s) => s.ships);
  const uld = useStore(selectedUld);
  const p = uld?.placements.find((q) => q.pieceId === id);
  const s = p ? ships.get(p.shipmentId) : undefined;
  if (!p || !s) return null;
  return (
    <div className="glass hover-tip" style={{ left: x, top: y }}>
      <b>{s.description}</b>
      <div className="muted mono" style={{ fontSize: 10.5 }}>{s.awb} · pc {p.pieceId.split('#')[1]}/{s.pieces} · #{p.seq}</div>
      <div>{kg(p.weight)} · {Math.round(p.w)}×{Math.round(p.d)}×{Math.round(p.h)} cm</div>
    </div>
  );
}

function Legend() {
  const mode = useStore((s) => s.colorMode);
  const uld = useStore(selectedUld);
  const ships = useStore((s) => s.ships);
  const physics = useStore((s) => s.physics);
  const res = uld ? physics.results[uld.id] : undefined;
  const present = useMemo(() => {
    const keys = new Set<string>();
    for (const p of uld?.placements ?? []) {
      const s = ships.get(p.shipmentId);
      if (s) keys.add(handlingOf(s).key);
    }
    return keys;
  }, [uld, ships]);
  if (res && !physics.running) {
    return (
      <div className="glass legend">
        <span className="legend-title">Stress-test result</span>
        <div className="row"><i className="sw" style={{ background: 'var(--critical)' }} /> Tips over (&gt; 12°)</div>
        <div className="row"><i className="sw" style={{ background: 'var(--serious)' }} /> Shifts &gt; 5 cm</div>
        <div className="row"><i className="sw" style={{ background: 'var(--warning)' }} /> Rocks / transient &gt; 8 cm</div>
        <div className="row"><i className="sw" style={{ background: '#4a6064' }} /> Holds position</div>
      </div>
    );
  }
  if (mode === 'weight') {
    const max = Math.max(...(uld?.placements.map((p) => p.weight) ?? [1]));
    return (
      <div className="glass legend">
        <span className="legend-title">Piece weight</span>
        <div className="ramp" style={{ background: `linear-gradient(90deg, ${WEIGHT_RAMP.join(',')})` }} />
        <div className="row" style={{ justifyContent: 'space-between' }}><span>0</span><span>{kg(max)}</span></div>
      </div>
    );
  }
  if (mode === 'temperature') {
    return (
      <div className="glass legend">
        <span className="legend-title">Temperature regime</span>
        {TEMP_CLASSES.map((t) => <div className="row" key={t.key}><i className="sw" style={{ background: t.color }} />{t.label}</div>)}
      </div>
    );
  }
  if (mode === 'shipment') {
    const ids = [...new Set(uld?.placements.map((p) => p.shipmentId))];
    return (
      <div className="glass legend">
        <span className="legend-title">Shipments in this ULD</span>
        {ids.slice(0, 8).map((id) => {
          const s = ships.get(id);
          const idx = Number(/\d+/.exec(id)?.[0] ?? 1) - 1;
          return <div className="row" key={id}><i className="sw" style={{ background: shipColor(idx) }} /><span className="nowrap" style={{ maxWidth: 190, overflow: 'hidden', textOverflow: 'ellipsis' }}>{s?.description}</span></div>;
        })}
        {ids.length > 8 && <div className="row muted">+{ids.length - 8} more</div>}
      </div>
    );
  }
  return (
    <div className="glass legend">
      <span className="legend-title">Handling class</span>
      {HANDLING.filter((h) => present.has(h.key)).map((h) => <div className="row" key={h.key}><i className="sw" style={{ background: h.color }} />{h.label}</div>)}
    </div>
  );
}


function SequencePlayer({ n }: { n: number }) {
  const seq = useStore((s) => s.seq);
  const physics = useStore((s) => s.physics);
  const set = useStore((s) => s.set);
  const step = seq.step ?? n;
  return (
    <div className="glass seq-player" aria-label="Build sequence">
      <button className="btn sm icon ghost" aria-label="Previous step" onClick={() => set({ seq: { step: Math.max(0, step - 1), playing: false } })} disabled={physics.running}><IconBack size={14} /></button>
      <button className="btn sm icon" aria-label={seq.playing ? 'Pause' : 'Play build sequence'} disabled={physics.running}
        onClick={() => set({ seq: seq.playing ? { step: seq.step, playing: false } : { step: seq.step === null || seq.step >= n ? 0 : seq.step, playing: true } })}>
        {seq.playing ? <IconPause size={14} /> : <IconPlay size={14} />}
      </button>
      <button className="btn sm icon ghost" aria-label="Next step" onClick={() => set({ seq: { step: Math.min(n, step + 1) >= n ? null : Math.min(n, step + 1), playing: false } })} disabled={physics.running}><IconStep size={14} /></button>
      <input type="range" min={0} max={n} value={step} aria-label="Build step" disabled={physics.running}
        onChange={(e) => { const v = Number(e.target.value); set({ seq: { step: v >= n ? null : v, playing: false } }); }} />
      <span className="mono dim" style={{ fontSize: 11, minWidth: 64, textAlign: 'right' }}>{step}/{n} pcs</span>
    </div>
  );
}

function StressHud({ onClear }: { onClear: () => void }) {
  const physics = useStore((s) => s.physics);
  const uld = useStore(selectedUld);
  const res = uld ? physics.results[uld.id] : undefined;
  const verdict = res?.verdict;
  return (
    <div className="glass stress-hud" role="status">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        <b style={{ fontSize: 12.5 }}>Stability check {physics.running ? '· running' : ''}</b>
        {!physics.running && verdict && (
          <span className={`badge ${verdict === 'stable' ? 'good' : verdict === 'restrain' ? 'warn' : 'bad'}`}>
            {verdict === 'stable' ? 'Stable' : verdict === 'restrain' ? 'Needs dunnage / straps' : 'Unstable — restack'}
          </span>
        )}
        {!physics.running && <button className="btn sm icon ghost" aria-label="Clear stress-test highlights" onClick={onClear}><IconX size={13} /></button>}
      </div>
      <div className="muted" style={{ fontSize: 11, marginTop: 2 }}>
        {physics.phase === 'settle' ? 'Settling the stack under 1 g…' : physics.running ? CASES[physics.caseIndex]?.description : 'Representative load cases · cannon-es rigid bodies · fixed 240 Hz step'}
      </div>
      <div className="cases">
        {CASES.map((c, i) => {
          const r = res?.cases.find((x) => x.id === c.id);
          const on = physics.running && physics.phase === 'case' && physics.caseIndex === i;
          const done = !!r || (physics.running && physics.caseIndex > i);
          return (
            <div key={c.id} className={`case ${on ? 'on' : ''} ${done ? 'done' : ''}`}>
              <b>{c.short}</b>
              {r ? `${r.movers.filter((m) => m.kind !== 'transient').length} moved · max ${num(r.maxDisp, 1)} cm` : on ? 'running…' : done ? 'done' : 'pending'}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Inspect() {
  const id = useStore((s) => s.selectedPieceId);
  const uld = useStore(selectedUld);
  const ships = useStore((s) => s.ships);
  const physics = useStore((s) => s.physics);
  const selectPiece = useStore((s) => s.selectPiece);
  const p = uld?.placements.find((q) => q.pieceId === id);
  const s = p ? ships.get(p.shipmentId) : undefined;
  if (!p || !s || !uld) return null;
  const mv = physics.results[uld.id]?.worst.find((m) => m.pieceId === p.pieceId);
  return (
    <div className="glass inspect" aria-label="Piece details">
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
        <div>
          <h4>{s.description}</h4>
          <div className="mono muted" style={{ fontSize: 11 }}>{s.awb} · piece {p.pieceId.split('#')[1]} of {s.pieces}</div>
        </div>
        <button className="btn sm icon ghost" aria-label="Close details" onClick={() => selectPiece(null)}><IconX size={13} /></button>
      </div>
      <div className="pill-row" style={{ marginTop: 8 }}><ShcChips codes={s.shc} /><DgChip s={s} /></div>
      <div className="grid">
        <span>Weight</span><span>{kg(p.weight)}</span>
        <span>Placed size (W×D×H)</span><span>{Math.round(p.w)}×{Math.round(p.d)}×{Math.round(p.h)} cm</span>
        <span>Position x / y / z</span><span className="mono">{Math.round(p.x)} / {Math.round(p.y)} / {Math.round(p.z)}</span>
        <span>Build step</span><span>#{p.seq} of {uld.placements.length}</span>
        <span>Orientation</span><span>{s.orientation === 'upright' ? 'This way up' : s.orientation === 'fixed' ? 'Fixed' : 'Any'}</span>
        <span>Base supported</span><span>{Math.round(p.supportRatio * 100)}%</span>
        {s.temp && <><span>Temperature</span><span>{s.temp.min}..{s.temp.max} °C · {REGIME_LABEL[uld.regime]}</span></>}
        {s.dg && <><span>DG</span><span>{s.dg.un} {s.dg.psn}{s.dg.cao ? ' (CAO)' : ''}</span></>}
      </div>
      <div style={{ marginTop: 9 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
          <span className="muted">Load on top</span>
          <span>{s.maxTopLoad <= 0 ? (p.loadOnTop > 0 ? `${kg(p.loadOnTop)} (non-stackable!)` : 'Non-stackable · top only') : `${kg(p.loadOnTop)} / ${kg(s.maxTopLoad)}`}</span>
        </div>
        {s.maxTopLoad > 0 && <Meter value={p.loadOnTop} max={s.maxTopLoad} color={p.loadOnTop / s.maxTopLoad > 0.85 ? 'var(--warning)' : undefined} />}
      </div>
      {mv && (
        <div className="warn warn" style={{ marginTop: 9 }}>
          <IconShake size={14} />
          <span>{mv.kind === 'tip' ? 'Tipped' : mv.kind === 'shift' ? 'Shifted' : 'Rocked'} in stress test: peak {num(mv.maxDisp, 1)} cm, final {num(mv.disp, 1)} cm, tilt {num(mv.tilt, 1)}°</span>
        </div>
      )}
    </div>
  );
}
