import assert from 'node:assert/strict';
import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const buildDirectory = fileURLToPath(new URL('../build/', import.meta.url));
const expectedBase = (process.env.BASE_PATH || '').replace(/\/+$/, '');
const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

async function findHtmlFiles(directory) {
	const entries = await readdir(directory, { withFileTypes: true });
	const files = await Promise.all(entries.map(async (entry) => {
		const absolutePath = path.join(directory, entry.name);
		if (entry.isDirectory()) return findHtmlFiles(absolutePath);
		return entry.isFile() && entry.name.endsWith('.html') ? [absolutePath] : [];
	}));
	return files.flat();
}

const htmlFiles = await findHtmlFiles(buildDirectory);
assert(htmlFiles.length > 0, 'expected prerendered HTML files in build/');

for (const endpoint of ['feed.xml', 'rss.xml', 'sitemap.xml', 'robots.txt']) {
	const endpointStat = await stat(path.join(buildDirectory, endpoint));
	assert(endpointStat.isFile(), `${endpoint} must be emitted as a file endpoint without a trailing slash`);
}

const collectionFeeds = [
	['about', 'About'],
	['blog', 'Blog'],
	['music', 'Music'],
	['photo', 'Photo'],
	['video', 'Video']
];
for (const [route, title] of collectionFeeds) {
	const feedPath = path.join(buildDirectory, route, 'feed.xml');
	const rssPath = path.join(buildDirectory, route, 'rss.xml');
	const [feedStat, rssStat, feedXml, rssXml] = await Promise.all([
		stat(feedPath),
		stat(rssPath),
		readFile(feedPath, 'utf8'),
		readFile(rssPath, 'utf8')
	]);
	assert(feedStat.isFile(), `${route}/feed.xml must be a static file endpoint`);
	assert(rssStat.isFile(), `${route}/rss.xml must be a static file endpoint`);
	assert.equal(rssXml, feedXml, `${route} feed.xml and rss.xml aliases must stay byte-identical`);
	assert.match(feedXml, new RegExp(`<title>${title} — GYW&apos;s Website<\\/title>`));
}

const rootFeedXml = await readFile(path.join(buildDirectory, 'feed.xml'), 'utf8');
const rootRssXml = await readFile(path.join(buildDirectory, 'rss.xml'), 'utf8');
assert.equal(rootRssXml, rootFeedXml, 'root feed.xml and rss.xml aliases must stay byte-identical');
assert.match(rootFeedXml, /<title>GYW&apos;s Website<\/title>/, 'root feed must retain its existing channel identity');
const rootChannelLink = rootFeedXml.match(/<channel>[\s\S]*?<link>([^<]+)<\/link>/)?.[1];
assert(rootChannelLink, 'root feed must expose the configured canonical site URL');
if (process.env.VITE_SITE_URL) {
	assert.equal(
		rootChannelLink,
		`${process.env.VITE_SITE_URL.replace(/\/+$/, '')}/`,
		'deployment VITE_SITE_URL must control the canonical feed origin'
	);
}

const blogFeedXml = await readFile(path.join(buildDirectory, 'blog', 'feed.xml'), 'utf8');
assert.match(blogFeedXml, /<title>MacOS setting preferences<\/title>/, 'Blog feed must use the real note title');
assert.match(
	blogFeedXml,
	new RegExp(`<guid>${escapeRegExp(`${rootChannelLink.replace(/\/$/, '')}/blog/mac-os-setting-preferences/`)}<\\/guid>`),
	'Blog feed must use the configured base-path-safe permanent note URL'
);

