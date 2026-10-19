import { useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, BadgeCheck, ExternalLink, FlaskConical, GitCompareArrows, Github, Heart, Search } from 'lucide-react';
import clsx from 'clsx';
import { apis, getApi, recentlyAdded, recentlyVerified } from '../lib/catalog';
import { CATEGORIES } from '../types/catalog';
import { DEFAULT_PARAMS, searchApis } from '../lib/search';
import { buildRequest, toCurl } from '../lib/examples';
import { estimateApi } from '../lib/cost';
import { STARTER_COLLECTIONS } from '../lib/curated';
import { authSummary, formatDate, freeTierSummary } from '../lib/format';
import { REPO_URL } from '../lib/site';
import { useMeta } from '../hooks/useTitle';
import { ApiCard } from '../components/ApiCard';
import { PricingBadge } from '../components/Badges';
import { CodeBlock } from '../components/CodeBlock';
import { CostBreakdown } from '../components/CostBreakdown';
import { SectionHeader } from '../components/Page';

/** Example searches are kept only if they really return results, so no suggestion is a dead end. */
const EXAMPLE_QUERIES = ['weather', 'books', 'geocoding', 'currency', 'pokemon'].filter((q) => searchApis(apis, { ...DEFAULT_PARAMS, q }).length > 0);
const PREVIEW_QUERIES = EXAMPLE_QUERIES.slice(0, 3);

/** A small, live slice of the Explore experience, driven by the real catalog and real search. */
function ExplorerPreview() {
  const [q, setQ] = useState(PREVIEW_QUERIES[0] ?? '');
  const hits = useMemo(() => searchApis(apis, { ...DEFAULT_PARAMS, q }), [q]);
  return (
    <div className="card overflow-hidden shadow-float" aria-label="Live preview of API search">
      <div className="flex items-center gap-2 border-b border-border bg-elevated/50 px-3 py-2">
        <span className="flex gap-1.5" aria-hidden="true">
          <span className="h-2.5 w-2.5 rounded-full bg-border-strong" />
          <span className="h-2.5 w-2.5 rounded-full bg-border-strong" />
          <span className="h-2.5 w-2.5 rounded-full bg-border-strong" />
        </span>
        <span className="ml-1 text-xs text-muted">Live from the catalog</span>
      </div>
      <div className="p-3">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Preview searches">
          {PREVIEW_QUERIES.map((x) => (
            <button key={x} type="button" className="chip" aria-pressed={q === x} onClick={() => setQ(x)}>
              {x}
            </button>
          ))}
        </div>
        <p className="mt-3 text-xs text-muted" role="status">
          {hits.length} {hits.length === 1 ? 'result' : 'results'} for “{q}”
        </p>
        <ul className="mt-2 space-y-2">
          {hits.slice(0, 3).map((a) => (
            <li key={a.id} className="relative rounded-control border border-border bg-bg p-3 transition-colors hover:border-accent/50">
              <Link to={`/api/${a.id}`} className="text-sm font-medium after:absolute after:inset-0 hover:text-accent">
                {a.name}
              </Link>
              <p className="mt-0.5 line-clamp-1 text-xs text-muted">{a.description}</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <PricingBadge api={a} />
                <span className="badge">{authSummary(a)}</span>
              </div>
            </li>
          ))}
        </ul>
        <Link to={`/explore?q=${encodeURIComponent(q)}`} className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-accent hover:underline">
          Open these results in Explore <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
      </div>
    </div>
  );
}

