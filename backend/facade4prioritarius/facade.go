// Package facade4prioritarius holds Prioritarius's application commands —
// the ONLY writers of Prioritarius records (founder ruling 2026-09-02: "all
// writes in sneat always go throw sneat-go backend https endpoints. No
// exceptions."). Every command here mirrors the semantics of the
// TypeScript reference implementation at prioritarius/libs/core exactly
// (see that package's README); this package is a storage-layer,
// transactional port of the same rules, not a redesign.
//
// The package follows extension-backend-architecture.md: every platform
// capability it needs (space membership, caller identity, id generation) is
// expressed as a port (ports.go); concrete adapters live in the host
// composition root (sneat-go/pkg/modules/prioritarius).
package facade4prioritarius

import (
	"context"
	"fmt"
	"time"

	"github.com/dal-go/dalgo/dal"
	"github.com/dal-go/record"
	"github.com/sneat-co/prioritarius/backend/models4prioritarius"
)

// Clock returns the current time; injectable for deterministic tests.
type Clock func() time.Time

// Facade carries the injected database and ports for this extension's
// application commands — the org's injected-store pattern (see
// eventius/backend or togethered/backend/facade4togd). The host constructs
// one Facade at composition time, wiring a real adapter for each port; tests
// construct it with dalgo2memory and fakes — no Firestore emulator, no
// platform bootstrapping (extension-backend-architecture.md: "Trivial
// testability").
type Facade struct {
	db         dal.DB
	ids        IDGenerator
	membership SpaceMembershipResolver
	now        Clock
}

// Option applies optional configuration to a Facade built by NewFacade.
type Option func(*Facade)

// WithClock overrides the Facade's clock (defaults to time.Now). Tests use
// this for deterministic DoneAt/CompletedAt timestamps.
func WithClock(clock Clock) Option {
	return func(f *Facade) { f.now = clock }
}

// NewFacade returns a Facade over the given database and ports.
func NewFacade(db dal.DB, ids IDGenerator, membership SpaceMembershipResolver, opts ...Option) Facade {
	f := Facade{db: db, ids: ids, membership: membership, now: time.Now}
	for _, opt := range opts {
		opt(&f)
	}
	return f
}

// requireMember verifies the caller is an identified member of the space,
// using the SAME transaction (tx) the gated write runs in — read-consistent
// with the write it authorizes (REQ: writes-are-backend-mediated: "every
// mutation is an HTTPS call to a sneat-go endpoint... any invariant that
// protects stored state... MUST therefore be enforced server-side").
func (f Facade) requireMember(ctx context.Context, tx dal.ReadSession, spaceID, userID string) error {
	if userID == "" {
		return ErrUnauthorized
	}
	if spaceID == "" {
		return fmt.Errorf("%w: spaceID is required", ErrValidation)
	}
	if f.membership == nil {
		return fmt.Errorf("prioritarius: space membership resolver is not configured")
	}
	isMember, err := f.membership.IsSpaceMember(ctx, tx, spaceID, userID)
	if err != nil {
		return fmt.Errorf("check space membership: %w", err)
	}
	if !isMember {
		return ErrForbidden
	}
	return nil
}

// loadWorkspace loads (or, if absent, returns a fresh empty) workspace
// record for spaceID within tx. ALWAYS call this before any Set in the same
// transaction: both Firestore and the fleet's strict in-memory test DB
// forbid reading after a write within one transaction.
func loadWorkspace(ctx context.Context, tx dal.ReadSession, spaceID string) (record.Record, *models4prioritarius.WorkspaceDbo, error) {
	rec, dbo := models4prioritarius.NewWorkspaceRecord(spaceID)
	if err := tx.Get(ctx, rec); err != nil {
		if record.IsNotFound(err) {
			return rec, dbo, nil // fresh, empty workspace — not yet an error
		}
		return rec, dbo, fmt.Errorf("get workspace record: %w", err)
	}
	if dbo.Nodes == nil {
		dbo.Nodes = map[string]*models4prioritarius.NodeDbo{}
	}
	return rec, dbo, nil
}

// setter is the subset of dal.ReadwriteTransaction this package writes
// through (Set only — the workspace document always exists once written, so
// every write here is an upsert, never an Insert/Delete).
type setter interface {
	Set(ctx context.Context, record record.Record) error
}

func saveWorkspace(ctx context.Context, tx setter, rec record.Record) error {
	if err := tx.Set(ctx, rec); err != nil {
		return fmt.Errorf("save workspace record: %w", err)
	}
	return nil
}
