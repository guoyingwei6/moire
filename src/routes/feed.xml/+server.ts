import type { RequestHandler } from './$types';
import { config } from '../../../moire.config';
import { getPosts } from '$lib/server/content';

export const prerender = true;

const escapeXml = (value: string) => value
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&apos;');

export const GET: RequestHandler = () => {
  const origin = config.url.replace(/\/$/, '');
  const items = getPosts().map((post) => {
    const postUrl = escapeXml(`${origin}${post.route}`);
    return `
    <item>
      <title>${escapeXml(post.title)}</title>
      <link>${postUrl}</link>
      <guid>${postUrl}</guid>
      ${post.created ? `<pubDate>${new Date(post.created).toUTCString()}</pubDate>` : ''}
      <description>${escapeXml(post.summary)}</description>
    </item>`;
  }).join('');

  return new Response(`<?xml version="1.0" encoding="UTF-8" ?>
<rss version="2.0">
  <channel>
    <title>${escapeXml(config.title)}</title>
    <link>${escapeXml(`${origin}/`)}</link>
    <description>${escapeXml(config.description)}</description>${items}
  </channel>
</rss>`, {
    headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' }
  });
};
