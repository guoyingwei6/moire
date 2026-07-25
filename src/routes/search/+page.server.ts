import type { PageServerLoad } from './$types';
import { getSearchEntries } from '$lib/server/content';

export const load: PageServerLoad = () => ({ entries: getSearchEntries() });
