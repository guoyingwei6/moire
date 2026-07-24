<script lang="ts">
  import { base } from '$app/paths';
  import { page } from '$app/state';
  import { config } from '../../moire.config';

  const heading = $derived(page.status === 404 ? 'Page not found' : 'Something went wrong');
  const description = $derived(
    page.status === 404
      ? 'This note or folder does not exist, or it may have moved.'
      : (page.error?.message || 'The page could not be loaded.')
  );
</script>

<svelte:head>
  <title>{page.status} | {config.title}</title>
  <meta name="robots" content="noindex" />
</svelte:head>

<h1>{heading}</h1>
<p>{description}</p>
<a class="error-home" href={`${base}/` || '/'}>Return home</a>

<style>
  p {
    margin: 0 0 1rem;
    color: var(--secondary);
  }

  .error-home {
    color: var(--accent);
  }
</style>
