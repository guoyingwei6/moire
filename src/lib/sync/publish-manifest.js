export const PUBLISH_MANIFEST_VERSION = 1;
export const PUBLISH_MANIFEST_PATH = '.moire-manifest.json';

const KINDS = new Set(['markdown', 'media']);

/** @param {string} value */
function pathKey(value) {
  return value.normalize('NFC').toLocaleLowerCase();
}

/** @param {unknown} value @param {string} label */
function requireString(value, label) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`Invalid publish manifest: ${label} must be a non-empty string`);
  }
  return value.trim();
}

/**
 * Paths are always relative to GitHub's content/ directory. The manifest may
 * remove only paths that appeared in an earlier validated Moire manifest.
 *
 * @param {unknown} value
 */
export function managedPath(value) {
  const path = requireString(value, 'file path').normalize('NFC');
  const segments = path.split('/');
  if (
    path.startsWith('/')
    || path.endsWith('/')
    || path.includes('\\')
    || /[?#\u0000-\u001f]/u.test(path)
    || segments.some((segment) => !segment || segment === '.' || segment === '..')
    || pathKey(path) === pathKey(PUBLISH_MANIFEST_PATH)
  ) {
    throw new Error(`Invalid publish manifest path: ${path}`);
  }
  return path;
}

/** @param {unknown} value */
function digest(value) {
  const normalized = requireString(value, 'digest').toLocaleLowerCase();
  if (!/^[a-f\d]{64}$/.test(normalized)) {
    throw new Error('Invalid publish manifest: digest must be a SHA-256 hex string');
  }
  return normalized;
}

/** @param {unknown} value */
function fileKind(value) {
  const normalized = requireString(value, 'kind').toLocaleLowerCase();
  if (!KINDS.has(normalized)) {
    throw new Error(`Invalid publish manifest kind: ${normalized}`);
  }
  return normalized;
}

/** @param {{ path: string, kind: 'markdown' | 'media' }} file */
function validateKindPath(file) {
  if (file.kind === 'markdown' && !file.path.toLocaleLowerCase().endsWith('.md')) {
    throw new Error(`Invalid publish manifest path for markdown: ${file.path}`);
  }
  if (
    file.kind === 'media'
    && !/^media\/[\p{L}\p{N}._~-]+\.(?:avif|gif|jpe?g|png|svg|webp)$/iu.test(file.path)
  ) {
    throw new Error(`Invalid publish manifest path for media: ${file.path}`);
  }
}

/**
 * @param {unknown} input
 * @returns {{ version: 1, root: string, files: Array<{ path: string, kind: 'markdown' | 'media', digest: string }> }}
 */
export function validatePublishManifest(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('Invalid publish manifest: expected an object');
  }
  const candidate = /** @type {Record<string, unknown>} */ (input);
  if (candidate.version !== PUBLISH_MANIFEST_VERSION) {
    throw new Error(`Invalid publish manifest version: ${String(candidate.version)}`);
  }
  const root = requireString(candidate.root, 'root').toLocaleLowerCase();
  if (!/^[a-f\d]{64}$/.test(root)) {
    throw new Error('Invalid publish manifest: root must be a SHA-256 hex fingerprint');
  }
  if (!Array.isArray(candidate.files)) {
    throw new Error('Invalid publish manifest: files must be an array');
  }

  const seen = new Map();
  const files = candidate.files.map((rawFile, index) => {
    if (!rawFile || typeof rawFile !== 'object' || Array.isArray(rawFile)) {
      throw new Error(`Invalid publish manifest: files[${index}] must be an object`);
    }
    const file = /** @type {Record<string, unknown>} */ (rawFile);
    const normalized = {
      path: managedPath(file.path),
      kind: /** @type {'markdown' | 'media'} */ (fileKind(file.kind)),
      digest: digest(file.digest)
    };
    validateKindPath(normalized);
    const key = pathKey(normalized.path);
    const previous = seen.get(key);
    if (previous) {
      throw new Error(`Duplicate publish manifest path: ${previous} and ${normalized.path}`);
    }
    seen.set(key, normalized.path);
    return normalized;
  });

  files.sort((left, right) => left.path.localeCompare(right.path));
  return { version: PUBLISH_MANIFEST_VERSION, root, files };
}

/**
 * Create the next manifest only after the complete Notes batch has been
 * validated and converted locally. No Notes identifiers or body text are
 * stored; the root binding, managed paths and content digests are sufficient
 * for deterministic cleanup.
 *
 * @param {string} root
 * @param {Array<{ path: string, kind: 'markdown' | 'media', digest: string }>} files
 */
export function createPublishManifest(root, files) {
  return validatePublishManifest({ version: PUBLISH_MANIFEST_VERSION, root, files });
}

/**
 * A missing prior manifest is a safe first run: everything is uploaded and
 * nothing is deleted. A malformed or differently bound prior manifest stops
 * the batch rather than widening deletion authority.
 *
 * @param {unknown | null} previousInput
 * @param {unknown} nextInput
 */
export function planPublishReconciliation(previousInput, nextInput) {
  const next = validatePublishManifest(nextInput);
  const previous = previousInput === null ? null : validatePublishManifest(previousInput);
  if (previous && previous.root !== next.root) {
    throw new Error('Publish manifest root mismatch; refusing to reconcile managed files');
  }

  const previousByPath = new Map((previous?.files ?? []).map((file) => [pathKey(file.path), file]));
  const nextByPath = new Map(next.files.map((file) => [pathKey(file.path), file]));
  const upsert = next.files.filter((file) => {
    const existing = previousByPath.get(pathKey(file.path));
    return !existing || existing.kind !== file.kind || existing.digest !== file.digest;
  });
  const unchanged = next.files.filter((file) => {
    const existing = previousByPath.get(pathKey(file.path));
    return existing?.kind === file.kind && existing.digest === file.digest;
  });
  const remove = (previous?.files ?? []).filter((file) => !nextByPath.has(pathKey(file.path)));
  const upsertByDigest = new Map();
  for (const file of upsert) {
    const key = `${file.kind}:${file.digest}`;
    const files = upsertByDigest.get(key) ?? [];
    files.push(file);
    upsertByDigest.set(key, files);
  }
  const relocate = [];
  for (const file of remove) {
    const key = `${file.kind}:${file.digest}`;
    const candidates = upsertByDigest.get(key) ?? [];
    const nextFile = candidates.shift();
    if (nextFile) {
      relocate.push({
        from: file.path,
        to: nextFile.path,
        kind: file.kind,
        digest: file.digest
      });
    }
  }

  return { upsert, unchanged, remove, relocate, next };
}