const indexPath = path.join(buildDirectory, 'index.html');
const indexHtml = await readFile(indexPath, 'utf8');
assert.match(indexHtml, /<main\b/, 'expected the home page to contain prerendered content');
assert.doesNotMatch(indexHtml, /Loading\.\.\./, 'home page must not depend on a Loading shell');
assert.match(indexHtml, /GYW(?:&#39;|')s Website/, 'expected root index settings to control the site title');
assert.equal(
	(indexHtml.match(/<h1\b/gi) ?? []).length,
	1,
	'root title metadata and the Markdown H1 must render as one page heading'
);
assert.doesNotMatch(indexHtml, /<th>menu<\/th>/i, 'the root menu configuration table must not render as page content');
assert.doesNotMatch(indexHtml, /<th>name<\/th>\s*<th>value<\/th>/i, 'name/value configuration must not render as page content');
assert.doesNotMatch(indexHtml, /class="section-list/, 'showChildren=no should keep the home page focused on its own content');
assert.match(indexHtml, /<span>About<\/span>/, 'the root index should place About in the Sidebar');
assert.match(indexHtml, />About me<\/a>/, 'the public About destination should remain available in the footer');

const implicitSectionPath = path.join(buildDirectory, 'about', 'index.html');
const implicitSectionHtml = await readFile(implicitSectionPath, 'utf8');
assert.match(
	implicitSectionHtml,
	/about-me/,
	'expected a folder without index.md to have a prerendered section page'
);

const headingPagePath = path.join(buildDirectory, 'blog', 'mac-os-setting-preferences', 'index.html');
const headingPageHtml = await readFile(headingPagePath, 'utf8');
assert.match(
	headingPageHtml,
	new RegExp(`<link rel="canonical" href="${escapeRegExp(`${rootChannelLink.replace(/\/$/, '')}/blog/mac-os-setting-preferences/`)}"\\s*/?>`),
	'canonical metadata must share the configured feed origin'
);
assert.match(
	headingPageHtml,
	new RegExp(`<link rel="alternate" type="application/rss\\+xml" title="Blog RSS feed" href="${escapeRegExp(`${rootChannelLink.replace(/\/$/, '')}/blog/feed.xml`)}"\\s*/?>`),
	'post metadata must advertise and correctly name its parent Collection feed'
);
assert.doesNotMatch(headingPageHtml, /class="table-of-contents"/, 'posts should not show the automatic table of contents by default');
assert.match(headingPageHtml, /<h2 id="01-system-preferences">/, 'Markdown headings need deterministic safe IDs');
assert.match(headingPageHtml, /<ul>\s*<li>\s*<p><strong>Func key:<\/strong><\/p>\s*<ul>/, 'Apple Notes nested lists should remain nested after export');
assert.match(headingPageHtml, /<pre><code>defaults write <span class="code-flag">-g<\/span> NSWindowShouldDragOnGesture/, 'Apple Notes mono blocks should render as highlighted fenced code blocks');

const aboutPath = path.join(buildDirectory, 'about', 'about-me', 'index.html');
const aboutHtml = await readFile(aboutPath, 'utf8');
assert.match(aboutHtml, /<article class="markdown-content">[\s\S]*<p><img[^>]+>\s*<img[^>]+><\/p>/, 'consecutive Apple Notes images should stay together for two-column rendering');
assert.doesNotMatch(
	aboutHtml.match(/<article class="markdown-content">[\s\S]*?<\/article>/)?.[0] ?? '',
	/showInFooter/,
	'name/value metadata tables must not render in article content'
);

const musicPath = path.join(buildDirectory, 'music', 'marry-you', 'index.html');
const musicHtml = await readFile(musicPath, 'utf8');
assert.match(musicHtml, /class="link-embed link-embed-apple-music"/, 'Apple Music links should render as embed modules');
assert.doesNotMatch(musicHtml, /<p>\s*<div class="link-embed/, 'embed modules should not be invalid nested block HTML');

const searchPath = path.join(buildDirectory, 'search', 'index.html');
const searchHtml = await readFile(searchPath, 'utf8');
assert.match(searchHtml, /<h1>GYW(?:&#39;|')s Website \(search\)<\/h1>/, 'expected a prerendered Search page');
assert.match(searchHtml, /id="site-search"/, 'the Search page must contain its keyboard-accessible search input');
assert.match(searchHtml, /Type a word or tag to search public notes\./, 'the Search page must prerender its empty-query state');
assert.match(indexHtml, /href="[^\"]*search\/"[^>]*>Search<\/a>/, 'the site footer must expose the Search page');
assert.match(
	searchHtml,
		new RegExp(`${escapeRegExp(expectedBase)}\\/blog\\/mac-os-setting-preferences\\/`),
	'prerendered Search data must contain a base-path-safe permanent note URL'
);

if (expectedBase) {
	for (const file of htmlFiles) {
		const html = await readFile(file, 'utf8');
		for (const match of html.matchAll(/\b(?:href|src)=["'](\/[^"']*)["']/g)) {
			const reference = match[1];
			assert(
				reference === expectedBase || reference.startsWith(`${expectedBase}/`),
				`${path.relative(buildDirectory, file)} contains a root-absolute URL outside ${expectedBase}: ${reference}`
			);
		}
	}
}

console.log(`Build output tests passed${expectedBase ? ` for ${expectedBase}` : ''}.`);
