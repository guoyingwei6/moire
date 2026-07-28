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

const nestedList = render(`
- **Func key:**
  - System Preferences > Keyboard
`);
assert.match(
  nestedList,
  /<ul>\s*<li>(?:<p>)?<strong>Func key:<\/strong>(?:<\/p>)?<ul>/,
  'Apple Notes nested lists should remain nested'
);

const monoBlock = render(`
\`\`\`sh
defaults write -g NSWindowShouldDragOnGesture -bool true
\`\`\`
`);
assert.match(
  monoBlock,
  /<pre><code>defaults write <span class="code-flag">-g<\/span> NSWindowShouldDragOnGesture/,
  'Apple Notes mono blocks should render as highlighted fenced code blocks'
);

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
assert.match(footnotes, /<img loading="lazy" decoding="async" src="\/assets\/note\.png" alt="alt">/, 'footnote images must use the normal asset resolver');
assert.match(footnotes, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/, 'raw HTML in footnotes must stay escaped');
assert.doesNotMatch(footnotes, /javascript:/, 'unsafe links in footnotes must not reach rendered HTML');
assert.match(footnotes, /missing\[\^missing\]/, 'undefined footnotes should stay visible rather than becoming broken links');
assert.match(footnotes, /<code>\[\^note\]<\/code>/, 'footnote syntax inside inline code must stay literal');
assert.match(footnotes, /<code>\[\^code\]: this is code/, 'footnote definitions inside fenced code must stay literal');
assert.doesNotMatch(footnotes, /\[\^note\]:/, 'a real definition must not render in the article body');

const collisionProof = render('## moire fn 1\n\nText[^a].\n\n[^a]: Footnote.');
assert.match(collisionProof, /<h2 id="moire-fn-1">/, 'heading anchors retain their readable slug');
assert.match(collisionProof, /id="moire:fn:1"/, 'footnotes use a namespace headings cannot produce');

