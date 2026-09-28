import { useStore } from '../app/store';
import { AIRCRAFT, typeLoadableOn } from '../domain/aircraft';
import { ULD_TYPES, usableVolumeM3, type UldType } from '../domain/uld';
import { IconX } from './icons';
import { num } from './format';

function Contour({ t }: { t: UldType }) {
  const W = 330, H = 310; // common scale for every type (cm)
  const s = 0.36;
  const ox = (W - t.external.width) / 2;
  const pts = (poly: readonly (readonly [number, number])[]) => poly.map(([x, y]) => `${(ox + x) * s},${(H - y) * s}`).join(' ');
  return (
    <svg viewBox={`0 0 ${W * s} ${H * s + 4}`} style={{ width: '100%', height: 104, marginTop: 4 }} role="img" aria-label={`${t.id} cross-section`}>
      <line x1={0} x2={W * s} y1={H * s} y2={H * s} stroke="#2a4146" />
      <polygon points={pts(t.outline)} fill="rgba(95,224,196,0.06)" stroke="#5fe0c4" strokeWidth={1.4} strokeLinejoin="round" />
      <polygon points={pts(t.profile)} fill="rgba(57,135,229,0.22)" stroke="#3987e5" strokeWidth={1} strokeDasharray="3 2" />
    </svg>
  );
}

export function Library() {
  const open = useStore((s) => s.library);
  const aircraftId = useStore((s) => s.aircraftId);
  const set = useStore((s) => s.set);
  if (!open) return null;
  const close = () => set({ library: false });
  const cur = AIRCRAFT.find((a) => a.id === aircraftId)!;
  return (
    <div className="modal-back" onMouseDown={(e) => e.target === e.currentTarget && close()}>
      <div className="modal" role="dialog" aria-modal="true" aria-label="Equipment library" style={{ width: 'min(1120px, 100%)' }}>
        <div className="modal-head">
          <h3>Equipment library <span className="muted" style={{ fontSize: 12, fontWeight: 500 }}>· representative, simplified data</span></h3>
          <button className="btn icon ghost" aria-label="Close" onClick={close}><IconX /></button>
        </div>
        <div className="modal-body">
          <div className="lib-legend muted">Cross-sections to a common scale: <span style={{ color: '#5fe0c4' }}>external contour</span> and <span style={{ color: '#3987e5' }}>usable build envelope</span> (walls, insulation, net margin and pallet plate removed). Depth runs into the page.</div>
          <div className="lib-grid">
            {ULD_TYPES.map((t) => {
              const ok = typeLoadableOn(cur, t.id);
              return (
                <div className="card" key={t.id}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 6 }}>
                    <b className="mono">{t.iata}</b>
                    <span className={`badge ${ok ? 'good' : 'neutral'}`} style={{ fontSize: 10 }}>{ok ? `loads on ${cur.short}` : `not on ${cur.short}`}</span>
                  </div>
                  <div className="dim" style={{ fontSize: 11.5 }}>{t.alias}{t.contour !== t.alias ? ` · ${t.contour}` : ''}</div>
                  <Contour t={t} />
                  <div className="wb-grid" style={{ gridTemplateColumns: '1fr auto', fontSize: 11.5 }}>
                    <span className="muted">W × D × H</span><span className="r">{t.external.width} × {t.external.depth} × {t.external.height}</span>
                    <span className="muted">Base width</span><span className="r">{t.baseWidth} cm</span>
                    <span className="muted">Usable volume</span><span className="r">{num(usableVolumeM3(t), 2)} m³</span>
                    <span className="muted">MGW · tare</span><span className="r">{num(t.maxGross)} · {t.tare} kg</span>
                    {t.active && <><span className="muted">Setpoint range</span><span className="r">{t.active.min}..+{t.active.max} °C</span></>}
                  </div>
                  <div className="muted" style={{ fontSize: 10.5, marginTop: 6 }}>{t.compat}</div>
                </div>
              );
            })}
          </div>
          <h4 style={{ margin: '18px 0 8px', fontSize: 12, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--text-2)' }}>Aircraft</h4>
          <div className="lib-grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
            {AIRCRAFT.map((a) => {
              const count = (k: string) => a.positions.filter((p) => p.kind === k && !p.alt).length;
              return (
                <div className="card" key={a.id}>
                  <b>{a.name}</b>
                  <div className="wb-grid" style={{ gridTemplateColumns: '1fr auto 1fr auto', fontSize: 11.5, marginTop: 6 }}>
                    <span className="muted">MTOW</span><span className="r">{num(a.mtow)} kg</span>
                    <span className="muted">MZFW</span><span className="r">{num(a.mzfw)} kg</span>
                    <span className="muted">MLW</span><span className="r">{num(a.mlw)} kg</span>
                    <span className="muted">DOW (repr.)</span><span className="r">{num(a.dow)} kg</span>
                    <span className="muted">LEMAC · MAC</span><span className="r">{a.lemac} · {a.mac} m</span>
                    <span className="muted">Max fuel</span><span className="r">{num(a.maxFuel)} kg</span>
                    <span className="muted">MD positions</span><span className="r">{count('MDS') + count('MDC')} (+{a.positions.filter((p) => p.alt).length} alt.)</span>
                    <span className="muted">Lower deck</span><span className="r">{count('LD3')} LD3 / {count('LDP')} pallets</span>
                  </div>
                  <div className="muted" style={{ fontSize: 10.5, marginTop: 6 }}>{a.notes} Stations, limits and envelope are illustrative.</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
