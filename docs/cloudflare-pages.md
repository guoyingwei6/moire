# Cloudflare Pages deployment for the blog branch

The two branches intentionally use separate deployment systems and domains:

```text
main -> GitHub Pages      -> https://moire.guoyingwei.top
blog -> Cloudflare Pages -> https://moires.guoyingwei.top
```

- Cloudflare project: `moire-blog`
- Cloudflare fallback URL: `https://moire-blog.pages.dev`

GitHub Pages remains unchanged and continues to deploy only `main`. The
Cloudflare project connects to the same GitHub repository but sets its
production branch to `blog`, so the two branches never compete for one Pages
deployment slot.

## Cloudflare build settings

- Production branch: `blog`
- Automatic production deployments: enabled
- Preview branch deployments: disabled (the repository's other branches are not Cloudflare inputs)
- Framework preset: none / SvelteKit static
- Build command: `pnpm build`
- Build output directory: `build`
- Root directory: repository root
- Node.js: `22.22.2`
- pnpm: `9.15.9`
- `VITE_SITE_URL`: `https://moires.guoyingwei.top`
- `BASE_PATH`: unset

`VITE_SITE_URL` is public deployment metadata, not a secret. It supplies the
canonical origin used by metadata, feeds, Sitemap and QR output without adding
a `domain` row to the existing Apple Notes root `index`. If that note later
contains an explicit `domain`, the Notes value remains authoritative.

The custom domain is attached only after the repository's production build
passes. The iPhone publisher has its own stricter rollout gate: its offline dry
run and isolated disposable-repository test must pass before it can write this
branch. Adding several domains to one Cloudflare Pages project would still
serve one build; separate content needs a separate Pages project, not merely
another DNS record.
