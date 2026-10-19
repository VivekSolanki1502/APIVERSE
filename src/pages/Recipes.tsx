import { Link } from 'react-router-dom';
import { Page } from '../components/Page';
import { analyzeRecipe, recipes } from '../lib/recipes';
import { apis } from '../lib/catalog';

export default function Recipes() {
  return (
    <Page title="Project recipes" intro="Curated stacks of APIs that work well together, with combined cost, authentication effort and commercial-use risk worked out from the catalog. Totals are shown only when every member can be estimated.">
      <div className="grid gap-4 sm:grid-cols-2">
        {recipes.map((r) => {
          const a = analyzeRecipe(r, apis, 10_000);
          return (
            <article key={r.id} className="card p-4">
              <h2 className="font-semibold">
                <Link className="hover:text-accent" to={`/recipes/${r.id}`}>{r.name}</Link>
              </h2>
              <p className="mt-1 text-sm text-muted">{r.summary}</p>
              <p className="mt-2 text-xs text-muted">{a.members.map((m) => m.api.name).join(' + ')}</p>
              <div className="mt-3 flex flex-wrap gap-1.5 text-xs">
                <span className="badge">{a.keyCount === 0 ? 'No keys needed' : `${a.keyCount} key${a.keyCount > 1 ? 's' : ''} needed`}</span>
                <span className="badge">{a.complete ? 'Cost estimable' : 'Cost partly unknown'}</span>
                <span className="badge">{a.verifiedCount}/{a.members.length} pricing verified</span>
              </div>
            </article>
          );
        })}
      </div>
    </Page>
  );
}
