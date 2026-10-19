import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { LayoutGrid, List, SearchX, SlidersHorizontal } from 'lucide-react';
import clsx from 'clsx';
import { apis } from '../lib/catalog';
import { paginate, paramsToQuery, queryToParams, searchApis, type SearchParams } from '../lib/search';
import { CATEGORIES, PRICING_MODELS } from '../types/catalog';
import { MODEL_LABEL } from '../lib/format';
import { ApiCard } from '../components/ApiCard';
import { Dialog } from '../components/Dialog';
import { FilterChip } from '../components/FilterChip';
import { EmptyState, Page } from '../components/Page';
import { SearchField } from '../components/SearchField';

const CATEGORY_COUNTS = new Map<string, number>();
apis.forEach((a) => CATEGORY_COUNTS.set(a.category, (CATEGORY_COUNTS.get(a.category) ?? 0) + 1));

interface FieldProps {
  params: SearchParams;
  update: (patch: Partial<SearchParams>) => void;
  /** Distinguishes ids when the same fields render in the sidebar and in the mobile sheet. */
  idp: string;
}

/** The filter controls, shared by the desktop sidebar and the mobile filter sheet. */
function FilterFields({ params, update, idp }: FieldProps) {
  return (
    <div className="space-y-4">
      <div>
        <label className="label" htmlFor={`${idp}-auth`}>
          Authentication
        </label>
        <select id={`${idp}-auth`} className="input" value={params.auth} onChange={(e) => update({ auth: e.target.value as SearchParams['auth'] })}>
          <option value="any">Any</option>
          <option value="none">No authentication required</option>
          <option value="required">Authentication required</option>
        </select>
      </div>
      <div>
        <label className="label" htmlFor={`${idp}-pricing`}>
          Pricing model
        </label>
        <select id={`${idp}-pricing`} className="input" value={params.pricing} onChange={(e) => update({ pricing: e.target.value as SearchParams['pricing'] })}>
          <option value="">Any</option>
          {PRICING_MODELS.map((m) => (
            <option key={m} value={m}>
              {MODEL_LABEL[m]}
            </option>
          ))}
        </select>
      </div>
      <fieldset className="space-y-1">
        <legend className="label">Only show</legend>
        {(
          [
            ['httpsOnly', 'HTTPS endpoints'],
            ['freeTier', 'Free tier available'],
            ['verifiedOnly', 'Verified pricing'],
          ] as const
        ).map(([k, label]) => (
          <label key={k} className="flex min-h-9 cursor-pointer items-center gap-2.5 text-sm">
            <input className="check" type="checkbox" checked={params[k]} onChange={(e) => update({ [k]: e.target.checked } as Partial<SearchParams>)} />
            {label}
          </label>
        ))}
      </fieldset>
      <p className="text-xs text-muted">“Free tier available” uses catalog data. Look for the verified badge before relying on it.</p>
    </div>
  );
}

