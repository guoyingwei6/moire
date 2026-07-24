# Moire Blog

This `blog` branch turns the upstream Moire memo stream into a folder-based, static blog inspired by Montaigne. Apple Notes stays the writing app, a local Shortcut exports only the selected public folder, GitHub stores the Markdown and images, and SvelteKit builds the complete site.

No hosted Notes account or third-party publishing server is required. GitHub cannot read Apple Notes directly, so publishing still begins on the owner’s device.

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

Folders become section pages. Section pages show titles and dates; each title opens a permanent note page. The build also creates Tags, Archive, QR, RSS and Sitemap pages. Fenced Markdown code blocks and any number of local Markdown images are supported.

## Site settings

Edit [`site.config.json`](site.config.json) for the title, author, public URL, logo emoji, sidebar menu, social links, colors and display switches. GitHub Actions YAML is only the build-and-deploy recipe; it is not the settings database.

See [`docs/configuration.md`](docs/configuration.md) for every field and [`docs/apple-notes-github-sync.md`](docs/apple-notes-github-sync.md) for the Notes-to-GitHub content protocol.

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
