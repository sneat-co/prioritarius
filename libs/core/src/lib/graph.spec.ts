import { describe, expect, it } from 'vitest';
import { addNode, createWorkspace } from './workspace';
import { addEdge, retargetEdge } from './graph';
import { formatPath } from './errors';

function workspaceWithChain() {
  let workspace = createWorkspace();
  workspace = addNode(workspace, { id: 'A', kind: 'goal', title: 'A' });
  workspace = addNode(workspace, { id: 'B', kind: 'goal', title: 'B' });
  workspace = addNode(workspace, { id: 'C', kind: 'goal', title: 'C' });
  return workspace;
}

describe('AC cycle-rejected', () => {
  // Given nodes A -> B -> C connected by contributes-to edges. When the
  // user attempts to add "C contributes to A". Then the edge is rejected,
  // the error names the existing path A -> B -> C, and the graph is
  // unchanged.
  it('refuses a contribution cycle, naming the offending path, graph unchanged', () => {
    const workspace = workspaceWithChain();
    const step1 = addEdge(workspace, {
      from: 'A',
      to: 'B',
      type: 'contributes_to',
    });
    if (step1.kind !== 'ok') throw new Error('expected ok');
    const step2 = addEdge(step1.workspace, {
      from: 'B',
      to: 'C',
      type: 'contributes_to',
    });
    if (step2.kind !== 'ok') throw new Error('expected ok');
    const before = step2.workspace;

    const result = addEdge(before, {
      from: 'C',
      to: 'A',
      type: 'contributes_to',
    });

    expect(result.kind).toBe('cycle-rejected');
    if (result.kind === 'cycle-rejected') {
      expect(result.error.path).toEqual(['A', 'B', 'C']);
      expect(formatPath(result.error.path)).toBe('A → B → C');
      expect(result.error.message).toContain('A → B → C');
    }
    expect(before.edges).toEqual([
      { from: 'A', to: 'B', type: 'contributes_to' },
      { from: 'B', to: 'C', type: 'contributes_to' },
    ]);
  });
});

describe('addEdge', () => {
  it('adds a valid contributes_to edge', () => {
    const workspace = workspaceWithChain();
    const result = addEdge(workspace, {
      from: 'A',
      to: 'B',
      type: 'contributes_to',
    });
    expect(result.kind).toBe('ok');
    if (result.kind === 'ok') {
      expect(result.workspace.edges).toEqual([
        { from: 'A', to: 'B', type: 'contributes_to' },
      ]);
    }
  });

  it('rejects a self-loop naming the single-node path', () => {
    const workspace = workspaceWithChain();
    const result = addEdge(workspace, {
      from: 'A',
      to: 'A',
      type: 'contributes_to',
    });
    expect(result.kind).toBe('cycle-rejected');
    if (result.kind === 'cycle-rejected') {
      expect(result.error.path).toEqual(['A']);
    }
  });

  it('rejects a direct 2-cycle', () => {
    const workspace = workspaceWithChain();
    const first = addEdge(workspace, {
      from: 'A',
      to: 'B',
      type: 'contributes_to',
    });
    expect(first.kind).toBe('ok');
    if (first.kind !== 'ok') throw new Error('expected ok');
    const result = addEdge(first.workspace, {
      from: 'B',
      to: 'A',
      type: 'contributes_to',
    });
    expect(result.kind).toBe('cycle-rejected');
    if (result.kind === 'cycle-rejected') {
      expect(result.error.path).toEqual(['A', 'B']);
      expect(formatPath(result.error.path)).toBe('A → B');
    }
  });

  it('scopes the DAG invariant per edge type: a blocks edge does not conflict with a contributes_to path', () => {
    let workspace = workspaceWithChain();
    const step1 = addEdge(workspace, {
      from: 'A',
      to: 'B',
      type: 'contributes_to',
    });
    if (step1.kind !== 'ok') throw new Error('expected ok');
    workspace = step1.workspace;
    const step2 = addEdge(workspace, {
      from: 'B',
      to: 'C',
      type: 'contributes_to',
    });
    if (step2.kind !== 'ok') throw new Error('expected ok');
    workspace = step2.workspace;

    // A "C blocks A" edge does not close a contributes_to cycle, because
    // cycle detection is scoped per edge type.
    const result = addEdge(workspace, { from: 'C', to: 'A', type: 'blocks' });
    expect(result.kind).toBe('ok');
  });

  it('leaves the graph completely unchanged on rejection', () => {
    let workspace = workspaceWithChain();
    const step1 = addEdge(workspace, {
      from: 'A',
      to: 'B',
      type: 'contributes_to',
    });
    if (step1.kind !== 'ok') throw new Error('expected ok');
    workspace = step1.workspace;
    const before = workspace;
    const result = addEdge(workspace, {
      from: 'B',
      to: 'A',
      type: 'contributes_to',
    });
    expect(result.kind).toBe('cycle-rejected');
    expect(workspace).toBe(before);
    expect(workspace.edges).toEqual([
      { from: 'A', to: 'B', type: 'contributes_to' },
    ]);
  });

  it('allows both a contributes_to and a blocks edge between the same pair', () => {
    const workspace = workspaceWithChain();
    const step1 = addEdge(workspace, {
      from: 'A',
      to: 'B',
      type: 'contributes_to',
    });
    if (step1.kind !== 'ok') throw new Error('expected ok');
    const step2 = addEdge(step1.workspace, {
      from: 'A',
      to: 'B',
      type: 'blocks',
    });
    expect(step2.kind).toBe('ok');
    if (step2.kind === 'ok') {
      expect(step2.workspace.edges).toHaveLength(2);
    }
  });
});

