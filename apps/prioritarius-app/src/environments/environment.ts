import { appEnvironmentConfig } from '@sneat/app';
import { IEnvironmentConfig } from '@sneat/core';

// Single environment for template — fail-safe by construction. appEnvironmentConfig
// returns this production config on every deployed domain and the Firebase
// emulator config only on localhost (decided at runtime from the hostname). No
// environment.prod.ts / fileReplacements: a mis-built or mis-deployed bundle can
// never point real users at the emulator.
//
// Reuses the shared sneat production Firebase project (sneat-eur3-1) — template
// shares auth, spaces and Firestore with the rest of the sneat ecosystem.
export const prioritariusAppEnvironmentConfig: IEnvironmentConfig =
  appEnvironmentConfig({
    production: true,
    agents: {},
    firebaseConfig: {
      projectId: 'sneat-eur3-1',
      appId: '1:588648831063:web:303af7e0c5f8a7b10d6b12',
      apiKey: 'AIzaSyCeQu1WC182yD0VHrRm4nHUxVf27fY-MLQ',
      // Pinned to the product's own domain — landings/worker.js reverse-proxies
      // the /__/* subtree to sneat-eur3-1.firebaseapp.com, mirroring schoolus and
      // sneat-club. Same-origin auth avoids the third-party-storage breakage a
      // cross-origin authDomain (the @sneat/app default, auth.sneat.co) triggers:
      // signInWithRedirect returns and getRedirectResult() yields nothing, so the
      // user lands back on the sign-in form. Pinning also matters because the
      // default has already changed once between @sneat/app releases, so leaving
      // it blank means a routine lib bump silently changes the OAuth redirect_uri.
      //
      // Google sign-in REQUIRES https://prioritarius.com/__/auth/handler in the
      // OAuth client's authorized redirect URIs (Google Cloud console — no API)
      // and prioritarius.com in Firebase Auth's authorized domains; a missing
      // entry surfaces as Error 400: redirect_uri_mismatch.
      authDomain: 'prioritarius.com',
      messagingSenderId: '588648831063',
      measurementId: 'G-TYBDTV738R',
    },
    // Full-page redirect sign-in is the robust default for a freshly-deployed
    // domain. BaseAppComponent completes it via getRedirectResult().
    signInMethod: 'redirect',
  });
