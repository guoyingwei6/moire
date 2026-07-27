import adapter from '@sveltejs/adapter-static';

const base = process.env.BASE_PATH || '';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  kit: {
    adapter: adapter({ fallback: '404.html' }),
    prerender: {
      handleUnseenRoutes: ({ routes }) => {
        const unexpected = routes.filter((route) => route !== '/tags/[tag]');
        if (unexpected.length) {
          throw new Error(`Unprerendered routes: ${unexpected.join(', ')}`);
        }
      }
    },
    paths: {
      base,
      relative: true
    },
    alias: {
      $theme: './src/theme',
      $themes: './src/themes'
    }
  }
};

export default config;
