import {
  addNode,
  createWorkspace,
  upstreamWorkItemClosure,
} from '@sneat/prioritarius-core';
import {
  assembleWorkspace,
  dboToEdge,
  dboToNode,
  edgeToDbo,
  nodeToDbo,
  planConnectEdge,
  planCreateNode,
  RawWorkspaceDocs,
} from './workspace-mapping';
import { edgeDocId, stripUndefinedFields } from './workspace-dbo';

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
    expect(stripUndefinedFields(dbo)).not.toHaveProperty('commitment');
    const roundTripped = dboToNode('w1', dbo);
    expect(roundTripped).toEqual(node);
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
    expect(stripUndefinedFields(dbo)).not.toHaveProperty('status');
    expect(dboToNode('g1', dbo)).toEqual(node);
  });

  it('round-trips an edge through dbo and back', () => {
    const edge = { from: 'a', to: 'b', type: 'contributes_to' as const };
    expect(dboToEdge(edgeToDbo(edge))).toEqual({
      ...edge,
      strength: undefined,
    });
  });
});

describe('AC multi-target-contribution', () => {
  // Scenario: One task feeds two goals across projects
  // Given a workspace with goals "Website A live" and "Website B live" and a
  // work item "Reusable login"
  // When the user connects "Reusable login" as contributing to both goals
  // Then both edges exist, and "Reusable login" appears in the upstream work
  // closure of each goal.
  it('persists two contributes_to edges from one work item and both survive reload', () => {
    let workspace = createWorkspace();
    workspace = addNode(workspace, {
      id: 'goalA',
      kind: 'goal',
      title: 'Website A live',
    });
    workspace = addNode(workspace, {
      id: 'goalB',
      kind: 'goal',
      title: 'Website B live',
    });
    workspace = addNode(workspace, {
      id: 'login',
      kind: 'work_item',
      title: 'Reusable login',
    });

    const firstConnect = planConnectEdge(workspace, {
      from: 'login',
      to: 'goalA',
      type: 'contributes_to',
    });
    expect(firstConnect.kind).toBe('ok');
    if (firstConnect.kind !== 'ok') throw new Error('expected ok');
    workspace = firstConnect.workspace;

    const secondConnect = planConnectEdge(workspace, {
      from: 'login',
      to: 'goalB',
      type: 'contributes_to',
    });
    expect(secondConnect.kind).toBe('ok');
    if (secondConnect.kind !== 'ok') throw new Error('expected ok');
    workspace = secondConnect.workspace;

    // Each connect produced a distinct, deterministic edge doc — this is
    // exactly what the store persists to Firestore.
    expect(firstConnect.edgeDoc.id).toBe(
      edgeDocId({ from: 'login', to: 'goalA', type: 'contributes_to' }),
    );
    expect(secondConnect.edgeDoc.id).toBe(
      edgeDocId({ from: 'login', to: 'goalB', type: 'contributes_to' }),
    );
    expect(firstConnect.edgeDoc.id).not.toBe(secondConnect.edgeDoc.id);

    // Reassemble from the raw docs the store would have written — proving
    // the mapping layer (not the core engine) round-trips both edges.
    const docs: RawWorkspaceDocs = {
      meta: undefined,
      nodes: [...workspace.nodes.entries()].map(([id, node]) => ({
        id,
        dbo: nodeToDbo(node),
      })),
      edges: [firstConnect.edgeDoc, secondConnect.edgeDoc],
    };
    const reloaded = assembleWorkspace(docs);

    expect(reloaded.edges).toHaveLength(2);
    expect(upstreamWorkItemClosure(reloaded, 'goalA')).toEqual(
      new Set(['login']),
    );
    expect(upstreamWorkItemClosure(reloaded, 'goalB')).toEqual(
      new Set(['login']),
    );
  });
});

describe('planCreateNode', () => {
  it('reuses the core defaulting rules instead of restating them', () => {
    const { node, dbo } = planCreateNode({
      id: 'wi-1',
      kind: 'work_item',
      title: 'Do the thing',
    });
    expect(node.kind).toBe('work_item');
    expect(node).toMatchObject({ status: 'open' });
    expect(dbo.status).toBe('open');
  });
});
