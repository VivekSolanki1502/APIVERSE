import { beforeEach, describe, expect, it } from 'vitest';
import { createStore } from './store';
import { newCollection, toExport } from './collections';

class MemoryStorage {
  data = new Map<string, string>();
  getItem(k: string) { return this.data.get(k) ?? null; }
  setItem(k: string, v: string) { this.data.set(k, v); }
}
const isStrArr = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === 'string');

describe('local persistence', () => {
  beforeEach(() => {
    (globalThis as unknown as { localStorage: unknown }).localStorage = new MemoryStorage();
  });

  it('favorites persist across reloads', () => {
    const a = createStore<string[]>('k', [], isStrArr);
    a.set((f) => [...f, 'pokeapi']);
    const b = createStore<string[]>('k', [], isStrArr); // simulates a page reload
    expect(b.get()).toEqual(['pokeapi']);
  });

  it('falls back safely on corrupt data', () => {
    localStorage.setItem('k', '{not json');
    expect(createStore<string[]>('k', [], isStrArr).get()).toEqual([]);
    localStorage.setItem('k', JSON.stringify({ wrong: true }));
    expect(createStore<string[]>('k', [], isStrArr).get()).toEqual([]);
  });

  it('keeps working in memory when storage throws', () => {
    (globalThis as unknown as { localStorage: unknown }).localStorage = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
    const s = createStore<string[]>('k', [], isStrArr);
    s.set(['x']);
    expect(s.get()).toEqual(['x']);
  });

  it('notifies subscribers', () => {
    const s = createStore<string[]>('k', [], isStrArr);
    let n = 0;
    const off = s.subscribe(() => n++);
    s.set(['a']);
    off();
    s.set(['b']);
    expect(n).toBe(1);
  });

  it('collections hold only a name and public ids, so API keys cannot be persisted or exported', () => {
    const c = newCollection('My stack', ['pokeapi']);
    expect(Object.keys(c).sort()).toEqual(['apiIds', 'createdAt', 'id', 'name']);
    expect(Object.keys(toExport(c)).sort()).toEqual(['apiIds', 'format', 'name', 'version']);
  });
});
