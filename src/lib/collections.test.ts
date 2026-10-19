import { describe, expect, it } from 'vitest';
import { decodeShare, encodeShare, newCollection, parseImport, toExport } from './collections';

const known = new Set(['pokeapi', 'open-meteo']);

describe('collections', () => {
  it('round-trips an export', () => {
    const c = newCollection('My stack', ['pokeapi', 'pokeapi', 'open-meteo']);
    expect(c.apiIds).toEqual(['pokeapi', 'open-meteo']);
    const r = parseImport(JSON.stringify(toExport(c)), known);
    expect(r).toEqual({ ok: true, name: 'My stack', apiIds: ['pokeapi', 'open-meteo'], skipped: [] });
  });
  it('rejects bad input safely', () => {
    expect(parseImport('{nope', known).ok).toBe(false);
    expect(parseImport('[]', known).ok).toBe(false);
    expect(parseImport(JSON.stringify({ format: 'x', version: 1 }), known).ok).toBe(false);
  });
  it('skips unknown or malformed ids instead of trusting them', () => {
    const r = parseImport(JSON.stringify({ format: 'apiverse-collection', version: 1, name: 'x', apiIds: ['pokeapi', '../etc', 'nope', 5] }), known);
    expect(r).toMatchObject({ ok: true, apiIds: ['pokeapi'] });
    expect(r.ok && r.skipped).toHaveLength(3);
  });
  it('share links round-trip and reject garbage', () => {
    const token = encodeShare({ name: 'Ünïcode ✓', apiIds: ['pokeapi'] });
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(decodeShare(token, known)).toMatchObject({ ok: true, name: 'Ünïcode ✓', apiIds: ['pokeapi'] });
    expect(decodeShare('%%%', known).ok).toBe(false);
  });
});
