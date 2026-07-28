import assert from 'node:assert/strict';
import worker from '../static/_worker.js';

const origin = 'https://moireblog.example';
const password = 'correct horse battery staple';
const env = {
  SETTINGS_PASSWORD: password,
  GITHUB_TOKEN: 'test-token',
  ASSETS: {
    fetch: () => new Response('asset', {
      headers: { 'cache-control': 'public, max-age=14400, must-revalidate' }
    })
  }
};

const formRequest = (pathname, value, cookie = '') => {
  const form = new FormData();
  form.set('settingsPassword', value);
  return new Request(`${origin}${pathname}`, {
    method: 'POST',
    headers: {
      accept: 'application/json',
      origin,
      'sec-fetch-site': 'same-origin',
      ...(cookie ? { cookie } : {})
    },
    body: form
  });
};

const immutableAsset = await worker.fetch(
  new Request(`${origin}/_app/immutable/chunks/app.HASH.js`),
  env
);
assert.equal(
  immutableAsset.headers.get('cache-control'),
  'public, max-age=31536000, immutable',
  'fingerprinted SvelteKit assets must stay in the browser cache for one year'
);

const ordinaryAsset = await worker.fetch(new Request(`${origin}/index.html`), env);
assert.equal(
  ordinaryAsset.headers.get('cache-control'),
  'public, max-age=14400, must-revalidate',
  'HTML and non-fingerprinted assets must retain the platform cache policy'
);

const crossOriginLogin = await worker.fetch(
  new Request(`${origin}/api/settings/login`, {
    method: 'POST',
    headers: {
      accept: 'application/json',
      origin: 'https://other.guoyingwei.top',
      'sec-fetch-site': 'same-site'
    },
    body: new FormData()
  }),
  env
);
assert.equal(crossOriginLogin.status, 403, 'a sibling subdomain must not be able to submit the login form');

const wrong = await worker.fetch(formRequest('/api/settings/login', 'wrong password'), env);
assert.equal(wrong.status, 401, 'an incorrect password must remain unauthorized');
assert.equal(wrong.headers.get('set-cookie'), null, 'an incorrect password must not create a session');

const login = await worker.fetch(formRequest('/api/settings/login', password), env);
assert.equal(login.status, 200, 'the configured password must sign in');
assert.deepEqual(await login.json(), { authenticated: true });

const setCookie = login.headers.get('set-cookie') || '';
assert.match(setCookie, /^moire_settings_session=/, 'login must create a dedicated settings session cookie');
assert.match(setCookie, /;\s*HttpOnly\b/i, 'the session cookie must be HttpOnly');
assert.match(setCookie, /;\s*Secure\b/i, 'the session cookie must be Secure');
assert.match(setCookie, /;\s*SameSite=Strict\b/i, 'the session cookie must use SameSite=Strict');
assert.match(setCookie, /;\s*Path=\/api\/settings\b/i, 'the session cookie must be limited to settings API routes');
assert.doesNotMatch(setCookie, new RegExp(password, 'i'), 'the session cookie must not contain the admin password');

const cookie = setCookie.split(';', 1)[0];
const session = await worker.fetch(new Request(`${origin}/api/settings/session`, {
  headers: { accept: 'application/json', cookie }
}), env);
assert.equal(session.status, 200, 'the signed cookie must authenticate the session endpoint');
assert.deepEqual(await session.json(), { authenticated: true });

const [cookieName, cookieValue] = cookie.split('=', 2);
const [expiresAt, nonce, signature] = cookieValue.split('.');
const tamperedSignature = `${signature.startsWith('A') ? 'B' : 'A'}${signature.slice(1)}`;
const tamperedCookie = `${cookieName}=${expiresAt}.${nonce}.${tamperedSignature}`;
const tampered = await worker.fetch(new Request(`${origin}/api/settings/session`, {
  headers: { accept: 'application/json', cookie: tamperedCookie }
}), env);
assert.equal(tampered.status, 401, 'a modified session cookie must be rejected');

const unauthenticatedSave = await worker.fetch(
  new Request(`${origin}/api/settings`, {
    method: 'POST',
    headers: {
      accept: 'application/json',
      origin,
      'sec-fetch-site': 'same-origin'
    },
    body: new FormData()
  }),
  env
);
assert.equal(unauthenticatedSave.status, 401, 'settings writes must require an authenticated session');

const crossOriginSave = await worker.fetch(
  new Request(`${origin}/api/settings`, {
    method: 'POST',
    headers: {
      accept: 'application/json',
      cookie,
      origin: 'https://other.guoyingwei.top',
      'sec-fetch-site': 'same-site'
    },
    body: new FormData()
  }),
  env
);
assert.equal(crossOriginSave.status, 403, 'a sibling subdomain must not be able to save with an active cookie');

const currentConfig = {
  site: {
    title: "GYW's Website",
    author: 'YingweiGuo',
    description: 'Notes published from Apple Notes.',
    domain: 'https://moireblog.example',
    logoEmoji: '📌',
    rtl: false
  },
  social: {
    twitter: '',
    instagram: '',
    github: '',
    youtube: '',
    mastodon: '',
    email: ''
  },
  colors: {
    background: '#fffef2',
    text: '#000000',
    secondary: '#555555',
    link: '#dda832'
  },
  navigation: [{ label: 'Home', icon: '🏠', href: '/' }],
  features: {
    qrCode: false,
    tags: true,
    archive: true,
    folderName: false,
    previousNext: true,
    footer: true,
    metadata: true
  }
};

const saveForm = new FormData();
saveForm.set('site.title', currentConfig.site.title);
saveForm.set('site.author', currentConfig.site.author);
saveForm.set('site.description', 'Updated through the authenticated settings test.');
saveForm.set('site.domain', currentConfig.site.domain);
saveForm.set('site.logoEmoji', currentConfig.site.logoEmoji);
saveForm.set('colors.background', currentConfig.colors.background);
saveForm.set('colors.text', currentConfig.colors.text);
saveForm.set('colors.secondary', currentConfig.colors.secondary);
saveForm.set('colors.link', currentConfig.colors.link);
saveForm.set('features.hideQrCode', 'on');
saveForm.set('features.previousNext', 'on');
saveForm.set('features.footer', 'on');
saveForm.set('features.metadata', 'on');

const originalFetch = globalThis.fetch;
let writtenConfig = null;
globalThis.fetch = async (_url, options = {}) => {
  if ((options.method || 'GET') === 'GET') {
    return Response.json({
      sha: 'config-sha',
      content: Buffer.from(`${JSON.stringify(currentConfig, null, 2)}\n`).toString('base64')
    });
  }
  writtenConfig = JSON.parse(Buffer.from(JSON.parse(options.body).content, 'base64').toString('utf8'));
  return Response.json({ commit: { sha: 'saved-commit-sha' } });
};

try {
  const authenticatedSave = await worker.fetch(
    new Request(`${origin}/api/settings`, {
      method: 'POST',
      headers: {
        accept: 'application/json',
        cookie,
        origin,
        'sec-fetch-site': 'same-origin'
      },
      body: saveForm
    }),
    env
  );
  assert.equal(authenticatedSave.status, 200, 'a valid signed session must be able to save settings');
  assert.deepEqual(await authenticatedSave.json(), {
    message: 'Saved. Redeploying…',
    commit: 'saved-commit-sha'
  });
  assert.equal(
    writtenConfig?.site?.description,
    'Updated through the authenticated settings test.',
    'the authenticated save must send the validated config to GitHub'
  );
} finally {
  globalThis.fetch = originalFetch;
}

console.log('Settings authentication tests passed.');
