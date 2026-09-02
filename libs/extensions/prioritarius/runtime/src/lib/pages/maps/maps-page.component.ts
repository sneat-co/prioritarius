import { ChangeDetectionStrategy, Component } from '@angular/core';
import { IonButtons } from '@ionic/angular/ion-buttons';
import { IonContent } from '@ionic/angular/ion-content';
import { IonHeader } from '@ionic/angular/ion-header';
import { IonMenuButton } from '@ionic/angular/ion-menu-button';
import { IonTitle } from '@ionic/angular/ion-title';
import { IonToolbar } from '@ionic/angular/ion-toolbar';

// Placeholder for the real Prioritarius surface: a goals/projects/tasks graph
// ("next best work"), not the template's retired listus-shaped lists demo.
// The domain model is still being specified (see
// https://github.com/sneat-co/backstage/blob/main/spec/features/prioritarius/domain-model/README.md),
// so this page is an honest empty state with nowhere to send the user yet —
// no CTA button, per the screen-flow rule against orphan actions.
@Component({
  selector: 'prioritarius-maps-page',
  imports: [
    IonHeader,
    IonToolbar,
    IonButtons,
    IonMenuButton,
    IonTitle,
    IonContent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ion-header>
      <ion-toolbar color="light">
        <ion-buttons slot="start">
          <ion-menu-button menu="mainMenu" />
        </ion-buttons>
        <ion-title>Maps</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content class="ion-padding">
      <h1>No goals maps yet</h1>
      <p>
        Prioritarius maps your tasks, projects and goals as one flowing graph.
        Map creation is coming — the graph model is being specified.
      </p>
    </ion-content>
  `,
})
export class MapsPageComponent {}
