import { useEffect, useRef, useState } from 'react';
import { selectedUld, useStore } from '../app/store';
import { UldScene } from '../three/UldScene';
import { aircraftById } from '../domain/aircraft';
import { Mark, IconSpark } from './icons';
import { kg, pct, tonnes } from './format';

/** Phone fallback: read-only summary + touch-orbit 3D viewer of the built ULDs. */
export function MobileView() {
  const hostRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<UldScene | null>(null);
  const [loading, setLoading] = useState(false);
  const manifest = useStore((s) => s.manifest);
  const build = useStore((s) => s.build);
  const wb = useStore((s) => s.wb);
  const uld = useStore(selectedUld);
  const ships = useStore((s) => s.ships);
  const selectUld = useStore((s) => s.selectUld);
  const ac = aircraftById(useStore((s) => s.aircraftId));

  useEffect(() => {
    const sc = new UldScene(hostRef.current!);
    sceneRef.current = sc;
    return () => sc.dispose();
  }, []);
  useEffect(() => sceneRef.current?.setUld(uld, ships), [uld, ships]);

  const load = async () => {
    setLoading(true);
    const st = useStore.getState();
    st.loadSample('HKG-LAX');
    await st.runBuild();
    await useStore.getState().runPlan(false);
    setLoading(false);
  };

  return (
    <div className="mobile">
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <Mark />
        <div>
          <b>Cathay Cargo Twin</b>
          <div className="muted" style={{ fontSize: 11 }}>Read-only phone view · open on a laptop for the full planner</div>
        </div>
      </div>
      {!build && (
        <button className="btn primary cta" onClick={load} disabled={loading}><IconSpark /> {loading ? 'Building sample flight…' : 'Load sample flight'}</button>
      )}
      <div className="viewport"><div className="gl" ref={hostRef} /></div>
      {build && (
        <>
          <select className="input" value={uld?.id ?? ''} onChange={(e) => selectUld(e.target.value)} aria-label="ULD">
            {build.ulds.map((u) => <option key={u.id} value={u.id}>{u.id} · {kg(u.gross)} · {u.placements.length} pcs</option>)}
          </select>
          <div className="kpis">
            <div className="kpi"><div className="l">Flight</div><div className="v" style={{ fontSize: 15 }}>{manifest?.flight}</div><div className="s">{manifest?.route.from} → {manifest?.route.to} · {ac.short}</div></div>
            <div className="kpi"><div className="l">ULDs</div><div className="v">{build.kpis.ulds}</div><div className="s">{build.kpis.placedPieces}/{build.kpis.pieces} pieces</div></div>
            <div className="kpi"><div className="l">Volume util.</div><div className="v">{pct(build.kpis.volUtil)}</div><div className="s">weight {pct(build.kpis.wtUtil)}</div></div>
            <div className="kpi"><div className="l">Chargeable</div><div className="v">{tonnes(build.kpis.chargeableKg)}</div><div className="s">gross {tonnes(build.kpis.grossKg)}</div></div>
            {wb && <div className="kpi"><div className="l">TOW</div><div className="v">{tonnes(wb.tow)}</div><div className="s">{wb.towMac.toFixed(1)} %MAC · {wb.inEnvelope.tow ? 'in envelope' : 'OUT of envelope'}</div></div>}
            {wb && <div className="kpi"><div className="l">ZFW</div><div className="v">{tonnes(wb.zfw)}</div><div className="s">{wb.zfwMac.toFixed(1)} %MAC</div></div>}
          </div>
        </>
      )}
      <div className="muted" style={{ fontSize: 11, textAlign: 'center' }}>Portfolio prototype · not affiliated with any airline</div>
    </div>
  );
}
