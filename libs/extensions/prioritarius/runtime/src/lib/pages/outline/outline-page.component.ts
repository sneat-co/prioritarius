import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { IonBadge } from '@ionic/angular/ion-badge';
import { IonButton } from '@ionic/angular/ion-button';
import { IonButtons } from '@ionic/angular/ion-buttons';
import { IonContent } from '@ionic/angular/ion-content';
import { IonHeader } from '@ionic/angular/ion-header';
import { IonIcon } from '@ionic/angular/ion-icon';
import { IonInput } from '@ionic/angular/ion-input';
import { IonItem } from '@ionic/angular/ion-item';
import { IonLabel } from '@ionic/angular/ion-label';
import { IonList } from '@ionic/angular/ion-list';
import { IonListHeader } from '@ionic/angular/ion-list-header';
import { IonMenuButton } from '@ionic/angular/ion-menu-button';
import { IonNote } from '@ionic/angular/ion-note';
import { IonReorder } from '@ionic/angular/ion-reorder';
import { IonReorderGroup } from '@ionic/angular/ion-reorder-group';
import { IonTitle } from '@ionic/angular/ion-title';
import { IonToolbar } from '@ionic/angular/ion-toolbar';
import { ItemReorderCustomEvent } from '@ionic/core';
import {
  NewNodeInput,
  PrioritariusNode,
  Workspace,
} from '@sneat/prioritarius-core';
import { spacePageUrl } from '@sneat/space-components';
import { SpaceNavService } from '@sneat/space-services';
import {
  describeNodeFigures,
  hoursToDisplayDays,
  NodeFigures,
  unestimatedFlagLabel,
} from '../../model/node-figures';
import {
  commitmentOf,
  isNodeCompleted,
  nodeKindLabel,
} from '../../model/node-guards';
import { WORKSPACE_TEMPLATES, WorkspaceTemplate } from '../../model/templates';
import { PrioritariusWorkspaceStore } from '../../workspace/prioritarius-workspace.store';
import { spaceContextFromRoute } from '../route-space-context';

interface OutlineRow {
  readonly id: string;
  readonly node: PrioritariusNode;
  readonly figures: NodeFigures;
}

