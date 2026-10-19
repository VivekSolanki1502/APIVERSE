# Security Policy

## Reporting a vulnerability

Please **do not** open a public issue for security problems.

Use your repository host's private vulnerability reporting (on GitHub: **Security → Report a vulnerability**). Maintainers: before publishing, enable private reporting and/or add a security contact email here.

Please include: affected route or file, reproduction steps, impact, and any suggested fix. We aim to acknowledge reports within a few days and will credit reporters who want credit.

## Scope and design notes

APIverse is a static site with no backend, accounts or database. Relevant security properties:

- **Playground**: requests are made from the user's browser. Only `http(s)` URLs are allowed; localhost, private, link-local, carrier-grade NAT, multicast and cloud-metadata destinations are blocked; URLs with embedded credentials are rejected; cookies are not sent (`credentials: "omit"`); responses are rendered as escaped text and never executed.
- **No proxy**: there is intentionally no server-side fetching. If one is ever added it must block private ranges after DNS resolution, re-check every redirect, and defend against DNS rebinding.
- **Secrets**: API keys and authorization headers are never persisted, logged or placed in URLs. The catalog validator rejects credential-looking values in sample requests.
- **Imports**: collection files and share links are size-limited and schema-validated; unknown ids are discarded.
- **Content**: catalog data is rendered through React's escaping; no `dangerouslySetInnerHTML`.

A client-side URL check cannot fully stop a user from entering a hostname that resolves to a private address (DNS-based). Because requests originate from the user's own browser and network, the exposure is limited to the user themself; keep this in mind before adding any server-side feature.

## Supported versions

Only the latest release on `main` is supported.
