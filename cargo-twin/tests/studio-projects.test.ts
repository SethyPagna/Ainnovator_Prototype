import { describe, expect, it } from 'vitest';
import { MAX_CARGO_PIECES } from '../src/studio/model';
import { cargoScenario, spacePreset } from '../src/studio/presets';
import { AUTOSAVE_STORAGE_KEY, LEGACY_STORAGE_KEY, MAX_SAVED_PROJECTS, PROJECTS_STORAGE_KEY, autosaveDocument, autosaveDraftSession, clearAutosave, deleteProject, loadProject, parseDocument, readAutosave, readDraftSession, readProjects, saveProject, serializeDocument, type ProjectStorage, type StudioDocument } from '../src/studio/projects';

class MemoryStorage implements ProjectStorage {
  private values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
  removeItem(key: string) { this.values.delete(key); }
}

function document(): StudioDocument {
  const scenario = cargoScenario('city-delivery');
  return { name: 'Morning route', space: spacePreset(scenario.spaceId), items: scenario.items, strategy: 'balanced' };
}

describe('studio scenario boundary', () => {
  it('round-trips named exports with every handling rule and returns independent data', () => {
    const original = document();
    const restored = parseDocument(JSON.parse(serializeDocument(original)));
    expect(restored).toEqual(original);
    restored.space.widthCm = 50;
    restored.items[0].name = 'Changed';
    expect(original.space.widthCm).toBe(175);
    expect(original.items[0].name).toBe('Everyday cartons');
  });

  it('preserves legacy scenario data and the planner limit rather than truncating quantities', () => {
    const { space, items, strategy } = document();
    items[0].quantity = MAX_CARGO_PIECES + 1;
    const restored = parseDocument({ version: 1, space, items, strategy });
    expect(restored).toEqual({ name: 'Untitled load plan', space, items, strategy });
    expect(parseDocument({ space, items }).strategy).toBe('max-fill');
  });

  it.each([
    { name: '' }, { name: 'bad\nname' }, { name: 'bad\u0085name' }, { name: 'a'.repeat(121) },
    { strategy: 'unknown' }, { strategy: null }, { version: 9 }, { format: 'another-app' },
    { items: null }, { items: Array(MAX_CARGO_PIECES + 1).fill({}) },
  ])('rejects invalid scenario metadata before applying it: %j', overrides => {
    expect(() => parseDocument({ ...document(), ...overrides })).toThrow();
  });

  it.each([
    { lengthCm: 0 }, { widthCm: Infinity }, { mode: 'spaceship' }, { clearanceCm: 100 },
    { reservedDepthCm: 100_000 }, { maxPayloadKg: 0 }, { id: '<svg>' }, { name: 'Space\tname' },
  ])('rejects invalid or unusable load spaces: %j', overrides => {
    const original = document();
    expect(() => parseDocument({ ...original, space: { ...original.space, ...overrides } })).toThrow();
  });

  it.each([
    { quantity: 0 }, { quantity: 1.5 }, { quantity: 10_001 }, { weightKg: 0 }, { weightKg: NaN },
    { heightCm: 100_001 }, { lengthCm: 0.01 }, { maxTopLoadKg: -1 }, { name: 'Box\rname' },
    { fragile: 'false' }, { keepUpright: 1 }, { stackable: null }, { priority: 'urgent' },
    { color: 'url(javascript:alert(1))' }, { color: '#123' }, { id: 'bad id' },
  ])('reports the cargo row that has invalid data: %j', overrides => {
    const original = document();
    expect(() => parseDocument({ ...original, items: [{ ...original.items[0], ...overrides }] })).toThrow(/Cargo row 1/);
  });

  it('rejects duplicate IDs and primitive rows without throwing an unrelated TypeError', () => {
    const original = document();
    expect(() => parseDocument({ ...original, items: [original.items[0], original.items[0]] })).toThrow(/duplicate ID/);
    expect(() => parseDocument({ ...original, items: [null] })).toThrow(/Cargo row 1 must be an object/);
    expect(() => parseDocument([])).toThrow(/scenario must be an object/);
  });

  it('drops unrecognized imported keys instead of returning attacker-controlled attributes', () => {
    const original = document();
    const restored = parseDocument({ ...original, injected: '<script>', space: { ...original.space, injected: '<script>' }, items: original.items.map(item => ({ ...item, injected: '<script>' })) });
    expect(restored).toEqual(original);
  });
});

