import {
  addEdge,
  addNode,
  createWorkspace,
  NewEdgeInput,
  upstreamWorkItemClosure,
  Workspace,
} from '@sneat/prioritarius-core';
import {
  assembleWorkspace,
  cycleErrorFromApiError,
  dboToEdge,
  dboToNode,
  edgeToDbo,
  localCycleCheck,
  nodeToDbo,
} from './workspace-mapping';
import { IPrioritariusWorkspaceDbo } from './workspace-dbo';

// Applies an edge that MUST succeed, throwing on an unexpected rejection —
// keeps arrange-phase setup below linear and readable.
function addEdgeOrThrow(workspace: Workspace, input: NewEdgeInput): Workspace {
  const result = addEdge(workspace, input);
  if (result.kind !== 'ok') throw new Error('expected ok');
  return result.workspace;
}

describe('node/edge mapping round-trip', () => {
  it('round-trips a work item through dbo and back', () => {
    const workspace = addNode(createWorkspace(), {
      id: 'w1',
      kind: 'work_item',
      title: 'Ship it',
      ownEstimate: { value: 3, unit: 'days' },
      deadline: { date: '2026-12-01', hard: true },
    });
    const node = workspace.nodes.get('w1');
    if (!node) throw new Error('missing node');
    const dbo = nodeToDbo(node);
    expect(dbo).not.toHaveProperty('commitment');
    expect(dboToNode(dbo)).toEqual(node);
  });

  it('round-trips a goal through dbo and back', () => {
    const workspace = addNode(createWorkspace(), {
      id: 'g1',
      kind: 'goal',
      title: 'Website A live',
      commitment: 'committed',
    });
    const node = workspace.nodes.get('g1');
    if (!node) throw new Error('missing node');
    const dbo = nodeToDbo(node);
    expect(dbo).not.toHaveProperty('status');
    expect(dboToNode(dbo)).toEqual(node);
  });

  it('round-trips an edge through dbo and back', () => {
    const edge = { from: 'a', to: 'b', type: 'contributes_to' as const };
    expect(dboToEdge(edgeToDbo(edge))).toEqual({
      ...edge,
      strength: undefined,
    });
  });
});

describe('assembleWorkspace — single-document shape', () => {
  it('treats a missing document as an empty workspace, not an error', () => {
    const workspace = assembleWorkspace(undefined);
    expect(workspace.nodes.size).toBe(0);
    expect(workspace.edges).toEqual([]);
    expect(workspace.committedGoalOrder).toEqual([]);
    expect(workspace.unit).toBe('days');
  });

  it('reassembles nodes (keyed by id), edges and committedGoalOrder from the one document', () => {
    const doc: IPrioritariusWorkspaceDbo = {
      unit: 'days',
      nodes: {
        goalA: {
          id: 'goalA',
          kind: 'goal',
          title: 'Website A live',
          commitment: 'committed',
        },
        login: {
          id: 'login',
          kind: 'work_item',
          title: 'Reusable login',
          status: 'open',
        },
      },
      edges: [{ from: 'login', to: 'goalA', type: 'contributes_to' }],
      committedGoalOrder: ['goalA'],
    };

    const workspace = assembleWorkspace(doc);

    expect(workspace.nodes.size).toBe(2);
    expect(workspace.nodes.get('goalA')?.title).toBe('Website A live');
    expect(workspace.edges).toEqual([
      {
        from: 'login',
        to: 'goalA',
        type: 'contributes_to',
        strength: undefined,
      },
    ]);
    expect(workspace.committedGoalOrder).toEqual(['goalA']);
  });
});

describe('AC multi-target-contribution', () => {
  // Scenario: One task feeds two goals across projects
  // Given a workspace with goals "Website A live" and "Website B live" and a
  // work item "Reusable login"
  // When the user connects "Reusable login" as contributing to both goals
  // Then both edges exist, and "Reusable login" appears in the upstream work
  // closure of each goal.
  it('a workspace document holding both edges reassembles with the item in both closures', () => {
    // What the backend document looks like after two successful
    // create_edge calls (the write path itself is HTTP-mediated — see
    // prioritarius-workspace.store.spec.ts — this proves the READ-side
    // mapping, not the core engine's arithmetic, surfaces both edges).
    const doc: IPrioritariusWorkspaceDbo = {
      unit: 'days',
      nodes: {
        goalA: { id: 'goalA', kind: 'goal', title: 'Website A live' },
        goalB: { id: 'goalB', kind: 'goal', title: 'Website B live' },
        login: { id: 'login', kind: 'work_item', title: 'Reusable login' },
      },
      edges: [
        { from: 'login', to: 'goalA', type: 'contributes_to' },
        { from: 'login', to: 'goalB', type: 'contributes_to' },
      ],
      committedGoalOrder: [],
    };

    const workspace = assembleWorkspace(doc);

    expect(workspace.edges).toHaveLength(2);
    expect(upstreamWorkItemClosure(workspace, 'goalA')).toEqual(
      new Set(['login']),
    );
    expect(upstreamWorkItemClosure(workspace, 'goalB')).toEqual(
      new Set(['login']),
    );
  });
});

describe('localCycleCheck', () => {
  it('is undefined when the candidate edge introduces no cycle', () => {
    let workspace = createWorkspace();
    workspace = addNode(workspace, { id: 'a', kind: 'goal', title: 'A' });
    workspace = addNode(workspace, { id: 'b', kind: 'goal', title: 'B' });
    expect(
      localCycleCheck(workspace, {
        from: 'a',
        to: 'b',
        type: 'contributes_to',
      }),
    ).toBeUndefined();
  });

  it('names the pre-existing path exactly like the core engine does, as a fast pre-check', () => {
    let workspace = createWorkspace();
    for (const id of ['a', 'b', 'c']) {
      workspace = addNode(workspace, { id, kind: 'goal', title: id });
    }
    workspace = addEdgeOrThrow(workspace, {
      from: 'a',
      to: 'b',
      type: 'contributes_to',
    });
    workspace = addEdgeOrThrow(workspace, {
      from: 'b',
      to: 'c',
      type: 'contributes_to',
    });

    const error = localCycleCheck(workspace, {
      from: 'c',
      to: 'a',
      type: 'contributes_to',
    });
    expect(error?.message).toContain('a → b → c');
  });
});

describe('cycleErrorFromApiError', () => {
  it('maps a 409 cycle_rejected body to the same CycleError shape the local pre-check produces', () => {
    const error = cycleErrorFromApiError(
      {
        code: 'cycle_rejected',
        message:
          'adding "c" -contributes_to-> "a" would close a cycle via the existing path a → b → c',
        path: ['a', 'b', 'c'],
      },
      { from: 'c', to: 'a', type: 'contributes_to' },
    );
    expect(error.kind).toBe('cycle-rejected');
    expect(error.path).toEqual(['a', 'b', 'c']);
    expect(error.message).toContain('a → b → c');
  });
});
