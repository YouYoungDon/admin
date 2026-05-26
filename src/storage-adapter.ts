import { ALL_STORAGE_KEYS } from './sobagi-schema';

export type RawStorageRow = {
  key: string;
  exists: boolean;
  raw: string | null;
  parsed: unknown;
  parseError: string | null;
};

export function loadJson<T>(key: string, fallback: T): T {
  const raw = window.localStorage.getItem(key);
  if (raw == null) return fallback;

  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function saveJson<T>(key: string, value: T): void {
  window.localStorage.setItem(key, JSON.stringify(value));
}

export function removeKey(key: string): void {
  window.localStorage.removeItem(key);
}

export function readRawValue(key: string): string {
  return window.localStorage.getItem(key) ?? '';
}

export function saveRawJson(key: string, rawJson: string): void {
  if (!rawJson.trim()) {
    removeKey(key);
    return;
  }
  window.localStorage.setItem(key, JSON.stringify(JSON.parse(rawJson)));
}

export function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

export function addToList(key: string, value: string): string[] {
  const next = unique([...loadJson<string[]>(key, []), value]);
  saveJson(key, next);
  return next;
}

export function removeFromList(key: string, value: string): string[] {
  const next = loadJson<string[]>(key, []).filter((id) => id !== value);
  saveJson(key, next);
  return next;
}

export function clearKeys(keys: string[]): void {
  for (const key of keys) removeKey(key);
}

export function readRawStorage(): RawStorageRow[] {
  return ALL_STORAGE_KEYS.map((key) => {
    const raw = window.localStorage.getItem(key);
    if (raw == null) {
      return { key, exists: false, raw: null, parsed: null, parseError: null };
    }

    try {
      return { key, exists: true, raw, parsed: JSON.parse(raw), parseError: null };
    } catch (error) {
      return {
        key,
        exists: true,
        raw,
        parsed: null,
        parseError: error instanceof Error ? error.message : String(error),
      };
    }
  });
}

export function todayString(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function yesterdayString(date = new Date()): string {
  const next = new Date(date);
  next.setDate(next.getDate() - 1);
  return todayString(next);
}
