# @sneat/prioritarius-core

Pure TypeScript (ESM, no framework dependencies) domain model and graph
engine for Prioritarius: goals, projects, and work items connected by
`contributes_to` / `blocks` edges, with DAG enforcement, effective-estimate
rollups, deduplicated cost vs multiplied benefit aggregations, and derived
"estimated" progress.

Every API is a **pure function over an immutable `Workspace` value**. Every
mutator returns a brand-new `Workspace` (or, for edge mutators that could
violate the DAG invariant, a typed rejection) — it never mutates the value
passed in. The workspace itself has no persistence or side effects; it is a
plain in-memory value ready to be serialized (e.g. under
`/spaces/{spaceID}/ext/prioritarius/...`) by a calling layer.

## Building

Run `nx build prioritarius-core` to build the library.

## Running unit tests

Run `nx test prioritarius-core` to execute the unit tests via [Vitest](https://vitest.dev/).

## Model

### Node kinds

Exactly three: `goal`, `project`, `work_item` (`NodeKind`). All three share:

- `id: string` — caller-supplied; no global-namespace assumptions.
- `title: string`, optional `description?: string`.
- optional `ownEstimate?: Estimate` (`{ value: number; unit: 'hours' | 'days' }`).
- optional `deadline?: Deadline` (`{ date: string; hard: boolean }`) — a hard
  deadline blocks, a soft one is informational only (no enforcement in this
  package; a later surface decides what "blocks" means for a hard deadline).

`work_item` additionally carries `status: 'open' | 'done'` and `doneAt?`.
`goal`/`project` additionally carry `commitment: 'committed' | 'exploring' |
'parked'` (default `'exploring'`) and an **explicit** `completed: boolean` +
`completedAt?`. There is no fixed decomposition depth — any node may
contribute to any other, subject only to the DAG invariant below.

**Completion is never implicit.** A work item's `status` only changes via
`completeWorkItem`/`reopenWorkItem`. A goal/project's `completed` flag only
changes via `setNodeCompletion` — reaching 100% estimated progress never
sets it (see `estimatedProgress` below, and the `progress-ripples`
acceptance test).

**Committed goals form an ordered list.** `Workspace.committedGoalOrder`
tracks committed **goal** ids in commitment order (newly committed goals are
appended; uncommitted goals are removed) — `setCommitment`/`addNode`
maintain it automatically. Projects carry the same `commitment` state but no
ordering guarantee (the spec text singles out goals for ordering).

### Edges

`EdgeType` is `'contributes_to' | 'blocks'`:

- `contributes_to` (`A → B`): completing `A` advances `B`; many-to-many; an
  optional `strength?: number` is reserved for future weighting and is
  unused by every derivation in this package.
- `blocks` (`A → B`): `B` cannot start until `A` is done; carries **no**
  contribution semantics — it never participates in any estimate, cost,
  benefit, or progress derivation below.

A pair of nodes may carry both edge types at once.

### DAG invariant

Enforced **per edge type**, independently — a `contributes_to` cycle check
never sees `blocks` edges and vice versa, so `A blocks B` and `B contributes
to A` can coexist. `addEdge`/`retargetEdge` reject an edge that would close
a cycle within its own type's subgraph, atomically (no partial application)
and with a typed `CycleError` naming the **existing** path the new edge
would close (see `formatPath`, e.g. `"A → B → C"`).

### Estimates

- `estimateToHours` / `hoursToEstimate` convert between the two units; 1 day
  = `HOURS_PER_DAY` (8) hours.
- **`rollup(workspace, nodeId)`** — the bottom-up sum of a node's **direct**
  work-item contributors' effective estimates (a direct goal/project
  contributor is never counted here — see "Two separate concerns" below).
  Returns `{ hasContributors, hours, contributorIds, unestimatedContributorIds }`.
- **`effectiveEstimate(workspace, nodeId)`** — the resolved estimate: the
  `rollup` when the node has direct work-item contributors, else its own
  estimate, else a **flagged** default of `UNESTIMATED_DEFAULT_DAYS` (1) day.
  Returns `{ kind: 'effective-estimate', hours, source: 'rollup' | 'own' |
'default-unestimated', ownHours?, rollupHours?, discrepancy,
unestimatedContributors }`. `discrepancy` is `true` when own and rollup
  are both present and differ by ≥20%, when any direct contributor is
  itself unestimated, or whenever the node fell through to the flagged
  default. **The own estimate is never overwritten** — `effectiveEstimate`
  is a pure read; only `setOwnEstimate` changes it, and only by explicit
  call.

