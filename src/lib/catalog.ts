import raw from '../data/catalog.json';
import type { ApiEntry, Catalog } from '../types/catalog';

const catalog = raw as unknown as Catalog;

export const apis: ApiEntry[] = catalog.apis;
export const schemaVersion = catalog.schemaVersion;

const byId = new Map(apis.map((a) => [a.id, a]));
export const getApi = (id: string): ApiEntry | undefined => byId.get(id);

export function recentlyVerified(limit = 6): ApiEntry[] {
  return apis
    .filter((a) => a.pricing.lastVerified)
    .sort((a, b) => (b.pricing.lastVerified ?? '').localeCompare(a.pricing.lastVerified ?? ''))
    .slice(0, limit);
}

export function recentlyAdded(limit = 6): ApiEntry[] {
  return [...apis].sort((a, b) => b.addedOn.localeCompare(a.addedOn) || a.name.localeCompare(b.name)).slice(0, limit);
}
