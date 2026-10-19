import clsx from 'clsx';

export function Skeleton({ className }: { className?: string }) {
  return <div className={clsx('animate-pulse rounded-control bg-elevated', className)} aria-hidden="true" />;
}

/** Shown while a lazily loaded route chunk downloads. */
export function PageSkeleton() {
  return (
    <div className="container-page py-10" role="status" aria-label="Loading page">
      <Skeleton className="h-8 w-56" />
      <Skeleton className="mt-3 h-4 w-full max-w-lg" />
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-36 rounded-panel" />
        ))}
      </div>
      <span className="sr-only">Loading…</span>
    </div>
  );
}
