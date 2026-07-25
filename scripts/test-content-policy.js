import assert from 'node:assert/strict';
import {
  isDiscoverable,
  isMenuVisible,
  isUnderscoreDraft,
  nearestExistingParentRoute,
  publicRouteSegment,
  publicTitle
} from '../src/lib/server/content-policy.js';

assert.equal(isUnderscoreDraft('/content/blog/_quiet-note.md', 'Quiet note'), true);
assert.equal(isUnderscoreDraft('/content/blog/quiet-note.md', '_Quiet note'), true);
assert.equal(isUnderscoreDraft('/content/blog/index.md', 'Blog'), false);
assert.equal(publicTitle('_ Quiet note'), 'Quiet note');
assert.equal(publicRouteSegment('_quiet-note', '/content/blog/_quiet-note.md'), 'quiet-note');
assert.throws(() => publicRouteSegment('_', '/content/blog/_.md'), /must contain text/);

const publicRecord = { hidden: false, options: { showInMenu: true } };
const unlistedRecord = { hidden: false, options: { showInMenu: false } };
const draftRecord = { hidden: true, options: { showInMenu: true } };
assert.equal(isDiscoverable(publicRecord), true);
assert.equal(isDiscoverable(draftRecord), false);
assert.equal(isMenuVisible(publicRecord), true);
assert.equal(isMenuVisible(unlistedRecord), false);
assert.equal(isMenuVisible(draftRecord), false);

const availableRoutes = new Map([
  ['/', {}],
  ['/blog/', {}]
]);
assert.equal(nearestExistingParentRoute('/blog/draft-only/', availableRoutes), '/blog/');
assert.equal(nearestExistingParentRoute('/unknown/nested/', availableRoutes), '/');
assert.equal(nearestExistingParentRoute(null, availableRoutes), null);

console.log('Content visibility policy tests passed.');
