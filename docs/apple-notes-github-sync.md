# Apple Notes to GitHub content protocol

This branch replaces Montaigne's hosted reader and renderer with a static GitHub Pages site. GitHub cannot read Apple Notes itself, so a Shortcut on the owner's iPhone must export the selected notes and attachments.

## What Montaigne does, and what Moire substitutes

Montaigne does not require every child folder to contain an `index`. Its service account continuously reads the shared root Apple Notes folder, so each direct child folder and the notes directly inside it automatically become a Collection. The root `index` controls navigation and global metadata. A child-folder `index` is optional and only customizes that Collection.

Pure iOS Shortcuts do not expose a Notes folder's parent, children or full path, so they cannot reproduce Montaigne's server-side “select one parent and recursively discover every future folder” operation. Moire uses one explicit root `index` instead:

```text
root index menu row
  -> plain source cell contains one exact anchor-note title
  -> Find Notes where Name contains source (without a result limit)
  -> keep exact title matches; require exactly one
  -> that NoteEntity.folder returns the current FolderEntity
  -> Find Notes where Folder is that exact FolderEntity
  -> export every note in that folder
```

This remains iPhone-only at runtime. The Mac may be used to create or repair the Shortcut, but publishing does not depend on the Mac being online.

## One-time setup and daily friction

The root Apple Notes folder contains one note named `index`. The Sync Folders Shortcut stores that root FolderEntity once, then requires exactly one note whose full title is `index`. The note contains the menu/source/path table documented in `configuration.md`.

For every public section, put the exact title of one uniquely titled note from that section in the `source` cell. It is ordinary text; an Apple Notes internal link is not required. Put the destination directory, such as `blog` or `projects/field-notes`, in `path`. The website ignores both columns; the Shortcut uses `source` as the folder capability and `path` as the GitHub destination.

Consequences:

- A new ordinary note inside an already authorized folder publishes automatically on the next sync. No index edit is required.
- A new public folder needs one new root-index row and one anchor note that already lives in that folder. The five Shortcut definitions do not change.
- A folder-level `index` note is optional.
- Rows with an empty `source` are virtual navigation only (Home, Tags, Archive, an external URL).
- Anchor titles must be unique both in the root index and among the Notes visible to the Shortcut. Missing, duplicate or unmatched anchors stop the complete sync; the Shortcut must never fall back to scanning every private note.
- Moving an anchor note intentionally moves the publication capability to its new current folder. iOS cannot verify that folder is still under the visual root; the root-index source anchor is therefore the authority.

The safe iPhone deployment target is one row per explicitly authorized Collection. Every non-empty `source` requires an explicit `path`, including one-level Collections, because iOS still cannot infer Notes ancestry or a repository destination. Exact zero-maintenance descendant discovery requires the Mac exporter described below.

## Two exporter modes

- **iPhone-safe mode:** keep the root-index `source` allow-list. Adding a public folder means adding one row in the root `index` note, but never editing any of the five Shortcut definitions.
- **Mac recursive mode:** select the Notes parent folder once. A Mac-side AppleScript/JXA exporter can walk `folders` recursively, preserve relative paths and publish future descendants without another mapping row. It can run after iCloud Notes sync, but the Mac must be awake and signed in.

There is deliberately no iPhone mode that scans every note and guesses membership from duplicate folder names. That would reduce setup friction by weakening the boundary around private Notes.

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
- `Moire Blog: Sync Folders and Notes to Github`: read the unique root index, resolve source-title folder anchors, validate the entire batch, then invoke Sync Notes.

The copied five-Shortcut set must not upload until every internal `Run Shortcut` action points only to the `Moire Blog:` versions and a dry run proves the batch boundary.

## GitHub write safety

Use a fine-grained token limited to this repository and Contents permission. GitHub cannot restrict a token to one branch, so protect `main` with a ruleset and configure the Shortcut to write only `blog`. Never commit the token.

Before any upload, the complete batch must pass:

1. unique root index and unique source anchor titles;
2. one exact FolderEntity per source row and no empty/missing folder;
3. safe, unique Unicode-normalized destination paths with no `..` or reserved route;
4. duplicate note destination detection before the first GitHub write;
5. all images prepared before their Markdown references are uploaded.

GitHub GET accepts only 200/404; PUT accepts only 200/201. Any other response stops with GitHub's returned message. Existing files update by SHA and identical images reuse their hashes.

Deletion, rename/move reconciliation, one-commit atomic batches and restart after a mid-batch network failure still require a manifest and are not claimed until implemented and tested.

## Deployment boundary

The repository's Pages workflow remains `main`-only. Pushing `blog` does not deploy or replace the formal site. A future branch preview must use an isolated service/address; one GitHub repository has only one Pages site at a given URL.
