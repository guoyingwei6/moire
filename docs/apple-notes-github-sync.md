# Apple Notes to GitHub content protocol

This branch replaces Montaigne's hosted reader and renderer with a static GitHub Pages site. GitHub cannot read Apple Notes itself, so a Shortcut on the owner's iPhone must export the selected notes and attachments.

## What Montaigne does, and what Moire substitutes

Montaigne does not require every child folder to contain an `index`. Its service account continuously reads the shared root Apple Notes folder, so each direct child folder and the notes directly inside it automatically become a Collection. The root `index` controls navigation and global metadata. A child-folder `index` is optional and only customizes that Collection.

Pure iOS Shortcuts do not expose a Notes folder's parent, children or full path. Moire therefore uses the already-existing root `index` as the publication capability instead of adding configuration to every note or child folder:

```text
one fixed public root FolderEntity
  -> exactly one root note titled index
  -> parse its existing menu | link | type table
  -> safe local content rows form the folder allow-list
  -> normalized menu label identifies the Notes folder display name
  -> local link identifies the destination below content/
  -> find all Notes and group only allow-listed direct FolderEntity names
  -> confirm the chosen FolderEntity contains every matching candidate
  -> export every note in that exact FolderEntity
```

This remains iPhone-only at runtime. The Mac may be used to create or repair the Shortcut, but publishing does not depend on the Mac being online. It relies on one explicit owner constraint accepted for this site: do not create another Notes folder outside the public tree with the same normalized display name as an allow-listed public folder.

## One-time setup and daily friction

The root Apple Notes folder contains one note named `index`. The Sync Folders Shortcut stores that root FolderEntity once, then requires exactly one note whose full title is `index`. The note keeps Montaigne's ordinary three-column menu table documented in `configuration.md`; no new columns are added.

For every public section, the menu label names the Notes folder after removing an initial emoji. The safe local link provides the GitHub route. The exporter normalizes Unicode, case, spaces and hyphens, then requires the menu label to match exactly one segment of the route. It uses the path through that segment as the destination directory:

```text
Blog        + /blog/                 -> content/blog/
About       + /about/about-me/       -> content/about/
Field Notes + /projects/field-notes/ -> content/projects/field-notes/
```

Generated routes such as Home, Tags, Archive, Search, QR, feeds, Sitemap and robots, plus external HTTPS links, do not authorize a Notes folder.

Consequences:

- A new ordinary note inside an already authorized folder publishes automatically on the next sync. No index edit is required.
- A new public folder needs one ordinary menu row in the single root `index`; the five Shortcut definitions do not change.
- A folder-level `index` note is optional.
- Empty authorized folders are skipped until their first note exists because Git cannot store an empty directory.
- If no Notes folder matches a content row, that row remains navigation-only and no private content is guessed.
- If matching notes do not all resolve to the same dynamic FolderEntity, the complete sync stops before any GitHub request.
- Folder names in the public allow-list must remain unique across the owner's Notes accounts and private folders. This is the accepted boundary that makes the three-column iPhone protocol deterministic for this site.

The safe iPhone deployment target is one row per explicitly authorized Collection. It does not require any per-note metadata, child `index`, anchor title, `source` column, `path` column or Shortcut edit.

## Two exporter modes

- **iPhone mode used here:** keep the root-index menu as the allow-list and keep public folder display names unique. Adding a public folder means adding one ordinary menu row, but never editing any of the five Shortcut definitions.
- **Mac recursive mode:** select the Notes parent folder once. A Mac-side AppleScript/JXA exporter can walk `folders` recursively, preserve relative paths and publish future descendants without another mapping row. It can run after iCloud Notes sync, but the Mac must be awake and signed in.

The iPhone mode does enumerate Notes locally so it can observe each note's direct FolderEntity, but it only exports names explicitly authorized by the root index. It does not upload the global scan, and ambiguity stops the batch. Unlike the optional Mac mode, it cannot publish an unlisted new folder automatically because iOS still cannot prove that folder is a descendant of the selected root.

## Repository layout

The root `index` becomes `content/index.md`. Each authorized Collection maps to a directory under `content/`:

