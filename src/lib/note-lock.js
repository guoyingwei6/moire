/**
 * Encrypted payload for a password-protected note.
 *
 * @typedef {object} LockedPayload
 * @property {1} v Payload format version.
 * @property {'AES-256-GCM'} alg Symmetric algorithm.
 * @property {'PBKDF2-SHA256'} kdf Key derivation function.
 * @property {number} iter PBKDF2 iteration count.
 * @property {string} salt PBKDF2 salt, base64.
 * @property {string} iv AES-GCM initialization vector, base64.
 * @property {string} data Ciphertext followed by the 16-byte GCM tag, base64.
 */

export const LOCKED_SUMMARY = 'This note is encrypted. Enter the password to read it.';
export const LOCK_PASSWORD_ENV = 'MOIRE_NOTES_PASSWORD';

const PBKDF2_ITERATIONS = 310_000;
const SALT_BYTES = 16;
const IV_BYTES = 12;

/** @param {string} value @returns {Uint8Array<ArrayBuffer>} */
function base64ToBytes(value) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

/** @param {Uint8Array<ArrayBuffer>} bytes @returns {string} */
function bytesToBase64(bytes) {
  let binary = '';
  for (let index = 0; index < bytes.length; index += 1) binary += String.fromCharCode(bytes[index]);
  return btoa(binary);
}

/**
 * Derive an AES-256-GCM key from a password.
 *
 * @param {string} password
 * @param {Uint8Array<ArrayBuffer>} salt
 * @param {number} iterations
 * @returns {Promise<CryptoKey>}
 */
async function deriveKey(password, salt, iterations) {
  // Copy into a fresh ArrayBuffer-backed view for maximum WebCrypto compatibility.
  const saltBytes = new Uint8Array(salt);
  const material = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt: saltBytes, iterations },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypt rendered note HTML with a password. Runs on the server at build
 * time, so static output only ever contains ciphertext.
 *
 * @param {string} html
 * @param {string} password
 * @returns {Promise<LockedPayload>}
 */
export async function encryptNoteHtml(html, password) {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const key = await deriveKey(password, salt, PBKDF2_ITERATIONS);
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv, tagLength: 128 }, key, new TextEncoder().encode(html))
  );
  return {
    v: 1,
    alg: 'AES-256-GCM',
    kdf: 'PBKDF2-SHA256',
    iter: PBKDF2_ITERATIONS,
    salt: bytesToBase64(salt),
    iv: bytesToBase64(iv),
    data: bytesToBase64(ciphertext)
  };
}

/**
 * Decrypt a locked note payload with the supplied password. Rejects when the
 * password is wrong (GCM authentication failure).
 *
 * @param {LockedPayload} payload
 * @param {string} password
 * @returns {Promise<string>}
 */
export async function decryptNote(payload, password) {
  if (!payload || payload.v !== 1 || !payload.salt || !payload.iv || !payload.data) {
    throw new Error('Invalid locked payload');
  }
  const iterations = Number(payload.iter) || PBKDF2_ITERATIONS;
  const key = await deriveKey(password, base64ToBytes(payload.salt), iterations);
  const iv = new Uint8Array(base64ToBytes(payload.iv));
  const data = new Uint8Array(base64ToBytes(payload.data));
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv, tagLength: 128 },
    key,
    data
  );
  return new TextDecoder().decode(plaintext);
}
