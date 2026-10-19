import { CircleSlash } from 'lucide-react';
import type { PlanEstimate } from '../lib/cost';
import { COST_DISCLAIMER } from '../lib/cost';
import { formatMoney } from '../lib/format';

/**
 * One plan's estimate as a line-by-line breakdown. When the pricing model is incomplete the card
 * says why a reliable estimate is impossible instead of showing a number.
 */
export function CostBreakdown({ estimate: e }: { estimate: PlanEstimate }) {
  const r = e.result;
  return (
    <section className="rounded-panel border border-border bg-bg p-4" aria-label={`${e.plan.name} estimate`}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h4 className="font-medium">{e.plan.name}</h4>
        <span className="text-xs text-muted">{e.currency ? `Currency: ${e.currency} (as recorded, no conversion)` : 'Currency not recorded'}</span>
      </div>
      {r.ok ? (
        <>
          <p className="mt-2 text-2xl font-semibold tracking-tight">
            {formatMoney(r.total, e.currency)}
            <span className="ml-1 text-sm font-normal text-muted">/ month, estimated</span>
          </p>
          <dl className="mt-3 grid grid-cols-[1fr_auto] gap-x-4 gap-y-1.5 text-sm">
            {r.breakdown.map((b) => (
              <div key={b.label} className="contents">
                <dt className="text-muted">{b.label}</dt>
                <dd className="text-right tabular-nums">{b.money && b.amount !== undefined ? formatMoney(b.amount, e.currency) : b.value}</dd>
              </div>
            ))}
          </dl>
          {r.assumptions.length > 0 && (
            <div className="mt-3">
              <p className="text-xs font-medium text-muted">Assumptions</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-5 text-xs text-muted">
                {r.assumptions.map((a) => (
                  <li key={a}>{a}</li>
                ))}
              </ul>
            </div>
          )}
          <p className="mt-3 text-xs text-muted">
            <span className="font-medium">Not included:</span> {COST_DISCLAIMER}
          </p>
        </>
      ) : (
        <div className="mt-2 flex gap-2 text-sm">
          <CircleSlash className="mt-0.5 h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
          <div>
            <p className="font-medium">Cannot estimate reliably</p>
            <p className="mt-0.5 text-muted">{r.reason}</p>
            {r.missing.length > 0 && (
              <p className="mt-1 text-xs text-muted">
                Missing data: <code className="font-mono">{r.missing.join(', ')}</code>
              </p>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
