import { Route } from '@angular/router';
import { SpaceComponentBaseParams } from '@sneat/space-components';
import { TemplateSpaceMenuComponent } from './space-menu/template-space-menu.component';
import { templateRoutes } from './template-routing';

export const templateSpaceRoutes: Route[] = [
  {
    path: '',
    providers: [SpaceComponentBaseParams],
    children: [
      {
        path: '',
        component: TemplateSpaceMenuComponent,
        outlet: 'menu',
      },
      {
        path: '',
        pathMatch: 'full',
        redirectTo: 'lists',
      },
      ...templateRoutes,
    ],
  },
];
