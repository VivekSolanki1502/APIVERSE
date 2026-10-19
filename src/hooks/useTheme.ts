import { useCallback, useEffect, useState } from 'react';
import { KEYS } from '../lib/storage';

export type Theme = 'dark' | 'light';

function current(): Theme {
  return document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
}

/** Dark is the default. The inline script in index.html applies the saved theme before paint. */
export function useTheme() {
  const [theme, setTheme] = useState<Theme>(current);
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    try {
      localStorage.setItem(KEYS.theme, theme);
    } catch {
      /* storage unavailable: theme still applies for this session */
    }
  }, [theme]);
  const toggle = useCallback(() => setTheme((t) => (t === 'dark' ? 'light' : 'dark')), []);
  return { theme, toggle };
}
