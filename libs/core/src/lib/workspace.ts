import { DuplicateNodeIdError, UnknownNodeError } from './errors';
import {
  CommitmentState,
  Deadline,
  Estimate,
  EstimateUnit,
  GoalOrProjectNode,
  PrioritariusNode,
  Workspace,
  WorkItemNode,
} from './types';

export interface CreateWorkspaceOptions {
  readonly unit?: EstimateUnit;
}

/** Creates an empty, immutable workspace. Default unit is 'days'. */
export function createWorkspace(
  options: CreateWorkspaceOptions = {},
): Workspace {
  return {
    unit: options.unit ?? 'days',
    nodes: new Map(),
    edges: [],
    committedGoalOrder: [],
  };
}

interface NewNodeCommonInput {
  readonly id: string;
  readonly title: string;
  readonly description?: string;
  readonly ownEstimate?: Estimate;
  readonly deadline?: Deadline;
}

export interface NewGoalOrProjectInput extends NewNodeCommonInput {
  readonly kind: 'goal' | 'project';
  readonly commitment?: CommitmentState;
}

export interface NewWorkItemInput extends NewNodeCommonInput {
  readonly kind: 'work_item';
  readonly status?: 'open' | 'done';
  readonly doneAt?: string;
}

export type NewNodeInput = NewGoalOrProjectInput | NewWorkItemInput;

function withNode(workspace: Workspace, node: PrioritariusNode): Workspace {
  const nodes = new Map(workspace.nodes);
  nodes.set(node.id, node);
  return { ...workspace, nodes };
}

function requireNode(workspace: Workspace, nodeId: string): PrioritariusNode {
  const node = workspace.nodes.get(nodeId);
  if (!node) {
    throw new UnknownNodeError(nodeId);
  }
  return node;
}

/**
 * Adds a node with kind-appropriate defaults (goal/project commitment
 * defaults to 'exploring'; a work item defaults to 'open'). Throws
 * {@link DuplicateNodeIdError} if the id is already present.
 */
export function addNode(workspace: Workspace, input: NewNodeInput): Workspace {
  if (workspace.nodes.has(input.id)) {
    throw new DuplicateNodeIdError(input.id);
  }

  if (input.kind === 'work_item') {
    const node: WorkItemNode = {
      id: input.id,
      kind: 'work_item',
      title: input.title,
      description: input.description,
      ownEstimate: input.ownEstimate,
      deadline: input.deadline,
      status: input.status ?? 'open',
      doneAt: input.doneAt,
    };
    return withNode(workspace, node);
  }

  const commitment = input.commitment ?? 'exploring';
  const node: GoalOrProjectNode = {
    id: input.id,
    kind: input.kind,
    title: input.title,
    description: input.description,
    ownEstimate: input.ownEstimate,
    deadline: input.deadline,
    commitment,
    completed: false,
  };
  let next = withNode(workspace, node);
  if (commitment === 'committed' && node.kind === 'goal') {
    next = {
      ...next,
      committedGoalOrder: [...next.committedGoalOrder, node.id],
    };
  }
  return next;
}

/** Sets the own (manual) estimate. Never derived; always overwrite-by-intent. */
export function setOwnEstimate(
  workspace: Workspace,
  nodeId: string,
  estimate: Estimate,
): Workspace {
  const node = requireNode(workspace, nodeId);
  return withNode(workspace, { ...node, ownEstimate: estimate });
}

/**
 * Sets commitment state on a goal/project. Maintains the committed-goal
 * ordered list: newly committed goals are appended at the end; uncommitted
 * goals are removed. Committed projects carry the state but no ordering.
 */
export function setCommitment(
  workspace: Workspace,
  nodeId: string,
  commitment: CommitmentState,
): Workspace {
  const node = requireNode(workspace, nodeId);
  if (node.kind !== 'goal' && node.kind !== 'project') {
    throw new Error(
      `Commitment only applies to goal/project nodes, not "${node.kind}" (${nodeId})`,
    );
  }
  const updated: GoalOrProjectNode = { ...node, commitment };
  let next = withNode(workspace, updated);

  if (node.kind === 'goal') {
    const wasCommitted = node.commitment === 'committed';
    const isCommitted = commitment === 'committed';
    if (!wasCommitted && isCommitted) {
      next = {
        ...next,
        committedGoalOrder: [...next.committedGoalOrder, nodeId],
      };
    } else if (wasCommitted && !isCommitted) {
      next = {
        ...next,
        committedGoalOrder: next.committedGoalOrder.filter(
          (id) => id !== nodeId,
        ),
      };
    }
  }
  return next;
}

/** Marks a work item done, stamping the completion timestamp. */
export function completeWorkItem(
  workspace: Workspace,
  nodeId: string,
  doneAt: string,
): Workspace {
  const node = requireNode(workspace, nodeId);
  if (node.kind !== 'work_item') {
    throw new Error(
      `completeWorkItem only applies to work_item nodes, not "${node.kind}" (${nodeId})`,
    );
  }
  return withNode(workspace, { ...node, status: 'done', doneAt });
}

/** Reopens a done work item, clearing the completion timestamp. */
export function reopenWorkItem(
  workspace: Workspace,
  nodeId: string,
): Workspace {
  const node = requireNode(workspace, nodeId);
  if (node.kind !== 'work_item') {
    throw new Error(
      `reopenWorkItem only applies to work_item nodes, not "${node.kind}" (${nodeId})`,
    );
  }
  return withNode(workspace, { ...node, status: 'open', doneAt: undefined });
}

/**
 * Explicitly completes (or reopens) a goal/project. This is the ONLY way a
 * goal/project's completion flag changes — estimated progress reaching 100%
 * never triggers it (see {@link estimatedProgress}).
 */
export function setNodeCompletion(
  workspace: Workspace,
  nodeId: string,
  completed: boolean,
  completedAt?: string,
): Workspace {
  const node = requireNode(workspace, nodeId);
  if (node.kind !== 'goal' && node.kind !== 'project') {
    throw new Error(
      `setNodeCompletion only applies to goal/project nodes, not "${node.kind}" (${nodeId}); use completeWorkItem for work items`,
    );
  }
  return withNode(workspace, {
    ...node,
    completed,
    completedAt: completed ? completedAt : undefined,
  });
}
