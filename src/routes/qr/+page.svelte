<script lang="ts">
  import type { PageData } from './$types';
  import { config } from '../../../moire.config';

  let { data }: { data: PageData } = $props();
</script>

<svelte:head>
  <title>QR Code | {config.title}</title>
  <meta name="description" content={`QR Code for ${config.title}`} />
  <link rel="canonical" href={data.canonical} />
</svelte:head>

<h1>QR Code</h1>

<section class="qr-page">
  <p>Scan this code to open {config.title}.</p>
  <img src={data.image} alt={`QR Code for ${config.title}`} width="640" height="640" />
  <a href={data.target}>{data.target}</a>
</section>

<style>
  .qr-page {
    max-width: 24rem;
  }

  p {
    margin-top: 0;
  }

  img {
    display: block;
    width: min(100%, 20rem);
    height: auto;
    margin: 1rem 0;
    background: white;
  }

  a {
    color: var(--accent);
    overflow-wrap: anywhere;
  }
</style>
