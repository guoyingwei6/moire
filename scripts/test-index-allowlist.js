import assert from 'node:assert/strict';
import {
  normalizeFolderKey,
  publicationAllowlist,
  publicationTarget
} from '../src/lib/sync/index-allowlist.js';

assert.equal(normalizeFolderKey(' Field Notes '), 'field-notes');
assert.equal(normalizeFolderKey('FIELD_notes'), 'field-notes');
assert.equal(normalizeFolderKey('Caf\u00e9'), normalizeFolderKey('Cafe\u0301'));

assert.deepEqual(publicationTarget({ label: 'Blog', href: '/blog/' }), {
  folderName: 'Blog',
  folderKey: 'blog',
  targetDir: 'blog',
  apiDir: 'blog',
  mediaPrefix: '../media/'
});

assert.deepEqual(publicationTarget({ label: 'About', href: '/about/about-me/' }), {
  folderName: 'About',
  folderKey: 'about',
  targetDir: 'about',
  apiDir: 'about',
  mediaPrefix: '../media/'
});

assert.deepEqual(publicationTarget({ label: 'Field Notes', href: '/projects/field-notes/' }), {
  folderName: 'Field Notes',
  folderKey: 'field-notes',
  targetDir: 'projects/field-notes',
  apiDir: 'projects/field-notes',
  mediaPrefix: '../../media/'
});

assert.deepEqual(publicationTarget({ label: 'Caf\u00e9', href: '/Cafe%CC%81/' }), {
  folderName: 'Caf\u00e9',
  folderKey: 'caf\u00e9',
  targetDir: 'Caf\u00e9',
  apiDir: 'Caf%C3%A9',
  mediaPrefix: '../media/'
});

for (const item of [
  { label: 'Home', href: '/' },
  { label: 'Tags', href: '/tags/' },
  { label: 'Archive', href: '/archive/' },
  { label: 'Search', href: '/search/' },
  { label: 'QR', href: '/qr/' },
  { label: 'RSS', href: '/feed.xml' },
  { label: 'Atom', href: '/atom.xml' },
  { label: 'Archives', href: '/archives/' },
  { label: 'External', href: 'https://example.com/' }
]) {
  assert.equal(publicationTarget(item), null, `${item.href} must remain navigation-only`);
}

assert.throws(
  () => publicationTarget({ label: 'Writing', href: '/blog/' }),
  /must match exactly one link segment/
);
assert.throws(
  () => publicationTarget({ label: 'Notes', href: '/notes/notes/' }),
  /found 2/
);
for (const href of ['/../private/', '/%2e%2e/private/', '/private%2Fnotes/', '/private\\notes/', '/private//notes/']) {
  assert.throws(
    () => publicationTarget({ label: 'Private', href }),
    /Unsafe publication link/
  );
}
assert.throws(
  () => publicationAllowlist([
    { label: 'Blog', href: '/blog/' },
    { label: 'BLOG', href: '/other/blog/' }
  ]),
  /Duplicate publication folder label/
);

assert.deepEqual(
  publicationAllowlist([
    { label: 'Home', href: '/' },
    { label: 'Blog', href: '/blog/' },
    { label: 'About', href: '/about/about-me/' }
  ]).map(({ folderName, targetDir }) => ({ folderName, targetDir })),
  [
    { folderName: 'Blog', targetDir: 'blog' },
    { folderName: 'About', targetDir: 'about' }
  ]
);

console.log('Root-index publication allow-list tests passed.');
