/**
 * Remove fields that belong only on a full note page.
 *
 * @param {{ html: string, sourcePath: string | null, wordCount: number, readingMinutes: number, locked: boolean, lockedPayload: unknown } & Record<string, unknown>} record
 */
export function toContentSummary(record) {
  const {
    html: _html,
    sourcePath: _sourcePath,
    wordCount: _wordCount,
    readingMinutes: _readingMinutes,
    locked: _locked,
    lockedPayload: _lockedPayload,
    ...summary
  } = record;
  return summary;
}

/**
 * Feed collections need the rendered note body; every other collection layout
 * keeps the lightweight summary payload it used before.
 *
 * @param {{ html: string, sourcePath: string | null, wordCount: number, readingMinutes: number, locked: boolean, lockedPayload: unknown } & Record<string, unknown>} record
 * @param {string} layout
 */
export function toListingEntry(record, layout) {
  const summary = toContentSummary(record);
  return layout === 'feed' ? { ...summary, html: record.html } : summary;
}

/**
 * Build the static client-side index from real, non-hidden source notes only.
 * Implicit folder records have no sourcePath and contain no searchable body.
 *
 * @param {Array<{ route: string, sourcePath: string | null, hidden: boolean, title: string, summary: string, tags: string[], kind: string, created: string | null }>} records
 * @param {Map<string, string>} textByRoute
 * @param {(route: string) => string} hrefForRoute
 */
export function toSearchEntries(records, textByRoute, hrefForRoute) {
  return records
    .filter((record) => !record.hidden && record.sourcePath !== null)
    .map((record) => ({
      route: record.route,
      href: hrefForRoute(record.route),
      title: record.title,
      text: textByRoute.get(record.route) ?? '',
      summary: record.summary,
      tags: [...record.tags],
      kind: record.kind,
      created: record.created
    }));
}
