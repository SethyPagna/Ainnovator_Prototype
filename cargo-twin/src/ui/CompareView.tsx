import { useStore } from '../app/store';
import type { BuildResult } from '../domain/packing/buildup';
import { STRATEGY_BY_ID } from '../domain/packing/strategies';
import { IconBars } from './icons';
import { kg, num, pct } from './format';

type Col = { key: string; label: string; get: (r: BuildResult) => number; fmt: (v: number) => string; better: 'low' | 'high'; bar?: boolean };

const COLS: Col[] = [
  { key: 'ulds', label: 'ULDs', get: (r) => r.kpis.ulds, fmt: (v) => String(v), better: 'low' },
  { key: 'deck', label: 'Deck m', get: (r) => r.kpis.deckMetres, fmt: (v) => num(v, 1), better: 'low' },
  { key: 'vol', label: 'Vol util', get: (r) => r.kpis.volUtil, fmt: (v) => pct(v, 1), better: 'high', bar: true },
  { key: 'wt', label: 'Wt util', get: (r) => r.kpis.wtUtil, fmt: (v) => pct(v, 1), better: 'high', bar: true },
  { key: 'un', label: 'Left behind', get: (r) => r.kpis.unplacedKg, fmt: (v) => kg(v), better: 'low' },
  { key: 'tare', label: 'Tare', get: (r) => r.kpis.tareKg, fmt: (v) => kg(v), better: 'low' },
  { key: 'cg', label: 'ULD CG off.', get: (r) => r.kpis.cgOffsetAvg, fmt: (v) => `${num(v, 1)}%`, better: 'low' },
  { key: 'cost', label: 'Cost', get: (r) => r.kpis.cost, fmt: (v) => num(v), better: 'low' },
  { key: 'ms', label: 'Time', get: (r) => r.ms, fmt: (v) => `${num(v)} ms`, better: 'low' },
];

