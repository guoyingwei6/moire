import type { PageServerLoad } from './$types';
import { getTagGroups } from '$lib/server/content';

export const load: PageServerLoad = () => ({ groups: getTagGroups() });
