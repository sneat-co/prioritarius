package models4prioritarius

import (
	"testing"
)

func TestEstimateUnit_IsValid(t *testing.T) {
	for _, u := range []EstimateUnit{EstimateUnitHours, EstimateUnitDays} {
		if !u.IsValid() {
			t.Errorf("expected %s to be valid", u)
		}
	}
	if EstimateUnit("weeks").IsValid() {
		t.Errorf("expected weeks to be invalid")
	}
}

func TestNodeKind_IsValid(t *testing.T) {
	for _, k := range []NodeKind{NodeKindGoal, NodeKindProject, NodeKindWorkItem} {
		if !k.IsValid() {
			t.Errorf("expected %s to be valid", k)
		}
	}
	if NodeKind("task").IsValid() {
		t.Errorf("expected task to be invalid")
	}
}

func TestCommitmentState_IsValid(t *testing.T) {
	for _, c := range []CommitmentState{CommitmentCommitted, CommitmentExploring, CommitmentParked} {
		if !c.IsValid() {
			t.Errorf("expected %s to be valid", c)
		}
	}
	if CommitmentState("abandoned").IsValid() {
		t.Errorf("expected abandoned to be invalid")
	}
}

func TestWorkItemStatus_IsValid(t *testing.T) {
	for _, s := range []WorkItemStatus{WorkItemStatusOpen, WorkItemStatusDone} {
		if !s.IsValid() {
			t.Errorf("expected %s to be valid", s)
		}
	}
	if WorkItemStatus("in_progress").IsValid() {
		t.Errorf("expected in_progress to be invalid")
	}
}

func TestEdgeType_IsValid(t *testing.T) {
	for _, edgeType := range []EdgeType{EdgeTypeContributesTo, EdgeTypeBlocks} {
		if !edgeType.IsValid() {
			t.Errorf("expected %s to be valid", edgeType)
		}
	}
	if EdgeType("relates_to").IsValid() {
		t.Errorf("expected relates_to to be invalid")
	}
}

func TestNewWorkspaceDbo(t *testing.T) {
	ws := NewWorkspaceDbo()
	if ws == nil {
		t.Fatal("expected non-nil WorkspaceDbo")
	}
	if ws.Unit != EstimateUnitDays {
		t.Errorf("expected Unit to be days, got %s", ws.Unit)
	}
	if ws.Nodes == nil {
		t.Errorf("expected non-nil Nodes map")
	}
}

func TestNewWorkspaceKey_AndRecord(t *testing.T) {
	const spaceID = "space123"
	key := NewWorkspaceKey(spaceID)
	if key == nil {
		t.Fatal("expected non-nil key")
	}
	if key.Collection() != extCollection {
		t.Errorf("expected collection %s, got %s", extCollection, key.Collection())
	}
	if key.Parent() == nil || key.Parent().Collection() != spacesCollection {
		t.Errorf("expected parent collection %s", spacesCollection)
	}

	rec, dbo := NewWorkspaceRecord(spaceID)
	if rec == nil || dbo == nil {
		t.Fatal("expected non-nil rec and dbo")
	}
	if dbo.Unit != EstimateUnitDays {
		t.Errorf("expected Unit to be days, got %s", dbo.Unit)
	}
}
