import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowDown, ExternalLink, Link2, RotateCcw, SearchX } from 'lucide-react';
import { apis } from '../lib/catalog';
import { CATEGORIES, CURRENCIES, type Category, type Currency } from '../types/catalog';
import { DEFAULT_BUDGET_INPUT, PRICING_CATEGORY_LABEL, findBudgetApis, type BudgetInput, type Recommendation } from '../lib/budget';
import { BUDGET_MODES, budgetToParams, calcToParams, modeOf, paramsToBudget, paramsToCalc } from '../lib/budgetUrl';
import { COST_DISCLAIMER, billingKind, estimateApi, type Usage } from '../lib/cost';
import { authSummary, billingLabel, formatDate, formatMoney, freeTierSummary } from '../lib/format';
import { absoluteUrl, copyToClipboard } from '../hooks/useCopy';
import { EmptyState, Page, SectionHeader } from '../components/Page';
import { PricingBadge, VerificationBadge } from '../components/Badges';
import { CostBreakdown } from '../components/CostBreakdown';
import { useToast } from '../components/Toast';

const toNum = (s: string): number | null => {
  if (s.trim() === '') return null;
  const n = Number(s);
  return Number.isFinite(n) && n >= 0 ? n : null;
};

type KindId = 'ai' | 'weather' | 'maps' | 'education' | 'finance' | 'gaming' | 'general' | 'other';
const KINDS: { id: KindId; label: string; category: Category | '' }[] = [
  { id: 'ai', label: 'AI or machine learning', category: 'AI & Machine Learning' },
  { id: 'weather', label: 'Weather app', category: 'Weather' },
  { id: 'maps', label: 'Maps and geolocation', category: 'Maps & Geolocation' },
  { id: 'education', label: 'Education', category: 'Books & Education' },
  { id: 'finance', label: 'Finance', category: 'Finance & Economics' },
  { id: 'gaming', label: 'Gaming', category: 'Gaming & Entertainment' },
  { id: 'general', label: 'General application', category: '' },
  { id: 'other', label: 'Other…', category: '' },
];
const OTHER_CATEGORIES = CATEGORIES.filter((c) => !KINDS.some((k) => k.category === c));

function kindOf(category: Category | ''): KindId {
  if (!category) return 'general';
  return KINDS.find((k) => k.category === category)?.id ?? 'other';
}

/** Native radio inputs, visually restyled: keyboard and screen-reader behaviour comes for free. */
function RadioCard({ name, value, checked, onChange, label, hint }: { name: string; value: string; checked: boolean; onChange: () => void; label: string; hint?: string }) {
  return (
    <label className="relative block cursor-pointer">
      <input type="radio" className="peer sr-only" name={name} value={value} checked={checked} onChange={onChange} />
      <span className="block min-h-11 rounded-control border border-border bg-bg px-3 py-2 text-sm transition-colors hover:border-border-strong peer-checked:border-accent peer-checked:bg-accent/10 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent">
        <span className="block font-medium">{label}</span>
        {hint && <span className="mt-0.5 block text-xs text-muted">{hint}</span>}
      </span>
    </label>
  );
}

function Step({ n, title, optional, children }: { n: number; title: string; optional?: boolean; children: ReactNode }) {
  return (
    <div role="group" aria-labelledby={`step-${n}`} className="border-t border-border pt-5 first:border-0 first:pt-0">
      <h3 id={`step-${n}`} className="mb-3 flex items-center gap-2 text-sm font-semibold">
        <span className="grid h-6 w-6 place-items-center rounded-full bg-accent/15 text-xs text-accent" aria-hidden="true">
          {n}
        </span>
        {title}
        {optional && <span className="text-xs font-normal text-muted">optional</span>}
      </h3>
      {children}
    </div>
  );
}

