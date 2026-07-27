#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

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

mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, result.stdout);
const parsed = JSON.parse(result.stdout);
const noteCount = parsed.root.notes.length + parsed.sections.reduce((sum, section) => sum + section.notes.length, 0);
console.log(JSON.stringify({
  output,
  root: parsed.root.name,
  sections: parsed.sections.map((section) => ({ name: section.name, notes: section.notes.length })),
  noteCount,
  bytes: Buffer.byteLength(result.stdout)
}, null, 2));
