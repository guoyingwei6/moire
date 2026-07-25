/**
 * @typedef {{ label: string, icon: string, href: string, external?: boolean }} NavigationItem
 * @typedef {{ route: string, title: string }} SectionItem
 */

const UTILITY_ROUTES = new Set(['/archive', '/archive/', '/tags', '/tags/']);

/**
 * Treat a configured link to a section or one of its descendants as an
 * explicit override for that top-level section. This lets a direct link such
 * as /about/about-me/ replace the generated /about/ navigation item.
 *
 * @param {string} sectionRoute
 * @param {string} href
 */
function coversSection(sectionRoute, href) {
  const normalizedHref = href === '/'
    ? '/'
    : `/${href.split('/').filter(Boolean).join('/')}/`;
  return normalizedHref === sectionRoute || normalizedHref.startsWith(sectionRoute);
}

/**
 * Keep configured navigation untouched and add previously unrepresented
 * top-level content sections immediately before Tags or Archive. When neither
 * utility item is visible, generated sections are appended.
 *
 * @param {NavigationItem[]} configured
 * @param {SectionItem[]} sections
 * @returns {NavigationItem[]}
 */
export function mergeNavigation(configured, sections) {
  const generated = sections
    .filter((section) => !configured.some((item) => coversSection(section.route, item.href)))
    .sort((left, right) => left.title.localeCompare(right.title) || left.route.localeCompare(right.route))
    .map((section) => ({
      label: section.title,
      icon: '📁',
      href: section.route
    }));

  if (!generated.length) return [...configured];

  const utilityIndex = configured.findIndex((item) => UTILITY_ROUTES.has(item.href));
  if (utilityIndex === -1) return [...configured, ...generated];

  return [
    ...configured.slice(0, utilityIndex),
    ...generated,
    ...configured.slice(utilityIndex)
  ];
}
