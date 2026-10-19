import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AlertCircle, CheckCircle2, Info } from 'lucide-react';

type Kind = 'success' | 'error' | 'info';
interface Item {
  id: number;
  message: string;
  kind: Kind;
}
interface Api {
  show: (message: string, kind?: Kind) => void;
}

const Ctx = createContext<Api>({ show: () => {} });
export const useToast = () => useContext(Ctx);

const ICON = { success: CheckCircle2, error: AlertCircle, info: Info } as const;
const TONE = { success: 'text-ok', error: 'text-danger', info: 'text-accent' } as const;

/** Polite live region + short-lived messages. Nothing here blocks interaction. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Item[]>([]);
  const next = useRef(1);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: number) => {
    clearTimeout(timers.current.get(id));
    timers.current.delete(id);
    setItems((all) => all.filter((t) => t.id !== id));
  }, []);

  const show = useCallback(
    (message: string, kind: Kind = 'success') => {
      const id = next.current++;
      setItems((all) => [...all.slice(-2), { id, message, kind }]);
      timers.current.set(id, setTimeout(() => dismiss(id), kind === 'error' ? 6000 : 3000));
    },
    [dismiss],
  );

  useEffect(() => {
    const t = timers.current;
    return () => t.forEach((x) => clearTimeout(x));
  }, []);

  const api = useMemo(() => ({ show }), [show]);

  return (
    <Ctx.Provider value={api}>
      {children}
      <div role="status" aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex flex-col items-center gap-2 px-4">
        {items.map((t) => {
          const Icon = ICON[t.kind];
          return (
            <div key={t.id} className="pointer-events-auto flex max-w-sm animate-slide-up items-center gap-2 rounded-panel border border-border-strong bg-elevated px-3.5 py-2.5 text-sm shadow-float">
              <Icon className={`h-4 w-4 shrink-0 ${TONE[t.kind]}`} aria-hidden="true" />
              <span>{t.message}</span>
            </div>
          );
        })}
      </div>
    </Ctx.Provider>
  );
}
