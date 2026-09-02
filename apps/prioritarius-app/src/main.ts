// Main entry point for prioritarius.app
import { bootstrapApplication } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import {
  getStandardSneatProviders,
  provideAppInfo,
  provideRolesByType,
} from '@sneat/app';
import type { SneatApp } from '@sneat/core';
import { authRoutes } from '@sneat/auth-ui';
import { provideContactus } from '@sneat/extension-contactus';
import { providePrioritarius } from '@sneat/extension-prioritarius';
import { App } from './app/app';
import { appRoutes } from './app/app.routes';
import { prioritariusAppEnvironmentConfig } from './environments/environment';
import { registerIonicons } from './register-ionicons';

bootstrapApplication(App, {
  providers: [
    ...getStandardSneatProviders(prioritariusAppEnvironmentConfig),
    // The app is the composition root and wires the runtime's providers.
    // providePrioritarius() is currently a no-op: the template's listus-shaped
    // demo domain has been retired and the real goals/projects/tasks contract
    // is still being specified.
    ...provideContactus(),
    ...providePrioritarius(),
    // `as SneatApp`: the template's placeholder appId isn't in @sneat/core's
    // SneatApp union yet. Remove the cast once @sneat/core allows any string
    // (or once the renamed app's id is registered).
    provideAppInfo({
      appId: 'prioritarius' as SneatApp,
      appTitle: 'Prioritarius.app',
    }),
    provideRouter([...appRoutes, ...authRoutes]),
    provideRolesByType(undefined),
  ],
}).catch((err) => console.error(err));

registerIonicons();
