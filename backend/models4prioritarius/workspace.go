// Package models4prioritarius holds Prioritarius's storage-layer types: the
// DBOs persisted to Firestore (via dalgo) and the dalgo key builders that
// place them under a Space, per the domain model at
// backstage/spec/features/prioritarius/domain-model/README.md. It mirrors
// the semantics of the TypeScript reference implementation at
// prioritarius/libs/core (see that package's README) exactly — this is a
// storage-layer port of the same rules, not a redesign.
package models4prioritarius

import "time"

// EstimateUnit is the workspace-wide default effort unit. 1 day =
// HoursPerDay hours (matches libs/core's HOURS_PER_DAY).
type EstimateUnit string

const (
	EstimateUnitHours EstimateUnit = "hours"
	EstimateUnitDays  EstimateUnit = "days"
)

// IsValid reports whether u is one of the two known estimate units.
func (u EstimateUnit) IsValid() bool {
	switch u {
	case EstimateUnitHours, EstimateUnitDays:
		return true
	default:
		return false
	}
}

// HoursPerDay mirrors libs/core's HOURS_PER_DAY conversion constant.
const HoursPerDay = 8

// UnestimatedDefaultDays mirrors libs/core's UNESTIMATED_DEFAULT_DAYS: the
// flagged default effective estimate (in days) for a work item with neither
// an own estimate nor estimated contributors.
const UnestimatedDefaultDays = 1

// NodeKind is one of the three node kinds a workspace MUST contain
// (REQ: node-kinds). No fixed decomposition depth is implied for work items.
type NodeKind string

const (
	NodeKindGoal     NodeKind = "goal"
	NodeKindProject  NodeKind = "project"
	NodeKindWorkItem NodeKind = "work_item"
)

// IsValid reports whether k is one of the three known node kinds.
func (k NodeKind) IsValid() bool {
	switch k {
	case NodeKindGoal, NodeKindProject, NodeKindWorkItem:
		return true
	default:
		return false
	}
}

// CommitmentState is the commitment lifecycle of a goal/project node
// (REQ: commitment-lifecycle). New goals/projects default to
// CommitmentExploring; committing is a deliberate act.
type CommitmentState string

const (
	CommitmentCommitted CommitmentState = "committed"
	CommitmentExploring CommitmentState = "exploring"
	CommitmentParked    CommitmentState = "parked"
)

// IsValid reports whether c is one of the three known commitment states.
func (c CommitmentState) IsValid() bool {
	switch c {
	case CommitmentCommitted, CommitmentExploring, CommitmentParked:
		return true
	default:
		return false
	}
}

// WorkItemStatus is a work item's open/done lifecycle (REQ: completion).
type WorkItemStatus string

const (
	WorkItemStatusOpen WorkItemStatus = "open"
	WorkItemStatusDone WorkItemStatus = "done"
)

// IsValid reports whether s is one of the two known work-item statuses.
func (s WorkItemStatus) IsValid() bool {
	switch s {
	case WorkItemStatusOpen, WorkItemStatusDone:
		return true
	default:
		return false
	}
}

// EdgeType is one of the two edge types. Each is DAG-enforced independently
// over its own subgraph (REQ: dag-invariant), so a node pair may carry both.
type EdgeType string

const (
	// EdgeTypeContributesTo: completing From advances To (many-to-many).
	EdgeTypeContributesTo EdgeType = "contributes_to"
	// EdgeTypeBlocks: To cannot start until From completes. No contribution
	// semantics (REQ: blocks-edge).
	EdgeTypeBlocks EdgeType = "blocks"
)

// IsValid reports whether t is one of the two known edge types.
func (t EdgeType) IsValid() bool {
	switch t {
	case EdgeTypeContributesTo, EdgeTypeBlocks:
		return true
	default:
		return false
	}
}

// Estimate is an own (manually entered) effort estimate in either unit
// (REQ: estimate-model). Never overwritten by any derivation.
type Estimate struct {
	Value float64      `firestore:"value" json:"value"`
	Unit  EstimateUnit `firestore:"unit" json:"unit"`
}

