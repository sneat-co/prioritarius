package facade4prioritarius

import (
	"context"
	"errors"
	"testing"

	"github.com/sneat-co/prioritarius/backend/models4prioritarius"
)

func TestFacade_ApplyTemplate_Starter(t *testing.T) {
	f, _ := newTestFacade([]string{"g1", "p1", "w1", "w2"})
	resp, err := f.ApplyTemplate(context.Background(), testUserID, ApplyTemplateRequest{SpaceID: testSpaceID})
	if err != nil {
		t.Fatalf("ApplyTemplate: %v", err)
	}
	if len(resp.Nodes) != 4 {
		t.Fatalf("len(Nodes) = %d, want 4", len(resp.Nodes))
	}
	if len(resp.Edges) != 3 {
		t.Fatalf("len(Edges) = %d, want 3", len(resp.Edges))
	}

	var goals, projects, workItems int
	for _, n := range resp.Nodes {
		switch n.Kind {
		case models4prioritarius.NodeKindGoal:
			goals++
		case models4prioritarius.NodeKindProject:
			projects++
		case models4prioritarius.NodeKindWorkItem:
			workItems++
		}
	}
	if goals != 1 || projects != 1 || workItems != 2 {
		t.Errorf("goals=%d projects=%d workItems=%d, want 1/1/2", goals, projects, workItems)
	}

	// The created edges must not violate the DAG invariant: adding a fresh
	// edge back from the goal into the project must be rejected as a cycle.
	_, err = f.CreateEdge(context.Background(), testUserID, CreateEdgeRequest{
		SpaceID: testSpaceID, From: "g1", To: "p1", Type: models4prioritarius.EdgeTypeContributesTo,
	})
	var cycleErr *CycleError
	if !errors.As(err, &cycleErr) {
		t.Fatalf("expected the template's own edges to form a DAG (reverse edge should cycle-reject); error = %v", err)
	}
}

func TestFacade_ApplyTemplate_UnknownTemplateIsRejected(t *testing.T) {
	f, _ := newTestFacade([]string{"g1"})
	_, err := f.ApplyTemplate(context.Background(), testUserID, ApplyTemplateRequest{SpaceID: testSpaceID, TemplateID: "does-not-exist"})
	if !errors.Is(err, ErrValidation) {
		t.Errorf("error = %v, want ErrValidation", err)
	}
}
