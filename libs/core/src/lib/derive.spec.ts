import { describe, expect, it } from 'vitest';
import { createWorkspace, addNode, completeWorkItem } from './workspace';
import { addEdge } from './graph';
import {
  attributedBenefit,
  effectiveEstimate,
  estimatedProgress,
  remainingEffort,
  rollup,
  unestimatedCount,
} from './derive';
import { UNESTIMATED_DEFAULT_DAYS, HOURS_PER_DAY } from './types';
import type { Workspace } from './types';

function contributes(
  workspace: Workspace,
  from: string,
  to: string,
): Workspace {
  const result = addEdge(workspace, { from, to, type: 'contributes_to' });
  if (result.kind !== 'ok') throw new Error('expected ok');
  return result.workspace;
}

describe('rollup', () => {
  it('is undefined when a node has no direct work-item contributors', () => {
    const workspace = addNode(createWorkspace(), {
      id: 'g1',
      kind: 'goal',
      title: 'Goal',
    });
    const result = rollup(workspace, 'g1');
    expect(result.hasContributors).toBe(false);
    expect(result.hours).toBe(0);
  });

  it('sums direct work-item contributors only, ignoring non-work-item contributors', () => {
    let workspace = createWorkspace();
    workspace = addNode(workspace, { id: 'g1', kind: 'goal', title: 'Goal' });
    workspace = addNode(workspace, {
      id: 'p1',
      kind: 'project',
      title: 'Project',
    });
    workspace = addNode(workspace, {
      id: 'w1',
      kind: 'work_item',
      title: 'Task',
      ownEstimate: { value: 2, unit: 'days' },
    });
    // p1 contributes directly to g1 (not a work item -> excluded from rollup)
    workspace = contributes(workspace, 'p1', 'g1');
    // w1 contributes directly to g1 (a work item -> included)
    workspace = contributes(workspace, 'w1', 'g1');

    const result = rollup(workspace, 'g1');
    expect(result.hasContributors).toBe(true);
    expect(result.hours).toBe(2 * HOURS_PER_DAY);
    expect(result.contributorIds).toEqual(['w1']);
  });
});

describe('effectiveEstimate', () => {
  it('defaults an unestimated leaf work item to a flagged 1 day', () => {
    const workspace = addNode(createWorkspace(), {
      id: 'w1',
      kind: 'work_item',
      title: 'Task',
    });
    const result = effectiveEstimate(workspace, 'w1');
    expect(result.source).toBe('default-unestimated');
    expect(result.hours).toBe(UNESTIMATED_DEFAULT_DAYS * HOURS_PER_DAY);
    expect(result.discrepancy).toBe(true);
  });

  it('uses the own estimate when there are no work-item contributors', () => {
    const workspace = addNode(createWorkspace(), {
      id: 'w1',
      kind: 'work_item',
      title: 'Task',
      ownEstimate: { value: 3, unit: 'days' },
    });
    const result = effectiveEstimate(workspace, 'w1');
    expect(result.source).toBe('own');
    expect(result.hours).toBe(3 * HOURS_PER_DAY);
    expect(result.discrepancy).toBe(false);
  });

  it('uses the rollup when direct work-item contributors exist, never overwriting own estimate', () => {
    let workspace = createWorkspace();
    workspace = addNode(workspace, {
      id: 'w1',
      kind: 'work_item',
      title: 'Parent task',
      ownEstimate: { value: 1, unit: 'days' },
    });
    workspace = addNode(workspace, {
      id: 'w2',
      kind: 'work_item',
      title: 'Sub task',
      ownEstimate: { value: 5, unit: 'days' },
    });
    workspace = contributes(workspace, 'w2', 'w1');

    const result = effectiveEstimate(workspace, 'w1');
    expect(result.source).toBe('rollup');
    expect(result.hours).toBe(5 * HOURS_PER_DAY);
    expect(result.ownHours).toBe(1 * HOURS_PER_DAY);
    expect(result.discrepancy).toBe(true); // differs by >=20%

    // Own estimate on the node itself is untouched.
    const node = workspace.nodes.get('w1');
    expect(node?.ownEstimate).toEqual({ value: 1, unit: 'days' });
  });

  it('flags discrepancy when own vs rollup differ by >=20%, not below', () => {
    let workspace = createWorkspace();
    workspace = addNode(workspace, {
      id: 'w1',
      kind: 'work_item',
      title: 'Parent',
      ownEstimate: { value: 10, unit: 'days' },
    });
    workspace = addNode(workspace, {
      id: 'w2',
      kind: 'work_item',
      title: 'Sub (close estimate)',
      ownEstimate: { value: 9, unit: 'days' }, // 10% off -> not flagged
    });
    workspace = contributes(workspace, 'w2', 'w1');
    const close = effectiveEstimate(workspace, 'w1');
    expect(close.discrepancy).toBe(false);
  });

  it('flags discrepancy when any direct contributor is itself unestimated', () => {
    let workspace = createWorkspace();
    workspace = addNode(workspace, {
      id: 'w1',
      kind: 'work_item',
      title: 'Parent',
    });
    workspace = addNode(workspace, {
      id: 'w2',
      kind: 'work_item',
      title: 'Sub (unestimated)',
    });
    workspace = contributes(workspace, 'w2', 'w1');
    const result = effectiveEstimate(workspace, 'w1');
    expect(result.source).toBe('rollup');
    expect(result.discrepancy).toBe(true);
    expect(result.unestimatedContributors).toEqual(['w2']);
  });
});

