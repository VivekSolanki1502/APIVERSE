/**
 * Project recipes: curated multi-API stacks. Everything shown is derived from the catalog:
 * combined cost is only a total when EVERY member can be estimated; otherwise the known part
 * is shown with the unknown members listed. Unknown is never zero.
 */
import type { ApiEntry, Currency } from '../types/catalog';
import { cheapestEstimate } from './cost';
import { buildRequest } from './examples';
import raw from '../data/recipes.json';

export interface RecipeMember { id: string; role: string }
export interface Recipe { id: string; name: string; summary: string; apis: RecipeMember[]; notes: string }
export const recipes: Recipe[] = (raw as { recipes: Recipe[] }).recipes;

export interface MemberCost { api: ApiEntry; role: string; cost: number | null; basis: string }
export interface RecipeAnalysis {
  members: { api: ApiEntry; role: string }[];
  missingIds: string[];
  costs: MemberCost[];
  knownTotal: number;
  complete: boolean;
  unknown: string[];
  currency: Currency | null;
  hardestAuth: 'none' | 'apiKey' | 'bearer' | 'oauth2';
  keyCount: number;
  commercialRisk: 'restricted-or-forbidden' | 'unchecked' | 'all-allowed';
  verifiedCount: number;
  hasSelfHosted: boolean;
}

const AUTH_RANK = { none: 0, apiKey: 1, bearer: 2, oauth2: 3 } as const;

export function memberCost(api: ApiEntry, monthlyRequests: number): { cost: number | null; basis: string } {
  const best = cheapestEstimate(api, { monthlyRequests });
  if (best && best.result.ok) return { cost: best.result.total, basis: `Cheapest recorded plan (${best.plan.name})` };
  if (api.pricing.model === 'free' && api.pricing.verificationStatus === 'verified' && api.pricing.plans.length === 0) return { cost: 0, basis: 'Documented as free (verified); fair-use limits still apply' };
  return { cost: null, basis: 'Cannot estimate reliably' };
}

export function analyzeRecipe(recipe: Recipe, catalog: ApiEntry[], monthlyRequests: number): RecipeAnalysis {
  const members: { api: ApiEntry; role: string }[] = [];
  const missingIds: string[] = [];
  for (const m of recipe.apis) {
    const api = catalog.find((a) => a.id === m.id);
    if (api) members.push({ api, role: m.role });
    else missingIds.push(m.id);
  }
  const costs: MemberCost[] = members.map((m) => ({ ...m, ...memberCost(m.api, monthlyRequests) }));
  const currencies = new Set(costs.filter((c) => c.cost !== null && c.cost > 0).map((c) => c.api.pricing.currency));
  const mixed = currencies.size > 1;
  const unknown = costs.filter((c) => c.cost === null).map((c) => c.api.name);
  if (mixed) unknown.push('(mixed currencies cannot be added)');
  const knownTotal = mixed ? 0 : costs.reduce((s, c) => s + (c.cost ?? 0), 0);
  const auths = members.map((m) => (m.api.authentication.required ? m.api.authentication.type : 'none'));
  const hardestAuth = auths.reduce<RecipeAnalysis['hardestAuth']>((a, t) => ((AUTH_RANK[t as keyof typeof AUTH_RANK] ?? 1) > AUTH_RANK[a] ? (t as RecipeAnalysis['hardestAuth']) : a), 'none');
  const cu = members.map((m) => m.api.usageTerms?.commercialUse ?? 'unclear');
  return {
    members, missingIds, costs, knownTotal, complete: unknown.length === 0 && missingIds.length === 0, unknown,
    currency: [...currencies][0] ?? null,
    hardestAuth,
    keyCount: members.filter((m) => m.api.authentication.required).length,
    commercialRisk: cu.some((c) => c === 'restricted' || c === 'forbidden') ? 'restricted-or-forbidden' : cu.every((c) => c === 'allowed') ? 'all-allowed' : 'unchecked',
    verifiedCount: members.filter((m) => m.api.pricing.verificationStatus === 'verified').length,
    hasSelfHosted: members.some((m) => m.api.pricing.model === 'self-hosted'),
  };
}

const ident = (id: string) => id.replace(/[^a-zA-Z0-9]/g, '_');

export function starterCode(members: { api: ApiEntry }[], lang: 'javascript' | 'python'): string {
  const reqs = members.map((m) => ({ id: m.api.id, name: m.api.name, req: buildRequest(m.api) })).filter((r) => r.req && r.req.method === 'GET');
  if (reqs.length === 0) return '';
  if (lang === 'javascript') {
    const entries = reqs.map((r) => `  ${JSON.stringify(r.id)}: { url: ${JSON.stringify(r.req!.url)}, headers: ${JSON.stringify(r.req!.headers)} },`).join('\n');
    return `// Starter: one sample call per API. Replace YOUR_API_KEY placeholders and adapt the URLs.\n// Browser use needs each API to allow CORS; otherwise call from a server.\nconst endpoints = {\n${entries}\n};\n\nasync function call(name) {\n  const { url, headers } = endpoints[name];\n  const res = await fetch(url, { headers });\n  if (!res.ok) throw new Error(\`\${name}: HTTP \${res.status}\`);\n  return res.json();\n}\n\nconst results = await Promise.all(Object.keys(endpoints).map(call));\nconsole.log(results);`;
  }
  const entries = reqs.map((r) => `    ${JSON.stringify(r.id)}: (${JSON.stringify(r.req!.url)}, ${JSON.stringify(r.req!.headers)}),`).join('\n');
  void ident;
  return `# Starter: one sample call per API. Replace YOUR_API_KEY placeholders and adapt the URLs.\nimport requests\n\nendpoints = {\n${entries}\n}\n\nresults = {}\nfor name, (url, headers) in endpoints.items():\n    response = requests.get(url, headers=headers, timeout=30)\n    response.raise_for_status()\n    results[name] = response.json()\nprint(results)`;
}
