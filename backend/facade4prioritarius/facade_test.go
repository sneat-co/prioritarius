package facade4prioritarius

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/dal-go/dalgo/dal"
	"github.com/sneat-co/prioritarius/backend/models4prioritarius"
	"github.com/sneat-co/sneat-go-core/sneatcoretesting"
)

// --- fakes (extension-backend-architecture.md: "Domain tests fake the port") ---

// fakeIDGenerator returns ids from a fixed sequence, so multi-node commands
// (apply_template) are deterministic in tests.
type fakeIDGenerator struct {
	ids []string
	i   int
}

func (f *fakeIDGenerator) NewID(context.Context) (string, error) {
	if f.i >= len(f.ids) {
		return "", errors.New("fakeIDGenerator: exhausted")
	}
	id := f.ids[f.i]
	f.i++
	return id, nil
}

const testUserID = "user1"
const testSpaceID = "space1"

// fakeMembership grants membership to exactly the given (spaceID, userID)
// pairs recorded via allow.
type fakeMembership struct {
	allowed map[string]bool
}

func newFakeMembership() *fakeMembership {
	return &fakeMembership{allowed: map[string]bool{}}
}

func (f *fakeMembership) allow(spaceID, userID string) *fakeMembership {
	f.allowed[spaceID+"|"+userID] = true
	return f
}

func (f *fakeMembership) IsSpaceMember(_ context.Context, _ dal.ReadSession, spaceID, userID string) (bool, error) {
	return f.allowed[spaceID+"|"+userID], nil
}

func newTestFacade(ids []string) (Facade, *fakeMembership) {
	membership := newFakeMembership().allow(testSpaceID, testUserID)
	f := NewFacade(sneatcoretesting.NewMemoryDB(), &fakeIDGenerator{ids: ids}, membership)
	return f, membership
}

// --- CreateNode ---

func TestFacade_CreateNode(t *testing.T) {
	tests := []struct {
		name      string
		req       CreateNodeRequest
		wantErr   bool
		wantErrIs error
		check     func(t *testing.T, node *models4prioritarius.NodeDbo)
	}{
		{
			name: "goal defaults to exploring commitment",
			req:  CreateNodeRequest{SpaceID: testSpaceID, Kind: models4prioritarius.NodeKindGoal, Title: "Ship v1"},
			check: func(t *testing.T, node *models4prioritarius.NodeDbo) {
				if node.Commitment != models4prioritarius.CommitmentExploring {
					t.Errorf("Commitment = %q, want exploring", node.Commitment)
				}
			},
		},
		{
			name: "work item defaults to open status",
			req:  CreateNodeRequest{SpaceID: testSpaceID, Kind: models4prioritarius.NodeKindWorkItem, Title: "Write code"},
			check: func(t *testing.T, node *models4prioritarius.NodeDbo) {
				if node.Status != models4prioritarius.WorkItemStatusOpen {
					t.Errorf("Status = %q, want open", node.Status)
				}
				if node.DoneAt != nil {
					t.Errorf("DoneAt = %v, want nil", node.DoneAt)
				}
			},
		},
		{
			name:      "empty title is rejected",
			req:       CreateNodeRequest{SpaceID: testSpaceID, Kind: models4prioritarius.NodeKindGoal, Title: ""},
			wantErr:   true,
			wantErrIs: ErrValidation,
		},
		{
			name:      "unknown kind is rejected",
			req:       CreateNodeRequest{SpaceID: testSpaceID, Kind: "epic", Title: "x"},
			wantErr:   true,
			wantErrIs: ErrValidation,
		},
		{
			name:      "status on a goal is rejected",
			req:       CreateNodeRequest{SpaceID: testSpaceID, Kind: models4prioritarius.NodeKindGoal, Title: "x", Status: models4prioritarius.WorkItemStatusDone},
			wantErr:   true,
			wantErrIs: ErrValidation,
		},
		{
			name:      "commitment on a work item is rejected",
			req:       CreateNodeRequest{SpaceID: testSpaceID, Kind: models4prioritarius.NodeKindWorkItem, Title: "x", Commitment: models4prioritarius.CommitmentCommitted},
			wantErr:   true,
			wantErrIs: ErrValidation,
		},
		{
			name:      "invalid estimate unit is rejected",
			req:       CreateNodeRequest{SpaceID: testSpaceID, Kind: models4prioritarius.NodeKindWorkItem, Title: "x", OwnEstimate: &models4prioritarius.Estimate{Value: 1, Unit: "weeks"}},
			wantErr:   true,
			wantErrIs: ErrValidation,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			f, _ := newTestFacade([]string{"n1"})
			resp, err := f.CreateNode(context.Background(), testUserID, tt.req)
			if tt.wantErr {
				if err == nil {
					t.Fatal("expected error, got nil")
				}
				if tt.wantErrIs != nil && !errors.Is(err, tt.wantErrIs) {
					t.Errorf("error = %v, want errors.Is(_, %v)", err, tt.wantErrIs)
				}
				return
			}
			if err != nil {
				t.Fatalf("CreateNode: %v", err)
			}
			if resp.Node.ID != "n1" {
				t.Errorf("ID = %q, want n1", resp.Node.ID)
			}
			if tt.check != nil {
				tt.check(t, resp.Node)
			}
		})
	}
}