#### Two separate concerns

1. **`effectiveEstimate`/`rollup`** answer "what is this node's own
   resolved size?", by looking only at its _direct_ work-item contributors.
   This is what flags a stale/wrong own estimate.
2. **`remainingEffort`/`attributedBenefit`/`estimatedProgress`** answer
   questions about a node's full **upstream work closure** — every
   `work_item` transitively reachable via `contributes_to` edges (through
   goal/project intermediaries too), deduplicated by `upstreamWorkItemClosure`.

### Cost vs benefit — never conflated, always labelled

- **`remainingEffort(workspace, nodeId?)`** — cost / effort-to-spend: the
  sum of **not-yet-done** work items' effective estimates. Each work item
  counts once, however many nodes it contributes to. Omit `nodeId` for the
  **portfolio-wide** total (every work item in the workspace, once each);
  pass a `nodeId` to scope it to that node's upstream closure. Returns
  `{ kind: 'cost', label: 'remaining-effort', hours, unestimatedCount, itemIds }`.
- **`attributedBenefit(workspace, nodeId)`** — the same work items' **full**
  effective estimates (not reduced by completion), attributed wholly to
  `nodeId`. A work item shared by three projects contributes its full size
  to each project's benefit — never divided, never deduplicated _across_
  nodes (only within one node's own closure). Returns
  `{ kind: 'benefit', label: 'attributed-benefit', hours, unestimatedCount, itemIds }`.

The two are structurally impossible to mix up: `kind` and `label` are
distinct string literal types, not booleans or a shared enum.

### Derived, always-"estimated" progress

**`estimatedProgress(workspace, nodeId)`** = completed effective effort /
total effective effort over `nodeId`'s deduplicated upstream work closure;
propagates transitively because the closure itself is transitive. When the
closure is empty (no upstream work items at all), the node's own estimate
stands in as the total and its **explicit** completion flag stands in for
"done" — reaching a ratio of `1` never sets that flag itself. Returns
`{ kind: 'estimated-progress', label: 'estimated', ratio, completedHours,
totalHours, unestimatedCount }`. There is no manual percentage anywhere in
this model — every progress figure is derived.

### `unestimatedCount(workspace, nodeId?)`

Counts work items that fell through to the flagged default estimate —
portfolio-wide when `nodeId` is omitted, else within that node's upstream
closure.

## API summary

| Function                                                        | Shape                                                                             |
| --------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `createWorkspace(options?)`                                     | `Workspace`                                                                       |
| `addNode(workspace, input)`                                     | `Workspace` (throws `DuplicateNodeIdError`)                                       |
| `setOwnEstimate(workspace, nodeId, estimate)`                   | `Workspace`                                                                       |
| `setCommitment(workspace, nodeId, commitment)`                  | `Workspace`                                                                       |
| `completeWorkItem(workspace, nodeId, doneAt)`                   | `Workspace`                                                                       |
| `reopenWorkItem(workspace, nodeId)`                             | `Workspace`                                                                       |
| `setNodeCompletion(workspace, nodeId, completed, completedAt?)` | `Workspace`                                                                       |
| `addEdge(workspace, input)`                                     | `{ kind: 'ok', workspace } \| { kind: 'cycle-rejected', error: CycleError }`      |
| `retargetEdge(workspace, matcher, next)`                        | same as `addEdge` (throws `EdgeNotFoundError` if `matcher` doesn't match an edge) |
| `rollup(workspace, nodeId)`                                     | `RollupResult`                                                                    |
| `effectiveEstimate(workspace, nodeId)`                          | `EffectiveEstimateResult`                                                         |
| `upstreamWorkItemClosure(workspace, nodeId)`                    | `ReadonlySet<string>`                                                             |
| `remainingEffort(workspace, nodeId?)`                           | `CostResult`                                                                      |
| `attributedBenefit(workspace, nodeId)`                          | `BenefitResult`                                                                   |
| `estimatedProgress(workspace, nodeId)`                          | `ProgressResult`                                                                  |
| `unestimatedCount(workspace, nodeId?)`                          | `number`                                                                          |
| `estimateToHours(estimate)` / `hoursToEstimate(hours, unit)`    | `number` / `Estimate`                                                             |
| `formatPath(path)`                                              | `string` (e.g. `"A → B → C"`)                                                     |

All mutators throw `UnknownNodeError` for an unrecognized node id (except
`addNode`, which throws `DuplicateNodeIdError` for an id already present).
