/**
 * Budget Finder: transparent, rule-based ranking. Every point comes with a stated reason.
 * Unverified pricing can never be presented as a confirmed free recommendation; such entries
 * go to a separate "needs review" list.
 */
import type { ApiEntry, Category, Currency } from '../types/catalog';
import { cheapestEstimate, type Usage } from './cost';

export type PricingCategory =
  | 'free-no-expiry'
  | 'limited-free-tier'
  | 'free-trial'
  | 'freemium'
  | 'paid'
  | 'self-hosted'
  | 'unknown';

export const PRICING_CATEGORY_LABEL: Record<PricingCategory, string> = {
  'free-no-expiry': 'Free offering (no scheduled expiry)',
  'limited-free-tier': 'Limited free tier',
  'free-trial': 'Free trial or promotional credits',
  freemium: 'Freemium',
  paid: 'Paid / budget-friendly',
  'self-hosted': 'Self-hosted / open source',
  unknown: 'Pricing unknown',
};

export function pricingCategory(api: ApiEntry): PricingCategory {
  const p = api.pricing;
  switch (p.model) {
    case 'self-hosted':
      return 'self-hosted';
    case 'free-trial':
      return 'free-trial';
    case 'paid':
    case 'contact-sales':
      return p.freeTier.available === true ? 'limited-free-tier' : 'paid';
    case 'freemium':
      return p.freeTier.quota !== null ? 'limited-free-tier' : 'freemium';
    case 'free':
      return p.freeTier.quota !== null ? 'limited-free-tier' : 'free-no-expiry';
  }
}

export interface BudgetInput {
  category: Category | '';
  keywords: string;
  authPreference: 'any' | 'none' | 'simple';
  monthlyRequests: number | null;
  maxBudget: number | null;
  currency: Currency;
  allowPaid: boolean;
  allowTrial: boolean;
  allowSelfHosted: boolean;
}

export const DEFAULT_BUDGET_INPUT: BudgetInput = {
  category: '',
  keywords: '',
  authPreference: 'any',
  monthlyRequests: null,
  maxBudget: null,
  currency: 'USD',
  allowPaid: true,
  allowTrial: false,
  allowSelfHosted: true,
};

export interface Recommendation {
  api: ApiEntry;
  category: PricingCategory;
  score: number;
  reasons: string[];
  warnings: string[];
  estimatedMonthlyCost: number | null;
  estimateNote: string;
}

export interface BudgetResult {
  recommended: Recommendation[];
  needsReview: Recommendation[];
  excluded: { api: ApiEntry; why: string }[];
  assumptions: string[];
}

function daysSince(date: string, today: Date): number {
  return Math.floor((today.getTime() - new Date(`${date}T00:00:00Z`).getTime()) / 86_400_000);
}

