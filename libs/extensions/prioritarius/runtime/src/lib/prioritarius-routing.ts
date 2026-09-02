import { Route } from '@angular/router';

export const prioritariusRoutes: Route[] = [
  {
    path: 'maps',
    data: { title: 'Maps' },
    loadComponent: () =>
      import('./pages/maps/maps-page.component').then(
        (m) => m.MapsPageComponent,
      ),
  },
];
