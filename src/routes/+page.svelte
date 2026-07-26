<script lang="ts">
  import type { PageData } from './$types';
  import { config } from '../../moire.config';
  import ThemeComponent from 'virtual:moire-theme';

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

<ThemeComponent {data} {config} />
