<script lang="ts">
  import { slide } from 'svelte/transition';
  import { format } from 'date-fns';
  import { base } from '$app/paths';
  import type { PageData } from '../../routes/$types';
  import { createMemoList } from '$lib/memo.svelte';
  import Heatmap from '$lib/components/Heatmap.svelte';

  let { data, config }: { data: PageData; config: any } = $props();
  const memoList = createMemoList(() => data, config);

  $effect(() => {
    if (memoList.selectedTag || memoList.selectedDate) {
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

        <div class="flex flex-wrap items-center justify-end gap-2 self-end md:self-auto">
          {#if memoList.selectedTag}
            <button
              type="button"
              class="filter-chip"
              onclick={() => memoList.selectTag(null)}
            >
              #{memoList.selectedTag} &times;
            </button>
          {/if}

          {#if memoList.selectedDate}
            <button
              type="button"
              class="filter-chip"
              onclick={() => memoList.selectDate(memoList.selectedDate ?? '')}
            >
              {memoList.selectedDate} &times;
            </button>
          {/if}
        </div>
      </div>
    </header>

    {#if config.heatmap}
      <div class="mb-8 pb-8 border-b border-gray-100">
        <Heatmap memos={data.memos} onSelectDate={memoList.selectDate} selectedDate={memoList.selectedDate} />
      </div>
    {/if}

    <div class="divide-y divide-gray-100">
      {#each memoList.visibleMemos as memo (memo.slug)}
        <article class="py-5 md:py-6" id={memo.slug} in:slide>
          <time
            class="block text-[0.75rem] text-gray-500 mb-1.5"
            datetime={new Date(memo.date).toISOString()}
          >{format(memo.date, 'MMMM d, yyyy')}</time>

          <h2 class="m-0 text-[1.08rem] md:text-[1.15rem] font-semibold leading-snug tracking-[-0.01em]">
            <a class="memo-title" href={`${base}/memo/${encodeURIComponent(memo.slug)}/`}>
              <span>{memo.title}</span>
              <span class="title-arrow" aria-hidden="true">→</span>
            </a>
          </h2>

          {#if memo.tags.length > 0}
            <ul class="memo-tags" aria-label={`Tags for ${memo.title}`}>
              {#each memo.tags as tag}
                <li>
                  <button
                    type="button"
                    class:active={memoList.selectedTag === tag}
                    aria-pressed={memoList.selectedTag === tag}
                    onclick={() => memoList.selectTag(tag)}
                  >#{tag}</button>
                </li>
              {/each}
            </ul>
          {/if}
        </article>
      {/each}
    </div>

    {#if memoList.visibleCount < memoList.filteredMemos.length}
      <div class="py-6 text-center">
        <button
          type="button"
          class="load-more"
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

<style>
  .filter-chip {
    padding: 0.25rem 0.55rem;
    border: 0;
    border-radius: 999px;
    color: var(--accent-color);
    background: #f9fafb;
    cursor: pointer;
    font: inherit;
    font-size: 0.8rem;
    font-weight: 500;
    transition: background-color 150ms ease;
  }

  .filter-chip:hover {
    background: #f3f4f6;
  }

  .filter-chip:focus-visible,
  .memo-title:focus-visible,
  .memo-tags button:focus-visible,
  .load-more:focus-visible {
    outline: 2px solid var(--accent-color);
    outline-offset: 3px;
  }

  .memo-title {
    display: inline-flex;
    align-items: baseline;
    gap: 0.45rem;
    border-radius: 0.15rem;
    color: #111827;
    text-decoration: none;
  }

  .memo-title:hover {
    color: var(--accent-color);
    text-decoration: underline;
    text-decoration-thickness: 0.08em;
    text-underline-offset: 0.2em;
  }

  .title-arrow {
    color: var(--accent-color);
    font-weight: 400;
    opacity: 0;
    transform: translateX(-0.2rem);
    transition: opacity 150ms ease, transform 150ms ease;
  }

  .memo-title:hover .title-arrow,
  .memo-title:focus-visible .title-arrow {
    opacity: 1;
    transform: translateX(0);
  }

  .memo-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem;
    margin: 0.75rem 0 0;
    padding: 0;
    list-style: none;
  }

  .memo-tags button {
    padding: 0.16rem 0.42rem;
    border: 1px solid #e5e7eb;
    border-radius: 999px;
    color: #6b7280;
    background: transparent;
    cursor: pointer;
    font: inherit;
    font-size: 0.72rem;
    transition: border-color 150ms ease, color 150ms ease, background-color 150ms ease;
  }

  .memo-tags button:hover {
    border-color: var(--accent-color);
    color: var(--accent-color);
  }

  .memo-tags button.active {
    border-color: var(--accent-color);
    color: #111827;
    background: color-mix(in srgb, var(--accent-color) 18%, white);
  }

  .load-more {
    padding: 0.35rem 0.5rem;
    border: 0;
    border-radius: 0.25rem;
    color: #9ca3af;
    background: transparent;
    cursor: pointer;
    font: inherit;
    font-size: 0.8rem;
  }

  .load-more:hover {
    color: var(--accent-color);
    text-decoration: underline;
    text-underline-offset: 0.2em;
  }

  @media (prefers-reduced-motion: reduce) {
    .filter-chip,
    .title-arrow,
    .memo-tags button {
      transition: none;
    }
  }
</style>
