
import { marked } from 'marked';
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

      markdown = markdown.replace(
        /(^|\s)#([^\s#.,!?;:()\[\]"']+)/g,
        '$1<button class="tag-link" data-tag="$2">#$2</button>'
      );

      const htmlContent = await marked.parse(markdown);

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

      let tags: string[] = [];
      const tagMatch = markdownString.match(/#([^\s#.,!?;:()\[\]"']+)/g);
      if (tagMatch) {
        tags = tagMatch.map(t => t.slice(1));
        tags = [...new Set(tags)];
      }

      return {
        slug,
        title,
        excerpt,
        content: htmlContent,
        date,
        tags
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
