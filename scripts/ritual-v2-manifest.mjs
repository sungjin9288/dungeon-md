#!/usr/bin/env node
/**
 * Provenance for ritual-v2 masters without committing them. Masters are ~2 MB
 * 1254² PNGs straight from the image tool (only the first nine are tracked);
 * git keeps their sha256/size/dimensions here, the runtime PNGs are committed.
 *
 *   node scripts/ritual-v2-manifest.mjs   → tools/ritual-v2-masters.json
 */
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIR = join(ROOT, 'output/character-art/ritual-v2');
const masters = {};
for (const file of readdirSync(DIR).filter(f => f.endsWith('-master.png')).sort()) {
  const bytes = readFileSync(join(DIR, file));
  masters[file.replace(/-master\.png$/, '')] = {
    sha256: createHash('sha256').update(bytes).digest('hex'),
    bytes: bytes.length,
    width: bytes.readUInt32BE(16),
    height: bytes.readUInt32BE(20),
  };
}
writeFileSync(join(ROOT, 'tools/ritual-v2-masters.json'), `${JSON.stringify({ note: 'ritual-v2 master PNG provenance; masters live in output/character-art/ritual-v2 (not committed after the first nine)', count: Object.keys(masters).length, masters }, null, 2)}\n`);
console.log(`tools/ritual-v2-masters.json: ${Object.keys(masters).length} masters`);
