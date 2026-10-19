/**
 * Safe client-side request layer for the playground.
 *
 * There is NO server-side proxy: requests go straight from the user's browser, so the browser
 * enforces CORS and the user's own network is the only thing at risk. This module still treats
 * the URL as untrusted input: it allows only http/https, refuses local/private/metadata
 * destinations, refuses credentials embedded in URLs, and never persists secrets.
 */

export type UrlCheck = { ok: true; url: URL } | { ok: false; reason: string };

const SENSITIVE_HEADERS = new Set(['authorization', 'proxy-authorization', 'cookie', 'x-api-key', 'x-goog-api-key', 'x-cg-demo-api-key']);
const FORBIDDEN_HEADERS = new Set(['host', 'origin', 'referer', 'user-agent', 'cookie', 'content-length', 'connection', 'accept-encoding', 'transfer-encoding', 'upgrade', 'via']);

function ipv4ToInts(host: string): number[] | null {
  // Handles dotted-decimal plus the integer / hex / octal forms WHATWG URL normalizes already.
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (!m) return null;
  const parts = m.slice(1).map(Number);
  return parts.every((p) => p <= 255) ? parts : null;
}

export function isBlockedHost(hostname: string): string | null {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '').replace(/\.$/, '');
  if (host === '' ) return 'The URL has no host.';
  if (host === 'localhost' || host.endsWith('.localhost')) return 'Localhost is blocked.';
  if (host.endsWith('.local') || host.endsWith('.internal') || host.endsWith('.lan') || host.endsWith('.home.arpa')) return 'Local network names are blocked.';
  if (host === 'metadata.google.internal') return 'Cloud metadata hosts are blocked.';

  const v4 = ipv4ToInts(host);
  if (v4) {
    const [a, b] = v4 as [number, number, number, number];
    if (a === 0 || a === 127) return 'Loopback and "this network" addresses are blocked.';
    if (a === 10) return 'Private (10.0.0.0/8) addresses are blocked.';
    if (a === 172 && b >= 16 && b <= 31) return 'Private (172.16.0.0/12) addresses are blocked.';
    if (a === 192 && b === 168) return 'Private (192.168.0.0/16) addresses are blocked.';
    if (a === 169 && b === 254) return 'Link-local and cloud metadata addresses are blocked.';
    if (a === 100 && b >= 64 && b <= 127) return 'Carrier-grade NAT addresses are blocked.';
    if (a >= 224) return 'Multicast and reserved addresses are blocked.';
    return null;
  }
  if (host.includes(':')) {
    // IPv6 literal.
    if (host === '::1' || host === '::') return 'Loopback addresses are blocked.';
    if (/^f[cd]/.test(host)) return 'Private IPv6 (fc00::/7) addresses are blocked.';
    if (/^fe[89ab]/.test(host)) return 'Link-local IPv6 addresses are blocked.';
    const mapped = /^::ffff:(?:(\d+\.\d+\.\d+\.\d+)|([0-9a-f]{1,4}):([0-9a-f]{1,4}))$/.exec(host);
    if (mapped) {
      if (mapped[1]) return isBlockedHost(mapped[1]);
      const hi = Number.parseInt(mapped[2] ?? '0', 16);
      const lo = Number.parseInt(mapped[3] ?? '0', 16);
      return isBlockedHost(`${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`);
    }
    return 'IPv6 literal addresses are not supported in the playground.';
  }
  return null;
}

export function checkUrl(input: string): UrlCheck {
  const trimmed = input.trim();
  if (!trimmed) return { ok: false, reason: 'Enter a URL.' };
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return { ok: false, reason: 'That is not a valid absolute URL (include https://).' };
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return { ok: false, reason: `Unsupported scheme "${url.protocol}". Only http and https are allowed.` };
  if (url.username || url.password) return { ok: false, reason: 'URLs with embedded credentials are not allowed. Use a header instead.' };
  const blocked = isBlockedHost(url.hostname);
  if (blocked) return { ok: false, reason: `${blocked} The playground only calls public internet hosts.` };
  return { ok: true, url };
}

/** Mixed content: an https page cannot call plain-http endpoints. */
export function isMixedContent(url: URL, pageProtocol: string): boolean {
  return pageProtocol === 'https:' && url.protocol === 'http:';
}

export function sanitizeHeaders(headers: Record<string, string>): { headers: Record<string, string>; dropped: string[] } {
  const out: Record<string, string> = {};
  const dropped: string[] = [];
  for (const [rawName, value] of Object.entries(headers)) {
    const name = rawName.trim();
    if (!name) continue;
    if (!/^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/.test(name) || /[\r\n]/.test(value)) { dropped.push(name); continue; }
    if (FORBIDDEN_HEADERS.has(name.toLowerCase())) { dropped.push(name); continue; }
    out[name] = value;
  }
  return { headers: out, dropped };
}

export const isSensitiveHeader = (name: string) => SENSITIVE_HEADERS.has(name.trim().toLowerCase());

/** Mask secrets for display or logging. */
export function redactHeaders(headers: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(headers).map(([k, v]) => [k, isSensitiveHeader(k) ? '••••••' : v]));
}

export function redactUrl(url: string): string {
  try {
    const u = new URL(url);
    for (const key of [...u.searchParams.keys()]) {
      if (/key|token|secret|password|auth|appid|apikey/i.test(key)) u.searchParams.set(key, '••••••');
    }
    return u.toString();
  } catch {
    return url;
  }
}

