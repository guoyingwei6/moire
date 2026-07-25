import assert from 'node:assert/strict';
import { renderMarkdownDocument, renderTableOfContents } from '../src/lib/server/markdown.js';

const render = (markdown, overrides = {}) => renderMarkdownDocument(markdown, {
  sourcePath: '/content/blog/markdown-test.md',
  resolveImageHref: (href) => `/assets/${href}`,
  resolveRootHref: (href) => `/moire${href}`,
  showTableOfContents: true,
  ...overrides
});

const headings = render(`
# Page title

## Hello *world*

### Hello [world](/ignored/)

## 你好，世界！

## !!!
`);
assert.match(headings, /<h1 id="page-title">Page title<\/h1>/, 'every Markdown heading needs a stable anchor');
assert.match(headings, /<h2 id="hello-world">Hello <em>world<\/em><\/h2>/);
assert.match(headings, /<h3 id="hello-world-2">Hello <a href="\/moire\/ignored\/">world<\/a><\/h3>/);
assert.match(headings, /<h2 id="你好-世界">你好，世界！<\/h2>/, 'Unicode headings should remain readable');
assert.match(headings, /<h2 id="section">!!!<\/h2>/, 'punctuation-only headings need a safe fallback');
assert.equal((headings.match(/class="table-of-contents"/g) ?? []).length, 1);
assert.match(headings, /aria-label="Table of contents"/, 'the TOC must expose an accessible navigation landmark');
assert.match(headings, /href="#hello-world"/);
assert.match(headings, /href="#hello-world-2"/);
assert.doesNotMatch(headings, /href="#page-title"/, 'the page H1 does not belong in the H2-H6 TOC');
assert.match(
  headings,
  /href="#hello-world"[^]*?<ol><li><a href="#hello-world-2"/,
  'subheadings should be represented as a nested list'
);

const withoutToc = render('## Kept anchor', { showTableOfContents: false });
assert.doesNotMatch(withoutToc, /table-of-contents/);
assert.match(withoutToc, /<h2 id="kept-anchor">/, 'disabling the TOC must not remove permanent heading anchors');
assert.doesNotMatch(render('# Only a page title'), /table-of-contents/, 'a document without H2-H6 headings needs no TOC');

const footnotes = render(`
Text[^note], repeated[^note], and a missing[^missing].

Inline code stays literal: \`[^note]\`.

\`\`\`
[^code]: this is code
\`\`\`

[^note]: A **safe** note with [root](/guide/), [unsafe](javascript:alert(1)), and <script>alert(1)</script>.

    A continuation paragraph with ![alt](note.png).
`);
assert.match(footnotes, /id="moire:fnref:1:1"/);
assert.match(footnotes, /id="moire:fnref:1:2"/, 'repeated references need distinct return targets');
assert.match(footnotes, /id="moire:fn:1"/);
assert.match(footnotes, /href="#moire:fn:1" aria-label="Footnote 1"/);
assert.match(footnotes, /href="#moire:fnref:1:1"/);
assert.match(footnotes, /href="#moire:fnref:1:2"/);
assert.match(footnotes, /<strong>safe<\/strong>/, 'footnote definitions should support ordinary Markdown');
assert.match(footnotes, /href="\/moire\/guide\/"/, 'root-relative footnote links must respect the configured base path');
assert.match(footnotes, /<img src="\/assets\/note\.png" alt="alt">/, 'footnote images must use the normal asset resolver');
assert.match(footnotes, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/, 'raw HTML in footnotes must stay escaped');
assert.doesNotMatch(footnotes, /javascript:/, 'unsafe links in footnotes must not reach rendered HTML');
assert.match(footnotes, /missing\[\^missing\]/, 'undefined footnotes should stay visible rather than becoming broken links');
assert.match(footnotes, /<code>\[\^note\]<\/code>/, 'footnote syntax inside inline code must stay literal');
assert.match(footnotes, /<code>\[\^code\]: this is code/, 'footnote definitions inside fenced code must stay literal');
assert.doesNotMatch(footnotes, /\[\^note\]:/, 'a real definition must not render in the article body');

const collisionProof = render('## moire fn 1\n\nText[^a].\n\n[^a]: Footnote.');
assert.match(collisionProof, /<h2 id="moire-fn-1">/, 'heading anchors retain their readable slug');
assert.match(collisionProof, /id="moire:fn:1"/, 'footnotes use a namespace headings cannot produce');

assert.throws(
  () => render('Use[^a].\n\n[^a]: One\n[^A]: Two'),
  /Duplicate footnote definition/,
  'ambiguous case-insensitive definitions must fail the build'
);

const escapedToc = renderTableOfContents([{ depth: 2, id: 'safe" onclick="bad', text: '<unsafe>' }]);
assert.match(escapedToc, /href="#safe&quot; onclick=&quot;bad"/);
assert.match(escapedToc, /&lt;unsafe&gt;/);
assert.doesNotMatch(escapedToc, /<unsafe>/);

console.log('Markdown TOC and footnote tests passed.');
