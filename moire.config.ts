import siteSettings from './site.config.json';

export type NavigationItem = {
  label: string;
  icon: string;
  href: string;
};

export type FooterLink = {
  label: string;
  href: string;
  external?: boolean;
};

export type SiteSettings = {
  site: {
    title: string;
    author: string;
    description: string;
    domain: string;
    logoEmoji: string;
    rtl: boolean;
  };
  social: {
    twitter: string;
    instagram: string;
    github: string;
    youtube: string;
    mastodon: string;
    email: string;
  };
  colors: {
    background: string;
    text: string;
    secondary: string;
    link: string;
  };
  navigation: NavigationItem[];
  features: {
    qrCode: boolean;
    tags: boolean;
    archive: boolean;
    previousNext: boolean;
    footer: boolean;
    metadata: boolean;
    folderName: boolean;
  };
};

type JsonObject = Record<string, unknown>;

const invalid = (path: string, expectation: string): never => {
  throw new Error(`Invalid site.config.json: ${path} ${expectation}`);
};

const objectAt = (value: unknown, path: string): JsonObject => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return invalid(path, 'must be an object');
  }
  return value as JsonObject;
};

const stringAt = (object: JsonObject, key: string, path: string): string => {
  const value = object[key];
  if (typeof value !== 'string') return invalid(`${path}.${key}`, 'must be a string');
  return value.trim();
};

const requiredStringAt = (object: JsonObject, key: string, path: string): string => {
  const value = stringAt(object, key, path);
  if (!value) return invalid(`${path}.${key}`, 'must not be empty');
  return value;
};

const booleanAt = (object: JsonObject, key: string, path: string): boolean => {
  const value = object[key];
  if (typeof value !== 'boolean') return invalid(`${path}.${key}`, 'must be true or false');
  return value;
};

const normalizeHttpsUrl = (value: string, path: string): string => {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return invalid(path, 'must be a valid https URL');
  }

  if (url.protocol !== 'https:' || url.username || url.password) {
    return invalid(path, 'must be an https URL without embedded credentials');
  }
  return url.href.replace(/\/$/, '');
};

const normalizeSiteUrl = (value: string): string => {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return invalid('site.domain', 'must be a complete https URL');
  }

  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) {
    return invalid('site.domain', 'must be an https URL without credentials, query, or hash');
  }

  const pathname = url.pathname === '/' ? '' : url.pathname.replace(/\/+$/, '');
  return `${url.origin}${pathname}`;
};

const normalizeProfile = (
  value: string,
  path: string,
  host: string,
  usernamePattern: RegExp
): string => {
  if (!value) return '';
  if (/^https:\/\//i.test(value)) return normalizeHttpsUrl(value, path);
  if (/^[a-z][a-z\d+.-]*:/i.test(value) || value.includes('/')) {
    return invalid(path, 'must be a username or complete https URL');
  }

  const username = value.replace(/^@/, '');
  if (!usernamePattern.test(username)) return invalid(path, 'contains an invalid username');
  return `https://${host}/${username}`;
};

const normalizeOptionalHttpsUrl = (value: string, path: string): string => (
  value ? normalizeHttpsUrl(value, path) : ''
);

const normalizeEmail = (value: string): string => {
  if (!value) return '';
  const address = value.replace(/^mailto:/i, '');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) {
    return invalid('social.email', 'must be a public email address');
  }
  return address;
};

const colorAt = (object: JsonObject, key: string): string => {
  const value = requiredStringAt(object, key, 'colors');
  if (!/^#(?:[\da-f]{3}|[\da-f]{4}|[\da-f]{6}|[\da-f]{8})$/i.test(value)) {
    return invalid(`colors.${key}`, 'must be a 3, 4, 6, or 8 digit hex color');
  }
  return value;
};

