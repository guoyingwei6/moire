<script lang="ts">
  import { base } from '$app/paths';
  import type { ContentLayout, ContentListingEntry } from '$lib/content';

  let {
    entries,
    layout = 'list',
    previewProps = []
  }: {
    entries: ContentListingEntry[];
    layout?: ContentLayout;
    previewProps?: string[];
  } = $props();

  const href = (route: string) => `${base}${route}` || '/';
  const displayDate = (value: string) => new Intl.DateTimeFormat('en', {
    month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC'
  }).format(new Date(value));
  const propertyLabel = (value: string) => value.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, (letter) => letter.toUpperCase());
</script>

{#if entries.length}
  {#if layout === 'feed'}
    <div class="section-list feed">
      {#each entries as entry}
        <article class="section-list-item section-feed-item">
          <header class="section-list-heading">
            <h2>
              <a href={href(entry.route)}>
                {#if entry.options.pinned}<span class="pin" aria-label="Pinned">📌</span>{/if}{entry.title}
              </a>
            </h2>
            {#if entry.created}<time datetime={entry.created}>{displayDate(entry.created)}</time>{/if}
          </header>
          {#if entry.html}
            <div class="markdown-content section-feed-content">{@html entry.html}</div>
          {/if}
          {#if previewProps.length}
            <dl class="preview-properties">
              {#each previewProps as property}
                {#if entry.properties[property]}
                  <div><dt>{propertyLabel(property)}</dt><dd>{entry.properties[property]}</dd></div>
                {/if}
              {/each}
            </dl>
          {/if}
        </article>
      {/each}
    </div>
  {:else if layout === 'table'}
    <div class="section-table-wrap">
      <table class="section-table">
        <thead>
          <tr>
            <th>Title</th>
            <th>Date</th>
            {#each previewProps as property}<th>{propertyLabel(property)}</th>{/each}
          </tr>
        </thead>
        <tbody>
          {#each entries as entry}
            <tr>
              <td>
                <a href={href(entry.route)}>
                  {#if entry.options.pinned}<span class="pin" aria-label="Pinned">📌</span>{/if}{entry.title}
                </a>
              </td>
              <td>{entry.created ? displayDate(entry.created) : '—'}</td>
              {#each previewProps as property}<td>{entry.properties[property] || '—'}</td>{/each}
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {:else}
    <div
      class="section-list"
      class:timeline={layout === 'timeline'}
      class:grid={layout === 'grid'}
    >
      {#each entries as entry}
        <a class="section-list-item" href={href(entry.route)}>
          <div class="section-list-heading">
            <span>{#if entry.options.pinned}<span class="pin" aria-label="Pinned">📌</span>{/if}{entry.title}</span>
            {#if entry.created}<time datetime={entry.created}>{displayDate(entry.created)}</time>{/if}
          </div>
          {#if layout === 'grid' && entry.summary}
            <p>{entry.summary}</p>
          {/if}
          {#if previewProps.length}
            <dl class="preview-properties">
              {#each previewProps as property}
                {#if entry.properties[property]}
                  <div><dt>{propertyLabel(property)}</dt><dd>{entry.properties[property]}</dd></div>
                {/if}
              {/each}
            </dl>
          {/if}
        </a>
      {/each}
    </div>
  {/if}
{:else}
  <p class="empty-state">No public notes in this folder yet.</p>
{/if}
