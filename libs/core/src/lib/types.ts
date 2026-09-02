/**
 * Core domain types for the Prioritarius goal/project/work-item graph.
 *
 * See the package README for the derivation rules these types support.
 */

/** The three node kinds. No fixed decomposition depth is implied. */
export type NodeKind = 'goal' | 'project' | 'work_item';

/** Workspace-level default estimate unit; 1 day = 8 hours. */
export type EstimateUnit = 'hours' | 'days';

/** An own (manually entered) estimate, in either unit. */
export interface Estimate {
  readonly value: number;
  readonly unit: EstimateUnit;
}

/** A hard deadline blocks; a soft deadline is informational only. */
export interface Deadline {
  readonly date: string;
  readonly hard: boolean;
}

/** Commitment state for goal/project nodes. Default is 'exploring'. */
export type CommitmentState = 'committed' | 'exploring' | 'parked';

interface BaseNode {
  readonly id: string;
  readonly title: string;
  readonly description?: string;
  readonly ownEstimate?: Estimate;
  readonly deadline?: Deadline;
}

/** Work items are the only nodes with an implicit open/done lifecycle. */
export interface WorkItemNode extends BaseNode {
  readonly kind: 'work_item';
  readonly status: 'open' | 'done';
  readonly doneAt?: string;
}

/**
 * Goals and projects are never auto-completed by progress reaching 100%;
 * completion is always an explicit act (see {@link setNodeCompletion}).
 */
export interface GoalOrProjectNode extends BaseNode {
  readonly kind: 'goal' | 'project';
  readonly commitment: CommitmentState;
  readonly completed: boolean;
  readonly completedAt?: string;
}

export type PrioritariusNode = WorkItemNode | GoalOrProjectNode;

/**
 * `contributes_to`: completing `from` advances `to` (many-to-many).
 * `blocks`: `to` cannot start until `from` is done; no contribution semantics.
 * A pair of nodes may carry both edge types at once.
 */
export type EdgeType = 'contributes_to' | 'blocks';

export interface Edge {
  readonly from: string;
  readonly to: string;
  readonly type: EdgeType;
  /** Reserved for future weighting. Unused by every MVP derivation. */
  readonly strength?: number;
}

/**
 * The workspace is an immutable value: every mutator returns a *new*
 * Workspace (or, for edge mutators, a typed rejection) and never mutates
 * the instance passed in.
 */
export interface Workspace {
  readonly unit: EstimateUnit;
  readonly nodes: ReadonlyMap<string, PrioritariusNode>;
  readonly edges: ReadonlyArray<Edge>;
  /**
   * Ordered list of committed goal ids, in commitment order. Spec text
   * singles out goals ("Committed goals form an ordered list"); committed
   * projects carry the same `commitment` state but no ordering guarantee.
   */
  readonly committedGoalOrder: ReadonlyArray<string>;
}

/** A work item defaults to this flagged estimate when it has no own estimate
 * and no estimated work-item contributors of its own. */
export const UNESTIMATED_DEFAULT_DAYS = 1;
export const HOURS_PER_DAY = 8;
