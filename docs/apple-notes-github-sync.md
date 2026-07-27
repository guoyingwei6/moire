# Apple Notes to GitHub sync

This document describes the currently verified `blog` branch sync path.

## Current architecture

```text
Notes.app on macOS
  -> scripts/notes/export-macos-notes.mjs
  -> notes-export/public-notes.json
  -> git commit/push origin/blog
  -> Cloudflare Pages runs pnpm build
  -> scripts/notes/build-content-from-export.mjs regenerates content/**
```

GitHub and Cloudflare cannot read Apple Notes directly. The Mac is the only Apple Notes reader. It does not render the final website; it only exports the public raw snapshot and pushes it when the snapshot changes.

## Publication scope

The exporter reads one Apple Notes parent folder:

```text
guoyingwei.montaigne.io
```

The root note named `index` supplies the home page and a menu table. The menu table is also the public section allow-list. A direct child folder is exported only when its normalized folder name is represented by a safe local menu URL.

Example:

```markdown
| menu | url | type |
| --- | --- | --- |
| 📒Blog | /blog | sidebar |
| 🎞️Photo | /photo | sidebar |
| 🧑‍💻About | /about/about-me | sidebar |
```

This publishes the direct child folders `Blog`, `Photo`, and `About`. A note added inside an already listed folder publishes automatically on the next Mac sync. A new public folder needs one new row in the root `index` menu table.

Draft rule: notes whose title starts with `_` are skipped before `notes-export/public-notes.json` is written.

## Snapshot and conversion

`notes-export/public-notes.json` contains:

- root folder metadata;
- direct section names;
- note title, Apple Notes ID, created/modified time;
- HTML body exported from Notes.app.

During build, the converter:

- creates `content/index.md`;
- creates section directories like `content/blog/`;
- creates note pages like `content/blog/mac-os-setting-preferences.md`;
- extracts embedded base64 images into `content/media/<sha1>.<ext>`;
- preserves image order from the exported HTML;
- converts tables, inline mono text, and simple mono blocks into Markdown.

Stable identity is handled by:

- Apple Notes `id` in the raw snapshot;
- deterministic slug generation from note titles;
- content-hash filenames for images.

`pnpm notes:build-content` also writes two machine files:

- `content/.moire-manifest.json`: SHA-256 ownership record for generated Markdown and media.
- `content/.moire-reconcile.json`: report-only upsert/remove/relocate plan.

The report is intentionally non-destructive. It can identify deleted, renamed
or moved output paths, but the current deployment does not automatically delete
repository content.

## Publish commands

Manual local publish without push:

```sh
pnpm notes:publish
```

Automatic publish with push:

```sh
pnpm notes:publish:push
```

The publish script refuses to run unless the current Git branch is `blog`. It commits only `notes-export/public-notes.json`, and only when that file changed.

## LaunchAgent

The installed LaunchAgent runs every 10 minutes:

```text
com.guoyingwei.moire-blog-notes
```

It executes:

```text
/opt/homebrew/bin/node scripts/notes/publish-macos-notes.mjs --push true
```

Check it with:

```sh
launchctl print gui/$(id -u)/com.guoyingwei.moire-blog-notes
tail -n 100 logs/launchd.out.log
tail -n 100 logs/launchd.err.log
```

The verified no-change behavior is `changed=false` and `pushed=false`.
