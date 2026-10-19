import { describe, expect, it } from 'vitest';
import { apis } from './catalog';
import { buildIssueUrl, buildObservation, detectBrowser, redactForReport } from './corsEvidence';
import type { ExecuteResult } from './request';

const api = apis[0]!;
const okRes: ExecuteResult = { ok: true, status: 200, statusText: 'OK', durationMs: 5, headers: {}, bodyText: '{}', json: {}, jsonError: false, truncated: false, statusHint: null };
const fail = (kind: 'cors-or-network' | 'timeout'): ExecuteResult => ({ ok: false, kind, message: 'x', durationMs: 5 });
const base = { api, requestUrl: 'https://api.example.com/v1/x?q=secret&apikey=SUPERSECRET', userAgent: 'Mozilla/5.0 Chrome/130.0.0.0 Safari/537.36', today: '2026-10-13', worksOutsideBrowser: false };

describe('CORS evidence', () => {
  it('records a readable response, even with an error status', () => {
    const r = buildObservation({ ...base, result: { ...okRes, status: 401 } as ExecuteResult });
    expect(r.ok && r.observation.result).toBe('readable');
  });
  it('treats a browser failure alone as inconclusive', () => {
    const r = buildObservation({ ...base, result: fail('cors-or-network') });
    expect(r.ok).toBe(false);
  });
  it('records blocked only when the person confirms it works outside a browser', () => {
    const r = buildObservation({ ...base, result: fail('cors-or-network'), worksOutsideBrowser: true });
    expect(r.ok && r.observation.result).toBe('blocked-confirmed');
  });
  it('ignores timeouts entirely', () => {
    expect(buildObservation({ ...base, result: fail('timeout'), worksOutsideBrowser: true }).ok).toBe(false);
  });
  it('never leaks query values into the URL or issue', () => {
    expect(redactForReport(base.requestUrl)).toBe('https://api.example.com/v1/x?q=…&apikey=…');
    const r = buildObservation({ ...base, result: okRes });
    if (!r.ok) throw new Error('expected ok');
    const url = decodeURIComponent(buildIssueUrl('https://github.com/o/r', r.observation));
    expect(url).not.toMatch(/SUPERSECRET|secret&/);
    expect(url).toMatch(/template=cors-report\.yml/);
  });
  it('detects browsers conservatively', () => {
    expect(detectBrowser('Mozilla/5.0 Firefox/131.0')).toBe('Firefox 131');
    expect(detectBrowser('Mozilla/5.0 Chrome/130.0 Safari/537 Edg/130.0')).toBe('Edge 130');
    expect(detectBrowser('curl/8')).toBe('Unknown browser');
  });
});
