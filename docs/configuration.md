# Site configuration

All Montaigne-style site settings live in the repository root at `site.config.json`. Edit that file in GitHub's web editor or locally, commit it to the publishing branch, and let the normal GitHub Pages build run.

GitHub Actions YAML is intentionally not the settings database. A workflow should only install, check, build and deploy the site. Keeping the settings in JSON makes them usable during local preview, visible to TypeScript, and independent of a specific CI provider.

## Settings

```json
{
  "site": {
    "title": "GYW's Website",
    "author": "YingweiGuo",
    "description": "Notes published from Apple Notes.",
    "domain": "https://guoyingwei6.github.io/moire",
    "logoEmoji": "📌",
    "rtl": false
  },
  "social": {
    "twitter": "",
    "instagram": "",
    "github": "https://github.com/guoyingwei6",
    "youtube": "",
    "mastodon": "",
    "email": ""
  },
  "colors": {
    "background": "#fffef2",
    "text": "#000000",
    "secondary": "#555555",
    "link": "#fa2f41"
  },
  "navigation": [
    { "icon": "🏠", "label": "Home", "href": "/" },
    { "icon": "📒", "label": "Blog", "href": "/blog/" },
    { "icon": "🎞️", "label": "Photo", "href": "/photo/" },
    { "icon": "🎧", "label": "Music", "href": "/music/" },
    { "icon": "📺", "label": "Video", "href": "/video/" },
    { "icon": "🏷️", "label": "Tags", "href": "/tags/" },
    { "icon": "🧰", "label": "Archive", "href": "/archive/" },
    { "icon": "🧑‍💻", "label": "About", "href": "/about/about-me/" }
  ],
  "features": {
    "qrCode": true,
    "tags": true,
    "archive": true,
    "previousNext": true,
    "footer": true,
    "metadata": false,
    "folderName": false
  }
}
```

- `site.title` controls the visible home heading, browser titles, feeds and site metadata. The first heading in `content/index.md` is still used as a content fallback during parsing, so keeping the two values aligned makes the source file easier to understand.
- `site.domain` is the public site URL. For a project Pages site, keep the repository path, for example `https://owner.github.io/moire`. For a custom domain use its complete `https://` URL. A trailing slash is accepted and removed during the build.
- `site.logoEmoji` is the mark shown above the sidebar navigation. `site.rtl` changes the document content direction and moves the desktop sidebar to the right.
- `social.twitter`, `social.instagram` and `social.github` accept either a username (with an optional leading `@`) or a complete `https://` profile URL. Usernames are expanded to the corresponding public profile URL during the build. YouTube and Mastodon accept complete `https://` URLs. Leave unused services empty. `social.email` is a public address; never put a GitHub token or other secret here.
- Colors must be 3, 4, 6 or 8 digit hex colors such as `#fff`, `#fffef2` or `#000000ff`. Invalid values stop the build instead of silently producing a broken theme.
- `navigation` is the ordered desktop and mobile sidebar menu. Each item has an emoji or short mark, a label and a site-local path. This is the Git-backed equivalent of Montaigne's menu table: add, remove or reorder entries in JSON without editing Svelte. Paths must begin with one `/`, cannot contain `..`, a query or a fragment, and must be unique. Folder pages are generated from `content/`; adding a completely new top-level folder therefore needs both content and a navigation entry if it should appear in the sidebar.
- `features.qrCode` controls the QR link in the footer. `features.tags` and `features.archive` control their sidebar and footer links. These switches do not delete or make the corresponding public pages private, and hiding the Tags link does not hide tags attached to a note.
- `previousNext` controls the links below an article, `footer` controls the complete site footer, `metadata` controls the visible Date/Words/Time to read block, and `folderName` controls whether a post shows its parent folder name. Search-engine metadata remains enabled when the visible metadata block is hidden. Social and QR links live in the footer, so they are not visible when `footer` is disabled.

Every field is checked during the build. Required text cannot be empty, booleans must be real JSON booleans, public URLs must use HTTPS, profile URLs cannot contain embedded credentials, and the public email must look like an email address. A validation failure names the exact `site.config.json` field that needs attention.

`moire.config.ts` is the typed adapter between this JSON file and SvelteKit. Most site owners should not need to edit it.

## GitHub Pages base path

The public domain and the SvelteKit build base are related but separate. Do not put `BASE_PATH` in `site.config.json` and do not remove the existing `base` handling in `svelte.config.js`.

- Custom domain or user Pages site: build with an empty `BASE_PATH`.
- Project Pages site at `/moire`: build with `BASE_PATH=/moire`.

This keeps generated links correct in local preview, GitHub Pages project deployments and future custom-domain deployments without duplicating settings in workflow YAML.

Changing `site.domain` updates generated canonical links, feeds, the sitemap and the QR code; it does not configure GitHub Pages or DNS. A custom domain must also be configured in the repository's Pages settings and at the DNS provider. Likewise, the deployment workflow must pass the matching `BASE_PATH` when publishing below a repository path.
