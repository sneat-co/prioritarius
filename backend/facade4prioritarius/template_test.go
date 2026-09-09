package facade4prioritarius

import (
	"context"
	"errors"
	"fmt"
	"testing"

	"github.com/sneat-co/prioritarius/backend/models4prioritarius"
)

// idsFor returns a deterministic id sequence long enough for def's nodes,
// prefixed so ids never collide across templates in a shared test DB.
func idsFor(def templateDef) []string {
	ids := make([]string, len(def.nodes))
	for i := range ids {
		ids[i] = fmt.Sprintf("%s-n%d", def.id, i)
	}
	return ids
}

func findCatalogDef(t *testing.T, id string) templateDef {
	t.Helper()
	for _, def := range templateCatalog {
		if def.id == id {
			return def
		}
	}
	t.Fatalf("no catalog entry for %q", id)
	return templateDef{}
}

// TestFacade_ApplyTemplate_Catalog is table-driven over the ENTIRE catalog:
// every template must apply cleanly, produce the promised node/edge shape,
// create no cycle, and respect commitment/estimate defaults.
func TestFacade_ApplyTemplate_Catalog(t *testing.T) {
	for _, def := range templateCatalog {
		def := def
		t.Run(def.id, func(t *testing.T) {
			f, _ := newTestFacade(idsFor(def))
			resp, err := f.ApplyTemplate(context.Background(), testUserID, ApplyTemplateRequest{SpaceID: testSpaceID, TemplateID: def.id})
			if err != nil {
				t.Fatalf("ApplyTemplate(%s): %v", def.id, err)
			}

			if len(resp.Nodes) != len(def.nodes) {
				t.Fatalf("len(Nodes) = %d, want %d", len(resp.Nodes), len(def.nodes))
			}
			if len(resp.Edges) != len(def.edges) {
				t.Fatalf("len(Edges) = %d, want %d", len(resp.Edges), len(def.edges))
			}

			var goals, projects, workItems, exploringGoals, committedGoals, unestimated int
			for i, n := range resp.Nodes {
				want := def.nodes[i]
				if n.ID == "" {
					t.Errorf("node[%d] has empty ID", i)
				}
				if n.Title != want.title {
					t.Errorf("node[%d].Title = %q, want %q", i, n.Title, want.title)
				}
				switch n.Kind {
				case models4prioritarius.NodeKindGoal:
					goals++
					switch n.Commitment {
					case models4prioritarius.CommitmentExploring:
						exploringGoals++
					case models4prioritarius.CommitmentCommitted:
						committedGoals++
					}
					if n.Commitment != want.commitment {
						t.Errorf("node[%d].Commitment = %q, want %q", i, n.Commitment, want.commitment)
					}
				case models4prioritarius.NodeKindProject:
					projects++
					if n.Commitment != want.commitment {
						t.Errorf("node[%d].Commitment = %q, want %q", i, n.Commitment, want.commitment)
					}
				case models4prioritarius.NodeKindWorkItem:
					workItems++
					if n.Status != models4prioritarius.WorkItemStatusOpen {
						t.Errorf("node[%d].Status = %q, want open", i, n.Status)
					}
					if want.ownEstimateDays == nil {
						if n.OwnEstimate != nil {
							t.Errorf("node[%d].OwnEstimate = %v, want nil", i, n.OwnEstimate)
						}
						unestimated++
					} else {
						if n.OwnEstimate == nil || n.OwnEstimate.Value != *want.ownEstimateDays || n.OwnEstimate.Unit != models4prioritarius.EstimateUnitDays {
							t.Errorf("node[%d].OwnEstimate = %v, want {%v days}", i, n.OwnEstimate, *want.ownEstimateDays)
						}
					}
				default:
					t.Errorf("node[%d] has unexpected kind %q", i, n.Kind)
				}
			}

			if goals < 2 || goals > 3 {
				t.Errorf("goals = %d, want 2-3", goals)
			}
			if projects < 1 || projects > 2 {
				t.Errorf("projects = %d, want 1-2", projects)
			}
			if workItems < 3 || workItems > 5 {
				t.Errorf("workItems = %d, want 3-5", workItems)
			}
			if exploringGoals == 0 {
				t.Error("expected at least one goal committed=exploring (core commitment-lifecycle concept)")
			}
			if committedGoals == 0 {
				t.Error("expected at least one goal committed=committed")
			}
			if unestimated == 0 {
				t.Error("expected at least one deliberately unestimated work item")
			}

			// dag-invariant: the applied edges must really form a DAG, not just
			// count right. Reversing the first edge (a direct contributes_to
			// project->goal edge, per every catalog entry above) must be
			// rejected as a two-node cycle.
			first := resp.Edges[0]
			_, err = f.CreateEdge(context.Background(), testUserID, CreateEdgeRequest{
				SpaceID: testSpaceID, From: first.To, To: first.From, Type: first.Type,
			})
			var cycleErr *CycleError
			if !errors.As(err, &cycleErr) {
				t.Fatalf("expected reversing the first applied edge to cycle-reject; error = %v", err)
			}
		})
	}
}

