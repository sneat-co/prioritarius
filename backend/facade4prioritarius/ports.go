package facade4prioritarius

import (
	"context"

	"github.com/dal-go/dalgo/dal"
)

// IDGenerator generates ids for new nodes. The real adapter (in
// sneat-go/pkg/modules/prioritarius) is a narrow host binding; tests inject a
// fake (see facade_test.go's fakeIDGenerator).
type IDGenerator interface {
	NewID(ctx context.Context) (string, error)
}

// SpaceMembershipResolver is Prioritarius's narrow dependency on Space
// membership (founder ruling 2026-09-02: "almost everything in sneat is
// space bounded"). The host composition supplies its concrete
// Contactus-backed binding, exactly as OVDB's contactusMembershipResolver
// does (sneat-go/pkg/modules/ovdb/module.go) — this module must not import
// sneat-core-modules or sneat-go-core directly, so it never sees the
// Contactus DBO, only the yes/no decision.
//
// tx is the SAME transaction the gated write runs in, so the membership
// check is read-consistent with the write it authorizes (no separate
// round-trip that could race a concurrent membership change).
type SpaceMembershipResolver interface {
	IsSpaceMember(ctx context.Context, tx dal.ReadSession, spaceID string, userID string) (bool, error)
}

// UserIdentity extracts the authenticated caller's userID from a request's
// bearer token. The real adapter (in sneat-go) verifies a Firebase ID token
// (see eventius's identityAdapter for the precedent this follows); tests
// inject the userID directly via a fake.
type UserIdentity interface {
	// UserID returns the caller's id and true when authenticated, or "" and
	// false when the token is missing or invalid.
	UserID(ctx context.Context, bearerToken string) (string, bool)
}
