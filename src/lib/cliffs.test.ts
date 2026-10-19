import { describe, expect, it } from 'vitest';
import { apis } from './catalog';
import { costAt, costCurve, logSpaced } from './cliffs';

const get = (id: string) => apis.find((a) => a.id === id)!;

describe('cost cliffs', () => {
  it('finds exact CoinGecko breakpoints from recorded plans', () => {
    const c = costCurve(get('coingecko'), 1_000_000);
    expect(c.estimable).toBe(true);
    const free = c.cliffs.find((x) => x.kind === 'free-ends')!;
    expect(free.fromRequests).toBe(10_001);
    expect(free.toTotal).toBe(35);
    expect(costAt(get('coingecko'), 10_000).total).toBe(0);
    const gap = c.cliffs.find((x) => x.kind === 'not-estimable')!;
    expect(gap.fromRequests).toBe(100_001);
    expect(costAt(get('coingecko'), 100_001).total).toBeNull();
  });
  it('never invents a cost when nothing can be estimated', () => {
    const c = costCurve({ ...get('coingecko'), pricing: { ...get('coingecko').pricing, plans: [] } });
    expect(c.estimable).toBe(false);
    expect(c.cliffs).toEqual([]);
    expect(c.points.every((p) => p.total === null)).toBe(true);
  });
  it('samples on a sorted, unique log scale including both ends', () => {
    const s = logSpaced(1_000_000);
    expect(s[0]).toBe(1);
    expect(s[s.length - 1]).toBe(1_000_000);
    expect(s.every((v, i) => i === 0 || v > s[i - 1]!)).toBe(true);
  });
  it('reports no cliffs for APIs without plans', () => {
    expect(costCurve(get('pokeapi')).cliffs).toEqual([]);
  });
});
