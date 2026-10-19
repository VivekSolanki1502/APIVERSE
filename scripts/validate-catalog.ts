/**
 * CLI: validate the catalog. Exits with code 1 when any error is found.
 * Usage: npm run validate:catalog [-- path/to/catalog.json]
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { summarize, validateCatalog } from '../src/lib/validateCatalog';

const file = resolve(process.argv[2] ?? 'src/data/catalog.json');

let data: unknown;
try {
  data = JSON.parse(readFileSync(file, 'utf8'));
} catch (err) {
  console.error(`✖ Could not read or parse ${file}: ${(err as Error).message}`);
  process.exit(1);
}

const { errors, warnings } = summarize(validateCatalog(data));

for (const w of warnings) console.warn(`  warning  [${w.where}] ${w.path}: ${w.message}`);
for (const e of errors) console.error(`  error    [${e.where}] ${e.path}: ${e.message}`);

const count = Array.isArray((data as { apis?: unknown[] })?.apis) ? (data as { apis: unknown[] }).apis.length : 0;
if (errors.length > 0) {
  console.error(`\n✖ Catalog invalid: ${errors.length} error(s), ${warnings.length} warning(s) across ${count} entries.`);
  process.exit(1);
}
console.log(`✔ Catalog valid: ${count} entries, ${warnings.length} warning(s).`);
