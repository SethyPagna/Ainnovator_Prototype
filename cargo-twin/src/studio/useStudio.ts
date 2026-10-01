import { useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { CARGO_SCENARIOS, SPACE_PRESETS } from './presets';
import { MAX_CARGO_PIECES } from './model';
import type { CargoItem, CargoScenario, PackingPlan, SpaceConfig } from './model';
import type { StudioWorkerResponse } from './packing.worker';
import { CARGO_COLORS } from './StudioEditors';
import { parseDocument, serializeDocument, readProjects, saveProject, deleteProject, readDraftSession, autosaveDraftSession, AUTOSAVE_STORAGE_KEY } from './projects';
import type { StudioDocument, SavedProject } from './projects';
import { createHistory, commitHistory, travelHistory as moveHistory, bindProject } from './documentHistory';
import { planningFingerprint as fingerprint } from './planningFingerprint';
import { parseCargoCsv, exportCargoCsv, exportPlanCsv, createPlanReport } from './reports';
import { derivePlanInsights } from './insights';

export type StudioDialogName = 'projects' | 'scenarios' | 'export' | 'help' | 'report' | null;
export type DetailTab = 'insights' | 'load-list' | 'compare';
const errorMessage = (error: unknown) => error instanceof Error ? error.message : 'Something could not finish. Please try again.';

function sampleDocument(scenario = CARGO_SCENARIOS[0]): StudioDocument {
  return { name: scenario.name + ' / load plan', space: { ...(SPACE_PRESETS.find(space => space.id === scenario.spaceId) ?? SPACE_PRESETS[0]) }, items: scenario.items.map(item => ({ ...item })), strategy: 'max-fill' };
}

function initialDocument(): { document: StudioDocument; projectId?: string; recoveryError: string } {
  try { return { ...(readDraftSession(localStorage) ?? { document: sampleDocument() }), recoveryError: '' }; }
  catch (error) { return { document: sampleDocument(), recoveryError: errorMessage(error) }; }
}

function emptyPlan(document: StudioDocument): PackingPlan {
  const { space, items, strategy } = document;
  const usableVolumeM3 = Math.max(0, (space.widthCm - space.clearanceCm * 2) * (space.heightCm - space.clearanceCm) * (space.lengthCm - space.clearanceCm * 2 - space.reservedDepthCm) / 1e6);
  return { space, strategy, valid: true, placements: [], unplaced: [], errors: [], warnings: [], explanation: 'Build a plan to inspect placements.', stats: { requestedCount: items.reduce((sum, item) => sum + item.quantity, 0), packedCount: 0, unplacedCount: 0, requestedWeightKg: items.reduce((sum, item) => sum + item.quantity * item.weightKg, 0), packedWeightKg: 0, totalVolumeM3: space.widthCm * space.heightCm * space.lengthCm / 1e6, usableVolumeM3, packedVolumeM3: 0, emptyVolumeM3: usableVolumeM3, volumeUtilization: 0, payloadUtilization: 0, centerOfGravity: null } };
}

function download(contents: string, filename: string, type: string) {
  const url = URL.createObjectURL(new Blob([contents], { type }));
  const anchor = document.createElement('a');
  anchor.href = url; anchor.download = filename; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function useStudio() {
  const [startup] = useState(initialDocument);
  const [recoveryError, setRecoveryError] = useState(startup.recoveryError);
  const [history, setHistory] = useState(() => createHistory(startup.document, startup.projectId));
  const doc = history.present;
  const projectId = history.projectId;
  const setProjectId = (id: string | undefined) => setHistory(current => bindProject(current, id));
  const firstDocument = useRef(doc);
  const [plan, setPlan] = useState(() => emptyPlan(doc));
  const [builtFrom, setBuiltFrom] = useState('');
  const [busy, setBusy] = useState(false);
  const [inputErrors, setInputErrors] = useState<string[]>([]);
  const [notice, setNotice] = useState('');
  const [autosaveStatus, setAutosaveStatus] = useState('Saving on this device…');
  const [projects, setProjects] = useState<SavedProject[]>([]);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [dialog, setDialog] = useState<StudioDialogName>(null);
  const [activeTab, setActiveTab] = useState<'cargo' | 'space'>('space');
  const [detailTab, setDetailTab] = useState<DetailTab>('insights');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editorSession, setEditorSession] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [view, setView] = useState<'perspective' | 'top' | 'side' | 'map'>('perspective');
  const [showCenter, setShowCenter] = useState(false);
  const [showShell, setShowShell] = useState(true);
  const [showLabels, setShowLabels] = useState(true);
  const [exploded, setExploded] = useState(false);
  const [colorMode, setColorMode] = useState<'cargo' | 'weight' | 'handling'>('cargo');
  const [resetKey, setResetKey] = useState(0);
  const [step, setStep] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const [playSpeed, setPlaySpeed] = useState(1);
  const [comparison, setComparison] = useState<PackingPlan[] | null>(null);
  const [listQuery, setListQuery] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);
  const csvInput = useRef<HTMLInputElement>(null);
  const workerRef = useRef<Worker | null>(null);
  const workerTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestId = useRef(0);
  const importRequestId = useRef(0);
  const documentRevision = useRef(0);
  const dirty = fingerprint(doc) !== builtFrom;
  const insights = useMemo(() => derivePlanInsights(plan), [plan]);
  const visibleCount = step ?? plan.placements.length;
  const selected = plan.placements.find(piece => piece.id === selectedId && piece.sequence <= visibleCount);
  const [reportHtml, setReportHtml] = useState('');
  const listPieces = plan.placements.filter(piece => piece.name.toLowerCase().includes(listQuery.toLowerCase()));

  useEffect(() => {
    document.body.classList.add('cargo-studio-body'); requestOptimization(firstDocument.current);
    return () => { document.body.classList.remove('cargo-studio-body'); requestId.current++; workerRef.current?.terminate(); if (workerTimer.current) clearTimeout(workerTimer.current); };
  }, []);
  useEffect(() => {
    if (recoveryError) { setAutosaveStatus('Autosave paused · recovery data preserved'); return; }
    setAutosaveStatus('Saving on this device…');
    const saveDraft = () => {
      try { autosaveDraftSession(localStorage, doc, projectId); setAutosaveStatus('Draft saved on this device'); }
      catch { setAutosaveStatus('Draft not saved · check inputs or export a copy'); }
    };
    const timer = setTimeout(saveDraft, 650);
    window.addEventListener('pagehide', saveDraft);
    window.addEventListener('beforeunload', saveDraft);
    return () => { clearTimeout(timer); window.removeEventListener('pagehide', saveDraft); window.removeEventListener('beforeunload', saveDraft); };
  }, [doc, projectId, recoveryError]);
  useEffect(() => { if (!notice) return; const timer = setTimeout(() => setNotice(''), 7000); return () => clearTimeout(timer); }, [notice]);
  useEffect(() => { if (selectedId && !plan.placements.some(piece => piece.id === selectedId && piece.sequence <= visibleCount)) setSelectedId(null); }, [selectedId, visibleCount, plan]);
  useEffect(() => {
    if (!playing) return;
    const timer = setInterval(() => setStep(current => { const next = (current ?? 0) + 1; if (next >= plan.placements.length) { setPlaying(false); return null; } return next; }), 600 / playSpeed);
    return () => clearInterval(timer);
  }, [playing, plan.placements.length, playSpeed]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') { event.preventDefault(); saveCurrent(); return; }
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName) || target.isContentEditable || dialog) return;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') { event.preventDefault(); travelHistory(event.shiftKey ? 'redo' : 'undo'); }
      if (event.key === '?') setDialog('help');
      if (event.key.toLowerCase() === 'r' && !event.ctrlKey && !event.metaKey) setResetKey(value => value + 1);
    };
    window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey);
  });

  function cancelOptimization() {
    requestId.current++; workerRef.current?.terminate(); workerRef.current = null;
    if (workerTimer.current) clearTimeout(workerTimer.current);
    workerTimer.current = null; setBusy(false);
  }
  function editDocument(updater: (current: StudioDocument) => StudioDocument) {
    documentRevision.current++;
    cancelOptimization(); setComparison(null); setPlaying(false); setInputErrors([]);
    setHistory(current => commitHistory(current, { document: updater(current.present) }));
  }
  function travelHistory(direction: 'undo' | 'redo') {
    documentRevision.current++;
    cancelOptimization(); setComparison(null); setInputErrors([]); setPlaying(false);
    setEditorSession(value => value + 1); setListQuery('');
    setHistory(current => moveHistory(current, direction));
  }
  function applyPlan(next: PackingPlan, source = doc) {
    setPlan(next); setBuiltFrom(fingerprint({ ...source, strategy: next.strategy }));
    if (doc.strategy !== next.strategy) documentRevision.current++;
    setHistory(current => commitHistory(current, { document: { ...current.present, strategy: next.strategy } }));
    setSelectedId(null); setStep(null); setPlaying(false); setInputErrors([]);
  }
  function requestOptimization(source = doc, compare = false) {
    cancelOptimization(); setBusy(true); setPlaying(false); setInputErrors([]);
    const id = ++requestId.current;
    try {
      const worker = new Worker(new URL('./packing.worker.ts', import.meta.url), { type: 'module' }); workerRef.current = worker;
      const finish = () => { worker.terminate(); workerRef.current = null; if (workerTimer.current) clearTimeout(workerTimer.current); workerTimer.current = null; setBusy(false); };
      worker.onmessage = ({ data }: MessageEvent<StudioWorkerResponse>) => {
        if (data.id !== requestId.current) return; finish();
        if (data.type === 'error') { setInputErrors([data.message]); return; }
        if (!data.plan.valid) { setInputErrors(data.plan.errors); setComparison(null); return; }
        if (compare) { setComparison(data.plans ?? [data.plan]); setDetailTab('compare'); setNotice('Three approaches are ready to compare below the canvas.'); }
        else { applyPlan(data.plan, source); setComparison(null); }
      };
      worker.onerror = () => { if (id !== requestId.current) return; finish(); setInputErrors(['The packing worker stopped. Try again or reduce the manifest size.']); };
      workerTimer.current = setTimeout(() => { if (id !== requestId.current) return; finish(); setInputErrors(['Planning took too long. Reduce cargo complexity and try again.']); }, 90_000);
      worker.postMessage({ id, space: source.space, items: source.items, strategy: source.strategy, compare });
    } catch { cancelOptimization(); setInputErrors(['The packing worker could not start. Reload the page and try again.']); }
  }
  function loadDocument(next: StudioDocument, id?: string) {
    documentRevision.current++; cancelOptimization(); setComparison(null); setPlaying(false); setInputErrors([]);
    setEditorSession(value => value + 1); setListQuery('');
    setHistory(current => commitHistory(current, { document: next, projectId: id }));
    setExpandedId(null); setSelectedId(null); setDialog(null); requestOptimization(next);
  }
  function loadScenario(scenario: CargoScenario) { loadDocument(sampleDocument(scenario)); setNotice(scenario.name + ' loaded. Customize every cargo type and dimension.'); }
  function newProject() { loadDocument({ ...sampleDocument(), name: 'Untitled load plan', items: [] }); setActiveTab('space'); setNotice('New project ready. Undo can restore the previous project.'); }
  function updateItem(id: string, patch: Partial<CargoItem>) { editDocument(current => ({ ...current, items: current.items.map(item => item.id === id ? { ...item, ...patch } : item) })); }
  function addItem() {
    if (doc.items.length >= MAX_CARGO_PIECES) return;
    const id = crypto.randomUUID();
    editDocument(current => ({ ...current, items: [...current.items, { id, name: 'Cargo ' + (current.items.length + 1), lengthCm: 60, widthCm: 40, heightCm: 40, weightKg: 15, quantity: 1, fragile: false, keepUpright: true, stackable: true, maxTopLoadKg: 80, priority: 'normal', color: CARGO_COLORS[current.items.length % CARGO_COLORS.length] }] })); setExpandedId(id);
  }
  function duplicateItem(id: string) {
    if (doc.items.length >= MAX_CARGO_PIECES) { setNotice('The manifest has reached its cargo-type limit.'); return; }
    const nextId = crypto.randomUUID();
    editDocument(current => ({ ...current, items: [...current.items, ...current.items.filter(item => item.id === id).map(item => ({ ...item, id: nextId, name: item.name.slice(0, 74) + ' copy' }))] })); setExpandedId(nextId);
  }
  function removeItem(id: string) { editDocument(current => ({ ...current, items: current.items.filter(item => item.id !== id) })); }
  function changeSpace(patch: Partial<SpaceConfig>) { editDocument(current => ({ ...current, space: { ...current.space, ...patch } })); }
  function choosePreset(id: string) { const next = SPACE_PRESETS.find(preset => preset.id === id); if (next) editDocument(current => ({ ...current, space: { ...next } })); }
  function inspectPiece(id: string) { const piece = plan.placements.find(candidate => candidate.id === id); if (!piece) return; setPlaying(false); if (piece.sequence > visibleCount) setStep(piece.sequence); setSelectedId(id); }
  function togglePlayback() { if (playing) setPlaying(false); else { if (step === null || step >= plan.placements.length) setStep(0); setPlaying(true); } }
  function seek(value: number) { setPlaying(false); setStep(value); }
  function saveCurrent(asCopy = false) {
    try { const next = saveProject(localStorage, asCopy ? undefined : projectId, doc); setProjects(next); setProjectId(next[0].id); if (!recoveryError) autosaveDraftSession(localStorage, doc, next[0].id); setNotice('“' + next[0].name + '” saved in your project library.'); }
    catch (error) { setNotice(errorMessage(error)); }
  }
  function openProjects() { try { setProjects(readProjects(localStorage)); setDeleteId(null); setDialog('projects'); } catch (error) { setNotice(errorMessage(error)); } }
  function removeProject(id: string) {
    if (deleteId !== id) { setDeleteId(id); return; }
    try { setProjects(deleteProject(localStorage, id)); if (projectId === id) setProjectId(undefined); setDeleteId(null); setNotice('Project removed from the library. The open draft remains available.'); } catch (error) { setNotice(errorMessage(error)); }
  }
  async function importFile(event: ChangeEvent<HTMLInputElement>, kind: 'json' | 'csv') {
    const file = event.target.files?.[0]; event.target.value = ''; if (!file) return;
    const importId = ++importRequestId.current;
    const revision = documentRevision.current;
    try {
      if (file.size > 1_000_000) throw new Error('Choose a file smaller than 1 MB.'); const contents = await file.text();
      if (importId !== importRequestId.current) return;
      if (revision !== documentRevision.current) { setNotice('Your draft changed while reading the file. Choose the import again.'); return; }
      if (kind === 'json') { loadDocument(parseDocument(JSON.parse(contents))); setNotice('Project imported. Building its plan…'); }
      else {
        const cargo = parseCargoCsv(contents); const next = { ...doc, items: cargo };
        editDocument(() => next); setEditorSession(value => value + 1); setListQuery('');
        setExpandedId(null); requestOptimization(next);
        setNotice('Imported ' + cargo.length + ' cargo types. Undo restores the previous manifest.');
      }
    } catch (error) { setNotice(errorMessage(error)); }
  }
  function exportFile(kind: 'json' | 'cargo' | 'plan' | 'html') {
    try {
      const filename = doc.name.replace(/[^a-z0-9-]+/gi, '-').replace(/^-|-$/g, '').slice(0, 64) || 'cargo-twin';
      if (kind === 'json') download(serializeDocument(doc), filename + '.json', 'application/json');
      if (kind === 'cargo') download(exportCargoCsv(doc.items), filename + '-manifest.csv', 'text/csv');
      if ((kind === 'plan' || kind === 'html') && dirty) throw new Error('Pack your edited cargo before exporting a load plan.');
      if (kind === 'plan') download(exportPlanCsv(plan), filename + '-placements.csv', 'text/csv');
      if (kind === 'html') download(createPlanReport(doc, plan), filename + '-load-sheet.html', 'text/html');
      setNotice('Your export is ready.');
    } catch (error) { setNotice(errorMessage(error)); }
  }
  function openReport() {
    if (dirty) { setNotice('Pack cargo to create a report for your current inputs.'); return; }
    try { setReportHtml(createPlanReport(doc, plan)); setDialog('report'); }
    catch (error) { setNotice(errorMessage(error)); }
  }
  function downloadRecovery() {
    try { const raw = localStorage.getItem(AUTOSAVE_STORAGE_KEY); if (raw === null) throw new Error('There is no stored recovery draft.'); download(raw, 'cargo-twin-recovery.txt', 'text/plain'); }
    catch (error) { setNotice(errorMessage(error)); }
  }
  function resumeAutosave() {
    try {
      const raw = localStorage.getItem(AUTOSAVE_STORAGE_KEY);
      if (raw !== null) localStorage.setItem(AUTOSAVE_STORAGE_KEY + '-recovery-' + Date.now(), raw);
      autosaveDraftSession(localStorage, doc, projectId); setRecoveryError(''); setNotice('Original recovery data preserved. Autosave has resumed for this draft.');
    } catch (error) { setNotice(errorMessage(error)); }
  }
  function printReport() {
    const popup = window.open('', '_blank'); if (!popup) { setNotice('Allow the print window, or download the HTML load sheet.'); return; }
    popup.document.open(); popup.document.write(reportHtml); popup.addEventListener('load', () => popup.print(), { once: true }); popup.document.close();
  }
  return { doc, history, plan, stats: plan.stats, busy, dirty, insights, inputErrors, notice, setNotice, autosaveStatus, projects, projectId, deleteId, setDeleteId, dialog, setDialog, activeTab, setActiveTab, detailTab, setDetailTab, editorSession, expandedId, setExpandedId, selectedId, setSelectedId, selected, view, setView, showCenter, setShowCenter, showShell, setShowShell, showLabels, setShowLabels, exploded, setExploded, colorMode, setColorMode, resetKey, setResetKey, visibleCount, playing, playSpeed, setPlaySpeed, comparison, listQuery, setListQuery, listPieces, reportHtml, fileInput, csvInput, cancelOptimization, editDocument, travelHistory, applyPlan, requestOptimization, loadDocument, loadScenario, newProject, updateItem, addItem, duplicateItem, removeItem, changeSpace, choosePreset, inspectPiece, togglePlayback, seek, saveCurrent, openProjects, removeProject, importFile, exportFile, openReport, printReport, recoveryError, downloadRecovery, resumeAutosave };
}

export type StudioController = ReturnType<typeof useStudio>;