export function CompareView() {
  const results = useStore((s) => s.compare);
  const busy = useStore((s) => s.busy.compare);
  const progress = useStore((s) => s.progress);
  const build = useStore((s) => s.build);
  const manifest = useStore((s) => s.manifest);
  const runCompare = useStore((s) => s.runCompare);
  const applyResult = useStore((s) => s.applyResult);
  const set = useStore((s) => s.set);

  if (!results) {
    return (
      <div className="viewport" style={{ display: 'grid', placeItems: 'center' }}>
        {busy && <div className="progress"><i /></div>}
        <div className="glass welcome-card" style={{ maxWidth: 520 }}>
          <h2>Compare packing strategies</h2>
          <p>Runs four greedy extreme-point variants and a time-boxed genetic refinement on the same manifest, then ranks them on ULD count, deck length, utilisation, tare, ULD CG and cargo left behind.</p>
          <div className="row">
            <button className="btn primary" disabled={!manifest?.shipments.length || busy} onClick={runCompare}><IconBars size={15} /> {busy ? progress?.label ?? 'Running…' : 'Run comparison'}</button>
            {!manifest?.shipments.length && <span className="muted">Load a manifest first.</span>}
          </div>
        </div>
      </div>
    );
  }
  const best = new Map<string, number>();
  for (const c of COLS) {
    const vals = results.map(c.get);
    best.set(c.key, c.better === 'low' ? Math.min(...vals) : Math.max(...vals));
  }
  const winner = [...results].sort((a, b) => a.kpis.cost - b.kpis.cost)[0];
  const ga = results.find((r) => r.strategy === 'ga');
  const greedyBest = [...results].filter((r) => r.strategy !== 'ga').sort((a, b) => a.kpis.cost - b.kpis.cost)[0];
  const trace = ga?.gaTrace ?? [];
  const tmin = Math.min(...trace), tmax = Math.max(...trace);
  const ty = (v: number) => (tmax === tmin ? 32 : 6 + (1 - (v - tmin) / (tmax - tmin)) * 54); // high cost at the top
  return (
    <div className="viewport compare" style={{ overflow: 'auto' }}>
      {busy && <div className="progress"><i /></div>}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <h2 style={{ margin: 0, fontSize: 16 }}>Strategy comparison</h2>
        <span className="muted">{manifest?.flight} · {results[0]?.kpis.pieces} pieces · lower cost is better</span>
        <span style={{ flex: 1 }} />
        <button className="btn sm" onClick={runCompare} disabled={busy}>{busy ? progress?.label ?? 'Running…' : 'Re-run'}</button>
      </div>
      <table>
        <thead>
          <tr>
            <th>Strategy</th>
            {COLS.map((c) => <th key={c.key}>{c.label}</th>)}
            <th />
          </tr>
        </thead>
        <tbody>
          {results.map((r) => {
            const def = STRATEGY_BY_ID[r.strategy];
            const cur = build?.strategy === r.strategy && build.kpis.cost === r.kpis.cost;
            return (
              <tr key={r.strategy} className={cur ? 'cur' : ''}>
                <td>
                  <b>{def.name}</b> {r === winner && <span className="badge good" style={{ marginLeft: 6 }}>best</span>}
                  <div className="desc">{def.description}</div>
                </td>
                {COLS.map((c) => {
                  const v = c.get(r);
                  const isBest = Math.abs(v - best.get(c.key)!) < 1e-9 && results.length > 1;
                  return (
                    <td key={c.key} className={isBest && c.key !== 'ms' ? 'best' : ''}>
                      {c.bar ? (
                        <span className="cell-bar"><i style={{ width: `${Math.round(v * 60)}px` }} />{c.fmt(v)}</span>
                      ) : c.fmt(v)}
                    </td>
                  );
                })}
                <td>
                  <button className="btn sm" disabled={cur} onClick={() => { applyResult(r); set({ tab: 'build' }); }}>{cur ? 'In use' : 'Apply'}</button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="compare-cards">
        <div className="card">
          <h4>ULD mix</h4>
          {results.map((r) => (
            <div key={r.strategy} style={{ display: 'grid', gridTemplateColumns: '64px 1fr', gap: 8, fontSize: 12, padding: '2px 0' }}>
              <span className="dim">{STRATEGY_BY_ID[r.strategy].short}</span>
              <span className="mono" style={{ fontSize: 11 }}>{Object.entries(r.kpis.byType).map(([t, n]) => `${n} ${t}`).join(' · ')}</span>
            </div>
          ))}
        </div>
        <div className="card">
          <h4>GA convergence (best cost per generation)</h4>
          {trace.length > 1 ? (
            <svg viewBox="0 0 240 70" style={{ width: '100%', height: 80 }} role="img" aria-label="GA best cost per generation">
              <line x1={0} x2={240} y1={64} y2={64} stroke="#1c2f33" />
              <polyline fill="none" stroke="#3987e5" strokeWidth={2} strokeLinejoin="round"
                points={trace.map((v, i) => `${(i / (trace.length - 1)) * 236 + 2},${ty(v)}`).join(' ')} />
              {trace.map((v, i) => <circle key={i} cx={(i / (trace.length - 1)) * 236 + 2} cy={ty(v)} r={2.5} fill="#3987e5"><title>{`Gen ${i}: ${num(v)}`}</title></circle>)}
            </svg>
          ) : <div className="muted">Not enough generations recorded.</div>}
          <div className="muted" style={{ fontSize: 11 }}>{trace.length - 1} generations in {num(ga?.ms ?? 0)} ms · lower is better</div>
        </div>
        <div className="card">
          <h4>Verdict</h4>
          <div style={{ fontSize: 12.5, lineHeight: 1.5 }}>
            <b>{STRATEGY_BY_ID[winner.strategy].name}</b> wins with cost {num(winner.kpis.cost)}: {winner.kpis.ulds} ULDs, {pct(winner.kpis.volUtil)} volume utilisation{winner.kpis.unplacedKg ? `, ${kg(winner.kpis.unplacedKg)} left behind` : ', nothing left behind'}.
            {ga && greedyBest && (
              <div className="muted" style={{ marginTop: 6 }}>
                GA vs best greedy ({STRATEGY_BY_ID[greedyBest.strategy].short}): {ga.kpis.cost < greedyBest.kpis.cost ? `${num(greedyBest.kpis.cost - ga.kpis.cost)} lower cost (${num(((greedyBest.kpis.cost - ga.kpis.cost) / greedyBest.kpis.cost) * 100, 1)}%)` : 'no improvement found within the time box'}.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
