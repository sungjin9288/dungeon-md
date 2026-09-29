#!/usr/bin/env node
/**
 * After a ritual-v2 batch is reviewed: export runtime WebP (512 RGBA, no
 * repaint) and append the ids to RITUAL_V2_IDS in src/data/characterArt.ts.
 * With --skins the ids are skin ids: export-skin-art.mjs + SKIN_ART_IDS.
 *
 *   node scripts/register-ritual-v2.mjs --ids a,b,c
 *   node scripts/register-ritual-v2.mjs --skins --ids gumiho_frost
 *
 * Tests/typecheck/commit stay with the caller.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const REGISTRY = join(ROOT, 'src/data/characterArt.ts');
const i = process.argv.indexOf('--ids');
const ids = (i >= 0 ? process.argv[i + 1] : '').split(',').map(s => s.trim()).filter(Boolean);
if (ids.length === 0) { console.error('usage: --ids a,b'); process.exit(1); }

const skins = process.argv.includes('--skins');
const masterDir = skins ? 'output/character-art/ritual-v2/skins' : 'output/character-art/ritual-v2';
const missing = ids.filter(id => !existsSync(join(ROOT, masterDir, `${id}-master.png`)));
if (missing.length) { console.error(`no master PNG for: ${missing.join(', ')}`); process.exit(1); }

const exportArgs = skins
  ? ['scripts/export-skin-art.mjs', '--ids', ids.join(',')]
  : ['scripts/export-character-art.mjs', '--ids', ids.join(','), '--master-dir', masterDir];
const run = spawnSync('node', exportArgs, { cwd: ROOT, stdio: 'inherit' });
if (run.status !== 0) process.exit(run.status ?? 1);

const block = skins
  ? { re: /const SKIN_ART_IDS: readonly string\[\] = \[\n([\s\S]*?)\];/, open: 'const SKIN_ART_IDS: readonly string[] = [', close: '];' }
  : { re: /const RITUAL_V2_IDS = \[\n([\s\S]*?)\] as const/, open: 'const RITUAL_V2_IDS = [', close: '] as const' };
let src = readFileSync(REGISTRY, 'utf8');
const m = src.match(block.re);
if (!m) { console.error(`${block.open} block not found`); process.exit(1); }
const present = new Set([...m[1].matchAll(/'([a-z0-9_]+)'/g)].map(x => x[1]));
const added = ids.filter(id => !present.has(id));
src = src.replace(m[0], `${block.open}\n${m[1]}${added.map(id => `  '${id}',\n`).join('')}${block.close}`);
writeFileSync(REGISTRY, src);
console.log(`registered ${added.length}${skins ? ' skin(s)' : ''}: ${added.join(', ') || '(none new)'}`);
