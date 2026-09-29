import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    // e2e/ はPlaywrightのテストなのでVitestの対象から除外する
    exclude: ['**/node_modules/**', '**/dist/**', 'e2e/**'],
  },
});
