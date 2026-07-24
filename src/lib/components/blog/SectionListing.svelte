<script lang="ts">
  import { base } from '$app/paths';
  import type { ContentSummary } from '$lib/content';

  let { entries }: { entries: ContentSummary[] } = $props();

  const href = (route: string) => `${base}${route}` || '/';
  const displayDate = (value: string) => new Intl.DateTimeFormat('en', {
    month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC'
  }).format(new Date(value));
</script>

{#if entries.length}
  <div class="section-list">
    {#each entries as entry}
      <a class="section-list-item" href={href(entry.route)}>
        <span>{entry.title}</span>
        {#if entry.created}<time datetime={entry.created}>{displayDate(entry.created)}</time>{/if}
      </a>
    {/each}
  </div>
{:else}
  <p class="empty-state">No public notes in this folder yet.</p>
{/if}
