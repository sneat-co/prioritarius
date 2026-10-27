import { appRoutes } from './app.routes';
import { sneatAuthGuard } from '@sneat/auth-core';

describe('appRoutes', () => {
  it('forwards the root path to /home instead of rendering there', () => {
    // `/` is the landing page's URL (served by landings/public/_redirects on a hard
    // load), so the app must not own it — and must not redirect to login,
    // which bounced signed-in users straight back to the login page.
    const root = appRoutes.find((r) => r.path === '');
    expect(root?.pathMatch).toBe('full');
    expect(root?.redirectTo).toBe('home');
    expect(root?.loadComponent).toBeUndefined();
  });

  it('serves the authenticated home component at /home, guarded', () => {
    const home = appRoutes.find((r) => r.path === 'home');
    expect(typeof home?.loadComponent).toBe('function');
    expect(home?.canActivate).toContain(sneatAuthGuard);
  });

  it('mounts the space-scoped routes lazily', () => {
    const space = appRoutes.find((r) => r.path === 'space/:spaceType/:spaceID');
    expect(space).toBeDefined();
    expect(typeof space?.loadChildren).toBe('function');
  });
});
