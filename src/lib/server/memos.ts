
import { marked, Renderer } from 'marked';
import { config } from '../../../moire.config';

export type Memo = {
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  date: Date;
  tags: string[];
};

const FRONTMATTER_PATTERN = /^---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/;
const TITLE_MAX_LENGTH = 160;
const EXCERPT_MAX_LENGTH = 240;
const TAG_PATTERN = /(^|\s)#([^\s#.,!?;:()\[\]"']+)/g;
const VOID_HTML_ELEMENTS = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr'
]);

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[character] ?? character);
}

function renderMarkdownWithTags(markdown: string): { html: string; tags: string[] } {
  const tags = new Set<string>();
  let suppressTags = 0;
  let rawHtmlDepth = 0;
  const renderer = new Renderer();
  const defaultText = renderer.text;
  const defaultLink = renderer.link;
  const defaultHtml = renderer.html;

  const renderText = function (this: Renderer, token: Parameters<Renderer['text']>[0]): string {
    if (suppressTags > 0 || rawHtmlDepth > 0 || token.type === 'escape') {
      return defaultText.call(this, token);
    }

    const source = token.text;
    const escaped = 'escaped' in token ? token.escaped : false;
    TAG_PATTERN.lastIndex = 0;
    let cursor = 0;
    let output = '';
    let match: RegExpExecArray | null;

    while ((match = TAG_PATTERN.exec(source)) !== null) {
      const tag = match[2];
      output += defaultText.call(this, { type: 'text', raw: source.slice(cursor, match.index), text: source.slice(cursor, match.index), escaped });
      output += defaultText.call(this, { type: 'text', raw: match[1], text: match[1], escaped });
      output += `<button class="tag-link" data-tag="${escapeHtml(tag)}">#${escapeHtml(tag)}</button>`;
      tags.add(tag);
      cursor = TAG_PATTERN.lastIndex;
    }

    if (cursor === 0) return defaultText.call(this, token);
    output += defaultText.call(this, { type: 'text', raw: source.slice(cursor), text: source.slice(cursor), escaped });
    return output;
  };

  renderer.text = renderText;
  renderer.link = function (token) {
    suppressTags += 1;
    try {
      return defaultLink.call(this, token);
    } finally {
      suppressTags -= 1;
    }
  };
  renderer.html = function (token) {
    const html = token.text;
    const result = defaultHtml.call(this, token);
    const tagPattern = /<\/?([a-z][\w:-]*)(?:\s[^>]*)?>/gi;
    let match: RegExpExecArray | null;
    while ((match = tagPattern.exec(html)) !== null) {
      const isClosing = match[0].startsWith('</');
      const isSelfClosing = /\/\s*>$/.test(match[0]);
      const tagName = match[1].toLowerCase();
      if (isClosing) {
        rawHtmlDepth = Math.max(0, rawHtmlDepth - 1);
      } else if (!isSelfClosing && !VOID_HTML_ELEMENTS.has(tagName)) {
        rawHtmlDepth += 1;
      }
    }
    return result;
  };

  return {
    html: marked.parse(markdown, { renderer }) as string,
    tags: [...tags]
  };
}

function decodeHtmlEntities(value: string): string {
  const namedEntities: Record<string, string> = {
    amp: '&',
    apos: "'",
    gt: '>',
    lt: '<',
    nbsp: ' ',
    quot: '"'
  };

  return value.replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (entity, code: string) => {
    if (code.startsWith('#x')) {
      const codePoint = Number.parseInt(code.slice(2), 16);
      return Number.isNaN(codePoint) ? entity : String.fromCodePoint(codePoint);
    }

    if (code.startsWith('#')) {
      const codePoint = Number.parseInt(code.slice(1), 10);
      return Number.isNaN(codePoint) ? entity : String.fromCodePoint(codePoint);
    }

    return namedEntities[code.toLowerCase()] ?? entity;
  });
}

