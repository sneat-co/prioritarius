package facade4prioritarius

import (
	"context"
	"fmt"
	"strings"

	"github.com/dal-go/dalgo/dal"
	"github.com/sneat-co/prioritarius/backend/models4prioritarius"
)

// CreateNodeRequest creates one goal, project or work item in a Space's
// workspace (REQ: node-kinds). Commitment applies to goal/project only and
// defaults to "exploring" (REQ: commitment-lifecycle); Status applies to
// work_item only and defaults to "open".
type CreateNodeRequest struct {
	SpaceID     string                              `json:"spaceID"`
	Kind        models4prioritarius.NodeKind        `json:"kind"`
	Title       string                              `json:"title"`
	Description string                              `json:"description,omitempty"`
	OwnEstimate *models4prioritarius.Estimate       `json:"ownEstimate,omitempty"`
	Deadline    *models4prioritarius.Deadline       `json:"deadline,omitempty"`
	Commitment  models4prioritarius.CommitmentState `json:"commitment,omitempty"`
	Status      models4prioritarius.WorkItemStatus  `json:"status,omitempty"`
}

// NodeResponse wraps a single node — returned by create_node/update_node so
// the frontend can update optimistically with the id the backend assigned.
type NodeResponse struct {
	Node *models4prioritarius.NodeDbo `json:"node"`
}

func validateEstimate(e *models4prioritarius.Estimate) error {
	if e == nil {
		return nil
	}
	if !e.Unit.IsValid() {
		return fmt.Errorf("%w: ownEstimate.unit must be \"hours\" or \"days\", got %q", ErrValidation, e.Unit)
	}
	if e.Value < 0 {
		return fmt.Errorf("%w: ownEstimate.value must be >= 0", ErrValidation)
	}
	return nil
}

func validateDeadline(d *models4prioritarius.Deadline) error {
	if d == nil {
		return nil
	}
	if strings.TrimSpace(d.Date) == "" {
		return fmt.Errorf("%w: deadline.date is required", ErrValidation)
	}
	return nil
}

// CreateNode creates a node. The caller must be a member of the space.
func (f Facade) CreateNode(ctx context.Context, userID string, req CreateNodeRequest) (resp NodeResponse, err error) {
	if strings.TrimSpace(req.Title) == "" {
		return resp, fmt.Errorf("%w: title is required", ErrValidation)
	}
	if !req.Kind.IsValid() {
		return resp, fmt.Errorf("%w: kind must be \"goal\", \"project\" or \"work_item\", got %q", ErrValidation, req.Kind)
	}
	if err = validateEstimate(req.OwnEstimate); err != nil {
		return resp, err
	}
	if err = validateDeadline(req.Deadline); err != nil {
		return resp, err
	}

	isGoalOrProject := req.Kind == models4prioritarius.NodeKindGoal || req.Kind == models4prioritarius.NodeKindProject
	if isGoalOrProject {
		if req.Status != "" {
			return resp, fmt.Errorf("%w: status only applies to work_item nodes, not %q", ErrValidation, req.Kind)
		}
		if req.Commitment != "" && !req.Commitment.IsValid() {
			return resp, fmt.Errorf("%w: commitment must be \"committed\", \"exploring\" or \"parked\", got %q", ErrValidation, req.Commitment)
		}
	} else {
		if req.Commitment != "" {
			return resp, fmt.Errorf("%w: commitment only applies to goal/project nodes, not work_item", ErrValidation)
		}
		if req.Status != "" && !req.Status.IsValid() {
			return resp, fmt.Errorf("%w: status must be \"open\" or \"done\", got %q", ErrValidation, req.Status)
		}
	}

	id, err := f.ids.NewID(ctx)
	if err != nil {
		return resp, fmt.Errorf("generate node id: %w", err)
	}

	node := &models4prioritarius.NodeDbo{
		ID:          id,
		Kind:        req.Kind,
		Title:       req.Title,
		Description: req.Description,
		OwnEstimate: req.OwnEstimate,
		Deadline:    req.Deadline,
	}
	if isGoalOrProject {
		commitment := req.Commitment
		if commitment == "" {
			commitment = models4prioritarius.CommitmentExploring
		}
		node.Commitment = commitment
	} else {
		status := req.Status
		if status == "" {
			status = models4prioritarius.WorkItemStatusOpen
		}
		node.Status = status
		if status == models4prioritarius.WorkItemStatusDone {
			now := f.now()
			node.DoneAt = &now
		}
	}

	err = f.db.RunReadwriteTransaction(ctx, func(ctx context.Context, tx dal.ReadwriteTransaction) error {
		if err := f.requireMember(ctx, tx, req.SpaceID, userID); err != nil {
			return err
		}
		rec, ws, err := loadWorkspace(ctx, tx, req.SpaceID)
		if err != nil {
			return err
		}
		ws.Nodes[node.ID] = node
		if node.Kind == models4prioritarius.NodeKindGoal && node.Commitment == models4prioritarius.CommitmentCommitted {
			ws.CommittedGoalOrder = append(ws.CommittedGoalOrder, node.ID)
		}
		return saveWorkspace(ctx, tx, rec)
	})
	if err != nil {
		return resp, err
	}
	resp.Node = node
	return resp, nil
}

