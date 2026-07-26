// Tiny localStorage-backed cache for stale-while-revalidate.
// We snapshot the last-known dataset/todos so the app can paint INSTANTLY on
// boot, then revalidate in the background. Bump VERSION to invalidate old shapes.
const VERSION = 'v1';
const PREFIX = `ideacrm_cache_${VERSION}_`;

export const cacheGet = <T = any>(key: string): T | null => {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
};

export const cacheSet = (key: string, value: unknown): void => {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    // Quota exceeded or serialization issue — cache is best-effort, ignore.
  }
};

export const cacheRemove = (key: string): void => {
  try {
    localStorage.removeItem(PREFIX + key);
  } catch {
    /* ignore */
  }
};

// Clear every cache entry (e.g. on logout) without touching other localStorage keys.
export const cacheClear = (): void => {
  try {
    Object.keys(localStorage)
      .filter(k => k.startsWith(PREFIX))
      .forEach(k => localStorage.removeItem(k));
  } catch {
    /* ignore */
  }
};

export const CACHE_KEYS = {
  appData: 'appdata',
  todos: 'todos',
} as const;