describe('named local projects and recovery', () => {
  it('creates, updates, independently loads and deletes projects without disturbing another project', () => {
    const storage = new MemoryStorage();
    expect(readProjects(storage)).toEqual([]);
    const first = saveProject(storage, undefined, document())[0];
    const second = saveProject(storage, undefined, { ...document(), name: 'Afternoon route', strategy: 'gentle' })[0];
    expect(first.id).not.toBe(second.id);
    expect(new Date(first.updatedAt).toISOString()).toBe(first.updatedAt);
    const updated = saveProject(storage, first.id, { ...document(), name: 'Morning revised' });
    expect(updated.map(project => project.id)).toEqual([first.id, second.id]);
    expect(loadProject(storage, first.id)?.name).toBe('Morning revised');
    const loaded = loadProject(storage, first.id)!;
    loaded.items[0].name = 'Mutated outside storage';
    expect(loadProject(storage, first.id)?.items[0].name).toBe('Everyday cartons');
    expect(deleteProject(storage, first.id).map(project => project.id)).toEqual([second.id]);
    expect(loadProject(storage, first.id)).toBeNull();
    expect(loadProject(storage, second.id)?.name).toBe('Afternoon route');
    expect(() => saveProject(storage, first.id, document())).toThrow(/no longer exists/);
  });

  it('migrates a legacy device save without modifying or deleting its original bytes', () => {
    const storage = new MemoryStorage();
    const { space, items, strategy } = document();
    const original = JSON.stringify({ version: 1, space, items, strategy });
    storage.setItem(LEGACY_STORAGE_KEY, original);
    const recovered = readProjects(storage)[0];
    expect(recovered.name).toBe('Recovered scenario');
    expect(recovered.space).toEqual(space);
    expect(recovered.items).toEqual(items);
    const projects = saveProject(storage, undefined, document());
    expect(projects).toHaveLength(2);
    expect(readProjects(storage)).toEqual(projects);
    expect(storage.getItem(LEGACY_STORAGE_KEY)).toBe(original);
    deleteProject(storage, recovered.id);
    expect(readProjects(storage)).toHaveLength(1);
    expect(storage.getItem(LEGACY_STORAGE_KEY)).toBe(original);
  });

  it('recovers an autosaved draft independently from the named project collection', () => {
    const storage = new MemoryStorage();
    const named = saveProject(storage, undefined, document())[0];
    expect(readAutosave(storage)).toBeNull();
    const draft = { ...document(), name: 'Unsaved changes', strategy: 'gentle' as const };
    autosaveDocument(storage, draft);
    expect(readAutosave(storage)).toEqual(draft);
    expect(loadProject(storage, named.id)?.name).toBe('Morning route');
    clearAutosave(storage);
    expect(storage.getItem(AUTOSAVE_STORAGE_KEY)).toBeNull();
    expect(readProjects(storage)).toHaveLength(1);
  });

  it('preserves corrupt storage instead of silently overwriting it with a new project', () => {
    const storage = new MemoryStorage();
    storage.setItem(PROJECTS_STORAGE_KEY, '{damaged');
    expect(() => readProjects(storage)).toThrow(/damaged/);
    expect(() => saveProject(storage, undefined, document())).toThrow(/damaged/);
    expect(storage.getItem(PROJECTS_STORAGE_KEY)).toBe('{damaged');
    storage.setItem(AUTOSAVE_STORAGE_KEY, '{damaged');
    expect(() => readAutosave(storage)).toThrow(/damaged/);
  });

  it('validates a whole saved collection and rejects duplicate identities or bad timestamps', () => {
    const storage = new MemoryStorage();
    const project = saveProject(storage, undefined, document())[0];
    storage.setItem(PROJECTS_STORAGE_KEY, JSON.stringify({ version: 2, projects: [project, project] }));
    expect(() => readProjects(storage)).toThrow(/duplicate project IDs/);
    storage.setItem(PROJECTS_STORAGE_KEY, JSON.stringify({ version: 2, projects: [{ ...project, updatedAt: '2026-02-31T00:00:00.000Z' }] }));
    expect(() => readProjects(storage)).toThrow(/timestamp/);
  });

  it('bounds saved projects while still allowing an existing project to be updated', () => {
    const storage = new MemoryStorage();
    const projects = Array.from({ length: MAX_SAVED_PROJECTS }, (_, index) => ({ ...document(), id: `project-${index}`, updatedAt: '2026-10-01T00:00:00.000Z' }));
    storage.setItem(PROJECTS_STORAGE_KEY, JSON.stringify({ version: 2, projects }));
    expect(() => saveProject(storage, undefined, document())).toThrow(/up to 50 projects/);
    expect(saveProject(storage, projects[0].id, document())).toHaveLength(MAX_SAVED_PROJECTS);
  });

  it('propagates unavailable storage and quota errors so the UI can disclose unsaved work', () => {
    const storage = new MemoryStorage();
    const original = saveProject(storage, undefined, document());
    const failedStorage = { getItem: (key: string) => storage.getItem(key), setItem: () => { throw new Error('Quota exceeded'); } };
    expect(() => saveProject(failedStorage, original[0].id, { ...document(), name: 'Unsaved' })).toThrow('Quota exceeded');
    expect(readProjects(storage)).toEqual(original);
    expect(() => readProjects({ getItem: () => { throw new Error('Access denied'); } })).toThrow('Access denied');
  });
});

