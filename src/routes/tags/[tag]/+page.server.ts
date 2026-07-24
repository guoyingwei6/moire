import { error } from '@sveltejs/kit';
import type { EntryGenerator, PageServerLoad } from './$types';
import { getTagEntries, getTagGroup } from '$lib/server/content';

export const entries: EntryGenerator = () => getTagEntries();

export const load: PageServerLoad = ({ params }) => {
  const group = getTagGroup(params.tag);
  if (!group) error(404, 'Tag not found');
  return { group };
};
