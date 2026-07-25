import assert from 'node:assert/strict';
import { mergeNavigation } from '../src/lib/server/navigation.js';

const configured = [
  { icon: '🏠', label: 'Home', href: '/' },
  { icon: '📒', label: 'Writing', href: '/blog/' },
  { icon: '🏷️', label: 'Tags', href: '/tags/' },
  { icon: '🧰', label: 'Archive', href: '/archive/' },
  { icon: '🧑‍💻', label: 'About me', href: '/about/about-me/' }
];

const sections = [
  { route: '/research/', title: 'Research' },
  { route: '/about/', title: 'About' },
  { route: '/blog/', title: 'Blog' },
  { route: '/notes/', title: 'Notes' }
];

assert.deepEqual(mergeNavigation(configured, sections), [
  configured[0],
  configured[1],
  { icon: '📁', label: 'Notes', href: '/notes/' },
  { icon: '📁', label: 'Research', href: '/research/' },
  configured[2],
  configured[3],
  configured[4]
], 'generated sections should appear alphabetically before utility links');

assert.deepEqual(
  mergeNavigation(configured, sections).filter((item) => item.href.startsWith('/about/')),
  [configured[4]],
  'a configured descendant link should cover its top-level section'
);

assert.equal(
  mergeNavigation([{ icon: '📒', label: 'Blog', href: '/blog' }], [{ route: '/blog/', title: 'Blog' }]).length,
  1,
  'a configured section link should cover the route with or without a trailing slash'
);

const withoutUtilities = configured.filter((item) => !['/tags/', '/archive/'].includes(item.href));
assert.deepEqual(
  mergeNavigation(withoutUtilities, [{ route: '/photo/', title: 'Photo' }]).at(-1),
  { icon: '📁', label: 'Photo', href: '/photo/' },
  'generated sections should append when no utility link is visible'
);

assert.notEqual(mergeNavigation(configured, []), configured, 'the merge must not expose the mutable config array');
assert.deepEqual(mergeNavigation(configured, []), configured, 'an empty content list should preserve configured navigation');

console.log('Automatic-navigation tests passed.');
