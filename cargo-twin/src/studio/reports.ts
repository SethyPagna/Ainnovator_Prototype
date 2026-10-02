import { MAX_CARGO_PIECES, type CargoItem, type PackingPlan, type PackingStats, type Placement } from './model';
import { usableDimensions } from './packing';
import { MAX_DOCUMENT_CHARACTERS, parseCargoItems, parseDocument, type StudioDocument } from './projects';

const CARGO_COLUMNS = ['id', 'name', 'lengthCm', 'widthCm', 'heightCm', 'weightKg', 'quantity', 'fragile', 'keepUpright', 'stackable', 'maxTopLoadKg', 'priority', 'color'] as const;
const REQUIRED_COLUMNS = ['name', 'lengthCm', 'widthCm', 'heightCm', 'weightKg', 'quantity'];
const DEFAULT_COLORS = ['#78d9c4', '#5ea8ff', '#f4b36b', '#b9a0f6', '#e6cd72'];
const PLAN_COLUMNS = ['status', 'sequence', 'placementId', 'itemId', 'name', 'unitIndex', 'xCm', 'yCm', 'zCm', 'lengthCm', 'widthCm', 'heightCm', 'weightKg', 'rotated', 'fragile', 'keepUpright', 'stackable', 'maxTopLoadKg', 'loadOnTopKg', 'supportRatio', 'supportIds', 'count', 'reasonCode', 'reason'];
type CsvRow = { cells: string[]; line: number };
type CsvValue = string | number | boolean;

function parseCsvRows(csv: string): CsvRow[] {
  if (csv.length > MAX_DOCUMENT_CHARACTERS) throw new Error('Cargo CSV is too large. Use at most 2,000,000 characters.');
  const source = csv.replace(/^\uFEFF/, '');
  const rows: CsvRow[] = [];
  let cells: string[] = [];
  let cell = '';
  let quoted = false;
  let closedQuote = false;
  let line = 1;
  let rowLine = 1;
  function finishCell() { cells.push(cell); cell = ''; closedQuote = false; }
  function finishRow() {
    finishCell();
    if (cells.some(value => value.trim())) rows.push({ cells, line: rowLine });
    if (rows.length > MAX_CARGO_PIECES + 1) throw new Error(`Cargo CSV has more than ${MAX_CARGO_PIECES} cargo rows.`);
    cells = [];
  }
  for (let index = 0; index < source.length; index++) {
    const character = source[index];
    if (quoted) {
      if (character === '"') {
        if (source[index + 1] === '"') { cell += '"'; index++; }
        else { quoted = false; closedQuote = true; }
      } else {
        cell += character;
        if (character === '\n' || (character === '\r' && source[index + 1] !== '\n')) line++;
      }
      continue;
    }
    if (character === ',') { finishCell(); continue; }
    if (character === '\r' || character === '\n') {
      finishRow();
      if (character === '\r' && source[index + 1] === '\n') index++;
      line++;
      rowLine = line;
      continue;
    }
    if (closedQuote) {
      if (character === ' ' || character === '\t') continue;
      throw new Error(`CSV row ${line}: unexpected text after a closing quote.`);
    }
    if (character === '"') {
      if (cell.trim()) throw new Error(`CSV row ${line}: quotes must enclose an entire field; use two quotes for a literal quote.`);
      cell = '';
      quoted = true;
    } else cell += character;
  }
  if (quoted) throw new Error(`CSV row ${rowLine}: a quoted field was not closed.`);
  if (cell.length || cells.length || closedQuote) finishRow();
  return rows;
}

function csvNumber(value: string, label: string): number {
  const trimmed = value.trim();
  if (!trimmed || !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(trimmed) || !Number.isFinite(Number(trimmed))) throw new Error(`${label} needs a finite number without units.`);
  return Number(trimmed);
}

function csvFlag(value: string | undefined, label: string, defaultValue: boolean): boolean {
  if (value === undefined || !value.trim()) return defaultValue;
  const normalized = value.trim().toLowerCase();
  if (['true', 'yes', '1'].includes(normalized)) return true;
  if (['false', 'no', '0'].includes(normalized)) return false;
  throw new Error(`${label} must be true/false, yes/no or 1/0.`);
}

