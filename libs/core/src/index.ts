// Types
export type {
  NodeKind,
  EstimateUnit,
  Estimate,
  Deadline,
  CommitmentState,
  WorkItemNode,
  GoalOrProjectNode,
  PrioritariusNode,
  EdgeType,
  Edge,
  Workspace,
} from './lib/types';
export { UNESTIMATED_DEFAULT_DAYS, HOURS_PER_DAY } from './lib/types';

// Estimate helpers
export { estimateToHours, hoursToEstimate } from './lib/estimate';

// Errors
export type { CycleError } from './lib/errors';
export {
  formatPath,
  UnknownNodeError,
  DuplicateNodeIdError,
} from './lib/errors';

// Workspace: creation and node mutators (all pure, return a new Workspace)
export type {
  CreateWorkspaceOptions,
  NewNodeInput,
  NewGoalOrProjectInput,
  NewWorkItemInput,
} from './lib/workspace';
export {
  createWorkspace,
  addNode,
  setOwnEstimate,
  setCommitment,
  completeWorkItem,
  reopenWorkItem,
  setNodeCompletion,
} from './lib/workspace';

// Graph: edge mutators enforcing the per-edge-type DAG invariant
export type { NewEdgeInput, EdgeMatcher, AddEdgeResult } from './lib/graph';
export { addEdge, retargetEdge, EdgeNotFoundError } from './lib/graph';

// Derivations
export type {
  RollupResult,
  EffectiveEstimateSource,
  EffectiveEstimateResult,
  CostResult,
  BenefitResult,
  ProgressResult,
} from './lib/derive';
export {
  rollup,
  effectiveEstimate,
  upstreamWorkItemClosure,
  remainingEffort,
  attributedBenefit,
  estimatedProgress,
  unestimatedCount,
} from './lib/derive';
