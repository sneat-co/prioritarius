import {
  CommitmentState,
  EdgeType,
  EstimateUnit,
  NodeKind,
} from '@sneat/prioritarius-core';

/**
 * Firestore document shape for this extension's data — mirrors
 * backend/models4prioritarius/workspace.go (WorkspaceDbo/NodeDbo/EdgeDbo)
 * exactly, field for field. The ENTIRE graph for one Space is ONE document
 * at `/spaces/{spaceID}/ext/prioritarius` (not one doc per node/edge): the
 * DAG invariant and cascading delete must never be partially applied, and a
 * single document read+write inside one backend transaction gives that for
 * free. `workspaceDocPath` is the one seam that would ever move this.
 *
 * Founder ruling 2026-09-02, verbatim: "All writes in sneat always go throw
 * sneat-go backend https endpoints. No exceptions." — this document is
 * READ directly from Firestore (gated by firestore.rules: a Space member
 * may read, nobody may write), but every mutation goes through
 * backend/api4prioritarius's HTTP endpoints. See
 * ../workspace/prioritarius-workspace.store.ts.
 */

/** A nested own (manually entered) estimate — matches
 * models4prioritarius.Estimate's `{value, unit}` JSON shape exactly (never
 * flattened; the backend serializes it as a nested object). */
export interface IPrioritariusEstimateDbo {
  readonly value: number;
  readonly unit: EstimateUnit;
}

/** Matches models4prioritarius.Deadline's `{date, hard}` JSON shape. */
export interface IPrioritariusDeadlineDbo {
  readonly date: string;
  readonly hard: boolean;
}

/** One graph node — matches models4prioritarius.NodeDbo. All three kinds
 * share this shape; `kind` discriminates which of the kind-specific fields
 * are meaningful (goal/project: commitment/completed/completedAt; work_item:
 * status/doneAt). The backend omits zero-value fields (Go `omitempty`), so
 * every optional field here is genuinely optional on the wire. */
export interface IPrioritariusNodeDbo {
  readonly id: string;
  readonly kind: NodeKind;
  readonly title: string;
  readonly description?: string;
  readonly ownEstimate?: IPrioritariusEstimateDbo;
  readonly deadline?: IPrioritariusDeadlineDbo;
  // work_item only
  readonly status?: 'open' | 'done';
  readonly doneAt?: string;
  // goal/project only
  readonly commitment?: CommitmentState;
  readonly completed?: boolean;
  readonly completedAt?: string;
}

/** One directed edge — matches models4prioritarius.EdgeDbo. There is no
 * separate edge id; an edge is identified by its (from, to, type) triple. */
export interface IPrioritariusEdgeDbo {
  readonly from: string;
  readonly to: string;
  readonly type: EdgeType;
  readonly strength?: number;
}

/** The whole-workspace document — matches models4prioritarius.WorkspaceDbo.
 * A missing document (a Space that has never had a node created in it)
 * means an empty workspace, not an error — the backend's `NewWorkspaceDbo`
 * default and this client's read path agree on that. */
export interface IPrioritariusWorkspaceDbo {
  readonly unit: EstimateUnit;
  readonly nodes: Readonly<Record<string, IPrioritariusNodeDbo>>;
  readonly edges: readonly IPrioritariusEdgeDbo[];
  readonly committedGoalOrder: readonly string[];
}

export function workspaceDocPath(spaceID: string): string {
  return `spaces/${spaceID}/ext/prioritarius`;
}

/** Firestore/JSON round-tripping helper: strip `undefined` fields from an
 * outgoing request body so an absent optional is genuinely absent on the
 * wire (matters for the backend's pointer-present-means-set convention on
 * `update_node` — see prioritarius-workspace.store.ts). */
export function stripUndefinedFields<T extends object>(value: T): Partial<T> {
  const result: Partial<T> = {};
  for (const key of Object.keys(value) as (keyof T)[]) {
    const v = value[key];
    if (v !== undefined) {
      result[key] = v;
    }
  }
  return result;
}
