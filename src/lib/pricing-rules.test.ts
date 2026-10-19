import { describe, expect, it } from 'vitest';
import { apis, getApi } from './catalog';
import { DEFAULT_BUDGET_INPUT, findBudgetApis, pricingCategory } from './budget';
import { estimateApi } from './cost';
import { formatMoney, freeTierSummary, VERIFICATION_LABEL } from './format';
import { DEFAULT_PARAMS, searchApis } from './search';
import type { ApiEntry } from '../types/catalog';

const base = getApi('pokeapi')!;
const withPricing = (patch: Partial<ApiEntry['pricing']>, id = 'x'): ApiEntry => ({ ...base, id, pricing: { ...base.pricing, ...patch } });

describe('pricing honesty rules', () => {
  it('trial-only offers are never categorized or recommended as free forever', () => {
    const trial = withPricing({ model: 'free-trial', trial: { available: true, durationDays: 14, creditAmount: 10, creditsExpire: true }, freeTier: { available: false, quota: null, unit: null, period: null } }, 'trial');
    expect(pricingCategory(trial)).toBe('free-trial');
    expect(pricingCategory(trial)).not.toBe('free-no-expiry');
    const off = findBudgetApis([trial], { ...DEFAULT_BUDGET_INPUT, allowTrial: false });
    expect(off.recommended.length + off.needsReview.length).toBe(0);
    const on = findBudgetApis([trial], { ...DEFAULT_BUDGET_INPUT, allowTrial: true });
    const rec = [...on.recommended, ...on.needsReview][0]!;
    expect(rec.warnings.join(' ')).toMatch(/not free long-term/);
    expect(rec.reasons.join(' ')).not.toMatch(/free with no scheduled expiry/);
  });

  it('unverified records are never presented as verified or as confirmed recommendations', () => {
    const unverified = withPricing({ verificationStatus: 'needs-review', lastVerified: null }, 'u');
    const r = findBudgetApis([unverified], DEFAULT_BUDGET_INPUT);
    expect(r.recommended).toHaveLength(0);
    expect(r.needsReview).toHaveLength(1);
    expect(VERIFICATION_LABEL['needs-review']).not.toMatch(/verified$/i);
    // every catalog entry labelled verified has a date and notes
    for (const a of apis.filter((x) => x.pricing.verificationStatus === 'verified')) {
      expect(a.pricing.lastVerified).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(Boolean(a.pricing.verificationNotes)).toBe(true);
    }
  });

  it('missing prices never become zero in estimates', () => {
    const meteo = getApi('open-meteo')!;
    const est = estimateApi(meteo, { monthlyRequests: 2_000_000 });
    expect(est.length).toBeGreaterThan(0);
    // paid plan prices are unknown in the catalog, so they must not be estimated as 0
    expect(est.every((e) => !e.result.ok)).toBe(true);
  });

  it('unknown free-tier data is shown as unknown, not as none or zero', () => {
    const unknown = withPricing({ freeTier: { available: null, quota: null, unit: null, period: null } });
    expect(freeTierSummary(unknown)).toBe('Free tier unknown');
    expect(freeTierSummary(withPricing({ freeTier: { available: true, quota: null, unit: null, period: null } }))).toMatch(/not recorded/);
  });

  it('formats currency, and says so when the currency is unknown', () => {
    expect(formatMoney(35, 'USD')).toBe('$35.00');
    expect(formatMoney(35, 'EUR')).toContain('€');
    expect(formatMoney(35, null)).toMatch(/currency not recorded/);
  });

  it('self-hosted software is not treated as zero-cost', () => {
    const ollama = getApi('ollama')!;
    expect(ollama.limitations.join(' ')).toMatch(/costs/i);
  });
});

describe('combined filters and sorting', () => {
  it('applies every filter together', () => {
    const r = searchApis(apis, { ...DEFAULT_PARAMS, category: 'Weather', auth: 'none', httpsOnly: true, freeTier: true });
    expect(r.length).toBeGreaterThan(0);
    expect(r.every((a) => a.category === 'Weather' && !a.authentication.required && a.https)).toBe(true);
  });
  it('narrows results as filters are added', () => {
    const a = searchApis(apis, { ...DEFAULT_PARAMS, q: 'data' }).length;
    const b = searchApis(apis, { ...DEFAULT_PARAMS, q: 'data', auth: 'none' }).length;
    expect(b <= a).toBe(true);
  });
  it('sorts by recently verified with verified entries first', () => {
    const r = searchApis(apis, { ...DEFAULT_PARAMS, sort: 'verified' });
    expect(r[0]?.pricing.lastVerified).not.toBeNull();
    const dates = r.map((x) => x.pricing.lastVerified ?? '');
    expect(dates).toEqual([...dates].sort((x, y) => y.localeCompare(x)));
  });
  it('returns nothing, not an error, for impossible combinations', () => {
    expect(searchApis(apis, { ...DEFAULT_PARAMS, category: 'Weather', q: 'pokemon' })).toHaveLength(0);
  });
});
