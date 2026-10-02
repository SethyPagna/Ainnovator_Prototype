import { describe, expect, it } from 'vitest';
import { MAX_EDITOR_HISTORY, bindProject, commitHistory, createHistory, travelHistory } from '../src/studio/documentHistory';
import { cargoScenario, spacePreset } from '../src/studio/presets';
import type { StudioDocument } from '../src/studio/projects';

function document(name = 'Morning route'): StudioDocument {
  const scenario = cargoScenario('city-delivery');
  return { name, space: spacePreset(scenario.spaceId), items: scenario.items, strategy: 'balanced' };
}

describe('editor history preserves project identity', () => {
  it('travels across edits, another saved project and a new detached project with the matching ID', () => {
    const first = document('Project A');
    const revised = document('Project A revised');
    const second = document('Project B');
    const detached = document('New unsaved project');
    let history = createHistory(first, 'project-A');
    history = commitHistory(history, { document: revised });
    expect(history.projectId).toBe('project-A');
    history = commitHistory(history, { document: second, projectId: 'project-B' });
    history = commitHistory(history, { document: detached, projectId: undefined });
    expect(history.projectId).toBeUndefined();
    history = travelHistory(history, 'undo');
    expect(history.present).toEqual(second);
    expect(history.projectId).toBe('project-B');
    history = travelHistory(history, 'undo');
    expect(history.present).toEqual(revised);
    expect(history.projectId).toBe('project-A');
    history = travelHistory(history, 'undo');
    expect(history.present).toEqual(first);
    expect(history.projectId).toBe('project-A');
    history = travelHistory(history, 'redo');
    history = travelHistory(history, 'redo');
    history = travelHistory(history, 'redo');
    expect(history.present).toEqual(detached);
    expect(history.projectId).toBeUndefined();
  });

  it('records identity-only loads and treats explicit undefined differently from an omitted binding', () => {
    let history = createHistory(document(), 'project-A');
    const unchanged = commitHistory(history, { document: document() });
    expect(unchanged).toBe(history);
    history = commitHistory(history, { document: document(), projectId: undefined });
    expect(history.past).toHaveLength(1);
    expect(history.projectId).toBeUndefined();
    expect(travelHistory(history, 'undo').projectId).toBe('project-A');
  });

  it('clears redo when an edit makes a new choice after undo', () => {
    let history = createHistory(document('Original'), 'project-A');
    history = commitHistory(history, { document: document('First choice') });
    history = travelHistory(history, 'undo');
    expect(history.future).toHaveLength(1);
    history = commitHistory(history, { document: document('New choice') });
    expect(history.future).toEqual([]);
    expect(travelHistory(history, 'redo')).toBe(history);
    expect(history.projectId).toBe('project-A');
  });

  it('bounds history to the most recent 40 snapshots without losing redo identity', () => {
    let history = createHistory(document('0'), 'project-A');
    for (let index = 1; index <= 65; index++) history = commitHistory(history, { document: document(String(index)) });
    expect(history.past).toHaveLength(MAX_EDITOR_HISTORY);
    for (let index = 0; index < MAX_EDITOR_HISTORY; index++) history = travelHistory(history, 'undo');
    expect(history.present.name).toBe('25');
    expect(history.future).toHaveLength(MAX_EDITOR_HISTORY);
    expect(travelHistory(history, 'undo')).toBe(history);
    for (let index = 0; index < MAX_EDITOR_HISTORY; index++) history = travelHistory(history, 'redo');
    expect(history.present.name).toBe('65');
    expect(history.projectId).toBe('project-A');
    expect(history.past).toHaveLength(MAX_EDITOR_HISTORY);
  });

  it('clones input snapshots so later changes cannot rewrite an earlier state', () => {
    const original = document();
    const initial = createHistory(original, 'project-A');
    original.items[0].name = 'Mutated caller';
    original.space.widthCm = 50;
    expect(initial.present.items[0].name).toBe('Everyday cartons');
    expect(initial.present.space.widthCm).toBe(175);
    const next = document('Next');
    const history = commitHistory(initial, { document: next });
    next.items[0].name = 'Mutated new caller';
    history.present.items[1].name = 'Mutated current view';
    expect(history.present.items[0].name).toBe('Everyday cartons');
    expect(travelHistory(history, 'undo').present.items[1].name).toBe('Tool cases');
    expect(initial.present.items[1].name).toBe('Tool cases');
  });

  it('retains transient invalid editor inputs and distinguishes non-finite values without JSON coercion', () => {
    let history = createHistory(document(), 'project-A');
    const incomplete = document('');
    incomplete.items[0].weightKg = NaN;
    history = commitHistory(history, { document: incomplete });
    expect(history.present.name).toBe('');
    expect(Number.isNaN(history.present.items[0].weightKg)).toBe(true);
    const infinite = document('');
    infinite.items[0].weightKg = Infinity;
    history = commitHistory(history, { document: infinite });
    expect(history.past).toHaveLength(2);
    expect(history.present.items[0].weightKg).toBe(Infinity);
    expect(Number.isNaN(travelHistory(history, 'undo').present.items[0].weightKg)).toBe(true);
  });

  it('binds a successful save without adding an edit and preserves existing snapshot bindings', () => {
    let history = createHistory(document(), 'project-A');
    history = commitHistory(history, { document: document('Imported'), projectId: undefined });
    history = bindProject(history, 'project-new');
    expect(history.projectId).toBe('project-new');
    expect(history.past).toHaveLength(1);
    expect(bindProject(history, 'project-new')).toBe(history);
    const previous = travelHistory(history, 'undo');
    expect(previous.projectId).toBe('project-A');
    expect(travelHistory(previous, 'redo').projectId).toBe('project-new');
    expect(bindProject(history, undefined).projectId).toBeUndefined();
  });

  it('rejects malformed identities and keeps boundary undo/redo as no-ops', () => {
    const history = createHistory(document());
    expect(travelHistory(history, 'undo')).toBe(history);
    expect(travelHistory(history, 'redo')).toBe(history);
    expect(() => createHistory(document(), 'bad id')).toThrow(/Project ID/);
    expect(() => commitHistory(history, { document: document(), projectId: '<bad>' })).toThrow(/Project ID/);
    expect(() => bindProject(history, 'bad\nID')).toThrow(/Project ID/);
  });
});
