package facade4template

import "context"

// IDGenerator is a stand-in PORT — the pattern every real cross-boundary need
// follows (see extension-backend-architecture.md): a small interface defined
// HERE, in the domain module, satisfied by an adapter that lives in the host
// composition root (sneat-go/pkg/modules/<id>/adapters.go), never imported
// directly. The module must not import sneat-go-core, sneat-core-modules, or
// another extension's backend — anything it needs crosses a port like this one.
//
// TODO(backend): delete this port once you have real ones (a
// UserBriefProvider, a HappeningCreator, ... — see eventius/backend/ports.go
// or togethered/backend/facade4togd/ports.go for real examples).
type IDGenerator interface {
	NewID(ctx context.Context) (string, error)
}
