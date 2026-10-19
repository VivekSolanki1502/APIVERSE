import { useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { BookOpen, Calculator, Clipboard, ExternalLink, FlaskConical, Flag, FolderOpen, GitCompareArrows, Heart, Link2, SearchX } from 'lucide-react';
import clsx from 'clsx';
import { getApi } from '../lib/catalog';
import { AUTH_LABEL, CORS_LABEL, authSummary, billingLabel, formatDate, formatMoney, freeTierSummary, pricingLabel } from '../lib/format';
import { generateExample, type ExampleLanguage } from '../lib/examples';
import { COST_DISCLAIMER, billingKind, estimateApi } from '../lib/cost';
import { reportIssueUrl } from '../lib/site';
import { useCompare, useFavorites } from '../hooks/useLocalData';
import { absoluteUrl, copyToClipboard } from '../hooks/useCopy';
import { useMeta } from '../hooks/useTitle';
import { CodeBlock } from '../components/CodeBlock';
import { CollectionPicker } from '../components/CollectionPicker';
import { PricingBadge, VerificationBadge } from '../components/Badges';
import { EmptyState } from '../components/Page';
import { TabPanel, Tabs, type TabDef } from '../components/Tabs';
import { useToast } from '../components/Toast';
import { submitReport } from '../lib/backend';

const LANGS: { id: ExampleLanguage; label: string }[] = [
  { id: 'curl', label: 'cURL' },
  { id: 'javascript', label: 'JavaScript' },
  { id: 'python', label: 'Python' },
];

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-0.5 border-b border-border py-2.5 text-sm last:border-0 sm:grid-cols-[10rem_1fr] sm:gap-3">
      <dt className="text-muted">{label}</dt>
      <dd className="min-w-0">{children}</dd>
    </div>
  );
}

const ext = (href: string, text: string) => (
  <a className="inline-flex items-center gap-1 font-medium text-accent hover:underline" href={href} target="_blank" rel="noopener noreferrer">
    {text} <ExternalLink className="h-3 w-3" aria-hidden="true" />
    <span className="sr-only"> (opens in a new tab)</span>
  </a>
);

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0 bg-surface p-3.5">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium">{children}</dd>
    </div>
  );
}