describe('retargetEdge', () => {
  it('changes an edge endpoint atomically', () => {
    let workspace = workspaceWithChain();
    workspace = addNode(workspace, { id: 'D', kind: 'goal', title: 'D' });
    const step1 = addEdge(workspace, {
      from: 'A',
      to: 'B',
      type: 'contributes_to',
    });
    if (step1.kind !== 'ok') throw new Error('expected ok');
    const result = retargetEdge(
      step1.workspace,
      { from: 'A', to: 'B', type: 'contributes_to' },
      { from: 'A', to: 'D' },
    );
    expect(result.kind).toBe('ok');
    if (result.kind === 'ok') {
      expect(result.workspace.edges).toEqual([
        { from: 'A', to: 'D', type: 'contributes_to' },
      ]);
    }
  });

  it('retargeting an edge onto its own current endpoints is a no-op ok', () => {
    const workspace = workspaceWithChain();
    const step1 = addEdge(workspace, {
      from: 'A',
      to: 'B',
      type: 'contributes_to',
    });
    if (step1.kind !== 'ok') throw new Error('expected ok');
    const result = retargetEdge(
      step1.workspace,
      { from: 'A', to: 'B', type: 'contributes_to' },
      { from: 'A', to: 'B' },
    );
    expect(result.kind).toBe('ok');
  });

  it('rejects retargeting an edge onto a path that would close a cycle', () => {
    // A -> B -> C (contributes_to). Retarget an unrelated D -> A edge to
    // become C -> A, which closes A -> B -> C -> A.
    let workspace = workspaceWithChain();
    workspace = addNode(workspace, { id: 'D', kind: 'goal', title: 'D' });
    const step1 = addEdge(workspace, {
      from: 'A',
      to: 'B',
      type: 'contributes_to',
    });
    if (step1.kind !== 'ok') throw new Error('expected ok');
    const step2 = addEdge(step1.workspace, {
      from: 'B',
      to: 'C',
      type: 'contributes_to',
    });
    if (step2.kind !== 'ok') throw new Error('expected ok');
    const step3 = addEdge(step2.workspace, {
      from: 'D',
      to: 'A',
      type: 'contributes_to',
    });
    if (step3.kind !== 'ok') throw new Error('expected ok');
    const before = step3.workspace;

    const result = retargetEdge(
      before,
      { from: 'D', to: 'A', type: 'contributes_to' },
      { from: 'C', to: 'A' },
    );
    expect(result.kind).toBe('cycle-rejected');
    if (result.kind === 'cycle-rejected') {
      expect(result.error.path).toEqual(['A', 'B', 'C']);
    }
    expect(before.edges).toEqual([
      { from: 'A', to: 'B', type: 'contributes_to' },
      { from: 'B', to: 'C', type: 'contributes_to' },
      { from: 'D', to: 'A', type: 'contributes_to' },
    ]);
  });
});
