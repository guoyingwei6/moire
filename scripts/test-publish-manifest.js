import assert from 'node:assert/strict';
import {
  PUBLISH_MANIFEST_PATH,
  createPublishManifest,
  managedPath,
  planPublishReconciliation,
  validatePublishManifest
} from '../src/lib/sync/publish-manifest.js';

const digest = (character) => character.repeat(64);
const root = digest('e');

assert.equal(managedPath('blog/一篇文章.md'), 'blog/一篇文章.md');
for (const path of ['', '/index.md', '../private.md', 'blog/../private.md', 'blog\\private.md', 'blog/?x.md', PUBLISH_MANIFEST_PATH]) {
  assert.throws(() => managedPath(path), /Invalid publish manifest/);
}

const previous = createPublishManifest(root, [
  { path: 'blog/keep.md', kind: 'markdown', digest: digest('a') },
  { path: 'blog/rename-me.md', kind: 'markdown', digest: digest('b') },
  { path: 'media/unused.jpg', kind: 'media', digest: digest('c') },
  { path: 'media/shared.jpg', kind: 'media', digest: digest('d') }
]);
const next = createPublishManifest(root, [
  { path: 'blog/keep.md', kind: 'markdown', digest: digest('a') },
  { path: 'blog/renamed.md', kind: 'markdown', digest: digest('b') },
  { path: 'media/attachments/recording.m4a', kind: 'media', digest: digest('c') },
  { path: 'media/shared.jpg', kind: 'media', digest: digest('d') }
]);

assert.deepEqual(planPublishReconciliation(previous, next), {
  upsert: [
    { path: 'blog/renamed.md', kind: 'markdown', digest: digest('b') },
    { path: 'media/attachments/recording.m4a', kind: 'media', digest: digest('c') }
  ],
  unchanged: [
    { path: 'blog/keep.md', kind: 'markdown', digest: digest('a') },
    { path: 'media/shared.jpg', kind: 'media', digest: digest('d') }
  ],
  remove: [
    { path: 'blog/rename-me.md', kind: 'markdown', digest: digest('b') },
    { path: 'media/unused.jpg', kind: 'media', digest: digest('c') }
  ],
  relocate: [
    {
      from: 'blog/rename-me.md',
      to: 'blog/renamed.md',
      kind: 'markdown',
      digest: digest('b')
    },
    {
      from: 'media/unused.jpg',
      to: 'media/attachments/recording.m4a',
      kind: 'media',
      digest: digest('c')
    }
  ],
  next
});

const firstRun = planPublishReconciliation(null, next);
assert.deepEqual(firstRun.upsert, next.files);
assert.deepEqual(firstRun.remove, []);

assert.throws(
  () => planPublishReconciliation(
    createPublishManifest(digest('f'), previous.files),
    next
  ),
  /root mismatch/
);

assert.throws(
  () => validatePublishManifest({
    version: 1,
    root,
    files: [
      { path: 'Blog/Post.md', kind: 'markdown', digest: digest('a') },
      { path: 'blog/post.md', kind: 'markdown', digest: digest('b') }
    ]
  }),
  /Duplicate publish manifest path/
);

for (const file of [
  { path: 'blog/not-markdown.txt', kind: 'markdown', digest: digest('a') },
  { path: 'private.jpg', kind: 'media', digest: digest('a') },
  { path: 'media/private/avatar.jpg', kind: 'media', digest: digest('a') }
]) {
  assert.throws(
    () => createPublishManifest(root, [file]),
    /Invalid publish manifest path/
  );
}

assert.throws(
  () => createPublishManifest('public-root-v1', []),
  /root must be a SHA-256/
);

console.log('Publish manifest reconciliation tests passed.');
