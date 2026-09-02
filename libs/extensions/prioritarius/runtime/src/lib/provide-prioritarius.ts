import { Provider } from '@angular/core';

// The extension's single root register function: binds EVERY always-on contract
// token to its concrete implementation in one place, so a host enables the whole
// extension by calling providePrioritarius() once at bootstrap. Consumers
// depend only on the contract tokens/interfaces and never import this factory or
// the impl classes directly.
//
// Still a no-op: the real domain model (@sneat/prioritarius-core) and its
// Firestore-backed store (PrioritariusWorkspaceStore) exist now, but the
// store is @Injectable({providedIn: 'root'}) and every page that needs it
// injects it directly — there is no contract token to bind here yet. See
// https://github.com/sneat-co/backstage/blob/main/spec/features/prioritarius/domain-model/README.md
// for the domain model this UI consumes.
//
// Heavy, route-only capabilities (a details page that pulls in a sibling
// extension's service, etc.) are NOT bound here — ship them as lazy, route-scoped
// provider bundles instead, so they load only when their route is opened. See the
// README "Wiring extension services (DI)" section and the frontend-apps standard:
// https://github.com/sneat-co/sneat-libs/blob/main/docs/extension-standards/frontend-apps.md
export function providePrioritarius(): Provider[] {
  return [];
}
