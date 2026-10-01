import { useEffect, useRef, useState } from 'react';
import { STRATEGIES } from './model';
import { validateSpace } from './packing';
import { StudioScene } from './StudioScene';
import { PlanMap } from './PlanMap';
import { cargoHasInputErrors, CargoEditor, SpaceEditor } from './StudioEditors';
import { PlanOverview, PlanDetails, ProjectDialogs } from './StudioPanels';
import { StudioTabs } from './StudioTabs';
import { Icon, formatNumber as number, formatPercent as percent } from './StudioIcons';
import type { StudioController } from './useStudio';

type WorkflowStep = 'space' | 'cargo' | 'review';
const INPUT_TABS = [
  { id: 'space', label: 'Load space', icon: 'custom', tabId: 'ct-tab-space', panelId: 'ct-panel-space' },
  { id: 'cargo', label: 'Cargo', icon: 'box', tabId: 'ct-tab-cargo', panelId: 'ct-panel-cargo' },
] as const;
const VIEWS = [
  { id: 'perspective', label: '3D', icon: 'cube' }, { id: 'top', label: 'Top', icon: 'top' },
  { id: 'side', label: 'Side', icon: 'side' }, { id: 'map', label: 'Map', icon: 'layers' },
] as const;
const STRATEGY_HINTS = { 'max-fill': 'Fit more cargo', balanced: 'Spread cargo weight', gentle: 'Favor lower stacks' };

function reveal(id: string, focus = true) {
  const element = document.getElementById(id);
  if (!element) return;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  element.scrollIntoView({ behavior: reduced ? 'instant' : 'smooth', block: 'start' });
  if (focus) element.focus({ preventScroll: true });
}

function ProjectHeader({ studio: s, onOpenAircraft }: { studio: StudioController; onOpenAircraft?: () => void }) {
  return <>
    <header className="ct-header">
      <a className="ct-brand" href="?workspace=studio" aria-label="Cargo Twin studio"><span className="ct-brandmark"><Icon name="cube" size={25} /></span><strong>Cargo<span>Twin</span><small>THE LOAD PLANNING STUDIO</small></strong></a>
      <div className="ct-header-context"><span>Workspace</span><b>/</b><strong>Load studio</strong><em>LOCAL</em></div>
      <nav className="ct-header-actions" aria-label="Project tools">
        <button aria-label="Projects" onClick={s.openProjects}><Icon name="folder" /><span>Projects</span></button>
        <button aria-label="Import project JSON" onClick={() => s.fileInput.current?.click()}><Icon name="upload" /><span>Import</span></button>
        <button aria-label="Export files" onClick={() => s.setDialog('export')}><Icon name="download" /><span>Export</span></button>
        <button className="ct-primary small" aria-label="Save project" onClick={() => s.saveCurrent()}><Icon name="save" /><span>Save<span className="ct-save-long"> project</span></span></button>
      </nav>
    </header>
    <nav className="ct-rail" aria-label="Studio navigation">
      <button className="active" aria-label="Load studio" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}><Icon name="cube" size={23} /><span>Studio</span></button>
      <button aria-label="Scenario gallery" onClick={() => s.setDialog('scenarios')}><Icon name="spark" size={23} /><span>Samples</span></button>
      <button aria-label="Saved projects" onClick={s.openProjects}><Icon name="folder" size={23} /><span>Projects</span></button>
      <button aria-label="Load sheet" onClick={s.openReport}><Icon name="print" size={23} /><span>Report</span></button>
      <div className="ct-rail-bottom"><button aria-label="Aircraft planner" onClick={onOpenAircraft ?? (() => window.location.assign('?workspace=aircraft'))}><Icon name="air" size={23} /><span>Aircraft</span></button><button aria-label="Help and shortcuts" onClick={() => s.setDialog('help')}><Icon name="help" size={23} /><span>Guide</span></button></div>
    </nav>
  </>;
}

