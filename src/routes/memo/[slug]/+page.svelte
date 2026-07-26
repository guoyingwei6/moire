<script lang="ts">
  import type { PageData } from './$types';
  import { config } from '../../../../moire.config';

  let { data }: { data: PageData } = $props();

  const memo = $derived(data.memo);
  const publishedAt = $derived(new Date(memo.date));
  const publishedAtIso = $derived(publishedAt.toISOString());
  const publishedAtLabel = $derived(
    new Intl.DateTimeFormat('zh-CN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(publishedAt)
  );
  const siteUrl = config.url.replace(/\/+$/, '');
  const canonicalUrl = $derived(`${ siteUrl }/memo/${ encodeURIComponent(memo.slug) }/`);
  const detailContent = $derived(
    memo.content
      .replace(/\b(src|href)=(['"])\.\//gi, '$1=$2../../')
      .replace(
        /<button class="tag-link" data-tag="[^"]*">([\s\S]*?)<\/button>/gi,
        '<span class="tag-link">$1</span>'
      )
  );
  const schema = $derived({
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: memo.title,
    description: memo.excerpt,
    datePublished: publishedAtIso,
    url: canonicalUrl,
    mainEntityOfPage: canonicalUrl,
    image: `${ siteUrl }/icon.svg`,
    author: {
      '@type': 'Person',
      name: config.author
    },
    keywords: memo.tags.join(', ')
  });
  const schemaJson = $derived(JSON.stringify(schema).replace(/</g, '\\u003c'));
</script>

<svelte:head>
  <title>{memo.title} | {config.title}</title>
  <meta name="description" content={memo.excerpt} />
  <link rel="canonical" href={canonicalUrl} />

  <meta property="og:type" content="article" />
  <meta property="og:url" content={canonicalUrl} />
  <meta property="og:title" content={memo.title} />
  <meta property="og:description" content={memo.excerpt} />
  <meta property="og:image" content={`${ siteUrl }/icon.svg`} />
  <meta property="article:published_time" content={publishedAtIso} />
  {#each memo.tags as tag}
    <meta property="article:tag" content={tag} />
  {/each}

  <meta name="twitter:card" content="summary" />
  <meta name="twitter:url" content={canonicalUrl} />
  <meta name="twitter:title" content={memo.title} />
  <meta name="twitter:description" content={memo.excerpt} />
  <meta name="twitter:image" content={`${ siteUrl }/icon.svg`} />

  {@html `<script type="application/ld+json">${schemaJson}</script>`}
</svelte:head>

<main class="memo-page">
  <nav aria-label="页面导航">
    <a class="back-link" href="../../">← 返回首页</a>
  </nav>

  <article>
    <header class="memo-header">
      <h1>{memo.title}</h1>
      <time datetime={publishedAtIso}>{publishedAtLabel}</time>
    </header>

    <div class="memo-content">
      {@html detailContent}
    </div>
  </article>
</main>

<style>
  .memo-page {
    box-sizing: border-box;
    width: min(100% - 2rem, 48rem);
    margin: 0 auto;
    padding: 2rem 0 4rem;
  }

  nav {
    margin-bottom: 2.5rem;
  }

  .back-link {
    color: var(--accent-color, #9a6700);
    font-size: 0.9rem;
    text-decoration: none;
  }

  .back-link:hover {
    text-decoration: underline;
    text-underline-offset: 0.2em;
  }

  .memo-header {
    margin-bottom: 2rem;
    padding-bottom: 1.5rem;
    border-bottom: 1px solid color-mix(in srgb, var(--text-color) 12%, transparent);
  }

  h1 {
    margin: 0 0 0.65rem;
    font-size: clamp(1.8rem, 6vw, 2.6rem);
    line-height: 1.2;
    letter-spacing: -0.025em;
  }

  time {
    color: color-mix(in srgb, var(--text-color) 62%, transparent);
    font-size: 0.85rem;
  }

  .memo-content {
    font-size: 1rem;
    line-height: 1.75;
  }

  .memo-content :global(h1),
  .memo-content :global(h2),
  .memo-content :global(h3),
  .memo-content :global(h4) {
    margin: 1.8em 0 0.65em;
    line-height: 1.3;
  }

  .memo-content :global(p) {
    margin: 0 0 1em;
  }

  .memo-content :global(a) {
    color: var(--accent-color, #9a6700);
  }

  .memo-content :global(img) {
    display: block;
    max-width: 100%;
    height: auto;
    margin: 1.5rem auto;
    border-radius: 0.35rem;
  }

  .memo-content :global(pre),
  .memo-content :global(table) {
    max-width: 100%;
    overflow-x: auto;
  }

  .memo-content :global(pre) {
    padding: 1rem;
    border-radius: 0.4rem;
    background: color-mix(in srgb, var(--text-color) 7%, transparent);
  }

  .memo-content :global(code) {
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    font-size: 0.9em;
  }

  .memo-content :global(.tag-link) {
    appearance: none;
    padding: 0;
    border: 0;
    background: transparent;
    color: var(--accent-color, #9a6700);
    font: inherit;
  }

  @media (min-width: 48rem) {
    .memo-page {
      padding-top: 3.5rem;
    }
  }
</style>
