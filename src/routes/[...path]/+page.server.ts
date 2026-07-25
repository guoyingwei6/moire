import { base } from '$app/paths';
import { error, redirect } from '@sveltejs/kit';
import type { EntryGenerator, PageServerLoad } from './$types';
import {
  getAliasTarget,
  getCatchAllEntries,
  getPostNeighbors,
  getRecord,
  getRecordSummary,
  getSectionEntries
} from '$lib/server/content';

export const entries: EntryGenerator = () => getCatchAllEntries();

export const load: PageServerLoad = ({ params }) => {
  const route = `/${params.path.split('/').filter(Boolean).join('/')}/`;
  const record = getRecord(route);
  if (!record) {
    const aliasTarget = getAliasTarget(route);
    if (aliasTarget) redirect(308, `${base}${aliasTarget}` || '/');
    error(404, 'Note or folder not found');
  }

  return {
    record,
    entries: record.kind === 'section' && record.options.showChildren
      ? getSectionEntries(record.route, record.options.layout)
      : [],
    folder: getRecordSummary(record.parentRoute),
    ...getPostNeighbors(record)
  };
};
