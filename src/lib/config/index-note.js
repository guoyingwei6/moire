/**
 * Montaigne-compatible configuration tables embedded in an Apple Note.
 *
 * A root note may contain one menu/link/type table. Legacy extra columns are
 * preserved for compatibility but are not required by the website. Every note may
 * contain one or more name/value tables. Recognised tables are removed from
 * the rendered body, while arbitrary name/value properties are preserved for
 * the content graph to interpret or display later.
 *
 * @typedef {'sidebar' | 'header' | 'footer'} IndexMenuType
 * @typedef {{ label: string, icon: string, href: string, type: IndexMenuType, source: string, path: string }} IndexMenuItem
 * @typedef {{ kind: 'menu' | 'settings', headers: string[], rows: { cells: string[], line: number }[], start: number, end: number }} ConfigTable
 * @typedef {{ menu: IndexMenuItem[] | null, properties: Record<string, string>, cleanedMarkdown: string, issues: string[] }} NoteConfiguration
 */

const MENU_TYPES = new Set(['sidebar', 'header', 'footer']);
const FILE_ENDPOINTS = new Set(['/feed.xml', '/robots.txt', '/rss.xml', '/sitemap.xml']);
const EMOJI_PREFIX = /^((?:\p{Extended_Pictographic})(?:\uFE0F|\p{Emoji_Modifier}|\u200D\p{Extended_Pictographic}\uFE0F?)*)\s*(.*)$/u;

/** @param {string} value */
function normalizeHeader(value) {
  return value.trim().toLocaleLowerCase().replace(/[^a-z]/g, '');
}

/** @param {string} value */
export function normalizePropertyName(value) {
  return value.trim().toLocaleLowerCase().replace(/[^a-z\d]/g, '');
}

/** @param {string} value */
export function plainCell(value) {
  return value
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/^(?:\*\*|__|`)(.*)(?:\*\*|__|`)$/, '$1')
    .trim();
}

/** @param {string} value */
export function parseBooleanProperty(value) {
  const normalized = plainCell(value).toLocaleLowerCase();
  if (['yes', 'true', '1', 'on'].includes(normalized)) return true;
  if (['no', 'false', '0', 'off'].includes(normalized)) return false;
  return null;
}

/** @param {string | undefined} value */
export function parseListProperty(value) {
  if (!value) return [];
  return plainCell(value)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

/**
 * Split a Markdown table row while preserving escaped pipe characters.
 *
 * @param {string} line
 * @returns {string[] | null}
 */
function splitTableRow(line) {
  let value = line.trim();
  if (!value.includes('|')) return null;
  if (value.startsWith('|')) value = value.slice(1);
  if (value.endsWith('|') && !value.endsWith('\\|')) value = value.slice(0, -1);

  /** @type {string[]} */
  const cells = [];
  let cell = '';
  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    if (character === '\\' && value[index + 1] === '|') {
      cell += '|';
      index += 1;
    } else if (character === '|') {
      cells.push(cell.trim());
      cell = '';
    } else {
      cell += character;
    }
  }
  cells.push(cell.trim());
  return cells;
}

/** @param {string[]} cells */
function isDelimiterRow(cells) {
  return cells.length > 0 && cells.every((cell) => /^:?-{3,}:?$/.test(cell.trim()));
}

/**
 * @param {string} markdown
 * @param {boolean} includeMenu
 * @returns {{ tables: ConfigTable[], cleanedMarkdown: string }}
 */
