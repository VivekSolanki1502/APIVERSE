import { describe, expect, it } from 'vitest';
import { apis } from './catalog';
import { DEFAULT_PARAMS, paginate, paramsToQuery, queryToParams, searchApis } from './search';

describe('searchApis', () => {
  it('returns everything with default params', () => {
    expect(searchApis(apis, DEFAULT_PARAMS)).toHaveLength(apis.length);
  });
  it('finds by name, tag and category', () => {
    expect(searchApis(apis, { ...DEFAULT_PARAMS, q: 'pokeapi' })[0]?.id).toBe('pokeapi');
    expect(searchApis(apis, { ...DEFAULT_PARAMS, q: 'geocoding' }).map((a) => a.id)).toContain('nominatim');
    expect(searchApis(apis, { ...DEFAULT_PARAMS, q: 'weather' }).map((a) => a.id)).toContain('open-meteo');
  });
  it('requires every token to match', () => {
    expect(searchApis(apis, { ...DEFAULT_PARAMS, q: 'weather zzzzqqq' })).toHaveLength(0);
  });
  it('filters by auth, verification and category', () => {
    expect(searchApis(apis, { ...DEFAULT_PARAMS, auth: 'none' }).every((a) => !a.authentication.required)).toBe(true);
    expect(searchApis(apis, { ...DEFAULT_PARAMS, verifiedOnly: true }).every((a) => a.pricing.verificationStatus === 'verified')).toBe(true);
    expect(searchApis(apis, { ...DEFAULT_PARAMS, category: 'Weather' }).every((a) => a.category === 'Weather')).toBe(true);
  });
  it('sorts by name', () => {
    const names = searchApis(apis, { ...DEFAULT_PARAMS, sort: 'name' }).map((a) => a.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
  });
});

describe('url state', () => {
  it('round-trips params', () => {
    const p = { ...DEFAULT_PARAMS, q: 'maps', auth: 'none' as const, freeTier: true, page: 2 };
    expect(queryToParams(paramsToQuery(p))).toEqual(p);
  });
  it('tolerates garbage', () => {
    expect(queryToParams(new URLSearchParams('page=-5&sort=zzz&auth=x')).page).toBe(1);
  });
  it('paginates and clamps', () => {
    const r = paginate([1, 2, 3, 4, 5], 99, 2);
    expect(r).toMatchObject({ page: 3, pages: 3, items: [5] });
  });
});
