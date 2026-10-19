import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { validateCatalog } from '../../src/lib/validateCatalog.js';
import type { ApiEntry, Catalog } from '../../src/types/catalog.js';

export function loadCatalog(): ApiEntry[] {
  const catalogPath = process.env.CATALOG_PATH ?? resolve(process.cwd(), 'src/data/catalog.json');
  const catalog = JSON.parse(readFileSync(catalogPath, 'utf8')) as Catalog;
  const errors = validateCatalog(catalog).filter((issue) => issue.severity === 'error');
  if (errors.length > 0) {
    throw new Error(`Catalog validation failed: ${errors.map((issue) => `${issue.where}.${issue.path}: ${issue.message}`).join('; ')}`);
  }
  return catalog.apis;
}
