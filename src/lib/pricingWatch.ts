/**
 * Pricing-page change detection (report only). A changed hash means the page TEXT changed,
 * not that a price changed: it can be noise (copy edits, dates, A/B text). A maintainer must
 * look at the page and update the catalog by hand. Nothing here ever edits catalog data.
 */

export interface Snapshot { url: string; hash: string; length: number; checkedOn: string }
export type Snapshots = Record<string, Snapshot>;

export function normalizePageText(html: string): string {
  return html
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(script|style|noscript|svg|template)\b[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;|&#34;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

export async function sha256Hex(text: string): Promise<string> {
  const buf = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export interface RobotsRules { disallow: string[]; allow: string[] }

/** Minimal robots.txt parser: uses the group for our agent token, else "*". */
export function parseRobots(text: string, agentToken: string): RobotsRules {
  const groups: { agents: string[]; allow: string[]; disallow: string[] }[] = [];
  let cur: (typeof groups)[number] | null = null;
  let lastWasAgent = false;
  for (const lineRaw of text.split(/\r?\n/)) {
    const line = lineRaw.replace(/#.*/, '').trim();
    if (!line) continue;
    const i = line.indexOf(':');
    if (i < 0) continue;
    const key = line.slice(0, i).trim().toLowerCase();
    const val = line.slice(i + 1).trim();
    if (key === 'user-agent') {
      if (!cur || !lastWasAgent) { cur = { agents: [], allow: [], disallow: [] }; groups.push(cur); }
      cur.agents.push(val.toLowerCase());
      lastWasAgent = true;
    } else {
      lastWasAgent = false;
      if (!cur) continue;
      if (key === 'disallow') cur.disallow.push(val);
      else if (key === 'allow') cur.allow.push(val);
    }
  }
  const tok = agentToken.toLowerCase();
  const g = groups.find((x) => x.agents.some((a) => a !== '*' && tok.includes(a))) ?? groups.find((x) => x.agents.includes('*'));
  return g ? { disallow: g.disallow.filter(Boolean), allow: g.allow.filter(Boolean) } : { disallow: [], allow: [] };
}

/** Longest matching rule wins; allow wins ties. */
export function isAllowed(rules: RobotsRules, path: string): boolean {
  const best = (list: string[]) => list.filter((r) => path.startsWith(r)).reduce((m, r) => Math.max(m, r.length), -1);
  const d = best(rules.disallow);
  const a = best(rules.allow);
  return d < 0 || a >= d;
}

export interface WatchDiff {
  changed: { id: string; url: string; previous: Snapshot; current: Snapshot }[];
  unchanged: string[];
  /** Pages with no baseline yet. Informational only. */
  newPages: string[];
}

export function diffSnapshots(previous: Snapshots, current: Snapshots): WatchDiff {
  const diff: WatchDiff = { changed: [], unchanged: [], newPages: [] };
  for (const [id, cur] of Object.entries(current)) {
    const prev = previous[id];
    if (!prev) diff.newPages.push(id);
    else if (prev.hash !== cur.hash || prev.url !== cur.url) diff.changed.push({ id, url: cur.url, previous: prev, current: cur });
    else diff.unchanged.push(id);
  }
  return diff;
}

export function formatIssueBody(diff: WatchDiff, errors: { id: string; reason: string }[], today: string): string {
  const lines = [
    `Pricing-page text changed for ${diff.changed.length} API(s) as of ${today}.`,
    '',
    '**A changed hash does not mean a price changed.** It can be a copy edit, date or layout change. Open each page, compare with the catalog, and update the entry by hand (with `lastVerified`) only if a recorded price or quota is actually different. This job never edits the catalog.',
    '',
    '| API | Pricing page | Last baseline |',
    '| --- | --- | --- |',
    ...diff.changed.map((c) => `| \`${c.id}\` | ${c.url} | ${c.previous.checkedOn} |`),
  ];
  if (errors.length) lines.push('', 'Pages that could not be checked (not evidence of a change):', ...errors.map((e) => `- \`${e.id}\`: ${e.reason}`));
  lines.push('', 'After reviewing, a maintainer runs `npm run pricing:watch -- --accept <id>` and commits `data/pricing-snapshots.json` to reset the baseline.');
  return lines.join('\n');
}