function DisplaySettings({ studio: s }: { studio: StudioController }) {
  const settings = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const closeOutside = (event: PointerEvent) => {
      if (settings.current && !settings.current.contains(event.target as Node)) settings.current.open = false;
    };
    const closeEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && settings.current?.open) {
        settings.current.open = false;
        settings.current.querySelector('summary')?.focus();
      }
    };
    document.addEventListener('pointerdown', closeOutside);
    document.addEventListener('keydown', closeEscape);
    return () => { document.removeEventListener('pointerdown', closeOutside); document.removeEventListener('keydown', closeEscape); };
  }, []);
  return <details className="ct-display-settings" ref={settings}>
    <summary><Icon name="eye" size={17} />Display settings</summary>
    <div className="ct-settings-content">
      <label><input type="checkbox" checked={s.showShell} onChange={event => s.setShowShell(event.target.checked)} />Show transport walls</label>
      <label><input type="checkbox" checked={s.showLabels} onChange={event => s.setShowLabels(event.target.checked)} />Show cargo labels</label>
      <label><input type="checkbox" checked={s.exploded} onChange={event => s.setExploded(event.target.checked)} />Separate cargo for inspection</label>
      <p>This display effect leaves planned positions unchanged.</p>
      <label><input type="checkbox" checked={s.showCenter} onChange={event => s.setShowCenter(event.target.checked)} />Show weight center</label>
      <p>Cargo only. Hidden while replaying or separating cargo.</p>
      <label className="ct-settings-color">Color cargo by<select aria-label="Color cargo by" value={s.colorMode} onChange={event => s.setColorMode(event.target.value as typeof s.colorMode)}><option value="cargo">Cargo type</option><option value="weight">Weight</option><option value="handling">Handling</option></select></label>
    </div>
  </details>;
}

function SceneToolbar({ studio: s }: { studio: StudioController }) {
  return <div className="ct-scene-toolbar">
    <div className="ct-view-tools" role="group" aria-label="Camera view">{VIEWS.map(option => <button className={s.view === option.id ? 'active' : ''} aria-pressed={s.view === option.id} key={option.id} onClick={() => s.setView(option.id)}><Icon name={option.icon} size={17} />{option.label}</button>)}</div>
    {s.view !== 'map' && <div className="ct-scene-actions"><button className="ct-reset-view" aria-label="Reset camera" onClick={() => s.setResetKey(value => value + 1)}><Icon name="reset" size={17} />Reset view</button><DisplaySettings studio={s} /></div>}
    {s.view === 'map' && <p className="ct-map-tip">Select a box or use Tab + Enter to inspect it.</p>}
  </div>;
}

function PieceDetails({ studio: s, onEdit }: { studio: StudioController; onEdit: (id: string) => void }) {
  const piece = s.selected;
  if (!piece) return null;
  const editable = s.doc.items.some(item => item.id === piece.itemId);
  return <section className="ct-piece-details" id="ct-piece-details" tabIndex={-1} aria-label="Selected cargo details">
    <div className="ct-piece-detail-title"><div><span className="ct-eyebrow">PIECE {piece.sequence} / {s.plan.placements.length}</span><h3><i style={{ background: piece.color }} />{piece.name}</h3></div><button onClick={() => s.setSelectedId(null)} aria-label="Close cargo details"><Icon name="close" size={18} /></button></div>
    <dl><div><dt>Size · W × H × L</dt><dd>{piece.widthCm} × {piece.heightCm} × {piece.lengthCm} cm</dd></div><div><dt>Weight per piece</dt><dd>{number(piece.weightKg, 1)} kg</dd></div><div><dt>Weight supported on top</dt><dd>{piece.fragile ? 'Fragile · keep top clear' : `${number(piece.loadOnTopKg, 1)} / ${number(piece.maxTopLoadKg)} kg`}</dd></div><div><dt>Base support</dt><dd>{percent(piece.supportRatio)}{piece.rotated ? ' · rotated to fit' : ''}</dd></div></dl>
    {editable ? <button className="ct-secondary" onClick={() => onEdit(piece.itemId)}><Icon name="box" size={16} />Edit this cargo type</button> : <p>This cargo was removed from your inputs. Update the plan to refresh it.</p>}
    {editable && <small>Edits apply to every piece of this cargo type.</small>}
  </section>;
}

function LoadingSequence({ studio: s }: { studio: StudioController }) {
  return <div className="ct-sequence">
    <button className="ct-sequence-play" aria-label={s.playing ? 'Pause loading sequence' : 'Play loading sequence'} disabled={!s.plan.placements.length || s.busy} onClick={s.togglePlayback}><Icon name={s.playing ? 'pause' : 'play'} size={16} />{s.playing ? 'Pause' : 'Play'}</button>
    <div className="ct-sequence-title"><strong>Loading order</strong><small>Suggested placement sequence</small></div>
    <input type="range" aria-label="Loading sequence step" min={0} max={s.plan.placements.length} value={s.visibleCount} onChange={event => s.seek(Number(event.target.value))} />
    <span className="ct-sequence-count">{s.visibleCount}<small> / {s.plan.placements.length} shown</small></span>
    <select aria-label="Playback speed" value={s.playSpeed} onChange={event => s.setPlaySpeed(Number(event.target.value))}><option value={0.5}>0.5×</option><option value={1}>1×</option><option value={2}>2×</option></select>
  </div>;
}

