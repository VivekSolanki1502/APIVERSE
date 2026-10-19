import type { ApiEntry, Category, PricingModel } from '../types/catalog';

export type SortKey = 'relevance' | 'name' | 'verified';
export type AuthFilter = 'any' | 'none' | 'required';

export interface SearchParams {
  q: string;
  category: Category | '';
  auth: AuthFilter;
  httpsOnly: boolean;
  pricing: PricingModel | '';
  freeTier: boolean;
  verifiedOnly: boolean;
  sort: SortKey;
  page: number;
}

export const DEFAULT_PARAMS: SearchParams = {
  q: '',
  category: '',
  auth: 'any',
  httpsOnly: false,
  pricing: '',
  freeTier: false,
  verifiedOnly: false,
  sort: 'relevance',
  page: 1,
};

export const PAGE_SIZE = 12;

/** Lowercase and strip accents so "pokeapi" finds "PokéAPI". */
const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const tokenize = (s: string) => fold(s).split(/[^a-z0-9]+/).filter(Boolean);

/** Weighted match score; 0 means no match. Every query token must match something. */
export function scoreEntry(api: ApiEntry, query: string): number {
  const tokens = tokenize(query);
  if (tokens.length === 0) return 1;
  const name = fold(api.name);
  const desc = fold(api.description);
  const cat = fold(api.category);
  const tags = api.tags.map(fold);
  let total = 0;
  for (const t of tokens) {
    let s = 0;
    if (name === t) s += 20;
    else if (name.startsWith(t)) s += 12;
    else if (name.includes(t)) s += 8;
    if (tags.some((x) => x === t)) s += 6;
    else if (tags.some((x) => x.includes(t))) s += 3;
    if (cat.includes(t)) s += 3;
    if (desc.includes(t)) s += 2;
    if (s === 0) return 0;
    total += s;
  }
  return total;
}

export function searchApis(list: ApiEntry[], p: SearchParams): ApiEntry[] {
  const scored = list
    .filter((a) => !p.category || a.category === p.category)
    .filter((a) => p.auth === 'any' || (p.auth === 'none' ? !a.authentication.required : a.authentication.required))
    .filter((a) => !p.httpsOnly || a.https)
    .filter((a) => !p.pricing || a.pricing.model === p.pricing)
    .filter((a) => !p.freeTier || a.pricing.freeTier.available === true || a.pricing.model === 'free')
    .filter((a) => !p.verifiedOnly || a.pricing.verificationStatus === 'verified')
    .map((a) => ({ a, s: scoreEntry(a, p.q) }))
    .filter((x) => x.s > 0);

  scored.sort((x, y) => {
    if (p.sort === 'name') return x.a.name.localeCompare(y.a.name);
    if (p.sort === 'verified') {
      return (y.a.pricing.lastVerified ?? '').localeCompare(x.a.pricing.lastVerified ?? '') || x.a.name.localeCompare(y.a.name);
    }
    return y.s - x.s || Number(y.a.featured) - Number(x.a.featured) || x.a.name.localeCompare(y.a.name);
  });
  return scored.map((x) => x.a);
}

export function paginate<T>(items: T[], page: number, size = PAGE_SIZE) {
  const pages = Math.max(1, Math.ceil(items.length / size));
  const current = Math.min(Math.max(1, page), pages);
  return { items: items.slice((current - 1) * size, current * size), page: current, pages, total: items.length };
}

/** URL <-> params so searches are shareable. Only non-default values are written. */
export function paramsToQuery(p: SearchParams): URLSearchParams {
  const u = new URLSearchParams();
  if (p.q) u.set('q', p.q);
  if (p.category) u.set('category', p.category);
  if (p.auth !== 'any') u.set('auth', p.auth);
  if (p.httpsOnly) u.set('https', '1');
  if (p.pricing) u.set('pricing', p.pricing);
  if (p.freeTier) u.set('free', '1');
  if (p.verifiedOnly) u.set('verified', '1');
  if (p.sort !== 'relevance') u.set('sort', p.sort);
  if (p.page > 1) u.set('page', String(p.page));
  return u;
}

export function queryToParams(u: URLSearchParams): SearchParams {
  const sort = u.get('sort');
  const auth = u.get('auth');
  const page = Number.parseInt(u.get('page') ?? '1', 10);
  return {
    q: (u.get('q') ?? '').slice(0, 200),
    category: (u.get('category') ?? '') as SearchParams['category'],
    auth: auth === 'none' || auth === 'required' ? auth : 'any',
    httpsOnly: u.get('https') === '1',
    pricing: (u.get('pricing') ?? '') as SearchParams['pricing'],
    freeTier: u.get('free') === '1',
    verifiedOnly: u.get('verified') === '1',
    sort: sort === 'name' || sort === 'verified' ? sort : 'relevance',
    page: Number.isFinite(page) && page > 0 ? page : 1,
  };
}
