import { Route } from '@angular/router';
import { AuthGuard } from '@angular/fire/auth-guard';
import { redirectToLoginIfNotSignedIn } from '@sneat/auth-core';

export const appRoutes: Route[] = [
  {
    // `/` belongs to the Astro landing: landings/worker.js serves index.html
    // there on a hard load, so an Angular home mounted at '' exists only via
    // in-app navigation and vanishes on reload. The app's front door is /home;
    // '' only forwards in-SPA navigations (e.g. the login page's '/' fallback).
    path: '',
    pathMatch: 'full',
    redirectTo: 'home',
  },
  {
    // Authenticated landing: lists the user's spaces. Unauthenticated visitors
    // are redirected to /login by the auth guard.
    path: 'home',
    loadComponent: () =>
      import('./home/prioritarius-home-page.component').then(
        (m) => m.PrioritariusHomePageComponent,
      ),
    canActivate: [AuthGuard],
    data: { authGuardPipe: () => redirectToLoginIfNotSignedIn },
  },
  {
    // Space-scoped routes host the template pages, mirroring sneat-app's
    // space/:spaceType/:spaceID mount point.
    path: 'space/:spaceType/:spaceID',
    loadChildren: () =>
      import('./space/prioritarius-space.routes').then(
        (m) => m.prioritariusSpaceRoutes,
      ),
  },
  {
    // sneat-auth-menu-item navigates here on sign-out; mirror sneat-app and
    // redirect to the login page (where the sign-in form is shown).
    path: 'signed-out',
    pathMatch: 'full',
    redirectTo: 'login',
  },
  {
    // User profile (linked auth accounts, country). Linked from the side menu's
    // sneat-auth-menu-item "signed in as" row. Guarded like the home page.
    path: 'my',
    loadComponent: () =>
      import('./my/my-profile-page.component').then(
        (m) => m.MyProfilePageComponent,
      ),
    canActivate: [AuthGuard],
    data: {
      title: 'My profile',
      authGuardPipe: () => redirectToLoginIfNotSignedIn,
    },
  },
];