export function parseCargoCsv(csv: string): CargoItem[] {
  const rows = parseCsvRows(csv);
  if (!rows.length) throw new Error('Cargo CSV is empty. Include a header and cargo rows.');
  const headers = rows[0].cells.map(header => header.trim());
  if (new Set(headers).size !== headers.length) throw new Error('Cargo CSV has duplicate column names.');
  const unknown = headers.find(header => !CARGO_COLUMNS.includes(header as typeof CARGO_COLUMNS[number]));
  if (unknown !== undefined) throw new Error(`Cargo CSV has an unknown column “${unknown}”. Use name,lengthCm,widthCm,heightCm,weightKg,quantity and optional handling columns.`);
  const missing = REQUIRED_COLUMNS.filter(header => !headers.includes(header));
  if (missing.length) throw new Error(`Cargo CSV is missing required columns: ${missing.join(', ')}.`);
  const ids = new Set<string>();
  const items = rows.slice(1).map((row, index) => {
    if (row.cells.length !== headers.length) throw new Error(`CSV row ${row.line}: expected ${headers.length} fields, received ${row.cells.length}. Quote names containing commas.`);
    const values = Object.fromEntries(headers.map((header, column) => [header, row.cells[column]]));
    const label = `CSV row ${row.line}`;
    const importedId = values.id?.trim() || `cargo-${index + 1}`;
    // Valid IDs cannot contain apostrophes; undo only the export's hyphen-ID prefix.
    // Cargo names retain spreadsheet protection because their apostrophes are ambiguous.
    const id = importedId.startsWith("'-") ? importedId.slice(1) : importedId;
    if (ids.has(id)) throw new Error(`${label}: duplicate ID “${id}”. Each cargo row needs a unique ID.`);
    ids.add(id);
    const item = {
      id,
      name: values.name.trim(),
      lengthCm: csvNumber(values.lengthCm, `${label} lengthCm`),
      widthCm: csvNumber(values.widthCm, `${label} widthCm`),
      heightCm: csvNumber(values.heightCm, `${label} heightCm`),
      weightKg: csvNumber(values.weightKg, `${label} weightKg`),
      quantity: csvNumber(values.quantity, `${label} quantity`),
      fragile: csvFlag(values.fragile, `${label} fragile`, false),
      keepUpright: csvFlag(values.keepUpright, `${label} keepUpright`, false),
      stackable: csvFlag(values.stackable, `${label} stackable`, true),
      maxTopLoadKg: values.maxTopLoadKg?.trim() ? csvNumber(values.maxTopLoadKg, `${label} maxTopLoadKg`) : 0,
      priority: values.priority?.trim() || 'normal',
      color: values.color?.trim() || DEFAULT_COLORS[index % DEFAULT_COLORS.length],
    };
    try { return parseCargoItems([item])[0]; }
    catch (error) { throw new Error(`${label}: ${error instanceof Error ? error.message.replace(/^Cargo row 1 /, '') : 'invalid cargo data.'}`); }
  });
  return parseCargoItems(items);
}