function findConfigurationTables(markdown, includeMenu) {
  const lines = markdown.split(/\r?\n/);
  /** @type {ConfigTable[]} */
  const tables = [];
  const removedLines = new Set();
  /** @type {'`' | '~' | null} */
  let fence = null;

  for (let index = 0; index < lines.length; index += 1) {
    const fenceMatch = lines[index].match(/^\s*(`{3,}|~{3,})/);
    if (fenceMatch) {
      const marker = /** @type {'`' | '~'} */ (fenceMatch[1][0]);
      if (fence === marker) fence = null;
      else if (!fence) fence = marker;
      continue;
    }
    if (fence || index + 1 >= lines.length) continue;

    const headerCells = splitTableRow(lines[index]);
    const delimiterCells = splitTableRow(lines[index + 1]);
    const headerNames = headerCells?.map(normalizeHeader) ?? [];
    const looksLikeMenu = includeMenu && headerNames.includes('menu');
    if (
      looksLikeMenu
      && (!delimiterCells || headerNames.length !== delimiterCells.length || !isDelimiterRow(delimiterCells))
    ) {
      throw new Error(
        `Invalid content/index.md menu: line ${index + 2} must be a Markdown table delimiter with one cell per column.`
      );
    }
    if (!headerCells || !delimiterCells || headerCells.length !== delimiterCells.length || !isDelimiterRow(delimiterCells)) {
      continue;
    }

    const headers = headerNames;
    const menuIndex = headers.indexOf('menu');
    const urlIndex = headers.findIndex((header) => header === 'url' || header === 'link');
    const nameIndex = headers.indexOf('name');
    const valueIndex = headers.indexOf('value');
    const kind = includeMenu && menuIndex !== -1
      ? 'menu'
      : nameIndex !== -1 && valueIndex !== -1
        ? 'settings'
        : null;
    if (!kind) continue;

    /** @type {{ cells: string[], line: number }[]} */
    const rows = [];
    let end = index + 2;
    while (end < lines.length) {
      const cells = splitTableRow(lines[end]);
      if (!cells) break;
      if (cells.length !== headers.length) {
        if (kind === 'menu') {
          throw new Error(
            `Invalid content/index.md menu: line ${end + 1} has ${cells.length} cells; expected ${headers.length}.`
          );
        }
        break;
      }
      rows.push({ cells, line: end + 1 });
      end += 1;
    }

    tables.push({ kind, headers, rows, start: index, end });
    for (let lineIndex = index; lineIndex < end; lineIndex += 1) removedLines.add(lineIndex);
    index = end - 1;
  }

  const cleanedMarkdown = lines
    .filter((_, index) => !removedLines.has(index))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return { tables, cleanedMarkdown };
}

/** @param {string} value */
function parseMenuLabel(value) {
  const display = plainCell(value);
  const emoji = display.match(EMOJI_PREFIX);
  if (!emoji) return display ? { icon: '•', label: display } : null;
  const label = emoji[2].trim();
  return label ? { icon: emoji[1], label } : null;
}

/** @param {string} value */
function unwrapMarkdownHref(value) {
  const raw = value.trim();
  const link = raw.match(/^\[[^\]]*\]\(([^)]+)\)$/);
  if (link) return link[1].trim();
  const angle = raw.match(/^<([^>]+)>$/);
  return (angle ? angle[1] : raw).trim();
}

/**
 * Only safe site-local paths and credential-free HTTPS links are allowed in
 * note-controlled navigation.
 *
 * @param {string} value
 * @returns {string | null}
 */
