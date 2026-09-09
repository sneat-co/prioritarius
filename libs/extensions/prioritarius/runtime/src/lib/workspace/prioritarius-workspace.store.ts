import { Injectable, inject } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { doc, docData, Firestore } from '@angular/fire/firestore';
import { firstValueFrom, map, Observable } from 'rxjs';
import { SneatApiService } from '@sneat/api';
import {
  CommitmentState,
  CycleError,
  Deadline,
  Edge,
  EdgeMatcher,
  Estimate,
  NewEdgeInput,
  NodeKind,
  PrioritariusNode,
  Workspace,
} from '@sneat/prioritarius-core';
import {
  IPrioritariusWorkspaceDbo,
  stripUndefinedFields,
  workspaceDocPath,
} from '../model/workspace-dbo';
import {
  assembleWorkspace,
  cycleErrorFromApiError,
  dboToNode,
  localCycleCheck,
} from '../model/workspace-mapping';
import {
  IApiErrorBody,
  IApplyTemplateRequest,
  IApplyTemplateResponse,
  ICreateEdgeRequest,
  ICreateNodeRequest,
  IDeleteEdgeRequest,
  IDeleteEdgeResponse,
  IDeleteNodeRequest,
  IDeleteNodeResponse,
  IEdgeResponse,
  IListTemplatesResponse,
  INodeResponse,
  ISetGoalOrderRequest,
  ISetGoalOrderResponse,
  IUpdateNodeRequest,
  IWorkspaceTemplateSummary,
} from '../model/api-contracts';

/** Input to {@link PrioritariusWorkspaceStore.createNode} — deliberately NOT
 * the core's `NewNodeInput` (which mandates a caller-supplied `id`): the
 * backend generates the id server-side (`create_node` has no id field) and
 * returns it in the response. */
export type CreateNodeInput =
  | {
      readonly kind: 'goal' | 'project';
      readonly title: string;
      readonly description?: string;
      readonly ownEstimate?: Estimate;
      readonly deadline?: Deadline;
      readonly commitment?: CommitmentState;
    }
  | {
      readonly kind: 'work_item';
      readonly title: string;
      readonly description?: string;
      readonly ownEstimate?: Estimate;
      readonly deadline?: Deadline;
      readonly status?: 'open' | 'done';
    };

export type ConnectEdgeResult =
  | { readonly kind: 'ok'; readonly edge: Edge }
  | { readonly kind: 'cycle-rejected'; readonly error: CycleError };

function apiErrorBody(error: unknown): IApiErrorBody | undefined {
  if (
    error instanceof HttpErrorResponse &&
    error.error &&
    typeof error.error === 'object'
  ) {
    return error.error as IApiErrorBody;
  }
  return undefined;
}

function apiErrorMessage(error: unknown): string {
  return (
    apiErrorBody(error)?.message ??
    (error instanceof Error ? error.message : String(error))
  );
}

/** Wraps any failure as an `Error` carrying the original as `.cause` (the
 * lib target here — es2020 — predates the `Error(message, {cause})`
 * constructor overload, so `.cause` is set as a plain property instead;
 * every JS runtime this app ships to still honours it). */
function wrapApiError(error: unknown): Error {
  const wrapped = new Error(apiErrorMessage(error)) as Error & {
    cause?: unknown;
  };
  wrapped.cause = error;
  return wrapped;
}

/**
 * Persistence for one space's Prioritarius workspace.
 *
 * Founder ruling 2026-09-02, verbatim: "All writes in sneat always go throw
 * sneat-go backend https endpoints. No exceptions." — every mutation below
 * is an authenticated HTTP POST to `backend/api4prioritarius` (via
 * `SneatApiService`, which attaches the bearer token). Reads stay
 * client-direct Firestore (`watchWorkspace`): `firestore.rules` grants a
 * Space member read-only access to `/spaces/{spaceID}/ext/prioritarius`,
 * the single document holding the whole graph, and denies every write.
 *
 * Every write goes through `../model/workspace-mapping.ts`/`api-contracts.ts`
 * (never a structural dump of a core `Workspace`), and `create_edge`'s DAG
 * check is run locally FIRST as a fast pre-check (`localCycleCheck`) before
 * ever hitting the network — the backend transaction is still the
 * authority, since the local workspace snapshot can be stale.
 */
@Injectable({ providedIn: 'root' })
export class PrioritariusWorkspaceStore {
  private readonly firestore = inject(Firestore);
  private readonly api = inject(SneatApiService);

