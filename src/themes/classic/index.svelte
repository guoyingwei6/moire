<script lang="ts">
  import { slide } from 'svelte/transition';
  import { base } from '$app/paths';
  import type { PageData } from '../../routes/$types';

  let { data, config }: { data: PageData; config: any } = $props();
</script>

<div class="min-h-screen bg-white text-[0.95rem] {config.theme}">
  <div class="max-w-2xl mx-auto px-5 md:px-12 mb-6">
    <header class="bg-white pt-12 pb-6 md:pb-12">
      <div class="flex flex-col md:flex-row md:items-baseline gap-2 md:gap-4">
        <div class="flex flex-col md:flex-row md:items-baseline gap-2 md:gap-4">
          <h1 class="text-3xl font-bold tracking-tight text-gray-900">{config.title}</h1>
          <p class="text-sm text-gray-500 italic">{config.description}</p>
        </div>
      </div>
    </header>

    {#if data.memos.length > 0}
      <nav class="divide-y divide-gray-100 border-t border-gray-100" aria-label="笔记列表">
        {#each data.memos as memo (memo.slug)}
        <article class="py-5 md:py-6" id={memo.slug} in:slide>
          <h2 class="m-0 text-[1.08rem] md:text-[1.15rem] font-semibold leading-snug tracking-[-0.01em]">
            <a class="memo-title" href={`${base}/memo/${encodeURIComponent(memo.slug)}/`}>
              <span>{memo.title}</span>
              <span class="title-arrow" aria-hidden="true">→</span>
            </a>
          </h2>
        </article>
        {/each}
      </nav>
    {:else}
      <p class="py-6 text-sm text-gray-400">暂无笔记</p>
    {/if}
  </div>

    <footer class="mt-16 text-center mx-9 text-[0.8rem] text-gray-400 pb-8">
      <p>© {new Date().getFullYear()} {config.author}, synced from Apple Notes and powered by <a href="https://github.com/guoyingwei6/moire/tree/development" target="_blank" rel="noreferrer" class="hover:text-gray-600 transition-colors">Moire</a></p>
    </footer>
</div>

<style>
  .memo-title:focus-visible {
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

  @media (prefers-reduced-motion: reduce) {
    .title-arrow {
      transition: none;
    }
  }
</style>
