<script lang="ts">
  import { base } from '$app/paths';
  import { page } from '$app/state';
  import favicon from '$lib/assets/favicon.svg';
  import '$themes/global.css';
  import { config } from '../../moire.config';

  let { data, children } = $props();
  let menuOpen = $state(false);
  type LightboxImage = { src: string; alt: string };
  let lightbox = $state<{ images: LightboxImage[]; index: number } | null>(null);
  let touchStartX = 0;
  let touchStartY = 0;
  const currentLightboxImage = $derived(lightbox ? lightbox.images[lightbox.index] : null);
  const hasMultipleLightboxImages = $derived((lightbox?.images.length ?? 0) > 1);
  const currentYear = new Date().getFullYear();

  const localHref = (href: string) => href.startsWith('/') ? `${base}${href}` || '/' : href;

  const isSelected = (href: string) => {
    if (!href.startsWith('/')) return false;
    const pathname = page.url.pathname.replace(base, '') || '/';
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  };

  $effect(() => {
    page.url.pathname;
    menuOpen = false;
    lightbox = null;
  });

  const openImageLightbox = (event: MouseEvent) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const link = target.closest<HTMLAnchorElement>('a.image-link');
    if (!link) return;
    const href = link.getAttribute('href');
    if (!href) return;
    const container = link.closest<HTMLElement>('.markdown-content') ?? document.body;
    const links = [...container.querySelectorAll<HTMLAnchorElement>('a.image-link')];
    const images = links
      .map((item) => {
        const source = item.getAttribute('href');
        if (!source) return null;
        return {
          src: source,
          alt: item.querySelector('img')?.getAttribute('alt') || 'Expanded image'
        };
      })
      .filter((image): image is LightboxImage => image !== null);
    const index = links.indexOf(link);
    event.preventDefault();
    lightbox = {
      images: images.length ? images : [{ src: href, alt: link.querySelector('img')?.getAttribute('alt') || 'Expanded image' }],
      index: index >= 0 ? index : 0
    };
  };

  const closeImageLightbox = () => {
    lightbox = null;
  };

  const showLightboxImage = (direction: -1 | 1) => {
    if (!lightbox || lightbox.images.length < 2) return;
    lightbox.index = (lightbox.index + direction + lightbox.images.length) % lightbox.images.length;
  };

  const handleLightboxKeydown = (event: KeyboardEvent) => {
    if (!lightbox) return;
    if (event.key === 'Escape') closeImageLightbox();
    else if (event.key === 'ArrowLeft') showLightboxImage(-1);
    else if (event.key === 'ArrowRight') showLightboxImage(1);
  };

  const handleLightboxTouchStart = (event: TouchEvent) => {
    const touch = event.touches[0];
    if (!touch) return;
    touchStartX = touch.clientX;
    touchStartY = touch.clientY;
  };

  const handleLightboxTouchEnd = (event: TouchEvent) => {
    if (!lightbox) return;
    const touch = event.changedTouches[0];
    if (!touch) return;
    const deltaX = touch.clientX - touchStartX;
    const deltaY = touch.clientY - touchStartY;
    if (Math.abs(deltaX) < 50 || Math.abs(deltaX) < Math.abs(deltaY) * 1.3) return;
    showLightboxImage(deltaX < 0 ? 1 : -1);
  };
</script>

<svelte:head>
  <meta name="author" content={config.author} />
  <meta name="keywords" content={config.keywords} />
  <link rel="icon" href={favicon} />
</svelte:head>

<svelte:window
  onclick={openImageLightbox}
  onkeydown={handleLightboxKeydown}
  ontouchstart={handleLightboxTouchStart}
  ontouchend={handleLightboxTouchEnd}
/>

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
        {#each data.navigation as item}
          <li>
            <a
              href={localHref(item.href)}
              target={item.external ? '_blank' : undefined}
              rel={item.external ? 'noreferrer' : undefined}
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
    {#if data.headerNavigation.length}
      <nav class="site-header-navigation" aria-label="Header navigation">
        {#each data.headerNavigation as item}
          <a
            href={localHref(item.href)}
            target={item.external ? '_blank' : undefined}
            rel={item.external ? 'noreferrer' : undefined}
            class:selected={isSelected(item.href)}
            aria-current={isSelected(item.href) ? 'page' : undefined}
          >{item.label}</a>
        {/each}
      </nav>
    {/if}
    {@render children()}
  </section>

  {#if data.showFooter}
    <footer class="site-footer">
      <small>
        <a class="site-footer-author" href={localHref('/settings/')}>{config.author}</a>
        © 2026{currentYear > 2026 ? `–${currentYear}` : ''}
      </small>
      <nav aria-label="Utility navigation">
        {#each data.footerEntries as item}
          <a href={localHref(item.route)}>{item.title}</a>
        {/each}
        {#each data.footerLinks as item}
          <a
            href={localHref(item.href)}
            target={item.external && item.href.startsWith('http') ? '_blank' : undefined}
            rel={item.external ? 'me noreferrer' : undefined}
          >{item.label}</a>
        {/each}
      </nav>
      <small>
        Published from Apple Notes, versioned on
        <a href="https://github.com/guoyingwei6/moire/tree/blog" target="_blank" rel="noreferrer">GitHub</a>,
        and deployed with Cloudflare Pages.
      </small>
    </footer>
  {/if}
</main>

{#if lightbox && currentLightboxImage}
  <div
    class="image-lightbox"
    role="dialog"
    aria-modal="true"
    aria-label="Image preview"
  >
    <button class="image-lightbox-backdrop" type="button" aria-label="Close image preview" onclick={closeImageLightbox}></button>
    <button class="image-lightbox-close" type="button" aria-label="Close image preview" onclick={closeImageLightbox}>×</button>
    {#if hasMultipleLightboxImages}
      <button class="image-lightbox-nav previous" type="button" aria-label="Previous image" onclick={() => showLightboxImage(-1)}>‹</button>
      <button class="image-lightbox-nav next" type="button" aria-label="Next image" onclick={() => showLightboxImage(1)}>›</button>
      <div class="image-lightbox-count">{lightbox.index + 1} / {lightbox.images.length}</div>
    {/if}
    <img src={currentLightboxImage.src} alt={currentLightboxImage.alt} />
  </div>
{/if}
