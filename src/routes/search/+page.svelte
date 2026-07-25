<script lang="ts">
  import type { PageData } from './$types';
  import { filterSearchEntries } from '$lib/search.js';
  import { config } from '../../../moire.config';

  let { data }: { data: PageData } = $props();
  let query = $state('');
  let searchInput: HTMLInputElement;

  const results = $derived(filterSearchEntries(data.entries, query));
  const hasQuery = $derived(query.trim().length > 0);
  const resultCount = $derived(`${results.length} ${results.length === 1 ? 'result' : 'results'}`);
  const canonical = `${config.url.replace(/\/$/, '')}/search/`;

  const displayDate = (value: string) => new Intl.DateTimeFormat('en', {
    month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC'
  }).format(new Date(value));

  const clearSearch = () => {
    query = '';
    searchInput.focus();
  };
</script>

<svelte:head>
  <title>{config.title} (search)</title>
  <meta name="description" content={`Search public notes on ${config.title}`} />
  <link rel="canonical" href={canonical} />
  <meta property="og:type" content="website" />
  <meta property="og:url" content={canonical} />
  <meta property="og:title" content={`${config.title} (search)`} />
</svelte:head>

<h1>{config.title} (search)</h1>

<div class="search-form" role="search">
  <label for="site-search">Search notes</label>
  <div class="search-control">
    <input
      bind:this={searchInput}
      bind:value={query}
      id="site-search"
      type="search"
      placeholder="Title, text or tag"
      autocomplete="off"
      aria-controls="search-results"
    />
    {#if query}
      <button type="button" onclick={clearSearch}>Clear</button>
    {/if}
  </div>
</div>

<p class="search-status" role="status" aria-live="polite" aria-atomic="true">
  {#if hasQuery}{resultCount}{:else}Type a word or tag to search public notes.{/if}
</p>

<div id="search-results">
  {#if hasQuery && results.length}
    <ol class="search-results">
      {#each results as entry}
        <li>
          <div class="search-result-heading">
            <h2><a href={entry.href}>{entry.title}</a></h2>
            {#if entry.created}<time datetime={entry.created}>{displayDate(entry.created)}</time>{/if}
          </div>
          {#if entry.summary}<p>{entry.summary}</p>{/if}
          {#if entry.tags.length}
            <ul aria-label={`Tags for ${entry.title}`}>
              {#each entry.tags as tag}<li>#{tag}</li>{/each}
            </ul>
          {/if}
        </li>
      {/each}
    </ol>
  {:else if hasQuery}
    <p class="empty-state">No public notes match “{query.trim()}”.</p>
  {/if}
</div>
