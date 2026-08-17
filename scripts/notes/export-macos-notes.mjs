#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, dirname, extname, join, resolve } from 'node:path';

const args = new Map();
for (let index = 2; index < process.argv.length; index += 1) {
  const key = process.argv[index];
  if (!key.startsWith('--')) continue;
  const value = process.argv[index + 1] && !process.argv[index + 1].startsWith('--')
    ? process.argv[++index]
    : 'true';
  args.set(key.slice(2), value);
}

const rootFolder = args.get('root') || 'guoyingwei.montaigne.io';
const output = resolve(args.get('out') || 'notes-export/public-notes.json');
const includeDrafts = args.get('include-drafts') === 'true';
const includeExportedAt = args.get('include-exported-at') === 'true';
const notesHome = resolve(args.get('notes-home') || `${homedir()}/Library/Group Containers/group.com.apple.notes`);
const noteStore = resolve(args.get('note-store') || `${notesHome}/NoteStore.sqlite`);
const diagnosticsOutput = resolve(args.get('diagnostics-out') || 'logs/notes-export-last.json');

const jxa = String.raw`
function isDraftName(name) {
  return String(name || "").trim().indexOf("_") === 0;
}

function noteFull(note) {
  return {
    name: note.name(),
    id: note.id(),
    created: note.creationDate().toISOString(),
    modified: note.modificationDate().toISOString(),
    body: String(note.body())
  };
}

function folderSummary(folder) {
  return {
    name: folder.name(),
    id: folder.id(),
    noteCount: folder.notes().length
  };
}

function folderFull(folder, includeDrafts) {
  let childFolders = [];
  try {
    childFolders = folder.folders().map(folderSummary);
  } catch (_) {
    childFolders = [];
  }

  return {
    name: folder.name(),
    id: folder.id(),
    notes: folder.notes().filter(function(note) {
      return includeDrafts || !isDraftName(note.name());
    }).map(noteFull),
    childFolders
  };
}

function run(argv) {
  const rootName = argv[0];
  const includeDrafts = argv[1] === "true";
  const includeExportedAt = argv[2] === "true";
  const Notes = Application("Notes");
  const matches = Notes.folders.whose({ name: rootName })();
  if (matches.length !== 1) {
    throw new Error("Expected exactly one Apple Notes folder named " + rootName + ", found " + matches.length);
  }

  const root = matches[0];
  const sections = root.folders().map(function(folder) {
    return folderFull(folder, includeDrafts);
  });
  const snapshot = {
    exporter: "jxa-notes-app",
    includeDrafts: includeDrafts,
    root: folderFull(root, includeDrafts),
    sections
  };
  if (includeExportedAt) {
    snapshot.exportedAt = new Date().toISOString();
  }
  return JSON.stringify(snapshot);
}
`;

const result = spawnSync('osascript', ['-l', 'JavaScript', '-e', jxa, rootFolder, String(includeDrafts), String(includeExportedAt)], {
  encoding: 'utf8',
  maxBuffer: 256 * 1024 * 1024
});

if (result.error) throw result.error;
if (result.status !== 0) {
  process.stderr.write(result.stderr || '');
  process.exit(result.status || 1);
}

const parsed = JSON.parse(result.stdout);
const diagnostics = createDiagnostics(parsed, noteStore, notesHome);
attachNativeTags(parsed, noteStore, diagnostics);
attachNativeAttachments(parsed, noteStore, notesHome, diagnostics);
parsed.exportDiagnostics = diagnostics;
writeDiagnostics(diagnosticsOutput, parsed, noteStore, notesHome);
if (diagnostics.status !== 'ok') {
  console.log(JSON.stringify({
    output,
    root: parsed.root.name,
    status: diagnostics.status,
    diagnostics
  }, null, 2));
  process.exitCode = 1;
} else {
  const serialized = JSON.stringify(parsed);
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, serialized);
  const noteCount = parsed.root.notes.length + parsed.sections.reduce((sum, section) => sum + section.notes.length, 0);
  console.log(JSON.stringify({
    output,
    root: parsed.root.name,
    sections: parsed.sections.map((section) => ({ name: section.name, notes: section.notes.length })),
    noteCount,
    nativeTags: countNativeTags(parsed),
    attachments: countNativeAttachments(parsed),
    bytes: Buffer.byteLength(serialized)
  }, null, 2));
}

