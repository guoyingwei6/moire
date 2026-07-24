# Apple Notes to GitHub content protocol

This branch replaces Montaigne’s hosted sync and rendering with a static GitHub Pages site. GitHub cannot read Apple Notes on its own: a Shortcut running on the owner’s iPhone, iPad or Mac must export the selected notes and attachments.

## Publication boundary

The `Moire-blog` Shortcut set uses six explicit folder mappings: the public root folder for Home, plus Blog, Photo, Music, Video and About. Each mapping is selected in the Shortcut editor before the sync is unlocked. It never scans all Notes, all iCloud folders or unrelated shared folders.

This fixed mapping is deliberate. Standard Shortcuts actions do not provide a reliable, testable way to discover and recurse through an arbitrary Apple Notes folder tree. Adding another public top-level folder therefore requires a new folder filter, a destination mapping and a matching `site.config.json` navigation item.

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

Every directory can have an optional `index.md`. Without one, the site still creates a folder page and lists its direct children. Filenames become stable URL segments, so renaming a file changes its URL.

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

The LAB uploader exports every image returned by Apple Notes, not only the first image. Each image is converted to PNG, named by a content hash and de-duplicated in one shared media directory, for example:

```text
content/media/7f36f93a.png
```

Section notes use a relative path from their folder:

```markdown
![](../media/7f36f93a.png)
```

The root `content/index.md` uses `./media/7f36f93a.png` instead. The current LAB sync appends the resulting image lines to the end of the note in the order returned by Shortcuts. It does not preserve the original interleaving of text and images inside Apple Notes. This is an explicit limitation, not a rendering limit in SvelteKit; the site can render any number of Markdown images once they are present.

## GitHub write path

The Shortcut can call GitHub’s API directly with a fine-grained token restricted to this repository and its Contents permission. GitHub tokens cannot be restricted to only one branch, so protect `main` with a ruleset and configure the copied Shortcut to write `blog`. Store the token only in the local Shortcut or Keychain; never commit it.

The current LAB candidate:

1. stays locked until all six folder mappings have been reviewed;
2. derives Unicode-safe slugs from note titles and detects duplicate destination paths for the complete batch before any upload action;
3. adds `created` and `updated` frontmatter from Apple Notes;
4. uploads every image by hash, then uploads each Markdown file to the `blog` branch through GitHub's Contents API;
5. updates an existing file by SHA and reuses an existing image with the same hash;
6. accepts only GitHub GET status 200/404 and PUT status 200/201, then stops with the returned GitHub message for any other status instead of silently continuing.

It does not yet keep an export manifest, delete notes removed from Apple Notes, create one atomic Git commit for the whole batch, or restore the previous state after a mid-batch network failure. Those are later reliability improvements. Until then, review deletions in GitHub manually and rerun a failed batch after correcting the reported error.

## Deployment boundary

The current repository workflow remains `main`-only, so this prototype does not publish automatically. When the local result is approved, add a separate preview target for `blog` or deploy it deliberately. One GitHub repository has one Pages site; `main` and `blog` cannot independently own two Pages sites at the same URL.
