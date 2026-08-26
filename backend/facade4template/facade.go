package facade4template

import (
	"context"
	"errors"

	"github.com/dal-go/dalgo/dal"
	"github.com/sneat-co/template/backend/models4template"
)

// Facade carries the injected database and ports for this extension's
// application commands — the org's injected-store pattern (see
// eventius/backend or togethered/backend/facade4togd). The host constructs one
// Facade at composition time, wiring a real adapter for each port; tests
// construct it with dalgo2memory and fakes — no Firestore emulator, no
// platform bootstrapping (extension-backend-architecture.md: "Trivial
// testability").
type Facade struct {
	db  dal.DB
	ids IDGenerator
}

// NewFacade returns a Facade over the given database and ports.
func NewFacade(db dal.DB, ids IDGenerator) Facade {
	return Facade{db: db, ids: ids}
}

// CreateExampleItem is a placeholder application command demonstrating the
// shape every real command follows: validate, generate an id via a port,
// build the dalgo record, write it in a transaction.
//
// TODO(backend): delete this command once you have real ones.
func (f Facade) CreateExampleItem(ctx context.Context, title string) (id string, err error) {
	if title == "" {
		return "", errors.New("title is required")
	}
	if id, err = f.ids.NewID(ctx); err != nil {
		return "", err
	}
	record, dbo := models4template.NewExampleItemRecord(id)
	dbo.Title = title
	if err = f.db.RunReadwriteTransaction(ctx, func(ctx context.Context, tx dal.ReadwriteTransaction) error {
		return tx.Insert(ctx, record)
	}); err != nil {
		return "", err
	}
	return id, nil
}
