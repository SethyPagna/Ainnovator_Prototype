import { useMemo } from 'react';
import { selectedUld, useStore } from '../app/store';
import { aircraftById, type Aircraft } from '../domain/aircraft';
import type { Warning, WbResult } from '../domain/balance';
import { REGIME_LABEL } from '../domain/rules';
import { uldType, usableVolumeM3 } from '../domain/uld';
import { CASES, THRESHOLDS } from '../physics/stability';
import { Meter } from './bits';
import { IconAlert, IconCheck, IconInfo, IconShake } from './icons';
import { kg, num, pct, tonnes } from './format';

export function RightPanel() {
  const tab = useStore((s) => s.tab);
  return (
    <aside className="panel" aria-label="Status">
      <div className="panel-head">
        <span className="panel-title">{tab === 'aircraft' ? 'Weight & balance' : tab === 'compare' ? 'Strategy notes' : 'Build-up KPIs'}</span>
      </div>
      <div className="scroll">
        {tab === 'aircraft' ? <WbPanel /> : tab === 'compare' ? <CompareNotes /> : <BuildPanel />}
      </div>
    </aside>
  );
}

function WarningList({ items }: { items: Warning[] }) {
  if (!items.length) return <div className="warn info"><IconCheck size={14} /><span>No warnings.</span></div>;
  const order = { error: 0, warn: 1, info: 2 };
  return (
    <div className="warn-list">
      {[...items].sort((a, b) => order[a.level] - order[b.level]).slice(0, 14).map((w, i) => (
        <div key={i} className={`warn ${w.level}`}>
          {w.level === 'info' ? <IconInfo size={14} /> : <IconAlert size={14} />}
          <span>{w.text}</span>
        </div>
      ))}
      {items.length > 14 && <div className="muted" style={{ fontSize: 11 }}>+{items.length - 14} more</div>}
    </div>
  );
}

