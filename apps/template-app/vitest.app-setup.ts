// Ionic 9's <ion-split-pane> (used by the app shell, apps/template-app/src/app/app.ts)
// calls window.matchMedia to watch the responsive breakpoint. jsdom does not
// implement matchMedia, so without this shim any spec that renders the app
// shell (e.g. app.spec.ts's `fixture.detectChanges()`) throws an unhandled
// "matchMedia is not a function" rejection. Sibling repos (contactus,
// remindius, renewon) hit the same Ionic 9 + jsdom + vitest gap; this mirrors
// their fix.
if (typeof window !== 'undefined' && !window.matchMedia) {
  window.matchMedia = (query: string): MediaQueryList =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => undefined, // deprecated, kept for older callers
      removeListener: () => undefined, // deprecated, kept for older callers
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false,
    }) as MediaQueryList;
}
