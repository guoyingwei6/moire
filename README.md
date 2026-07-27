# Moire Blog

Publish an Apple Notes folder tree as a Montaigne-style personal site.

Current production site:

- Blog branch site: <https://moires.guoyingwei.top>
- Production branch: `blog`
- Deployment: Cloudflare Pages

The current footer line is:

```text
Published from Apple Notes, versioned on GitHub, and deployed with Cloudflare Pages.
```

## What this branch does

This `blog` branch is a self-hosted Apple Notes publishing pipeline. It keeps the local Mac side deliberately small:

```text
iPhone Apple Notes
  -> iCloud sync
  -> Mac Notes.app exporter
  -> notes-export/public-notes.json on origin/blog
  -> Cloudflare Pages runs pnpm build
  -> SvelteKit renders the static site
  -> https://moires.guoyingwei.top
```

The Mac only exports a public snapshot and pushes it to GitHub. Parsing, Markdown generation, responsive images, site rendering, RSS, sitemap and deployment happen during the remote build.

## Branch roles

- `main`: original/upstream Moire route. It stays close to upstream and is served separately at <https://moire.guoyingwei.top>.
- `development`: minimal title-list experiment line. It is not used by this macOS Apple Notes exporter.
- `blog`: Montaigne-style Apple Notes folder site, exported from macOS and deployed by Cloudflare Pages.

The local publish script refuses to publish unless the current Git branch is `blog`.

## Apple Notes structure

Create one public parent folder in Apple Notes:

```text
guoyingwei.montaigne.io
├── index
├── Blog
├── Photo
├── Music
├── Video
└── About
```

The root `index` note has two jobs:

1. It provides the home page content.
2. Its menu table controls the public section allow-list and navigation.

Example root `index` menu table:

```markdown
| menu | url | type |
| --- | --- | --- |
| 🏠Home | / | sidebar |
| 📒Blog | /blog | sidebar |
| 🎞️Photo | /photo | sidebar |
| 🎧Music | /music | sidebar |
| 📺Video | /video | sidebar |
| 🏷️Tags | /tags | sidebar |
| 🧰Archive | /archive | sidebar |
| 🧑‍💻About | /about/about-me | sidebar |
```

Only direct child folders listed by safe local menu URLs are exported. A new note inside an already listed folder publishes automatically on the next Mac sync. A new public folder needs one row in the root `index` menu table.

Draft rule: notes whose title starts with `_` are skipped before the raw snapshot is written.

## Site settings

Global site settings live in `site.config.json`.

They can also be edited online at:

```text
https://moires.guoyingwei.top/settings/
```

The settings page can update:

- site title, author, description, domain, logo emoji and right-to-left text;
- Twitter, Instagram, GitHub, YouTube, Mastodon and public email;
- background, text, secondary and link colors;
- QR, tags, archive, folder name, previous/next links, footer and metadata toggles.

Settings save behavior:

- the web UI only writes `site.config.json`;
- it never edits Apple Notes content;
- it never edits the root `index` navigation table;
- saving creates a GitHub commit on `blog`;
- Cloudflare Pages then redeploys the site;
- the settings page stays open and shows a rounded translucent toast while deployment catches up.

Cloudflare Pages needs one server-side environment variable for online saves:

```text
GITHUB_TOKEN
```

Use a fine-grained GitHub token limited to this repository with Contents read/write access. Do not put the token in the repo, in frontend code, or in URLs.

## Rendering features

The site is built to preserve the parts of Apple Notes that matter for this blog:

- Montaigne-style left navigation and cream background.
- Section pages such as `/blog/`, `/photo/`, `/music/`, `/video/`, `/about/`.
- Note detail pages, for example `/blog/mac-os-setting-preferences/`.
- Markdown generated from Notes HTML during build.
- Tables and two-column information tables.
- Nested lists.
- Inline mono and mono/code blocks.
- Basic shell highlighting for mono code blocks.
- Multiple images per note.
- Adjacent images can render side by side.
- Draft notes hidden by `_` title prefix.
- RSS feeds and sitemap.
- Tags and archive pages, controlled by settings.

## Images

The repository keeps the original images exported from Apple Notes.

