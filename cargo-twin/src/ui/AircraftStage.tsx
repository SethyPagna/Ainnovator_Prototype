import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '../app/store';
import { aircraftById, buildOverlapMap, type Position } from '../domain/aircraft';
import { envelopeLimitsAt, loadSequence, positionIssue } from '../domain/balance';
import type { BuiltUld } from '../domain/packing/buildup';
import { AircraftScene } from '../three/AircraftScene';
import { HANDLING, WEIGHT_RAMP, handlingOf, weightColor } from './colors';
import { IconDownload, IconPlane, IconPrint, IconReset, IconTrash } from './icons';
import { download } from './ManifestPanel';
import { shortUld } from './format';

export function AircraftStage() {
  const hostRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<AircraftScene | null>(null);
  const aircraftId = useStore((s) => s.aircraftId);
  const build = useStore((s) => s.build);
  const ships = useStore((s) => s.ships);
  const plan = useStore((s) => s.plan);
  const wb = useStore((s) => s.wb);
  const selected = useStore((s) => s.selectedUldId);
  const acColor = useStore((s) => s.acColor);
  const busy = useStore((s) => s.busy);
  const set = useStore((s) => s.set);
  const runPlan = useStore((s) => s.runPlan);
  const clearPlan = useStore((s) => s.clearPlan);
  const ac = aircraftById(aircraftId);

  useEffect(() => {
    const sc = new AircraftScene(hostRef.current!);
    sceneRef.current = sc;
    sc.onPick = (id) => id && useStore.getState().selectUld(id);
    const reset = () => sc.resetView();
    window.addEventListener('cct-reset-view', reset);
    return () => {
      window.removeEventListener('cct-reset-view', reset);
      sc.dispose();
      sceneRef.current = null;
    };
  }, []);

  useEffect(() => sceneRef.current?.setAircraft(ac), [ac]);
  useEffect(() => {
    sceneRef.current?.setAircraft(ac);
    sceneRef.current?.setPlan(build?.ulds ?? [], plan.assignments, ships, plan.seqOrder ?? undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [build, plan.assignments, plan.animateKey, ships, ac]);
  useEffect(() => sceneRef.current?.setSelected(selected), [selected, plan.assignments]);
  useEffect(() => sceneRef.current?.setColorMode(acColor, ships), [acColor, ships, plan.assignments]);
  useEffect(() => {
    const sc = sceneRef.current;
    if (!sc) return;
    if (!wb || !wb.loaded) return sc.setCg(null, null, 0, 0, null, true);
    sc.setCg(wb.towArm, wb.zfwArm, wb.towMac, wb.zfwMac, envelopeLimitsAt(ac.envelope, wb.tow), wb.inEnvelope.tow && wb.inEnvelope.zfw);
  }, [wb, ac]);

  const exportJson = () => {
    if (!build || !wb) return;
    const m = useStore.getState().manifest!;
    const seq = loadSequence(ac, plan.assignments);
    const byId = new Map(build.ulds.map((u) => [u.id, u]));
    const data = {
      generator: 'Cargo Twin aircraft workspace (portfolio prototype - not for operational use)',
      generatedAt: new Date().toISOString(),
      flight: m.flight, route: m.route, aircraft: ac.name,
      weightAndBalance: {
        dow: ac.dow, payload: Math.round(wb.payload), zfw: Math.round(wb.zfw), zfwMac: +wb.zfwMac.toFixed(2),
        takeoffFuel: plan.fuel, tow: Math.round(wb.tow), towMac: +wb.towMac.toFixed(2), lw: Math.round(wb.lw), lwMac: +wb.lwMac.toFixed(2),
        lateralMomentKgM: Math.round(wb.lateralMoment), holds: wb.holdWeights, warnings: wb.warnings,
      },
      loadingSequence: seq.map((pid, i) => {
        const u = byId.get(plan.assignments[pid])!;
        return { seq: i + 1, position: pid, uld: u.id, type: u.typeId, grossKg: Math.round(u.gross), shc: u.shc, dgClasses: u.dgClasses, awbs: u.shipmentIds.map((id) => ships.get(id)?.awb) };
      }),
      unassignedUlds: wb.unassigned,
      ulds: build.ulds.map((u) => ({ id: u.id, type: u.typeId, gross: Math.round(u.gross), cg: u.cg, pieces: u.placements.map((p) => ({ piece: p.pieceId, awb: ships.get(p.shipmentId)?.awb, x: p.x, y: p.y, z: p.z, w: p.w, h: p.h, d: p.d, kg: p.weight, seq: p.seq })) })),
    };
    download(`${m.flight.replace(/\s/g, '')}-loadplan.json`, JSON.stringify(data, null, 2), 'application/json');
  };

  return (
    <div className="aircraft-stage">
      <div className="viewport" aria-label="Aircraft 3D view">
        <div className="gl" ref={hostRef} />
        {busy.plan && <div className="progress"><i /></div>}
        <div className="overlay-tl">
          <div className="glass toolbar" role="toolbar" aria-label="Load plan tools">
            <button className="btn sm primary" onClick={() => runPlan(true)} disabled={!build || busy.plan} title="Auto-plan positions (A)"><IconPlane size={14} /> Auto-plan</button>
            <button className="btn sm" onClick={clearPlan} disabled={!wb?.loaded} title="Unload every position"><IconTrash size={14} /> <span className="lbl">Clear</span></button>
            <span className="div" />
            <div className="seg" role="radiogroup" aria-label="Colour ULDs by">
              <button className={acColor === 'handling' ? 'on' : ''} onClick={() => set({ acColor: 'handling' })}>Handling</button>
              <button className={acColor === 'weight' ? 'on' : ''} onClick={() => set({ acColor: 'weight' })}>Load vs limit</button>
            </div>
            <button className="btn sm icon" onClick={() => sceneRef.current?.resetView()} aria-label="Reset camera" title="Reset camera (V)"><IconReset size={14} /></button>
            <span className="div" />
            <button className="btn sm" onClick={() => set({ lir: true })} disabled={!wb?.loaded} title="Loading instruction sheet (L)"><IconPrint size={14} /> <span className="lbl">LIR</span></button>
            <button className="btn sm" onClick={exportJson} disabled={!wb?.loaded} title="Export load plan as JSON"><IconDownload size={14} /> <span className="lbl">JSON</span></button>
          </div>
        </div>
        <div className="overlay-br">
          <div className="glass legend" style={{ minWidth: 0, maxWidth: 360 }} title={ac.notes}>
            <span className="legend-title">{ac.name} · representative data</span>
            {acColor === 'weight' ? (
              <>
                <div className="ramp" style={{ background: `linear-gradient(90deg, ${WEIGHT_RAMP.join(',')})`, width: 180 }} />
                <div className="row" style={{ justifyContent: 'space-between', width: 180 }}><span>light</span><span>at position limit</span></div>
              </>
            ) : (
              HANDLING.filter((h) => h.key !== 'fragile').map((h) => <div className="row" key={h.key}><i className="sw" style={{ background: h.color }} />{h.label}</div>)
            )}
          </div>
        </div>
        {!build && (
          <div className="welcome"><div className="glass welcome-card"><h2>No ULDs to load yet</h2><p>Build the ULDs first (Build-up tab, or press <span className="kbd">P</span>), then auto-plan or drag them onto positions.</p></div></div>
        )}
      </div>
      <DeckPlan />
    </div>
  );
}

// ---------------------------------------------------------------------------------------
// 2D deck plan with drag & drop
// ---------------------------------------------------------------------------------------

interface Drag {
  uldId: string;
  from: string | null;
  x: number;
  y: number;
  over: string | null;
  overTray: boolean;
  reason: string | null;
}

function DeckPlan() {
  const aircraftId = useStore((s) => s.aircraftId);
  const build = useStore((s) => s.build);
  const ships = useStore((s) => s.ships);
  const assignments = useStore((s) => s.plan.assignments);
  const wb = useStore((s) => s.wb);
  const selected = useStore((s) => s.selectedUldId);
  const acColor = useStore((s) => s.acColor);
  const assign = useStore((s) => s.assign);
  const selectUld = useStore((s) => s.selectUld);
  const toast = useStore((s) => s.toast);
  const ac = aircraftById(aircraftId);
  const svgRef = useRef<SVGSVGElement>(null);
  const trayRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const dragRef = useRef<Drag | null>(null);
  dragRef.current = drag;

  const overlaps = useMemo(() => buildOverlapMap(ac), [ac]);
  const uldById = useMemo(() => new Map((build?.ulds ?? []).map((u) => [u.id, u])), [build]);
  const posOf = useMemo(() => new Map(Object.entries(assignments).map(([p, u]) => [u, p])), [assignments]);
  const unassigned = (build?.ulds ?? []).filter((u) => !posOf.has(u.id));

  const x0 = Math.min(...ac.positions.map((p) => p.x0)) - 1.5;
  const x1 = Math.max(...ac.positions.map((p) => p.x1)) + 0.8;
  const MDc = 3.8; // centre line of the main-deck strip (svg units = metres)
  const LDc = 10.5; // centre line of the lower-deck strip
  const H = 14.8;
  const yOf = (p: Position) => (p.deck === 'main' ? MDc : LDc) - p.y1; // starboard at the top

  const check = (u: BuiltUld, p: Position, from: string | null): string | null => {
    const issue = positionIssue(p, u, ships);
    if (issue) return issue;
    for (const q of overlaps.get(p.id) ?? []) {
      const occ = assignments[q];
      if (occ && occ !== u.id) return `Blocked: overlapping position ${q} is loaded`;
    }
    const displaced = assignments[p.id];
    if (displaced && displaced !== u.id && from) {
      const d = uldById.get(displaced)!;
      const fp = ac.positions.find((q) => q.id === from)!;
      const back = positionIssue(fp, d, ships);
      if (back) return `Swap not possible: ${shortUld(displaced)} cannot go to ${from}`;
    }
    return null;
  };

  const toSvg = (cx: number, cy: number) => {
    const svg = svgRef.current!;
    const pt = svg.createSVGPoint();
    pt.x = cx;
    pt.y = cy;
    return pt.matrixTransform(svg.getScreenCTM()!.inverse());
  };

  const hit = (cx: number, cy: number, u: BuiltUld, from: string | null): { pid: string | null; reason: string | null } => {
    const pt = toSvg(cx, cy);
    const under = ac.positions.filter((p) => pt.x >= p.x0 && pt.x <= p.x1 && pt.y >= yOf(p) && pt.y <= yOf(p) + (p.y1 - p.y0));
    if (!under.length) return { pid: null, reason: null };
    const ok = under.find((p) => !check(u, p, from));
    if (ok) return { pid: ok.id, reason: null };
    return { pid: under[0].id, reason: check(u, under[0], from) };
  };

  useEffect(() => {
    if (!drag) return;
    const move = (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d) return;
      const u = uldById.get(d.uldId);
      if (!u) return;
      const tr = trayRef.current?.getBoundingClientRect();
      const overTray = !!tr && e.clientX >= tr.left && e.clientX <= tr.right && e.clientY >= tr.top && e.clientY <= tr.bottom;
      const h = overTray ? { pid: null, reason: null } : hit(e.clientX, e.clientY, u, d.from);
      setDrag({ ...d, x: e.clientX, y: e.clientY, over: h.pid, reason: h.reason, overTray });
    };
    const up = () => {
      const d = dragRef.current;
      setDrag(null);
      if (!d) return;
      if (d.overTray && d.from) return assign(d.from, null);
      if (!d.over) return;
      if (d.reason) return toast(d.reason, 'warn');
      if (d.over !== d.from) assign(d.over, d.uldId);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up, { once: true });
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!drag]);

  const start = (e: React.PointerEvent, uldId: string, from: string | null) => {
    e.preventDefault();
    selectUld(uldId);
    setDrag({ uldId, from, x: e.clientX, y: e.clientY, over: from, overTray: false, reason: null });
  };

  const dragU = drag ? uldById.get(drag.uldId) : undefined;
  const colorOf = (u: BuiltUld, p: Position) => {
    if (acColor === 'weight') return weightColor(u.gross / p.maxWeight);
    let best = { c: '#7d9295', kg: 0 };
    const acc = new Map<string, { c: string; kg: number }>();
    for (const pl of u.placements) {
      const s = ships.get(pl.shipmentId);
      if (!s) continue;
      const h = handlingOf(s);
      const cur = acc.get(h.key) ?? { c: h.color, kg: 0 };
      cur.kg += pl.weight * (h.key === 'dg' ? 3 : 1);
      acc.set(h.key, cur);
      if (cur.kg > best.kg) best = cur;
    }
    return best.c;
  };
  const cgX = wb && wb.loaded ? wb.towArm : null;
  const zfwX = wb && wb.loaded ? wb.zfwArm : null;
  const lim = wb ? envelopeLimitsAt(ac.envelope, wb.tow) : null;
  const errorsByUld = new Set((wb?.warnings ?? []).filter((w) => w.level === 'error' && w.ref).map((w) => w.ref!));

  return (
    <div className="panel deck-plan" aria-label="Deck plan">
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span className="panel-title">Deck plan · drag ULDs onto positions</span>
        <span className="muted" style={{ fontSize: 11 }}>nose ←  · starboard at top · dashed = centre-line alternatives</span>
        <span style={{ flex: 1 }} />
        <span className="muted" style={{ fontSize: 11 }}>{wb ? `${wb.loaded}/${build?.ulds.length ?? 0} loaded` : ''}</span>
      </div>
      <div ref={trayRef} className={`tray ${drag?.overTray ? 'drop' : ''}`} aria-label="Unassigned ULDs">
        {!build && <span className="muted" style={{ fontSize: 11, padding: '0 6px' }}>No ULDs built yet</span>}
        {build && !unassigned.length && <span className="muted" style={{ fontSize: 11, padding: '0 6px' }}>All ULDs assigned · drag one here to offload it</span>}
        {unassigned.map((u) => (
          <span key={u.id} className="tray-chip" style={{ outline: selected === u.id ? '1px solid var(--accent)' : undefined }} onPointerDown={(e) => start(e, u.id, null)} title={`${u.typeId} · ${Math.round(u.gross)} kg`}>
            <i className="sw" style={{ width: 8, height: 8, borderRadius: 2, background: colorOf(u, ac.positions.find((p) => p.accepts.includes(u.typeId)) ?? ac.positions[0]) }} />
            {shortUld(u.id)} · {(u.gross / 1000).toFixed(1)}t
          </span>
        ))}
      </div>
      <svg ref={svgRef} viewBox={`${x0} 0 ${x1 - x0} ${H}`} preserveAspectRatio="xMidYMid meet" role="img" aria-label={`${ac.name} deck plan`}>
        <text x={x0 + 0.2} y={0.75} fontSize={0.62} fill="#6f8784" fontWeight={650} letterSpacing={0.05}>MAIN DECK</text>
        <text x={x0 + 0.2} y={7.95} fontSize={0.62} fill="#6f8784" fontWeight={650} letterSpacing={0.05}>LOWER DECK</text>
        {/* fuselage outline strips */}
        <rect x={x0 + 0.4} y={MDc - 2.75} width={x1 - x0 - 0.6} height={5.5} rx={0.6} fill="rgba(150,220,205,0.025)" stroke="rgba(150,220,205,0.12)" strokeWidth={0.04} />
        <rect x={x0 + 0.4} y={LDc - 2.3} width={x1 - x0 - 0.6} height={4.6} rx={0.6} fill="rgba(150,220,205,0.025)" stroke="rgba(150,220,205,0.12)" strokeWidth={0.04} />
        {/* door */}
        <rect x={ac.body.doorX[0]} y={MDc + 2.6} width={ac.body.doorX[1] - ac.body.doorX[0]} height={0.22} fill="#fab219" rx={0.08} />
        <text x={(ac.body.doorX[0] + ac.body.doorX[1]) / 2} y={MDc + 3.4} fontSize={0.42} fill="#e0b24e" textAnchor="middle">cargo door (port)</text>
        {[...ac.positions].sort((a, b) => Number(!!a.alt) - Number(!!b.alt)).map((p) => {
          const uid = assignments[p.id];
          const u = uid ? uldById.get(uid) : undefined;
          const y = yOf(p);
          const w = p.x1 - p.x0, h = p.y1 - p.y0;
          let stroke = 'rgba(95,224,196,0.35)';
          let fill = 'rgba(95,224,196,0.03)';
          if (dragU) {
            const reason = check(dragU, p, drag!.from);
            if (!reason) { fill = 'rgba(12,163,12,0.16)'; stroke = 'rgba(12,163,12,0.8)'; }
            else if (drag!.over === p.id) { fill = 'rgba(208,59,59,0.2)'; stroke = '#d03b3b'; }
            else { fill = 'rgba(0,0,0,0)'; stroke = 'rgba(95,224,196,0.12)'; }
          }
          if (drag?.over === p.id && !drag.reason) { fill = 'rgba(95,224,196,0.28)'; stroke = '#5fe0c4'; }
          if (p.alt && !u && !dragU) return (
            <rect key={p.id} x={p.x0} y={y} width={w} height={h} fill="none" stroke="rgba(95,224,196,0.18)" strokeWidth={0.04} strokeDasharray="0.2 0.15" />
          );
          return (
            <g key={p.id}>
              <rect x={p.x0 + 0.03} y={y + 0.03} width={w - 0.06} height={h - 0.06} rx={0.12} fill={fill} stroke={stroke} strokeWidth={0.05} strokeDasharray={p.alt ? '0.2 0.15' : undefined} />
              <text x={p.x0 + 0.14} y={y + 0.48} fontSize={0.4} fill="#6f8784" style={{ pointerEvents: 'none' }}>{p.id}</text>
              {u && (
                <g style={{ cursor: 'grab' }} onPointerDown={(e) => start(e, u.id, p.id)} onDoubleClick={() => assign(p.id, null)}>
                  <title>{`${u.id} · ${u.typeId} · ${Math.round(u.gross)} kg (limit ${p.maxWeight} kg) — drag to move, double-click to offload`}</title>
                  <rect x={p.x0 + 0.12} y={y + 0.12} width={w - 0.24} height={h - 0.24} rx={0.14}
                    fill={colorOf(u, p)} fillOpacity={drag?.uldId === u.id ? 0.25 : 0.62}
                    stroke={errorsByUld.has(u.id) ? '#d03b3b' : selected === u.id ? '#ffffff' : 'rgba(0,0,0,0.4)'} strokeWidth={selected === u.id || errorsByUld.has(u.id) ? 0.1 : 0.04} />
                  {w > 1.2 && (
                    <text x={p.x0 + w / 2} y={y + h / 2 + 0.05} fontSize={Math.min(0.66, w / 5.4)} textAnchor="middle" fill="#f4fbfa" fontFamily="JetBrains Mono, monospace" fontWeight={600} style={{ pointerEvents: 'none' }}>
                      {shortUld(u.id).split(' ')[1]}
                    </text>
                  )}
                  <text x={p.x0 + w / 2} y={y + h / 2 + 0.72} fontSize={Math.min(0.52, w / 6)} textAnchor="middle" fill="#dff4ef" style={{ pointerEvents: 'none' }}>
                    {(u.gross / 1000).toFixed(1)}t
                  </text>
                </g>
              )}
            </g>
          );
        })}
        {/* CG and MAC */}
        <g>
          <text x={ac.lemac - 0.2} y={H - 0.78} fontSize={0.5} fill="#5fe0c4" textAnchor="end">LEMAC</text>
          <rect x={ac.lemac} y={H - 1.1} width={ac.mac} height={0.28} fill="rgba(95,224,196,0.25)" />
          {lim && <rect x={ac.lemac + (lim[0] / 100) * ac.mac} y={H - 1.16} width={((lim[1] - lim[0]) / 100) * ac.mac} height={0.4} fill="rgba(12,163,12,0.35)" stroke="#0ca30c" strokeWidth={0.03} />}
          <text x={ac.lemac + ac.mac + 0.2} y={H - 0.78} fontSize={0.5} fill="#6f8784">MAC {ac.mac.toFixed(2)} m · green = CG limits at TOW</text>
        </g>
        {zfwX !== null && <line x1={zfwX} x2={zfwX} y1={1.0} y2={H - 1.1} stroke="#fab219" strokeWidth={0.05} strokeDasharray="0.25 0.18" opacity={0.8} />}
        {cgX !== null && (
          <g>
            <line x1={cgX} x2={cgX} y1={1.0} y2={H - 0.7} stroke={wb!.inEnvelope.tow ? '#5fe0c4' : '#d03b3b'} strokeWidth={0.07} />
            <text x={cgX + 0.2} y={0.8} fontSize={0.55} fill={wb!.inEnvelope.tow ? '#5fe0c4' : '#ff9b9b'} fontFamily="JetBrains Mono, monospace">TOW CG {wb!.towMac.toFixed(1)}%</text>
          </g>
        )}
      </svg>
      {drag && (
        <div className={`drag-ghost glass ${drag.over ? (drag.reason ? 'bad' : 'ok') : ''}`} style={{ left: drag.x, top: drag.y }}>
          {shortUld(drag.uldId)}{drag.over ? ` → ${drag.over}` : drag.overTray ? ' → offload' : ''}
          {drag.reason && <div style={{ fontFamily: 'var(--sans)', fontSize: 10.5, maxWidth: 240 }}>{drag.reason}</div>}
        </div>
      )}
    </div>
  );
}
