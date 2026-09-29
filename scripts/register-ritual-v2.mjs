#!/usr/bin/env node
/**
 * After a ritual-v2 batch is reviewed: export runtime PNGs (512 RGBA, no
 * repaint) and append the ids to RITUAL_V2_IDS in src/data/characterArt.ts.
 *
 *   node scripts/register-ritual-v2.mjs --ids a,b,c
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

const missing = ids.filter(id => !existsSync(join(ROOT, `output/character-art/ritual-v2/${id}-master.png`)));
if (missing.length) { console.error(`no master PNG for: ${missing.join(', ')}`); process.exit(1); }

const run = spawnSync('node', ['scripts/export-character-art.mjs', '--ids', ids.join(','), '--master-dir', 'output/character-art/ritual-v2'], { cwd: ROOT, stdio: 'inherit' });
if (run.status !== 0) process.exit(run.status ?? 1);

let src = readFileSync(REGISTRY, 'utf8');
const m = src.match(/const RITUAL_V2_IDS = \[\n([\s\S]*?)\] as const/);
if (!m) { console.error('RITUAL_V2_IDS block not found'); process.exit(1); }
const present = new Set([...m[1].matchAll(/'([a-z0-9_]+)'/g)].map(x => x[1]));
const added = ids.filter(id => !present.has(id));
src = src.replace(m[0], `const RITUAL_V2_IDS = [\n${m[1]}${added.map(id => `  '${id}',\n`).join('')}] as const`);
writeFileSync(REGISTRY, src);
console.log(`registered ${added.length}: ${added.join(', ') || '(none new)'}`);
