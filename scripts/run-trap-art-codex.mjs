#!/usr/bin/env node
/**
 * Generate trap / affliction icon masters (TRAP_ART_CODEX_HANDOFF.md) through
 * Codex's built-in image tool, one id at a time, in dependency order so a T2/T3
 * trap can take its two ingredient traps as visual references (fusion must read).
 *
 *   node scripts/run-trap-art-codex.mjs [--ids a,b] [--force] [--print id]
 *
 * Masters: output/trap-art/v1/{id}-master.png. Export: scripts/export-trap-art.mjs.
 * Env as run-ritual-v2-codex.mjs (CODEX_PKG, CODEX_MODEL, CODEX_EFFORT, RITUAL_LOG_DIR).
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, openSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const MASTER_DIR = join(ROOT, 'output/trap-art/v1');
const STYLE_REFS = ['dokkaebi_warrior', 'gumiho_guardian'].map(id => join(ROOT, `output/character-art/ritual-v2/${id}-master.png`));
const SUBJECTS = JSON.parse(readFileSync(join(ROOT, 'scripts/trap-art-subjects.json'), 'utf8'));
const PKG = process.env.CODEX_PKG ?? '@openai/codex@0.158.0';
const MODEL = process.env.CODEX_MODEL ?? 'gpt-6-luna';
const EFFORT = process.env.CODEX_EFFORT ?? 'max';
const LOG_DIR = process.env.RITUAL_LOG_DIR ?? join(tmpdir(), 'trap-art-codex');

/** Tier and ingredients, from src/data/traps.ts recipes (parsed, not duplicated by hand). */
function loadTraps() {
  const src = readFileSync(join(ROOT, 'src/data/traps.ts'), 'utf8');
  const traps = new Map();
  // Each def starts at "{ id: '...'"; its recipe (if any) sits before the next def.
  const starts = [...src.matchAll(/\{\s*id:\s*'([a-z_]+)'[^\n]*?tier:\s*(\d)/g)];
  starts.forEach((m, i) => {
    const body = src.slice(m.index, starts[i + 1]?.index ?? src.length);
    const recipe = body.match(/traps:\s*\[\s*'([a-z_]+)',\s*'([a-z_]+)'\s*\]/);
    traps.set(m[1], { tier: Number(m[2]), from: recipe ? [recipe[1], recipe[2]] : [] });
  });
  return traps;
}
const TRAPS = loadTraps();
const AFFLICTIONS = Object.keys(SUBJECTS).filter(id => id.startsWith('affliction_'));
const ORDER = [...AFFLICTIONS, ...[...TRAPS.keys()].sort((a, b) => TRAPS.get(a).tier - TRAPS.get(b).tier)];

const TIER_RULE = {
  1: 'Tier 1: one plain folk material, no glow.',
  2: 'Tier 2: two materials fused (both ingredient traps clearly recognisable), a subtle inner glow.',
  3: 'Tier 3: aged bronze fittings and a small violet boss-essence flame accent, both ingredients still recognisable; richer but not cluttered.',
};

export function trapPrompt(id) {
  const subject = SUBJECTS[id];
  if (!subject) throw new Error(`no subject for ${id} in scripts/trap-art-subjects.json`);
  const isAffliction = id.startsWith('affliction_');
  const tier = TRAPS.get(id)?.tier;
  return `You are only an image generator for this task. Do NOT edit, create or delete any file other than the single output PNG named below. Do not run git. Do not change code.

Task: use your built-in image generation tool to create ONE image, then save the generated PNG unchanged (no resizing, no background removal, no repainting) to exactly this path, relative to the current directory:
  output/trap-art/v1/${id}-master.png

The first attached images are STYLE REFERENCES ONLY (approved characters of the same game): match their hand-painted matte gouache rendering, restrained dark contour and color discipline. Any further attached images are the INGREDIENT trap icons this one is fused from — carry their key visual elements into the new icon. Do not copy characters.

Image prompt:
Asset type: one production ${isAffliction ? 'status-effect icon shown above enemies, readable even at 32 to 64 pixels' : 'dungeon trap icon for a Korean folklore dungeon-defense game, readable at 44 to 96 pixels'}.
Subject: ${subject}.
${isAffliction ? 'One simple bold symbol, very clear silhouette, minimal detail.' : `${TIER_RULE[tier] ?? TIER_RULE[1]} Viewed from the front and slightly above.`}
Materials: Korean folk craft only — bamboo, straw, hemp, onggi earthenware, spirit-paper talismans, aged brass and bronze, mother-of-pearl. No Chinese or Japanese objects, no modern metal machinery.
Style: hand-painted stylized 2D gouache game icon matching the references, broad matte brush planes, selective dry-brush texture, slightly irregular dark contour, soft ivory key light. Color discipline: charcoal and ink-indigo shadows, warm ochre, jade and aged brass, with the effect color used sparingly. Not glossy 3D, not photorealistic, no thick cartoon outline.
Composition: square, one centered object, fully visible, occupies about 84 percent of the canvas with an even empty margin on every side. Genuinely TRANSPARENT background with alpha. No environment, floor, cast shadow, frame, badge, circle backdrop, text, letters, numbers, UI or watermark.

When done, reply with only: the saved path, the image pixel size, and whether the PNG has an alpha channel.
`;
}

function isRgbaPng(path) {
  const b = readFileSync(path);
  return b.subarray(0, 8).toString('hex') === '89504e470d0a1a0a' && b[25] === 6;
}

function main() {
  const arg = name => { const i = process.argv.indexOf(name); return i >= 0 ? process.argv[i + 1] : null; };
  if (arg('--print')) { process.stdout.write(trapPrompt(arg('--print'))); return; }
  const wanted = arg('--ids') ? new Set(arg('--ids').split(',').map(s => s.trim())) : null;
  const ids = ORDER.filter(id => !wanted || wanted.has(id));
  const force = process.argv.includes('--force');
  mkdirSync(MASTER_DIR, { recursive: true });
  mkdirSync(LOG_DIR, { recursive: true });
  for (const id of ids) {
    const master = join(MASTER_DIR, `${id}-master.png`);
    if (existsSync(master) && !force) { console.log(`${id}: skip (exists)`); continue; }
    const refs = [...STYLE_REFS, ...(TRAPS.get(id)?.from ?? []).map(dep => join(MASTER_DIR, `${dep}-master.png`)).filter(existsSync)];
    const args = ['-y', PKG, 'exec', '-m', MODEL, '-c', `model_reasoning_effort="${EFFORT}"`, '-C', ROOT, '-s', 'workspace-write',
      '--skip-git-repo-check', ...refs.flatMap(r => ['-i', r]), '-o', join(LOG_DIR, `${id}.last.txt`), '-'];
    const started = Date.now();
    const log = openSync(join(LOG_DIR, `${id}.log`), 'w');
    const run = spawnSync('npx', args, { input: trapPrompt(id), stdio: ['pipe', log, log], cwd: ROOT });
    const secs = Math.round((Date.now() - started) / 1000);
    const ok = run.status === 0 && existsSync(master);
    console.log(`${id}: ${ok ? (isRgbaPng(master) ? 'ok RGBA' : 'NOT RGBA') : `FAILED exit=${run.status}`} ${secs}s`);
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
