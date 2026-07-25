const VIRTUAL_ROOTS = new Set([
  '404',
  'archive',
  'archives',
  'atom',
  'feed',
  'qr',
  'robots',
  'rss',
  'search',
  'sitemap',
  'tags'
]);
const VIRTUAL_FILES = new Set([
  '404.html',
  'atom.xml',
  'feed.xml',
  'robots.txt',
  'rss.xml',
  'sitemap.xml'
]);

/** @param {string} value */
export function normalizeFolderKey(value) {
  return value
    .normalize('NFC')
    .trim()
    .toLocaleLowerCase()
    .replace(/[\s_]+/gu, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * @param {{ label: string, href: string }} item
 * @returns {{ folderName: string, folderKey: string, targetDir: string, apiDir: string, mediaPrefix: string } | null}
 */
export function publicationTarget(item) {
  if (!item.href.startsWith('/')) return null;
  if (/\/{2,}/.test(item.href) || /[\\\s?#]/u.test(item.href)) {
    throw new Error(`Unsafe publication link: ${item.href}`);
  }

  const segments = item.href.split('/').filter(Boolean).map((segment) => {
    let decoded;
    try {
      decoded = decodeURIComponent(segment).normalize('NFC');
    } catch {
      throw new Error(`Invalid publication link escape: ${item.href}`);
    }
    if (!decoded || decoded === '.' || decoded === '..' || /[/\\\u0000-\u001f\u007f]/u.test(decoded)) {
      throw new Error(`Unsafe publication link segment in ${item.href}`);
    }
    return decoded;
  });
  if (!segments.length) return null;
  if (VIRTUAL_ROOTS.has(normalizeFolderKey(segments[0]))) return null;
  if (VIRTUAL_FILES.has(segments.at(-1)?.toLocaleLowerCase() ?? '')) return null;

  const folderKey = normalizeFolderKey(item.label);
  if (!folderKey) throw new Error(`Empty publication folder label for ${item.href}`);

  const matchingIndexes = segments
    .map((segment, index) => normalizeFolderKey(segment) === folderKey ? index : -1)
    .filter((index) => index !== -1);
  if (matchingIndexes.length !== 1) {
    throw new Error(
      `Publication menu label "${item.label}" must match exactly one link segment in ${item.href}; found ${matchingIndexes.length}`
    );
  }

  const targetSegments = segments.slice(0, matchingIndexes[0] + 1);
  const targetDir = targetSegments.join('/');
  return {
    folderName: item.label.normalize('NFC').trim(),
    folderKey,
    targetDir,
    apiDir: targetSegments.map(encodeURIComponent).join('/'),
    mediaPrefix: '../'.repeat(targetSegments.length) + 'media/'
  };
}

/**
 * @param {{ label: string, href: string }[]} menu
 */
export function publicationAllowlist(menu) {
  const targets = menu.map(publicationTarget).filter((target) => target !== null);
  const folderKeys = new Set();
  const targetDirs = new Set();
  for (const target of targets) {
    if (folderKeys.has(target.folderKey)) {
      throw new Error(`Duplicate publication folder label: ${target.folderName}`);
    }
    const targetKey = target.targetDir.normalize('NFC').toLocaleLowerCase();
    if (targetDirs.has(targetKey)) {
      throw new Error(`Duplicate publication target directory: ${target.targetDir}`);
    }
    folderKeys.add(target.folderKey);
    targetDirs.add(targetKey);
  }
  return targets;
}
