import type { PageServerLoad } from './$types';
import { getHome, getSectionEntries } from '$lib/server/content';

export const load: PageServerLoad = () => {
  const record = getHome();
  return {
    record,
    entries: record.options.showChildren ? getSectionEntries('/') : [],
    folder: null,
    previous: null,
    next: null
  };
};
