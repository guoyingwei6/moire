import { base } from '$app/paths';
import type {
  ArchiveGroup,
  ContentListingEntry,
  ContentLayout,
  ContentOptions,
  ContentRecord,
  SearchEntry,
  ContentSort,
  ContentSummary,
  TagGroup
} from '$lib/content';
import {
  normalizePropertyName,
  parseBooleanProperty,
  parseIndexNoteConfiguration,
  parseListProperty,
  parseNoteConfiguration
} from '$lib/config/index-note.js';
import {
  isDiscoverable,
  isMenuVisible,
  isUnderscoreDraft,
  nearestExistingParentRoute,
  publicTitle,
  routeFromContentSource
} from '$lib/server/content-policy.js';
import { buildAliasEntries } from '$lib/server/aliases.js';
import { toListingEntry, toSearchEntries } from '$lib/server/content-projection.js';
import { renderMarkdownDocument } from '$lib/server/markdown.js';
import { config } from '../../../moire.config';

const markdownModules = import.meta.glob('/content/**/*.md', {
  query: '?raw',
  import: 'default',
  eager: true
}) as Record<string, string>;

const assetModules = import.meta.glob('/content/**/*.{avif,gif,heic,heif,jpeg,jpg,png,svg,webp}', {
  query: '?url',
  import: 'default',
  eager: true
}) as Record<string, string>;

