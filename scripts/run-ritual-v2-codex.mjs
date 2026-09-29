#!/usr/bin/env node
/**
 * Generate ritual-v2 master PNGs by driving Codex's built-in image tool, one
 * character at a time. Codex only generates and saves; export, wiring,
 * verification and commits stay with the caller (CHARACTER_ART_CODEX_HANDOFF.md).
 *
 *   node scripts/run-ritual-v2-codex.mjs --ids a,b,c [--force]
 *
 * Env: CODEX_PKG (default @openai/codex@0.158.0 — the installed 0.152 cannot
 * reach gpt-6 models), CODEX_MODEL (gpt-6-luna), CODEX_EFFORT (max),
 * RITUAL_LOG_DIR (default: OS temp dir).
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, openSync, readFileSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promptForId, tribeOf } from './ritual-v2-prompts.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const MASTER_DIR = join(ROOT, 'output/character-art/ritual-v2');
const PKG = process.env.CODEX_PKG ?? '@openai/codex@0.158.0';
const MODEL = process.env.CODEX_MODEL ?? 'gpt-6-luna';
const EFFORT = process.env.CODEX_EFFORT ?? 'max';
const LOG_DIR = process.env.RITUAL_LOG_DIR ?? join(tmpdir(), 'ritual-v2-codex');
mkdirSync(LOG_DIR, { recursive: true });

const arg = name => { const i = process.argv.indexOf(name); return i >= 0 ? process.argv[i + 1] : null; };
const ids = (arg('--ids') ?? '').split(',').map(s => s.trim()).filter(Boolean);
const force = process.argv.includes('--force');
if (ids.length === 0) { console.error('usage: --ids a,b [--force]'); process.exit(1); }

/** Approved same-tribe master used as an extra style anchor, if any. */
const TRIBE_ANCHOR = {
  dokkaebi: 'dokkaebi_warrior', gumiho: 'gumiho_guardian', underworld: 'death_messenger',
  sansin: 'mountain_spirit', sea: 'gold_turtle',
};

function isRgbaPng(path) {
  const b = readFileSync(path);
  const sig = b.subarray(0, 8).toString('hex') === '89504e470d0a1a0a';
  return sig && b.readUInt32BE(16) > 0 && b[25] === 6; // IHDR colour type 6 = RGBA
}

const results = [];
for (const id of ids) {
  const master = join(MASTER_DIR, `${id}-master.png`);
  if (existsSync(master) && !force) { results.push([id, 'skip (exists)']); continue; }
  const refs = new Set([join(MASTER_DIR, 'dokkaebi_warrior-master.png')]);
  const anchor = TRIBE_ANCHOR[tribeOf(id)];
  if (anchor && anchor !== id) refs.add(join(MASTER_DIR, `${anchor}-master.png`));
  else refs.add(join(MASTER_DIR, 'gumiho_guardian-master.png'));
  const args = ['-y', PKG, 'exec', '-m', MODEL, '-c', `model_reasoning_effort="${EFFORT}"`,
    '-C', ROOT, '-s', 'workspace-write', '--skip-git-repo-check',
    ...[...refs].flatMap(r => ['-i', r]), '-o', join(LOG_DIR, `${id}.last.txt`), '-'];
  const started = Date.now();
  const log = openSync(join(LOG_DIR, `${id}.log`), 'w');
  const run = spawnSync('npx', args, { input: promptForId(id), stdio: ['pipe', log, log], cwd: ROOT });
  const secs = Math.round((Date.now() - started) / 1000);
  if (run.status !== 0 || !existsSync(master)) { results.push([id, `FAILED exit=${run.status} ${secs}s (log ${join(LOG_DIR, `${id}.log`)})`]); continue; }
  const ok = isRgbaPng(master);
  results.push([id, `${ok ? 'ok RGBA' : 'NOT RGBA'} ${Math.round(statSync(master).size / 1024)}KiB ${secs}s`]);
  console.log(`${id}: ${results.at(-1)[1]}`);
}
console.log('\n' + results.map(([id, r]) => `${id}\t${r}`).join('\n'));
