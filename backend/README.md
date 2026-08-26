# Template backend

Go domain module for this extension. Module path: `github.com/sneat-co/template/backend`
(the module is rooted here in `backend/`, not at the repo root — same shape as
`eventius/backend` and `togethered/backend`).

Built to the org standard
[`extension-backend-architecture.md`](https://github.com/sneat-co/sneat-specs/blob/main/standards/extension-backend-architecture.md):
the module depends on **`dal-go/dalgo` only**. It must not import `sneat-go-core`,
`sneat-core-modules`, or another extension's backend. Platform needs are
expressed as **ports** — small interfaces defined here — satisfied by
**adapters** that live in the host composition root (`sneat-go`).

This gets the module: no version treadmill against the kernel, independent
`backend/vX.Y.Z` releases, trivial testability (fake the port, no Firestore
emulator), and no public/private CI friction (a dalgo-only module builds
anywhere, no GOPRIVATE needed).

## What's here

This scaffold ships one placeholder vertical slice, wired end to end, so
`go build ./...` and `go test ./...` prove the shape works before you write
anything real:

| Package | What it is |
|---|---|
| `const4template` | Extension ID (plain string constant) |
| `models4template` | A placeholder DBO + dalgo key builder |
| `facade4template` | `Facade` (injected `dal.DB` + ports) and one example command, `CreateExampleItem` |

**Delete the placeholder as you build real domain logic.** Nothing here is
product code — it exists to prove the wiring, the way `Home.astro`'s example
copy in `landings/` does for the frontend.

## Adding a real port

1. Define the interface in `facade4template` (or a new file) — small, one or
   two methods, primitives + the extension's own spec types only. Never leak
   another extension's DBO/DTO across it.
2. Add it as a `Facade` field + `NewFacade` parameter.
3. Write the real adapter in the host: `sneat-go/pkg/modules/<id>/adapters.go`,
   registered alongside the extension's `module.go`.
4. Fake the port in tests — see `facade_test.go`'s `fakeIDGenerator`.

See `eventius/backend/eventius/ports.go` or
`togethered/backend/facade4togd/ports.go` for real, larger examples of the
same shape.

## Build & test

```bash
go build ./...
go test ./...
go vet ./...
```

## CI & versioning

`../.github/workflows/backend-ci.yml` runs strongo's Standard Go CI (lint ·
test · build) on every push/PR touching `backend/**`, and auto-tags the next
`backend/vX.Y.Z` on push to `main` from conventional-commit messages. Nothing
to configure — it inherits the org's `SNEAT_CI_READWRITE_TOKEN`.

## Where shared types go

If a type here turns out to be needed by more than one extension, it likely
belongs in the extension's contract module, not here — by default that's
`<id>/go.mod` in `sneat-co/sneat-ext-contracts`; a standalone `ext-<id>`
repo's `backend/` is the explicit-decision exception. See the architecture
doc's "decision ladder" for exactly which packages move (`dto4<id>`,
brief/read models, facade *interfaces*) versus which stay private to this
implementation (`dbo4<id>`, `dal4<id>`, facade *implementations*).
