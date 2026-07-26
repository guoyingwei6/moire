<script lang="ts">
    import type { PageData } from './$types';
    import { base } from '$app/paths';
    import { config } from '../../moire.config';
    import MemoSearch from '$lib/components/MemoSearch.svelte';
    import ThemeComponent from 'virtual:moire-theme';
    
    let { data }: { data: PageData } = $props();
    let searchQuery = $state('');
    let selectedMonth = $state('');
    let selectedTag = $state('');

    function clearFilters() {
        searchQuery = '';
        selectedMonth = '';
        selectedTag = '';
    }

    const monthOptions = $derived.by(() => {
        const months = new Map<string, string>();
        const formatter = new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'long', timeZone: 'UTC' });
        for (const memo of data.memos) {
            const date = new Date(memo.date);
            const value = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
            months.set(value, formatter.format(date));
        }
        return Array.from(months, ([value, label]) => ({ value, label })).sort((a, b) => b.value.localeCompare(a.value));
    });

    const tagOptions = $derived.by(() => {
        const counts = new Map<string, number>();
        for (const memo of data.memos) {
            for (const tag of memo.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
        }
        return Array.from(counts, ([name, count]) => ({ name, count })).sort((a, b) => a.name.localeCompare(b.name));
    });

    const indexedMemos = $derived.by(() => data.memos.map((memo) => {
        const date = new Date(memo.date);
        return {
            memo,
            month: `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`,
            searchable: [memo.title, memo.tags.join(' '), memo.content.replace(/<[^>]*>/g, ' ')]
                .join(' ')
                .toLowerCase()
        };
    }));

    async function handleCopyLink(event: MouseEvent) {
        const button = (event.target as HTMLElement | null)?.closest<HTMLButtonElement>('button[data-copy-path]');
        if (!button) return;

        const url = new URL(button.dataset.copyPath ?? '/', window.location.origin).toString();
        try {
            await navigator.clipboard.writeText(url);
            const originalLabel = button.textContent;
            button.textContent = 'Copied';
            window.setTimeout(() => (button.textContent = originalLabel), 1400);
        } catch {
            window.prompt('Copy this memo link:', url);
        }
    }

    const visibleData = $derived.by(() => {
        const query = searchQuery.trim().toLowerCase();
        const memos = indexedMemos
            .filter(({ memo, month, searchable }) => {
                if (selectedMonth && month !== selectedMonth) return false;
                if (selectedTag && !memo.tags.includes(selectedTag)) return false;
                if (!query) return true;
                return searchable.includes(query);
            })
            .map(({ memo }) => ({
                ...memo,
                content: `${memo.content}<div class="memo-permalink"><a href="${base}/memo/${encodeURIComponent(memo.slug)}/">Open permanent link →</a><button type="button" data-copy-path="${base}/memo/${encodeURIComponent(memo.slug)}/">Copy link</button></div>`
            }));

        return { ...data, memos };
    });

    const schema = $derived({
        "@context": "https://schema.org",
        "@type": "Blog",
        "name": config.title,
        "description": config.description,
        "url": config.url,
        "author": {
            "@type": "Person",
            "name": config.author
        },
        "blogPost": data.memos.map(memo => ({
            "@type": "BlogPosting",
            "headline": memo.title,
            "datePublished": memo.date instanceof Date ? memo.date.toISOString() : memo.date,
            "url": `${config.url}/memo/${memo.slug}/`,
            "articleBody": memo.excerpt,
            "keywords": memo.tags.join(', ')
        }))
    });

    const schemaJson = $derived(JSON.stringify(schema).replace(/</g, '\\u003c'));
</script>

<svelte:head>
    <title>{config.title}{config.description ? ` | ${config.description}` : ''}</title>
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

<svelte:window onclick={handleCopyLink} />

<MemoSearch
    query={searchQuery}
    onQueryChange={(query) => (searchQuery = query)}
    resultCount={visibleData.memos.length}
    totalCount={data.memos.length}
    months={monthOptions}
    {selectedMonth}
    onMonthChange={(month) => (selectedMonth = month)}
    tags={tagOptions}
    {selectedTag}
    onTagChange={(tag) => (selectedTag = tag)}
    onClearFilters={clearFilters}
/>

{#if visibleData.memos.length > 0}
    <ThemeComponent data={visibleData} {config} />
{:else}
    <div class="memo-empty" role="status">
        <p>No memos match the current filters.</p>
        <button
            type="button"
            onclick={clearFilters}>Clear filters</button
        >
    </div>
{/if}

<style>
    .memo-empty {
        min-height: 50vh;
        display: grid;
        place-content: center;
        justify-items: center;
        gap: 0.75rem;
        color: var(--text-color, #1d1d1f);
    }

    .memo-empty p {
        margin: 0;
        opacity: 0.7;
    }

    .memo-empty button {
        border: 1px solid color-mix(in srgb, currentColor 22%, transparent);
        border-radius: 999px;
        padding: 0.45rem 0.8rem;
        color: inherit;
        background: transparent;
        cursor: pointer;
    }

    :global(.memo-permalink) {
        margin-top: 1.5rem !important;
        font-size: 0.75rem;
        opacity: 0.55;
    }

    :global(.memo-permalink button) {
        margin-left: 0.75rem;
        padding: 0;
        border: 0;
        border-bottom: 1px dotted currentColor;
        color: inherit;
        background: transparent;
        cursor: pointer;
        font: inherit;
    }
</style>
