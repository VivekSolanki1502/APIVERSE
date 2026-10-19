/** Tiny localStorage-backed store usable with useSyncExternalStore. */
import { readJson, writeJson } from './storage';

export interface Store<T> {
  get: () => T;
  set: (next: T | ((prev: T) => T)) => void;
  subscribe: (listener: () => void) => () => void;
}

export function createStore<T>(key: string, initial: T, validate: (v: unknown) => v is T): Store<T> {
  let value = readJson<T>(key, initial, validate);
  const listeners = new Set<() => void>();
  return {
    get: () => value,
    set: (next) => {
      value = typeof next === 'function' ? (next as (p: T) => T)(value) : next;
      writeJson(key, value); // best effort: the app keeps working in memory if storage is blocked
      listeners.forEach((l) => l());
    },
    subscribe: (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
  };
}
