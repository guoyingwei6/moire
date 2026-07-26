<script lang="ts">
	import favicon from '$lib/assets/favicon.svg';
	import '$themes/global.css';

	import { config } from '../../moire.config';

	let { children } = $props();
</script>

<svelte:head>
	<meta name="author" content={config.author} />
	<meta name="keywords" content={config.keywords} />
	<link rel="icon" href={favicon} />
</svelte:head>

{@render children()}
