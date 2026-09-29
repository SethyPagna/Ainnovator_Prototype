import { useState } from 'react';
import { useStore } from '../app/store';
import { formatAwb, SHC_INFO, type DgClass, type Orientation, type Shc, type Shipment } from '../domain/cargo';
import { IconX } from './icons';

const SHC_LIST = Object.keys(SHC_INFO).filter((c) => c !== 'GEN') as Shc[];
const DG_CLASSES: DgClass[] = ['1.4S', '2.1', '2.2', '3', '4.1', '4.2', '4.3', '5.1', '5.2', '6.1', '6.2', '8', '9'];

export function ShipmentEditor() {
  const editor = useStore((s) => s.editor);
  const manifest = useStore((s) => s.manifest);
  const upsert = useStore((s) => s.upsertShipment);
  const set = useStore((s) => s.set);
  const toast = useStore((s) => s.toast);
  const init = editor.shipment;
  const nextId = () => {
    const ids = new Set(manifest?.shipments.map((s) => s.id));
    let i = (manifest?.shipments.length ?? 0) + 1;
    while (ids.has(`U${String(i).padStart(2, '0')}`)) i++;
    return `U${String(i).padStart(2, '0')}`;
  };
  const [f, setF] = useState(() => ({
    description: init?.description ?? '',
    pieces: init?.pieces ?? 1,
    l: init?.l ?? 120, w: init?.w ?? 100, h: init?.h ?? 120,
    weight: init?.weight ?? 250,
    shc: (init?.shc ?? []).filter((c) => c !== 'GEN') as Shc[],
    tempOn: !!init?.temp,
    tmin: init?.temp?.min ?? 2, tmax: init?.temp?.max ?? 8,
    dgOn: !!init?.dg,
    un: init?.dg?.un ?? 'UN3480', cls: (init?.dg?.cls ?? '9') as DgClass, psn: init?.dg?.psn ?? 'Lithium ion batteries', cao: init?.dg?.cao ?? false,
    orientation: (init?.orientation ?? 'upright') as Orientation,
    maxTopLoad: init?.maxTopLoad ?? 500,
    dest: init?.dest ?? manifest?.route.to ?? 'LAX',
  }));
  if (!editor.open) return null;
  const close = () => set({ editor: { open: false, shipment: null } });
  const upd = (p: Partial<typeof f>) => setF({ ...f, ...p });
  const toggle = (c: Shc) => upd({ shc: f.shc.includes(c) ? f.shc.filter((x) => x !== c) : [...f.shc, c] });

  const save = () => {
    const errs: string[] = [];
    if (!f.description.trim()) errs.push('description');
    if (![f.pieces, f.l, f.w, f.h, f.weight].every((v) => Number.isFinite(v) && v > 0)) errs.push('positive dimensions, pieces and weight');
    if (f.tempOn && f.tmin > f.tmax) errs.push('a valid temperature range');
    if (errs.length) return toast(`Please provide ${errs.join(', ')}`, 'warn');
    let shc = [...f.shc];
    if (f.dgOn && !shc.includes('DGR')) shc.push('DGR');
    if (!f.dgOn) shc = shc.filter((c) => c !== 'DGR');
    if (f.weight >= 150 && !shc.includes('HEA')) shc.push('HEA');
    const s: Shipment = {
      id: init?.id ?? nextId(),
      awb: init?.awb ?? formatAwb('000', 8000000 + Math.floor(Math.random() * 999999)),
      description: f.description.trim(),
      origin: manifest?.route.from ?? 'HKG',
      dest: f.dest,
      pieces: Math.round(f.pieces),
      l: f.l, w: f.w, h: f.h,
      weight: f.weight,
      shc: shc.length ? shc : ['GEN'],
      temp: f.tempOn ? { min: f.tmin, max: f.tmax } : undefined,
      dg: f.dgOn ? { un: f.un, cls: f.cls, psn: f.psn, cao: f.cao } : undefined,
      orientation: f.orientation,
      maxTopLoad: Math.max(0, f.maxTopLoad),
      priority: init?.priority ?? 'normal',
    };
    upsert(s);
    toast(`${init ? 'Updated' : 'Added'} ${s.description} — rebuild to apply`, 'good');
    close();
  };

  const n = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => upd({ [k]: Number(e.target.value) } as Partial<typeof f>);

  return (
    <div className="modal-back" onMouseDown={(e) => e.target === e.currentTarget && close()}>
      <div className="modal" role="dialog" aria-modal="true" aria-label="Shipment editor">
        <div className="modal-head">
          <h3>{init ? `Edit ${init.awb}` : 'Add shipment'}</h3>
          <button className="btn icon ghost" aria-label="Close" onClick={close}><IconX /></button>
        </div>
        <div className="modal-body">
          <div className="form-grid">
            <label className="field span4">Description<input className="input" value={f.description} onChange={(e) => upd({ description: e.target.value })} placeholder="e.g. Machine parts on skids" autoFocus /></label>
            <label className="field">Pieces<input className="input" type="number" min={1} value={f.pieces} onChange={n('pieces')} /></label>
            <label className="field">Weight / pc (kg)<input className="input" type="number" min={1} value={f.weight} onChange={n('weight')} /></label>
            <label className="field">Max load on top (kg)<input className="input" type="number" min={0} value={f.maxTopLoad} onChange={n('maxTopLoad')} /></label>
            <label className="field">Destination<input className="input" value={f.dest} onChange={(e) => upd({ dest: e.target.value.toUpperCase().slice(0, 3) })} /></label>
            <label className="field">Length (cm)<input className="input" type="number" min={1} value={f.l} onChange={n('l')} /></label>
            <label className="field">Width (cm)<input className="input" type="number" min={1} value={f.w} onChange={n('w')} /></label>
            <label className="field">Height (cm)<input className="input" type="number" min={1} value={f.h} onChange={n('h')} /></label>
            <label className="field">Orientation
              <select className="input" value={f.orientation} onChange={(e) => upd({ orientation: e.target.value as Orientation })}>
                <option value="upright">This way up (rotate on floor only)</option>
                <option value="any">Any orientation</option>
                <option value="fixed">Fixed (no rotation)</option>
              </select>
            </label>
            <div className="field span4">Special handling codes
              <div className="shc-picker">
                {SHC_LIST.filter((c) => c !== 'DGR').map((c) => (
                  <button key={c} type="button" className={f.shc.includes(c) ? 'on' : ''} title={SHC_INFO[c].label} onClick={() => toggle(c)}>{c}</button>
                ))}
              </div>
            </div>
            <label className="field span2" style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <input type="checkbox" checked={f.tempOn} onChange={(e) => upd({ tempOn: e.target.checked })} /> Temperature-controlled
            </label>
            <label className="field">Min °C<input className="input" type="number" disabled={!f.tempOn} value={f.tmin} onChange={n('tmin')} /></label>
            <label className="field">Max °C<input className="input" type="number" disabled={!f.tempOn} value={f.tmax} onChange={n('tmax')} /></label>
            <label className="field span4" style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <input type="checkbox" checked={f.dgOn} onChange={(e) => upd({ dgOn: e.target.checked })} /> Dangerous goods (DGR)
            </label>
            {f.dgOn && (
              <>
                <label className="field">UN number<input className="input" value={f.un} onChange={(e) => upd({ un: e.target.value.toUpperCase() })} /></label>
                <label className="field">Class / division
                  <select className="input" value={f.cls} onChange={(e) => upd({ cls: e.target.value as DgClass })}>
                    {DG_CLASSES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </label>
                <label className="field span2">Proper shipping name<input className="input" value={f.psn} onChange={(e) => upd({ psn: e.target.value })} /></label>
                <label className="field span4" style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <input type="checkbox" checked={f.cao} onChange={(e) => upd({ cao: e.target.checked })} /> Cargo aircraft only (CAO) — must be loaded on the main deck
                </label>
              </>
            )}
          </div>
        </div>
        <div className="modal-foot">
          <button className="btn ghost" onClick={close}>Cancel</button>
          <button className="btn primary" onClick={save}>{init ? 'Save changes' : 'Add shipment'}</button>
        </div>
      </div>
    </div>
  );
}
