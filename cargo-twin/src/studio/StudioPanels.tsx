import { useState } from 'react';
import { CARGO_SCENARIOS, SPACE_PRESETS } from './presets';
import { STRATEGIES } from './model';
import type { PackingStrategy } from './model';
import { PLAN_RULES } from './insights';
import { parseDocument } from './projects';
import { StudioDialog } from './StudioDialog';
import { StudioTabs } from './StudioTabs';
import { Icon, formatNumber as number, formatPercent as percent } from './StudioIcons';
import type { StudioController } from './useStudio';
import './panels.css';

type PanelProps = { studio: StudioController };
type DetailPanelProps = PanelProps & { hidden?: boolean };

const DETAIL_TABS = [
  { id: 'insights', label: 'Load insights', icon: 'chart', tabId: 'ct-tab-insights', panelId: 'ct-panel-insights' },
  { id: 'load-list', label: 'Placement list', icon: 'box', tabId: 'ct-tab-load-list', panelId: 'ct-panel-load-list' },
  { id: 'compare', label: 'Compare plans', icon: 'layers', tabId: 'ct-tab-compare', panelId: 'ct-panel-compare' },
] as const;

const APPROACH_COPY: Record<PackingStrategy, { benefit: string; description: string }> = {
  'max-fill': { benefit: 'Make the most of your space', description: 'Tries several cargo orders and keeps the layout with the most packed volume.' },
  balanced: { benefit: 'Bring cargo weight closer to the centre', description: 'Prefers low, centrally distributed cargo weight. Check the actual vehicle limits separately.' },
  gentle: { benefit: 'Prefer lower stacks', description: 'Places delicate cargo after sturdier support boxes and prefers lower stacking.' },
};

export function Meter({ value, tone = '' }: { value: number; tone?: string }) {
  return <div className={'ct-meter ' + tone}><i style={{ width: Math.max(0, Math.min(100, value * 100)) + '%' }} /></div>;
}

