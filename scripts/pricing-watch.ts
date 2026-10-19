/**
 * Pricing-page watch. Fetches each catalog pricingUrl politely (one at a time, delayed,
 * robots.txt respected, identifying User-Agent), hashes the normalized text and compares it
 * with data/pricing-snapshots.json.
 *
 *   tsx scripts/pricing-watch.ts                  report only; writes pricing-watch-report.md if something changed
 *   tsx scripts/pricing-watch.ts --accept-new     (human) record baselines for pages that have none
 *   tsx scripts/pricing-watch.ts --accept <id>    (human) accept the current page text for one API after reviewing it
 *
 * It NEVER edits src/data/catalog.json. Pages that are JavaScript-rendered or blocked cannot be
 * read and are reported as "could not check", never as "unchanged".
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { diffSnapshots, formatIssueBody, isAllowed, normalizePageText, parseRobots, sha256Hex, type Snapshots } from '../src/lib/pricingWatch';

interface Config { delayMs: number; timeoutMs: number; userAgent: string; exclude: string[] }
const config = JSON.parse(readFileSync('data/pricing-watch.config.json', 'utf8')) as Config;
const catalog = JSON.parse(readFileSync('src/data/catalog.json', 'utf8')) as { apis: { id: string; pricing: { pricingUrl: string | null } }[] };
const store = JSON.parse(readFileSync('data/pricing-snapshots.json', 'utf8')) as { schemaVersion: number; snapshots: Snapshots };

const args = process.argv.slice(2);
const acceptNew = args.includes('--accept-new');
const acceptIdx = args.indexOf('--accept');
const acceptId = acceptIdx >= 0 ? args[acceptIdx + 1] : null;
if (acceptIdx >= 0 && !acceptId) { console.error('--accept needs an API id'); process.exit(2); }

const today = new Date().toISOString().slice(0, 10);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const robotsCache = new Map<string, ReturnType<typeof parseRobots> | 'unreadable'>();

async function get(url: string): Promise<Response> {
  return fetch(url, { headers: { 'User-Agent': config.userAgent, Accept: 'text/html,text/plain' }, signal: AbortSignal.timeout(config.timeoutMs), redirect: 'follow' });
}

async function allowedByRobots(url: URL): Promise<boolean> {
  let rules = robotsCache.get(url.origin);
  if (!rules) {
    try {
      const res = await get(`${url.origin}/robots.txt`);
      // 404 means no rules; any other failure is treated as "do not fetch" (fail closed).
      rules = res.status === 404 ? { disallow: [], allow: [] } : res.ok ? parseRobots(await res.text(), config.userAgent) : 'unreadable';
    } catch {
      rules = 'unreadable';
    }
    robotsCache.set(url.origin, rules);
  }
  return rules !== 'unreadable' && isAllowed(rules, url.pathname);
}

const targets = catalog.apis.filter((a) => a.pricing.pricingUrl && !config.exclude.includes(a.id) && (!acceptId || a.id === acceptId));
if (acceptId && targets.length === 0) { console.error(`No watchable pricing URL for "${acceptId}".`); process.exit(2); }

const current: Snapshots = {};
const errors: { id: string; reason: string }[] = [];

for (const [i, api] of targets.entries()) {
  if (i > 0) await sleep(config.delayMs);
  const url = new URL(api.pricing.pricingUrl as string);
  try {
    if (!(await allowedByRobots(url))) { errors.push({ id: api.id, reason: 'robots.txt does not allow (or could not be read); skipped' }); continue; }
    const res = await get(url.toString());
    if (!res.ok) { errors.push({ id: api.id, reason: `HTTP ${res.status}` }); continue; }
    const text = normalizePageText(await res.text());
    if (text.length < 200) { errors.push({ id: api.id, reason: 'page text too short (probably rendered by JavaScript); cannot be monitored' }); continue; }
    current[api.id] = { url: url.toString(), hash: await sha256Hex(text), length: text.length, checkedOn: today };
  } catch (e) {
    errors.push({ id: api.id, reason: e instanceof Error ? e.message : 'request failed' });
  }
}

if (acceptId || acceptNew) {
  for (const [id, snap] of Object.entries(current)) {
    if (acceptId || !store.snapshots[id]) store.snapshots[id] = snap;
  }
  writeFileSync('data/pricing-snapshots.json', JSON.stringify(store, null, 2) + '\n');
  console.log(`Recorded ${Object.keys(current).length} checked page(s) (new baselines or accepted). Commit data/pricing-snapshots.json.`);
  errors.forEach((e) => console.warn(`could not check ${e.id}: ${e.reason}`));
  process.exit(0);
}

const diff = diffSnapshots(store.snapshots, current);
console.log(`Checked ${Object.keys(current).length}/${targets.length}. Changed: ${diff.changed.length}. No baseline yet: ${diff.newPages.length}. Could not check: ${errors.length}.`);
errors.forEach((e) => console.warn(`could not check ${e.id}: ${e.reason}`));
if (diff.changed.length > 0) {
  writeFileSync('pricing-watch-report.md', formatIssueBody(diff, errors, today));
  console.log('Wrote pricing-watch-report.md');
}
