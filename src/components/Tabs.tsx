import { useRef, type KeyboardEvent, type ReactNode } from 'react';
import clsx from 'clsx';

export interface TabDef {
  id: string;
  label: string;
  count?: number;
  disabled?: boolean;
  title?: string;
}

interface Props {
  tabs: TabDef[];
  value: string;
  onChange: (id: string) => void;
  label: string;
  idPrefix: string;
  /** "line" is the page-level underline style; "pill" is a compact segmented control. */
  variant?: 'line' | 'pill';
}

const tabId = (p: string, id: string) => `${p}-tab-${id}`;
const panelId = (p: string, id: string) => `${p}-panel-${id}`;

/** WAI-ARIA tabs: roving tabindex, arrow/Home/End keys, automatic activation. */
export function Tabs({ tabs, value, onChange, label, idPrefix, variant = 'line' }: Props) {
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});
  const enabled = tabs.filter((t) => !t.disabled);

  const onKey = (e: KeyboardEvent) => {
    const i = enabled.findIndex((t) => t.id === value);
    let n = -1;
    if (e.key === 'ArrowRight') n = (i + 1) % enabled.length;
    else if (e.key === 'ArrowLeft') n = (i - 1 + enabled.length) % enabled.length;
    else if (e.key === 'Home') n = 0;
    else if (e.key === 'End') n = enabled.length - 1;
    if (n < 0) return;
    e.preventDefault();
    const t = enabled[n];
    if (t) {
      onChange(t.id);
      refs.current[t.id]?.focus();
    }
  };

  return (
    <div className={clsx('overflow-x-auto', variant === 'line' && 'border-b border-border')}>
      <div role="tablist" aria-label={label} onKeyDown={onKey} className={clsx('flex min-w-max', variant === 'pill' ? 'gap-1' : 'gap-1')}>
        {tabs.map((t) => {
          const active = t.id === value;
          return (
            <button
              key={t.id}
              ref={(el) => {
                refs.current[t.id] = el;
              }}
              type="button"
              role="tab"
              id={tabId(idPrefix, t.id)}
              aria-selected={active}
              aria-controls={panelId(idPrefix, t.id)}
              tabIndex={active ? 0 : -1}
              disabled={t.disabled}
              title={t.title}
              onClick={() => onChange(t.id)}
              className={clsx(
                'inline-flex min-h-10 items-center gap-1.5 whitespace-nowrap text-sm font-medium transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-50',
                variant === 'line' && ['-mb-px border-b-2 px-3', active ? 'border-accent text-fg' : 'border-transparent text-muted hover:text-fg'],
                variant === 'pill' && ['rounded-control px-3', active ? 'bg-elevated text-fg' : 'text-muted hover:text-fg'],
              )}
            >
              {t.label}
              {t.count !== undefined && <span className="rounded-full bg-elevated px-1.5 text-[0.7rem] text-muted">{t.count}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function TabPanel({ idPrefix, id, active, children, className }: { idPrefix: string; id: string; active: boolean; children: ReactNode; className?: string }) {
  if (!active) return null;
  return (
    <div role="tabpanel" id={panelId(idPrefix, id)} aria-labelledby={tabId(idPrefix, id)} tabIndex={0} className={clsx('animate-fade-in focus-visible:outline-offset-4', className)}>
      {children}
    </div>
  );
}
