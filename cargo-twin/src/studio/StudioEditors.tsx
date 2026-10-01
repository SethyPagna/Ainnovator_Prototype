import { useEffect, useId, useRef, useState } from 'react';
import type { CargoItem, SpaceConfig, TransportMode } from './model';
import { MAX_CARGO_PIECES } from './model';
import { SPACE_PRESETS } from './presets';
import { Icon, formatNumber } from './StudioIcons';
import './editors.css';

export const CARGO_COLORS = ['#9185ee', '#65bda8', '#eda76a', '#6bade3', '#d893ad', '#c8ba64'];
export const MODES: { id: TransportMode; label: string }[] = [{ id: 'road', label: 'Road' }, { id: 'sea', label: 'Sea' }, { id: 'air', label: 'Air' }, { id: 'rail', label: 'Rail' }, { id: 'custom', label: 'Custom' }];
const MIN_DIMENSION_CM = 0.1;
const MAX_DIMENSION_CM = 100_000;
const MAX_MASS_KG = 1_000_000_000;
const MAX_QUANTITY = 10_000;
const CSV_REQUIRED_HEADERS = 'name,lengthCm,widthCm,heightCm,weightKg,quantity';
const SAMPLE_CARGO_CSV = CSV_REQUIRED_HEADERS + ',fragile,keepUpright,stackable,maxTopLoadKg,priority,color\r\n'
  + 'Everyday cartons,60,40,40,12,6,false,true,true,48,normal,#9185ee\r\n'
  + 'Glass crates,50,40,45,9,2,true,true,false,0,high,#eda76a\r\n';
const SAMPLE_CSV_URL = 'data:text/csv;charset=utf-8,' + encodeURIComponent(SAMPLE_CARGO_CSV);
type Dimensions = Pick<CargoItem, 'lengthCm' | 'widthCm' | 'heightCm'>;

interface NumericProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  unit?: string;
  min?: number;
  max?: number;
  step?: number | 'any';
  disabled?: boolean;
  integer?: boolean;
  exclusiveMin?: boolean;
  help?: string;
  validationError?: string;
}

function numericError({ value, min = 0, max, integer, exclusiveMin }: Pick<NumericProps, 'value' | 'min' | 'max' | 'integer' | 'exclusiveMin'>): string | undefined {
  if (!Number.isFinite(value)) return 'Enter a number.';
  if (value < min || (exclusiveMin && value === min)) return 'Enter ' + (exclusiveMin ? 'more than ' : 'at least ') + formatNumber(min, 2) + '.';
  if (integer && !Number.isSafeInteger(value)) return 'Use a whole number of pieces.';
  if (max !== undefined && value > max) return 'Use ' + formatNumber(max) + ' or less.';
  return undefined;
}

export function cargoHasInputErrors(item: CargoItem): boolean {
  const invalidDimension = [item.lengthCm, item.widthCm, item.heightCm].some(value => numericError({ value, min: MIN_DIMENSION_CM, max: MAX_DIMENSION_CM }));
  return !item.name.trim() || invalidDimension
    || Boolean(numericError({ value: item.quantity, min: 1, max: MAX_QUANTITY, integer: true }))
    || Boolean(numericError({ value: item.weightKg, max: MAX_MASS_KG, exclusiveMin: true }))
    || Boolean(numericError({ value: item.maxTopLoadKg, max: MAX_MASS_KG }));
}

export function Numeric(props: NumericProps) {
  const { label, value, onChange, unit, min = 0, max, step = 1, disabled = false, help } = props;
  const id = useId();
  const error = props.validationError ?? (disabled ? undefined : numericError(props));
  const describedBy = [help ? id + '-help' : '', error ? id + '-error' : ''].filter(Boolean).join(' ') || undefined;
  return <label className={'ct-field ' + (error ? 'ct-field-invalid' : '')}>
    <span>{label}{unit && <small>{unit}</small>}</span>
    <input id={id} aria-label={label + (unit ? ' ' + unit : '')} aria-invalid={error ? true : undefined} aria-describedby={describedBy}
      type="number" min={min} max={max} step={step} disabled={disabled} value={Number.isFinite(value) ? value : ''}
      onChange={event => onChange(event.currentTarget.valueAsNumber)} />
    {help && <small id={id + '-help'} className="ct-editor-help">{help}</small>}
    {error && <small id={id + '-error'} className="ct-editor-error">{error}</small>}
  </label>;
}

