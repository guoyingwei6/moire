#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import {
  PUBLISH_MANIFEST_PATH,
  createPublishManifest,
  planPublishReconciliation
} from '../../src/lib/sync/publish-manifest.js';

const args = new Map();
for (let index = 2; index < process.argv.length; index += 1) {
  const key = process.argv[index];
  if (!key.startsWith('--')) continue;
  const value = process.argv[index + 1] && !process.argv[index + 1].startsWith('--')
    ? process.argv[++index]
    : 'true';
  args.set(key.slice(2), value);
}

const input = resolve(args.get('in') || 'notes-export/public-notes.json');
const contentDir = resolve(args.get('content') || 'content');
const clean = args.get('clean') === 'true';
const ifExists = args.get('if-exists') === 'true';
const manifestPath = resolve(contentDir, PUBLISH_MANIFEST_PATH);
const reconcilePath = resolve(contentDir, '.moire-reconcile.json');
if (!existsSync(input)) {
  if (ifExists) {
    console.log(JSON.stringify({ input, skipped: true, reason: 'input does not exist' }, null, 2));
    process.exit(0);
  }
  throw new Error(`Notes export snapshot not found: ${input}`);
}
const data = JSON.parse(readFileSync(input, 'utf8'));
const siteConfig = JSON.parse(readFileSync(resolve('site.config.json'), 'utf8'));

const sectionSlugs = new Map(data.sections.map((section) => [section.name, slugify(section.name)]));
const rootIndexNote = data.root.notes.find((note) => normalizedTitle(note.name) === 'index') || data.root.notes[0];
const publicSectionSlugs = extractPublicSectionSlugs(rootIndexNote?.body, sectionSlugs);
const previousManifest = existsSync(manifestPath)
  ? JSON.parse(readFileSync(manifestPath, 'utf8'))
  : null;
const generatedFiles = new Map();
const report = {
  input,
  contentDir,
  manifest: relative(process.cwd(), manifestPath),
  reconcile: relative(process.cwd(), reconcilePath),
  notes: [],
  media: [],
  skippedDrafts: [],
  skippedSections: []
};

if (clean) {
  for (const name of ['about', 'blog', 'music', 'photo', 'video', 'media']) {
    rmSync(resolve(contentDir, name), { recursive: true, force: true });
  }
}
mkdirSync(contentDir, { recursive: true });
mkdirSync(resolve(contentDir, 'media'), { recursive: true });

writeNote({
  note: rootIndexNote,
  sectionSlug: '',
  outputPath: resolve(contentDir, 'index.md'),
  isIndex: true
});

for (const section of data.sections) {
  const sectionSlug = sectionSlugs.get(section.name);
  if (!sectionSlug) continue;
  if (publicSectionSlugs.size && !publicSectionSlugs.has(sectionSlug)) {
    report.skippedSections.push({ section: section.name, slug: sectionSlug, reason: 'not listed in root index menu table' });
    continue;
  }
  mkdirSync(resolve(contentDir, sectionSlug), { recursive: true });
  const visibleNotes = section.notes.filter((note) => !isDraft(note.name));
  for (const note of section.notes) {
    if (isDraft(note.name)) {
      report.skippedDrafts.push({ section: section.name, title: note.name, id: note.id });
      continue;
    }
    const isIndex = normalizedTitle(note.name) === 'index';
    const slug = isIndex ? 'index' : slugify(note.name);
    writeNote({
      note,
      sectionSlug,
      outputPath: resolve(contentDir, sectionSlug, `${slug}.md`),
      isIndex
    });
  }
  if (!visibleNotes.some((note) => normalizedTitle(note.name) === 'index')) {
    const title = section.name;
    writeManagedFile(
      resolve(contentDir, sectionSlug, 'index.md'),
      frontmatter({ title, created: '', updated: '' }),
      'markdown'
    );
  }
}

