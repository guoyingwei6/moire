
import { config } from '../../../moire.config';
import { getMemos } from '$lib/server/memos';
import type { RequestHandler } from './$types';

export const prerender = true;

function escapeXml(value: string): string {
  return value.replace(/[<>&'\"]/g, (character) => {
    const entities: Record<string, string> = {
      '<': '&lt;',
      '>': '&gt;',
      '&': '&amp;',
      "'": '&apos;',
      '"': '&quot;'
    };
    return entities[character];
  });
}

function asCdata(value: string): string {
  return value.replace(/]]>/g, ']]]]><![CDATA[>');
}

export const GET: RequestHandler = async ({ url }) => {
  const memos = await getMemos();
  const configuredUrl = (config.url || 'https://example.com').replace(/\/+$/, '');
  const siteUrl = (url.origin && url.origin !== 'http://sveltekit-prerender' ? url.origin : configuredUrl).replace(/\/+$/, '');
  const feedUrl = `${ siteUrl }/rss.xml`;

  const body = `<?xml version="1.0" encoding="UTF-8" ?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${ escapeXml(config.title) }${ config.description ? ` | ${ escapeXml(config.description) }` : '' }</title>
    <description>${ escapeXml(config.description) }</description>
    <link>${ escapeXml(`${ siteUrl }/`) }</link>
    <atom:link href="${ escapeXml(feedUrl) }" rel="self" type="application/rss+xml"/>
    ${ memos
      .map(
        (memo) => {
          const memoUrl = `${ siteUrl }/memo/${ encodeURIComponent(memo.slug) }/`;
          return `
      <item>
        <guid isPermaLink="true">${ escapeXml(memoUrl) }</guid>
        <title>${ escapeXml(memo.title) }</title>
        <link>${ escapeXml(memoUrl) }</link>
        <description><![CDATA[${ asCdata(memo.content) }]]></description>
        <pubDate>${ memo.date.toUTCString() }</pubDate>
        ${ memo.tags.map((tag) => `<category>${ escapeXml(tag) }</category>`).join('') }
      </item>
    `;
        }
      )
      .join('') }
  </channel>
</rss>`;

  return new Response(body, {
    headers: {
      'Cache-Control': 'max-age=0, s-maxage=3600',
      'Content-Type': 'application/rss+xml; charset=utf-8'
    }
  });
};
