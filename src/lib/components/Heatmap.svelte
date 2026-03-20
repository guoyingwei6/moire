<script lang="ts">
  import type {Memo} from '$lib/server/memos';
  import {format, startOfDay, startOfWeek, endOfWeek, eachDayOfInterval, subDays} from 'date-fns';
  import {onMount} from 'svelte';

  let {memos}: {memos: Memo[]} = $props();

  const today = startOfDay(new Date());

  const days = $derived.by(() => {
    let earliestDate = today;
    if (memos && memos.length > 0) {
      const minDateRaw = new Date(Math.min(...memos.map((m) => new Date(m.date).getTime())));
      earliestDate = startOfDay(minDateRaw);
    }

    // Enforce a minimum of half a year (approx 180 days)
    const sixMonthsAgo = subDays(today, 360);
    if (earliestDate > sixMonthsAgo) {
      earliestDate = sixMonthsAgo;
    }

    const startDate = startOfWeek(earliestDate, {weekStartsOn: 0});
    const endDate = endOfWeek(today, {weekStartsOn: 0});
    return eachDayOfInterval({start: startDate, end: endDate});
  });

  // Calculate columns needed to set the grid dynamically
  const numColumns = $derived(Math.ceil(days.length / 7));

  // Count actual memos
  const memoCounts = $derived.by(() => {
    const counts = new Map<string, number>();

    // Initialize all days
    days.forEach((day) => {
      counts.set(format(day, 'yyyy-MM-dd'), 0);
    });

    // Increment counts for each memo
    memos?.forEach((memo) => {
      const dateStr = format(new Date(memo.date), 'yyyy-MM-dd');
      if (counts.has(dateStr)) {
        counts.set(dateStr, counts.get(dateStr)! + 1);
      }
    });

    return counts;
  });

  const maxMemos = $derived(Math.max(1, ...Array.from(memoCounts.values())));

  const getLevel = (count: number) => {
    if (count === 0) return 0;
    if (count === 1) return 1;
    if (maxMemos <= 3) return count;

    const percentage = count / maxMemos;
    if (percentage <= 0.33) return 2;
    if (percentage <= 0.66) return 3;
    return 4;
  };

  let scrollContainer: HTMLDivElement | undefined = $state();

  onMount(() => {
    // Scroll to the end on mobile so user sees recent days first
    if (scrollContainer && scrollContainer.scrollWidth > scrollContainer.clientWidth) {
      scrollContainer.scrollLeft = scrollContainer.scrollWidth;
    }
  });

  // Tooltip State
  let hoveredCell = $state<{x: number; y: number; date: string; count: number} | null>(null);

  const handlePointerEnter = (e: PointerEvent, day: Date, count: number) => {
    const rect = (e.target as HTMLElement).getBoundingClientRect();
    hoveredCell = {
      x: window.scrollX + rect.left + rect.width / 2, // Document-relative X
      y: window.scrollY + rect.top - 8, // Document-relative Y
      date: format(day, 'MMM d, yyyy'),
      count,
    };
  };

  const handlePointerLeave = () => {
    hoveredCell = null;
  };

  function portal(node: HTMLElement) {
    if (typeof document === 'undefined') return;
    document.body.appendChild(node);
    return {
      destroy() {
        if (node.parentNode) {
          node.parentNode.removeChild(node);
        }
      },
    };
  }
</script>

<div
  use:portal
  class="absolute z-[10000] text-white pointer-events-none transform -translate-x-1/2 -translate-y-full px-2.5 py-1.5 rounded-[4px] text-[11px] font-medium tracking-wide whitespace-nowrap shadow-lg transition-opacity duration-150 {hoveredCell
    ? 'opacity-100'
    : 'opacity-0'}"
  style="left: {hoveredCell?.x ?? -9999}px; top: {hoveredCell?.y ??
    -9999}px; background-color: #24292f; font-family: -apple-system, BlinkMacSystemFont, sans-serif;"
>
  {hoveredCell?.count ?? 0} memo{(hoveredCell?.count ?? 0) !== 1 ? 's' : ''} on {hoveredCell?.date ?? ''}

  <!-- Tooltip Arrow -->
  <div
    class="absolute left-1/2 bottom-[1px] transform -translate-x-1/2 translate-y-full border-solid border-[5px] border-transparent"
    style="border-top-color: #24292f;"
  ></div>
</div>

<div class="w-full flex justify-center px-0 relative z-[9900]">
  <div
    bind:this={scrollContainer}
    class="heatmap-container w-full max-w-2xl overflow-x-auto py-4 flex sm:justify-center will-change-scroll"
    style="justify-content: {numColumns > 40 ? 'flex-start' : 'center'};"
  >
    <div
      class="heatmap-grid gap-[3px] sm:gap-[4px] min-w-max pb-2 px-1"
      style="grid-template-columns: repeat({numColumns}, 1fr);"
    >
      {#each days as day}
        <div
          class="heatmap-cell rounded-[2px] w-[10px] h-[10px] sm:w-[12px] sm:h-[12px] transition-colors duration-200"
          role="presentation"
          data-level={getLevel(memoCounts.get(format(day, 'yyyy-MM-dd')) || 0)}
          onpointerenter={(e) => handlePointerEnter(e, day, memoCounts.get(format(day, 'yyyy-MM-dd')) || 0)}
          onpointerleave={handlePointerLeave}
        ></div>
      {/each}
    </div>
  </div>
</div>

<style>
  .heatmap-grid {
    display: grid;
    grid-template-rows: repeat(7, 1fr);
    grid-auto-flow: column;
  }

  .heatmap-cell {
    background-color: color-mix(in srgb, var(--accent-color, var(--text-color)) 10%, transparent);
  }

  .heatmap-cell[data-level='1'] {
    background-color: color-mix(in srgb, var(--accent-color, var(--text-color)) 30%, transparent);
  }

  .heatmap-cell[data-level='2'] {
    background-color: color-mix(in srgb, var(--accent-color, var(--text-color)) 55%, transparent);
  }

  .heatmap-cell[data-level='3'] {
    background-color: color-mix(in srgb, var(--accent-color, var(--text-color)) 80%, transparent);
  }

  .heatmap-cell[data-level='4'] {
    background-color: var(--accent-color, var(--text-color));
  }

  .heatmap-cell:hover {
    outline: 1px solid var(--text-color);
    outline-offset: 1px;
    z-index: 10;
  }

  .heatmap-container::-webkit-scrollbar {
    height: 4px;
    background: transparent;
  }

  .heatmap-container::-webkit-scrollbar-thumb {
    background: color-mix(in srgb, var(--text-color) 20%, transparent);
    border-radius: 4px;
  }

  .heatmap-container::-webkit-scrollbar-thumb:hover {
    background: color-mix(in srgb, var(--text-color) 40%, transparent);
  }
</style>