func TestFacade_CreateNode_CommittedGoalJoinsOrder(t *testing.T) {
	f, _ := newTestFacade([]string{"g1", "g2"})
	ctx := context.Background()

	if _, err := f.CreateNode(ctx, testUserID, CreateNodeRequest{
		SpaceID: testSpaceID, Kind: models4prioritarius.NodeKindGoal, Title: "G1", Commitment: models4prioritarius.CommitmentCommitted,
	}); err != nil {
		t.Fatalf("CreateNode g1: %v", err)
	}
	if _, err := f.CreateNode(ctx, testUserID, CreateNodeRequest{
		SpaceID: testSpaceID, Kind: models4prioritarius.NodeKindGoal, Title: "G2", Commitment: models4prioritarius.CommitmentCommitted,
	}); err != nil {
		t.Fatalf("CreateNode g2: %v", err)
	}

	order, err := f.SetGoalOrder(ctx, testUserID, SetGoalOrderRequest{SpaceID: testSpaceID, GoalIDs: []string{"g1", "g2"}})
	if err != nil {
		t.Fatalf("SetGoalOrder: %v", err)
	}
	want := []string{"g1", "g2"}
	if len(order.CommittedGoalOrder) != 2 || order.CommittedGoalOrder[0] != want[0] || order.CommittedGoalOrder[1] != want[1] {
		t.Errorf("CommittedGoalOrder = %v, want %v", order.CommittedGoalOrder, want)
	}
}

// --- UpdateNode ---