During build, `sharp` creates responsive WebP display images under `content/responsive-media`. These generated files are ignored by Git and recreated by Cloudflare.

Rendered behavior:

- the page loads a smaller responsive WebP when available;
- clicking the image opens the original exported image;
- if a source image cannot be converted, the site falls back to the original.

This keeps the original files available without forcing every page view to download the full iPhone original immediately.

## Link embeds

Only bare links are auto-rendered as embeds or cards. Labelled links stay normal links.

Auto-embed examples:

```markdown
https://photos.guoyingwei.top
https://maps.apple.com/?ll=40.025272,116.286638&q=...
https://www.google.com/maps/place/Beijing/@39.904211,116.407395,10z
https://www.bilibili.com/video/BV...
https://www.xiaohongshu.com/explore/...
https://github.com/guoyingwei6/moire
https://doi.org/10.1038/s41586-020-2649-2
https://music.apple.com/...
https://youtu.be/...
https://open.spotify.com/...
https://podcasts.apple.com/...
https://tv.apple.com/...
```

Currently supported:

- YouTube iframe embeds;
- Apple Music iframe embeds;
- Spotify iframe embeds;
- Apple Podcasts iframe embeds;
- Apple TV iframe embeds;
- personal photo site card for `photos.guoyingwei.top`;
- Apple Maps card;
- Google Maps card;
- Bilibili card;
- Xiaohongshu card;
- GitHub repository card;
- DOI card.

The project intentionally does not fetch arbitrary URL metadata during local export. Extra preview types should be added as explicit whitelist rules.

## Local commands

Run these from the `blog` worktree:

```sh
pnpm install
pnpm notes:export
pnpm notes:publish
pnpm notes:publish:push
pnpm notes:agent:install
pnpm notes:agent:status
pnpm setup:macos-sync
pnpm notes:build-content
pnpm build
pnpm test
pnpm check
pnpm test:build
```

Command meanings:

- `pnpm notes:export`: read the public Apple Notes tree and write `notes-export/public-notes.json`.
- `pnpm notes:publish`: export and create a local commit only if the snapshot changed.
- `pnpm notes:publish:push`: export, commit if changed, and push `origin/blog`.
- `pnpm notes:agent:install`: install or replace the macOS LaunchAgent for automatic sync.
- `pnpm notes:agent:status`: print the current LaunchAgent state.
- `pnpm setup:macos-sync`: run the full macOS setup flow for this branch.
- `pnpm notes:build-content`: regenerate `content/**` from the raw snapshot.
- `pnpm build`: run `prebuild`, generate responsive media and build the SvelteKit static site.
- `pnpm test`: run unit-level safety and content tests.
- `pnpm check`: run Svelte/TypeScript checks.
- `pnpm test:build`: inspect the generated build output.

The publish script first runs `git pull --ff-only origin blog` so online settings commits are integrated before the Mac pushes a new Notes snapshot.

## Automatic Mac sync

For a new Mac that already has Git, Node.js and pnpm:

```sh
git clone https://github.com/guoyingwei6/moire.git
cd moire
git checkout blog
node scripts/notes/setup-macos-sync.mjs
```

If dependencies are already installed, the shorter project command is:

```sh
pnpm setup:macos-sync
```

The setup script checks the branch, installs dependencies, performs one Apple
Notes export to trigger macOS Automation permission, renders a machine-specific
LaunchAgent plist, installs it into `~/Library/LaunchAgents/`, kickstarts it, and
prints the current status.

This Mac uses a user LaunchAgent as a simple pseudo-hook. It is not a
long-running watcher process. `launchd` starts it after login and then starts it
again every 10 minutes. Each run exports Apple Notes once, checks whether the raw
snapshot changed, commits only when changed, and pushes `origin/blog`.

```text
/Users/guoyingwei/Library/LaunchAgents/com.guoyingwei.moire-blog-notes.plist
```

It runs every 10 minutes:

```text
/opt/homebrew/bin/node scripts/notes/publish-macos-notes.mjs --push true
```

Current installed behavior on this Mac:

