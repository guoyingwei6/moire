# Moire Blog

This `blog` branch publishes an Apple Notes folder tree as a Montaigne-style static site.

Current verified chain:

```text
iPhone Apple Notes
  -> iCloud sync
  -> Mac Notes.app exporter
  -> notes-export/public-notes.json on origin/blog
  -> Cloudflare Pages prebuild converts the snapshot to content/**
  -> https://moires.guoyingwei.top
```

The Mac only exports and pushes a raw public snapshot. GitHub/Cloudflare do the parsing, content generation and deployment.

## Branches and domains

- `main`: upstream/original Moire route, served separately at `https://moire.guoyingwei.top`.
- `development`: minimal title-list experiment line; not used by this macOS exporter.
- `blog`: macOS Apple Notes exporter and Cloudflare Pages deployment for `https://moires.guoyingwei.top`.

The exporter refuses to publish unless the current Git branch is `blog`.

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

The root `index` note controls the home page and the public section allow-list. Its menu table should contain `menu` and `url` columns:

```markdown
| menu | url | type |
| --- | --- | --- |
| 🏠Home | / | sidebar |
| 📒Blog | /blog | sidebar |
| 🎞️Photo | /photo | sidebar |
| 🎧Music | /music | sidebar |
| 📺Video | /video | sidebar |
| 🧑‍💻About | /about/about-me | sidebar |
```

Only direct child folders listed by this table are published. Notes whose title starts with `_` are skipped before the raw snapshot is written.

## Local commands

From the `blog` worktree:

```sh
pnpm install
pnpm notes:export
pnpm notes:publish
pnpm notes:publish:push
pnpm build
pnpm test
pnpm test:build
```

- `pnpm notes:export` writes `notes-export/public-notes.json`.
- `pnpm notes:publish` exports and creates a local commit only if the snapshot changed.
- `pnpm notes:publish:push` does the same and pushes `origin/blog` only when a new commit was created.
- `pnpm build` runs `prebuild`, which regenerates `content/**` from the snapshot.

## Automatic Mac sync

A user LaunchAgent is installed on this Mac:

```text
/Users/guoyingwei/Library/LaunchAgents/com.guoyingwei.moire-blog-notes.plist
```

It runs every 10 minutes:

```text
/opt/homebrew/bin/node scripts/notes/publish-macos-notes.mjs --push true
```

Useful checks:

```sh
launchctl print gui/$(id -u)/com.guoyingwei.moire-blog-notes
tail -n 100 logs/launchd.out.log
tail -n 100 logs/launchd.err.log
git status --short --branch
```

To stop it:

```sh
launchctl bootout gui/$(id -u)/com.guoyingwei.moire-blog-notes
```

## Restore on another Mac

1. Clone this repository and checkout `blog`.
2. Install Node, pnpm and Git.
3. Make sure Notes.app is signed into iCloud and has the public parent folder.
4. Run `pnpm install`.
5. Run `pnpm notes:export` once and approve macOS Automation permission for the terminal to control Notes.app.
6. Run `pnpm notes:publish` and confirm it refuses to run outside `blog`.
7. Copy `scripts/notes/launchd/com.guoyingwei.moire-blog-notes.plist` to `~/Library/LaunchAgents/`.
8. Run `launchctl bootstrap`, `launchctl enable`, and `launchctl kickstart`.

Cloudflare Pages should use production branch `blog`, build command `pnpm build`, output directory `build`, and custom domain `moires.guoyingwei.top`.

## Current limits

- Only direct child folders of the public parent are supported.
- Deletion/rename/move reconciliation is report-only. `content/.moire-manifest.json` records generated Markdown/media ownership and `content/.moire-reconcile.json` reports upsert/remove/relocate candidates, but cleanup deletion is not applied automatically.
- The trigger is a 10-minute LaunchAgent pseudo-hook, not a real Apple Notes change event.

## License

This project remains licensed under GPL-3.0.
