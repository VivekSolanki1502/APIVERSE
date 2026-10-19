import { describe, expect, it } from 'vitest';
import { getApi } from './catalog';
import { STARTER_COLLECTIONS } from './curated';

describe('starter collections', () => {
  it('only reference real catalog entries, without duplicates', () => {
    for (const c of STARTER_COLLECTIONS) {
      expect(c.apiIds.length).toBeGreaterThan(0);
      expect(new Set(c.apiIds).size).toBe(c.apiIds.length);
      for (const id of c.apiIds) expect(getApi(id)?.id).toBe(id);
    }
  });

  it('has unique ids', () => {
    expect(new Set(STARTER_COLLECTIONS.map((c) => c.id)).size).toBe(STARTER_COLLECTIONS.length);
  });

  it('keeps the "no key needed" promise for the hackathon collection', () => {
    const c = STARTER_COLLECTIONS.find((x) => x.id === 'hackathon-no-key');
    expect(c).toBeDefined();
    for (const id of c?.apiIds ?? []) expect(getApi(id)?.authentication.required).toBe(false);
  });
});
