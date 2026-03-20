<script lang="ts">
  import { slide } from 'svelte/transition';
  import {config} from '../../../moire.config';
  import {createMemoList} from '$lib/memo.svelte';
  import type {PageData} from '../../routes/$types';
  import {marked} from 'marked';
  import {format} from 'date-fns';
  import {onMount} from 'svelte';
  import Heatmap from '$lib/components/Heatmap.svelte';

  let {data}: {data: PageData} = $props();
  const memoList = createMemoList(() => data, config);

  $effect(() => {
    if (memoList.selectedTag) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  });

  let time = $state(new Date());
  let fps = $state(60);
  let scrollY = $state(0);
  let scrollHex = $derived(scrollY.toString(16).toUpperCase().padStart(4, '0'));

  onMount(() => {
    // Clock
    const timer = setInterval(() => {
      time = new Date();
    }, 1000);

    // Simulated FPS jitter
    const fpsTimer = setInterval(() => {
      fps = 60 + Math.floor(Math.random() * 5) - 2;
    }, 1000);

    return () => {
      clearInterval(timer);
      clearInterval(fpsTimer);
    };
  });
</script>

<svelte:window onscroll={() => (scrollY = window.scrollY)} />

<div
  class="min-h-screen bg-[var(--bg-color)] text-[var(--text-color)] font-[family-name:var(--font-family)] selection:bg-[var(--text-color)] selection:text-[var(--bg-color)] overflow-x-hidden {config.theme}"
