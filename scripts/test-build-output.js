import assert from 'node:assert/strict';
import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const buildDirectory = fileURLToPath(new URL('../build/', import.meta.url));
const expectedBase = (process.env.BASE_PATH || '').replace(/\/+$/, '');
const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

async function readIfExists(filePath) {
	try {
		return await readFile(filePath, 'utf8');
	} catch (error) {
		if (error?.code === 'ENOENT') return null;
		throw error;
	}
}

function feedItems(xml) {
	return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map(([, item]) => ({
		title: item.match(/<title>([^<]+)<\/title>/)?.[1] ?? '',
		guid: item.match(/<guid>([^<]+)<\/guid>/)?.[1] ?? ''
	}));
}

function pagePathForGuid(guid) {
	const pathname = decodeURIComponent(new URL(guid).pathname);
	const baseSegment = expectedBase.replace(/^\/+|\/+$/g, '');
	let relativePath = pathname.replace(/^\/+|\/+$/g, '');
	if (baseSegment && (relativePath === baseSegment || relativePath.startsWith(`${baseSegment}/`))) {
		relativePath = relativePath.slice(baseSegment.length).replace(/^\/+/, '');
	}
	return path.join(buildDirectory, relativePath, 'index.html');
}

function clientRouteForGuid(guid) {
	const pathname = new URL(guid).pathname;
	if (!expectedBase || pathname === expectedBase || pathname.startsWith(`${expectedBase}/`)) return pathname;
	return `${expectedBase}${pathname.startsWith('/') ? '' : '/'}${pathname}`;
}

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
const sitemapXml = await readFile(path.join(buildDirectory, 'sitemap.xml'), 'utf8');
assert.doesNotMatch(sitemapXml, /\/settings\//, 'noindex Settings must not be listed in the sitemap');
const siteConfig = JSON.parse(await readFile(path.join(process.cwd(), 'site.config.json'), 'utf8'));
if (!siteConfig.features.qrCode) {
	assert.doesNotMatch(sitemapXml, /\/qr\//, 'disabled QR pages must not be listed in the sitemap');
}
if (!siteConfig.features.tags) {
	assert.doesNotMatch(sitemapXml, /\/tags\//, 'disabled Tags pages must not be listed in the sitemap');
}
if (!siteConfig.features.archive) {
	assert.doesNotMatch(sitemapXml, /\/archive\//, 'disabled Archive pages must not be listed in the sitemap');
}
assert.equal(rootRssXml, rootFeedXml, 'root feed.xml and rss.xml aliases must stay byte-identical');
assert.match(rootFeedXml, /<title>GYW&apos;s Website<\/title>/, 'root feed must retain its existing channel identity');
const rootChannelLink = rootFeedXml.match(/<channel>[\s\S]*?<link>([^<]+)<\/link>/)?.[1];
assert(rootChannelLink, 'root feed must expose the configured canonical site URL');
assert.equal(
	rootChannelLink,
	'https://moireblog.guoyingwei.top/',
	'site.config.json must control the canonical feed origin'
);

const blogFeedXml = await readFile(path.join(buildDirectory, 'blog', 'feed.xml'), 'utf8');
const blogItems = feedItems(blogFeedXml);
for (const item of blogItems) {
	assert(item.title, 'every Blog feed item must expose its current note title');
	assert(item.guid, 'every Blog feed item must expose a permanent URL');
	const pageStat = await stat(pagePathForGuid(item.guid));
	assert(pageStat.isFile(), `the current Blog feed item must have a prerendered page: ${item.guid}`);
}

const indexPath = path.join(buildDirectory, 'index.html');
const indexHtml = await readFile(indexPath, 'utf8');
assert.match(indexHtml, /<main\b/, 'expected the home page to contain prerendered content');
assert.doesNotMatch(indexHtml, /Loading\.\.\./, 'home page must not depend on a Loading shell');
assert.match(indexHtml, /GYW(?:&#39;|')s Website/, 'expected site settings to control the site title');
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
const implicitSectionHtml = await readIfExists(implicitSectionPath);
if (implicitSectionHtml) {
	assert.match(
		implicitSectionHtml,
		/about-me/,
		'expected a folder without index.md to have a prerendered section page'
	);
}

if (blogItems.length > 0) {
	const currentPost = blogItems[0];
	const currentPostHtml = await readFile(pagePathForGuid(currentPost.guid), 'utf8');
	assert.match(
		currentPostHtml,
		new RegExp(`<link rel="canonical" href="${escapeRegExp(currentPost.guid)}"\\s*/?>`),
		'canonical metadata must use the current note permanent URL'
	);
	assert.match(
		currentPostHtml,
		new RegExp(`<link rel="alternate" type="application/rss\\+xml" title="Blog RSS feed" href="${escapeRegExp(`${rootChannelLink.replace(/\/$/, '')}/blog/feed.xml`)}"\\s*/?>`),
		'post metadata must advertise and correctly name its parent Collection feed'
	);
	assert.doesNotMatch(currentPostHtml, /class="table-of-contents"/, 'posts should not show the automatic table of contents by default');
	if (blogItems.length === 1) {
		assert.doesNotMatch(
			currentPostHtml,
			/<a class="(?:previous|next)"/,
			'a single-note Collection must not render stale previous or next links'
		);
	}
}

const aboutPath = path.join(buildDirectory, 'about', 'about-me', 'index.html');
const aboutHtml = await readIfExists(aboutPath);
if (aboutHtml) {
	assert.match(aboutHtml, /<article class="markdown-content">[\s\S]*<div class="image-gallery"><a class="image-link"[^>]+><img[^>]+srcset=[^>]+><\/a><a class="image-link"[^>]+><img[^>]+srcset=[^>]+><\/a><\/div>/, 'same-block Apple Notes images should stay together for two-column rendering');
	assert.match(aboutHtml, /<a class="image-link" href="[^\"]+" target="_blank" rel="noreferrer"><img[^>]+srcset=/, 'responsive display images should link to the original image');
	assert.doesNotMatch(
		aboutHtml.match(/<article class="markdown-content">[\s\S]*?<\/article>/)?.[0] ?? '',
		/showInFooter/,
		'name/value metadata tables must not render in article content'
	);
}

const lifePath = path.join(buildDirectory, 'photo', 'life', 'index.html');
const lifeHtml = await readIfExists(lifePath);
if (lifeHtml) {
	assert.doesNotMatch(lifeHtml, /<div class="image-gallery">/, 'single-image Apple Notes blocks should remain single-column');
}

const musicPath = path.join(buildDirectory, 'music', 'marry-you', 'index.html');
const musicHtml = await readIfExists(musicPath);
if (musicHtml) {
	assert.match(musicHtml, /class="link-embed link-embed-apple-music"/, 'Apple Music links should render as embed modules');
	assert.doesNotMatch(musicHtml, /<p>\s*<div class="link-embed/, 'embed modules should not be invalid nested block HTML');
}

const searchPath = path.join(buildDirectory, 'search', 'index.html');
const searchHtml = await readFile(searchPath, 'utf8');
assert.match(searchHtml, /<h1>GYW(?:&#39;|')s Website \(search\)<\/h1>/, 'expected a prerendered Search page');
assert.match(searchHtml, /id="site-search"/, 'the Search page must contain its keyboard-accessible search input');
assert.match(searchHtml, /Type a word or tag to search public notes\./, 'the Search page must prerender its empty-query state');
assert.match(indexHtml, /href="[^\"]*search\/"[^>]*>Search<\/a>/, 'the site footer must expose the Search page');
const publicFeedItems = feedItems(rootFeedXml);
if (publicFeedItems.length > 0) {
	assert.match(
		searchHtml,
		new RegExp(escapeRegExp(clientRouteForGuid(publicFeedItems[0].guid))),
		'prerendered Search data must contain a base-path-safe URL for a current public note'
	);
}

const settingsPath = path.join(buildDirectory, 'settings', 'index.html');
const settingsHtml = await readFile(settingsPath, 'utf8');
const workerPath = path.join(buildDirectory, '_worker.js');
const workerJs = await readFile(workerPath, 'utf8');
assert.match(settingsHtml, /<h1>Settings<\/h1>/, 'expected a prerendered Settings page');
assert.match(settingsHtml, /class="settings-login"/, 'Settings page must initially expose only the admin sign-in view');
assert.match(settingsHtml, /name="settingsPassword"/, 'Settings sign-in must require an admin password');
assert.doesNotMatch(settingsHtml, /<form class="settings-form"/, 'Settings form must stay hidden until the browser session is authenticated');
assert.doesNotMatch(settingsHtml, /Effective site config/, 'Effective settings must stay hidden until authentication');
assert.doesNotMatch(settingsHtml, /General Settings/, 'Editable settings must stay hidden until authentication');
assert.doesNotMatch(settingsHtml, /Navigation from root index/, 'Navigation inspection must stay hidden until authentication');
assert.doesNotMatch(settingsHtml, /Page metadata and effective options/, 'Settings page should stay concise and not list every page');
assert.match(settingsHtml, /name="robots" content="noindex"/, 'Settings page should be public but not indexed');
assert.match(indexHtml, /class="site-footer-author"[^>]+settings\/"[^>]*>YingweiGuo<\/a>/, 'the footer author must link to Settings');
assert.match(workerJs, /\/api\/settings\/login/, 'Cloudflare Pages worker must expose the settings login route');
assert.match(workerJs, /\/api\/settings\/session/, 'Cloudflare Pages worker must expose the settings session route');
assert.match(workerJs, /SETTINGS_PASSWORD/, 'Settings API must require the Cloudflare SETTINGS_PASSWORD secret');
assert.match(workerJs, /HttpOnly;\s*Secure;\s*SameSite=Strict/, 'Settings session cookie must be HttpOnly, Secure, and SameSite=Strict');
assert.match(
	workerJs,
	/public, max-age=31536000, immutable/,
	'fingerprinted SvelteKit assets must use a one-year immutable browser cache'
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
