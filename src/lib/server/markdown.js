import { Marked, Renderer } from 'marked';
import { isSafeLinkHref } from './safe-link.js';

/**
 * @typedef {{ depth: number, id: string, text: string }} TableOfContentsEntry
 * @typedef {{
 *   sourcePath: string,
 *   resolveImageHref: (href: string) => string,
 *   resolveImageSet?: (href: string) => { href: string, src: string, srcset: string, sizes: string } | null,
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
  const renderCode = renderer.code;

  renderer.image = function (token) {
    const responsive = options.resolveImageSet?.(token.href) ?? null;
    if (responsive) {
      const alt = escapeHtml(token.text || '');
      const title = token.title ? ` title="${escapeHtml(token.title)}"` : '';
      return `<a class="image-link" href="${escapeHtml(responsive.href)}" target="_blank" rel="noreferrer"><img src="${escapeHtml(responsive.src)}" srcset="${escapeHtml(responsive.srcset)}" sizes="${escapeHtml(responsive.sizes)}" alt="${alt}"${title} loading="lazy" decoding="async"></a>`;
    }
    const href = options.resolveImageHref(token.href);
    if (!href) return '';
    const html = renderImage.call(this, { ...token, href });
    return html.replace('<img ', '<img loading="lazy" decoding="async" ');
  };

  renderer.link = function (token) {
    if (!isSafeLinkHref(token.href)) return this.parser.parseInline(token.tokens);
    const href = token.href.startsWith('/') ? options.resolveRootHref(token.href) : token.href;
    const embed = renderBareLinkEmbed(href, plainTextFromTokens(token.tokens));
    if (embed) return embed;
    return renderLink.call(this, { ...token, href });
  };

  renderer.heading = function (token) {
    const text = plainTextFromTokens(token.tokens);
    const id = nextHeadingId(text);
    if (headings && token.depth >= 2) headings.push({ depth: token.depth, id, text });
    return `<h${token.depth} id="${escapeHtml(id)}">${this.parser.parseInline(token.tokens)}</h${token.depth}>\n`;
  };

  renderer.code = function (token) {
    const language = String(token.lang || '').trim().toLowerCase();
    const code = String(token.text || '');
    if (!language || ['sh', 'shell', 'bash', 'zsh'].includes(language)) {
      return `<pre><code>${highlightShellCode(code)}</code></pre>\n`;
    }
    return renderCode.call(this, token);
  };

  renderer.html = (token) => escapeHtml(token.text);
  return renderer;
}

/** @param {string} code */
function highlightShellCode(code) {
  return escapeHtml(code)
    .replace(/(^|\s)(#[^\n]*)/g, '$1<span class="code-comment">$2</span>')
    .replace(/(^|\s)(-{1,2}[A-Za-z][A-Za-z0-9_-]*)/g, '$1<span class="code-flag">$2</span>')
    .replace(/\b(true|false|TRUE|FALSE|Default)\b/g, '<span class="code-literal">$1</span>')
    .replace(/\b(\d+(?:\.\d+)?)\b/g, '<span class="code-number">$1</span>');
}

/**
 * Montaigne turns supported bare media links into rich embeds. Keep this narrow:
 * only auto-embed when the visible label is the URL itself, so ordinary labelled
 * links keep behaving like links.
 *
 * @param {string} href
 * @param {string} label
 */
function renderBareLinkEmbed(href, label) {
  const url = safeUrl(href);
  if (!url) return '';
  if (label.trim() && normalizeUrlLabel(label) !== normalizeUrlLabel(url.href)) return '';

  const youtube = youtubeEmbedUrl(url);
  if (youtube) {
    return `<div class="link-embed link-embed-youtube"><iframe src="${escapeHtml(youtube)}" title="YouTube video" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe></div>`;
  }

  if (url.hostname === 'embed.music.apple.com' || url.hostname === 'music.apple.com') {
    const embedUrl = url.hostname === 'embed.music.apple.com'
      ? url.href
      : `https://embed.music.apple.com${url.pathname}${url.search}`;
    return `<div class="link-embed link-embed-apple-music"><iframe src="${escapeHtml(embedUrl)}" title="Apple Music" loading="lazy" allow="autoplay *; encrypted-media *; fullscreen *; clipboard-write"></iframe></div>`;
  }

  if (url.hostname === 'open.spotify.com') {
    return `<div class="link-embed link-embed-spotify"><iframe src="${escapeHtml(url.href)}" title="Spotify" loading="lazy" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"></iframe></div>`;
  }

  if (url.hostname === 'podcasts.apple.com' || url.hostname === 'embed.podcasts.apple.com') {
    const embedUrl = url.hostname === 'embed.podcasts.apple.com'
      ? url.href
      : `https://embed.podcasts.apple.com${url.pathname}${url.search}`;
    return `<div class="link-embed link-embed-apple-podcast"><iframe src="${escapeHtml(embedUrl)}" title="Apple Podcasts" loading="lazy" allow="autoplay *; encrypted-media *; fullscreen *"></iframe></div>`;
  }

  if (url.hostname === 'tv.apple.com' || url.hostname === 'embed.tv.apple.com') {
    const embedUrl = url.hostname === 'embed.tv.apple.com'
      ? url.href
      : `https://embed.tv.apple.com${url.pathname}${url.search}`;
    return `<div class="link-embed link-embed-apple-tv"><iframe src="${escapeHtml(embedUrl)}" title="Apple TV" loading="lazy" allow="autoplay *; encrypted-media *; fullscreen *"></iframe></div>`;
  }

  return '';
}

/** @param {string} value */
function safeUrl(value) {
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol)) return null;
    return url;
  } catch {
    return null;
  }
}

/** @param {string} value */
function normalizeUrlLabel(value) {
  return value.trim().replace(/\/$/, '');
}

/** @param {URL} url */
function youtubeEmbedUrl(url) {
  const host = url.hostname.replace(/^www\./, '');
  if (host === 'youtu.be') {
    const id = url.pathname.split('/').filter(Boolean)[0];
    return id ? `https://www.youtube-nocookie.com/embed/${escapeURIComponent(id)}` : '';
  }
  if (host === 'youtube.com' || host === 'm.youtube.com') {
    const id = url.searchParams.get('v');
    if (id) return `https://www.youtube-nocookie.com/embed/${escapeURIComponent(id)}`;
    const shorts = url.pathname.match(/^\/shorts\/([^/?#]+)/);
    if (shorts) return `https://www.youtube-nocookie.com/embed/${escapeURIComponent(shorts[1])}`;
    const embed = url.pathname.match(/^\/embed\/([^/?#]+)/);
    if (embed) return `https://www.youtube-nocookie.com/embed/${escapeURIComponent(embed[1])}`;
  }
  return '';
}

/** @param {string} value */
function escapeURIComponent(value) {
  return encodeURIComponent(value).replace(/%2F/gi, '');
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

  const html = unwrapBlockEmbeds(String(marked.parse(body)));
  const toc = options.showTableOfContents ? renderTableOfContents(headings) : '';
  return `${toc}${html}${footnotes.render()}`;
}

/** @param {string} html */
function unwrapBlockEmbeds(html) {
  return html.replace(/<p>\s*(<div class="link-embed [\s\S]*?<\/div>)\s*<\/p>/g, '$1');
}