export function PlanOverview({ studio: s }: PanelProps) {
  const { stats, plan, insights, dirty, inputErrors } = s;
  const hasCargo = stats.requestedCount > 0;
  const centerAvailable = s.view !== 'map' && !s.exploded && s.visibleCount === plan.placements.length;
  const status = s.busy ? 'Calculating…' : dirty ? 'Previous plan' : 'Current plan';
  const fitMessage = s.busy ? 'Calculating placements for your cargo…' : dirty ? 'These counts belong to the previous plan.' : stats.unplacedCount ? number(stats.unplacedCount) + ' pieces still need a place.' : stats.packedCount === stats.requestedCount ? 'Every requested piece fits the modeled packing rules.' : 'Build a plan to calculate placements.';
  return <aside className="ct-results ct-plan-overview" aria-label={dirty ? 'Previous plan metrics' : 'Current plan metrics'}>
    <div className="ct-panel-heading"><div><span className="ct-eyebrow">YOUR RESULT</span><h2>Plan overview</h2></div><Icon name="chart" size={20} /></div>
    <div className={'ct-plan-status ' + (dirty ? 'previous' : 'current')}><span>{status}</span>{dirty && <p>{s.busy ? 'Building the updated layout. Results below are from the previous plan.' : 'Your inputs changed. Build an updated plan to see what fits now.'}</p>}</div>
    {inputErrors.length > 0 && <section className="ct-plan-input-errors" role="alert"><strong>Check these inputs</strong>{inputErrors.map((error, index) => <p key={index}>{error}</p>)}</section>}
    <div className={'ct-fit-summary ' + (stats.unplacedCount ? 'has-unplaced' : '')}>
      {hasCargo ? <><span>Pieces that fit</span><strong>{number(stats.packedCount)}<small> / {number(stats.requestedCount)}</small></strong><p>{fitMessage}</p></> : <><Icon name="box" size={28} /><strong className="ct-fit-empty">No cargo yet</strong><p>Add cargo types and quantities, then build your plan.</p></>}
    </div>
    {dirty && <button className="ct-primary ct-update-plan" disabled={s.busy} onClick={() => s.requestOptimization(s.doc)}><Icon name="bolt" size={17} />{s.busy ? 'Calculating…' : 'Update plan'}<Icon name="arrow" size={16} /></button>}
    <div className="ct-overview-capacity">
      <section className="ct-capacity-metric"><div><span>Space used</span><strong>{percent(stats.volumeUtilization)}</strong></div><Meter value={stats.volumeUtilization} /><p>{number(stats.packedVolumeM3, 2)} of {number(stats.usableVolumeM3, 2)} m³ usable space</p></section>
      <section className="ct-capacity-metric"><div><span>Weight limit used</span><strong>{percent(stats.payloadUtilization)}</strong></div><Meter value={stats.payloadUtilization} tone="mint" /><p>{number(stats.packedWeightKg, 1)} of {number(plan.space.maxPayloadKg)} kg</p></section>
    </div>
    <div className="ct-capacity-remaining"><span><strong>{number(stats.emptyVolumeM3, 2)} m³</strong> space left</span><span><strong>{number(insights.remainingPayloadKg)} kg</strong> weight allowance left</span></div>
    {plan.unplaced.length > 0 && <section className="ct-unplaced-list"><h3>{dirty ? 'Not placed in the previous plan' : 'Pieces not placed'}</h3>{plan.unplaced.map((item, index) => <article key={item.itemId + item.code + index}><strong>{item.count}× {item.name}</strong><p>{item.reason}</p></article>)}<p className="ct-small-note">Try another space or compare layouts. Spare volume alone does not mean every piece will fit.</p></section>}
    <details className="ct-panel-disclosure"><summary>Weight distribution &amp; plan notes <Icon name="arrow" size={15} /></summary><div className="ct-disclosure-content">
      <div className="ct-cog"><h3>Cargo weight distribution</h3><p>Estimated weight in each half of the usable space.</p><div className="ct-balance-labels"><span>Front <b>{percent(insights.massDistribution.frontFraction)}</b></span><span>Rear <b>{percent(insights.massDistribution.rearFraction)}</b></span></div><div className="ct-balance-track"><i style={{ width: insights.massDistribution.frontFraction * 100 + '%' }} /></div>
        {stats.centerOfGravity ? <><small>Weight centre: {number(stats.centerOfGravity.y, 1)} cm above the floor · {number(stats.centerOfGravity.z, 1)} cm from the front.</small><button className="ct-secondary" disabled={!centerAvailable} onClick={() => s.setShowCenter(!s.showCenter)} aria-label="Show center of gravity" aria-pressed={s.showCenter}><Icon name="target" size={16} />{s.showCenter ? 'Hide weight centre' : 'Show weight centre in 3D'}</button>{!centerAvailable && <small>Show the complete plan in a normal 3D view to display the weight centre.</small>}</> : <small>Build a plan with cargo to estimate its weight centre.</small>}
        <p className="ct-small-note">This assumes evenly distributed weight inside each box. It does not check vehicle axle limits.</p>
      </div>
      {plan.warnings.length > 0 && <div className="ct-plan-notes"><h3>Plan notes</h3>{plan.warnings.map((warning, index) => <p key={index}>{warning}</p>)}</div>}
    </div></details>
    <button className="ct-compare-button" disabled={s.busy} onClick={() => s.requestOptimization(s.doc, true)}><Icon name="layers" size={17} /> Compare approaches <Icon name="arrow" size={16} /></button>
    <p className="ct-small-note ct-model-note">A static rectangular-cargo estimate. Review real loading access, restraints and transport limits separately.</p>
  </aside>;
}

