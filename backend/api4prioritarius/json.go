package api4prioritarius

import (
	"encoding/json"
	"errors"
	"net/http"
	"strings"

	"github.com/sneat-co/prioritarius/backend/facade4prioritarius"
)

func bearerToken(r *http.Request) string {
	return strings.TrimSpace(strings.TrimPrefix(r.Header.Get("Authorization"), "Bearer "))
}

func decodeJSON(w http.ResponseWriter, r *http.Request, v any) bool {
	if err := json.NewDecoder(r.Body).Decode(v); err != nil {
		writeError(w, http.StatusBadRequest, "bad_request", "invalid JSON body")
		return false
	}
	return true
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func writeError(w http.ResponseWriter, status int, code, message string) {
	writeJSON(w, status, map[string]string{"code": code, "message": message})
}

// writeCallerErrors writes the standard unauthorized/forbidden responses.
// Returns true iff the caller was rejected (handler must return).
func writeUnauthorized(w http.ResponseWriter) {
	writeError(w, http.StatusUnauthorized, "unauthorized", "missing or invalid bearer token")
}

// handleFacadeError maps a facade4prioritarius command error to an HTTP
// response, per the status table in the package doc comment. Returns true
// iff err was non-nil (and thus a response was written).
func handleFacadeError(w http.ResponseWriter, err error) bool {
	if err == nil {
		return false
	}

	var cycleErr *facade4prioritarius.CycleError
	if errors.As(err, &cycleErr) {
		writeJSON(w, http.StatusConflict, map[string]any{
			"code":    "cycle_rejected",
			"message": cycleErr.Error(),
			"path":    cycleErr.Path,
		})
		return true
	}

	switch {
	case errors.Is(err, facade4prioritarius.ErrUnauthorized):
		writeUnauthorized(w)
	case errors.Is(err, facade4prioritarius.ErrForbidden):
		writeError(w, http.StatusForbidden, "forbidden", "caller is not a member of the space")
	case errors.Is(err, facade4prioritarius.ErrNotFound):
		writeError(w, http.StatusNotFound, "not_found", err.Error())
	case errors.Is(err, facade4prioritarius.ErrValidation):
		writeError(w, http.StatusBadRequest, "bad_request", err.Error())
	default:
		writeError(w, http.StatusInternalServerError, "internal", "internal error")
	}
	return true
}
