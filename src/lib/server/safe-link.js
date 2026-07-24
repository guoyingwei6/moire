const allowedSchemes = new Set(['http', 'https', 'mailto', 'tel']);
const schemeSyntax = /^[A-Za-z][A-Za-z\d+.-]*$/;
const browserIgnoredControl = /[\u0000-\u001f\u007f]/;
const htmlEntity = /&(?:#(?:[xX][\dA-Fa-f]+|\d+)|[A-Za-z][A-Za-z\d]+);?/;

/**
 * Checks the part of a link that a browser can interpret as a URL scheme.
 *
 * HTML entities and ASCII controls are rejected in that prefix because the
 * browser normalizes them while parsing an href. Checking the un-normalized
 * Markdown token would otherwise allow values such as
 * `jav&#x61;script:alert(1)` to bypass the protocol allowlist.
 *
 * @param {string} href
 */
export function isSafeLinkHref(href) {
  if (typeof href !== 'string') return false;

  const candidate = href.trim();
  if (!candidate) return true;

  // `#` is deliberately not a boundary here because it also appears inside
  // numeric HTML entities such as `&#x61;`.
  const pathStart = candidate.search(/[/?]/);
  const prefix = pathStart === -1 ? candidate : candidate.slice(0, pathStart);

  if (browserIgnoredControl.test(prefix) || htmlEntity.test(prefix)) return false;

  const colon = prefix.indexOf(':');
  if (colon === -1) return true;

  const scheme = prefix.slice(0, colon);
  return schemeSyntax.test(scheme) && allowedSchemes.has(scheme.toLocaleLowerCase());
}
