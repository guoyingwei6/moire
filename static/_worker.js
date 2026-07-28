const DEFAULT_REPOSITORY = 'guoyingwei6/moire';
const DEFAULT_BRANCH = 'blog';
const CONFIG_PATH = 'site.config.json';
const SESSION_COOKIE = 'moire_settings_session';
const SESSION_TTL_SECONDS = 8 * 60 * 60;
const SESSION_CONTEXT = 'moire-blog-settings-session-v1';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/api/settings/login') {
      if (request.method === 'POST') return loginSettings(request, env);
      return json({ error: 'Use POST to sign in.' }, 405);
    }
    if (url.pathname === '/api/settings/session') {
      if (request.method === 'GET') return settingsSession(request, env);
      return json({ error: 'Use GET to check the settings session.' }, 405);
    }
    if (url.pathname === '/api/settings') {
      if (request.method === 'POST') return saveSettings(request, env);
      return json({ error: 'Use POST to save settings.' }, 405);
    }
    const response = await env.ASSETS.fetch(request);
    return withImmutableAssetCache(url.pathname, response);
  }
};

function withImmutableAssetCache(pathname, response) {
  if (!response.ok || !pathname.startsWith('/_app/immutable/')) return response;

  const headers = new Headers(response.headers);
  headers.set('cache-control', 'public, max-age=31536000, immutable');
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

async function saveSettings(request, env = {}) {
  const wantsHtml = acceptsHtml(request);
  if (!isSameOriginMutation(request)) {
    return settingsResponse(request, wantsHtml, { error: 'Cross-origin settings requests are not allowed.' }, 403);
  }
  try {
    const token = env.GITHUB_TOKEN;
    const password = env.SETTINGS_PASSWORD;
    const repository = env.GITHUB_REPOSITORY || DEFAULT_REPOSITORY;
    const branch = env.GITHUB_BRANCH || DEFAULT_BRANCH;

    if (!password) {
      return settingsResponse(request, wantsHtml, { error: 'Settings API is not configured. Missing SETTINGS_PASSWORD.' }, 501);
    }
    if (!(await hasValidSettingsSession(request, password))) {
      return settingsResponse(request, wantsHtml, { error: 'Your settings session has expired. Sign in again.' }, 401);
    }
    if (!token) {
      return settingsResponse(request, wantsHtml, { error: 'Settings API is not configured. Missing GITHUB_TOKEN.' }, 501);
    }

    const form = await request.formData();
    const current = await readConfig({ repository, branch, token });
    const next = updateConfig(current.config, form);
    const content = `${JSON.stringify(next, null, 2)}\n`;

    if (content === `${JSON.stringify(current.config, null, 2)}\n`) {
      return settingsResponse(request, wantsHtml, {
        message: 'No settings changed.',
        commit: current.sha
      });
    }

    const result = await writeConfig({
      repository,
      branch,
      token,
      sha: current.sha,
      content,
      message: 'Update site settings'
    });

    return settingsResponse(request, wantsHtml, {
      message: 'Saved. Redeploying…',
      commit: result.commit?.sha || null
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown settings error.';
    return settingsResponse(request, wantsHtml, { error: message }, 400);
  }
}

async function loginSettings(request, env = {}) {
  const wantsHtml = acceptsHtml(request);
  if (!isSameOriginMutation(request)) {
    return loginResponse(request, wantsHtml, { error: 'Cross-origin settings requests are not allowed.' }, 403);
  }
  const password = env.SETTINGS_PASSWORD;
  if (!password) {
    return loginResponse(request, wantsHtml, { error: 'Settings login is not configured.' }, 501);
  }

  try {
    const form = await request.formData();
    const candidate = String(form.get('settingsPassword') || '');
    if (!(await secureEqual(candidate, String(password)))) {
      return loginResponse(request, wantsHtml, { error: 'Incorrect password.' }, 401);
    }

    const session = await createSettingsSession(String(password));
    return loginResponse(
      request,
      wantsHtml,
      { authenticated: true },
      200,
      settingsSessionCookie(session)
    );
  } catch {
    return loginResponse(request, wantsHtml, { error: 'Unable to sign in.' }, 400);
  }
}

async function settingsSession(request, env = {}) {
  const password = env.SETTINGS_PASSWORD;
  if (!password) return json({ error: 'Settings login is not configured.' }, 501);
  const authenticated = await hasValidSettingsSession(request, String(password));
  return json({ authenticated }, authenticated ? 200 : 401);
}

async function createSettingsSession(secret) {
  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
  const nonce = crypto.randomUUID().replaceAll('-', '');
  const payload = `${expiresAt}.${nonce}`;
  const signature = await signSession(payload, secret);
  return `${payload}.${signature}`;
}

async function hasValidSettingsSession(request, secret) {
  const value = readCookie(request, SESSION_COOKIE);
  if (!value) return false;
  const parts = value.split('.');
  if (parts.length !== 3) return false;

  const [expiresAtText, nonce, signature] = parts;
  if (!/^\d+$/.test(expiresAtText) || !/^[a-f0-9]{32}$/i.test(nonce) || !signature) return false;
  const expiresAt = Number(expiresAtText);
  if (!Number.isSafeInteger(expiresAt) || expiresAt <= Math.floor(Date.now() / 1000)) return false;

  const payload = `${expiresAtText}.${nonce}`;
  return verifySession(payload, signature, secret);
}

async function signSession(payload, secret) {
  const key = await sessionKey(secret, ['sign']);
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${SESSION_CONTEXT}:${payload}`));
  return base64UrlEncode(new Uint8Array(signature));
}

async function verifySession(payload, signature, secret) {
  let bytes;
  try {
    bytes = base64UrlDecode(signature);
  } catch {
    return false;
  }
  const key = await sessionKey(secret, ['verify']);
  return crypto.subtle.verify(
    'HMAC',
    key,
    bytes,
    new TextEncoder().encode(`${SESSION_CONTEXT}:${payload}`)
  );
}

function sessionKey(secret, usages) {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    usages
  );
}

async function secureEqual(left, right) {
  const encoder = new TextEncoder();
  const [leftHash, rightHash] = await Promise.all([
    crypto.subtle.digest('SHA-256', encoder.encode(left)),
    crypto.subtle.digest('SHA-256', encoder.encode(right))
  ]);
  const leftBytes = new Uint8Array(leftHash);
  const rightBytes = new Uint8Array(rightHash);
  let difference = 0;
  for (let index = 0; index < leftBytes.length; index += 1) {
    difference |= leftBytes[index] ^ rightBytes[index];
  }
  return difference === 0;
}

function readCookie(request, name) {
  const cookie = request.headers.get('cookie') || '';
  for (const part of cookie.split(';')) {
    const separator = part.indexOf('=');
    if (separator < 0) continue;
    if (part.slice(0, separator).trim() === name) {
      return part.slice(separator + 1).trim();
    }
  }
  return '';
}

function settingsSessionCookie(value) {
  return `${SESSION_COOKIE}=${value}; Path=/api/settings; Max-Age=${SESSION_TTL_SECONDS}; HttpOnly; Secure; SameSite=Strict`;
}

function isSameOriginMutation(request) {
  const requestOrigin = new URL(request.url).origin;
  const origin = request.headers.get('origin');
  const fetchSite = request.headers.get('sec-fetch-site');
  return origin === requestOrigin && (!fetchSite || fetchSite === 'same-origin');
}

function updateConfig(config, form) {
  const next = structuredClone(config);
  next.site = object(next.site, 'site');
  next.social = object(next.social, 'social');
  next.colors = object(next.colors, 'colors');
  next.features = object(next.features, 'features');
  next.navigation = Array.isArray(next.navigation) ? next.navigation : [];

  next.site.title = requiredText(form, 'site.title');
  next.site.author = requiredText(form, 'site.author');
  next.site.description = requiredText(form, 'site.description');
  next.site.domain = siteUrl(requiredText(form, 'site.domain'));
  next.site.logoEmoji = requiredText(form, 'site.logoEmoji');
  next.site.rtl = checked(form, 'site.rtl');

  next.social.twitter = optionalText(form, 'social.twitter');
  next.social.instagram = optionalText(form, 'social.instagram');
  next.social.github = optionalText(form, 'social.github');
  next.social.youtube = optionalUrl(form, 'social.youtube');
  next.social.mastodon = optionalUrl(form, 'social.mastodon');
  next.social.email = optionalEmail(form, 'social.email');

  next.colors.background = color(requiredText(form, 'colors.background'), 'Background color');
  next.colors.text = color(requiredText(form, 'colors.text'), 'Text color');
  next.colors.secondary = color(requiredText(form, 'colors.secondary'), 'Secondary text color');
  next.colors.link = color(requiredText(form, 'colors.link'), 'Link color');

  next.features.qrCode = !checked(form, 'features.hideQrCode');
  next.features.tags = !checked(form, 'features.hideTags');
  next.features.archive = !checked(form, 'features.hideArchive');
  next.features.folderName = checked(form, 'features.folderName');
  next.features.previousNext = checked(form, 'features.previousNext');
  next.features.footer = checked(form, 'features.footer');
  next.features.metadata = checked(form, 'features.metadata');

  validateNavigation(next.navigation);
  return next;
}

async function readConfig({ repository, branch, token }) {
  const url = `https://api.github.com/repos/${repository}/contents/${CONFIG_PATH}?ref=${encodeURIComponent(branch)}`;
  const response = await github(url, { token });
  const payload = await response.json();
  if (!payload.sha || !payload.content) throw new Error('GitHub did not return site.config.json content.');
  const decoded = decodeBase64(String(payload.content).replace(/\s+/g, ''));
  return { config: JSON.parse(decoded), sha: payload.sha };
}

async function writeConfig({ repository, branch, token, sha, content, message }) {
  const url = `https://api.github.com/repos/${repository}/contents/${CONFIG_PATH}`;
  const response = await github(url, {
    token,
    method: 'PUT',
    body: JSON.stringify({
      message,
      content: encodeBase64(content),
      sha,
      branch
    })
  });
  return response.json();
}

async function github(url, { token, method = 'GET', body } = {}) {
  const response = await fetch(url, {
    method,
    headers: {
      accept: 'application/vnd.github+json',
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
      'user-agent': 'moire-blog-settings'
    },
    body
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`GitHub API ${response.status}: ${text.slice(0, 300)}`);
  }
  return response;
}

function object(value, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`Invalid ${name} settings.`);
  }
  return value;
}

function requiredText(form, name) {
  const value = optionalText(form, name);
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

function optionalText(form, name) {
  return String(form.get(name) || '').trim();
}

function checked(form, name) {
  return form.has(name);
}

function siteUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error('Site domain must be a complete https URL.');
  }
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) {
    throw new Error('Site domain must be an https URL without credentials, query, or hash.');
  }
  const pathname = url.pathname === '/' ? '' : url.pathname.replace(/\/+$/, '');
  return `${url.origin}${pathname}`;
}

