import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, CornerDownLeft, FlaskConical, Calculator, FolderHeart, GitCompareArrows, Search } from 'lucide-react';
import clsx from 'clsx';
import { apis } from '../lib/catalog';
import { DEFAULT_PARAMS, searchApis } from '../lib/search';
import { Dialog } from './Dialog';

const SHORTCUTS = [
  { to: '/budget-finder', label: 'Budget Finder', icon: Calculator },
  { to: '/playground', label: 'Playground', icon: FlaskConical },
  { to: '/compare', label: 'Compare APIs', icon: GitCompareArrows },
  { to: '/collections', label: 'Collections', icon: FolderHeart },
];

interface Row {
  key: string;
  label: string;
  sub: string;
  to: string;
  icon?: typeof Search;
}

function Palette({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const listId = useId();
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => input.current?.focus(), []);

  const rows: Row[] = useMemo(() => {
    const term = q.trim();
    if (!term) return SHORTCUTS.map((s) => ({ key: s.to, label: s.label, sub: 'Go to', to: s.to, icon: s.icon }));
    const hits = searchApis(apis, { ...DEFAULT_PARAMS, q: term }).slice(0, 7);
    const list: Row[] = hits.map((a) => ({ key: a.id, label: a.name, sub: a.category, to: `/api/${a.id}` }));
    list.push({ key: '__all', label: `Search all APIs for “${term}”`, sub: 'Explore', to: `/explore?q=${encodeURIComponent(term)}`, icon: Search });
    return list;
  }, [q]);

  const go = (r: Row | undefined) => {
    if (!r) return;
    navigate(r.to);
    onClose();
  };

  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => (i + 1) % rows.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => (i - 1 + rows.length) % rows.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      go(rows[Math.min(active, rows.length - 1)]);
    }
  };

  const activeId = `${listId}-opt-${Math.min(active, rows.length - 1)}`;

  return (
    <div>
      <div className="flex items-center gap-2 border-b border-border px-3">
        <Search className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
        <input
          ref={input}
          role="combobox"
          aria-expanded="true"
          aria-controls={listId}
          aria-activedescendant={activeId}
          aria-autocomplete="list"
          aria-label="Search APIs"
          className="min-h-12 w-full bg-transparent text-base outline-none placeholder:text-muted"
          placeholder="Search APIs by name, tag or use case…"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setActive(0);
          }}
          onKeyDown={onKey}
        />
        <span className="kbd">Esc</span>
      </div>
      <ul id={listId} role="listbox" aria-label="Results" className="max-h-[50vh] overflow-auto p-2">
        {rows.map((r, i) => {
          const Icon = r.icon;
          return (
            <li
              key={r.key}
              id={`${listId}-opt-${i}`}
              role="option"
              aria-selected={i === Math.min(active, rows.length - 1)}
              onMouseMove={() => setActive(i)}
              onClick={() => go(r)}
              className={clsx('flex min-h-11 cursor-pointer items-center gap-3 rounded-control px-3 py-2 text-sm', i === Math.min(active, rows.length - 1) ? 'bg-elevated' : '')}
            >
              {Icon ? <Icon className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" /> : <ArrowRight className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />}
              <span className="min-w-0 flex-1 truncate font-medium">{r.label}</span>
              <span className="shrink-0 text-xs text-muted">{r.sub}</span>
            </li>
          );
        })}
      </ul>
      <div className="flex items-center gap-3 border-t border-border px-3 py-2 text-xs text-muted">
        <span className="inline-flex items-center gap-1">
          <span className="kbd">↑</span>
          <span className="kbd">↓</span> move
        </span>
        <span className="inline-flex items-center gap-1">
          <CornerDownLeft className="h-3 w-3" aria-hidden="true" /> open
        </span>
      </div>
    </div>
  );
}

export function CommandSearch({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} onClose={onClose} title="Search APIs" variant="palette" hideTitle>
      <Palette onClose={onClose} />
    </Dialog>
  );
}
