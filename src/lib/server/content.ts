import { base } from '$app/paths';
import { Marked, Renderer } from 'marked';
import type { ArchiveGroup, ContentRecord, ContentSummary, TagGroup } from '$lib/content';
import { isSafeLinkHref } from '$lib/server/safe-link.js';

const markdownModules = import.meta.glob('/content/**/*.md', {
  query: '?raw',
  import: 'default',
  eager: true
}) as Record<string, string>;

const assetModules = import.meta.glob('/content/**/*.{avif,gif,jpeg,jpg,png,svg,webp}', {
  query: '?url',
  import: 'default',
  eager: true
}) as Record<string, string>;

const RESERVED_ROUTES = new Set([
  '/archive/',
  '/feed.xml/',
  '/qr/',
  '/robots.txt/',
  '/rss.xml/',
  '/sitemap.xml/',
  '/tags/'
]);

type Frontmatter = Record<string, string>;

type DraftRecord = {
  sourcePath: string;
  route: string;
  kind: ContentRecord['kind'];
  title: string;
  body: string;
  created: string | null;
  updated: string | null;
  tags: string[];
  parentRoute: string | null;
};

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function parseFrontmatter(raw: string): { metadata: Frontmatter; body: string } {
  const match = raw.match(/^---\s*\r?\n([\s\S]*?)\r?\n---\s*(?:\r?\n|$)/);
  if (!match) return { metadata: {}, body: raw.trim() };

  const metadata: Frontmatter = {};
  for (const line of match[1].split(/\r?\n/)) {
    const field = line.match(/^([A-Za-z][\w-]*):\s*(.*?)\s*$/);
    if (!field) continue;
    metadata[field[1].toLowerCase()] = field[2].replace(/^(['"])(.*)\1$/, '$2');
  }

  return { metadata, body: raw.slice(match[0].length).trim() };
}

function parseDate(value: string | undefined, sourcePath: string, field: string): string | null {
  if (!value) return null;
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) {
    throw new Error(`Invalid ${field} date in ${sourcePath}: ${value}`);
  }
  return new Date(timestamp).toISOString();
}

function titleFromFilename(sourcePath: string): string {
  const filename = sourcePath.split('/').pop()?.replace(/\.md$/i, '') || 'Untitled';
  return filename
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function extractTitle(body: string, metadata: Frontmatter, sourcePath: string): { title: string; body: string } {
  if (metadata.title) return { title: metadata.title, body };

  const heading = body.match(/^\s{0,3}#{1,6}\s+(.+?)\s*#*\s*(?:\r?\n|$)/);
  if (heading) {
    return { title: heading[1].trim(), body: body.slice(heading[0].length).trimStart() };
  }

  const bold = body.match(/^\s*\*\*(.+?)\*\*\s*(?:\r?\n|$)/);
  if (bold) {
    return { title: bold[1].trim(), body: body.slice(bold[0].length).trimStart() };
  }

  return { title: titleFromFilename(sourcePath), body };
}

function normalizeSegments(pathname: string): string {
  const stack: string[] = [];
  for (const segment of pathname.split('/')) {
    if (!segment || segment === '.') continue;
    if (segment === '..') {
      if (stack.length <= 1) throw new Error(`Content asset escapes the content folder: ${pathname}`);
      stack.pop();
      continue;
    }
    stack.push(segment);
  }
  return `/${stack.join('/')}`;
}

function routeFromSource(sourcePath: string): { route: string; kind: ContentRecord['kind'] } {
  const relative = sourcePath.replace(/^\/content\//, '').replace(/\.md$/i, '');
  const segments = relative.split('/').filter(Boolean);
  const isIndex = segments.at(-1)?.toLowerCase() === 'index';

  if (isIndex) segments.pop();
  const route = segments.length ? `/${segments.join('/')}/` : '/';
  const kind = route === '/' ? 'home' : isIndex ? 'section' : 'post';
  return { route, kind };
}

function parentRouteFor(route: string, kind: ContentRecord['kind']): string | null {
  if (route === '/') return null;
  const segments = route.split('/').filter(Boolean);
  if (kind === 'post') segments.pop();
  else segments.splice(-1, 1);
  return segments.length ? `/${segments.join('/')}/` : '/';
}

function extractTags(body: string): { body: string; tags: string[] } {
  const tags = new Set<string>();
  let insideFence = false;
  const kept: string[] = [];

  for (const line of body.split(/\r?\n/)) {
    if (/^\s*```/.test(line)) {
      insideFence = !insideFence;
      kept.push(line);
      continue;
    }

    if (!insideFence) {
      const withoutInlineCode = line.replace(/`[^`]*`/g, '');
      for (const match of withoutInlineCode.matchAll(/(?:^|\s)#([\p{L}\p{N}_-]+)/gu)) {
        tags.add(match[1]);
      }
      if (/^\s*(?:#[\p{L}\p{N}_-]+\s*)+$/u.test(line)) continue;
    }

    kept.push(line);
  }

  return { body: kept.join('\n').trim(), tags: [...tags] };
}

function stripMarkdown(markdown: string): string {
  return markdown
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[#>*_~`|\[\]-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function summarize(markdown: string): string {
  const plain = stripMarkdown(markdown);
  if (plain.length <= 160) return plain;
  return `${plain.slice(0, 157).trimEnd()}…`;
}

function countWords(markdown: string): number {
  const plain = stripMarkdown(markdown);
  const latinWords = plain.match(/[A-Za-z0-9]+(?:['’-][A-Za-z0-9]+)*/g)?.length ?? 0;
  const cjkCharacters = plain.match(/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/gu)?.length ?? 0;
  return latinWords + cjkCharacters;
}

function tagSlug(tag: string): string {
  return tag.normalize('NFC').trim().toLocaleLowerCase().replace(/\s+/g, '-');
}

function hrefWithBase(href: string): string {
  if (!href.startsWith('/')) return href;
  return `${base}${href}` || '/';
}

function resolveAssetHref(href: string, sourcePath: string): string {
  if (/^https:/i.test(href)) return href;
  if (/^data:image\/(?:avif|gif|jpeg|png|webp);base64,/i.test(href)) return href;
  if (/^[a-z][a-z\d+.-]*:/i.test(href)) return '';
  if (href.startsWith('/')) return hrefWithBase(href);

  const cleanHref = href.split(/[?#]/, 1)[0];
  const sourceDirectory = sourcePath.slice(0, sourcePath.lastIndexOf('/'));
  const assetPath = normalizeSegments(`${sourceDirectory}/${decodeURIComponent(cleanHref)}`);
  const assetUrl = assetModules[assetPath];
  if (!assetUrl) throw new Error(`Missing local asset ${href} referenced by ${sourcePath}`);
  return assetUrl;
}

function renderMarkdown(markdown: string, sourcePath: string): string {
  const renderer = new Renderer();
  const renderImage = renderer.image;
  const renderLink = renderer.link;

  renderer.image = function (token) {
    const href = resolveAssetHref(token.href, sourcePath);
    if (!href) return '';
    return renderImage.call(this, { ...token, href });
  };

  renderer.link = function (token) {
    if (!isSafeLinkHref(token.href)) {
      return escapeHtml(token.text || token.href);
    }
    const href = token.href.startsWith('/') ? hrefWithBase(token.href) : token.href;
    return renderLink.call(this, { ...token, href });
  };

  renderer.html = (token) => escapeHtml(token.text);

  const marked = new Marked({
    breaks: true,
    gfm: true,
    renderer
  });

  return String(marked.parse(markdown));
}

function buildDrafts(): DraftRecord[] {
  return Object.entries(markdownModules).map(([sourcePath, raw]) => {
    const { metadata, body: rawBody } = parseFrontmatter(raw);
    const { title, body: bodyWithoutTitle } = extractTitle(rawBody, metadata, sourcePath);
    const { body, tags } = extractTags(bodyWithoutTitle);
    const { route, kind } = routeFromSource(sourcePath);

    return {
      sourcePath,
      route,
      kind,
      title,
      body,
      created: parseDate(metadata.created, sourcePath, 'created'),
      updated: parseDate(metadata.updated ?? metadata.modified, sourcePath, 'updated'),
      tags,
      parentRoute: parentRouteFor(route, kind)
    };
  });
}

function implicitSections(drafts: DraftRecord[]): DraftRecord[] {
  const existing = new Set(drafts.map((draft) => draft.route));
  const sections = new Map<string, DraftRecord>();

  for (const draft of drafts) {
    const segments = draft.route.split('/').filter(Boolean);
    if (draft.kind === 'post') segments.pop();
    else if (draft.kind === 'section') segments.splice(-1, 1);

    for (let index = 1; index <= segments.length; index += 1) {
      const route = `/${segments.slice(0, index).join('/')}/`;
      if (existing.has(route) || sections.has(route)) continue;
      const title = segments[index - 1]
        .replace(/[-_]+/g, ' ')
        .replace(/\b\w/g, (character) => character.toUpperCase());
      sections.set(route, {
        sourcePath: '',
        route,
        kind: 'section',
        title,
        body: '',
        created: null,
        updated: null,
        tags: [],
        parentRoute: parentRouteFor(route, 'section')
      });
    }
  }

  return [...sections.values()];
}

function buildRecords(): ContentRecord[] {
  const drafts = buildDrafts();
  drafts.push(...implicitSections(drafts));

  const routes = new Map<string, string>();
  for (const draft of drafts) {
    const normalizedRoute = draft.route.normalize('NFC').toLocaleLowerCase();
    const existing = routes.get(normalizedRoute);
    if (existing) throw new Error(`Duplicate content route ${draft.route}: ${existing} and ${draft.sourcePath}`);
    if (RESERVED_ROUTES.has(draft.route.toLocaleLowerCase())) {
      throw new Error(`Content route is reserved: ${draft.route}`);
    }
    routes.set(normalizedRoute, draft.sourcePath || draft.route);
  }

  return drafts.map((draft) => {
    const wordCount = countWords(draft.body);
    return {
      route: draft.route,
      kind: draft.kind,
      sourcePath: draft.sourcePath || null,
      title: draft.title,
      summary: summarize(draft.body),
      html: draft.sourcePath ? renderMarkdown(draft.body, draft.sourcePath) : '',
      created: draft.created,
      updated: draft.updated,
      tags: draft.tags,
      parentRoute: draft.parentRoute,
      wordCount,
      readingMinutes: Math.max(1, Math.ceil(wordCount / 220))
    };
  });
}

function asSummary(record: ContentRecord): ContentSummary {
  const { html: _html, sourcePath: _sourcePath, wordCount: _wordCount, readingMinutes: _readingMinutes, ...summary } = record;
  return summary;
}

function byNewest(left: ContentRecord | ContentSummary, right: ContentRecord | ContentSummary): number {
  return (right.created ?? '').localeCompare(left.created ?? '') || left.title.localeCompare(right.title);
}

const records = buildRecords();
const recordsByRoute = new Map(records.map((record) => [record.route, record]));

export function getHome(): ContentRecord {
  const home = recordsByRoute.get('/');
  if (!home) throw new Error('Missing required content/index.md home page');
  return home;
}

export function getRecord(route: string): ContentRecord | null {
  const normalized = route === '/' ? '/' : `/${route.split('/').filter(Boolean).join('/')}/`;
  return recordsByRoute.get(normalized) ?? null;
}

export function getRecordSummary(route: string | null): ContentSummary | null {
  if (!route) return null;
  const record = getRecord(route);
  return record ? asSummary(record) : null;
}

export function getSectionEntries(route: string): ContentSummary[] {
  return records
    .filter((record) => record.parentRoute === route && record.kind !== 'home')
    .sort(byNewest)
    .map(asSummary);
}

export function getPostNeighbors(record: ContentRecord): { previous: ContentSummary | null; next: ContentSummary | null } {
  if (record.kind !== 'post' || !record.parentRoute) return { previous: null, next: null };
  const siblings = records
    .filter((candidate) => candidate.kind === 'post' && candidate.parentRoute === record.parentRoute)
    .sort(byNewest);
  const index = siblings.findIndex((candidate) => candidate.route === record.route);
  return {
    previous: index >= 0 ? (siblings[index + 1] ? asSummary(siblings[index + 1]) : null) : null,
    next: index > 0 ? asSummary(siblings[index - 1]) : null
  };
}

export function getCatchAllEntries(): { path: string }[] {
  return records
    .filter((record) => record.route !== '/')
    .map((record) => ({ path: record.route.split('/').filter(Boolean).join('/') }));
}

export function getPosts(): ContentRecord[] {
  return records.filter((record) => record.kind === 'post').sort(byNewest);
}

export function getTagGroups(): TagGroup[] {
  const groups = new Map<string, TagGroup>();
  for (const record of getPosts()) {
    for (const tag of record.tags) {
      const key = tag.normalize('NFC').toLocaleLowerCase();
      const group = groups.get(key) ?? { tag, slug: tagSlug(tag), entries: [] };
      group.entries.push(asSummary(record));
      groups.set(key, group);
    }
  }
  return [...groups.values()].sort((left, right) => right.entries.length - left.entries.length || left.tag.localeCompare(right.tag));
}

export function getTagGroup(slug: string): TagGroup | null {
  return getTagGroups().find((group) => group.slug === slug.normalize('NFC').toLocaleLowerCase()) ?? null;
}

export function getTagEntries(): { tag: string }[] {
  return getTagGroups().map((group) => ({ tag: group.slug }));
}

export function getArchiveGroups(): ArchiveGroup[] {
  const groups = new Map<string, ContentSummary[]>();
  for (const record of getPosts()) {
    const key = record.created?.slice(0, 7) ?? 'undated';
    const entries = groups.get(key) ?? [];
    entries.push(asSummary(record));
    groups.set(key, entries);
  }

  return [...groups.entries()]
    .sort(([left], [right]) => right.localeCompare(left))
    .map(([key, entries]) => ({
      key,
      label: key === 'undated'
        ? 'Undated'
        : new Intl.DateTimeFormat('en', { month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${key}-01T00:00:00Z`)),
      entries
    }));
}

export function getAllPublicRoutes(): string[] {
  return [
    ...records.map((record) => record.route),
    '/tags/',
    ...getTagGroups().map((group) => `/tags/${encodeURIComponent(group.slug)}/`),
    '/archive/',
    '/qr/',
    '/feed.xml',
    '/sitemap.xml'
  ];
}
