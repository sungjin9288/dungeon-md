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
        // Split the 800KB+ application bundle into logical feature chunks so
        // each stays under Vite's 500KB warning threshold. Third-party libs
        // (phaser, tone) keep their own chunks for long-term browser cache.
        manualChunks(id: string): string | undefined {
          if (id.includes('node_modules/phaser')) return 'phaser';
          if (id.includes('node_modules/tone'))   return 'tone';

          // Application code — split `src/` paths into feature chunks.
          // Scenes, UI, and combat subsystems are highly interdependent
          // (scenes import UI widgets, UI reads back to scene state, combat
          // mutates scene sprites) so we bundle them together to avoid
          // circular-chunk warnings. The combined size stays under 500KB.
          if (
            id.includes('/src/scenes/')  ||
            id.includes('/src/ui/')      ||
            id.includes('/src/combat/')  ||
            id.includes('/src/objects/')
          ) return 'app-gameplay';

          if (id.includes('/src/art/'))       return 'app-art';
          // Data + utils + constants share a chunk: data files import
          // `../utils/logger`, so keeping them together avoids a
          // data → utils → (default) → data round-trip in the chunk graph.
          if (
            id.includes('/src/data/')      ||
            id.includes('/src/utils/')     ||
            id.includes('/src/constants/')
          ) return 'app-data';
          if (id.includes('/src/audio/'))  return 'app-audio';
          if (id.includes('/src/themes/')) return 'app-themes';

          return undefined;
        },
      },
    },
  },
});
