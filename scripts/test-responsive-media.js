import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import sharp from 'sharp';

const root = mkdtempSync(join(tmpdir(), 'moire-responsive-media-'));
const contentDir = join(root, 'content');
const mediaDir = join(contentDir, 'media');
const outputDir = join(contentDir, 'responsive-media');
const cacheDir = join(root, 'cache');
const generator = resolve('scripts/images/generate-responsive-media.mjs');
const generatorSource = readFileSync(generator, 'utf8');
assert.match(generatorSource, /findReferencedHeic/, 'responsive-media generation must inspect Markdown HEIC references');
assert.match(generatorSource, /no usable WebP derivative was produced/, 'referenced HEIC files must fail when no WebP is available');

function runGenerator() {
  const output = execFileSync(process.execPath, [
    generator,
    '--content', contentDir,
    '--cache', cacheDir
  ], {
    encoding: 'utf8'
  });
  return JSON.parse(output);
}

try {
  mkdirSync(mediaDir, { recursive: true });
  const source = join(mediaDir, 'content-hash.png');
  await sharp({
    create: {
      width: 1400,
      height: 900,
      channels: 3,
      background: { r: 80, g: 140, b: 200 }
    }
  }).png().toFile(source);

  const first = runGenerator();
  assert.equal(first.generated.length, 3, 'the first run should generate every smaller responsive width');
  assert.equal(first.reused.length, 0, 'the first run should not report cached derivatives');
  assert.deepEqual(
    readdirSync(outputDir).sort(),
    ['content-hash-1280.webp', 'content-hash-640.webp', 'content-hash-960.webp'],
    'responsive output names should stay compatible with the Markdown image resolver'
  );

  const second = runGenerator();
  assert.equal(second.generated.length, 0, 'an unchanged content-addressed image should not be converted again');
  assert.equal(second.reused.length, 3, 'an unchanged content-addressed image should reuse all derivatives');

  rmSync(outputDir, { recursive: true, force: true });
  const third = runGenerator();
  assert.equal(third.generated.length, 0, 'a clean build should not reconvert an image in the persistent build cache');
  assert.equal(third.restored.length, 3, 'a clean build should restore every derivative from the persistent cache');
  assert.deepEqual(
    readdirSync(outputDir).sort(),
    ['content-hash-1280.webp', 'content-hash-640.webp', 'content-hash-960.webp'],
    'restored derivatives should use the public output names expected by the Markdown renderer'
  );

  rmSync(source);
  const fourth = runGenerator();
  assert.equal(fourth.removed.length, 3, 'derivatives whose source disappeared should be removed');
  assert.deepEqual(readdirSync(outputDir), [], 'stale responsive images must not survive source deletion');

  writeFileSync(join(contentDir, 'heic-note.md'), '![](media/referenced.heic)\n');
  writeFileSync(join(mediaDir, 'referenced.heic'), Buffer.from('not a real HEIC file'));
  const failed = await import('node:child_process').then(({ spawnSync }) => spawnSync(process.execPath, [
    generator,
    '--content', contentDir,
    '--cache', cacheDir
  ], { encoding: 'utf8' }));
  assert.notEqual(failed.status, 0, 'a referenced HEIC conversion failure must fail the build');
  const failedReport = JSON.parse(failed.stdout);
  assert.equal(failedReport.failed.length, 1, 'the failed HEIC should be reported explicitly');
} finally {
  rmSync(root, { recursive: true, force: true });
}

console.log('Responsive-media incremental-cache tests passed.');
