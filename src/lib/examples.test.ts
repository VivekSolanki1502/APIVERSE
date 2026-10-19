import { describe, expect, it } from 'vitest';
import { getApi } from './catalog';
import { generateExample } from './examples';

describe('generateExample', () => {
  it('builds cURL for a simple GET', () => {
    const out = generateExample(getApi('pokeapi')!, 'curl');
    expect(out).toBe("curl 'https://pokeapi.co/api/v2/pokemon/ditto'");
  });
  it('builds fetch with query params', () => {
    const out = generateExample(getApi('open-meteo')!, 'javascript')!;
    expect(out).toContain('https://api.open-meteo.com/v1/forecast?latitude=52.52');
    expect(out).toContain('await fetch(');
  });
  it('uses placeholders, never real credentials', () => {
    const out = generateExample(getApi('coingecko')!, 'python')!;
    expect(out).toContain('YOUR_API_KEY');
    expect(out).toContain('import requests');
  });
  it('handles POST bodies in all languages', () => {
    const api = getApi('anthropic-api')!;
    expect(generateExample(api, 'curl')).toContain('-X POST');
    expect(generateExample(api, 'javascript')).toContain('JSON.stringify(');
    expect(generateExample(api, 'python')).toContain('json=payload');
  });
  it('returns null when no sample is recorded', () => {
    expect(generateExample({ ...getApi('pokeapi')!, sampleRequest: null }, 'curl')).toBeNull();
  });
});