describe('autosaved editor session identity', () => {
  it('recovers unsaved changes bound to the existing saved project in one atomic write', () => {
    const storage = new MemoryStorage();
    const saved = saveProject(storage, undefined, document())[0];
    const draft = { ...document(), name: 'Morning revised but unsaved' };
    let writes = 0;
    autosaveDraftSession({ setItem: (key, value) => { writes++; storage.setItem(key, value); } }, draft, saved.id);
    expect(writes).toBe(1);
    expect(readDraftSession(storage)).toEqual({ document: draft, projectId: saved.id });
    expect(readAutosave(storage)).toEqual(draft);
    expect(loadProject(storage, saved.id)?.name).toBe('Morning route');
    expect(parseDocument(JSON.parse(storage.getItem(AUTOSAVE_STORAGE_KEY)!))).toEqual(draft);
  });

  it('detaches deleted or missing bindings while retaining all draft changes and original bytes', () => {
    const storage = new MemoryStorage();
    const saved = saveProject(storage, undefined, document())[0];
    const draft = { ...document(), name: 'Recovered after deletion' };
    autosaveDraftSession(storage, draft, saved.id);
    const raw = storage.getItem(AUTOSAVE_STORAGE_KEY);
    deleteProject(storage, saved.id);
    expect(readDraftSession(storage)).toEqual({ document: draft });
    expect(storage.getItem(AUTOSAVE_STORAGE_KEY)).toBe(raw);
    autosaveDraftSession(storage, draft, 'missing-project');
    expect(readDraftSession(storage)).toEqual({ document: draft });
  });

  it('recovers a valid draft independently when the project collection is corrupt or unavailable', () => {
    const storage = new MemoryStorage();
    const saved = saveProject(storage, undefined, document())[0];
    autosaveDraftSession(storage, document(), saved.id);
    const raw = storage.getItem(AUTOSAVE_STORAGE_KEY);
    storage.setItem(PROJECTS_STORAGE_KEY, '{damaged collection');
    expect(readDraftSession(storage)).toEqual({ document: document() });
    expect(storage.getItem(AUTOSAVE_STORAGE_KEY)).toBe(raw);
    expect(storage.getItem(PROJECTS_STORAGE_KEY)).toBe('{damaged collection');
    expect(readDraftSession({ getItem: key => { if (key === PROJECTS_STORAGE_KEY) throw new Error('Library denied'); return storage.getItem(key); } })).toEqual({ document: document() });
  });

  it('accepts existing document-only and legacy autosaves as detached sessions', () => {
    const storage = new MemoryStorage();
    expect(readDraftSession(storage)).toBeNull();
    autosaveDocument(storage, document());
    expect(readDraftSession(storage)).toEqual({ document: document() });
    const { space, items, strategy } = document();
    storage.setItem(AUTOSAVE_STORAGE_KEY, JSON.stringify({ version: 1, space, items, strategy }));
    expect(readDraftSession(storage)).toEqual({ document: { name: 'Untitled load plan', space, items, strategy } });
  });

  it('detaches malformed binding metadata and preserves invalid draft or raw corruption for recovery', () => {
    const storage = new MemoryStorage();
    storage.setItem(AUTOSAVE_STORAGE_KEY, JSON.stringify({ ...document(), projectId: '<invalid ID>' }));
    const metadataRaw = storage.getItem(AUTOSAVE_STORAGE_KEY);
    expect(readDraftSession(storage)).toEqual({ document: document() });
    expect(storage.getItem(AUTOSAVE_STORAGE_KEY)).toBe(metadataRaw);
    storage.setItem(AUTOSAVE_STORAGE_KEY, '{damaged draft');
    expect(() => readDraftSession(storage)).toThrow(/damaged/);
    expect(storage.getItem(AUTOSAVE_STORAGE_KEY)).toBe('{damaged draft');
    const invalid = JSON.stringify({ ...document(), name: '' });
    storage.setItem(AUTOSAVE_STORAGE_KEY, invalid);
    expect(() => readDraftSession(storage)).toThrow(/Project name/);
    expect(storage.getItem(AUTOSAVE_STORAGE_KEY)).toBe(invalid);
  });

  it('validates both document and identity before any write and surfaces quota failures', () => {
    const storage = new MemoryStorage();
    autosaveDraftSession(storage, document());
    const raw = storage.getItem(AUTOSAVE_STORAGE_KEY);
    expect(() => autosaveDraftSession(storage, { ...document(), name: '' }, 'project-A')).toThrow(/Project name/);
    expect(() => autosaveDraftSession(storage, document(), 'bad id')).toThrow(/Project ID/);
    expect(storage.getItem(AUTOSAVE_STORAGE_KEY)).toBe(raw);
    expect(() => autosaveDraftSession({ setItem: () => { throw new Error('Quota exceeded'); } }, document(), 'project-A')).toThrow('Quota exceeded');
  });
});