const navigationAt = (value: unknown): NavigationItem[] => {
  if (!Array.isArray(value) || value.length === 0) {
    return invalid('navigation', 'must be a non-empty array');
  }

  const seen = new Set<string>();
  return value.map((entry, index) => {
    const path = `navigation[${index}]`;
    const item = objectAt(entry, path);
    const label = requiredStringAt(item, 'label', path);
    const icon = requiredStringAt(item, 'icon', path);
    const href = requiredStringAt(item, 'href', path);

    if (!href.startsWith('/') || href.startsWith('//') || href.includes('\\') || /[?#]/.test(href)) {
      return invalid(`${path}.href`, 'must be a local path beginning with one slash and without query or hash');
    }

    const segments = href.split('/').filter(Boolean);
    if (segments.some((segment) => segment === '.' || segment === '..')) {
      return invalid(`${path}.href`, 'must not contain dot path segments');
    }

    const normalized = href === '/' ? '/' : `/${segments.join('/')}${href.endsWith('/') ? '/' : ''}`;
    if (seen.has(normalized)) return invalid(`${path}.href`, 'must be unique');
    seen.add(normalized);
    return { label, icon, href: normalized };
  });
};

const validateSettings = (value: unknown): SiteSettings => {
  const root = objectAt(value, 'root');
  const site = objectAt(root.site, 'site');
  const social = objectAt(root.social, 'social');
  const colors = objectAt(root.colors, 'colors');
  const features = objectAt(root.features, 'features');

  return {
    site: {
      title: requiredStringAt(site, 'title', 'site'),
      author: requiredStringAt(site, 'author', 'site'),
      description: requiredStringAt(site, 'description', 'site'),
      domain: normalizeSiteUrl(requiredStringAt(site, 'domain', 'site')),
      logoEmoji: requiredStringAt(site, 'logoEmoji', 'site'),
      rtl: booleanAt(site, 'rtl', 'site')
    },
    social: {
      twitter: normalizeProfile(stringAt(social, 'twitter', 'social'), 'social.twitter', 'twitter.com', /^[A-Za-z\d_]{1,15}$/),
      instagram: normalizeProfile(stringAt(social, 'instagram', 'social'), 'social.instagram', 'instagram.com', /^[A-Za-z\d._]{1,30}$/),
      github: normalizeProfile(stringAt(social, 'github', 'social'), 'social.github', 'github.com', /^(?!-)[A-Za-z\d-]{1,39}(?<!-)$/),
      youtube: normalizeOptionalHttpsUrl(stringAt(social, 'youtube', 'social'), 'social.youtube'),
      mastodon: normalizeOptionalHttpsUrl(stringAt(social, 'mastodon', 'social'), 'social.mastodon'),
      email: normalizeEmail(stringAt(social, 'email', 'social'))
    },
    colors: {
      background: colorAt(colors, 'background'),
      text: colorAt(colors, 'text'),
      secondary: colorAt(colors, 'secondary'),
      link: colorAt(colors, 'link')
    },
    navigation: navigationAt(root.navigation),
    features: {
      qrCode: booleanAt(features, 'qrCode', 'features'),
      tags: booleanAt(features, 'tags', 'features'),
      archive: booleanAt(features, 'archive', 'features'),
      previousNext: booleanAt(features, 'previousNext', 'features'),
      footer: booleanAt(features, 'footer', 'features'),
      metadata: booleanAt(features, 'metadata', 'features'),
      folderName: booleanAt(features, 'folderName', 'features')
    }
  };
};

const settings = validateSettings(siteSettings);
const siteUrl = settings.site.domain;

const navigation = settings.navigation.filter((item) => (
  (settings.features.tags || item.href !== '/tags/')
  && (settings.features.archive || item.href !== '/archive/')
));

const socialLinks = [
  ['Twitter', settings.social.twitter],
  ['Instagram', settings.social.instagram],
  ['GitHub', settings.social.github],
  ['YouTube', settings.social.youtube],
  ['Mastodon', settings.social.mastodon],
  ['Email', settings.social.email ? `mailto:${settings.social.email.replace(/^mailto:/, '')}` : '']
] as const;

const footerLinks: FooterLink[] = [
  ...(settings.features.tags ? [{ label: 'Tags', href: '/tags/' }] : []),
  ...(settings.features.archive ? [{ label: 'Archive', href: '/archive/' }] : []),
  { label: 'RSS feed', href: '/feed.xml' },
  ...socialLinks
    .filter(([, href]) => Boolean(href))
    .map(([label, href]) => ({ label, href, external: true })),
  ...(settings.features.qrCode ? [{ label: 'QR Code', href: '/qr/' }] : []),
  { label: 'About me', href: '/about/about-me/' }
];

export const config = {
  title: settings.site.title,
  author: settings.site.author,
  description: settings.site.description,
  keywords: 'blog, Apple Notes, notes, photos, music, video',
  url: siteUrl,
  domain: siteUrl,
  logoEmoji: settings.site.logoEmoji,
  rtl: settings.site.rtl,
  social: settings.social,
  colors: settings.colors,
  features: settings.features,
  navigation,
  footerLinks
};
