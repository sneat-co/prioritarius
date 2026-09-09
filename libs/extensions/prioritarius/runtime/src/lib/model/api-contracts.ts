import { CommitmentState, EdgeType, NodeKind } from '@sneat/prioritarius-core';
import {
  IPrioritariusDeadlineDbo,
  IPrioritariusEdgeDbo,
  IPrioritariusEstimateDbo,
  IPrioritariusNodeDbo,
} from './workspace-dbo';

/**
 * Request/response bodies for backend/api4prioritarius's HTTP endpoints
 * (see that package's doc.go comment, the single source of truth this
 * mirrors field-for-field). Every endpoint is POST, JSON-bodied, under
 * `/v0/prioritarius/...`, and every request carries `spaceID` (founder
 * ruling 2026-09-02: "almost everything in sneat is space bounded").
 */

export interface ICreateNodeRequest {
  readonly spaceID: string;
  readonly kind: NodeKind;
  readonly title: string;
  readonly description?: string;
  readonly ownEstimate?: IPrioritariusEstimateDbo;
  readonly deadline?: IPrioritariusDeadlineDbo;
  readonly commitment?: CommitmentState;
  readonly status?: 'open' | 'done';
}

export interface INodeResponse {
  readonly node: IPrioritariusNodeDbo;
}

/** Pointer-present-means-set: a field present in the body is applied: an
 * ABSENT field is left untouched. Clearing description/ownEstimate/deadline
 * needs its own explicit `clearX: true` flag (JSON has no way to
 * distinguish "send null" from "not provided" on the Go side's *T fields). */
export interface IUpdateNodeRequest {
  readonly spaceID: string;
  readonly id: string;
  readonly title?: string;
  readonly description?: string;
  readonly clearDescription?: boolean;
  readonly ownEstimate?: IPrioritariusEstimateDbo;
  readonly clearOwnEstimate?: boolean;
  readonly deadline?: IPrioritariusDeadlineDbo;
  readonly clearDeadline?: boolean;
  readonly commitment?: CommitmentState;
  readonly status?: 'open' | 'done';
  readonly completed?: boolean;
}

export interface IDeleteNodeRequest {
  readonly spaceID: string;
  readonly id: string;
}

export interface IDeleteNodeResponse {
  readonly id: string;
  readonly removedEdges: number;
  readonly removedFromGoalOrder: boolean;
}

export interface ICreateEdgeRequest {
  readonly spaceID: string;
  readonly from: string;
  readonly to: string;
  readonly type: EdgeType;
  readonly strength?: number;
}

export interface IEdgeResponse {
  readonly edge: IPrioritariusEdgeDbo;
}

export interface IDeleteEdgeRequest {
  readonly spaceID: string;
  readonly from: string;
  readonly to: string;
  readonly type: EdgeType;
}

export interface IDeleteEdgeResponse {
  readonly removed: boolean;
}

export interface ISetGoalOrderRequest {
  readonly spaceID: string;
  /** MUST be exactly the workspace's current committed-goal set (a
   * permutation) — this endpoint reorders, it does not commit/park. */
  readonly goalIds: readonly string[];
}

export interface ISetGoalOrderResponse {
  readonly committedGoalOrder: readonly string[];
}

export interface IApplyTemplateRequest {
  readonly spaceID: string;
  readonly templateId?: string;
}

export interface IApplyTemplateResponse {
  readonly nodes: readonly IPrioritariusNodeDbo[];
  readonly edges: readonly IPrioritariusEdgeDbo[];
}

/** Catalog entry returned by `list_templates` — a parallel lane is adding
 * this endpoint plus the personal/family/work/starter catalog. Not yet
 * deployed as of this writing: callers MUST degrade gracefully (treat any
 * failure — 404 route-not-found included — as "no templates available",
 * never hard-code a second copy of the catalog to fall back on). */
export interface IWorkspaceTemplateSummary {
  readonly id: string;
  readonly title: string;
  readonly goalTitles: readonly string[];
}

export interface IListTemplatesResponse {
  readonly templates: readonly IWorkspaceTemplateSummary[];
}

/** Every endpoint's failure body — see api4prioritarius's doc.go "Errors"
 * table for the HTTP status <-> code mapping. `path` is present only for a
 * 409 `cycle_rejected` (create_edge), naming the pre-existing path the new
 * edge would close, e.g. `["A","B","C"]` for "A → B → C". */
export interface IApiErrorBody {
  readonly code: string;
  readonly message: string;
  readonly path?: readonly string[];
}
