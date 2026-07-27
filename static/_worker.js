const DEFAULT_REPOSITORY = 'guoyingwei6/moire';
const DEFAULT_BRANCH = 'blog';
const CONFIG_PATH = 'site.config.json';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/api/settings') {
      if (request.method === 'POST') return saveSettings(request, env);
      return json({ error: 'Use POST to save settings.' }, 405);
    }
    return env.ASSETS.fetch(request);
  }
};

async function saveSettings(request, env = {}) {
  try {
    const password = env.SETTINGS_PASSWORD;
    const token = env.GITHUB_TOKEN;
    const repository = env.GITHUB_REPOSITORY || DEFAULT_REPOSITORY;
    const branch = env.GITHUB_BRANCH || DEFAULT_BRANCH;

    if (!password || !token) {
      return json({ error: 'Settings API is not configured. Missing SETTINGS_PASSWORD or GITHUB_TOKEN.' }, 501);
    }

    const form = await request.formData();
    if (String(form.get('password') || '') !== String(password)) {
      return json({ error: 'Invalid settings password.' }, 401);
    }

    const current = await readConfig({ repository, branch, token });
    const next = updateConfig(current.config, form);
    const content = `${JSON.stringify(next, null, 2)}\n`;

    if (content === `${JSON.stringify(current.config, null, 2)}\n`) {
      return json({ message: 'No settings changed.', commit: current.sha });
    }

    const result = await writeConfig({
      repository,
      branch,
      token,
      sha: current.sha,
      content,
      message: 'Update site settings'
    });

    return json({
      message: 'Settings saved. Cloudflare Pages will redeploy the blog branch.',
      commit: result.commit?.sha || null
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown settings error.';
    return json({ error: message }, 400);
  }
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
    headers: { 'content-type': 'application/json; charset=utf-8' }
  });
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