- LaunchAgent label: `com.guoyingwei.moire-blog-notes`
- Trigger: `RunAtLoad=true` and `StartInterval=600`
- Scope: user session only; it starts after the macOS user logs in, not before login
- Normal state between runs: `state = not running`
- Failure behavior: a failed run exits and will be tried again at the next interval
- No-change behavior: `changed=false`, `pushed=false`, no empty commit

Stability model:

- `launchd` is the supervisor. If one run fails, it does not keep a broken Node
  process alive; the next scheduled run tries again.
- The script refuses to run outside the `blog` branch, so it cannot accidentally
  publish to `main` or `development`.
- The script runs `git pull --ff-only origin blog` before export, so settings
  edits made from `/settings/` are integrated before the Mac pushes a Notes
  snapshot.
- Only `notes-export/public-notes.json` is committed by the automatic publisher.
  Markdown, responsive images and the final site are regenerated by Cloudflare.
- Empty runs do not create commits.

Known boundary: this is a login-session LaunchAgent, not a system daemon. If the
Mac is off, asleep, logged out, or Notes has not synced from iCloud yet, nothing
is pushed until the next successful run after the Mac is awake and logged in.

Useful checks:

```sh
pnpm notes:agent:status
tail -n 100 logs/launchd.out.log
tail -n 100 logs/launchd.err.log
git status --short --branch
```

To stop it:

```sh
pnpm notes:agent:uninstall
```

To start or reload it on a Mac:

```sh
pnpm notes:agent:install
```

To change the interval, edit `StartInterval` in
`scripts/notes/launchd/com.guoyingwei.moire-blog-notes.plist`, or run install
with an environment override:

```sh
MOIRE_NOTES_INTERVAL=1800 pnpm notes:agent:install
MOIRE_NOTES_INTERVAL=1800 node scripts/notes/setup-macos-sync.mjs
```

`600` means 10 minutes; `1800` means 30 minutes. The install script renders the
template with the current Node path and current worktree path, so the committed
template is portable across machines and users.

The normal no-change output is:

```text
changed=false
pushed=false
```

## Cloudflare Pages setup

Cloudflare Pages should use:

- repository: `guoyingwei6/moire`
- production branch: `blog`
- build command: `pnpm build`
- output directory: `build`
- custom domain: `moires.guoyingwei.top`
- environment variable for settings writes: `GITHUB_TOKEN`

No GitHub Actions workflow is required for this branch. Cloudflare deploys from the `blog` branch.

## Restore on another Mac

Minimum path:

```sh
git clone https://github.com/guoyingwei6/moire.git
cd moire
git checkout blog
node scripts/notes/setup-macos-sync.mjs
```

Prerequisites:

- macOS with Notes.app signed into the iCloud account that owns the public Notes
  folder.
- Git credentials that can push to the target repository.
- Node.js and pnpm installed.
- The `blog` branch checked out.

During the first run, macOS may ask whether Terminal/iTerm/Codex can control
Notes.app. Approve it; otherwise the exporter cannot read Apple Notes.

Check logs and Git status after setup:

```sh
pnpm notes:agent:status
tail -n 100 logs/launchd.out.log
tail -n 100 logs/launchd.err.log
git status --short --branch
```

For another user or repository fork, update these values first:

- Apple Notes root folder name:

```sh
node scripts/notes/setup-macos-sync.mjs --root "your.public.notes.folder"
```

- Git remote and branch if they are not `origin` and `blog`.
- Cloudflare Pages project settings: production branch, build command and
  `GITHUB_TOKEN` for `/settings/` writes.
- Site fields in `site.config.json` or `/settings/`.

## Current limits

- Only direct child folders of the public Apple Notes parent folder are supported.
- New public folders require adding a row to the root `index` menu table.
- The trigger is a 10-minute LaunchAgent pseudo-hook, not a true Apple Notes database event.
- Deletion, rename and move reconciliation is report-only. `content/.moire-manifest.json` records generated ownership and `content/.moire-reconcile.json` reports candidates, but cleanup deletion is not applied automatically.
- Generic arbitrary URL preview is intentionally not implemented. Add explicit whitelist preview rules instead.

## License

This project remains licensed under GPL-3.0.
