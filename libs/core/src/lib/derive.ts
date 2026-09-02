import { estimateToHours } from './estimate';
import { UnknownNodeError } from './errors';
import {
  HOURS_PER_DAY,
  PrioritariusNode,
  UNESTIMATED_DEFAULT_DAYS,
  Workspace,
} from './types';

function requireNode(workspace: Workspace, nodeId: string): PrioritariusNode {
  const node = workspace.nodes.get(nodeId);
  if (!node) {
    throw new UnknownNodeError(nodeId);
  }
  return node;
}

/** Relative difference in [0, 1] between two non-negative hour figures. */
function relativeDifference(a: number, b: number): number {
  const denominator = Math.max(a, b);
  return denominator === 0 ? 0 : Math.abs(a - b) / denominator;
}

const DISCREPANCY_THRESHOLD = 0.2;

export interface RollupResult {
  readonly kind: 'rollup';
  readonly nodeId: string;
  readonly hasContributors: boolean;
  /** Sum of direct work-item contributors' effective estimates, in hours. */
  readonly hours: number;
  readonly contributorIds: ReadonlyArray<string>;
  readonly unestimatedContributorIds: ReadonlyArray<string>;
}

/**
 * Bottom-up rollup over a node's DIRECT work-item contributors only (a
 * direct goal/project contributor never counts here — see the package
 * README for why). Recurses through each contributor's own
 * {@link effectiveEstimate}, so a chain of work items decomposing other
 * work items rolls up correctly.
 */
export function rollup(workspace: Workspace, nodeId: string): RollupResult {
  requireNode(workspace, nodeId);
  const contributorIds = workspace.edges
    .filter((edge) => edge.type === 'contributes_to' && edge.to === nodeId)
    .map((edge) => edge.from)
    .filter((id) => workspace.nodes.get(id)?.kind === 'work_item');

  let hours = 0;
  const unestimatedContributorIds: string[] = [];
  for (const contributorId of contributorIds) {
    const effective = effectiveEstimate(workspace, contributorId);
    hours += effective.hours;
    if (effective.source === 'default-unestimated') {
      unestimatedContributorIds.push(contributorId);
    }
  }

  return {
    kind: 'rollup',
    nodeId,
    hasContributors: contributorIds.length > 0,
    hours,
    contributorIds,
    unestimatedContributorIds,
  };
}

export type EffectiveEstimateSource = 'rollup' | 'own' | 'default-unestimated';

export interface EffectiveEstimateResult {
  readonly kind: 'effective-estimate';
  readonly nodeId: string;
  readonly hours: number;
  readonly source: EffectiveEstimateSource;
  readonly ownHours?: number;
  readonly rollupHours?: number;
  /**
   * True when the own estimate and rollup are both present and differ by
   * >=20%, when any direct contributor is itself unestimated, or when this
   * node has no estimate at all (used the flagged default).
   */
  readonly discrepancy: boolean;
  readonly unestimatedContributors: ReadonlyArray<string>;
}

/**
 * Resolves a node's effective estimate: the bottom-up rollup of its direct
 * work-item contributors when any exist, else its own estimate, else a
 * FLAGGED default of {@link UNESTIMATED_DEFAULT_DAYS} day. Never mutates or
 * overwrites the node's own estimate.
 */
export function effectiveEstimate(
  workspace: Workspace,
  nodeId: string,
): EffectiveEstimateResult {
  const node = requireNode(workspace, nodeId);
  const ownHours = node.ownEstimate
    ? estimateToHours(node.ownEstimate)
    : undefined;
  const r = rollup(workspace, nodeId);

  if (r.hasContributors) {
    const discrepancy =
      r.unestimatedContributorIds.length > 0 ||
      (ownHours !== undefined &&
        relativeDifference(ownHours, r.hours) >= DISCREPANCY_THRESHOLD);
    return {
      kind: 'effective-estimate',
      nodeId,
      hours: r.hours,
      source: 'rollup',
      ownHours,
      rollupHours: r.hours,
      discrepancy,
      unestimatedContributors: r.unestimatedContributorIds,
    };
  }

  if (ownHours !== undefined) {
    return {
      kind: 'effective-estimate',
      nodeId,
      hours: ownHours,
      source: 'own',
      ownHours,
      rollupHours: undefined,
      discrepancy: false,
      unestimatedContributors: [],
    };
  }

  return {
    kind: 'effective-estimate',
    nodeId,
    hours: UNESTIMATED_DEFAULT_DAYS * HOURS_PER_DAY,
    source: 'default-unestimated',
    ownHours: undefined,
    rollupHours: undefined,
    discrepancy: true,
    unestimatedContributors: [],
  };
}

/**
 * The deduplicated set of work-item node ids upstream of `nodeId`, reached
 * by following `contributes_to` edges backward through nodes of any kind
 * (goal/project intermediaries are traversed, not counted). Includes
 * `nodeId` itself when it is a work item.
 */
export function upstreamWorkItemClosure(
  workspace: Workspace,
  nodeId: string,
): ReadonlySet<string> {
  requireNode(workspace, nodeId);
  const workItems = new Set<string>();
  const visited = new Set<string>([nodeId]);
  const queue: string[] = [nodeId];

  while (queue.length > 0) {
    const current = queue.shift() as string;
    if (workspace.nodes.get(current)?.kind === 'work_item') {
      workItems.add(current);
    }
    for (const edge of workspace.edges) {
      if (edge.type !== 'contributes_to' || edge.to !== current) {
        continue;
      }
      if (!visited.has(edge.from)) {
        visited.add(edge.from);
        queue.push(edge.from);
      }
    }
  }
  return workItems;
}

