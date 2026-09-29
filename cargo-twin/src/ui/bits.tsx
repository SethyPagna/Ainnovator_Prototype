import type { Shc, Shipment } from '../domain/cargo';
import { SHC_INFO } from '../domain/cargo';

const CLS: Partial<Record<Shc, string>> = {
  DGR: 'dg', RLI: 'dg', ICE: 'dg', CAO: 'dg',
  COL: 'cold', FRO: 'cold', CRT: 'cold', ERT: 'cold', PIL: 'cold',
  PER: 'per', PES: 'per', PEF: 'per', EAT: 'per',
  VAL: 'special', AVI: 'special',
  FRG: 'frg',
  HEA: 'hea', BIG: 'hea',
};

export function ShcChip({ code }: { code: Shc }) {
  return (
    <span className={`chip ${CLS[code] ?? ''}`} title={SHC_INFO[code].label}>
      {code}
    </span>
  );
}

export function ShcChips({ codes, max = 6 }: { codes: Shc[]; max?: number }) {
  const list = codes.filter((c) => c !== 'GEN');
  if (!list.length) return <span className="chip" title="General cargo">GEN</span>;
  return (
    <>
      {list.slice(0, max).map((c) => <ShcChip key={c} code={c} />)}
      {list.length > max && <span className="chip">+{list.length - max}</span>}
    </>
  );
}

export function DgChip({ s }: { s: Shipment }) {
  if (!s.dg) return null;
  return <span className="chip dg" title={`${s.dg.psn}${s.dg.cao ? ' · cargo aircraft only' : ''}`}>{s.dg.un} · {s.dg.cls}</span>;
}

export function Meter({ value, color, max = 1 }: { value: number; color?: string; max?: number }) {
  const v = Math.max(0, Math.min(1, value / max));
  return <div className="meter"><i style={{ width: `${v * 100}%`, background: color }} /></div>;
}
