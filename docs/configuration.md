<p align="center">
  <a href="./configuration.zh-CN.md">简体中文</a> · <strong>English</strong>
</p>

# Configure the site from Apple Notes

> Current implementation note: site-level settings are stored in `site.config.json` and can be edited from `/settings/`. The macOS-exported root `index` note controls navigation and content structure. Older references to iPhone Shortcut behavior describe the abandoned Shortcut route and are not required for the active `blog` deployment.

The public root note named `index` is the content control surface. It can hold the Home page body and the visible navigation. `site.config.json` stores site identity, colors, social links and default display switches. A present but invalid menu stops the build instead of silently widening the visible publication surface.

Cloudflare build settings are intentionally not a settings database. Cloudflare
only parses, builds and deploys the snapshot that the macOS exporter has already
pushed to the `blog` branch.

## The one root index

Add this table to the root `index` note:

```markdown
| menu | link | type |
| --- | --- | --- |
| 🏠 Home | / | |
| 📒 Blog | /blog/ | |
| 🎞️ Photo | /photo/ | |
| 🏷️ Tags | /tags/ | |
| 🧰 Archive | /archive/ | |
| About | /about/about-me/ | |
```

- `menu` is the visible label. An initial emoji becomes its icon; a bullet is used when no emoji is present.
- `link` accepts a safe site-local path or a credential-free HTTPS URL.
- An empty `type` means Sidebar. `header` puts the item in the top navigation. `footer` is retained for compatibility with older Montaigne index tables. This site's public About target is shown in the Sidebar and is also mirrored into the footer as `About me`; new pages can enter the footer through `showInFooter` metadata.

The same three columns also form the macOS export allowlist. For each safe local
content link, the exporter removes the leading emoji and normalizes the
remaining menu label as the Apple Notes folder name. The local link supplies the
repository route. The label must match exactly one path segment after
normalization, so `About` plus `/about/about-me/` maps the Notes folder `About`
to `content/about/`, while `Field Notes` plus `/projects/field-notes/` maps to
`content/projects/field-notes/`.

Home, Tags, Archive, Search, QR and XML/text endpoints are generated routes and are not treated as Notes folders. HTTPS links are navigation only. No `source` or `path` columns, anchor notes, folder-level `index` notes or Shortcut edits are required.

The active macOS exporter reads only direct child folders of the configured
public parent folder. A root menu entry must match one of those child folder
names after normalization. It never broadens the publication scope by searching
unrelated Notes folders with the same name.

When a valid root menu table exists, it is authoritative: only its safe local
section rows are exported and shown in Sidebar/Header navigation. If there is no
menu table, `site.config.json` plus automatic folder discovery is used for
backward compatibility. If a menu table exists but is invalid, the build stops
instead of silently falling back to a broader publication scope.

The configuration table itself is removed before the Home page Markdown renders.

## Site settings

Use `/settings/` for site-level settings. The form writes `site.config.json`
on the `blog` branch and Cloudflare Pages redeploys the site.

The editable site settings are:

- title, author, description, domain, logo emoji and right-to-left text;
- Twitter, Instagram, GitHub, YouTube, Mastodon and public email;
- background, text, secondary text and link colors;
- QR, Tags, Archive, folder-name, previous/next, footer and metadata display.

These settings are intentionally not read from the Apple Notes root `index` note.
This avoids a conflict where a future Notes sync would override settings saved
from the web page.

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
- `showInFooter`: add a public page to the footer and remove it from automatic collection listings. An explicit root-menu row remains explicit.
- `showChildren`: show or hide a collection's child listing.
- `showNestedNotes`: include descendants rather than only direct children.
- `sortBy`: `create`, `update` or `title`.
- `layout`: `list`, `timeline`, `feed`, `grid` or `table`.
- `previewProps`: comma-separated metadata keys displayed in folder previews/table columns.
- `showBreadcrumbs`, `showNoteNavigation`, `showNoteFooter`, `showNoteMetadata`.
- `date`: override the displayed/ordering creation date; `tags`: comma-separated tags merged with hashtag lines.
- `slug`: replace an ordinary note's filename-derived URL with one safe segment inside the same folder, for example `stable-note`. Values may use Unicode letters and numbers plus dots, underscores, tildes and hyphens. Empty values, collection `index` notes and other URL punctuation stop the build.
- `aliases`: add comma-separated alternative URLs for a note. A bare value such as `old-title` creates a sibling URL; an absolute value such as `/old/blog/title/` creates that site-local URL. Each alias becomes a static permanent redirect to the canonical note. External URLs, generated endpoints, unsafe segments and collisions stop the build. Montaigne documents the property but not its exact list grammar; this explicit grammar keeps the GitHub-only result deterministic.

Identity and collection controls such as `pinned`, `showInMenu`, `showInFooter`, `showChildren`, `sortBy`, `layout` and `previewProps` are local to that note/index. Site identity, colors, social links and default display switches belong to `/settings/` / `site.config.json`.

A folder `index` is optional. Without it, the folder still publishes and lists
its notes using defaults. Creating a new ordinary note inside an already
authorized folder requires no index edit and no exporter change.

## Drafts

Prefix an Apple Note title with `_` to keep it out of the public snapshot.
Drafts are skipped by the macOS exporter before
`notes-export/public-notes.json` is written, so the remote build does not create
a page, media, Tags/Archive entry, feed item or Sitemap entry for them.

This is a publication rule, not access control for content that was previously
published. If a note or attachment already exists in Git history, removing it
from a later snapshot does not erase that history.

## Repository fallback and Pages base path

`site.config.json` stores site identity, colors, social links, default display switches and a fallback menu. Most daily content-structure changes should happen in the root Apple Note. Most site-appearance changes should happen in `/settings/`.

The public domain and SvelteKit base path remain separate:

- Custom domain or user Pages site: build with an empty `BASE_PATH`.
- Project Pages site at `/moire`: build with `BASE_PATH=/moire`.

Changing the `/settings/` site domain updates canonical URLs, feeds, Sitemap and QR output. It does not configure DNS, GitHub Pages or Cloudflare custom-domain bindings itself.

## Note password protection

Add a `name/value` configuration table to an ordinary note with a `password` field to lock that note:

```markdown
| name | value |
| --- | --- |
| password | your-password |
```

Chinese field name `密码` is also accepted. A locked note will:

- encrypt its rendered HTML at build time with **AES-256-GCM** (PBKDF2 key derivation) and store only ciphertext in the page
- show a lock prompt; readers decrypt and render the body in the browser after entering the correct password
- be excluded from search indexes, RSS feeds, the sitemap, and section listings
- never ship the plaintext body or password value in static build output

To use one shared password instead of writing it into every note, add:

```markdown
| name | value |
| --- | --- |
| locked | yes |
```

and set Cloudflare Pages environment variable `MOIRE_NOTES_PASSWORD=your-shared-password` (or `export MOIRE_NOTES_PASSWORD=...` before a local `pnpm build`).

## Accent hover UI

The site link color from `/settings/` (CSS variable `--accent`) is used for:

- sidebar navigation hover and the current section highlight
- page title hover, plus list/table/feed title hover
- footer utility links and author link hover

If unset, the theme default accent is used.
