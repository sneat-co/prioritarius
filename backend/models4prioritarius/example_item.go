package models4prioritarius

import (
	"github.com/dal-go/record"
)

// ItemsCollection is the dalgo collection example items are stored in.
//
// TODO(backend): delete this file (and models4prioritarius entirely) once you have
// real domain records — this is a placeholder proving the module's storage
// wiring compiles and is testable, not product logic. See
// https://github.com/sneat-co/sneat-specs/blob/main/standards/extension-backend-architecture.md
// for the ports-and-adapters standard this module follows, and
// eventius/backend or togethered/backend for real, larger examples of the
// same shape (const4<id> / models4<id> / facade4<id>).
const ItemsCollection = "prioritarius-items"

// ExampleItemDbo is a placeholder DBO.
type ExampleItemDbo struct {
	Title string `firestore:"title"`
}

// NewExampleItemKey builds the dalgo key for an example item.
func NewExampleItemKey(id string) *record.Key {
	return record.NewKeyWithID(ItemsCollection, id)
}

// NewExampleItemRecord wraps a fresh ExampleItemDbo in its dalgo record,
// returning both the record (for db calls) and the DBO (to populate fields on).
func NewExampleItemRecord(id string) (record.Record, *ExampleItemDbo) {
	dbo := new(ExampleItemDbo)
	return record.NewRecordWithData(NewExampleItemKey(id), dbo), dbo
}
