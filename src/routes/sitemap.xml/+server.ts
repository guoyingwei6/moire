import type { RequestHandler } from './$types';
import { config } from '../../../moire.config';
import { getAllPublicRoutes } from '$lib/server/content';

export const prerender = true;

const escapeXml = (value: string) => value
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&apos;');

export const GET: RequestHandler = () => {
  const origin = config.url.replace(/\/$/, '');
  const urls = [...new Set(getAllPublicRoutes())]
    .filter((route) => !route.endsWith('.xml'))
    .map((route) => `<url><loc>${escapeXml(`${origin}${route}`)}</loc></url>`)
    .join('');

  return new Response(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' }
  });
};
