import { Link } from 'react-router-dom';
import { Heart } from 'lucide-react';
import { getApi } from '../lib/catalog';
import { useFavorites } from '../hooks/useLocalData';
import { ApiCard } from '../components/ApiCard';
import { EmptyState, Page } from '../components/Page';
import type { ApiEntry } from '../types/catalog';

export default function Favorites() {
  const { favorites } = useFavorites();
  const list = favorites.map((id) => getApi(id)).filter((a): a is ApiEntry => a !== undefined);
  return (
    <Page
      title="Favorites"
      description="APIs you saved in this browser. No account is needed and nothing is synced."
      intro="APIs you saved. Stored only in this browser, with no account required, and not synced across devices."
      actions={
        list.length > 0 ? (
          <Link to="/explore" className="btn">
            Find more APIs
          </Link>
        ) : undefined
      }
    >
      {list.length === 0 ? (
        <EmptyState
          icon={<Heart />}
          title="No favorites yet"
          action={
            <Link className="btn btn-primary" to="/explore">
              Browse APIs
            </Link>
          }
        >
          Tap the heart on any API to keep it here for later. Favorites stay in this browser only.
        </EmptyState>
      ) : (
        <>
          <p className="mb-4 text-sm text-muted" role="status">
            {list.length} saved {list.length === 1 ? 'API' : 'APIs'}
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {list.map((a) => (
              <ApiCard key={a.id} api={a} />
            ))}
          </div>
        </>
      )}
    </Page>
  );
}
