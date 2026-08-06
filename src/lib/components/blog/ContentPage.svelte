<script lang="ts">
  import { base } from '$app/paths';
  import type { ContentListingEntry, ContentRecord, ContentSummary } from '$lib/content';
  import { feedDiscovery } from '$lib/feed-policy.js';
  import { LOCKED_SUMMARY, decryptNote } from '$lib/note-lock.js';
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
    entries?: ContentListingEntry[];
    folder?: ContentSummary | null;
    previous?: ContentSummary | null;
    next?: ContentSummary | null;
  } = $props();

  const href = (route: string) => `${base}${route}` || '/';
  const canonical = $derived(`${config.url.replace(/\/$/, '')}${record.route === '/' ? '/' : record.route}`);
  const displayTitle = $derived(record.kind === 'home' ? config.title : record.title);
  let password = $state('');
  let busy = $state(false);
  let unlockError = $state('');
  let unlockedHtml = $state<string | null>(null);
  let passwordInput: HTMLInputElement | null = $state(null);

  const readPassword = () => {
    const values = [
      password,
      passwordInput?.value ?? '',
      (typeof document !== 'undefined'
        ? (document.getElementById('note-password') as HTMLInputElement | null)?.value ?? ''
        : '')
    ];
    for (const value of values) {
      const trimmed = value.trim();
      if (trimmed) return trimmed;
    }
    return '';
  };

  const unlock = async (event?: Event) => {
    event?.preventDefault?.();
    event?.stopPropagation?.();
    if (busy) return;

    if (!record.lockedPayload) {
      unlockError = 'Missing encrypted payload. Rebuild the site and try again.';
      return;
    }
    if (typeof crypto === 'undefined' || !crypto.subtle) {
      unlockError = 'This browser context cannot decrypt. Open the site over http://127.0.0.1 or HTTPS.';
      return;
    }

    const candidate = readPassword();
    if (!candidate) {
      unlockError = 'Please enter a password.';
      passwordInput?.focus();
      return;
    }

    password = candidate;
    busy = true;
    unlockError = '';
    try {
      unlockedHtml = await decryptNote(record.lockedPayload, candidate);
    } catch (error) {
      console.error('note unlock failed', error);
      unlockError = 'Wrong password. Try again.';
      passwordInput?.focus();
      passwordInput?.select();
    } finally {
      busy = false;
    }
  };

  const onPasswordKeydown = (event: KeyboardEvent) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      void unlock(event);
    }
  };

  const feed = $derived(feedDiscovery(record, folder, config.title));
  const feedUrl = $derived(feed ? `${config.url.replace(/\/$/, '')}${feed.route}` : '');
  const pageTitle = $derived(record.kind === 'home' ? config.title : `${record.title} | ${config.title}`);
  const displayDate = (value: string) => new Intl.DateTimeFormat('en', {
    month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC'
  }).format(new Date(value));
</script>