function DimensionFields({ value, onChange }: { value: Dimensions; onChange: (patch: Partial<Dimensions>) => void }) {
  return <div className="ct-fields three">
    <Numeric label="Length" unit="cm" value={value.lengthCm} min={MIN_DIMENSION_CM} max={MAX_DIMENSION_CM} step="any" onChange={lengthCm => onChange({ lengthCm })} />
    <Numeric label="Width" unit="cm" value={value.widthCm} min={MIN_DIMENSION_CM} max={MAX_DIMENSION_CM} step="any" onChange={widthCm => onChange({ widthCm })} />
    <Numeric label="Height" unit="cm" value={value.heightCm} min={MIN_DIMENSION_CM} max={MAX_DIMENSION_CM} step="any" onChange={heightCm => onChange({ heightCm })} />
  </div>;
}

interface CargoEditorProps {
  items: CargoItem[];
  expandedId: string | null;
  onExpand: (id: string | null) => void;
  onUpdate: (id: string, patch: Partial<CargoItem>) => void;
  onAdd: () => void;
  onDuplicate: (id: string) => void;
  onRemove: (id: string) => void;
  onImport: () => void;
}

function CargoFields({ item, onUpdate, onDuplicate, onRemove, onClose }: {
  item: CargoItem;
  onUpdate: (patch: Partial<CargoItem>) => void;
  onDuplicate: () => void;
  onRemove: () => void;
  onClose: () => void;
}) {
  const id = useId();
  const [repairingLimit, setRepairingLimit] = useState(false);
  const nameError = !item.name.trim() ? 'Give this cargo type a name.' : undefined;
  const topIsClear = item.fragile || !item.stackable;
  const topLoadInvalid = Boolean(numericError({ value: item.maxTopLoadKg, max: MAX_MASS_KG }));
  const showStoredLimit = !topIsClear || topLoadInvalid || repairingLimit;
  return <>
    <label className={'ct-field ' + (nameError ? 'ct-field-invalid' : '')}>
      <span>Description</span><input aria-label="Description" aria-invalid={nameError ? true : undefined} aria-describedby={nameError ? id + '-name-error' : undefined}
        value={item.name} maxLength={80} placeholder="For example, tool cases" onChange={event => onUpdate({ name: event.target.value })} />
      {nameError && <small id={id + '-name-error'} className="ct-editor-error">{nameError}</small>}
    </label>
    <div className="ct-editor-section"><h3>Size of one piece</h3><p>Measure each box or crate, not the whole shipment.</p></div>
    <DimensionFields value={item} onChange={onUpdate} />
    <div className="ct-fields">
      <Numeric label="Quantity" value={item.quantity} min={1} max={MAX_QUANTITY} integer onChange={quantity => onUpdate({ quantity })} help="How many identical pieces?" />
      <Numeric label="Per piece" unit="kg" value={item.weightKg} max={MAX_MASS_KG} exclusiveMin step="any" onChange={weightKg => onUpdate({ weightKg })} help="Weight of one piece." />
    </div>
    <fieldset className="ct-editor-handling"><legend>Handling rules</legend><div className="ct-handling">
      <label><input aria-label="Fragile" aria-describedby={id + '-fragile'} type="checkbox" checked={item.fragile} onChange={event => onUpdate({ fragile: event.target.checked })} /><span><strong>Fragile</strong><small id={id + '-fragile'}>Keep the top clear. Nothing is stacked above it.</small></span></label>
      <label><input aria-label="Keep upright" aria-describedby={id + '-upright'} type="checkbox" checked={item.keepUpright} onChange={event => onUpdate({ keepUpright: event.target.checked })} /><span><strong>Keep upright</strong><small id={id + '-upright'}>Height stays vertical; the piece may turn on the floor.</small></span></label>
      <label className={item.fragile ? 'ct-handling-disabled' : ''}><input aria-label="Allow cargo above" aria-describedby={id + '-stackable'} type="checkbox" checked={item.stackable && !item.fragile} disabled={item.fragile} onChange={event => onUpdate({ stackable: event.target.checked })} /><span><strong>Allow cargo above</strong><small id={id + '-stackable'}>{item.fragile ? 'Turn off Fragile to allow stacking.' : 'Use the top-load limit below to protect this piece.'}</small></span></label>
    </div></fieldset>
    <Numeric label="Top-load limit" unit="kg" value={showStoredLimit ? item.maxTopLoadKg : 0} max={MAX_MASS_KG} disabled={!showStoredLimit}
      onChange={maxTopLoadKg => { setRepairingLimit(topIsClear); onUpdate({ maxTopLoadKg }); }}
      help={topIsClear ? showStoredLimit ? 'Enter a valid saved allowance. These handling rules still keep the top clear.' : 'The top stays clear with these handling rules.' : 'Combined weight this piece can support above it. Zero keeps its top clear.'} />
    <label className="ct-field"><span>Priority</span><select aria-label="Priority" aria-describedby={id + '-priority'} value={item.priority} onChange={event => onUpdate({ priority: event.target.value as CargoItem['priority'] })}>
      <option value="normal">Normal</option><option value="high">High</option><option value="low">Low</option>
    </select><small id={id + '-priority'} className="ct-editor-help">High-priority pieces are considered first when space or payload is limited.</small></label>
    <div className="ct-cargo-edit-footer">
      <label className="ct-color-picker"><input type="color" aria-label={'Color for ' + item.name} value={item.color} onChange={event => onUpdate({ color: event.target.value })} />Cargo color</label>
      <button type="button" className="ct-editor-action" aria-label={'Duplicate ' + item.name} onClick={onDuplicate}><Icon name="copy" size={16} />Duplicate</button>
      <button type="button" className="ct-editor-action danger" aria-label={'Remove ' + item.name} onClick={onRemove}><Icon name="trash" size={16} />Remove</button>
      <button type="button" className="ct-editor-close" onClick={onClose}>Close editor <Icon name="check" size={16} /></button>
    </div>
  </>;
}

