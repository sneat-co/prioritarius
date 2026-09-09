package facade4prioritarius

import (
	"context"
	"fmt"

	"github.com/dal-go/dalgo/dal"
	"github.com/sneat-co/prioritarius/backend/models4prioritarius"
)

// TemplateStarter is a legacy id kept working as an alias of TemplatePersonal
// (see templateAliases) so nothing that already shipped against "starter"
// breaks. New callers should prefer the three catalog ids directly.
const TemplateStarter = "starter"

// The three built-in template ids (founder ruling 2026-09-02: "personal",
// "family" and "work" — content relatable to an ordinary person, a family,
// or any workplace; nothing Sneat-specific). This is the entire set of
// catalog entries in templateCatalog below.
const (
	TemplatePersonal = "personal"
	TemplateFamily   = "family"
	TemplateWork     = "work"
)

// templateAliases maps a legacy/alternate id to its canonical catalog id.
// Only "starter" exists today.
var templateAliases = map[string]string{
	TemplateStarter: TemplatePersonal,
}

// templateNode is one node in a template definition, addressed by a
// template-local key — never a real node id. Real ids are minted fresh by
// f.ids on every ApplyTemplate call, exactly as a hand-built node would be;
// nothing about a template-created node is distinguishable from
// user-created content (no "template" marker, nothing undeletable).
// ownEstimateDays is nil for deliberately unestimated work items, so the
// "n unestimated" flag (REQ: estimate-model) has something to show.
type templateNode struct {
	key             string
	kind            models4prioritarius.NodeKind
	title           string
	commitment      models4prioritarius.CommitmentState // goal/project only
	ownEstimateDays *float64
}

// templateEdge connects two templateNode keys within the same template.
type templateEdge struct {
	from, to string
	edgeType models4prioritarius.EdgeType
}

// templateDef is one catalog entry: a small, immediately recognisable graph
// definition (2-3 goals, 1-2 projects, 3-5 work items). This is DATA — the
// apply logic below only ever walks templateCatalog, so adding a fourth
// template is a data edit, never a new code branch.
type templateDef struct {
	id    string
	title string
	nodes []templateNode
	edges []templateEdge
}

// day is a small helper for the *float64 ownEstimateDays field.
func day(v float64) *float64 { return &v }

