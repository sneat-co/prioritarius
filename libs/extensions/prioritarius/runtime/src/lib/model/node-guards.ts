import {
  CommitmentState,
  GoalOrProjectNode,
  PrioritariusNode,
  WorkItemNode,
} from '@sneat/prioritarius-core';

/** Narrowing helpers used by templates (which don't reliably narrow a
 * discriminated union the way TS control flow does), kept here so every
 * page reads a node's kind-specific fields the same way. */

export function isWorkItem(node: PrioritariusNode): node is WorkItemNode {
  return node.kind === 'work_item';
}

export function isGoalOrProject(
  node: PrioritariusNode,
): node is GoalOrProjectNode {
  return node.kind !== 'work_item';
}

export function commitmentOf(
  node: PrioritariusNode,
): CommitmentState | undefined {
  return isGoalOrProject(node) ? node.commitment : undefined;
}

export function isNodeCompleted(node: PrioritariusNode): boolean {
  return isGoalOrProject(node) ? node.completed : node.status === 'done';
}

export function nodeKindLabel(node: PrioritariusNode): string {
  switch (node.kind) {
    case 'goal':
      return 'Goal';
    case 'project':
      return 'Project';
    case 'work_item':
      return 'Work item';
  }
}