const nextManifest = createPublishManifest(rootFingerprint(data.root), [...generatedFiles.values()]);
const reconciliation = planPublishReconciliation(previousManifest, nextManifest);
writeFileSync(manifestPath, `${JSON.stringify(nextManifest, null, 2)}\n`);
writeFileSync(reconcilePath, `${JSON.stringify({
  version: 1,
  previousManifest: previousManifest ? relative(process.cwd(), manifestPath) : null,
  nextManifest: relative(process.cwd(), manifestPath),
  summary: {
    upsert: reconciliation.upsert.length,
    unchanged: reconciliation.unchanged.length,
    remove: reconciliation.remove.length,
    relocate: reconciliation.relocate.length
  },
  upsert: reconciliation.upsert,
  unchanged: reconciliation.unchanged,
  remove: reconciliation.remove,
  relocate: reconciliation.relocate,
  deletesApplied: false,
  note: 'Report only. The build script never deletes repository content as a publish cleanup action.'
}, null, 2)}\n`);
report.reconciliation = {
  upsert: reconciliation.upsert.length,
  unchanged: reconciliation.unchanged.length,
  remove: reconciliation.remove.length,
  relocate: reconciliation.relocate.length,
  deletesApplied: false
};

console.log(JSON.stringify(report, null, 2));

function writeNote({ note, sectionSlug, outputPath, isIndex }) {
  if (!note) return;
  const markdown = normalizeMarkdownBody(htmlToMarkdown(note.body, {
    noteId: stableId(note),
    sourcePath: outputPath
  }), note.name).trim();
  const title = isIndex ? titleForIndex(sectionSlug, note.name) : note.name;
  const body = `${!sectionSlug && isIndex ? normalizeRootIndexMarkdown(markdown) : markdown}\n`;
  writeManagedFile(outputPath, frontmatter({ title, created: note.created, updated: note.modified }) + body, 'markdown');
  report.notes.push({
    title: note.name,
    id: note.id,
    output: relative(process.cwd(), outputPath),
    bytes: Buffer.byteLength(body)
  });
}