describe('unestimatedCount', () => {
  it('counts unestimated work items across the whole workspace', () => {
    let workspace = createWorkspace();
    workspace = addNode(workspace, { id: 'w1', kind: 'work_item', title: 'A' });
    workspace = addNode(workspace, {
      id: 'w2',
      kind: 'work_item',
      title: 'B',
      ownEstimate: { value: 1, unit: 'days' },
    });
    expect(unestimatedCount(workspace)).toBe(1);
  });

  it('counts unestimated work items within a single node upstream closure', () => {
    let workspace = createWorkspace();
    workspace = addNode(workspace, { id: 'g1', kind: 'goal', title: 'Goal' });
    workspace = addNode(workspace, { id: 'w1', kind: 'work_item', title: 'A' });
    workspace = addNode(workspace, {
      id: 'w2',
      kind: 'work_item',
      title: 'B',
      ownEstimate: { value: 1, unit: 'days' },
    });
    workspace = contributes(workspace, 'w1', 'g1');
    workspace = contributes(workspace, 'w2', 'g1');
    expect(unestimatedCount(workspace, 'g1')).toBe(1);
  });
});

describe('AC dedupe-cost-multiply-benefit', () => {
  // A 3-day work item contributing to three projects: the portfolio
  // remaining-effort total counts the 3 days once; each project's
  // attributed benefit from the item is 3 days; the two figures are
  // labelled differently.
  it('counts a shared 3-day task as one cost but three benefits', () => {
    let workspace = createWorkspace();
    workspace = addNode(workspace, {
      id: 'w1',
      kind: 'work_item',
      title: 'Shared task',
      ownEstimate: { value: 3, unit: 'days' },
    });
    workspace = addNode(workspace, { id: 'p1', kind: 'project', title: 'P1' });
    workspace = addNode(workspace, { id: 'p2', kind: 'project', title: 'P2' });
    workspace = addNode(workspace, { id: 'p3', kind: 'project', title: 'P3' });
    workspace = contributes(workspace, 'w1', 'p1');
    workspace = contributes(workspace, 'w1', 'p2');
    workspace = contributes(workspace, 'w1', 'p3');

    const portfolioCost = remainingEffort(workspace);
    expect(portfolioCost.kind).toBe('cost');
    expect(portfolioCost.label).toBe('remaining-effort');
    expect(portfolioCost.hours).toBe(3 * HOURS_PER_DAY);

    for (const projectId of ['p1', 'p2', 'p3']) {
      const benefit = attributedBenefit(workspace, projectId);
      expect(benefit.kind).toBe('benefit');
      expect(benefit.label).toBe('attributed-benefit');
      expect(benefit.hours).toBe(3 * HOURS_PER_DAY);
    }

    // Cost and benefit are never conflated: distinct kind/label discriminators.
    const oneBenefit = attributedBenefit(workspace, 'p1');
    expect(oneBenefit.kind).not.toBe(portfolioCost.kind);
    expect(oneBenefit.label).not.toBe(portfolioCost.label);
  });

  it('a completed shared work item drops out of remaining effort but stays in attributed benefit', () => {
    let workspace = createWorkspace();
    workspace = addNode(workspace, {
      id: 'w1',
      kind: 'work_item',
      title: 'Shared task',
      ownEstimate: { value: 3, unit: 'days' },
    });
    workspace = addNode(workspace, { id: 'p1', kind: 'project', title: 'P1' });
    workspace = contributes(workspace, 'w1', 'p1');
    workspace = completeWorkItem(workspace, 'w1', '2026-09-02T00:00:00.000Z');

    expect(remainingEffort(workspace).hours).toBe(0);
    expect(attributedBenefit(workspace, 'p1').hours).toBe(3 * HOURS_PER_DAY);
  });
});

describe('remainingEffort', () => {
  it('excludes blocks-only contributors (blocks has no contribution semantics)', () => {
    let workspace = createWorkspace();
    workspace = addNode(workspace, { id: 'g1', kind: 'goal', title: 'Goal' });
    workspace = addNode(workspace, {
      id: 'w1',
      kind: 'work_item',
      title: 'Blocker only',
      ownEstimate: { value: 4, unit: 'days' },
    });
    const blocked = addEdge(workspace, {
      from: 'w1',
      to: 'g1',
      type: 'blocks',
    });
    if (blocked.kind !== 'ok') throw new Error('expected ok');
    workspace = blocked.workspace;

    expect(remainingEffort(workspace, 'g1').hours).toBe(0);
  });
});

