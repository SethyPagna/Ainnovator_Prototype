import { formatAwb, SHC_INFO, type DgClass, type Orientation, type Shc, type Shipment } from './cargo';

export const CSV_COLUMNS = [
  'awb', 'description', 'origin', 'dest', 'pieces', 'length_cm', 'width_cm', 'height_cm', 'weight_kg_per_piece',
  'shc', 'temp_min_c', 'temp_max_c', 'dg_un', 'dg_class', 'dg_psn', 'dg_cao', 'orientation', 'max_top_load_kg', 'priority',
] as const;

const DG_CLASSES: DgClass[] = ['1.4S', '2.1', '2.2', '2.3', '3', '4.1', '4.2', '4.3', '5.1', '5.2', '6.1', '6.2', '7', '8', '9'];

function esc(v: string | number | undefined): string {
  const s = v === undefined ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(ships: Shipment[]): string {
  const rows = [CSV_COLUMNS.join(',')];
  for (const s of ships) {
    rows.push([
      s.awb, s.description, s.origin, s.dest, s.pieces, s.l, s.w, s.h, s.weight,
      s.shc.join(' '), s.temp?.min, s.temp?.max, s.dg?.un, s.dg?.cls, s.dg?.psn, s.dg ? (s.dg.cao ? 'Y' : 'N') : '',
      s.orientation, s.maxTopLoad, s.priority ?? 'normal',
    ].map(esc).join(','));
  }
  return rows.join('\n') + '\n';
}

/** Minimal RFC-4180 style parser (quoted fields, escaped quotes, CRLF). */
export function parseCsvRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let f = '';
  let q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { f += '"'; i++; }
      else if (c === '"') q = false;
      else f += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(f); f = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(f); f = '';
      if (row.some((x) => x.trim() !== '')) rows.push(row);
      row = [];
    } else f += c;
  }
  row.push(f);
  if (row.some((x) => x.trim() !== '')) rows.push(row);
  return rows;
}

export interface CsvImport {
  shipments: Shipment[];
  errors: string[];
}

export function fromCsv(text: string): CsvImport {
  const rows = parseCsvRows(text.replace(/^﻿/, ''));
  const errors: string[] = [];
  if (!rows.length) return { shipments: [], errors: ['The file is empty'] };
  const head = rows[0].map((h) => h.trim().toLowerCase());
  const col = (name: string) => head.indexOf(name);
  for (const req of ['description', 'pieces', 'length_cm', 'width_cm', 'height_cm', 'weight_kg_per_piece']) {
    if (col(req) < 0) errors.push(`Missing required column "${req}"`);
  }
  if (errors.length) return { shipments: [], errors };
  const shipments: Shipment[] = [];
  rows.slice(1).forEach((r, i) => {
    const line = i + 2;
    const get = (name: string) => (col(name) >= 0 ? (r[col(name)] ?? '').trim() : '');
    const num = (name: string) => Number(get(name));
    const pcs = num('pieces'), l = num('length_cm'), w = num('width_cm'), h = num('height_cm'), kg = num('weight_kg_per_piece');
    if (![pcs, l, w, h, kg].every((v) => Number.isFinite(v) && v > 0)) {
      errors.push(`Line ${line}: pieces, dimensions and weight must be positive numbers`);
      return;
    }
    if (pcs > 500) {
      errors.push(`Line ${line}: more than 500 pieces - split the shipment`);
      return;
    }
    const shcRaw = get('shc').toUpperCase().split(/[\s|;/]+/).filter(Boolean);
    const shc = shcRaw.filter((c): c is Shc => c in SHC_INFO);
    const unknown = shcRaw.filter((c) => !(c in SHC_INFO));
    if (unknown.length) errors.push(`Line ${line}: ignored unknown SHC ${unknown.join(', ')}`);
    const tmin = get('temp_min_c'), tmax = get('temp_max_c');
    const dgCls = get('dg_class') as DgClass;
    const orient = (get('orientation') || 'upright') as Orientation;
    const top = get('max_top_load_kg');
    shipments.push({
      id: `C${String(i + 1).padStart(2, '0')}`,
      awb: get('awb') || formatAwb('000', 9000000 + i),
      description: get('description') || 'Unnamed shipment',
      origin: get('origin') || 'HKG',
      dest: get('dest') || '---',
      pieces: Math.round(pcs),
      l, w, h,
      weight: kg,
      shc: shc.length ? shc : ['GEN'],
      temp: tmin !== '' && tmax !== '' ? { min: Number(tmin), max: Number(tmax) } : undefined,
      dg: get('dg_un') ? {
        un: get('dg_un').toUpperCase().startsWith('UN') ? get('dg_un').toUpperCase() : `UN${get('dg_un')}`,
        cls: DG_CLASSES.includes(dgCls) ? dgCls : '9',
        psn: get('dg_psn') || 'Dangerous goods',
        cao: /^(y|yes|true|1)$/i.test(get('dg_cao')),
      } : undefined,
      orientation: ['any', 'upright', 'fixed'].includes(orient) ? orient : 'upright',
      maxTopLoad: top === '' ? Math.round(kg * 2) : Math.max(0, Number(top)),
      priority: get('priority') === 'express' ? 'express' : 'normal',
    });
  });
  return { shipments, errors };
}