// UpdateNodeRequest applies a partial update to an existing node. Every
// pointer/non-empty field present is applied; absent fields are left
// untouched. Explicit Clear* flags remove an optional field entirely
// (setting a pointer field back to its zero value cannot be distinguished
// from "not provided" in JSON, so clearing needs its own flag).
type UpdateNodeRequest struct {
	SpaceID string `json:"spaceID"`
	ID      string `json:"id"`

	Title            *string                       `json:"title,omitempty"`
	Description      *string                       `json:"description,omitempty"`
	ClearDescription bool                          `json:"clearDescription,omitempty"`
	OwnEstimate      *models4prioritarius.Estimate `json:"ownEstimate,omitempty"`
	ClearOwnEstimate bool                          `json:"clearOwnEstimate,omitempty"`
	Deadline         *models4prioritarius.Deadline `json:"deadline,omitempty"`
	ClearDeadline    bool                          `json:"clearDeadline,omitempty"`

	// Commitment applies to goal/project nodes only (REQ: commitment-lifecycle).
	Commitment *models4prioritarius.CommitmentState `json:"commitment,omitempty"`

	// Status applies to work_item nodes only; transitioning to "done" stamps
	// DoneAt with the server clock, transitioning to "open" clears it
	// (REQ: completion).
	Status *models4prioritarius.WorkItemStatus `json:"status,omitempty"`

	// Completed applies to goal/project nodes only. This is the ONLY way a
	// goal/project's completion flag changes — reaching 100% derived
	// progress never sets it (REQ: completion). Setting true stamps
	// CompletedAt with the server clock; setting false clears it.
	Completed *bool `json:"completed,omitempty"`
}

// UpdateNode applies a partial update to an existing node. The caller must
// be a member of the space.
func (f Facade) UpdateNode(ctx context.Context, userID string, req UpdateNodeRequest) (resp NodeResponse, err error) {
	if strings.TrimSpace(req.ID) == "" {
		return resp, fmt.Errorf("%w: id is required", ErrValidation)
	}
	if req.Title != nil && strings.TrimSpace(*req.Title) == "" {
		return resp, fmt.Errorf("%w: title must not be empty", ErrValidation)
	}
	if err = validateEstimate(req.OwnEstimate); err != nil {
		return resp, err
	}
	if err = validateDeadline(req.Deadline); err != nil {
		return resp, err
	}

	var updated *models4prioritarius.NodeDbo
	err = f.db.RunReadwriteTransaction(ctx, func(ctx context.Context, tx dal.ReadwriteTransaction) error {
		if err := f.requireMember(ctx, tx, req.SpaceID, userID); err != nil {
			return err
		}
		rec, ws, err := loadWorkspace(ctx, tx, req.SpaceID)
		if err != nil {
			return err
		}
		node, ok := ws.Nodes[req.ID]
		if !ok {
			return fmt.Errorf("%w: node %q", ErrNotFound, req.ID)
		}
		isGoalOrProject := node.Kind == models4prioritarius.NodeKindGoal || node.Kind == models4prioritarius.NodeKindProject

		if req.Title != nil {
			node.Title = *req.Title
		}
		if req.Description != nil {
			node.Description = *req.Description
		} else if req.ClearDescription {
			node.Description = ""
		}
		if req.OwnEstimate != nil {
			node.OwnEstimate = req.OwnEstimate
		} else if req.ClearOwnEstimate {
			node.OwnEstimate = nil
		}
		if req.Deadline != nil {
			node.Deadline = req.Deadline
		} else if req.ClearDeadline {
			node.Deadline = nil
		}

		if req.Commitment != nil {
			if !isGoalOrProject {
				return fmt.Errorf("%w: commitment only applies to goal/project nodes, not %q (%s)", ErrValidation, node.Kind, node.ID)
			}
			if !req.Commitment.IsValid() {
				return fmt.Errorf("%w: commitment must be \"committed\", \"exploring\" or \"parked\", got %q", ErrValidation, *req.Commitment)
			}
			wasCommitted := node.Commitment == models4prioritarius.CommitmentCommitted
			node.Commitment = *req.Commitment
			isCommitted := node.Commitment == models4prioritarius.CommitmentCommitted
			// Ordering is maintained for GOALS only (REQ: goal-ordering);
			// committed projects carry the state but no ordering guarantee.
			if node.Kind == models4prioritarius.NodeKindGoal {
				if !wasCommitted && isCommitted {
					ws.CommittedGoalOrder = append(ws.CommittedGoalOrder, node.ID)
				} else if wasCommitted && !isCommitted {
					ws.CommittedGoalOrder = removeString(ws.CommittedGoalOrder, node.ID)
				}
			}
		}

		if req.Status != nil {
			if isGoalOrProject {
				return fmt.Errorf("%w: status only applies to work_item nodes, not %q (%s)", ErrValidation, node.Kind, node.ID)
			}
			if !req.Status.IsValid() {
				return fmt.Errorf("%w: status must be \"open\" or \"done\", got %q", ErrValidation, *req.Status)
			}
			node.Status = *req.Status
			if node.Status == models4prioritarius.WorkItemStatusDone {
				now := f.now()
				node.DoneAt = &now
			} else {
				node.DoneAt = nil
			}
		}

		if req.Completed != nil {
			if !isGoalOrProject {
				return fmt.Errorf("%w: completed only applies to goal/project nodes, not %q (%s); work items use status", ErrValidation, node.Kind, node.ID)
			}
			node.Completed = *req.Completed
			if node.Completed {
				now := f.now()
				node.CompletedAt = &now
			} else {
				node.CompletedAt = nil
			}
		}

		ws.Nodes[node.ID] = node
		updated = node
		return saveWorkspace(ctx, tx, rec)
	})
	if err != nil {
		return resp, err
	}
	resp.Node = updated
	return resp, nil
}