const embeds = render('[https://embed.music.apple.com/cn/album/marry-you/576670451?i=576670463](https://embed.music.apple.com/cn/album/marry-you/576670451?i=576670463)');
assert.match(embeds, /class="link-embed link-embed-apple-music"/, 'bare Apple Music links should render as embeds');
assert.match(embeds, /<iframe src="https:\/\/embed\.music\.apple\.com\/cn\/album\/marry-you\/576670451\?i=576670463"/);
assert.doesNotMatch(embeds, /<p>\s*<div class="link-embed/, 'block embeds must not remain wrapped inside paragraphs');

const youtubeEmbed = render('[https://youtu.be/dQw4w9WgXcQ](https://youtu.be/dQw4w9WgXcQ)');
assert.match(youtubeEmbed, /https:\/\/www\.youtube-nocookie\.com\/embed\/dQw4w9WgXcQ/, 'bare YouTube links should use privacy-preserving embed URLs');

const photoEmbed = render('[https://photos.guoyingwei.top](https://photos.guoyingwei.top)');
assert.match(photoEmbed, /class="link-embed link-embed-card link-embed-photo-site"/, 'the personal photo site should render as a preview card');
assert.match(photoEmbed, /YingweiGuo&#39;s Photos/, 'photo preview card should include the site title');
assert.match(photoEmbed, /https:\/\/photos\.guoyingwei\.top\/home-image/, 'photo preview card should use the site preview image');

const appleMap = render('[https://maps.apple.com/?ll=40.025272,116.286638&q=%E5%9B%BD%E5%AE%B6%E5%86%9C%E4%B8%9A%E5%9B%BE%E4%B9%A6%E9%A6%86&t=m](https://maps.apple.com/?ll=40.025272,116.286638&q=%E5%9B%BD%E5%AE%B6%E5%86%9C%E4%B8%9A%E5%9B%BE%E4%B9%A6%E9%A6%86&t=m)');
assert.match(appleMap, /class="link-embed link-embed-card link-embed-map link-embed-apple-map"/, 'Apple Maps links should render as map cards');
assert.match(appleMap, /国家农业图书馆/, 'Apple Maps cards should decode q labels');
assert.match(appleMap, /40\.025272,116\.286638/, 'Apple Maps cards should show coordinates when available');

const googleMap = render('[https://www.google.com/maps/place/Beijing/@39.904211,116.407395,10z](https://www.google.com/maps/place/Beijing/@39.904211,116.407395,10z)');
assert.match(googleMap, /class="link-embed link-embed-card link-embed-map link-embed-google-map"/, 'Google Maps links should render as map cards');
assert.match(googleMap, /Beijing/, 'Google Maps cards should use the path place label');

const bilibili = render('[https://www.bilibili.com/video/BV1xx411c7mD](https://www.bilibili.com/video/BV1xx411c7mD)');
assert.match(bilibili, /class="link-embed link-embed-card link-embed-service link-embed-bilibili"/, 'Bilibili bare links should render as service cards');
assert.match(bilibili, /Bilibili video BV1xx411c7mD/);

const xiaohongshu = render('[https://www.xiaohongshu.com/explore/65abcdef](https://www.xiaohongshu.com/explore/65abcdef)');
assert.match(xiaohongshu, /class="link-embed link-embed-card link-embed-service link-embed-xiaohongshu"/, 'Xiaohongshu bare links should render as service cards');
assert.match(xiaohongshu, /Xiaohongshu note 65abcdef/);

const github = render('[https://github.com/guoyingwei6/moire](https://github.com/guoyingwei6/moire)');
assert.match(github, /class="link-embed link-embed-card link-embed-service link-embed-github"/, 'GitHub repository bare links should render as service cards');
assert.match(github, /guoyingwei6\/moire/);

const doi = render('[https://doi.org/10.1038/s41586-020-2649-2](https://doi.org/10.1038/s41586-020-2649-2)');
assert.match(doi, /class="link-embed link-embed-card link-embed-service link-embed-doi"/, 'DOI bare links should render as service cards');
assert.match(doi, /10.1038\/s41586-020-2649-2/);

const attachments = render(`
::moire-attachment
type: audio
title: New Recording
href: ../media/attachments/recording.m4a
mime: audio/mp4
size: 42000
duration: 4.7
::

::moire-attachment
type: pdf
title: Paper
href: ../media/attachments/paper.pdf
mime: application/pdf
size: 250000
::
`);
assert.match(attachments, /class="moire-attachment moire-attachment-audio"/, 'audio attachments should render as cards');
assert.match(attachments, /<audio controls preload="metadata" src="\/assets\/\.\.\/media\/attachments\/recording\.m4a"><\/audio>/);
assert.match(attachments, /New Recording/);
assert.match(attachments, /5s/);
assert.match(
  attachments,
  /moire-attachment-audio"><div class="attachment-main">[\s\S]*?<a class="attachment-open"[^>]*>Open<\/a><\/div><audio/,
  'audio Open links should stay in the card header beside the title'
);
assert.match(attachments, /class="moire-attachment moire-attachment-pdf"/, 'PDF attachments should render as inline previews');
assert.match(attachments, /<iframe src="\/assets\/\.\.\/media\/attachments\/paper\.pdf" title="Paper" loading="lazy"><\/iframe>/);
assert.match(
  attachments,
  /moire-attachment-pdf"><div class="attachment-main">[\s\S]*?<a class="attachment-open"[^>]*>Open<\/a><\/div><iframe/,
  'PDF Open links should stay in the same header position as audio attachments'
);

const labelledMusic = render('[listen](https://embed.music.apple.com/cn/album/marry-you/576670451?i=576670463)');
assert.doesNotMatch(labelledMusic, /link-embed-apple-music/, 'labelled media links should stay ordinary links');
const labelledMap = render('[open map](https://maps.apple.com/?ll=40.025272,116.286638&q=Place)');
assert.doesNotMatch(labelledMap, /link-embed-map/, 'labelled map links should stay ordinary links');
const labelledGithub = render('[repo](https://github.com/guoyingwei6/moire)');
assert.doesNotMatch(labelledGithub, /link-embed-github/, 'labelled GitHub links should stay ordinary links');

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
