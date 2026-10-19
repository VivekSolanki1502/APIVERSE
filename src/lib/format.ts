import type { ApiEntry, AuthType, CorsStatus, Currency, PricingModel, VerificationStatus } from '../types/catalog';

export const VERIFICATION_LABEL: Record<VerificationStatus, string> = {
  verified: 'Verified',
  'needs-review': 'Needs review',
  'reported-outdated': 'Reported outdated',
  deprecated: 'Deprecated',
};

export const MODEL_LABEL: Record<PricingModel, string> = {
  free: 'Free',
  freemium: 'Freemium',
  'free-trial': 'Free trial',
  paid: 'Paid',
  'self-hosted': 'Self-hosted',
  'contact-sales': 'Contact sales',
};

export const AUTH_LABEL: Record<AuthType, string> = {
  none: 'None',
  apiKey: 'API key',
  bearer: 'Bearer token',
  basic: 'Basic auth',
  oauth2: 'OAuth 2.0',
  other: 'Other',
};

export const CORS_LABEL: Record<CorsStatus, string> = {
  unknown: 'Unknown (untested)',
  supported: 'Supported',
  unsupported: 'Not supported',
  partial: 'Partial',
};

export function authSummary(api: ApiEntry): string {
  const a = api.authentication;
  if (!a.required && a.type === 'none') return 'No authentication';
  const base = AUTH_LABEL[a.type];
  return a.required ? `${base} required` : `${base} optional`;
}

export function freeTierSummary(api: ApiEntry): string {
  const f = api.pricing.freeTier;
  if (f.available === null) return 'Free tier unknown';
  if (!f.available) return 'No free tier';
  if (f.quota === null || !f.unit || !f.period) return 'Free tier (quota not recorded)';
  return `${f.quota.toLocaleString('en-US')} ${f.unit} / ${f.period}`;
}

export function formatMoney(amount: number, currency: Currency | null): string {
  if (currency === null) return `${amount.toLocaleString('en-US', { maximumFractionDigits: 4 })} (currency not recorded)`;
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: amount < 1 ? 4 : 2 }).format(amount);
  } catch {
    return `${amount} ${currency}`;
  }
}

export function formatDate(iso: string | null): string {
  if (!iso) return 'Never verified';
  const d = new Date(`${iso}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

export type PricingTone = 'verified' | 'unverified';

/**
 * Badge text for an API's pricing. A pricing label is only presented plainly when the pricing
 * record is verified; otherwise the label says it is unverified (never a bare "Free").
 */
export function pricingLabel(api: ApiEntry): { text: string; tone: PricingTone; title: string } {
  const label = MODEL_LABEL[api.pricing.model];
  if (api.pricing.verificationStatus === 'verified') {
    return { text: label, tone: 'verified', title: `${label} — pricing verified ${formatDate(api.pricing.lastVerified)}` };
  }
  return {
    text: `${label} · unverified`,
    tone: 'unverified',
    title: `Listed as “${label}”, but this pricing has not been confirmed against official sources (${VERIFICATION_LABEL[api.pricing.verificationStatus].toLowerCase()}).`,
  };
}

const BILLING_LABEL: Record<string, string> = {
  requests: 'Per request',
  credits: 'Credits',
  tokens: 'Tokens (input and output)',
  'tiered-requests': 'Tiered per-request',
  'data-volume': 'Data volume',
  'per-user': 'Per user',
  unknown: 'Not recorded',
};

/** Human label for the value returned by billingKind(); combined models are joined with " + ". */
export function billingLabel(kind: string): string {
  return kind
    .split('+')
    .map((k) => BILLING_LABEL[k] ?? k)
    .join(' + ');
}