export function findBudgetApis(list: ApiEntry[], input: BudgetInput, today: Date = new Date()): BudgetResult {
  const kw = input.keywords.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  const usage: Usage = input.monthlyRequests === null ? {} : { monthlyRequests: input.monthlyRequests };
  const result: BudgetResult = {
    recommended: [],
    needsReview: [],
    excluded: [],
    assumptions: [
      'Scores are a transparent heuristic, not a claim that any API is the cheapest or best.',
      'Only pricing recorded in the catalog is used; unknown values are never treated as zero.',
      'Free trials are never presented as free forever, and self-hosted options still cost hardware and maintenance.',
      `Costs are shown in the provider's recorded currency${input.currency ? `; no exchange-rate conversion to ${input.currency} is applied` : ''}.`,
    ],
  };

  for (const api of list) {
    const cat = pricingCategory(api);
    const exclude = (why: string) => result.excluded.push({ api, why });

    if (input.category && api.category !== input.category) continue;
    if (kw.length > 0) {
      const hay = `${api.name} ${api.description} ${api.tags.join(' ')}`.toLowerCase();
      if (!kw.every((k) => hay.includes(k))) continue;
    }
    if (cat === 'self-hosted' && !input.allowSelfHosted) { exclude('Self-hosted options are turned off.'); continue; }
    if (cat === 'free-trial' && !input.allowTrial) { exclude('Trial-only pricing is turned off.'); continue; }
    if (cat === 'paid' && !input.allowPaid) { exclude('Paid-only options are turned off.'); continue; }
    if (input.authPreference === 'none' && api.authentication.required) { exclude('Requires authentication.'); continue; }
    if (input.authPreference === 'simple' && api.authentication.required && api.authentication.type === 'oauth2') { exclude('Requires OAuth 2.0.'); continue; }

    const reasons: string[] = [];
    const warnings: string[] = [];
    let score = 0;

    // Functional suitability
    if (input.category) { score += 20; reasons.push(`Matches the ${api.category} category.`); }
    if (kw.length > 0) { score += 15; reasons.push('Matches all of your keywords.'); }

    // Budget fit
    if (cat === 'free-no-expiry') { score += 30; reasons.push('Documented as free with no scheduled expiry (terms and fair-use limits still apply).'); }
    else if (cat === 'limited-free-tier') { score += 24; reasons.push('Has a free tier with a documented quota.'); }
    else if (cat === 'freemium') { score += 18; reasons.push('Freemium: a free tier exists but its quota is not recorded.'); }
    else if (cat === 'self-hosted') { score += 14; reasons.push('Open-source/self-hosted: no provider fee, but you pay for hosting and maintenance.'); warnings.push('Infrastructure and maintenance costs are not included.'); }
    else if (cat === 'free-trial') { score += 6; warnings.push('Trial or promotional credits expire; this is not free long-term.'); }
    else if (cat === 'paid') { score += 8; reasons.push('Paid option.'); }

    // Estimated cost
    let est: number | null = null;
    let estimateNote = 'Cannot estimate reliably.';
    if (api.pricing.plans.length > 0 && input.monthlyRequests !== null) {
      const cheapest = cheapestEstimate(api, usage);
      if (cheapest && cheapest.result.ok) {
        est = cheapest.result.total;
        estimateNote = `Cheapest recorded plan (${cheapest.plan.name}) at ${input.monthlyRequests.toLocaleString('en-US')} requests/month.`;
        if (input.maxBudget !== null) {
          if (est <= input.maxBudget) { score += 12; reasons.push(`Estimated cost fits your budget of ${input.maxBudget}.`); }
          else { exclude(`Estimated cost ${est} exceeds the budget of ${input.maxBudget}.`); continue; }
        }
      } else {
        warnings.push('Cost at your volume cannot be estimated from the recorded pricing.');
      }
    } else if (input.monthlyRequests !== null && cat !== 'self-hosted') {
      warnings.push('No plan data recorded, so cost at your volume cannot be estimated.');
    }
    if (input.monthlyRequests !== null && api.pricing.freeTier.quota !== null && api.pricing.freeTier.unit && /request|call/i.test(api.pricing.freeTier.unit)) {
      const perMonth = { second: 2_592_000, minute: 43_200, hour: 720, day: 30, month: 1, year: 1 / 12, 'one-time': 1 } as const;
      const p = api.pricing.freeTier.period;
      if (p) {
        const monthlyQuota = api.pricing.freeTier.quota * perMonth[p];
        if (p !== 'one-time' && monthlyQuota >= input.monthlyRequests) { score += 10; reasons.push('Your volume fits within the free quota (assuming a 30-day month).'); }
        else if (p !== 'one-time') warnings.push('Your volume exceeds the recorded free quota.');
      }
    }

    // Authentication complexity
    if (!api.authentication.required) { score += 10; reasons.push('No authentication required.'); }
    else if (api.authentication.type === 'apiKey') { score += 6; reasons.push('Simple API-key authentication.'); }
    else if (api.authentication.type === 'oauth2') { score += 1; warnings.push('OAuth 2.0 adds integration complexity.'); }
    else { score += 3; }

    // Documentation
    score += 5; reasons.push('Official documentation available.');

    // Limits and freshness
    if (api.limitations.length > 0) { score -= Math.min(6, api.limitations.length * 2); warnings.push(`${api.limitations.length} known limitation(s) — see the details page.`); }
    const v = api.pricing.lastVerified;
    if (api.pricing.verificationStatus === 'verified' && v) {
      const age = daysSince(v, today);
      if (age <= 90) { score += 10; reasons.push(`Pricing verified ${age} day(s) ago.`); }
      else { score += 3; warnings.push(`Pricing was verified ${age} days ago and may be outdated.`); }
    }

    const rec: Recommendation = { api, category: cat, score, reasons, warnings, estimatedMonthlyCost: est, estimateNote };
    if (api.pricing.verificationStatus === 'verified') result.recommended.push(rec);
    else result.needsReview.push(rec);
  }

  const byScore = (a: Recommendation, b: Recommendation) => b.score - a.score || a.api.name.localeCompare(b.api.name);
  result.recommended.sort(byScore);
  result.needsReview.sort(byScore);
  return result;
}
