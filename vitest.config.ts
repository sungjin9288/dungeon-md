import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // happy-dom is lighter than jsdom and provides localStorage, window, etc.
    environment: 'happy-dom',
    // Match *.test.ts and *.spec.ts files under src/
    include: ['src/**/*.{test,spec}.ts'],
    // Exclude phaser-coupled code from default runs (scenes/objects depend on
    // the full Phaser runtime which is heavy and not meaningful to unit test).
    exclude: ['node_modules', 'dist', 'android', 'ios'],
    // Globals: enable describe/it/expect without imports
    globals: true,
    // Clear localStorage between tests to prevent cross-test pollution
    clearMocks: true,
    restoreMocks: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/data/**', 'src/themes/**', 'src/constants/**'],
      exclude: [
        'src/**/*.test.ts',
        'src/**/*.spec.ts',
        'src/scenes/**',
        'src/objects/**',
        'src/ui/**',
        'src/art/**',
      ],
    },
  },
});
