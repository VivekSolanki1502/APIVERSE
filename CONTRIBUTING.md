# Contributing to APIverse

Thanks for helping! Accuracy matters more than volume. One verified entry is worth more than ten guesses.

## Quick path: add or fix an API

1. **Fork** the repository and create a branch: `git checkout -b add-<api-id>`.
2. Edit `src/data/catalog.json` (add a record, or correct an existing one).
3. Include the **official documentation URL**, and the **official pricing and terms URLs** when they exist.
4. Run `npm run validate:catalog`. Fix every error.
5. Run `npm test`.
6. Open a **pull request** using the template. A maintainer reviews every change; nothing is auto-merged.

## Development setup

```bash
npm install
npm run dev
npm run check   # format, lint, types, catalog, tests, build
```

Node.js 20+ is required. No accounts or paid services are needed.

## Catalog schema (summary)

The authoritative definition is `src/types/catalog.ts`; rules are enforced by `src/lib/validateCatalog.ts`.

- `id`: lowercase kebab-case, unique.
- `category`: one of the values in `CATEGORIES`.
- `authentication`: `{ required, type, location, parameterName }`. `parameterName` is a name such as `x-api-key`, never a secret.
- `https` must agree with `baseUrl`.
- `corsStatus`: leave `unknown` unless you tested a browser call (say how in your PR).
- `pricing.model`: `free | freemium | free-trial | paid | self-hosted | contact-sales`. Labels must not contradict `freeTier` or `plans`.
- Unknown numbers and strings are `null`. **Unknown is never zero.**
- `sampleRequest`: documented endpoint only; credentials are placeholders like `YOUR_API_KEY`.

## Pricing evidence requirements

- Source: the provider's own pricing page, documentation or terms. Blog posts, forums and third-party comparisons are not evidence.
- `lastVerified` is the date you actually checked. Do not backdate, forward-date or auto-fill it.
- `verificationStatus: "verified"` requires: a `lastVerified` date, an official URL, and `verificationNotes` stating what you checked.
- If a value could not be confirmed (JavaScript-only page, price not listed), record `null` and say so in `verificationNotes`. Keep the entry `needs-review` if key facts are unconfirmed.
- When a price or quota changes, add a `history` entry (`{ "date", "summary" }`) before overwriting.
- Never scrape pages that forbid it, and do not paste large amounts of provider text. Summarize.

See [docs/pricing-verification.md](docs/pricing-verification.md) for the step-by-step guide.

## Coding standards

- TypeScript `strict`; no `any` without a comment explaining why.
- Keep logic in `src/lib` as pure functions with unit tests. UI stays thin.
- Treat all external data (catalog edits, imports, URL params, API responses) as untrusted. Never render it as HTML.
- Never store secrets in `localStorage`, URLs or logs.
- Accessibility: labelled controls, visible focus, keyboard operable, respect `prefers-reduced-motion`.
- Prettier and ESLint must pass (`npm run format`, `npm run lint`).

## Branches and pull requests

- Branch from `main`; keep PRs focused (one API or one fix when possible).
- Commit messages: imperative, concise (`Add Open-Meteo pricing verification`).
- Fill in the PR template, including evidence links for any pricing change.
- CI must pass. A maintainer reviews before merge.

## Testing

- `npm test` runs Vitest. Add tests for any logic change (calculators need tests for each billing model they touch).
- Catalog-only changes must pass `npm run validate:catalog`.

## Beginner-friendly tasks

Look for the **good first issue** label. Ideas:

- Verify one `needs-review` entry against its official pricing page and promote it.
- Record the free-tier quota for an entry with `"quota": null` when the provider documents it.
- Test whether an API sends CORS headers for browser requests and update `corsStatus` with notes.
- Add a missing `statusPageUrl`.
- Improve an error message or add a test.

## Labels

`good first issue`, `help wanted`, `bug`, `enhancement`, `pricing verification`, `data-correction`, `new-api`, `documentation`, `security`.

## Reporting security problems

Do not open a public issue. Follow [SECURITY.md](SECURITY.md).

## Code of conduct

By participating you agree to the [Code of Conduct](CODE_OF_CONDUCT.md).
