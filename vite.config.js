import { defineConfig } from 'vite';
import { resolve } from 'node:path';

const repository = process.env.GITHUB_REPOSITORY?.split('/')[1];

export default defineConfig({
  base: process.env.GITHUB_ACTIONS && repository ? `/${repository}/` : '/',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        index: resolve(process.cwd(), 'index.html'),
        pacer: resolve(process.cwd(), 'pacer.html'),
        alike: resolve(process.cwd(), 'alike.html'),
        progress: resolve(process.cwd(), 'progress.html'),
        kanji: resolve(process.cwd(), 'kanji.html'),
      },
    },
  },
});
