<script lang="ts">
  import { slide } from 'svelte/transition';
  import { format } from 'date-fns';
  import type { PageData } from '../../routes/$types';
  import { createMemoList } from '$lib/memo.svelte';
  import Heatmap from '$lib/components/Heatmap.svelte';

  let { data, config }: { data: PageData; config: any } = $props();
  const memoList = createMemoList(() => data, config);

  $effect(() => {
    if (memoList.selectedTag) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  });
</script>

<div class="min-h-screen bg-white text-[0.95rem] {config.theme}">
  <div class="max-w-2xl mx-auto px-5 md:px-12 mb-6">
    <header class="bg-white pt-12 pb-6 md:pb-12">
      <div class="flex flex-col md:flex-row md:items-baseline justify-between gap-4">
        <div class="flex flex-col md:flex-row md:items-baseline gap-2 md:gap-4">
          <h1 class="text-3xl font-bold tracking-tight text-gray-900">{config.title}</h1>
          <p class="text-sm text-gray-500 italic">{config.description}</p>
        </div>

        <div class="flex items-center gap-3 self-end md:self-auto">
          {#if memoList.selectedTag}
            <button 
              class="px-2 py-1 cursor-pointer bg-gray-50 rounded-full text-[0.8rem] font-medium hover:bg-gray-100 transition-colors"
              style="color: var(--accent-color)"
              onclick={() => memoList.selectTag(null)}
            >
              #{memoList.selectedTag} &times;
            </button>
          {/if}
        </div>
      </div>
    </header>

    {#if config.heatmap}
      <div class="mb-8 pb-8 border-b border-gray-100">
        <Heatmap memos={data.memos} />
      </div>
    {/if}

    <div class="divide-y divide-gray-100">
      {#each memoList.visibleMemos as memo (memo.slug)}
        <article class="py-6" id={memo.slug} in:slide>
          <div class="text-[0.75rem] font-400 text-gray-500 mb-2">{format(memo.date, 'MMMM d, yyyy')}</div>
          <div 
            class=" leading-[1.8] text-gray-800
              [&_h1]:text-xl [&_h1]:font-bold [&_h1]:text-gray-900 [&_h1]:mt-6 [&_h1]:mb-3 [&_h1]:leading-tight
              [&_h2]:text-lg [&_h2]:font-bold [&_h2]:text-gray-900 [&_h2]:mt-5 [&_h2]:mb-2 [&_h2]:leading-snug
              [&_h3]:text-base [&_h3]:font-bold [&_h3]:text-gray-900 [&_h3]:mt-4 [&_h3]:mb-2
              [&_p]:mb-4 [&_p:last-child]:mb-0
              [&_a]:no-underline [&_a]:hover:opacity-80
              [&_img]:rounded-xl [&_img]:my-4 [&_img]:max-w-full [&_img]:shadow-sm
              [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:mb-4 [&_ul]:space-y-1
              [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:mb-4 [&_ol]:space-y-1
              [&_blockquote]:border-l-[3px] [&_blockquote]:border-gray-200 [&_blockquote]:pl-4 [&_blockquote]:text-gray-500 [&_blockquote]:italic [&_blockquote]:my-4
              [&_table]:w-full [&_table]:my-4 [&_table]:text-[0.8rem]
              [&_th]:text-left [&_th]:font-semibold [&_th]:text-gray-900 [&_th]:pb-2 [&_th]:border-b [&_th]:border-gray-200
              [&_td]:py-2 [&_td]:border-b [&_td]:border-gray-100 [&_td]:text-gray-600
              [&_code]:text-[0.8rem] [&_code]:bg-gray-100 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded-md [&_code]:text-gray-800 [&_code]:font-mono
              [&_pre]:bg-gray-50 [&_pre]:p-4 [&_pre]:rounded-xl [&_pre]:text-[0.8rem] [&_pre]:overflow-x-auto [&_pre]:my-4 [&_pre]:border [&_pre]:border-gray-100
              [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_pre_code]:text-gray-800
              [&_.tag-link]:text-[0.85rem] [&_.tag-link]:mr-1 [&_.tag-link]:no-underline [&_.tag-link]:cursor-pointer [&_.tag-link]:font-medium
            "
            style="
              --link-color: var(--accent-color);
            "
            role="presentation"
            onclick={(e) => {
              const target = e.target as HTMLElement;
              if (target.classList.contains('tag-link')) {
                  const tag = target.dataset.tag;
                  if (tag) memoList.selectTag(tag);
              }
            }}
          >
            <!-- Inject dynamic color style for links and tags -->
            <style>
              .classic article a, .classic article .tag-link {
                color: var(--accent-color);
              }
            </style>
            {@html memo.content}
          </div>
        </article>
      {/each}
    </div>

    {#if memoList.visibleCount < memoList.filteredMemos.length}
      <div class="py-6 text-center">
        <button 
          class="text-[0.8rem] text-gray-400"
          onclick={memoList.loadMore}
        >
          Load more...
        </button>
      </div>
    {/if}
  </div>

    <footer class="mt-16 text-center mx-9 text-[0.8rem] text-gray-400 pb-8">
      <p>© {new Date().getFullYear()} {config.author}, synced from Apple Notes and powered by <a href="https://moire.blog/" target="_blank" class="hover:text-gray-600 transition-colors">Moire</a></p>
    </footer>
</div>