function csvCell(value: CsvValue): string {
  let serialized = String(value);
  // Spreadsheet programs execute formula-like text even when CSV fields are quoted.
  if (typeof value === 'string' && /^\s*[=+\-@]/.test(serialized)) serialized = `'${serialized}`;
  return /[,"\r\n]/.test(serialized) ? `"${serialized.replace(/"/g, '""')}"` : serialized;
}

function csvTable(headers: string[], rows: CsvValue[][]): string {
  return [headers.map(csvCell).join(','), ...rows.map(row => row.map(csvCell).join(','))].join('\r\n');
}

export function exportCargoCsv(items: CargoItem[]): string {
  return csvTable([...CARGO_COLUMNS], parseCargoItems(items).map(item => CARGO_COLUMNS.map(column => item[column])));
}

export function exportPlanCsv(plan: PackingPlan): string {
  const placed: CsvValue[][] = plan.placements.map(piece => [
    'packed', piece.sequence, piece.id, piece.itemId, piece.name, piece.unitIndex,
    piece.x, piece.y, piece.z, piece.lengthCm, piece.widthCm, piece.heightCm, piece.weightKg,
    piece.rotated, piece.fragile, piece.keepUpright, piece.stackable, piece.maxTopLoadKg,
    piece.loadOnTopKg, piece.supportRatio, piece.supportIds.join('|'), 1, '', '',
  ]);
  const unplaced: CsvValue[][] = plan.unplaced.map(piece => [
    'unplaced', '', '', piece.itemId, piece.name, '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', piece.count, piece.code, piece.reason,
  ]);
  return csvTable(PLAN_COLUMNS, [...placed, ...unplaced]);
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!);
}

const formatNumber = (value: number, digits = 2) => Number.isFinite(value) ? value.toLocaleString('en', { maximumFractionDigits: digits }) : '—';
const formatPercent = (value: number) => `${formatNumber(value * 100, 1)}%`;
const volume = (box: { lengthCm: number; widthCm: number; heightCm: number }) => box.lengthCm * box.widthCm * box.heightCm / 1_000_000;

function matchesCargo(piece: Placement, item: CargoItem): boolean {
  const dimensions = (box: CargoItem | Placement) => [box.lengthCm, box.widthCm, box.heightCm].sort((a, b) => a - b).join(':');
  const topLoad = item.fragile || !item.stackable ? 0 : item.maxTopLoadKg;
  return item.weightKg === piece.weightKg && item.name === piece.name && item.color === piece.color
    && item.fragile === piece.fragile && item.keepUpright === piece.keepUpright && item.stackable === piece.stackable
    && topLoad === piece.maxTopLoadKg && (!item.keepUpright || item.heightCm === piece.heightCm)
    && dimensions(item) === dimensions(piece);
}

function reportStats(document: StudioDocument, plan: PackingPlan): PackingStats {
  if (!plan.valid || JSON.stringify(document.space) !== JSON.stringify(parseDocument({ ...document, space: plan.space }).space) || document.strategy !== plan.strategy) throw new Error('Build a valid plan for the current load space and strategy before exporting a report.');
  const requestedCount = document.items.reduce((sum, item) => sum + item.quantity, 0);
  const ids = new Map(document.items.map(item => [item.id, item]));
  const units = new Set<string>();
  const counts = new Map<string, number>();
  for (const piece of plan.placements) {
    const item = ids.get(piece.itemId);
    const unit = `${piece.itemId}#${piece.unitIndex}`;
    if (!item || !Number.isSafeInteger(piece.unitIndex) || piece.unitIndex < 1 || piece.unitIndex > item.quantity || units.has(unit) || !matchesCargo(piece, item)) throw new Error('The cargo manifest has changed. Rebuild the plan before exporting a report.');
    units.add(unit);
    counts.set(piece.itemId, (counts.get(piece.itemId) ?? 0) + 1);
  }
  const unplacedCount = plan.unplaced.reduce((sum, entry) => sum + entry.count, 0);
  for (const entry of plan.unplaced) {
    if (!ids.has(entry.itemId) || ids.get(entry.itemId)?.name !== entry.name || !Number.isSafeInteger(entry.count) || entry.count <= 0) throw new Error('The cargo quantities have changed. Rebuild the plan before exporting a report.');
    counts.set(entry.itemId, (counts.get(entry.itemId) ?? 0) + entry.count);
  }
  if (requestedCount !== plan.placements.length + unplacedCount || document.items.some(item => counts.get(item.id) !== item.quantity)) throw new Error('The cargo quantities have changed. Rebuild the plan before exporting a report.');
  const packedWeightKg = plan.placements.reduce((sum, piece) => sum + piece.weightKg, 0);
  const packedVolumeM3 = plan.placements.reduce((sum, piece) => sum + volume(piece), 0);
  const usableVolumeM3 = volume(usableDimensions(document.space));
  const moment = plan.placements.reduce((sum, piece) => ({ x: sum.x + (piece.x + piece.widthCm / 2) * piece.weightKg, y: sum.y + (piece.y + piece.heightCm / 2) * piece.weightKg, z: sum.z + (piece.z + piece.lengthCm / 2) * piece.weightKg }), { x: 0, y: 0, z: 0 });
  return {
    requestedCount, packedCount: plan.placements.length, unplacedCount,
    requestedWeightKg: document.items.reduce((sum, item) => sum + item.quantity * item.weightKg, 0),
    packedWeightKg, totalVolumeM3: volume(document.space), usableVolumeM3, packedVolumeM3,
    emptyVolumeM3: Math.max(0, usableVolumeM3 - packedVolumeM3),
    volumeUtilization: usableVolumeM3 ? packedVolumeM3 / usableVolumeM3 : 0,
    payloadUtilization: packedWeightKg / document.space.maxPayloadKg,
    centerOfGravity: packedWeightKg ? { x: moment.x / packedWeightKg, y: moment.y / packedWeightKg, z: moment.z / packedWeightKg } : null,
  };
}

function htmlTable(headers: string[], rows: string[][]): string {
  return `<table><thead><tr>${headers.map(header => `<th>${escapeHtml(header)}</th>`).join('')}</tr></thead><tbody>${rows.map(row => `<tr>${row.map(cell => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
}

export function createPlanReport(value: StudioDocument, plan: PackingPlan): string {
  const document = parseDocument(value);
  const stats = reportStats(document, plan);
  const space = document.space;
  const dimensions = usableDimensions(space);
  const handling = (item: Pick<CargoItem, 'fragile' | 'keepUpright' | 'stackable' | 'maxTopLoadKg'>) => [item.fragile ? 'Fragile' : '', item.keepUpright ? 'Upright' : '', !item.stackable || item.fragile ? 'No stacking' : `Top load ≤ ${formatNumber(item.maxTopLoadKg)} kg`].filter(Boolean).join(' · ');
  const manifest = htmlTable(['Cargo', 'Quantity', 'L × W × H (cm)', 'Per piece (kg)', 'Priority', 'Handling'], document.items.map(item => [item.name, String(item.quantity), `${formatNumber(item.lengthCm)} × ${formatNumber(item.widthCm)} × ${formatNumber(item.heightCm)}`, formatNumber(item.weightKg), item.priority, handling(item)]));
  const placements = htmlTable(['Load step', 'Cargo / unit', 'Position x / y / z (cm)', 'L × W × H (cm)', 'Weight (kg)', 'Load on top (kg)', 'Handling / orientation'], plan.placements.map(piece => [String(piece.sequence), `${piece.name} / ${piece.unitIndex}`, `${formatNumber(piece.x)} / ${formatNumber(piece.y)} / ${formatNumber(piece.z)}`, `${formatNumber(piece.lengthCm)} × ${formatNumber(piece.widthCm)} × ${formatNumber(piece.heightCm)}`, formatNumber(piece.weightKg), `${formatNumber(piece.loadOnTopKg)} / ${formatNumber(piece.maxTopLoadKg)}`, `${handling(piece)}${piece.rotated ? ' · Rotated' : ''}`]));
  const unplaced = plan.unplaced.length ? htmlTable(['Cargo', 'Pieces', 'Code', 'Why it was not placed'], plan.unplaced.map(piece => [piece.name, String(piece.count), piece.code, piece.reason])) : '<p>All requested cargo was placed.</p>';
  const center = stats.centerOfGravity;
  const notes = [...plan.errors, ...plan.warnings].map(note => `<li>${escapeHtml(note)}</li>`).join('');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(document.name)} · Cargo Twin plan</title><style>
    :root{font-family:Arial,sans-serif;color:#172a39;background:#f3f5f7}body{max-width:1120px;margin:32px auto;padding:36px;background:#fff}h1{font-size:32px;margin:8px 0 12px}h2{font-size:20px;margin:32px 0 12px}p,li{line-height:1.6}.eyebrow{color:#436c84;font-weight:bold;letter-spacing:2px;font-size:12px}.meta{color:#536574}.stats{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin:24px 0}.metric{border:1px solid #ccd9e1;padding:16px;border-radius:8px}.metric strong{display:block;font-size:24px;margin-bottom:6px}.metric span{font-size:13px;color:#536574}table{width:100%;border-collapse:collapse;font-size:12px;overflow-wrap:anywhere}th,td{text-align:left;padding:10px 8px;border-bottom:1px solid #d8e0e5;vertical-align:top}th{background:#edf2f5}tr{break-inside:avoid}.limits{background:#edf2f5;border-left:4px solid #436c84;padding:16px 20px;margin-top:28px}button{border:0;border-radius:6px;background:#172a39;color:#fff;padding:10px 16px;float:right;cursor:pointer}@media(max-width:650px){body{padding:16px;margin:0}.stats{grid-template-columns:repeat(2,1fr)}table{font-size:10px}th,td{padding:6px 3px}}@media print{@page{size:landscape;margin:12mm}:root{background:white}body{max-width:none;margin:0;padding:0}button{display:none}.stats{grid-template-columns:repeat(3,1fr)}thead{display:table-header-group}.limits{break-inside:avoid}h2{break-after:avoid}}
  </style></head><body><button type="button" onclick="window.print()">Print / save PDF</button><div class="eyebrow">CARGO TWIN · LOAD PLAN</div><h1>${escapeHtml(document.name)}</h1><p class="meta">${escapeHtml(space.name)} · ${escapeHtml(space.mode)} · ${escapeHtml(plan.strategy)} strategy</p>
  <div class="stats"><div class="metric"><strong>${stats.packedCount} / ${stats.requestedCount}</strong><span>Packed / requested pieces · ${stats.unplacedCount} unplaced</span></div><div class="metric"><strong>${formatNumber(stats.packedWeightKg)} kg</strong><span>Packed cargo · ${formatNumber(stats.requestedWeightKg)} kg requested</span></div><div class="metric"><strong>${formatPercent(stats.volumeUtilization)}</strong><span>Usable-volume fill · ${formatNumber(stats.packedVolumeM3, 3)} / ${formatNumber(stats.usableVolumeM3, 3)} m³</span></div><div class="metric"><strong>${formatPercent(stats.payloadUtilization)}</strong><span>Payload used · ${formatNumber(space.maxPayloadKg)} kg capacity</span></div><div class="metric"><strong>${formatNumber(stats.emptyVolumeM3, 3)} m³</strong><span>Unoccupied usable volume</span></div><div class="metric"><strong>${center ? `${formatNumber(center.x)} / ${formatNumber(center.y)} / ${formatNumber(center.z)}` : 'No loaded cargo'}</strong><span>Cargo centre of mass x / y / z (cm)</span></div></div>
  <h2>Load space</h2><p>Interior L × W × H: ${formatNumber(space.lengthCm)} × ${formatNumber(space.widthCm)} × ${formatNumber(space.heightCm)} cm. Usable: ${formatNumber(dimensions.lengthCm)} × ${formatNumber(dimensions.widthCm)} × ${formatNumber(dimensions.heightCm)} cm. Clearance: ${formatNumber(space.clearanceCm)} cm. Reserved rear slice: ${formatNumber(space.reservedDepthCm)} cm.</p>
  <h2>Cargo manifest</h2>${manifest}<h2>Loading sequence · ${stats.packedCount} placed pieces</h2><p>Coordinates mark the lower corner of each piece: x across width, y up from the floor, z along length. Rows follow planner insertion order.</p>${placements}<h2>Unplaced cargo · ${stats.unplacedCount} pieces</h2>${unplaced}${notes ? `<h2>Plan notes</h2><ul>${notes}</ul>` : ''}
  <div class="limits"><strong>Planning limits</strong><p>${escapeHtml(plan.explanation)}</p><p>The interactive planner evaluates at most ${MAX_CARGO_PIECES} eligible pieces. This rectangular-box planning aid does not certify a transport load. Vehicle and fuel mass, real axle limits, tie-down restraints, acceleration, friction, door access, unloading access, irregular cargo and transport certification require independent checks. Loading sequence shows placement order; a collision-free loading path is not simulated. Unplaced pieces are excluded from every packed-weight and fill calculation.</p></div></body></html>`;
}
