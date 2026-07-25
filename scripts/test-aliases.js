import assert from 'node:assert/strict';
import { aliasRoute, buildAliasEntries } from '../src/lib/server/aliases.js';

assert.equal(aliasRoute('old-title', '/blog/current-title/', '/content/blog/current-title.md'), '/blog/old-title/');
assert.equal(aliasRoute('/notes/旧地址/', '/blog/current-title/', '/content/blog/current-title.md'), '/notes/旧地址/');

for (const value of [
  '',
  '../private',
  'nested/relative',
  'https://example.com',
  '/tags/hidden',
  '/blog/feed.xml/',
  '/bad path/'
]) {
  assert.throws(
    () => aliasRoute(value, '/blog/current-title/', '/content/blog/current-title.md'),
    /Invalid aliases value/
  );
}

assert.throws(
  () => aliasRoute('current-title', '/blog/current-title/', '/content/blog/current-title.md'),
  /duplicates its canonical route/
);

const records = [
  {
    route: '/blog/current-title/',
    sourcePath: '/content/blog/current-title.md',
    properties: { aliases: 'old-title, /writing/first-title/' }
  },
  {
    route: '/about/',
    sourcePath: '/content/about/index.md',
    properties: {}
  }
];
assert.deepEqual(buildAliasEntries(records), [
  { route: '/blog/old-title/', target: '/blog/current-title/' },
  { route: '/writing/first-title/', target: '/blog/current-title/' }
]);

assert.throws(
  () => buildAliasEntries([
    ...records,
    {
      route: '/other/',
      sourcePath: '/content/other/index.md',
      properties: { aliases: '/about/' }
    }
  ]),
  /conflicts with canonical content/
);

assert.throws(
  () => buildAliasEntries([
    ...records,
    {
      route: '/other/',
      sourcePath: '/content/other/index.md',
      properties: { aliases: '/blog/old-title/' }
    }
  ]),
  /Duplicate alias route/
);

console.log('Alias policy tests passed.');
