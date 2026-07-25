import { error } from '@sveltejs/kit';
import type { EntryGenerator, RequestHandler } from './$types';
import { config } from '../../../../moire.config';
import type { ContentRecord } from '$lib/content';
import { getCatchAllEntries, getPosts, getRecord } from '$lib/server/content';
import { isFeedCollection, renderRssFeed, selectFeedPosts } from '$lib/server/rss-feed.js';

export const prerender = true;

const collectionRoute = (value: string): string => {
  const path = value.split('/').filter(Boolean).join('/');
  return path ? `/${path}/` : '/';
};

const publicCollections = (): ContentRecord[] => getCatchAllEntries()
  .map(({ path }) => getRecord(collectionRoute(path)))
  .filter((record): record is ContentRecord => Boolean(record && isFeedCollection(record)))
  .sort((left, right) => left.route.localeCompare(right.route));

export const entries: EntryGenerator = () => publicCollections().map((collection) => {
  for (const endpoint of ['feed.xml', 'rss.xml']) {
    const collision = getRecord(`${collection.route}${endpoint}/`);
    if (collision) {
      throw new Error(
        `Content route ${collision.route} conflicts with the generated Collection ${endpoint} endpoint`
      );
    }
  }

  return { collection: collection.route.split('/').filter(Boolean).join('/') };
});

export const GET: RequestHandler = ({ params }) => {
  const route = collectionRoute(params.collection);
  const collection = getRecord(route);
  if (!collection || !isFeedCollection(collection)) {
    error(404, 'Public Collection feed not found');
  }

  const posts = selectFeedPosts(getPosts(), route, collection.options.showNestedNotes);
  const body = renderRssFeed({
    siteUrl: config.url,
    channelTitle: `${collection.title} — ${config.title}`,
    channelRoute: route,
    description: collection.summary || config.description,
    posts
  });

  return new Response(body, {
    headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' }
  });
};
