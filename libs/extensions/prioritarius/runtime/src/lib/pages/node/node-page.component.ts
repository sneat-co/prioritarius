import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { IonBadge } from '@ionic/angular/ion-badge';
import { IonButton } from '@ionic/angular/ion-button';
import { IonButtons } from '@ionic/angular/ion-buttons';
import { IonBackButton } from '@ionic/angular/ion-back-button';
import { IonCheckbox } from '@ionic/angular/ion-checkbox';
import { IonContent } from '@ionic/angular/ion-content';
import { IonHeader } from '@ionic/angular/ion-header';
import { IonInput } from '@ionic/angular/ion-input';
import { IonItem } from '@ionic/angular/ion-item';
import { IonLabel } from '@ionic/angular/ion-label';
import { IonList } from '@ionic/angular/ion-list';
import { IonListHeader } from '@ionic/angular/ion-list-header';
import { IonNote } from '@ionic/angular/ion-note';
import { IonSelect } from '@ionic/angular/ion-select';
import { IonSelectOption } from '@ionic/angular/ion-select-option';
import { IonTextarea } from '@ionic/angular/ion-textarea';
import { IonTitle } from '@ionic/angular/ion-title';
import { IonToolbar } from '@ionic/angular/ion-toolbar';
import {
  CommitmentState,
  Deadline,
  Edge,
  EdgeType,
  EstimateUnit,
  Workspace,
} from '@sneat/prioritarius-core';
import { spacePageUrl } from '@sneat/space-components';
import { SpaceNavService } from '@sneat/space-services';
import {
  describeNodeFigures,
  hoursToDisplayDays,
} from '../../model/node-figures';
import {
  commitmentOf,
  isWorkItem,
  nodeKindLabel,
} from '../../model/node-guards';
import { PrioritariusWorkspaceStore } from '../../workspace/prioritarius-workspace.store';
import { spaceContextFromRoute } from '../route-space-context';

