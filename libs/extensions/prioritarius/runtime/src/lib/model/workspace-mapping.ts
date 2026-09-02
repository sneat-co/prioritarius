import {
  addEdge,
  addNode,
  createWorkspace,
  CycleError,
  Deadline,
  Edge,
  Estimate,
  EstimateUnit,
  NewEdgeInput,
  PrioritariusNode,
  Workspace,
} from '@sneat/prioritarius-core';
import {
  edgeDocId,
  IPrioritariusEdgeDbo,
  IPrioritariusNodeDbo,
  IPrioritariusWorkspaceDbo,
} from './workspace-dbo';

/**
 * Explicit core-type <-> Firestore-document mapping. Every function here is
 * pure and framework-free (no Firestore import) so it is trivially unit
 * tested — the goal is that a Workspace is never persisted "by structural
 * accident" (e.g. `JSON.stringify`-ing the core value): every field
 * crossing the boundary passes through a named mapper.
 */

export function nodeToDbo(node: PrioritariusNode): IPrioritariusNodeDbo {
  const common = {
    kind: node.kind,
    title: node.title,
    description: node.description,
    ownEstimateValue: node.ownEstimate?.value,
    ownEstimateUnit: node.ownEstimate?.unit,
    deadlineDate: node.deadline?.date,
    deadlineHard: node.deadline?.hard,
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

export function dboToNode(
  id: string,
  dbo: IPrioritariusNodeDbo,
): PrioritariusNode {
  const ownEstimate: Estimate | undefined =
    dbo.ownEstimateValue !== undefined && dbo.ownEstimateUnit !== undefined
      ? { value: dbo.ownEstimateValue, unit: dbo.ownEstimateUnit }
      : undefined;
  const deadline: Deadline | undefined = dbo.deadlineDate
    ? { date: dbo.deadlineDate, hard: dbo.deadlineHard ?? false }
    : undefined;
  const base = {
    id,
    title: dbo.title,
    description: dbo.description,
    ownEstimate,
    deadline,
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

export function workspaceMetaToDbo(
  workspace: Pick<Workspace, 'unit' | 'committedGoalOrder'>,
  updatedAt: string,
): IPrioritariusWorkspaceDbo {
  return {
    unit: workspace.unit,
    committedGoalOrder: workspace.committedGoalOrder,
    updatedAt,
  };
}

export interface RawWorkspaceDocs {
  readonly meta: IPrioritariusWorkspaceDbo | undefined;
  readonly nodes: ReadonlyArray<{
    readonly id: string;
    readonly dbo: IPrioritariusNodeDbo;
  }>;
  readonly edges: ReadonlyArray<{
    readonly id: string;
    readonly dbo: IPrioritariusEdgeDbo;
  }>;
}

/**
 * Reassembles a core {@link Workspace} value from raw Firestore documents.
 * Nodes/edges are inserted directly (not via `addNode`/`addEdge`) because
 * those mutators encode "create new" defaulting rules (e.g. a fresh
 * goal/project is never `completed`) that would silently corrupt already
 * -persisted state on every reload; `committedGoalOrder` is taken verbatim
 * from the meta doc, since that field is the user's own explicit reordering,
 * not something a rebuild should re-derive from insertion order.
 */
export function assembleWorkspace(docs: RawWorkspaceDocs): Workspace {
  const unit: EstimateUnit = docs.meta?.unit ?? 'days';
  const nodes = new Map<string, PrioritariusNode>();
  for (const { id, dbo } of docs.nodes) {
    nodes.set(id, dboToNode(id, dbo));
  }
  const edges = docs.edges.map(({ dbo }) => dboToEdge(dbo));
  return {
    unit,
    nodes,
    edges,
    committedGoalOrder: docs.meta?.committedGoalOrder ?? [],
  };
}

export type ConnectEdgePlan =
  | {
      readonly kind: 'ok';
      readonly workspace: Workspace;
      readonly edgeDoc: {
        readonly id: string;
        readonly dbo: IPrioritariusEdgeDbo;
      };
    }
  | { readonly kind: 'cycle-rejected'; readonly error: CycleError };

/**
 * Wraps the core's `addEdge` (the DAG-invariant enforcement lives there and
 * is never reimplemented here) and produces the exact Firestore write the
 * caller should perform on success — the store layer never decides the
 * document id/shape ad hoc.
 */
export function planConnectEdge(
  workspace: Workspace,
  input: NewEdgeInput,
): ConnectEdgePlan {
  const result = addEdge(workspace, input);
  if (result.kind === 'cycle-rejected') {
    return result;
  }
  return {
    kind: 'ok',
    workspace: result.workspace,
    edgeDoc: {
      id: edgeDocId(input),
      dbo: edgeToDbo({
        from: input.from,
        to: input.to,
        type: input.type,
        strength: input.strength,
      }),
    },
  };
}

/**
 * Builds a fully-defaulted node (via the core's own `addNode`, on a scratch
 * empty workspace so no unrelated state leaks in) and its Firestore doc in
 * one step, so every "create" path reuses the core's defaulting rules
 * (open/exploring/etc.) instead of restating them here.
 */
export function planCreateNode(input: Parameters<typeof addNode>[1]): {
  readonly node: PrioritariusNode;
  readonly dbo: IPrioritariusNodeDbo;
} {
  const scratch = addNode(createWorkspace(), input);
  const node = scratch.nodes.get(input.id);
  if (!node) {
    // Unreachable: addNode either throws (duplicate id, impossible on an
    // empty scratch workspace) or inserts the node under its own id.
    throw new Error(`planCreateNode: node "${input.id}" missing after addNode`);
  }
  return { node, dbo: nodeToDbo(node) };
}
