import type { Ref } from 'react';
import clsx from 'clsx';
import { Search, X } from 'lucide-react';

interface Props {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  size?: 'md' | 'lg';
  inputRef?: Ref<HTMLInputElement>;
  className?: string;
}

/** Search input with an always-labelled field and an accessible clear button. */
export function SearchField({ id, label, value, onChange, placeholder, size = 'md', inputRef, className }: Props) {
  return (
    <div className={clsx('relative', className)}>
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <Search className={clsx('pointer-events-none absolute top-1/2 -translate-y-1/2 text-muted', size === 'lg' ? 'left-3.5 h-5 w-5' : 'left-3 h-4 w-4')} aria-hidden="true" />
      <input
        id={id}
        ref={inputRef}
        type="search"
        enterKeyHint="search"
        autoComplete="off"
        spellCheck={false}
        className={clsx('input [&::-webkit-search-cancel-button]:hidden', size === 'lg' ? 'min-h-12 pl-11 pr-10 text-base' : 'pl-9 pr-9')}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {value && (
        <button type="button" className="btn btn-ghost btn-icon btn-sm absolute right-1 top-1/2 -translate-y-1/2" onClick={() => onChange('')} aria-label="Clear search">
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
