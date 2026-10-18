package api4prioritarius

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/dal-go/dalgo/dal"
	"github.com/sneat-co/prioritarius/backend/facade4prioritarius"
	"github.com/sneat-co/sneat-go-core/sneatcoretesting"
)

type fakeIDGenerator struct{ next string }

func (f fakeIDGenerator) NewID(context.Context) (string, error) { return f.next, nil }

type allowAllMembership struct{}

func (allowAllMembership) IsSpaceMember(context.Context, dal.ReadSession, string, string) (bool, error) {
	return true, nil
}

type fakeIdentity struct{ userID string }

func (f fakeIdentity) UserID(_ context.Context, token string) (string, bool) {
	if token == "" {
		return "", false
	}
	return f.userID, true
}

func newTestHandler() *Handler {
	facade := facade4prioritarius.NewFacade(sneatcoretesting.NewMemoryDB(), fakeIDGenerator{next: "n1"}, allowAllMembership{})
	return NewHandler(facade, fakeIdentity{userID: "user1"})
}

// TestRegisterHttpRoutes_MountsAllRoutes exercises the RegisterHttpRoutes
// wiring itself — proves the assignability trick documented on it (an
// unnamed func-type parameter accepting extension.HTTPHandleFunc-shaped
// values without importing sneat-go-core) actually registers every route.
func TestRegisterHttpRoutes_MountsAllRoutes(t *testing.T) {
	h := newTestHandler()
	mux := http.NewServeMux()
	registered := map[string]bool{}
	h.RegisterHttpRoutes(func(method, path string, handler http.HandlerFunc) {
		registered[method+" "+path] = true
		mux.Handle(path, handler)
	})

	want := []string{
		"POST /v0/prioritarius/create_node",
		"POST /v0/prioritarius/update_node",
		"POST /v0/prioritarius/delete_node",
		"POST /v0/prioritarius/create_edge",
		"POST /v0/prioritarius/delete_edge",
		"POST /v0/prioritarius/set_goal_order",
		"POST /v0/prioritarius/apply_template",
		"POST /v0/prioritarius/list_templates",
	}
	for _, route := range want {
		if !registered[route] {
			t.Errorf("route %q was not registered", route)
		}
	}

	// End-to-end smoke: create_node through the real mux.
	body, _ := json.Marshal(facade4prioritarius.CreateNodeRequest{SpaceID: "space1", Kind: "goal", Title: "Ship it"})
	req := httptest.NewRequest(http.MethodPost, "/v0/prioritarius/create_node", bytes.NewReader(body))
	req.Header.Set("Authorization", "Bearer test-token")
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)
	if rec.Code != http.StatusCreated {
		t.Fatalf("status = %d, body = %s", rec.Code, rec.Body.String())
	}
	var resp facade4prioritarius.NodeResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if resp.Node == nil || resp.Node.ID != "n1" {
		t.Errorf("Node = %+v, want id n1", resp.Node)
	}
}

func TestHttpCreateNode_Unauthorized(t *testing.T) {
	h := newTestHandler()
	body, _ := json.Marshal(facade4prioritarius.CreateNodeRequest{SpaceID: "space1", Kind: "goal", Title: "x"})
	req := httptest.NewRequest(http.MethodPost, "/v0/prioritarius/create_node", bytes.NewReader(body))
	rec := httptest.NewRecorder()
	h.httpCreateNode(rec, req)
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d, want 401", rec.Code)
	}
}

