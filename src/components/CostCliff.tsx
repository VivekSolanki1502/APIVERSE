import { useMemo, useState } from 'react';
import type { ApiEntry } from '../types/catalog';
import { costCurve } from '../lib/cliffs';
import { formatMoney } from '../lib/format';

const W = 640;
const H = 220;
const PAD = { l: 52, r: 12, t: 12, b: 28 };

const MAX_OPTIONS = [10_000, 100_000, 1_000_000, 10_000_000];

/**
 * Accessible cost-versus-volume chart. Gaps (volumes with no reliable estimate) are drawn as a
 * hatched band, never as $0. A table below carries the same information as the SVG.
 */
export function CostCliff({ api }: { api: ApiEntry }) {
  const [max, setMax] = useState(1_000_000);
  const currency = api.pricing.currency;
  const fmt = (n: number) => formatMoney(n, currency);
  const curve = useMemo(() => costCurve(api, max, fmt), [api, max, currency]); // eslint-disable-line react-hooks/exhaustive-deps

  if (api.pricing.plans.length === 0) {
    return <p className="text-sm text-muted">No plans are recorded for this API, so there is no cost curve to draw. Unknown is not zero.</p>;
  }
  if (!curve.estimable) {
    return <p className="text-sm text-muted">The recorded plans cannot be estimated from request volume alone (for example token-based or unrecorded prices), so no curve is drawn.</p>;
  }

  const known = curve.points.filter((p) => p.total !== null) as { requests: number; total: number }[];
  const yMax = Math.max(1, ...known.map((p) => p.total)) * 1.1;
  const x = (r: number) => PAD.l + (Math.log10(r) / Math.log10(max)) * (W - PAD.l - PAD.r);
  const y = (v: number) => PAD.t + (1 - v / yMax) * (H - PAD.t - PAD.b);

  // Build step-like segments of consecutive known points; gaps break the line.
  const segments: string[] = [];
  let cur: string[] = [];
  for (const p of curve.points) {
    if (p.total === null) {
      if (cur.length) segments.push(cur.join(' '));
      cur = [];
    } else cur.push(`${cur.length ? 'L' : 'M'}${x(p.requests).toFixed(1)},${y(p.total).toFixed(1)}`);
  }
  if (cur.length) segments.push(cur.join(' '));

  const gaps = curve.cliffs.filter((c) => c.kind === 'not-estimable');
  const firstGap = gaps[0];
  const ticks = [1, 10, 100, 1_000, 10_000, 100_000, 1_000_000, 10_000_000].filter((t) => t <= max);

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <label className="text-sm" htmlFor="cliff-max">
          Show volumes up to{' '}
          <select id="cliff-max" className="input inline-block w-auto" value={max} onChange={(e) => setMax(Number(e.target.value))}>
            {MAX_OPTIONS.map((m) => (
              <option key={m} value={m}>{m.toLocaleString('en-US')} requests/month</option>
            ))}
          </select>
        </label>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-labelledby="cliff-title cliff-desc" className="w-full">
        <title id="cliff-title">{`Estimated monthly cost of ${api.name} by request volume`}</title>
        <desc id="cliff-desc">{curve.cliffs.length ? curve.cliffs.map((c) => c.message).join(' ') : 'The estimated cost does not change plan across this range.'}</desc>
        <defs>
          <pattern id="hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="6" stroke="currentColor" strokeWidth="1" opacity="0.35" />
          </pattern>
        </defs>
        {firstGap && <rect x={x(firstGap.fromRequests)} y={PAD.t} width={Math.max(0, W - PAD.r - x(firstGap.fromRequests))} height={H - PAD.t - PAD.b} fill="url(#hatch)" className="text-muted" />}
        <line x1={PAD.l} y1={H - PAD.b} x2={W - PAD.r} y2={H - PAD.b} stroke="currentColor" opacity="0.4" />
        <line x1={PAD.l} y1={PAD.t} x2={PAD.l} y2={H - PAD.b} stroke="currentColor" opacity="0.4" />
        {ticks.map((t) => (
          <g key={t}>
            <line x1={x(t)} y1={H - PAD.b} x2={x(t)} y2={H - PAD.b + 4} stroke="currentColor" opacity="0.4" />
            <text x={x(t)} y={H - 8} textAnchor="middle" fontSize="10" fill="currentColor" opacity="0.7">{t >= 1000 ? `${t / 1000}k` : t}</text>
          </g>
        ))}
        <text x={PAD.l - 6} y={y(0) + 3} textAnchor="end" fontSize="10" fill="currentColor" opacity="0.7">0</text>
        <text x={PAD.l - 6} y={PAD.t + 8} textAnchor="end" fontSize="10" fill="currentColor" opacity="0.7">{fmt(Math.round(yMax))}</text>
        {segments.map((d) => (
          <path key={d} d={d} fill="none" stroke="rgb(var(--accent, 59 130 246))" strokeWidth="2" />
        ))}
        {curve.cliffs.filter((c) => c.kind !== 'estimable-again').map((c) => (
          <line key={`${c.kind}-${c.fromRequests}`} x1={x(c.fromRequests)} y1={PAD.t} x2={x(c.fromRequests)} y2={H - PAD.b} stroke="currentColor" strokeDasharray="3 3" opacity="0.5" />
        ))}
      </svg>
      <p className="text-xs text-muted">Horizontal axis: requests per month (log scale). Vertical axis: estimated monthly cost. Hatched area: no reliable estimate, which is not the same as free.</p>

      {curve.cliffs.length > 0 ? (
        <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm">
          {curve.cliffs.map((c) => (
            <li key={`${c.kind}-${c.fromRequests}`}>{c.message}</li>
          ))}
        </ol>
      ) : (
        <p className="mt-3 text-sm text-muted">No plan changes or gaps were found in this range.</p>
      )}
    </div>
  );
}
