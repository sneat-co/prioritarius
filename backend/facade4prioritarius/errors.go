package facade4prioritarius

import (
	"errors"
	"fmt"
	"strings"

	"github.com/sneat-co/prioritarius/backend/models4prioritarius"
)

// Sentinel errors every api4prioritarius handler maps to an HTTP status via
// errors.Is. Wrap with fmt.Errorf("...: %w", ErrX) to add detail.
var (
	// ErrUnauthorized means the request carried no identifiable caller.
	ErrUnauthorized = errors.New("prioritarius: caller is not identified")
	// ErrForbidden means the caller is not a member of the space.
	ErrForbidden = errors.New("prioritarius: caller is not a member of the space")
	// ErrNotFound means the referenced workspace, node or edge does not exist.
	ErrNotFound = errors.New("prioritarius: not found")
	// ErrValidation means the request itself is invalid (bad field, unknown
	// kind, missing required value, ...).
	ErrValidation = errors.New("prioritarius: invalid request")
)

// FormatPath renders a node-id path as "A → B → C", matching libs/core's
// formatPath exactly (see prioritarius/libs/core/src/lib/errors.ts).
func FormatPath(path []string) string {
	return strings.Join(path, " → ")
}

// CycleError is returned (always wrapped so errors.As finds it) when
// create_edge would close a cycle in its edge type's subgraph
// (REQ: dag-invariant). It names the pre-existing path — from the attempted
// edge's To back to its From — that the new edge would close, mirroring
// libs/core's CycleError exactly.
type CycleError struct {
	EdgeType models4prioritarius.EdgeType
	From, To string
	Path     []string
}

func (e *CycleError) Error() string {
	return fmt.Sprintf(
		"adding %q -%s-> %q would close a cycle via the existing path %s",
		e.From, e.EdgeType, e.To, FormatPath(e.Path),
	)
}

// newCycleError builds a CycleError already wrapped so errors.Is(err,
// ErrValidation) also matches it (a cycle-rejection is a request-validation
// failure from the API's point of view).
func newCycleError(edgeType models4prioritarius.EdgeType, from, to string, path []string) error {
	return fmt.Errorf("%w: %w", ErrValidation, &CycleError{EdgeType: edgeType, From: from, To: to, Path: path})
}
