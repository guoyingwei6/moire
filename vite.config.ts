import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import { config } from './moire.config';

const virtualThemeId = 'virtual:moire-theme';
const resolvedVirtualThemeId = `\0${virtualThemeId}`;
const supportedThemes = new Set(['receipt', 'cyberpunk', 'academic', 'bento', 'pixel', 'classic']);
const selectedTheme = supportedThemes.has(config.theme) ? config.theme : 'receipt';

export default defineConfig({
  plugins: [
    {
      name: 'moire-theme',
      resolveId(id) {
        if (id === virtualThemeId) return resolvedVirtualThemeId;
      },
      load(id) {
        if (id === resolvedVirtualThemeId) {
          return `export { default } from '/src/themes/${selectedTheme}/index.svelte';`;
        }
      }
    },
    tailwindcss(),
    sveltekit()
  ],
  server: {
    fs: {
      allow: ['.']
    }
  }
});
