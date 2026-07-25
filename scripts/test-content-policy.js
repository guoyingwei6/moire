import assert from 'node:assert/strict';
import { parseNoteConfiguration } from '../src/lib/config/index-note.js';
import {
  customSlugSegment,
  isDiscoverable,
  isMenuVisible,
  isUnderscoreDraft,
  nearestExistingParentRoute,
  publicRouteSegment,
  publicTitle,
  routeFromContentSource
} from '../src/lib/server/content-policy.js';

assert.equal(isUnderscoreDraft('/content/blog/_quiet-note.md', 'Quiet note'), true);
assert.equal(isUnderscoreDraft('/content/blog/quiet-note.md', '_Quiet note'), true);
assert.equal(isUnderscoreDraft('/content/blog/index.md', 'Blog'), false);
assert.equal(publicTitle('_ Quiet note'), 'Quiet note');
assert.equal(publicRouteSegment('_quiet-note', '/content/blog/_quiet-note.md'), 'quiet-note');
assert.throws(() => publicRouteSegment('_', '/content/blog/_.md'), /must contain text/);
assert.equal(customSlugSegment('stable-note', '/content/blog/note.md'), 'stable-note');
assert.equal(customSlugSegment('中文笔记', '/content/blog/note.md'), '中文笔记');
assert.throws(() => customSlugSegment('', '/content/blog/note.md'), /must not be empty/);
for (const unsafeSlug of ['.', '..', 'nested/path', 'query?value', 'fragment#part', 'encoded%2Fpath', 'back\\slash', 'space slug', 'colon:value']) {
  assert.throws(() => customSlugSegment(unsafeSlug, '/content/blog/note.md'), /Invalid slug/);
}
assert.deepEqual(routeFromContentSource('/content/blog/ordinary-note.md'), {
  route: '/blog/ordinary-note/',
  kind: 'post'
});
assert.deepEqual(routeFromContentSource('/content/blog/ordinary-note.md', 'stable-note'), {
  route: '/blog/stable-note/',
  kind: 'post'
});
const sluggedNote = parseNoteConfiguration(`| name | value |
| --- | --- |
| slug | stable-from-note |

Visible body.`);
assert.deepEqual(routeFromContentSource('/content/blog/ordinary-note.md', sluggedNote.properties.slug), {
  route: '/blog/stable-from-note/',
  kind: 'post'
});
assert.equal(sluggedNote.cleanedMarkdown, 'Visible body.');
assert.deepEqual(routeFromContentSource('/content/blog/index.md'), {
  route: '/blog/',
  kind: 'section'
});
assert.throws(
  () => routeFromContentSource('/content/blog/index.md', 'renamed-blog'),
  /supported only on ordinary notes/
);

const publicRecord = { hidden: false, options: { showInMenu: true } };
const unlistedRecord = { hidden: false, options: { showInMenu: false } };
const draftRecord = { hidden: true, options: { showInMenu: true } };
const footerRecord = { hidden: false, options: { showInMenu: true, showInFooter: true } };
assert.equal(isDiscoverable(publicRecord), true);
assert.equal(isDiscoverable(draftRecord), false);
assert.equal(isMenuVisible(publicRecord), true);
assert.equal(isMenuVisible(unlistedRecord), false);
assert.equal(isMenuVisible(draftRecord), false);
assert.equal(isDiscoverable(footerRecord), true);
assert.equal(isMenuVisible(footerRecord), false, 'footer notes must leave automatic collection listings');

const availableRoutes = new Map([
  ['/', {}],
  ['/blog/', {}]
]);
assert.equal(nearestExistingParentRoute('/blog/draft-only/', availableRoutes), '/blog/');
assert.equal(nearestExistingParentRoute('/unknown/nested/', availableRoutes), '/');
assert.equal(nearestExistingParentRoute(null, availableRoutes), null);

console.log('Content visibility policy tests passed.');
