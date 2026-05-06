import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    lib: {
      entry: resolve(__dirname, 'src/content/index.ts'),
      formats: ['iife'],
      name: 'CommentPilotContent',
      fileName: () => 'src/content/index.js'
    },
    rollupOptions: {
      output: {
        extend: true
      }
    }
  }
});
