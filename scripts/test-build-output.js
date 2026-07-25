import assert from 'node:assert/strict';
import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const buildDirectory = fileURLToPath(new URL('../build/', import.meta.url));
const expectedBase = (process.env.BASE_PATH || '').replace(/\/+$/, '');

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

const implicitSectionPath = path.join(buildDirectory, 'about', 'index.html');
const implicitSectionHtml = await readFile(implicitSectionPath, 'utf8');
assert.match(
	implicitSectionHtml,
	/about-me/,
	'expected a folder without index.md to have a prerendered section page'
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
