<script lang="ts">
  import { base } from '$app/paths';
  import type { PageData } from './$types';
  import { config } from '../../moire.config';

  let { data }: { data: PageData } = $props();

  const schema = $derived({
    '@context': 'https://schema.org',
    '@type': 'Blog',
    name: config.title,
    description: config.description,
    url: config.url,
    author: {
      '@type': 'Person',
      name: config.author
    },
    blogPost: data.memos.map((memo) => ({
      '@type': 'BlogPosting',
      headline: memo.title,
      datePublished: memo.date instanceof Date ? memo.date.toISOString() : memo.date,
      url: `${config.url}/memo/${memo.slug}/`,
      articleBody: memo.excerpt
    }))
  });

  const schemaJson = $derived(JSON.stringify(schema).replace(/</g, '\\u003c'));
</script>

<svelte:head>
  <title>{config.title}</title>
  <meta name="description" content={config.description} />
  <link rel="canonical" href={`${config.url}/`} />

  <meta property="og:type" content="website" />
  <meta property="og:url" content={`${config.url}/`} />
  <meta property="og:title" content={config.title} />
  <meta property="og:description" content={config.description} />
  <meta property="og:image" content={`${config.url}/icon.svg`} />

  <meta name="twitter:card" content="summary" />
  <meta name="twitter:url" content={`${config.url}/`} />
  <meta name="twitter:title" content={config.title} />
  <meta name="twitter:description" content={config.description} />
  <meta name="twitter:image" content={`${config.url}/icon.svg`} />

  {@html `<script type="application/ld+json">${schemaJson}</script>`}
</svelte:head>

<main class="index-page">
  <header>
    <h1>{config.title}</h1>
  </header>

  {#if data.memos.length > 0}
    <nav aria-label="笔记列表">
      <ul class="memo-list">
        {#each data.memos as memo}
          <li>
            <a href={`${base}/memo/${encodeURIComponent(memo.slug)}/`}>{memo.title}</a>
          </li>
        {/each}
      </ul>
    </nav>
  {:else}
    <p class="empty">暂无笔记</p>
  {/if}
</main>

<style>
  .index-page {
    box-sizing: border-box;
    width: min(100% - 2.5rem, 42rem);
    margin: 0 auto;
    padding: clamp(3.5rem, 12vw, 7rem) 0 5rem;
  }

  header {
    margin-bottom: 2.25rem;
  }

  h1 {
    margin: 0;
    font-size: clamp(1.45rem, 5vw, 1.85rem);
    font-weight: 600;
    letter-spacing: -0.025em;
  }

  .memo-list {
    margin: 0;
    padding: 0;
    border-top: 1px solid color-mix(in srgb, var(--text-color) 12%, transparent);
    list-style: none;
  }

  .memo-list li {
    margin: 0;
    border-bottom: 1px solid color-mix(in srgb, var(--text-color) 12%, transparent);
  }

  .memo-list a {
    display: block;
    padding: 1.1rem 0;
    color: inherit;
    font-size: clamp(1rem, 3vw, 1.08rem);
    line-height: 1.45;
    text-decoration: none;
    word-break: normal;
  }

  .memo-list a:hover {
    opacity: 0.55;
  }

  .memo-list a:focus-visible {
    border-radius: 0.2rem;
    outline: 2px solid var(--accent-color, currentColor);
    outline-offset: 0.35rem;
  }

  .empty {
    margin: 0;
    color: color-mix(in srgb, var(--text-color) 55%, transparent);
  }
</style>
