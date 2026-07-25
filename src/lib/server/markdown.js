import { Marked, Renderer } from 'marked';
import { isSafeLinkHref } from './safe-link.js';

/**
 * @typedef {{ depth: number, id: string, text: string }} TableOfContentsEntry
 * @typedef {{
 *   sourcePath: string,
 *   resolveImageHref: (href: string) => string,
 *   resolveRootHref: (href: string) => string,
 *   showTableOfContents: boolean
 * }} RenderMarkdownOptions
 */

/** @param {string} value */
function escapeHtml(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

/**
 * Heading anchors deliberately contain only Unicode letters/numbers and `-`.
 * Keeping non-Latin scripts makes Chinese headings readable while excluding
 * characters that could escape an HTML attribute or be interpreted as a URL.
 *
 * @param {string} value
 */
function headingSlug(value) {
  return value
    .normalize('NFKC')
    .toLowerCase()
    .replace(/\p{Mark}+/gu, '')
    .replace(/[^\p{Letter}\p{Number}]+/gu, '-')
    .replace(/^-+|-+$/g, '') || 'section';
}

/**
 * @param {unknown[]} tokens
 * @returns {string}
 */
function plainTextFromTokens(tokens) {
  return tokens.map((token) => {
    if (!token || typeof token !== 'object') return '';
    const candidate = /** @type {{ type?: string, text?: string, tokens?: unknown[] }} */ (token);
    if (candidate.type === 'br') return ' ';
    if (Array.isArray(candidate.tokens)) return plainTextFromTokens(candidate.tokens);
    return typeof candidate.text === 'string' ? candidate.text : '';
  }).join('');
}

/**
 * @param {string} label
 */
function normalizeFootnoteLabel(label) {
  return label.normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase();
}

/**
 * Extract footnote definitions before Marked can interpret them as ordinary
 * reference links. Definitions in fenced code blocks remain untouched.
 * Continuation paragraphs follow the usual four-space/tab indentation rule.
 *
 * @param {string} markdown
 * @param {string} sourcePath
 */
function extractFootnoteDefinitions(markdown, sourcePath) {
  const lines = markdown.split(/\r?\n/);
  const removed = new Set();
  /** @type {Map<string, string>} */
  const definitions = new Map();
  let fence = /** @type {{ marker: string, length: number } | null} */ (null);

  for (let index = 0; index < lines.length; index += 1) {
    const fenceMatch = lines[index].match(/^\s{0,3}(`{3,}|~{3,})/);
    if (fenceMatch) {
      const marker = fenceMatch[1][0];
      if (fence?.marker === marker && fenceMatch[1].length >= fence.length) fence = null;
      else if (!fence) fence = { marker, length: fenceMatch[1].length };
      continue;
    }
    if (fence) continue;

    const definition = lines[index].match(/^\s{0,3}\[\^([^\]\r\n]+)\]:[ \t]*(.*)$/);
    if (!definition) continue;
    const label = normalizeFootnoteLabel(definition[1]);
    if (!label) continue;
    if (definitions.has(label)) {
      throw new Error(`Duplicate footnote definition [^${definition[1]}] in ${sourcePath}`);
    }

    const body = [definition[2]];
    removed.add(index);
    let cursor = index + 1;
    while (cursor < lines.length) {
      const continuation = lines[cursor].match(/^(?: {4}|\t)(.*)$/);
      if (continuation) {
        body.push(continuation[1]);
        removed.add(cursor);
        cursor += 1;
        continue;
      }

      if (/^\s*$/.test(lines[cursor])) {
        const next = lines[cursor + 1];
        if (next !== undefined && /^(?: {4}|\t)/.test(next)) {
          body.push('');
          removed.add(cursor);
          cursor += 1;
          continue;
        }
      }
      break;
    }

    definitions.set(label, body.join('\n').trim());
    index = cursor - 1;
  }

  return {
    markdown: lines.filter((_, index) => !removed.has(index)).join('\n'),
    definitions
  };
}

/**
 * @param {RenderMarkdownOptions} options
 * @param {(text: string) => string} nextHeadingId
 * @param {TableOfContentsEntry[] | null} headings
 */
function createRenderer(options, nextHeadingId, headings) {
  const renderer = new Renderer();
  const renderImage = renderer.image;
  const renderLink = renderer.link;

  renderer.image = function (token) {
    const href = options.resolveImageHref(token.href);
    if (!href) return '';
    return renderImage.call(this, { ...token, href });
  };

  renderer.link = function (token) {
    if (!isSafeLinkHref(token.href)) return this.parser.parseInline(token.tokens);
    const href = token.href.startsWith('/') ? options.resolveRootHref(token.href) : token.href;
    return renderLink.call(this, { ...token, href });
  };

  renderer.heading = function (token) {
    const text = plainTextFromTokens(token.tokens);
    const id = nextHeadingId(text);
    if (headings && token.depth >= 2) headings.push({ depth: token.depth, id, text });
    return `<h${token.depth} id="${escapeHtml(id)}">${this.parser.parseInline(token.tokens)}</h${token.depth}>\n`;
  };

  renderer.html = (token) => escapeHtml(token.text);
  return renderer;
}

/**
 * @param {TableOfContentsEntry[]} entries
 */
export function renderTableOfContents(entries) {
  if (!entries.length) return '';

  /** @typedef {{ entry: TableOfContentsEntry | null, children: TocNode[] }} TocNode */
  /** @type {TocNode} */
  const root = { entry: null, children: [] };
  /** @type {{ depth: number, node: TocNode }[]} */
  const stack = [{ depth: 1, node: root }];

  for (const entry of entries) {
    while (stack.length > 1 && stack[stack.length - 1].depth >= entry.depth) stack.pop();
    const node = { entry, children: [] };
    stack[stack.length - 1].node.children.push(node);
    stack.push({ depth: entry.depth, node });
  }

  /**
   * @param {TocNode[]} nodes
   * @returns {string}
   */
  const renderNodes = (nodes) => `<ol>${nodes.map((node) => {
    if (!node.entry) return '';
    const children = /** @type {string} */ (node.children.length ? renderNodes(node.children) : '');
    return `<li><a href="#${escapeHtml(node.entry.id)}">${escapeHtml(node.entry.text)}</a>${children}</li>`;
  }).join('')}</ol>`;

  return `<nav class="table-of-contents" aria-label="Table of contents"><p class="table-of-contents-title">On this page</p>${renderNodes(root.children)}</nav>`;
}

/**
 * @param {Map<string, string>} definitions
 * @param {RenderMarkdownOptions} options
 * @param {(text: string) => string} nextHeadingId
 */
function createFootnoteState(definitions, options, nextHeadingId) {
  /** @type {string[]} */
  const labels = [];
  /** @type {Map<string, string[]>} */
  const referenceIds = new Map();

  return {
    /** @param {string} rawLabel */
    reference(rawLabel) {
      const label = normalizeFootnoteLabel(rawLabel);
      if (!definitions.has(label)) return null;
      let number = labels.indexOf(label) + 1;
      if (!number) {
        labels.push(label);
        number = labels.length;
      }
      const references = referenceIds.get(label) ?? [];
      const occurrence = references.length + 1;
      // Colons cannot be emitted by headingSlug(), so the two anchor
      // namespaces cannot collide even when a note is titled "fn 1".
      const referenceId = `moire:fnref:${number}:${occurrence}`;
      references.push(referenceId);
      referenceIds.set(label, references);
      return `<sup class="footnote-ref" id="${referenceId}"><a href="#moire:fn:${number}" aria-label="Footnote ${number}">${number}</a></sup>`;
    },

    render() {
      if (!labels.length) return '';
      const items = labels.map((label, labelIndex) => {
        const number = labelIndex + 1;
        const definition = definitions.get(label) ?? '';
        const definitionRenderer = createRenderer(options, nextHeadingId, null);
        const marked = new Marked({ breaks: true, gfm: true, renderer: definitionRenderer });
        const body = String(marked.parse(definition));
        const backlinks = (referenceIds.get(label) ?? []).map((referenceId, referenceIndex) => {
          const suffix = referenceIndex ? ` (${referenceIndex + 1})` : '';
          return `<a class="footnote-backref" href="#${referenceId}" aria-label="Back to footnote ${number} reference${suffix}">↩</a>`;
        }).join(' ');
        return `<li id="moire:fn:${number}">${body}<span class="footnote-backlinks">${backlinks}</span></li>`;
      }).join('');
      return `<section class="footnotes" aria-label="Footnotes"><hr><ol>${items}</ol></section>`;
    }
  };
}

/**
 * Render one complete content document while preserving Moire's existing link,
 * image and raw-HTML safety boundaries.
 *
 * @param {string} markdown
 * @param {RenderMarkdownOptions} options
 */
export function renderMarkdownDocument(markdown, options) {
  const { markdown: body, definitions } = extractFootnoteDefinitions(markdown, options.sourcePath);
  /** @type {TableOfContentsEntry[]} */
  const headings = [];
  const headingCounts = new Map();
  /** @param {string} text */
  const nextHeadingId = (text) => {
    const slug = headingSlug(text);
    const count = (headingCounts.get(slug) ?? 0) + 1;
    headingCounts.set(slug, count);
    return count === 1 ? slug : `${slug}-${count}`;
  };

  const footnotes = createFootnoteState(definitions, options, nextHeadingId);
  const renderer = createRenderer(options, nextHeadingId, headings);
  const marked = new Marked({ breaks: true, gfm: true, renderer });
  marked.use({
    extensions: [
      {
        name: 'footnoteReference',
        level: 'inline',
        start(source) {
          const index = source.indexOf('[^');
          return index === -1 ? undefined : index;
        },
        tokenizer(source) {
          const match = source.match(/^\[\^([^\]\r\n]+)\]/);
          if (!match || !definitions.has(normalizeFootnoteLabel(match[1]))) return undefined;
          return { type: 'footnoteReference', raw: match[0], label: match[1] };
        },
        renderer(token) {
          return footnotes.reference(String(token.label)) ?? escapeHtml(token.raw);
        }
      }
    ]
  });

  const html = String(marked.parse(body));
  const toc = options.showTableOfContents ? renderTableOfContents(headings) : '';
  return `${toc}${html}${footnotes.render()}`;
}