function LoadInsights({ studio: s, hidden }: DetailPanelProps) {
  const { insights } = s;
  return <div className="ct-insights-content" id="ct-panel-insights" role="tabpanel" aria-labelledby="ct-tab-insights" hidden={hidden}>
    <div className="ct-details-intro"><h3>Understand this layout</h3><p>Review pieces that need attention, then explore the optional measurements below.</p></div>
    <div className="ct-advice">{insights.advice.map(advice => <article key={advice.id} className={advice.tone}><Icon name={advice.tone === 'attention' ? 'warning' : 'check'} size={17} /><div><strong>{advice.title}</strong><p>{advice.detail}</p></div></article>)}</div>
    <section className="ct-cargo-fit-breakdown"><h3>Fit by cargo type</h3><div className="ct-group-legend">{insights.groups.map(group => <span key={group.itemId}><i style={{ background: group.color ?? '#9895b0' }} /><strong>{group.name}</strong><b>{group.packedCount} / {group.requestedCount}</b> pieces fit</span>)}</div>{!insights.groups.length && <p>Build a plan with cargo to see each type here.</p>}</section>
    <details className="ct-panel-disclosure ct-insight-disclosure"><summary>Space, stacking &amp; weight measurements <Icon name="arrow" size={16} /></summary><div className="ct-disclosure-content"><div className="ct-insight-stats">
      <article><span>Floor covered</span><strong>{percent(insights.floorUtilization)}</strong><Meter value={insights.floorUtilization} /><small>{number(insights.occupiedFloorAreaM2, 2)} of {number(insights.usableFloorAreaM2, 2)} m² usable floor</small></article>
      <article><span>Height used</span><strong>{percent(insights.heightUtilization)}</strong><Meter value={insights.heightUtilization} tone="mint" /><small>Highest cargo reaches {number(insights.maxHeightCm, 1)} cm above the floor</small></article>
      <article><span>Pieces in stacks</span><strong>{insights.stackedCount}<small> / {insights.packedCount}</small></strong><p>{insights.floorCount} on the floor · {insights.rotatedCount} rotated to fit</p></article>
      <article><span>Weight left / right</span><strong>{percent(insights.massDistribution.leftFraction)}<small> / {percent(insights.massDistribution.rightFraction)}</small></strong><p>Estimated cargo weight in each half of the usable width.</p></article>
    </div></div></details>
  </div>;
}

function PlacementList({ studio: s, hidden }: DetailPanelProps) {
  const [showTechnicalColumns, setShowTechnicalColumns] = useState(false);
  const { plan } = s;
  return <div className="ct-load-list" id="ct-panel-load-list" role="tabpanel" aria-labelledby="ct-tab-load-list" hidden={hidden}>
    <div className="ct-details-intro"><h3>One row for each placed piece</h3><p>Select an order number to inspect that piece in the plan. This is a placement guide; actual loading access needs a separate check.</p></div>
    <div className="ct-list-heading"><label className="ct-search"><Icon name="search" size={15} /><input aria-label="Search placements" placeholder="Find a cargo piece…" value={s.listQuery} onChange={event => s.setListQuery(event.target.value)} /></label><button className="ct-secondary" disabled={s.dirty} onClick={() => s.exportFile('plan')}><Icon name="download" size={16} /> CSV</button></div>
    <label className="ct-technical-columns"><input type="checkbox" checked={showTechnicalColumns} onChange={event => setShowTechnicalColumns(event.target.checked)} />Show positions and stacking details</label>
    {showTechnicalColumns && <p className="ct-small-note">Positions in centimetres: x crosses the width, y is height above the floor, z starts at the front. Base support is the portion resting on the floor or other cargo.</p>}
    <div className="ct-table-scroll"><table><thead><tr><th>Order</th><th>Cargo piece</th><th>Size W / H / L · cm</th><th>Weight</th>{showTechnicalColumns && <><th>Position x / y / z · cm</th><th>Base support</th><th>Weight above</th></>}</tr></thead><tbody>{s.listPieces.map(piece => <tr key={piece.id} className={piece.id === s.selectedId ? 'selected' : ''}><td><button aria-label={'Inspect piece ' + piece.sequence} onClick={() => s.inspectPiece(piece.id)}>{String(piece.sequence).padStart(2, '0')}</button></td><td><i style={{ background: piece.color }} />{piece.name}</td><td>{piece.widthCm} / {piece.heightCm} / {piece.lengthCm}</td><td>{number(piece.weightKg, 1)} kg</td>{showTechnicalColumns && <><td>{number(piece.x, 1)} / {number(piece.y, 1)} / {number(piece.z, 1)}</td><td>{percent(piece.supportRatio)}</td><td>{number(piece.loadOnTopKg, 1)} kg</td></>}</tr>)}</tbody></table></div>
    {!s.listPieces.length && <p className="ct-empty">{plan.placements.length ? 'No pieces match your search.' : 'Build a plan to create the placement list.'}</p>}
    <p className="ct-small-note">CSV downloads every calculated placement, including the optional technical columns.</p>
  </div>;
}

