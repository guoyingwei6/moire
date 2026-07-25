import type { RequestHandler } from './$types';
import { config } from '../../../moire.config';
import { getPosts } from '$lib/server/content';
import { renderRssFeed, selectFeedPosts } from '$lib/server/rss-feed.js';

export const prerender = true;

export const GET: RequestHandler = () => {
  const body = renderRssFeed({
    siteUrl: config.url,
    channelTitle: config.title,
    channelRoute: '/',
    description: config.description,
    posts: selectFeedPosts(getPosts())
  });

  return new Response(body, {
    headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' }
  });
};
