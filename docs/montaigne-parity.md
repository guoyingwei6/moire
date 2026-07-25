# Montaigne parity map

This map records the 2026-07-25 audit of the public Montaigne documentation and keeps evidence separate from implementation claims. The audit covered all 52 sitemap articles: 22 Features, 16 Guides, 10 Demo pages, plus FAQ, Limits, Changelog and Roadmap. The four section landing pages, Archive, Search, feeds, Sitemap, robots, PDF and QR endpoints were checked separately.

## Folder and index model

Montaigne's service account reads the shared Apple Notes folder tree. It turns each direct child folder into a Collection and publishes the notes directly inside it. The root `index` controls global metadata and custom navigation; a Collection-level `index` is optional and only customizes that Collection. Montaigne documents one child-folder level, not arbitrary Notes nesting.

Moire cannot use Montaigne's private service account. Its iPhone-safe substitute is:

```text
one fixed public root FolderEntity
  -> exactly one root note titled index
  -> existing menu | link | type rows form the allow-list
  -> normalized menu label matches a direct Folder display name
  -> local link selects the destination below content/
  -> matching-note count must equal the selected FolderEntity note count
```

Ordinary notes added to an already authorized folder require no configuration change. A new public Collection adds one ordinary root-index menu row; the five Shortcut definitions remain unchanged. The owner has accepted one environment constraint: no private or cross-account folder may reuse an allow-listed public folder name. An observed duplicate stops the complete batch.

## Implemented on the blog branch

- Static folder pages with optional folder `index.md` and stable note pages.
- Root `index` menu plus Sidebar, Header and Footer destinations.
- Root, folder and note `name/value` metadata with inheritance.
- `showChildren`, `showNestedNotes`, `showInMenu`, `showInFooter`, `pinned`, `sortBy`, `layout`, `previewProps`, breadcrumbs, metadata, footer and previous/next switches.
- List, timeline, feed, grid and table Collection layouts.
- Lightweight `_` drafts: excluded from discovery, but still prerendered at their direct URL.
- Tags, Archive, QR, RSS, Sitemap, robots and 404 pages.
- Static HTML article bodies, safe links, fenced/inline code styling and multiple Markdown images.
- Empty `type` or `sidebar`, plus `header` and `footer`, in the root menu table.
- Fail-closed root menus: a present but invalid allow-list stops the build instead of exposing automatically discovered directories.

## iPhone exporter contract

The iOS Notes API exposes a note's direct FolderEntity, but not folder parents, children or complete paths. The exporter therefore enumerates Notes locally, reads only direct folder display names, and exports only names explicitly authorized by the root-index menu. Global candidates are never uploaded. This is deterministic for the accepted unique-folder-name environment but is not a general proof of folder ancestry.

The first safe release targets:

- one-time fixed root FolderEntity and exact root `index` lookup;
- strict three-column menu parsing, safe local path derivation and virtual-route exclusion;
- normalized folder-name matching followed by an exact dynamic FolderEntity count check;
- complete-batch validation before the first GitHub request;
- all image attachments, while accepting that their original rich-text interleaving is not reconstructed;
- Monospaced style boundaries exported as inline or fenced Markdown code;
- `_` notes uploaded with a leading-underscore filename so the website can apply the lightweight-draft policy;
- GitHub upserts only; stale remote deletion and rename/move reconciliation remain unimplemented until a manifest protocol is added.

## Feasible later without a hosted Notes service

These are static-site features and can be added directly in SvelteKit when their use becomes important:

- aliases through generated redirect pages;
- client-side full-text Search;
- table of contents and Markdown footnotes;
- authors, more metadata fields and richer preview cards;
- per-Collection feeds and printable/PDF output;
- stable internal-note links once the exporter provides a durable note-ID manifest;
- captions and same-line image galleries when the exporter preserves attachment positions.

## Features that need an extra service or a deliberate trade-off

- privacy-preserving server analytics;
- dynamic social images;
- Apple Maps snapshots and broad rich embeds;
- newsletter forms;
- large audio/video/PDF hosting outside ordinary Git storage;
- Montaigne-style background polling within 30–60 seconds;
- automatic remote deletion reconciliation.

These are not presented as GitHub-only features. They should be added only when the extra dependency solves a real use case.

## Known Montaigne documentation inconsistencies

- Drafts are documented as a leading `_`; an older Changelog also mentions `[draft]`.
- `showPostNavigation` and `showNoteNavigation` both appear; Moire accepts both.
- The default layout is described as both timeline and list; Moire uses list.
- Analytics is described as unavailable in an older FAQ but available in a later feature page.
- Image limits are documented more specifically as 50 MB, while audio/video use 100 MB.
- The live Apple Notes internal-link demo currently exposes raw `applenotes:` text instead of a working site link.

The implementation follows the current, testable behavior where documentation conflicts.