function RecCard({ r, currency }: { r: Recommendation; currency: Currency }) {
  const p = r.api.pricing;
  const shownLimits = r.api.limitations.slice(0, 2);
  return (
    <li className="card p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="font-semibold">
            <Link to={`/api/${r.api.id}`} className="hover:text-accent">
              {r.api.name}
            </Link>
          </h3>
          <p className="text-xs text-muted">
            {PRICING_CATEGORY_LABEL[r.category]} · {r.api.category}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <PricingBadge api={r.api} />
          <span className="badge" title="A transparent heuristic score; higher means a better fit for the inputs you gave. It is not a quality or price ranking.">
            Fit score {r.score}
          </span>
        </div>
      </div>

      <dl className="mt-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-xs text-muted">Free quota</dt>
          <dd>{freeTierSummary(r.api)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted">Billing model</dt>
          <dd>{billingLabel(billingKind(r.api))}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted">Estimated monthly cost</dt>
          <dd>{r.estimatedMonthlyCost === null ? <span className="text-muted">Cannot estimate reliably</span> : <strong>{formatMoney(r.estimatedMonthlyCost, p.currency ?? currency)}</strong>}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted">Authentication</dt>
          <dd>{authSummary(r.api)}</dd>
        </div>
      </dl>
      {r.estimatedMonthlyCost !== null && <p className="mt-1.5 text-xs text-muted">{r.estimateNote}</p>}

      {shownLimits.length > 0 && (
        <div className="mt-3">
          <p className="text-xs font-medium text-muted">Important limitations</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm text-muted">
            {shownLimits.map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
          {r.api.limitations.length > shownLimits.length && (
            <Link to={`/api/${r.api.id}?tab=limitations`} className="mt-1 inline-block text-xs text-accent hover:underline">
              +{r.api.limitations.length - shownLimits.length} more on the details page
            </Link>
          )}
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border pt-3 text-xs text-muted">
        <VerificationBadge status={p.verificationStatus} compact />
        <span>Last verified: {formatDate(p.lastVerified)}</span>
        {p.pricingUrl ? (
          <a href={p.pricingUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-medium text-accent hover:underline">
            Official pricing <ExternalLink className="h-3 w-3" aria-hidden="true" />
          </a>
        ) : (
          <span>No pricing URL recorded</span>
        )}
      </div>

      <details className="mt-3 text-sm">
        <summary className="inline-flex min-h-8 cursor-pointer items-center text-accent">Why this result</summary>
        <ul className="mt-1 list-disc space-y-1 pl-5 text-muted">
          {r.reasons.map((x) => (
            <li key={x}>{x}</li>
          ))}
        </ul>
        {r.warnings.length > 0 && (
          <ul className="mt-2 list-disc space-y-1 pl-5 text-warn">
            {r.warnings.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
        )}
      </details>
    </li>
  );
}

const USAGE_FIELDS: { key: keyof Usage; label: string; hint?: string }[] = [
  { key: 'monthlyRequests', label: 'Requests per month' },
  { key: 'monthlyInputTokens', label: 'Input tokens per month' },
  { key: 'monthlyOutputTokens', label: 'Output tokens per month' },
  { key: 'monthlyUsers', label: 'Users per month' },
  { key: 'monthlyDataGb', label: 'Data per month (GB)' },
];

function fieldsFor(kinds: Set<string | undefined>): (keyof Usage)[] {
  const f: (keyof Usage)[] = [];
  if (kinds.has('tokens')) f.push('monthlyInputTokens', 'monthlyOutputTokens');
  if (kinds.has('per-user')) f.push('monthlyUsers');
  if (kinds.has('data-volume')) f.push('monthlyDataGb');
  if (f.length === 0 || kinds.has('requests') || kinds.has('credits') || kinds.has('tiered-requests')) f.unshift('monthlyRequests');
  return f;
}

export default function BudgetFinder() {
  const [sp, setSp] = useSearchParams();
  const toast = useToast();

  // --- The brief (steps 1–3) ---------------------------------------------------------------
  const [input, setInput] = useState<BudgetInput>(() => paramsToBudget(sp));
  const [kind, setKind] = useState<KindId>(() => kindOf(paramsToBudget(sp).category));
  const [volumeText, setVolumeText] = useState(() => (input.monthlyRequests === null ? '' : String(input.monthlyRequests)));
  const [budgetText, setBudgetText] = useState(() => (input.maxBudget === null ? '' : String(input.maxBudget)));
  const set = (patch: Partial<BudgetInput>) => setInput((i) => ({ ...i, ...patch }));
  const result = useMemo(() => findBudgetApis(apis, input), [input]);
  const mode = modeOf(input);
  const total = result.recommended.length + result.needsReview.length;

  // --- Calculator ----------------------------------------------------------------------------
  const withPlans = useMemo(() => apis.filter((a) => a.pricing.plans.length > 0), []);
  const initialCalc = useMemo(() => paramsToCalc(sp, withPlans.map((a) => a.id), withPlans[0]?.id ?? ''), []); // eslint-disable-line react-hooks/exhaustive-deps
  const [calcOn, setCalcOn] = useState(() => sp.has('calc'));
  const [calcId, setCalcId] = useState(initialCalc.apiId);
  const [usageText, setUsageText] = useState<Partial<Record<keyof Usage, string>>>(() => Object.fromEntries(Object.entries(initialCalc.usage).map(([k, v]) => [k, String(v)])));
  const calcApi = withPlans.find((a) => a.id === calcId);
  const needed = calcApi ? fieldsFor(new Set(calcApi.pricing.plans.map((p) => p.billing?.kind))) : [];
  const usage: Usage = {};
  for (const f of needed) {
    const v = toNum(usageText[f] ?? '');
    if (v !== null) usage[f] = v;
  }
  const usageInvalid = needed.some((f) => (usageText[f] ?? '').trim() !== '' && toNum(usageText[f] ?? '') === null);
  const estimates = calcApi ? estimateApi(calcApi, usage) : [];
  const touchCalc = () => setCalcOn(true);

  // Keep the URL in step with the form so the exact brief or estimate can be shared.
  useEffect(() => {
    const u = budgetToParams(input);
    if (calcOn && calcApi) calcToParams({ apiId: calcApi.id, usage }, u);
    setSp(u, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input, calcOn, calcId, JSON.stringify(usage)]);

  const share = async (withCalc: boolean) => {
    // Built from the form state (not the address bar) so it is always complete and contains only inputs.
    const u = budgetToParams(input);
    if (withCalc && calcApi) calcToParams({ apiId: calcApi.id, usage }, u);
    const q = u.toString();
    const ok = await copyToClipboard(absoluteUrl(`/budget-finder${q ? `?${q}` : ''}${withCalc ? '#calculator' : '#results'}`));
    toast.show(ok ? 'Link copied. It contains only the values you entered.' : 'Could not copy automatically. Copy the address bar instead.', ok ? 'success' : 'error');
  };

  const reset = () => {
    setInput(DEFAULT_BUDGET_INPUT);
    setKind('general');
    setVolumeText('');
    setBudgetText('');
  };

  const chooseKind = (id: KindId) => {
    setKind(id);
    const k = KINDS.find((x) => x.id === id);
    if (id !== 'other') set({ category: k?.category ?? '' });
  };

  return (
    <Page
      title="Budget Finder"
      eyebrow="Discover. Compare. Test. Budget. Build."
      description="Describe your project and budget to find free and affordable APIs, with transparent reasoning and cost estimates based on each provider’s own pricing."
      intro="Describe your project and budget. Results update as you go, show their reasoning, and never claim something is “the cheapest”. Every step is optional."
      actions={
        <>
          <button type="button" className="btn" onClick={() => void share(false)}>
            <Link2 className="h-4 w-4" aria-hidden="true" /> Copy link to this brief
          </button>
          <button type="button" className="btn btn-ghost" onClick={reset}>
            <RotateCcw className="h-4 w-4" aria-hidden="true" /> Reset
          </button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-6 pb-16 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] lg:pb-0">
        <form className="card h-fit space-y-5 p-4 sm:p-5 lg:sticky lg:top-20" aria-label="Project brief" onSubmit={(e) => e.preventDefault()}>
          <Step n={1} title="What are you building?">
            <div role="radiogroup" aria-label="Project type" className="grid grid-cols-2 gap-2">
              {KINDS.map((k) => (
                <RadioCard key={k.id} name="kind" value={k.id} checked={kind === k.id} onChange={() => chooseKind(k.id)} label={k.label} />
              ))}
            </div>
            {kind === 'other' && (
              <div className="mt-3">
                <label className="label" htmlFor="b-cat">
                  Category
                </label>
                <select id="b-cat" className="input" value={input.category} onChange={(e) => set({ category: e.target.value as BudgetInput['category'] })}>
                  <option value="">Any category</option>
                  {OTHER_CATEGORIES.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </div>
            )}
            <div className="mt-3">
              <label className="label" htmlFor="b-kw">
                Required functionality (keywords, optional)
              </label>
              <input id="b-kw" className="input" placeholder="e.g. forecast, geocoding" maxLength={100} value={input.keywords} onChange={(e) => set({ keywords: e.target.value })} />
            </div>
          </Step>

          <Step n={2} title="What is your budget?" optional>
            <div role="radiogroup" aria-label="Budget" className="grid gap-2">
              {BUDGET_MODES.map((m) => (
                <RadioCard key={m.id} name="budget-mode" value={m.id} checked={mode === m.id} onChange={() => set(m.flags)} label={m.label} hint={m.hint} />
              ))}
            </div>
            <details className="mt-3 text-sm" open={mode === null}>
              <summary className="inline-flex min-h-8 cursor-pointer items-center text-accent">Fine-tune what to include{mode === null ? ' (custom)' : ''}</summary>
              <div className="mt-1 space-y-1">
                {(
                  [
                    ['allowPaid', 'Paid upgrades and paid-only APIs'],
                    ['allowTrial', 'Free trials (not free long-term)'],
                    ['allowSelfHosted', 'Self-hosted alternatives'],
                  ] as const
                ).map(([k, label]) => (
                  <label key={k} className="flex min-h-9 cursor-pointer items-center gap-2.5">
                    <input className="check" type="checkbox" checked={input[k]} onChange={(e) => set({ [k]: e.target.checked } as Partial<BudgetInput>)} />
                    {label}
                  </label>
                ))}
              </div>
            </details>
          </Step>

          <Step n={3} title="Estimate your usage" optional>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="label" htmlFor="b-vol">
                  Expected monthly requests
                </label>
                <input
                  id="b-vol"
                  className="input"
                  inputMode="numeric"
                  placeholder="e.g. 50000"
                  value={volumeText}
                  aria-invalid={volumeText.trim() !== '' && toNum(volumeText) === null}
                  onChange={(e) => {
                    setVolumeText(e.target.value);
                    set({ monthlyRequests: toNum(e.target.value) });
                  }}
                />
              </div>
              <div>
                <label className="label" htmlFor="b-max">
                  Max monthly budget
                </label>
                <input
                  id="b-max"
                  className="input"
                  inputMode="decimal"
                  placeholder="e.g. 20"
                  value={budgetText}
                  aria-invalid={budgetText.trim() !== '' && toNum(budgetText) === null}
                  onChange={(e) => {
                    setBudgetText(e.target.value);
                    set({ maxBudget: toNum(e.target.value) });
                  }}
                />
              </div>
              <div>
                <label className="label" htmlFor="b-cur">
                  Currency
                </label>
                <select id="b-cur" className="input" value={input.currency} onChange={(e) => set({ currency: e.target.value as Currency })}>
                  {CURRENCIES.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div className="col-span-2">
                <label className="label" htmlFor="b-auth">
                  Authentication
                </label>
                <select id="b-auth" className="input" value={input.authPreference} onChange={(e) => set({ authPreference: e.target.value as BudgetInput['authPreference'] })}>
                  <option value="any">Any</option>
                  <option value="none">No authentication only</option>
                  <option value="simple">Avoid OAuth 2.0</option>
                </select>
              </div>
            </div>
            {(volumeText.trim() !== '' && toNum(volumeText) === null) || (budgetText.trim() !== '' && toNum(budgetText) === null) ? (
              <p role="alert" className="mt-2 text-sm text-danger">
                Enter plain, non-negative numbers (for example 50000). Invalid values are ignored.
              </p>
            ) : null}
            <p className="mt-2 text-xs text-muted">Token, credit and per-user pricing can be explored in the calculator below.</p>
          </Step>
        </form>

        <div className="min-w-0 space-y-8" id="results">
          <section aria-labelledby="rec">
            <SectionHeader id="rec" title="Matches with verified pricing" description="Pricing for these entries was checked against official pages." />
            <p className="mb-3 text-sm text-muted" role="status" aria-live="polite">
              {result.recommended.length} verified {result.recommended.length === 1 ? 'match' : 'matches'}, {result.needsReview.length} awaiting review.
            </p>
            {result.recommended.length === 0 ? (
              <EmptyState icon={<SearchX />} title="No verified match for this brief">
                Loosen a choice above, or look at the unverified matches below. Only entries with verified pricing appear in this list.
              </EmptyState>
            ) : (
              <ul className="space-y-3">
                {result.recommended.map((r) => (
                  <RecCard key={r.api.id} r={r} currency={input.currency} />
                ))}
              </ul>
            )}
          </section>

          <section aria-labelledby="review">
            <SectionHeader id="review" title="Unverified matches" description="These fit your inputs, but their pricing has not been confirmed, so they are never shown as confirmed free or cheap options. Check the provider’s pricing page first." />
            {result.needsReview.length === 0 ? (
              <p className="text-sm text-muted">None.</p>
            ) : (
              <details className="group" open={result.recommended.length === 0}>
                <summary className="btn btn-sm mb-3 cursor-pointer list-none">
                  <span className="group-open:hidden">Show {result.needsReview.length} unverified</span>
                  <span className="hidden group-open:inline">Hide unverified</span>
                </summary>
                <ul className="space-y-3">
                  {result.needsReview.map((r) => (
                    <RecCard key={r.api.id} r={r} currency={input.currency} />
                  ))}
                </ul>
              </details>
            )}
          </section>

          {result.excluded.length > 0 && (
            <details className="text-sm">
              <summary className="inline-flex min-h-8 cursor-pointer items-center text-accent">Why were {result.excluded.length} APIs left out?</summary>
              <ul className="mt-2 space-y-1 text-muted">
                {result.excluded.slice(0, 40).map((x) => (
                  <li key={x.api.id}>
                    <span className="text-fg">{x.api.name}</span>: {x.why}
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-muted">APIs that simply don’t match the category or keywords are not listed here.</p>
            </details>
          )}

          <section className="card p-4" aria-labelledby="assump">
            <h2 id="assump" className="font-semibold">
              Assumptions
            </h2>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted">
              {result.assumptions.map((a) => (
                <li key={a}>{a}</li>
              ))}
              <li>“Free options only” hides paid-only, trial-only and self-hosted entries; freemium products with a free tier can still appear, with their limits shown.</li>
              <li>{COST_DISCLAIMER}</li>
            </ul>
          </section>

          <section id="calculator" className="card p-4 sm:p-5" aria-labelledby="calc">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h2 id="calc" className="text-lg font-semibold">
                  Cost calculator
                </h2>
                <p className="mt-1 max-w-xl text-sm text-muted">Pick an API with recorded plans. Missing prices produce “cannot estimate reliably” with the reason, never a guess. {withPlans.length} of {apis.length} APIs currently have plan data.</p>
              </div>
              <button type="button" className="btn btn-sm" onClick={() => void share(true)} disabled={!calcApi}>
                <Link2 className="h-3.5 w-3.5" aria-hidden="true" /> Copy link to this estimate
              </button>
            </div>
            {withPlans.length === 0 ? (
              <p className="mt-3 text-sm text-muted">No API in the catalog has plan data yet.</p>
            ) : (
              <>
                <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="label" htmlFor="calc-api">
                      API
                    </label>
                    <select
                      id="calc-api"
                      className="input"
                      value={calcId}
                      onChange={(e) => {
                        setCalcId(e.target.value);
                        touchCalc();
                      }}
                    >
                      {withPlans.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  {needed.map((f) => {
                    const def = USAGE_FIELDS.find((u) => u.key === f);
                    const bad = (usageText[f] ?? '').trim() !== '' && toNum(usageText[f] ?? '') === null;
                    return (
                      <div key={f}>
                        <label className="label" htmlFor={`calc-${f}`}>
                          {def?.label ?? f}
                        </label>
                        <input
                          id={`calc-${f}`}
                          className="input"
                          inputMode="numeric"
                          value={usageText[f] ?? ''}
                          aria-invalid={bad}
                          onChange={(e) => {
                            setUsageText((t) => ({ ...t, [f]: e.target.value }));
                            touchCalc();
                          }}
                        />
                      </div>
                    );
                  })}
                </div>
                {usageInvalid && (
                  <p role="alert" className="mt-2 text-sm text-danger">
                    Enter plain, non-negative numbers. Invalid fields are treated as empty.
                  </p>
                )}
                {calcApi && (
                  <div className="mt-4 space-y-3" aria-live="polite">
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                      {estimates.map((e) => (
                        <CostBreakdown key={e.plan.name} estimate={e} />
                      ))}
                    </div>
                    <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
                      <VerificationBadge status={calcApi.pricing.verificationStatus} compact />
                      <span>Last verified {formatDate(calcApi.pricing.lastVerified)}</span>
                      {calcApi.pricing.pricingUrl ? (
                        <a className="inline-flex items-center gap-1 font-medium text-accent hover:underline" href={calcApi.pricing.pricingUrl} target="_blank" rel="noopener noreferrer">
                          Official pricing page <ExternalLink className="h-3 w-3" aria-hidden="true" />
                        </a>
                      ) : (
                        <span>No pricing URL recorded</span>
                      )}
                    </p>
                  </div>
                )}
              </>
            )}
          </section>
        </div>
      </div>

      <a href="#results" className="fixed inset-x-4 bottom-4 z-30 flex min-h-11 items-center justify-between rounded-panel border border-border-strong bg-elevated px-4 text-sm font-medium shadow-float lg:hidden">
        <span>
          {total} {total === 1 ? 'match' : 'matches'}
        </span>
        <span className="inline-flex items-center gap-1 text-accent">
          View results <ArrowDown className="h-4 w-4" aria-hidden="true" />
        </span>
      </a>
    </Page>
  );
}
