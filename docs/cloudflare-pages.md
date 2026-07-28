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
- `VITE_SITE_URL`: not required; site domain is controlled by `/settings/` and `site.config.json`
- `BASE_PATH`: unset
- `GITHUB_TOKEN`: fine-grained GitHub token that can write repository contents
- `SETTINGS_PASSWORD`: admin password required to save `/settings/`
- `GITHUB_REPOSITORY`: `guoyingwei6/moire`
- `GITHUB_BRANCH`: `blog`

`GITHUB_TOKEN` and `SETTINGS_PASSWORD` are Cloudflare environment variables.
Do not commit them to the repository, frontend code or URLs. The settings API
still only writes `site.config.json` on the `blog` branch.

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

## Web settings

`/settings/` is an editable site settings page. It saves only
`site.config.json` on the `blog` branch through the Cloudflare Pages Function at
`/api/settings`.

Saving requires the admin password stored in Cloudflare as `SETTINGS_PASSWORD`.
The password is submitted only with the save request; it is not stored in
`site.config.json` and is not included in the static site bundle.

The web form controls site-level settings:

- title, author, description, domain, logo emoji and right-to-left text;
- Twitter, Instagram, GitHub, YouTube, Mastodon and public email;
- background, text, secondary text and link colors;
- QR, Tags, Archive, folder-name, previous/next, footer and metadata display.

Apple Notes `index` remains responsible for navigation and content structure.
The Mac publish script runs `git pull --ff-only origin blog` before exporting
Notes so settings commits made from the website do not conflict with later
snapshot pushes.
