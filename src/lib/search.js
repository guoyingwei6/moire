/** @param {string} value */
export function normalizeSearchText(value) {
  return value.normalize('NFKC').toLocaleLowerCase().trim();
}

/**
 * Match every whitespace-delimited term against title, full plain text and
 * tags. Tags are indexed both with and without their leading hash.
 *
 * @template {{ title: string, text: string, tags: string[] }} T
 * @param {T[]} entries
 * @param {string} query
 * @returns {T[]}
 */
export function filterSearchEntries(entries, query) {
  const terms = normalizeSearchText(query).split(/\s+/u).filter(Boolean);
  if (!terms.length) return [];

  return entries.filter((entry) => {
    const tags = entry.tags.flatMap((tag) => [tag, `#${tag}`]);
    const haystack = normalizeSearchText([entry.title, entry.text, ...tags].join('\n'));
    return terms.every((term) => haystack.includes(term));
  });
}
