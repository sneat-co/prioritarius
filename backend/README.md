# Prioritarius backend

Go domain module for this extension. Module path: `github.com/sneat-co/prioritarius/backend`
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

The real domain module for the goal/project/work-item graph described in
`backstage/spec/features/prioritarius/domain-model/README.md`, ported from the
TypeScript reference implementation at `prioritarius/libs/core` (same
semantics — DAG enforcement, commitment lifecycle, completion — mirrored
exactly, not redesigned):

| Package | What it is |
|---|---|
| `const4prioritarius` | Extension ID (plain string constant) |
| `models4prioritarius` | The workspace/node/edge DBOs and dalgo key builder — one Firestore document per Space at `/spaces/{spaceID}/ext/prioritarius` (see `WorkspaceDbo`'s doc comment for why one document, not one per node/edge) |
| `facade4prioritarius` | `Facade` (injected `dal.DB` + ports) and every application command: `CreateNode`, `UpdateNode`, `DeleteNode`, `CreateEdge` (server-side DAG invariant, named-path cycle rejection), `DeleteEdge`, `SetGoalOrder`, `ApplyTemplate` |
| `api4prioritarius` | Thin HTTP layer mounting every command under `/v0/prioritarius/...` (see its package doc comment for the full request/response contract) |

Reads are Firestore-direct from the client (gated by `../firestore.rules`);
every write goes through `api4prioritarius` (founder ruling 2026-09-02: "all
writes in sneat always go throw sneat-go backend https endpoints. No
exceptions.").

## Adding a real port

1. Define the interface in `facade4prioritarius` (or a new file) — small, one or
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
