import { useEffect, useState, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { GitCompareArrows, Link2, X } from 'lucide-react';
import clsx from 'clsx';
import { apis, getApi } from '../lib/catalog';
import { MAX_COMPARE, useCompare } from '../hooks/useLocalData';
import { absoluteUrl, copyToClipboard } from '../hooks/useCopy';
import { billingKind, cheapestEstimate, COST_DISCLAIMER } from '../lib/cost';
import { authSummary, billingLabel, formatDate, formatMoney, freeTierSummary } from '../lib/format';
import { EmptyState, Page } from '../components/Page';
import { PricingBadge, VerificationBadge } from '../components/Badges';
import { useToast } from '../components/Toast';
import type { ApiEntry } from '../types/catalog';

interface Row {
  label: string;
  cell: (a: ApiEntry) => ReactNode;
  /** Plain-text value used only to decide whether the row differs between the selected APIs. */
  key?: (a: ApiEntry) => string;
}

function AddPicker({ selected, onAdd }: { selected: string[]; onAdd: (id: string) => void }) {
  return (
    <div>
      <label className="label" htmlFor="add-compare">
        Add an API
      </label>
      <select id="add-compare" className="input w-56" value="" onChange={(e) => e.target.value && onAdd(e.target.value)}>
        <option value="">Choose…</option>
        {apis.filter((a) => !selected.includes(a.id)).map((a) => (
          <option key={a.id} value={a.id}>
            {a.name}
          </option>
        ))}
      </select>
    </div>
  );
}

export default function Compare() {
  const compare = useCompare();
  const toast = useToast();
  const [sp, setSp] = useSearchParams();
  const [volume, setVolume] = useState('10000');
  const [onlyDiff, setOnlyDiff] = useState(false);

  // A shared ?ids= link is adopted into the local selection, so that removing items works normally.
  const urlIds = (sp.get('ids') ?? '').split(',').filter((id) => getApi(id)).slice(0, MAX_COMPARE);
  const urlKey = urlIds.join(',');
  useEffect(() => {
    if (urlKey) {
      compare.set(urlKey.split(','));
      setSp(new URLSearchParams(), { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlKey]);

  const ids = urlKey ? urlIds : compare.ids;
  const list = ids.map((id) => getApi(id)).filter((a): a is ApiEntry => Boolean(a));
  const monthly = Number(volume);
  const volumeOk = volume.trim() !== '' && Number.isFinite(monthly) && monthly >= 0;
  const usage = volumeOk ? { monthlyRequests: monthly } : {};
  const kinds = new Set(list.map(billingKind));
  const incompatible = kinds.size > 1 || kinds.has('unknown') || [...kinds].some((k) => k.includes('tokens'));

  const estimateOf = (a: ApiEntry) => (volumeOk ? cheapestEstimate(a, usage) : null);
  const currencies = new Set(list.map((a) => estimateOf(a)).flatMap((e) => (e && e.result.ok && e.currency ? [e.currency] : [])));

  const rows: Row[] = [
    { label: 'Category', cell: (a) => a.category, key: (a) => a.category },
    { label: 'Pricing model', cell: (a) => <PricingBadge api={a} />, key: (a) => a.pricing.model },
    { label: 'Billing unit', cell: (a) => billingLabel(billingKind(a)), key: (a) => billingKind(a) },
    { label: 'Free quota', cell: (a) => freeTierSummary(a), key: (a) => freeTierSummary(a) },
    {
      label: `Est. cost at ${volumeOk ? monthly.toLocaleString('en-US') : '?'} requests/mo`,
      cell: (a) => {
        const e = estimateOf(a);
        return e && e.result.ok ? `${formatMoney(e.result.total, e.currency)} (${e.plan.name})` : <span className="text-muted">Cannot estimate reliably</span>;
      },
      key: (a) => {
        const e = estimateOf(a);
        return e && e.result.ok ? `${e.result.total}${e.currency ?? ''}` : 'n/a';
      },
    },
    { label: 'Authentication', cell: (a) => authSummary(a), key: (a) => authSummary(a) },
    { label: 'Rate limits', cell: (a) => a.pricing.rateLimits ?? <span className="text-muted">Not recorded</span>, key: (a) => a.pricing.rateLimits ?? '' },
    { label: 'Documentation', cell: (a) => <a className="text-accent underline" href={a.documentationUrl} target="_blank" rel="noopener noreferrer">Official docs<span className="sr-only"> for {a.name} (opens in a new tab)</span></a> },
    {
      label: 'Restrictions',
      cell: (a) => (a.limitations.length ? <ul className="list-disc space-y-1 pl-4">{a.limitations.map((l) => <li key={l}>{l}</li>)}</ul> : <span className="text-muted">None recorded</span>),
      key: (a) => a.limitations.join('|'),
    },
    { label: 'Pricing verification', cell: (a) => <VerificationBadge status={a.pricing.verificationStatus} compact />, key: (a) => a.pricing.verificationStatus },
    { label: 'Last verified', cell: (a) => formatDate(a.pricing.lastVerified), key: (a) => a.pricing.lastVerified ?? '' },
  ];
  const differs = (r: Row) => (r.key ? new Set(list.map(r.key)).size > 1 : false);
  const shown = onlyDiff ? rows.filter(differs) : rows;

  const share = async () => {
    const ok = await copyToClipboard(absoluteUrl(`/compare?ids=${list.map((a) => a.id).join(',')}`));
    toast.show(ok ? 'Comparison link copied' : 'Could not copy automatically', ok ? 'success' : 'error');
  };
  const DiffTag = ({ r }: { r: Row }) =>
    differs(r) ? (
      <span className="ml-2 rounded-full border border-accent/40 bg-accent/10 px-1.5 py-px text-[0.65rem] font-medium text-accent">
        Differs
        <span className="sr-only"> between these APIs</span>
      </span>
    ) : null;

  return (
    <Page
      title="Compare APIs"
      description="Compare up to four APIs side by side: authentication, free quota, billing model, estimated cost, rate limits and how recently pricing was verified."
      intro={`Compare up to ${MAX_COMPARE} APIs side by side. Differences are marked, and “cheapest” is only implied when the pricing models can fairly be compared.`}
    >
      {list.length < 2 ? (
        <EmptyState
          icon={<GitCompareArrows />}
          title={list.length === 0 ? 'Nothing to compare yet' : 'Add at least one more API'}
          action={
            <Link className="btn btn-primary" to="/explore">
              Browse APIs
            </Link>
          }
        >
          Use the compare icon on any API card, or pick one below.
          <div className="mt-4 flex justify-center text-left">
            <AddPicker selected={compare.ids} onAdd={compare.toggle} />
          </div>
          {list.length === 1 && <p className="mt-3">Currently selected: {list[0]?.name}</p>}
        </EmptyState>
      ) : (
        <>
          {incompatible && (
            <div role="note" className="mb-4 rounded-panel border border-warn/40 bg-warn/10 p-3 text-sm">
              <strong>These pricing models are not directly comparable.</strong> The selected APIs bill in different units (or by tokens, or have no recorded plan), so a single “cheapest” cannot be named. Compare the quota and billing rows individually rather than the cost row.
            </div>
          )}
          <div className="mb-4 flex flex-wrap items-end gap-3">
            <div>
              <label className="label" htmlFor="cmp-vol">
                Monthly requests for the estimate
              </label>
              <input id="cmp-vol" className="input w-44" inputMode="numeric" value={volume} aria-invalid={!volumeOk} onChange={(e) => setVolume(e.target.value)} />
            </div>
            {list.length < MAX_COMPARE && <AddPicker selected={compare.ids} onAdd={compare.toggle} />}
            <label className="flex min-h-10 cursor-pointer items-center gap-2 text-sm">
              <input className="check" type="checkbox" checked={onlyDiff} onChange={(e) => setOnlyDiff(e.target.checked)} /> Show only differences
            </label>
            <div className="ml-auto flex gap-2">
              <button type="button" className="btn" onClick={() => void share()}>
                <Link2 className="h-4 w-4" aria-hidden="true" /> Copy link
              </button>
              <button type="button" className="btn" onClick={compare.clear}>
                Clear
              </button>
            </div>
          </div>
          {!volumeOk && (
            <p role="alert" className="mb-3 text-sm text-danger">
              Enter a non-negative number of requests to see cost estimates.
            </p>
          )}

          {/* Desktop: table */}
          <div className="card hidden overflow-x-auto md:block">
            <table className="w-full min-w-[40rem] text-left text-sm">
              <caption className="sr-only">API comparison</caption>
              <thead>
                <tr className="border-b border-border">
                  <th scope="col" className="w-44 p-3 text-xs font-medium text-muted">
                    Attribute
                  </th>
                  {list.map((a) => (
                    <th key={a.id} scope="col" className="p-3 align-top">
                      <div className="flex items-start justify-between gap-2">
                        <Link to={`/api/${a.id}`} className="font-semibold hover:text-accent">
                          {a.name}
                        </Link>
                        <button type="button" className="btn btn-ghost btn-icon btn-sm" onClick={() => compare.toggle(a.id)} aria-label={`Remove ${a.name} from comparison`}>
                          <X className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {shown.map((r) => (
                  <tr key={r.label} className={clsx('border-t border-border align-top', differs(r) && 'bg-accent/[0.04]')}>
                    <th scope="row" className="p-3 text-xs font-medium text-muted">
                      {r.label}
                      <DiffTag r={r} />
                    </th>
                    {list.map((a) => (
                      <td key={a.id} className="p-3">
                        {r.cell(a)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile: one stacked section per API */}
          <div className="space-y-4 md:hidden">
            {list.map((a) => (
              <section key={a.id} className="card p-4" aria-label={a.name}>
                <div className="flex items-start justify-between gap-2">
                  <h2 className="font-semibold">
                    <Link to={`/api/${a.id}`} className="hover:text-accent">
                      {a.name}
                    </Link>
                  </h2>
                  <button type="button" className="btn btn-ghost btn-icon btn-sm" onClick={() => compare.toggle(a.id)} aria-label={`Remove ${a.name} from comparison`}>
                    <X className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
                <dl className="mt-2 divide-y divide-border text-sm">
                  {shown.map((r) => (
                    <div key={r.label} className="py-2">
                      <dt className="text-xs text-muted">
                        {r.label}
                        <DiffTag r={r} />
                      </dt>
                      <dd className="mt-0.5">{r.cell(a)}</dd>
                    </div>
                  ))}
                </dl>
              </section>
            ))}
          </div>

          <section className="mt-5 rounded-panel border border-border p-4 text-sm" aria-labelledby="assump">
            <h2 id="assump" className="font-semibold">
              Assumptions behind the estimates
            </h2>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-muted">
              <li>{volumeOk ? `Each estimate assumes ${monthly.toLocaleString('en-US')} requests per month` : 'Enter a request volume to see estimates'}, using the cheapest recorded plan that can be calculated.</li>
              <li>Estimates only use prices recorded in the catalog; unknown prices are never treated as zero.</li>
              {currencies.size > 1 && <li>The costs above are in different currencies ({[...currencies].join(', ')}) and are not converted, so they cannot be ranked against each other.</li>}
              <li>{COST_DISCLAIMER}</li>
              <li>“Functional fit” depends on your use case. Use the Budget Finder to score fit against your requirements.</li>
            </ul>
          </section>
        </>
      )}
    </Page>
  );
}
