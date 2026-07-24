<script lang="ts">
  import { base } from '$app/paths';
  import type { PageData } from './$types';
  import { config } from '../../../moire.config';

  let { data }: { data: PageData } = $props();
  const href = (route: string) => `${base}${route}` || '/';
  const canonical = `${config.url}/tags/`;
</script>

<svelte:head>
  <title>{config.title} (tags)</title>
  <meta name="description" content={`Tags used on ${config.title}`} />
  <link rel="canonical" href={canonical} />
  <meta property="og:type" content="website" />
  <meta property="og:url" content={canonical} />
  <meta property="og:title" content={`${config.title} (tags)`} />
</svelte:head>

<h1>{config.title} (tags)</h1>

{#if data.groups.length}
  <ul class="tag-index">
    {#each data.groups as group}
      <li><a href={href(`/tags/${encodeURIComponent(group.slug)}/`)}>#{group.tag} <span>{group.entries.length}</span></a></li>
    {/each}
  </ul>
{:else}
  <p class="empty-state">No tags yet.</p>
{/if}
