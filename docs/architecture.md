# Architecture

APIverse is a single-page frontend with an optional Fastify API. Catalog browsing, search, comparison, budgeting and playground requests run in the browser from a version-controlled JSON catalog. The backend stores public share records, pending API suggestions and correction reports in SQLite. There are no user accounts.

## Layers

```
catalog.json ──► lib/catalog ──► lib/* (pure logic) ──► hooks ──► components / pages
                                   ▲
                      tests run against lib/* directly

Browser ──► /api/v1/* ──► Fastify ──► SQLite (shares, suggestions, reports)
```

| Directory | Responsibility |
| --- | --- |
| `src/data/catalog.json` | The data. Schema version 1. Edited by contributors via pull request |
| `src/types/catalog.ts` | Strict TypeScript types and allowed enum values |
| `src/lib/validateCatalog.ts` | Runtime validation used by the CLI, tests and CI |
| `src/lib/search.ts` | Accent-insensitive weighted search, filters, sorting, pagination, URL ⇄ state |
| `src/lib/cost.ts` | One calculator per billing model; returns a breakdown or "cannot estimate" |
| `src/lib/budget.ts` | Transparent scoring for the Budget Finder; separates verified from needs-review |
| `src/lib/request.ts` | Playground URL safety checks, header sanitizing, redaction, request execution, error explanations |
| `src/lib/examples.ts` | cURL / JavaScript / Python generators |
| `src/lib/collections.ts` | Collection model, safe import/export, share links |
| `src/lib/store.ts`, `storage.ts` | localStorage-backed stores that tolerate blocked or corrupt storage |
| `src/hooks/` | React bindings (theme, favorites, collections, compare, clipboard) |
| `src/components/`, `src/pages/` | UI; pages are lazy-loaded per route |
| `src/lib/backend.ts` | Typed clients for online shares, API suggestions and correction reports |
| `backend/src/app.ts` | Fastify routes, validation, rate limits and OpenAPI docs |
| `backend/src/database.ts` | SQLite persistence for online shares and community submissions |
| `backend/tests/` | HTTP integration tests using an in-memory database |
| `scripts/` | `validate-catalog.ts`, `check-links.ts`, `postbuild.mjs` |

### Deviations from the suggested layout

- Logic lives in `src/lib/` rather than per-feature folders (`features/discovery`, …). The features share the same catalog and pure helpers, so one flat, well-tested `lib` avoids duplication. Move to `features/` if a feature grows its own components, state and tests.
- One `catalog.json` holds the data; categories are an enum in `types/catalog.ts` so the validator and UI cannot drift apart.
- `.env.example` documents the optional backend origin, local API proxy and repository link settings.

## Key design decisions

1. **Unknown is not zero.** Unknown values are `null` in the schema. Calculators return `{ ok: false }`; the UI shows "Cannot estimate reliably".
2. **Verified vs unverified is structural.** The Budget Finder returns two lists. Unverified records cannot enter the "recommended" list.
3. **No provider proxy.** The playground calls API providers directly from the browser, so CORS is enforced by the browser and APIverse never sees those requests or credentials. The backend only handles APIverse's catalog-adjacent records; it does not fetch user-supplied provider URLs.
4. **Untrusted data everywhere.** Catalog edits, imports, URL params, share links and API responses are validated and rendered as escaped text; there is no `dangerouslySetInnerHTML`.
5. **Local personal state, public shares.** Favorites and editable collections stay in `localStorage`. Publishing creates a server-side read-only collection reachable by an unguessable id. The name and API ids are public to anyone with the link.

## Testing approach

Pure logic in `src/lib` carries most behavior, so most tests are fast unit tests (`*.test.ts`). Component and routing tests with React Testing Library belong in `src/pages/*.test.tsx`; none are written yet (see Known limitations in the README).
