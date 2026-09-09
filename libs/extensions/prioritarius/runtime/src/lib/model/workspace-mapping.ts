import {
  addEdge,
  CycleError,
  Edge,
  EstimateUnit,
  EdgeType,
  NewEdgeInput,
  PrioritariusNode,
  Workspace,
} from '@sneat/prioritarius-core';
import {
  IPrioritariusEdgeDbo,
  IPrioritariusNodeDbo,
  IPrioritariusWorkspaceDbo,
} from './workspace-dbo';
import { IApiErrorBody } from './api-contracts';

/**
 * Explicit core-type <-> backend-DBO mapping. Every function here is pure
 * and framework-free (no Firestore/HTTP import) so it is trivially unit
 * tested — a Workspace is never persisted or reassembled "by structural
 * accident": every field crossing the boundary passes through a named
 * mapper. The backend (backend/models4prioritarius) is the schema's source
 * of truth; this module is a hand-written mirror of it, not a codegen
 * output, so keep the two in sync by hand when either changes.
 */

export function nodeToDbo(node: PrioritariusNode): IPrioritariusNodeDbo {
  const common = {
    id: node.id,
    kind: node.kind,
    title: node.title,
    description: node.description,
    ownEstimate: node.ownEstimate,
    deadline: node.deadline,
  };
  if (node.kind === 'work_item') {
    return { ...common, status: node.status, doneAt: node.doneAt };
  }
  return {
    ...common,
    commitment: node.commitment,
    completed: node.completed,
    completedAt: node.completedAt,
  };
}

export function dboToNode(dbo: IPrioritariusNodeDbo): PrioritariusNode {
  const base = {
    id: dbo.id,
    title: dbo.title,
    description: dbo.description,
    ownEstimate: dbo.ownEstimate,
    deadline: dbo.deadline,
  };
  if (dbo.kind === 'work_item') {
    return {
      ...base,
      kind: 'work_item',
      status: dbo.status ?? 'open',
      doneAt: dbo.doneAt,
    };
  }
  return {
    ...base,
    kind: dbo.kind,
    commitment: dbo.commitment ?? 'exploring',
    completed: dbo.completed ?? false,
    completedAt: dbo.completedAt,
  };
}

export function edgeToDbo(edge: Edge): IPrioritariusEdgeDbo {
  return {
    from: edge.from,
    to: edge.to,
    type: edge.type,
    strength: edge.strength,
  };
}

export function dboToEdge(dbo: IPrioritariusEdgeDbo): Edge {
  return { from: dbo.from, to: dbo.to, type: dbo.type, strength: dbo.strength };
}

/**
 * Reassembles a core {@link Workspace} value from the single backend
 * document (`/spaces/{spaceID}/ext/prioritarius`). A missing document
 * (`undefined`) means an empty workspace — the backend's `NewWorkspaceDbo`
 * default — never an error.
 *
 * Nodes are inserted directly (not via `addNode`) because that mutator
 * encodes "create new" defaulting rules (e.g. a fresh goal/project is never
 * `completed`) that would silently corrupt already-persisted state on every
 * reload; `committedGoalOrder` is taken verbatim from the document, since
 * that field is the user's own explicit reordering, not something a rebuild
 * should re-derive from map iteration order.
 */
export function assembleWorkspace(
  doc: IPrioritariusWorkspaceDbo | undefined,
): Workspace {
  const unit: EstimateUnit = doc?.unit ?? 'days';
  const nodes = new Map<string, PrioritariusNode>();
  for (const dbo of Object.values(doc?.nodes ?? {})) {
    if (dbo) {
      nodes.set(dbo.id, dboToNode(dbo));
    }
  }
  const edges = (doc?.edges ?? []).map(dboToEdge);
  return {
    unit,
    nodes,
    edges,
    committedGoalOrder: doc?.committedGoalOrder ?? [],
  };
}

/**
 * Fast client-side pre-check only — the backend's `create_edge` enforces
 * the DAG invariant authoritatively (server transaction sees the latest
 * committed state; this runs against whatever workspace snapshot the UI
 * currently holds, which can be stale). Reuses the core's own `addEdge`
 * cycle detection so the two never disagree on the algorithm, only
 * possibly on freshness. Returns `undefined` when the local check finds no
 * cycle (the request should still be sent — the server has the last word).
 */
export function localCycleCheck(
  workspace: Workspace,
  input: NewEdgeInput,
): CycleError | undefined {
  const result = addEdge(workspace, input);
  return result.kind === 'cycle-rejected' ? result.error : undefined;
}

/**
 * Maps a 409 `cycle_rejected` API error body to the same {@link CycleError}
 * shape the core engine's local pre-check produces, so the UI renders
 * exactly one code path for "an edge was rejected as a cycle" regardless of
 * whether the rejection was caught locally or authoritatively by the
 * server (see api4prioritarius's CycleError.Error() — same message format,
 * "A → B → C").
 */
export function cycleErrorFromApiError(
  body: IApiErrorBody,
  attempted: {
    readonly from: string;
    readonly to: string;
    readonly type: EdgeType;
  },
): CycleError {
  const path = body.path ?? [];
  return {
    kind: 'cycle-rejected',
    edgeType: attempted.type,
    attempted: { from: attempted.from, to: attempted.to },
    path,
    message:
      body.message ||
      `Adding "${attempted.from}" -${attempted.type}-> "${attempted.to}" would close a cycle via the existing path ${path.join(' → ')}`,
  };
}
