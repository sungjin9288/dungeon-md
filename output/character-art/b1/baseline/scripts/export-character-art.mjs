// Mechanical runtime export of the four selected, unmodified image-tool masters.
// Does not generate, repaint, segment, or remove backgrounds.
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const runtime = process.env.PLAYWRIGHT_MODULE ?? '/Users/sungjin/.codex/node_modules/playwright/index.mjs';
const { chromium } = await import(pathToFileURL(runtime).href);
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  for (const id of ['dokkaebi_warrior', 'gumiho_guardian', 'death_messenger', 'mountain_spirit']) {
    const master = await readFile(path.join(root, `output/character-art/ritual-v2/${id}-master.png`));
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
    assert.equal(bytes.readUInt32BE(16), 512);
    assert.equal(bytes.readUInt32BE(20), 512);
    assert.ok(bytes.length <= 512 * 1024, `${id} exceeds runtime byte budget`);
    const output = `public/assets/monsters/ritual-v2/${id}.png`;
    await writeFile(path.join(root, output), bytes);
    console.log(`${output}: 512×512, ${bytes.length} bytes, 42px transparent export margin`);
  }
} finally {
  await browser.close();
}
