import { error } from '@sveltejs/kit';
import type { EntryGenerator, PageServerLoad } from './$types';
import { getCatchAllEntries, getPostNeighbors, getRecord, getRecordSummary, getSectionEntries } from '$lib/server/content';

export const entries: EntryGenerator = () => getCatchAllEntries();

export const load: PageServerLoad = ({ params }) => {
  const route = `/${params.path.split('/').filter(Boolean).join('/')}/`;
  const record = getRecord(route);
  if (!record) error(404, 'Note or folder not found');

  return {
    record,
    entries: record.kind === 'section' ? getSectionEntries(record.route) : [],
    folder: getRecordSummary(record.parentRoute),
    ...getPostNeighbors(record)
  };
};
