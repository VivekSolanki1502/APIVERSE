/**
 * Cost estimation. Every calculator is explicit about its billing model, returns a
 * line-by-line breakdown, and returns { ok: false } ("Cannot estimate reliably") whenever a
 * required price or quota is unknown. Unknown is never treated as zero.
 */
import type { ApiEntry, Billing, Currency, PricingPlan } from '../types/catalog';

export interface Usage {
  monthlyRequests?: number;
  monthlyUsers?: number;
  monthlyDataGb?: number;
  monthlyInputTokens?: number;
  monthlyOutputTokens?: number;
}

export interface BreakdownLine {
  label: string;
  value: string;
  /** True when `value` is a currency amount (the UI formats it with the plan currency). */
  money?: boolean;
  /** Raw numeric amount for money lines, so the UI never has to parse formatted text. */
  amount?: number;
}

export type CostResult =
  | {
      ok: true;
      total: number;
      baseFee: number;
      usageCost: number;
      billableUnits: number;
      includedUnits: number;
      breakdown: BreakdownLine[];
      assumptions: string[];
    }
  | { ok: false; reason: string; missing: string[] };

const fail = (reason: string, missing: string[]): CostResult => ({ ok: false, reason, missing });
const num = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 6 });

export function requestCost(
  monthlyRequests: number,
  includedRequests: number,
  pricePerRequest: number,
  blockSize: number | null,
): { billable: number; cost: number } {
  const billable = Math.max(0, monthlyRequests - includedRequests);
  const cost = blockSize && blockSize > 1 ? Math.ceil(billable / blockSize) * pricePerRequest : billable * pricePerRequest;
  return { billable, cost };
}

export function estimateBilling(base: number | null, billing: Billing | null, usage: Usage): CostResult {
  if (base === null) return fail('The plan\'s fixed monthly fee is not recorded.', ['monthlyBase']);
  if (billing === null) {
    return {
      ok: true, total: base, baseFee: base, usageCost: 0, billableUnits: 0, includedUnits: 0,
      breakdown: [{ label: 'Plan fee', value: num(base) }],
      assumptions: ['The plan has no documented usage-based component in the catalog.'],
    };
  }

  switch (billing.kind) {
    case 'requests': {
      if (usage.monthlyRequests === undefined) return fail('Enter expected monthly requests.', ['monthlyRequests']);
      if (billing.includedRequests === null) return fail('Included request quota is unknown.', ['includedRequests']);
      const requests = usage.monthlyRequests;
      const over = Math.max(0, requests - billing.includedRequests);
      if (billing.pricePerRequest === null) {
        if (over === 0) {
          return done(base, 0, 0, billing.includedRequests, [
            line('Monthly requests', num(requests)), line('Included', num(billing.includedRequests)), line('Billable', '0'),
          ], ['Usage is within the included quota, so no overage applies.']);
        }
        return fail('Usage exceeds the included quota and the overage price is unknown.', ['pricePerRequest']);
      }
      const { billable, cost } = requestCost(requests, billing.includedRequests, billing.pricePerRequest, billing.billedInBlocksOf);
      return done(base, cost, billable, billing.includedRequests, [
        line('Monthly requests', num(requests)), line('Included', num(billing.includedRequests)), line('Billable', num(billable)),
      ], [billing.billedInBlocksOf ? `Billable usage is rounded up to blocks of ${num(billing.billedInBlocksOf)}.` : 'Billed per individual request.']);
    }
    case 'credits': {
      if (usage.monthlyRequests === undefined) return fail('Enter expected monthly requests.', ['monthlyRequests']);
      if (billing.includedCredits === null || billing.creditsPerRequest === null) {
        return fail('Credit quota or credits-per-request is unknown.', ['includedCredits', 'creditsPerRequest'].filter((k) => billing[k as 'includedCredits'] === null));
      }
      const credits = usage.monthlyRequests * billing.creditsPerRequest;
      const billable = Math.max(0, credits - billing.includedCredits);
      if (billable > 0 && billing.pricePerCredit === null) return fail('Usage exceeds included credits and the credit price is unknown.', ['pricePerCredit']);
      return done(base, billable * (billing.pricePerCredit ?? 0), billable, billing.includedCredits, [
        line('Credits used', num(credits)), line('Included credits', num(billing.includedCredits)), line('Billable credits', num(billable)),
      ], [`Assumes ${num(billing.creditsPerRequest)} credit(s) per request.`]);
    }
    case 'tokens': {
      if (usage.monthlyInputTokens === undefined || usage.monthlyOutputTokens === undefined) {
        return fail('Token pricing needs your expected input and output tokens.', ['monthlyInputTokens', 'monthlyOutputTokens']);
      }
      if (billing.pricePerMillionInputTokens === null || billing.pricePerMillionOutputTokens === null) {
        return fail('Per-token prices are unknown.', ['pricePerMillionInputTokens', 'pricePerMillionOutputTokens']);
      }
      const included = billing.includedTokens ?? 0;
      const totalTokens = usage.monthlyInputTokens + usage.monthlyOutputTokens;
      // Included tokens are applied pro rata across input and output.
      const share = totalTokens === 0 ? 0 : Math.min(1, included / totalTokens);
      const inBill = usage.monthlyInputTokens * (1 - share);
      const outBill = usage.monthlyOutputTokens * (1 - share);
      const cost = (inBill / 1e6) * billing.pricePerMillionInputTokens + (outBill / 1e6) * billing.pricePerMillionOutputTokens;
      return done(base, cost, inBill + outBill, included, [
        line('Input tokens', num(usage.monthlyInputTokens)), line('Output tokens', num(usage.monthlyOutputTokens)), line('Included tokens', num(included)),
      ], ['Included tokens are applied pro rata to input and output.', 'Ignores caching, batch discounts and model differences.']);
    }
    case 'tiered-requests': {
      if (usage.monthlyRequests === undefined) return fail('Enter expected monthly requests.', ['monthlyRequests']);
      if (billing.tiers.length === 0) return fail('No tiers recorded.', ['tiers']);
      let remaining = Math.max(0, usage.monthlyRequests - (billing.includedRequests ?? 0));
      let prev = 0;
      let cost = 0;
      const lines: BreakdownLine[] = [line('Monthly requests', num(usage.monthlyRequests)), line('Included', num(billing.includedRequests ?? 0))];
      for (const tier of billing.tiers) {
        if (remaining <= 0) break;
        const width = tier.upTo === null ? remaining : Math.max(0, tier.upTo - prev);
        const used = Math.min(remaining, width);
        cost += used * tier.pricePerRequest;
        lines.push(line(`Tier up to ${tier.upTo === null ? '∞' : num(tier.upTo)}`, `${num(used)} × ${num(tier.pricePerRequest)}`));
        remaining -= used;
        prev = tier.upTo ?? prev;
      }
      if (remaining > 0) return fail('Usage exceeds the highest recorded tier.', ['tiers']);
      return done(base, cost, Math.max(0, usage.monthlyRequests - (billing.includedRequests ?? 0)), billing.includedRequests ?? 0, lines, ['Tiers are applied as graduated (each request priced by the tier it falls in).']);
    }
    case 'data-volume': {
      if (usage.monthlyDataGb === undefined) return fail('Enter expected monthly data volume (GB).', ['monthlyDataGb']);
      if (billing.includedGb === null || billing.pricePerGb === null) return fail('Included data or price per GB is unknown.', ['includedGb', 'pricePerGb'].filter((k) => billing[k as 'includedGb'] === null));
      const billable = Math.max(0, usage.monthlyDataGb - billing.includedGb);
      return done(base, billable * billing.pricePerGb, billable, billing.includedGb, [
        line('Data used (GB)', num(usage.monthlyDataGb)), line('Included (GB)', num(billing.includedGb)), line('Billable (GB)', num(billable)),
      ], ['Assumes 1 GB = the unit the provider bills in; check the provider\'s definition.']);
    }
    case 'per-user': {
      if (usage.monthlyUsers === undefined) return fail('Enter expected active users.', ['monthlyUsers']);
      if (billing.includedUsers === null || billing.pricePerUser === null) return fail('Included users or price per user is unknown.', ['includedUsers', 'pricePerUser'].filter((k) => billing[k as 'includedUsers'] === null));
      const billable = Math.max(0, usage.monthlyUsers - billing.includedUsers);
      return done(base, billable * billing.pricePerUser, billable, billing.includedUsers, [
        line('Active users', num(usage.monthlyUsers)), line('Included users', num(billing.includedUsers)), line('Billable users', num(billable)),
      ], ['Assumes users are counted as the provider defines "active".']);
    }
  }
}

