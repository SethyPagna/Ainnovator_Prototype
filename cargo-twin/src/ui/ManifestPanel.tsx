import { useMemo, useRef, useState } from 'react';
import { useStore } from '../app/store';
import { chargeableWeight, shipmentGross, shipmentVolumeM3, type Shipment } from '../domain/cargo';
import { fromCsv, toCsv } from '../domain/csv';
import { sampleList } from '../domain/manifests';
import { handlingOf, HANDLING } from './colors';
import { DgChip, ShcChips } from './bits';
import { IconDice, IconDownload, IconEdit, IconPlus, IconTrash, IconUpload } from './icons';
import { num, tonnes } from './format';

export function download(name: string, text: string, type = 'text/plain') {
  const blob = new Blob([text], { type });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

export function ManifestPanel() {
  const manifest = useStore((s) => s.manifest);
  const build = useStore((s) => s.build);
  const selectedPieceId = useStore((s) => s.selectedPieceId);
  const loadSample = useStore((s) => s.loadSample);
  const loadRandom = useStore((s) => s.loadRandom);
  const setShipments = useStore((s) => s.setShipments);
  const deleteShipment = useStore((s) => s.deleteShipment);
  const toast = useStore((s) => s.toast);
  const set = useStore((s) => s.set);
  const selectUld = useStore((s) => s.selectUld);
  const selectPiece = useStore((s) => s.selectPiece);
  const [filter, setFilter] = useState<string>('all');
  const fileRef = useRef<HTMLInputElement>(null);
  const samples = useMemo(() => sampleList(), []);

  const ships = manifest?.shipments ?? [];
  const totals = useMemo(() => {
    let kg = 0, vol = 0, ch = 0, pcs = 0;
    for (const s of ships) {
      kg += shipmentGross(s);
      vol += shipmentVolumeM3(s);
      ch += chargeableWeight(s);
      pcs += s.pieces;
    }
    return { kg, vol, ch, pcs };
  }, [ships]);

  const unplacedBy = useMemo(() => {
    const m = new Map<string, number>();
    for (const u of build?.unplaced ?? []) m.set(u.shipmentId, (m.get(u.shipmentId) ?? 0) + 1);
    return m;
  }, [build]);

  const selectedShip = selectedPieceId?.split('#')[0] ?? null;
  const list = ships.filter((s) => filter === 'all' || handlingOf(s).key === filter);

  const onFile = async (f: File) => {
    const text = await f.text();
    const res = fromCsv(text);
    if (!res.shipments.length) {
      toast(res.errors[0] ?? 'No shipments found in the file', 'error');
      return;
    }
    setShipments(res.shipments);
    toast(`Imported ${res.shipments.length} shipments${res.errors.length ? ` (${res.errors.length} warnings: ${res.errors[0]})` : ''}`, res.errors.length ? 'warn' : 'good');
  };

  const locate = (s: Shipment) => {
    if (!build) return;
    const u = build.ulds.find((x) => x.shipmentIds.includes(s.id));
    if (u) {
      selectUld(u.id);
      const p = u.placements.find((x) => x.shipmentId === s.id);
      if (p) selectPiece(p.pieceId);
      set({ tab: 'build' });
    }
  };

  return (
    <aside className="panel" aria-label="Manifest">
      <div className="panel-head">
        <span className="panel-title">Manifest</span>
        <select className="input" style={{ height: 26, maxWidth: 190 }} aria-label="Load sample manifest" value="" onChange={(e) => e.target.value && loadSample(e.target.value)}>
          <option value="">Load sample flight…</option>
          {samples.map((s) => <option key={s.id} value={s.id}>{s.flight} · {s.route} · {s.name}</option>)}
        </select>
      </div>
      <div className="manifest-summary">
        <div className="mini-stat"><div className="v">{ships.length}</div><div className="l">AWBs · {num(totals.pcs)} pcs</div></div>
        <div className="mini-stat"><div className="v">{tonnes(totals.kg)}</div><div className="l">Gross</div></div>
        <div className="mini-stat"><div className="v">{num(totals.vol, 0)} m³</div><div className="l">Volume</div></div>
      </div>
      <div className="toolbar-row">
        <button className="btn sm" onClick={() => fileRef.current?.click()} title="Import shipments from CSV"><IconUpload size={14} /> CSV</button>
        <button className="btn sm" disabled={!ships.length} onClick={() => download(`${manifest?.flight.replace(/\s/g, '') ?? 'manifest'}-manifest.csv`, toCsv(ships), 'text/csv')} title="Export shipments as CSV"><IconDownload size={14} /> CSV</button>
        <button className="btn sm" onClick={() => loadRandom()} title="Generate a random manifest (R)"><IconDice size={14} /> Random</button>
        <button className="btn sm" onClick={() => set({ editor: { open: true, shipment: null } })} title="Add a shipment"><IconPlus size={14} /> Add</button>
        <input ref={fileRef} type="file" accept=".csv,text/csv" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ''; }} />
      </div>
      {ships.length > 0 && (
        <div className="toolbar-row" style={{ gap: 4 }}>
          <button className={`chip ${filter === 'all' ? 'dim' : ''}`} style={{ cursor: 'pointer', borderColor: filter === 'all' ? 'var(--accent)' : undefined }} onClick={() => setFilter('all')}>ALL</button>
          {HANDLING.map((h) => {
            const n = ships.filter((s) => handlingOf(s).key === h.key).length;
            if (!n) return null;
            return (
              <button key={h.key} className="chip" style={{ cursor: 'pointer', borderColor: filter === h.key ? h.color : undefined }} onClick={() => setFilter(filter === h.key ? 'all' : h.key)} title={h.label}>
                <i className="sw" style={{ background: h.color }} /> {n}
              </button>
            );
          })}
        </div>
      )}
      <div className="ship-list" role="list">
        {!ships.length && (
          <div className="empty">
            <div>No shipments yet.</div>
            <div>Load a sample flight, import a CSV or generate a random manifest.</div>
          </div>
        )}
        {list.map((s) => {
          const h = handlingOf(s);
          const missing = unplacedBy.get(s.id) ?? 0;
          return (
            <div key={s.id} role="listitem" className={`ship ${selectedShip === s.id ? 'sel' : ''}`} onClick={() => locate(s)} title={build ? 'Show in the 3D build-up' : undefined}>
              <div className="bar" style={{ background: h.color }} />
              <div style={{ minWidth: 0 }}>
                <div className="t">{s.description}</div>
                <div className="s">{s.awb} · {s.pieces} × {s.l}×{s.w}×{s.h}</div>
                <div className="chips">
                  <ShcChips codes={s.shc} max={4} />
                  <DgChip s={s} />
                  {s.temp && <span className="chip cold">{s.temp.min}..{s.temp.max}°C</span>}
                  {missing > 0 && <span className="chip" style={{ color: '#ffb3b3', borderColor: 'rgba(208,59,59,.5)' }}>{missing} not loaded</span>}
                </div>
              </div>
              <div className="r">
                <b>{num(shipmentGross(s))} kg</b>
                <span className="muted">{s.orientation === 'upright' ? '↑ up' : s.orientation === 'fixed' ? 'fixed' : 'any'}{s.maxTopLoad <= 0 ? ' · no stack' : ''}</span>
              </div>
              <div className="acts">
                <button className="btn sm icon ghost" aria-label="Edit shipment" onClick={(e) => { e.stopPropagation(); set({ editor: { open: true, shipment: s } }); }}><IconEdit size={14} /></button>
                <button className="btn sm icon ghost" aria-label="Delete shipment" onClick={(e) => { e.stopPropagation(); deleteShipment(s.id); }}><IconTrash size={14} /></button>
              </div>
            </div>
          );
        })}
      </div>
    </aside>
  );
}
