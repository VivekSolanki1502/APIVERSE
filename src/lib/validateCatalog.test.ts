import { describe, expect, it } from 'vitest';
import raw from '../data/catalog.json';
import { summarize, validateCatalog } from './validateCatalog';

interface MutablePricing {
  freeTier: { available: unknown };
  lastVerified: string | null;
}
interface MutableApi {
  id: string;
  documentationUrl: string;
  baseUrl: string;
  pricing: MutablePricing;
  addedOn: string;
  sampleRequest: unknown;
  https: boolean;
}
const clone = () => JSON.parse(JSON.stringify(raw)) as { schemaVersion: number; apis: MutableApi[] };
const errorsOf = (c: unknown) => summarize(validateCatalog(c, '2026-10-13')).errors.map((e) => e.message);

describe('catalog validator', () => {
  it('accepts the shipped catalog', () => {
    expect(errorsOf(raw)).toEqual([]);
  });
  it('detects duplicate ids', () => {
    const c = clone();
    c.apis.push({ ...c.apis[0]! });
    expect(errorsOf(c).join(' ')).toMatch(/Duplicate id/);
  });
  it('detects missing documentation and bad URLs', () => {
    const c = clone();
    c.apis[0]!.documentationUrl = '';
    c.apis[1]!.baseUrl = 'not-a-url';
    expect(errorsOf(c).join(' ')).toMatch(/documentation/i);
    expect(errorsOf(c).join(' ')).toMatch(/baseUrl/);
  });
  it('detects contradictory pricing labels', () => {
    const c = clone();
    const a = c.apis.find((x) => x.id === 'pokeapi')!;
    a.pricing.freeTier.available = false;
    expect(errorsOf(c).join(' ')).toMatch(/Contradiction/);
  });
  it('requires verification metadata on verified entries', () => {
    const c = clone();
    const a = c.apis.find((x) => x.id === 'pokeapi')!;
    a.pricing.lastVerified = null;
    expect(errorsOf(c).join(' ')).toMatch(/lastVerified/);
  });
  it('rejects future verification dates and invalid dates', () => {
    const c = clone();
    c.apis[0]!.pricing.lastVerified = '2099-01-01';
    c.apis[1]!.addedOn = '2026-02-31';
    const e = errorsOf(c).join(' ');
    expect(e).toMatch(/future/);
    expect(e).toMatch(/addedOn/);
  });
  it('rejects credential-looking values in samples', () => {
    const c = clone();
    c.apis[0]!.sampleRequest = { method: 'GET', path: '/x', query: { key: 'abcdefghijklmnopqrstuvwxyz012345' }, headers: {}, body: null };
    expect(errorsOf(c).join(' ')).toMatch(/credential/);
  });
  it('rejects https flag that disagrees with baseUrl', () => {
    const c = clone();
    c.apis[0]!.https = false;
    expect(errorsOf(c).join(' ')).toMatch(/https/);
  });
});
