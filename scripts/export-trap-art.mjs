// Mechanical runtime export of trap / affliction icon masters (TRAP_ART_CODEX_HANDOFF.md).
// Does not generate, repaint, segment, or remove backgrounds: contain 216×216 on a
// 256×256 transparent canvas (20px margin), keep alpha, enforce 128 KiB.
//
//   node scripts/export-trap-art.mjs --ids spike_trap,affliction_bleed   (or --all)
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const masterDir = path.join(root, 'output/trap-art/v1');
const outDir = path.join(root, 'public/assets/traps');
const MAX_BYTES = 128 * 1024;

const trapSrc = readFileSync(path.join(root, 'src/data/traps.ts'), 'utf8');
const TRAP_IDS = [...trapSrc.matchAll(/\{\s*id:\s*'([a-z_]+)'[^\n]*?tier:\s*\d/g)].map(m => m[1]);
const AFFLICTION_IDS = ['bleed', 'slow', 'poison', 'shock', 'burn', 'fear'].map(a => `affliction_${a}`);
const KNOWN = new Set([...TRAP_IDS, ...AFFLICTION_IDS]);

const i = process.argv.indexOf('--ids');
const ids = process.argv.includes('--all')
  ? [...KNOWN].filter(id => existsSync(path.join(masterDir, `${id}-master.png`)))
  : (i >= 0 ? process.argv[i + 1] : '').split(',').map(s => s.trim()).filter(Boolean);
if (ids.length === 0) { console.error('usage: --ids a,b | --all'); process.exit(1); }
const unknown = ids.filter(id => !KNOWN.has(id));
if (unknown.length) { console.error(`unknown trap art id: ${unknown.join(', ')}`); process.exit(1); }

function checkPng(bytes, label, size) {
  if (bytes.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') throw new Error(`${label}: not a PNG`);
  if (bytes[25] !== 6) throw new Error(`${label}: not RGBA (colour type ${bytes[25]})`);
  if (size && (bytes.readUInt32BE(16) !== size || bytes.readUInt32BE(20) !== size)) throw new Error(`${label}: not ${size}×${size}`);
}

const masters = ids.map(id => {
  const file = path.join(masterDir, `${id}-master.png`);
  if (!existsSync(file)) throw new Error(`missing master: ${path.relative(root, file)}`);
  const bytes = readFileSync(file);
  checkPng(bytes, `${id} master`);
  return { id, bytes };
});

const runtime = process.env.PLAYWRIGHT_MODULE ?? '/Users/sungjin/.codex/node_modules/playwright/index.mjs';
const { chromium } = await import(pathToFileURL(runtime).href);
const browser = await chromium.launch({ headless: true });
mkdirSync(outDir, { recursive: true });
try {
  const page = await browser.newPage();
  for (const { id, bytes: master } of masters) {
    const exported = await page.evaluate(async base64 => {
      const image = new Image();
      image.src = `data:image/png;base64,${base64}`;
      await image.decode();
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 256;
      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingQuality = 'high';
      const scale = 216 / Math.max(image.width, image.height);
      const width = image.width * scale, height = image.height * scale;
      ctx.drawImage(image, (256 - width) / 2, (256 - height) / 2, width, height);
      return canvas.toDataURL('image/png').split(',')[1];
    }, master.toString('base64'));
    const bytes = Buffer.from(exported, 'base64');
    checkPng(bytes, id, 256);
    if (bytes.length > MAX_BYTES) throw new Error(`${id}: ${bytes.length} bytes exceeds ${MAX_BYTES}`);
    const out = path.join(outDir, `${id}.png`);
    const unchanged = existsSync(out) && readFileSync(out).equals(bytes);
    if (!unchanged) writeFileSync(out, bytes);
    console.log(`${path.relative(root, out)}: ${unchanged ? 'unchanged' : 'written'} 256×256 RGBA, ${bytes.length} bytes`);
  }
} finally {
  await browser.close();
}
