import type { RequestHandler } from './$types';
import { config } from '../../../moire.config';

export const prerender = true;

export const GET: RequestHandler = () => {
  const origin = config.url.replace(/\/$/, '');

  return new Response(`User-agent: *\nAllow: /\n\nSitemap: ${origin}/sitemap.xml\n`, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' }
  });
};
