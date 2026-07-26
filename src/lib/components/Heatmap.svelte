<script lang="ts">
  import type {Memo} from '$lib/server/memos';
  import {eachDayOfInterval, format, startOfDay, subDays} from 'date-fns';
  import {onMount} from 'svelte';

  let {
    memos,
    selectedDate = null,
    onSelectDate,
  }: {
    memos: Memo[];
    selectedDate?: string | null;
    onSelectDate?: (dateKey: string) => void;
  } = $props();

  const today = startOfDay(new Date());
  const rangeStart = subDays(today, 364);
  const days = eachDayOfInterval({start: rangeStart, end: today});
  const firstWeekday = rangeStart.getDay();
  const numColumns = Math.ceil((firstWeekday + days.length) / 7);

  const calendarDays = days.map((date, index) => ({
    date,
    dateKey: format(date, 'yyyy-MM-dd'),
    column: Math.floor((firstWeekday + index) / 7) + 1,
    row: date.getDay() + 1,
  }));

  const rangeKeys = new Set(calendarDays.map(({dateKey}) => dateKey));

  const monthLabels = calendarDays
    .filter(({date}) => date.getDate() === 1)
    .map(({date, column}) => ({
      label: format(date, 'M月'),
      column,
      align: column >= numColumns - 1 ? 'end' : 'start',
    }));

  const weekdayLabels = [
    {short: '日', full: '星期日'},
    {short: '一', full: '星期一'},
    {short: '二', full: '星期二'},
    {short: '三', full: '星期三'},
    {short: '四', full: '星期四'},
    {short: '五', full: '星期五'},
    {short: '六', full: '星期六'},
  ];

  const memoCounts = $derived.by(() => {
    const counts = new Map<string, number>();

    memos?.forEach((memo) => {
      const dateKey = format(new Date(memo.date), 'yyyy-MM-dd');
      if (rangeKeys.has(dateKey)) {
        counts.set(dateKey, (counts.get(dateKey) ?? 0) + 1);
      }
    });

    return counts;
  });

  const totalMemos = $derived(Array.from(memoCounts.values()).reduce((total, count) => total + count, 0));
  const maxMemos = $derived(Math.max(1, ...Array.from(memoCounts.values())));

  function getLevel(count: number) {
    if (count === 0) return 0;
    if (count === 1) return 1;
    if (maxMemos <= 3) return count;

    const percentage = count / maxMemos;
    if (percentage <= 0.33) return 2;
    if (percentage <= 0.66) return 3;
    return 4;
  }

  const cells = $derived(
    calendarDays.map((day) => {
      const count = memoCounts.get(day.dateKey) ?? 0;
      return {
        ...day,
        count,
        level: getLevel(count),
        label: `${format(day.date, 'yyyy年M月d日')}：${count} 条`,
      };
    })
  );

  let scrollContainer: HTMLDivElement | undefined = $state();

  onMount(() => {
    if (scrollContainer && scrollContainer.scrollWidth > scrollContainer.clientWidth) {
      scrollContainer.scrollLeft = scrollContainer.scrollWidth;
    }
  });

  function handleGridClick(event: MouseEvent) {
    const target = event.target;
    if (!(target instanceof Element)) return;

    const cell = target.closest('button[data-date-key]');
    if (!(cell instanceof HTMLButtonElement)) return;

    const dateKey = cell.dataset.dateKey;
    if (dateKey) onSelectDate?.(dateKey);
  }

  function delegateDateSelection(node: HTMLElement) {
    node.addEventListener('click', handleGridClick);

    return {
      destroy() {
        node.removeEventListener('click', handleGridClick);
      },
    };
  }
</script>

