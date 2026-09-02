package facade4prioritarius

import (
	"context"
	"fmt"

	"github.com/dal-go/dalgo/dal"
)

// SetGoalOrderRequest reorders the committed-goal list (REQ: goal-ordering).
// GoalIDs MUST be exactly the current committedGoalOrder (a permutation) —
// this endpoint reorders; it does not commit or park goals (use update_node
// for that, which maintains the set automatically).
type SetGoalOrderRequest struct {
	SpaceID string   `json:"spaceID"`
	GoalIDs []string `json:"goalIds"`
}

// SetGoalOrderResponse carries the new order back for optimistic update.
type SetGoalOrderResponse struct {
	CommittedGoalOrder []string `json:"committedGoalOrder"`
}

// SetGoalOrder reorders the committed-goal list. The caller must be a member
// of the space.
func (f Facade) SetGoalOrder(ctx context.Context, userID string, req SetGoalOrderRequest) (resp SetGoalOrderResponse, err error) {
	err = f.db.RunReadwriteTransaction(ctx, func(ctx context.Context, tx dal.ReadwriteTransaction) error {
		if err := f.requireMember(ctx, tx, req.SpaceID, userID); err != nil {
			return err
		}
		rec, ws, err := loadWorkspace(ctx, tx, req.SpaceID)
		if err != nil {
			return err
		}
		if !sameStringSet(ws.CommittedGoalOrder, req.GoalIDs) {
			return fmt.Errorf(
				"%w: goalIds must be exactly the current committed goals (%s), got (%s)",
				ErrValidation, FormatPath(ws.CommittedGoalOrder), FormatPath(req.GoalIDs),
			)
		}
		ws.CommittedGoalOrder = append([]string{}, req.GoalIDs...)
		resp.CommittedGoalOrder = ws.CommittedGoalOrder
		return saveWorkspace(ctx, tx, rec)
	})
	if err != nil {
		return SetGoalOrderResponse{}, err
	}
	return resp, nil
}

// sameStringSet reports whether a and b contain the same elements with the
// same multiplicities, ignoring order.
func sameStringSet(a, b []string) bool {
	if len(a) != len(b) {
		return false
	}
	counts := make(map[string]int, len(a))
	for _, v := range a {
		counts[v]++
	}
	for _, v := range b {
		counts[v]--
		if counts[v] < 0 {
			return false
		}
	}
	for _, c := range counts {
		if c != 0 {
			return false
		}
	}
	return true
}