export function StudioWorkspace({ studio: s, onOpenAircraft }: { studio: StudioController; onOpenAircraft?: () => void }) {
  const { doc, plan, stats } = s;
  const [step, setStep] = useState<WorkflowStep>('space');
  const pendingReview = useRef(false);
  const previousComparison = useRef(s.comparison);
  const buildLabel = s.busy ? 'Building plan…' : s.dirty && plan.placements.length ? 'Update plan' : 'Build 3D plan';

  function navigate(next: WorkflowStep) {
    setStep(next);
    if (next !== 'review') s.setActiveTab(next);
    requestAnimationFrame(() => reveal(next === 'review' ? 'ct-visual' : 'ct-inputs'));
  }
  function buildPlan() {
    pendingReview.current = false;
    if (validateSpace(doc.space).length || doc.items.some(cargoHasInputErrors)) {
      revealInputErrors();
      s.requestOptimization();
      return;
    }
    pendingReview.current = true; s.requestOptimization();
  }
  function revealInputErrors() {
    const target = validateSpace(doc.space).length ? 'space' : 'cargo';
    const invalidItem = doc.items.find(cargoHasInputErrors);
    s.setActiveTab(target); setStep(target);
    if (target === 'cargo' && invalidItem) s.setExpandedId(invalidItem.id);
    requestAnimationFrame(() => {
      reveal('ct-inputs', false);
      const invalid = document.querySelector<HTMLElement>('#ct-inputs [aria-invalid="true"]');
      if (invalid) { invalid.scrollIntoView({ block: 'center' }); invalid.focus({ preventScroll: true }); }
      else document.getElementById('ct-inputs')?.focus({ preventScroll: true });
    });
  }
  function cancelPlan() { pendingReview.current = false; s.cancelOptimization(); }
  function editSelected(id: string) {
    s.setExpandedId(id); s.setActiveTab('cargo'); setStep('cargo');
    requestAnimationFrame(() => {
      const input = document.querySelector<HTMLInputElement>('#ct-inputs [data-expanded-editor="true"] input[aria-label="Description"]');
      if (input) { input.scrollIntoView({ block: 'center' }); input.focus({ preventScroll: true }); }
      else reveal('ct-inputs');
    });
  }
  function newProject() { pendingReview.current = false; s.newProject(); navigate('space'); }

  useEffect(() => {
    if (!pendingReview.current || s.busy) return;
    pendingReview.current = false;
    if (s.inputErrors.length) {
      revealInputErrors();
    } else if (!s.dirty) { setStep('review'); reveal('ct-visual'); }
  }, [s.busy, s.dirty, s.inputErrors]);
  useEffect(() => {
    if (s.comparison && previousComparison.current !== s.comparison) reveal('ct-plan-details');
    previousComparison.current = s.comparison;
  }, [s.comparison]);
  // Panels guide the user back to the scene. Map selection retains its keyboard focus.
  const panelStudio: StudioController = {
    ...s,
    inspectPiece: id => { s.inspectPiece(id); requestAnimationFrame(() => reveal('ct-piece-details')); },
    requestOptimization: (source = doc, compare = false) => {
      if (!compare && s.dialog === 'export') s.setDialog(null);
      pendingReview.current = !compare;
      if (validateSpace(source.space).length || source.items.some(cargoHasInputErrors)) revealInputErrors();
      s.requestOptimization(source, compare);
    },
  };

  return <div className="ct-app ct-intuitive">
    <ProjectHeader studio={s} onOpenAircraft={onOpenAircraft} />
    <main className="ct-main">
      {s.recoveryError && <div className="ct-recovery" role="alert"><Icon name="warning" size={20} /><div><strong>Your stored draft needs recovery.</strong><p>{s.recoveryError} Its original data is preserved; autosave is paused.</p></div><button className="ct-secondary" onClick={s.downloadRecovery}>Download original data</button><button className="ct-secondary" onClick={s.resumeAutosave}>Use current draft</button></div>}
      <div className="ct-intro"><div><span className="ct-eyebrow"><i /> YOUR CARGO, CLEARLY PLANNED</span><h1>Plan your load<span>.</span></h1><p>Choose a space, add your cargo, then review the 3D plan.</p><p className="ct-start-hint">Edit the load below, choose New project for a blank load, or try a sample.</p></div><button className="ct-sample-button" aria-label="Start with a sample" onClick={() => s.setDialog('scenarios')}><Icon name="spark" size={19} /><span>Try a sample<small>Three editable starting points</small></span><Icon name="arrow" /></button></div>
      <nav className="ct-workflow" aria-label="Planning steps">{([{ id: 'space', label: 'Choose space', description: 'Transport and dimensions' }, { id: 'cargo', label: 'Add cargo', description: 'Pieces and handling' }, { id: 'review', label: 'Review plan', description: 'Inspect, compare and save' }] as const).map((option, index) => <button key={option.id} className={step === option.id ? 'active' : ''} aria-current={step === option.id ? 'step' : undefined} onClick={() => navigate(option.id)}><span className="ct-step-number">{index + 1}</span><span><strong>{option.label}</strong><small>{option.description}</small></span>{index < 2 && <Icon name="arrow" size={16} />}</button>)}</nav>
      <div className="ct-project-bar"><div className="ct-project-title"><label htmlFor="ct-project-name">Project name</label><input id="ct-project-name" aria-label="Project name" maxLength={80} value={doc.name} onChange={event => s.editDocument(current => ({ ...current, name: event.target.value }))} /><span className="ct-autosave" role="status"><i />{s.autosaveStatus}</span></div><div className="ct-history"><button disabled={!s.history.past.length} aria-label="Undo edit" title="Undo (Ctrl+Z)" onClick={() => s.travelHistory('undo')}><Icon name="undo" size={16} />Undo</button><button disabled={!s.history.future.length} aria-label="Redo edit" title="Redo (Ctrl+Shift+Z)" onClick={() => s.travelHistory('redo')}><Icon name="redo" size={16} />Redo</button><button className="ct-text-button" onClick={newProject}><Icon name="plus" size={16} />New project</button></div></div>
      <p className="ct-draft-help">Your draft saves automatically in this browser. <strong>Save project</strong> adds it to your project library. Export JSON to take a copy with you.</p>
      <div className="ct-workspace">
        <aside className="ct-inputs" id="ct-inputs" tabIndex={-1} aria-label="Plan setup">
          <div className="ct-input-tabs"><StudioTabs label="Plan inputs" options={INPUT_TABS} value={s.activeTab} onChange={next => { s.setActiveTab(next); setStep(next); }} /></div>
          <div id="ct-panel-space" role="tabpanel" aria-labelledby="ct-tab-space" hidden={s.activeTab !== 'space'}>{s.activeTab === 'space' && <SpaceEditor space={doc.space} onChange={s.changeSpace} onPreset={s.choosePreset} />}</div>
          <div id="ct-panel-cargo" role="tabpanel" aria-labelledby="ct-tab-cargo" hidden={s.activeTab !== 'cargo'}>{s.activeTab === 'cargo' && <CargoEditor key={s.editorSession} items={doc.items} expandedId={s.expandedId} onExpand={s.setExpandedId} onUpdate={s.updateItem} onAdd={s.addItem} onDuplicate={s.duplicateItem} onRemove={s.removeItem} onImport={() => s.csvInput.current?.click()} />}</div>
          {s.inputErrors.length > 0 && <div className="ct-setup-error" role="alert"><strong>The plan could not be updated.</strong>{s.inputErrors.map(error => <p key={error}>{error}</p>)}</div>}
          <div className="ct-input-next">{s.activeTab === 'space' ? <button className="ct-primary" onClick={() => navigate('cargo')}>Next: add cargo<Icon name="arrow" size={17} /></button> : <button className="ct-primary" disabled={s.busy} onClick={buildPlan}><Icon name="bolt" size={17} />{buildLabel}<Icon name="arrow" size={17} /></button>}</div>
        </aside>
        <section className="ct-visual" id="ct-visual" tabIndex={-1} aria-label="Load visualization">
          <div className="ct-visual-heading"><div><span className="ct-eyebrow">YOUR 3D LOAD PLAN</span><h2><Icon name={plan.space.mode} size={19} />{plan.space.name}</h2></div><span className={'ct-status ' + (s.inputErrors.length ? 'error' : s.dirty ? 'changed' : '')}><i />{s.busy ? 'Calculating' : s.inputErrors.length ? 'Check inputs' : s.dirty ? 'Update pending' : 'Plan ready'}</span></div>
          {s.dirty && <div className="ct-stale"><Icon name="warning" size={17} /><span>{s.busy ? 'Building your updated plan. The previous plan stays visible until it finishes.' : 'Inputs changed. Update the plan to see your latest cargo and dimensions.'}</span>{!s.busy && <button onClick={buildPlan}>Update plan<Icon name="arrow" size={16} /></button>}</div>}
          <SceneToolbar studio={s} />
          <div className="ct-scene-wrap">
            {s.view === 'map' ? <PlanMap plan={plan} selectedId={s.selectedId} onSelect={s.inspectPiece} visibleCount={s.visibleCount} /> : <StudioScene space={plan.space} pieces={plan.placements} selectedId={s.selectedId} visibleCount={s.visibleCount} view={s.view} showCenter={s.showCenter} centerOfGravity={stats.centerOfGravity} onSelect={s.inspectPiece} showShell={s.showShell} showLabels={s.showLabels} colorMode={s.colorMode} exploded={s.exploded} resetKey={s.resetKey} />}
            {s.view !== 'map' && s.colorMode === 'weight' && <div className="ct-scene-legend"><span>Weight per piece · relative to heaviest packed</span><div><small>Light</small><i className="weight-ramp" /><small>{number(Math.max(1, ...plan.placements.map(piece => piece.weightKg)), 1)} kg</small></div></div>}
            {s.view !== 'map' && s.colorMode === 'handling' && <div className="ct-scene-legend handling"><span><i style={{ background: '#ffae7d' }} />Fragile</span><span><i style={{ background: '#9b8aff' }} />Upright</span><span><i style={{ background: '#72d9c0' }} />Standard</span></div>}
            {!plan.placements.length && !s.busy && <div className="ct-empty-scene"><Icon name="box" size={38} /><strong>Your cargo plan will appear here.</strong><span>Add cargo, then choose Build 3D plan.</span></div>}
            {s.busy && <div className="ct-planning"><span className="ct-spinner" /><strong>Finding room for your cargo…</strong><button onClick={cancelPlan}>Cancel</button></div>}
          </div>
          <div className="ct-scene-caption"><span><strong>{plan.space.lengthCm} × {plan.space.widthCm} × {plan.space.heightCm} cm</strong><small>Internal space · L × W × H</small></span><span>{s.view === 'map' ? 'Top-down view · select a box to inspect' : s.exploded ? 'Cargo separated for inspection' : 'Drag to rotate · scroll or pinch to zoom · select a box'}</span>{s.selected && <button className="ct-selected-link" onClick={() => reveal('ct-piece-details')}>View selected cargo details<Icon name="arrow" size={16} /></button>}</div>
          <PieceDetails studio={s} onEdit={editSelected} />
          <LoadingSequence studio={s} />
          <div className="ct-strategy-bar"><div><span className="ct-eyebrow">PACKING APPROACH</span><div className="ct-strategy-options">{STRATEGIES.map(option => <button key={option.id} aria-pressed={doc.strategy === option.id} className={doc.strategy === option.id ? 'active' : ''} title={option.description} onClick={() => s.editDocument(current => ({ ...current, strategy: option.id }))}><strong>{option.name}</strong><small>{STRATEGY_HINTS[option.id]}</small></button>)}</div></div><button className="ct-primary ct-pack-button" onClick={buildPlan} disabled={s.busy}><Icon name="bolt" size={18} />{buildLabel}<Icon name="arrow" size={17} /></button></div>
        </section>
        <PlanOverview studio={panelStudio} />
      </div>
      <PlanDetails studio={panelStudio} />
      <footer className="ct-footer"><span><Icon name="cube" size={16} /> CARGO TWIN</span><p>Planning prototype · rectangular packing · verify equipment and loading access.</p><button onClick={() => s.setDialog('help')}>How it works<Icon name="arrow" size={14} /></button></footer>
    </main>
    <div className="ct-mobile-next" aria-label="Next planning action"><span>{step === 'review' ? '3 · Review your plan' : s.activeTab === 'space' ? '1 · Choose your space' : '2 · Add your cargo'}</span>{step === 'review' && !s.dirty ? <button className="ct-primary" onClick={() => s.saveCurrent()}><Icon name="save" size={17} />Save project</button> : step !== 'review' && s.activeTab === 'space' ? <button className="ct-primary" onClick={() => navigate('cargo')}>Next: add cargo<Icon name="arrow" size={17} /></button> : <button className="ct-primary" disabled={s.busy} onClick={buildPlan}><Icon name="bolt" size={17} />{buildLabel}</button>}</div>
    <input ref={s.fileInput} type="file" accept=".json,application/json" hidden onChange={event => void s.importFile(event, 'json')} /><input ref={s.csvInput} type="file" accept=".csv,text/csv" hidden onChange={event => void s.importFile(event, 'csv')} />
    <ProjectDialogs studio={panelStudio} />
    {s.notice && !s.dialog && <div className="ct-toast" role="status"><Icon name="help" size={18} /><span>{s.notice}</span><button onClick={() => s.setNotice('')} aria-label="Dismiss notification"><Icon name="close" size={16} /></button></div>}
  </div>;
}

