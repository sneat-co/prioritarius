import { Injectable, inject } from '@angular/core';
import {
  collection,
  collectionData,
  deleteDoc,
  doc,
  docData,
  Firestore,
  setDoc,
  writeBatch,
} from '@angular/fire/firestore';
import { combineLatest, map, Observable } from 'rxjs';
import {
  AddEdgeResult,
  completeWorkItem,
  createWorkspace,
  Deadline,
  EdgeMatcher,
  Estimate,
  NewEdgeInput,
  NewNodeInput,
  CommitmentState,
  PrioritariusNode,
  reopenWorkItem,
  setCommitment,
  setNodeCompletion,
  setOwnEstimate,
  Workspace,
} from '@sneat/prioritarius-core';
import {
  edgeDocId,
  edgesCollectionPath,
  IPrioritariusEdgeDbo,
  IPrioritariusNodeDbo,
  IPrioritariusWorkspaceDbo,
  nodesCollectionPath,
  stripUndefinedFields,
  workspaceDocPath,
} from '../model/workspace-dbo';
import {
  assembleWorkspace,
  nodeToDbo,
  planConnectEdge,
  planCreateNode,
} from '../model/workspace-mapping';
import { planApplyTemplate, WorkspaceTemplate } from '../model/templates';

/**
 * Firestore-backed persistence for one space's Prioritarius workspace. Every
 * write goes through `../model/workspace-mapping.ts` (never a structural
 * dump of a core `Workspace`), and every mutation that carries a domain rule
 * (estimates, commitment/ordering, edges, completion) is computed by the
 * core engine first — this class only decides WHERE the result is written,
 * never what it means.
 */
@Injectable({ providedIn: 'root' })
export class PrioritariusWorkspaceStore {
  private readonly firestore = inject(Firestore);

  watchWorkspace(spaceID: string): Observable<Workspace> {
    const meta$ = docData(
      doc(this.firestore, workspaceDocPath(spaceID)),
    ) as unknown as Observable<IPrioritariusWorkspaceDbo | undefined>;
    const nodes$ = collectionData(
      collection(this.firestore, nodesCollectionPath(spaceID)),
      {
        idField: '__id',
      },
    ) as unknown as Observable<
      ReadonlyArray<IPrioritariusNodeDbo & { readonly __id: string }>
    >;
    const edges$ = collectionData(
      collection(this.firestore, edgesCollectionPath(spaceID)),
      {
        idField: '__id',
      },
    ) as unknown as Observable<
      ReadonlyArray<IPrioritariusEdgeDbo & { readonly __id: string }>
    >;

    return combineLatest([meta$, nodes$, edges$]).pipe(
      map(([meta, nodes, edges]) =>
        assembleWorkspace({
          meta,
          nodes: nodes.map(({ __id, ...dbo }) => ({ id: __id, dbo })),
          edges: edges.map(({ __id, ...dbo }) => ({ id: __id, dbo })),
        }),
      ),
    );
  }

  private nodeDocRef(spaceID: string, nodeId: string) {
    return doc(this.firestore, nodesCollectionPath(spaceID), nodeId);
  }

  private async writeNode(
    spaceID: string,
    nodeId: string,
    node: PrioritariusNode,
  ): Promise<void> {
    await setDoc(
      this.nodeDocRef(spaceID, nodeId),
      stripUndefinedFields(nodeToDbo(node)),
    );
  }

  private async touchMeta(
    spaceID: string,
    workspace: Workspace,
  ): Promise<void> {
    await setDoc(
      doc(this.firestore, workspaceDocPath(spaceID)),
      {
        unit: workspace.unit,
        committedGoalOrder: workspace.committedGoalOrder,
        updatedAt: new Date().toISOString(),
      } satisfies IPrioritariusWorkspaceDbo,
      { merge: true },
    );
  }

  async createNode(
    spaceID: string,
    input: NewNodeInput,
  ): Promise<PrioritariusNode> {
    const { node, dbo } = planCreateNode(input);
    await setDoc(this.nodeDocRef(spaceID, node.id), stripUndefinedFields(dbo));
    // Ensures the workspace meta doc exists (and carries the unit default)
    // the first time anything is created — persistence works without a
    // separate "create workspace" step.
    await this.touchMeta(spaceID, createWorkspace());
    return node;
  }

  /** Plain field edit — title/description/deadline carry no derivation rule
   * in the core engine, so this never needs to run a core mutator; it is a
   * pure reshape, same as every other mapper in this file. The caller (the
   * node edit form) always sends the field's full current value, including
   * `undefined` to mean "cleared" — there is no separate partial-patch
   * semantics to get wrong. */
  async updateNodeFields(
    spaceID: string,
    node: PrioritariusNode,
    fields: {
      readonly title: string;
      readonly description?: string;
      readonly deadline?: Deadline;
    },
  ): Promise<void> {
    const updated: PrioritariusNode = {
      ...node,
      title: fields.title,
      description: fields.description,
      deadline: fields.deadline,
    };
    await this.writeNode(spaceID, node.id, updated);
  }

