import { describe, expect, it } from 'vitest';
import { DEFAULT_BUDGET_INPUT } from './budget';
import { BUDGET_MODES, budgetToParams, calcToParams, modeOf, paramsToBudget, paramsToCalc } from './budgetUrl';

describe('budget URL state', () => {
  it('omits defaults', () => {
    expect(budgetToParams(DEFAULT_BUDGET_INPUT).toString()).toBe('');
  });

  it('round-trips a filled brief', () => {
    const input = { ...DEFAULT_BUDGET_INPUT, category: 'Weather' as const, keywords: 'forecast', monthlyRequests: 50000, maxBudget: 20, currency: 'EUR' as const, allowPaid: false, allowTrial: true };
    expect(paramsToBudget(budgetToParams(input))).toEqual(input);
  });

  it('ignores invalid and hostile values', () => {
    const i = paramsToBudget(new URLSearchParams('cat=<script>&req=-5&max=abc&cur=XYZ&auth=evil&kw=' + 'x'.repeat(500)));
    expect(i.category).toBe('');
    expect(i.monthlyRequests).toBeNull();
    expect(i.maxBudget).toBeNull();
    expect(i.currency).toBe('USD');
    expect(i.authPreference).toBe('any');
    expect(i.keywords).toHaveLength(100);
  });

  it('applies a named mode and lets explicit flags override it', () => {
    expect(paramsToBudget(new URLSearchParams('mode=free-only')).allowPaid).toBe(false);
    expect(paramsToBudget(new URLSearchParams('mode=free-only&paid=1')).allowPaid).toBe(true);
  });

  it('recognises presets and custom flag combinations', () => {
    for (const m of BUDGET_MODES) expect(modeOf(m.flags)).toBe(m.id);
    expect(modeOf({ allowPaid: false, allowTrial: true, allowSelfHosted: true })).toBeNull();
  });

  it('round-trips calculator state and falls back for unknown ids', () => {
    const p = calcToParams({ apiId: 'coingecko', usage: { monthlyRequests: 1200 } }, new URLSearchParams());
    expect(paramsToCalc(p, ['coingecko', 'open-meteo'], 'open-meteo')).toEqual({ apiId: 'coingecko', usage: { monthlyRequests: 1200 } });
    expect(paramsToCalc(new URLSearchParams('calc=nope'), ['open-meteo'], 'open-meteo').apiId).toBe('open-meteo');
  });
});