<section class="heatmap" aria-labelledby="heatmap-summary">
  {#if totalMemos === 0}
    <p id="heatmap-summary" class="heatmap-empty">过去一年暂无发布</p>
  {:else}
    <div class="heatmap-meta">
      <p id="heatmap-summary">过去一年 {totalMemos} 条</p>
      <div class="heatmap-legend" aria-label="颜色越深，发布数量越多">
        <span>少</span>
        {#each [0, 1, 2, 3, 4] as level}
          <i data-level={level}></i>
        {/each}
        <span>多</span>
      </div>
    </div>

    <div class="heatmap-chart">
      <div class="weekday-axis" aria-hidden="true">
        <div class="axis-spacer"></div>
        <div class="weekday-labels">
          {#each weekdayLabels as weekday}
            <span title={weekday.full}>{weekday.short}</span>
          {/each}
        </div>
      </div>

      <div bind:this={scrollContainer} class="heatmap-scroll">
        <div class="heatmap-content" style="--columns: {numColumns};">
          <div class="month-labels" aria-hidden="true">
            {#each monthLabels as month}
              <span style="grid-column: {month.column}; justify-self: {month.align};">{month.label}</span>
            {/each}
          </div>

          <div class="heatmap-grid" use:delegateDateSelection>
            {#each cells as cell (cell.dateKey)}
              {#if cell.count > 0}
                <button
                  type="button"
                  class="heatmap-cell heatmap-cell-active"
                  class:heatmap-cell-selected={selectedDate === cell.dateKey}
                  data-date-key={cell.dateKey}
                  data-level={cell.level}
                  title={cell.label}
                  aria-label={`${cell.label}，${selectedDate === cell.dateKey ? '已选择，再次选择可清除日期筛选' : '选择该日期'}`}
                  aria-pressed={selectedDate === cell.dateKey}
                  style="grid-column: {cell.column}; grid-row: {cell.row};"
                ></button>
              {:else}
                <span
                  class="heatmap-cell"
                  data-level="0"
                  title={cell.label}
                  aria-hidden="true"
                  style="grid-column: {cell.column}; grid-row: {cell.row};"
                ></span>
              {/if}
            {/each}
          </div>
        </div>
      </div>
    </div>
  {/if}
</section>

<style>
  .heatmap {
    --cell-size: 10px;
    --cell-gap: 3px;
    width: 100%;
    max-width: 42rem;
    min-width: 0;
    margin-inline: auto;
    padding-block: 0.75rem 1rem;
    color: var(--text-color);
  }

  .heatmap-meta {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    margin-bottom: 0.35rem;
    padding-inline: 1.4rem 0.25rem;
    font-size: 0.6875rem;
    line-height: 1;
    color: color-mix(in srgb, var(--text-color) 68%, transparent);
  }

  .heatmap-meta p {
    margin: 0;
    white-space: nowrap;
  }

  .heatmap-empty {
    margin: 0;
    padding: 0.45rem 0;
    text-align: center;
    font-size: 0.75rem;
    color: color-mix(in srgb, var(--text-color) 58%, transparent);
  }

  .heatmap-legend {
    display: flex;
    align-items: center;
    gap: 3px;
    white-space: nowrap;
  }

  .heatmap-legend i {
    width: 7px;
    height: 7px;
    border-radius: 1px;
    background-color: color-mix(in srgb, var(--accent-color, var(--text-color)) 10%, transparent);
  }

  .heatmap-chart {
    display: flex;
    width: 100%;
    min-width: 0;
  }

  .weekday-axis {
    flex: 0 0 1.25rem;
    font-size: 0.5625rem;
    line-height: var(--cell-size);
    color: color-mix(in srgb, var(--text-color) 58%, transparent);
    text-align: center;
    user-select: none;
  }

  .axis-spacer,
  .month-labels {
    height: 1rem;
    margin-bottom: 0.35rem;
  }

  .weekday-labels {
    display: grid;
    grid-template-rows: repeat(7, var(--cell-size));
    gap: var(--cell-gap);
  }

  .heatmap-scroll {
    flex: 1 1 auto;
    min-width: 0;
    max-width: 100%;
    overflow-x: auto;
    padding: 0 0.25rem 0.4rem 0;
    overscroll-behavior-inline: contain;
    scrollbar-width: thin;
    scrollbar-color: color-mix(in srgb, var(--text-color) 20%, transparent) transparent;
  }

  .heatmap-content {
    width: max-content;
  }

  .month-labels,
  .heatmap-grid {
    display: grid;
    grid-template-columns: repeat(var(--columns), var(--cell-size));
    column-gap: var(--cell-gap);
  }

  .month-labels {
    align-items: start;
    overflow: hidden;
    font-size: 0.5625rem;
    line-height: 1;
    color: color-mix(in srgb, var(--text-color) 58%, transparent);
    user-select: none;
  }

  .month-labels span {
    grid-row: 1;
    white-space: nowrap;
  }

  .heatmap-grid {
    grid-template-rows: repeat(7, var(--cell-size));
    row-gap: var(--cell-gap);
  }

  .heatmap-cell {
    box-sizing: border-box;
    display: block;
    width: var(--cell-size);
    height: var(--cell-size);
    min-width: 0;
    min-height: 0;
    margin: 0;
    padding: 0;
    border: 0;
    border-radius: 2px;
    appearance: none;
    background-color: color-mix(in srgb, var(--accent-color, var(--text-color)) 10%, transparent);
  }

  .heatmap-cell[data-level='1'],
  .heatmap-legend i[data-level='1'] {
    background-color: color-mix(in srgb, var(--accent-color, var(--text-color)) 30%, transparent);
  }

  .heatmap-cell[data-level='2'],
  .heatmap-legend i[data-level='2'] {
    background-color: color-mix(in srgb, var(--accent-color, var(--text-color)) 55%, transparent);
  }

  .heatmap-cell[data-level='3'],
  .heatmap-legend i[data-level='3'] {
    background-color: color-mix(in srgb, var(--accent-color, var(--text-color)) 80%, transparent);
  }

  .heatmap-cell[data-level='4'],
  .heatmap-legend i[data-level='4'] {
    background-color: var(--accent-color, var(--text-color));
  }

  .heatmap-cell-active {
    cursor: pointer;
    transition:
      outline-color 120ms ease,
      transform 120ms ease;
  }

  .heatmap-cell-active:hover,
  .heatmap-cell-active:focus-visible {
    z-index: 1;
    outline: 1px solid var(--text-color);
    outline-offset: 1px;
  }

  .heatmap-cell-active:focus-visible {
    transform: scale(1.12);
  }

  .heatmap-cell-selected {
    z-index: 1;
    outline: 2px solid var(--text-color);
    outline-offset: 1px;
    transform: scale(1.12);
  }

  .heatmap-cell-active:active {
    transform: scale(0.9);
  }

  .heatmap-scroll::-webkit-scrollbar {
    height: 4px;
    background: transparent;
  }

  .heatmap-scroll::-webkit-scrollbar-thumb {
    border-radius: 4px;
    background: color-mix(in srgb, var(--text-color) 20%, transparent);
  }

  .heatmap-scroll::-webkit-scrollbar-thumb:hover {
    background: color-mix(in srgb, var(--text-color) 40%, transparent);
  }

  @media (min-width: 640px) {
    .heatmap {
      --cell-size: 12px;
      --cell-gap: 4px;
    }

    .heatmap-meta {
      font-size: 0.75rem;
    }

    .weekday-axis,
    .month-labels {
      font-size: 0.625rem;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .heatmap-cell-active {
      transition: none;
    }
  }
</style>
