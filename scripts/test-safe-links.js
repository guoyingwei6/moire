import assert from 'node:assert/strict';
import { isSafeLinkHref } from '../src/lib/server/safe-link.js';

for (const href of [
  'https://example.com/path?a=1&amp;b=2',
  'http://example.com',
  'mailto:hello@example.com',
  'tel:+123456789',
  '/blog/a-note/',
  './a-note/',
  '../a-note/',
  'a note',
  '#section',
  '?page=2'
]) {
  assert.equal(isSafeLinkHref(href), true, `expected safe link: ${href}`);
}

for (const href of [
  'javascript:alert(1)',
  'JAVASCRIPT:alert(1)',
  'jav&#x61;script:alert(1)',
  'javascript&colon;alert(1)',
  'java&#9;script:alert(1)',
  'data:text/html,<script>alert(1)</script>',
  'file:///private/etc/passwd',
  'vbscript:msgbox(1)'
]) {
  assert.equal(isSafeLinkHref(href), false, `expected unsafe link: ${href}`);
}

console.log('Safe-link protocol tests passed.');