func TestFacade_UpdateNode(t *testing.T) {
	fixedNow := time.Date(2026, 9, 2, 12, 0, 0, 0, time.UTC)

	setup := func(t *testing.T, ids []string, kind models4prioritarius.NodeKind) (Facade, string) {
		t.Helper()
		membership := newFakeMembership().allow(testSpaceID, testUserID)
		f := NewFacade(sneatcoretesting.NewMemoryDB(), &fakeIDGenerator{ids: ids}, membership, WithClock(func() time.Time { return fixedNow }))
		req := CreateNodeRequest{SpaceID: testSpaceID, Kind: kind, Title: "Original"}
		resp, err := f.CreateNode(context.Background(), testUserID, req)
		if err != nil {
			t.Fatalf("setup CreateNode: %v", err)
		}
		return f, resp.Node.ID
	}

	t.Run("title and description patch", func(t *testing.T) {
		f, id := setup(t, []string{"n1"}, models4prioritarius.NodeKindWorkItem)
		newTitle := "Renamed"
		newDesc := "Now with detail"
		resp, err := f.UpdateNode(context.Background(), testUserID, UpdateNodeRequest{SpaceID: testSpaceID, ID: id, Title: &newTitle, Description: &newDesc})
		if err != nil {
			t.Fatalf("UpdateNode: %v", err)
		}
		if resp.Node.Title != newTitle || resp.Node.Description != newDesc {
			t.Errorf("got title=%q desc=%q, want %q / %q", resp.Node.Title, resp.Node.Description, newTitle, newDesc)
		}
	})

	t.Run("work item done stamps DoneAt, reopen clears it", func(t *testing.T) {
		f, id := setup(t, []string{"n1"}, models4prioritarius.NodeKindWorkItem)
		done := models4prioritarius.WorkItemStatusDone
		resp, err := f.UpdateNode(context.Background(), testUserID, UpdateNodeRequest{SpaceID: testSpaceID, ID: id, Status: &done})
		if err != nil {
			t.Fatalf("UpdateNode(done): %v", err)
		}
		if resp.Node.DoneAt == nil || !resp.Node.DoneAt.Equal(fixedNow) {
			t.Fatalf("DoneAt = %v, want %v", resp.Node.DoneAt, fixedNow)
		}

		open := models4prioritarius.WorkItemStatusOpen
		resp, err = f.UpdateNode(context.Background(), testUserID, UpdateNodeRequest{SpaceID: testSpaceID, ID: id, Status: &open})
		if err != nil {
			t.Fatalf("UpdateNode(open): %v", err)
		}
		if resp.Node.DoneAt != nil {
			t.Errorf("DoneAt = %v, want nil after reopen", resp.Node.DoneAt)
		}
	})

	t.Run("explicit completion never happens implicitly and stamps CompletedAt", func(t *testing.T) {
		f, id := setup(t, []string{"g1"}, models4prioritarius.NodeKindGoal)
		// Before any explicit call, the goal must not be completed.
		completedTrue := true
		resp, err := f.UpdateNode(context.Background(), testUserID, UpdateNodeRequest{SpaceID: testSpaceID, ID: id, Completed: &completedTrue})
		if err != nil {
			t.Fatalf("UpdateNode(completed=true): %v", err)
		}
		if !resp.Node.Completed || resp.Node.CompletedAt == nil || !resp.Node.CompletedAt.Equal(fixedNow) {
			t.Fatalf("Completed=%v CompletedAt=%v, want true / %v", resp.Node.Completed, resp.Node.CompletedAt, fixedNow)
		}

		completedFalse := false
		resp, err = f.UpdateNode(context.Background(), testUserID, UpdateNodeRequest{SpaceID: testSpaceID, ID: id, Completed: &completedFalse})
		if err != nil {
			t.Fatalf("UpdateNode(completed=false): %v", err)
		}
		if resp.Node.Completed || resp.Node.CompletedAt != nil {
			t.Errorf("Completed=%v CompletedAt=%v, want false / nil", resp.Node.Completed, resp.Node.CompletedAt)
		}
	})

	t.Run("status on a goal is rejected", func(t *testing.T) {
		f, id := setup(t, []string{"g1"}, models4prioritarius.NodeKindGoal)
		done := models4prioritarius.WorkItemStatusDone
		_, err := f.UpdateNode(context.Background(), testUserID, UpdateNodeRequest{SpaceID: testSpaceID, ID: id, Status: &done})
		if !errors.Is(err, ErrValidation) {
			t.Errorf("error = %v, want ErrValidation", err)
		}
	})

	t.Run("completed on a work item is rejected", func(t *testing.T) {
		f, id := setup(t, []string{"w1"}, models4prioritarius.NodeKindWorkItem)
		completedTrue := true
		_, err := f.UpdateNode(context.Background(), testUserID, UpdateNodeRequest{SpaceID: testSpaceID, ID: id, Completed: &completedTrue})
		if !errors.Is(err, ErrValidation) {
			t.Errorf("error = %v, want ErrValidation", err)
		}
	})

	t.Run("unknown node id is not found", func(t *testing.T) {
		f, _ := setup(t, []string{"g1"}, models4prioritarius.NodeKindGoal)
		title := "x"
		_, err := f.UpdateNode(context.Background(), testUserID, UpdateNodeRequest{SpaceID: testSpaceID, ID: "missing", Title: &title})
		if !errors.Is(err, ErrNotFound) {
			t.Errorf("error = %v, want ErrNotFound", err)
		}
	})

	t.Run("committing a goal joins the order, uncommitting leaves it", func(t *testing.T) {
		f, id := setup(t, []string{"g1"}, models4prioritarius.NodeKindGoal)
		committed := models4prioritarius.CommitmentCommitted
		if _, err := f.UpdateNode(context.Background(), testUserID, UpdateNodeRequest{SpaceID: testSpaceID, ID: id, Commitment: &committed}); err != nil {
			t.Fatalf("UpdateNode(committed): %v", err)
		}
		order, err := f.SetGoalOrder(context.Background(), testUserID, SetGoalOrderRequest{SpaceID: testSpaceID, GoalIDs: []string{id}})
		if err != nil {
			t.Fatalf("SetGoalOrder: %v", err)
		}
		if len(order.CommittedGoalOrder) != 1 || order.CommittedGoalOrder[0] != id {
			t.Fatalf("CommittedGoalOrder = %v, want [%s]", order.CommittedGoalOrder, id)
		}

		exploring := models4prioritarius.CommitmentExploring
		if _, err := f.UpdateNode(context.Background(), testUserID, UpdateNodeRequest{SpaceID: testSpaceID, ID: id, Commitment: &exploring}); err != nil {
			t.Fatalf("UpdateNode(exploring): %v", err)
		}
		order, err = f.SetGoalOrder(context.Background(), testUserID, SetGoalOrderRequest{SpaceID: testSpaceID, GoalIDs: nil})
		if err != nil {
			t.Fatalf("SetGoalOrder(empty): %v", err)
		}
		if len(order.CommittedGoalOrder) != 0 {
			t.Errorf("CommittedGoalOrder = %v, want empty", order.CommittedGoalOrder)
		}
	})
}

// --- DeleteNode ---