  /** A missing document (a Space with no Prioritarius data yet) means an
   * empty workspace, not an error — `assembleWorkspace(undefined)` returns
   * one. */
  watchWorkspace(spaceID: string): Observable<Workspace> {
    const doc$ = docData(
      doc(this.firestore, workspaceDocPath(spaceID)),
    ) as unknown as Observable<IPrioritariusWorkspaceDbo | undefined>;
    return doc$.pipe(map((workspaceDoc) => assembleWorkspace(workspaceDoc)));
  }

  private async post<TReq extends object, TResp>(
    endpoint: string,
    body: TReq,
  ): Promise<TResp> {
    try {
      return await firstValueFrom(
        this.api.post<TResp>(
          `prioritarius/${endpoint}`,
          stripUndefinedFields(body),
        ),
      );
    } catch (error) {
      throw wrapApiError(error);
    }
  }

  async createNode(
    spaceID: string,
    input: CreateNodeInput,
  ): Promise<PrioritariusNode> {
    const body: ICreateNodeRequest = {
      spaceID,
      kind: input.kind as NodeKind,
      title: input.title,
      description: input.description,
      ownEstimate: input.ownEstimate,
      deadline: input.deadline,
      commitment: input.kind !== 'work_item' ? input.commitment : undefined,
      status: input.kind === 'work_item' ? input.status : undefined,
    };
    const resp = await this.post<ICreateNodeRequest, INodeResponse>(
      'create_node',
      body,
    );
    return dboToNode(resp.node);
  }

  /** Plain field edit — title/description/deadline carry no derivation rule
   * in the core engine, so no core mutator applies here; this just maps
   * onto `update_node`'s pointer-present-means-set convention. The caller
   * (the node edit form) always sends the field's full current value,
   * including `undefined` to mean "cleared" — comparing against `node`'s
   * current value is what turns an `undefined` into the matching
   * `clearX: true` flag (a field the caller isn't touching at all simply
   * echoes its unchanged current value, so it never spuriously clears). */
  async updateNodeFields(
    spaceID: string,
    node: PrioritariusNode,
    fields: {
      readonly title: string;
      readonly description?: string;
      readonly deadline?: Deadline;
    },
  ): Promise<PrioritariusNode> {
    const body: IUpdateNodeRequest = {
      spaceID,
      id: node.id,
      title: fields.title,
      description: fields.description,
      clearDescription:
        fields.description === undefined && node.description !== undefined,
      deadline: fields.deadline,
      clearDeadline:
        fields.deadline === undefined && node.deadline !== undefined,
    };
    const resp = await this.post<IUpdateNodeRequest, INodeResponse>(
      'update_node',
      body,
    );
    return dboToNode(resp.node);
  }

  async updateOwnEstimate(
    spaceID: string,
    node: PrioritariusNode,
    estimate: Estimate,
  ): Promise<PrioritariusNode> {
    const body: IUpdateNodeRequest = {
      spaceID,
      id: node.id,
      ownEstimate: estimate,
    };
    const resp = await this.post<IUpdateNodeRequest, INodeResponse>(
      'update_node',
      body,
    );
    return dboToNode(resp.node);
  }

  async clearOwnEstimate(
    spaceID: string,
    node: PrioritariusNode,
  ): Promise<PrioritariusNode> {
    const body: IUpdateNodeRequest = {
      spaceID,
      id: node.id,
      clearOwnEstimate: true,
    };
    const resp = await this.post<IUpdateNodeRequest, INodeResponse>(
      'update_node',
      body,
    );
    return dboToNode(resp.node);
  }

  async updateCommitment(
    spaceID: string,
    nodeId: string,
    commitment: CommitmentState,
  ): Promise<PrioritariusNode> {
    const body: IUpdateNodeRequest = { spaceID, id: nodeId, commitment };
    const resp = await this.post<IUpdateNodeRequest, INodeResponse>(
      'update_node',
      body,
    );
    return dboToNode(resp.node);
  }

  /** goalIds MUST be exactly the current committed-goal set (the backend
   * validates this and rejects anything else) — this reorders, it never
   * commits/parks. */
  async reorderCommittedGoals(
    spaceID: string,
    order: readonly string[],
  ): Promise<void> {
    const body: ISetGoalOrderRequest = { spaceID, goalIds: order };
    await this.post<ISetGoalOrderRequest, ISetGoalOrderResponse>(
      'set_goal_order',
      body,
    );
  }

