import { describe, expect, it } from 'vitest';
import { getApi } from './catalog';
import { billingLabel, pricingLabel } from './format';

describe('pricingLabel', () => {
  it('never presents an unverified free claim as plain "Free"', () => {
    const a = getApi('open-library');
    expect(a?.pricing.verificationStatus).not.toBe('verified');
    const l = pricingLabel(a!);
    expect(l.tone).toBe('unverified');
    expect(l.text).toContain('unverified');
  });

  it('uses the plain label for verified pricing', () => {
    const l = pricingLabel(getApi('pokeapi')!);
    expect(l.tone).toBe('verified');
    expect(l.text).toBe('Free');
  });
});


describe('billingLabel', () => {
  it('labels known, combined and unknown billing kinds', () => {
    expect(billingLabel('requests')).toBe('Per request');
    expect(billingLabel('credits+requests')).toBe('Credits + Per request');
    expect(billingLabel('unknown')).toBe('Not recorded');
  });
});
