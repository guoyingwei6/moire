import { base } from '$app/paths';
import { error, redirect } from '@sveltejs/kit';
import type { EntryGenerator, PageServerLoad } from './$types';
import {
  getAliasTarget,
  getCatchAllEntries,
  getLockedMaterial,
  getPostNeighbors,
  getRecord,
  getRecordSummary,
  getSectionEntries
} from '$lib/server/content';
import { encryptNoteHtml } from '$lib/note-lock.js';

export const entries: EntryGenerator = () => getCatchAllEntries();

export const load: PageServerLoad = async ({ params }) => {
  const route = `/${params.path.split('/').filter(Boolean).join('/')}/`;
  let record = getRecord(route);
  if (!record) {
    const aliasTarget = getAliasTarget(route);
    if (aliasTarget) redirect(308, `${base}${aliasTarget}` || '/');
    error(404, 'Note or folder not found');
  }

  if (record.locked) {
    const material = getLockedMaterial(record.route);
    if (!material) error(500, 'Locked note is missing encrypted content');
    const lockedPayload = await encryptNoteHtml(material.html, material.password);
    record = { ...record, html: '', lockedPayload };
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
