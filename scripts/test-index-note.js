import assert from 'node:assert/strict';
import {
  parseBooleanProperty,
  parseIndexNoteConfiguration,
  parseListProperty,
  parseNoteConfiguration
} from '../src/lib/config/index-note.js';

const parsed = parseIndexNoteConfiguration(`# Home

| menu | link | type |
| --- | --- | --- |
| 🏠 Home | / | |
| Docs | https://example.com/docs | header |
| About | /about/ | footer |

| name | value |
| --- | --- |
| title | My site |
| showChildren | yes |
| previewProps | author, category |

Visible body.
`);

assert.deepEqual(parsed.menu, [
  { icon: '🏠', label: 'Home', href: '/', type: 'sidebar', source: '', path: '' },
  {
    icon: '•',
    label: 'Docs',
    href: 'https://example.com/docs',
    type: 'header',
    source: '',
    path: ''
  },
  { icon: '•', label: 'About', href: '/about/', type: 'footer', source: '', path: '' }
]);
assert.deepEqual(parsed.properties, {
  title: 'My site',
  showchildren: 'yes',
  previewprops: 'author, category'
});
assert.equal(parsed.cleanedMarkdown, '# Home\n\nVisible body.');
assert.deepEqual(parsed.issues, []);
assert.deepEqual(parseIndexNoteConfiguration('# Home'), {
  menu: null,
  properties: {},
  cleanedMarkdown: '# Home',
  issues: []
});

assert.throws(() => parseIndexNoteConfiguration(`| menu | link | type |
| --- | --- | --- |
| Unsafe | javascript:alert(1) | sidebar |
`), /unsafe or invalid link/);

assert.throws(() => parseIndexNoteConfiguration(`| menu | link | type |
| --- | --- | --- |
| Ambiguous path | /projects//field-notes/ | sidebar |
`), /unsafe or invalid link/);

assert.throws(() => parseIndexNoteConfiguration(`| menu | link | type |
| --- | --- | --- |
| Wrong type | /wrong/ | toolbar |
`), /unsupported type/);

assert.throws(() => parseIndexNoteConfiguration(`| menu | link | type |
| --- | --- | --- |
| Home | / | sidebar |

| menu | link | type |
| --- | --- | --- |
| About | /about/ | sidebar |
`), /only one menu table/);

assert.throws(() => parseIndexNoteConfiguration(`| menu | link | type |
| --- | --- | --- |
| Home | / | sidebar |
| Home again | / | sidebar |
`), /duplicates/);

assert.deepEqual(parseIndexNoteConfiguration(`| menu | link |
| --- | --- |
| Home | / |
`).menu, [
  { icon: '•', label: 'Home', href: '/', type: 'sidebar', source: '', path: '' }
]);

assert.deepEqual(parseIndexNoteConfiguration(`| menu | link | type | source | path |
| --- | --- | --- | --- | --- |
| Legacy | /legacy/ | sidebar | Old anchor | legacy |
`).menu, [
  { icon: '•', label: 'Legacy', href: '/legacy/', type: 'sidebar', source: 'Old anchor', path: 'legacy' }
], 'legacy extra columns remain parseable but are not required by the iPhone protocol');

assert.deepEqual(parseIndexNoteConfiguration(`| menu | link | type |
| --- | --- | --- |
| Feed | /feed.xml | footer |
| RSS | /rss.xml | header |
| Sitemap | /sitemap.xml | sidebar |
| Robots | /robots.txt | footer |
`).menu?.map(({ href }) => href), [
  '/feed.xml',
  '/rss.xml',
  '/sitemap.xml',
  '/robots.txt'
]);

assert.equal(
  parseIndexNoteConfiguration(`| menu | link |
| --- | --- |
| Versioned notes | /notes/v1.2/ |
`).menu?.[0].href,
  '/notes/v1.2/',
  'a dotted directory must not be mistaken for a file endpoint'
);

assert.throws(() => parseIndexNoteConfiguration(`| menu | link |
| -- | --- |
| Home | / |
`), /must be a Markdown table delimiter/);

assert.throws(() => parseIndexNoteConfiguration(`| menu | link | type |
| --- | --- | --- |
| Home | / | sidebar |
| Missing type | /broken/ |
`), /has 2 cells; expected 3/);

assert.throws(() => parseIndexNoteConfiguration(`| menu | type |
| --- | --- |
| Home | sidebar |
`), /must contain menu and link\/url columns/);

const nonRoot = parseNoteConfiguration(`# Notes

| menu | link | type |
| --- | --- | --- |
| This is article data | /not-navigation/ | sidebar |

| name | value |
| --- | --- |
| title | Notes title |

Visible body.
`);
assert.equal(nonRoot.menu, null);
assert.deepEqual(nonRoot.properties, { title: 'Notes title' });
assert.match(nonRoot.cleanedMarkdown, /\| menu \| link \| type \|/);
assert.doesNotMatch(nonRoot.cleanedMarkdown, /\| name \| value \|/);

assert.throws(() => parseNoteConfiguration(`| name | value |
| --- | --- |
| title | First |
| title | Second |
| custom field | Kept |
`), /duplicate title rows/);

const fenced = parseNoteConfiguration('```md\n| name | value |\n| --- | --- |\n| title | Code sample |\n```');
assert.deepEqual(fenced.properties, {});
assert.match(fenced.cleanedMarkdown, /Code sample/);

assert.equal(parseBooleanProperty('YES'), true);
assert.equal(parseBooleanProperty('off'), false);
assert.equal(parseBooleanProperty('maybe'), null);
assert.deepEqual(parseListProperty('author, category, author'), ['author', 'category', 'author']);

console.log('Index-note configuration tests passed.');
