/** Guarded localStorage helpers. Storage can be unavailable or corrupt; the app must still work. */

export function readJson<T>(key: string, fallback: T, validate: (v: unknown) => v is T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    const parsed: unknown = JSON.parse(raw);
    return validate(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

export function writeJson(key: string, value: unknown): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export const KEYS = {
  theme: 'apiverse:theme',
  favorites: 'apiverse:favorites',
  collections: 'apiverse:collections',
  compare: 'apiverse:compare',
} as const;
