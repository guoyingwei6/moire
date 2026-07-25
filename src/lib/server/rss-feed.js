import { isFeedPost } from '../feed-policy.js';
export { isFeedCollection, isFeedPost } from '../feed-policy.js';

/**
 * Small, framework-independent RSS helpers. Keeping XML construction here
 * makes the root and per-Collection endpoints use exactly the same escaping,
 * visibility and permanent-link rules.
 */

/** @param {string} value */
export function escapeXml(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

/**
 * Resolve a content route below the configured public URL without discarding
 * a GitHub Pages project base such as `/moire`.
 *
 * @param {string} siteUrl
 * @param {string} route
 */
export function absoluteFeedUrl(siteUrl, route) {
  const baseUrl = new URL(`${siteUrl.replace(/\/+$/, '')}/`);
  const relativeRoute = route === '/' ? '' : route.replace(/^\/+/, '');
  return new URL(relativeRoute, baseUrl).href;
}

/**
 * @template {{ route: string, parentRoute: string | null, kind: string, hidden: boolean, options?: { showInMenu?: boolean, showInFooter?: boolean } }} T
 * @param {T[]} posts
 * @param {string | null} [collectionRoute]
 * @param {boolean} [includeDescendants]
 * @returns {T[]}
 */
export function selectFeedPosts(posts, collectionRoute = null, includeDescendants = false) {
  return posts.filter((post) => {
    if (!isFeedPost(post)) return false;
    if (collectionRoute === null) return true;
    return includeDescendants
      ? post.route.startsWith(collectionRoute)
      : post.parentRoute === collectionRoute;
  });
}

/**
 * @param {{
 *   siteUrl: string,
 *   channelTitle: string,
 *   channelRoute: string,
 *   description: string,
 *   posts: Array<{ route: string, title: string, summary: string, created: string | null }>
 * }} input
 */
export function renderRssFeed({ siteUrl, channelTitle, channelRoute, description, posts }) {
  const items = posts.map((post) => {
    const postUrl = escapeXml(absoluteFeedUrl(siteUrl, post.route));
    const timestamp = post.created ? new Date(post.created) : null;
    const pubDate = timestamp && !Number.isNaN(timestamp.valueOf())
      ? `<pubDate>${timestamp.toUTCString()}</pubDate>`
      : '';

    return `
    <item>
      <title>${escapeXml(post.title)}</title>
      <link>${postUrl}</link>
      <guid>${postUrl}</guid>
      ${pubDate}
      <description>${escapeXml(post.summary)}</description>
    </item>`;
  }).join('');

  return `<?xml version="1.0" encoding="UTF-8" ?>
<rss version="2.0">
  <channel>
    <title>${escapeXml(channelTitle)}</title>
    <link>${escapeXml(absoluteFeedUrl(siteUrl, channelRoute))}</link>
    <description>${escapeXml(description)}</description>${items}
  </channel>
</rss>`;
}