func TestHttpCreateEdge_CycleReturnsConflictWithPath(t *testing.T) {
	facade := facade4prioritarius.NewFacade(sneatcoretesting.NewMemoryDB(), &sequentialIDs{ids: []string{"A", "B", "C"}}, allowAllMembership{})
	h := NewHandler(facade, fakeIdentity{userID: "user1"})
	ctx := context.Background()
	for _, id := range []string{"A", "B", "C"} {
		if _, err := facade.CreateNode(ctx, "user1", facade4prioritarius.CreateNodeRequest{SpaceID: "space1", Kind: "work_item", Title: id}); err != nil {
			t.Fatalf("setup CreateNode %s: %v", id, err)
		}
	}
	if _, err := facade.CreateEdge(ctx, "user1", facade4prioritarius.CreateEdgeRequest{SpaceID: "space1", From: "A", To: "B", Type: "contributes_to"}); err != nil {
		t.Fatalf("setup CreateEdge A->B: %v", err)
	}
	if _, err := facade.CreateEdge(ctx, "user1", facade4prioritarius.CreateEdgeRequest{SpaceID: "space1", From: "B", To: "C", Type: "contributes_to"}); err != nil {
		t.Fatalf("setup CreateEdge B->C: %v", err)
	}

	body, _ := json.Marshal(facade4prioritarius.CreateEdgeRequest{SpaceID: "space1", From: "C", To: "A", Type: "contributes_to"})
	req := httptest.NewRequest(http.MethodPost, "/v0/prioritarius/create_edge", bytes.NewReader(body))
	req.Header.Set("Authorization", "Bearer test-token")
	rec := httptest.NewRecorder()
	h.httpCreateEdge(rec, req)
	if rec.Code != http.StatusConflict {
		t.Fatalf("status = %d, body = %s", rec.Code, rec.Body.String())
	}
	var payload struct {
		Code string   `json:"code"`
		Path []string `json:"path"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &payload); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if payload.Code != "cycle_rejected" {
		t.Errorf("code = %q, want cycle_rejected", payload.Code)
	}
	want := []string{"A", "B", "C"}
	if len(payload.Path) != len(want) {
		t.Fatalf("path = %v, want %v", payload.Path, want)
	}
	for i := range want {
		if payload.Path[i] != want[i] {
			t.Errorf("path[%d] = %q, want %q", i, payload.Path[i], want[i])
		}
	}
}

func TestHttpApplyTemplate_UnknownIdIsBadRequest(t *testing.T) {
	h := newTestHandler()
	body, _ := json.Marshal(facade4prioritarius.ApplyTemplateRequest{SpaceID: "space1", TemplateID: "does-not-exist"})
	req := httptest.NewRequest(http.MethodPost, "/v0/prioritarius/apply_template", bytes.NewReader(body))
	req.Header.Set("Authorization", "Bearer test-token")
	rec := httptest.NewRecorder()
	h.httpApplyTemplate(rec, req)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, body = %s", rec.Code, rec.Body.String())
	}
}

func TestHttpApplyTemplate_FamilyTemplateThroughMux(t *testing.T) {
	h := newTestHandler()
	mux := http.NewServeMux()
	h.RegisterHttpRoutes(func(method, path string, handler http.HandlerFunc) { mux.Handle(path, handler) })

	body, _ := json.Marshal(facade4prioritarius.ApplyTemplateRequest{SpaceID: "space1", TemplateID: "family"})
	req := httptest.NewRequest(http.MethodPost, "/v0/prioritarius/apply_template", bytes.NewReader(body))
	req.Header.Set("Authorization", "Bearer test-token")
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)
	if rec.Code != http.StatusCreated {
		t.Fatalf("status = %d, body = %s", rec.Code, rec.Body.String())
	}
	var resp facade4prioritarius.ApplyTemplateResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if len(resp.Nodes) == 0 {
		t.Error("expected at least one node in the response")
	}
}

func TestHttpListTemplates_ThroughMux(t *testing.T) {
	h := newTestHandler()
	mux := http.NewServeMux()
	h.RegisterHttpRoutes(func(method, path string, handler http.HandlerFunc) { mux.Handle(path, handler) })

	req := httptest.NewRequest(http.MethodPost, "/v0/prioritarius/list_templates", nil)
	req.Header.Set("Authorization", "Bearer test-token")
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, body = %s", rec.Code, rec.Body.String())
	}
	var resp facade4prioritarius.ListTemplatesResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if len(resp.Templates) != 3 {
		t.Fatalf("len(Templates) = %d, want 3", len(resp.Templates))
	}
	for _, tpl := range resp.Templates {
		if tpl.ID == "" || tpl.Title == "" || len(tpl.GoalTitles) == 0 {
			t.Errorf("incomplete preview: %+v", tpl)
		}
	}
}

func TestHttpListTemplates_Unauthorized(t *testing.T) {
	h := newTestHandler()
	req := httptest.NewRequest(http.MethodPost, "/v0/prioritarius/list_templates", nil)
	rec := httptest.NewRecorder()
	h.httpListTemplates(rec, req)
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d, want 401", rec.Code)
	}
}

func TestHttpListTemplates_EmptyUserID(t *testing.T) {
	facade := facade4prioritarius.NewFacade(sneatcoretesting.NewMemoryDB(), fakeIDGenerator{}, allowAllMembership{})
	h := NewHandler(facade, fakeIdentity{userID: ""})
	req := httptest.NewRequest(http.MethodPost, "/v0/prioritarius/list_templates", nil)
	req.Header.Set("Authorization", "Bearer valid-token-empty-user")
	rec := httptest.NewRecorder()
	h.httpListTemplates(rec, req)
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d, want 401", rec.Code)
	}
}

type sequentialIDs struct {
	ids []string
	i   int
}

func (s *sequentialIDs) NewID(context.Context) (string, error) {
	if s.i >= len(s.ids) {
		return "", errors.New("sequentialIDs: exhausted")
	}
	id := s.ids[s.i]
	s.i++
	return id, nil
}

func TestHandleFacadeError(t *testing.T) {
	rec := httptest.NewRecorder()
	if handleFacadeError(rec, nil) {
		t.Error("expected false for nil error, got true")
	}

	tests := []struct {
		err        error
		wantStatus int
		wantCode   string
	}{
		{facade4prioritarius.ErrUnauthorized, http.StatusUnauthorized, "unauthorized"},
		{facade4prioritarius.ErrForbidden, http.StatusForbidden, "forbidden"},
		{facade4prioritarius.ErrNotFound, http.StatusNotFound, "not_found"},
		{facade4prioritarius.ErrValidation, http.StatusBadRequest, "bad_request"},
		{errors.New("other internal error"), http.StatusInternalServerError, "internal"},
	}

	for _, tt := range tests {
		rec := httptest.NewRecorder()
		if !handleFacadeError(rec, tt.err) {
			t.Errorf("handleFacadeError(%v) returned false, want true", tt.err)
		}
		if rec.Code != tt.wantStatus {
			t.Errorf("status = %d, want %d", rec.Code, tt.wantStatus)
		}
	}
}

func TestHandlers_InvalidJSON(t *testing.T) {
	h := newTestHandler()
	badJSON := []byte("{malformed")

	handlers := []struct {
		name string
		call func(w http.ResponseWriter, r *http.Request)
	}{
		{"httpCreateNode", h.httpCreateNode},
		{"httpUpdateNode", h.httpUpdateNode},
		{"httpDeleteNode", h.httpDeleteNode},
		{"httpCreateEdge", h.httpCreateEdge},
		{"httpDeleteEdge", h.httpDeleteEdge},
		{"httpSetGoalOrder", h.httpSetGoalOrder},
		{"httpApplyTemplate", h.httpApplyTemplate},
	}

	for _, tc := range handlers {
		t.Run(tc.name, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodPost, "/", bytes.NewReader(badJSON))
			req.Header.Set("Authorization", "Bearer test-token")
			rec := httptest.NewRecorder()
			tc.call(rec, req)
			if rec.Code != http.StatusBadRequest {
				t.Errorf("%s status = %d, want 400", tc.name, rec.Code)
			}
		})
	}
}

func TestHandlers_Unauthorized(t *testing.T) {
	h := newTestHandler()
	handlers := []struct {
		name string
		call func(w http.ResponseWriter, r *http.Request)
	}{
		{"httpUpdateNode", h.httpUpdateNode},
		{"httpDeleteNode", h.httpDeleteNode},
		{"httpCreateEdge", h.httpCreateEdge},
		{"httpDeleteEdge", h.httpDeleteEdge},
		{"httpSetGoalOrder", h.httpSetGoalOrder},
		{"httpApplyTemplate", h.httpApplyTemplate},
	}

	for _, tc := range handlers {
		t.Run(tc.name, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodPost, "/", bytes.NewReader([]byte("{}")))
			rec := httptest.NewRecorder()
			tc.call(rec, req)
			if rec.Code != http.StatusUnauthorized {
				t.Errorf("%s status = %d, want 401", tc.name, rec.Code)
			}
		})
	}
}

func TestHandlers_EndToEnd(t *testing.T) {
	facade := facade4prioritarius.NewFacade(sneatcoretesting.NewMemoryDB(), &sequentialIDs{ids: []string{"n1", "n2", "g1"}}, allowAllMembership{})
	h := NewHandler(facade, fakeIdentity{userID: "user1"})

	// Create n1
	body, _ := json.Marshal(facade4prioritarius.CreateNodeRequest{SpaceID: "space1", Kind: "work_item", Title: "First"})
	req := httptest.NewRequest(http.MethodPost, "/v0/prioritarius/create_node", bytes.NewReader(body))
	req.Header.Set("Authorization", "Bearer token")
	rec := httptest.NewRecorder()
	h.httpCreateNode(rec, req)
	if rec.Code != http.StatusCreated {
		t.Fatalf("create_node status = %d, body = %s", rec.Code, rec.Body.String())
	}

	// Create n2
	body, _ = json.Marshal(facade4prioritarius.CreateNodeRequest{SpaceID: "space1", Kind: "work_item", Title: "Second"})
	req = httptest.NewRequest(http.MethodPost, "/v0/prioritarius/create_node", bytes.NewReader(body))
	req.Header.Set("Authorization", "Bearer token")
	rec = httptest.NewRecorder()
	h.httpCreateNode(rec, req)
	if rec.Code != http.StatusCreated {
		t.Fatalf("create_node status = %d, body = %s", rec.Code, rec.Body.String())
	}

	// Create goal g1 (committed)
	body, _ = json.Marshal(facade4prioritarius.CreateNodeRequest{SpaceID: "space1", Kind: "goal", Title: "Goal 1", Commitment: "committed"})
	req = httptest.NewRequest(http.MethodPost, "/v0/prioritarius/create_node", bytes.NewReader(body))
	req.Header.Set("Authorization", "Bearer token")
	rec = httptest.NewRecorder()
	h.httpCreateNode(rec, req)
	if rec.Code != http.StatusCreated {
		t.Fatalf("create_node status = %d, body = %s", rec.Code, rec.Body.String())
	}

	// CreateNode error: empty title -> 400
	body, _ = json.Marshal(facade4prioritarius.CreateNodeRequest{SpaceID: "space1", Kind: "work_item", Title: ""})
	req = httptest.NewRequest(http.MethodPost, "/v0/prioritarius/create_node", bytes.NewReader(body))
	req.Header.Set("Authorization", "Bearer token")
	rec = httptest.NewRecorder()
	h.httpCreateNode(rec, req)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("create_node empty title status = %d, want 400", rec.Code)
	}

	// UpdateNode: update title of n1 -> 200
	newTitle := "First Updated"
	body, _ = json.Marshal(facade4prioritarius.UpdateNodeRequest{SpaceID: "space1", ID: "n1", Title: &newTitle})
	req = httptest.NewRequest(http.MethodPost, "/v0/prioritarius/update_node", bytes.NewReader(body))
	req.Header.Set("Authorization", "Bearer token")
	rec = httptest.NewRecorder()
	h.httpUpdateNode(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("update_node status = %d, body = %s", rec.Code, rec.Body.String())
	}

	// UpdateNode error: unknown node -> 404
	body, _ = json.Marshal(facade4prioritarius.UpdateNodeRequest{SpaceID: "space1", ID: "missing", Title: &newTitle})
	req = httptest.NewRequest(http.MethodPost, "/v0/prioritarius/update_node", bytes.NewReader(body))
	req.Header.Set("Authorization", "Bearer token")
	rec = httptest.NewRecorder()
	h.httpUpdateNode(rec, req)
	if rec.Code != http.StatusNotFound {
		t.Fatalf("update_node unknown status = %d, want 404", rec.Code)
	}

	// CreateEdge: n1 -> n2 -> 201
	body, _ = json.Marshal(facade4prioritarius.CreateEdgeRequest{SpaceID: "space1", From: "n1", To: "n2", Type: "blocks"})
	req = httptest.NewRequest(http.MethodPost, "/v0/prioritarius/create_edge", bytes.NewReader(body))
	req.Header.Set("Authorization", "Bearer token")
	rec = httptest.NewRecorder()
	h.httpCreateEdge(rec, req)
	if rec.Code != http.StatusCreated {
		t.Fatalf("create_edge status = %d, body = %s", rec.Code, rec.Body.String())
	}

	// CreateEdge error: invalid type -> 400
	body, _ = json.Marshal(facade4prioritarius.CreateEdgeRequest{SpaceID: "space1", From: "n1", To: "n2", Type: "invalid"})
	req = httptest.NewRequest(http.MethodPost, "/v0/prioritarius/create_edge", bytes.NewReader(body))
	req.Header.Set("Authorization", "Bearer token")
	rec = httptest.NewRecorder()
	h.httpCreateEdge(rec, req)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("create_edge invalid type status = %d, want 400", rec.Code)
	}

	// DeleteEdge: n1 -> n2 -> 200
	body, _ = json.Marshal(facade4prioritarius.DeleteEdgeRequest{SpaceID: "space1", From: "n1", To: "n2", Type: "blocks"})
	req = httptest.NewRequest(http.MethodPost, "/v0/prioritarius/delete_edge", bytes.NewReader(body))
	req.Header.Set("Authorization", "Bearer token")
	rec = httptest.NewRecorder()
	h.httpDeleteEdge(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("delete_edge status = %d, body = %s", rec.Code, rec.Body.String())
	}

	// DeleteEdge error: empty spaceID -> 400
	body, _ = json.Marshal(facade4prioritarius.DeleteEdgeRequest{SpaceID: "", From: "n1", To: "n2", Type: "blocks"})
	req = httptest.NewRequest(http.MethodPost, "/v0/prioritarius/delete_edge", bytes.NewReader(body))
	req.Header.Set("Authorization", "Bearer token")
	rec = httptest.NewRecorder()
	h.httpDeleteEdge(rec, req)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("delete_edge empty spaceID status = %d, want 400", rec.Code)
	}

	// SetGoalOrder: g1 -> 200
	body, _ = json.Marshal(facade4prioritarius.SetGoalOrderRequest{SpaceID: "space1", GoalIDs: []string{"g1"}})
	req = httptest.NewRequest(http.MethodPost, "/v0/prioritarius/set_goal_order", bytes.NewReader(body))
	req.Header.Set("Authorization", "Bearer token")
	rec = httptest.NewRecorder()
	h.httpSetGoalOrder(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("set_goal_order status = %d, body = %s", rec.Code, rec.Body.String())
	}

	// SetGoalOrder error: wrong goalIDs -> 400
	body, _ = json.Marshal(facade4prioritarius.SetGoalOrderRequest{SpaceID: "space1", GoalIDs: []string{"nonexistent"}})
	req = httptest.NewRequest(http.MethodPost, "/v0/prioritarius/set_goal_order", bytes.NewReader(body))
	req.Header.Set("Authorization", "Bearer token")
	rec = httptest.NewRecorder()
	h.httpSetGoalOrder(rec, req)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("set_goal_order wrong goalIDs status = %d, want 400", rec.Code)
	}

	// DeleteNode: n2 -> 200
	body, _ = json.Marshal(facade4prioritarius.DeleteNodeRequest{SpaceID: "space1", ID: "n2"})
	req = httptest.NewRequest(http.MethodPost, "/v0/prioritarius/delete_node", bytes.NewReader(body))
	req.Header.Set("Authorization", "Bearer token")
	rec = httptest.NewRecorder()
	h.httpDeleteNode(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("delete_node status = %d, body = %s", rec.Code, rec.Body.String())
	}

	// DeleteNode error: unknown node -> 404
	body, _ = json.Marshal(facade4prioritarius.DeleteNodeRequest{SpaceID: "space1", ID: "missing"})
	req = httptest.NewRequest(http.MethodPost, "/v0/prioritarius/delete_node", bytes.NewReader(body))
	req.Header.Set("Authorization", "Bearer token")
	rec = httptest.NewRecorder()
	h.httpDeleteNode(rec, req)
	if rec.Code != http.StatusNotFound {
		t.Fatalf("delete_node unknown status = %d, want 404", rec.Code)
	}
}
