import type { PageServerLoad } from './$types';
import { getHome } from '$lib/server/content';

export const load: PageServerLoad = () => ({
  record: getHome(),
  entries: [],
  folder: null,
  previous: null,
  next: null
});
