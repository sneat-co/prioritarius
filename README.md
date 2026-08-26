# sneat-ext-template

> **DEFAULT: a new extension's contract is created as `libs/<family>/` in
> [`sneat-co/sneat-ext-contracts`](https://github.com/sneat-co/sneat-ext-contracts)
> (see its README + the scaffold generator). A standalone `ext-<id>` contract
> repo, scaffolded from
> [`sneat-ext-contract-template`](../sneat-ext-contract-template), is used
> ONLY when that has been explicitly decided by the founder.**

Starter implementation repository for a Sneat extension. It contains an Nx
workspace, Angular/Ionic app, and one host-facing runtime package.

## Repository model

- `<id>` owns the implementation app and `@sneat/extension-<id>` runtime.
- The public `@sneat/extension-<id>-contract` package defaults to living in
  `sneat-ext-contracts` (`libs/<id>/`). A standalone `ext-<id>` repo owning it
  instead is the explicit-decision exception.

The implementation never copies contract source. It consumes the published
contract package just as another extension would.

## Layout

```text
apps/
  prioritarius-app/        # Ionic composition root
  prioritarius-app-e2e/    # Playwright harness
libs/extensions/prioritarius/
  runtime/             # @sneat/extension-prioritarius
landings/               # Astro marketing site (see landings/README.md)
backend/                # Go domain module (see backend/README.md)
```

This demo pairs with the exception-path
[`sneat-ext-contract-template`](../sneat-ext-contract-template)
repository, which owns
`@sneat/extension-prioritarius-contract`. A real new extension should default to
`sneat-ext-contracts` instead — see the banner above.

## Backend

`backend/` is a Go domain module (`github.com/sneat-co/prioritarius/backend`) built
to the org's
[ports-and-adapters standard](https://github.com/sneat-co/sneat-specs/blob/main/standards/extension-backend-architecture.md):
it depends on `dal-go/dalgo` only — never `sneat-go-core`, `sneat-core-modules`,
or another extension's backend — and expresses platform/cross-extension needs
as ports, satisfied by adapters in the host composition root (`sneat-go`). See
[`backend/README.md`](backend/README.md).

CI (`.github/workflows/backend-ci.yml`) runs lint/test/build on every push and
PR touching `backend/**`, and auto-tags the next `backend/vX.Y.Z` release on
push to `main`.

This is distinct from the extension's **contract** module (`dto4<id>` types,
briefs, facade interfaces) — by default `<id>/go.mod` in
`sneat-co/sneat-ext-contracts`, or a standalone `ext-<id>` repo's `backend/`
in the explicit-decision exception case. This one is the
**implementation** — DBOs, storage, facade bodies.

## Runtime API

The runtime package is deliberately an application-integration surface. Its
root entry point exports provider functions and route arrays only. It does not
export concrete services, pages, or components for other extension libraries to
consume.

```ts
import { providePrioritarius, prioritariusSpaceRoutes } from '@sneat/extension-prioritarius';

bootstrapApplication(App, {
  providers: [...providePrioritarius(), provideRouter(prioritariusSpaceRoutes)],
});
```

Extension libraries use contract tokens; only the app composition root imports a
different extension's runtime package. Reusable components deserve a separate
`@sneat/extension-<id>-ui` package only when another extension needs them.

## Create a new extension

Clone this repository as `<id>`, rename `template` with `./customize.sh <id>`,
and add the contract as `libs/<id>/` in `sneat-ext-contracts` (the default —
see its README + the scaffold generator). Only when a standalone contract
repo has been explicitly decided, create a paired `ext-<id>` repository from
`sneat-ext-contract-template` instead. Publish the contract first, update the
implementation's dependency range, then build:

```sh
pnpm install
pnpm exec nx run-many -t lint test build
(cd backend && go build ./... && go test ./...)
```

See the [extension standards](https://github.com/sneat-co/sneat-libs/tree/main/docs/extension-standards)
for dependency rules and release sequencing.
