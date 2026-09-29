#!/usr/bin/env node
/**
 * Generate ritual-v2 SKIN masters through Codex's built-in image tool. Each skin
 * attaches its base character's approved master as the identity reference, so
 * the skin reads as the same guardian re-dressed (colour/costume only).
 *
 *   node scripts/run-skin-art-codex.mjs [--ids a,b] [--force]
 *
 * Masters: output/character-art/ritual-v2/skins/{skinId}-master.png (skins whose
 * base master does not exist yet are skipped). Export: scripts/export-cutout-art.mjs --skins.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, openSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BASE_DIR = join(ROOT, 'output/character-art/ritual-v2');
const MASTER_DIR = join(BASE_DIR, 'skins');
const SUBJECTS = JSON.parse(readFileSync(join(ROOT, 'scripts/skin-art-subjects.json'), 'utf8'));
const PKG = process.env.CODEX_PKG ?? '@openai/codex@0.158.0';
const MODEL = process.env.CODEX_MODEL ?? 'gpt-6-luna';
const EFFORT = process.env.CODEX_EFFORT ?? 'max';
const LOG_DIR = process.env.RITUAL_LOG_DIR ?? join(tmpdir(), 'skin-art-codex');

/** skinId → base monster id, parsed from SKIN_DATA. */
export function loadSkins() {
  const src = readFileSync(join(ROOT, 'src/data/monstersDataCh7andExtras.ts'), 'utf8');
  const body = src.slice(src.indexOf('export const SKIN_DATA'));
  return new Map([...body.matchAll(/id: '([a-z_0-9]+)',\s*monsterId: '([a-z_]+)',\s*name: '([^']+)'/g)].map(m => [m[1], { base: m[2], name: m[3] }]));
}

export function skinPrompt(skinId, skin) {
  const subject = SUBJECTS[skinId];
  if (!subject) throw new Error(`no subject for skin ${skinId} in scripts/skin-art-subjects.json`);
  return `You are only an image generator for this task. Do NOT edit, create or delete any file other than the single output PNG named below. Do not run git. Do not change code.

Task: use your built-in image generation tool to create ONE image, then save the generated PNG unchanged (no resizing, no background removal, no repainting) to exactly this path, relative to the current directory:
  output/character-art/ritual-v2/skins/${skinId}-master.png

The FIRST attached image is the approved base character. Keep the SAME character identity: species, body shape, proportions, face, silhouette, stance and role prop. Change only colours, costume and small themed accessories as described. Any further attached image is a style reference only.

Image prompt:
Asset type: one production full-body transparent character cutout (a cosmetic skin) for a Korean folklore dungeon-defense collection game, shown at 48 to 180 pixels tall.
Skin (${skin.name}): ${subject}.
Style: identical rendering to the base character — hand-painted stylized 2D gouache, broad matte brush planes, selective dry-brush texture, slightly irregular dark contour, soft ivory key light. Not anime cel-shaded, not glossy 3D, not photorealistic. No Chinese imperial or Japanese motifs.
Composition: square, one centered character, full body and every prop fully visible, same scale and framing as the base image, at least 10 percent empty margin on every side. Genuinely TRANSPARENT background with alpha. No environment, floor, cast shadow, frame, text, letters, UI or watermark.

When done, reply with only: the saved path, the image pixel size, and whether the PNG has an alpha channel.
`;
}

function main() {
  const arg = name => { const i = process.argv.indexOf(name); return i >= 0 ? process.argv[i + 1] : null; };
  const skins = loadSkins();
  const wanted = arg('--ids') ? new Set(arg('--ids').split(',').map(s => s.trim())) : null;
  const force = process.argv.includes('--force');
  mkdirSync(MASTER_DIR, { recursive: true });
  mkdirSync(LOG_DIR, { recursive: true });
  for (const [skinId, skin] of skins) {
    if (wanted && !wanted.has(skinId)) continue;
    const master = join(MASTER_DIR, `${skinId}-master.png`);
    const base = join(BASE_DIR, `${skin.base}-master.png`);
    if (existsSync(master) && !force) { console.log(`${skinId}: skip (exists)`); continue; }
    if (!existsSync(base)) { console.log(`${skinId}: skip (base ${skin.base} has no master yet)`); continue; }
    const refs = [base, join(BASE_DIR, 'dokkaebi_warrior-master.png')].filter((r, i, all) => all.indexOf(r) === i);
    const args = ['-y', PKG, 'exec', '-m', MODEL, '-c', `model_reasoning_effort="${EFFORT}"`, '-C', ROOT, '-s', 'workspace-write',
      '--skip-git-repo-check', ...refs.flatMap(r => ['-i', r]), '-o', join(LOG_DIR, `${skinId}.last.txt`), '-'];
    const started = Date.now();
    const log = openSync(join(LOG_DIR, `${skinId}.log`), 'w');
    const run = spawnSync('npx', args, { input: skinPrompt(skinId, skin), stdio: ['pipe', log, log], cwd: ROOT });
    const ok = run.status === 0 && existsSync(master);
    const b = ok ? readFileSync(master) : null;
    console.log(`${skinId}: ${ok ? (b[25] === 6 ? 'ok RGBA' : 'NOT RGBA') : `FAILED exit=${run.status}`} ${Math.round((Date.now() - started) / 1000)}s`);
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
