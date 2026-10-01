import { MAX_CARGO_PIECES, type CargoItem, type PackingStrategy, type SpaceConfig } from './model';
import { validateSpace } from './packing';

export interface StudioDocument {
  name: string;
  space: SpaceConfig;
  items: CargoItem[];
  strategy: PackingStrategy;
}

export interface SavedProject extends StudioDocument {
  id: string;
  updatedAt: string;
}

export interface DraftSession {
  document: StudioDocument;
  projectId?: string;
}

export interface ProjectStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export const PROJECTS_STORAGE_KEY = 'cargo-twin-projects-v2';
export const AUTOSAVE_STORAGE_KEY = 'cargo-twin-autosave-v2';
export const LEGACY_STORAGE_KEY = 'cargo-twin-studio-v1';
export const MAX_SAVED_PROJECTS = 50;
export const MAX_DOCUMENT_CHARACTERS = 2_000_000;
const MAX_STORED_CHARACTERS = 8_000_000;
const LEGACY_PROJECT_ID = 'legacy-project';
const PRINTABLE_TEXT = /[\u0000-\u001f\u007f-\u009f]/;
const VALID_ID = /^[\p{L}\p{N}_-]{1,64}$/u;
const STRATEGIES: PackingStrategy[] = ['max-fill', 'balanced', 'gentle'];

function object(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} must be an object.`);
  return value as Record<string, unknown>;
}

function text(value: unknown, label: string): string {
  if (typeof value !== 'string' || !value.trim() || value.length > 120 || PRINTABLE_TEXT.test(value)) {
    throw new Error(`${label} needs 1–120 printable characters.`);
  }
  return value;
}

function identifier(value: unknown, label: string): string {
  if (typeof value !== 'string' || !VALID_ID.test(value)) throw new Error(`${label} needs 1–64 letters, numbers, hyphens or underscores.`);
  return value;
}

export function parseProjectId(value: unknown): string {
  return identifier(value, 'Project ID');
}

function number(value: unknown, label: string, minimum: number, maximum: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < minimum || value > maximum) {
    throw new Error(`${label} must be between ${minimum.toLocaleString('en')} and ${maximum.toLocaleString('en')}.`);
  }
  return value;
}

function flag(value: unknown, label: string): boolean {
  if (typeof value !== 'boolean') throw new Error(`${label} must be true or false.`);
  return value;
}

function parseSpace(value: unknown): SpaceConfig {
  const source = object(value, 'Load space');
  const mode = source.mode;
  if (mode !== 'road' && mode !== 'sea' && mode !== 'air' && mode !== 'rail' && mode !== 'custom') throw new Error('Load space needs a supported transport mode.');
  const space: SpaceConfig = {
    id: identifier(source.id, 'Space ID'), name: text(source.name, 'Space name'), mode,
    lengthCm: number(source.lengthCm, 'Space length (cm)', 0.1, 100_000),
    widthCm: number(source.widthCm, 'Space width (cm)', 0.1, 100_000),
    heightCm: number(source.heightCm, 'Space height (cm)', 0.1, 100_000),
    maxPayloadKg: number(source.maxPayloadKg, 'Payload (kg)', Number.MIN_VALUE, 1_000_000_000),
    clearanceCm: number(source.clearanceCm, 'Clearance (cm)', 0, 100_000),
    reservedDepthCm: number(source.reservedDepthCm, 'Reserved rear depth (cm)', 0, 100_000),
  };
  const errors = validateSpace(space);
  if (errors.length) throw new Error(errors.join(' '));
  return space;
}

/** Validates rows without expanding quantities or running the packing heuristic. */
export function parseCargoItems(value: unknown): CargoItem[] {
  if (!Array.isArray(value) || value.length > MAX_CARGO_PIECES) throw new Error(`Cargo needs a list of 0–${MAX_CARGO_PIECES} rows.`);
  const ids = new Set<string>();
  return value.map((entry, index) => {
    const label = `Cargo row ${index + 1}`;
    const source = object(entry, label);
    const id = identifier(source.id, `${label} ID`);
    if (ids.has(id)) throw new Error(`${label} has duplicate ID “${id}”. Each cargo row needs a unique ID.`);
    ids.add(id);
    const priority = source.priority;
    if (priority !== 'low' && priority !== 'normal' && priority !== 'high') throw new Error(`${label} priority must be low, normal or high.`);
    if (typeof source.color !== 'string' || !/^#[0-9a-f]{6}$/i.test(source.color)) throw new Error(`${label} color must be a six-digit hexadecimal color, such as #78d9c4.`);
    const quantity = number(source.quantity, `${label} quantity`, 1, 10_000);
    if (!Number.isSafeInteger(quantity)) throw new Error(`${label} quantity must be a whole number.`);
    return {
      id, name: text(source.name, `${label} name`), priority, color: source.color,
      lengthCm: number(source.lengthCm, `${label} length (cm)`, 0.1, 100_000),
      widthCm: number(source.widthCm, `${label} width (cm)`, 0.1, 100_000),
      heightCm: number(source.heightCm, `${label} height (cm)`, 0.1, 100_000),
      weightKg: number(source.weightKg, `${label} per-piece weight (kg)`, Number.MIN_VALUE, 1_000_000_000),
      quantity, fragile: flag(source.fragile, `${label} fragile`),
      keepUpright: flag(source.keepUpright, `${label} keepUpright`),
      stackable: flag(source.stackable, `${label} stackable`),
      maxTopLoadKg: number(source.maxTopLoadKg, `${label} top-load allowance (kg)`, 0, 1_000_000_000),
    };
  });
}

