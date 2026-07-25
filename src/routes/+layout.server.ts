import { base } from '$app/paths';
import type { LayoutServerLoad } from './$types';
import { getFooterEntries, getRecord, getSectionEntries } from '$lib/server/content';
import { mergeNavigation } from '$lib/server/navigation.js';
import { config } from '../../moire.config';

const UTILITY_ROUTES = new Set([
  '/archive/',
  '/feed.xml',
  '/qr/',
  '/robots.txt',
  '/rss.xml',
  '/search/',
  '/sitemap.xml',
  '/tags/'
]);

const isPublicLink = (item: { href: string; external?: boolean }): boolean => {
  if (item.external || UTILITY_ROUTES.has(item.href)) return true;
  const record = getRecord(item.href);
  return record !== null && !record.hidden;
};

export const load: LayoutServerLoad = ({ url }) => {
  const topLevelSections = getSectionEntries('/')
    .filter((entry) => entry.kind === 'section');
  const localPath = base && url.pathname.startsWith(base) ? url.pathname.slice(base.length) || '/' : url.pathname;
  const currentRecord = getRecord(localPath);
  const configuredNavigation = config.navigation.filter(isPublicLink);
  const headerNavigation = config.headerNavigation.filter(isPublicLink);
  const footerLinks = config.footerLinks.filter(isPublicLink);
  const configuredFooterRoutes = new Set(footerLinks.map((item) => item.href));

  return {
    navigation: config.autoDiscoverNavigation
      ? mergeNavigation(configuredNavigation, topLevelSections)
      : configuredNavigation,
    headerNavigation,
    footerEntries: getFooterEntries().filter((entry) => !configuredFooterRoutes.has(entry.route)),
    footerLinks,
    showFooter: currentRecord?.options.showNoteFooter ?? config.features.footer
  };
};
