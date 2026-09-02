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
