# Moire Blog

This `blog` branch turns the upstream Moire memo stream into a folder-based, static blog inspired by Montaigne. GitHub stores the Markdown and images, and SvelteKit discovers the complete `content/` folder tree and builds the site.

No hosted Notes account or third-party publishing server is required. GitHub cannot read Apple Notes directly, so publishing still needs an owner-controlled exporter. The website side is ready for arbitrary nested folders. The iPhone protocol uses the existing root `index` menu as its publication allow-list: the menu label identifies the Apple Notes folder and the local link identifies its destination below `content/`. It does not add per-folder anchors or `source`/`path` columns. The five copied Shortcuts are not yet approved for real upload.

## Content model

```text
content/
├── index.md              -> /
├── blog/
│   ├── index.md          -> /blog/
│   └── a-note.md         -> /blog/a-note/
├── photo/
├── music/
├── video/
└── about/
```

Folders become section pages. A folder `index` is optional. Section pages support list, timeline, feed, grid and table layouts; each title opens a permanent note page. A note-level `slug` can provide a stable custom URL without moving it out of its folder. The build also creates Search, Tags, Archive, QR, RSS and Sitemap pages. Fenced Markdown code blocks and any number of local Markdown images are supported.

## Site settings

The root [`content/index.md`](content/index.md) is the daily control surface: its ordinary `menu | link | type` table configures Sidebar/Header navigation and doubles as the iOS publication allow-list. Its settings table controls the title, colours and display switches. Folder and note tables add inherited metadata, sorting, pinning and layouts. Prefix a note title with `_` to hide it from discovery while retaining its hard-to-guess direct page.

[`site.config.json`](site.config.json) remains the validated technical fallback and holds social defaults. GitHub Actions YAML is only the build-and-deploy recipe; it is not the settings database.

See [`docs/configuration.md`](docs/configuration.md) for every field, [`docs/apple-notes-github-sync.md`](docs/apple-notes-github-sync.md) for the Notes-to-GitHub content protocol, and [`docs/montaigne-parity.md`](docs/montaigne-parity.md) for the audited feature-parity boundary.

## Local development

```bash
pnpm install --frozen-lockfile
pnpm dev
```

Validate a root-domain build:

```bash
pnpm test
pnpm check
pnpm build
```

Validate GitHub project Pages at `/moire`:

```bash
BASE_PATH=/moire pnpm build
```

## Branch boundary

- `main` remains available for synchronizing the upstream Moire project.
- This implementation is developed on `blog`.
- The committed Pages workflow still listens only to `main`; pushing `blog` does not publish or replace the current site.

## License

This project remains licensed under GPL-3.0.
