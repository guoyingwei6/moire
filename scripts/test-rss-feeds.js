import assert from 'node:assert/strict';
import {
  absoluteFeedUrl,
  escapeXml,
  isFeedCollection,
  isFeedPost,
  renderRssFeed,
  selectFeedPosts
} from '../src/lib/server/rss-feed.js';
import { feedDiscovery } from '../src/lib/feed-policy.js';

const visibleOptions = { showInMenu: true, showInFooter: false };
const post = (overrides = {}) => ({
  route: '/blog/public-note/',
  parentRoute: '/blog/',
  kind: 'post',
  hidden: false,
  options: visibleOptions,
  title: 'Public note',
  summary: 'A public summary.',
  created: '2026-07-25T03:04:05.000Z',
  ...overrides
});

const publicPost = post();
const nestedPost = post({ route: '/blog/lab/nested-note/', parentRoute: '/blog/lab/', title: 'Nested note' });
const otherCollectionPost = post({ route: '/photo/sunset/', parentRoute: '/photo/', title: 'Sunset' });
const draftPost = post({ route: '/blog/draft/', hidden: true, title: 'Private draft marker' });
const footerOnlyPost = post({
  route: '/blog/contact/',
  title: 'Footer contact marker',
  options: { showInMenu: true, showInFooter: true }
});
const listingHiddenPost = post({
  route: '/blog/unlisted/',
  title: 'Unlisted marker',
  options: { showInMenu: false, showInFooter: false }
});
const records = [publicPost, nestedPost, otherCollectionPost, draftPost, footerOnlyPost, listingHiddenPost];

assert.equal(isFeedPost(publicPost), true);
assert.equal(isFeedPost(draftPost), false, 'underscore drafts must remain outside RSS discovery');
assert.equal(isFeedPost(footerOnlyPost), false, 'footer-only pages must remain outside RSS discovery');
assert.equal(isFeedPost(listingHiddenPost), false, 'showInMenu=no must remain outside automatic discovery');
assert.equal(isFeedCollection(post({ kind: 'section' })), true);
assert.equal(
  isFeedCollection(post({ kind: 'section', options: { showInMenu: false, showInFooter: false } })),
  false,
  'an unlisted Collection must not expose a generated feed'
);
assert.equal(
  isFeedCollection(post({ kind: 'section', options: { showInMenu: true, showInFooter: true } })),
  false,
  'a footer-only Collection must not expose a generated feed'
);
const blogCollection = post({
  kind: 'section',
  route: '/blog/',
  title: 'Blog',
  parentRoute: '/',
  options: visibleOptions
});
assert.deepEqual(
  feedDiscovery(publicPost, blogCollection, 'Example site'),
  { route: '/blog/feed.xml', title: 'Blog' },
  'post metadata must advertise and name its visible parent Collection feed'
);
assert.equal(
  feedDiscovery(publicPost, { ...blogCollection, options: { showInMenu: false, showInFooter: false } }, 'Example site'),
  null,
  'post metadata must not advertise a feed that its unlisted parent Collection does not expose'
);
assert.deepEqual(
  feedDiscovery({ ...blogCollection, kind: 'home', route: '/' }, null, 'Example site'),
  { route: '/feed.xml', title: 'Example site' },
  'the home page always advertises the root feed'
);
assert.deepEqual(
  selectFeedPosts(records).map(({ title }) => title),
  ['Public note', 'Nested note', 'Sunset'],
  'the root feed must retain visible posts from every Collection'
);
assert.deepEqual(
  selectFeedPosts(records, '/blog/').map(({ title }) => title),
  ['Public note'],
  'a Collection feed lists direct notes by default'
);
assert.deepEqual(
  selectFeedPosts(records, '/blog/', true).map(({ title }) => title),
  ['Public note', 'Nested note'],
  'showNestedNotes Collections include descendant notes'
);

assert.equal(
  absoluteFeedUrl('https://example.com/moire', '/blog/中文-note/'),
  'https://example.com/moire/blog/%E4%B8%AD%E6%96%87-note/',
  'absolute URLs must retain and encode the GitHub Pages project base'
);
assert.equal(escapeXml(`A & B < C > D "E" 'F'`), 'A &amp; B &lt; C &gt; D &quot;E&quot; &apos;F&apos;');

const xml = renderRssFeed({
  siteUrl: 'https://example.com/moire',
  channelTitle: `Blog & <Notes> "Today" 'Now'`,
  channelRoute: '/blog/',
  description: 'Ideas & tests < safely >.',
  posts: [post({
    route: '/blog/permanent-note/',
    title: `A & B < C > "D" 'E'`,
    summary: 'Summary & <markup>.',
    created: '2026-07-25T03:04:05.000Z'
  })]
});

assert.match(xml, /^<\?xml version="1\.0" encoding="UTF-8" \?>/);
assert.match(xml, /<title>Blog &amp; &lt;Notes&gt; &quot;Today&quot; &apos;Now&apos;<\/title>/);
assert.match(xml, /<description>Ideas &amp; tests &lt; safely &gt;\.<\/description>/);
assert.match(xml, /<link>https:\/\/example\.com\/moire\/blog\/<\/link>/);
assert.match(xml, /<title>A &amp; B &lt; C &gt; &quot;D&quot; &apos;E&apos;<\/title>/);
assert.match(xml, /<guid>https:\/\/example\.com\/moire\/blog\/permanent-note\/<\/guid>/);
assert.match(xml, /<pubDate>Sat, 25 Jul 2026 03:04:05 GMT<\/pubDate>/);
assert.match(xml, /<description>Summary &amp; &lt;markup&gt;\.<\/description>/);
assert.doesNotMatch(xml, /Private draft marker|Footer contact marker|Unlisted marker/);

console.log('Root and per-Collection RSS feed tests passed.');