function ionValue(event: Event): string {
  return String((event as CustomEvent).detail?.value ?? '');
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

interface EdgeRow {
  readonly edge: Edge;
  readonly otherTitle: string;
}

// Entry: routerLink from an outline row, or the create-redirect after
// `createGoal`/`createProject`/`createWorkItem` (replaceUrl'd, so Back skips
// the filled outline inputs). Cold deep link re-derives everything from the
// route's `id` + ancestor `spaceID`/`spaceType` — no reliance on router
// `state`. Exit: Back / after delete -> the outline (replaceUrl on delete).
@Component({
  selector: 'prioritarius-node-page',
  imports: [
    FormsModule,
    RouterLink,
    IonHeader,
    IonToolbar,
    IonButtons,
    IonBackButton,
    IonTitle,
    IonContent,
    IonList,
    IonListHeader,
    IonItem,
    IonLabel,
    IonInput,
    IonTextarea,
    IonSelect,
    IonSelectOption,
    IonCheckbox,
    IonButton,
    IonBadge,
    IonNote,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './node-page.component.html',
})
export class NodePageComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly store = inject(PrioritariusWorkspaceStore);
  private readonly spaceNav = inject(SpaceNavService);

  protected readonly space = spaceContextFromRoute(this.route);
  protected readonly nodeId = this.route.snapshot.paramMap.get('id') ?? '';

  protected readonly $workspace = toSignal<Workspace | undefined>(
    this.store.watchWorkspace(this.space.id),
    { initialValue: undefined },
  );
  protected readonly $node = computed(() =>
    this.$workspace()?.nodes.get(this.nodeId),
  );
  protected readonly $notFound = computed(
    () => this.$workspace() !== undefined && !this.$node(),
  );
  protected readonly $figures = computed(() => {
    const workspace = this.$workspace();
    return workspace && this.$node()
      ? describeNodeFigures(workspace, this.nodeId)
      : undefined;
  });

  protected readonly $errorMessage = signal<string | undefined>(undefined);
  protected readonly $busy = signal(false);

  protected readonly $contributesTo = computed<readonly EdgeRow[]>(() =>
    this.outgoingEdges('contributes_to'),
  );
  protected readonly $blocks = computed<readonly EdgeRow[]>(() =>
    this.outgoingEdges('blocks'),
  );

  protected readonly $otherNodes = computed(() => {
    const workspace = this.$workspace();
    if (!workspace) return [];
    return [...workspace.nodes.entries()]
      .filter(([id]) => id !== this.nodeId)
      .map(([id, node]) => ({ id, title: node.title }));
  });

  protected connectTargetId = '';
  protected blockTargetId = '';

  protected readonly commitmentOf = commitmentOf;
  protected readonly isWorkItem = isWorkItem;
  protected readonly nodeKindLabel = nodeKindLabel;
  protected readonly hoursToDisplayDays = hoursToDisplayDays;

  private outgoingEdges(type: EdgeType): readonly EdgeRow[] {
    const workspace = this.$workspace();
    if (!workspace) return [];
    return workspace.edges
      .filter((edge) => edge.type === type && edge.from === this.nodeId)
      .map((edge) => ({
        edge,
        otherTitle: workspace.nodes.get(edge.to)?.title ?? edge.to,
      }));
  }

  protected onTitleChange(event: Event): void {
    const node = this.$node();
    if (!node) return;
    void this.runOrReportError(() =>
      this.store.updateNodeFields(this.space.id, node, {
        title: ionValue(event) || node.title,
        description: node.description,
        deadline: node.deadline,
      }),
    );
  }

  protected onDescriptionChange(event: Event): void {
    const node = this.$node();
    if (!node) return;
    void this.runOrReportError(() =>
      this.store.updateNodeFields(this.space.id, node, {
        title: node.title,
        description: ionValue(event) || undefined,
        deadline: node.deadline,
      }),
    );
  }

  protected onDeadlineDateChange(event: Event): void {
    const node = this.$node();
    if (!node) return;
    const date = (event.target as HTMLInputElement | null)?.value;
    void this.runOrReportError(() =>
      this.store.updateNodeFields(this.space.id, node, {
        title: node.title,
        description: node.description,
        deadline: date
          ? { date, hard: node.deadline?.hard ?? false }
          : undefined,
      }),
    );
  }

  protected onDeadlineHardChange(event: Event): void {
    const node = this.$node();
    const deadline = node?.deadline;
    if (!node || !deadline) return;
    const hard = Boolean((event as CustomEvent).detail?.checked);
    const nextDeadline: Deadline = { date: deadline.date, hard };
    void this.runOrReportError(() =>
      this.store.updateNodeFields(this.space.id, node, {
        title: node.title,
        description: node.description,
        deadline: nextDeadline,
      }),
    );
  }

  protected onEstimateValueChange(event: Event): void {
    const node = this.$node();
    const raw = ionValue(event);
    if (!node || raw === '') return;
    const value = Number(raw);
    if (!Number.isFinite(value)) return;
    void this.runOrReportError(() =>
      this.store.updateOwnEstimate(this.space.id, node, {
        value,
        unit: node.ownEstimate?.unit ?? this.$workspace()?.unit ?? 'days',
      }),
    );
  }

  protected onEstimateUnitChange(event: Event): void {
    const node = this.$node();
    const ownEstimate = node?.ownEstimate;
    if (!node || !ownEstimate) return;
    const unit = ionValue(event) as EstimateUnit;
    void this.runOrReportError(() =>
      this.store.updateOwnEstimate(this.space.id, node, {
        value: ownEstimate.value,
        unit,
      }),
    );
  }

  protected onCommitmentChange(event: Event): void {
    const workspace = this.$workspace();
    if (!workspace) return;
    const commitment = ionValue(event) as CommitmentState;
    void this.runOrReportError(() =>
      this.store.updateCommitment(
        this.space.id,
        workspace,
        this.nodeId,
        commitment,
      ),
    );
  }

  protected onGoalOrProjectCompletionChange(event: Event): void {
    const node = this.$node();
    if (!node) return;
    const completed = Boolean((event as CustomEvent).detail?.checked);
    void this.runOrReportError(() =>
      this.store.setNodeCompletion(
        this.space.id,
        node,
        completed,
        completed ? new Date().toISOString() : undefined,
      ),
    );
  }

  protected async toggleWorkItemDone(): Promise<void> {
    const node = this.$node();
    if (!node || node.kind !== 'work_item') return;
    if (node.status === 'open') {
      await this.runOrReportError(() =>
        this.store.completeWorkItem(
          this.space.id,
          node,
          new Date().toISOString(),
        ),
      );
    } else {
      await this.runOrReportError(() =>
        this.store.reopenWorkItem(this.space.id, node),
      );
    }
  }

  protected async connectEdge(type: EdgeType): Promise<void> {
    const workspace = this.$workspace();
    const targetId =
      type === 'contributes_to' ? this.connectTargetId : this.blockTargetId;
    if (!workspace || !targetId) return;
    this.$busy.set(true);
    try {
      const result = await this.store.connectEdge(this.space.id, workspace, {
        from: this.nodeId,
        to: targetId,
        type,
      });
      if (result.kind === 'cycle-rejected') {
        // Surfaced verbatim (the core's message already names the offending
        // existing path via `formatPath`) — never a silent failure.
        this.$errorMessage.set(result.error.message);
      } else {
        this.$errorMessage.set(undefined);
        if (type === 'contributes_to') this.connectTargetId = '';
        else this.blockTargetId = '';
      }
    } catch (error) {
      this.$errorMessage.set(`Could not connect: ${describeError(error)}`);
    } finally {
      this.$busy.set(false);
    }
  }

  protected async removeEdge(edge: Edge): Promise<void> {
    await this.runOrReportError(() =>
      this.store.removeEdge(this.space.id, edge),
    );
  }

  protected async deleteNode(): Promise<void> {
    const workspace = this.$workspace();
    const node = this.$node();
    if (!workspace || !node) return;
    if (
      !confirm(
        `Delete "${node.title}"? This also removes any connections to it.`,
      )
    )
      return;
    this.$busy.set(true);
    try {
      await this.store.deleteNode(this.space.id, workspace, this.nodeId);
      await this.spaceNav.navigateBackToSpacePage(this.space, 'outline', {
        replaceUrl: true,
      });
    } catch (error) {
      this.$errorMessage.set(
        `Could not delete "${node.title}": ${describeError(error)}`,
      );
    } finally {
      this.$busy.set(false);
    }
  }

  protected spacePageUrl(page: string): string | undefined {
    return spacePageUrl(this.space, page);
  }

  private async runOrReportError(action: () => Promise<void>): Promise<void> {
    this.$busy.set(true);
    try {
      await action();
    } catch (error) {
      this.$errorMessage.set(describeError(error));
    } finally {
      this.$busy.set(false);
    }
  }
}
