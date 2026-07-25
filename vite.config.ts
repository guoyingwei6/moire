import { sveltekit } from '@sveltejs/kit/vite';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin } from 'vite';
import { parseIndexNoteConfiguration } from './src/lib/config/index-note.js';

const rootIndexPath = fileURLToPath(new URL('./content/index.md', import.meta.url));
const virtualRootConfig = 'virtual:moire-root-index';
const resolvedVirtualRootConfig = `\0${virtualRootConfig}`;

function rootIndexConfigPlugin(): Plugin {
  return {
    name: 'moire-root-index-config',
    resolveId(id) {
      return id === virtualRootConfig ? resolvedVirtualRootConfig : null;
    },
    load(id) {
      if (id !== resolvedVirtualRootConfig) return null;
      this.addWatchFile(rootIndexPath);
      const { menu, properties, issues } = parseIndexNoteConfiguration(readFileSync(rootIndexPath, 'utf8'));
      return `export default ${JSON.stringify({ menu, properties, issues })};`;
    }
  };
}

export default defineConfig({
  plugins: [rootIndexConfigPlugin(), sveltekit()],
  server: {
    fs: {
      allow: ['.']
    }
  }
});
