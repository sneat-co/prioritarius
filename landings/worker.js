// Edge router for the single product origin.
//
//   reserved public path -> landing (static asset, or its own 404)
//   everything else       -> root-mounted Angular SPA (index.app.html shell)
//
// The landing owns `/` (index.html); the Angular app is mounted at the root and
// its SPA shell is stored as index.app.html so the two never collide. See
// backstage ADR 0001 and sneat-libs docs/extension-standards/routing-and-deployment.md.
//
// Canonical reserved-path contract: @sneat/core reserved-public-path.ts. Inlined
// here to keep this Worker dependency-free — KEEP IN SYNC with that source.

// Locale codes whose /{locale}/* subtree is landing content. Explicit list, NOT
// "any two-letter segment": /my (the personal dashboard) is also two letters and
// must stay an application route. Add locales as the landing publishes them.
//
// KEEP IN SYNC with `langs` in src/i18n/languages.ts. A locale that ships there
// but is missing here does NOT 404 — it falls through to the SPA and answers 200
// with the app shell, so the landing looks "deployed" while being unreachable.
// That is the single easiest way to break this landing, and it hides well.
const RESERVED_LOCALES = ['en', 'ru'];

function isReservedPublicPath(pathname) {
  let p = pathname || '/';
  if (p.length > 1 && p.endsWith('/')) p = p.replace(/\/+$/, '') || '/';
  if (p === '/') return true;
  if (RESERVED_LOCALES.includes(p.split('/')[1])) return true;
  if (p === '/static' || p.startsWith('/static/')) return true;
  if (p === '/.well-known' || p.startsWith('/.well-known/')) return true;
  if (p === '/robots.txt') return true;
  if (/^\/sitemap[-\w]*\.xml$/.test(p)) return true;
  if (p === '/favicon.ico' || p === '/favicon.svg') return true;
  if (p === '/manifest.webmanifest') return true;
  return false;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const p = url.pathname;

    // Legacy /pwa/* backward compatibility -> root-mounted route (permanent).
    // Remove once no old /pwa/* links remain.
    if (p === '/pwa' || p.startsWith('/pwa/')) {
      url.pathname = p.slice('/pwa'.length) || '/';
      return Response.redirect(url.toString(), 301);
    }

    // English is the default locale and its home is the bare root, so `/en/` is
    // a duplicate front door rather than a page: 301 it to `/`. Only the locale
    // INDEX folds away — `/en/privacy` stays the canonical English URL and keeps
    // its prefix, because that prefix is what separates landing space from the
    // root-mounted app.
    if (p === '/en' || p === '/en/') {
      url.pathname = '/';
      return Response.redirect(url.toString(), 301);
    }

    // Unprefixed legal pages are what people type and what other sites link to.
    // Without this they'd miss every asset and fall through to the app shell —
    // answering 200 with an Angular bundle where a human expected a policy.
    // Send them to the default locale's copy.
    const LEGAL = ['/privacy', '/terms'];
    const bare = p.length > 1 ? p.replace(/\/+$/, '') : p;
    if (LEGAL.includes(bare)) {
      url.pathname = `/en${bare}`;
      return Response.redirect(url.toString(), 301);
    }

    // Serve a matching static asset: landing pages + the app's JS/CSS/assets.
    const res = await env.ASSETS.fetch(request);
    if (res.status !== 404) return res;

    // Asset miss. Reserved public space never falls back to the app shell — a
    // missing landing page or static file 404s as itself.
    if (isReservedPublicPath(p)) return res;

    // Application deep link (e.g. /space/..., /my, /login) -> serve the Angular
    // SPA shell as 200 at the REQUESTED url, following any html_handling redirect
    // (Cloudflare Assets rewrites `/index.app.html` -> `/index.app`) so the deep
    // link keeps its URL instead of bouncing the browser to the shell path.
    const shellUrl = new URL('/index.app.html', url.origin);
    let shell = await env.ASSETS.fetch(new Request(shellUrl, request));
    if (shell.status >= 301 && shell.status <= 308) {
      const loc = shell.headers.get('location');
      if (loc) {
        shell = await env.ASSETS.fetch(
          new Request(new URL(loc, url.origin), request),
        );
      }
    }
    return new Response(shell.body, { status: 200, headers: shell.headers });
  },
};