export function CargoEditor({ items, expandedId, onExpand, onUpdate, onAdd, onDuplicate, onRemove, onImport }: CargoEditorProps) {
  const [query, setQuery] = useState('');
  const id = useId();
  const listRef = useRef<HTMLDivElement>(null);
  const shown = items.filter(item => item.id === expandedId || item.name.toLowerCase().includes(query.toLowerCase()));
  const quantitiesComplete = items.every(item => Number.isSafeInteger(item.quantity) && item.quantity >= 1 && item.quantity <= MAX_QUANTITY);
  const weightsComplete = quantitiesComplete && items.every(item => Number.isFinite(item.weightKg) && item.weightKg > 0 && item.weightKg <= MAX_MASS_KG);
  const totalQuantity = quantitiesComplete ? items.reduce((sum, item) => sum + item.quantity, 0) : NaN;
  const totalWeight = weightsComplete ? items.reduce((sum, item) => sum + item.quantity * item.weightKg, 0) : NaN;
  useEffect(() => {
    if (!expandedId) return;
    const editor = listRef.current?.querySelector<HTMLElement>('[data-expanded-editor="true"]');
    if (!editor || editor.contains(document.activeElement)) return;
    editor.scrollIntoView({ block: 'nearest' });
    editor.querySelector<HTMLInputElement>('input[aria-label="Description"]')?.focus({ preventScroll: true });
  }, [expandedId]);
  return <div className="ct-cargo-panel ct-editor">
    <div className="ct-panel-heading"><div><h2>Your cargo <span>{items.length} types</span></h2><p>Add boxes or crates. Edit a type to set its size and handling.</p></div>
      <button type="button" className="ct-editor-import" aria-label="Import cargo CSV" title="Import cargo CSV" onClick={onImport}><Icon name="upload" size={16} /><span>Import CSV</span></button>
    </div>
    <details className="ct-editor-csv"><summary>CSV format &amp; example</summary><div className="ct-editor-csv-content">
      <p>Each row describes one cargo type. Sizes are in <strong>cm per piece</strong>, weight is in <strong>kg per piece</strong>, and quantity counts identical pieces.</p>
      <p>Include these six column headers:</p><code className="ct-editor-csv-headers">{CSV_REQUIRED_HEADERS}</code>
      <p>Optional columns: <code>id</code>, <code>fragile</code>, <code>keepUpright</code>, <code>stackable</code>, <code>maxTopLoadKg</code>, <code>priority</code> and <code>color</code>.</p>
      <p>Handling flags accept true/false, yes/no or 1/0. Priority is low, normal or high. Omitted handling defaults to non-fragile, free orientation and stackable, with <strong>zero top-load allowance</strong>. Set a positive <code>maxTopLoadKg</code> to support cargo above.</p>
      <a className="ct-editor-csv-download" href={SAMPLE_CSV_URL} download="cargo-twin-example.csv"><Icon name="download" size={16} />Download sample CSV</a>
      <p className="ct-editor-help">The example has two cargo types and includes handling rules. Import replaces the cargo list; Undo restores your previous list.</p>
    </div></details>
    <label className="ct-search"><Icon name="search" size={16} /><input aria-label="Search cargo" placeholder="Find a cargo type…" value={query} onChange={event => setQuery(event.target.value)} /></label>
    <div className="ct-cargo-list" ref={listRef}>{shown.map(item => {
      const expanded = expandedId === item.id;
      const editorId = id + '-' + item.id;
      return <article className={'ct-cargo-card ' + (expanded ? 'expanded' : '')} key={item.id}>
        <button type="button" className="ct-cargo-summary" aria-label={(item.name || 'Untitled cargo') + ', ' + formatNumber(item.quantity) + ' pieces. ' + (expanded ? 'Close' : 'Edit') + ' cargo details.'}
          onClick={() => onExpand(expanded ? null : item.id)} aria-expanded={expanded} aria-controls={expanded ? editorId : undefined}>
          <span className="ct-cargo-swatch" style={{ background: item.color + '25', color: item.color }}><Icon name="box" size={22} /></span>
          <span className="ct-cargo-name"><strong>{item.name || 'Untitled cargo'}</strong><small>{formatNumber(item.lengthCm, 1)} × {formatNumber(item.widthCm, 1)} × {formatNumber(item.heightCm, 1)} cm / piece</small>
            <span className="ct-mini-tags"><em>{formatNumber(item.weightKg, 1)} kg / piece</em>{item.fragile && <em className="fragile">Fragile</em>}{item.priority === 'high' && <em>High priority</em>}</span>
          </span>
          <span className="ct-quantity">×{formatNumber(item.quantity)}<small>{expanded ? 'Close' : 'Edit'} <Icon name={expanded ? 'close' : 'arrow'} size={13} /></small></span>
        </button>
        {expanded && <div id={editorId} className="ct-cargo-editor" data-expanded-editor="true"><CargoFields item={item} onUpdate={patch => onUpdate(item.id, patch)} onDuplicate={() => onDuplicate(item.id)} onRemove={() => onRemove(item.id)} onClose={() => onExpand(null)} /></div>}
      </article>;
    })}</div>
    {!shown.length && <p className="ct-empty">{items.length ? 'No cargo matches your search.' : 'Add your first cargo type, or import a CSV manifest.'}</p>}
    <button type="button" className="ct-add-cargo" disabled={items.length >= MAX_CARGO_PIECES} onClick={onAdd}><Icon name="plus" size={17} /> Add cargo type</button>
    <div className="ct-manifest-total"><span>{formatNumber(totalQuantity)} pieces</span><strong>{formatNumber(totalWeight, 1)} kg total</strong></div>
    <p className="ct-small-note">{weightsComplete ? 'Sizes and weight describe one piece. The planner evaluates up to ' + MAX_CARGO_PIECES + ' pieces per plan.' : 'Complete each quantity and per-piece weight to see the shipment total.'}</p>
  </div>;
}