function BuildPanel() {
  const build = useStore((s) => s.build);
  const stale = useStore((s) => s.buildStale);
  const uld = useStore(selectedUld);
  const physics = useStore((s) => s.physics);
  const ships = useStore((s) => s.ships);
  const minSupport = useStore((s) => s.minSupport);
  const setMinSupport = useStore((s) => s.setMinSupport);
  const selectPiece = useStore((s) => s.selectPiece);

  const warnings = useMemo<Warning[]>(() => {
    if (!build) return [];
    const out: Warning[] = [];
    const byReason = new Map<string, { n: number; kg: number; ship: string }>();
    for (const u of build.unplaced) {
      const k = `${u.shipmentId}|${u.reason}`;
      const cur = byReason.get(k) ?? { n: 0, kg: 0, ship: u.shipmentId };
      cur.n++;
      cur.kg += ships.get(u.shipmentId)?.weight ?? 0;
      byReason.set(k, cur);
    }
    for (const [k, v] of byReason) {
      const s = ships.get(v.ship);
      out.push({ level: 'error', code: 'UNPLACED', text: `${s?.description ?? v.ship} — ${v.n} pc (${kg(v.kg)}) not loaded: ${k.split('|')[1]}` });
    }
    for (const u of build.ulds) {
      if (Math.abs(u.cgOffsetPct.x) > 10 || Math.abs(u.cgOffsetPct.z) > 10) out.push({ level: 'warn', code: 'ULDCG', text: `${u.id}: CG ${num(u.cgOffsetPct.x, 1)}% lateral / ${num(u.cgOffsetPct.z, 1)}% longitudinal from base centre (guide ±10%)` });
    }
    const light = build.ulds.filter((u) => u.volUtil < 0.2 && u.wtUtil < 0.2);
    if (light.length) out.push({ level: 'info', code: 'LIGHT', text: `${light.length} lightly used ULD${light.length > 1 ? 's' : ''} (segregation / temperature / remainder builds)` });
    return out;
  }, [build, ships]);

  if (!build) {
    return (
      <div className="section">
        <div className="empty" style={{ padding: '30px 8px' }}>
          <div>Build ULDs to see utilisation, chargeable weight and warnings.</div>
          <div>Press <span className="kbd">P</span> to pack or <span className="kbd">S</span> for the guided sample flight.</div>
        </div>
      </div>
    );
  }
  const k = build.kpis;
  const types = Object.entries(k.byType).map(([t, n]) => `${n}× ${t.replace('-', ' ')}`).join(' · ');
  const res = uld ? physics.results[uld.id] : undefined;
  const t = uld ? uldType(uld.typeId) : null;
  return (
    <>
      <div className="section">
        {stale && <div className="warn warn" style={{ marginBottom: 8 }}><IconAlert size={14} /><span>Inputs changed since this build — press <span className="kbd">P</span> to rebuild.</span></div>}
        <div className="kpis">
          <div className="kpi"><div className="l">ULDs built</div><div className="v">{k.ulds}</div><div className="s" title={types}>{types}</div></div>
          <div className="kpi"><div className="l">Pieces loaded</div><div className="v">{k.placedPieces}<span className="muted" style={{ fontSize: 13 }}>/{k.pieces}</span></div><div className="s">{k.unplacedPieces ? `${k.unplacedPieces} not loaded (${kg(k.unplacedKg)})` : 'all pieces stowed'}</div></div>
          <div className="kpi"><div className="l">Volume utilisation</div><div className="v">{pct(k.volUtil)}</div><div className="s">of usable contour volume</div></div>
          <div className="kpi"><div className="l">Weight utilisation</div><div className="v">{pct(k.wtUtil)}</div><div className="s">of buildable payload</div></div>
          <div className="kpi"><div className="l">Chargeable weight</div><div className="v">{tonnes(k.chargeableKg)}</div><div className="s">max(actual, vol ÷ 6000)</div></div>
          <div className="kpi"><div className="l">Gross incl. tare</div><div className="v">{tonnes(k.grossKg)}</div><div className="s">tare {kg(k.tareKg)} · {build.ms} ms</div></div>
        </div>
      </div>
      {uld && t && (
        <div className="section">
          <h3>Selected ULD <span className="mono" style={{ letterSpacing: 0, textTransform: 'none', color: 'var(--text)' }}>{uld.id}</span></h3>
          <div className="wb-grid" style={{ gridTemplateColumns: '1fr auto' }}>
            <span className="dim">Type / contour</span><span className="r">{t.iata} ({t.alias}) · {t.contour}</span>
            <span className="dim">Gross / build cap</span><span className="r">{kg(uld.gross)} / {kg(uld.cap)}</span>
            <span className="dim">Tare · MGW</span><span className="r">{kg(uld.tare)} · {kg(t.maxGross)}</span>
            <span className="dim">Usable volume</span><span className="r">{num(usableVolumeM3(t), 2)} m³ · {pct(uld.volUtil)} used</span>
            <span className="dim">Build height</span><span className="r">{Math.round(uld.heightUsed)} / {t.external.height} cm</span>
            <span className="dim">Climate</span><span className="r">{uld.active ? `Active, setpoint ${uld.setpoint} °C` : uld.regime === 'AMB' ? 'Ambient' : `${REGIME_LABEL[uld.regime]} (passive cover)`}</span>
            <span className="dim">CG vs base centre</span><span className="r">{num(uld.cgOffsetPct.x, 1)}% lat · {num(uld.cgOffsetPct.z, 1)}% long · {Math.round(uld.cg.y)} cm high</span>
          </div>
          <div className="muted" style={{ fontSize: 11, marginTop: 8 }}>{t.notes}</div>
        </div>
      )}
      {uld && (
        <div className="section">
          <h3>Stability <span className="muted" style={{ textTransform: 'none', letterSpacing: 0 }}>{res ? '' : 'press T'}</span></h3>
          {!res && <div className="muted" style={{ fontSize: 12 }}>Runs a cannon-es rigid-body simulation: the stack settles under 1 g, then {CASES.map((c) => c.short).join(', ')} are applied. Pieces that shift &gt; {THRESHOLDS.shiftCm} cm or tilt &gt; {THRESHOLDS.tipDeg}° are flagged.</div>}
          {res && (
            <>
              <span className={`badge ${res.verdict === 'stable' ? 'good' : res.verdict === 'restrain' ? 'warn' : 'bad'}`}>
                {res.verdict === 'stable' ? 'Stable under all cases' : res.verdict === 'restrain' ? 'Shifts — add dunnage / straps' : 'Tipping — rework the stack'}
              </span>
              <div className="wb-grid" style={{ marginTop: 8, gridTemplateColumns: '1fr auto auto' }}>
                <span className="h">Case</span><span className="h r">Moved</span><span className="h r">Peak</span>
                {res.cases.map((c) => (
                  <span key={c.id} style={{ display: 'contents' }}>
                    <span>{CASES.find((x) => x.id === c.id)?.short}</span>
                    <span className="r">{c.movers.filter((m) => m.kind !== 'transient').length}</span>
                    <span className="r">{num(c.maxDisp, 1)} cm</span>
                  </span>
                ))}
              </div>
              {res.worst.length > 0 && (
                <div className="warn-list" style={{ marginTop: 8 }}>
                  {res.worst.slice(0, 5).map((m) => (
                    <button key={m.pieceId} className="warn warn" style={{ textAlign: 'left', cursor: 'pointer' }} onClick={() => selectPiece(m.pieceId)}>
                      <IconShake size={14} />
                      <span><b>{ships.get(m.pieceId.split('#')[0])?.description}</b> #{m.pieceId.split('#')[1]} — {m.kind}, peak {num(m.maxDisp, 1)} cm, tilt {num(m.tilt, 0)}°</span>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}
      <div className="section">
        <h3>Build warnings <span className="muted">{warnings.length}</span></h3>
        <WarningList items={warnings} />
      </div>
      <div className="section">
        <h3>Engine settings</h3>
        <label className="field">
          <span className="slider-row"><span>Minimum base support</span><b className="mono">{Math.round(minSupport * 100)}%</b></span>
          <input type="range" min={0.5} max={1} step={0.05} value={minSupport} onChange={(e) => setMinSupport(Number(e.target.value))} />
        </label>
        <div className="muted" style={{ fontSize: 11, marginTop: 6 }}>Hard constraints: contour clipping, no overlap, support ratio, per-piece load bearing, orientation locks, temperature regime, DGR segregation (Table 9.3.A), VAL/AVI dedicated ULDs, CAO main-deck only, build weight cap per position limits.</div>
      </div>
    </>
  );
}

function WbPanel() {
  const wb = useStore((s) => s.wb);
  const plan = useStore((s) => s.plan);
  const manifest = useStore((s) => s.manifest);
  const aircraftId = useStore((s) => s.aircraftId);
  const setFuel = useStore((s) => s.setFuel);
  const setTargetMac = useStore((s) => s.setTargetMac);
  const ac = aircraftById(aircraftId);
  if (!wb || !manifest) {
    return <div className="section"><div className="empty" style={{ padding: '30px 8px' }}>Build ULDs and plan the aircraft to see weight &amp; balance.</div></div>;
  }
  const over = (v: number, lim: number) => (v > lim ? 'over' : '');
  const margin = (v: number, lim: number) => `${v > lim ? '+' : '−'}${tonnes(Math.abs(lim - v))}`;
  return (
    <>
      <div className="section">
        <EnvelopeChart ac={ac} wb={wb} target={plan.targetMac} />
      </div>
      <div className="section">
        <div className="wb-grid">
          <span className="h">Weight</span><span className="h r">kg</span><span className="h r">%MAC · margin</span>
          <span className="dim">Dry operating (DOW)</span><span className="r">{num(ac.dow)}</span><span className="r muted">{num(((ac.dowArm - ac.lemac) / ac.mac) * 100, 1)}</span>
          <span className="dim">Payload ({wb.loaded} ULDs)</span><span className="r">{num(wb.payload)}</span><span className="r muted">{wb.payload ? num(((wb.payloadArm - ac.lemac) / ac.mac) * 100, 1) : '—'}</span>
          <span><b>ZFW</b></span><span className={`r ${over(wb.zfw, ac.mzfw)}`}><b>{num(wb.zfw)}</b></span><span className="r">{num(wb.zfwMac, 1)} · {margin(wb.zfw, ac.mzfw)}</span>
          <span className="dim">Take-off fuel</span><span className="r">{num(plan.fuel)}</span><span className="r muted">{num(((ac.fuelArm - ac.lemac) / ac.mac) * 100, 1)}</span>
          <span><b>TOW</b></span><span className={`r ${over(wb.tow, ac.mtow)}`}><b>{num(wb.tow)}</b></span><span className="r">{num(wb.towMac, 1)} · {margin(wb.tow, ac.mtow)}</span>
          <span className="dim">Trip fuel</span><span className="r">{num(manifest.tripFuel)}</span><span />
          <span><b>LW</b></span><span className={`r ${over(wb.lw, ac.mlw)}`}><b>{num(wb.lw)}</b></span><span className="r">{num(wb.lwMac, 1)} · {margin(wb.lw, ac.mlw)}</span>
        </div>
      </div>
      <div className="section">
        <label className="field">
          <span className="slider-row"><span>Take-off fuel</span><b className="mono">{tonnes(plan.fuel)}</b></span>
          <input type="range" min={Math.round(manifest.tripFuel * 0.8)} max={ac.maxFuel} step={500} value={plan.fuel} onChange={(e) => setFuel(Number(e.target.value))} aria-label="Take-off fuel" />
        </label>
        <label className="field" style={{ marginTop: 8 }}>
          <span className="slider-row"><span>Optimiser CG target</span><b className="mono">{plan.targetMac.toFixed(1)} %MAC</b></span>
          <input type="range" min={ac.envelope[0][0] + 2} max={Math.max(...ac.envelope.map((p) => p[0])) - 4} step={0.5} value={plan.targetMac} onChange={(e) => setTargetMac(Number(e.target.value))} aria-label="CG target" />
        </label>
        <div className="muted" style={{ fontSize: 11 }}>Aft-of-centre CG trims with less tail download (lower fuel burn); re-run Auto-plan after changing the target.</div>
      </div>
      <div className="section">
        <h3>Holds &amp; balance</h3>
        <div className="hold-bars">
          {ac.holds.map((h) => (
            <div className="row" key={h.id}>
              <span className="dim">{h.label}</span>
              <Meter value={wb.holdWeights[h.id]} max={h.maxWeight} color={wb.holdWeights[h.id] > h.maxWeight ? 'var(--critical)' : undefined} />
              <span className="v">{tonnes(wb.holdWeights[h.id])}</span>
            </div>
          ))}
          <div className="row">
            <span className="dim">Lateral imbalance</span>
            <Meter value={Math.abs(wb.lateralMoment)} max={ac.lateralLimit} color={Math.abs(wb.lateralMoment) > ac.lateralLimit ? 'var(--warning)' : undefined} />
            <span className="v">{num(Math.abs(wb.lateralMoment) / 1000, 1)} t·m {wb.lateralMoment > 0 ? 'R' : wb.lateralMoment < 0 ? 'L' : ''}</span>
          </div>
          <div className="row">
            <span className="dim">MD positions</span>
            <Meter value={wb.positionsUsed.main} max={wb.positionsUsed.mainTotal} />
            <span className="v">{wb.positionsUsed.main}/{wb.positionsUsed.mainTotal} MD</span>
          </div>
        </div>
      </div>
      <div className="section">
        <h3>Warnings <span className="muted">{wb.warnings.length}</span></h3>
        <WarningList items={wb.warnings} />
      </div>
      <div className="section muted" style={{ fontSize: 11 }}>
        Simplified W&amp;B: moments about a nose datum with representative arms, fixed fuel arm and an illustrative take-off envelope. Not for operational use.
      </div>
    </>
  );
}

export function EnvelopeChart({ ac, wb, target }: { ac: Aircraft; wb: WbResult; target: number }) {
  const W = 320, H = 222, ml = 40, mr = 12, mt = 12, mb = 30;
  const macs = ac.envelope.map((p) => p[0]);
  const ws = ac.envelope.map((p) => p[1] / 1000);
  const xmin = Math.floor(Math.min(...macs, wb.zfwMac, wb.towMac) / 5) * 5 - 2;
  const xmax = Math.ceil(Math.max(...macs, wb.zfwMac, wb.towMac) / 5) * 5 + 2;
  const ymin = Math.floor(Math.min(...ws, wb.zfw / 1000) / 50) * 50;
  const ymax = Math.ceil((Math.max(ac.mtow, wb.tow) / 1000 + 10) / 50) * 50;
  const X = (v: number) => ml + ((v - xmin) / (xmax - xmin)) * (W - ml - mr);
  const Y = (t: number) => mt + (1 - (t - ymin) / (ymax - ymin)) * (H - mt - mb);
  const poly = ac.envelope.map(([m, w]) => `${X(m)},${Y(w / 1000)}`).join(' ');
  const xticks: number[] = [];
  for (let v = Math.ceil(xmin / 5) * 5; v <= xmax; v += 5) xticks.push(v);
  const yticks: number[] = [];
  for (let v = ymin; v <= ymax; v += 50) yticks.push(v);
  const ok = wb.inEnvelope.tow && wb.inEnvelope.zfw;
  const pts = [
    { k: 'ZFW', mac: wb.zfwMac, t: wb.zfw / 1000, in: wb.inEnvelope.zfw },
    { k: 'TOW', mac: wb.towMac, t: wb.tow / 1000, in: wb.inEnvelope.tow },
    { k: 'LW', mac: wb.lwMac, t: wb.lw / 1000, in: wb.inEnvelope.lw },
  ];
  const line = (t: number, label: string, dash?: string, left = false) => (
    <g>
      <line x1={ml} x2={W - mr} y1={Y(t)} y2={Y(t)} stroke="#6f8784" strokeWidth={1} strokeDasharray={dash} />
      <text x={left ? ml + 3 : W - mr - 2} y={left ? Y(t) + 10 : Y(t) - 3} fontSize={9} fill="#a9bdba" textAnchor={left ? 'start' : 'end'}>{label} {Math.round(t)} t</text>
    </g>
  );
  return (
    <figure style={{ margin: 0 }}>
      <figcaption style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <span style={{ fontSize: 11, fontWeight: 650, letterSpacing: '.09em', textTransform: 'uppercase', color: 'var(--text-2)' }}>CG envelope</span>
        <span className={`badge ${ok ? 'good' : 'bad'}`}>{ok ? <IconCheck size={12} /> : <IconAlert size={12} />}{ok ? 'Within limits' : 'Out of envelope'}</span>
      </figcaption>
      <svg className="envelope" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`CG envelope: ZFW ${wb.zfwMac.toFixed(1)} %MAC, TOW ${wb.towMac.toFixed(1)} %MAC`}>
        {yticks.map((t) => <line key={t} x1={ml} x2={W - mr} y1={Y(t)} y2={Y(t)} stroke="#1c2f33" strokeWidth={1} />)}
        {xticks.map((v) => <line key={v} x1={X(v)} x2={X(v)} y1={mt} y2={H - mb} stroke="#1c2f33" strokeWidth={1} />)}
        <polygon points={poly} fill="rgba(95,224,196,0.08)" stroke="#5fe0c4" strokeWidth={1.5} strokeLinejoin="round" />
        {line(ac.mtow / 1000, 'MTOW')}
        {line(ac.mlw / 1000, 'MLW', '4 3')}
        {line(ac.mzfw / 1000, 'MZFW', '2 3', true)}
        <line x1={X(target)} x2={X(target)} y1={mt} y2={H - mb} stroke="#6f8784" strokeDasharray="3 3" />
        <text x={X(target) + 3} y={H - mb - 4} fontSize={9} fill="#6f8784">target</text>
        <line x1={X(wb.zfwMac)} y1={Y(wb.zfw / 1000)} x2={X(wb.towMac)} y2={Y(wb.tow / 1000)} stroke="#e6f1ef" strokeWidth={2} />
        <line x1={X(wb.towMac)} y1={Y(wb.tow / 1000)} x2={X(wb.lwMac)} y2={Y(wb.lw / 1000)} stroke="#a9bdba" strokeWidth={1.5} strokeDasharray="3 3" />
        {pts.map((p) => (
          <g key={p.k}>
            <title>{`${p.k}: ${Math.round(p.t * 1000).toLocaleString('en-US')} kg at ${p.mac.toFixed(1)} %MAC${p.in ? '' : ' — outside envelope'}`}</title>
            {p.k === 'ZFW' ? (
              <rect x={X(p.mac) - 5} y={Y(p.t) - 5} width={10} height={10} transform={`rotate(45 ${X(p.mac)} ${Y(p.t)})`} fill="#fab219" stroke={p.in ? '#0f1c1f' : '#d03b3b'} strokeWidth={2} />
            ) : p.k === 'TOW' ? (
              <circle cx={X(p.mac)} cy={Y(p.t)} r={6} fill="#5fe0c4" stroke={p.in ? '#0f1c1f' : '#d03b3b'} strokeWidth={2} />
            ) : (
              <rect x={X(p.mac) - 4} y={Y(p.t) - 4} width={8} height={8} fill="#a9bdba" stroke={p.in ? '#0f1c1f' : '#d03b3b'} strokeWidth={2} />
            )}
            <text x={p.k === 'ZFW' ? X(p.mac) - 9 : X(p.mac) + 9} y={Y(p.t) + (p.k === 'LW' ? -6 : 4)} fontSize={10} fill="#e6f1ef" fontWeight={600} textAnchor={p.k === 'ZFW' ? 'end' : 'start'}>{p.k} {p.mac.toFixed(1)}%</text>
          </g>
        ))}
        {xticks.map((v) => <text key={v} x={X(v)} y={H - mb + 13} fontSize={9} fill="#6f8784" textAnchor="middle">{v}</text>)}
        {yticks.map((t) => <text key={t} x={ml - 5} y={Y(t) + 3} fontSize={9} fill="#6f8784" textAnchor="end">{t}</text>)}
        <text x={(ml + W - mr) / 2} y={H - 3} fontSize={9.5} fill="#a9bdba" textAnchor="middle">CG (%MAC)</text>
        <text x={10} y={(mt + H - mb) / 2} fontSize={9.5} fill="#a9bdba" textAnchor="middle" transform={`rotate(-90 10 ${(mt + H - mb) / 2})`}>Weight (t)</text>
      </svg>
    </figure>
  );
}

function CompareNotes() {
  return (
    <div className="section" style={{ fontSize: 12.5, color: 'var(--text-2)', lineHeight: 1.55 }}>
      <p style={{ marginTop: 0 }}>Every strategy runs the same multi-ULD pipeline — skids and crates drive pallet builds, loose cartons top up voids, remaining cartons are containerised, then lightly used ULDs are consolidated. They differ in <b>piece order</b> and <b>placement scoring</b>.</p>
      <p><b>Cost</b> (lower is better) = 20 × kg left behind + 600 × deck metres used + 0.5 × tare kg + 500 × (1 − volume utilisation). It rewards fewer positions and less tare while never trading away payload.</p>
      <p>The <b>GA</b> is a biased random-key genetic algorithm over shipment order and placement rule, seeded with the greedy results and time-boxed, so it can only match or beat them.</p>
      <p className="muted" style={{ marginBottom: 0 }}>Apply any row to make it the working build-up.</p>
    </div>
  );
}
