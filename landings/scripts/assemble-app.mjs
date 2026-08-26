// Merge the Angular app build into the landing `dist/` to produce the single
// distribution the Cloudflare Worker serves.
//
// The landing owns `dist/index.html` (the `/` home). The app is root-mounted, so
// its own `index.html` would clobber the landing home — instead we store it as
// `dist/index.app.html` (the SPA shell the Worker serves for app deep links).
// Angular's hashed JS/CSS and `assets/` do not collide with Astro's `_astro/`.
//
// Run AFTER `astro build` (writes dist/) and the app build (writes browser/).
import { cp, access } from 'node:fs/promises';
import { sep } from 'node:path';

// This template is a single Nx workspace: the app builds to
// <repo-root>/dist/apps/template-app/browser, and landings/ is one level down.
const BROWSER = '../dist/apps/template-app/browser';
const DIST = './dist';

try {
  await access(`${BROWSER}/index.html`);
} catch {
  throw new Error(
    `App build not found at ${BROWSER}/index.html — run the app build first ` +
      `(pnpm run build:app).`,
  );
}

// Copy the app build into dist, but never overwrite the landing's index.html.
await cp(BROWSER, DIST, {
  recursive: true,
  force: true,
  filter: (src) => !src.endsWith(`${sep}index.html`),
});

// The app's index.html becomes the SPA shell served for application deep links.
await cp(`${BROWSER}/index.html`, `${DIST}/index.app.html`, { force: true });

console.log(
  'Assembled Angular app into landing dist (SPA shell: dist/index.app.html).',
);