function ComparePlans({ studio: s, hidden }: DetailPanelProps) {
  const { plan } = s;
  return <div className="ct-comparison" id="ct-panel-compare" role="tabpanel" aria-labelledby="ct-tab-compare" hidden={hidden}>
    {s.comparison ? <><div className="ct-details-intro"><h3>Choose the layout that suits this load</h3><p>Each option uses the same cargo and space. Choosing a plan updates the 3D view, placement list and load sheet.</p></div><div className="ct-comparison-grid">{s.comparison.map(result => {
      const active = result.strategy === plan.strategy && !s.dirty;
      const copy = APPROACH_COPY[result.strategy];
      return <article key={result.strategy} className={active ? 'current' : ''}><div><Icon name={result.strategy === 'max-fill' ? 'box' : result.strategy === 'balanced' ? 'target' : 'eye'} size={22} /><span>{active ? 'CURRENT PLAN' : 'ANOTHER APPROACH'}</span></div><h3>{STRATEGIES.find(option => option.id === result.strategy)?.name}</h3><h4>{copy.benefit}</h4><p>{copy.description}</p><strong>{result.stats.packedCount}<small> / {result.stats.requestedCount} pieces fit</small></strong><dl><div><dt>Still not placed</dt><dd>{result.stats.unplacedCount} pieces</dd></div><div><dt>Space used</dt><dd>{percent(result.stats.volumeUtilization)}</dd></div><div><dt>Cargo weight</dt><dd>{number(result.stats.packedWeightKg)} kg</dd></div></dl><button disabled={s.busy} onClick={() => s.applyPlan(result)}>Use this plan <Icon name="arrow" size={15} /></button></article>;
    })}</div><p className="ct-small-note">These are practical packing estimates. An approach may fit fewer pieces to favour its goal; none certifies transport safety.</p></> : <div className="ct-compare-empty"><Icon name="layers" size={32} /><div><h3>Try three layouts for the same load</h3><p>Compare maximum space use, weight centring and lower stacks. Then choose a plan.</p></div><button className="ct-primary" disabled={s.busy} onClick={() => s.requestOptimization(s.doc, true)}>Compare approaches <Icon name="arrow" size={16} /></button></div>}
  </div>;
}

export function PlanDetails({ studio: s }: PanelProps) {
  return <section className="ct-details ct-plan-details" id="ct-plan-details" tabIndex={-1} aria-label="Plan details">
    <header><StudioTabs options={DETAIL_TABS} value={s.detailTab} onChange={s.setDetailTab} label="Plan details" /><button className="ct-text-button" onClick={s.openReport}><Icon name="print" size={16} /> Load sheet <Icon name="arrow" size={15} /></button></header>
    {s.dirty && s.detailTab !== 'compare' && <div className="ct-stale"><Icon name="warning" size={15} />Previous plan details. Build an updated plan for your current cargo and space.</div>}
    <LoadInsights studio={s} hidden={s.detailTab !== 'insights'} />
    <PlacementList studio={s} hidden={s.detailTab !== 'load-list'} />
    <ComparePlans studio={s} hidden={s.detailTab !== 'compare'} />
  </section>;
}

function ScenarioGallery({ studio: s }: PanelProps) {
  return <div className="ct-scenario-grid">{CARGO_SCENARIOS.map((scenario, index) => <button className={'ct-scenario-card scenario-' + index} key={scenario.id} onClick={() => s.loadScenario(scenario)}><div className="ct-scenario-art"><Icon name={SPACE_PRESETS.find(space => space.id === scenario.spaceId)?.mode ?? 'custom'} size={76} /><span>{String(index + 1).padStart(2, '0')}</span><i /><i /><i /></div><span className="ct-eyebrow">{SPACE_PRESETS.find(space => space.id === scenario.spaceId)?.name}</span><h3>{scenario.name}</h3><p>{scenario.description}</p><footer><span>{scenario.items.reduce((sum, item) => sum + item.quantity, 0)} pieces · {scenario.items.length} cargo types</span><Icon name="arrow" size={17} /></footer></button>)}</div>;
}

