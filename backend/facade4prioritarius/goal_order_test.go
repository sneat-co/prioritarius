package facade4prioritarius

import (
	"context"
	"errors"
	"testing"

	"github.com/sneat-co/prioritarius/backend/models4prioritarius"
)

func TestFacade_SetGoalOrder(t *testing.T) {
	setup := func(t *testing.T) Facade {
		t.Helper()
		f, _ := newTestFacade([]string{"g1", "g2", "g3"})
		for _, id := range []string{"g1", "g2", "g3"} {
			if _, err := f.CreateNode(context.Background(), testUserID, CreateNodeRequest{
				SpaceID: testSpaceID, Kind: models4prioritarius.NodeKindGoal, Title: id, Commitment: models4prioritarius.CommitmentCommitted,
			}); err != nil {
				t.Fatalf("setup CreateNode %s: %v", id, err)
			}
		}
		return f
	}

	t.Run("reorders the committed set", func(t *testing.T) {
		f := setup(t)
		resp, err := f.SetGoalOrder(context.Background(), testUserID, SetGoalOrderRequest{SpaceID: testSpaceID, GoalIDs: []string{"g3", "g1", "g2"}})
		if err != nil {
			t.Fatalf("SetGoalOrder: %v", err)
		}
		want := []string{"g3", "g1", "g2"}
		for i, id := range want {
			if resp.CommittedGoalOrder[i] != id {
				t.Errorf("order[%d] = %q, want %q", i, resp.CommittedGoalOrder[i], id)
			}
		}
	})

	t.Run("rejects a set that omits a committed goal", func(t *testing.T) {
		f := setup(t)
		_, err := f.SetGoalOrder(context.Background(), testUserID, SetGoalOrderRequest{SpaceID: testSpaceID, GoalIDs: []string{"g1", "g2"}})
		if !errors.Is(err, ErrValidation) {
			t.Errorf("error = %v, want ErrValidation", err)
		}
	})

	t.Run("rejects a set with an id not currently committed", func(t *testing.T) {
		f := setup(t)
		_, err := f.SetGoalOrder(context.Background(), testUserID, SetGoalOrderRequest{SpaceID: testSpaceID, GoalIDs: []string{"g1", "g2", "g3", "ghost"}})
		if !errors.Is(err, ErrValidation) {
			t.Errorf("error = %v, want ErrValidation", err)
		}
	})
}