func TestFacade_DeleteNode_CascadesAtomically(t *testing.T) {
	f, _ := newTestFacade([]string{"a", "b", "c"})
	ctx := context.Background()

	for _, id := range []string{"a", "b", "c"} {
		if _, err := f.CreateNode(ctx, testUserID, CreateNodeRequest{SpaceID: testSpaceID, Kind: models4prioritarius.NodeKindWorkItem, Title: id}); err != nil {
			t.Fatalf("CreateNode %s: %v", id, err)
		}
	}
	if _, err := f.CreateEdge(ctx, testUserID, CreateEdgeRequest{SpaceID: testSpaceID, From: "a", To: "b", Type: models4prioritarius.EdgeTypeContributesTo}); err != nil {
		t.Fatalf("CreateEdge a->b: %v", err)
	}
	if _, err := f.CreateEdge(ctx, testUserID, CreateEdgeRequest{SpaceID: testSpaceID, From: "c", To: "b", Type: models4prioritarius.EdgeTypeBlocks}); err != nil {
		t.Fatalf("CreateEdge c->b: %v", err)
	}

	resp, err := f.DeleteNode(ctx, testUserID, DeleteNodeRequest{SpaceID: testSpaceID, ID: "b"})
	if err != nil {
		t.Fatalf("DeleteNode: %v", err)
	}
	if resp.RemovedEdges != 2 {
		t.Errorf("RemovedEdges = %d, want 2", resp.RemovedEdges)
	}

	// Deleting again is not-found, and re-adding an edge to the deleted node
	// must fail (proves the delete really removed it, not just hid it).
	if _, err := f.DeleteNode(ctx, testUserID, DeleteNodeRequest{SpaceID: testSpaceID, ID: "b"}); !errors.Is(err, ErrNotFound) {
		t.Errorf("second DeleteNode error = %v, want ErrNotFound", err)
	}
	if _, err := f.CreateEdge(ctx, testUserID, CreateEdgeRequest{SpaceID: testSpaceID, From: "a", To: "b", Type: models4prioritarius.EdgeTypeContributesTo}); !errors.Is(err, ErrNotFound) {
		t.Errorf("CreateEdge to deleted node error = %v, want ErrNotFound", err)
	}
}

func TestFacade_DeleteNode_DropsFromCommittedGoalOrder(t *testing.T) {
	f, _ := newTestFacade([]string{"g1", "g2"})
	ctx := context.Background()

	for _, id := range []string{"g1", "g2"} {
		if _, err := f.CreateNode(ctx, testUserID, CreateNodeRequest{SpaceID: testSpaceID, Kind: models4prioritarius.NodeKindGoal, Title: id, Commitment: models4prioritarius.CommitmentCommitted}); err != nil {
			t.Fatalf("CreateNode %s: %v", id, err)
		}
	}
	resp, err := f.DeleteNode(ctx, testUserID, DeleteNodeRequest{SpaceID: testSpaceID, ID: "g1"})
	if err != nil {
		t.Fatalf("DeleteNode: %v", err)
	}
	if !resp.RemovedFromGoalOrder {
		t.Error("RemovedFromGoalOrder = false, want true")
	}
	order, err := f.SetGoalOrder(ctx, testUserID, SetGoalOrderRequest{SpaceID: testSpaceID, GoalIDs: []string{"g2"}})
	if err != nil {
		t.Fatalf("SetGoalOrder: %v", err)
	}
	if len(order.CommittedGoalOrder) != 1 || order.CommittedGoalOrder[0] != "g2" {
		t.Errorf("CommittedGoalOrder = %v, want [g2]", order.CommittedGoalOrder)
	}
}

// --- Membership / auth gating ---

func TestFacade_CreateNode_RejectsNonMember(t *testing.T) {
	membership := newFakeMembership() // nobody is a member
	f := NewFacade(sneatcoretesting.NewMemoryDB(), &fakeIDGenerator{ids: []string{"n1"}}, membership)

	_, err := f.CreateNode(context.Background(), testUserID, CreateNodeRequest{SpaceID: testSpaceID, Kind: models4prioritarius.NodeKindGoal, Title: "x"})
	if !errors.Is(err, ErrForbidden) {
		t.Errorf("error = %v, want ErrForbidden", err)
	}
}

func TestFacade_CreateNode_RejectsUnauthenticated(t *testing.T) {
	f, _ := newTestFacade([]string{"n1"})
	_, err := f.CreateNode(context.Background(), "", CreateNodeRequest{SpaceID: testSpaceID, Kind: models4prioritarius.NodeKindGoal, Title: "x"})
	if !errors.Is(err, ErrUnauthorized) {
		t.Errorf("error = %v, want ErrUnauthorized", err)
	}
}