function ProjectLibrary({ studio: s }: PanelProps) {
  const currentSavedProject = s.projects.find(project => project.id === s.history.projectId);
  return <div className="ct-project-library">
    <div className="ct-save-explainer"><article><strong>Working draft</strong><p>{s.recoveryError ? 'Automatic saving is paused. Your recovery data is preserved.' : 'Valid edits are saved automatically in this browser while you work.'}</p><small>{s.autosaveStatus}</small></article><article><strong>Named saved projects</strong><p>Save a project below to keep it in your library. Save again to update it.</p></article><article><strong>Portable backup</strong><p>Download Project JSON to move or back up the editable project.</p><button className="ct-text-button" onClick={() => s.setDialog('export')}>Download a backup <Icon name="arrow" size={15} /></button></article></div>
    <div className="ct-library-save-form"><label className="ct-field"><span>Name this project</span><input aria-label="Name this project" value={s.doc.name} maxLength={100} onChange={event => s.editDocument(current => ({ ...current, name: event.target.value }))} /></label><p>{currentSavedProject ? 'Save current project updates “' + currentSavedProject.name + '” in this library.' : 'Save current project creates a named copy of your working draft.'}</p><div className="ct-library-tools"><button className="ct-primary" onClick={() => s.saveCurrent()}><Icon name="save" size={17} />Save current project</button><button className="ct-secondary" onClick={() => s.saveCurrent(true)}><Icon name="copy" size={17} />Save as a new copy</button></div></div>
    {!s.projects.length && <div className="ct-library-empty"><Icon name="folder" size={42} /><h3>No saved projects yet</h3><p>Name this project and save it above. Your working draft stays separate.</p></div>}
    <div className="ct-project-list">{s.projects.map(project => <article className="ct-project-card" key={project.id}><div className="ct-project-card-row"><span className="ct-project-icon"><Icon name={project.space.mode} size={24} /></span><div className="ct-project-description"><strong>{project.name}</strong>{project.id === s.history.projectId && <span className="ct-library-current">Open project</span>}<p>{project.space.name} · {project.items.reduce((sum, item) => sum + item.quantity, 0)} pieces</p><small>Saved {new Date(project.updatedAt).toLocaleString()}</small></div><div className="ct-project-actions"><button className="ct-secondary" onClick={() => { s.loadDocument(parseDocument(project), project.id); s.setNotice('Saved project loaded.'); }}>Open <Icon name="arrow" size={15} /></button>{s.deleteId !== project.id && <button className="ct-text-button danger" aria-label={'Delete ' + project.name} onClick={() => s.setDeleteId(project.id)}><Icon name="trash" size={17} />Delete</button>}</div></div>
      {s.deleteId === project.id && <div className="ct-project-delete-confirm"><div><strong>Delete “{project.name}” from this library?</strong><p>The saved copy is removed from this browser. Your open working draft stays available.</p></div><div><button className="ct-delete-confirm-button" aria-label={'Confirm delete ' + project.name} onClick={() => s.removeProject(project.id)}><Icon name="trash" size={16} />Delete saved project</button><button className="ct-secondary" onClick={() => s.setDeleteId(null)}>Cancel</button></div></div>}
    </article>)}</div>
  </div>;
}

function ExportOptions({ studio: s }: PanelProps) {
  return <div className="ct-file-workflows">
    <section><div className="ct-details-intro"><h3>Keep an editable copy</h3><p>These files use your current draft, including edits you have not packed yet.</p></div><div className="ct-export-options">
      <button onClick={() => s.exportFile('json')}><Icon name="cube" size={26} /><div><strong>Project JSON</strong><p>The complete editable project: cargo, space, rules and approach. Import it on another browser or device.</p><span className="ct-file-purpose">Best for backup or continuing later</span></div><Icon name="download" /></button>
      <button onClick={() => s.exportFile('cargo')}><Icon name="box" size={26} /><div><strong>Manifest CSV</strong><p>A spreadsheet list of cargo types, sizes, quantities, weights and rules. It contains no load space or placements.</p><span className="ct-file-purpose">Edit in a spreadsheet, then import as cargo</span></div><Icon name="download" /></button>
    </div></section>
    <section><div className="ct-details-intro"><h3>Share calculated results</h3><p>Use these files to review the layout and pass its details to someone else.</p></div>{s.dirty && <div className="ct-export-stale"><Icon name="warning" size={18} /><div><strong>Update the plan first</strong><p>Your cargo or space changed. Rebuild before downloading calculated results.</p></div><button className="ct-primary" disabled={s.busy} onClick={() => s.requestOptimization(s.doc)}>{s.busy ? 'Calculating…' : 'Update plan'}<Icon name="arrow" size={15} /></button></div>}<div className="ct-export-options">
      <button disabled={s.dirty || s.busy} onClick={() => s.exportFile('plan')}><Icon name="layers" size={26} /><div><strong>Placement CSV</strong><p>One row per placed piece: positions, orientations, support and weight above. Open it in a spreadsheet.</p><span className="ct-file-purpose">Calculated data; not an editable project backup</span></div><Icon name="download" /></button>
      <button disabled={s.dirty || s.busy} onClick={() => s.exportFile('html')}><Icon name="print" size={26} /><div><strong>Printable load sheet</strong><p>Download an HTML report with results, placements and reasons for unplaced cargo. Open it in a browser to print.</p><span className="ct-file-purpose">A report for reviewing or sharing this plan</span></div><Icon name="download" /></button>
    </div></section>
  </div>;
}

