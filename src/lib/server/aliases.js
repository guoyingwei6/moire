const RESERVED_PREFIXES = [
  '/404/',
  '/404.html/',
  '/archive/',
  '/feed.xml/',
  '/qr/',
  '/robots.txt/',
  '/rss.xml/',
  '/search/',
  '/sitemap.xml/',
  '/tags/'
];
const RESERVED_BASENAMES = new Set([
  '404.html',
  'feed.xml',
  'robots.txt',
  'rss.xml',
  'sitemap.xml'
]);

/** @param {string} route */
function routeKey(route) {
  return route.normalize('NFC').toLocaleLowerCase();
}

/** @param {string} route */
function isReserved(route) {
  const key = routeKey(route);
  const basename = key.split('/').filter(Boolean).at(-1) ?? '';
  return RESERVED_BASENAMES.has(basename)
    || RESERVED_PREFIXES.some((prefix) => key === prefix || key.startsWith(prefix));
}

/**
 * Montaigne documents aliases only as alternative URLs. Moire accepts either
 * one sibling slug (`old-title`) or one absolute site path (`/old/blog/title/`).
 * Keeping the grammar narrower than a general URL prevents an Apple Note from
 * creating an external redirect or escaping into a generated site endpoint.
 *
 * @param {string} value
 * @param {string} canonicalRoute
 * @param {string} sourcePath
 */
export function aliasRoute(value, canonicalRoute, sourcePath) {
  const raw = value.normalize('NFC').trim();
  if (!raw) throw new Error(`Invalid aliases value in ${sourcePath}: alias must not be empty`);

  let segments;
  if (raw.startsWith('/')) {
    segments = raw.split('/').filter(Boolean);
  } else {
    if (raw.includes('/')) {
      throw new Error(
        `Invalid aliases value in ${sourcePath}: use one sibling slug or an absolute site path`
      );
    }
    const canonicalSegments = canonicalRoute.split('/').filter(Boolean);
    canonicalSegments.pop();
    segments = [...canonicalSegments, raw];
  }

  if (
    !segments.length
    || segments.some((segment) => (
      segment === '.'
      || segment === '..'
      || !/^[\p{L}\p{N}._~-]+$/u.test(segment)
    ))
  ) {
    throw new Error(
      `Invalid aliases value in ${sourcePath}: use URL segments made of letters, numbers, dots, underscores, tildes, or hyphens`
    );
  }

  const route = `/${segments.join('/')}/`;
  if (isReserved(route)) {
    throw new Error(`Invalid aliases value in ${sourcePath}: ${route} is a generated site route`);
  }
  if (routeKey(route) === routeKey(canonicalRoute)) {
    throw new Error(`Invalid aliases value in ${sourcePath}: alias duplicates its canonical route ${canonicalRoute}`);
  }
  return route;
}

/**
 * @param {Array<{ route: string, sourcePath: string | null, properties: Record<string, string> }>} records
 * @returns {Array<{ route: string, target: string }>}
 */
export function buildAliasEntries(records) {
  const canonical = new Map(records.map((record) => [routeKey(record.route), record]));
  const aliases = new Map();

  for (const record of records) {
    const rawAliases = record.properties.aliases;
    if (rawAliases === undefined || !rawAliases.trim()) continue;

    for (const rawAlias of rawAliases.split(',').map((item) => item.trim()).filter(Boolean)) {
      const route = aliasRoute(rawAlias, record.route, record.sourcePath ?? record.route);
      const key = routeKey(route);
      const canonicalCollision = canonical.get(key);
      if (canonicalCollision) {
        throw new Error(
          `Alias route ${route} in ${record.sourcePath ?? record.route} conflicts with canonical content ${canonicalCollision.sourcePath ?? canonicalCollision.route}`
        );
      }

      const existing = aliases.get(key);
      if (existing) {
        throw new Error(
          `Duplicate alias route ${route}: ${existing.sourcePath} and ${record.sourcePath ?? record.route}`
        );
      }
      aliases.set(key, {
        route,
        target: record.route,
        sourcePath: record.sourcePath ?? record.route
      });
    }
  }

  return [...aliases.values()].map(({ route, target }) => ({ route, target }));
}
