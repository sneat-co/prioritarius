/**
 * Adapts this landing's copy layer to @sneat/astro's chrome contract: a
 * locale-independent SiteMeta (identity) and a per-locale SiteChrome (the words
 * the shared Header/Footer render). BaseLayout passes both down.
 *
 * TODO(fork): set `url` to match astro.config `site:`, set the GA4 id (or leave
 * analytics off), and adjust `appRoutes` if the app mounts more root paths.
 */
import type { SiteMeta, SiteChrome } from '@sneat/astro/config';
import { getCopy } from './copy';
import type { LangCode } from './languages';

export const siteMeta: SiteMeta = {
  name: getCopy('en').site.brand,
  // Keep in step with astro.config `site:`.
  url: 'https://prioritarius.com',
  // Fallback only. SiteMeta is locale-independent, so this line can only ever be
  // one language; BaseLayout passes the page locale's own seoDescription as
  // `siteDescription`, and that is what reaches the JSON-LD graph.
  description: getCopy('en').site.seoDescription,
  companyUrl: 'https://sneat.co',
  // This landing wires its OWN consent-banner GA via BaseLayout's head slot, so
  // the shared SeoHead renders no analytics (null). If you'd rather use the
  // package's silent geo-gated GA instead, set the id here and drop the head-slot
  // GoogleAnalytics from BaseLayout.
  gaMeasurementId: null,
  favicon: '/favicon.svg',
  // Global app routes that must NOT be localised (root-mounted SPA).
  appRoutes: ['/login'],
};

export function getChrome(locale: LangCode): SiteChrome {
  const c = getCopy(locale);
  return {
    brand: c.site.brand,
    tld: c.site.tld,
    nav: c.nav,
    cta: { href: '/login', label: c.site.navCta, labelShort: c.site.navCtaShort },
    footer: {
      tagline: c.footer.tagline,
      groups: [
        { title: c.footer.productTitle, links: c.footer.product },
        { title: c.footer.moreTitle, links: c.footer.more },
      ],
      owner: c.site.brand,
      ecosystemHref: siteMeta.companyUrl,
      ecosystemLabel: c.footer.legal.link,
    },
    a11y: {
      skipToContent: c.a11y.skipToContent,
      brandHome: c.a11y.brandHome,
      primaryNav: c.a11y.primaryNav,
    },
  };
}