function htmlToMarkdown(html, context) {
  let text = String(html || '');
  text = convertImageOnlyDivs(text, context);
  text = text.replace(/<img\b[^>]*\bsrc=(["'])(data:image\/([^;]+);base64,([\s\S]*?))\1[^>]*>/gi, (tag) => {
    const markdown = imageTagToMarkdown(tag, context);
    return markdown ? `\n\n${markdown}\n\n` : '\n\n';
  });

  text = text.replace(/<table\b[\s\S]*?<\/table>/gi, tableToMarkdown);
  text = convertMonoBlocks(text);
  text = convertInlineMono(text);
  text = text.replace(/<(h[1-6])\b[^>]*>([\s\S]*?)<\/\1>/gi, (_, tag, body) => {
    const level = Number(tag.slice(1));
    const heading = inlineText(body);
    return heading ? `\n\n${'#'.repeat(level)} ${heading}\n\n` : '\n\n';
  });
  text = text.replace(/<(strong|b)\b[^>]*>([\s\S]*?)<\/\1>/gi, (_, _tag, body) => {
    const value = inlineFormattingText(body);
    if (value === ' ') return value;
    return value ? `**${value}**` : '';
  });
  text = text.replace(/<(em|i)\b[^>]*>([\s\S]*?)<\/\1>/gi, (_, _tag, body) => {
    const value = inlineFormattingText(body);
    if (value === ' ') return value;
    return value ? `*${value}*` : '';
  });
  text = text.replace(/<a\b[^>]*\bhref=(["']?)([^"'\s>]+)\1[^>]*>([\s\S]*?)<\/a>/gi, (_, _quote, href, body) => {
    const label = inlineText(body);
    return safeHref(href) ? `[${label}](${href})` : label;
  });
  text = convertLists(text);
  text = text.replace(/<br\s*\/?>/gi, '\n');
  text = text.replace(/<\/p\s*>/gi, '\n\n');
  text = text.replace(/<p\b[^>]*>/gi, '');
  text = text.replace(/<\/div\s*>/gi, '\n');
  text = text.replace(/<div\b[^>]*>/gi, '');
  text = stripTags(text);
  text = decodeEntities(text);
  text = text.replace(/[ \t]+\n/g, '\n');
  text = normalizeInlineMarkdownSyntax(text);
  text = text.replace(/\n{3,}/g, '\n\n');
  return text;
}

function convertImageOnlyDivs(html, context) {
  return String(html || '').replace(/<div\b[^>]*>([\s\S]*?)<\/div>/gi, (full, inner) => {
    const imageTags = [...String(inner).matchAll(/<img\b[^>]*>/gi)].map((match) => match[0]);
    if (!imageTags.length) return full;
    const nonImageContent = String(inner)
      .replace(/<img\b[^>]*>/gi, '')
      .replace(/<br\s*\/?>/gi, '')
      .replace(/&nbsp;?/gi, ' ')
      .replace(/\s+/g, '')
      .trim();
    if (nonImageContent) return full;
    const images = imageTags.map((tag) => imageTagToMarkdown(tag, context)).filter(Boolean);
    if (!images.length) return '\n\n';
    if (images.length === 1) return `\n\n${images[0]}\n\n`;
    return `\n\n::moire-gallery\n${images.join('\n')}\n::\n\n`;
  });
}

function imageTagToMarkdown(tag, context) {
  const match = String(tag || '').match(/<img\b[^>]*\bsrc=(["'])(data:image\/([^;]+);base64,([\s\S]*?))\1[^>]*>/i);
  if (!match) return '';
  const mime = match[3];
  const base64 = match[4];
  const normalizedBase64 = String(base64).replace(/\s+/g, '');
  const buffer = Buffer.from(normalizedBase64, 'base64');
  const ext = extensionForImage(mime, buffer);
  const hash = createHash('sha1').update(buffer).digest('hex').slice(0, 32);
  const filePath = resolve(contentDir, 'media', `${hash}.${ext}`);
  writeManagedFile(filePath, buffer, 'media');
  const href = relative(dirname(context.sourcePath), filePath).replaceAll('\\', '/');
  report.media.push({ noteId: context.noteId, href, bytes: buffer.length });
  return `![](${href})`;
}

function convertLists(html) {
  const source = String(html || '');
  const tokenPattern = /<ul\b[^>]*>|<\/ul>|<ol\b[^>]*>|<\/ol>|<li\b[^>]*>([\s\S]*?)<\/li>/gi;
  let output = '';
  let cursor = 0;
  let depth = 0;
  let match;

  while ((match = tokenPattern.exec(source)) !== null) {
    output += source.slice(cursor, match.index);
    const token = match[0].toLowerCase();
    if (token.startsWith('<ul') || token.startsWith('<ol')) {
      depth += 1;
    } else if (token.startsWith('</ul') || token.startsWith('</ol')) {
      depth = Math.max(0, depth - 1);
    } else {
      const body = listItemText(match[1]);
      if (body) {
        const indent = '  '.repeat(Math.max(0, depth - 1));
        output += `\n${indent}- ${body}`;
      }
    }
    cursor = match.index + match[0].length;
  }

  output += source.slice(cursor);
  return output;
}

function listItemText(html) {
  return normalizeInlineMarkdownSyntax(decodeEntities(stripTags(String(html || '')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/?div\b[^>]*>/gi, ' ')))
    .replace(/\s+/g, ' ')
    .trim());
}

function normalizeInlineMarkdownSyntax(value) {
  return String(value || '')
    .replace(/\*\*([^*\n]+)\*\*\*\*([^*\n]+)\*\*/g, '**$1$2**')
    .replace(/\*\{4,}/g, '');
}

function convertMonoBlocks(html) {
  const lines = [];
  const divPattern = /<div\b[^>]*>([\s\S]*?)<\/div>/gi;
  let output = '';
  let cursor = 0;
  let match;
  while ((match = divPattern.exec(html)) !== null) {
    const before = html.slice(cursor, match.index);
    const divHtml = match[0];
    const inner = match[1];
    const monoLine = monoOnlyLine(inner);
    if (monoLine === null) {
      output += flushMonoLines(lines);
      output += before + divHtml;
    } else {
      if (hasBlockSeparator(before)) output += flushMonoLines(lines);
      output += before;
      lines.push(monoLine);
    }
    cursor = match.index + divHtml.length;
  }
  output += flushMonoLines(lines);
  output += html.slice(cursor);
  return output;
}

function hasBlockSeparator(html) {
  return /<(?:ul|ol|li|h[1-6]|table)\b/i.test(String(html || ''));
}

function flushMonoLines(lines) {
  if (!lines.length) return '';
  const code = lines.splice(0, lines.length).join('\n');
  return `\n\n\`\`\`\n${code}\n\`\`\`\n\n`;
}

function monoOnlyLine(innerHtml) {
  const value = String(innerHtml || '');
  const isMono = /<tt\b|<font\b[^>]*face=(["'])?[^"'>]*Courier/i.test(value);
  if (!isMono) return null;
  const outsideMono = value
    .replace(/<font\b[^>]*face=(["'])?[^"'>]*Courier[^>]*>[\s\S]*?<\/font>/gi, '')
    .replace(/<tt\b[^>]*>[\s\S]*?<\/tt>/gi, '');
  if (inlineText(outsideMono)) return null;
  const withoutLineBreaks = value.replace(/<br\s*\/?>/gi, '');
  const text = decodeEntities(stripTags(withoutLineBreaks)).replace(/\u00a0/g, ' ');
  return text.trimEnd();
}

function convertInlineMono(html) {
  return String(html || '')
    .replace(/<tt\b[^>]*>([\s\S]*?)<\/tt>/gi, (_, body) => inlineCode(body))
    .replace(/<font\b[^>]*face=(["'])?[^"'>]*Courier[^>]*>([\s\S]*?)<\/font>/gi, (_, _quote, body) => inlineCode(body));
}

function inlineCode(html) {
  const code = decodeEntities(stripTags(String(html || ''))).replace(/\s+/g, ' ').trim();
  if (!code) return '';
  return `\`${code.replace(/`/g, '\\`')}\``;
}

function tableToMarkdown(tableHtml) {
  const rows = htmlTableRows(tableHtml);
  if (!rows.length || !rows[0].length) return '\n\n';
  const width = Math.max(...rows.map((row) => row.length));
  const normalized = rows.map((row) => [...row, ...Array(width - row.length).fill('')]);
  const header = normalized[0];
  const body = normalized.slice(1);
  return `\n\n| ${header.map(escapeTableCell).join(' | ')} |\n| ${header.map(() => '---').join(' | ')} |\n${body.map((row) => `| ${row.map(escapeTableCell).join(' | ')} |`).join('\n')}\n\n`;
}

function htmlTableRows(tableHtml) {
  return [...String(tableHtml || '').matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)]
    .map((row) => [...row[1].matchAll(/<t[hd]\b[^>]*>([\s\S]*?)<\/t[hd]>/gi)].map((cell) => inlineText(cell[1])))
    .filter((row) => row.length);
}

function extractPublicSectionSlugs(rootHtml, availableSections) {
  const allowed = new Set();
  const tables = [...String(rootHtml || '').matchAll(/<table\b[\s\S]*?<\/table>/gi)].map((match) => match[0]);
  for (const table of tables) {
    const rows = htmlTableRows(table);
    if (rows.length < 2) continue;
    const header = rows[0].map((cell) => normalizeKey(cell));
    const menuIndex = header.indexOf('menu');
    const urlIndex = header.indexOf('url');
    if (menuIndex === -1 || urlIndex === -1) continue;
    for (const row of rows.slice(1)) {
      const url = String(row[urlIndex] || '').trim();
      const match = url.match(/^\/([^/?#]+)/);
      if (!match) continue;
      const slug = slugify(match[1]);
      if ([...availableSections.values()].includes(slug)) {
        allowed.add(slug);
      }
    }
  }
  return allowed;
}

function inlineText(html) {
  return decodeEntities(stripTags(String(html || ''))).replace(/\s+/g, ' ').trim();
}

function inlineFormattingText(html) {
  const source = String(html || '');
  const value = decodeEntities(stripTags(source)).replace(/\u00a0/g, ' ');
  if (!value.trim()) return /<br\b/i.test(source) ? '' : (value ? ' ' : '');
  return value.replace(/\s+/g, ' ').trim();
}

function stripTags(value) {
  return value.replace(/<[^>]+>/g, '');
}

function decodeEntities(value) {
  return value
    .replace(/&nbsp;?/gi, ' ')
    .replace(/&amp;?/gi, '&')
    .replace(/&lt;?/gi, '<')
    .replace(/&gt;?/gi, '>')
    .replace(/&quot;?/gi, '"')
    .replace(/&#39;?|&apos;?/gi, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([\da-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)));
}

function frontmatter({ title, created, updated }) {
  const lines = ['---'];
  if (title) lines.push(`title: ${yamlString(title)}`);
  if (created) lines.push(`created: ${dateOnly(created)}`);
  if (updated) lines.push(`updated: ${dateOnly(updated)}`);
  lines.push('---', '');
  return `${lines.join('\n')}\n`;
}

function titleForIndex(sectionSlug, fallback) {
  if (!sectionSlug) return siteConfig.site?.title || fallback;
  for (const [name, slug] of sectionSlugs.entries()) {
    if (slug === sectionSlug) return name;
  }
  return fallback;
}

function normalizeMarkdownBody(markdown, noteName) {
  let value = String(markdown || '').replace(/^\uFEFF/, '').trim();
  value = value
    .split(/\r?\n/)
    .map((line) => {
      const heading = line.match(/^\s*\*\*(#{1,6}\s+.*?)\*\*\s*$/);
      return heading ? heading[1] : line;
    })
    .join('\n');

  const escapedName = escapeRegExp(String(noteName || '').trim());
  if (escapedName) {
    const titlePatterns = [
      new RegExp(`^#{1,6}\\s+${escapedName}\\s*\\n+`, 'iu'),
      new RegExp(`^\\*\\*#{1,6}\\s+${escapedName}\\*\\*\\s*\\n+`, 'iu'),
      new RegExp(`^\\*\\*${escapedName}\\*\\*\\s*\\n+`, 'iu')
    ];
    let changed = true;
    while (changed) {
      changed = false;
      for (const pattern of titlePatterns) {
        if (pattern.test(value)) {
          value = value.replace(pattern, '').trimStart();
          changed = true;
        }
      }
    }
  }

  value = value.replace(/^(?:#\s*\n+)+/, '');
  value = value.replace(/\n{3,}/g, '\n\n');
  return value;
}

function normalizeRootIndexMarkdown(markdown) {
  const lines = String(markdown || '').split(/\r?\n/);
  const output = [];
  for (let index = 0; index < lines.length; index += 1) {
    const header = splitMarkdownTableRow(lines[index]);
    const delimiter = splitMarkdownTableRow(lines[index + 1] || '');
    const normalizedHeader = header?.map((cell) => cell.trim().toLowerCase().replace(/[^a-z]/g, ''));
    const isMenuTable = normalizedHeader?.includes('menu') && normalizedHeader.some((cell) => cell === 'url' || cell === 'link');
    if (!isMenuTable || !delimiter) {
      output.push(lines[index]);
      continue;
    }

    const typeIndex = normalizedHeader.indexOf('type');
    output.push(lines[index]);
    output.push(lines[index + 1]);
    index += 2;
    while (index < lines.length) {
      const row = splitMarkdownTableRow(lines[index]);
      if (!row || row.length !== header.length) {
        index -= 1;
        break;
      }
      if (typeIndex !== -1) row[typeIndex] = '';
      output.push(`| ${row.join(' | ')} |`);
      index += 1;
    }
  }
  return output.join('\n');
}

function splitMarkdownTableRow(line) {
  const trimmed = String(line || '').trim();
  if (!trimmed.includes('|')) return null;
  const inner = trimmed.replace(/^\|/, '').replace(/\|$/, '');
  return inner.split('|').map((cell) => cell.trim());
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function dateOnly(value) {
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? '' : date.toISOString().slice(0, 10);
}

function yamlString(value) {
  return JSON.stringify(String(value));
}

function stableId(note) {
  return String(note.id || note.name).replace(/[^A-Za-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '') || 'note';
}

function rootFingerprint(root) {
  return createHash('sha256')
    .update(String(root?.id || root?.name || 'moire-public-root'))
    .digest('hex');
}

function writeManagedFile(filePath, content, kind) {
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, content);
  const buffer = Buffer.isBuffer(content) ? content : Buffer.from(String(content));
  const path = relative(contentDir, filePath).replaceAll('\\', '/');
  const digest = createHash('sha256').update(buffer).digest('hex');
  const key = path.normalize('NFC').toLocaleLowerCase();
  const existing = generatedFiles.get(key);
  if (existing && (existing.kind !== kind || existing.digest !== digest || existing.path !== path)) {
    throw new Error(`Generated file collision: ${existing.path} and ${path}`);
  }
  generatedFiles.set(key, { path, kind, digest });
}

function slugify(value) {
  const normalized = String(value || '')
    .normalize('NFKC')
    .trim()
    .replace(/([\p{Ll}\p{Nd}])(\p{Lu}+)/gu, '$1-$2')
    .toLowerCase()
    .replace(/^_+/, '')
    .replace(/[^\p{Letter}\p{Number}]+/gu, '-')
    .replace(/^-+|-+$/g, '');
  return normalized || 'untitled';
}

function normalizedTitle(value) {
  return String(value || '').trim().toLowerCase();
}

function normalizeKey(value) {
  return String(value || '').trim().toLowerCase().replace(/[^a-z]/g, '');
}

function isDraft(value) {
  return String(value || '').trim().startsWith('_');
}

function escapeTableCell(value) {
  return String(value).replace(/\|/g, '\\|').replace(/\n+/g, '<br>');
}

function safeHref(href) {
  return /^(https?:\/\/|mailto:|\/|\.\/|\.\.\/)/i.test(String(href || ''));
}

function extensionForImage(mime, buffer) {
  return extensionForSignature(buffer) || extensionForMime(mime);
}

function extensionForSignature(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 12) return '';
  if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'jpg';
  if (buffer.subarray(0, 6).toString('ascii').startsWith('GIF8')) return 'gif';
  if (buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP') return 'webp';
  if (buffer.subarray(4, 8).toString('ascii') === 'ftyp') {
    const brandText = buffer.subarray(8, Math.min(buffer.length, 64)).toString('ascii');
    if (/avif|avis/.test(brandText)) return 'avif';
    if (/heic|heix|hevc|hevx|mif1|msf1/.test(brandText)) return 'heic';
  }
  return '';
}

function extensionForMime(mime) {
  const value = String(mime || '').toLowerCase();
  if (value.includes('avif')) return 'avif';
  if (value.includes('heic') || value.includes('heif')) return 'heic';
  if (value.includes('jpeg') || value.includes('jpg')) return 'jpg';
  if (value.includes('gif')) return 'gif';
  if (value.includes('webp')) return 'webp';
  if (value.includes('svg')) return 'svg';
  return 'png';
}
