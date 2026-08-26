/**
 * English copy — the base locale.
 *
 * Keep in step with ru.ts: the Copy contract makes a missing string a type
 * error, but it cannot tell you a translation has gone stale. If you change a
 * claim here, change it there.
 */
import type { Copy } from './types';

export const en: Copy = {
  site: {
    brand: 'Prioritarius',
    headline: 'What should you work on next',
    headlineAccent: 'to move what matters most?',
    lede: 'Prioritarius maps your tasks, projects and goals as one flowing graph — so one piece of work can advance several goals, and you can always see the next step with the most leverage.',
    navCta: 'Open my map',
    navCtaShort: 'Open',
    ctaPrimary: 'Create your goals map',
    ctaSecondary: 'Read the vision',
    microcopy: 'You choose what matters. Prioritarius works out the consequences.',
    seoTitle: 'Prioritarius — know what to work on next',
    seoDescription:
      'Map tasks, projects and goals as one flowing graph. Order your goals, and Prioritarius recommends the next work with the most leverage — and explains why.',
  },

  nav: [
    { label: 'How it works', href: '#how-it-works' },
    { label: 'Why a graph', href: '#why-a-graph' },
    { label: 'Vision', href: '/vision' },
  ],

  demo: {
    eyebrow: 'The river of work',
    title: 'Click any node — see what it really moves',
    hint: 'This is a live sample map. Select a task to trace everything it advances; select a goal to see its next best work.',
    reset: 'Reset selection',
    legend: {
      goal: 'Goal',
      project: 'Project',
      work: 'Task',
      blocks: 'blocks',
      exploring: 'exploring',
    },
    labels: {
      't-seo': 'Landing page SEO',
      't-login': 'Reusable login',
      't-pay': 'Open payment account',
      't-bookings': 'Bookings',
      't-cal': 'Calendar view',
      't-news': 'Weekly newsletter',
      't-kite': 'Book kite weekend',
      'p-siteA': 'Website A',
      'p-siteB': 'Website B',
      'p-gt': 'GameTable.space',
      'g-cust': '5 paying customers',
      'g-launch': 'Launch GameTable MVP',
      'g-ret': 'Retention',
      'g-mrr': 'Reach €1,000 MRR',
      'g-kite': '10h kitesurfing',
    },
    est: {
      't-seo': '1d',
      't-login': '3d',
      't-pay': '½d',
      't-bookings': '8d',
      't-cal': '5d',
      't-news': '2d',
      't-kite': '½d',
    },
    cards: {
      'g-mrr': {
        title: 'Next best work for your #1 goal',
        lines: [
          '1. Open payment account (½d) — unblocks 8 days of Bookings on the path to GameTable MVP (#2) and this goal.',
          '2. Reusable login (3d) — advances Website A and Website B at once: ~6 project-days of progress for 3 days of work.',
          '3. Weekly newsletter (2d) — feeds Retention, which feeds recurring revenue.',
        ],
      },
      'g-launch': {
        title: 'Launch GameTable MVP — goal #2',
        lines: [
          'Remaining work upstream: Bookings (8d, blocked) and Calendar view (5d).',
          'Highest leverage right now: Open payment account (½d) — it is the last blocker holding Bookings.',
        ],
      },
      't-login': {
        title: 'Reusable login — one task, two projects',
        lines: [
          'Costs 3 days once; advances Website A and Website B together.',
          'Both feed “5 paying customers”, your route to €1,000 MRR (#1).',
          'Actual effort: 3 days. Portfolio progress: ~6 project-days.',
        ],
      },
      't-pay': {
        title: 'Small task, big unlock',
        lines: [
          'Half a day of admin — but it is the last blocker on Bookings (8d).',
          'Completing it opens the main path to GameTable MVP (#2) and €1,000 MRR (#1).',
          'This is leverage a to-do list cannot see.',
        ],
      },
      't-bookings': {
        title: 'Bookings — blocked',
        lines: [
          '8 days of work toward GameTable MVP, waiting on the payment account.',
          'Prioritarius never recommends blocked work — it recommends the unblocker.',
        ],
      },
      'g-kite': {
        title: '10h kitesurfing — exploring',
        lines: [
          'Not committed yet, so it never outranks work for your committed goals.',
          'Commit it, drag it into your order, and its work joins the recommendations.',
        ],
      },
    },
    srInstructions:
      'Interactive diagram of a sample goal map. Use Tab to move between nodes and Enter to select one; selecting highlights everything it contributes to and shows an explanation.',
  },

  problem: {
    eyebrow: 'Why a graph',
    title: 'Task trees can’t answer the only question that matters',
    paragraphs: [
      'Lists, boards and project trees force every piece of work into exactly one box. But real work isn’t shaped like that: one task serves several goals, a shared capability advances three projects, and a half-day errand quietly holds back a month of work.',
      'A tree can tell you what is inside a project. Only a graph can tell you which piece of work — anywhere — best advances everything you care about.',
    ],
    tree: {
      title: 'A tree hides it',
      text: 'One parent per task. Shared work gets duplicated or buried, and cross-project leverage is invisible.',
    },
    graph: {
      title: 'The graph shows it',
      text: 'Work flows into projects, projects into goals. Contributions merge, split and cross boundaries — and can be measured.',
    },
  },

  howItWorks: {
    eyebrow: 'How it works',
    title: 'Map it. Order it. Follow the flow.',
    steps: [
      {
        title: 'Map your work into the river',
        text: 'Add goals, projects and tasks, connect what contributes to what, mark what blocks what, and add rough estimates. Nothing needs to be perfect — the map is useful from day one.',
      },
      {
        title: 'Put your goals in order',
        text: 'Drag your committed goals into the order that matters now. No priority numbers, no percentages — order and commitment are all Prioritarius asks of you.',
      },
      {
        title: 'Work where the leverage is',
        text: 'Prioritarius recommends the next best work and explains every pick in words: which goals it advances, what it unblocks, what the deadline pressure is. Feel like a different project today? It finds the work there that still moves your bigger goals.',
      },
    ],
  },

  principles: {
    eyebrow: 'Principles',
    title: 'Opinionated where it counts',
    quotes: [
      'The user chooses what matters. Prioritarius helps work out the consequences.',
      'Move between projects without losing sight of your ultimate goals.',
      'Find the work that creates the greatest useful progress across competing goals.',
    ],
  },

  ctaBand: {
    title: 'Put your goals on the map',
    text: 'Start with three goals and the work you already know about. The river takes shape in minutes.',
    cta: 'Create your goals map',
  },

  footer: {
    tagline: 'Know what to work on next.',
    productTitle: 'Product',
    product: [
      { label: 'How it works', href: '#how-it-works' },
      { label: 'Why a graph', href: '#why-a-graph' },
      { label: 'Vision', href: '/vision' },
      { label: 'Open my map', href: '/login' },
    ],
    moreTitle: 'More',
    more: [
      { label: 'Privacy', href: '/privacy' },
      { label: 'Terms', href: '/terms' },
    ],
    legal: { before: 'built on the ', link: 'Sneat platform', after: '.' },
  },

  visionPage: {
    seoTitle: 'The Prioritarius vision — work as a graph, not a tree',
    seoDescription:
      'Why Prioritarius models goals, projects and tasks as a directed graph, derives progress from completed work, and explains every recommendation instead of hiding behind a score.',
    eyebrow: 'Vision',
    title: 'Work is a river system, not a filing cabinet',
    lede: 'Prioritarius exists to answer one question honestly: what should we work on next to make the best progress toward the outcomes that matter most? Everything in the product follows from taking that question seriously.',
    sections: [
      {
        title: 'The graph is the truth; the tree is a picture',
        paragraphs: [
          'Every mainstream tool — lists, boards, project trees — assumes each piece of work lives in exactly one place. The moment one task serves two goals, or a reusable capability serves three projects, that assumption fails, and with it every answer the tool can give about priority.',
          'Prioritarius models work as a directed graph. Tasks contribute to projects and goals; goals contribute to bigger goals; a task can block other work entirely. Branches merge, split and cross project boundaries. The familiar left-to-right river you see on screen is a projection of that graph — never the data model itself.',
        ],
      },
      {
        title: 'Goals are outcomes, not folders',
        paragraphs: [
          'A goal is a desired outcome whose completion you can verify: launch the MVP, get five paying customers, reach €1,000 MRR, spend ten hours kitesurfing this month. Projects organise related work — but goals never live inside project folders, because several projects can feed one goal, and one project can feed several.',
          'Commitment is explicit and cheap to express: a goal is Committed, Exploring, or Parked. Speculative ideas are welcome on the map — and structurally unable to distort the priorities of the goals you have actually committed to.',
        ],
      },
      {
        title: 'Honest arithmetic',
        paragraphs: [
          'Estimates are rough and that is fine. Prioritarius keeps both your top-down estimate (“this project is about six person-months”) and the bottom-up sum of its parts — and when they disagree, it shows you the gap instead of silently reconciling it. The gap is information: missing work, padded parts, or an unrealistic plan.',
          'Progress is derived from completed, estimated work — you never type a percentage. And the cost of work is never confused with its value: a 3-day capability that advances three projects costs 3 days and advances roughly 9 project-days. That difference — leverage — is what Prioritarius is built to find.',
        ],
      },
      {
        title: 'Recommendations that argue their case',
        paragraphs: [
          'Prioritarius will never tell you “priority: 83.7”. Every recommendation explains itself in the same terms you think in: it strongly advances your #1 goal, it also moves two other committed goals, it unblocks three tasks, its deadline is getting tight. The engine calculates, exposes, recommends and explains. You decide.',
          'And it refuses to bully you into single-minded focus. If you feel like working on a different project today, it finds the work there that still carries the most leverage toward everything you care about — so switching projects stops costing you your bigger goals.',
        ],
      },
      {
        title: 'A map you can hand to someone',
        paragraphs: [
          'A prioritisation map is also a communication artifact. Any Prioritarius graph can be shared as a read-only link — a living roadmap for your team, your customers or your investors, always in step with the plan you are actually executing.',
          'Later, the same shared graph becomes the ground for stakeholder prioritisation: different people distribute limited priority points, differences of opinion stay visible instead of vanishing into an average, and the argument happens over a map everyone can see.',
        ],
      },
      {
        title: 'Part of something bigger',
        paragraphs: [
          'Prioritarius is a standalone product, and it is built on the Sneat platform — the same foundation as Sneat.work, where teams organise people, operations and the work itself. As both grow, your goal map connects to the place your team already works.',
        ],
      },
    ],
    cta: {
      title: 'See it on your own goals',
      text: 'The fastest way to judge the idea is to map three real goals and a week of real work.',
      button: 'Create your goals map',
    },
    back: '← Back to home',
  },

  privacyPage: {
    seoTitle: 'Privacy — Prioritarius',
    seoDescription:
      'How Prioritarius handles your information: your goal maps are yours, private by default, never sold.',
    eyebrow: 'Privacy',
    title: 'Your plans are yours',
    lede: 'A goal map is a candid document — it says what you want and what you are struggling with. We treat it accordingly.',
    sections: [
      {
        title: 'Private by default',
        body: 'Your maps are visible only to you unless you explicitly share them. A share link shows exactly what you shared, read-only, and stops working when you revoke it.',
      },
      {
        title: 'You own your data',
        body: 'Your data belongs to you — you can review, update and remove it at any time, and it is never sold.',
      },
      {
        title: 'We collect what the product needs',
        body: 'An account to sign you in, the maps you create, and basic product analytics to understand what works. Nothing is collected to build a profile of you.',
      },
    ],
    early: {
      title: 'This is an early page',
      body: 'Prioritarius is in active development. This page will grow into a full privacy policy as it launches. Questions in the meantime? Reach us via the',
      linkLabel: 'Sneat platform',
    },
    back: '← Back to home',
  },

  termsPage: {
    seoTitle: 'Terms — Prioritarius',
    seoDescription:
      'The rules of the road for using Prioritarius: what you agree to, and what we owe you.',
    eyebrow: 'Terms',
    title: 'The rules of the road',
    lede: 'The deal in plain English: what you agree to by using Prioritarius, and what we owe you back.',
    updated: 'Last updated: 26 August 2026',
    sections: [
      {
        title: 'What this is, and what it is not',
        body: 'Prioritarius is a planning tool. It recommends and explains; it does not decide for you, and it is not responsible for the outcomes of the plans you make with it.',
      },
      {
        title: 'Your account',
        body: 'You sign in with your Sneat account. Keep your sign-in details to yourself — you are responsible for what happens under your account, and you can leave whenever you like and take your data with you.',
      },
      {
        title: 'Fair use',
        body: 'Don’t use it for anything illegal, don’t abuse shared links, and don’t try to break other people’s maps. Doing so can get an account suspended.',
      },
      {
        title: 'No warranties, and things change',
        body: 'Prioritarius is provided as-is: recommendations can be wrong, the service can be unavailable, and features may change while the product is young. Material changes to these terms will be flagged, not quietly swapped in.',
      },
    ],
    early: {
      title: 'This is an early page',
      body: 'Prioritarius is in active development, and these terms will grow into a fuller agreement as it launches. They deliberately carry no legal entity, jurisdiction or liability clauses yet — those need a real entity and a lawyer, not a template. Questions in the meantime? Reach us via the',
      linkLabel: 'Sneat platform',
    },
    back: '← Back to home',
  },

  langLabel: 'Language',

  a11y: {
    skipToContent: 'Skip to content',
    primaryNav: 'Primary',
    brandHome: 'Prioritarius home',
    productNav: 'Product',
    moreNav: 'More',
  },
};
