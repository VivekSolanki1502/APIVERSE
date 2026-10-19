import { useEffect, useRef, type ReactNode } from 'react';
import clsx from 'clsx';
import { X } from 'lucide-react';

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  /** modal: centred · sheet: bottom sheet (mobile filters) · palette: top-anchored search */
  variant?: 'modal' | 'sheet' | 'palette';
  /** Hide the visible heading (the title still labels the dialog for screen readers). */
  hideTitle?: boolean;
  children: ReactNode;
}

/**
 * Uses the native <dialog> element: the browser provides the focus trap, Escape to close, inert
 * background and focus restoration. Children are only mounted while open, so state resets.
 */
export function Dialog({ open, onClose, title, variant = 'modal', hideTitle, children }: Props) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      if (typeof d.showModal === 'function') d.showModal();
      else d.setAttribute('open', '');
    }
    if (!open && d.open) d.close();
    document.documentElement.classList.toggle('dialog-open', open);
    return () => document.documentElement.classList.remove('dialog-open');
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-label={title}
      className={clsx('overlay', variant === 'sheet' && 'overlay-sheet', variant === 'palette' && 'overlay-palette')}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {open && (
        <div className="flex max-h-[inherit] flex-col">
          {!hideTitle && (
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <h2 className="text-base font-semibold">{title}</h2>
              <button type="button" className="btn btn-ghost btn-icon btn-sm" onClick={onClose} aria-label="Close">
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          )}
          {children}
        </div>
      )}
    </dialog>
  );
}
