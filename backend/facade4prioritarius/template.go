package facade4prioritarius

import (
	"context"
	"fmt"

	"github.com/dal-go/dalgo/dal"
	"github.com/sneat-co/prioritarius/backend/models4prioritarius"
)

// TemplateStarter is the only built-in template id today: one goal, one
// project contributing to it, and two work items contributing to the
// project — enough to see the graph, estimates and progress working without
// a blank canvas.
const TemplateStarter = "starter"

// ApplyTemplateRequest creates a small starter set of nodes+edges in one
// transaction. TemplateID defaults to TemplateStarter.
type ApplyTemplateRequest struct {
	SpaceID    string `json:"spaceID"`
	TemplateID string `json:"templateId,omitempty"`
}

// ApplyTemplateResponse returns every node and edge the template created, so
// the frontend can update optimistically without a re-read.
type ApplyTemplateResponse struct {
	Nodes []*models4prioritarius.NodeDbo `json:"nodes"`
	Edges []models4prioritarius.EdgeDbo  `json:"edges"`
}

// ApplyTemplate creates the named starter template's nodes and edges
// atomically. The caller must be a member of the space.
func (f Facade) ApplyTemplate(ctx context.Context, userID string, req ApplyTemplateRequest) (resp ApplyTemplateResponse, err error) {
	templateID := req.TemplateID
	if templateID == "" {
		templateID = TemplateStarter
	}
	if templateID != TemplateStarter {
		return resp, fmt.Errorf("%w: unknown templateId %q", ErrValidation, templateID)
	}

	goalID, err := f.ids.NewID(ctx)
	if err != nil {
		return resp, fmt.Errorf("generate goal id: %w", err)
	}
	projectID, err := f.ids.NewID(ctx)
	if err != nil {
		return resp, fmt.Errorf("generate project id: %w", err)
	}
	workItem1ID, err := f.ids.NewID(ctx)
	if err != nil {
		return resp, fmt.Errorf("generate work item id: %w", err)
	}
	workItem2ID, err := f.ids.NewID(ctx)
	if err != nil {
		return resp, fmt.Errorf("generate work item id: %w", err)
	}

	goal := &models4prioritarius.NodeDbo{
		ID: goalID, Kind: models4prioritarius.NodeKindGoal,
		Title: "Your first goal", Commitment: models4prioritarius.CommitmentExploring,
	}
	project := &models4prioritarius.NodeDbo{
		ID: projectID, Kind: models4prioritarius.NodeKindProject,
		Title: "Your first project", Commitment: models4prioritarius.CommitmentExploring,
	}
	workItem1 := &models4prioritarius.NodeDbo{
		ID: workItem1ID, Kind: models4prioritarius.NodeKindWorkItem,
		Title: "First task", Status: models4prioritarius.WorkItemStatusOpen,
	}
	workItem2 := &models4prioritarius.NodeDbo{
		ID: workItem2ID, Kind: models4prioritarius.NodeKindWorkItem,
		Title: "Second task", Status: models4prioritarius.WorkItemStatusOpen,
	}
	nodes := []*models4prioritarius.NodeDbo{goal, project, workItem1, workItem2}
	edges := []models4prioritarius.EdgeDbo{
		{From: project.ID, To: goal.ID, Type: models4prioritarius.EdgeTypeContributesTo},
		{From: workItem1.ID, To: project.ID, Type: models4prioritarius.EdgeTypeContributesTo},
		{From: workItem2.ID, To: project.ID, Type: models4prioritarius.EdgeTypeContributesTo},
	}

	err = f.db.RunReadwriteTransaction(ctx, func(ctx context.Context, tx dal.ReadwriteTransaction) error {
		if err := f.requireMember(ctx, tx, req.SpaceID, userID); err != nil {
			return err
		}
		rec, ws, err := loadWorkspace(ctx, tx, req.SpaceID)
		if err != nil {
			return err
		}
		for _, n := range nodes {
			ws.Nodes[n.ID] = n
		}
		ws.Edges = append(ws.Edges, edges...)
		return saveWorkspace(ctx, tx, rec)
	})
	if err != nil {
		return ApplyTemplateResponse{}, err
	}
	resp.Nodes = nodes
	resp.Edges = edges
	return resp, nil
}
