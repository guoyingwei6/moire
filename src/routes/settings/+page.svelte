<script lang="ts">
  import { base } from '$app/paths';

  let { data } = $props();

  const settings = $derived(data.inspection.defaults);
  const effective = $derived(data.inspection.effective);
  const saveEndpoint = `${base}/api/settings`;
  const hexPattern = '#[0-9A-Fa-f]{3,8}';

  let status = $state<'idle' | 'saving' | 'success' | 'error'>('idle');
  let message = $state('');

  const entries = (value: Record<string, unknown>) => Object.entries(value);

  const formatValue = (value: unknown): string => {
    if (Array.isArray(value)) return value.length ? value.join(', ') : '—';
    if (typeof value === 'boolean') return value ? 'yes' : 'no';
    if (value === null || value === undefined || value === '') return '—';
    return String(value);
  };

  const handleSubmit = async (event: SubmitEvent) => {
    event.preventDefault();
    const form = event.currentTarget;
    if (!(form instanceof HTMLFormElement)) return;

    status = 'saving';
    message = 'Saving settings…';

    try {
      const response = await fetch(saveEndpoint, {
        method: 'POST',
        body: new FormData(form)
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(result.error || `Save failed with HTTP ${response.status}`);
      }
      status = 'success';
      message = result.message || `Saved. Commit ${result.commit ?? ''} is waiting for Cloudflare deployment.`;
    } catch (error) {
      status = 'error';
      message = error instanceof Error ? error.message : 'Save failed.';
    }
  };
</script>

<svelte:head>
  <title>Settings | {data.config.title}</title>
  <meta name="robots" content="noindex" />
  <meta name="description" content={`Editable site settings for ${data.config.title}`} />
</svelte:head>

<article class="settings-page">
  <h1>Settings</h1>
  <p class="settings-note">
    Site-level settings are saved to <code>site.config.json</code> on the <code>blog</code> branch.
    Apple Notes index tables remain responsible for navigation and content structure.
  </p>

  <form class="settings-form" method="post" action={saveEndpoint} onsubmit={handleSubmit}>
    <section>
      <h2>General Settings</h2>
      <label>
        Site title
        <input name="site.title" value={settings.site.title} required />
      </label>
      <label>
        Site author
        <input name="site.author" value={settings.site.author} required />
      </label>
      <label>
        Site description
        <input name="site.description" value={settings.site.description} required />
      </label>
      <label>
        Site domain
        <input name="site.domain" value={settings.site.domain} type="url" required />
      </label>
      <label>
        Emoji as a logo
        <input name="site.logoEmoji" value={settings.site.logoEmoji} required />
      </label>
      <label class="checkbox-row">
        <input name="site.rtl" type="checkbox" checked={settings.site.rtl} />
        Right-to-left text
      </label>
    </section>

    <section>
      <h2>Social Settings</h2>
      <label>
        Twitter username
        <input name="social.twitter" value={settings.social.twitter.replace('https://twitter.com/', '')} />
      </label>
      <label>
        Instagram username
        <input name="social.instagram" value={settings.social.instagram.replace('https://instagram.com/', '')} />
      </label>
      <label>
        Github username
        <input name="social.github" value={settings.social.github.replace('https://github.com/', '')} />
      </label>
      <label>
        Youtube link
        <input name="social.youtube" value={settings.social.youtube} type="url" placeholder="youtube channel link" />
      </label>
      <label>
        Mastodon link
        <input name="social.mastodon" value={settings.social.mastodon} type="url" placeholder="mastodon link" />
      </label>
      <label>
        Public email
        <input name="social.email" value={settings.social.email} type="email" />
      </label>
    </section>

    <section>
      <h2>Customization Settings</h2>
      <label>
        Background color
        <input name="colors.background" value={settings.colors.background} pattern={hexPattern} required />
      </label>
      <label>
        Text color
        <input name="colors.text" value={settings.colors.text} pattern={hexPattern} required />
      </label>
      <label>
        Secondary text color
        <input name="colors.secondary" value={settings.colors.secondary} pattern={hexPattern} required />
      </label>
      <label>
        Link color
        <input name="colors.link" value={settings.colors.link} pattern={hexPattern} required />
      </label>
      <label class="checkbox-row">
        <input name="features.hideQrCode" type="checkbox" checked={!settings.features.qrCode} />
        Hide QR code link
      </label>
      <label class="checkbox-row">
        <input name="features.hideTags" type="checkbox" checked={!settings.features.tags} />
        Hide tags link
      </label>
      <label class="checkbox-row">
        <input name="features.hideArchive" type="checkbox" checked={!settings.features.archive} />
        Hide archive link
      </label>
      <label class="checkbox-row">
        <input name="features.folderName" type="checkbox" checked={settings.features.folderName} />
        Show folder name on the notes page
      </label>
      <label class="checkbox-row">
        <input name="features.previousNext" type="checkbox" checked={settings.features.previousNext} />
        Show previous and next links on each note's page
      </label>
      <label class="checkbox-row">
        <input name="features.footer" type="checkbox" checked={settings.features.footer} />
        Show footer on each note's page
      </label>
      <label class="checkbox-row">
        <input name="features.metadata" type="checkbox" checked={settings.features.metadata} />
        Show metadata on each note's page
      </label>
    </section>

    <section>
      <button type="submit" disabled={status === 'saving'}>save</button>
      {#if message}
        <p class:success={status === 'success'} class:error={status === 'error'}>{message}</p>
      {/if}
    </section>
  </form>

  <section>
    <h2>Effective site config</h2>
    <div class="settings-grid">
      <div>
        <h3>Site</h3>
        <table>
          <tbody>
            {#each entries(effective.site) as [name, value]}
              <tr><th>{name}</th><td>{formatValue(value)}</td></tr>
            {/each}
          </tbody>
        </table>
      </div>
      <div>
        <h3>Colors</h3>
        <table>
          <tbody>
            {#each entries(effective.colors) as [name, value]}
              <tr>
                <th>{name}</th>
                <td><span class="color-chip" style:background={String(value)}></span>{formatValue(value)}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
      <div>
        <h3>Features</h3>
        <table>
          <tbody>
            {#each entries(effective.features) as [name, value]}
              <tr><th>{name}</th><td>{formatValue(value)}</td></tr>
            {/each}
          </tbody>
        </table>
      </div>
      <div>
        <h3>Social</h3>
        <table>
          <tbody>
            {#each entries(effective.social) as [name, value]}
              <tr><th>{name}</th><td>{formatValue(value)}</td></tr>
            {/each}
          </tbody>
        </table>
      </div>
    </div>
  </section>

  <section>
    <h2>Navigation from root index</h2>
    <table>
      <thead><tr><th>label</th><th>href</th><th>type</th><th>source</th></tr></thead>
      <tbody>
        {#each effective.navigation as item}
          <tr><td>{item.icon} {item.label}</td><td>{item.href}</td><td>sidebar</td><td>{data.inspection.rootIndex.menu ? 'content/index.md' : 'site.config.json + auto-discovery'}</td></tr>
        {/each}
        {#each effective.headerNavigation as item}
          <tr><td>{item.label}</td><td>{item.href}</td><td>header</td><td>content/index.md</td></tr>
        {/each}
        {#each effective.footerLinks as item}
          <tr><td>{item.label}</td><td>{item.href}</td><td>footer</td><td>{item.external ? 'site.config.json' : 'content/index.md'}</td></tr>
        {/each}
      </tbody>
    </table>
  </section>
</article>
