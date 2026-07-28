<script lang="ts">
  import { base } from '$app/paths';
  import { onMount } from 'svelte';

  let { data } = $props();

  const settings = $derived(data.inspection.defaults);
  const saveEndpoint = `${base}/api/settings`;
  const loginEndpoint = `${base}/api/settings/login`;
  const sessionEndpoint = `${base}/api/settings/session`;
  const hexPattern = '#[0-9A-Fa-f]{3,8}';

  let authState = $state<'login' | 'authenticated'>('login');
  let loginStatus = $state<'idle' | 'checking' | 'submitting' | 'error'>('idle');
  let loginMessage = $state('');
  let status = $state<'idle' | 'saving' | 'success' | 'error'>('idle');
  let message = $state('');

  const applyResultQuery = () => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('saved') === '1') {
      status = 'success';
      message = 'Saved. Redeploying…';
    } else if (params.has('error')) {
      status = 'error';
      message = params.get('error') || 'Save failed.';
    }
  };

  onMount(async () => {
    const params = new URLSearchParams(window.location.search);
    loginMessage = params.get('loginError') || '';
    loginStatus = 'checking';

    try {
      const response = await fetch(sessionEndpoint, {
        headers: { accept: 'application/json' },
        credentials: 'same-origin'
      });
      const result = await response.json().catch(() => ({}));
      if (response.ok && result.authenticated) {
        authState = 'authenticated';
        loginStatus = 'idle';
        loginMessage = '';
        applyResultQuery();
        return;
      }
      loginStatus = loginMessage ? 'error' : 'idle';
      if (!loginMessage && response.status >= 500) {
        loginStatus = 'error';
        loginMessage = result.error || 'Settings login is unavailable.';
      } else if (!loginMessage && params.has('error')) {
        loginStatus = 'error';
        loginMessage = params.get('error') || 'Sign in again.';
      }
    } catch {
      loginStatus = 'error';
      loginMessage = 'Unable to check the settings session.';
    }
  });

  const handleLogin = async (event: SubmitEvent) => {
    event.preventDefault();
    const form = event.currentTarget;
    if (!(form instanceof HTMLFormElement)) return;

    loginStatus = 'submitting';
    loginMessage = '';

    try {
      const response = await fetch(loginEndpoint, {
        method: 'POST',
        headers: { accept: 'application/json' },
        body: new FormData(form),
        credentials: 'same-origin'
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.authenticated) {
        throw new Error(result.error || 'Unable to sign in.');
      }
      form.reset();
      authState = 'authenticated';
      loginStatus = 'idle';
      status = 'idle';
      message = '';
    } catch (error) {
      loginStatus = 'error';
      loginMessage = error instanceof Error ? error.message : 'Unable to sign in.';
    }
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
        if (response.status === 401) {
          authState = 'login';
          loginStatus = 'error';
          loginMessage = result.error || 'Your settings session has expired. Sign in again.';
          status = 'idle';
          message = '';
          return;
        }
        throw new Error(result.error || `Save failed with HTTP ${response.status}`);
      }
      status = 'success';
      message = result.message || 'Saved. Redeploying…';
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
  {#if authState === 'login'}
    <section class="settings-login" aria-labelledby="settings-login-title">
      <h2 id="settings-login-title">Admin sign in</h2>
      <form method="post" action={loginEndpoint} onsubmit={handleLogin}>
        <label>
          Admin password
          <input
            name="settingsPassword"
            type="password"
            autocomplete="current-password"
            required
          />
        </label>
        {#if loginMessage}
          <p class="settings-login-error" role="alert">{loginMessage}</p>
        {/if}
        <button type="submit" disabled={loginStatus === 'submitting' || loginStatus === 'checking'}>
          {loginStatus === 'submitting' || loginStatus === 'checking' ? 'Checking…' : 'Continue'}
        </button>
      </form>
      <p class="settings-help">Your password is checked securely and is not stored in this browser.</p>
    </section>
  {:else}
    {#if message}
      <div
        class:settings-toast={true}
        class:success={status === 'success'}
        class:error={status === 'error'}
        role={status === 'error' ? 'alert' : 'status'}
      >
        {message}
      </div>
    {/if}
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
      </section>
    </form>
  {/if}
</article>
