package facade4prioritarius

import (
	"context"
	"errors"
	"testing"

	"github.com/sneat-co/prioritarius/backend/models4prioritarius"
)

// createTestNodes creates one work_item node per label. Node ids are
// server-generated (see CreateNodeRequest doc), so the caller must have
// built f with a fakeIDGenerator whose ids are exactly these labels, in this
// order — that is what lets the rest of a test refer to nodes by these
// short names.
func createTestNodes(t *testing.T, f Facade, labels ...string) {
	t.Helper()
	for _, label := range labels {
		if _, err := f.CreateNode(context.Background(), testUserID, CreateNodeRequest{
			SpaceID: testSpaceID, Kind: models4prioritarius.NodeKindWorkItem, Title: label,
		}); err != nil {
			t.Fatalf("setup CreateNode %s: %v", label, err)
		}
	}
}

// TestFacade_CreateEdge_CycleRejected covers AC: cycle-rejected — nodes
// A -> B -> C connected by contributes_to; attempting C -> A must be
// rejected, the error must name the existing path "A → B → C", and the
// graph must be left completely unchanged (proven by re-reading via
// SetGoalOrder-free round trip: we assert edge count directly below).
func TestFacade_CreateEdge_CycleRejected(t *testing.T) {
	f, _ := newTestFacade([]string{"A", "B", "C"})
	createTestNodes(t, f, "A", "B", "C")
	ctx := context.Background()

	if _, err := f.CreateEdge(ctx, testUserID, CreateEdgeRequest{SpaceID: testSpaceID, From: "A", To: "B", Type: models4prioritarius.EdgeTypeContributesTo}); err != nil {
		t.Fatalf("CreateEdge A->B: %v", err)
	}
	if _, err := f.CreateEdge(ctx, testUserID, CreateEdgeRequest{SpaceID: testSpaceID, From: "B", To: "C", Type: models4prioritarius.EdgeTypeContributesTo}); err != nil {
		t.Fatalf("CreateEdge B->C: %v", err)
	}

	_, err := f.CreateEdge(ctx, testUserID, CreateEdgeRequest{SpaceID: testSpaceID, From: "C", To: "A", Type: models4prioritarius.EdgeTypeContributesTo})
	if err == nil {
		t.Fatal("expected cycle rejection, got nil error")
	}
	var cycleErr *CycleError
	if !errors.As(err, &cycleErr) {
		t.Fatalf("error = %v, want *CycleError", err)
	}
	wantPath := "A → B → C"
	if got := FormatPath(cycleErr.Path); got != wantPath {
		t.Errorf("path = %q, want %q", got, wantPath)
	}
	if !errors.Is(err, ErrValidation) {
		t.Errorf("error does not wrap ErrValidation: %v", err)
	}

	// The graph must be unchanged: deleting the edge that would have closed
	// the cycle must report "not removed" (it was never added).
	delResp, err := f.DeleteEdge(ctx, testUserID, DeleteEdgeRequest{SpaceID: testSpaceID, From: "C", To: "A", Type: models4prioritarius.EdgeTypeContributesTo})
	if err != nil {
		t.Fatalf("DeleteEdge: %v", err)
	}
	if delResp.Removed {
		t.Error("Removed = true, want false — the rejected edge must never have been applied")
	}
}

// TestFacade_CreateEdge_SelfLoopRejected covers the degenerate from==to case.
func TestFacade_CreateEdge_SelfLoopRejected(t *testing.T) {
	f, _ := newTestFacade([]string{"A"})
	createTestNodes(t, f, "A")
	_, err := f.CreateEdge(context.Background(), testUserID, CreateEdgeRequest{SpaceID: testSpaceID, From: "A", To: "A", Type: models4prioritarius.EdgeTypeContributesTo})
	var cycleErr *CycleError
	if !errors.As(err, &cycleErr) {
		t.Fatalf("error = %v, want *CycleError", err)
	}
}

// TestFacade_CreateEdge_DagCheckedPerTypeIndependently proves A blocks B and
// B contributes_to A can coexist (REQ: dag-invariant: "evaluated per edge
// type").
func TestFacade_CreateEdge_DagCheckedPerTypeIndependently(t *testing.T) {
	f, _ := newTestFacade([]string{"A", "B"})
	createTestNodes(t, f, "A", "B")
	ctx := context.Background()

	if _, err := f.CreateEdge(ctx, testUserID, CreateEdgeRequest{SpaceID: testSpaceID, From: "A", To: "B", Type: models4prioritarius.EdgeTypeBlocks}); err != nil {
		t.Fatalf("CreateEdge A-blocks->B: %v", err)
	}
	if _, err := f.CreateEdge(ctx, testUserID, CreateEdgeRequest{SpaceID: testSpaceID, From: "B", To: "A", Type: models4prioritarius.EdgeTypeContributesTo}); err != nil {
		t.Fatalf("CreateEdge B-contributes_to->A should be allowed (different edge type): %v", err)
	}
}

func TestFacade_CreateEdge_UnknownNodeIsNotFound(t *testing.T) {
	f, _ := newTestFacade([]string{"A"})
	createTestNodes(t, f, "A")
	_, err := f.CreateEdge(context.Background(), testUserID, CreateEdgeRequest{SpaceID: testSpaceID, From: "A", To: "ghost", Type: models4prioritarius.EdgeTypeContributesTo})
	if !errors.Is(err, ErrNotFound) {
		t.Errorf("error = %v, want ErrNotFound", err)
	}
}

func TestFacade_CreateEdge_ReAddIsIdempotent(t *testing.T) {
	f, _ := newTestFacade([]string{"A", "B"})
	createTestNodes(t, f, "A", "B")
	ctx := context.Background()
	req := CreateEdgeRequest{SpaceID: testSpaceID, From: "A", To: "B", Type: models4prioritarius.EdgeTypeContributesTo}
	if _, err := f.CreateEdge(ctx, testUserID, req); err != nil {
		t.Fatalf("first CreateEdge: %v", err)
	}
	if _, err := f.CreateEdge(ctx, testUserID, req); err != nil {
		t.Fatalf("second CreateEdge (idempotent re-add): %v", err)
	}
	delResp, err := f.DeleteEdge(ctx, testUserID, DeleteEdgeRequest{SpaceID: testSpaceID, From: "A", To: "B", Type: models4prioritarius.EdgeTypeContributesTo})
	if err != nil {
		t.Fatalf("DeleteEdge: %v", err)
	}
	if !delResp.Removed {
		t.Fatal("Removed = false, want true")
	}
	// A second delete finds nothing — proves the re-add did not duplicate the edge.
	delResp, err = f.DeleteEdge(ctx, testUserID, DeleteEdgeRequest{SpaceID: testSpaceID, From: "A", To: "B", Type: models4prioritarius.EdgeTypeContributesTo})
	if err != nil {
		t.Fatalf("second DeleteEdge: %v", err)
	}
	if delResp.Removed {
		t.Error("Removed = true on second delete, want false (no duplicate edge)")
	}
}

func TestFacade_DeleteEdge_AbsentIsNoopNotError(t *testing.T) {
	f, _ := newTestFacade([]string{"n1"})
	resp, err := f.DeleteEdge(context.Background(), testUserID, DeleteEdgeRequest{SpaceID: testSpaceID, From: "x", To: "y", Type: models4prioritarius.EdgeTypeBlocks})
	if err != nil {
		t.Fatalf("DeleteEdge: %v", err)
	}
	if resp.Removed {
		t.Error("Removed = true, want false")
	}
}
