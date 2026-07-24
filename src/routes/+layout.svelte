<script lang="ts">
  import { base } from '$app/paths';
  import { page } from '$app/state';
  import favicon from '$lib/assets/favicon.svg';
  import '$themes/global.css';
  import { config } from '../../moire.config';

  let { children } = $props();
  let menuOpen = $state(false);
  const currentYear = new Date().getFullYear();

  const localHref = (href: string) => href.startsWith('/') ? `${base}${href}` || '/' : href;

  const isSelected = (href: string) => {
    const pathname = page.url.pathname.replace(base, '') || '/';
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  };

  $effect(() => {
    page.url.pathname;
    menuOpen = false;
  });
</script>

<svelte:head>
  <meta name="author" content={config.author} />
  <meta name="keywords" content={config.keywords} />
  <link rel="icon" href={favicon} />
</svelte:head>

<main
  class="site-frame"
  dir={config.rtl ? 'rtl' : 'ltr'}
  style:--page-bg={config.colors.background}
  style:--text={config.colors.text}
  style:--secondary={config.colors.secondary}
  style:--accent={config.colors.link}
>
  <aside class:menu-open={menuOpen} class="site-sidebar" aria-label="Site navigation">
    <div class="site-sidebar-header">
      <a class="site-pin" href={localHref('/')} aria-label={`${config.title} home`}>{config.logoEmoji}</a>
      <button
        class="menu-toggle"
        type="button"
        aria-label={menuOpen ? 'Close menu' : 'Open menu'}
        aria-expanded={menuOpen}
        aria-controls="site-navigation"
        onclick={() => menuOpen = !menuOpen}
      >
        <span>—</span><span>—</span><span>—</span>
      </button>
    </div>

    <nav id="site-navigation" class="site-navigation">
      <ul>
        {#each config.navigation as item}
          <li>
            <a
              href={localHref(item.href)}
              class:selected={isSelected(item.href)}
              aria-current={isSelected(item.href) ? 'page' : undefined}
            >
              <span aria-hidden="true">{item.icon}</span><span>{item.label}</span>
            </a>
          </li>
        {/each}
      </ul>
    </nav>
  </aside>

  <section class="site-content">
    {@render children()}
  </section>

  {#if config.features.footer}
    <footer class="site-footer">
      <small>{config.author} © 2022–{currentYear}</small>
      <nav aria-label="Utility navigation">
        {#each config.footerLinks as item}
          <a
            href={localHref(item.href)}
            target={item.external && item.href.startsWith('http') ? '_blank' : undefined}
            rel={item.external ? 'me noreferrer' : undefined}
          >{item.label}</a>
        {/each}
      </nav>
      <small>Published with Apple Notes, GitHub and SvelteKit.</small>
    </footer>
  {/if}
</main>
