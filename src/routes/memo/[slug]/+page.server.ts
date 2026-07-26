import { error } from '@sveltejs/kit';
import { getMemos, removeLeadingTagBlock, removeLeadingTitleBlock } from '$lib/server/memos';
import type { EntryGenerator, PageServerLoad } from './$types';

export const prerender = true;
export const trailingSlash = 'always';

export const entries: EntryGenerator = async () => {
  const memos = await getMemos();
  return memos.map((memo) => ({ slug: memo.slug }));
};

export const load: PageServerLoad = async ({ params }) => {
  const memos = await getMemos();
  const memo = memos.find((candidate) => candidate.slug === params.slug);

  if (!memo) {
    error(404, 'Memo not found');
  }

  return {
    memo: {
      ...memo,
      content: removeLeadingTagBlock(removeLeadingTitleBlock(memo.content, memo.title))
    }
  };
};
