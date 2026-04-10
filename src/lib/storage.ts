import type { SetProgress } from './types';

const STORAGE_PREFIX = 'pypecker:';
const PROGRESS_KEY = (setId: string) => `${STORAGE_PREFIX}progress:${setId}`;
const PROGRESS_INDEX_KEY = `${STORAGE_PREFIX}progress:index`;

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function readIndex(): string[] {
  if (!isBrowser()) return [];
  try {
    const raw = window.localStorage.getItem(PROGRESS_INDEX_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

function writeIndex(ids: string[]): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(PROGRESS_INDEX_KEY, JSON.stringify(ids));
  } catch (err) {
    console.warn('[pypecker] failed to persist progress index', err);
  }
}

export function saveSetProgress(progress: SetProgress): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(PROGRESS_KEY(progress.setId), JSON.stringify(progress));
    const index = readIndex();
    if (!index.includes(progress.setId)) {
      index.push(progress.setId);
      writeIndex(index);
    }
  } catch (err) {
    console.warn('[pypecker] failed to save progress', err);
  }
}

export function loadSetProgress(setId: string): SetProgress | null {
  if (!isBrowser()) return null;
  try {
    const raw = window.localStorage.getItem(PROGRESS_KEY(setId));
    if (!raw) return null;
    return JSON.parse(raw) as SetProgress;
  } catch (err) {
    console.warn(`[pypecker] failed to load progress for set ${setId}`, err);
    return null;
  }
}

export function loadAllProgress(): SetProgress[] {
  if (!isBrowser()) return [];
  return readIndex()
    .map((id) => loadSetProgress(id))
    .filter((p): p is SetProgress => p !== null);
}

export function clearProgress(setId?: string): void {
  if (!isBrowser()) return;
  try {
    if (setId) {
      window.localStorage.removeItem(PROGRESS_KEY(setId));
      writeIndex(readIndex().filter((id) => id !== setId));
      return;
    }
    const toRemove: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (key && key.startsWith(STORAGE_PREFIX)) toRemove.push(key);
    }
    toRemove.forEach((key) => window.localStorage.removeItem(key));
  } catch (err) {
    console.warn('[pypecker] failed to clear progress', err);
  }
}
