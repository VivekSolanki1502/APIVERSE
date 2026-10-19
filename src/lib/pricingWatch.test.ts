import { describe, expect, it } from 'vitest';
import { diffSnapshots, formatIssueBody, isAllowed, normalizePageText, parseRobots, sha256Hex } from './pricingWatch';

describe('pricing watch', () => {
  it('normalizes away scripts, tags and whitespace noise', () => {
    const a = normalizePageText('<html><script>var t=1</script><h1>Pro  $35</h1><!-- c --></html>');
    const b = normalizePageText('<html><script>var t=999</script>\n<h1>Pro $35</h1></html>');
    expect(a).toBe('Pro $35');
    expect(a).toBe(b);
  });
  it('hashes deterministically', async () => {
    expect(await sha256Hex('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });
  it('honours robots.txt for our agent, falling back to *', () => {
    const r = parseRobots('User-agent: *\nDisallow: /private\nAllow: /private/pricing\n', 'APIverse-pricing-watch');
    expect(isAllowed(r, '/pricing')).toBe(true);
    expect(isAllowed(r, '/private/x')).toBe(false);
    expect(isAllowed(r, '/private/pricing')).toBe(true);
    const own = parseRobots('User-agent: *\nDisallow: /\n\nUser-agent: apiverse\nDisallow:\n', 'APIverse-pricing-watch');
    expect(isAllowed(own, '/pricing')).toBe(true);
    expect(isAllowed(parseRobots('User-agent: *\nDisallow: /\n', 'x'), '/pricing')).toBe(false);
  });
  it('diffs snapshots and treats new pages as informational', () => {
    const s = (hash: string) => ({ url: 'https://e.com/p', hash, length: 1, checkedOn: '2026-10-01' });
    const d = diffSnapshots({ a: s('1'), b: s('1') }, { a: s('1'), b: s('2'), c: s('3') });
    expect(d.unchanged).toEqual(['a']);
    expect(d.changed.map((x) => x.id)).toEqual(['b']);
    expect(d.newPages).toEqual(['c']);
  });
  it('warns in the issue body that a hash change is not a price change', () => {
    const s = { url: 'https://e.com/p', hash: '1', length: 1, checkedOn: '2026-10-01' };
    const body = formatIssueBody({ changed: [{ id: 'b', url: s.url, previous: s, current: s }], unchanged: [], newPages: [] }, [], '2026-10-14');
    expect(body).toMatch(/does not mean a price changed/);
    expect(body).toMatch(/never edits the catalog/);
  });
});