const responsiveAssetModules = import.meta.glob('/content/responsive-media/*.webp', {
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
  '/search/',
  '/settings/',
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
  hidden: boolean;
  localProperties: Record<string, string>;
};

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
  const heading = body.match(/^\s{0,3}(#{1,6})\s+(.+?)\s*#*\s*(?:\r?\n|$)/);
  if (metadata.title) {
    const headingText = heading?.[2].trim();
    const isPageHeading = heading?.[1].length === 1
      || headingText?.localeCompare(metadata.title, undefined, { sensitivity: 'base' }) === 0;
    return {
      title: metadata.title,
      body: heading && isPageHeading ? body.slice(heading[0].length).trimStart() : body
    };
  }

  if (heading) {
    return { title: heading[2].trim(), body: body.slice(heading[0].length).trimStart() };
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

function searchableText(markdown: string): string {
  return markdown
    .replace(/```[^\r\n]*\r?\n([\s\S]*?)```/g, ' $1 ')
    .replace(/~~~[^\r\n]*\r?\n([\s\S]*?)~~~/g, ' $1 ')
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, ' $1 ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/^\s{0,3}(?:#{1,6}|>|[-+*]|\d+[.)])\s+/gm, '')
    .replace(/[*_~|\[\]]/g, ' ')
    .replace(/\\([\\`*{}\[\]()#+.!_>-])/g, '$1')
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
  if (!assetUrl && /\.(?:heic|heif)$/i.test(assetPath)) return '';
  if (!assetUrl) throw new Error(`Missing local asset ${href} referenced by ${sourcePath}`);
  return assetUrl;
}

function imageAssetPath(href: string, sourcePath: string): string | null {
  if (/^https:/i.test(href) || /^data:/i.test(href) || /^[a-z][a-z\d+.-]*:/i.test(href)) return null;
  if (href.startsWith('/')) return null;
  const cleanHref = href.split(/[?#]/, 1)[0];
  const sourceDirectory = sourcePath.slice(0, sourcePath.lastIndexOf('/'));
  return normalizeSegments(`${sourceDirectory}/${decodeURIComponent(cleanHref)}`);
}

function resolveImageSet(href: string, sourcePath: string): { href: string; src: string; srcset: string; sizes: string } | null {
  const assetPath = imageAssetPath(href, sourcePath);
  if (!assetPath) return null;
  const original = assetModules[assetPath] ?? '';
  const match = assetPath.match(/^\/content\/media\/(.+)\.(jpe?g|png|webp|heic|heif)$/i);
  if (!match) return null;
  const stem = match[1];
  const extension = match[2].toLowerCase();
  const candidates = [640, 960, 1280, 1920]
    .map((width) => {
      const url = responsiveAssetModules[`/content/responsive-media/${stem}-${width}.webp`];
      return url ? { width, url } : null;
    })
    .filter((candidate): candidate is { width: number; url: string } => candidate !== null);
  if (!candidates.length) return null;
  const fallbackHref = extension === 'heic' || extension === 'heif'
    ? candidates[candidates.length - 1].url
    : original;
  if (!fallbackHref) return null;
  return {
    href: fallbackHref,
    src: candidates[0].url,
    srcset: candidates.map((candidate) => `${candidate.url} ${candidate.width}w`).join(', '),
    sizes: '(max-width: 720px) calc(100vw - 2rem), 640px'
  };
}

function buildDrafts(): DraftRecord[] {
  return Object.entries(markdownModules).map(([sourcePath, raw]) => {
    const { metadata, body: rawBody } = parseFrontmatter(raw);
    const noteConfiguration = sourcePath === '/content/index.md'
      ? parseIndexNoteConfiguration(rawBody)
      : parseNoteConfiguration(rawBody);
    const titleMetadata = noteConfiguration.properties.title
      ? { ...metadata, title: noteConfiguration.properties.title }
      : metadata;
    const extracted = extractTitle(noteConfiguration.cleanedMarkdown, titleMetadata, sourcePath);
    const hidden = isUnderscoreDraft(sourcePath, extracted.title);
    const { body, tags: inlineTags } = extractTags(extracted.body);
    const tags = [...new Set([
      ...parseListProperty(noteConfiguration.properties.tags),
      ...inlineTags
    ])];
    const { route, kind } = routeFromContentSource(sourcePath, noteConfiguration.properties.slug);
    const date = noteConfiguration.properties.date ?? metadata.date ?? metadata.created;

    return {
      sourcePath,
      route,
      kind,
      title: publicTitle(extracted.title),
      body,
      created: parseDate(date, sourcePath, 'created'),
      updated: parseDate(metadata.updated ?? metadata.modified, sourcePath, 'updated'),
      tags,
      parentRoute: parentRouteFor(route, kind),
      hidden,
      localProperties: noteConfiguration.properties
    };
  });
}

function implicitSections(drafts: DraftRecord[]): DraftRecord[] {
  const existing = new Set(drafts.map((draft) => draft.route));
  const sections = new Map<string, DraftRecord>();

  for (const draft of drafts) {
    if (draft.hidden) continue;
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
        parentRoute: parentRouteFor(route, 'section'),
        hidden: false,
        localProperties: {}
      });
    }
  }

  return [...sections.values()];
}

const LOCAL_PROPERTIES = new Set([
  'aliases',
  'date',
  'layout',
  'pinned',
  'previewprops',
  'showchildren',
  'showinfooter',
  'showinmenu',
  'shownestednotes',
  'slug',
  'sortby',
  'tags',
  'title'
]);

const SITE_SETTINGS_PROPERTIES = new Set([
  'author',
  'backgroundcolor',
  'description',
  'domain',
  'email',
  'emoji',
  'foldername',
  'github',
  'githubusername',
  'hidearchivelink',
  'hideqrcodelink',
  'hidetagslink',
  'instagram',
  'instagramusername',
  'linkcolor',
  'logoemoji',
  'mastodon',
  'mastodonlink',
  'metadata',
  'previousnext',
  'publicemail',
  'qrcode',
  'rtl',
  'secondarycolor',
  'secondarytextcolor',
  'showarchive',
  'showbreadcrumbs',
  'showfoldername',
  'showfoldernameonthenotespage',
  'showmetadata',
  'shownotefooter',
  'shownotemetadata',
  'shownotenavigation',
  'showpostnavigation',
  'showqrcode',
  'showtags',
  'sitedescription',
  'sitetitle',
  'siteurl',
  'tags',
  'textcolor',
  'twitter',
  'twitterusername',
  'youtube',
  'youtubelink'
]);

function inheritedProperties(
  parent: Record<string, string> | undefined,
  parentRoute: string | undefined
): Record<string, string> {
  if (!parent) return {};
  return Object.fromEntries(Object.entries(parent).filter(([name]) => (
    !LOCAL_PROPERTIES.has(name)
    && !(parentRoute === '/' && SITE_SETTINGS_PROPERTIES.has(name))
  )));
}

function booleanOption(
  properties: Record<string, string>,
  names: string[],
  fallback: boolean,
  sourcePath: string
): boolean {
  for (const name of names) {
    const raw = properties[name];
    if (raw === undefined) continue;
    const value = parseBooleanProperty(raw);
    if (value === null) throw new Error(`Invalid ${name} value in ${sourcePath || 'implicit folder'}: ${raw}`);
    return value;
  }
  return fallback;
}

function sortOption(properties: Record<string, string>, sourcePath: string): ContentSort {
  const raw = properties.sortby?.trim().toLocaleLowerCase();
  if (!raw || ['create', 'created', 'date'].includes(raw)) return 'create';
  if (['update', 'updated', 'modified'].includes(raw)) return 'update';
  if (raw === 'title') return 'title';
  throw new Error(`Invalid sortBy value in ${sourcePath || 'implicit folder'}: ${properties.sortby}`);
}

function layoutOption(properties: Record<string, string>, sourcePath: string): ContentLayout {
  const raw = properties.layout?.trim().toLocaleLowerCase();
  if (!raw) return 'list';
  if (['list', 'timeline', 'feed', 'grid', 'table'].includes(raw)) return raw as ContentLayout;
  throw new Error(`Invalid layout value in ${sourcePath || 'implicit folder'}: ${properties.layout}`);
}

function contentOptions(
  draft: DraftRecord,
  effective: Record<string, string>
): ContentOptions {
  const local = draft.localProperties;
  return {
    pinned: booleanOption(local, ['pinned'], false, draft.sourcePath),
    showInMenu: booleanOption(local, ['showinmenu'], true, draft.sourcePath),
    showInFooter: booleanOption(local, ['showinfooter'], false, draft.sourcePath),
    showChildren: booleanOption(effective, ['showchildren'], draft.kind !== 'home', draft.sourcePath),
    showNestedNotes: booleanOption(effective, ['shownestednotes'], false, draft.sourcePath),
    showBreadcrumbs: booleanOption(effective, ['showbreadcrumbs'], config.features.folderName, draft.sourcePath),
    showNoteNavigation: booleanOption(
      effective,
      ['shownotenavigation', 'showpostnavigation'],
      config.features.previousNext,
      draft.sourcePath
    ),
    showNoteFooter: booleanOption(effective, ['shownotefooter'], config.features.footer, draft.sourcePath),
    showNoteMetadata: booleanOption(effective, ['shownotemetadata'], config.features.metadata, draft.sourcePath),
    sortBy: sortOption(effective, draft.sourcePath),
    layout: layoutOption(effective, draft.sourcePath),
    previewProps: parseListProperty(effective.previewprops).map(normalizePropertyName).filter(Boolean)
  };
}

const searchTextByRoute = new Map<string, string>();

function buildRecords(): ContentRecord[] {
  const drafts = buildDrafts();
  drafts.push(...implicitSections(drafts));
  searchTextByRoute.clear();

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

  const draftsByRoute = new Map(drafts.map((draft) => [draft.route, draft]));
  const effectiveByRoute = new Map<string, Record<string, string>>();

  const effectiveFor = (draft: DraftRecord): Record<string, string> => {
    const existing = effectiveByRoute.get(draft.route);
    if (existing) return existing;
    const parentRoute = nearestExistingParentRoute(draft.parentRoute, draftsByRoute);
    const parent = parentRoute ? draftsByRoute.get(parentRoute) : undefined;
    const effective = {
      ...inheritedProperties(parent ? effectiveFor(parent) : undefined, parent?.route),
      ...draft.localProperties
    };
    effectiveByRoute.set(draft.route, effective);
    return effective;
  };

  return drafts.map((draft) => {
    const wordCount = countWords(draft.body);
    const properties = effectiveFor(draft);
    const showTableOfContents = Boolean(draft.sourcePath) && booleanOption(
      properties,
      ['showtableofcontents'],
      false,
      draft.sourcePath
    );
    searchTextByRoute.set(draft.route, searchableText(draft.body));
    return {
      route: draft.route,
      kind: draft.kind,
      sourcePath: draft.sourcePath || null,
      title: draft.title,
      summary: summarize(draft.body),
      html: draft.sourcePath
        ? renderMarkdownDocument(draft.body, {
            sourcePath: draft.sourcePath,
            resolveImageHref: (href) => resolveAssetHref(href, draft.sourcePath),
            resolveImageSet: (href) => resolveImageSet(href, draft.sourcePath),
            resolveRootHref: hrefWithBase,
            showTableOfContents
          })
        : '',
      created: draft.created,
      updated: draft.updated,
      tags: draft.tags,
      parentRoute: draft.parentRoute,
      hidden: draft.hidden,
      properties,
      options: contentOptions(draft, properties),
      wordCount,
      readingMinutes: Math.max(1, Math.ceil(wordCount / 220))
    };
  });
}

function asSummary(record: ContentRecord): ContentSummary {
  const { html: _html, sourcePath: _sourcePath, wordCount: _wordCount, readingMinutes: _readingMinutes, ...summary } = record;
  return summary;
}

function compareContent(
  sortBy: ContentSort,
  left: ContentRecord | ContentSummary,
  right: ContentRecord | ContentSummary
): number {
  if (left.options.pinned !== right.options.pinned) return left.options.pinned ? -1 : 1;
  if (sortBy === 'title') return left.title.localeCompare(right.title) || left.route.localeCompare(right.route);
  const leftDate = sortBy === 'update' ? left.updated : left.created;
  const rightDate = sortBy === 'update' ? right.updated : right.created;
  return (rightDate ?? '').localeCompare(leftDate ?? '') || left.title.localeCompare(right.title);
}

const records = buildRecords();
const recordsByRoute = new Map(records.map((record) => [record.route, record]));
const aliasEntries = buildAliasEntries(records);
const aliasesByRoute = new Map(aliasEntries.map((entry) => [
  entry.route.normalize('NFC').toLocaleLowerCase(),
  entry.target
]));

function findRecord(route: string): ContentRecord | null {
  const normalized = route === '/' ? '/' : `/${route.split('/').filter(Boolean).join('/')}/`;
  return recordsByRoute.get(normalized) ?? null;
}

export function getHome(): ContentRecord {
  const home = findRecord('/');
  if (!home) throw new Error('Missing required content/index.md home page');
  return home;
}

export function getRecord(route: string): ContentRecord | null {
  return findRecord(route);
}

export function getAliasTarget(route: string): string | null {
  const normalized = route === '/' ? '/' : `/${route.split('/').filter(Boolean).join('/')}/`;
  return aliasesByRoute.get(normalized.normalize('NFC').toLocaleLowerCase()) ?? null;
}

export function getRecordSummary(route: string | null): ContentSummary | null {
  if (!route) return null;
  const record = getRecord(route);
  return record ? asSummary(record) : null;
}

export function getSectionEntries(route: string, layout: ContentLayout = 'list'): ContentListingEntry[] {
  const section = getRecord(route);
  const nested = section?.options.showNestedNotes ?? false;
  return records
    .filter((record) => (
      record.kind !== 'home'
      && isMenuVisible(record)
      && (nested ? record.route.startsWith(route) && record.route !== route : record.parentRoute === route)
    ))
    .sort((left, right) => compareContent(section?.options.sortBy ?? 'create', left, right))
    .map((record) => toListingEntry(record, layout) as ContentListingEntry);
}

export function getSearchEntries(): SearchEntry[] {
  return toSearchEntries(records, searchTextByRoute, hrefWithBase) as SearchEntry[];
}

export function getPostNeighbors(record: ContentRecord): { previous: ContentSummary | null; next: ContentSummary | null } {
  if (record.kind !== 'post' || !record.parentRoute || record.hidden || !record.options.showNoteNavigation) {
    return { previous: null, next: null };
  }
  const parent = getRecord(record.parentRoute);
  const siblings = records
    .filter((candidate) => (
      candidate.kind === 'post'
      && candidate.parentRoute === record.parentRoute
      && isMenuVisible(candidate)
    ))
    .sort((left, right) => compareContent(parent?.options.sortBy ?? 'create', left, right));
  const index = siblings.findIndex((candidate) => candidate.route === record.route);
  return {
    previous: index >= 0 ? (siblings[index + 1] ? asSummary(siblings[index + 1]) : null) : null,
    next: index > 0 ? asSummary(siblings[index - 1]) : null
  };
}

export function getCatchAllEntries(): { path: string }[] {
  return [
    ...records.filter((record) => record.route !== '/').map((record) => record.route),
    ...aliasEntries.map((entry) => entry.route)
  ].map((route) => ({ path: route.split('/').filter(Boolean).join('/') }));
}

export function getPosts(): ContentRecord[] {
  return records
    .filter((record) => record.kind === 'post' && isDiscoverable(record))
    .sort((left, right) => compareContent('create', left, right));
}

export function getFooterEntries(): ContentSummary[] {
  return records
    .filter((record) => record.route !== '/' && isDiscoverable(record) && record.options.showInFooter)
    .sort((left, right) => left.title.localeCompare(right.title))
    .map(asSummary);
}

export function getConfigurationRecords(): ContentSummary[] {
  return records
    .filter((record) => !record.hidden)
    .sort((left, right) => left.route.localeCompare(right.route))
    .map(asSummary);
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
    ...records.filter(isDiscoverable).map((record) => record.route),
    '/tags/',
    ...getTagGroups().map((group) => `/tags/${encodeURIComponent(group.slug)}/`),
    '/archive/',
    '/search/',
    '/settings/',
    '/qr/',
    '/feed.xml',
    '/sitemap.xml'
  ];
}
