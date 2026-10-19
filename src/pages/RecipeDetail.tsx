import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Page, EmptyState } from '../components/Page';
import { CodeBlock } from '../components/CodeBlock';
import { VerificationBadge, CommercialBadge } from '../components/Badges';
import { analyzeRecipe, recipes, starterCode } from '../lib/recipes';
import { apis } from '../lib/catalog';
import { formatMoney } from '../lib/format';
import { COST_DISCLAIMER } from '../lib/cost';
import { useCollections } from '../hooks/useLocalData';

const RISK = {
  'restricted-or-forbidden': 'At least one API has restricted or forbidden commercial use. Read its terms before building a paid product.',
  unchecked: 'Commercial-use terms have not been checked in APIverse for every API here. Verify them yourself.',
  'all-allowed': 'Every API has checked terms that allow commercial use (see each API page for conditions).',
} as const;

export default function RecipeDetail() {
  const { id = '' } = useParams();
  const recipe = recipes.find((r) => r.id === id);
  const [volume, setVolume] = useState(10_000);
  const [lang, setLang] = useState<'javascript' | 'python'>('javascript');
  const { create } = useCollections();
  const nav = useNavigate();

  if (!recipe) {
    return (
      <Page title="Recipe not found">
        <EmptyState title="No such recipe.">
          <Link className="text-accent underline" to="/recipes">Browse recipes</Link>
        </EmptyState>
      </Page>
    );
  }
  const a = analyzeRecipe(recipe, apis, volume);
  const code = starterCode(a.members, lang);

  return (
    <Page title={recipe.name} intro={recipe.summary}>
      <div className="max-w-3xl space-y-6 text-sm">
        <section className="card p-4" aria-labelledby="r-apis">
          <h2 id="r-apis" className="mb-2 font-semibold">APIs in this stack</h2>
          <ul className="space-y-3">
            {a.costs.map((c) => (
              <li key={c.api.id}>
                <div className="flex flex-wrap items-center gap-2">
                  <Link className="font-medium text-accent underline" to={`/api/${c.api.id}`}>{c.api.name}</Link>
                  <VerificationBadge status={c.api.pricing.verificationStatus} />
                  <CommercialBadge api={c.api} />
                </div>
                <p className="text-muted">{c.role}</p>
                <p className="text-xs text-muted">{c.cost === null ? 'Cost: cannot estimate reliably' : `Cost: ${formatMoney(c.cost, c.api.pricing.currency)}/month`} · {c.basis}</p>
              </li>
            ))}
          </ul>
          {a.missingIds.length > 0 && <p className="mt-2 text-danger">Missing from catalog: {a.missingIds.join(', ')}</p>}
        </section>

        <section className="card p-4" aria-labelledby="r-sum">
          <h2 id="r-sum" className="mb-2 font-semibold">Combined summary</h2>
          <label className="mb-3 block">
            Requests per month, per API{' '}
            <input type="number" min={0} className="input inline-block w-32" value={volume} onChange={(e) => setVolume(Math.max(0, Number(e.target.value) || 0))} />
          </label>
          <dl className="space-y-1">
            <div><dt className="inline text-muted">Monthly cost: </dt><dd className="inline">
              {a.complete
                ? formatMoney(a.knownTotal, a.currency ?? 'USD')
                : `Cannot be fully estimated. Known part: ${formatMoney(a.knownTotal, a.currency ?? 'USD')}; unknown: ${a.unknown.join(', ')}.`}
            </dd></div>
            <div><dt className="inline text-muted">Authentication: </dt><dd className="inline">{a.keyCount === 0 ? 'No keys needed' : `${a.keyCount} of ${a.members.length} need credentials (hardest: ${a.hardestAuth})`}</dd></div>
            <div><dt className="inline text-muted">Commercial use: </dt><dd className="inline">{RISK[a.commercialRisk]}</dd></div>
            <div><dt className="inline text-muted">Verified pricing: </dt><dd className="inline">{a.verifiedCount} of {a.members.length}</dd></div>
          </dl>
          <p className="mt-2 text-xs text-muted">{COST_DISCLAIMER}</p>
        </section>

        <section>
          <h2 className="mb-2 font-semibold">Things to know</h2>
          <p className="text-muted">{recipe.notes}</p>
        </section>

        {code && (
          <section>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="font-semibold">Starter code</h2>
              <div className="flex gap-2">
                <button className={`btn btn-sm ${lang === 'javascript' ? 'border-accent text-accent' : ''}`} onClick={() => setLang('javascript')}>JavaScript</button>
                <button className={`btn btn-sm ${lang === 'python' ? 'border-accent text-accent' : ''}`} onClick={() => setLang('python')}>Python</button>
              </div>
            </div>
            <CodeBlock code={code} label={lang === 'javascript' ? 'JavaScript' : 'Python'} />
          </section>
        )}

        <button className="btn btn-primary" onClick={() => { create(recipe.name, a.members.map((m) => m.api.id)); nav('/collections'); }}>
          Save these APIs as a collection
        </button>
      </div>
    </Page>
  );
}
