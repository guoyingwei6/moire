<script lang="ts">
  let {
    query,
    onQueryChange,
    resultCount,
    totalCount,
    months,
    selectedMonth,
    onMonthChange,
    tags,
    selectedTag,
    onTagChange,
    onClearFilters
  }: {
    query: string;
    onQueryChange: (query: string) => void;
    resultCount: number;
    totalCount: number;
    months: { value: string; label: string }[];
    selectedMonth: string;
    onMonthChange: (month: string) => void;
    tags: { name: string; count: number }[];
    selectedTag: string;
    onTagChange: (tag: string) => void;
    onClearFilters: () => void;
  } = $props();
</script>

<div class="memo-search" role="search">
  <label for="memo-search-input">Search memos</label>
  <div class="memo-search-row">
    <div class="memo-search-control">
      <svg aria-hidden="true" viewBox="0 0 24 24" width="17" height="17">
        <circle cx="11" cy="11" r="7"></circle>
        <path d="m16.5 16.5 4 4"></path>
      </svg>
      <input
        id="memo-search-input"
        type="search"
        value={query}
        placeholder="Search titles, text, or tags…"
        autocomplete="off"
        oninput={(event) => onQueryChange(event.currentTarget.value)}
      />
      {#if query}
        <button type="button" onclick={() => onQueryChange('')} aria-label="Clear search">×</button>
      {/if}
    </div>
    <select
      aria-label="Filter by month"
      value={selectedMonth}
      onchange={(event) => onMonthChange(event.currentTarget.value)}
    >
      <option value="">All dates</option>
      {#each months as month}
        <option value={month.value}>{month.label}</option>
      {/each}
    </select>
  </div>

  {#if tags.length > 0}
    <div class="memo-tags" aria-label="Filter by tag">
      {#each tags as tag}
        <button
          type="button"
          class:active={selectedTag === tag.name}
          aria-pressed={selectedTag === tag.name}
          onclick={() => onTagChange(selectedTag === tag.name ? '' : tag.name)}
        >#{tag.name} <span>{tag.count}</span></button>
      {/each}
    </div>
  {/if}

  {#if query || selectedMonth || selectedTag}
    <div class="memo-search-status">
      <p aria-live="polite">{resultCount} of {totalCount} memos</p>
      <button class="clear-filters" type="button" onclick={onClearFilters}>Clear all</button>
    </div>
  {/if}
</div>

<style>
  .memo-search {
    width: min(42rem, calc(100% - 2.5rem));
    margin: 1.25rem auto 0;
    color: var(--text-color, #1d1d1f);
    position: relative;
    z-index: 100;
  }

  label {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }

  .memo-search-row {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 0.55rem;
  }

  .memo-search-control,
  select {
    border: 1px solid color-mix(in srgb, currentColor 18%, transparent);
    border-radius: 0.8rem;
    color: inherit;
    background: color-mix(in srgb, var(--bg-color, white) 88%, transparent);
    backdrop-filter: blur(12px);
  }

  .memo-search-control {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    padding: 0.6rem 0.8rem;
  }

  select {
    max-width: 9rem;
    padding: 0.55rem 1.8rem 0.55rem 0.7rem;
    font: inherit;
    font-size: 0.8rem;
    cursor: pointer;
  }

  svg {
    flex: none;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.8;
    opacity: 0.55;
  }

  input {
    width: 100%;
    min-width: 0;
    border: 0;
    outline: 0;
    color: inherit;
    background: transparent;
    font: inherit;
    font-size: 0.9rem;
  }

  input::placeholder {
    color: currentColor;
    opacity: 0.42;
  }

  button {
    width: 1.65rem;
    height: 1.65rem;
    border: 0;
    border-radius: 999px;
    color: inherit;
    background: color-mix(in srgb, currentColor 10%, transparent);
    cursor: pointer;
    font-size: 1rem;
    line-height: 1;
  }

  p {
    margin: 0;
    font-size: 0.72rem;
    opacity: 0.58;
  }

  .memo-search-status {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    margin: 0.4rem 0.25rem 0;
  }

  .clear-filters {
    width: auto;
    height: auto;
    padding: 0;
    border-radius: 0;
    border-bottom: 1px dotted currentColor;
    background: transparent;
    font-size: 0.72rem;
  }

  .memo-tags {
    display: flex;
    gap: 0.4rem;
    margin-top: 0.55rem;
    padding-bottom: 0.15rem;
    overflow-x: auto;
    scrollbar-width: thin;
  }

  .memo-tags button {
    width: auto;
    height: auto;
    flex: none;
    padding: 0.3rem 0.55rem;
    border: 1px solid color-mix(in srgb, currentColor 14%, transparent);
    font-size: 0.72rem;
    white-space: nowrap;
  }

  .memo-tags button.active {
    color: var(--bg-color, white);
    background: var(--text-color, #1d1d1f);
  }

  .memo-tags span {
    opacity: 0.58;
  }

  @media (max-width: 520px) {
    .memo-search-row {
      grid-template-columns: 1fr;
    }

    select {
      max-width: none;
      width: 100%;
    }
  }

  @media print {
    .memo-search {
      display: none;
    }
  }
</style>
