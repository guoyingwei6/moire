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

/** @param {{ hidden: boolean }} record */
export function isDiscoverable(record) {
  return !record.hidden;
}

/** @param {{ hidden: boolean, options: { showInMenu: boolean } }} record */
export function isMenuVisible(record) {
  return isDiscoverable(record) && record.options.showInMenu;
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
