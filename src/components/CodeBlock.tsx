import { Check, Copy } from 'lucide-react';
import { useCopy } from '../hooks/useCopy';

interface Props {
  code: string;
  label?: string;
  maxHeightClass?: string;
}

/** Code is always rendered as text (React escapes it); it is never executed or injected as HTML. */
export function CodeBlock({ code, label, maxHeightClass = 'max-h-96' }: Props) {
  const { state, copy } = useCopy();
  return (
    <div className="overflow-hidden rounded-panel border border-border bg-code">
      <div className="flex items-center justify-between border-b border-border bg-elevated/60 px-3 py-1">
        <span className="font-mono text-xs font-medium text-muted">{label ?? 'Code'}</span>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => copy(code)} aria-label={`Copy ${label ?? 'code'}`}>
          {state === 'copied' ? <Check className="h-3.5 w-3.5 text-ok" aria-hidden="true" /> : <Copy className="h-3.5 w-3.5" aria-hidden="true" />}
          <span aria-live="polite">{state === 'copied' ? 'Copied' : state === 'failed' ? 'Copy failed' : 'Copy'}</span>
        </button>
      </div>
      {/* Scrollable region is focusable so keyboard users can scroll long lines. */}
      <pre tabIndex={0} aria-label={`${label ?? 'Code'} (scrollable)`} className={`${maxHeightClass} overflow-auto p-3 font-mono text-[0.8rem] leading-relaxed`}>
        <code>{code}</code>
      </pre>
    </div>
  );
}