describe('AC progress-ripples', () => {
  // Goals G1 and G2 each with 10 days of remaining upstream work including a
  // shared 2-day task. Completing the task moves both goals' estimated
  // progress by the task's share; the label always reads "estimated"; no
  // goal ever auto-completes.
  it('moves both goals estimated progress by the shared task share, labelled estimated, never auto-completing', () => {
    let workspace = createWorkspace();
    workspace = addNode(workspace, { id: 'g1', kind: 'goal', title: 'G1' });
    workspace = addNode(workspace, { id: 'g2', kind: 'goal', title: 'G2' });

    // Shared 2-day task, contributing to both goals.
    workspace = addNode(workspace, {
      id: 'shared',
      kind: 'work_item',
      title: 'Shared task',
      ownEstimate: { value: 2, unit: 'days' },
    });
    // 8 more days of work private to each goal (so each goal totals 10 days).
    workspace = addNode(workspace, {
      id: 'g1-only',
      kind: 'work_item',
      title: 'G1 only',
      ownEstimate: { value: 8, unit: 'days' },
    });
    workspace = addNode(workspace, {
      id: 'g2-only',
      kind: 'work_item',
      title: 'G2 only',
      ownEstimate: { value: 8, unit: 'days' },
    });

    workspace = contributes(workspace, 'shared', 'g1');
    workspace = contributes(workspace, 'shared', 'g2');
    workspace = contributes(workspace, 'g1-only', 'g1');
    workspace = contributes(workspace, 'g2-only', 'g2');

    const before1 = estimatedProgress(workspace, 'g1');
    const before2 = estimatedProgress(workspace, 'g2');
    expect(before1.totalHours).toBe(10 * HOURS_PER_DAY);
    expect(before2.totalHours).toBe(10 * HOURS_PER_DAY);
    expect(before1.ratio).toBe(0);
    expect(before2.ratio).toBe(0);
    expect(before1.label).toBe('estimated');
    expect(before2.label).toBe('estimated');
    expect(before1.kind).toBe('estimated-progress');

    workspace = completeWorkItem(
      workspace,
      'shared',
      '2026-09-02T00:00:00.000Z',
    );

    const after1 = estimatedProgress(workspace, 'g1');
    const after2 = estimatedProgress(workspace, 'g2');
    // Each goal's progress increases by the shared task's share: 2/10 = 20%.
    expect(after1.ratio).toBeCloseTo(0.2);
    expect(after2.ratio).toBeCloseTo(0.2);
    expect(after1.label).toBe('estimated');
    expect(after2.label).toBe('estimated');

    // Neither goal auto-completes, at this or any other progress value.
    const g1 = workspace.nodes.get('g1');
    const g2 = workspace.nodes.get('g2');
    expect(g1?.kind === 'goal' && g1.completed).toBe(false);
    expect(g2?.kind === 'goal' && g2.completed).toBe(false);
  });

  it('never auto-completes even when estimated progress reaches 100%', () => {
    let workspace = createWorkspace();
    workspace = addNode(workspace, { id: 'g1', kind: 'goal', title: 'G1' });
    workspace = addNode(workspace, {
      id: 'w1',
      kind: 'work_item',
      title: 'Only task',
      ownEstimate: { value: 1, unit: 'days' },
    });
    workspace = contributes(workspace, 'w1', 'g1');
    workspace = completeWorkItem(workspace, 'w1', '2026-09-02T00:00:00.000Z');

    const progress = estimatedProgress(workspace, 'g1');
    expect(progress.ratio).toBe(1);
    const g1 = workspace.nodes.get('g1');
    expect(g1?.kind === 'goal' && g1.completed).toBe(false);
  });

  it('propagates transitively through an intermediate project', () => {
    let workspace = createWorkspace();
    workspace = addNode(workspace, { id: 'g1', kind: 'goal', title: 'G1' });
    workspace = addNode(workspace, { id: 'p1', kind: 'project', title: 'P1' });
    workspace = addNode(workspace, {
      id: 'w1',
      kind: 'work_item',
      title: 'Task',
      ownEstimate: { value: 4, unit: 'days' },
    });
    workspace = contributes(workspace, 'w1', 'p1');
    workspace = contributes(workspace, 'p1', 'g1');

    expect(estimatedProgress(workspace, 'g1').ratio).toBe(0);
    workspace = completeWorkItem(workspace, 'w1', '2026-09-02T00:00:00.000Z');
    expect(estimatedProgress(workspace, 'g1').ratio).toBe(1);
    expect(estimatedProgress(workspace, 'p1').ratio).toBe(1);
  });

  it('uses own estimate to stand in for progress when there are no work-item contributors', () => {
    let workspace = createWorkspace();
    workspace = addNode(workspace, {
      id: 'g1',
      kind: 'goal',
      title: 'G1',
      ownEstimate: { value: 2, unit: 'days' },
    });
    const notDone = estimatedProgress(workspace, 'g1');
    expect(notDone.totalHours).toBe(2 * HOURS_PER_DAY);
    expect(notDone.ratio).toBe(0);

    workspace = { ...workspace }; // no-op, goal completion is independent
    const stillNotDone = estimatedProgress(workspace, 'g1');
    expect(stillNotDone.ratio).toBe(0);
  });
});
