<script lang="ts">
  import { slide } from 'svelte/transition';
  import {format} from 'date-fns';
  import avatar from '$lib/assets/avatar.png';
  import type {PageData} from '../../routes/$types';
  import {createMemoList} from '$lib/memo.svelte';
  import Background from './Background.svelte';

  let {data, config}: {data: PageData; config: any} = $props();
  const memoList = createMemoList(() => data, config);

  $effect(() => {
    if (memoList.selectedTag) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  });
</script>

<div class="flex justify-center sm:m-10 min-h-screen {config.theme} relative isolate">
  <Background />
  <div
    class="w-full max-w-[540px] bg-[var(--card-bg)] px-4 sm:p-6 pt-8 shadow-[0_0_10px_rgba(0,0,0,0.1)] relative drop-shadow-[0px_2px_4px_rgba(0,0,0,0.1)] sm:border-y border-dashed border-[#ccc]"
  >
    <header class="text-center mb-5">
      <div class="text-4xl font-black tracking-[4px] mb-2.5">{config.title.toUpperCase()}</div>
      <div class="text-xs uppercase mb-2.5">
        <p>STORE: 001</p>
        <p>CASHIER: {config.author.toUpperCase()}</p>
        <p>{new Date().toLocaleDateString()}</p>
      </div>
      <div class="font-bold overflow-hidden whitespace-nowrap my-2.5">================================</div>

      {#if memoList.selectedTag}
        <div class="mb-5 text-center">
          <div class="text-xs font-bold mb-2">
            FILTERING BY: <button
              class="bg-transparent border border-black px-1 py-0.5 text-xs cursor-pointer uppercase transition-all duration-200 inline-block hover:text-black [&.active]:text-black active"
              onclick={() => memoList.selectTag(null)}>#{memoList.selectedTag}</button
            >
          </div>
          <div class="font-bold overflow-hidden whitespace-nowrap my-2.5">--------------------------------</div>
        </div>
      {/if}
    </header>

    <div
      onclick={(e) => {
        const target = (e.target as HTMLElement).closest('button[data-tag]');
        if (target) {
          const tag = (target as HTMLElement).dataset.tag || null;
          if (tag) memoList.selectTag(tag);
        }
      }}
      role="presentation"
    >
      {#each Object.entries(memoList.groupedMemos) as [dateKey, memos] (dateKey)}
        <div class="mb-[30px]" in:slide>
          <div class="text-center mb-4 font-bold text-sm">
            <span>*** {format(new Date(dateKey + 'T00:00:00'), 'MMM dd, yyyy').toUpperCase()} ***</span>
          </div>

          {#each memos as memo (memo.slug)}
            <div class="flex gap-2 mb-4 items-start -mx-1" id={memo.slug} in:slide>
              <div class="flex flex-col items-center gap-1 w-10 shrink-0 mt-4">
                <div class="w-8 h-8 md:w-9 md:h-9 rounded-full overflow-hidden">
                  <img
                    src={avatar}
                    alt="User"
                    class="w-full h-full object-contain"
                    onerror={(e) => ((e.currentTarget as HTMLImageElement).style.display = 'none')}
                  />
                </div>
                <span class="text-xs font-bold">{format(memo.date, 'HH:mm')}</span>
              </div>
              <div
                class="flex-1 text-[0.95rem] 
                  [&_h1]:text-[1.2rem] [&_h1]:uppercase [&_h1]:font-black [&_h1]:mb-2 [&_h1]:mt-4
                  [&_h2]:text-[1.1rem] [&_h2]:uppercase [&_h2]:font-bold [&_h2]:mb-2 [&_h2]:mt-4
                  [&_h3]:text-[1.0rem] [&_h3]:font-bold [&_h3]:mb-1.5 [&_h3]:mt-3
                  [&_h4]:text-[0.9rem] [&_h4]:font-bold [&_h4]:mb-1 [&_h4]:mt-2
                  [&_h5]:text-[0.8rem] [&_h5]:font-bold [&_h5]:italic [&_h5]:mb-1
                  [&_p]:my-4 [&_img]:grayscale [&_img]:contrast-120 [&_img]:max-w-full [&_img]:my-5 [&_img]:border-2 [&_img]:border-black [&_img]:transition-all [&_img]:duration-500 hover:[&_img]:grayscale-0 hover:[&_img]:border-transparent
                  [&_a]:underline [&_a]:decoration-1 [&_a]:underline-offset-2 [&_a]:hover:bg-black [&_a]:hover:text-white
                  [&_table]:w-full [&_table]:border-collapse [&_table]:my-3 [&_table]:text-xs
                  [&_th]:border-b-2 [&_th]:border-black [&_th]:border-dashed [&_th]:py-1 [&_th]:uppercase
                  [&_td]:py-1 [&_td]:px-1 [&_td]:border-b [&_td]:border-[#ccc] [&_td]:border-dashed
                  [&_blockquote]:border-l-4 [&_blockquote]:border-black [&_blockquote]:pl-4 [&_blockquote]:py-1 [&_blockquote]:my-4 [&_blockquote]:italic [&_blockquote]:text-[0.9rem] [&_blockquote]:bg-black/5
                  [&_code]:font-mono [&_code]:bg-black/5 [&_code]:px-1
                  [&_pre]:border-y-2 [&_pre]:border-dashed [&_pre]:border-[#ccc] [&_pre]:py-3 [&_pre]:my-4 [&_pre]:overflow-x-auto [&_pre]:text-xs
                  [&_pre_code]:bg-transparent [&_pre_code]:p-0
                  [&_.tag-link]:bg-transparent [&_.tag-link]:font-bold [&_.tag-link]:underline [&_.tag-link]:decoration-dashed [&_.tag-link]:underline-offset-3 [&_.tag-link]:hover:bg-black [&_.tag-link]:hover:text-white
                "
              >
                {@html memo.content}
              </div>
            </div>
          {/each}
        </div>
      {/each}

      {#if data.memos.length === 0}
          <p class="text-center">NO DATA.</p>
      {/if}

      {#if memoList.visibleCount < memoList.filteredMemos.length}
        <div class="text-center my-5">
          <button
            class="bg-transparent border-2 dashed border-black px-4 py-1 text-xs cursor-pointer uppercase font-bold hover:bg-black hover:text-white transition-colors"
            onclick={memoList.loadMore}>[ PRINT MORE... ]</button
          >
        </div>
      {/if}
    </div>

    <footer class="text-center mt-10 text-xs">
      <div class="font-bold overflow-hidden whitespace-nowrap my-2.5">================================</div>
      <p>TOTAL ITEMS: {data.memos.length}</p>
      <p>THANK YOU FOR VISITING</p>

      <div class="font-['Libre_Barcode_39',cursive] text-3xl my-5 tracking-[5px]">||||| |||| || | ||||| || |</div>

      <div class="my-5 text-[#999]">- - - - - - - - - - - - - - -</div>

      <p class="mt-8 mb-1">© {new Date().getFullYear()} {config.author.toUpperCase()}</p>
      <p class="mb-4">synced from Apple Notes and powered by <a href="https://moire.blog/" target="_blank" class="underline decoration-dotted hover:bg-black hover:text-white transition-colors">MOIRE.BLOG</a></p>
    </footer>
  </div>
</div>
