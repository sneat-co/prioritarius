package api4prioritarius

import (
	"net/http"

	"github.com/sneat-co/prioritarius/backend/facade4prioritarius"
)

func (h *Handler) httpSetGoalOrder(w http.ResponseWriter, r *http.Request) {
	userID, ok := h.caller(r)
	if !ok {
		writeUnauthorized(w)
		return
	}
	var req facade4prioritarius.SetGoalOrderRequest
	if !decodeJSON(w, r, &req) {
		return
	}
	resp, err := h.facade.SetGoalOrder(r.Context(), userID, req)
	if handleFacadeError(w, err) {
		return
	}
	writeJSON(w, http.StatusOK, resp)
}

func (h *Handler) httpApplyTemplate(w http.ResponseWriter, r *http.Request) {
	userID, ok := h.caller(r)
	if !ok {
		writeUnauthorized(w)
		return
	}
	var req facade4prioritarius.ApplyTemplateRequest
	if !decodeJSON(w, r, &req) {
		return
	}
	resp, err := h.facade.ApplyTemplate(r.Context(), userID, req)
	if handleFacadeError(w, err) {
		return
	}
	writeJSON(w, http.StatusCreated, resp)
}
