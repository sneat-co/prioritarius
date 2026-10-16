// Merge the Angular app build into the landing `dist/` to produce the single
// distribution Cloudflare static assets serve (no Worker script).
//
// The Angular app is root-mounted and owns `dist/index.html`: it is the SPA
// shell that assets.not_found_handling "single-page-application" serves (200,
// URL kept) for every path without a file, so no route list is needed. The
// landing home Astro wrote as `dist/index.html` moves to `dist/landing.html`,
// and public/_redirects rewrites exactly `/` to `/landing`.
// Angular's hashed JS/CSS and `assets/` do not collide with Astro's `_astro/`.
//
// Run AFTER `astro build` (writes dist/) and the app build (writes browser/).
import { access, cp, readFile, rename } from 'node:fs/promises';
import { sep } from 'node:path';

// This template is a single Nx workspace: the app builds to
// <repo-root>/dist/apps/prioritarius-app/browser, and landings/ is one level down.
const BROWSER = '../dist/apps/prioritarius-app/browser';
const DIST = './dist';

try {
  await access(`${BROWSER}/index.html`);
} catch {
  throw new Error(
    `App build not found at ${BROWSER}/index.html — run the app build first ` +
      `(pnpm run build:app).`,
  );
}

// Assemble exactly once per astro build: a second run would move the app shell
// over the landing home.
let home;
try {
  home = await readFile(`${DIST}/index.html`, 'utf8');
} catch {
  throw new Error(
    `Landing home not found at ${DIST}/index.html — run astro build first.`,
  );
}
if (home === (await readFile(`${BROWSER}/index.html`, 'utf8'))) {
  throw new Error(
    `${DIST}/index.html is already the app shell — rerun astro build first.`,
  );
}

// The landing home leaves the root index.html to the app shell. `landing.html`
// is served at `/landing` (html_handling), the `/` rewrite target in
// public/_redirects; its canonical URL stays `/`.
await rename(`${DIST}/index.html`, `${DIST}/landing.html`);

// Copy the app build into dist without any index.html (a nested one could
// shadow a landing page), then place the app's root index.html: the SPA shell.
await cp(BROWSER, DIST, {
  recursive: true,
  force: true,
  filter: (src) => !src.endsWith(`${sep}index.html`),
});
await cp(`${BROWSER}/index.html`, `${DIST}/index.html`, { force: true });

console.log(
  'Assembled Angular app into landing dist (SPA shell: dist/index.html, ' +
    'landing home: dist/landing.html).',
);