function usableSpace(space: SpaceConfig): Dimensions | null {
  const dimensions = [space.lengthCm, space.widthCm, space.heightCm];
  const margins = [space.clearanceCm, space.reservedDepthCm];
  if (!dimensions.every(value => Number.isFinite(value) && value >= MIN_DIMENSION_CM && value <= MAX_DIMENSION_CM)
    || !margins.every(value => Number.isFinite(value) && value >= 0 && value <= MAX_DIMENSION_CM)) return null;
  return { lengthCm: space.lengthCm - space.clearanceCm * 2 - space.reservedDepthCm, widthCm: space.widthCm - space.clearanceCm * 2, heightCm: space.heightCm - space.clearanceCm };
}

export function SpaceEditor({ space, onChange, onPreset }: { space: SpaceConfig; onChange: (patch: Partial<SpaceConfig>) => void; onPreset: (id: string) => void }) {
  const id = useId();
  const usable = usableSpace(space);
  const hasUsableSpace = usable !== null && usable.lengthCm > 0 && usable.widthCm > 0 && usable.heightCm > 0;
  const clearanceLeavesNoSpace = usable !== null && (usable.widthCm <= 0 || usable.heightCm <= 0 || space.lengthCm - space.clearanceCm * 2 <= 0);
  const reserveLeavesNoSpace = usable !== null && !clearanceLeavesNoSpace && usable.lengthCm <= 0;
  const nameError = !space.name.trim() ? 'Give your load space a name.' : undefined;
  return <div className="ct-space-panel ct-editor">
    <div className="ct-panel-heading"><div><h2>Your load space</h2><p>Choose a starting point, then enter the space inside your equipment.</p></div></div>
    <div className="ct-modes" role="group" aria-label="Transport type">{MODES.map(mode => <button type="button" key={mode.id} className={space.mode === mode.id ? 'active' : ''} aria-pressed={space.mode === mode.id}
      onClick={() => { if (space.mode === mode.id) return; const preset = SPACE_PRESETS.find(preset => preset.mode === mode.id); if (preset) onPreset(preset.id); }}><Icon name={mode.id} /><span>{mode.label}</span></button>)}</div>
    <label className="ct-field"><span>Space template</span><select aria-label="Space template" aria-describedby={id + '-template'} value={SPACE_PRESETS.some(preset => preset.id === space.id && preset.mode === space.mode) ? space.id : ''} onChange={event => onPreset(event.target.value)}>
      <option value="" disabled>Custom space</option>{SPACE_PRESETS.filter(preset => preset.mode === space.mode).map(preset => <option key={preset.id} value={preset.id}>{preset.name}</option>)}
    </select><small id={id + '-template'} className="ct-editor-help">Templates fill in example sizes and payload. Edit them to match your equipment.</small></label>
    <label className={'ct-field ' + (nameError ? 'ct-field-invalid' : '')}><span>Space name</span><input aria-label="Space name" aria-invalid={nameError ? true : undefined} aria-describedby={nameError ? id + '-name-error' : undefined} value={space.name} onChange={event => onChange({ name: event.target.value })} maxLength={70} />
      {nameError && <small id={id + '-name-error'} className="ct-editor-error">{nameError}</small>}
    </label>
    <div className="ct-space-diagram"><Icon name={space.mode} size={36} /><div><strong>{formatNumber(space.lengthCm, 1)} × {formatNumber(space.widthCm, 1)} × {formatNumber(space.heightCm, 1)} cm</strong><small>Inside length × width × height</small></div></div>
    <DimensionFields value={space} onChange={onChange} />
    <Numeric label="Cargo payload" unit="kg" value={space.maxPayloadKg} max={MAX_MASS_KG} exclusiveMin step="any" onChange={maxPayloadKg => onChange({ maxPayloadKg })} help="Maximum cargo weight your equipment can carry. Cargo weight excludes the vehicle itself." />
    <Numeric label="Clearance" unit="cm" value={space.clearanceCm} max={MAX_DIMENSION_CM} step="any" onChange={clearanceCm => onChange({ clearanceCm })}
      validationError={clearanceLeavesNoSpace ? 'Reduce clearance; it leaves no room for cargo.' : undefined} help="Leave a margin at both side walls, the front/rear and below the ceiling." />
    <Numeric label="Reserved rear" unit="cm" value={space.reservedDepthCm} max={MAX_DIMENSION_CM} step="any" onChange={reservedDepthCm => onChange({ reservedDepthCm })}
      validationError={reserveLeavesNoSpace ? 'Reduce the rear reserve; it uses all remaining length.' : undefined} help="Keep this extra slice at the rear empty, for equipment or space you cannot use." />
    <div className={'ct-editor-usable ' + (usable && !hasUsableSpace ? 'ct-editor-usable-invalid' : '')}>
      <span><Icon name="layers" size={18} />Available for cargo</span>
      <strong>{hasUsableSpace && usable ? formatNumber(usable.lengthCm, 1) + ' × ' + formatNumber(usable.widthCm, 1) + ' × ' + formatNumber(usable.heightCm, 1) + ' cm' : '—'}</strong>
      <p>{usable && !hasUsableSpace ? 'Clearance and the reserved rear leave no usable space. Reduce them or increase the internal dimensions.' : usable ? 'This is the remaining length × width × height. Fill metrics use this space.' : 'Complete the dimensions, clearance and reserved rear to see usable space.'}</p>
    </div>
    <p className="ct-small-note">Check your actual equipment specifications. Templates and visual shells are examples; loading access needs a separate check.</p>
  </div>;
}
