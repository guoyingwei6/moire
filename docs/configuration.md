# Configure the site from Apple Notes

The public root note named `index` is the primary control surface. It can hold the Home page body, the visible navigation and global site settings in one place. `site.config.json` remains the validated fallback when the menu table is absent. A present but invalid menu stops the build instead of silently widening the visible publication surface.

GitHub Actions YAML is intentionally not a settings database. The workflow only checks, builds and deploys the content that the Shortcut has already exported.

## The one root index

Add this table to the root `index` note:

```markdown
| menu | link | type | source | path |
| --- | --- | --- | --- | --- |
| 🏠 Home | / | | | |
| 📒 Blog | /blog/ | | MacOS setting preferences | blog |
| 🎞️ Photo | /photo/ | | Campus Sunset | photo |
| 🏷️ Tags | /tags/ | | | |
| 🧰 Archive | /archive/ | | | |
| About | /about/about-me/ | footer | About Me | about |
```

- `menu` is the visible label. An initial emoji becomes its icon; a bullet is used when no emoji is present.
- `link` accepts a safe site-local path or a credential-free HTTPS URL.
- An empty `type` means Sidebar. `header` puts the item in the top navigation. `footer` is retained for compatibility with older Montaigne index tables (including this site's original table). New pages can also enter the footer through `showInFooter` metadata.
- `source` is Moire's iOS-only extension. Enter the exact plain-text title of one uniquely titled note in the folder that the row authorizes for publication. The exporter first uses Notes' supported `Name contains` search, then keeps exact-title matches and requires exactly one. The website ignores this column. Home, Tags, Archive and external virtual links leave it empty.
- `path` is the safe repository directory below `content/`, for example `blog` or `projects/field-notes`. Every row with a non-empty `source` must also provide an explicit `path`; the exporter does not guess it from the URL or Notes folder name. The website parses but does not display or execute it. This does not make iOS capable of discovering Notes descendants.

When a valid root menu table exists, it is authoritative: only its rows appear in Sidebar/Header navigation. This is the requested visual publication allow-list. Notes already present in Git remain directly reachable, just like Montaigne drafts, but they are not automatically inserted into the navigation. If there is no menu table, `site.config.json` plus automatic folder discovery is used for backward compatibility. If a menu table exists but is invalid, the build stops instead of falling back open.

The configuration table itself is removed before the Home page Markdown renders.

## Global settings in the same note

Add a separate `name/value` table anywhere in the root `index` note:

```markdown
| name | value |
| --- | --- |
| title | GYW's Website |
| description | Notes, photos, music and videos published from Apple Notes. |
| logoEmoji | 📌 |
| showChildren | no |
| backgroundColor | #fffef2 |
| linkColor | #fa2f41 |
```

Currently connected global properties are:

- `title`, `author`, `description`, `domain`, `emoji`/`logoEmoji`, `RTL`
- `twitter`, `instagram`, `github`, `youtube`, `mastodon`, `email` (also accepts the older `...Username`, `...Link` and `publicEmail` names)
- `backgroundColor`, `textColor`, `secondaryTextColor`, `linkColor`
- `showQRCode`, `showTags`, `showArchive`, `showNoteNavigation`, `showNoteFooter`, `showNoteMetadata`, `showBreadcrumbs`
- Montaigne-compatible inverse names `hideQRCodeLink`, `hideTagsLink` and `hideArchiveLink`

Booleans accept `yes/no`, `true/false`, `1/0` and `on/off`. Colours must be 3, 4, 6 or 8 digit hex values. Invalid controlled values stop the build with the property name instead of silently generating broken CSS or unsafe links.

`showChildren=no` on the root hides the Home page's child listing; it does not stop child folders from publishing or hide explicit Sidebar rows.

## Folder and note metadata

The same `name/value` table may be placed in a folder's optional `index` note or in an ordinary note. Configuration rows are removed from the rendered article. Display properties inherit in this order:

```text
ordinary note > folder index > root index > site.config.json defaults
```

Each property name may appear only once in a note. Duplicate rows stop the build so an ambiguous setting cannot silently fall back to a broader default.

Core properties connected in this branch:

- `pinned`: place a note first inside its folder.
- `showInMenu`: hide an ordinary note or child folder from its folder listing without removing its direct URL.
- `showInFooter`: add a public page to the footer.
- `showChildren`: show or hide a collection's child listing.
- `showNestedNotes`: include descendants rather than only direct children.
- `sortBy`: `create`, `update` or `title`.
- `layout`: `list`, `timeline`, `feed`, `grid` or `table`.
- `previewProps`: comma-separated metadata keys displayed in folder previews/table columns.
- `showBreadcrumbs`, `showNoteNavigation`, `showNoteFooter`, `showNoteMetadata`.
- `date`: override the displayed/ordering creation date; `tags`: comma-separated tags merged with hashtag lines.

Identity and collection controls such as `pinned`, `showInMenu`, `showInFooter`, `showChildren`, `sortBy`, `layout` and `previewProps` are local to that note/index. Visual note settings such as breadcrumbs and metadata visibility inherit.

A folder `index` is optional. Without it, the folder still publishes and lists its notes using defaults. Creating a new ordinary note inside an already authorized folder requires no index edit and no Shortcut edit.

## Lightweight drafts

Prefix an Apple Note title with `_` to make it a lightweight draft. For example `_New camera notes` becomes the direct path `/new-camera-notes/`, but is excluded from discovery surfaces including:

- Sidebar and folder listings
- Tags and Archive
- RSS and Sitemap
- footer links and previous/next navigation

The direct page is deliberately still generated and carries `noindex, nofollow` for ordinary search crawlers. This is not privacy protection: the Markdown and attachments remain in the public repository and Git history once uploaded.

## Repository fallback and Pages base path

`site.config.json` still stores defaults, social links and a fallback menu. Most daily changes should now happen in the root Apple Note instead of editing JSON or code.

The public domain and SvelteKit base path remain separate:

- Custom domain or user Pages site: build with an empty `BASE_PATH`.
- Project Pages site at `/moire`: build with `BASE_PATH=/moire`.

Changing the root `domain` setting updates canonical URLs, feeds, Sitemap and QR output. It does not configure DNS or GitHub Pages itself.