```text
content/
├── index.md
├── blog/
│   ├── index.md                     # optional Collection settings/body
│   └── mac-os-setting-preferences.md
├── photo/
│   └── campus-sunset.md
└── about/
    └── about-me.md
```

The website generates a folder page even when no `index.md` exists. Git cannot store an empty directory, so an empty Notes folder appears only after its first exported note.

The root menu table is also the visible allow-list. A valid table suppresses automatic Sidebar insertion for unlisted Git directories. Publication scope is ultimately the combination of the root index authorization and the files committed under `content/`.

## Markdown contract

Default frontmatter contains only Apple Notes creation and update dates:

```yaml
---
created: 2026-07-24T10:30:00+08:00
updated: 2026-07-24T10:45:00+08:00
---
```

The first Markdown heading becomes the page title. A line containing only tags such as `#Mac #Tips` is removed from the body and becomes site metadata. `name/value` and root menu tables remain in exported Markdown so the build can interpret them; they are removed from visible HTML.

Apple Notes Monospaced formatting is not plain text. The exporter must preserve its style boundary:

- short inline Monospaced spans become single backticks;
- multi-line Monospaced blocks become fenced code blocks;
- a blank line or change back to Body style closes the fence;
- it must not guess that every line beginning with `$` or `#` is code.

This is why some commands in the old sync rendered as code while others did not: the Markdown uploaded to GitHub did not consistently contain code delimiters.

## Lightweight drafts

When a Note title begins with `_`, the exporter keeps it in the authorized section. The website removes the leading underscore from its route/title and excludes it from Sidebar/folder lists, Tags, Archive, RSS, Sitemap, footer discovery and previous/next links. The full direct URL still works.

It is not private: the file, attachment and Git history are public once pushed.

## Attachments

The renderer supports every Markdown image it receives. The exporter must iterate all image attachments, convert unsupported HEIC data to PNG or JPEG, hash each output and de-duplicate it in a shared media directory such as:

```text
content/media/7f36f93a.png
```

Section notes then reference `../media/7f36f93a.png`; the root note uses `./media/7f36f93a.png`.

Appending all images at the end in Shortcuts order is an acceptable first release, but it does not preserve Apple Notes' original text/image interleaving. The renderer itself has no one-image limit.

## Five-Shortcut responsibilities

- `Moire Blog: Config`: GitHub repository, `blog` branch and protocol constants. It does not contain a hand-maintained folder list.
- `Moire Blog: Clean Note to Markdown`: Notes rich-text to Markdown, configuration tables, Mono boundaries and all attachment extraction.
- `Moire Blog: Upload Images to Github`: content-hash naming and GitHub GET/PUT for every image.
- `Moire Blog: Sync Notes to Github`: validate and export one note into an already authorized destination directory.
- `Moire Blog: Sync Folders and Notes to Github`: read the unique root index, resolve its allow-listed menu labels to unique direct FolderEntity matches, validate the entire batch, then invoke Sync Notes.

The copied five-Shortcut set must not upload until every internal `Run Shortcut` action points only to the `Moire Blog:` versions and a dry run proves the batch boundary.

## GitHub write safety

Use a fine-grained token limited to this repository and Contents permission. GitHub cannot restrict a token to one branch, so protect `main` with a ruleset and configure the Shortcut to write only `blog`. Never commit the token.

Before any upload, the complete batch must pass:

1. one exact root index and one valid three-column menu table;
2. safe menu-label-to-route mappings and one observed FolderEntity for each non-empty authorized folder;
3. matching-note count equal to the selected dynamic FolderEntity note count, so observed duplicate folder names stop the batch;
4. safe, unique Unicode-normalized destination paths with no `..` or reserved route;
5. duplicate note destination detection before the first GitHub write;
6. all images prepared before their Markdown references are uploaded.

GitHub GET accepts only 200/404; PUT accepts only 200/201. Any other response stops with GitHub's returned message. Existing files update by SHA and identical images reuse their hashes.

Deletion, rename/move reconciliation, one-commit atomic batches and restart after a mid-batch network failure still require a manifest and are not claimed until implemented and tested.

## Deployment boundary

The repository's Pages workflow remains `main`-only. Pushing `blog` does not deploy or replace the formal site. A future branch preview must use an isolated service/address; one GitHub repository has only one Pages site at a given URL.
