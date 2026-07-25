# Apple Notes to GitHub content protocol

This branch replaces Montaigne’s hosted sync and rendering with a static GitHub Pages site. GitHub cannot read Apple Notes on its own: a Shortcut running on the owner’s iPhone, iPad or Mac must export the selected notes and attachments.

## Publication boundary

The website publication boundary is the repository's `content/` directory. It discovers Markdown files at any depth, preserves their relative directory hierarchy and generates missing folder pages. Once a new top-level directory contains at least one Markdown note, it also appears in the sidebar unless `site.config.json` already provides an override for that folder or a page inside it.

Apple Notes export is a separate, unresolved boundary. The five copied `Moire-blog` Shortcuts are not yet a complete or approved publishing workflow. Native Notes actions on iPhone and iPad do not expose a folder's parent or relative path and cannot recursively enumerate every descendant of one selected parent folder. A one-time parent-folder selection therefore cannot currently provide zero-configuration recursive publishing on iOS. The future exporter must either run on a Mac through the Notes scripting interface or use a different content source that exposes folder paths. Until one route is implemented and tested, this document does not claim that Apple Notes recursive sync is available.

Recommended source layout:

```text
Public Website
├── index
├── Blog
├── Photo
├── Music
├── Video
└── About
```

The root folder must contain one note named `index`; it becomes the Home page. A note named `index` inside a section becomes that section's optional introduction. The exported repository layout is:

```text
content/
├── index.md                         -> / (public root/index)
├── blog/
│   ├── index.md                     -> /blog/
│   └── mac-os-setting-preferences.md -> /blog/mac-os-setting-preferences/
├── photo/
│   └── campus-sunset.md             -> /photo/campus-sunset/
└── about/
    └── about-me.md                  -> /about/about-me/
```

Every directory can have an optional `index.md`. Without one, the site still creates a folder page and lists its direct children. Git does not store empty directories, so an empty Apple Notes folder appears only after its first public note is exported. Filenames become stable URL segments, so renaming a file changes its URL. An implicit folder page derives its display name from the exported path; add an `index` note or a `site.config.json` navigation override when an exact custom label is important.

## Markdown contract

The default frontmatter contains only the Note creation and update dates:

```yaml
---
created: 2026-07-24T10:30:00+08:00
updated: 2026-07-24T10:45:00+08:00
---
```

The first Markdown heading becomes the page title. A line containing only tags such as `#Mac #Tips` is removed from the body and becomes site metadata.

Apple Notes Monospaced formatting is not plain text. The exporter must preserve the style boundary:

- Short inline Monospaced spans become single backticks.
- Multi-line Monospaced blocks become fenced code blocks.
- A blank line or a change back to Body style closes the fenced block.
- The exporter must not guess that every line beginning with `$` or `#` is code.

This conversion is the reason some commands in the old sync rendered as code while others did not: the Markdown received by GitHub did not contain a consistent code delimiter.

## Attachments

The website renderer supports every Markdown image it receives, not only the first image. A future exporter should convert every Apple Notes image to PNG, name it by a content hash and de-duplicate it in one shared media directory, for example:

```text
content/media/7f36f93a.png
```

Section notes use a relative path from their folder:

```markdown
![](../media/7f36f93a.png)
```

The root `content/index.md` uses `./media/7f36f93a.png` instead. The unfinished LAB design appends the resulting image lines to the end of the note in the order returned by Shortcuts; it does not preserve the original interleaving of text and images inside Apple Notes. This is a prototype limitation, not a rendering limit in SvelteKit. It must be retested as part of whichever export route is selected.

## GitHub write path

The Shortcut can call GitHub’s API directly with a fine-grained token restricted to this repository and its Contents permission. GitHub tokens cannot be restricted to only one branch, so protect `main` with a ruleset and configure the copied Shortcut to write `blog`. Store the token only in the local Shortcut or Keychain; never commit it.

Any future uploader must:

1. stay locked until its public source boundary and GitHub destination have been reviewed;
2. preserve whatever relative folder paths the selected source exposes, create Unicode-safe slugs from note titles and detect duplicate destination paths for the complete batch before any upload action;
3. add `created` and `updated` frontmatter from Apple Notes;
4. upload every image by hash, then upload each Markdown file to the `blog` branch through GitHub's Contents API;
5. update an existing file by SHA and reuse an existing image with the same hash;
6. accept only GitHub GET status 200/404 and PUT status 200/201, then stop with the returned GitHub message for any other status instead of silently continuing.

The currently copied five-Shortcut set does not yet satisfy this complete list and must not be treated as a working uploader.

An export manifest, safe handling for notes removed from the source, one atomic Git commit for a complete batch and recovery after a mid-batch network failure remain future reliability requirements. No real publishing workflow should rely on those behaviors until they are implemented and tested.

## Deployment boundary

The current repository workflow remains `main`-only, so this prototype does not publish automatically. When the local result is approved, add a separate preview target for `blog` or deploy it deliberately. One GitHub repository has one Pages site; `main` and `blog` cannot independently own two Pages sites at the same URL.
