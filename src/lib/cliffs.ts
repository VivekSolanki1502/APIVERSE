/**
 * Cost cliffs: how the estimated monthly cost of an API changes as request volume grows.
 *
 * The curve is the cheapest *estimable* recorded plan at each volume. Volumes where no plan
 * can be estimated reliably are reported as gaps (null), never as zero. Breakpoints are found
 * by sampling on a log scale and then bisecting to the exact first request count where the
 * cheapest-plan state changes. Pure and deterministic, no network.
 */
import type { ApiEntry } from '../types/catalog';
import { cheapestEstimate } from './cost';

export interface CurvePoint {
  requests: number;
  /** Estimated monthly total, or null when no plan can be estimated reliably. */
  total: number | null;
  plan: string | null;
}

export type CliffKind = 'free-ends' | 'plan-change' | 'not-estimable' | 'estimable-again';

export interface Cliff {
  kind: CliffKind;
  /** First monthly request count at which the new state applies. */
  fromRequests: number;
  fromPlan: string | null;
  toPlan: string | null;
  fromTotal: number | null;
  toTotal: number | null;
  message: string;
}

export interface CostCurve {
  points: CurvePoint[];
  cliffs: Cliff[];
  maxRequests: number;
  /** True when at least one volume could be estimated. */
  estimable: boolean;
}

export function costAt(api: ApiEntry, requests: number): CurvePoint {
  const best = cheapestEstimate(api, { monthlyRequests: requests });
  if (!best || !best.result.ok) return { requests, total: null, plan: null };
  return { requests, total: best.result.total, plan: best.plan.name };
}

/** Coarse state: a change in this key is a cliff. Cost growth inside one plan is not. */
function stateKey(p: CurvePoint): string {
  if (p.total === null) return 'none';
  return `${p.plan}|${p.total === 0 ? 'free' : 'paid'}`;
}

export function logSpaced(max: number, count = 120): number[] {
  const out = new Set<number>([1]);
  const top = Math.max(2, Math.floor(max));
  for (let i = 1; i <= count; i++) out.add(Math.max(1, Math.round(Math.pow(top, i / count))));
  out.add(top);
  return [...out].sort((a, b) => a - b);
}

function describe(a: CurvePoint, b: CurvePoint, fmt: (n: number) => string): Pick<Cliff, 'kind' | 'message'> {
  const n = b.requests.toLocaleString('en-US');
  const prev = (b.requests - 1).toLocaleString('en-US');
  if (a.total !== null && b.total === null) {
    return { kind: 'not-estimable', message: `Above ${prev} requests/month the cost cannot be estimated reliably from the recorded data. Check the provider's pricing page.` };
  }
  if (a.total === null && b.total !== null) {
    return { kind: 'estimable-again', message: `From ${n} requests/month the cost can be estimated again (${b.plan}, ${fmt(b.total)}).` };
  }
  if (a.total === 0 && (b.total ?? 0) > 0) {
    return { kind: 'free-ends', message: `Free usage covers up to ${prev} requests/month. From ${n} the cheapest recorded option is ${b.plan} at ${fmt(b.total as number)}.` };
  }
  return { kind: 'plan-change', message: `From ${n} requests/month the cheapest recorded plan changes from ${a.plan} to ${b.plan} (${fmt(b.total as number)}).` };
}

/** Smallest volume in (lo, hi] whose state differs from lo's state, assuming a single change in the gap. */
function bisect(api: ApiEntry, lo: CurvePoint, hi: CurvePoint): CurvePoint {
  const key = stateKey(lo);
  let l = lo.requests;
  let h = hi.requests;
  let hiPoint = hi;
  while (h - l > 1) {
    const mid = Math.floor((l + h) / 2);
    const m = costAt(api, mid);
    if (stateKey(m) === key) l = mid;
    else { h = mid; hiPoint = m; }
  }
  return h === hi.requests ? hi : hiPoint;
}

export function costCurve(
  api: ApiEntry,
  maxRequests = 1_000_000,
  fmt: (n: number) => string = (n) => String(n),
): CostCurve {
  const points = logSpaced(maxRequests).map((r) => costAt(api, r));
  const cliffs: Cliff[] = [];
  for (let i = 1; i < points.length; i++) {
    let from = points[i - 1]!;
    const to = points[i]!;
    // A gap may hide more than one change; walk forward until the states agree.
    let guard = 0;
    while (stateKey(from) !== stateKey(to) && guard++ < 8) {
      const at = bisect(api, from, to);
      const before = costAt(api, at.requests - 1);
      const d = describe(before, at, fmt);
      cliffs.push({ ...d, fromRequests: at.requests, fromPlan: before.plan, toPlan: at.plan, fromTotal: before.total, toTotal: at.total });
      from = at;
    }
  }
  return { points, cliffs, maxRequests, estimable: points.some((p) => p.total !== null) };
}
