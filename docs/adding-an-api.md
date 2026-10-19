# Adding an API

A step-by-step guide. The authoritative schema is `src/types/catalog.ts`.

## 1. Check it belongs

- It is a documented, publicly reachable HTTP API (or open-source software with an HTTP API).
- It is not already in `src/data/catalog.json` (search by name and base URL).
- You can link its **official documentation**.

## 2. Add the record

Copy the starter record from the `/contribute` page (or any existing entry) and append it to `apis` in `src/data/catalog.json`.

Minimum you must get right:

| Field | Notes |
| --- | --- |
| `id` | lowercase kebab-case, unique (`open-meteo`) |
| `category` | one of the enum values in `types/catalog.ts` |
| `baseUrl`, `documentationUrl`, `officialWebsiteUrl` | valid `http(s)` URLs. `https` must match `baseUrl` |
| `authentication` | `required`, `type`, and where the credential goes if documented |
| `pricing.model` | `free`, `freemium`, `free-trial`, `paid`, `self-hosted` or `contact-sales` |
| `pricing.verificationStatus` | start with `needs-review` unless you complete the verification guide |
| `addedOn` | today's date |

Leave anything you cannot confirm as `null`. Unknown is never zero.

## 3. Optional but valuable

- `sampleRequest` with a documented GET endpoint. This enables the playground and generated code examples. Use placeholders like `YOUR_API_KEY`, never real keys.
- `limitations`: usage restrictions you read in the terms (non-commercial only, attribution, caching rules, fair use).
- `statusPageUrl`.

## 4. Verify pricing (to mark it `verified`)

Follow [pricing-verification.md](pricing-verification.md). In short: check the official pricing page and docs, record what you saw, set `lastVerified` to the actual date, and explain in `verificationNotes`.

## 5. Validate and test

```bash
npm run validate:catalog
npm test
```

## 6. Open a pull request

Fill in the template and link the official pages you used. A maintainer reviews every pull request; nothing is auto-merged.
