// Mechanical runtime export of an explicit batch of unmodified image-tool masters.
// Does not generate, repaint, segment, or remove backgrounds.
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

import {
  loadKnownMonsterIds,
  parseCharacterArtExportArgs,
  planCharacterArtOutputWrites,
  preflightCharacterArtMasters,
  preflightCharacterArtOutputTargets,
  validateKnownCharacterArtIds,
  validateRuntimePng,
  writeCharacterArtOutputs,
} from './character-art-export-options.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const { ids, masterDir } = parseCharacterArtExportArgs(process.argv.slice(2), root);
const knownIds = await loadKnownMonsterIds(root);
validateKnownCharacterArtIds(ids, knownIds);

const allowedMasterRoot = path.join(root, 'output/character-art/ritual-v2');
const outputRoot = path.join(root, 'public/assets/monsters/ritual-v2');
const masters = await preflightCharacterArtMasters(ids, masterDir, allowedMasterRoot, root);
await preflightCharacterArtOutputTargets(ids, outputRoot, root);

const runtime = process.env.PLAYWRIGHT_MODULE ?? '/Users/sungjin/.codex/node_modules/playwright/index.mjs';
const { chromium } = await import(pathToFileURL(runtime).href);
const browser = await chromium.launch({ headless: true });
const exports = [];
try {
  const page = await browser.newPage();
  for (const { id, bytes: master } of masters) {
    const exported = await page.evaluate(async base64 => {
      const image = new Image();
      image.src = `data:image/png;base64,${base64}`;
      await image.decode();
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 512;
      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingQuality = 'high';
      const scale = 428 / Math.max(image.width, image.height);
      const width = image.width * scale, height = image.height * scale;
      ctx.drawImage(image, (512 - width) / 2, (512 - height) / 2, width, height);
      return canvas.toDataURL('image/png').split(',')[1];
    }, master.toString('base64'));
    const bytes = Buffer.from(exported, 'base64');
    validateRuntimePng(bytes, id);
    exports.push({ id, outputPath: path.join(outputRoot, `${id}.png`), bytes });
  }
} finally {
  await browser.close();
}

const plan = await planCharacterArtOutputWrites(exports, outputRoot, root);
await writeCharacterArtOutputs(plan);
for (const { id, outputPath, bytes, status } of plan) {
  const relativeOutput = path.relative(root, outputPath);
  if (status === 'unchanged') {
    console.log(`${relativeOutput}: unchanged, no write (${bytes.length} bytes)`);
  } else {
    console.log(`${relativeOutput}: created 512×512 RGBA, ${bytes.length} bytes, 42px transparent export margin`);
  }
}