export function parseDocument(value: unknown): StudioDocument {
  const source = object(value, 'Cargo Twin scenario');
  if (source.version !== undefined && source.version !== 1 && source.version !== 2) throw new Error('This scenario version is not supported. Use a Cargo Twin version 1 or 2 export.');
  if (source.format !== undefined && source.format !== 'cargo-twin') throw new Error('Choose a Cargo Twin scenario export.');
  const strategy = source.strategy === undefined ? 'max-fill' : source.strategy;
  if (!STRATEGIES.includes(strategy as PackingStrategy)) throw new Error('Strategy must be max-fill, balanced or gentle.');
  return {
    name: source.name === undefined ? 'Untitled load plan' : text(source.name, 'Project name'),
    space: parseSpace(source.space), items: parseCargoItems(source.items), strategy: strategy as PackingStrategy,
  };
}

export function serializeDocument(document: StudioDocument): string {
  return JSON.stringify({ format: 'cargo-twin', version: 2, ...parseDocument(document) }, null, 2);
}

function parseStoredJson(raw: string, label: string): unknown {
  if (raw.length > MAX_STORED_CHARACTERS) throw new Error(`${label} exceeds the local storage size limit.`);
  try { return JSON.parse(raw) as unknown; }
  catch { throw new Error(`${label} is damaged or is not valid JSON. Export or preserve the stored data before replacing it.`); }
}

function parseSavedProject(value: unknown): SavedProject {
  const source = object(value, 'Saved project');
  const id = identifier(source.id, 'Saved project ID');
  const updatedAt = source.updatedAt;
  if (typeof updatedAt !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(updatedAt) || !Number.isFinite(Date.parse(updatedAt)) || new Date(updatedAt).toISOString() !== updatedAt) {
    throw new Error('Saved project needs a valid save timestamp.');
  }
  return { ...parseDocument(source), id, updatedAt };
}

export function readProjects(storage: Pick<ProjectStorage, 'getItem'>): SavedProject[] {
  const raw = storage.getItem(PROJECTS_STORAGE_KEY);
  if (raw === null) {
    const legacy = storage.getItem(LEGACY_STORAGE_KEY);
    if (legacy === null) return [];
    return [{ ...parseDocument(parseStoredJson(legacy, 'Legacy scenario')), name: 'Recovered scenario', id: LEGACY_PROJECT_ID, updatedAt: '1970-01-01T00:00:00.000Z' }];
  }
  const source = object(parseStoredJson(raw, 'Saved projects'), 'Saved projects');
  if (source.version !== 2 || !Array.isArray(source.projects) || source.projects.length > MAX_SAVED_PROJECTS) throw new Error(`Saved projects needs a version 2 collection with at most ${MAX_SAVED_PROJECTS} projects.`);
  const projects = source.projects.map(parseSavedProject);
  if (new Set(projects.map(project => project.id)).size !== projects.length) throw new Error('Saved projects contain duplicate project IDs. Preserve the stored data before replacing it.');
  return projects;
}

