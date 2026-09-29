import { resolve } from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';
import { generateProblemIndex } from './scripts/problemIndex.js';

function problemIndexPlugin(): Plugin {
  const problemsDir = resolve(__dirname, 'public/problems');

  return {
    name: 'kenshou-lab-problem-index',
    buildStart() {
      generateProblemIndex(problemsDir);
    },
    configureServer(server) {
      generateProblemIndex(problemsDir);
      server.watcher.add(problemsDir);
      server.watcher.on('all', (_event, filePath) => {
        const normalized = filePath.replace(/\\/g, '/');
        if (
          normalized.startsWith(problemsDir.replace(/\\/g, '/')) &&
          normalized.endsWith('.json') &&
          !normalized.endsWith('index.json')
        ) {
          generateProblemIndex(problemsDir);
        }
      });
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), problemIndexPlugin()],
});
