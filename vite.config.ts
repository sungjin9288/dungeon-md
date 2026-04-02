import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  server: {
    port: 8083,
    host: true,
  },
  build: {
    outDir: 'dist',
    rollupOptions: {
      output: {
        manualChunks: {
          phaser: ['phaser'],
          tone:   ['tone'],
        },
      },
    },
  },
});
