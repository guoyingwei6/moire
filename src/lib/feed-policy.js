/**
 * Feed visibility is shared by static endpoint generation and browser
 * autodiscovery metadata. Keeping it client-safe prevents the two surfaces
 * from disagreeing about whether a Collection feed exists.
 *
 * @param {{ kind: string, hidden: boolean, locked?: boolean, options?: { showInMenu?: boolean, showInFooter?: boolean } }} post
 */
export function isFeedPost(post) {
  return post.kind === 'post'
    && !post.hidden
    && !post.locked
    && post.options?.showInMenu !== false
    && post.options?.showInFooter !== true;
}

/** @param {{ kind: string, hidden: boolean, options?: { showInMenu?: boolean, showInFooter?: boolean } }} collection */
export function isFeedCollection(collection) {
  return collection.kind === 'section'
    && !collection.hidden
    && collection.options?.showInMenu !== false
    && collection.options?.showInFooter !== true;
}

/**
 * @param {{ kind: string, route: string, title: string, hidden: boolean, options?: { showInMenu?: boolean, showInFooter?: boolean } }} record
 * @param {{ kind: string, route: string, title: string, hidden: boolean, options?: { showInMenu?: boolean, showInFooter?: boolean } } | null} folder
 * @param {string} siteTitle
 * @returns {{ route: string, title: string } | null}
 */
export function feedDiscovery(record, folder, siteTitle) {
  if (record.kind === 'home') return { route: '/feed.xml', title: siteTitle };

  const collection = record.kind === 'section' ? record : folder;
  if (!collection) return null;
  if (collection.kind === 'home' || collection.route === '/') {
    return { route: '/feed.xml', title: siteTitle };
  }
  if (!isFeedCollection(collection)) return null;
  return { route: `${collection.route}feed.xml`, title: collection.title };
}
