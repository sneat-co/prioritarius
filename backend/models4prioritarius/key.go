package models4prioritarius

import (
	"github.com/dal-go/record"
	"github.com/sneat-co/prioritarius/backend/const4prioritarius"
)

// spacesCollection and extCollection are the storage collection names for
// Space records ("/spaces/{spaceID}") and a Space's per-extension records
// ("/spaces/{spaceID}/ext/{extID}"). They match sneat-go-core's
// coretypes.NewSpaceModuleKey layout exactly, but are duplicated here as
// literals (not imported) because this module must depend on dal-go/dalgo
// only — see the package README's architecture note.
const (
	spacesCollection = "spaces"
	extCollection    = "ext"
)

// NewWorkspaceKey builds the dalgo key for the one document holding a
// Space's entire Prioritarius graph: /spaces/{spaceID}/ext/prioritarius.
func NewWorkspaceKey(spaceID string) *record.Key {
	spaceKey := record.NewKeyWithID(spacesCollection, spaceID)
	return record.NewKeyWithParentAndID(spaceKey, extCollection, const4prioritarius.ExtensionID)
}

// NewWorkspaceRecord wraps a fresh WorkspaceDbo in its dalgo record for
// spaceID, returning both the record (for db calls) and the DBO (to read or
// populate fields on).
func NewWorkspaceRecord(spaceID string) (record.Record, *WorkspaceDbo) {
	dbo := NewWorkspaceDbo()
	return record.NewRecordWithData(NewWorkspaceKey(spaceID), dbo), dbo
}