function Hero() {
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const submit = (e: FormEvent) => {
    e.preventDefault();
    navigate(`/explore${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ''}`);
  };
  return (
    <section className="relative isolate overflow-hidden border-b border-border" aria-labelledby="hero-title">
      <div className="bg-dots absolute inset-0 -z-10" aria-hidden="true" />
      <div className="container-page grid grid-cols-1 items-center gap-10 py-10 sm:py-14 lg:grid-cols-[1.15fr_1fr] lg:py-16">
        <div>
          <p className="text-sm font-medium text-accent">Discover. Compare. Test. Budget. Build.</p>
          <h1 id="hero-title" className="mt-3 max-w-2xl text-3xl font-semibold leading-[1.1] tracking-tight sm:text-5xl">
            Find the right API. Know the real cost. Start building.
          </h1>
          <p className="mt-4 max-w-xl text-base text-muted sm:text-lg">Discover public APIs, compare free tiers, estimate usage costs, and test endpoints in one developer-friendly workspace.</p>

          <form onSubmit={submit} role="search" className="mt-6 flex max-w-xl flex-col gap-2 sm:flex-row">
            <label htmlFor="home-search" className="sr-only">
              Search APIs
            </label>
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-muted" aria-hidden="true" />
              <input id="home-search" className="input min-h-12 pl-11 text-base" placeholder={`Search APIs, e.g. “${EXAMPLE_QUERIES[0] ?? 'weather'}”`} value={q} onChange={(e) => setQ(e.target.value)} autoComplete="off" enterKeyHint="search" />
            </div>
            <button type="submit" className="btn btn-primary min-h-12 px-5">
              Search
            </button>
          </form>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted">
            <span>Try:</span>
            {EXAMPLE_QUERIES.map((x) => (
              <Link key={x} to={`/explore?q=${encodeURIComponent(x)}`} className="chip">
                {x}
              </Link>
            ))}
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            <Link to="/explore" className="btn btn-primary">
              Explore APIs
            </Link>
            <Link to="/budget-finder?mode=free-only" className="btn">
              Find Free APIs
            </Link>
          </div>
        </div>
        <ExplorerPreview />
      </div>
    </section>
  );
}

