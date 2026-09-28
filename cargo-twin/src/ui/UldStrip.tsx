import { useEffect, useMemo, useRef } from 'react';
import { useStore } from '../app/store';
import { uldType } from '../domain/uld';
import { REGIME_LABEL } from '../domain/rules';
import { Meter } from './bits';
import { kg, pct, shortUld } from './format';

export function UldSilhouette({ typeId, fill, height = 26 }: { typeId: string; fill: number; height?: number }) {
  const t = uldType(typeId);
  const W = t.external.width, H = t.external.height;
  const pts = t.outline.map(([x, y]) => `${x},${H - y}`).join(' ');
  const id = `clip-${typeId}`;
  const f = Math.max(0, Math.min(1, fill));
  return (
    <svg className="uld-sil" viewBox={`-4 -4 ${W + 8} ${H + 8}`} style={{ height, width: (height * (W + 8)) / (H + 8) }} aria-hidden>
      <defs><clipPath id={id}><polygon points={pts} /></clipPath></defs>
      <rect x={0} y={H - f * H} width={W} height={f * H} fill="rgba(57,135,229,0.55)" clipPath={`url(#${id})`} />
      <polygon points={pts} fill="none" stroke="#5fe0c4" strokeWidth={Math.max(3, W / 60)} strokeLinejoin="round" />
    </svg>
  );
}

export function UldStrip() {
  const build = useStore((s) => s.build);
  const selected = useStore((s) => s.selectedUldId);
  const selectUld = useStore((s) => s.selectUld);
  const physics = useStore((s) => s.physics);
  const assignments = useStore((s) => s.plan.assignments);
  const ref = useRef<HTMLDivElement>(null);
  const posOf = useMemo(() => new Map(Object.entries(assignments).map(([p, u]) => [u, p])), [assignments]);

  useEffect(() => {
    const el = ref.current?.querySelector('.uld-card.sel') as HTMLElement | null;
    el?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
  }, [selected]);

  if (!build) return <div className="uld-strip" />;
  const unplacedKg = build.kpis.unplacedKg;
  return (
    <div className="uld-strip" ref={ref} role="listbox" aria-label="Built ULDs">
      {build.ulds.map((u) => {
        const t = uldType(u.typeId);
        const res = physics.results[u.id];
        return (
          <button key={u.id} role="option" aria-selected={selected === u.id} className={`uld-card ${selected === u.id ? 'sel' : ''}`} onClick={() => selectUld(u.id)}>
            <div className="id">
              <span>{shortUld(u.id)}</span>
              {res ? (
                <span className={`badge ${res.verdict === 'stable' ? 'good' : res.verdict === 'restrain' ? 'warn' : 'bad'}`} style={{ padding: '0 6px', fontSize: 10 }}>
                  {res.verdict === 'stable' ? 'stable' : res.verdict === 'restrain' ? 'secure' : 'restack'}
                </span>
              ) : posOf.get(u.id) ? <span className="chip">{posOf.get(u.id)}</span> : null}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <UldSilhouette typeId={u.typeId} fill={u.volUtil} />
              <div style={{ minWidth: 0 }}>
                <div className="ty">{t.alias} · {t.contour}</div>
                <div className="ty">{u.placements.length} pcs · {u.shipmentIds.length} AWB{u.shipmentIds.length > 1 ? 's' : ''}</div>
              </div>
            </div>
            <div className="nums"><span>{kg(u.gross)}</span><span>vol {pct(u.volUtil)}</span></div>
            <Meter value={u.gross} max={u.cap} color={u.gross / u.cap > 0.95 ? 'var(--warning)' : undefined} />
            <div className="chips">
              {u.active && <span className="chip cold">RKN {u.setpoint}°C</span>}
              {!u.active && u.regime !== 'AMB' && <span className="chip cold" title={REGIME_LABEL[u.regime]}>{u.regime} cover</span>}
              {u.dgClasses.length > 0 && <span className="chip dg" title="Dangerous goods classes">DG {u.dgClasses.join('·')}</span>}
              {u.cao && <span className="chip dg">CAO</span>}
              {u.shc.includes('VAL') && <span className="chip special">VAL</span>}
              {u.shc.includes('AVI') && <span className="chip special">AVI</span>}
              <span className="chip">{u.deckHint === 'main' ? 'MD' : 'LD'}</span>
            </div>
          </button>
        );
      })}
      {build.unplaced.length > 0 && (
        <div className="uld-card" style={{ borderColor: 'rgba(208,59,59,.45)', cursor: 'default' }}>
          <div className="id"><span style={{ color: '#ff9b9b' }}>Not loaded</span></div>
          <div className="ty">{build.unplaced.length} piece{build.unplaced.length > 1 ? 's' : ''} · {kg(unplacedKg)}</div>
          <div className="ty" style={{ whiteSpace: 'normal', fontSize: 10.5 }} title={build.unplaced[0].reason}>{build.unplaced[0].reason}</div>
        </div>
      )}
    </div>
  );
}
