import { describe, expect, it } from 'vitest';
import { createWorkspace } from './workspace';
import {
  addNode,
  completeWorkItem,
  reopenWorkItem,
  setCommitment,
  setNodeCompletion,
  setOwnEstimate,
} from './workspace';
import { DuplicateNodeIdError, UnknownNodeError } from './errors';

describe('createWorkspace', () => {
  it('defaults the workspace estimate unit to days', () => {
    const workspace = createWorkspace();
    expect(workspace.unit).toBe('days');
  });

  it('accepts an explicit unit', () => {
    const workspace = createWorkspace({ unit: 'hours' });
    expect(workspace.unit).toBe('hours');
  });

  it('starts with no nodes, edges, or committed goals', () => {
    const workspace = createWorkspace();
    expect(workspace.nodes.size).toBe(0);
    expect(workspace.edges).toEqual([]);
    expect(workspace.committedGoalOrder).toEqual([]);
  });
});

describe('addNode', () => {
  it('is immutable: returns a new workspace, never mutates the input', () => {
    const before = createWorkspace();
    const after = addNode(before, { id: 'g1', kind: 'goal', title: 'Goal 1' });
    expect(before.nodes.size).toBe(0);
    expect(after.nodes.size).toBe(1);
    expect(after).not.toBe(before);
  });

  it('rejects a duplicate id', () => {
    const workspace = addNode(createWorkspace(), {
      id: 'g1',
      kind: 'goal',
      title: 'Goal 1',
    });
    expect(() =>
      addNode(workspace, { id: 'g1', kind: 'project', title: 'Dup' }),
    ).toThrow(DuplicateNodeIdError);
  });

  it('defaults goal/project commitment to exploring', () => {
    const workspace = addNode(createWorkspace(), {
      id: 'g1',
      kind: 'goal',
      title: 'Goal 1',
    });
    const node = workspace.nodes.get('g1');
    expect(node?.kind).toBe('goal');
    if (node?.kind === 'goal' || node?.kind === 'project') {
      expect(node.commitment).toBe('exploring');
      expect(node.completed).toBe(false);
    } else {
      throw new Error('expected goal node');
    }
  });

  it('defaults a work item to open status', () => {
    const workspace = addNode(createWorkspace(), {
      id: 'w1',
      kind: 'work_item',
      title: 'Task',
    });
    const node = workspace.nodes.get('w1');
    if (node?.kind === 'work_item') {
      expect(node.status).toBe('open');
      expect(node.doneAt).toBeUndefined();
    } else {
      throw new Error('expected work_item node');
    }
  });

  it('honors an explicit commitment on creation and orders committed goals', () => {
    let workspace = createWorkspace();
    workspace = addNode(workspace, {
      id: 'g1',
      kind: 'goal',
      title: 'Goal 1',
      commitment: 'committed',
    });
    workspace = addNode(workspace, {
      id: 'g2',
      kind: 'goal',
      title: 'Goal 2',
      commitment: 'committed',
    });
    expect(workspace.committedGoalOrder).toEqual(['g1', 'g2']);
  });
});

describe('setCommitment', () => {
  it('appends a newly committed goal to the end of the ordered list', () => {
    let workspace = addNode(createWorkspace(), {
      id: 'g1',
      kind: 'goal',
      title: 'Goal 1',
    });
    workspace = setCommitment(workspace, 'g1', 'committed');
    expect(workspace.committedGoalOrder).toEqual(['g1']);
    const node = workspace.nodes.get('g1');
    expect(node?.kind === 'goal' && node.commitment).toBe('committed');
  });

  it('removes a goal from the ordered list when uncommitted', () => {
    let workspace = addNode(createWorkspace(), {
      id: 'g1',
      kind: 'goal',
      title: 'Goal 1',
      commitment: 'committed',
    });
    workspace = setCommitment(workspace, 'g1', 'parked');
    expect(workspace.committedGoalOrder).toEqual([]);
  });

  it('does not track a committed project in the ordered list', () => {
    let workspace = addNode(createWorkspace(), {
      id: 'p1',
      kind: 'project',
      title: 'Project 1',
    });
    workspace = setCommitment(workspace, 'p1', 'committed');
    const node = workspace.nodes.get('p1');
    expect(node?.kind === 'project' && node.commitment).toBe('committed');
    expect(workspace.committedGoalOrder).toEqual([]);
  });

  it('throws for an unknown node id', () => {
    expect(() =>
      setCommitment(createWorkspace(), 'missing', 'committed'),
    ).toThrow(UnknownNodeError);
  });
});

describe('work item completion', () => {
  it('marks a work item done with a timestamp', () => {
    let workspace = addNode(createWorkspace(), {
      id: 'w1',
      kind: 'work_item',
      title: 'Task',
    });
    workspace = completeWorkItem(workspace, 'w1', '2026-09-02T00:00:00.000Z');
    const node = workspace.nodes.get('w1');
    expect(node?.kind === 'work_item' && node.status).toBe('done');
    expect(node?.kind === 'work_item' && node.doneAt).toBe(
      '2026-09-02T00:00:00.000Z',
    );
  });

  it('reopens a done work item, clearing the timestamp', () => {
    let workspace = addNode(createWorkspace(), {
      id: 'w1',
      kind: 'work_item',
      title: 'Task',
    });
    workspace = completeWorkItem(workspace, 'w1', '2026-09-02T00:00:00.000Z');
    workspace = reopenWorkItem(workspace, 'w1');
    const node = workspace.nodes.get('w1');
    expect(node?.kind === 'work_item' && node.status).toBe('open');
    expect(node?.kind === 'work_item' && node.doneAt).toBeUndefined();
  });
});

describe('goal/project explicit completion', () => {
  it('never completes automatically; only setNodeCompletion sets it', () => {
    let workspace = addNode(createWorkspace(), {
      id: 'g1',
      kind: 'goal',
      title: 'Goal 1',
    });
    const before = workspace.nodes.get('g1');
    expect(before?.kind === 'goal' && before.completed).toBe(false);

    workspace = setNodeCompletion(workspace, 'g1', true, '2026-09-02');
    const after = workspace.nodes.get('g1');
    expect(after?.kind === 'goal' && after.completed).toBe(true);
    expect(after?.kind === 'goal' && after.completedAt).toBe('2026-09-02');
  });

  it('rejects setting completion on a work item (use completeWorkItem)', () => {
    const workspace = addNode(createWorkspace(), {
      id: 'w1',
      kind: 'work_item',
      title: 'Task',
    });
    expect(() => setNodeCompletion(workspace, 'w1', true)).toThrow();
  });
});

describe('setOwnEstimate', () => {
  it('sets the own estimate without touching anything else', () => {
    let workspace = addNode(createWorkspace(), {
      id: 'w1',
      kind: 'work_item',
      title: 'Task',
    });
    workspace = setOwnEstimate(workspace, 'w1', { value: 2, unit: 'days' });
    const node = workspace.nodes.get('w1');
    expect(node?.ownEstimate).toEqual({ value: 2, unit: 'days' });
  });
});