function countUnestimated(
  workspace: Workspace,
  itemIds: ReadonlyArray<string>,
): number {
  return itemIds.filter(
    (id) => effectiveEstimate(workspace, id).source === 'default-unestimated',
  ).length;
}

export interface CostResult {
  readonly kind: 'cost';
  readonly label: 'remaining-effort';
  readonly nodeId?: string;
  readonly hours: number;
  readonly unestimatedCount: number;
  readonly itemIds: ReadonlyArray<string>;
}

/**
 * Cost / effort-to-spend: the sum of NOT-YET-DONE work items' effective
 * estimates. Each work item is counted once, however many nodes it
 * contributes to. With `nodeId` given, scoped to that node's deduplicated
 * upstream work closure; omitted, this is the portfolio-wide total over
 * every work item in the workspace (still counted once each).
 */
export function remainingEffort(
  workspace: Workspace,
  nodeId?: string,
): CostResult {
  const itemIds =
    nodeId === undefined
      ? [...workspace.nodes.values()]
          .filter((node) => node.kind === 'work_item')
          .map((node) => node.id)
      : [...upstreamWorkItemClosure(workspace, nodeId)];

  let hours = 0;
  for (const id of itemIds) {
    const node = workspace.nodes.get(id);
    if (node?.kind === 'work_item' && node.status === 'done') {
      continue;
    }
    hours += effectiveEstimate(workspace, id).hours;
  }

  return {
    kind: 'cost',
    label: 'remaining-effort',
    nodeId,
    hours,
    unestimatedCount: countUnestimated(workspace, itemIds),
    itemIds,
  };
}

export interface BenefitResult {
  readonly kind: 'benefit';
  readonly label: 'attributed-benefit';
  readonly nodeId: string;
  readonly hours: number;
  readonly unestimatedCount: number;
  readonly itemIds: ReadonlyArray<string>;
}

/**
 * Attributed benefit: a work item's FULL effective estimate is attributed
 * to EVERY goal/project it transitively contributes to (never divided,
 * never deduplicated across nodes — a shared item benefits each of its
 * targets fully). Never conflated with {@link remainingEffort}: distinct
 * `kind`/`label`.
 */
export function attributedBenefit(
  workspace: Workspace,
  nodeId: string,
): BenefitResult {
  requireNode(workspace, nodeId);
  const itemIds = [...upstreamWorkItemClosure(workspace, nodeId)];
  let hours = 0;
  for (const id of itemIds) {
    hours += effectiveEstimate(workspace, id).hours;
  }
  return {
    kind: 'benefit',
    label: 'attributed-benefit',
    nodeId,
    hours,
    unestimatedCount: countUnestimated(workspace, itemIds),
    itemIds,
  };
}

export interface ProgressResult {
  readonly kind: 'estimated-progress';
  readonly label: 'estimated';
  readonly nodeId: string;
  readonly ratio: number;
  readonly completedHours: number;
  readonly totalHours: number;
  readonly unestimatedCount: number;
}

/**
 * Derived, always-labelled-"estimated" progress: completed effective effort
 * / total effective effort over the deduplicated upstream work closure.
 * When a node has no work-item contributors at all, its own estimate
 * stands in as the total, and its explicit completion flag stands in for
 * "done" (goals/projects never auto-complete from this ratio reaching 1).
 * Propagates transitively because the closure itself is transitive.
 */
export function estimatedProgress(
  workspace: Workspace,
  nodeId: string,
): ProgressResult {
  const node = requireNode(workspace, nodeId);
  const itemIds = [...upstreamWorkItemClosure(workspace, nodeId)];

  if (itemIds.length > 0) {
    let totalHours = 0;
    let completedHours = 0;
    for (const id of itemIds) {
      const hours = effectiveEstimate(workspace, id).hours;
      totalHours += hours;
      const item = workspace.nodes.get(id);
      if (item?.kind === 'work_item' && item.status === 'done') {
        completedHours += hours;
      }
    }
    return {
      kind: 'estimated-progress',
      label: 'estimated',
      nodeId,
      ratio: totalHours > 0 ? completedHours / totalHours : 0,
      completedHours,
      totalHours,
      unestimatedCount: countUnestimated(workspace, itemIds),
    };
  }

  const ownHours = node.ownEstimate ? estimateToHours(node.ownEstimate) : 0;
  const isComplete =
    (node.kind === 'goal' || node.kind === 'project') && node.completed;
  const completedHours = isComplete ? ownHours : 0;
  return {
    kind: 'estimated-progress',
    label: 'estimated',
    nodeId,
    ratio: ownHours > 0 ? completedHours / ownHours : 0,
    completedHours,
    totalHours: ownHours,
    unestimatedCount: 0,
  };
}

/**
 * Count of unestimated work items (those defaulting to the flagged
 * {@link UNESTIMATED_DEFAULT_DAYS}-day estimate) — portfolio-wide when
 * `nodeId` is omitted, else within that node's upstream work closure.
 */
export function unestimatedCount(
  workspace: Workspace,
  nodeId?: string,
): number {
  const itemIds =
    nodeId === undefined
      ? [...workspace.nodes.values()]
          .filter((node) => node.kind === 'work_item')
          .map((node) => node.id)
      : [...upstreamWorkItemClosure(workspace, nodeId)];
  return countUnestimated(workspace, itemIds);
}
