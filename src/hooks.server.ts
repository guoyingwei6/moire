import type { Handle } from '@sveltejs/kit';
import { config } from '../moire.config';

const supportedThemes = new Set(['receipt', 'cyberpunk', 'academic', 'bento', 'pixel', 'classic']);
const theme = supportedThemes.has(config.theme) ? config.theme : 'receipt';

export const handle: Handle = async ({ event, resolve }) => {
  return resolve(event, {
    transformPageChunk: ({ html }) => html.replace('<body ', `<body class="${ theme }" `)
  });
};
