import { parseProjectId, type StudioDocument } from './projects';

export interface HistoryEntry {
  document: StudioDocument;
  projectId?: string;
}

export interface EditorHistory {
  present: StudioDocument;
  projectId?: string;
  past: HistoryEntry[];
  future: HistoryEntry[];
}

export const MAX_EDITOR_HISTORY = 40;

function cloneDocument(document: StudioDocument): StudioDocument {
  // Editor snapshots retain temporarily incomplete input; import/autosave validate at their own boundaries.
  return { ...document, space: { ...document.space }, items: document.items.map(item => ({ ...item })) };
}

function projectId(value: string | undefined): string | undefined {
  return value === undefined ? undefined : parseProjectId(value);
}

function snapshot(history: EditorHistory): HistoryEntry {
  return { document: cloneDocument(history.present), projectId: history.projectId };
}

function fieldsMatch(first: object, second: object): boolean {
  const firstEntries = Object.entries(first);
  const secondEntries = new Map(Object.entries(second));
  return firstEntries.length === secondEntries.size && firstEntries.every(([key, value]) => secondEntries.has(key) && Object.is(value, secondEntries.get(key)));
}

function documentsMatch(first: StudioDocument, second: StudioDocument): boolean {
  return first.name === second.name && first.strategy === second.strategy && fieldsMatch(first.space, second.space)
    && first.items.length === second.items.length && first.items.every((item, index) => fieldsMatch(item, second.items[index]));
}

export function createHistory(document: StudioDocument, id?: string): EditorHistory {
  return { present: cloneDocument(document), projectId: projectId(id), past: [], future: [] };
}

/** Omitting projectId preserves the binding; an explicit undefined starts a detached document. */
export function commitHistory(history: EditorHistory, change: HistoryEntry): EditorHistory {
  const id = Object.hasOwn(change, 'projectId') ? projectId(change.projectId) : history.projectId;
  if (id === history.projectId && documentsMatch(history.present, change.document)) return history;
  return { present: cloneDocument(change.document), projectId: id, past: [...history.past, snapshot(history)].slice(-MAX_EDITOR_HISTORY), future: [] };
}

export function travelHistory(history: EditorHistory, direction: 'undo' | 'redo'): EditorHistory {
  if (direction === 'undo') {
    const previous = history.past.at(-1);
    if (!previous) return history;
    return { present: cloneDocument(previous.document), projectId: previous.projectId, past: history.past.slice(0, -1), future: [snapshot(history), ...history.future].slice(0, MAX_EDITOR_HISTORY) };
  }
  const next = history.future[0];
  if (!next) return history;
  return { present: cloneDocument(next.document), projectId: next.projectId, past: [...history.past, snapshot(history)].slice(-MAX_EDITOR_HISTORY), future: history.future.slice(1) };
}

/** Saving or deleting binds the current snapshot without creating a content edit. */
export function bindProject(history: EditorHistory, id: string | undefined): EditorHistory {
  const nextId = projectId(id);
  return nextId === history.projectId ? history : { ...history, projectId: nextId };
}
