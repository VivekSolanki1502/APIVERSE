/**
 * Local-only favorites and collections. Nothing is synced to a server. Shareable links carry
 * only a name and API ids (public catalog ids), never secrets.
 */

export interface Collection {
  id: string;
  name: string;
  apiIds: string[];
  createdAt: string;
}

export interface CollectionExport {
  format: 'apiverse-collection';
  version: 1;
  name: string;
  apiIds: string[];
}

const ID_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const MAX_NAME = 80;
export const MAX_IDS = 200;

export function newCollection(name: string, apiIds: string[] = []): Collection {
  const id = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `c-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return { id, name: cleanName(name) || 'Untitled collection', apiIds: [...new Set(apiIds)], createdAt: new Date().toISOString() };
}

// Strip control characters before names enter the UI, URL, or export data.
// eslint-disable-next-line no-control-regex
export const cleanName = (s: string) => s.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, MAX_NAME);

export function toExport(c: Collection): CollectionExport {
  return { format: 'apiverse-collection', version: 1, name: c.name, apiIds: [...c.apiIds] };
}

export type ImportResult = { ok: true; name: string; apiIds: string[]; skipped: string[] } | { ok: false; error: string };

/** Safely parse an imported file. Unknown ids are skipped (not trusted), never executed. */
export function parseImport(text: string, knownIds: Set<string>): ImportResult {
  if (text.length > 100_000) return { ok: false, error: 'File is too large to be a collection.' };
  let data: unknown;
  try { data = JSON.parse(text); } catch { return { ok: false, error: 'File is not valid JSON.' }; }
  if (typeof data !== 'object' || data === null) return { ok: false, error: 'Unexpected file contents.' };
  const d = data as Record<string, unknown>;
  if (d.format !== 'apiverse-collection' || d.version !== 1) return { ok: false, error: 'Not an APIverse collection file (format or version mismatch).' };
  if (typeof d.name !== 'string' || !cleanName(d.name)) return { ok: false, error: 'Collection name is missing.' };
  if (!Array.isArray(d.apiIds) || d.apiIds.length > MAX_IDS) return { ok: false, error: `apiIds must be an array of at most ${MAX_IDS} ids.` };
  const apiIds: string[] = [];
  const skipped: string[] = [];
  for (const id of d.apiIds) {
    if (typeof id !== 'string' || !ID_RE.test(id)) { skipped.push(String(id).slice(0, 40)); continue; }
    if (!knownIds.has(id)) { skipped.push(id); continue; }
    if (!apiIds.includes(id)) apiIds.push(id);
  }
  return { ok: true, name: cleanName(d.name), apiIds, skipped };
}

/** Encode as URL-safe text: "name~id1,id2". Not secret, not private. */
export function encodeShare(c: Pick<Collection, 'name' | 'apiIds'>): string {
  const payload = JSON.stringify({ n: cleanName(c.name), i: c.apiIds });
  const bytes = new TextEncoder().encode(payload);
  let bin = '';
  bytes.forEach((b) => { bin += String.fromCharCode(b); });
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function decodeShare(token: string, knownIds: Set<string>): ImportResult {
  if (token.length > 8_000) return { ok: false, error: 'Share link is too long.' };
  try {
    const b64 = token.replace(/-/g, '+').replace(/_/g, '/');
    const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
    const text = new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
    const d = JSON.parse(text) as { n?: unknown; i?: unknown };
    return parseImport(JSON.stringify({ format: 'apiverse-collection', version: 1, name: d.n, apiIds: d.i }), knownIds);
  } catch {
    return { ok: false, error: 'This share link is not valid.' };
  }
}