// Deadline is a date plus a hard/soft flag (REQ: deadline-model). A hard
// deadline is a contract, launch or regulatory date; a soft one is
// informational only — this package enforces nothing from it.
type Deadline struct {
	// Date is an ISO yyyy-mm-dd string.
	Date string `firestore:"date" json:"date"`
	Hard bool   `firestore:"hard" json:"hard"`
}

// NodeDbo is one graph node: a goal, project or work item. All three kinds
// share one document shape (Firestore is schemaless); Kind discriminates
// which of the kind-specific fields below are meaningful:
//
//   - goal / project: Commitment, Completed, CompletedAt.
//   - work_item: Status, DoneAt.
//
// Completion is NEVER automatic (REQ: completion): Completed and Status
// change only through an explicit update_node call — reaching 100% derived
// progress never sets either.
type NodeDbo struct {
	ID          string    `firestore:"id" json:"id"`
	Kind        NodeKind  `firestore:"kind" json:"kind"`
	Title       string    `firestore:"title" json:"title"`
	Description string    `firestore:"description,omitempty" json:"description,omitempty"`
	OwnEstimate *Estimate `firestore:"ownEstimate,omitempty" json:"ownEstimate,omitempty"`
	Deadline    *Deadline `firestore:"deadline,omitempty" json:"deadline,omitempty"`

	// Status and DoneAt apply to work_item nodes only.
	Status WorkItemStatus `firestore:"status,omitempty" json:"status,omitempty"`
	DoneAt *time.Time     `firestore:"doneAt,omitempty" json:"doneAt,omitempty"`

	// Commitment, Completed and CompletedAt apply to goal/project nodes only.
	Commitment  CommitmentState `firestore:"commitment,omitempty" json:"commitment,omitempty"`
	Completed   bool            `firestore:"completed,omitempty" json:"completed,omitempty"`
	CompletedAt *time.Time      `firestore:"completedAt,omitempty" json:"completedAt,omitempty"`
}

// EdgeDbo is one directed edge. Strength is reserved for future weighting
// and is unused by every MVP derivation (REQ: contributes-edge).
type EdgeDbo struct {
	From     string   `firestore:"from" json:"from"`
	To       string   `firestore:"to" json:"to"`
	Type     EdgeType `firestore:"type" json:"type"`
	Strength *float64 `firestore:"strength,omitempty" json:"strength,omitempty"`
}

// WorkspaceDbo is the ENTIRE Prioritarius graph for one Space, stored as a
// single Firestore document at /spaces/{spaceID}/ext/prioritarius. A
// workspace IS a Space (founder ruling 2026-09-02, REQ: workspace); there is
// exactly one per Space.
//
// Deliberately one document, not one per node/edge: the DAG invariant
// (create_edge, REQ: dag-invariant) and the cascading delete (delete_node:
// incident edges + committed-goal order, all atomically) must never be
// partially applied (REQ: writes-are-backend-mediated), and a single
// document Get+Set inside one dalgo transaction gives that for free — no
// cross-document transaction, no collection query to enumerate a space's
// edges. MVP-scale graphs (up to a few thousand nodes/edges) stay well under
// Firestore's 1MiB document limit.
type WorkspaceDbo struct {
	Unit  EstimateUnit        `firestore:"unit" json:"unit"`
	Nodes map[string]*NodeDbo `firestore:"nodes" json:"nodes"`
	Edges []EdgeDbo           `firestore:"edges" json:"edges"`
	// CommittedGoalOrder is the ordered list of committed GOAL ids
	// (REQ: goal-ordering). Committed projects carry the same Commitment
	// state but no ordering guarantee — the spec text singles out goals.
	CommittedGoalOrder []string `firestore:"committedGoalOrder" json:"committedGoalOrder"`
}

// NewWorkspaceDbo returns a fresh, empty workspace. Default unit is days,
// matching libs/core's createWorkspace default.
func NewWorkspaceDbo() *WorkspaceDbo {
	return &WorkspaceDbo{
		Unit:  EstimateUnitDays,
		Nodes: map[string]*NodeDbo{},
	}
}