// templateCatalog is every built-in template, in display order. Every
// template defaults its goals/projects to "exploring" unless a commitment is
// given explicitly (REQ: commitment-lifecycle: "new goals and projects
// default to Exploring"), and each one deliberately commits at least one
// goal and leaves at least one exploring, so the Committed/Exploring
// distinction is visible from the moment the template lands. Each also
// leaves one or two work items without an ownEstimateDays, and carries one
// "blocks" edge alongside its "contributes_to" edges, so both product
// concepts (unestimated flag, blocking relationship) are discoverable
// immediately.
var templateCatalog = []templateDef{
	{
		id:    TemplatePersonal,
		title: "Personal goals",
		nodes: []templateNode{
			{key: "g1", kind: models4prioritarius.NodeKindGoal, title: "Get physically healthier", commitment: models4prioritarius.CommitmentCommitted},
			{key: "g2", kind: models4prioritarius.NodeKindGoal, title: "Learn a new language", commitment: models4prioritarius.CommitmentExploring},
			{key: "p1", kind: models4prioritarius.NodeKindProject, title: "Build a workout habit", commitment: models4prioritarius.CommitmentExploring},
			{key: "p2", kind: models4prioritarius.NodeKindProject, title: "Study Spanish basics", commitment: models4prioritarius.CommitmentExploring},
			{key: "w1", kind: models4prioritarius.NodeKindWorkItem, title: "Buy running shoes", ownEstimateDays: day(0.5)},
			{key: "w2", kind: models4prioritarius.NodeKindWorkItem, title: "Go for a run three times this week", ownEstimateDays: day(2)},
			{key: "w3", kind: models4prioritarius.NodeKindWorkItem, title: "Pick a language app and set a daily reminder", ownEstimateDays: day(0.5)},
			{key: "w4", kind: models4prioritarius.NodeKindWorkItem, title: "Complete the first 10 lessons"},
			{key: "w5", kind: models4prioritarius.NodeKindWorkItem, title: "Practice conversation for 15 minutes a day"},
		},
		edges: []templateEdge{
			{from: "p1", to: "g1", edgeType: models4prioritarius.EdgeTypeContributesTo},
			{from: "p2", to: "g2", edgeType: models4prioritarius.EdgeTypeContributesTo},
			{from: "w1", to: "p1", edgeType: models4prioritarius.EdgeTypeContributesTo},
			{from: "w2", to: "p1", edgeType: models4prioritarius.EdgeTypeContributesTo},
			{from: "w3", to: "p2", edgeType: models4prioritarius.EdgeTypeContributesTo},
			{from: "w4", to: "p2", edgeType: models4prioritarius.EdgeTypeContributesTo},
			{from: "w5", to: "p2", edgeType: models4prioritarius.EdgeTypeContributesTo},
			{from: "w1", to: "w2", edgeType: models4prioritarius.EdgeTypeBlocks},
		},
	},
	{
		id:    TemplateFamily,
		title: "Family goals",
		nodes: []templateNode{
			{key: "g1", kind: models4prioritarius.NodeKindGoal, title: "Plan a memorable family vacation", commitment: models4prioritarius.CommitmentExploring},
			{key: "g2", kind: models4prioritarius.NodeKindGoal, title: "Get the household finances organized", commitment: models4prioritarius.CommitmentCommitted},
			{key: "p1", kind: models4prioritarius.NodeKindProject, title: "Plan the summer trip", commitment: models4prioritarius.CommitmentExploring},
			{key: "p2", kind: models4prioritarius.NodeKindProject, title: "Set up a monthly budget", commitment: models4prioritarius.CommitmentExploring},
			{key: "w1", kind: models4prioritarius.NodeKindWorkItem, title: "Agree on destination and dates", ownEstimateDays: day(1)},
			{key: "w2", kind: models4prioritarius.NodeKindWorkItem, title: "Book flights and accommodation", ownEstimateDays: day(1)},
			{key: "w3", kind: models4prioritarius.NodeKindWorkItem, title: "List monthly income and expenses", ownEstimateDays: day(1)},
			{key: "w4", kind: models4prioritarius.NodeKindWorkItem, title: "Set a savings goal and pick a budgeting app"},
			{key: "w5", kind: models4prioritarius.NodeKindWorkItem, title: "Review the budget together as a family"},
		},
		edges: []templateEdge{
			{from: "p1", to: "g1", edgeType: models4prioritarius.EdgeTypeContributesTo},
			{from: "p2", to: "g2", edgeType: models4prioritarius.EdgeTypeContributesTo},
			{from: "w1", to: "p1", edgeType: models4prioritarius.EdgeTypeContributesTo},
			{from: "w2", to: "p1", edgeType: models4prioritarius.EdgeTypeContributesTo},
			{from: "w3", to: "p2", edgeType: models4prioritarius.EdgeTypeContributesTo},
			{from: "w4", to: "p2", edgeType: models4prioritarius.EdgeTypeContributesTo},
			{from: "w5", to: "p2", edgeType: models4prioritarius.EdgeTypeContributesTo},
			{from: "w1", to: "w2", edgeType: models4prioritarius.EdgeTypeBlocks},
		},
	},
	{
		id:    TemplateWork,
		title: "Work goals",
		nodes: []templateNode{
			{key: "g1", kind: models4prioritarius.NodeKindGoal, title: "Ship the current project on time", commitment: models4prioritarius.CommitmentCommitted},
			{key: "g2", kind: models4prioritarius.NodeKindGoal, title: "Improve team onboarding", commitment: models4prioritarius.CommitmentExploring},
			{key: "p1", kind: models4prioritarius.NodeKindProject, title: "Deliver the current feature", commitment: models4prioritarius.CommitmentExploring},
			{key: "p2", kind: models4prioritarius.NodeKindProject, title: "Write the onboarding guide", commitment: models4prioritarius.CommitmentExploring},
			{key: "w1", kind: models4prioritarius.NodeKindWorkItem, title: "Finalize requirements with stakeholders", ownEstimateDays: day(2)},
			{key: "w2", kind: models4prioritarius.NodeKindWorkItem, title: "Build and test the feature", ownEstimateDays: day(5)},
			{key: "w3", kind: models4prioritarius.NodeKindWorkItem, title: "Draft the onboarding checklist", ownEstimateDays: day(1)},
			{key: "w4", kind: models4prioritarius.NodeKindWorkItem, title: "Collect feedback from recent new hires"},
			{key: "w5", kind: models4prioritarius.NodeKindWorkItem, title: "Publish the guide to the team wiki"},
		},
		edges: []templateEdge{
			{from: "p1", to: "g1", edgeType: models4prioritarius.EdgeTypeContributesTo},
			{from: "p2", to: "g2", edgeType: models4prioritarius.EdgeTypeContributesTo},
			{from: "w1", to: "p1", edgeType: models4prioritarius.EdgeTypeContributesTo},
			{from: "w2", to: "p1", edgeType: models4prioritarius.EdgeTypeContributesTo},
			{from: "w3", to: "p2", edgeType: models4prioritarius.EdgeTypeContributesTo},
			{from: "w4", to: "p2", edgeType: models4prioritarius.EdgeTypeContributesTo},
			{from: "w5", to: "p2", edgeType: models4prioritarius.EdgeTypeContributesTo},
			{from: "w1", to: "w2", edgeType: models4prioritarius.EdgeTypeBlocks},
		},
	},
}

