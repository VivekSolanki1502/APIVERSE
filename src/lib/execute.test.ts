import { describe, expect, it } from 'vitest';
import { executeRequest } from './request';

type Init = RequestInit & { signal?: AbortSignal };

function response(status: number, body: string, statusText = ''): Response {
  return new Response(body, { status: status === 204 ? 200 : status, statusText, headers: { 'content-type': 'application/json', 'set-cookie-ignored': 'x', 'x-ratelimit-remaining': '9' } });
}

describe('executeRequest: honest error handling', () => {
  it('never fabricates a response when the network/CORS layer fails', async () => {
    const r = await executeRequest('https://example.com/x', { fetchImpl: (async () => { throw new TypeError('Failed to fetch'); }) as typeof fetch, pageProtocol: 'https:' });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.kind).toBe('cors-or-network');
      expect(r.message).toMatch(/NOT proof the provider is down/);
    }
  });

  it('reports provider errors as errors with an explanation, not as success', async () => {
    const r = await executeRequest('https://example.com/x', { fetchImpl: (async () => response(500, '{"error":"boom"}')) as typeof fetch, pageProtocol: 'https:' });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.status).toBe(500);
      expect(r.statusHint).toMatch(/Server Error/);
    }
  });

  it('explains 429 and 401', async () => {
    for (const [status, re] of [[429, /rate limit/i], [401, /authentication/i]] as const) {
      const r = await executeRequest('https://example.com/x', { fetchImpl: (async () => response(status, '{}')) as typeof fetch, pageProtocol: 'https:' });
      expect(r.ok && r.statusHint).toMatch(re);
    }
  });

  it('flags invalid JSON and keeps the body as plain text', async () => {
    const r = await executeRequest('https://example.com/x', { fetchImpl: (async () => response(200, '<script>alert(1)</script>')) as typeof fetch, pageProtocol: 'https:' });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.jsonError).toBe(true);
      expect(r.json).toBeUndefined();
      expect(r.bodyText).toBe('<script>alert(1)</script>'); // returned as inert text for escaped rendering
    }
  });

  it('parses valid JSON', async () => {
    const r = await executeRequest('https://example.com/x', { fetchImpl: (async () => response(200, '{"a":1}')) as typeof fetch, pageProtocol: 'https:' });
    expect(r.ok && r.json).toEqual({ a: 1 });
  });

  it('refuses blocked destinations without ever calling fetch', async () => {
    let called = false;
    const r = await executeRequest('http://169.254.169.254/latest/meta-data', { fetchImpl: (async () => { called = true; return response(200, '{}'); }) as typeof fetch });
    expect(r.ok).toBe(false);
    expect(called).toBe(false);
  });

  it('refuses plain-http endpoints from an https page (mixed content)', async () => {
    let called = false;
    const r = await executeRequest('http://ip-api.com/json', { pageProtocol: 'https:', fetchImpl: (async () => { called = true; return response(200, '{}'); }) as typeof fetch });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.kind).toBe('mixed-content');
    expect(called).toBe(false);
  });

  it('times out', async () => {
    const hang = ((_u: string, init: Init) => new Promise((_res, rej) => init.signal?.addEventListener('abort', () => rej(new DOMException('aborted', 'AbortError'))))) as unknown as typeof fetch;
    const r = await executeRequest('https://example.com/x', { fetchImpl: hang, timeoutMs: 20, pageProtocol: 'https:' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.kind).toBe('timeout');
  });

  it('can be cancelled by the user', async () => {
    const ctl = new AbortController();
    const hang = ((_u: string, init: Init) => new Promise((_res, rej) => init.signal?.addEventListener('abort', () => rej(new DOMException('aborted', 'AbortError'))))) as unknown as typeof fetch;
    const p = executeRequest('https://example.com/x', { fetchImpl: hang, signal: ctl.signal, timeoutMs: 5000, pageProtocol: 'https:' });
    ctl.abort();
    const r = await p;
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.kind).toBe('cancelled');
  });

  it('never sends cookies or a referrer, and strips forbidden headers', async () => {
    let seen: Init | undefined;
    await executeRequest('https://example.com/x', {
      headers: { Accept: 'application/json', Cookie: 'session=1' },
      pageProtocol: 'https:',
      fetchImpl: (async (_u: string, init: Init) => { seen = init; return response(200, '{}'); }) as unknown as typeof fetch,
    });
    expect(seen?.credentials).toBe('omit');
    expect(seen?.referrerPolicy).toBe('no-referrer');
    expect(seen?.headers).toEqual({ Accept: 'application/json' });
  });

  it('only exposes a safe subset of response headers', async () => {
    const r = await executeRequest('https://example.com/x', { fetchImpl: (async () => response(200, '{}')) as typeof fetch, pageProtocol: 'https:' });
    if (r.ok) {
      expect(r.headers['x-ratelimit-remaining']).toBe('9');
      expect(Object.keys(r.headers).includes('set-cookie-ignored')).toBe(false);
    }
  });
});
