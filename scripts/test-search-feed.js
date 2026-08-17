import assert from 'node:assert/strict';
import { filterSearchEntries } from '../src/lib/search.js';
import { toListingEntry, toSearchEntries } from '../src/lib/server/content-projection.js';

const options = {
  pinned: false,
  showInMenu: true,
  showInFooter: false,
  showChildren: true,
  showNestedNotes: false,
  showBreadcrumbs: true,
  showNoteNavigation: true,
  showNoteFooter: true,
  showNoteMetadata: true,
  sortBy: 'create',
  layout: 'list',
  previewProps: []
};

const record = (overrides = {}) => ({
  route: '/blog/public-note/',
  title: 'Public Note',
  summary: 'A short summary.',
  created: '2026-07-25T00:00:00.000Z',
  updated: null,
  tags: ['Svelte'],
  kind: 'post',
  parentRoute: '/blog/',
  hidden: false,
  locked: false,
  properties: {},
  options,
  sourcePath: '/content/blog/public-note.md',
  html: '<p>Complete <a href="/source/">HTML body</a>.</p>',
  wordCount: 4,
  readingMinutes: 1,
  ...overrides
});

const publicRecord = record();
const hiddenRecord = record({
  route: '/blog/hidden-note/',
  title: 'Hidden secret',
  hidden: true,
  sourcePath: '/content/blog/_hidden-note.md'
});
const implicitFolder = record({
  route: '/implicit/',
  title: 'Implicit',
  kind: 'section',
  sourcePath: null,
  html: ''
});
const texts = new Map([
  [publicRecord.route, 'Full body text with keyboard navigation.'],
  [hiddenRecord.route, 'Private draft terms must not leak.']
]);

const index = toSearchEntries(
  [publicRecord, hiddenRecord, implicitFolder],
  texts,
  (route) => `/moire${route}`
);
assert.deepEqual(index.map(({ route }) => route), ['/blog/public-note/']);
assert.equal(index[0].text, 'Full body text with keyboard navigation.');
assert.equal(index[0].href, '/moire/blog/public-note/');
assert.equal(JSON.stringify(index).includes('Hidden secret'), false, 'hidden notes must not enter the search index');
assert.equal(JSON.stringify(index).includes('Private draft terms'), false, 'hidden note text must not enter the search index');

const feedEntry = toListingEntry(publicRecord, 'feed');
assert.equal(feedEntry.html, publicRecord.html, 'feed entries must contain complete rendered HTML');
assert.equal(feedEntry.locked, false, 'listing summaries must preserve the lock state');
for (const layout of ['list', 'timeline', 'grid', 'table']) {
  assert.equal('html' in toListingEntry(publicRecord, layout), false, `${layout} entries must remain lightweight summaries`);
}

assert.deepEqual(filterSearchEntries(index, 'public'), index, 'title search must match');
assert.deepEqual(filterSearchEntries(index, 'keyboard'), index, 'full-text search must match');
assert.deepEqual(filterSearchEntries(index, '#svelte'), index, 'hash-prefixed tag search must match');
assert.deepEqual(filterSearchEntries(index, 'public keyboard'), index, 'every query term may match a different field');
assert.deepEqual(filterSearchEntries(index, ''), [], 'an empty query must not render every note');
assert.deepEqual(filterSearchEntries(index, 'missing'), [], 'a missing query must return no results');

console.log('Search-index and feed-projection tests passed.');
