import { Link } from 'react-router-dom';
import { ArrowUpRight, BookOpen, GitCompareArrows, Heart, KeyRound, ShieldOff } from 'lucide-react';
import clsx from 'clsx';
import type { ApiEntry } from '../types/catalog';
import { authSummary, freeTierSummary } from '../lib/format';
import { useCompare, useFavorites } from '../hooks/useLocalData';
import { PricingBadge } from './Badges';
import { useToast } from './Toast';

interface Props {
  api: ApiEntry;
  /** card: grid tile · row: dense list row */
  variant?: 'card' | 'row';
}

/**
 * The whole tile is one link to the details page (stretched link); the favourite, compare and
 * docs controls sit above it. Only facts that help a first decision are shown.
 */
export function ApiCard({ api, variant = 'card' }: Props) {
  const { isFavorite, toggle } = useFavorites();
  const compare = useCompare();
  const toast = useToast();
  const fav = isFavorite(api.id);
  const inCompare = compare.has(api.id);
  const row = variant === 'row';

  const onFav = () => {
    toggle(api.id);
    toast.show(fav ? `Removed ${api.name} from favorites` : `Saved ${api.name} to favorites`, 'info');
  };
  const onCompare = () => {
    compare.toggle(api.id);
    toast.show(inCompare ? `Removed ${api.name} from comparison` : `Added ${api.name} to comparison`, 'info');
  };

  const actions = (
    <div className="relative z-10 flex shrink-0 gap-0.5">
      <button
        type="button"
        className={clsx('btn btn-ghost btn-icon btn-sm', inCompare && 'text-accent')}
        onClick={onCompare}
        aria-pressed={inCompare}
        aria-label={inCompare ? `Remove ${api.name} from comparison` : `Add ${api.name} to comparison`}
        disabled={!inCompare && compare.full}
        title={!inCompare && compare.full ? 'Comparison is full (4 APIs)' : inCompare ? 'In comparison' : 'Compare'}
      >
        <GitCompareArrows className="h-4 w-4" aria-hidden="true" />
      </button>
      <button
        type="button"
        className={clsx('btn btn-ghost btn-icon btn-sm', fav && 'text-danger')}
        onClick={onFav}
        aria-pressed={fav}
        aria-label={fav ? `Remove ${api.name} from favorites` : `Add ${api.name} to favorites`}
        title={fav ? 'Favorited' : 'Favorite'}
      >
        <Heart className={clsx('h-4 w-4 transition-transform', fav && 'scale-110 fill-current')} aria-hidden="true" />
      </button>
    </div>
  );

  const badges = (
    <div className="flex flex-wrap gap-1.5">
      <PricingBadge api={api} />
      <span className="badge">
        {api.authentication.required && <KeyRound className="h-3 w-3" aria-hidden="true" />}
        {authSummary(api)}
      </span>
      {!api.https && (
        <span className="badge border-warn/40 text-warn">
          <ShieldOff className="h-3 w-3" aria-hidden="true" />
          HTTP only
        </span>
      )}
    </div>
  );

  const title = (
    <h3 className="min-w-0 truncate text-base font-semibold">
      <Link to={`/api/${api.id}`} className="after:absolute after:inset-0 after:content-[''] hover:text-accent focus-visible:outline-offset-[-2px]">
        {api.name}
      </Link>
    </h3>
  );

  const docs = (
    <a
      href={api.documentationUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="relative z-10 inline-flex min-h-8 items-center gap-1 rounded-control px-1.5 text-xs font-medium text-muted hover:text-fg"
      aria-label={`${api.name} official documentation (opens in a new tab)`}
    >
      <BookOpen className="h-3.5 w-3.5" aria-hidden="true" /> Docs
    </a>
  );

  if (row) {
    return (
      <article className="card card-interactive relative flex flex-col gap-2 p-3.5 sm:flex-row sm:items-center sm:gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            {title}
            <span className="hidden shrink-0 text-xs text-muted sm:inline">{api.category}</span>
          </div>
          <p className="mt-0.5 line-clamp-1 text-sm text-muted">{api.description}</p>
        </div>
        <div className="sm:w-72">{badges}</div>
        <div className="flex items-center justify-between gap-2 sm:justify-end">
          <span className="text-xs text-muted sm:hidden">{freeTierSummary(api)}</span>
          <div className="flex items-center">
            {docs}
            {actions}
          </div>
        </div>
      </article>
    );
  }

  return (
    <article className="card card-interactive group relative flex h-full flex-col p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          {title}
          <p className="text-xs text-muted">{api.category}</p>
        </div>
        {actions}
      </div>
      <div className="mt-2 flex-1">
        <p className="line-clamp-2 text-sm text-muted">{api.description}</p>
      </div>
      <div className="mt-3">{badges}</div>
      <div className="mt-3 flex items-center justify-between gap-2 border-t border-border pt-2.5">
        <span className="min-w-0 text-xs leading-snug text-muted">{freeTierSummary(api)}</span>
        <div className="flex shrink-0 items-center">
          {docs}
          <span className="inline-flex items-center gap-0.5 pl-1 text-xs font-medium text-accent" aria-hidden="true">
            <span className="xl:hidden">Details</span> <ArrowUpRight className="h-3.5 w-3.5 transition-transform group-hover:-translate-y-px group-hover:translate-x-px" />
          </span>
        </div>
      </div>
    </article>
  );
}
