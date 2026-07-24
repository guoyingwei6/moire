<script lang="ts">
  import type { PageData } from './$types';
  import SectionListing from '$lib/components/blog/SectionListing.svelte';
  import { config } from '../../../../moire.config';

  let { data }: { data: PageData } = $props();
  const canonical = $derived(`${config.url}/tags/${encodeURIComponent(data.group.slug)}/`);
</script>

<svelte:head>
  <title>#{data.group.tag} | {config.title}</title>
  <meta name="description" content={`Notes tagged #${data.group.tag}`} />
  <link rel="canonical" href={canonical} />
  <meta property="og:type" content="website" />
  <meta property="og:url" content={canonical} />
  <meta property="og:title" content={`#${data.group.tag} | ${config.title}`} />
</svelte:head>

<h1>#{data.group.tag}</h1>
<SectionListing entries={data.group.entries} />