  async completeWorkItem(
    spaceID: string,
    node: PrioritariusNode,
  ): Promise<PrioritariusNode> {
    if (node.kind !== 'work_item') return node;
    const body: IUpdateNodeRequest = { spaceID, id: node.id, status: 'done' };
    const resp = await this.post<IUpdateNodeRequest, INodeResponse>(
      'update_node',
      body,
    );
    return dboToNode(resp.node);
  }

  async reopenWorkItem(
    spaceID: string,
    node: PrioritariusNode,
  ): Promise<PrioritariusNode> {
    if (node.kind !== 'work_item') return node;
    const body: IUpdateNodeRequest = { spaceID, id: node.id, status: 'open' };
    const resp = await this.post<IUpdateNodeRequest, INodeResponse>(
      'update_node',
      body,
    );
    return dboToNode(resp.node);
  }

  /** The ONLY way a goal/project's completion flag changes (REQ:
   * completion) — `completedAt` is stamped server-side, never sent by the
   * client. */
  async setNodeCompletion(
    spaceID: string,
    node: PrioritariusNode,
    completed: boolean,
  ): Promise<PrioritariusNode> {
    if (node.kind === 'work_item') return node;
    const body: IUpdateNodeRequest = { spaceID, id: node.id, completed };
    const resp = await this.post<IUpdateNodeRequest, INodeResponse>(
      'update_node',
      body,
    );
    return dboToNode(resp.node);
  }

  /**
   * Runs the core engine's cycle check locally first (a fast pre-check
   * against the workspace snapshot the caller already holds) and only
   * calls the network when that passes; the backend transaction is still
   * the authority — on a 409 `cycle_rejected` its (fresher) path replaces
   * the local one. Never a silent failure either way.
   */
  async connectEdge(
    spaceID: string,
    workspace: Workspace,
    input: NewEdgeInput,
  ): Promise<ConnectEdgeResult> {
    const localError = localCycleCheck(workspace, input);
    if (localError) {
      return { kind: 'cycle-rejected', error: localError };
    }
    const body: ICreateEdgeRequest = {
      spaceID,
      from: input.from,
      to: input.to,
      type: input.type,
      strength: input.strength,
    };
    try {
      const resp = await firstValueFrom(
        this.api.post<IEdgeResponse>(
          'prioritarius/create_edge',
          stripUndefinedFields(body),
        ),
      );
      return { kind: 'ok', edge: resp.edge };
    } catch (error) {
      if (error instanceof HttpErrorResponse && error.status === 409) {
        const errorBody = apiErrorBody(error) ?? {
          code: 'cycle_rejected',
          message: error.message,
        };
        return {
          kind: 'cycle-rejected',
          error: cycleErrorFromApiError(errorBody, input),
        };
      }
      throw wrapApiError(error);
    }
  }

  /** Removing an edge carries no invariant to check (only adding one can
   * close a cycle), so this needs no local pre-check. */
  async removeEdge(spaceID: string, edge: EdgeMatcher): Promise<void> {
    const body: IDeleteEdgeRequest = {
      spaceID,
      from: edge.from,
      to: edge.to,
      type: edge.type,
    };
    await this.post<IDeleteEdgeRequest, IDeleteEdgeResponse>(
      'delete_edge',
      body,
    );
  }

  /** The backend cascades — deleting the node, every edge incident to it
   * (either direction, either type) and its committedGoalOrder entry, all
   * atomically — so the client never deletes edges itself first. */
  async deleteNode(spaceID: string, nodeId: string): Promise<void> {
    const body: IDeleteNodeRequest = { spaceID, id: nodeId };
    await this.post<IDeleteNodeRequest, IDeleteNodeResponse>(
      'delete_node',
      body,
    );
  }

  async applyTemplate(spaceID: string, templateId: string): Promise<void> {
    const body: IApplyTemplateRequest = { spaceID, templateId };
    await this.post<IApplyTemplateRequest, IApplyTemplateResponse>(
      'apply_template',
      body,
    );
  }

  /**
   * Drives the "or start with a template" previews — never a hard-coded
   * second copy of the catalog, so a preview can never drift from what
   * `apply_template` actually creates (founder requirement). A parallel
   * lane is adding this endpoint; if it isn't deployed yet (404, or any
   * other failure), this degrades to an empty list so the caller hides the
   * template option entirely rather than guessing at a catalog.
   */
  async listTemplates(): Promise<readonly IWorkspaceTemplateSummary[]> {
    try {
      const resp = await firstValueFrom(
        this.api.post<IListTemplatesResponse>(
          'prioritarius/list_templates',
          {},
        ),
      );
      return resp.templates ?? [];
    } catch {
      return [];
    }
  }
}
