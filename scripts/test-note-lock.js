import assert from 'node:assert/strict';
import { parseNoteConfiguration } from '../src/lib/config/index-note.js';
import { decryptNote, encryptNoteHtml } from '../src/lib/note-lock.js';

const english = parseNoteConfiguration(`| name | value |
| --- | --- |
| password | s3cret |

Visible body.`);
assert.equal(english.properties.password, 's3cret');
assert.equal(english.cleanedMarkdown, 'Visible body.');

const chinese = parseNoteConfiguration(`| name | value |
| --- | --- |
| 密码 | 中文密码 |

正文`);
assert.equal(chinese.properties['密码'], '中文密码');

const lockedMarker = parseNoteConfiguration(`| name | value |
| --- | --- |
| locked | yes |

Body`);
assert.equal(lockedMarker.properties.locked, 'yes');

const payload = await encryptNoteHtml('<p>secret html</p>', 'correct horse battery staple');
assert.equal(payload.v, 1);
assert.equal(payload.alg, 'AES-256-GCM');
assert.equal(payload.kdf, 'PBKDF2-SHA256');
assert.equal(await decryptNote(payload, 'correct horse battery staple'), '<p>secret html</p>');
await assert.rejects(decryptNote(payload, 'wrong password'));

console.log('Note lock tests passed.');
