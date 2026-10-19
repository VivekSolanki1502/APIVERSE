/**
 * Budget Finder state <-> URL, so a brief or calculator result can be shared. Only the form
 * inputs are encoded (no identifiers, no personal data). Defaults are omitted.
 */
import { CATEGORIES, CURRENCIES, type Currency } from '../types/catalog';
import { DEFAULT_BUDGET_INPUT, type BudgetInput } from './budget';
import type { Usage } from './cost';

export type BudgetMode = 'any' | 'free-only' | 'free-plus-paid' | 'budget-paid' | 'self-hosted';

export const BUDGET_MODES: { id: BudgetMode; label: string; hint: string; flags: Pick<BudgetInput, 'allowPaid' | 'allowTrial' | 'allowSelfHosted'> }[] = [
  { id: 'any', label: 'No preference', hint: 'Show every pricing type.', flags: { allowPaid: true, allowTrial: false, allowSelfHosted: true } },
  { id: 'free-only', label: 'Free options only', hint: 'Hides paid-only, trial-only and self-hosted entries.', flags: { allowPaid: false, allowTrial: false, allowSelfHosted: false } },
  { id: 'free-plus-paid', label: 'Free tier, paid upgrades OK', hint: 'Free tiers first; paid plans allowed when you outgrow them.', flags: { allowPaid: true, allowTrial: false, allowSelfHosted: false } },
  { id: 'budget-paid', label: 'Budget-friendly paid', hint: 'Paid and trial entries allowed. Set a monthly budget below.', flags: { allowPaid: true, allowTrial: true, allowSelfHosted: false } },
  { id: 'self-hosted', label: 'Self-hosted alternatives', hint: 'Open-source you run yourself. Hosting costs are not included.', flags: { allowPaid: false, allowTrial: false, allowSelfHosted: true } },
];

/** The preset matching the current flags, or null when the flags were fine-tuned by hand. */
export function modeOf(i: Pick<BudgetInput, 'allowPaid' | 'allowTrial' | 'allowSelfHosted'>): BudgetMode | null {
  const m = BUDGET_MODES.find((x) => x.flags.allowPaid === i.allowPaid && x.flags.allowTrial === i.allowTrial && x.flags.allowSelfHosted === i.allowSelfHosted);
  return m ? m.id : null;
}

const posNum = (s: string | null): number | null => {
  if (s === null || s.trim() === '') return null;
  const n = Number(s);
  return Number.isFinite(n) && n >= 0 && n < 1e15 ? n : null;
};

export function budgetToParams(i: BudgetInput): URLSearchParams {
  const d = DEFAULT_BUDGET_INPUT;
  const u = new URLSearchParams();
  if (i.category) u.set('cat', i.category);
  if (i.keywords.trim()) u.set('kw', i.keywords.trim().slice(0, 100));
  if (i.authPreference !== d.authPreference) u.set('auth', i.authPreference);
  if (i.monthlyRequests !== null) u.set('req', String(i.monthlyRequests));
  if (i.maxBudget !== null) u.set('max', String(i.maxBudget));
  if (i.currency !== d.currency) u.set('cur', i.currency);
  if (i.allowPaid !== d.allowPaid) u.set('paid', i.allowPaid ? '1' : '0');
  if (i.allowTrial !== d.allowTrial) u.set('trial', i.allowTrial ? '1' : '0');
  if (i.allowSelfHosted !== d.allowSelfHosted) u.set('self', i.allowSelfHosted ? '1' : '0');
  return u;
}

export function paramsToBudget(u: URLSearchParams): BudgetInput {
  const d = DEFAULT_BUDGET_INPUT;
  const cat = u.get('cat') ?? '';
  const auth = u.get('auth');
  const cur = u.get('cur') ?? '';
  const flag = (k: string, fallback: boolean) => (u.get(k) === '1' ? true : u.get(k) === '0' ? false : fallback);
  const mode = BUDGET_MODES.find((m) => m.id === u.get('mode'));
  const base = mode ? { ...d, ...mode.flags } : d;
  return {
    category: (CATEGORIES as readonly string[]).includes(cat) ? (cat as BudgetInput['category']) : '',
    keywords: (u.get('kw') ?? '').slice(0, 100),
    authPreference: auth === 'none' || auth === 'simple' ? auth : 'any',
    monthlyRequests: posNum(u.get('req')),
    maxBudget: posNum(u.get('max')),
    currency: (CURRENCIES as readonly string[]).includes(cur) ? (cur as Currency) : d.currency,
    allowPaid: flag('paid', base.allowPaid),
    allowTrial: flag('trial', base.allowTrial),
    allowSelfHosted: flag('self', base.allowSelfHosted),
  };
}

export interface CalcState {
  apiId: string;
  usage: Usage;
}

export function calcToParams(c: CalcState, into: URLSearchParams): URLSearchParams {
  into.set('calc', c.apiId);
  const map: [keyof Usage, string][] = [['monthlyRequests', 'creq'], ['monthlyInputTokens', 'cin'], ['monthlyOutputTokens', 'cout'], ['monthlyUsers', 'cusers'], ['monthlyDataGb', 'cgb']];
  for (const [k, p] of map) {
    const v = c.usage[k];
    if (v !== undefined) into.set(p, String(v)); else into.delete(p);
  }
  return into;
}

export function paramsToCalc(u: URLSearchParams, validIds: string[], fallbackId: string): CalcState {
  const id = u.get('calc') ?? '';
  const usage: Usage = {};
  const map: [keyof Usage, string][] = [['monthlyRequests', 'creq'], ['monthlyInputTokens', 'cin'], ['monthlyOutputTokens', 'cout'], ['monthlyUsers', 'cusers'], ['monthlyDataGb', 'cgb']];
  for (const [k, p] of map) {
    const v = posNum(u.get(p));
    if (v !== null) usage[k] = v;
  }
  if (usage.monthlyRequests === undefined) usage.monthlyRequests = 50000;
  return { apiId: validIds.includes(id) ? id : fallbackId, usage };
}
