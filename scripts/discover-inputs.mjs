// One-shot discovery: print the inferred input labels per surface so modal
// triggers can be chosen from live evidence instead of guessed.
// WEB_AUDIT_HEADLESS=1 node scripts/discover-inputs.mjs
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { createSceneOpener, inventory } from './lib/web-audit.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const runtime = process.env.PLAYWRIGHT_MODULE ?? '/Users/sungjin/.codex/node_modules/playwright/index.mjs';
const { chromium } = await import(pathToFileURL(runtime).href);
const base = process.env.WEB_AUDIT_URL ?? 'http://127.0.0.1:8083';
const viewport = { width: 390, height: 844 };

const scenes = (process.env.SCENES ?? [
  'ShopScene', 'BarracksScene', 'CodexScene', 'FusionScene', 'ForgeScene',
  'AncestralWisdomScene', 'AchievementScene', 'AbyssScene',
  'ProductionScene', 'DecorationScene', 'SummonScene',
].join(',')).split(',');

const browser = await chromium.launch({ headless: process.env.WEB_AUDIT_HEADLESS === '1' });
const openScene = createSceneOpener({ browser, base });

try {
  const seed = process.env.SEED ? JSON.parse(process.env.SEED) : undefined;
  for (const scene of scenes) {
    const { context, page } = await openScene(scene, viewport, undefined, { seed });
    try {
      const state = await inventory(page);
      const labels = state.scenes
        .flatMap(entry => entry.inputs)
        .map(input => (input.label ?? '').replace(/\s+/g, ' ').trim())
        .filter(Boolean);
      const unique = [...new Set(labels)];
      process.stdout.write(`\n=== ${scene} (${labels.length} inputs) ===\n`);
      process.stdout.write(unique.map(label => `  ${label.slice(0, 60)}`).join('\n') + '\n');
    } catch (error) {
      process.stdout.write(`\n=== ${scene} FAILED: ${error}\n`);
    } finally { await context.close(); }
  }
} finally { await browser.close(); }