export type FailureKind = 'http' | 'cors-or-network' | 'timeout' | 'cancelled' | 'mixed-content' | 'invalid-json';

export function explainStatus(status: number): string | null {
  if (status >= 200 && status < 300) return null;
  if (status === 400) return '400 Bad Request: the provider rejected the request. Check query parameters and body against its documentation.';
  if (status === 401) return '401 Unauthorized: authentication is required or the credential is invalid or expired.';
  if (status === 403) return '403 Forbidden: your credential lacks permission, the provider blocks this client, or a quota or terms restriction applies.';
  if (status === 404) return '404 Not Found: the resource or endpoint does not exist. Check the path and identifiers.';
  if (status === 429) return '429 Too Many Requests: you hit a rate limit. Wait and retry; check the provider\'s documented limits.';
  if (status >= 500) return `${status} Server Error: the provider reported an internal error. This may be temporary; check its status page.`;
  if (status >= 300 && status < 400) return `${status}: the request was redirected.`;
  return `${status}: the provider returned an unexpected status.`;
}

export function explainFailure(kind: FailureKind): string {
  switch (kind) {
    case 'cors-or-network':
      return 'The browser blocked or could not complete the request. This is usually a CORS restriction (the provider does not allow calls from web pages), but it can also be a network error, an ad-blocker, or a provider outage. The browser deliberately hides which, so this is NOT proof the provider is down. Try the same request with cURL, or check the provider\'s status page.';
    case 'timeout':
      return 'The request timed out. The provider may be slow or unreachable. This does not by itself confirm an outage.';
    case 'cancelled':
      return 'Request cancelled.';
    case 'mixed-content':
      return 'This endpoint uses plain http, which browsers block from an https page (mixed content). Use the official documentation or cURL instead.';
    case 'invalid-json':
      return 'The response was received but is not valid JSON. It is shown below as plain text.';
    case 'http':
      return 'The provider returned an error status.';
  }
}

export interface ExecuteOptions {
  method?: 'GET' | 'POST';
  headers?: Record<string, string>;
  body?: string | null;
  timeoutMs?: number;
  signal?: AbortSignal;
  fetchImpl?: typeof fetch;
  pageProtocol?: string;
  maxBytes?: number;
}

export type ExecuteResult =
  | {
      ok: true;
      status: number;
      statusText: string;
      durationMs: number;
      headers: Record<string, string>;
      bodyText: string;
      json: unknown | undefined;
      jsonError: boolean;
      truncated: boolean;
      statusHint: string | null;
    }
  | { ok: false; kind: FailureKind; message: string; durationMs: number };

const SAFE_RESPONSE_HEADERS = ['content-type', 'content-length', 'cache-control', 'etag', 'last-modified', 'retry-after', 'x-ratelimit-limit', 'x-ratelimit-remaining', 'x-ratelimit-reset', 'ratelimit-limit', 'ratelimit-remaining', 'ratelimit-reset', 'date', 'server'];

export async function executeRequest(rawUrl: string, opts: ExecuteOptions = {}): Promise<ExecuteResult> {
  const started = performance.now();
  const elapsed = () => Math.round(performance.now() - started);
  const check = checkUrl(rawUrl);
  if (!check.ok) return { ok: false, kind: 'http', message: check.reason, durationMs: 0 };
  if (isMixedContent(check.url, opts.pageProtocol ?? globalThis.location?.protocol ?? 'https:')) {
    return { ok: false, kind: 'mixed-content', message: explainFailure('mixed-content'), durationMs: 0 };
  }

  const method = opts.method ?? 'GET';
  const { headers } = sanitizeHeaders(opts.headers ?? {});
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; controller.abort(); }, opts.timeoutMs ?? 20_000);
  const onAbort = () => controller.abort();
  opts.signal?.addEventListener('abort', onAbort);

  try {
    const res = await (opts.fetchImpl ?? fetch)(check.url.toString(), {
      method,
      headers,
      body: method === 'GET' ? undefined : (opts.body ?? undefined),
      signal: controller.signal,
      credentials: 'omit', // never send cookies to third-party hosts
      redirect: 'follow',
      referrerPolicy: 'no-referrer',
      cache: 'no-store',
    });

    const maxBytes = opts.maxBytes ?? 2_000_000;
    const text = await res.text();
    const truncated = text.length > maxBytes;
    const bodyText = truncated ? text.slice(0, maxBytes) : text;

    let json: unknown;
    let jsonError = false;
    if (!truncated && bodyText.trim() !== '') {
      try { json = JSON.parse(bodyText); } catch { jsonError = true; }
    }
    const safe: Record<string, string> = {};
    res.headers.forEach((v, k) => { if (SAFE_RESPONSE_HEADERS.includes(k.toLowerCase())) safe[k.toLowerCase()] = v; });

    return {
      ok: true, status: res.status, statusText: res.statusText, durationMs: elapsed(), headers: safe,
      bodyText, json, jsonError, truncated, statusHint: explainStatus(res.status),
    };
  } catch (err) {
    if (opts.signal?.aborted) return { ok: false, kind: 'cancelled', message: explainFailure('cancelled'), durationMs: elapsed() };
    if (timedOut) return { ok: false, kind: 'timeout', message: explainFailure('timeout'), durationMs: elapsed() };
    void err;
    return { ok: false, kind: 'cors-or-network', message: explainFailure('cors-or-network'), durationMs: elapsed() };
  } finally {
    clearTimeout(timer);
    opts.signal?.removeEventListener('abort', onAbort);
  }
}
