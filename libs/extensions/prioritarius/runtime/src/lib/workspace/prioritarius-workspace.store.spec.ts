import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { Firestore } from '@angular/fire/firestore';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { SneatApiService } from '@sneat/api';
import {
  AddEdgeResult,
  addEdge,
  addNode,
  createWorkspace,
  Workspace,
} from '@sneat/prioritarius-core';
import { PrioritariusWorkspaceStore } from './prioritarius-workspace.store';

/**
 * Founder ruling 2026-09-02, verbatim: "All writes in sneat always go throw
 * sneat-go backend https endpoints. No exceptions." These tests prove every
 * mutation goes through `SneatApiService.post` to the right
 * `/v0/prioritarius/...` endpoint with the right body — never a
 * `setDoc`/`deleteDoc`/`writeBatch` against Firestore directly.
 */
describe('PrioritariusWorkspaceStore — write path is HTTP-only', () => {
  let apiPost: ReturnType<typeof vi.fn>;
  let store: PrioritariusWorkspaceStore;

  beforeEach(() => {
    apiPost = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        { provide: Firestore, useValue: {} },
        { provide: SneatApiService, useValue: { post: apiPost } },
      ],
    });
    store = TestBed.inject(PrioritariusWorkspaceStore);
  });

  it('createNode POSTs to create_node with the space-bounded request and maps the response node', async () => {
    apiPost.mockReturnValue(
      of({ node: { id: 'srv-1', kind: 'goal', title: 'Website A live' } }),
    );

    const node = await store.createNode('space-1', {
      kind: 'goal',
      title: 'Website A live',
    });

    expect(apiPost).toHaveBeenCalledWith(
      'prioritarius/create_node',
      expect.objectContaining({
        spaceID: 'space-1',
        kind: 'goal',
        title: 'Website A live',
      }),
    );
    // The backend, not the client, assigns the id (no client-generated uuid).
    expect(node.id).toBe('srv-1');
  });

  it('updateNodeFields sends clearDescription/clearDeadline only when the caller actually cleared them', async () => {
    apiPost.mockReturnValue(
      of({ node: { id: 'n1', kind: 'goal', title: 'New title' } }),
    );
    let workspace = createWorkspace();
    workspace = addNode(workspace, {
      id: 'n1',
      kind: 'goal',
      title: 'Old title',
      description: 'was here',
      deadline: { date: '2026-01-01', hard: false },
    });
    const node = workspace.nodes.get('n1');
    if (!node) throw new Error('missing node');

    await store.updateNodeFields('space-1', node, { title: 'New title' });

    expect(apiPost).toHaveBeenCalledWith('prioritarius/update_node', {
      spaceID: 'space-1',
      id: 'n1',
      title: 'New title',
      clearDescription: true,
      clearDeadline: true,
    });
  });

  it('deleteNode POSTs to delete_node and never deletes edges client-side first', async () => {
    apiPost.mockReturnValue(
      of({ id: 'n1', removedEdges: 2, removedFromGoalOrder: false }),
    );

    await store.deleteNode('space-1', 'n1');

    expect(apiPost).toHaveBeenCalledTimes(1);
    expect(apiPost).toHaveBeenCalledWith('prioritarius/delete_node', {
      spaceID: 'space-1',
      id: 'n1',
    });
  });

  it('removeEdge POSTs to delete_edge with the (from, to, type) triple', async () => {
    apiPost.mockReturnValue(of({ removed: true }));

    await store.removeEdge('space-1', {
      from: 'a',
      to: 'b',
      type: 'contributes_to',
    });

    expect(apiPost).toHaveBeenCalledWith('prioritarius/delete_edge', {
      spaceID: 'space-1',
      from: 'a',
      to: 'b',
      type: 'contributes_to',
    });
  });

  it('reorderCommittedGoals POSTs to set_goal_order with the reordered goal ids', async () => {
    apiPost.mockReturnValue(of({ committedGoalOrder: ['b', 'a'] }));

    await store.reorderCommittedGoals('space-1', ['b', 'a']);

    expect(apiPost).toHaveBeenCalledWith('prioritarius/set_goal_order', {
      spaceID: 'space-1',
      goalIds: ['b', 'a'],
    });
  });

  it('applyTemplate POSTs to apply_template with the chosen templateId', async () => {
    apiPost.mockReturnValue(of({ nodes: [], edges: [] }));

    await store.applyTemplate('space-1', 'personal');

    expect(apiPost).toHaveBeenCalledWith('prioritarius/apply_template', {
      spaceID: 'space-1',
      templateId: 'personal',
    });
  });

  it('connectEdge never calls the network when the local pre-check already finds a cycle', async () => {
    let workspace = createWorkspace();
    for (const id of ['a', 'b', 'c']) {
      workspace = addNode(workspace, { id, kind: 'goal', title: id });
    }
    workspace = mustOk(
      addEdge(workspace, { from: 'a', to: 'b', type: 'contributes_to' }),
    );
    workspace = mustOk(
      addEdge(workspace, { from: 'b', to: 'c', type: 'contributes_to' }),
    );

    const result = await store.connectEdge('space-1', workspace, {
      from: 'c',
      to: 'a',
      type: 'contributes_to',
    });

    expect(apiPost).not.toHaveBeenCalled();
    expect(result.kind).toBe('cycle-rejected');
  });

  it('connectEdge POSTs to create_edge when the local pre-check passes', async () => {
    let workspace = createWorkspace();
    workspace = addNode(workspace, { id: 'a', kind: 'goal', title: 'A' });
    workspace = addNode(workspace, { id: 'b', kind: 'goal', title: 'B' });
    apiPost.mockReturnValue(
      of({ edge: { from: 'a', to: 'b', type: 'contributes_to' } }),
    );

    const result = await store.connectEdge('space-1', workspace, {
      from: 'a',
      to: 'b',
      type: 'contributes_to',
    });

    expect(apiPost).toHaveBeenCalledWith('prioritarius/create_edge', {
      spaceID: 'space-1',
      from: 'a',
      to: 'b',
      type: 'contributes_to',
    });
    expect(result.kind).toBe('ok');
  });

  // AC-adjacent (REQ:dag-invariant): the server is the authority; a 409
  // cycle_rejected response must render the SAME named-path error the local
  // pre-check produces — never a silent failure.
  it("renders the backend's 409 cycle_rejected path when the server rejects an edge the local pre-check missed (stale local snapshot)", async () => {
    let workspace = createWorkspace();
    workspace = addNode(workspace, { id: 'a', kind: 'goal', title: 'A' });
    workspace = addNode(workspace, { id: 'b', kind: 'goal', title: 'B' });
    apiPost.mockReturnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 409,
            error: {
              code: 'cycle_rejected',
              message:
                'adding "a" -contributes_to-> "b" would close a cycle via the existing path b → x → a',
              path: ['b', 'x', 'a'],
            },
          }),
      ),
    );

    const result = await store.connectEdge('space-1', workspace, {
      from: 'a',
      to: 'b',
      type: 'contributes_to',
    });

    expect(result.kind).toBe('cycle-rejected');
    if (result.kind !== 'cycle-rejected')
      throw new Error('expected cycle-rejected');
    expect(result.error.path).toEqual(['b', 'x', 'a']);
    expect(result.error.message).toContain('b → x → a');
  });

  it("surfaces every other mutation failure with the server's message — never a silent failure", async () => {
    apiPost.mockReturnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 403,
            error: {
              code: 'forbidden',
              message: 'caller is not a member of the space',
            },
          }),
      ),
    );

    await expect(store.deleteNode('space-1', 'n1')).rejects.toThrow(
      'caller is not a member of the space',
    );
  });

  it('listTemplates degrades to an empty list when the endpoint is not deployed yet, rather than hard-coding a catalog', async () => {
    apiPost.mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 404 })),
    );

    const templates = await store.listTemplates();

    expect(templates).toEqual([]);
  });
});

function mustOk(result: AddEdgeResult): Workspace {
  if (result.kind !== 'ok') throw new Error('expected ok');
  return result.workspace;
}
