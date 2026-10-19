import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

/**
 * Collapsible JSON tree. Every value is rendered as escaped text. Depth and breadth are capped
 * so a hostile or huge response cannot freeze the page.
 */
const MAX_DEPTH = 12;
const MAX_ITEMS = 200;

function Primitive({ value }: { value: unknown }) {
  if (value === null) return <span className="text-muted">null</span>;
  if (typeof value === 'string') return <span className="break-all text-ok">{JSON.stringify(value.length > 2000 ? `${value.slice(0, 2000)}…` : value)}</span>;
  if (typeof value === 'number') return <span className="text-accent">{String(value)}</span>;
  if (typeof value === 'boolean') return <span className="text-warn">{String(value)}</span>;
  return <span>{String(value)}</span>;
}

function Node({ name, value, depth, defaultOpen, force }: { name?: string; value: unknown; depth: number; defaultOpen: boolean; force: boolean | null }) {
  const [open, setOpen] = useState(force ?? defaultOpen);
  const isArr = Array.isArray(value);
  const isObj = typeof value === 'object' && value !== null;
  const label = name !== undefined ? <span className="text-fg">{isArr ? name : JSON.stringify(name)}: </span> : null;

  if (!isObj) {
    return (
      <div className="pl-4">
        {label}
        <Primitive value={value} />
      </div>
    );
  }
  if (depth >= MAX_DEPTH) return <div className="pl-4 text-muted">{label}… (max depth)</div>;

  const entries = isArr ? (value as unknown[]).map((v, i) => [String(i), v] as const) : Object.entries(value as Record<string, unknown>);
  const shown = entries.slice(0, MAX_ITEMS);
  const [openCh, closeCh] = isArr ? ['[', ']'] : ['{', '}'];

  return (
    <div className="pl-4">
      <button type="button" className="inline-flex items-center gap-1 rounded text-left hover:text-accent" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        {open ? <ChevronDown className="h-3 w-3" aria-hidden="true" /> : <ChevronRight className="h-3 w-3" aria-hidden="true" />}
        {label}
        <span className="text-muted">
          {openCh}
          {!open && ` ${entries.length} ${isArr ? 'items' : 'keys'} `}
          {!open && closeCh}
        </span>
      </button>
      {open && (
        <>
          <div className="ml-1.5 border-l border-border">
            {shown.map(([k, v]) => (
              <Node key={k} name={k} value={v} depth={depth + 1} defaultOpen={depth < 1} force={force} />
            ))}
            {entries.length > MAX_ITEMS && <div className="pl-4 text-muted">… {entries.length - MAX_ITEMS} more not shown</div>}
          </div>
          <div className="pl-0 text-muted">{closeCh}</div>
        </>
      )}
    </div>
  );
}

export function JsonViewer({ value }: { value: unknown }) {
  // `force` + `nonce` remount the tree so "expand all / collapse all" applies to every node.
  const [force, setForce] = useState<boolean | null>(null);
  const [nonce, setNonce] = useState(0);
  const apply = (f: boolean) => {
    setForce(f);
    setNonce((n) => n + 1);
  };
  return (
    <div className="overflow-hidden rounded-panel border border-border bg-code">
      <div className="flex items-center gap-1 border-b border-border bg-elevated/60 px-2 py-1">
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => apply(true)}>
          Expand all
        </button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => apply(false)}>
          Collapse all
        </button>
      </div>
      <div tabIndex={0} role="region" aria-label="JSON response (scrollable)" className="max-h-[32rem] overflow-auto p-3 font-mono text-[0.8rem] leading-relaxed">
        <Node key={nonce} value={value} depth={0} defaultOpen force={force} />
      </div>
    </div>
  );
}
