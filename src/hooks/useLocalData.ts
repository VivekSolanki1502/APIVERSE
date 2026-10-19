import { useCallback, useSyncExternalStore } from 'react';
import { createStore } from '../lib/store';
import { KEYS } from '../lib/storage';
import { newCollection, type Collection } from '../lib/collections';

const isStrArr = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === 'string');
const isCollections = (v: unknown): v is Collection[] =>
  Array.isArray(v) &&
  v.every((c) => typeof c === 'object' && c !== null && typeof c.id === 'string' && typeof c.name === 'string' && isStrArr(c.apiIds));

const favoritesStore = createStore<string[]>(KEYS.favorites, [], isStrArr);
const collectionsStore = createStore<Collection[]>(KEYS.collections, [], isCollections);
const compareStore = createStore<string[]>(KEYS.compare, [], isStrArr);

export const MAX_COMPARE = 4;

export function useFavorites() {
  const favorites = useSyncExternalStore(favoritesStore.subscribe, favoritesStore.get);
  const toggle = useCallback((id: string) => favoritesStore.set((f) => (f.includes(id) ? f.filter((x) => x !== id) : [...f, id])), []);
  return { favorites, isFavorite: (id: string) => favorites.includes(id), toggle };
}

export function useCompare() {
  const ids = useSyncExternalStore(compareStore.subscribe, compareStore.get);
  const toggle = useCallback((id: string) => compareStore.set((c) => (c.includes(id) ? c.filter((x) => x !== id) : c.length >= MAX_COMPARE ? c : [...c, id])), []);
  const clear = useCallback(() => compareStore.set([]), []);
  const set = useCallback((next: string[]) => compareStore.set(next.slice(0, MAX_COMPARE)), []);
  return { ids, has: (id: string) => ids.includes(id), toggle, clear, set, full: ids.length >= MAX_COMPARE };
}

export function useCollections() {
  const collections = useSyncExternalStore(collectionsStore.subscribe, collectionsStore.get);
  const create = useCallback((name: string, apiIds: string[] = []) => {
    const c = newCollection(name, apiIds);
    collectionsStore.set((all) => [...all, c]);
    return c;
  }, []);
  const remove = useCallback((id: string) => collectionsStore.set((all) => all.filter((c) => c.id !== id)), []);
  const rename = useCallback((id: string, name: string) => collectionsStore.set((all) => all.map((c) => (c.id === id ? { ...c, name: newCollection(name).name } : c))), []);
  const toggleApi = useCallback(
    (id: string, apiId: string) =>
      collectionsStore.set((all) => all.map((c) => (c.id === id ? { ...c, apiIds: c.apiIds.includes(apiId) ? c.apiIds.filter((x) => x !== apiId) : [...c.apiIds, apiId] } : c))),
    [],
  );
  return { collections, create, remove, rename, toggleApi };
}