// TestFacade_ApplyTemplate_CatalogHasBlocksEdgeSomewhere proves the "blocks"
// relationship is discoverable from at least one catalog template (not
// necessarily every one).
func TestFacade_ApplyTemplate_CatalogHasBlocksEdgeSomewhere(t *testing.T) {
	for _, def := range templateCatalog {
		for _, e := range def.edges {
			if e.edgeType == models4prioritarius.EdgeTypeBlocks {
				return
			}
		}
	}
	t.Fatal("no template in the catalog defines a \"blocks\" edge")
}

// TestFacade_ApplyTemplate_StarterAliasesPersonal proves "starter" still
// resolves, and resolves to exactly what "personal" produces.
func TestFacade_ApplyTemplate_StarterAliasesPersonal(t *testing.T) {
	personalDef := findCatalogDef(t, TemplatePersonal)
	ids := idsFor(personalDef)

	fPersonal, _ := newTestFacade(ids)
	wantResp, err := fPersonal.ApplyTemplate(context.Background(), testUserID, ApplyTemplateRequest{SpaceID: testSpaceID, TemplateID: TemplatePersonal})
	if err != nil {
		t.Fatalf("ApplyTemplate(personal): %v", err)
	}

	fStarter, _ := newTestFacade(ids)
	gotResp, err := fStarter.ApplyTemplate(context.Background(), testUserID, ApplyTemplateRequest{SpaceID: testSpaceID, TemplateID: TemplateStarter})
	if err != nil {
		t.Fatalf("ApplyTemplate(starter): %v", err)
	}

	if len(gotResp.Nodes) != len(wantResp.Nodes) || len(gotResp.Edges) != len(wantResp.Edges) {
		t.Fatalf("starter shape = %d nodes / %d edges, want %d / %d", len(gotResp.Nodes), len(gotResp.Edges), len(wantResp.Nodes), len(wantResp.Edges))
	}
	for i := range wantResp.Nodes {
		if gotResp.Nodes[i].Title != wantResp.Nodes[i].Title || gotResp.Nodes[i].Kind != wantResp.Nodes[i].Kind {
			t.Errorf("starter node[%d] = %+v, want %+v", i, gotResp.Nodes[i], wantResp.Nodes[i])
		}
	}
}

// TestFacade_ApplyTemplate_DefaultIsPersonal proves an empty templateId
// resolves the same as "personal".
func TestFacade_ApplyTemplate_DefaultIsPersonal(t *testing.T) {
	personalDef := findCatalogDef(t, TemplatePersonal)
	ids := idsFor(personalDef)

	f, _ := newTestFacade(ids)
	resp, err := f.ApplyTemplate(context.Background(), testUserID, ApplyTemplateRequest{SpaceID: testSpaceID})
	if err != nil {
		t.Fatalf("ApplyTemplate(default): %v", err)
	}
	if len(resp.Nodes) != len(personalDef.nodes) {
		t.Fatalf("len(Nodes) = %d, want %d", len(resp.Nodes), len(personalDef.nodes))
	}
}