function ionValue(event: Event): string {
  return String((event as CustomEvent).detail?.value ?? '');
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function rowSortKey(workspace: Workspace, row: OutlineRow): string {
  if (row.node.kind === 'goal') {
    const committedIndex = workspace.committedGoalOrder.indexOf(row.id);
    // Committed goals first, in their explicit drag order; everything else
    // after, alphabetically.
    const prefix =
      committedIndex >= 0 ? `0${String(committedIndex).padStart(6, '0')}` : '1';
    return `${prefix}-${row.node.title.toLowerCase()}`;
  }
  return row.node.title.toLowerCase();
}

// Entry: the space's "Outline" menu item (space-menu) and, cold, a direct
// deep link into `/space/:spaceType/:spaceID/outline`. Exit: creating a
// goal/project/work item navigates forward to its detail page (`node/:id`,
// replaceUrl) per the screen-flow default; applying a template creates
// several goals at once (no single "new entity" id to redirect to), so it
// stays here with the outline now populated.
@Component({
  selector: 'prioritarius-outline-page',
  imports: [
    RouterLink,
    IonHeader,
    IonToolbar,
    IonButtons,
    IonMenuButton,
    IonTitle,
    IonContent,
    IonList,
    IonListHeader,
    IonItem,
    IonLabel,
    IonButton,
    IonIcon,
    IonInput,
    IonBadge,
    IonNote,
    IonReorderGroup,
    IonReorder,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './outline-page.component.html',
})
export class OutlinePageComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly store = inject(PrioritariusWorkspaceStore);
  private readonly spaceNav = inject(SpaceNavService);

  protected readonly space = spaceContextFromRoute(this.route);
  protected readonly templates: readonly WorkspaceTemplate[] =
    WORKSPACE_TEMPLATES;

  protected readonly $workspace = toSignal<Workspace | undefined>(
    this.store.watchWorkspace(this.space.id),
    { initialValue: undefined },
  );
  protected readonly $errorMessage = signal<string | undefined>(undefined);
  protected readonly $busy = signal(false);

  protected readonly $rows = computed<readonly OutlineRow[]>(() => {
    const workspace = this.$workspace();
    if (!workspace) return [];
    return [...workspace.nodes.keys()]
      .map((id) => this.rowFor(workspace, id))
      .sort((a, b) =>
        rowSortKey(workspace, a).localeCompare(rowSortKey(workspace, b)),
      );
  });
  protected readonly $goals = computed(() =>
    this.$rows().filter((r) => r.node.kind === 'goal'),
  );
  /** Committed goals in their explicit drag order (REQ:goal-ordering) — the
   * only goals that are ever reorderable; exploring/parked goals sit
   * outside the ordered list per the spec. */
  protected readonly $committedGoals = computed<readonly OutlineRow[]>(() => {
    const workspace = this.$workspace();
    if (!workspace) return [];
    const byId = new Map(this.$goals().map((row) => [row.id, row]));
    return workspace.committedGoalOrder
      .map((id) => byId.get(id))
      .filter((row): row is OutlineRow => row !== undefined);
  });
  protected readonly $otherGoals = computed(() =>
    this.$goals().filter((row) => this.commitmentOf(row.node) !== 'committed'),
  );
  protected readonly $projects = computed(() =>
    this.$rows().filter((r) => r.node.kind === 'project'),
  );
  protected readonly $workItems = computed(() =>
    this.$rows().filter((r) => r.node.kind === 'work_item'),
  );
  protected readonly $isEmpty = computed(
    () => this.$workspace()?.nodes.size === 0,
  );

  protected newGoalTitle = '';
  protected newProjectTitle = '';
  protected newWorkItemTitle = '';

  protected readonly unestimatedFlagLabel = unestimatedFlagLabel;
  protected readonly hoursToDisplayDays = hoursToDisplayDays;
  protected readonly commitmentOf = commitmentOf;
  protected readonly isNodeCompleted = isNodeCompleted;
  protected readonly nodeKindLabel = nodeKindLabel;

  private rowFor(workspace: Workspace, id: string): OutlineRow {
    const node = workspace.nodes.get(id);
    if (!node) throw new Error(`unreachable: row for missing node ${id}`);
    return { id, node, figures: describeNodeFigures(workspace, id) };
  }

  protected onNewGoalTitleInput(event: Event): void {
    this.newGoalTitle = ionValue(event);
  }
  protected onNewProjectTitleInput(event: Event): void {
    this.newProjectTitle = ionValue(event);
  }
  protected onNewWorkItemTitleInput(event: Event): void {
    this.newWorkItemTitle = ionValue(event);
  }

  protected async createGoal(): Promise<void> {
    const title = this.newGoalTitle.trim();
    if (!title) return;
    await this.createNodeAndNavigate({
      id: crypto.randomUUID(),
      kind: 'goal',
      title,
    });
    this.newGoalTitle = '';
  }

  protected async createProject(): Promise<void> {
    const title = this.newProjectTitle.trim();
    if (!title) return;
    await this.createNodeAndNavigate({
      id: crypto.randomUUID(),
      kind: 'project',
      title,
    });
    this.newProjectTitle = '';
  }

  protected async createWorkItem(): Promise<void> {
    const title = this.newWorkItemTitle.trim();
    if (!title) return;
    await this.createNodeAndNavigate({
      id: crypto.randomUUID(),
      kind: 'work_item',
      title,
    });
    this.newWorkItemTitle = '';
  }

  private async createNodeAndNavigate(input: NewNodeInput): Promise<void> {
    this.$busy.set(true);
    try {
      const node = await this.store.createNode(this.space.id, input);
      await this.spaceNav.navigateForwardToSpacePage(
        this.space,
        `node/${node.id}`,
        {
          replaceUrl: true,
        },
      );
    } catch (error) {
      this.$errorMessage.set(
        `Could not create ${input.kind.replace('_', ' ')}: ${describeError(error)}`,
      );
    } finally {
      this.$busy.set(false);
    }
  }

  protected async applyTemplate(template: WorkspaceTemplate): Promise<void> {
    const workspace = this.$workspace();
    if (!workspace) return;
    this.$busy.set(true);
    try {
      await this.store.applyTemplate(this.space.id, workspace, template);
    } catch (error) {
      this.$errorMessage.set(
        `Could not apply template "${template.label}": ${describeError(error)}`,
      );
    } finally {
      this.$busy.set(false);
    }
  }

  protected async deleteRow(row: OutlineRow): Promise<void> {
    const workspace = this.$workspace();
    if (!workspace) return;
    if (
      !confirm(
        `Delete "${row.node.title}"? This also removes any connections to it.`,
      )
    ) {
      return;
    }
    this.$busy.set(true);
    try {
      await this.store.deleteNode(this.space.id, workspace, row.id);
    } catch (error) {
      this.$errorMessage.set(
        `Could not delete "${row.node.title}": ${describeError(error)}`,
      );
    } finally {
      this.$busy.set(false);
    }
  }

  protected spacePageUrl(page: string): string | undefined {
    return spacePageUrl(this.space, page);
  }

  /** `ion-reorder-group`'s drag handler for committed goals
   * (REQ:goal-ordering: "reorderable by drag"; "no numeric priority field
   * is ever entered" — this IS the priority statement). `detail.complete`
   * both finalizes the DOM move and, given the current order, returns the
   * reordered array. */
  protected async onCommittedGoalsReordered(
    event: ItemReorderCustomEvent,
  ): Promise<void> {
    const workspace = this.$workspace();
    if (!workspace) {
      event.detail.complete();
      return;
    }
    const currentOrder = this.$committedGoals().map((row) => row.id);
    const reordered = event.detail.complete(currentOrder) as string[];
    try {
      await this.store.reorderCommittedGoals(
        this.space.id,
        workspace,
        reordered,
      );
    } catch (error) {
      this.$errorMessage.set(
        `Could not save the new order: ${describeError(error)}`,
      );
    }
  }
}
