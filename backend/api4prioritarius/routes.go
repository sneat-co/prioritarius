package api4prioritarius

import (
	"net/http"

	"github.com/sneat-co/prioritarius/backend/facade4prioritarius"
)

// Handler wires the Prioritarius HTTP endpoints onto a
// facade4prioritarius.Facade and a UserIdentity port.
type Handler struct {
	facade   facade4prioritarius.Facade
	identity facade4prioritarius.UserIdentity
}

// NewHandler builds a Handler. identity must not be nil in production — the
// host (sneat-go) supplies the real Firebase-token-verifying adapter; tests
// inject a fake.
func NewHandler(facade facade4prioritarius.Facade, identity facade4prioritarius.UserIdentity) *Handler {
	return &Handler{facade: facade, identity: identity}
}

// RegisterHttpRoutes registers every Prioritarius HTTP route under
// /v0/prioritarius/... (see the package doc for each endpoint's contract).
//
// handle has the same shape as sneat-go-core's extension.HTTPHandleFunc
// (func(method, path string, handler http.HandlerFunc)) but is declared here
// as an UNNAMED func type rather than importing that type directly — this
// module depends on dal-go/dalgo only (see the module README's architecture
// note). sneat-go/pkg/modules/prioritarius passes its extension.HTTPHandleFunc
// value here directly: Go's assignability rule allows it because the
// underlying types are identical and this parameter's type is unnamed.
func (h *Handler) RegisterHttpRoutes(handle func(method, path string, handler http.HandlerFunc)) {
	handle(http.MethodPost, "/v0/prioritarius/create_node", h.httpCreateNode)
	handle(http.MethodPost, "/v0/prioritarius/update_node", h.httpUpdateNode)
	handle(http.MethodPost, "/v0/prioritarius/delete_node", h.httpDeleteNode)
	handle(http.MethodPost, "/v0/prioritarius/create_edge", h.httpCreateEdge)
	handle(http.MethodPost, "/v0/prioritarius/delete_edge", h.httpDeleteEdge)
	handle(http.MethodPost, "/v0/prioritarius/set_goal_order", h.httpSetGoalOrder)
	handle(http.MethodPost, "/v0/prioritarius/apply_template", h.httpApplyTemplate)
}

// caller extracts the authenticated userID from the Authorization header.
func (h *Handler) caller(r *http.Request) (string, bool) {
	token := bearerToken(r)
	return h.identity.UserID(r.Context(), token)
}
