import { useEffect } from 'react';

const DEFAULT_TITLE = 'APIverse — Discover. Compare. Test. Budget. Build.';
const DEFAULT_DESC = 'Open-source API discovery, comparison, testing and budget planning for developers.';

function setMeta(selector: string, attr: 'name' | 'property', key: string, value: string) {
  let el = document.head.querySelector<HTMLMetaElement>(selector);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', value);
}

/** Sets the document title and, optionally, the description and social-preview text. */
export function useMeta(title: string, description?: string) {
  useEffect(() => {
    const full = title ? `${title} · APIverse` : DEFAULT_TITLE;
    const desc = description ?? DEFAULT_DESC;
    document.title = full;
    setMeta('meta[name="description"]', 'name', 'description', desc);
    setMeta('meta[property="og:title"]', 'property', 'og:title', full);
    setMeta('meta[property="og:description"]', 'property', 'og:description', desc);
    setMeta('meta[name="twitter:title"]', 'name', 'twitter:title', full);
    setMeta('meta[name="twitter:description"]', 'name', 'twitter:description', desc);
  }, [title, description]);
}

export function useTitle(title: string) {
  useMeta(title);
}
