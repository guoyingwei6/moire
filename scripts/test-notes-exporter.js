import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const exporter = readFileSync(new URL('./notes/export-macos-notes.mjs', import.meta.url), 'utf8');

assert.match(
  exporter,
  /ZTYPEUTI1='com\.apple\.notes\.inlinetextattachment\.hashtag'[\s\S]*?COALESCE\(ZMARKEDFORDELETION,\s*0\)=0[\s\S]*?ZNOTE1 IN/,
  'native hashtag export must ignore Apple Notes tombstone rows'
);

console.log('Notes exporter regression tests passed.');