>
  <div
    class="fixed inset-0 pointer-events-none z-0 opacity-10"
    style="background: repeating-linear-gradient(0deg, transparent, transparent 2px, var(--accent-color) 3px);"
  ></div>
  <div
    class="fixed inset-0 pointer-events-none z-0 bg-[radial-gradient(circle_at_center,transparent_0%,var(--bg-color)_100%)] opacity-80"
  ></div>

  <div class="fixed inset-0 pointer-events-none z-50 p-4 md:p-8 flex flex-col justify-between">
    <header class="flex justify-between items-start pointer-events-auto">
      <div class="flex flex-col">
        <h1
          class="text-4xl font-bold uppercase tracking-[0.2em] relative inline-block glitch-text"
          data-text={config.title}
        >
          {config.title}
        </h1>
        <div class="flex items-center gap-4 mt-1">
          <div class="flex items-center gap-2 text-xs text-[var(--accent-color)] tracking-widest opacity-80">
            <span class="inline-block w-2 h-2 bg-[var(--accent-color)] animate-pulse"></span>
            <span>SYS.NORMAL</span>
          </div>
        </div>
        {#if memoList.selectedTag}
          <div class="mt-2 flex items-center gap-2 animate-in fade-in slide-in-from-left-4 duration-500">
            <span class="text-[10px] text-[var(--text-color)]/40 font-mono tracking-tighter">// SYSTEM_FILTER:</span>
            <button
              onclick={() => memoList.selectTag(null)}
              class="bg-[var(--accent-color)]/10 text-[var(--accent-color)] px-2 py-0.5 text-[10px] font-bold border border-[var(--accent-color)]/40 hover:bg-[var(--accent-color)] hover:text-[var(--bg-color)] transition-all flex items-center gap-2"
            >
              {memoList.selectedTag.toUpperCase()}
              <span class="opacity-50">✕</span>
            </button>
          </div>
        {/if}
      </div>

      <div class="text-right font-mono text-sm leading-tight text-[var(--accent-color)]/80 pointer-events-auto">
        <div>FPS: {fps}</div>
        <div>HEX: 0x{scrollHex}</div>
      </div>
    </header>

    <footer class="flex justify-between items-end pt-2">
      <div class="text-xs tracking-widest opacity-60">
        {config.author}
      </div>
      <div class="text-xl font-bold tracking-widest">
        {format(time, 'HH:mm:ss')}
      </div>
    </footer>

    <div class="absolute top-8 left-8 w-8 h-8 border-t-2 border-l-2 border-[var(--text-color)]"></div>
    <div class="absolute top-8 right-8 w-8 h-8 border-t-2 border-r-2 border-[var(--text-color)]"></div>
    <div class="absolute bottom-8 left-8 w-8 h-8 border-b-2 border-l-2 border-[var(--text-color)]"></div>
    <div class="absolute bottom-8 right-8 w-8 h-8 border-b-2 border-r-2 border-[var(--text-color)]"></div>
    <div
      class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[20px] h-[20px] border border-[var(--accent-color)]/20 items-center justify-center flex"
    >
      <div class="w-[2px] h-[2px] bg-[var(--accent-color)]/50"></div>
    </div>
  </div>

  <main
    class="relative z-10 pt-32 pb-32 px-4 max-w-2xl mx-auto space-y-12"
    data-selected-tag={memoList.selectedTag}
  >
    {#if config.heatmap}
      <div class="p-2 border border-[var(--accent-color)]/30 bg-[var(--accent-color)]/5 mb-8">
        <Heatmap memos={data.memos} />
      </div>
    {/if}

    {#each memoList.visibleMemos as memo (memo.slug)}
      <article
        in:slide
        class="group relative pl-6 border-l-2 border-[var(--text-color)]/20 hover:border-[var(--accent-color)] transition-colors duration-300"
        id={memo.slug}
      >
        <div
          class="absolute -left-[5px] top-0 w-[8px] h-[8px] bg-[var(--bg-color)] border border-[var(--text-color)] group-hover:bg-[var(--accent-color)] group-hover:border-[var(--accent-color)] transition-colors"
        ></div>
        <header class="mb-4 flex items-baseline gap-4 opacity-70 group-hover:opacity-100 transition-opacity">
          <h2 class="text-sm font-bold tracking-widest text-[var(--accent-color)] uppercase">
            LOG ID: {format(new Date(memo.date), 'yyyyMMdd')}
          </h2>
          <span class="text-xs font-mono text-[var(--text-color)]/60">
            T-{format(new Date(memo.date), 'HH:mm')}
          </span>
        </header>

        <div
          class="max-w-none text-[var(--text-color)]/90
                   [&_h1]:text-[1.35rem] [&_h1]:font-black [&_h1]:mb-4 [&_h1]:mt-5 [&_h1]:tracking-[0.15em] [&_h1]:text-[var(--accent-color)]
                   [&_h2]:text-[1.25rem] [&_h2]:font-bold [&_h2]:mb-3 [&_h2]:mt-4 [&_h2]:tracking-[0.15em] [&_h2]:text-[var(--accent-color)]
                   [&_h3]:text-[1.15rem] [&_h3]:font-bold [&_h3]:mb-2 [&_h3]:mt-3 [&_h3]:tracking-[0.15em] [&_h3]:text-[var(--accent-color)]
                   [&_h4]:text-[1.05rem] [&_h4]:font-bold [&_h4]:mb-2 [&_h4]:mt-2 [&_h4]:tracking-[0.15em] [&_h4]:text-[var(--accent-color)]
                   [&_h5]:text-[0.95rem] [&_h5]:font-bold [&_h5]:italic [&_h5]:mb-2 [&_h5]:tracking-[0.15em] [&_h5]:text-[var(--accent-color)]
                   [&_p]:my-4
                   [&_a]:text-[var(--accent-color)] [&_a]:underline [&_a]:underline-offset-4 [&_a]:decoration-1 [&_a]:hover:bg-[var(--accent-color)]/10
                   [&_strong]:text-white
                   [&_code]:text-[var(--accent-color)] [&_code]:bg-[var(--accent-color)]/10 [&_code]:px-1
                   [&_table]:w-full [&_table]:border-collapse [&_table]:my-6 [&_table]:text-sm [&_table]:border [&_table]:border-[var(--accent-color)]/50
                   [&_th]:bg-[var(--accent-color)]/10 [&_th]:text-[var(--accent-color)] [&_th]:p-3 [&_th]:border-b-2 [&_th]:border-dashed [&_th]:border-[var(--accent-color)]/50 [&_th]:uppercase [&_th]:tracking-wider [&_th]:text-center
                   [&_td]:p-3 [&_td]:border-b [&_td]:border-dashed [&_td]:border-[var(--accent-color)]/30 [&_td]:text-center
                   [&_blockquote]:border-l-4 [&_blockquote]:border-[var(--accent-color)] [&_blockquote]:pl-4 [&_blockquote]:py-1 [&_blockquote]:my-3 [&_blockquote]:italic [&_blockquote]:text-[0.95rem] [&_blockquote]:bg-[var(--accent-color)]/5
                   [&_pre]:bg-black/40 [&_pre]:border [&_pre]:border-[var(--accent-color)]/30 [&_pre]:p-4 [&_pre]:overflow-x-auto [&_pre]:my-4 [&_pre]:text-sm
                   [&_pre_code]:text-[var(--accent-color)] [&_pre_code]:bg-transparent [&_pre_code]:p-0
                   [&_.tag-link]:inline-block [&_.tag-link]:px-2 [&_.tag-link]:py-0.5 [&_.tag-link]:border [&_.tag-link]:border-[var(--text-color)]/30 [&_.tag-link]:text-[10px] [&_.tag-link]:tracking-widest [&_.tag-link]:uppercase [&_.tag-link]:text-[var(--text-color)]/60 [&_.tag-link:hover]:bg-[var(--text-color)] [&_.tag-link:hover]:text-[var(--bg-color)] [&_.tag-link]:transition-colors [&_.tag-link]:cursor-pointer [&_.tag-link]:no-underline"
          onclick={(e) => {
            const target = e.target as HTMLElement;
            if (target.classList.contains('tag-link')) {
              const tag = target.dataset.tag;
              if (tag) memoList.selectTag(tag);
            }
          }}
        >
          {@html marked.parse(memo.content)}
        </div>

        <style>
          .glitch-text::before,
          .glitch-text::after {
            content: attr(data-text);
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
          }

          .glitch-text::before {
            left: 2px;
            text-shadow: -2px 0 #ff00c1;
            clip: rect(44px, 450px, 56px, 0);
            animation: glitch-anim 5s infinite linear alternate-reverse;
          }

          .glitch-text::after {
            left: -2px;
            text-shadow: -2px 0 #00fff9;
            clip: rect(44px, 450px, 56px, 0);
            animation: glitch-anim2 5s infinite linear alternate-reverse;
          }

          @keyframes glitch-anim {
            0% {
              clip: rect(31px, 9999px, 94px, 0);
            }
            20% {
              clip: rect(62px, 9999px, 42px, 0);
            }
            40% {
              clip: rect(16px, 9999px, 78px, 0);
            }
            60% {
              clip: rect(85px, 9999px, 13px, 0);
            }
            80% {
              clip: rect(54px, 9999px, 91px, 0);
            }
            100% {
              clip: rect(4px, 9999px, 29px, 0);
            }
          }

          @keyframes glitch-anim2 {
            0% {
              clip: rect(65px, 9999px, 100px, 0);
            }
            20% {
              clip: rect(25px, 9999px, 34px, 0);
            }
            40% {
              clip: rect(89px, 9999px, 12px, 0);
            }
            60% {
              clip: rect(43px, 9999px, 67px, 0);
            }
            80% {
              clip: rect(11px, 9999px, 5px, 0);
            }
            100% {
              clip: rect(78px, 9999px, 46px, 0);
            }
          }

          [data-selected-tag] :global(.tag-link) {
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          }

          /* When a tag is selected, dim other tags and highlight the active one */
          [data-selected-tag]:not([data-selected-tag='null']) :global(.tag-link) {
            opacity: 0.3;
            filter: blur(0.5px);
          }

          /* Active tag gets neon highlight */
          [data-selected-tag="Academic"] :global(.tag-link[data-tag="Academic"]),
  [data-selected-tag="Bento"] :global(.tag-link[data-tag="Bento"]),
  [data-selected-tag="Cyberpunk"] :global(.tag-link[data-tag="Cyberpunk"]),
  [data-selected-tag="Pixel"] :global(.tag-link[data-tag="Pixel"]),
  [data-selected-tag="Receipt"] :global(.tag-link[data-tag="Receipt"]),
  /* Generic selector that works for any tag if the attribute matches exactly */
  [data-selected-tag]:not([data-selected-tag="null"]) :global(.tag-link.active) {
            opacity: 1 !important;
            filter: blur(0) !important;
            background-color: var(--accent-color) !important;
            color: var(--bg-color) !important;
            border-color: var(--accent-color) !important;
            box-shadow: 0 0 15px var(--accent-color) !important;
            font-weight: 900 !important;
            letter-spacing: 0.1em !important;
          }
        </style>
      </article>
    {/each}

    {#if memoList.visibleMemos.length < memoList.filteredMemos.length}
      <div class="text-center py-8">
        <button
          onclick={memoList.loadMore}
          class="inline-block px-8 py-2 border border-[var(--accent-color)] text-[var(--accent-color)] text-sm tracking-[0.2em] hover:bg-[var(--accent-color)] hover:text-[var(--bg-color)] transition-all"
        >
          // LOAD_MORE_DATA
        </button>
      </div>
    {/if}
  </main>

    <footer class="mt-20 mx-12 text-center text-xs tracking-widest pb-8">
            © {new Date().getFullYear()} {config.author}
            <span class="mx-2 text-[var(--accent-color)]">::</span>
            synced from Apple Notes and powered by <a href="https://moire.blog/" target="_blank" class="text-[var(--accent-color)] hover:bg-[var(--accent-color)] hover:text-[var(--bg-color)] transition-colors px-1">MOIRE.BLOG</a>
    </footer>
</div>
