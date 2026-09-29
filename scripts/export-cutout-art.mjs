// Mechanical runtime export of ritual-v2 SKIN or BOSS masters: contain 428×428 on a
// 512×512 transparent canvas, encode WebP q0.92 with alpha, ≤512 KiB. No repaint.
//
//   node scripts/export-cutout-art.mjs --skins  --ids gumiho_frost,...   (or --all)
//   node scripts/export-cutout-art.mjs --bosses --ids fox_queen,...      (or --all)
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { RUNTIME_WEBP_QUALITY, validateRuntimeWebp } from './character-art-export-options.mjs';
import { loadSkins } from './run-skin-art-codex.mjs';
import { BOSS_SUBJECTS } from './run-boss-art-codex.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const kind = process.argv.includes('--bosses') ? 'bosses' : process.argv.includes('--skins') ? 'skins' : null;
if (!kind) { console.error('usage: --skins | --bosses, then --ids a,b | --all'); process.exit(1); }
const masterDir = path.join(root, 'output/character-art/ritual-v2', kind);
const outDir = path.join(root, 'public/assets/monsters/ritual-v2', kind);
const known = kind === 'skins' ? new Set(loadSkins().keys()) : new Set(Object.keys(BOSS_SUBJECTS));

const i = process.argv.indexOf('--ids');
const ids = process.argv.includes('--all')
  ? [...known].filter(id => existsSync(path.join(masterDir, `${id}-master.png`)))
  : (i >= 0 ? process.argv[i + 1] : '').split(',').map(s => s.trim()).filter(Boolean);
if (ids.length === 0) { console.error('usage: --ids a,b | --all'); process.exit(1); }
const unknown = ids.filter(id => !known.has(id));
if (unknown.length) { console.error(`unknown ${kind} id: ${unknown.join(', ')}`); process.exit(1); }

const masters = ids.map(id => {
  const file = path.join(masterDir, `${id}-master.png`);
  if (!existsSync(file)) throw new Error(`missing master: ${path.relative(root, file)}`);
  const bytes = readFileSync(file);
  if (bytes.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a' || bytes[25] !== 6) throw new Error(`${id} master is not an RGBA PNG`);
  return { id, bytes };
});

const runtime = process.env.PLAYWRIGHT_MODULE ?? '/Users/sungjin/.codex/node_modules/playwright/index.mjs';
const { chromium } = await import(pathToFileURL(runtime).href);
const browser = await chromium.launch({ headless: true });
mkdirSync(outDir, { recursive: true });
try {
  const page = await browser.newPage();
  for (const { id, bytes: master } of masters) {
    const exported = await page.evaluate(async ({ base64, quality }) => {
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
      return canvas.toDataURL('image/webp', quality).split(',')[1];
    }, { base64: master.toString('base64'), quality: RUNTIME_WEBP_QUALITY });
    const bytes = Buffer.from(exported, 'base64');
    validateRuntimeWebp(bytes, id);
    const out = path.join(outDir, `${id}.webp`);
    const unchanged = existsSync(out) && readFileSync(out).equals(bytes);
    if (!unchanged) writeFileSync(out, bytes);
    console.log(`${path.relative(root, out)}: ${unchanged ? 'unchanged' : 'written'} 512×512 WebP with alpha, ${bytes.length} bytes`);
  }
} finally {
  await browser.close();
}