function parseMenuHref(value) {
  const href = unwrapMarkdownHref(value);
  if (href.startsWith('/')) {
    if (/\/{2,}/.test(href) || href.includes('\\') || /[\s?#]/.test(href)) return null;
    const segments = href.split('/').filter(Boolean);
    if (segments.some((segment) => segment === '.' || segment === '..')) return null;
    if (href === '/') return '/';
    const normalized = `/${segments.join('/')}`;
    return FILE_ENDPOINTS.has(normalized) ? normalized : `${normalized}/`;
  }

  let url;
  try {
    url = new URL(href);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' || url.username || url.password) return null;
  return url.href;
}

/**
 * @param {ConfigTable[]} tables
 * @returns {IndexMenuItem[] | null}
 */
function parseMenuTable(tables) {
  const menuTables = tables.filter((table) => table.kind === 'menu');
  if (!menuTables.length) return null;
  if (menuTables.length > 1) {
    throw new Error('Invalid content/index.md menu: only one menu table is allowed.');
  }

  const table = menuTables[0];
  const menuIndex = table.headers.indexOf('menu');
  const urlIndex = table.headers.findIndex((header) => header === 'url' || header === 'link');
  const typeIndex = table.headers.indexOf('type');
  const sourceIndex = table.headers.indexOf('source');
  const pathIndex = table.headers.indexOf('path');
  if (menuIndex === -1 || urlIndex === -1) {
    throw new Error('Invalid content/index.md menu: the table must contain menu and link/url columns.');
  }
  /** @type {IndexMenuItem[]} */
  const items = [];
  const seen = new Set();
  /** @type {string[]} */
  const errors = [];

  for (const row of table.rows) {
    if (row.cells.every((cell) => !cell.trim())) continue;
    const display = parseMenuLabel(row.cells[menuIndex]);
    const href = parseMenuHref(row.cells[urlIndex]);
    const rawType = typeIndex === -1 ? '' : plainCell(row.cells[typeIndex]).toLocaleLowerCase();
    const typeValue = rawType || 'sidebar';
    const type = MENU_TYPES.has(typeValue) ? /** @type {IndexMenuType} */ (typeValue) : null;
    const duplicateKey = type && href ? `${type}\u0000${href}` : '';

    if (!display) {
      errors.push(`line ${row.line} has an empty menu label`);
      continue;
    }
    if (!href) {
      errors.push(`line ${row.line} has an unsafe or invalid link`);
      continue;
    }
    if (!type) {
      errors.push(`line ${row.line} has an unsupported type`);
      continue;
    }
    if (seen.has(duplicateKey)) {
      errors.push(`line ${row.line} duplicates ${href} in ${type}`);
      continue;
    }
    seen.add(duplicateKey);
    items.push({
      ...display,
      href,
      type,
      source: sourceIndex === -1 ? '' : plainCell(row.cells[sourceIndex]),
      path: pathIndex === -1 ? '' : plainCell(row.cells[pathIndex])
    });
  }

  if (!items.length && !errors.length) errors.push('the table has no menu rows');
  if (errors.length) {
    throw new Error(`Invalid content/index.md menu: ${errors.join('; ')}.`);
  }
  return items;
}

/**
 * @param {ConfigTable[]} tables
 * @param {string[]} issues
 * @returns {Record<string, string>}
 */
function parsePropertyTables(tables, issues) {
  /** @type {Record<string, string>} */
  const properties = {};
  /** @type {Map<string, { value: string, line: number }[]>} */
  const values = new Map();

  for (const table of tables.filter((candidate) => candidate.kind === 'settings')) {
    const nameIndex = table.headers.indexOf('name');
    const valueIndex = table.headers.indexOf('value');
    for (const row of table.rows) {
      const name = normalizePropertyName(plainCell(row.cells[nameIndex]));
      if (!name) continue;
      const entries = values.get(name) ?? [];
      entries.push({ value: plainCell(row.cells[valueIndex]), line: row.line });
      values.set(name, entries);
    }
  }

  for (const [name, entries] of values) {
    if (entries.length > 1) {
      const lines = entries.map((entry) => entry.line).join(', ');
      throw new Error(`Invalid note settings: duplicate ${name} rows on lines ${lines}.`);
    }
    properties[name] = entries[0].value;
  }
  return properties;
}

/**
 * Parse name/value configuration from a folder index or ordinary note. A
 * menu/link table outside content/index.md is ordinary Markdown and must stay
 * in the rendered body.
 *
 * @param {string} markdown
 * @returns {NoteConfiguration}
 */
export function parseNoteConfiguration(markdown) {
  const { tables, cleanedMarkdown } = findConfigurationTables(markdown, false);
  /** @type {string[]} */
  const issues = [];
  return {
    menu: null,
    properties: parsePropertyTables(tables, issues),
    cleanedMarkdown,
    issues
  };
}

/**
 * Parse the root index control surface. A present-but-invalid menu must stop
 * the build; falling back to a broader repository menu would silently widen
 * the publication surface.
 *
 * @param {string} markdown
 * @returns {NoteConfiguration}
 */
export function parseIndexNoteConfiguration(markdown) {
  const { tables, cleanedMarkdown } = findConfigurationTables(markdown, true);
  /** @type {string[]} */
  const issues = [];
  return {
    menu: parseMenuTable(tables),
    properties: parsePropertyTables(tables, issues),
    cleanedMarkdown,
    issues
  };
}
