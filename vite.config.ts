import { readdir, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { defineConfig, type Plugin } from 'vite';

// `public/` is copied into `dist/` verbatim, which also ships the drop-in
// guides that deliberately live next to the folders they document
// (`assets/ASSET_GUIDE.md`, `assets/backgrounds/README.md`). Those are
// contributor docs: nothing fetches them at runtime, and Capacitor packages
// `dist/` into the APK/IPA, so a store build would carry them where anyone
// unzipping it can read them. Dropping them after the copy keeps the guides
// where contributors expect them while leaving them out of the shipped app.
function stripBundledDocs(): Plugin {
  let outDir = '';
  return {
    name: 'strip-bundled-docs',
    apply: 'build',
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir);
    },
    async closeBundle() {
      for (const path of await removeMarkdown(outDir)) {
        this.info(`stripped contributor doc: ${path}`);
      }
    },
  };
}

async function removeMarkdown(dir: string): Promise<string[]> {
  const removed: string[] = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) removed.push(...(await removeMarkdown(path)));
    else if (entry.name.endsWith('.md')) {
      await rm(path);
      removed.push(path);
    }
  }
  return removed;
}

export default defineConfig({
  base: './',
  plugins: [stripBundledDocs()],
  server: {
    port: 8083,
    host: true,
  },
  build: {
    outDir: 'dist',
    rollupOptions: {
      output: {
        // Feature chunks keep every application chunk under Vite's 500KB
        // warning threshold and limit cache invalidation: editing a scene no
        // longer rewrites the UI/combat chunks. Third-party libs (phaser,
        // tone) stay in their own chunks for long-term browser cache.
        //
        // `phaser` (~1.5MB) is the one chunk that exceeds the threshold. It is
        // a single vendor library, so it cannot be split without a custom
        // Phaser build; its advisory is expected. The 500KB limit is kept at
        // the default on purpose so a regression in any *app* chunk is still
        // reported instead of being hidden by a raised limit.
        //
        // Scene code is NOT lazy-loaded: all 20 scenes are registered eagerly
        // in `main.ts`, and the app ships inside a Capacitor shell where
        // `dist/` is read from local storage, so deferring chunks would add
        // async navigation risk across 81 `scene.start` call sites without a
        // meaningful delivery win.
        manualChunks(id: string): string | undefined {
          if (id.includes('node_modules/phaser')) return 'phaser';
          if (id.includes('node_modules/tone'))   return 'tone';

          // Scenes, UI, and combat are interdependent (scenes import UI
          // widgets, UI reads back scene state, combat mutates scene sprites).
          // Separate chunks were verified against that risk: the build emits
          // no circular-chunk warning, and a built-output boot exercised all
          // 12 hub scenes plus DungeonScene/UIScene with zero console errors.
          if (id.includes('/src/scenes/')) return 'app-scenes';
          if (id.includes('/src/ui/'))     return 'app-ui';
          if (
            id.includes('/src/combat/')  ||
            id.includes('/src/objects/')
          ) return 'app-combat';

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
