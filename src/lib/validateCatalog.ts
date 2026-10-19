/**
 * Dependency-free runtime validator for the catalog. Used by the CLI
 * (scripts/validate-catalog.ts), unit tests, and the app's import checks.
 */
import {
  AUTH_LOCATIONS,
  AUTH_TYPES,
  CATEGORIES,
  CORS_STATUSES,
  CURRENCIES,
  PERIODS,
  PRICING_MODELS,
  SCHEMA_VERSION,
  VERIFICATION_STATUSES,
} from '../types/catalog';

export interface ValidationIssue {
  severity: 'error' | 'warning';
  /** API id (or "catalog") the issue belongs to. */
  where: string;
  path: string;
  message: string;
}

const ID_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isIsoDate(value: unknown): value is string {
  if (typeof value !== 'string' || !DATE_RE.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

export function isHttpUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  try {
    const u = new URL(value);
    return u.protocol === 'https:' || u.protocol === 'http:';
  } catch {
    return false;
  }
}

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const isNumOrNull = (v: unknown) => v === null || (typeof v === 'number' && Number.isFinite(v) && v >= 0);

export function validateCatalog(data: unknown, today: string = new Date().toISOString().slice(0, 10)): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const add = (severity: ValidationIssue['severity'], where: string, path: string, message: string) =>
    issues.push({ severity, where, path, message });

  if (!isObj(data)) {
    add('error', 'catalog', '', 'Catalog must be a JSON object.');
    return issues;
  }
  if (data.schemaVersion !== SCHEMA_VERSION) {
    add('error', 'catalog', 'schemaVersion', `Expected schemaVersion ${SCHEMA_VERSION}, got ${String(data.schemaVersion)}.`);
  }
  if (!Array.isArray(data.apis)) {
    add('error', 'catalog', 'apis', '"apis" must be an array.');
    return issues;
  }

  const seen = new Map<string, number>();

  data.apis.forEach((raw, index) => {
    if (!isObj(raw)) {
      add('error', `apis[${index}]`, '', 'Entry must be an object.');
      return;
    }
    const id = typeof raw.id === 'string' ? raw.id : `apis[${index}]`;
    const e = (path: string, message: string) => add('error', id, path, message);
    const w = (path: string, message: string) => add('warning', id, path, message);

    // --- identity ---
    if (typeof raw.id !== 'string' || !ID_RE.test(raw.id)) e('id', 'id must be lowercase kebab-case (a-z, 0-9, hyphens).');
    else {
      if (seen.has(raw.id)) e('id', `Duplicate id "${raw.id}" (also at apis[${seen.get(raw.id)}]).`);
      seen.set(raw.id, index);
    }
    for (const f of ['name', 'description'] as const) {
      if (typeof raw[f] !== 'string' || (raw[f] as string).trim() === '') e(f, `${f} is required.`);
    }
    if (typeof raw.description === 'string' && raw.description.length > 280) w('description', 'Description is longer than 280 characters.');
    if (!CATEGORIES.includes(raw.category as never)) e('category', `category must be one of: ${CATEGORIES.join(', ')}.`);
    if (!Array.isArray(raw.tags) || raw.tags.some((t) => typeof t !== 'string' || t.trim() === '')) e('tags', 'tags must be an array of non-empty strings.');
    else if (raw.tags.length === 0) w('tags', 'No tags — the entry will be harder to find.');

    // --- URLs ---
    if (!isHttpUrl(raw.baseUrl)) e('baseUrl', 'baseUrl must be a valid http(s) URL.');
    if (!isHttpUrl(raw.documentationUrl)) e('documentationUrl', 'Official documentation URL is required and must be a valid http(s) URL.');
    if (!isHttpUrl(raw.officialWebsiteUrl)) e('officialWebsiteUrl', 'officialWebsiteUrl must be a valid http(s) URL.');
    if (raw.statusPageUrl !== null && raw.statusPageUrl !== undefined && !isHttpUrl(raw.statusPageUrl)) e('statusPageUrl', 'statusPageUrl must be null or a valid URL.');

    // --- https must agree with baseUrl ---
    if (typeof raw.https !== 'boolean') e('https', 'https must be true or false.');
    else if (isHttpUrl(raw.baseUrl)) {
      const isHttps = new URL(raw.baseUrl).protocol === 'https:';
      if (isHttps !== raw.https) e('https', `https is ${raw.https} but baseUrl uses ${new URL(raw.baseUrl).protocol}`);
    }
    if (!CORS_STATUSES.includes(raw.corsStatus as never)) e('corsStatus', `corsStatus must be one of: ${CORS_STATUSES.join(', ')}.`);
    if (typeof raw.featured !== 'boolean') e('featured', 'featured must be a boolean.');
    if (!isIsoDate(raw.addedOn)) e('addedOn', 'addedOn must be a valid YYYY-MM-DD date.');
    else if (raw.addedOn > today) e('addedOn', 'addedOn is in the future.');
    if (!Array.isArray(raw.limitations) || raw.limitations.some((l) => typeof l !== 'string')) e('limitations', 'limitations must be an array of strings.');

    // --- authentication ---
    const auth = raw.authentication;
    if (!isObj(auth)) e('authentication', 'authentication object is required.');
    else {
      if (typeof auth.required !== 'boolean') e('authentication.required', 'required must be a boolean.');
      if (!AUTH_TYPES.includes(auth.type as never)) e('authentication.type', `type must be one of: ${AUTH_TYPES.join(', ')}.`);
      if (auth.location !== null && !AUTH_LOCATIONS.includes(auth.location as never)) e('authentication.location', 'location must be null, header, query or body.');
      if (auth.parameterName !== null && typeof auth.parameterName !== 'string') e('authentication.parameterName', 'parameterName must be null or a string.');
      if (auth.type === 'none' && auth.required === true) e('authentication', 'Contradiction: type is "none" but required is true.');
      if (auth.type !== 'none' && auth.required === false && typeof auth.type === 'string') {
        // optional auth is allowed (e.g. optional keys with higher limits), but should be explained.
        if (!Array.isArray(raw.limitations) || raw.limitations.length === 0) w('authentication', 'Optional authentication should be explained in limitations.');
      }
    }

    // --- sample request ---
    if (raw.sampleRequest !== null && raw.sampleRequest !== undefined) {
      const s = raw.sampleRequest;
      if (!isObj(s)) e('sampleRequest', 'sampleRequest must be null or an object.');
      else {
        if (s.method !== 'GET' && s.method !== 'POST') e('sampleRequest.method', 'method must be GET or POST.');
        if (typeof s.path !== 'string' || !s.path.startsWith('/')) e('sampleRequest.path', 'path must start with "/".');
        if (!isObj(s.query)) e('sampleRequest.query', 'query must be an object.');
        if (!isObj(s.headers)) e('sampleRequest.headers', 'headers must be an object.');
        if (isObj(s.query) && isObj(s.headers)) {
          for (const [k, v] of [...Object.entries(s.query), ...Object.entries(s.headers)]) {
            if (typeof v !== 'string') e('sampleRequest', `Value for "${k}" must be a string.`);
            else if (/^(sk|pk|ghp|xox[bap])[-_][A-Za-z0-9]{10,}/.test(v) || /^[A-Za-z0-9]{32,}$/.test(v)) {
              e('sampleRequest', `Value for "${k}" looks like a real credential. Use a placeholder like YOUR_API_KEY.`);
            }
          }
        }
      }
    }

    // --- pricing ---
    const p = raw.pricing;
    if (!isObj(p)) {
      e('pricing', 'pricing object is required.');
      return;
    }
    if (!PRICING_MODELS.includes(p.model as never)) e('pricing.model', `model must be one of: ${PRICING_MODELS.join(', ')}.`);
    if (!VERIFICATION_STATUSES.includes(p.verificationStatus as never)) e('pricing.verificationStatus', `verificationStatus must be one of: ${VERIFICATION_STATUSES.join(', ')}.`);
    if (p.currency !== null && !CURRENCIES.includes(p.currency as never)) e('pricing.currency', `currency must be null or one of: ${CURRENCIES.join(', ')}.`);
    if (p.pricingUrl !== null && !isHttpUrl(p.pricingUrl)) e('pricing.pricingUrl', 'pricingUrl must be null or a valid URL.');
    if (p.termsUrl !== null && !isHttpUrl(p.termsUrl)) e('pricing.termsUrl', 'termsUrl must be null or a valid URL.');
    for (const f of ['rateLimits', 'overagePolicy', 'verificationNotes'] as const) {
      if (p[f] !== null && typeof p[f] !== 'string') e(`pricing.${f}`, `${f} must be null or a string.`);
    }
    if (!Array.isArray(p.history)) e('pricing.history', 'history must be an array (may be empty).');
    else p.history.forEach((h, i) => {
      if (!isObj(h) || !isIsoDate(h.date) || typeof h.summary !== 'string') e(`pricing.history[${i}]`, 'history entries need a valid date and a summary.');
    });

    const ft = p.freeTier;
    if (!isObj(ft)) e('pricing.freeTier', 'freeTier object is required.');
    else {
      if (ft.available !== null && typeof ft.available !== 'boolean') e('pricing.freeTier.available', 'available must be true, false or null (unknown).');
      if (!isNumOrNull(ft.quota)) e('pricing.freeTier.quota', 'quota must be null (unknown) or a non-negative number.');
      if (ft.unit !== null && typeof ft.unit !== 'string') e('pricing.freeTier.unit', 'unit must be null or a string.');
      if (ft.period !== null && !PERIODS.includes(ft.period as never)) e('pricing.freeTier.period', `period must be null or one of: ${PERIODS.join(', ')}.`);
      if (ft.quota !== null && (ft.unit === null || ft.period === null)) e('pricing.freeTier', 'A known quota needs both unit and period.');
      if (ft.available === false && ft.quota !== null && ft.quota !== 0) e('pricing.freeTier', 'Contradiction: available is false but a quota is set.');
    }

    if (!Array.isArray(p.plans)) e('pricing.plans', 'plans must be an array (may be empty).');
    else p.plans.forEach((plan, i) => {
      const pp = `pricing.plans[${i}]`;
      if (!isObj(plan)) { e(pp, 'Plan must be an object.'); return; }
      if (typeof plan.name !== 'string' || !plan.name) e(`${pp}.name`, 'Plan name is required.');
      if (!isNumOrNull(plan.monthlyBase)) e(`${pp}.monthlyBase`, 'monthlyBase must be null (unknown) or a non-negative number.');
      if (plan.billing !== null) {
        if (!isObj(plan.billing) || typeof plan.billing.kind !== 'string') e(`${pp}.billing`, 'billing must be null or an object with a "kind".');
        else if (!['requests', 'credits', 'tokens', 'tiered-requests', 'data-volume', 'per-user'].includes(plan.billing.kind)) e(`${pp}.billing.kind`, `Unknown billing kind "${plan.billing.kind}".`);
      }
      if (p.model === 'free' && typeof plan.monthlyBase === 'number' && plan.monthlyBase > 0) {
        e(pp, 'Contradiction: pricing.model is "free" but a plan has a monthly price above zero.');
      }
    });

    // --- contradictory labels ---
    if (p.model === 'free' && isObj(ft) && ft.available === false) e('pricing', 'Contradiction: model is "free" but freeTier.available is false.');
    if (p.model === 'freemium' && isObj(ft) && ft.available === false) e('pricing', 'Contradiction: model is "freemium" but freeTier.available is false.');
    if (p.model === 'free-trial' && !isObj(p.trial)) e('pricing.trial', 'model "free-trial" requires a trial object.');
    if (p.trial !== null && p.trial !== undefined) {
      const t = p.trial;
      if (!isObj(t)) e('pricing.trial', 'trial must be null or an object.');
      else {
        if (t.available !== null && typeof t.available !== 'boolean') e('pricing.trial.available', 'available must be boolean or null.');
        if (!isNumOrNull(t.durationDays)) e('pricing.trial.durationDays', 'durationDays must be null or a non-negative number.');
        if (!isNumOrNull(t.creditAmount)) e('pricing.trial.creditAmount', 'creditAmount must be null or a non-negative number.');
      }
    }
    if ((p.model === 'paid' || p.model === 'freemium' || p.model === 'contact-sales') && !isHttpUrl(p.pricingUrl) && p.verificationStatus === 'verified') {
      e('pricing.pricingUrl', `Verified ${String(p.model)} entries need an official pricingUrl.`);
    }

    // --- verification metadata ---
    if (p.lastVerified !== null && !isIsoDate(p.lastVerified)) e('pricing.lastVerified', 'lastVerified must be null or a valid YYYY-MM-DD date.');
    else if (typeof p.lastVerified === 'string' && p.lastVerified > today) e('pricing.lastVerified', 'lastVerified is in the future. It must record an actual verification.');
    if (p.verificationStatus === 'verified') {
      if (p.lastVerified === null) e('pricing.lastVerified', 'Verified entries must record lastVerified.');
      if (!isHttpUrl(p.pricingUrl) && !isHttpUrl(p.termsUrl) && !isHttpUrl(raw.documentationUrl)) e('pricing', 'Verified entries need an official source URL.');
      if (!p.verificationNotes) e('pricing.verificationNotes', 'Verified entries must say what was checked in verificationNotes.');
    }
    if (p.verificationStatus === 'needs-review' && p.lastVerified !== null) {
      w('pricing.lastVerified', 'needs-review entry has a lastVerified date; make sure it is still accurate.');
    }
  });

  return issues;
}

export function summarize(issues: ValidationIssue[]) {
  return {
    errors: issues.filter((i) => i.severity === 'error'),
    warnings: issues.filter((i) => i.severity === 'warning'),
  };
}
