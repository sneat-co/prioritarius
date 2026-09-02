import { CycleError, createCycleError } from './errors';
import { UnknownNodeError } from './errors';
import { Edge, EdgeType, Workspace } from './types';

export interface NewEdgeInput {
  readonly from: string;
  readonly to: string;
  readonly type: EdgeType;
  readonly strength?: number;
}

export interface EdgeMatcher {
  readonly from: string;
  readonly to: string;
  readonly type: EdgeType;
}

export type AddEdgeResult =
  | { readonly kind: 'ok'; readonly workspace: Workspace }
  | { readonly kind: 'cycle-rejected'; readonly error: CycleError };

/** Thrown by {@link retargetEdge} when no edge matches the given matcher. */
export class EdgeNotFoundError extends Error {
  constructor(readonly matcher: EdgeMatcher) {
    super(
      `No ${matcher.type} edge found from "${matcher.from}" to "${matcher.to}"`,
    );
    this.name = 'EdgeNotFoundError';
  }
}

function requireNodeExists(workspace: Workspace, nodeId: string): void {
  if (!workspace.nodes.has(nodeId)) {
    throw new UnknownNodeError(nodeId);
  }
}

/**
 * Breadth-first search over edges of a single type for a path from `start`
 * to `target`, both inclusive. Returns null when unreachable.
 */
function findPath(
  edges: ReadonlyArray<Edge>,
  start: string,
  target: string,
): string[] | null {
  if (start === target) {
    return [start];
  }
  const adjacency = new Map<string, string[]>();
  for (const edge of edges) {
    const list = adjacency.get(edge.from);
    if (list) {
      list.push(edge.to);
    } else {
      adjacency.set(edge.from, [edge.to]);
    }
  }

  const visited = new Set<string>([start]);
  const predecessor = new Map<string, string>();
  const queue: string[] = [start];

  while (queue.length > 0) {
    const current = queue.shift() as string;
    for (const next of adjacency.get(current) ?? []) {
      if (visited.has(next)) {
        continue;
      }
      visited.add(next);
      predecessor.set(next, current);
      if (next === target) {
        const path = [target];
        let node = current;
        while (node !== start) {
          path.unshift(node);
          node = predecessor.get(node) as string;
        }
        path.unshift(start);
        return path;
      }
      queue.push(next);
    }
  }
  return null;
}

/**
 * Checks whether adding `candidate` to `existingEdges` (of the same type)
 * would close a cycle. Returns the existing path (from candidate.to to
 * candidate.from) when it would, else null.
 */
function detectCycle(
  existingEdges: ReadonlyArray<Edge>,
  candidate: { from: string; to: string },
): string[] | null {
  if (candidate.from === candidate.to) {
    return [candidate.from];
  }
  return findPath(existingEdges, candidate.to, candidate.from);
}

/**
 * Adds an edge, enforcing the DAG invariant *per edge type*: a
 * `contributes_to` cycle is independent of any `blocks` cycle, so the same
 * node pair may carry both edge types. On rejection the workspace is
 * returned unchanged (the caller's reference is simply not replaced).
 */
export function addEdge(
  workspace: Workspace,
  input: NewEdgeInput,
): AddEdgeResult {
  requireNodeExists(workspace, input.from);
  requireNodeExists(workspace, input.to);

  const sameType = workspace.edges.filter((edge) => edge.type === input.type);
  const path = detectCycle(sameType, input);
  if (path) {
    return {
      kind: 'cycle-rejected',
      error: createCycleError(input.type, input, path),
    };
  }

  const edge: Edge = {
    from: input.from,
    to: input.to,
    type: input.type,
    strength: input.strength,
  };
  return {
    kind: 'ok',
    workspace: { ...workspace, edges: [...workspace.edges, edge] },
  };
}

/**
 * Retargets an existing edge's endpoints, keeping its type. Validated and
 * applied atomically: either the new edge set is DAG-valid (for that edge
 * type, excluding the edge being moved) and is applied whole, or the
 * original edge is left completely untouched.
 */
export function retargetEdge(
  workspace: Workspace,
  matcher: EdgeMatcher,
  next: { from: string; to: string },
): AddEdgeResult {
  const index = workspace.edges.findIndex(
    (edge) =>
      edge.from === matcher.from &&
      edge.to === matcher.to &&
      edge.type === matcher.type,
  );
  if (index === -1) {
    throw new EdgeNotFoundError(matcher);
  }
  requireNodeExists(workspace, next.from);
  requireNodeExists(workspace, next.to);

  const existing = workspace.edges[index];
  const withoutExisting = workspace.edges.filter((_, i) => i !== index);
  const sameTypeWithoutExisting = withoutExisting.filter(
    (edge) => edge.type === matcher.type,
  );

  const path = detectCycle(sameTypeWithoutExisting, next);
  if (path) {
    return {
      kind: 'cycle-rejected',
      error: createCycleError(matcher.type, next, path),
    };
  }

  const retargeted: Edge = {
    from: next.from,
    to: next.to,
    type: matcher.type,
    strength: existing.strength,
  };
  const edges = [...withoutExisting];
  edges.splice(index, 0, retargeted);
  return { kind: 'ok', workspace: { ...workspace, edges } };
}
