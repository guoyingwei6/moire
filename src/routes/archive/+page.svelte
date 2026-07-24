<script lang="ts">
  import type { PageData } from './$types';
  import SectionListing from '$lib/components/blog/SectionListing.svelte';
  import { config } from '../../../moire.config';

  let { data }: { data: PageData } = $props();
  const canonical = `${config.url}/archive/`;
</script>

<svelte:head>
  <title>{config.title} (archive)</title>
  <meta name="description" content={`Archive of ${config.title}`} />
  <link rel="canonical" href={canonical} />
  <meta property="og:type" content="website" />
  <meta property="og:url" content={canonical} />
  <meta property="og:title" content={`${config.title} (archive)`} />
</svelte:head>

<h1>{config.title} (archive)</h1>

{#if data.groups.length}
  <div class="archive-groups">
    {#each data.groups as group}
      <section>
        <h2>{group.label}</h2>
        <SectionListing entries={group.entries} />
      </section>
    {/each}
  </div>
{:else}
  <p class="empty-state">No published notes yet.</p>
{/if}
