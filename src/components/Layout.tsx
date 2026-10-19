import { Suspense, useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { GitCompareArrows, Github, Heart, Menu, Moon, Search, Sun, X } from 'lucide-react';
import clsx from 'clsx';
import { useTheme } from '../hooks/useTheme';
import { useCompare, useFavorites } from '../hooks/useLocalData';
import { REPO_URL } from '../lib/site';
import { Logo } from './Logo';
import { CommandSearch } from './CommandSearch';
import { ErrorBoundary } from './ErrorBoundary';
import { PageSkeleton } from './Skeleton';

export { REPO_URL };

const NAV = [
  { to: '/explore', label: 'Explore' },
  { to: '/budget-finder', label: 'Budget Finder' },
  { to: '/playground', label: 'Playground' },
  { to: '/collections', label: 'Collections' },
];
const MORE = [
  { to: '/compare', label: 'Compare' },
  { to: '/favorites', label: 'Favorites' },
];

const isMac = typeof navigator !== 'undefined' && /mac|iphone|ipad/i.test(navigator.platform || navigator.userAgent);

export function Layout() {
  const { theme, toggle } = useTheme();
  const [menu, setMenu] = useState(false);
  const [searching, setSearching] = useState(false);
  const { pathname, hash } = useLocation();
  const compare = useCompare();
  const { favorites } = useFavorites();
  const menuButton = useRef<HTMLButtonElement>(null);

  // Close the mobile menu and reset scroll on navigation.
  useEffect(() => {
    setMenu(false);
    const target = hash ? document.getElementById(decodeURIComponent(hash.slice(1))) : null;
    if (target) target.scrollIntoView();
    else window.scrollTo(0, 0);
  }, [pathname, hash]);

  // Global shortcuts: Ctrl/⌘+K opens search; "/" opens it when not typing in a field.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const typing = !!t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearching(true);
      } else if (e.key === '/' && !typing && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        setSearching(true);
      } else if (e.key === 'Escape' && menu) {
        setMenu(false);
        menuButton.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [menu]);

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    clsx(
      'relative rounded-control px-3 py-2 text-sm font-medium transition-colors duration-150',
      isActive ? 'text-fg after:absolute after:inset-x-3 after:-bottom-[0.8rem] after:h-0.5 after:rounded-full after:bg-accent' : 'text-muted hover:text-fg',
    );
  const mobileLink = ({ isActive }: { isActive: boolean }) =>
    clsx('flex min-h-11 items-center rounded-control border-l-2 px-3 text-sm font-medium', isActive ? 'border-accent bg-accent/10 text-fg' : 'border-transparent text-muted hover:bg-elevated hover:text-fg');

  return (
    <div className="flex min-h-screen flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-50 focus:rounded-control focus:bg-accent focus:px-3 focus:py-2 focus:text-accent-fg">
        Skip to content
      </a>
      <header className="sticky top-0 z-40 border-b border-border bg-bg/85 backdrop-blur">
        <div className="container-page flex h-14 items-center gap-2">
          <Logo />
          <nav aria-label="Primary" className="ml-4 hidden items-center gap-0.5 md:flex">
            {NAV.map((n) => (
              <NavLink key={n.to} to={n.to} className={linkClass}>
                {n.label}
              </NavLink>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-1">
            <button type="button" onClick={() => setSearching(true)} className="hidden min-h-9 w-56 items-center gap-2 rounded-control border border-border bg-surface px-3 text-sm text-muted transition-colors hover:border-border-strong hover:text-fg lg:flex" aria-label="Search APIs" aria-keyshortcuts="Control+K Meta+K /">
              <Search className="h-4 w-4" aria-hidden="true" />
              <span className="flex-1 text-left">Search APIs…</span>
              <span className="kbd">{isMac ? '⌘' : 'Ctrl'} K</span>
            </button>
            <button type="button" onClick={() => setSearching(true)} className="btn btn-ghost btn-icon lg:hidden" aria-label="Search APIs">
              <Search className="h-4 w-4" aria-hidden="true" />
            </button>

            {compare.ids.length > 0 && (
              <Link to="/compare" className="btn btn-sm hidden md:inline-flex" aria-label={`Compare ${compare.ids.length} selected APIs`}>
                <GitCompareArrows className="h-4 w-4" aria-hidden="true" />
                <span>{compare.ids.length}</span>
              </Link>
            )}
            <Link to="/favorites" className="btn btn-ghost btn-icon relative hidden md:inline-flex" aria-label={`Favorites (${favorites.length})`}>
              <Heart className="h-4 w-4" aria-hidden="true" />
              {favorites.length > 0 && <span className="absolute right-1 top-1 grid h-4 min-w-4 place-items-center rounded-full bg-accent px-1 text-[0.6rem] font-semibold text-accent-fg">{favorites.length}</span>}
            </Link>
            {REPO_URL && (
              <a href={REPO_URL} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-icon hidden md:inline-flex" aria-label="APIverse on GitHub (opens in a new tab)">
                <Github className="h-4 w-4" aria-hidden="true" />
              </a>
            )}
            <button type="button" className="btn btn-ghost btn-icon" onClick={toggle} aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}>
              {theme === 'dark' ? <Sun className="h-4 w-4" aria-hidden="true" /> : <Moon className="h-4 w-4" aria-hidden="true" />}
            </button>
            <button ref={menuButton} type="button" className="btn btn-ghost btn-icon md:hidden" onClick={() => setMenu((o) => !o)} aria-expanded={menu} aria-controls="mobile-nav" aria-label={menu ? 'Close menu' : 'Open menu'}>
              {menu ? <X className="h-5 w-5" aria-hidden="true" /> : <Menu className="h-5 w-5" aria-hidden="true" />}
            </button>
          </div>
        </div>
        {menu && (
          <div id="mobile-nav" className="animate-fade-in border-t border-border bg-bg md:hidden">
            <nav aria-label="Mobile" className="container-page flex flex-col gap-1 py-3">
              {[...NAV, ...MORE].map((n) => (
                <NavLink key={n.to} to={n.to} className={mobileLink}>
                  {n.label}
                  {n.to === '/favorites' && favorites.length > 0 && <span className="ml-2 text-xs text-muted">({favorites.length})</span>}
                  {n.to === '/compare' && compare.ids.length > 0 && <span className="ml-2 text-xs text-muted">({compare.ids.length})</span>}
                </NavLink>
              ))}
              {REPO_URL && (
                <a href={REPO_URL} target="_blank" rel="noopener noreferrer" className={mobileLink({ isActive: false })}>
                  <Github className="mr-2 h-4 w-4" aria-hidden="true" /> GitHub
                </a>
              )}
            </nav>
          </div>
        )}
      </header>

      <CommandSearch open={searching} onClose={() => setSearching(false)} />

      <main id="main" className="flex-1" tabIndex={-1}>
        <ErrorBoundary resetKey={pathname}>
          <Suspense fallback={<PageSkeleton />}>
            <Outlet />
          </Suspense>
        </ErrorBoundary>
      </main>

      <footer className="mt-16 border-t border-border">
        <div className="container-page grid gap-8 py-10 sm:grid-cols-2 lg:grid-cols-4">
          <div className="lg:col-span-1">
            <Logo />
            <p className="mt-3 max-w-xs text-sm text-muted">Discover. Compare. Test. Budget. Build. An open-source API discovery and budget platform.</p>
          </div>
          <nav aria-label="Product" className="text-sm">
            <h2 className="mb-2 font-semibold">Product</h2>
            <ul className="space-y-1.5 text-muted">
              {[...NAV, ...MORE].map((n) => (
                <li key={n.to}>
                  <Link className="hover:text-fg" to={n.to}>
                    {n.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <nav aria-label="Documentation" className="text-sm">
            <h2 className="mb-2 font-semibold">Documentation</h2>
            <ul className="space-y-1.5 text-muted">
              <li>
                <Link className="hover:text-fg" to="/contribute">
                  Contributing &amp; data guide
                </Link>
              </li>
              <li>
                <Link className="hover:text-fg" to="/about">
                  About &amp; methodology
                </Link>
              </li>
              <li>
                <Link className="hover:text-fg" to="/privacy">
                  Privacy
                </Link>
              </li>
            </ul>
          </nav>
          <nav aria-label="Project" className="text-sm">
            <h2 className="mb-2 font-semibold">Project</h2>
            <ul className="space-y-1.5 text-muted">
              {REPO_URL && (
                <li>
                  <a className="inline-flex items-center gap-1.5 hover:text-fg" href={REPO_URL} target="_blank" rel="noopener noreferrer">
                    <Github className="h-3.5 w-3.5" aria-hidden="true" /> GitHub repository
                  </a>
                </li>
              )}
              <li>
                {REPO_URL ? (
                  <a className="hover:text-fg" href={`${REPO_URL}/blob/main/LICENSE`} target="_blank" rel="noopener noreferrer">
                    MIT License
                  </a>
                ) : (
                  'MIT License'
                )}
              </li>
            </ul>
          </nav>
        </div>
      </footer>
    </div>
  );
}
