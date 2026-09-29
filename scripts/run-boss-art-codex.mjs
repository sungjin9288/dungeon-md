#!/usr/bin/env node
/**
 * Generate ritual-v2 BOSS masters (chapter villains: cinematic speakers, boss
 * intro, codex invader detail) through Codex's built-in image tool.
 *
 *   node scripts/run-boss-art-codex.mjs [--ids fox_queen,...] [--force] [--print id]
 *
 * Masters: output/character-art/ritual-v2/bosses/{invaderType}-master.png
 * Subjects: scripts/boss-art-subjects.json. Export + register:
 *   node scripts/register-ritual-v2.mjs --bosses --ids ...
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, openSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const STYLE_DIR = join(ROOT, 'output/character-art/ritual-v2');
const MASTER_DIR = join(STYLE_DIR, 'bosses');
export const BOSS_SUBJECTS = JSON.parse(readFileSync(join(ROOT, 'scripts/boss-art-subjects.json'), 'utf8'));
const PKG = process.env.CODEX_PKG ?? '@openai/codex@0.158.0';
const MODEL = process.env.CODEX_MODEL ?? 'gpt-6-luna';
const EFFORT = process.env.CODEX_EFFORT ?? 'max';
const LOG_DIR = process.env.RITUAL_LOG_DIR ?? join(tmpdir(), 'boss-art-codex');
/** Approved masters used as style references only. */
const STYLE_REFS = ['dokkaebi_warrior', 'gumiho_queen', 'dokkaebi_king'];

export function bossPrompt(type) {
  const subject = BOSS_SUBJECTS[type];
  if (!subject) throw new Error(`no subject for boss ${type} in scripts/boss-art-subjects.json`);
  return `You are only an image generator for this task. Do NOT edit, create or delete any file other than the single output PNG named below. Do not run git. Do not change code.

Task: use your built-in image generation tool to create ONE image, then save the generated PNG unchanged (no resizing, no background removal, no repainting) to exactly this path, relative to the current directory:
  output/character-art/ritual-v2/bosses/${type}-master.png

The attached images are STYLE REFERENCES ONLY (approved characters of the same game): match their painterly gouache rendering, matte materials, deliberate silhouettes, collectible proportions and color discipline. Do not copy their bodies, props or costumes.

Image prompt:
Use case: stylized-concept. Asset type: one production full-body transparent BOSS character cutout for the SAME Korean folklore dungeon-defense collection game as the references — a chapter villain who invades the player's dungeon, shown in story dialogue and boss intros at 120 to 260 pixels tall.
Subject: ${subject}.
Boss presence: slightly taller collectible proportions than the guardians (about 3 to 3.5 heads), a commanding stance and one unmistakable signature prop; the finest authored craft of the set, majestic, never cluttered or glowing everywhere.
Style: original hand-painted stylized 2D gouache game illustration matching the references, broad matte brush planes, selective dry-brush texture, slightly irregular dark contour, readable face, soft ivory key light with a restrained cold rim light. Threatening but family-friendly, not horror or gore. Color discipline: charcoal and ink-indigo shadows, the villain's own accent color used deliberately, aged brass accents. Not anime cel-shaded human, not glossy 3D toy, not photorealistic. No Chinese imperial costume or Chinese dragon, no Japanese kimono/samurai/oni motifs, no named-game copying.
Composition: square, one centered character, full body and every prop fully visible, occupies about 80 percent of the canvas with at least 8 percent empty margin on every side, front three-quarter view facing slightly left, silhouette readable at thumbnail size. Genuinely TRANSPARENT background with alpha. No environment, floor, cast shadow, white square, gradient backdrop, smoke background, text, letters, labels, UI, frame, badge, logo or watermark. Preserve clean transparency around fine edges.

When done, reply with only: the saved path, the image pixel size, and whether the PNG has an alpha channel.
`;
}

function main() {
  const arg = name => { const i = process.argv.indexOf(name); return i >= 0 ? process.argv[i + 1] : null; };
  if (arg('--print')) { process.stdout.write(bossPrompt(arg('--print'))); return; }
  const wanted = arg('--ids') ? arg('--ids').split(',').map(s => s.trim()) : Object.keys(BOSS_SUBJECTS);
  const force = process.argv.includes('--force');
  mkdirSync(MASTER_DIR, { recursive: true });
  mkdirSync(LOG_DIR, { recursive: true });
  const refs = STYLE_REFS.map(id => join(STYLE_DIR, `${id}-master.png`)).filter(existsSync);
  for (const type of wanted) {
    const master = join(MASTER_DIR, `${type}-master.png`);
    if (existsSync(master) && !force) { console.log(`${type}: skip (exists)`); continue; }
    const args = ['-y', PKG, 'exec', '-m', MODEL, '-c', `model_reasoning_effort="${EFFORT}"`, '-C', ROOT, '-s', 'workspace-write',
      '--skip-git-repo-check', ...refs.flatMap(r => ['-i', r]), '-o', join(LOG_DIR, `${type}.last.txt`), '-'];
    const started = Date.now();
    const log = openSync(join(LOG_DIR, `${type}.log`), 'w');
    const run = spawnSync('npx', args, { input: bossPrompt(type), stdio: ['pipe', log, log], cwd: ROOT });
    const ok = run.status === 0 && existsSync(master);
    const b = ok ? readFileSync(master) : null;
    console.log(`${type}: ${ok ? (b[25] === 6 ? 'ok RGBA' : 'NOT RGBA') : `FAILED exit=${run.status}`} ${Math.round((Date.now() - started) / 1000)}s`);
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
