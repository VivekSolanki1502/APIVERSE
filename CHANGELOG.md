# Changelog

All notable changes are documented here. Format based on [Keep a Changelog](https://keepachangelog.com/).

## [Unreleased]

### Changed (UI/UX redesign)
- New design tokens (surface layers, radii, shadows, motion) and a refined dark theme with a complete light theme. The brand mark and favicon were redrawn.
- Homepage: compact hero with a working search, example searches that are verified to return results, and a live preview of the real catalog; verified-only free-tier section, playground preview, working cost calculator, starter collections and contribution section.
- Explore: category chips, active-filter chips, clear-all, sort, grid/list view, a mobile filter sheet, and a result count announced to screen readers.
- Budget Finder: guided three-step brief (project, budget, usage) with live results, “why this result”, limitations, sources and verification per result, an excluded-APIs explanation, a calculator that adapts its inputs to the provider’s billing model, and shareable URLs that contain only the form inputs.
- API details: key facts and documentation/pricing links above the fold, linkable tabs (Overview, Pricing, Code examples, Limitations), pricing history, and a copy-example action.
- Playground: request bar with tabbed params/headers, status pill, timing, body/headers tabs, loading skeleton and Ctrl/⌘+Enter to send. Request safety checks are unchanged (GET only, no proxy, URL validation, redaction).
- Compare: stacked layout on mobile, “differs” markers, a show-only-differences toggle, shareable links and an explicit assumptions section.
- Collections: separate maintainer-curated starter collections (real catalog ids) from the visitor’s own saved data; delete confirmation dialog; toast feedback.
- Added global command search (Ctrl/⌘+K or “/”), toasts, native-dialog overlays, accessible tabs, an error boundary and a route skeleton.
- Added `VITE_REPO_URL`. GitHub links are hidden until a repository URL is configured instead of pointing at a placeholder.

### Fixed
- Unverified pricing is no longer shown as a plain “Free”; badges now read “Free · unverified” until the pricing record is verified.
- Horizontal overflow on narrow screens in Explore.
- Opening a shared `?ids=` comparison link no longer prevents removing APIs from the comparison.


### Added
- Initial release: discovery, API details, Budget Finder with cost calculators (requests, credits, tokens, tiered, data volume, per-user), comparison, browser-side playground with URL safety checks, local favorites and collections, contribution docs, CI.
- Catalog schema v1 with a validator (`npm run validate:catalog`).
- Seed catalog of 34 entries. Pricing for 5 was checked against official pages on 2026-10-12 (Open-Meteo, PokéAPI, GitHub REST API, CoinGecko, openFDA; see each entry's `verificationNotes`); the rest are `needs-review`.
