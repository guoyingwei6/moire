import type { PageServerLoad } from './$types';
import { getArchiveGroups } from '$lib/server/content';

export const load: PageServerLoad = () => ({ groups: getArchiveGroups() });