  async updateOwnEstimate(
    spaceID: string,
    node: PrioritariusNode,
    estimate: Estimate,
  ): Promise<void> {
    const scratch = { ...createWorkspace(), nodes: new Map([[node.id, node]]) };
    const next = setOwnEstimate(scratch, node.id, estimate);
    const updated = next.nodes.get(node.id);
    if (updated) {
      await this.writeNode(spaceID, node.id, updated);
    }
  }

  /** Commitment changes touch the workspace-wide `committedGoalOrder`, so
   * (unlike the single-node mutators above) this needs the real workspace,
   * not a one-node scratch. */
  async updateCommitment(
    spaceID: string,
    workspace: Workspace,
    nodeId: string,
    commitment: CommitmentState,
  ): Promise<void> {
    const next = setCommitment(workspace, nodeId, commitment);
    const updated = next.nodes.get(nodeId);
    if (updated) {
      await this.writeNode(spaceID, nodeId, updated);
    }
    await this.touchMeta(spaceID, next);
  }

  async reorderCommittedGoals(
    spaceID: string,
    workspace: Workspace,
    order: readonly string[],
  ): Promise<void> {
    await this.touchMeta(spaceID, { ...workspace, committedGoalOrder: order });
  }

  async completeWorkItem(
    spaceID: string,
    node: PrioritariusNode,
    doneAt: string,
  ): Promise<void> {
    if (node.kind !== 'work_item') return;
    const scratch = { ...createWorkspace(), nodes: new Map([[node.id, node]]) };
    const updated = completeWorkItem(scratch, node.id, doneAt).nodes.get(
      node.id,
    );
    if (updated) {
      await this.writeNode(spaceID, node.id, updated);
    }
  }

  async reopenWorkItem(spaceID: string, node: PrioritariusNode): Promise<void> {
    if (node.kind !== 'work_item') return;
    const scratch = { ...createWorkspace(), nodes: new Map([[node.id, node]]) };
    const updated = reopenWorkItem(scratch, node.id).nodes.get(node.id);
    if (updated) {
      await this.writeNode(spaceID, node.id, updated);
    }
  }

  async setNodeCompletion(
    spaceID: string,
    node: PrioritariusNode,
    completed: boolean,
    completedAt?: string,
  ): Promise<void> {
    if (node.kind === 'work_item') return;
    const scratch = { ...createWorkspace(), nodes: new Map([[node.id, node]]) };
    const updated = setNodeCompletion(
      scratch,
      node.id,
      completed,
      completedAt,
    ).nodes.get(node.id);
    if (updated) {
      await this.writeNode(spaceID, node.id, updated);
    }
  }

  /** Returns the core's typed rejection (naming the offending path) on a
   * cycle so the caller can show it — never a silent failure. */
  async connectEdge(
    spaceID: string,
    workspace: Workspace,
    input: NewEdgeInput,
  ): Promise<AddEdgeResult> {
    const plan = planConnectEdge(workspace, input);
    if (plan.kind === 'cycle-rejected') {
      return plan;
    }
    await setDoc(
      doc(this.firestore, edgesCollectionPath(spaceID), plan.edgeDoc.id),
      stripUndefinedFields(plan.edgeDoc.dbo),
    );
    return { kind: 'ok', workspace: plan.workspace };
  }

  /** Removing an edge carries no invariant to check (only adding one can
   * close a cycle), so this needs no core call. */
  async removeEdge(spaceID: string, edge: EdgeMatcher): Promise<void> {
    await deleteDoc(
      doc(this.firestore, edgesCollectionPath(spaceID), edgeDocId(edge)),
    );
  }

  /** Deletes a node and every edge touching it (either endpoint, either
   * type) in one batch, so the graph never carries a dangling reference to
   * a node that no longer exists. */
  async deleteNode(
    spaceID: string,
    workspace: Workspace,
    nodeId: string,
  ): Promise<void> {
    const batch = writeBatch(this.firestore);
    batch.delete(this.nodeDocRef(spaceID, nodeId));
    for (const edge of workspace.edges) {
      if (edge.from === nodeId || edge.to === nodeId) {
        batch.delete(
          doc(this.firestore, edgesCollectionPath(spaceID), edgeDocId(edge)),
        );
      }
    }
    await batch.commit();
  }

  async applyTemplate(
    spaceID: string,
    workspace: Workspace,
    template: WorkspaceTemplate,
  ): Promise<Workspace> {
    const plan = planApplyTemplate(workspace, template, () =>
      crypto.randomUUID(),
    );
    const batch = writeBatch(this.firestore);
    for (const { id, node } of plan.created) {
      batch.set(
        this.nodeDocRef(spaceID, id),
        stripUndefinedFields(nodeToDbo(node)),
      );
    }
    await batch.commit();
    await this.touchMeta(spaceID, plan.workspace);
    return plan.workspace;
  }
}
