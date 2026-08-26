/**
 * English copy — the base locale.
 *
 * TODO(copy): replace every string below with your product's real messaging.
 * This is a working skeleton, not a starting style — see debtus.app or
 * requoter.app for landings built from these same components.
 *
 * Keep in step with ru.ts: the Copy contract makes a missing string a type
 * error, but it cannot tell you a translation has gone stale. If you change a
 * claim here, change it there.
 */
import type { Copy } from './types';

export const en: Copy = {
  site: {
    brand: 'Template',
    // tld: '.app',
    headline: 'A clear, benefit-led',
    headlineAccent: 'headline.',
    lede: 'One or two sentences that explain the promise of your product in plain language — what changes for the user, stated as an outcome.',
    navCta: 'Sign in',
    navCtaShort: 'Sign in',
    ctaPrimary: 'Get started free',
    ctaSecondary: 'See how it works',
    microcopy: '✨ A few trust signals · 🔒 Privacy-first · 🆓 Free to start',
    seoTitle: 'Template — a short, benefit-led tagline.',
    seoDescription:
      "One or two sentences describing what your product does and who it's for. This is the default meta description; override it per page.",
  },

  nav: [
    { label: 'How it works', href: '#how-it-works' },
    { label: 'Features', href: '#features' },
    { label: 'Why us', href: '#why' },
  ],

  howItWorks: {
    eyebrow: 'How it works',
    title: 'Three or four simple steps',
    steps: [
      { icon: '1️⃣', title: 'First step', text: 'Describe the first thing a user does.' },
      { icon: '2️⃣', title: 'Second step', text: 'Describe the second thing a user does.' },
      { icon: '3️⃣', title: 'Third step', text: 'Describe the third thing a user does.' },
      { icon: '4️⃣', title: 'Fourth step', text: 'Describe the payoff.' },
    ],
  },

  features: {
    eyebrow: 'Features',
    title: "What you get today — and what's coming",
    items: [
      {
        icon: '✅',
        title: 'A live capability',
        examples:
          "Describe a thing the product does today. Use status 'live' and an href to drive the primary action.",
        status: 'live',
        href: '/login',
        cta: 'Try it',
      },
      {
        icon: '🧩',
        title: 'Something on the roadmap',
        examples:
          "Describe a capability that's coming soon. Use status 'soon' to show a 'Coming soon' pill.",
        status: 'soon',
      },
    ],
  },

  why: {
    eyebrow: 'Why us',
    title: 'The reasons to choose this',
    tiles: [
      { icon: '⏱️', title: 'Save time' },
      { icon: '💸', title: 'Save money' },
      { icon: '🔒', title: 'You own your data' },
    ],
  },

  ctaBand: {
    title: 'A closing call to action',
    text: "One line that removes the last bit of friction — it's free, fast, private, etc.",
    cta: 'Get started free',
  },

  footer: {
    tagline: 'A short one-line description of your product.',
    productTitle: 'Product',
    product: [
      { label: 'How it works', href: '#how-it-works' },
      { label: 'Features', href: '#features' },
      { label: 'Why us', href: '#why' },
      { label: 'Sign in', href: '/login' },
    ],
    moreTitle: 'More',
    more: [
      { label: 'Privacy', href: '/privacy' },
      { label: 'Terms', href: '/terms' },
    ],
    legal: { before: 'built on the ', link: 'Sneat platform', after: '.' },
  },

  privacyPage: {
    seoTitle: 'Privacy — Template',
    seoDescription:
      'How Template handles your information: privacy-first, you own your data.',
    eyebrow: 'Privacy',
    title: 'Your information, handled with care',
    lede: 'TODO(copy): write your privacy stance. Keep it plain-language and honest. Below are starter headings you can adapt.',
    sections: [
      {
        title: 'You own your data',
        body: 'Your data belongs to you — you can review, update and remove it at any time, and it is never sold.',
      },
      {
        title: 'Privacy-first by design',
        body: "State what you collect, why, and what you deliberately don't do with it.",
      },
    ],
    early: {
      title: 'This is an early page',
      body: 'This product is in active development. This page will grow into a full privacy policy as it launches. Questions in the meantime? Reach us via the',
      linkLabel: 'Sneat platform',
    },
    back: '← Back to home',
  },

  // TODO(copy): a stub, and deliberately a thin one. Terms are the page most
  // likely to be filled with clauses nobody read and nobody meant — say only
  // what is true of YOUR product. If it touches money, records debts, arranges
  // people to meet, or holds anything on someone else's behalf, say what you
  // are NOT (not a bank, not a broker, not the organiser) before you say
  // anything else. Delete the sections that don't apply.
  termsPage: {
    seoTitle: 'Terms — Template',
    seoDescription:
      'The rules of the road for using Template: what you agree to, and what we owe you.',
    eyebrow: 'Terms',
    title: 'The rules of the road',
    lede: "TODO(copy): write the deal in plain English — what someone is agreeing to by using this, and what you owe them back. Written to be read, not to be defensible.",
    updated: 'Last updated: 16 July 2026',
    sections: [
      {
        title: 'What this is, and what it is not',
        body: 'State the boundary before anything else. If the product records money without moving it, say so: not a bank, not a payment service, not a party to anything between two other people.',
      },
      {
        title: 'Your account',
        body: "You sign in with your Sneat account. Keep your sign-in details to yourself — you're responsible for what happens under your account, and you can leave whenever you like and take your data with you.",
      },
      {
        title: 'Fair use',
        body: "Don't use it for anything illegal, and don't abuse it. Say what would get an account suspended, in the words you'd actually use.",
      },
      {
        title: 'No warranties, and things change',
        body: "It's provided as-is. Say plainly that it can be wrong or unavailable, that features may change, and that you'll flag material changes to these terms rather than quietly swapping the page.",
      },
    ],
    early: {
      title: 'This is an early page',
      body: 'This product is in active development, and these terms will grow into a fuller agreement as it launches. They deliberately carry no legal entity, jurisdiction or liability clauses yet — those need a real entity and a lawyer, not a template. Questions in the meantime? Reach us via the',
      linkLabel: 'Sneat platform',
    },
    back: '← Back to home',
  },

  langLabel: 'Language',

  a11y: {
    skipToContent: 'Skip to content',
    primaryNav: 'Primary',
    brandHome: 'Template home',
    productNav: 'Product',
    moreNav: 'More',
  },
};
