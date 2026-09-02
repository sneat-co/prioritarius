import { Route } from '@angular/router';

// Route names: 'outline' (list = the outline/list editing surface for the
// whole graph — not just goals, so not a plural entity name) and
// 'node/:id' (single-entity detail; one detail page for all three node
// kinds since they share one Firestore collection and one edit surface).
// '/priorities' is reserved for the later recommendations screen; '/maps'
// is retired (Task 3 owns the canvas under its own route).
export const prioritariusRoutes: Route[] = [
  {
    path: 'outline',
    data: { title: 'Outline' },
    loadComponent: () =>
      import('./pages/outline/outline-page.component').then(
        (m) => m.OutlinePageComponent,
      ),
  },
  {
    path: 'node/:id',
    data: { title: 'Node' },
    loadComponent: () =>
      import('./pages/node/node-page.component').then(
        (m) => m.NodePageComponent,
      ),
  },
];
