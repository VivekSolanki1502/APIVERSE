/**
 * Canonical APIverse catalog schema.
 *
 * Rules that apply to every field:
 *  - `null` means "unknown / not documented". It never means zero.
 *  - Anything not backed by an official source must have verificationStatus "needs-review".
 */

export const SCHEMA_VERSION = 1;

export const CATEGORIES = [
  'AI & Machine Learning',
  'Books & Education',
  'Weather',
  'Maps & Geolocation',
  'Finance & Economics',
  'News',
  'Science',
  'Public Datasets',
  'Developer Utilities',
  'Gaming & Entertainment',
  'Productivity',
  'Health',
] as const;
export type Category = (typeof CATEGORIES)[number];

export const AUTH_TYPES = ['none', 'apiKey', 'bearer', 'basic', 'oauth2', 'other'] as const;
export type AuthType = (typeof AUTH_TYPES)[number];

export const AUTH_LOCATIONS = ['header', 'query', 'body'] as const;
export type AuthLocation = (typeof AUTH_LOCATIONS)[number];

export const CORS_STATUSES = ['unknown', 'supported', 'unsupported', 'partial'] as const;
export type CorsStatus = (typeof CORS_STATUSES)[number];

export const COMMERCIAL_USES = ['allowed', 'restricted', 'forbidden', 'unclear'] as const;
export type CommercialUse = (typeof COMMERCIAL_USES)[number];

export const CORS_RESULTS = ['readable', 'blocked-confirmed'] as const;
export type CorsResult = (typeof CORS_RESULTS)[number];

export const PRICING_MODELS = [
  'free',
  'freemium',
  'free-trial',
  'paid',
  'self-hosted',
  'contact-sales',
] as const;
export type PricingModel = (typeof PRICING_MODELS)[number];

export const VERIFICATION_STATUSES = [
  'verified',
  'needs-review',
  'reported-outdated',
  'deprecated',
] as const;
export type VerificationStatus = (typeof VERIFICATION_STATUSES)[number];

export const PERIODS = ['second', 'minute', 'hour', 'day', 'month', 'year', 'one-time'] as const;
export type Period = (typeof PERIODS)[number];

export const CURRENCIES = ['USD', 'EUR', 'GBP', 'INR'] as const;
export type Currency = (typeof CURRENCIES)[number];

export interface Authentication {
  required: boolean;
  type: AuthType;
  /** Where the credential goes, when documented. */
  location: AuthLocation | null;
  /** Header or parameter name, when documented (e.g. "x-api-key"). Never a real credential. */
  parameterName: string | null;
}

export interface FreeTier {
  /** null = unknown */
  available: boolean | null;
  quota: number | null;
  unit: string | null;
  period: Period | null;
}

export interface Trial {
  available: boolean | null;
  durationDays: number | null;
  creditAmount: number | null;
  creditsExpire: boolean | null;
}

/** Explicit, separately calculated billing rules. See src/lib/cost.ts. */
export type Billing =
  | {
      kind: 'requests';
      includedRequests: number | null;
      pricePerRequest: number | null;
      /** If the provider bills in blocks (e.g. per 1,000), the block size. Otherwise null. */
      billedInBlocksOf: number | null;
    }
  | {
      kind: 'credits';
      includedCredits: number | null;
      creditsPerRequest: number | null;
      pricePerCredit: number | null;
    }
  | {
      kind: 'tokens';
      includedTokens: number | null;
      pricePerMillionInputTokens: number | null;
      pricePerMillionOutputTokens: number | null;
    }
  | {
      kind: 'tiered-requests';
      tiers: { upTo: number | null; pricePerRequest: number }[];
      includedRequests: number | null;
    }
  | {
      kind: 'data-volume';
      includedGb: number | null;
      pricePerGb: number | null;
    }
  | {
      kind: 'per-user';
      includedUsers: number | null;
      pricePerUser: number | null;
    };

export interface PricingPlan {
  name: string;
  /** Fixed monthly fee for the plan. null = unknown. 0 = documented as free. */
  monthlyBase: number | null;
  billing: Billing | null;
  notes: string | null;
}

export interface HistoryEntry {
  date: string;
  summary: string;
}

export interface Pricing {
  model: PricingModel;
  freeTier: FreeTier;
  trial: Trial | null;
  plans: PricingPlan[];
  rateLimits: string | null;
  overagePolicy: string | null;
  currency: Currency | null;
  pricingUrl: string | null;
  termsUrl: string | null;
  /** ISO date (YYYY-MM-DD) of an actual human verification, or null if never verified. */
  lastVerified: string | null;
  verificationStatus: VerificationStatus;
  verificationNotes: string | null;
  history: HistoryEntry[];
}

export interface SampleRequest {
  method: 'GET' | 'POST';
  /** Path appended to baseUrl, starting with "/". */
  path: string;
  query: Record<string, string>;
  /** Header names/values. Credentials must be placeholders such as YOUR_API_KEY. */
  headers: Record<string, string>;
  /** JSON body for POST requests. */
  body: unknown | null;
}

export interface UsageTerms {
  commercialUse: CommercialUse;
  attributionRequired: boolean | null;
  notes: string | null;
  sourceUrl: string | null;
  checkedOn: string | null;
}

export interface CorsEvidenceEntry {
  testedOn: string;
  browser: string;
  result: CorsResult;
  notes: string | null;
  reportUrl: string | null;
}

export interface ApiEntry {
  id: string;
  name: string;
  description: string;
  category: Category;
  tags: string[];
  baseUrl: string;
  documentationUrl: string;
  officialWebsiteUrl: string;
  authentication: Authentication;
  https: boolean;
  corsStatus: CorsStatus;
  pricing: Pricing;
  featured: boolean;
  sampleRequest: SampleRequest | null;
  limitations: string[];
  statusPageUrl: string | null;
  usageTerms?: UsageTerms;
  corsEvidence?: CorsEvidenceEntry[];
  /** ISO date this entry was added to the catalog. */
  addedOn: string;
}

export interface Catalog {
  schemaVersion: number;
  apis: ApiEntry[];
}
