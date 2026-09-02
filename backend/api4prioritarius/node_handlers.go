package api4prioritarius

import (
	"net/http"

	"github.com/sneat-co/prioritarius/backend/facade4prioritarius"
)

func (h *Handler) httpCreateNode(w http.ResponseWriter, r *http.Request) {
	userID, ok := h.caller(r)
	if !ok {
		writeUnauthorized(w)
		return
	}
	var req facade4prioritarius.CreateNodeRequest
	if !decodeJSON(w, r, &req) {
		return
	}
	resp, err := h.facade.CreateNode(r.Context(), userID, req)
	if handleFacadeError(w, err) {
		return
	}
	writeJSON(w, http.StatusCreated, resp)
}

func (h *Handler) httpUpdateNode(w http.ResponseWriter, r *http.Request) {
	userID, ok := h.caller(r)
	if !ok {
		writeUnauthorized(w)
		return
	}
	var req facade4prioritarius.UpdateNodeRequest
	if !decodeJSON(w, r, &req) {
		return
	}
	resp, err := h.facade.UpdateNode(r.Context(), userID, req)
	if handleFacadeError(w, err) {
		return
	}
	writeJSON(w, http.StatusOK, resp)
}

func (h *Handler) httpDeleteNode(w http.ResponseWriter, r *http.Request) {
	userID, ok := h.caller(r)
	if !ok {
		writeUnauthorized(w)
		return
	}
	var req facade4prioritarius.DeleteNodeRequest
	if !decodeJSON(w, r, &req) {
		return
	}
	resp, err := h.facade.DeleteNode(r.Context(), userID, req)
	if handleFacadeError(w, err) {
		return
	}
	writeJSON(w, http.StatusOK, resp)
}
