import type { ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';
import { useMeta } from '../hooks/useTitle';

export function PageHeader({ title, intro, actions, eyebrow }: { title: string; intro?: ReactNode; actions?: ReactNode; eyebrow?: ReactNode }) {
  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow && <p className="mb-1 text-xs font-medium uppercase tracking-wider text-accent">{eyebrow}</p>}
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
        {intro && <p className="mt-2 max-w-2xl text-sm text-muted sm:text-base">{intro}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
    </header>
  );
}

export function Page({ title, intro, description, actions, eyebrow, children }: { title: string; intro?: ReactNode; description?: string; actions?: ReactNode; eyebrow?: ReactNode; children: ReactNode }) {
  useMeta(title, description);
  return (
    <div className="container-page py-8 sm:py-10">
      <PageHeader title={title} intro={intro} actions={actions} eyebrow={eyebrow} />
      <div className="mt-6 sm:mt-8">{children}</div>
    </div>
  );
}

export function SectionHeader({ id, title, description, action }: { id?: string; title: string; description?: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
      <div className="min-w-0">
        <h2 id={id} className="text-lg font-semibold tracking-tight sm:text-xl">
          {title}
        </h2>
        {description && <p className="mt-1 max-w-2xl text-sm text-muted">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function EmptyState({ title, children, icon, action }: { title: string; children?: ReactNode; icon?: ReactNode; action?: ReactNode }) {
  return (
    <div className="card flex flex-col items-center border-dashed p-8 text-center sm:p-10">
      {icon && <div className="mb-3 grid h-11 w-11 place-items-center rounded-full bg-elevated text-muted [&>svg]:h-5 [&>svg]:w-5">{icon}</div>}
      <p className="font-medium">{title}</p>
      {children && <div className="mt-1.5 max-w-md text-sm text-muted">{children}</div>}
      {action && <div className="mt-4 flex flex-wrap justify-center gap-2">{action}</div>}
    </div>
  );
}

export function ErrorState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div role="alert" className="card flex flex-col items-center border-danger/40 p-8 text-center">
      <div className="mb-3 grid h-11 w-11 place-items-center rounded-full bg-danger/10 text-danger">
        <AlertTriangle className="h-5 w-5" aria-hidden="true" />
      </div>
      <p className="font-medium">{title}</p>
      {children && <div className="mt-1.5 max-w-md text-sm text-muted">{children}</div>}
      {action && <div className="mt-4 flex gap-2">{action}</div>}
    </div>
  );
}