export default function Explore() {
  const [sp, setSp] = useSearchParams();
  const params = useMemo(() => queryToParams(sp), [sp]);
  const results = useMemo(() => searchApis(apis, params), [params]);
  const view = paginate(results, params.page);
  const [layout, setLayout] = useState<'grid' | 'list'>('grid');
  const [sheet, setSheet] = useState(false);
  const top = useRef<HTMLDivElement>(null);
  const firstRender = useRef(true);

  const update = (patch: Partial<SearchParams>) => setSp(paramsToQuery({ ...params, page: 1, ...patch }), { replace: true });
  const goPage = (page: number) => setSp(paramsToQuery({ ...params, page }));
  const clearAll = () => setSp(new URLSearchParams(), { replace: true });

  // Bring the results back into view after changing page (not on first load).
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    top.current?.scrollIntoView({ block: 'start' });
  }, [view.page]);

  const chips: { key: string; label: string; clear: Partial<SearchParams> }[] = [];
  if (params.q) chips.push({ key: 'q', label: `Search: “${params.q}”`, clear: { q: '' } });
  if (params.category) chips.push({ key: 'category', label: params.category, clear: { category: '' } });
  if (params.auth !== 'any') chips.push({ key: 'auth', label: params.auth === 'none' ? 'No authentication' : 'Authentication required', clear: { auth: 'any' } });
  if (params.pricing) chips.push({ key: 'pricing', label: `Pricing: ${MODEL_LABEL[params.pricing]}`, clear: { pricing: '' } });
  if (params.httpsOnly) chips.push({ key: 'https', label: 'HTTPS only', clear: { httpsOnly: false } });
  if (params.freeTier) chips.push({ key: 'free', label: 'Free tier available', clear: { freeTier: false } });
  if (params.verifiedOnly) chips.push({ key: 'verified', label: 'Verified pricing', clear: { verifiedOnly: false } });
  const filterCount = chips.filter((c) => c.key !== 'q' && c.key !== 'category').length;

  return (
    <Page
      title="Explore APIs"
      description={`Search ${apis.length} documented public APIs by name, tag or use case and filter by authentication, HTTPS, pricing model and free-tier availability.`}
      intro="Search by name, tag or use case, then narrow by authentication, pricing and verification. The URL always reflects your filters, so you can share it."
    >
      <SearchField id="q" label="Search APIs" size="lg" value={params.q} onChange={(q) => update({ q })} placeholder="Search by name, tag or use case…" />

      <div className="mt-4 flex gap-2 overflow-x-auto pb-1 sm:flex-wrap" role="group" aria-label="Category">
        <button type="button" className="chip shrink-0" aria-pressed={!params.category} onClick={() => update({ category: '' })}>
          All <span className="opacity-70">{apis.length}</span>
        </button>
        {CATEGORIES.filter((c) => CATEGORY_COUNTS.has(c)).map((c) => (
          <button key={c} type="button" className="chip shrink-0" aria-pressed={params.category === c} onClick={() => update({ category: params.category === c ? '' : c })}>
            {c} <span className="opacity-70">{CATEGORY_COUNTS.get(c)}</span>
          </button>
        ))}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[15rem_minmax(0,1fr)]">
        <aside aria-label="Filters" className="hidden h-fit lg:sticky lg:top-20 lg:block">
          <div className="card p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold">Filters</h2>
              <button type="button" className="text-xs text-accent hover:underline disabled:cursor-not-allowed disabled:text-muted disabled:no-underline" onClick={clearAll} disabled={sp.toString() === ''}>
                Clear all
              </button>
            </div>
            <FilterFields params={params} update={update} idp="side" />
          </div>
        </aside>

        <section aria-label="Results" className="min-w-0" ref={top}>
          <div className="flex flex-wrap items-center gap-2">
            <p className="mr-auto text-sm text-muted" role="status" aria-live="polite">
              <span className="font-medium text-fg">{results.length}</span> {results.length === 1 ? 'API' : 'APIs'} found
              {results.length !== apis.length && <> of {apis.length}</>}
            </p>
            <button type="button" className="btn btn-sm lg:hidden" onClick={() => setSheet(true)}>
              <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden="true" /> Filters
              {filterCount > 0 && <span className="rounded-full bg-accent px-1.5 text-[0.65rem] text-accent-fg">{filterCount}</span>}
            </button>
            <div className="flex items-center gap-1.5">
              <label htmlFor="sort" className="sr-only">
                Sort by
              </label>
              <select id="sort" className="input min-h-8 w-auto py-1 text-xs" value={params.sort} onChange={(e) => update({ sort: e.target.value as SearchParams['sort'] })}>
                <option value="relevance">Sort: Relevant match</option>
                <option value="name">Sort: Name</option>
                <option value="verified">Sort: Recently verified</option>
              </select>
            </div>
            <div role="group" aria-label="Layout" className="flex rounded-control border border-border p-0.5">
              {(
                [
                  ['grid', LayoutGrid, 'Grid view'],
                  ['list', List, 'List view'],
                ] as const
              ).map(([id, Icon, label]) => (
                <button key={id} type="button" aria-pressed={layout === id} aria-label={label} title={label} onClick={() => setLayout(id)} className={clsx('grid h-7 w-8 place-items-center rounded transition-colors', layout === id ? 'bg-elevated text-fg' : 'text-muted hover:text-fg')}>
                  <Icon className="h-4 w-4" aria-hidden="true" />
                </button>
              ))}
            </div>
          </div>

          {chips.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-2" aria-label="Active filters" role="group">
              {chips.map((c) => (
                <FilterChip key={c.key} label={c.label} onRemove={() => update(c.clear)} />
              ))}
              <button type="button" className="text-xs text-muted underline hover:text-fg" onClick={clearAll}>
                Clear all filters
              </button>
            </div>
          )}

          <div className="mt-4">
            {results.length === 0 ? (
              <EmptyState
                icon={<SearchX />}
                title="No APIs match these filters"
                action={
                  <>
                    <button type="button" className="btn btn-primary" onClick={clearAll}>
                      Clear all filters
                    </button>
                    <Link className="btn" to="/contribute">
                      Contribute this API
                    </Link>
                  </>
                }
              >
                Try removing a filter or searching a broader term such as “weather” or “books”. Missing an API? Add it to the catalog.
              </EmptyState>
            ) : (
              <>
                <div className={clsx(layout === 'grid' ? 'grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3' : 'flex flex-col gap-2.5')}>
                  {view.items.map((a) => (
                    <ApiCard key={a.id} api={a} variant={layout === 'grid' ? 'card' : 'row'} />
                  ))}
                </div>
                {view.pages > 1 && (
                  <nav aria-label="Pagination" className="mt-6 flex items-center justify-center gap-3">
                    <button className="btn" disabled={view.page <= 1} onClick={() => goPage(view.page - 1)}>
                      Previous
                    </button>
                    <span className="text-sm text-muted">
                      Page {view.page} of {view.pages}
                    </span>
                    <button className="btn" disabled={view.page >= view.pages} onClick={() => goPage(view.page + 1)}>
                      Next
                    </button>
                  </nav>
                )}
              </>
            )}
          </div>
        </section>
      </div>

      <Dialog open={sheet} onClose={() => setSheet(false)} title="Filters" variant="sheet">
        <div className="overflow-auto p-4">
          <FilterFields params={params} update={update} idp="sheet" />
        </div>
        <div className="flex gap-2 border-t border-border p-3">
          <button type="button" className="btn flex-1" onClick={clearAll} disabled={sp.toString() === ''}>
            Clear all
          </button>
          <button type="button" className="btn btn-primary flex-1" onClick={() => setSheet(false)}>
            Show {results.length} {results.length === 1 ? 'result' : 'results'}
          </button>
        </div>
      </Dialog>
    </Page>
  );
}