// Post-build step for static hosting.
// - GitHub Pages has no SPA fallback, but serves 404.html for unknown paths, so we copy index.html.
// - Cloudflare Pages uses public/_redirects (already copied by Vite).
import { copyFileSync, existsSync } from 'node:fs';

if (existsSync('dist/index.html')) {
  copyFileSync('dist/index.html', 'dist/404.html');
  console.log('postbuild: wrote dist/404.html (GitHub Pages SPA fallback)');
} else {
  console.error('postbuild: dist/index.html not found — did the build fail?');
  process.exit(1);
}
