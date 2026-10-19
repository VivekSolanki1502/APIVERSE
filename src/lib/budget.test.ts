import { describe, expect, it } from 'vitest';
import { apis } from './catalog';
import { DEFAULT_BUDGET_INPUT, findBudgetApis, pricingCategory } from './budget';

describe('findBudgetApis', () => {
  it('never lists unverified pricing as a confirmed recommendation', () => {
    const r = findBudgetApis(apis, DEFAULT_BUDGET_INPUT, new Date('2026-10-13'));
    expect(r.recommended.every((x) => x.api.pricing.verificationStatus === 'verified')).toBe(true);
    expect(r.needsReview.every((x) => x.api.pricing.verificationStatus !== 'verified')).toBe(true);
    expect(r.recommended.length + r.needsReview.length).toBeGreaterThan(0);
  });
  it('honours the no-auth preference', () => {
    const r = findBudgetApis(apis, { ...DEFAULT_BUDGET_INPUT, authPreference: 'none' });
    expect([...r.recommended, ...r.needsReview].every((x) => !x.api.authentication.required)).toBe(true);
  });
  it('excludes trial-only and self-hosted when asked', () => {
    const r = findBudgetApis(apis, { ...DEFAULT_BUDGET_INPUT, allowSelfHosted: false });
    expect([...r.recommended, ...r.needsReview].some((x) => x.category === 'self-hosted')).toBe(false);
  });
  it('explains every recommendation', () => {
    const r = findBudgetApis(apis, DEFAULT_BUDGET_INPUT);
    expect([...r.recommended, ...r.needsReview].every((x) => x.reasons.length > 0)).toBe(true);
  });
  it('states assumptions', () => {
    expect(findBudgetApis(apis, DEFAULT_BUDGET_INPUT).assumptions.length).toBeGreaterThan(0);
  });
  it('flags self-hosted as not free of cost', () => {
    const ollama = apis.find((a) => a.id === 'ollama');
    expect(ollama && pricingCategory(ollama)).toBe('self-hosted');
    const r = findBudgetApis(apis, DEFAULT_BUDGET_INPUT);
    const rec = [...r.recommended, ...r.needsReview].find((x) => x.api.id === 'ollama');
    expect(rec?.warnings.join(' ')).toMatch(/maintenance/i);
  });
});
