import { describe, expect, it } from 'vitest';
import { estimateBilling, requestCost } from './cost';

describe('requestCost', () => {
  it('never bills negative usage', () => {
    expect(requestCost(500, 1000, 0.01, null)).toEqual({ billable: 0, cost: 0 });
  });
  it('bills per request', () => {
    expect(requestCost(1500, 1000, 0.01, null)).toEqual({ billable: 500, cost: 5 });
  });
  it('rounds up to billed blocks only when the provider does', () => {
    expect(requestCost(1001, 0, 2, 1000).cost).toBe(4); // ceil(1001/1000) * 2
    expect(requestCost(1001, 0, 0.002, null).cost).toBeCloseTo(2.002);
  });
});

describe('estimateBilling', () => {
  it('requests: includes breakdown', () => {
    const r = estimateBilling(10, { kind: 'requests', includedRequests: 1000, pricePerRequest: 0.01, billedInBlocksOf: null }, { monthlyRequests: 2000 });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.total).toBe(20);
      expect(r.billableUnits).toBe(1000);
    }
  });
  it('refuses when included quota is unknown (unknown is not zero)', () => {
    const r = estimateBilling(0, { kind: 'requests', includedRequests: null, pricePerRequest: 0.01, billedInBlocksOf: null }, { monthlyRequests: 10 });
    expect(r.ok).toBe(false);
  });
  it('refuses when base fee is unknown', () => {
    expect(estimateBilling(null, null, {}).ok).toBe(false);
  });
  it('allows usage within quota when overage price is unknown', () => {
    const r = estimateBilling(0, { kind: 'requests', includedRequests: 1000, pricePerRequest: null, billedInBlocksOf: null }, { monthlyRequests: 500 });
    expect(r.ok).toBe(true);
  });
  it('refuses over-quota usage when overage price is unknown', () => {
    const r = estimateBilling(0, { kind: 'requests', includedRequests: 1000, pricePerRequest: null, billedInBlocksOf: null }, { monthlyRequests: 5000 });
    expect(r.ok).toBe(false);
  });
  it('credits', () => {
    const r = estimateBilling(0, { kind: 'credits', includedCredits: 100, creditsPerRequest: 2, pricePerCredit: 0.5 }, { monthlyRequests: 100 });
    expect(r.ok && r.total).toBe(50);
  });
  it('tokens need token assumptions, not request counts', () => {
    const billing = { kind: 'tokens', includedTokens: null, pricePerMillionInputTokens: 3, pricePerMillionOutputTokens: 15 } as const;
    expect(estimateBilling(0, billing, { monthlyRequests: 1000 }).ok).toBe(false);
    const r = estimateBilling(0, billing, { monthlyInputTokens: 2_000_000, monthlyOutputTokens: 1_000_000 });
    expect(r.ok && r.total).toBe(21);
  });
  it('tiered requests are graduated', () => {
    const r = estimateBilling(0, { kind: 'tiered-requests', includedRequests: 0, tiers: [{ upTo: 1000, pricePerRequest: 1 }, { upTo: null, pricePerRequest: 0.5 }] }, { monthlyRequests: 1500 });
    expect(r.ok && r.total).toBe(1250);
  });
  it('data volume', () => {
    const r = estimateBilling(5, { kind: 'data-volume', includedGb: 10, pricePerGb: 2 }, { monthlyDataGb: 15 });
    expect(r.ok && r.total).toBe(15);
  });
  it('per user', () => {
    const r = estimateBilling(0, { kind: 'per-user', includedUsers: 5, pricePerUser: 10 }, { monthlyUsers: 8 });
    expect(r.ok && r.total).toBe(30);
  });
});