<svelte:head>
  <title>{pageTitle}</title>
  <meta name="description" content={record.summary || config.description} />
  <link rel="canonical" href={canonical} />
  {#if feed}
    <link rel="alternate" type="application/rss+xml" title={`${feed.title} RSS feed`} href={feedUrl} />
  {/if}
  <meta property="og:type" content={record.kind === 'post' ? 'article' : 'website'} />
  <meta property="og:url" content={canonical} />
  <meta property="og:title" content={displayTitle} />
  <meta property="og:description" content={record.summary || config.description} />
  {#if record.hidden || record.locked}
    <meta name="robots" content="noindex, nofollow" />
  {/if}
</svelte:head>

<h1>{displayTitle}</h1>

{#if record.options.showBreadcrumbs && record.kind === 'post' && folder && folder.route !== '/'}
  <a class="folder-name" href={href(folder.route)}>{folder.title}</a>
{/if}

{#if record.kind === 'post' && !record.hidden && record.tags.length}
  <nav class="post-tags" aria-label="Tags">
    {#each record.tags as tag}
      <a href={href(`/tags/${encodeURIComponent(tag.toLocaleLowerCase().replace(/\s+/g, '-'))}/`)}>#{tag}</a>
    {/each}
  </nav>
{/if}

{#if record.locked && unlockedHtml === null}
  <div class="note-lock">
    <p class="note-lock-message">🔒 {LOCKED_SUMMARY}</p>
    <div class="note-lock-form" role="group" aria-label="Unlock note">
      <input
        id="note-password"
        name="password"
        type="password"
        bind:this={passwordInput}
        bind:value={password}
        placeholder="Password"
        autocomplete="current-password"
        autocapitalize="off"
        autocorrect="off"
        spellcheck="false"
        onkeydown={onPasswordKeydown}
      />
      <button type="button" onclick={unlock} disabled={busy}>
        {busy ? 'Unlocking…' : 'Unlock'}
      </button>
    </div>
    {#if unlockError}
      <p class="note-lock-error" role="alert">{unlockError}</p>
    {/if}
    {#if busy}
      <p class="note-lock-hint">Decrypting…</p>
    {/if}
  </div>
{:else if record.html || unlockedHtml}
  <article
    class:home-article={record.kind === 'home'}
    class:photo-article={record.kind === 'post' && folder?.route === '/photo/'}
    class="markdown-content"
  >
    {@html unlockedHtml ?? record.html}
  </article>
{/if}

{#if record.kind === 'section'}
  <SectionListing {entries} layout={record.options.layout} previewProps={record.options.previewProps} />
{:else if record.kind === 'home' && record.options.showChildren}
  <SectionListing {entries} layout={record.options.layout} previewProps={record.options.previewProps} />
{/if}

{#if record.kind === 'post' && !record.locked}
  {#if record.options.showNoteMetadata}
    <dl class="post-metadata">
    {#if record.created}
      <div><dt>Date</dt><dd>{displayDate(record.created)}</dd></div>
    {/if}
    <div><dt>Words</dt><dd>{record.wordCount}</dd></div>
    <div><dt>Time to read</dt><dd>{record.readingMinutes} min</dd></div>
    </dl>
  {/if}

  {#if record.options.showNoteNavigation && (previous || next)}
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

<style>
  .note-lock {
    box-sizing: border-box;
    max-width: 28rem;
    margin: 2.5rem auto;
    padding: 1.75rem 1.5rem;
    border: 1px solid color-mix(in srgb, var(--text, #000) 14%, transparent);
    border-radius: 14px;
    background: #fff;
    text-align: center;
    box-shadow: 0 8px 24px color-mix(in srgb, #000 6%, transparent);
  }

  .note-lock-message {
    margin: 0 0 1.25rem;
    font-size: 1.05rem;
    color: var(--text, #000);
    line-height: 1.6;
  }

  .note-lock-form {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: 0.75rem;
  }

  .note-lock-form input {
    box-sizing: border-box;
    width: 100%;
    padding: 0.8rem 1rem;
    border: 1.5px solid color-mix(in srgb, var(--text, #000) 22%, transparent);
    border-radius: 10px;
    background: #fff;
    color: #000;
    font-size: 1rem;
    font-family: inherit;
    transition: border-color 0.15s ease, box-shadow 0.15s ease;
  }

  .note-lock-form input:focus {
    outline: none;
    border-color: var(--accent, #DDA832);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent, #DDA832) 24%, transparent);
  }

  .note-lock-form button {
    padding: 0.8rem 1.25rem;
    border: none;
    border-radius: 10px;
    background: var(--accent, #DDA832);
    color: #111;
    font-size: 1rem;
    font-weight: 600;
    cursor: pointer;
    transition: filter 0.15s ease, transform 0.1s ease;
  }

  .note-lock-form button:not(:disabled):hover {
    filter: brightness(0.96);
  }

  .note-lock-form button:not(:disabled):active {
    transform: scale(0.99);
  }

  .note-lock-form button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .note-lock-hint {
    margin: 0.75rem 0 0;
    color: var(--secondary, #555);
    font-size: 0.9rem;
  }

  .note-lock-error {
    margin: 0.85rem 0 0;
    color: #b42318;
    font-size: 0.9rem;
    padding: 0.55rem 0.75rem;
    background: color-mix(in srgb, #b42318 10%, #fff);
    border-radius: 8px;
  }
</style>
