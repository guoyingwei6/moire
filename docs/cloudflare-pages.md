<p align="center">
  <a href="./cloudflare-pages.zh-CN.md">简体中文</a> · <strong>English</strong>
</p>

# Cloudflare Pages deployment

The two public sites are intentionally separate:

```text
main -> GitHub Pages      -> https://moire.guoyingwei.top
blog -> Cloudflare Pages -> https://moireblog.guoyingwei.top
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
- `SETTINGS_PASSWORD`: admin password required to sign in to `/settings/`
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

## Deployment boundary

GitHub Actions does not deploy this branch; Cloudflare Pages listens directly
to `blog`. A successful push starts a new Cloudflare build, while `main` and
`development` keep their own independent deployments.

## Browser cache policy

The Advanced Mode Worker adds this response header only to successful
`/_app/immutable/*` requests:

```text
Cache-Control: public, max-age=31536000, immutable
```

SvelteKit gives those build assets, including CSS, JavaScript and generated
media, content-hashed names, so a new deployment receives new URLs. HTML,
settings API responses and non-fingerprinted assets keep their normal
Cloudflare policy and are not cached for one year.

## Web settings

`/settings/` is an editable site settings page. It saves only
`site.config.json` on the `blog` branch through the Cloudflare Pages Function at
`/api/settings`.

Saving requires the admin password stored in Cloudflare as `SETTINGS_PASSWORD`.
After a successful sign-in, the Worker creates an eight-hour HMAC-signed
`HttpOnly`, `Secure`, `SameSite=Strict` cookie. The configured password is not
stored in the browser, `site.config.json`, or the static site bundle. Saves use
the signed session and do not ask for the password again until it expires.

The web form controls site-level settings:

- title, author, description, domain, logo emoji and right-to-left text;
- Twitter, Instagram, GitHub, YouTube, Mastodon and public email;
- background, text, secondary text and link colors;
- QR, Tags, Archive, folder-name, previous/next, footer and metadata display.

Apple Notes `index` remains responsible for navigation and content structure.
The Mac publish script runs `git pull --ff-only origin blog` before exporting
Notes so settings commits made from the website do not conflict with later
snapshot pushes.