function optionalUrl(form, name) {
  const value = optionalText(form, name);
  if (!value) return '';
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${name} must be a complete https URL.`);
  }
  if (url.protocol !== 'https:' || url.username || url.password) {
    throw new Error(`${name} must be an https URL without credentials.`);
  }
  return url.href.replace(/\/$/, '');
}

function optionalEmail(form, name) {
  const value = optionalText(form, name).replace(/^mailto:/i, '');
  if (!value) return '';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) throw new Error(`${name} must be a valid public email address.`);
  return value;
}

function color(value, label) {
  const normalized = value.trim();
  if (!/^#(?:[\da-f]{3}|[\da-f]{4}|[\da-f]{6}|[\da-f]{8})$/i.test(normalized)) {
    throw new Error(`${label} must be a 3, 4, 6, or 8 digit hex color.`);
  }
  return normalized;
}

function validateNavigation(navigation) {
  if (!Array.isArray(navigation) || navigation.length === 0) throw new Error('navigation must remain a non-empty array.');
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: {
      'cache-control': 'no-store',
      'content-type': 'application/json; charset=utf-8'
    }
  });
}

function acceptsHtml(request) {
  const accept = request.headers.get('accept') || '';
  return accept.includes('text/html');
}

function settingsResponse(request, wantsHtml, body, status = 200) {
  if (!wantsHtml) return json(body, status);
  const url = new URL('/settings/', request.url);
  if (body.error) {
    url.searchParams.set('error', String(body.error));
  } else {
    url.searchParams.set('saved', '1');
    if (body.commit) url.searchParams.set('commit', String(body.commit));
  }
  return Response.redirect(url.toString(), 303);
}

function loginResponse(request, wantsHtml, body, status = 200, cookie = '') {
  if (!wantsHtml) {
    const response = json(body, status);
    if (cookie) response.headers.set('set-cookie', cookie);
    return response;
  }

  const url = new URL('/settings/', request.url);
  if (body.error) url.searchParams.set('loginError', String(body.error));
  const headers = new Headers({
    'cache-control': 'no-store',
    location: url.toString()
  });
  if (cookie) headers.set('set-cookie', cookie);
  return new Response(null, { status: 303, headers });
}

function encodeBase64(value) {
  const bytes = new TextEncoder().encode(value);
  let binary = '';
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.slice(index, index + 0x8000));
  }
  return btoa(binary);
}

function decodeBase64(value) {
  const binary = atob(value);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function base64UrlEncode(bytes) {
  let binary = '';
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.slice(index, index + 0x8000));
  }
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}

function base64UrlDecode(value) {
  const normalized = value.replaceAll('-', '+').replaceAll('_', '/');
  const padding = '='.repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(`${normalized}${padding}`);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}
