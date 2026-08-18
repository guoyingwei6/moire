
import type { PageServerLoad } from './$types';
import { getHomepageMemos } from '$lib/server/memos';

export const load: PageServerLoad = async () => {
  const memos = await getHomepageMemos();

  return {
    memos
  };
};
