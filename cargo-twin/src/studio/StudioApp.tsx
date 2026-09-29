import { useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent, ReactNode } from 'react';
import { CARGO_SCENARIOS, SPACE_PRESETS } from './presets';
import { MAX_CARGO_PIECES, STRATEGIES } from './model';
import type { CargoItem, CargoScenario, PackingPlan, PackingStrategy, SpaceConfig, TransportMode } from './model';
import { StudioScene } from './StudioScene';
import type { StudioWorkerResponse } from './packing.worker';
import './studio.css';

type IconName = 'box' | 'road' | 'sea' | 'air' | 'rail' | 'custom' | 'plus' | 'arrow' | 'play' | 'pause' | 'download' | 'upload' | 'save' | 'folder' | 'layers' | 'cube' | 'top' | 'side' | 'check' | 'warning' | 'close' | 'copy' | 'trash' | 'bolt';
function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  const paths: Record<IconName, ReactNode> = {
    box: <><path d="m12 3 9 5-9 5-9-5 9-5Z M3 8v9l9 5 9-5V8 M12 13v9 M7.5 5.5l9 5" /></>,
    cube: <><path d="m12 3 9 5-9 5-9-5 9-5Z M3 8v9l9 5 9-5V8 M12 13v9" /></>,
    road: <><path d="M2 5h12v12H2z M14 9h4l4 4v4h-8" /><circle cx="6" cy="18" r="2" /><circle cx="18" cy="18" r="2" /></>,
    sea: <><path d="M4 12h16l-3 7H7L4 12Z M7 12V5h10v7 M10 5V2 M2 21l3-1 4 1 3-1 4 1 3-1 3 1" /></>,
    air: <path d="m3 15 7-4V5c0-4 4-4 4 0v6l7 4v3l-7-2v4l2 1H8l2-1v-4l-7 2v-3Z" />,
    rail: <><rect x="5" y="3" width="14" height="15" rx="3" /><path d="M5 10h14 M12 3v7 M8 18l-3 4 M16 18l3 4" /><circle cx="8" cy="14" r="1" /><circle cx="16" cy="14" r="1" /></>,
    custom: <><path d="M4 6h16 M4 12h16 M4 18h16 M8 3v6 M16 9v6 M10 15v6" /></>,
    plus: <path d="M12 5v14 M5 12h14" />,
    arrow: <path d="M4 12h16 M14 6l6 6-6 6" />,
    play: <path d="m8 4 12 8-12 8V4Z" />,
    pause: <path d="M8 4v16 M16 4v16" />,
    download: <path d="M12 3v12 M7 10l5 5 5-5 M4 16v5h16v-5" />,
    upload: <path d="M12 16V4 M7 9l5-5 5 5 M4 16v5h16v-5" />,
    save: <><path d="M4 3h13l4 4v14H3V3h1Z M7 3v6h9V3 M7 21v-8h10v8" /></>,
    folder: <path d="M3 6V4h7l2 3h9v13H3V6Z" />,
    layers: <path d="m12 3 10 5-10 5L2 8l10-5Z M2 12l10 5 10-5 M2 16l10 5 10-5" />,
    top: <><rect x="4" y="4" width="16" height="16" rx="1" /><path d="M4 12h16 M12 4v16" /></>,
    side: <><rect x="3" y="8" width="18" height="10" rx="1" /><path d="M9 8v10 M15 8v10 M3 21h18" /></>,
    check: <path d="m5 12 4 4L20 5" />,
    warning: <><path d="m12 3 10 18H2L12 3Z M12 9v5 M12 17v1" /></>,
    close: <path d="m6 6 12 12 M6 18 18 6" />,
    copy: <><rect x="8" y="8" width="12" height="13" rx="2" /><path d="M16 8V3H3v13h5" /></>,
    trash: <path d="M3 6h18 M8 6V3h8v3 M5 6l1 15h12l1-15 M10 10v7 M14 10v7" />,
    bolt: <path d="m13 2-9 12h7l-1 8 10-12h-7l1-8Z" />,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

const number = (value: number, digits = 0) => Number.isFinite(value) ? value.toLocaleString('en', { maximumFractionDigits: digits }) : '—';
const percent = (value: number) => `${number(value * 100, 1)}%`;
const COLORS = ['#eaa861', '#789f8c', '#7399b8', '#ba91ac', '#d1826e', '#a9ae72'];
const STORAGE_KEY = 'cargo-twin-studio-v1';
const MODES: { id: TransportMode; label: string }[] = [{ id: 'road', label: 'Road' }, { id: 'sea', label: 'Sea' }, { id: 'air', label: 'Air' }, { id: 'rail', label: 'Rail' }, { id: 'custom', label: 'Custom' }];
const snapshot = (space: SpaceConfig, items: CargoItem[], strategy: PackingStrategy) => JSON.stringify({ space, items, strategy });

function emptyPlan(space: SpaceConfig, items: CargoItem[]): PackingPlan {
  const usableVolumeM3 = Math.max(0, (space.widthCm - space.clearanceCm * 2) * (space.heightCm - space.clearanceCm) * (space.lengthCm - space.clearanceCm * 2 - space.reservedDepthCm) / 1e6);
  return { space, strategy: 'max-fill', valid: true, placements: [], unplaced: [], errors: [], warnings: [], explanation: 'Build a plan to inspect placements.', stats: { requestedCount: items.reduce((sum, item) => sum + item.quantity, 0), packedCount: 0, unplacedCount: 0, requestedWeightKg: items.reduce((sum, item) => sum + item.quantity * item.weightKg, 0), packedWeightKg: 0, totalVolumeM3: space.widthCm * space.heightCm * space.lengthCm / 1e6, usableVolumeM3, packedVolumeM3: 0, emptyVolumeM3: usableVolumeM3, volumeUtilization: 0, payloadUtilization: 0, centerOfGravity: null } };
}

function Numeric({ label, value, onChange, unit, min = 0, step = 1, disabled = false }: { label: string; value: number; onChange: (value: number) => void; unit?: string; min?: number; step?: number; disabled?: boolean }) {
  return <label className="ct-field"><span>{label}{unit && <small>{unit}</small>}</span><input type="number" min={min} step={step} disabled={disabled} value={Number.isFinite(value) ? value : ''} onChange={event => onChange(event.target.value === '' ? 0 : Number(event.target.value))} /></label>;
}

function Meter({ value, className = '' }: { value: number; className?: string }) {
  return <div className={`ct-meter ${className}`}><i style={{ width: `${Math.max(0, Math.min(100, value * 100))}%` }} /></div>;
}

function importedScenario(value: unknown): { space: SpaceConfig; items: CargoItem[]; strategy: PackingStrategy } {
  if (!value || typeof value !== 'object') throw new Error('Choose a Cargo Twin scenario JSON file.');
  const data = value as Record<string, unknown>;
  const space = data.space as SpaceConfig;
  const items = data.items as CargoItem[];
  if (!space || !Array.isArray(items) || items.length > MAX_CARGO_PIECES) throw new Error('A scenario needs a load space and 0–400 cargo rows.');
  const dimensions = [space.lengthCm, space.widthCm, space.heightCm, space.maxPayloadKg, space.clearanceCm, space.reservedDepthCm];
  if (typeof space.name !== 'string' || !MODES.some(mode => mode.id === space.mode) || !dimensions.every(Number.isFinite)) throw new Error('The load-space data is incomplete or invalid.');
  const ids = new Set<string>();
  for (const item of items) {
    if (!item || typeof item.id !== 'string' || ids.has(item.id) || typeof item.name !== 'string' || !/^#[a-f0-9]{6}$/i.test(item.color) || ![item.lengthCm, item.widthCm, item.heightCm, item.quantity, item.weightKg, item.maxTopLoadKg].every(Number.isFinite) || !['low', 'normal', 'high'].includes(item.priority) || ![item.fragile, item.keepUpright, item.stackable].every(flag => typeof flag === 'boolean')) throw new Error('Cargo rows need unique IDs, valid dimensions, colors, and handling rules.');
    ids.add(item.id);
  }
  const strategy = STRATEGIES.some(strategy => strategy.id === data.strategy) ? data.strategy as PackingStrategy : 'max-fill';
  if (space.lengthCm <= 0 || space.widthCm <= 0 || space.heightCm <= 0 || space.maxPayloadKg <= 0 || space.clearanceCm < 0 || space.reservedDepthCm < 0 || space.widthCm <= space.clearanceCm * 2 || space.heightCm <= space.clearanceCm || space.lengthCm <= space.clearanceCm * 2 + space.reservedDepthCm) throw new Error('The load space needs positive dimensions, payload, and usable space.');
  if (items.some(item => !Number.isSafeInteger(item.quantity) || item.quantity <= 0 || item.lengthCm <= 0 || item.widthCm <= 0 || item.heightCm <= 0 || item.weightKg <= 0 || item.maxTopLoadKg < 0)) throw new Error('Cargo needs positive dimensions, weight, and whole-piece quantities.');
  return { space: { ...space }, items: items.map(item => ({ ...item })), strategy };
}

export function StudioApp({ onOpenAircraft }: { onOpenAircraft?: () => void }) {
  const initial = CARGO_SCENARIOS[0];
  const initialSpace = SPACE_PRESETS.find(space => space.id === initial.spaceId) ?? SPACE_PRESETS[0];
  const [space, setSpace] = useState<SpaceConfig>(() => ({ ...initialSpace }));
  const [items, setItems] = useState<CargoItem[]>(() => initial.items.map(item => ({ ...item })));
  const [strategy, setStrategy] = useState<PackingStrategy>('max-fill');
  const [plan, setPlan] = useState<PackingPlan>(() => emptyPlan(initialSpace, initial.items));
  const [builtFrom, setBuiltFrom] = useState('');
  const [inputErrors, setInputErrors] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<'cargo' | 'space'>('cargo');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [view, setView] = useState<'perspective' | 'top' | 'side'>('perspective');
  const [showCenter, setShowCenter] = useState(false);
  const [step, setStep] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const [busy, setBusy] = useState(false);
  const [comparison, setComparison] = useState<PackingPlan[] | null>(null);
  const [notice, setNotice] = useState('');
  const [detailsOpen, setDetailsOpen] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const workerRef = useRef<Worker | null>(null);
  const requestId = useRef(0);
  const dirty = snapshot(space, items, strategy) !== builtFrom;
  const totalPieces = items.reduce((sum, item) => sum + item.quantity, 0);
  const totalWeight = items.reduce((sum, item) => sum + item.quantity * item.weightKg, 0);
  const stats = plan.stats;
  const visibleCount = step ?? plan.placements.length;
  const selected = plan.placements.find(piece => piece.id === selectedId && piece.sequence <= visibleCount);
  const scenePieces = useMemo(() => plan.placements.map(piece => ({ ...piece })), [plan]);

  useEffect(() => {
    document.body.classList.add('cargo-studio-body');
    requestOptimization(initialSpace, initial.items, 'max-fill');
    return () => { document.body.classList.remove('cargo-studio-body'); requestId.current++; workerRef.current?.terminate(); workerRef.current = null; };
  }, []);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(''), 6000);
    return () => clearTimeout(timer);
  }, [notice]);
  useEffect(() => {
    if (selectedId && !plan.placements.some(piece => piece.id === selectedId && piece.sequence <= visibleCount)) setSelectedId(null);
  }, [selectedId, visibleCount, plan]);
  useEffect(() => {
    if (!playing) return;
    const timer = setInterval(() => {
      setStep(current => {
        const next = (current ?? 0) + 1;
        if (next >= plan.placements.length) { setPlaying(false); return null; }
        return next;
      });
    }, 450);
    return () => clearInterval(timer);
  }, [playing, plan.placements.length]);

  const applyPlan = (next: PackingPlan, nextSpace = space, nextItems = items) => {
    if (!next.valid) { setInputErrors(next.errors); return; }
    setInputErrors([]);
    setPlan(next); setStrategy(next.strategy); setBuiltFrom(snapshot(nextSpace, nextItems, next.strategy));
    setSelectedId(null); setStep(null); setPlaying(false);
  };
  const inspectPiece = (id: string) => {
    const piece = plan.placements.find(candidate => candidate.id === id);
    if (!piece) return;
    setPlaying(false);
    if (piece.sequence > visibleCount) setStep(piece.sequence);
    setSelectedId(id);
  };
  function cancelOptimization() { requestId.current++; workerRef.current?.terminate(); workerRef.current = null; setBusy(false); }
  function requestOptimization(nextSpace: SpaceConfig, nextItems: CargoItem[], nextStrategy: PackingStrategy, compare = false) {
    cancelOptimization(); setBusy(true); setPlaying(false); setInputErrors([]);
    const id = ++requestId.current;
    try {
      const worker = new Worker(new URL('./packing.worker.ts', import.meta.url), { type: 'module' });
      workerRef.current = worker;
      worker.onmessage = ({ data }: MessageEvent<StudioWorkerResponse>) => {
        if (data.id !== requestId.current) return;
        worker.terminate(); workerRef.current = null; setBusy(false);
        if (data.type === 'error') { setInputErrors([data.message]); return; }
        if (!data.plan.valid) { setInputErrors(data.plan.errors); setComparison(null); return; }
        if (compare) setComparison(data.plans ?? [data.plan]);
        else { applyPlan(data.plan, nextSpace, nextItems); setComparison(null); }
      };
      worker.onerror = () => {
        if (id !== requestId.current) return;
        worker.terminate(); workerRef.current = null; setBusy(false);
        setInputErrors(['The packing worker stopped. Try Pack cargo again or reduce the manifest size.']);
      };
      worker.postMessage({ id, space: nextSpace, items: nextItems, strategy: nextStrategy, compare });
    } catch { setBusy(false); setInputErrors(['The packing worker could not start. Reload the page and try again.']); }
  }
  const runPacking = (compare = false) => requestOptimization(space, items, strategy, compare);
  const loadScenario = (scenario: CargoScenario) => {
    const nextSpace = { ...(SPACE_PRESETS.find(preset => preset.id === scenario.spaceId) ?? SPACE_PRESETS[0]) };
    const nextItems = scenario.items.map(item => ({ ...item }));
    setSpace(nextSpace); setItems(nextItems); setExpandedId(null); setComparison(null);
    setStrategy('max-fill'); requestOptimization(nextSpace, nextItems, 'max-fill');
    setNotice(`${scenario.name} loaded. ${scenario.description}`);
  };
  const updateItem = (id: string, values: Partial<CargoItem>) => { cancelOptimization(); setItems(current => current.map(item => item.id === id ? { ...item, ...values } : item)); setComparison(null); };
  const addItem = () => {
    cancelOptimization();
    const id = crypto.randomUUID();
    setItems(current => [...current, { id, name: `Cargo ${current.length + 1}`, lengthCm: 60, widthCm: 40, heightCm: 40, weightKg: 15, quantity: 4, fragile: false, keepUpright: true, stackable: true, maxTopLoadKg: 80, priority: 'normal', color: COLORS[current.length % COLORS.length] }]);
    setExpandedId(id); setComparison(null);
  };
  const changeSpace = (values: Partial<SpaceConfig>) => { cancelOptimization(); setSpace(current => ({ ...current, ...values })); setComparison(null); };
  const choosePreset = (id: string) => { cancelOptimization(); const preset = SPACE_PRESETS.find(space => space.id === id); if (preset) setSpace({ ...preset }); setComparison(null); };
  const saveLocal = () => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, space, items, strategy })); setNotice('Scenario saved on this device.'); }
    catch { setNotice('Device storage is unavailable. Export a JSON copy instead.'); }
  };
  const applyImported = (value: unknown) => {
    const data = importedScenario(value); setSpace(data.space); setItems(data.items); setExpandedId(null); setComparison(null);
    setStrategy(data.strategy); requestOptimization(data.space, data.items, data.strategy);
  };
  const loadLocal = () => {
    try { const saved = localStorage.getItem(STORAGE_KEY); if (!saved) throw new Error('No saved scenario on this device yet.'); applyImported(JSON.parse(saved)); setNotice('Your saved scenario is ready.'); }
    catch (error) { setNotice(error instanceof Error ? error.message : 'Could not load this scenario.'); }
  };
  const exportScenario = () => {
    const blob = new Blob([JSON.stringify({ version: 1, name: space.name, space, items, strategy }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob), anchor = document.createElement('a');
    anchor.href = url; anchor.download = 'cargo-twin-scenario.json'; anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000); setNotice('Scenario exported with cargo and handling rules.');
  };
  const importFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; event.target.value = '';
    if (!file) return;
    try { if (file.size > 1_000_000) throw new Error('Choose a scenario file smaller than 1 MB.'); applyImported(JSON.parse(await file.text())); setNotice('Imported scenario. Building the packing plan…'); }
    catch (error) { setNotice(error instanceof Error ? error.message : 'Unable to read this scenario file.'); }
  };

  return <div className="ct-app">
    <header className="ct-header">
      <a className="ct-brand" href="?workspace=studio" aria-label="Cargo Twin studio"><span className="ct-brandmark"><Icon name="box" size={25} /></span><span>Cargo<span className="ct-brand-light">Twin</span><small>LOAD PLANNING STUDIO</small></span><span className="ct-version">03</span></a>
      <nav className="ct-header-actions" aria-label="Scenario tools">
        <button onClick={saveLocal} title="Save scenario on this device"><Icon name="save" /><span>Save</span></button>
        <button onClick={loadLocal} title="Load saved scenario"><Icon name="folder" /><span>Load</span></button>
        <button onClick={() => fileInput.current?.click()} title="Import scenario JSON"><Icon name="upload" /><span>Import</span></button>
        <button onClick={exportScenario} title="Export scenario JSON"><Icon name="download" /><span>Export</span></button>
        <span className="ct-header-divider" />
        {onOpenAircraft ? <button className="ct-aircraft-link" onClick={onOpenAircraft}><Icon name="air" /><span>Aircraft planner</span><span aria-hidden="true">↗</span></button> : <a className="ct-aircraft-link" href="?workspace=aircraft"><Icon name="air" /><span>Aircraft planner</span>↗</a>}
      </nav>
      <input ref={fileInput} type="file" accept=".json,application/json" hidden onChange={importFile} />
    </header>

    <div className="ct-intro"><div><span className="ct-eyebrow"><i /> FROM EMPTY SPACE TO A BETTER LOAD</span><h1>Every cubic metre counts.</h1><p>Shape your space. Set the rules. See what fits.</p></div><label className="ct-scenario"><span>START WITH A SCENARIO</span><select aria-label="Load sample scenario" value="" onChange={event => { const scenario = CARGO_SCENARIOS.find(scenario => scenario.id === event.target.value); if (scenario) loadScenario(scenario); }}><option value="" disabled>Explore a sample load</option>{CARGO_SCENARIOS.map(scenario => <option key={scenario.id} value={scenario.id}>{scenario.name}</option>)}</select></label></div>

    <main className="ct-workspace">
      <aside className="ct-inputs">
        <div className="ct-input-tabs" role="tablist" aria-label="Plan inputs"><button role="tab" aria-selected={activeTab === 'cargo'} className={activeTab === 'cargo' ? 'active' : ''} onClick={() => setActiveTab('cargo')}><Icon name="box" /> Cargo <span>{items.length}</span></button><button role="tab" aria-selected={activeTab === 'space'} className={activeTab === 'space' ? 'active' : ''} onClick={() => setActiveTab('space')}><Icon name="custom" /> Load space</button></div>
        {activeTab === 'cargo' ? <div className="ct-cargo-panel">
          <div className="ct-panel-heading"><div><h2>Your manifest</h2><p>{number(totalPieces)} pieces · {number(totalWeight, 1)} kg</p></div><button className="ct-icon-button" onClick={addItem} aria-label="Add cargo" title="Add cargo"><Icon name="plus" /></button></div>
          <div className="ct-cargo-list">{items.map((item, index) => <article className={`ct-cargo-card ${expandedId === item.id ? 'expanded' : ''}`} key={item.id}>
            <button className="ct-cargo-summary" onClick={() => setExpandedId(expandedId === item.id ? null : item.id)} aria-expanded={expandedId === item.id}>
              <span className="ct-cargo-swatch" style={{ background: item.color }}><Icon name="box" size={21} /></span><span className="ct-cargo-name"><strong>{item.name || 'Untitled cargo'}</strong><small>{item.lengthCm} × {item.widthCm} × {item.heightCm} cm · {number(item.weightKg, 1)} kg</small><span className="ct-mini-tags">{item.fragile && <em>Fragile</em>}{!item.stackable && <em>No top load</em>}{item.priority === 'high' && <em>Priority</em>}</span></span><span className="ct-quantity">×{number(item.quantity)}<small>{expandedId === item.id ? '−' : '+'}</small></span>
            </button>
            {expandedId === item.id && <div className="ct-cargo-editor"><label className="ct-field"><span>Description</span><input value={item.name} maxLength={80} onChange={event => updateItem(item.id, { name: event.target.value })} /></label><div className="ct-fields three"><Numeric label="Length" unit="cm" value={item.lengthCm} min={1} onChange={lengthCm => updateItem(item.id, { lengthCm })} /><Numeric label="Width" unit="cm" value={item.widthCm} min={1} onChange={widthCm => updateItem(item.id, { widthCm })} /><Numeric label="Height" unit="cm" value={item.heightCm} min={1} onChange={heightCm => updateItem(item.id, { heightCm })} /></div><div className="ct-fields"><Numeric label="Quantity" value={item.quantity} min={1} onChange={quantity => updateItem(item.id, { quantity })} /><Numeric label="Per piece" unit="kg" value={item.weightKg} min={0.01} step={0.1} onChange={weightKg => updateItem(item.id, { weightKg })} /></div>
              <div className="ct-handling"><label><input type="checkbox" checked={item.fragile} onChange={event => updateItem(item.id, { fragile: event.target.checked })} />Fragile <small>Keep top clear</small></label><label><input type="checkbox" checked={item.keepUpright} onChange={event => updateItem(item.id, { keepUpright: event.target.checked })} />Keep upright</label><label><input type="checkbox" checked={item.stackable && !item.fragile} disabled={item.fragile} onChange={event => updateItem(item.id, { stackable: event.target.checked })} />Allow cargo above</label></div>
              <div className="ct-fields"><Numeric label="Top-load limit" unit="kg" value={item.fragile || !item.stackable ? 0 : item.maxTopLoadKg} disabled={item.fragile || !item.stackable} onChange={maxTopLoadKg => updateItem(item.id, { maxTopLoadKg })} /><label className="ct-field"><span>Priority</span><select value={item.priority} onChange={event => updateItem(item.id, { priority: event.target.value as CargoItem['priority'] })}><option value="normal">Normal</option><option value="high">High</option><option value="low">Low</option></select></label></div>
              <div className="ct-cargo-edit-footer"><label className="ct-color-picker" title="Cargo color"><input type="color" aria-label={`Color for ${item.name}`} value={item.color} onChange={event => updateItem(item.id, { color: event.target.value })} /><span>Color {String(index + 1).padStart(2, '0')}</span></label><button className="ct-icon-button" aria-label={`Duplicate ${item.name}`} onClick={() => { cancelOptimization(); const id = crypto.randomUUID(); setItems(current => [...current, { ...item, id, name: `${item.name} copy` }]); setExpandedId(id); setComparison(null); }}><Icon name="copy" size={16} /></button><button className="ct-icon-button danger" aria-label={`Remove ${item.name}`} onClick={() => { cancelOptimization(); setItems(current => current.filter(row => row.id !== item.id)); setComparison(null); }}><Icon name="trash" size={16} /></button></div>
            </div>}
          </article>)}</div>
          {!items.length && <p className="ct-empty">Start with a box, crate, or pallet. Add its dimensions and we will find it a place.</p>}
          <button className="ct-add-cargo" onClick={addItem}><Icon name="plus" size={16} /> Add cargo type</button><p className="ct-small-note">Dimensions are per piece. Up to {MAX_CARGO_PIECES} pieces per plan.</p>
        </div> : <div className="ct-space-panel"><div className="ct-panel-heading"><div><h2>Make room.</h2><p>Choose a starting shape, then make it yours.</p></div></div><div className="ct-modes">{MODES.map(mode => <button key={mode.id} className={space.mode === mode.id ? 'active' : ''} onClick={() => { const preset = SPACE_PRESETS.find(preset => preset.mode === mode.id); if (preset) choosePreset(preset.id); else changeSpace({ mode: mode.id, id: 'custom', name: 'Custom load space' }); }}><Icon name={mode.id} /><span>{mode.label}</span></button>)}</div><label className="ct-field"><span>Space template</span><select value={SPACE_PRESETS.some(preset => preset.id === space.id) ? space.id : ''} onChange={event => choosePreset(event.target.value)}><option value="" disabled>Custom space</option>{SPACE_PRESETS.filter(preset => preset.mode === space.mode).map(preset => <option key={preset.id} value={preset.id}>{preset.name}</option>)}</select></label><label className="ct-field"><span>Space name</span><input value={space.name} onChange={event => changeSpace({ name: event.target.value })} maxLength={70} /></label><div className="ct-space-diagram"><Icon name={space.mode} size={42} /><div><strong>{space.lengthCm} × {space.widthCm} × {space.heightCm}</strong><small>INTERNAL DIMENSIONS · CM</small></div></div><div className="ct-fields three"><Numeric label="Length" unit="cm" value={space.lengthCm} min={1} onChange={lengthCm => changeSpace({ lengthCm })} /><Numeric label="Width" unit="cm" value={space.widthCm} min={1} onChange={widthCm => changeSpace({ widthCm })} /><Numeric label="Height" unit="cm" value={space.heightCm} min={1} onChange={heightCm => changeSpace({ heightCm })} /></div><Numeric label="Maximum cargo payload" unit="kg" value={space.maxPayloadKg} min={1} onChange={maxPayloadKg => changeSpace({ maxPayloadKg })} /><div className="ct-fields"><Numeric label="Wall clearance" unit="cm" value={space.clearanceCm} onChange={clearanceCm => changeSpace({ clearanceCm })} /><Numeric label="Reserved rear" unit="cm" value={space.reservedDepthCm} onChange={reservedDepthCm => changeSpace({ reservedDepthCm })} /></div><div className="ct-info-note"><Icon name="layers" size={17} /><p>Clearance protects sides, ends and ceiling. The reserved rear slice stays empty and is removed from usable volume.</p></div></div>}
      </aside>

      <section className="ct-visual" aria-label="Load visualization">
        <div className="ct-visual-heading"><div><span className="ct-eyebrow">01 / LOAD CANVAS</span><h2><Icon name={plan.space.mode} size={22} />{plan.space.name}</h2></div><span className={`ct-status ${inputErrors.length ? 'error' : dirty ? 'changed' : ''}`}><i />{busy ? 'Planning…' : inputErrors.length ? 'Check inputs' : dirty ? 'Changes pending' : 'Plan ready'}</span></div>
        <div className="ct-scene-wrap"><StudioScene space={plan.space} pieces={scenePieces} selectedId={selectedId} visibleCount={visibleCount} view={view} showCenter={showCenter} centerOfGravity={stats.centerOfGravity} onSelect={inspectPiece} />
          <div className="ct-view-tools" role="group" aria-label="Camera view">{([{ id: 'perspective', label: '3D', icon: 'cube' }, { id: 'top', label: 'Top', icon: 'top' }, { id: 'side', label: 'Side', icon: 'side' }] as const).map(option => <button className={view === option.id ? 'active' : ''} key={option.id} onClick={() => setView(option.id)}><Icon name={option.icon} size={16} />{option.label}</button>)}</div>
          <button className={`ct-center-toggle ${showCenter ? 'active' : ''}`} onClick={() => setShowCenter(!showCenter)} aria-pressed={showCenter}><span>⊕</span> Weight centre</button>
          <div className="ct-scene-caption"><span className="ct-crosshair">+</span><span>{plan.space.lengthCm} × {plan.space.widthCm} × {plan.space.heightCm} cm <b>·</b> {number(plan.space.maxPayloadKg)} kg capacity</span></div>
          {selected && <div className="ct-piece-popover"><button className="ct-popover-close" onClick={() => setSelectedId(null)} aria-label="Close cargo details"><Icon name="close" size={15} /></button><span className="ct-eyebrow">PIECE {selected.sequence} / {plan.placements.length}</span><strong><i style={{ background: selected.color }} />{selected.name}</strong><div>{selected.widthCm} × {selected.lengthCm} × {selected.heightCm} cm · {number(selected.weightKg, 1)} kg</div><p>{selected.fragile ? 'Fragile · no cargo above' : `${number(selected.loadOnTopKg, 1)} / ${number(selected.maxTopLoadKg)} kg top load`}<br />{percent(selected.supportRatio)} base support{selected.rotated ? ' · rotated to fit' : ''}</p></div>}
          {!plan.placements.length && <div className="ct-empty-scene"><Icon name="box" size={38} /><strong>Your next load starts here.</strong><span>{plan.valid ? 'Add cargo, then build a packing plan.' : 'Correct the input errors to build your plan.'}</span></div>}
        </div>
        <div className="ct-sequence"><button className="ct-sequence-play" aria-label={playing ? 'Pause loading sequence' : 'Play loading sequence'} disabled={!plan.placements.length} onClick={() => { if (playing) setPlaying(false); else { if (step === null || step >= plan.placements.length) setStep(0); setPlaying(true); } }}><Icon name={playing ? 'pause' : 'play'} size={17} /></button><div className="ct-sequence-title"><strong>Load sequence</strong><small>{visibleCount === plan.placements.length ? 'Complete plan' : `Piece ${visibleCount} of ${plan.placements.length}`}</small></div><input type="range" aria-label="Loading sequence step" min={0} max={plan.placements.length} value={visibleCount} onChange={event => { setPlaying(false); setStep(Number(event.target.value)); }} /><span className="ct-sequence-count">{String(visibleCount).padStart(2, '0')}<small> / {plan.placements.length}</small></span></div>
        <div className="ct-strategy-bar"><div><span className="ct-eyebrow">PACKING APPROACH</span><div className="ct-strategy-options">{STRATEGIES.map(option => <button key={option.id} className={strategy === option.id ? 'active' : ''} title={option.description} onClick={() => { cancelOptimization(); setStrategy(option.id); }}>{option.name}</button>)}</div></div><button className="ct-pack-button" onClick={() => runPacking()} disabled={busy}><Icon name="bolt" size={19} />{busy ? 'Planning…' : 'Pack cargo'}<Icon name="arrow" size={19} /></button></div>
        {dirty && <div className="ct-stale"><Icon name="warning" size={16} />Inputs changed. Pack cargo to update this scene and its metrics.</div>}
      </section>

      <aside className="ct-results" aria-label={dirty ? 'Previous plan metrics, inputs changed' : 'Current plan metrics'}>{dirty && <div className="ct-results-stale">{busy ? 'Building your new plan…' : 'PREVIOUS PLAN · UPDATE PENDING'}</div>}<div className="ct-panel-heading"><div><span className="ct-eyebrow">02 / PLAN PULSE</span><h2>A clearer picture.</h2></div><Icon name="layers" size={21} /></div><div className="ct-utilization"><div className="ct-metric-heading"><span>Space used</span><span className="ct-metric-symbol">↗</span></div><strong>{percent(stats.volumeUtilization)}</strong><Meter value={stats.volumeUtilization} /><p>{number(stats.packedVolumeM3, 2)} of {number(stats.usableVolumeM3, 2)} m³ usable</p><small>Excludes clearance & reserved space</small></div><div className="ct-metric"><div><span>Payload</span><strong>{percent(stats.payloadUtilization)}</strong></div><Meter value={stats.payloadUtilization} className="orange" /><p>{number(stats.packedWeightKg, 1)} / {number(plan.space.maxPayloadKg)} kg</p></div><div className="ct-packed-count"><span><Icon name="box" size={20} />Pieces packed</span><strong>{stats.packedCount}<small> / {stats.requestedCount}</small></strong></div><div className="ct-mini-metrics"><div><span>Open volume</span><strong>{number(stats.emptyVolumeM3, 2)} <small>m³</small></strong></div><div><span>Payload left</span><strong>{number(Math.max(0, plan.space.maxPayloadKg - stats.packedWeightKg))} <small>kg</small></strong></div></div>
        <div className="ct-cog"><div><span>Centre of gravity</span><button onClick={() => setShowCenter(!showCenter)} aria-label="Show center of gravity">⊕</button></div>{stats.centerOfGravity ? <><div className="ct-cog-track"><i style={{ left: `${Math.max(0, Math.min(100, stats.centerOfGravity.z / plan.space.lengthCm * 100))}%` }} /><span /></div><p><span>Front</span><span>Rear</span></p><small>{number(stats.centerOfGravity.y, 1)} cm high · {number(stats.centerOfGravity.x, 1)} cm across · {number(stats.centerOfGravity.z, 1)} cm along</small></> : <small>Pack cargo to calculate.</small>}</div>
        <div className={`ct-outcome ${stats.unplacedCount || inputErrors.length ? 'attention' : ''}`}><Icon name={stats.unplacedCount || inputErrors.length ? 'warning' : 'check'} size={19} /><div><strong>{inputErrors.length ? 'Inputs need attention' : stats.unplacedCount ? `${stats.unplacedCount} pieces left out` : dirty ? 'Previous plan shown' : 'Everything has a place.'}</strong><p>{inputErrors.length ? 'Last valid plan shown. Review the messages below.' : stats.unplacedCount ? 'Inspect the reasons and adjust your load.' : dirty ? 'Pack your edited cargo to refresh these results.' : 'All requested cargo fits the checked packing constraints.'}</p></div></div>
        {inputErrors.map((error, index) => <div className="ct-issue" key={`e${index}`}>{error}</div>)}{plan.unplaced.map((item, index) => <div className="ct-unplaced" key={`${item.itemId}-${item.code}-${index}`}><strong>{item.count}× {item.name}</strong><p>{item.reason}</p></div>)}{plan.warnings.map((warning, index) => <div className="ct-issue warning" key={`w${index}`}>{warning}</div>)}
        <button className="ct-compare-button" disabled={busy} onClick={() => runPacking(true)}>Compare approaches <Icon name="arrow" size={16} /></button><p className="ct-small-note">Practical heuristic plans. A higher fill is not a guarantee of the best possible arrangement.</p>
      </aside>

      <section className="ct-insights"><div className="ct-insight-heading"><div><span className="ct-eyebrow">03 / CHECK THE DETAILS</span><h2>Good plans explain themselves.</h2></div><button className="ct-text-button" onClick={() => setDetailsOpen(!detailsOpen)} aria-expanded={detailsOpen}>{detailsOpen ? 'Hide' : 'Inspect'} load list <Icon name={detailsOpen ? 'close' : 'arrow'} size={16} /></button></div><div className="ct-rule-cards"><article><span className="ct-rule-index">01</span><div><strong>Real boundaries</strong><p>Every box stays inside the usable space, with reserved areas left clear.</p></div></article><article><span className="ct-rule-index">02</span><div><strong>Handle with care</strong><p>Upright, fragile, support and top-load rules shape every placement.</p></div></article><article><span className="ct-rule-index">03</span><div><strong>Weight has a place</strong><p>Payload and cargo centre of gravity update with the packing plan.</p></div></article></div>
        {comparison && <div className="ct-comparison"><h3>Same cargo. Three approaches.</h3><div className="ct-comparison-grid">{comparison.map(result => <article key={result.strategy} className={result.strategy === plan.strategy && !dirty ? 'current' : ''}><span className="ct-eyebrow">{STRATEGIES.find(strategy => strategy.id === result.strategy)?.name}</span><strong>{percent(result.stats.volumeUtilization)}<small>space used</small></strong><p>{result.stats.packedCount} pieces · {number(result.stats.packedWeightKg)} kg · {result.stats.unplacedCount} left out</p><button disabled={!result.valid || busy} onClick={() => applyPlan(result)}>Use this plan <Icon name="arrow" size={15} /></button></article>)}</div></div>}
        {detailsOpen && <div className="ct-load-list"><p>{plan.explanation}</p><div className="ct-table-scroll"><table><thead><tr><th>Load</th><th>Cargo</th><th>Position x / y / z (cm)</th><th>Size W / H / L (cm)</th><th>Mass</th><th>Support</th><th>Top load</th></tr></thead><tbody>{plan.placements.map(piece => <tr key={piece.id} className={piece.id === selectedId ? 'selected' : ''} onClick={() => inspectPiece(piece.id)}><td><button aria-label={`Inspect piece ${piece.sequence}`} onClick={() => inspectPiece(piece.id)}>{String(piece.sequence).padStart(2, '0')}</button></td><td><i style={{ background: piece.color }} />{piece.name}</td><td>{number(piece.x, 1)} / {number(piece.y, 1)} / {number(piece.z, 1)}</td><td>{piece.widthCm} / {piece.heightCm} / {piece.lengthCm}</td><td>{number(piece.weightKg, 1)} kg</td><td>{percent(piece.supportRatio)}</td><td>{number(piece.loadOnTopKg, 1)} kg</td></tr>)}</tbody></table></div>{!plan.placements.length && <p>No packed pieces yet.</p>}</div>}
      </section>
    </main>
    <footer className="ct-footer"><span><Icon name="box" size={15} /> CARGO TWIN <b>·</b> PLANNING, MADE TANGIBLE.</span><p>Prototype for exploration. Packing and sequence views do not certify transport safety or loading access.</p></footer>
    {notice && <div className="ct-toast" role="status"><Icon name="check" size={18} /><span>{notice}</span><button onClick={() => setNotice('')} aria-label="Dismiss notification"><Icon name="close" size={17} /></button></div>}
  </div>;
}
