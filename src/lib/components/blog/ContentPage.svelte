<script lang="ts">
  import { base } from '$app/paths';
  import type { ContentRecord, ContentSummary } from '$lib/content';
  import { config } from '../../../../moire.config';
  import SectionListing from './SectionListing.svelte';

  let {
    record,
    entries = [],
    folder = null,
    previous = null,
    next = null
  }: {
    record: ContentRecord;
    entries?: ContentSummary[];
    folder?: ContentSummary | null;
    previous?: ContentSummary | null;
    next?: ContentSummary | null;
  } = $props();

  const href = (route: string) => `${base}${route}` || '/';
  const canonical = $derived(`${config.url.replace(/\/$/, '')}${record.route === '/' ? '/' : record.route}`);
  const displayTitle = $derived(record.kind === 'home' ? config.title : record.title);
  const pageTitle = $derived(record.kind === 'home' ? config.title : `${record.title} | ${config.title}`);
  const displayDate = (value: string) => new Intl.DateTimeFormat('en', {
    month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC'
  }).format(new Date(value));
</script>

<svelte:head>
  <title>{pageTitle}</title>
  <meta name="description" content={record.summary || config.description} />
  <link rel="canonical" href={canonical} />
  <meta property="og:type" content={record.kind === 'post' ? 'article' : 'website'} />
  <meta property="og:url" content={canonical} />
  <meta property="og:title" content={displayTitle} />
  <meta property="og:description" content={record.summary || config.description} />
</svelte:head>

<h1>{displayTitle}</h1>

{#if config.features.folderName && record.kind === 'post' && folder && folder.route !== '/'}
  <a class="folder-name" href={href(folder.route)}>{folder.title}</a>
{/if}

{#if record.kind === 'post' && record.tags.length}
  <nav class="post-tags" aria-label="Tags">
    {#each record.tags as tag}
      <a href={href(`/tags/${encodeURIComponent(tag.toLocaleLowerCase().replace(/\s+/g, '-'))}/`)}>#{tag}</a>
    {/each}
  </nav>
{/if}

{#if record.html}
  <article
    class:home-article={record.kind === 'home'}
    class:photo-article={record.kind === 'post' && folder?.route === '/photo/'}
    class="markdown-content"
  >
    {@html record.html}
  </article>
{/if}

{#if record.kind === 'section'}
  <SectionListing {entries} />
{/if}

{#if record.kind === 'post'}
  {#if config.features.metadata}
    <dl class="post-metadata">
    {#if record.created}
      <div><dt>Date</dt><dd>{displayDate(record.created)}</dd></div>
    {/if}
    <div><dt>Words</dt><dd>{record.wordCount}</dd></div>
    <div><dt>Time to read</dt><dd>{record.readingMinutes} min</dd></div>
    </dl>
  {/if}

  {#if config.features.previousNext && (previous || next)}
    <nav class="post-navigation" aria-label="Post navigation">
      {#if previous}
        <a href={href(previous.route)}><small>Previous</small><span>{previous.title}</span></a>
      {/if}
      {#if next}
        <a class="next" href={href(next.route)}><small>Next</small><span>{next.title}</span></a>
      {/if}
    </nav>
  {/if}
{/if}
