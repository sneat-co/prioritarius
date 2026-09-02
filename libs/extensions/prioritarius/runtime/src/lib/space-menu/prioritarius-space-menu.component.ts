import { TitleCasePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonIcon } from '@ionic/angular/ion-icon';
import { IonItem } from '@ionic/angular/ion-item';
import { IonLabel } from '@ionic/angular/ion-label';
import { IonList } from '@ionic/angular/ion-list';
import { IonSelect } from '@ionic/angular/ion-select';
import { IonSelectOption } from '@ionic/angular/ion-select-option';
import { MenuController } from '@ionic/angular/menu-controller';
import { ISneatUserState } from '@sneat/auth-core';
import { IUserSpaceBrief } from '@sneat/auth-models';
import { AuthMenuItemComponent } from '@sneat/auth-ui';
import { IIdAndBrief } from '@sneat/core';
import {
  SpaceBaseComponent,
  SpaceComponentBaseParams,
} from '@sneat/space-components';
import { SpaceServiceModule } from '@sneat/space-services';
import { zipMapBriefsWithIDs } from '@sneat/space-models';
import { ClassName } from '@sneat/ui';
import { takeUntil } from 'rxjs/operators';

// prioritarius-specific side menu rendered in the space "menu" outlet. Unlike the
// generic @sneat SpaceMenuComponent (which hardcodes every sneat-app extension —
// Assets, Budget, Calendar, Contacts, Debts, …, none of which exist in
// prioritarius-app), this shows only what prioritarius has: a space selector (to
// switch spaces, like sneat-app) and the single Maps item — the template's
// listus-shaped "Lists" + per-list menu entries have been retired.
@Component({
  selector: 'prioritarius-space-menu',
  templateUrl: './prioritarius-space-menu.component.html',
  imports: [
    TitleCasePipe,
    RouterLink,
    SpaceServiceModule,
    IonList,
    IonItem,
    IonSelect,
    IonSelectOption,
    IonIcon,
    IonLabel,
    AuthMenuItemComponent,
  ],
  providers: [
    { provide: ClassName, useValue: 'PrioritariusSpaceMenuComponent' },
    SpaceComponentBaseParams,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PrioritariusSpaceMenuComponent extends SpaceBaseComponent {
  protected readonly $spaces = signal<
    readonly IIdAndBrief<IUserSpaceBrief>[] | undefined
  >(undefined);
  protected readonly $disabled = computed(() => !this.$spaceID());

  private readonly menuCtrl = inject(MenuController);

  constructor() {
    super();
    this.spaceParams.userService.userState
      .pipe(takeUntil(this.destroyed$))
      .subscribe({
        next: (userState: ISneatUserState) =>
          this.$spaces.set(
            userState?.record
              ? zipMapBriefsWithIDs(userState.record.spaces) || []
              : undefined,
          ),
        error: this.errorLogger.logErrorHandler('failed to get user state'),
      });
  }

  protected onSpaceSelected(event: Event): void {
    const spaceID = (event as CustomEvent).detail.value as string;
    if (spaceID === this.space?.id) {
      return;
    }
    const space = this.$spaces()?.find((t) => t.id === spaceID);
    if (space) {
      this.setSpaceRef(space);
      this.spaceNav
        .navigateToSpace(space)
        .catch(
          this.errorLogger.logErrorHandler(
            'Failed to navigate to selected space',
          ),
        );
    }
    this.closeMenu();
  }

  protected closeMenu(): void {
    this.menuCtrl.close().catch(this.errorLogger.logError);
  }
}
