# Deployment

APIverse has a static frontend and an optional API backend. The frontend can still be deployed without the backend, but online collection sharing, API suggestions and correction reports require it. Check each host's current limits and terms before deploying.

## Build settings

| Setting | Value |
| --- | --- |
| Install command | `npm ci` |
| Build command | `npm run build` |
| Output directory | `dist` |
| Node.js | 22.13 or newer |
| Environment variables | `VITE_API_BASE_URL` for the backend origin; `BASE_PATH` for sub-path hosting (below) |

## Backend service

Deploy the API as a separate Node service from the same repository:

- Build command: `npm ci && npm run backend:build`
- Start command: `npm run backend:start`
- Runtime: Node.js 22.13 or newer (uses the built-in `node:sqlite` module)
- Set `HOST=0.0.0.0`, `PORT` to the platform's assigned port, and `CORS_ORIGINS` to the exact frontend origin(s), comma-separated.
- Mount persistent storage and set `DATABASE_PATH` to a writable SQLite file on that volume. Back up this file; it contains online collections, reports and pending suggestions.
- `CATALOG_PATH` can point at a catalog JSON file when it is not at `src/data/catalog.json` relative to the service working directory.
- `/health` checks the process, `/ready` also checks SQLite, and `/docs` serves the OpenAPI UI.
- Set `VITE_API_BASE_URL` to the deployed backend origin when building the frontend. The local Vite proxy is only for development.

The backend has no accounts or moderation dashboard. Anyone may create a public share or submit suggestions/reports; submissions remain pending until reviewed outside the application. Use HTTPS and monitor/backup the persistent database.

## Client-side routing

Direct links such as `/api/open-meteo` must work on refresh, so the host must serve `index.html` for unknown paths.

### Cloudflare Pages

1. Create a Pages project from your repository.
2. Set the build command and output directory above.
3. `public/_redirects` (`/* /index.html 200`) is copied into `dist/` and provides the SPA fallback. Set `VITE_API_BASE_URL` at build time if using a separately hosted backend.

### GitHub Pages

GitHub Pages has no rewrite rules, but serves `404.html` for unknown paths. `npm run build` copies `index.html` to `dist/404.html` for that purpose.

- **User/organization site or custom domain** (`https://example.github.io/` or your domain): build with defaults.
- **Project site** (`https://<user>.github.io/<repo>/`): build with `BASE_PATH=/<repo>/ npm run build`. The router reads Vite's base URL automatically.

The 404.html fallback makes pages load with a `404` HTTP status, which is fine for users but not ideal for search engines. Prefer Cloudflare Pages if SEO for detail pages matters.

Example GitHub Actions deploy job (optional, add to your own workflow):

```yaml
- uses: actions/upload-pages-artifact@v3
  with: { path: dist }
- uses: actions/deploy-pages@v4
```

## Before you go live

- Set `VITE_REPO_URL` (see `.env.example`) to your public GitHub URL, for example `https://github.com/owner/apiverse`. While it is unset, APIverse hides all GitHub links and the pre-filled issue link rather than pointing at a placeholder.
- Social previews: `public/og-image.png` (1200×630) is included, but most networks need an absolute URL. Set `og:image` in `index.html` to `https://<your-origin>/og-image.png` and add a `<link rel="canonical">` once the origin is known. The app is client-rendered, so per-page titles and descriptions are set at runtime and are not seen by crawlers that do not run JavaScript.
- Enable private vulnerability reporting and add a security contact to `SECURITY.md`.
