/**
 * Single source of truth for the locales this landing supports.
 *
 * Thin wrapper over @sneat/astro's createI18n: the locale plumbing (localeHref,
 * routeFromPath, hreflang, og:locale) is shared across the Sneat landings and
 * lives in the package; this module declares THIS landing's locales and
 * re-exports the bound helpers, so every page and component reads unchanged.
 *
 * ⚠️ Adding a locale here is NOT enough to make it reachable. `worker.js` keeps
 * its own RESERVED_LOCALES list, and any locale missing from it falls through
 * the edge router to the root-mounted Angular SPA — so a brand-new `/xx/` would
 * answer 200 with the app shell rather than 404, which is why this failure
 * hides so well. The two lists must be kept in sync by hand: worker.js is
 * deliberately dependency-free and cannot import this file.
 *
 * Adding a locale, end to end:
 *   1. add it to `langs` below
 *   2. add it to RESERVED_LOCALES in worker.js
 *   3. write src/i18n/copy/<code>.ts against the Copy interface
 *   4. register it in src/i18n/copy/index.ts
 *   5. add src/pages/<code>/index.astro and src/pages/<code>/privacy.astro
 * The type-checker will tell you exactly which strings you still owe — that is
 * the main reason Copy is an explicit contract rather than a loose record.
 *
 * Why labels and not flag emoji
 * -----------------------------
 * Flags were considered and rejected across the ecosystem. Don't reintroduce
 * them: flags mark countries not languages (Russian outlives any one flag; no
 * English flag is neutral), Windows renders none of them, and screen readers
 * announce them unpredictably. (Full rationale in @sneat/astro.)
 *
 * A note on fonts: the brand font (Montserrat, see tokens.css) ships Latin and
 * Cyrillic, so this landing needs no per-script font gating. If you swap it for
 * a face that lacks a script you ship — Poppins, for one, has no Cyrillic at
 * all — that locale silently falls back to system-ui and the whole site looks
 * broken in that language only. Check the subsets before you change the font.
 */
import { createI18n, type Lang as SharedLang } from '@sneat/astro/i18n';

export type LangCode = 'en' | 'ru';
export type Lang = SharedLang;

/** English is the default and owns the bare root. */
export const DEFAULT_LOCALE: LangCode = 'en';

export const i18n = createI18n({
  defaultLocale: DEFAULT_LOCALE,
  langs: [
    { code: 'en', label: 'English', short: 'EN', tag: 'en', ogLocale: 'en_GB' },
    { code: 'ru', label: 'Русский', short: 'RU', tag: 'ru', ogLocale: 'ru_RU' },
  ],
});

export const langs = i18n.langs;
// Accept a plain `string` (not just LangCode): these are also called while
// mapping over `langs`, whose element codes the package types as `string`.
export const langByCode = (code: string): Lang => i18n.langByCode(code);
export const localeFromPath = (path: string): LangCode => i18n.localeFromPath(path) as LangCode;
export const routeFromPath = (path: string): string => i18n.routeFromPath(path);
export const localeHref = (code: string, route = '/'): string => i18n.localeHref(code, route);