function writeProjects(storage: Pick<ProjectStorage, 'setItem'>, projects: SavedProject[]): SavedProject[] {
  const raw = JSON.stringify({ version: 2, projects });
  if (raw.length > MAX_STORED_CHARACTERS) throw new Error('Saved projects exceed the local storage size limit. Export a project and remove an older saved copy.');
  storage.setItem(PROJECTS_STORAGE_KEY, raw);
  return projects;
}

/** Returns the saved project first, followed by the other projects. Writes happen only after validation. */
export function saveProject(storage: Pick<ProjectStorage, 'getItem' | 'setItem'>, id: string | undefined, document: StudioDocument): SavedProject[] {
  const parsed = parseDocument(document);
  const projects = readProjects(storage);
  if (id !== undefined && !projects.some(project => project.id === id)) throw new Error('This saved project no longer exists. Save a new project instead.');
  if (id === undefined && projects.length >= MAX_SAVED_PROJECTS) throw new Error(`You can save up to ${MAX_SAVED_PROJECTS} projects on this device. Export and delete an older project first.`);
  const projectId = id ?? `project-${globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`}`;
  if (id === undefined && projects.some(project => project.id === projectId)) throw new Error('Could not create a unique project ID. Try saving again.');
  const saved: SavedProject = { ...parsed, id: projectId, updatedAt: new Date().toISOString() };
  return writeProjects(storage, [saved, ...projects.filter(project => project.id !== projectId)]);
}

export function deleteProject(storage: Pick<ProjectStorage, 'getItem' | 'setItem'>, id: string): SavedProject[] {
  const projects = readProjects(storage);
  return writeProjects(storage, projects.filter(project => project.id !== id));
}

export function loadProject(storage: Pick<ProjectStorage, 'getItem'>, id: string): SavedProject | null {
  return readProjects(storage).find(project => project.id === id) ?? null;
}

export function readAutosave(storage: Pick<ProjectStorage, 'getItem'>): StudioDocument | null {
  const raw = storage.getItem(AUTOSAVE_STORAGE_KEY);
  return raw === null ? null : parseDocument(parseStoredJson(raw, 'Autosaved draft'));
}

export function autosaveDocument(storage: Pick<ProjectStorage, 'setItem'>, document: StudioDocument): void {
  storage.setItem(AUTOSAVE_STORAGE_KEY, serializeDocument(document));
}

export function readDraftSession(storage: Pick<ProjectStorage, 'getItem'>): DraftSession | null {
  const raw = storage.getItem(AUTOSAVE_STORAGE_KEY);
  if (raw === null) return null;
  const source = object(parseStoredJson(raw, 'Autosaved draft'), 'Autosaved draft');
  const document = parseDocument(source);
  if (source.projectId === undefined) return { document };
  try {
    const projectId = parseProjectId(source.projectId);
    return readProjects(storage).some(project => project.id === projectId) ? { document, projectId } : { document };
  } catch {
    // A damaged or unavailable library must not prevent recovery of a valid draft.
    return { document };
  }
}

export function autosaveDraftSession(storage: Pick<ProjectStorage, 'setItem'>, document: StudioDocument, projectId?: string): void {
  const parsed = parseDocument(document);
  const id = projectId === undefined ? undefined : parseProjectId(projectId);
  storage.setItem(AUTOSAVE_STORAGE_KEY, JSON.stringify({ format: 'cargo-twin', version: 2, ...parsed, projectId: id }, null, 2));
}

export function clearAutosave(storage: Pick<ProjectStorage, 'removeItem'>): void {
  storage.removeItem(AUTOSAVE_STORAGE_KEY);
}
