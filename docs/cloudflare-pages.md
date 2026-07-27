# Cloudflare Pages deployment

The two public sites are intentionally separate:

```text
main -> GitHub Pages      -> https://moire.guoyingwei.top
blog -> Cloudflare Pages -> https://moires.guoyingwei.top
```

`main` remains available for upstream/original Moire work. The macOS Apple Notes exporter pushes only `blog`.

## Cloudflare Pages settings

Use these settings for the `blog` site:

- Production branch: `blog`
- Build command: `pnpm build`
- Build output directory: `build`
- Root directory: repository root
- `VITE_SITE_URL`: `https://moires.guoyingwei.top`
- `BASE_PATH`: unset

`pnpm build` runs the `prebuild` script first:

```sh
node scripts/notes/build-content-from-export.mjs \
  --in notes-export/public-notes.json \
  --content content \
  --clean true \
  --if-exists true
```

That means Cloudflare regenerates `content/**` from the committed raw snapshot before SvelteKit builds the static site.

## Verified deployment

Verified on 2026-07-27:

- `origin/blog=60d14de0aa31c939b7150a77816f43e2cd30de2b`
- `https://moires.guoyingwei.top/` returns HTTP 200
- `/blog/` lists `症状` and `MacOS setting preferences`
- `/blog/症状/` renders two images
- `/photo/portrait/` renders four images
- `/sitemap.xml` includes generated pages

GitHub Actions does not deploy this branch; Cloudflare Pages listens to `blog`.