// findTemplate resolves id (through templateAliases first) to its catalog
// entry, or a wrapped ErrValidation naming the unknown id.
func findTemplate(id string) (*templateDef, error) {
	if canonical, ok := templateAliases[id]; ok {
		id = canonical
	}
	for i := range templateCatalog {
		if templateCatalog[i].id == id {
			return &templateCatalog[i], nil
		}
	}
	return nil, fmt.Errorf("%w: unknown templateId %q", ErrValidation, id)
}

// ApplyTemplateRequest creates one catalog template's nodes+edges in one
// transaction. TemplateID defaults to TemplatePersonal (via TemplateStarter
// historically) when empty.
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

// ApplyTemplate creates the named catalog template's nodes and edges
// atomically. The caller must be a member of the space. Every created node
// is ordinary editable/deletable content — nothing marks it as
// template-derived.
func (f Facade) ApplyTemplate(ctx context.Context, userID string, req ApplyTemplateRequest) (resp ApplyTemplateResponse, err error) {
	templateID := req.TemplateID
	if templateID == "" {
		templateID = TemplatePersonal
	}
	def, err := findTemplate(templateID)
	if err != nil {
		return resp, err
	}

	// Mint a fresh real id for every template-local key BEFORE the
	// transaction, exactly like the original single-template implementation
	// did — id generation is not transactional here.
	realID := make(map[string]string, len(def.nodes))
	nodes := make([]*models4prioritarius.NodeDbo, 0, len(def.nodes))
	for _, tn := range def.nodes {
		id, err := f.ids.NewID(ctx)
		if err != nil {
			return resp, fmt.Errorf("generate id for %s: %w", tn.key, err)
		}
		realID[tn.key] = id

		node := &models4prioritarius.NodeDbo{
			ID:    id,
			Kind:  tn.kind,
			Title: tn.title,
		}
		if tn.ownEstimateDays != nil {
			node.OwnEstimate = &models4prioritarius.Estimate{
				Value: *tn.ownEstimateDays,
				Unit:  models4prioritarius.EstimateUnitDays,
			}
		}
		switch tn.kind {
		case models4prioritarius.NodeKindWorkItem:
			node.Status = models4prioritarius.WorkItemStatusOpen
		default: // goal, project
			node.Commitment = tn.commitment
		}
		nodes = append(nodes, node)
	}

	edges := make([]models4prioritarius.EdgeDbo, 0, len(def.edges))
	for _, te := range def.edges {
		edges = append(edges, models4prioritarius.EdgeDbo{
			From: realID[te.from], To: realID[te.to], Type: te.edgeType,
		})
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

// TemplatePreview is one catalog entry's id, display title, and the goal
// titles it would create — the compact preview the frontend renders before
// a template is applied (founder 2026-09-02: "or start with a template
// where template has compact preview of goals it will create"). GoalTitles
// is ALWAYS exactly what ApplyTemplate would create for this id, in the same
// order — see TestFacade_ListTemplates_MatchesApplyTemplate, which asserts
// this equivalence directly so the preview can never drift from reality.
type TemplatePreview struct {
	ID         string   `json:"id"`
	Title      string   `json:"title"`
	GoalTitles []string `json:"goalTitles"`
}

// ListTemplatesResponse returns every built-in template's preview, in
// catalog (display) order. Legacy aliases (TemplateStarter) are not listed
// as separate entries — the alias resolves to its canonical entry when
// applied.
type ListTemplatesResponse struct {
	Templates []TemplatePreview `json:"templates"`
}

// ListTemplates returns the catalog's previews. It needs an identified
// caller (consistent with every other endpoint here) but no space and no
// membership check — the catalog is static and identical for every caller.
func (f Facade) ListTemplates(ctx context.Context, userID string) (ListTemplatesResponse, error) {
	if userID == "" {
		return ListTemplatesResponse{}, ErrUnauthorized
	}
	previews := make([]TemplatePreview, 0, len(templateCatalog))
	for _, def := range templateCatalog {
		var goalTitles []string
		for _, n := range def.nodes {
			if n.kind == models4prioritarius.NodeKindGoal {
				goalTitles = append(goalTitles, n.title)
			}
		}
		previews = append(previews, TemplatePreview{ID: def.id, Title: def.title, GoalTitles: goalTitles})
	}
	return ListTemplatesResponse{Templates: previews}, nil
}
