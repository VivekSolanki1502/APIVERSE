# Data verification guide

Pricing accuracy is a core feature. Follow these steps whenever you add, verify or correct an entry.

## 1. Gather official sources

Use only the provider's own:

- pricing page,
- API documentation (rate limits, authentication, quotas),
- terms of service / acceptable use policy.

Record the URLs in `documentationUrl`, `pricing.pricingUrl` and `pricing.termsUrl`.

## 2. Record facts, not impressions

| Field | Rule |
| --- | --- |
| `freeTier.quota` / `unit` / `period` | All three, or `null` if the provider doesn't state a quota |
| `freeTier.available` | `true`, `false`, or `null` if unclear |
| `plans[].monthlyBase` | `0` only if documented as free. `null` if the price isn't published |
| `plans[].billing` | Pick the model the provider actually uses (`requests`, `credits`, `tokens`, `tiered-requests`, `data-volume`, `per-user`). Use `billedInBlocksOf` only if the provider documents block rounding |
| `rateLimits` | A short, faithful summary. Include the scope (per IP, per key) |
| `currency` | The currency the provider quotes, or `null` |
| Trials / credits | Use `model: "free-trial"` and fill `pricing.trial`. Never describe a time-limited trial as free forever |
| Open source / self-hosted | `model: "self-hosted"`. Mention in `limitations` that hosting and maintenance cost money |

## 3. Set the verification fields

- `lastVerified`: the date you checked (YYYY-MM-DD). Not in the future.
- `verificationStatus`:
  - `verified`: everything recorded is confirmed on an official page.
  - `needs-review`: not checked, or key facts unconfirmed.
  - `reported-outdated`: someone reported a change; awaiting re-check.
  - `deprecated`: the API or plan is discontinued.
- `verificationNotes`: say what you checked and what you could not confirm (for example, "page rendered by JavaScript; price not visible").
- Before changing a verified price or quota, append to `history`: `{ "date": "YYYY-MM-DD", "summary": "Basic plan 29 → 35 USD/month" }`.

## 4. Handling uncertainty

- If you cannot confirm something, leave it `null` and keep the entry `needs-review`.
- Do not infer prices from third-party comparison sites.
- Do not scrape pages that prohibit it and do not run automated checks that ignore a provider's rate limits or terms.
- Significant price changes (new price above or below the old by a notable margin, plan removals) need maintainer review in the PR.

## 5. Validate

```bash
npm run validate:catalog
npm test
```

The validator rejects duplicate ids, invalid URLs and dates, invalid enums, contradictory labels (for example `free` with a non-zero plan fee), verified entries without a date or notes, and credential-looking sample values.

## 6. Optional link check

```bash
npm run check:links
```

Checks catalog URLs one at a time with a delay, to be polite to providers. Failures may be temporary or caused by bot protection, so treat them as hints to investigate manually, never as automatic reasons to edit pricing.

## Reporting outdated information

Open an issue with the **Data correction** template, linking to the official page that shows the current value.

## Not provided (yet)

APIverse has no automatic price monitoring or alerts. Do not claim otherwise in docs or UI.
