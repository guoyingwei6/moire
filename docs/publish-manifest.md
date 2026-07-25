# Managed publish manifest

Apple Notes export is a one-way publication workflow, but it should still
converge after a published note is deleted, renamed or moved. Moire therefore
reserves `content/.moire-manifest.json` as a machine-written ownership record.
It is not an Apple Notes setting and never needs to be edited by the author.

## Privacy-preserving format

```json
{
  "version": 1,
  "root": "sha256-of-the-fixed-public-root-binding",
  "files": [
    {
      "path": "blog/example.md",
      "kind": "markdown",
      "digest": "sha256-of-the-generated-file"
    },
    {
      "path": "media/example.jpg",
      "kind": "media",
      "digest": "sha256-of-the-generated-file"
    }
  ]
}
```

The manifest contains no note body, credential or private Notes identifier.
The `root` is exactly one lowercase SHA-256 fingerprint of the fixed public
FolderEntity binding, never its readable name or raw identifier. Paths are
relative to `content/`. They must be Unicode-normalized, unique even
under case folding, and must not contain an absolute prefix, empty segment,
`.`/`..`, backslash, query, fragment or control character. The manifest cannot
claim ownership of itself. `markdown` entries must end in `.md`; `media`
entries must live directly below `media/` and use one of the renderer's current
image extensions. This prevents a forged or stale manifest from widening its
deletion authority to unrelated repository files.

## Reconciliation sequence

The iPhone Shortcut must use this order:

1. Resolve the one fixed public root and parse its one valid `index` menu.
2. Resolve every allow-listed FolderEntity, collect all notes and locally
   validate every destination path before the first GitHub write.
3. Convert all currently processed Markdown and media to deterministic bytes
   and calculate SHA-256 digests.
4. Read and strictly validate the previous manifest. A missing manifest means
   first run; a malformed manifest, unsupported version or different root
   fingerprint stops the sync.
5. Upload new or changed media, then upload new or changed Markdown.
6. Delete only paths present in the previous validated manifest but absent
   from the next manifest. A missing path is an idempotent success; no other
   repository file is deletion-eligible.
7. Write the new manifest last and report completion.

Writing the manifest last makes retrying safe after a network interruption.
This protocol provides eventual convergence but not one-commit atomicity:
GitHub's Contents API creates one commit per request. A later move to the Git
Data API could make a complete batch atomic without changing the ownership
rules.

## Rollout gate

The pure validation and reconciliation rules live in
`src/lib/sync/publish-manifest.js` and have deterministic unit tests. They do
not delete anything by themselves. The feature must not be called operational
until the same rules are present in the signed iOS Shortcut, an offline dry run
has passed on the real public Notes tree, and the owner separately authorizes
the first isolated `blog`-branch write.
