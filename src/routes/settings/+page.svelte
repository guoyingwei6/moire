<script lang="ts">
  import { base } from '$app/paths';

  let { data } = $props();

  const href = (route: string) => `${base}${route}` || '/';

  const entries = (value: Record<string, unknown>) => Object.entries(value);

  const formatValue = (value: unknown): string => {
    if (Array.isArray(value)) return value.length ? value.join(', ') : '—';
    if (typeof value === 'boolean') return value ? 'yes' : 'no';
    if (value === null || value === undefined || value === '') return '—';
    return String(value);
  };
</script>

<svelte:head>
  <title>Settings | {data.config.title}</title>
  <meta name="robots" content="noindex" />
  <meta name="description" content={`Read-only configuration snapshot for ${data.config.title}`} />
</svelte:head>

<article class="settings-page">
  <h1>Settings</h1>
  <p class="settings-note">
    Read-only snapshot generated at build time. Apple Notes metadata and repository config remain the source of truth.
  </p>

  <section>
    <h2>Effective site config</h2>
    <div class="settings-grid">
      <div>
        <h3>Site</h3>
        <table>
          <tbody>
            {#each entries(data.inspection.effective.site) as [name, value]}
              <tr><th>{name}</th><td>{formatValue(value)}</td></tr>
            {/each}
          </tbody>
        </table>
      </div>
      <div>
        <h3>Colors</h3>
        <table>
          <tbody>
            {#each entries(data.inspection.effective.colors) as [name, value]}
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
            {#each entries(data.inspection.effective.features) as [name, value]}
              <tr><th>{name}</th><td>{formatValue(value)}</td></tr>
            {/each}
          </tbody>
        </table>
      </div>
      <div>
        <h3>Social</h3>
        <table>
          <tbody>
            {#each entries(data.inspection.effective.social) as [name, value]}
              <tr><th>{name}</th><td>{formatValue(value)}</td></tr>
            {/each}
          </tbody>
        </table>
      </div>
    </div>
  </section>

  <section>
    <h2>Root index overrides</h2>
    {#if Object.keys(data.inspection.rootIndex.properties).length}
      <table>
        <thead><tr><th>name</th><th>value</th><th>source</th></tr></thead>
        <tbody>
          {#each entries(data.inspection.rootIndex.properties) as [name, value]}
            <tr><td>{name}</td><td>{formatValue(value)}</td><td>content/index.md</td></tr>
          {/each}
        </tbody>
      </table>
    {:else}
      <p>No root index metadata table found.</p>
    {/if}
  </section>

  <section>
    <h2>Navigation from root index</h2>
    <table>
      <thead><tr><th>label</th><th>href</th><th>type</th><th>source</th></tr></thead>
      <tbody>
        {#each data.inspection.effective.navigation as item}
          <tr><td>{item.icon} {item.label}</td><td>{item.href}</td><td>sidebar</td><td>{data.inspection.rootIndex.menu ? 'content/index.md' : 'site.config.json + auto-discovery'}</td></tr>
        {/each}
        {#each data.inspection.effective.headerNavigation as item}
          <tr><td>{item.label}</td><td>{item.href}</td><td>header</td><td>content/index.md</td></tr>
        {/each}
        {#each data.inspection.effective.footerLinks as item}
          <tr><td>{item.label}</td><td>{item.href}</td><td>footer</td><td>{item.external ? 'site.config.json' : 'content/index.md'}</td></tr>
        {/each}
      </tbody>
    </table>
  </section>
</article>
