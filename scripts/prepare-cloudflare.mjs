import { rm } from 'node:fs/promises';

// Cloudflare Workers Assets handles SPA fallback through wrangler.toml. The
// Pages-specific _redirects rule conflicts with that fallback in Workers.
await rm('dist/_redirects', { force: true });
console.info('prepare-cloudflare: removed the Pages-only _redirects rule from dist/');
