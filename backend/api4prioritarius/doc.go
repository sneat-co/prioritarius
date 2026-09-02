// Package api4prioritarius is the thin HTTP layer over facade4prioritarius.
// It mounts every Prioritarius mutation under /v0/prioritarius/... — reads
// are Firestore-direct from the client (gated by firestore.rules), so this
// package exposes writes only (founder ruling 2026-09-02: "all writes in
// sneat always go throw sneat-go backend https endpoints. No exceptions.").
//
// Every request is POST, JSON-bodied, and carries spaceID (founder ruling
// 2026-09-02: "almost everything in sneat is space bounded"). Every handler
// authenticates the caller via the injected UserIdentity port and lets
// facade4prioritarius enforce space membership inside the same transaction
// as the write. Responses return the created/updated entity (and its
// server-assigned id) so the frontend can apply the change optimistically
// without a re-read.
//
// # Errors
//
// Every endpoint returns a JSON body {"code": string, "message": string} on
// failure, with the HTTP status:
//
//	400 bad_request    — malformed JSON or a facade4prioritarius.ErrValidation
//	                      (includes DAG-cycle rejection; the body additionally
//	                      carries "path": []string naming the existing path,
//	                      e.g. ["A","B","C"])
//	401 unauthorized    — missing or invalid bearer token
//	403 forbidden       — caller is not a member of the space
//	404 not_found       — referenced workspace/node/edge does not exist
//	500 internal        — unexpected failure
//
// # Endpoints
//
// POST /v0/prioritarius/create_node
//
//	Request  facade4prioritarius.CreateNodeRequest
//	  {spaceID, kind: "goal"|"project"|"work_item", title,
//	   description?, ownEstimate?: {value, unit}, deadline?: {date, hard},
//	   commitment?: "committed"|"exploring"|"parked" (goal/project only,
//	   default "exploring"), status?: "open"|"done" (work_item only,
//	   default "open")}
//	Response facade4prioritarius.NodeResponse — {node: NodeDbo}
//
// POST /v0/prioritarius/update_node
//
//	Request  facade4prioritarius.UpdateNodeRequest
//	  {spaceID, id, title?, description?, clearDescription?,
//	   ownEstimate?, clearOwnEstimate?, deadline?, clearDeadline?,
//	   commitment?, status?, completed?}
//	  Every field present is applied; absent fields are untouched. Status
//	  "done" stamps doneAt server-side; completed:true stamps completedAt
//	  server-side — completion is never automatic (REQ: completion).
//	Response facade4prioritarius.NodeResponse — {node: NodeDbo}
//
// POST /v0/prioritarius/delete_node
//
//	Request  facade4prioritarius.DeleteNodeRequest — {spaceID, id}
//	Response facade4prioritarius.DeleteNodeResponse
//	  {id, removedEdges: int, removedFromGoalOrder: bool}
//	  Atomically removes the node, every edge incident to it (either
//	  direction, either type), and its committedGoalOrder entry if present.
//
// POST /v0/prioritarius/create_edge
//
//	Request  facade4prioritarius.CreateEdgeRequest
//	  {spaceID, from, to, type: "contributes_to"|"blocks", strength?}
//	Response facade4prioritarius.EdgeResponse — {edge: EdgeDbo}
//	  409 conflict (mapped from the wrapped ErrValidation) when the edge
//	  would close a cycle in its edge type's subgraph (REQ: dag-invariant):
//	  body carries "path": []string naming the pre-existing path the new
//	  edge would close, e.g. ["A","B","C"] for "A → B → C". The graph is
//	  left completely unchanged on rejection.
//
// POST /v0/prioritarius/delete_edge
//
//	Request  facade4prioritarius.DeleteEdgeRequest — {spaceID, from, to, type}
//	Response facade4prioritarius.DeleteEdgeResponse — {removed: bool}
//
// POST /v0/prioritarius/set_goal_order
//
//	Request  facade4prioritarius.SetGoalOrderRequest — {spaceID, goalIds: []string}
//	  goalIds MUST be exactly the workspace's current committed-goal set
//	  (a permutation); this endpoint reorders, it does not commit/park.
//	Response facade4prioritarius.SetGoalOrderResponse — {committedGoalOrder: []string}
//
// POST /v0/prioritarius/apply_template
//
//	Request  facade4prioritarius.ApplyTemplateRequest — {spaceID, templateId?}
//	  templateId defaults to "starter" (the only built-in template today).
//	Response facade4prioritarius.ApplyTemplateResponse — {nodes: []NodeDbo, edges: []EdgeDbo}
//	  Every node/edge the template created, for optimistic update.
package api4prioritarius
