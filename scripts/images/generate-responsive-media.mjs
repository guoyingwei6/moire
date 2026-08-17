#!/usr/bin/env node
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { basename, dirname, extname, join, relative, resolve } from 'node:path';
import convertHeic from 'heic-convert';
import sharp from 'sharp';

const args = new Map();
for (let index = 2; index < process.argv.length; index += 1) {
  const key = process.argv[index];
  if (!key.startsWith('--')) continue;
  const value = process.argv[index + 1] && !process.argv[index + 1].startsWith('--')
    ? process.argv[++index]
    : 'true';
  args.set(key.slice(2), value);
}

const contentDir = resolve(args.get('content') || 'content');
const mediaDir = resolve(contentDir, 'media');
const outputDir = resolve(contentDir, 'responsive-media');
const cacheDir = resolve(
  args.get('cache')
  || process.env.MOIRE_MEDIA_CACHE_DIR
  || 'node_modules/.cache/imagetools/moire-responsive-media-v1'
);
const widths = [640, 960, 1280, 1920];
const supported = new Set(['.avif', '.heic', '.heif', '.jpg', '.jpeg', '.png', '.webp']);
const report = {
  mediaDir,
  outputDir,
  cacheDir,
  generated: [],
  reused: [],
  restored: [],
  removed: [],
  skipped: [],
  failed: []
};

const referencedHeic = findReferencedHeic(contentDir);

if (!existsSync(mediaDir)) {
  for (const file of referencedHeic) {
    report.failed.push({ file: relative(contentDir, file), reason: 'referenced HEIC source does not exist' });
  }
  console.log(JSON.stringify({ ...report, skipped: [{ reason: 'media directory does not exist' }] }, null, 2));
  process.exit(report.failed.length ? 1 : 0);
}

mkdirSync(outputDir, { recursive: true });
mkdirSync(cacheDir, { recursive: true });
const expectedOutputs = new Set();

for (const entry of readdirSync(mediaDir, { withFileTypes: true })) {
  if (!entry.isFile()) continue;
  const file = entry.name;
  const extension = extname(file).toLowerCase();
  if (!supported.has(extension)) {
    report.skipped.push({ file, reason: 'unsupported media type' });
    continue;
  }

  const input = join(mediaDir, file);
  const isReferenced = referencedHeic.has(input);
  let resizeInput = input;
  let metadata;
  try {
    if (extension === '.heic' || extension === '.heif') {
      resizeInput = await heicToJpegBuffer(input);
    }
    metadata = await sharp(resizeInput, { unlimited: true }).metadata();
  } catch (error) {
    const item = { file, reason: error instanceof Error ? error.message : 'metadata error' };
    (isReferenced && (extension === '.heic' || extension === '.heif') ? report.failed : report.skipped).push(item);
    continue;
  }

  const originalWidth = metadata.width || 0;
  if (!originalWidth) {
    const item = { file, reason: 'missing width metadata' };
    (isReferenced && (extension === '.heic' || extension === '.heif') ? report.failed : report.skipped).push(item);
    continue;
  }

  const stem = basename(file, extension);
  const candidateWidths = widths.filter((candidate) => candidate < originalWidth);
  if (isReferenced && (extension === '.heic' || extension === '.heif') && !candidateWidths.length) {
    candidateWidths.push(640);
  }
  let produced = false;
  try {
    for (const width of candidateWidths) {
      const outputName = `${stem}-${width}.webp`;
      const output = join(outputDir, outputName);
      const cachedOutput = join(cacheDir, outputName);
      expectedOutputs.add(basename(output));
      const outputDetails = {
        source: `media/${file}`,
        output: `responsive-media/${basename(output)}`,
        width
      };
      if (existsSync(output)) {
        report.reused.push(outputDetails);
        produced = true;
        continue;
      }
      if (existsSync(cachedOutput)) {
        copyFileSync(cachedOutput, output);
        report.restored.push(outputDetails);
        produced = true;
        continue;
      }
      await sharp(resizeInput, { unlimited: true })
        .rotate()
        .resize({ width, withoutEnlargement: true })
        .webp({ quality: 82, effort: 4 })
        .toFile(cachedOutput);
      copyFileSync(cachedOutput, output);
      report.generated.push(outputDetails);
      produced = true;
    }
  } catch (error) {
    const item = { file, reason: error instanceof Error ? error.message : 'resize error' };
    (isReferenced && (extension === '.heic' || extension === '.heif') ? report.failed : report.skipped).push(item);
    continue;
  }
  if (isReferenced && (extension === '.heic' || extension === '.heif') && !produced) {
    report.failed.push({ file, reason: 'no usable WebP derivative was produced' });
  }
}

for (const entry of readdirSync(outputDir, { withFileTypes: true })) {
  if (!entry.isFile() || extname(entry.name).toLowerCase() !== '.webp' || expectedOutputs.has(entry.name)) continue;
  rmSync(join(outputDir, entry.name), { force: true });
  report.removed.push(`responsive-media/${entry.name}`);
}

console.log(JSON.stringify(report, null, 2));
if (report.failed.length) process.exitCode = 1;

function findReferencedHeic(root) {
  const references = new Set();
  for (const markdownPath of walkFiles(root, (path) => extname(path).toLowerCase() === '.md')) {
    let markdown;
    try {
      markdown = readFileSync(markdownPath, 'utf8');
    } catch {
      continue;
    }
    const refs = [];
    for (const match of markdown.matchAll(/!\[[^\]]*\]\(\s*(?:<([^>]+)>|([^\s)]+))/g)) {
      refs.push(match[1] || match[2]);
    }
    for (const match of markdown.matchAll(/<img\b[^>]*\bsrc=(['"])(.*?)\1/gi)) {
      refs.push(match[2]);
    }
    for (const ref of refs) {
      const path = referencedAssetPath(ref, markdownPath, root);
      if (path && /\.(?:heic|heif)$/i.test(path)) references.add(path);
    }
  }
  return references;
}

function referencedAssetPath(value, markdownPath, root) {
  let href = String(value || '').trim();
  if (!href || /^data:/i.test(href) || /^[a-z][a-z\d+.-]*:/i.test(href) || href.startsWith('/')) return '';
  href = href.split(/[?#]/, 1)[0];
  try {
    const path = resolve(dirname(markdownPath), decodeURIComponent(href));
    const relativePath = relative(root, path);
    if (relativePath.startsWith('..')) return '';
    return path;
  } catch {
    return '';
  }
}

function walkFiles(root, predicate) {
  const files = [];
  const stack = [root];
  while (stack.length) {
    const directory = stack.pop();
    let entries;
    try {
      entries = readdirSync(directory, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) stack.push(path);
      else if (entry.isFile() && predicate(path)) files.push(path);
    }
  }
  return files;
}

async function heicToJpegBuffer(input) {
  const buffer = await readFile(input);
  const output = await convertHeic({
    buffer,
    format: 'JPEG',
    quality: 0.92
  });
  return Buffer.from(output);
}
