/** @param {string} sourcePath @param {string} title */
export function isUnderscoreDraft(sourcePath, title) {
  const filename = sourcePath.split('/').pop()?.replace(/\.md$/i, '') ?? '';
  return title.trimStart().startsWith('_') || (filename.toLocaleLowerCase() !== 'index' && filename.startsWith('_'));
}

/** @param {string} title */
export function publicTitle(title) {
  const visible = title.replace(/^\s*_+\s*/, '').trim();
  return visible || 'Untitled';
}

/** @param {string} segment @param {string} sourcePath */
export function publicRouteSegment(segment, sourcePath) {
  const visible = segment.replace(/^_+/, '');
  if (!visible) throw new Error(`Draft filename must contain text after the underscore: ${sourcePath}`);
  return visible;
}

/** @param {string} value @param {string} sourcePath */
export function customSlugSegment(value, sourcePath) {
  const slug = value.normalize('NFC').trim();
  if (!slug) throw new Error(`Invalid slug in ${sourcePath}: the value must not be empty`);
  if (slug === '.' || slug === '..' || !/^[\p{L}\p{N}._~-]+$/u.test(slug)) {
    throw new Error(`Invalid slug in ${sourcePath}: use one URL segment made of letters, numbers, dots, underscores, tildes, or hyphens`);
  }
  return slug;
}

/**
 * Resolve one Markdown source file to its public route. A custom slug is a
 * note-level URL segment, so it cannot rename a collection index or escape
 * the physical parent folder exported by the Shortcut.
 *
 * @param {string} sourcePath
 * @param {string | undefined} slug
 * @returns {{ route: string, kind: 'home' | 'section' | 'post' }}
 */
export function routeFromContentSource(sourcePath, slug) {
  const relative = sourcePath.replace(/^\/content\//, '').replace(/\.md$/i, '');
  const segments = relative.split('/').filter(Boolean);
  const isIndex = segments.at(-1)?.toLocaleLowerCase() === 'index';

  if (isIndex) {
    if (slug !== undefined) {
      throw new Error(`Invalid slug in ${sourcePath}: slug is supported only on ordinary notes`);
    }
    segments.pop();
  } else if (segments.length) {
    const fallback = publicRouteSegment(segments.at(-1) ?? '', sourcePath);
    segments[segments.length - 1] = slug === undefined
      ? fallback
      : customSlugSegment(slug, sourcePath);
  }

  const route = segments.length ? `/${segments.join('/')}/` : '/';
  return { route, kind: route === '/' ? 'home' : isIndex ? 'section' : 'post' };
}

/** @param {{ hidden: boolean }} record */
export function isDiscoverable(record) {
  return !record.hidden;
}

/** @param {{ hidden: boolean, options: { showInMenu: boolean, showInFooter?: boolean } }} record */
export function isMenuVisible(record) {
  return isDiscoverable(record) && record.options.showInMenu && !record.options.showInFooter;
}

/**
 * Find the closest existing folder record without requiring every physical
 * directory to contain an index note. This keeps metadata inheritance intact
 * for a draft inside an otherwise hidden, index-less nested folder.
 *
 * @param {string | null} parentRoute
 * @param {{ has(route: string): boolean }} routes
 */
export function nearestExistingParentRoute(parentRoute, routes) {
  let candidate = parentRoute;
  while (candidate) {
    if (routes.has(candidate)) return candidate;
    const segments = candidate.split('/').filter(Boolean);
    segments.pop();
    candidate = segments.length ? `/${segments.join('/')}/` : '/';
  }
  return null;
}
