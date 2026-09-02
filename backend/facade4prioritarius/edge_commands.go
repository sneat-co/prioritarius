package facade4prioritarius

import (
	"context"
	"fmt"
	"strings"

	"github.com/dal-go/dalgo/dal"
	"github.com/sneat-co/prioritarius/backend/models4prioritarius"
)

// CreateEdgeRequest creates one directed edge. The DAG invariant is enforced
// server-side, per edge type independently (REQ: dag-invariant): a
// contributes_to cycle check never sees blocks edges and vice versa, so the
// same node pair may carry both edge types.
type CreateEdgeRequest struct {
	SpaceID  string                       `json:"spaceID"`
	From     string                       `json:"from"`
	To       string                       `json:"to"`
	Type     models4prioritarius.EdgeType `json:"type"`
	Strength *float64                     `json:"strength,omitempty"`
}

// EdgeResponse wraps a single edge — returned by create_edge so the frontend
// can update optimistically.
type EdgeResponse struct {
	Edge *models4prioritarius.EdgeDbo `json:"edge"`
}

// CreateEdge creates a from->to edge of the given type. Rejected — with the
// full graph left UNCHANGED — when it would close a cycle within that edge
// type's subgraph; the returned error wraps a *CycleError naming the
// pre-existing path (e.g. "A → B → C"). The caller must be a member of the
// space.
func (f Facade) CreateEdge(ctx context.Context, userID string, req CreateEdgeRequest) (resp EdgeResponse, err error) {
	if strings.TrimSpace(req.From) == "" || strings.TrimSpace(req.To) == "" {
		return resp, fmt.Errorf("%w: from and to are required", ErrValidation)
	}
	if !req.Type.IsValid() {
		return resp, fmt.Errorf("%w: type must be \"contributes_to\" or \"blocks\", got %q", ErrValidation, req.Type)
	}

	err = f.db.RunReadwriteTransaction(ctx, func(ctx context.Context, tx dal.ReadwriteTransaction) error {
		if err := f.requireMember(ctx, tx, req.SpaceID, userID); err != nil {
			return err
		}
		rec, ws, err := loadWorkspace(ctx, tx, req.SpaceID)
		if err != nil {
			return err
		}
		if _, ok := ws.Nodes[req.From]; !ok {
			return fmt.Errorf("%w: node %q", ErrNotFound, req.From)
		}
		if _, ok := ws.Nodes[req.To]; !ok {
			return fmt.Errorf("%w: node %q", ErrNotFound, req.To)
		}

		sameType := edgesOfType(ws.Edges, req.Type)
		if path := detectCycle(sameType, req.From, req.To); path != nil {
			// The graph is left unchanged: we return before any mutation, and
			// this whole function runs inside one dalgo transaction — dalgo
			// discards all writes of a transaction whose worker returns an
			// error (REQ: dag-invariant: "MUST NOT be partially applied").
			return newCycleError(req.Type, req.From, req.To, path)
		}

		// A pair may already carry an edge of this exact type with the same
		// direction; treat re-adding the identical edge as an idempotent
		// no-op rather than a duplicate.
		for _, e := range ws.Edges {
			if e.From == req.From && e.To == req.To && e.Type == req.Type {
				resp.Edge = &e
				return nil
			}
		}

		edge := models4prioritarius.EdgeDbo{From: req.From, To: req.To, Type: req.Type, Strength: req.Strength}
		ws.Edges = append(ws.Edges, edge)
		resp.Edge = &edge
		return saveWorkspace(ctx, tx, rec)
	})
	if err != nil {
		return EdgeResponse{}, err
	}
	return resp, nil
}

// DeleteEdgeRequest identifies one edge by its (from, to, type) triple —
// dalgo has no separate edge id (REQ: contributes-edge / REQ: blocks-edge).
type DeleteEdgeRequest struct {
	SpaceID string                       `json:"spaceID"`
	From    string                       `json:"from"`
	To      string                       `json:"to"`
	Type    models4prioritarius.EdgeType `json:"type"`
}

// DeleteEdgeResponse reports whether a matching edge was removed.
type DeleteEdgeResponse struct {
	Removed bool `json:"removed"`
}

// DeleteEdge removes one edge. Removing an edge can never close a cycle, so
// no DAG check is needed. Deleting an already-absent edge is a no-op (not an
// error) — Removed reports which happened. The caller must be a member of
// the space.
func (f Facade) DeleteEdge(ctx context.Context, userID string, req DeleteEdgeRequest) (resp DeleteEdgeResponse, err error) {
	err = f.db.RunReadwriteTransaction(ctx, func(ctx context.Context, tx dal.ReadwriteTransaction) error {
		if err := f.requireMember(ctx, tx, req.SpaceID, userID); err != nil {
			return err
		}
		rec, ws, err := loadWorkspace(ctx, tx, req.SpaceID)
		if err != nil {
			return err
		}
		kept := ws.Edges[:0:0]
		removed := false
		for _, e := range ws.Edges {
			if !removed && e.From == req.From && e.To == req.To && e.Type == req.Type {
				removed = true
				continue
			}
			kept = append(kept, e)
		}
		if !removed {
			resp.Removed = false
			return nil // no-op: nothing to save
		}
		ws.Edges = kept
		resp.Removed = true
		return saveWorkspace(ctx, tx, rec)
	})
	if err != nil {
		return DeleteEdgeResponse{}, err
	}
	return resp, nil
}
