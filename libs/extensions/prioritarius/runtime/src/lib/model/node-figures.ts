import {
  EffectiveEstimateResult,
  estimateToHours,
  effectiveEstimate,
  estimatedProgress,
  HOURS_PER_DAY,
  ProgressResult,
  unestimatedCount,
  Workspace,
} from '@sneat/prioritarius-core';

/**
 * The read-side figures the outline/detail UI renders for one node. Every
 * number here is read straight off a core derivation — this module adds no
 * business rule, only reshapes hours into the workspace's display unit
 * (days by default) and names the two presentation concerns the spec calls
 * out: the top-down/bottom-up discrepancy (REQ:two-estimates-visible) and
 * the unestimated-count flag (REQ:estimate-model).
 */
export interface NodeFigures {
  readonly effective: EffectiveEstimateResult;
  readonly progress: ProgressResult;
  /** Unestimated work items in this node's upstream closure — the flag
   * shown as "n unestimated" (AC unestimated-flagged). */
  readonly unestimatedInClosure: number;
  /** Own (top-down) estimate in days, when the node has one. */
  readonly topDownDays?: number;
  /** Bottom-up rollup of direct work-item contributors, in days, when the
   * node has any. Shown alongside `topDownDays` without overwriting either
   * (AC discrepancy-surfaced) whenever `effective.discrepancy` is true. */
  readonly bottomUpDays?: number;
}

export function describeNodeFigures(
  workspace: Workspace,
  nodeId: string,
): NodeFigures {
  const effective = effectiveEstimate(workspace, nodeId);
  const progress = estimatedProgress(workspace, nodeId);
  return {
    effective,
    progress,
    unestimatedInClosure: unestimatedCount(workspace, nodeId),
    topDownDays:
      effective.ownHours !== undefined
        ? effective.ownHours / HOURS_PER_DAY
        : undefined,
    bottomUpDays:
      effective.rollupHours !== undefined
        ? effective.rollupHours / HOURS_PER_DAY
        : undefined,
  };
}

/** `undefined` when there is nothing to flag — callers render nothing, not
 * an empty/zero badge. */
export function unestimatedFlagLabel(count: number): string | undefined {
  return count > 0 ? `${count} unestimated` : undefined;
}

/** Rounds to a friendly day figure for display (core derivations work in
 * hours; the workspace's own unit conversion is `estimateToHours`'s
 * inverse). */
export function hoursToDisplayDays(hours: number): number {
  return Math.round((hours / HOURS_PER_DAY) * 10) / 10;
}

export function daysToHours(days: number): number {
  return estimateToHours({ value: days, unit: 'days' });
}