function LoadReport({ studio: s }: PanelProps) {
  return <div className="ct-load-report"><div className="ct-report-instructions"><strong>Review or share your current plan</strong><p>Print / save PDF opens a print window. Choose Save as PDF there to keep a PDF. Download HTML keeps a report you can reopen in a browser; Placement CSV is for a spreadsheet.</p></div><div className="ct-library-tools"><button className="ct-primary" onClick={s.printReport}><Icon name="print" size={17} />Print / save PDF</button><button className="ct-secondary" onClick={() => s.exportFile('html')}><Icon name="download" size={17} />Download HTML</button><button className="ct-secondary" onClick={() => s.exportFile('plan')}><Icon name="download" size={17} />Placement CSV</button></div><iframe className="ct-report-preview" title="Load sheet preview" srcDoc={s.reportHtml.replace('<button type="button" onclick="window.print()">Print / save PDF</button>', '')} sandbox="" /></div>;
}

function PlanningGuide() {
  return <div className="ct-planning-guide"><div className="ct-guide-steps"><article><span>01</span><h3>Choose your space</h3><p>Pick a vehicle or container template. Check its internal dimensions and cargo weight limit.</p></article><article><span>02</span><h3>Add your cargo</h3><p>Enter each cargo type's size, quantity and weight. Set handling rules, import a cargo CSV or start with a sample.</p></article><article><span>03</span><h3>Build and review</h3><p>Build the 3D plan. See what fits, inspect pieces and compare layouts. Update the plan after editing, then save or download it.</p></article></div><details className="ct-panel-disclosure"><summary>How the packing rules work <Icon name="arrow" size={16} /></summary><div className="ct-guide-rules">{PLAN_RULES.map(rule => <article key={rule.title}><Icon name="check" size={17} /><div><strong>{rule.title}</strong><p>{rule.detail}</p></div></article>)}</div><p className="ct-info-note">The planner estimates rectangular cargo and static support. It does not certify transport safety, solve door access or guarantee the best possible layout. The aircraft workspace retains a separate ULD and weight-and-balance prototype.</p></details><div className="ct-shortcuts"><span><kbd>Ctrl</kbd> + <kbd>S</kbd> Save</span><span><kbd>Ctrl</kbd> + <kbd>Z</kbd> Undo</span><span><kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>Z</kbd> Redo</span><span><kbd>R</kbd> Reset camera</span><span><kbd>?</kbd> Guide</span></div></div>;
}

export function ProjectDialogs({ studio: s }: PanelProps) {
  const close = () => s.setDialog(null);
  const feedback = { notice: s.notice, onDismissNotice: () => s.setNotice('') };
  if (s.dialog === 'scenarios') return <StudioDialog {...feedback} title="Start with a sample load" subtitle="Choose a complete example, then change its cargo and space. Undo can restore your previous work." onClose={close}><ScenarioGallery studio={s} /></StudioDialog>;
  if (s.dialog === 'projects') return <StudioDialog {...feedback} title="Your project library" subtitle="Named projects saved in this browser. Keep a Project JSON backup when moving devices." onClose={close}><ProjectLibrary studio={s} /></StudioDialog>;
  if (s.dialog === 'export') return <StudioDialog {...feedback} title="Download your work" subtitle="Choose an editable backup, cargo spreadsheet or calculated report." onClose={close}><ExportOptions studio={s} /></StudioDialog>;
  if (s.dialog === 'report') return <StudioDialog {...feedback} title={'Load sheet / ' + s.doc.name} subtitle="Calculated results, placements and handling notes for the current plan." onClose={close}><LoadReport studio={s} /></StudioDialog>;
  if (s.dialog === 'help') return <StudioDialog {...feedback} title="Plan a load in three steps" subtitle="Choose your space, add cargo, then build and review the plan." onClose={close}><PlanningGuide /></StudioDialog>;
  return null;
}

