import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const exporter = readFileSync(new URL('./notes/export-macos-notes.mjs', import.meta.url), 'utf8');
const publisher = readFileSync(new URL('./notes/publish-macos-notes.mjs', import.meta.url), 'utf8');

assert.match(
  exporter,
  /ZTYPEUTI1='com\.apple\.notes\.inlinetextattachment\.hashtag'[\s\S]*?COALESCE\(ZMARKEDFORDELETION,\s*0\)=0[\s\S]*?ZNOTE1 IN/,
  'native hashtag export must ignore Apple Notes tombstone rows'
);
assert.match(exporter, /exportDiagnostics/, 'native export must expose health diagnostics');
assert.match(exporter, /buildAttachmentFileIndex/, 'attachment lookup must build one filesystem index per export');
assert.doesNotMatch(exporter, /findFirstFile\(/, 'attachment lookup must not rescan Notes Accounts for every attachment');
assert.match(publisher, /diff', '--cached', '--name-only'/, 'publisher must inspect the index before committing');
assert.match(publisher, /git', \['add', '--', snapshotRepoPath\]/, 'publisher must stage only the snapshot path');
assert.match(publisher, /max-drop-ratio|MOIRE_NOTES_MAX_DROP_RATIO/, 'publisher must compare snapshot health metrics');

console.log('Notes exporter regression tests passed.');
