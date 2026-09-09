import { addEdge, addNode, createWorkspace } from '@sneat/prioritarius-core';
import { describeNodeFigures, unestimatedFlagLabel } from './node-figures';

describe('AC discrepancy-surfaced', () => {
  // Scenario: Top-down and bottom-up estimates disagree visibly
  // Given a project with an own estimate of 120 days whose direct work
  // items' effective estimates sum to 80 days
  // When the user views the project
  // Then both 120 and 80 are shown with a discrepancy indication, and
  // neither number has been overwritten.
  it('surfaces both the own and rollup day figures with a discrepancy flag, unmodified', () => {
    let workspace = createWorkspace();
    workspace = addNode(workspace, {
      id: 'project',
      kind: 'project',
      title: 'Relaunch',
      ownEstimate: { value: 120, unit: 'days' },
    });
    workspace = addNode(workspace, {
      id: 'wi1',
      kind: 'work_item',
      title: 'Design',
      ownEstimate: { value: 50, unit: 'days' },
    });
    workspace = addNode(workspace, {
      id: 'wi2',
      kind: 'work_item',
      title: 'Build',
      ownEstimate: { value: 30, unit: 'days' },
    });
    for (const from of ['wi1', 'wi2']) {
      const result = addEdge(workspace, {
        from,
        to: 'project',
        type: 'contributes_to',
      });
      if (result.kind !== 'ok') throw new Error('expected ok');
      workspace = result.workspace;
    }

    const figures = describeNodeFigures(workspace, 'project');

    // The UI-facing layer surfaces exactly what the core computed — it never
    // recomputes or overwrites either number.
    expect(figures.topDownDays).toBe(120);
    expect(figures.bottomUpDays).toBe(80);
    expect(figures.effective.discrepancy).toBe(true);
    expect(figures.effective.source).toBe('rollup');

    // The project's own estimate is untouched in the workspace value itself.
    expect(workspace.nodes.get('project')?.ownEstimate).toEqual({
      value: 120,
      unit: 'days',
    });
  });
});

describe('AC unestimated-flagged', () => {
  // Scenario: Missing estimates degrade gracefully, visibly
  // Given a goal whose upstream work includes two items without estimates
  // When rollups are computed
  // Then the defaulted items are counted at 1 day each and the goal's
  // figures carry an "n unestimated" flag.
  it('flags unestimated upstream work items and defaults them to 1 day each', () => {
    let workspace = createWorkspace();
    workspace = addNode(workspace, {
      id: 'goal',
      kind: 'goal',
      title: 'Launch',
    });
    workspace = addNode(workspace, {
      id: 'wi1',
      kind: 'work_item',
      title: 'Unestimated A',
    });
    workspace = addNode(workspace, {
      id: 'wi2',
      kind: 'work_item',
      title: 'Unestimated B',
    });
    for (const from of ['wi1', 'wi2']) {
      const result = addEdge(workspace, {
        from,
        to: 'goal',
        type: 'contributes_to',
      });
      if (result.kind !== 'ok') throw new Error('expected ok');
      workspace = result.workspace;
    }

    const figures = describeNodeFigures(workspace, 'goal');

    expect(figures.unestimatedInClosure).toBe(2);
    expect(unestimatedFlagLabel(figures.unestimatedInClosure)).toBe(
      '2 unestimated',
    );
    // 2 defaulted work items at UNESTIMATED_DEFAULT_DAYS (1 day) each.
    expect(figures.bottomUpDays).toBe(2);
  });

  it('renders no flag when nothing is unestimated', () => {
    expect(unestimatedFlagLabel(0)).toBeUndefined();
  });
});