function createDiagnostics(snapshot, databasePath, notesDirectory) {
  const diagnostics = {
    status: 'ok',
    reasons: [],
    database: {
      exists: existsSync(databasePath)
    },
    tags: {
      status: 'not-run',
      expectedNotes: allNotes(snapshot).length,
      queryRows: 0,
      taggedNotes: 0
    },
    attachments: {
      status: 'not-run',
      expectedRows: 0,
      queryRows: 0,
      attached: 0,
      skippedImages: 0,
      missingFiles: 0,
      readErrors: 0
    },
    notesDirectory: {
      accountsExists: existsSync(join(notesDirectory, 'Accounts'))
    }
  };
  if (!diagnostics.database.exists) {
    degrade(diagnostics, 'NoteStore.sqlite does not exist; native tags and attachments could not be verified');
  }
  return diagnostics;
}

function degrade(diagnostics, reason) {
  diagnostics.status = 'degraded';
  if (!diagnostics.reasons.includes(reason)) diagnostics.reasons.push(reason);
}

function writeDiagnostics(path, snapshot, databasePath, notesDirectory) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify({
    at: new Date().toISOString(),
    output,
    exporter: snapshot.exporter,
    databasePath,
    notesDirectory,
    diagnostics: snapshot.exportDiagnostics
  }, null, 2)}\n`);
}

function attachNativeTags(snapshot, databasePath, diagnostics) {
  const notes = allNotes(snapshot);
  diagnostics.tags.expectedNotes = notes.length;
  if (!notes.length) {
    diagnostics.tags.status = 'not-needed';
    return;
  }
  if (!existsSync(databasePath)) {
    diagnostics.tags.status = 'degraded';
    return;
  }
  const ids = notes.map((note) => notePrimaryKey(note.id)).filter((id) => id !== null);
  if (!ids.length) {
    diagnostics.tags.status = 'degraded';
    degrade(diagnostics, 'No Apple Notes primary keys were available for the native tag query');
    return;
  }
  const query = [
    '.mode tabs',
    '.headers off',
    `SELECT ZNOTE1, COALESCE(ZALTTEXT, ZDISPLAYTEXT, ZTOKENCONTENTIDENTIFIER, '')`,
    'FROM ZICCLOUDSYNCINGOBJECT',
    "WHERE ZTYPEUTI1='com.apple.notes.inlinetextattachment.hashtag'",
    'AND COALESCE(ZMARKEDFORDELETION, 0)=0',
    `AND ZNOTE1 IN (${ids.join(',')});`
  ].join('\n');
  const tagResult = spawnSync('sqlite3', [databasePath], {
    input: query,
    encoding: 'utf8',
    maxBuffer: 8 * 1024 * 1024
  });
  if (tagResult.status !== 0) {
    diagnostics.tags.status = 'degraded';
    degrade(diagnostics, 'SQLite native tag query failed');
    return;
  }
  const tagsByNote = new Map();
  for (const line of tagResult.stdout.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const [id, rawTag] = line.split('\t');
    const tag = normalizeTag(rawTag);
    if (!id || !tag) continue;
    const tags = tagsByNote.get(id) ?? [];
    if (!tags.includes(tag)) tags.push(tag);
    tagsByNote.set(id, tags);
  }
  diagnostics.tags.queryRows = [...tagsByNote.values()].reduce((sum, tags) => sum + tags.length, 0);
  diagnostics.tags.taggedNotes = tagsByNote.size;
  diagnostics.tags.status = 'ok';
  for (const note of notes) {
    const id = notePrimaryKey(note.id);
    const tags = id === null ? [] : tagsByNote.get(String(id)) ?? [];
    note.tags = tags;
  }
}

function attachNativeAttachments(snapshot, databasePath, notesDirectory, diagnostics) {
  const notes = allNotes(snapshot);
  if (!notes.length) {
    diagnostics.attachments.status = 'not-needed';
    return;
  }
  if (!existsSync(databasePath)) {
    diagnostics.attachments.status = 'degraded';
    return;
  }
  const noteIds = notes.map((note) => notePrimaryKey(note.id)).filter((id) => id !== null);
  if (!noteIds.length) {
    diagnostics.attachments.status = 'degraded';
    degrade(diagnostics, 'No Apple Notes primary keys were available for the native attachment query');
    return;
  }
  const query = [
    '.mode tabs',
    '.headers off',
    `SELECT Z_PK, ZNOTE, COALESCE(ZMEDIA, 0), COALESCE(ZTYPEUTI, ZTYPEUTI1, ''), COALESCE(ZFILENAME, ''), COALESCE(ZTITLE, ZTITLE1, ZUSERTITLE, ZDISPLAYTEXT, ZALTTEXT, ''), COALESCE(ZIDENTIFIER, ''), COALESCE(ZFILESIZE, 0), COALESCE(ZDURATION, 0), COALESCE(ZWIDTH, 0), COALESCE(ZHEIGHT, 0), COALESCE(ZCREATIONDATE, 0)`,
    'FROM ZICCLOUDSYNCINGOBJECT',
    'WHERE Z_ENT=5',
    `AND ZNOTE IN (${noteIds.join(',')})`,
    'AND COALESCE(ZPARENTATTACHMENT, 0)=0',
    'AND COALESCE(ZPARENTATTACHMENT1, 0)=0',
    'ORDER BY ZNOTE, Z_PK;'
  ].join('\n');
  const attachmentResult = spawnSync('sqlite3', [databasePath], {
    input: query,
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024
  });
  if (attachmentResult.status !== 0) {
    diagnostics.attachments.status = 'degraded';
    degrade(diagnostics, 'SQLite native attachment query failed');
    return;
  }

  const rows = attachmentResult.stdout
    .split(/\r?\n/)
    .filter((line) => line.trim())
    .map((line) => parseAttachmentRow(line));
  diagnostics.attachments.queryRows = rows.length;
  diagnostics.attachments.expectedRows = rows.length;
  if (!rows.length) {
    diagnostics.attachments.status = 'ok';
    return;
  }

  const mediaIds = [...new Set(rows.map((row) => row.mediaId).filter(Boolean))];
  const mediaResult = mediaIds.length ? readMediaRows(databasePath, mediaIds) : { mediaById: new Map(), ok: true };
  const mediaById = mediaResult.mediaById;
  if (!mediaResult.ok) {
    diagnostics.attachments.status = 'degraded';
    degrade(diagnostics, 'SQLite native media lookup failed');
  }
  const fileIndex = buildAttachmentFileIndex(join(notesDirectory, 'Accounts'));
  const notesByPrimaryKey = new Map(notes
    .map((note) => [notePrimaryKey(note.id), note])
    .filter(([id]) => id !== null));

  for (const row of rows) {
    if (isImageUti(row.uti)) {
      diagnostics.attachments.skippedImages += 1;
      continue;
    }
    const media = mediaById.get(row.mediaId);
    const sourcePath = findAttachmentFile(fileIndex, row, media);
    if (!sourcePath) {
      diagnostics.attachments.missingFiles += 1;
      diagnostics.attachments.status = 'degraded';
      degrade(diagnostics, 'One or more native attachments could not be found on disk');
      continue;
    }
    let buffer;
    try {
      buffer = readFileSync(sourcePath);
    } catch {
      diagnostics.attachments.readErrors += 1;
      diagnostics.attachments.status = 'degraded';
      degrade(diagnostics, 'One or more native attachments could not be read');
      continue;
    }
    const extension = extensionForAttachment(buffer, row, media, sourcePath);
    const kind = attachmentKind(row.uti, extension);
    const title = row.title || row.filename || media?.filename || basename(sourcePath);
    const note = notesByPrimaryKey.get(row.noteId);
    if (!note) {
      diagnostics.attachments.status = 'degraded';
      degrade(diagnostics, 'A native attachment referenced an unknown note');
      continue;
    }
    const attachments = Array.isArray(note.attachments) ? note.attachments : [];
    attachments.push({
      id: String(row.pk),
      title,
      kind,
      uti: row.uti,
      mime: mimeForAttachment(kind, extension),
      filename: sanitizeFilename(row.filename || media?.filename || `${slugifyAttachmentTitle(title)}.${extension}`),
      extension,
      size: buffer.length,
      duration: row.duration,
      width: row.width,
      height: row.height,
      creationDate: row.creationDate,
      dataBase64: buffer.toString('base64')
    });
    note.attachments = attachments;
    diagnostics.attachments.attached += 1;
  }
  if (diagnostics.attachments.status === 'not-run') diagnostics.attachments.status = 'ok';
}

function parseAttachmentRow(line) {
  const [
    pk,
    noteId,
    mediaId,
    uti,
    filename,
    title,
    identifier,
    size,
    duration,
    width,
    height,
    creationDate
  ] = line.split('\t');
  return {
    pk: Number(pk),
    noteId: Number(noteId),
    mediaId: Number(mediaId),
    uti: String(uti || ''),
    filename: String(filename || ''),
    title: String(title || ''),
    identifier: String(identifier || ''),
    size: Number(size) || 0,
    duration: Number(duration) || 0,
    width: Number(width) || 0,
    height: Number(height) || 0,
    creationDate: Number(creationDate) || 0
  };
}

function readMediaRows(databasePath, mediaIds) {
  const query = [
    '.mode tabs',
    '.headers off',
    `SELECT Z_PK, COALESCE(ZIDENTIFIER, ''), COALESCE(ZFILENAME, ''), COALESCE(ZTYPEUTI, ZTYPEUTI1, ''), COALESCE(ZFILESIZE, 0)`,
    'FROM ZICCLOUDSYNCINGOBJECT',
    `WHERE Z_PK IN (${mediaIds.join(',')});`
  ].join('\n');
  const result = spawnSync('sqlite3', [databasePath], {
    input: query,
    encoding: 'utf8',
    maxBuffer: 8 * 1024 * 1024
  });
  const mediaById = new Map();
  if (result.status !== 0) return { mediaById, ok: false };
  for (const line of result.stdout.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const [pk, identifier, filename, uti, size] = line.split('\t');
    mediaById.set(Number(pk), {
      pk: Number(pk),
      identifier: String(identifier || ''),
      filename: String(filename || ''),
      uti: String(uti || ''),
      size: Number(size) || 0
    });
  }
  return { mediaById, ok: true };
}

function buildAttachmentFileIndex(accountsDirectory, maxDepth = 8) {
  if (!existsSync(accountsDirectory)) return [];
  const files = [];
  const stack = [{ directory: accountsDirectory, depth: 0 }];
  while (stack.length) {
    const current = stack.pop();
    if (!current || current.depth > maxDepth) continue;
    let entries = [];
    try {
      entries = readdirSync(current.directory, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const path = join(current.directory, entry.name);
      if (entry.isDirectory()) {
        stack.push({ directory: path, depth: current.depth + 1 });
        continue;
      }
      if (!entry.isFile()) continue;
      try {
        const info = statSync(path);
        if (info.size > 0) files.push(path);
      } catch {
        // A file can disappear while Notes is syncing; it will be reported as missing.
      }
    }
  }
  return files;
}

function findAttachmentFile(fileIndex, row, media) {
  if (row.identifier && isPdfUti(row.uti)) {
    const pdfPath = findFirstIndexedFile(fileIndex, (filePath) => (
      filePath.includes(`/FallbackPDFs/${row.identifier}/`) && /\.pdf$/i.test(filePath)
    ));
    if (pdfPath) return pdfPath;
  }
  if (media?.identifier) {
    const mediaPath = findFirstIndexedFile(fileIndex, (filePath) => (
      filePath.includes(`/Media/${media.identifier}/`)
      && (!media.filename || basename(filePath) === media.filename)
    ));
    if (mediaPath) return mediaPath;
    const anyMediaPath = findFirstIndexedFile(fileIndex, (filePath) => filePath.includes(`/Media/${media.identifier}/`));
    if (anyMediaPath) return anyMediaPath;
  }
  if (row.identifier) {
    return findFirstIndexedFile(fileIndex, (filePath) => filePath.includes(`/${row.identifier}/`));
  }
  return '';
}

function findFirstIndexedFile(fileIndex, predicate) {
  return fileIndex.find(predicate) || '';
}

function allNotes(snapshot) {
  return [
    ...(snapshot.root?.notes ?? []),
    ...(snapshot.sections ?? []).flatMap((section) => section.notes ?? [])
  ];
}

function notePrimaryKey(id) {
  const match = String(id || '').match(/\/p(\d+)$/);
  return match ? Number(match[1]) : null;
}

function normalizeTag(value) {
  return String(value || '')
    .trim()
    .replace(/^#+/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function countNativeTags(snapshot) {
  return allNotes(snapshot).reduce((sum, note) => sum + (note.tags?.length ?? 0), 0);
}

function countNativeAttachments(snapshot) {
  return allNotes(snapshot).reduce((sum, note) => sum + (note.attachments?.length ?? 0), 0);
}

function isImageUti(value) {
  return /(?:^|\.|-)image|public\.(?:jpeg|png|heic|heif|gif|tiff)|svg/i.test(String(value || ''));
}

function isPdfUti(value) {
  return /pdf/i.test(String(value || ''));
}

function attachmentKind(uti, extension) {
  const value = String(uti || '').toLowerCase();
  const ext = String(extension || '').toLowerCase();
  if (value.includes('pdf') || ext === 'pdf') return 'pdf';
  if (value.includes('audio') || ['m4a', 'mp3', 'aac', 'wav', 'ogg', 'oga'].includes(ext)) return 'audio';
  if (value.includes('movie') || value.includes('video') || ['mp4', 'm4v', 'mov', 'webm'].includes(ext)) return 'video';
  return 'file';
}

function extensionForAttachment(buffer, row, media, sourcePath) {
  const signature = extensionForAttachmentSignature(buffer);
  if (signature) return signature;
  const names = [row.filename, media?.filename, sourcePath].filter(Boolean);
  for (const name of names) {
    const ext = extname(String(name)).replace(/^\./, '').toLowerCase();
    if (ext) return ext === 'jpeg' ? 'jpg' : ext;
  }
  const uti = `${row.uti} ${media?.uti || ''}`.toLowerCase();
  if (uti.includes('pdf')) return 'pdf';
  if (uti.includes('m4a')) return 'm4a';
  if (uti.includes('mpeg-4-audio')) return 'm4a';
  if (uti.includes('mp3')) return 'mp3';
  if (uti.includes('quicktime') || uti.includes('movie')) return 'mov';
  if (uti.includes('video')) return 'mp4';
  return 'bin';
}

function extensionForAttachmentSignature(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 12) return '';
  if (buffer.subarray(0, 4).toString('ascii') === '%PDF') return 'pdf';
  if (buffer.subarray(4, 8).toString('ascii') === 'ftyp') {
    const brandText = buffer.subarray(8, Math.min(buffer.length, 64)).toString('ascii');
    if (/M4A|mp42|isom/i.test(brandText)) return 'm4a';
    if (/qt  /i.test(brandText)) return 'mov';
    return 'mp4';
  }
  if (buffer.subarray(0, 4).toString('ascii') === 'OggS') return 'ogg';
  if (buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WAVE') return 'wav';
  if (buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0) return 'mp3';
  return '';
}

function mimeForAttachment(kind, extension) {
  const ext = String(extension || '').toLowerCase();
  if (ext === 'pdf') return 'application/pdf';
  if (ext === 'm4a') return 'audio/mp4';
  if (ext === 'mp3') return 'audio/mpeg';
  if (ext === 'aac') return 'audio/aac';
  if (ext === 'wav') return 'audio/wav';
  if (ext === 'ogg' || ext === 'oga') return 'audio/ogg';
  if (ext === 'mp4' || ext === 'm4v') return 'video/mp4';
  if (ext === 'mov') return 'video/quicktime';
  if (ext === 'webm') return 'video/webm';
  if (kind === 'pdf') return 'application/pdf';
  if (kind === 'audio') return 'audio/mp4';
  if (kind === 'video') return 'video/mp4';
  return 'application/octet-stream';
}

function sanitizeFilename(value) {
  const name = String(value || '').normalize('NFKC').replace(/[\\/:*?"<>|\u0000-\u001f]+/g, '-').trim();
  return name || 'attachment';
}

function slugifyAttachmentTitle(value) {
  return String(value || 'attachment')
    .normalize('NFKC')
    .trim()
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}]+/gu, '-')
    .replace(/^-+|-+$/g, '') || 'attachment';
}