// DeleteNodeRequest deletes a node and, atomically, everything that
// references it.
type DeleteNodeRequest struct {
	SpaceID string `json:"spaceID"`
	ID      string `json:"id"`
}

// DeleteNodeResponse reports what the atomic delete removed, so the frontend
// can update every affected local view optimistically.
type DeleteNodeResponse struct {
	ID                   string `json:"id"`
	RemovedEdges         int    `json:"removedEdges"`
	RemovedFromGoalOrder bool   `json:"removedFromGoalOrder"`
}

// DeleteNode removes a node, every edge incident to it (either direction,
// either type), and — if it was a committed goal — its entry in
// committedGoalOrder, all in one atomic write. The caller must be a member
// of the space.
func (f Facade) DeleteNode(ctx context.Context, userID string, req DeleteNodeRequest) (resp DeleteNodeResponse, err error) {
	if strings.TrimSpace(req.ID) == "" {
		return resp, fmt.Errorf("%w: id is required", ErrValidation)
	}
	err = f.db.RunReadwriteTransaction(ctx, func(ctx context.Context, tx dal.ReadwriteTransaction) error {
		if err := f.requireMember(ctx, tx, req.SpaceID, userID); err != nil {
			return err
		}
		rec, ws, err := loadWorkspace(ctx, tx, req.SpaceID)
		if err != nil {
			return err
		}
		if _, ok := ws.Nodes[req.ID]; !ok {
			return fmt.Errorf("%w: node %q", ErrNotFound, req.ID)
		}
		delete(ws.Nodes, req.ID)

		kept := ws.Edges[:0:0]
		removed := 0
		for _, e := range ws.Edges {
			if e.From == req.ID || e.To == req.ID {
				removed++
				continue
			}
			kept = append(kept, e)
		}
		ws.Edges = kept

		before := len(ws.CommittedGoalOrder)
		ws.CommittedGoalOrder = removeString(ws.CommittedGoalOrder, req.ID)

		resp = DeleteNodeResponse{
			ID:                   req.ID,
			RemovedEdges:         removed,
			RemovedFromGoalOrder: len(ws.CommittedGoalOrder) != before,
		}
		return saveWorkspace(ctx, tx, rec)
	})
	if err != nil {
		return DeleteNodeResponse{}, err
	}
	return resp, nil
}

func removeString(list []string, value string) []string {
	out := list[:0:0]
	for _, v := range list {
		if v != value {
			out = append(out, v)
		}
	}
	return out
}
