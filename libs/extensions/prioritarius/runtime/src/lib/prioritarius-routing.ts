import { Route } from '@angular/router';

export const prioritariusRoutes: Route[] = [
  {
    path: 'goals',
    data: { title: 'Goals' },
    loadComponent: () =>
      import('./pages/goals/goals-page.component').then(
        (m) => m.GoalsPageComponent,
      ),
  },
];
