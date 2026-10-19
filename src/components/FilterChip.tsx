import { X } from 'lucide-react';

/** A removable active-filter chip. The remove control is the whole chip. */
export function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <button type="button" className="chip chip-active group" onClick={onRemove} aria-label={`Remove filter: ${label}`}>
      {label}
      <X className="h-3 w-3 opacity-70 group-hover:opacity-100" aria-hidden="true" />
    </button>
  );
}