export default function ApiDetail() {
  const { id = '' } = useParams();
  const api = getApi(id);
  const [sp, setSp] = useSearchParams();
  const toast = useToast();
  const { isFavorite, toggle } = useFavorites();
  const compare = useCompare();
  const [lang, setLang] = useState<ExampleLanguage>('curl');
  const [reportOpen, setReportOpen] = useState(false);
  const [reportBusy, setReportBusy] = useState(false);
  const example = useMemo(() => (api ? generateExample(api, lang) : null), [api, lang]);

  useMeta(api?.name ?? 'API not found', api ? `${api.description} Authentication: ${authSummary(api)}. Pricing status: ${api.pricing.verificationStatus === 'verified' ? 'verified' : 'unverified'}.` : undefined);

  if (!api) {
    return (
      <div className="container-page py-10">
        <EmptyState
          icon={<SearchX />}
          title="API not found"
          action={
            <>
              <Link className="btn btn-primary" to="/explore">
                Browse all APIs
              </Link>
              <Link className="btn" to="/contribute">
                Contribute it
              </Link>
            </>
          }
        >
          There is no catalog entry called “{id}”. It may have been renamed or removed.
        </EmptyState>
      </div>
    );
  }

  const p = api.pricing;
  const fav = isFavorite(api.id);
  const inCompare = compare.has(api.id);
  const unverified = p.verificationStatus !== 'verified';
  const reportUrl = reportIssueUrl(api.id, api.name);
  const estimates = estimateApi(api, { monthlyRequests: 10000 });
  const playgroundOk = api.sampleRequest?.method === 'GET' && api.https;

  const tabs: TabDef[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'pricing', label: 'Pricing' },
    { id: 'code', label: 'Code examples' },
    { id: 'limitations', label: 'Limitations', count: api.limitations.length },
  ];
  const requested = sp.get('tab') ?? 'overview';
  const tab = tabs.some((t) => t.id === requested) ? requested : 'overview';
  const setTab = (t: string) => {
    const next = new URLSearchParams(sp);
    if (t === 'overview') next.delete('tab');
    else next.set('tab', t);
    setSp(next, { replace: true });
  };

  const copyExample = async () => {
    const text = generateExample(api, 'curl');
    if (!text) return toast.show('No example is recorded for this API.', 'info');
    const ok = await copyToClipboard(text);
    toast.show(ok ? 'cURL example copied' : 'Could not copy automatically', ok ? 'success' : 'error');
  };
  const share = async () => {
    const ok = await copyToClipboard(absoluteUrl(`/api/${api.id}`));
    toast.show(ok ? 'Link copied' : 'Could not copy automatically', ok ? 'success' : 'error');
  };

  const sendReport = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    setReportBusy(true);
    try {
      await submitReport({
        apiId: api.id,
        details: String(fields.get('details') ?? ''),
        sourceUrl: String(fields.get('sourceUrl') ?? '') || undefined,
      });
      toast.show('Report submitted for maintainer review. Thank you.');
      setReportOpen(false);
    } catch (error) {
      toast.show(error instanceof Error ? error.message : 'Could not send this report.', 'error');
    } finally {
      setReportBusy(false);
    }
  };

  return (
    <div className="container-page py-8 sm:py-10">
      <nav aria-label="Breadcrumb" className="mb-4 text-sm text-muted">
        <ol className="flex items-center gap-1.5">
          <li>
            <Link to="/explore" className="hover:text-fg">
              Explore
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li aria-current="page" className="text-fg">
            {api.name}
          </li>
        </ol>
      </nav>

      <header className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{api.name}</h1>
            <PricingBadge api={api} />
          </div>
          <p className="mt-2 max-w-2xl text-muted">{api.description}</p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            <Link to={`/explore?category=${encodeURIComponent(api.category)}`} className="badge hover:border-accent hover:text-accent">
              {api.category}
            </Link>
            {api.tags.map((t) => (
              <Link key={t} to={`/explore?q=${encodeURIComponent(t)}`} className="badge hover:border-accent hover:text-accent">
                #{t}
              </Link>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-2 lg:items-end">
          <div className="grid grid-cols-2 gap-2 sm:flex">
            {playgroundOk ? (
              <Link to={`/playground?api=${api.id}`} className="btn btn-primary">
                <FlaskConical className="h-4 w-4" aria-hidden="true" /> Try API
              </Link>
            ) : (
              <button type="button" className="btn" disabled title="No browser-safe GET example is recorded for this API.">
                <FlaskConical className="h-4 w-4" aria-hidden="true" /> Try API unavailable
              </button>
            )}
            <a className="btn" href={api.documentationUrl} target="_blank" rel="noopener noreferrer">
              <BookOpen className="h-4 w-4" aria-hidden="true" /> Documentation
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={clsx('btn btn-sm', fav && 'text-danger')} onClick={() => { toggle(api.id); toast.show(fav ? 'Removed from favorites' : 'Saved to favorites', 'info'); }} aria-pressed={fav}>
              <Heart className={clsx('h-3.5 w-3.5', fav && 'fill-current')} aria-hidden="true" /> {fav ? 'Favorited' : 'Favorite'}
            </button>
            <button type="button" className={clsx('btn btn-sm', inCompare && 'text-accent')} onClick={() => { compare.toggle(api.id); toast.show(inCompare ? 'Removed from comparison' : 'Added to comparison', 'info'); }} aria-pressed={inCompare} disabled={!inCompare && compare.full} title={!inCompare && compare.full ? 'Comparison is full (4 APIs)' : undefined}>
              <GitCompareArrows className="h-3.5 w-3.5" aria-hidden="true" /> {inCompare ? 'In comparison' : 'Compare'}
            </button>
            <CollectionPicker apiId={api.id} />
            <button type="button" className="btn btn-sm" onClick={() => void copyExample()}>
              <Clipboard className="h-3.5 w-3.5" aria-hidden="true" /> Copy example
            </button>
            <button type="button" className="btn btn-sm" onClick={() => void share()}>
              <Link2 className="h-3.5 w-3.5" aria-hidden="true" /> Share
            </button>
          </div>
        </div>
      </header>

      {/* The facts a developer needs first, before any scrolling. */}
      <dl className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-panel border border-border bg-border lg:grid-cols-4">
        <Fact label="Authentication">{authSummary(api)}</Fact>
        <Fact label="Free tier">{freeTierSummary(api)}</Fact>
        <Fact label="Pricing model">{pricingLabel(api).text}</Fact>
        <Fact label="Pricing verification">
          <VerificationBadge status={p.verificationStatus} compact />
          <span className="mt-1 block text-xs font-normal text-muted">{p.lastVerified ? `Checked ${formatDate(p.lastVerified)}` : 'Never checked'}</span>
        </Fact>
      </dl>
      <p className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm">
        {ext(api.documentationUrl, 'Official documentation')}
        {p.pricingUrl ? ext(p.pricingUrl, 'Official pricing') : <span className="text-muted">No pricing URL recorded</span>}
      </p>

      {unverified && (
        <div role="note" className="mt-5 rounded-panel border border-warn/40 bg-warn/10 p-3 text-sm">
          <strong>Unverified information.</strong> {p.verificationNotes ?? 'Pricing and limits for this entry have not been checked against official sources.'} Treat everything below as a starting point and confirm on the provider’s own pages.
        </div>
      )}

      <div className="mt-8">
        <Tabs tabs={tabs} value={tab} onChange={setTab} label="API details" idPrefix="detail" />

        <TabPanel idPrefix="detail" id="overview" active={tab === 'overview'} className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-2">
          <section className="card min-w-0 p-4" aria-labelledby="about">
            <h2 id="about" className="mb-1 font-semibold">
              About this API
            </h2>
            <dl>
              <Row label="Documentation">{ext(api.documentationUrl, 'Official documentation')}</Row>
              <Row label="Provider website">{ext(api.officialWebsiteUrl, api.officialWebsiteUrl.replace(/^https?:\/\//, ''))}</Row>
              <Row label="Base URL">
                <code className="break-all font-mono text-xs">{api.baseUrl}</code>
              </Row>
              <Row label="HTTPS">{api.https ? 'Yes' : 'No (plain http)'}</Row>
              <Row label="CORS">
                {CORS_LABEL[api.corsStatus]}
                {api.corsStatus === 'unknown' && <span className="text-muted"> — not tested; browser calls may be blocked.</span>}
              </Row>
              {api.statusPageUrl && <Row label="Status page">{ext(api.statusPageUrl, 'Provider status')}</Row>}
            </dl>
          </section>
          <section className="card min-w-0 p-4" aria-labelledby="auth">
            <h2 id="auth" className="mb-1 font-semibold">
              Authentication
            </h2>
            <dl>
              <Row label="Required">{api.authentication.required ? 'Yes' : 'No'}</Row>
              <Row label="Type">{AUTH_LABEL[api.authentication.type]}</Row>
              <Row label="Sent in">
                {api.authentication.location && api.authentication.parameterName ? (
                  <>
                    {api.authentication.location}, as <code className="font-mono text-xs">{api.authentication.parameterName}</code>
                  </>
                ) : (
                  <span className="text-muted">Not recorded</span>
                )}
              </Row>
            </dl>
            {api.authentication.required && <p className="mt-2 text-xs text-muted">Keep credentials out of source control and out of shared links. The playground never saves what you type.</p>}
          </section>
        </TabPanel>

        <TabPanel idPrefix="detail" id="pricing" active={tab === 'pricing'} className="mt-5 space-y-5">
          <section className="card p-4" aria-labelledby="pricing">
            <h2 id="pricing" className="mb-1 flex flex-wrap items-center justify-between gap-2 font-semibold">
              Pricing <VerificationBadge status={p.verificationStatus} />
            </h2>
            <dl>
              <Row label="Model">{pricingLabel(api).text}</Row>
              <Row label="Free tier">{freeTierSummary(api)}</Row>
              <Row label="Billing unit">{billingLabel(billingKind(api))}</Row>
              <Row label="Rate limits">{p.rateLimits ?? <span className="text-muted">Not recorded</span>}</Row>
              {p.overagePolicy && <Row label="Overage">{p.overagePolicy}</Row>}
              {p.trial?.available && (
                <Row label="Trial">
                  {p.trial.durationDays ? `${p.trial.durationDays} days` : 'Duration not recorded'}
                  {p.trial.creditsExpire ? ' — credits expire' : ''}
                </Row>
              )}
              <Row label="Last verified">{formatDate(p.lastVerified)}</Row>
              <Row label="Sources">
                <span className="flex flex-wrap gap-x-4 gap-y-1">
                  {p.pricingUrl ? ext(p.pricingUrl, 'Official pricing') : <span className="text-muted">No pricing URL recorded</span>}
                  {p.termsUrl && ext(p.termsUrl, 'Terms')}
                </span>
              </Row>
            </dl>
            {p.verificationNotes && <p className="mt-2 text-xs text-muted">What was checked: {p.verificationNotes}</p>}
          </section>

          {p.plans.length > 0 && (
            <section className="card p-4" aria-labelledby="plans">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 id="plans" className="font-semibold">
                  Recorded plans
                </h2>
                <Link className="btn btn-sm" to={`/budget-finder?calc=${api.id}#calculator`}>
                  <Calculator className="h-3.5 w-3.5" aria-hidden="true" /> Estimate with your usage
                </Link>
              </div>
              <div className="mt-2 overflow-x-auto">
                <table className="w-full min-w-[26rem] text-left text-sm">
                  <caption className="sr-only">Recorded plans and estimated cost at 10,000 requests per month</caption>
                  <thead className="text-xs text-muted">
                    <tr>
                      <th scope="col" className="py-1 pr-3 font-medium">Plan</th>
                      <th scope="col" className="py-1 pr-3 font-medium">Monthly fee</th>
                      <th scope="col" className="py-1 font-medium">Est. at 10,000 requests/mo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {estimates.map((e) => (
                      <tr key={e.plan.name} className="border-t border-border align-top">
                        <th scope="row" className="py-2 pr-3 font-medium">{e.plan.name}</th>
                        <td className="py-2 pr-3">{e.plan.monthlyBase === null ? 'Unknown' : formatMoney(e.plan.monthlyBase, p.currency)}</td>
                        <td className="py-2">{e.result.ok ? formatMoney(e.result.total, p.currency) : <span className="text-muted">Cannot estimate reliably</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-2 text-xs text-muted">{COST_DISCLAIMER}</p>
            </section>
          )}

          {p.history.length > 0 && (
            <section className="card p-4" aria-labelledby="hist">
              <h2 id="hist" className="mb-2 font-semibold">
                Pricing history
              </h2>
              <ul className="space-y-1 text-sm">
                {p.history.map((h) => (
                  <li key={`${h.date}-${h.summary}`} className="flex gap-3">
                    <time className="w-28 shrink-0 text-muted" dateTime={h.date}>{formatDate(h.date)}</time>
                    <span>{h.summary}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </TabPanel>

        <TabPanel idPrefix="detail" id="code" active={tab === 'code'} className="mt-5">
          {example ? (
            <>
              <div className="mb-3">
                <Tabs tabs={LANGS} value={lang} onChange={(l) => setLang(l as ExampleLanguage)} label="Language" idPrefix="lang" variant="pill" />
              </div>
              <CodeBlock code={example} label={LANGS.find((l) => l.id === lang)?.label} />
              <p className="mt-2 text-xs text-muted">
                Generated from the documented endpoint. This does not guarantee the request will succeed.
                {api.authentication.required && ' Replace the YOUR_… placeholders with your own credential and never commit it to source control.'}
              </p>
            </>
          ) : (
            <EmptyState title="No example recorded for this API">See the {ext(api.documentationUrl, 'official documentation')}.</EmptyState>
          )}
        </TabPanel>

        <TabPanel idPrefix="detail" id="limitations" active={tab === 'limitations'} className="mt-5">
          {api.limitations.length > 0 ? (
            <section className="card p-4" aria-labelledby="limits">
              <h2 id="limits" className="mb-2 font-semibold">
                Limitations and restrictions
              </h2>
              <ul className="list-disc space-y-1.5 pl-5 text-sm text-muted">
                {api.limitations.map((l) => (
                  <li key={l}>{l}</li>
                ))}
              </ul>
            </section>
          ) : (
            <EmptyState icon={<FolderOpen />} title="No limitations recorded">
              That means none have been documented here yet, not that none exist. Check the provider’s terms and rate-limit documentation.
            </EmptyState>
          )}
        </TabPanel>
      </div>

      <section className="mt-10 border-t border-border pt-5 text-sm" aria-labelledby="report-title">
        <h2 id="report-title" className="font-semibold">Keep this entry accurate</h2>
        <p className="mt-1 text-muted">Send a correction to APIverse maintainers for review. Do not include credentials or private information.</p>
        <div className="mt-3 flex flex-wrap gap-3">
          <button type="button" className="btn btn-sm" aria-expanded={reportOpen} onClick={() => setReportOpen((open) => !open)}>
            <Flag className="h-3.5 w-3.5" aria-hidden="true" /> {reportOpen ? 'Close report form' : 'Report outdated or incorrect information'}
          </button>
          {reportUrl && <a className="btn btn-sm" href={reportUrl} target="_blank" rel="noopener noreferrer">Open GitHub issue form</a>}
          {!reportUrl && <Link className="btn btn-sm" to="/contribute#report">Contribution guide</Link>}
        </div>
        {reportOpen && (
          <form className="card mt-4 grid max-w-2xl gap-3 p-4" onSubmit={(event) => void sendReport(event)}>
            <div>
              <label className="label" htmlFor="report-details">What is wrong or outdated?</label>
              <textarea className="input min-h-24" id="report-details" name="details" required minLength={10} maxLength={2000} />
            </div>
            <div>
              <label className="label" htmlFor="report-source">Official source URL (optional)</label>
              <input className="input" id="report-source" name="sourceUrl" type="url" maxLength={2048} placeholder="https://provider.example.com/pricing" />
            </div>
            <div>
              <button className="btn btn-primary" type="submit" disabled={reportBusy}>{reportBusy ? 'Sending…' : 'Submit for review'}</button>
            </div>
          </form>
        )}
      </section>
    </div>
  );
}
