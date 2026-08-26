# Hosting the landing site (`landings/`)

The `landings/` directory is a static **Astro** marketing site, deployed to
**Cloudflare** (Workers static assets) at your product's apex domain. It is the
public, crawlable front door. The signed-in Angular app is **mounted at the root
of the same origin** (not a subdomain — so the landing can read the Firebase auth
session and show the signed-in user), and a small Cloudflare **Worker** routes
each request to either the landing or the app. See
[Routing model](#routing-model).

This follows the Sneat **site-hosting-pattern** — the canonical spec lives in
[`backstage/spec/features/site-hosting-pattern`](https://github.com/sneat-co/backstage/blob/main/spec/features/site-hosting-pattern/README.md).
Reference implementations built from this exact scaffold:
[`surpriseless`](https://github.com/sneat-co/surpriseless/tree/main/landings) and
[`requoter`](https://github.com/sneat-co/requoter/tree/main/landings).

---

## Local development

```sh
cd landings
pnpm install
pnpm dev                # Astro dev server (landing pages only)
pnpm run build:landing  # just the Astro landing  -> landings/dist
pnpm build              # combined build: landing + Angular app -> landings/dist
npx wrangler dev        # preview the REAL routing (landing + app) locally
```

`pnpm build` also builds the Angular app (`nx build <id>-app --base-href=/`) and
merges it into `landings/dist` via `scripts/assemble-app.mjs`, so it needs the
repo-root workspace deps installed (`pnpm install` at the repo root), not just
`landings/`. Preview with `wrangler dev` rather than `astro preview` — only the
Worker reproduces the landing/app split and the SPA-shell fallback.

---

## First-time Cloudflare setup

### 1. Prerequisite: the domain must be a zone in the Cloudflare account

The apex domain (e.g. `myproduct.com`) has to already exist as an **active
zone** in the Sneat Cloudflare account (domain registered + nameservers pointing
at Cloudflare). If it isn't, add it in the dashboard first.

### 2. Set your domain in three places

The scaffold ships with `example.com` placeholders. Replace them with your apex:

| File | Field |
|------|-------|
| `landings/astro.config.mjs` | `site: "https://myproduct.com"` |
| `landings/wrangler.jsonc` | the `routes[].pattern` custom-domain entry |
| `landings/public/robots.txt` | the `Sitemap:` line |

The worker `name` in `wrangler.jsonc` is `template` and is renamed to your
extension id by `customize.sh`.

### 3. Attach the apex as a Cloudflare Custom Domain

The worker serves the apex via a Cloudflare **Custom Domain** (Cloudflare
manages a proxied DNS record + TLS cert for it). There are two ways to create
it — **the permission matters** (see [Token scopes](#token-scopes--permissions)):

- **Dashboard (simplest):** Workers & Pages → your worker → **Settings → Domains
  & Routes → Add → Custom Domain** → add your apex. Cloudflare creates the DNS
  record + cert.
- **CLI / API:** `wrangler deploy` will attempt to attach the `custom_domain`
  routes from `wrangler.jsonc` — **but only if the deploy token has
  `Zone:DNS:Edit`.** A plain OAuth / `workers`-only token **cannot** create a
  custom domain (it fails at the `.../domains/records` step). Either run the
  one-time attach in the dashboard, or use a DNS-scoped token.

### 4. Deploy — via the GitHub Action (the normal way)

**Deploys run in CI, not from your laptop.** Trigger the **"Deploy landings +
app (Cloudflare)"** Action (`.github/workflows/deploy-landings.yml`,
`workflow_dispatch`). It calls the shared `sneat-co/cicd` reusable workflow with
**org-level** Cloudflare credentials — `CLOUDFLARE_API_TOKEN` (org secret) and
`CLOUDFLARE_ACCOUNT_ID` (org variable) — so **no per-repo secrets and no local
`wrangler login` are needed**:

```sh
gh workflow run "Deploy landings + app (Cloudflare)" -R sneat-co/<id> --ref main
gh run watch -R sneat-co/<id>
```

(or GitHub → Actions → *Deploy landings + app (Cloudflare)* → **Run workflow**.)
Once you're happy, switch the workflow trigger to `push` on
`landings/**`, `apps/**`, `libs/**`.

The org token needs `Zone:DNS:Edit` in addition to `Workers Scripts:Edit` only
if you want CI to (re)attach the custom domain; otherwise attach it once in the
dashboard (step 3) and the token just needs Workers write.

#### Local fallback

Only if you have your own Cloudflare token and need an out-of-band deploy
(once the custom domain exists):

```sh
cd landings
pnpm build
npx wrangler deploy --config wrangler.jsonc
```

---

## `www` vs apex — **recommendation: apex-only**

**Default to apex-only (`myproduct.com`, no `www`).** `www` is a legacy
convention; a modern product does not need it, and apex-only is the simplest
correct setup. The scaffold is apex-only out of the box (one custom-domain route,
no `www`).

**Do NOT** make `www` work by adding it as a *second custom domain* — that
serves the same content on two hosts (duplicate content). And **do not** handle
`www` in the routing Worker — a **zone Redirect Rule** runs at Cloudflare's edge
*before* the Worker, costs nothing, and keeps `www` out of your routing code.

(This scaffold does run a Worker with `run_worker_first` — but for an essential
reason: the landing/app [routing split](#routing-model), not a `www` redirect. A
Redirect Rule short-circuits `www` before that Worker ever runs.)

### If you do want `www` → use a zone Redirect Rule (301 to apex)

A **Redirect Rule** runs at Cloudflare's edge, before Workers, costs nothing,
and keeps static serving free. Two requirements:

**a) A proxied `www` DNS record must exist.** A Redirect Rule only fires if the
request reaches Cloudflare for that hostname, which needs a **proxied
(orange-cloud)** `www` record. The content is irrelevant — a dummy
`AAAA www 100::` (proxied) is ideal, because the redirect happens at the edge and
no origin is ever contacted. (Add it in the dashboard; creating it needs
`Zone:DNS:Edit`.)

**b) The rule itself.** Dashboard → your zone → **Rules → Redirect Rules →
Create rule**:

- **When incoming requests match:** Hostname `equals` `www.myproduct.com`
- **Then (URL Redirect):**
  - Type = **Dynamic**
  - Expression = `concat("https://myproduct.com", http.request.uri.path)`
  - Status code = **301**
  - **Preserve query string** = **On**

Verify:

```sh
curl -sI https://www.myproduct.com/some/path?x=1 | grep -i location
# -> location: https://myproduct.com/some/path?x=1
```

> Creating Redirect Rules via API needs a token with **Zone → Dynamic Redirect:
> Edit** (the `workers`-only and read-only tokens can't). The dashboard is
> usually the quickest path for a single rule.

Every page also emits `<link rel="canonical">` pointing at the apex (from
`astro.config.mjs`'s `site`), so search engines are told the canonical host
regardless.

---

## Token scopes & permissions

What each action requires — useful when a deploy "partially fails":

| Action | Needs |
|--------|-------|
| Deploy the worker + upload assets | `Workers Scripts:Edit` |
| Attach / create a **Custom Domain** | `Zone:DNS:Edit` (creates the proxied DNS record + cert) |
| Create a `www` placeholder DNS record | `Zone:DNS:Edit` |
| Create a **Redirect Rule** | `Zone → Dynamic Redirect:Edit` |
| Read zones / workers / domains | `Zone:Read`, `Account:Read` |

A plain `wrangler login` OAuth token typically has Workers write + `Zone:Read`
only — enough to **deploy the worker**, but **not** to create custom domains,
DNS records, or redirect rules. Do those one-time, zone-level steps in the
dashboard (or with a purpose-scoped API token).

---

## Routing model

One origin, one Worker, two builds. Per
[backstage ADR 0001](https://github.com/sneat-co/backstage/blob/main/docs/decisions/0001-root-mounted-app-routing.md)
and
[sneat-libs `routing-and-deployment.md`](https://github.com/sneat-co/sneat-libs/blob/main/docs/extension-standards/routing-and-deployment.md):

- The **Angular app is mounted at the root** (`<base href="/">`). Reserved public
  paths serve the **landing**; everything else is an application route:

  | Landing (reserved) | App (everything else) |
  |---|---|
  | `/`, `/{locale}/*`, `/static/*`, `/.well-known/*`, `/robots.txt`, `/sitemap*.xml`, `/favicon.*`, `/manifest.webmanifest` | `/space/...`, `/my`, `/my/settings`, `/event/:id`, `/u/:handle`, `/login`, … |

- **Locales are an explicit allow-list** (`RESERVED_LOCALES` in `worker.js`), not
  "any two-letter segment" — otherwise `/my` (the personal dashboard) collides
  with a locale.
- **Content pages live under `/{locale}/*`** (`landings/src/pages/en/*`); the home
  stays at `/`. Don't create flat `/about`, `/pricing`, `/privacy` — use
  `/en/about`, `/en/pricing`, `/en/privacy`.
- `/my` is an application **section**, never the global app prefix (many app pages
  are shared/public: `/event/:id`, `/u/:handle`). Do **not** mount the app under
  `/pwa/` or `/app/` — `worker.js` keeps a `/pwa/*` → `/*` 301 as legacy compat
  only.
- **The service worker stays disabled**; when enabled it must not intercept the
  reserved public paths.

### How it's wired

- `landings/worker.js` — the edge split (`isReservedPublicPath`): reserved →
  landing asset (or its own 404); else → the app SPA shell (`index.app.html`),
  returned as 200 at the requested URL.
- `landings/wrangler.jsonc` — `main: worker.js` + `assets.binding: ASSETS` +
  `run_worker_first: true` so the Worker is authoritative.
- `landings/scripts/assemble-app.mjs` — `pnpm build` builds the Astro landing,
  builds the app (`--base-href=/`), and merges the app into `landings/dist`,
  renaming the app `index.html` → `index.app.html` so it doesn't clobber the
  landing home. Angular's hashed JS/CSS + `assets/` don't collide with Astro's
  `_astro/`.

## Topology recap

- **Landing (this `landings/`)** = Astro static build.
- **App** = the Angular SPA in `apps/<id>-app`, built with `--base-href=/`.
- **One origin, two builds, one distribution**, served by **one** Cloudflare
  Worker (`landings/worker.js`) that splits landing vs app per the
  [Routing model](#routing-model). See the
  [site-hosting-pattern spec](https://github.com/sneat-co/backstage/blob/main/spec/features/site-hosting-pattern/README.md).