function Categories() {
  const counts = new Map<string, number>();
  apis.forEach((a) => counts.set(a.category, (counts.get(a.category) ?? 0) + 1));
  return (
    <section className="container-page pt-8" aria-labelledby="cats">
      <h2 id="cats" className="sr-only">
        Browse by category
      </h2>
      <ul className="flex flex-wrap gap-2">
        {CATEGORIES.filter((c) => counts.has(c)).map((c) => (
          <li key={c}>
            <Link to={`/explore?category=${encodeURIComponent(c)}`} className="chip min-h-9 text-sm">
              {c}
              <span className="text-xs opacity-70">{counts.get(c)}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Featured() {
  const featured = apis.filter((a) => a.featured).slice(0, 4);
  const verified = recentlyVerified(4);
  const added = recentlyAdded(3);
  return (
    <section className="container-page section-y" aria-labelledby="featured">
      <SectionHeader
        id="featured"
        title="Featured and recently verified"
        action={
          <Link to="/explore" className="inline-flex items-center gap-1 text-sm font-medium text-accent hover:underline">
            Browse all {apis.length} <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        }
      />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="grid gap-4 sm:grid-cols-2">
          {featured.map((a) => (
            <ApiCard key={a.id} api={a} />
          ))}
        </div>
        <div className="space-y-5">
          <div className="card p-4">
            <h3 className="flex items-center gap-1.5 text-sm font-semibold">
              <BadgeCheck className="h-4 w-4 text-ok" aria-hidden="true" /> Recently verified
            </h3>
            <ul className="mt-2 divide-y divide-border text-sm">
              {verified.length === 0 && <li className="py-2 text-muted">Nothing verified yet.</li>}
              {verified.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-2 py-2">
                  <Link to={`/api/${a.id}`} className="font-medium hover:text-accent">
                    {a.name}
                  </Link>
                  <time className="text-xs text-muted" dateTime={a.pricing.lastVerified ?? undefined}>
                    {formatDate(a.pricing.lastVerified)}
                  </time>
                </li>
              ))}
            </ul>
          </div>
          <div className="card p-4">
            <h3 className="text-sm font-semibold">Recently added</h3>
            <ul className="mt-2 divide-y divide-border text-sm">
              {added.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-2 py-2">
                  <Link to={`/api/${a.id}`} className="font-medium hover:text-accent">
                    {a.name}
                  </Link>
                  <time className="text-xs text-muted" dateTime={a.addedOn}>
                    {formatDate(a.addedOn)}
                  </time>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-muted">Added entries stay “unverified” until their pricing is checked against official pages.</p>
          </div>
        </div>
      </div>
    </section>
  );
}

function FreeApis() {
  const verifiedFree = apis.filter((a) => a.pricing.verificationStatus === 'verified' && (a.pricing.model === 'free' || a.pricing.freeTier.available === true));
  const verifiedCount = apis.filter((a) => a.pricing.verificationStatus === 'verified').length;
  return (
    <section className="border-y border-border bg-surface/40" aria-labelledby="free">
      <div className="container-page section-y">
        <SectionHeader
          id="free"
          title="Free and budget-friendly, with proof"
          description={`${verifiedCount} of ${apis.length} catalog entries have pricing checked against official pages. Only those are listed here; everything else is labelled “unverified” wherever it appears.`}
          action={
            <Link to="/budget-finder?mode=free-only" className="btn btn-primary">
              Open Budget Finder
            </Link>
          }
        />
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {verifiedFree.map((a) => (
            <li key={a.id} className="card flex flex-col p-4">
              <div className="flex items-start justify-between gap-2">
                <Link to={`/api/${a.id}`} className="font-semibold hover:text-accent">
                  {a.name}
                </Link>
                <PricingBadge api={a} />
              </div>
              <dl className="mt-3 space-y-1 text-sm">
                <div className="flex justify-between gap-3">
                  <dt className="text-muted">Free quota</dt>
                  <dd className="text-right">{freeTierSummary(a)}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-muted">Auth</dt>
                  <dd className="text-right">{authSummary(a)}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-muted">Verified</dt>
                  <dd className="text-right">{formatDate(a.pricing.lastVerified)}</dd>
                </div>
              </dl>
              {a.pricing.pricingUrl && (
                <a href={a.pricing.pricingUrl} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline">
                  Official pricing <ExternalLink className="h-3 w-3" aria-hidden="true" />
                </a>
              )}
            </li>
          ))}
        </ul>
        <p className="mt-4 text-sm text-muted">
          Looking for more?{' '}
          <Link className="text-accent underline" to="/explore?free=1">
            Browse every entry that lists a free tier
          </Link>{' '}
          — just check each one’s verification badge first.
        </p>
      </div>
    </section>
  );
}

function PlaygroundPreview() {
  const api = getApi('open-meteo') ?? apis.find((a) => a.sampleRequest?.method === 'GET' && a.https && !a.authentication.required);
  const req = api ? buildRequest(api) : null;
  if (!api || !req) return null;
  return (
    <section className="container-page section-y" aria-labelledby="pg">
      <div className="grid grid-cols-1 items-center gap-8 lg:grid-cols-2">
        <div className="min-w-0">
          <p className="text-sm font-medium text-accent">Playground</p>
          <h2 id="pg" className="mt-1 text-2xl font-semibold tracking-tight">
            Test an endpoint before you integrate it
          </h2>
          <ul className="mt-4 space-y-2 text-sm text-muted">
            <li>Send a public GET request straight from your browser. There is no proxy.</li>
            <li>See the real status, timing and a collapsible JSON tree. Nothing is mocked.</li>
            <li>If the provider blocks browser calls (CORS), you’re told plainly.</li>
            <li>Copy a matching cURL, JavaScript or Python snippet.</li>
          </ul>
          <Link to={`/playground?api=${api.id}`} className="btn btn-primary mt-5">
            <FlaskConical className="h-4 w-4" aria-hidden="true" /> Open {api.name} in the playground
          </Link>
        </div>
        <div className="min-w-0 space-y-3">
          <div className="card flex items-center gap-2 p-2 text-sm">
            <span className="rounded-control bg-ok/10 px-2 py-1 font-mono text-xs font-semibold text-ok">GET</span>
            <span className="min-w-0 flex-1 truncate font-mono text-xs text-muted" title={req.url}>
              {req.url}
            </span>
          </div>
          <CodeBlock code={toCurl(req)} label="cURL" maxHeightClass="max-h-40" />
          <p className="text-xs text-muted">Preview of the request this example sends. The response appears only after you run it.</p>
        </div>
      </div>
    </section>
  );
}

function CostPreview() {
  const withPlans = apis.filter((a) => a.pricing.plans.length > 0);
  const [id, setId] = useState(withPlans.find((a) => a.id === 'coingecko')?.id ?? withPlans[0]?.id ?? '');
  const [req, setReq] = useState('50000');
  const api = withPlans.find((a) => a.id === id);
  const n = Number(req);
  const usage = Number.isFinite(n) && n >= 0 && req.trim() !== '' ? { monthlyRequests: n } : null;
  const estimates = api && usage ? estimateApi(api, usage) : [];
  return (
    <section className="border-y border-border bg-surface/40" aria-labelledby="cost">
      <div className="container-page section-y grid grid-cols-1 gap-8 lg:grid-cols-[1fr_1.2fr]">
        <div>
          <p className="text-sm font-medium text-accent">Compare and budget</p>
          <h2 id="cost" className="mt-1 text-2xl font-semibold tracking-tight">
            Estimate costs from the provider’s own pricing model
          </h2>
          <p className="mt-3 text-sm text-muted">Every estimate shows its quota, billable usage and assumptions. If a price is unknown, you’ll see “cannot estimate reliably” instead of a guess, and APIs with incompatible pricing are never ranked as “cheapest”.</p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Link to="/budget-finder" className="btn btn-primary">
              Open Budget Finder
            </Link>
            <Link to="/compare" className="btn">
              <GitCompareArrows className="h-4 w-4" aria-hidden="true" /> Compare APIs
            </Link>
          </div>
        </div>
        <div className="card min-w-0 p-4">
          <p className="text-sm font-medium">Try the calculator</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="home-calc-api">
                API (with recorded plans)
              </label>
              <select id="home-calc-api" className="input" value={id} onChange={(e) => setId(e.target.value)}>
                {withPlans.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="home-calc-req">
                Requests per month
              </label>
              <input id="home-calc-req" className="input" inputMode="numeric" value={req} onChange={(e) => setReq(e.target.value)} aria-invalid={usage === null} />
            </div>
          </div>
          {usage === null && (
            <p role="alert" className="mt-2 text-sm text-danger">
              Enter a non-negative number of requests.
            </p>
          )}
          <div className="mt-3 grid gap-3 sm:grid-cols-2" aria-live="polite">
            {estimates.map((e) => (
              <CostBreakdown key={e.plan.name} estimate={e} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function Collections() {
  return (
    <section className="container-page section-y" aria-labelledby="cols">
      <SectionHeader
        id="cols"
        title="Starter collections"
        description="Curated by the APIverse maintainers from real catalog entries. Save a copy to make it yours."
        action={
          <Link to="/collections" className="inline-flex items-center gap-1 text-sm font-medium text-accent hover:underline">
            All collections <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        }
      />
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {STARTER_COLLECTIONS.slice(0, 3).map((c) => (
          <li key={c.id}>
            <Link to={`/collections?starter=${c.id}`} className="card card-interactive flex h-full flex-col p-4">
              <span className="font-semibold">{c.name}</span>
              <span className="mt-1 flex-1 text-sm text-muted">{c.description}</span>
              <span className="mt-3 text-xs text-muted">
                {c.apiIds.length} APIs · {c.apiIds.slice(0, 3).map((id) => getApi(id)?.name ?? id).join(', ')}
                {c.apiIds.length > 3 ? '…' : ''}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Contribute() {
  return (
    <section className="container-page pb-4" aria-labelledby="contrib">
      <div className={clsx('card flex flex-col items-start justify-between gap-4 p-6 sm:flex-row sm:items-center')}>
        <div>
          <h2 id="contrib" className="text-xl font-semibold tracking-tight">
            Help keep the catalog accurate
          </h2>
          <p className="mt-1 max-w-xl text-sm text-muted">Add an API, verify a pricing page, or fix an outdated entry. Every change is a reviewed pull request, and accuracy matters more than size.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/contribute" className="btn btn-primary">
            How to contribute
          </Link>
          {REPO_URL && (
            <a className="btn" href={REPO_URL} target="_blank" rel="noopener noreferrer">
              <Github className="h-4 w-4" aria-hidden="true" /> GitHub
            </a>
          )}
          <Link to="/favorites" className="btn btn-ghost">
            <Heart className="h-4 w-4" aria-hidden="true" /> Your favorites
          </Link>
        </div>
      </div>
    </section>
  );
}

export default function Home() {
  useMeta('', 'Discover public APIs, compare free tiers, estimate usage costs and test endpoints in your browser. Open source, with pricing you can verify.');
  return (
    <>
      <Hero />
      <Categories />
      <Featured />
      <FreeApis />
      <PlaygroundPreview />
      <CostPreview />
      <Collections />
      <Contribute />
    </>
  );
}