function markdownToPlainText(markdown: string): string {
  return decodeHtmlEntities(
    markdown
      .replace(/<!--[\s\S]*?-->/g, ' ')
      .replace(/```[^\n]*\n?/g, ' ')
      .replace(/~~~[^\n]*\n?/g, ' ')
      .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
      .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
      .replace(/\[([^\]]+)\]\[[^\]]*\]/g, '$1')
      .replace(/^\s{0,3}(?:#{1,6}\s+|>\s*|[-+*]\s+|\d+[.)]\s+)/gm, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/[`*_~]/g, '')
      .replace(/\\([\\`*{}\[\]()#+\-.!_>])/g, '$1')
      .replace(/\s+/g, ' ')
      .trim()
  );
}

function truncate(value: string, maxLength: number): string {
  const characters = Array.from(value);
  if (characters.length <= maxLength) return value;
  return `${ characters.slice(0, maxLength - 1).join('').trimEnd() }…`;
}

function parseFrontmatterValue(frontmatter: string, key: string): string | null {
  const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = frontmatter.match(new RegExp(`^${ escapedKey }[ \\t]*:[ \\t]*(.*)$`, 'mi'));
  if (!match) return null;

  const value = match[1].trim();
  if (!value) return null;

  if (value.startsWith('"') && value.endsWith('"')) {
    try {
      const parsed = JSON.parse(value);
      return typeof parsed === 'string' ? parsed : value.slice(1, -1);
    } catch {
      return value.slice(1, -1);
    }
  }

  if (value.startsWith("'") && value.endsWith("'")) {
    return value.slice(1, -1).replace(/''/g, "'");
  }

  return value;
}

function deriveTitle(markdown: string, frontmatterTitle: string | null, slug: string): string {
  const explicitTitle = frontmatterTitle ? markdownToPlainText(frontmatterTitle) : '';
  if (explicitTitle) return truncate(explicitTitle, TITLE_MAX_LENGTH);

  for (const paragraph of markdown.split(/\r?\n\s*\r?\n/)) {
    const candidate = markdownToPlainText(paragraph);
    if (candidate) return truncate(candidate, TITLE_MAX_LENGTH);
  }

  return slug;
}

function deriveExcerpt(markdown: string, title: string): string {
  const plainText = markdownToPlainText(markdown);
  return truncate(plainText || title, EXCERPT_MAX_LENGTH);
}

export function removeLeadingTitleBlock(html: string, title: string): string {
  const leadingBlock = html.match(/^\s*<(p|h[1-6])(?:\s[^>]*)?>([\s\S]*?)<\/\1>\s*/i);
  if (!leadingBlock) return html;

  const leadingText = markdownToPlainText(leadingBlock[2]);
  return leadingText === title ? html.slice(leadingBlock[0].length) : html;
}

export function removeLeadingTagBlock(html: string): string {
  return html.replace(
    /^\s*<p>(?:\s*<button class="tag-link" data-tag="[^"]+">#[^<]+<\/button>\s*)+<\/p>\s*/i,
    ''
  );
}

function parseDate(value: string | null): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

let memoPromise: Promise<Memo[]> | null = null;

async function loadMemos(): Promise<Memo[]> {
  const memoModules = import.meta.glob('/src/memos/**/*.md', { query: '?raw', import: 'default', eager: true });
  const assetModules = import.meta.glob('/src/memos/**/*.{png,jpg,jpeg,gif,webp}', { eager: true });

  const memos: Memo[] = await Promise.all(
    Object.entries(memoModules).map(async ([path, rawContent]) => {
      const slug = path.split('/').pop()?.replace('.md', '') || 'unknown';

      let markdownString = rawContent as string;

      const resolveAssets = (markdown: string, memoPath: string) => {
        return markdown.replace(/!\[(.*?)\]\((.*?)\)/g, (match, alt, distinctUrl) => {
          let assetKeyLink = '';

          if (!distinctUrl.startsWith('http') && !distinctUrl.startsWith('/')) {
            const memoDir = memoPath.substring(0, memoPath.lastIndexOf('/'));
            let assetPath = `${ memoDir }/${ distinctUrl }`;
            assetPath = assetPath.replace('/./', '/');
            // Simple normalization for ../
            const parts = assetPath.split('/');
            const stack = [];
            for (const part of parts) {
              if (part === '..') stack.pop();
              else if (part !== '.') stack.push(part);
            }
            assetKeyLink = stack.join('/');
          }

          if (assetKeyLink) {
            const assetModule = assetModules[assetKeyLink] as { default: string } | string;
            const assetUrl = assetModule && typeof assetModule === 'object' ? assetModule.default : assetModule;

            if (assetUrl) {
              const normalizedAssetUrl = assetUrl.startsWith('/') ? `.${ assetUrl }` : assetUrl;
              return `![${ alt }](${ normalizedAssetUrl })`;
            }
          }

          return match;
        });
      };

      const fmMatch = markdownString.match(FRONTMATTER_PATTERN);
      let created: Date | null = null;
      let modified: Date | null = null;
      let frontmatterTitle: string | null = null;

      if (fmMatch) {
        const fm = fmMatch[1];
        markdownString = markdownString.replace(FRONTMATTER_PATTERN, '').trim();

        created = parseDate(parseFrontmatterValue(fm, 'created'));
        modified = parseDate(parseFrontmatterValue(fm, 'modified') ?? parseFrontmatterValue(fm, 'updated'));
        frontmatterTitle = parseFrontmatterValue(fm, 'title');
      }

      const title = deriveTitle(markdownString, frontmatterTitle, slug);
      const excerpt = deriveExcerpt(markdownString, title);

      let markdown = resolveAssets(markdownString, path);

      const rendered = renderMarkdownWithTags(markdown);
      const htmlContent = rendered.html;

      let date = new Date();

      const filenameDate = (() => {
        const match = slug.match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})$/);
        if (match) {
          const year = match[1];
          const month = match[2];
          const day = match[3];
          const hour = match[4];
          const minute = match[5];
          const second = match[6];

          const isoString = `${ year }-${ month }-${ day }T${ hour }:${ minute }:${ second }Z`;
          return new Date(isoString);
        }
        return null;
      })();

      if (config.order_by === 'modified') {
        date = modified || created || filenameDate || new Date();
      } else {
        date = created || filenameDate || new Date();
      }

      return {
        slug,
        title,
        excerpt,
        content: htmlContent,
        date,
        tags: rendered.tags
      };
    })
  );

  memos.sort((a, b) => b.date.getTime() - a.date.getTime());

  return memos;
}

export function getMemos(): Promise<Memo[]> {
  memoPromise ??= loadMemos();
  return memoPromise;
}

/**
 * The classic homepage renders only memo titles. Keep the list metadata used
 * by the page-level SEO schema and the full Memo shape for alternate themes,
 * but omit rendered HTML from the classic page payload.
 */
export async function getHomepageMemos(): Promise<Memo[]> {
  const memos = await getMemos();
  if (config.theme !== 'classic') return memos;
  return memos.map(({ content: _content, ...memo }) => ({ ...memo, content: '' }));
}
