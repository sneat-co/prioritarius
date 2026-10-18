package facade4prioritarius

import (
	"reflect"
	"testing"

	"github.com/sneat-co/prioritarius/backend/models4prioritarius"
)

func TestFindPath_StartEqualsTarget(t *testing.T) {
	got := findPath(nil, "A", "A")
	want := []string{"A"}
	if !reflect.DeepEqual(got, want) {
		t.Errorf("findPath(nil, A, A) = %v, want %v", got, want)
	}
}

func TestFindPath_DiamondGraphVisitsAlreadyVisited(t *testing.T) {
	// A -> B -> D
	// A -> C -> D
	// Target is E which is reachable from D. Both B and C lead to D.
	edges := []models4prioritarius.EdgeDbo{
		{From: "A", To: "B", Type: models4prioritarius.EdgeTypeBlocks},
		{From: "A", To: "C", Type: models4prioritarius.EdgeTypeBlocks},
		{From: "B", To: "D", Type: models4prioritarius.EdgeTypeBlocks},
		{From: "C", To: "D", Type: models4prioritarius.EdgeTypeBlocks},
		{From: "D", To: "E", Type: models4prioritarius.EdgeTypeBlocks},
	}
	got := findPath(edges, "A", "E")
	if len(got) == 0 || got[0] != "A" || got[len(got)-1] != "E" {
		t.Errorf("findPath(edges, A, E) = %v, want path from A to E", got)
	}
}
