import { config } from '../../../moire.config';
import { getMemos } from '$lib/server/memos';
import type { RequestHandler } from './$types';

export const prerender = true;

type SitemapPage = {
  loc: string;
  priority: number;
  changefreq: 'daily' | 'monthly';
  lastmod?: Date;
};

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

export const GET: RequestHandler = async () => {
  const memos = await getMemos();
  const headers = { 'Content-Type': 'application/xml; charset=utf-8' };
  const siteUrl = (config.url || 'https://example.com').replace(/\/+$/, '');

  const pages: SitemapPage[] = [
    { loc: `${ siteUrl }/`, priority: 1.0, changefreq: 'daily' },
    ...memos.map((memo) => ({
      loc: `${ siteUrl }/memo/${ encodeURIComponent(memo.slug) }/`,
      priority: 0.8,
      changefreq: 'monthly' as const,
      lastmod: memo.date
    }))
  ];

  const sitemap = `<?xml version="1.0" encoding="UTF-8" ?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
    ${ pages
      .map(
        (page) => `
    <url>
        <loc>${ escapeXml(page.loc) }</loc>
        <changefreq>${ page.changefreq }</changefreq>
        <priority>${ page.priority }</priority>
        ${ page.lastmod ? `<lastmod>${ page.lastmod.toISOString() }</lastmod>` : '' }
    </url>`
      )
    .join('')}
</urlset>`;

  return new Response(sitemap, { headers });
};