const line = (label: string, value: string): BreakdownLine => ({ label, value });
const moneyLine = (label: string, amount: number): BreakdownLine => ({ label, value: num(amount), money: true, amount });

function done(base: number, usageCost: number, billable: number, included: number, breakdown: BreakdownLine[], assumptions: string[]): CostResult {
  return {
    ok: true,
    total: base + usageCost,
    baseFee: base,
    usageCost,
    billableUnits: billable,
    includedUnits: included,
    breakdown: [...breakdown, moneyLine('Plan fee', base), moneyLine('Estimated overage', usageCost)],
    assumptions,
  };
}

export const COST_DISCLAIMER =
  'This is an estimate, not an exact bill. Taxes, exchange rates, provider changes, rounding rules and other charges may not be included.';

export interface PlanEstimate {
  api: ApiEntry;
  plan: PricingPlan;
  currency: Currency | null;
  result: CostResult;
}

/** Estimate every recorded plan of an API. APIs with no plans return no estimates. */
export function estimateApi(api: ApiEntry, usage: Usage): PlanEstimate[] {
  return api.pricing.plans.map((plan) => ({
    api,
    plan,
    currency: api.pricing.currency,
    result: estimateBilling(plan.monthlyBase, plan.billing, usage),
  }));
}

/** Cheapest estimable plan for an API, or null if nothing can be estimated reliably. */
export function cheapestEstimate(api: ApiEntry, usage: Usage): PlanEstimate | null {
  const ok = estimateApi(api, usage).filter((e) => e.result.ok);
  if (ok.length === 0) return null;
  return ok.reduce((a, b) => ((a.result as { total: number }).total <= (b.result as { total: number }).total ? a : b));
}

/** Billing-model signature used to decide whether two plans can be compared meaningfully. */
export function billingKind(api: ApiEntry): string {
  const kinds = new Set(api.pricing.plans.map((p) => p.billing?.kind).filter(Boolean));
  if (kinds.size === 0) return 'unknown';
  return [...kinds].sort().join('+');
}
