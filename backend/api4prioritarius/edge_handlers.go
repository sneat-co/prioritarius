package api4prioritarius

import (
	"net/http"

	"github.com/sneat-co/prioritarius/backend/facade4prioritarius"
)

func (h *Handler) httpCreateEdge(w http.ResponseWriter, r *http.Request) {
	userID, ok := h.caller(r)
	if !ok {
		writeUnauthorized(w)
		return
	}
	var req facade4prioritarius.CreateEdgeRequest
	if !decodeJSON(w, r, &req) {
		return
	}
	resp, err := h.facade.CreateEdge(r.Context(), userID, req)
	if handleFacadeError(w, err) {
		return
	}
	writeJSON(w, http.StatusCreated, resp)
}

func (h *Handler) httpDeleteEdge(w http.ResponseWriter, r *http.Request) {
	userID, ok := h.caller(r)
	if !ok {
		writeUnauthorized(w)
		return
	}
	var req facade4prioritarius.DeleteEdgeRequest
	if !decodeJSON(w, r, &req) {
		return
	}
	resp, err := h.facade.DeleteEdge(r.Context(), userID, req)
	if handleFacadeError(w, err) {
		return
	}
	writeJSON(w, http.StatusOK, resp)
}
