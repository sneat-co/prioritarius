import { EdgeType } from './types';

/**
 * Rejection returned by {@link addEdge}/{@link retargetEdge} when applying
 * the edge would close a cycle within its edge type's subgraph. The graph is
 * left completely unchanged; carries the existing path (named endpoint by
 * endpoint) that the new edge would close.
 */
export interface CycleError {
  readonly kind: 'cycle-rejected';
  readonly edgeType: EdgeType;
  readonly attempted: { readonly from: string; readonly to: string };
  /** The pre-existing path, from the attempted edge's `to` to its `from`. */
  readonly path: ReadonlyArray<string>;
  /** Human-readable message naming the offending path, e.g. "A → B → C". */
  readonly message: string;
}

export function formatPath(path: ReadonlyArray<string>): string {
  return path.join(' → ');
}

export function createCycleError(
  edgeType: EdgeType,
  attempted: { from: string; to: string },
  path: ReadonlyArray<string>,
): CycleError {
  return {
    kind: 'cycle-rejected',
    edgeType,
    attempted,
    path,
    message: `Adding "${attempted.from}" -${edgeType}-> "${attempted.to}" would close a cycle via the existing path ${formatPath(path)}`,
  };
}

/** Thrown by mutators when a referenced node id does not exist. */
export class UnknownNodeError extends Error {
  constructor(readonly nodeId: string) {
    super(`Unknown node id: ${nodeId}`);
    this.name = 'UnknownNodeError';
  }
}

/** Thrown by {@link addNode} when the id is already present in the workspace. */
export class DuplicateNodeIdError extends Error {
  constructor(readonly nodeId: string) {
    super(`Node id already exists: ${nodeId}`);
    this.name = 'DuplicateNodeIdError';
  }
}
