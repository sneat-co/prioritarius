import { Route } from '@angular/router';
import { SpaceComponentBaseParams } from '@sneat/space-components';
import { PrioritariusSpaceMenuComponent } from './space-menu/prioritarius-space-menu.component';
import { prioritariusRoutes } from './prioritarius-routing';

export const prioritariusSpaceRoutes: Route[] = [
  {
    path: '',
    providers: [SpaceComponentBaseParams],
    children: [
      {
        path: '',
        component: PrioritariusSpaceMenuComponent,
        outlet: 'menu',
      },
      {
        path: '',
        pathMatch: 'full',
        redirectTo: 'goals',
      },
      ...prioritariusRoutes,
    ],
  },
];
