import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
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

const indexPath = path.join(buildDirectory, 'index.html');
const indexHtml = await readFile(indexPath, 'utf8');
assert.match(indexHtml, /<main\b/, 'expected the home page to contain prerendered content');
assert.doesNotMatch(indexHtml, /Loading\.\.\./, 'home page must not depend on a Loading shell');

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
