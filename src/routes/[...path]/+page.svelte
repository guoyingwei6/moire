<script lang="ts">
  import type { PageData } from './$types';
  import ContentPage from '$lib/components/blog/ContentPage.svelte';

  let { data }: { data: PageData } = $props();
</script>

<ContentPage {...data} />
