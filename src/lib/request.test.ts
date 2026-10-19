import { describe, expect, it } from 'vitest';
import { checkUrl, explainStatus, isMixedContent, redactHeaders, redactUrl, sanitizeHeaders } from './request';

describe('checkUrl', () => {
  it('accepts public https URLs', () => {
    expect(checkUrl('https://pokeapi.co/api/v2/pokemon/ditto').ok).toBe(true);
  });
  it.each([
    'file:///etc/passwd',
    'javascript:alert(1)',
    'ftp://example.com',
    'http://localhost:3000',
    'http://127.0.0.1',
    'http://10.0.0.5',
    'http://172.16.0.1',
    'http://192.168.1.1',
    'http://169.254.169.254/latest/meta-data',
    'http://[::1]/',
    'http://[::ffff:127.0.0.1]/',
    'http://[fd00::1]/',
    'http://0x7f000001/',
    'http://2130706433/',
    'http://metadata.google.internal/',
    'http://printer.local/',
    'https://user:pass@example.com/',
    'not a url',
    '',
  ])('rejects %s', (u) => {
    expect(checkUrl(u).ok).toBe(false);
  });
});

describe('helpers', () => {
  it('detects mixed content', () => {
    expect(isMixedContent(new URL('http://ip-api.com/json'), 'https:')).toBe(true);
    expect(isMixedContent(new URL('https://x.com'), 'https:')).toBe(false);
  });
  it('drops forbidden and malformed headers', () => {
    const { headers, dropped } = sanitizeHeaders({ Accept: 'application/json', Cookie: 'a=b', 'Bad Name': 'x', 'X-Test': 'a\r\nInjected: 1' });
    expect(headers).toEqual({ Accept: 'application/json' });
    expect(dropped.sort()).toEqual(['Bad Name', 'Cookie', 'X-Test']);
  });
  it('redacts secrets', () => {
    expect(redactHeaders({ Authorization: 'Bearer abc', Accept: 'x' })).toEqual({ Authorization: '••••••', Accept: 'x' });
    expect(redactUrl('https://x.com/a?api_key=SECRET&q=1')).not.toContain('SECRET');
  });
  it('explains statuses', () => {
    expect(explainStatus(200)).toBeNull();
    expect(explainStatus(429)).toMatch(/rate limit/i);
    expect(explainStatus(503)).toMatch(/server error/i);
  });
});
