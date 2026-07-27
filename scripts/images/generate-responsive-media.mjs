#!/usr/bin/env node
import { existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { basename, extname, join, resolve } from 'node:path';
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
const widths = [640, 960, 1280, 1920];
const supported = new Set(['.jpg', '.jpeg', '.png', '.webp']);
const report = { mediaDir, outputDir, generated: [], skipped: [] };

if (!existsSync(mediaDir)) {
  console.log(JSON.stringify({ ...report, skipped: [{ reason: 'media directory does not exist' }] }, null, 2));
  process.exit(0);
}

rmSync(outputDir, { recursive: true, force: true });
mkdirSync(outputDir, { recursive: true });

for (const file of readdirSync(mediaDir)) {
  const extension = extname(file).toLowerCase();
  if (!supported.has(extension)) {
    report.skipped.push({ file, reason: 'unsupported media type' });
    continue;
  }

  const input = join(mediaDir, file);
  let metadata;
  try {
    metadata = await sharp(input, { unlimited: true }).metadata();
  } catch (error) {
    report.skipped.push({ file, reason: error instanceof Error ? error.message : 'metadata error' });
    continue;
  }

  const originalWidth = metadata.width || 0;
  if (!originalWidth) {
    report.skipped.push({ file, reason: 'missing width metadata' });
    continue;
  }

  const stem = basename(file, extension);
  try {
    for (const width of widths.filter((candidate) => candidate < originalWidth)) {
      const output = join(outputDir, `${stem}-${width}.webp`);
      await sharp(input, { unlimited: true })
        .rotate()
        .resize({ width, withoutEnlargement: true })
        .webp({ quality: 82, effort: 4 })
        .toFile(output);
      report.generated.push({
        source: `media/${file}`,
        output: `responsive-media/${basename(output)}`,
        width
      });
    }
  } catch (error) {
    report.skipped.push({ file, reason: error instanceof Error ? error.message : 'resize error' });
  }
}

console.log(JSON.stringify(report, null, 2));
