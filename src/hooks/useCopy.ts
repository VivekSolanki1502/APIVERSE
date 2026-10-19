import { useCallback, useEffect, useRef, useState } from 'react';

/** Clipboard write that reports success instead of throwing (blocked in some contexts). */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/** Copy text to the clipboard with visible, time-limited feedback. */
export function useCopy(resetMs = 1800) {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const timer = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => () => clearTimeout(timer.current), []);
  const copy = useCallback(
    async (text: string) => {
      const ok = await copyToClipboard(text);
      setState(ok ? 'copied' : 'failed');
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setState('idle'), resetMs);
      return ok;
    },
    [resetMs],
  );
  return { state, copy };
}

/** Absolute URL for an in-app path, respecting the deploy base path. */
export function absoluteUrl(pathAndQuery: string): string {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  return `${window.location.origin}${base}${pathAndQuery}`;
}
