import { useEffect, useRef, useState } from 'react';
import { Check, FolderPlus } from 'lucide-react';
import { useCollections } from '../hooks/useLocalData';
import { useToast } from './Toast';

/** Popover for adding the current API to collections. Closes on Escape or an outside click. */
export function CollectionPicker({ apiId }: { apiId: string }) {
  const { collections, create, toggleApi } = useCollections();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const saved = collections.filter((c) => c.apiIds.includes(apiId)).length;

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        button.current?.focus();
      }
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="relative" ref={root}>
      <button ref={button} type="button" className="btn btn-sm" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-haspopup="true">
        <FolderPlus className="h-3.5 w-3.5" aria-hidden="true" /> Add to collection
        {saved > 0 && (
          <span className="inline-flex items-center gap-0.5 text-ok">
            <Check className="h-3 w-3" aria-hidden="true" />
            <span className="text-xs">{saved}</span>
            <span className="sr-only"> saved in {saved} collections</span>
          </span>
        )}
      </button>
      {open && (
        <div className="card absolute left-0 z-20 mt-2 w-72 max-w-[calc(100vw-2rem)] animate-pop-in p-3 shadow-float" role="group" aria-label="Collections">
          {collections.length === 0 && <p className="mb-2 text-sm text-muted">No collections yet. Create one below.</p>}
          <ul className="mb-2 max-h-48 space-y-0.5 overflow-auto">
            {collections.map((c) => (
              <li key={c.id}>
                <label className="flex min-h-9 cursor-pointer items-center gap-2 rounded-control px-1.5 text-sm hover:bg-elevated">
                  <input
                    className="check"
                    type="checkbox"
                    checked={c.apiIds.includes(apiId)}
                    onChange={() => {
                      toggleApi(c.id, apiId);
                      toast.show(c.apiIds.includes(apiId) ? `Removed from “${c.name}”` : `Added to “${c.name}”`, 'info');
                    }}
                  />
                  <span className="truncate">{c.name}</span>
                </label>
              </li>
            ))}
          </ul>
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (!name.trim()) return;
              const c = create(name, [apiId]);
              toast.show(`Created “${c.name}”`);
              setName('');
            }}
          >
            <label htmlFor="new-collection" className="sr-only">
              New collection name
            </label>
            <input id="new-collection" className="input" placeholder="New collection" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} />
            <button className="btn btn-primary" type="submit">
              Create
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
