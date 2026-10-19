import { Link } from 'react-router-dom';

/** Brand mark: an orbit ring with a satellite dot — "verse" as a small system of APIs. */
export function LogoMark({ className = 'h-7 w-7' }: { className?: string }) {
  return (
    <span className={`grid shrink-0 place-items-center rounded-control bg-accent text-accent-fg ${className}`} aria-hidden="true">
      <svg viewBox="0 0 24 24" className="h-[70%] w-[70%]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <circle cx="12" cy="12" r="6.5" opacity="0.9" />
        <circle cx="18" cy="7.5" r="2.2" fill="currentColor" stroke="none" />
      </svg>
    </span>
  );
}

export function Logo() {
  return (
    <Link to="/" className="flex items-center gap-2 rounded-control font-semibold tracking-tight" aria-label="APIverse home">
      <LogoMark />
      <span className="text-[0.95rem]">APIverse</span>
    </Link>
  );
}