func TestFacade_ApplyTemplate_UnknownTemplateIsRejected(t *testing.T) {
	f, _ := newTestFacade([]string{"g1"})
	_, err := f.ApplyTemplate(context.Background(), testUserID, ApplyTemplateRequest{SpaceID: testSpaceID, TemplateID: "does-not-exist"})
	if !errors.Is(err, ErrValidation) {
		t.Errorf("error = %v, want ErrValidation", err)
	}
}

// --- ListTemplates ---

func TestFacade_ListTemplates_ReturnsWholeCatalog(t *testing.T) {
	f, _ := newTestFacade(nil)
	resp, err := f.ListTemplates(context.Background(), testUserID)
	if err != nil {
		t.Fatalf("ListTemplates: %v", err)
	}
	if len(resp.Templates) != len(templateCatalog) {
		t.Fatalf("len(Templates) = %d, want %d", len(resp.Templates), len(templateCatalog))
	}
	wantIDs := map[string]bool{TemplatePersonal: true, TemplateFamily: true, TemplateWork: true}
	for _, preview := range resp.Templates {
		if !wantIDs[preview.ID] {
			t.Errorf("unexpected template id %q in catalog", preview.ID)
		}
		if preview.Title == "" {
			t.Errorf("template %q has empty title", preview.ID)
		}
		if len(preview.GoalTitles) < 2 || len(preview.GoalTitles) > 3 {
			t.Errorf("template %q has %d goal titles, want 2-3", preview.ID, len(preview.GoalTitles))
		}
	}
}

func TestFacade_ListTemplates_RejectsUnauthenticated(t *testing.T) {
	f, _ := newTestFacade(nil)
	_, err := f.ListTemplates(context.Background(), "")
	if !errors.Is(err, ErrUnauthorized) {
		t.Errorf("error = %v, want ErrUnauthorized", err)
	}
}

// TestFacade_ListTemplates_MatchesApplyTemplate is the equivalence test the
// brief calls out as the point: list_templates' preview goal titles MUST
// match what apply_template actually creates for the same id — a preview
// that lies is the failure mode this guards against.
func TestFacade_ListTemplates_MatchesApplyTemplate(t *testing.T) {
	fList, _ := newTestFacade(nil)
	listResp, err := fList.ListTemplates(context.Background(), testUserID)
	if err != nil {
		t.Fatalf("ListTemplates: %v", err)
	}

	for _, preview := range listResp.Templates {
		preview := preview
		t.Run(preview.ID, func(t *testing.T) {
			def := findCatalogDef(t, preview.ID)
			f, _ := newTestFacade(idsFor(def))
			applyResp, err := f.ApplyTemplate(context.Background(), testUserID, ApplyTemplateRequest{SpaceID: testSpaceID, TemplateID: preview.ID})
			if err != nil {
				t.Fatalf("ApplyTemplate(%s): %v", preview.ID, err)
			}

			var gotGoalTitles []string
			for _, n := range applyResp.Nodes {
				if n.Kind == models4prioritarius.NodeKindGoal {
					gotGoalTitles = append(gotGoalTitles, n.Title)
				}
			}
			if len(gotGoalTitles) != len(preview.GoalTitles) {
				t.Fatalf("apply created goal titles = %v, preview promised = %v", gotGoalTitles, preview.GoalTitles)
			}
			for i := range gotGoalTitles {
				if gotGoalTitles[i] != preview.GoalTitles[i] {
					t.Errorf("goal[%d] = %q, preview promised %q", i, gotGoalTitles[i], preview.GoalTitles[i])
				}
			}
		})
	}
}
