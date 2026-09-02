import {
  CommitmentState,
  EdgeType,
  EstimateUnit,
  NodeKind,
} from '@sneat/prioritarius-core';

/**
 * Firestore document shapes for this extension's data. The workspace root is
 * the real Sneat Space's own per-extension document —
 * `/spaces/{spaceID}/ext/prioritarius` — which is already the exact shape
 * REQ:workspace names, so there is no later "relocation": {@link
 * workspaceDocPath} is simply the one seam that would ever change. String
 * doc IDs throughout (Firestore auto/caller-supplied ids), no global
 * namespace assumptions (everything is scoped under the space), and no
 * hard-coded "ownerId" field — ownership is the Space's own member-role
 * model (a Space already has owner/editor/... members), so this extension's
 * documents never duplicate that concept.
 */

/** `spaces/{spaceID}/ext/prioritarius` — one per space. Doc id is the
 * extension id, the org convention for a space's per-extension state. */
export interface IPrioritariusWorkspaceDbo {
  readonly unit: EstimateUnit;
  readonly committedGoalOrder: readonly string[];
  readonly updatedAt: string;
}

/** `spaces/{spaceID}/ext/prioritarius/nodes/{nodeID}`. Flattened for
 * Firestore: `ownEstimate`/`deadline` become sibling scalar fields (nested
 * value objects with `undefined` members don't round-trip through
 * `setDoc`), and kind-specific fields are simply absent for the other kind
 * rather than nested in a union. */
export interface IPrioritariusNodeDbo {
  readonly kind: NodeKind;
  readonly title: string;
  readonly description?: string;
  readonly ownEstimateValue?: number;
  readonly ownEstimateUnit?: EstimateUnit;
  readonly deadlineDate?: string;
  readonly deadlineHard?: boolean;
  // work_item only
  readonly status?: 'open' | 'done';
  readonly doneAt?: string;
  // goal/project only
  readonly commitment?: CommitmentState;
  readonly completed?: boolean;
  readonly completedAt?: string;
}

/** `spaces/{spaceID}/ext/prioritarius/edges/{edgeID}`. */
export interface IPrioritariusEdgeDbo {
  readonly from: string;
  readonly to: string;
  readonly type: EdgeType;
  readonly strength?: number;
}

/** Deterministic doc id: one edge per (type, from, to) pair, so re-adding
 * never duplicates and removal never needs a query. */
export function edgeDocId(edge: {
  readonly from: string;
  readonly to: string;
  readonly type: EdgeType;
}): string {
  return `${edge.type}__${edge.from}__${edge.to}`;
}

export function workspaceDocPath(spaceID: string): string {
  return `spaces/${spaceID}/ext/prioritarius`;
}

export function nodesCollectionPath(spaceID: string): string {
  return `${workspaceDocPath(spaceID)}/nodes`;
}

export function edgesCollectionPath(spaceID: string): string {
  return `${workspaceDocPath(spaceID)}/edges`;
}

/** Firestore rejects `undefined` field values in `setDoc`/`updateDoc`; strip
 * them so an absent optional (e.g. no deadline) is simply omitted rather
 * than throwing. A full (non-merge) `setDoc` of a stripped DBO therefore
 * also correctly clears a field the caller just removed. */
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
