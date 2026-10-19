/**
 * Optional, polite link checker for catalog URLs. Sequential, with a delay between requests.
 * Failures can be temporary or caused by bot protection: investigate manually.
 * Usage: npm run check:links
 */
import { readFileSync } from 'node:fs';

const DELAY_MS = 1000;
const TIMEOUT_MS = 15000;
const UA = 'APIverse-link-check/0.1 (+https://github.com/your-org/apiverse)';

interface Entry {
  id: string;
  documentationUrl: string;
  officialWebsiteUrl: string;
  statusPageUrl: string | null;
  pricing: { pricingUrl: string | null; termsUrl: string | null };
}

const catalog = JSON.parse(readFileSync('src/data/catalog.json', 'utf8')) as { apis: Entry[] };
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function probe(url: string): Promise<string | null> {
  for (const method of ['HEAD', 'GET'] as const) {
    try {
      const res = await fetch(url, { method, redirect: 'follow', headers: { 'user-agent': UA }, signal: AbortSignal.timeout(TIMEOUT_MS) });
      if (res.ok) return null;
      if (method === 'GET') return `HTTP ${res.status}`;
    } catch (err) {
      if (method === 'GET') return (err as Error).message;
    }
  }
  return 'unknown failure';
}

const seen = new Set<string>();
let failures = 0;
for (const api of catalog.apis) {
  const urls = [api.documentationUrl, api.officialWebsiteUrl, api.statusPageUrl, api.pricing.pricingUrl, api.pricing.termsUrl].filter((u): u is string => Boolean(u));
  for (const url of urls) {
    if (seen.has(url)) continue;
    seen.add(url);
    const problem = await probe(url);
    if (problem) {
      failures++;
      console.warn(`✖ [${api.id}] ${url} — ${problem}`);
    } else {
      console.log(`✔ [${api.id}] ${url}`);
    }
    await sleep(DELAY_MS);
  }
}
console.log(`\n${seen.size} URLs checked, ${failures} problem(s). Investigate manually before changing any data.`);
process.exit(failures > 0 ? 1 : 0);
