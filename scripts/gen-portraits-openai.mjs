// ─── gen-portraits-openai.mjs ────────────────────────────────────────────────
// Batch-generate missing monster portraits via the OpenAI Images API (gpt-image-1),
// using the EXACT prompts from docs/monster-art-brief.md (single source of truth).
// Saves the raw 1024² PNGs to art-staging/; a separate one-line `sips` step then
// downscales them to the 256²·≤150KB JPEG spec into public/assets/monsters/.
// (Generation is kept shell-free here; the image-resize uses macOS `sips`.)
//
// SECURITY: the API key is read ONLY from the OPENAI_API_KEY environment variable.
// Never hardcode it, never paste it into chat. In your shell:
//     export OPENAI_API_KEY=sk-...
//
// USAGE:
//   node scripts/gen-portraits-openai.mjs                  # dry-run: list targets + cost, generate nothing
//   node scripts/gen-portraits-openai.mjs --only void_monarch    # generate 1 (sample test)
//   node scripts/gen-portraits-openai.mjs --limit 5             # first 5 missing
//   node scripts/gen-portraits-openai.mjs --all                 # ALL missing
//   flags: --quality low|medium|high (default medium) · --force (re-stage existing)
//
// THEN downscale + wire in (one block, copy-paste):
//   for f in art-staging/*.png; do id=$(basename "$f" .png); \
//     sips -Z 256 -s format jpeg -s formatOptions 80 "$f" --out "public/assets/monsters/$id.jpg"; done
//   rm -rf art-staging && npm run check:portraits && npm run gen:portraits
//
// Requires Node 18+ (global fetch).

import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BRIEF = join(ROOT, 'docs/monster-art-brief.md');
const ART_DIR = join(ROOT, 'public/assets/monsters');
const STAGING = join(ROOT, 'art-staging');

const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const val = (f) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : null; };
const onlyIds = (val('--only') ?? '').split(',').map(s => s.trim()).filter(Boolean);
const limit = val('--limit') ? parseInt(val('--limit'), 10) : null;
const quality = val('--quality') ?? 'medium';   // gpt-image-1: low | medium | high
const force = has('--force');
const all = has('--all');
const COST_USD = { low: 0.02, medium: 0.04, high: 0.07 };

// ── parse {id, prompt} pairs straight from the brief ──────────────────────────
if (!existsSync(BRIEF)) { console.error(`✗ ${BRIEF} 없음. 먼저 \`npm run gen:art-brief\`.`); process.exit(1); }
const md = readFileSync(BRIEF, 'utf8');
const all_pairs = [];
const re = /^####\s+`([a-z0-9_]+)\.jpg`[^\n]*\n```\n([\s\S]*?)\n```/gm;
let m;
while ((m = re.exec(md))) all_pairs.push({ id: m[1], prompt: m[2].trim() });

// ── select targets ────────────────────────────────────────────────────────────
let targets = all_pairs;
if (onlyIds.length) targets = targets.filter(t => onlyIds.includes(t.id));
if (!force) targets = targets.filter(t => !existsSync(join(ART_DIR, `${t.id}.jpg`)));
if (limit != null) targets = targets.slice(0, limit);

const wantGenerate = onlyIds.length > 0 || limit != null || all;

console.log(`\n브리프 파싱: ${all_pairs.length}종 · 이번 대상: ${targets.length}종${force ? ' (--force)' : ''}`);
console.log(`예상 비용: ~$${(targets.length * (COST_USD[quality] ?? 0.04)).toFixed(2)} (gpt-image-1 ${quality}, 대략치)`);

if (!wantGenerate) {
  console.log('\n[dry-run] 생성 안 함. --only <id> / --limit N / --all 중 하나를 주세요.');
  console.log('대상 일부:', targets.slice(0, 10).map(t => t.id).join(', ') + (targets.length > 10 ? ' …' : ''));
  process.exit(0);
}

const KEY = process.env.OPENAI_API_KEY;
if (!KEY) { console.error('\n✗ OPENAI_API_KEY 없음. 셸에서: export OPENAI_API_KEY=sk-...'); process.exit(1); }

mkdirSync(STAGING, { recursive: true });
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
let ok = 0, fail = 0;

for (const [i, t] of targets.entries()) {
  process.stdout.write(`[${i + 1}/${targets.length}] ${t.id} … `);
  try {
    const res = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'gpt-image-1', prompt: t.prompt, size: '1024x1024', quality, n: 1 }),
    });
    if (!res.ok) { console.log(`✗ API ${res.status}: ${(await res.text()).slice(0, 160)}`); fail++; await sleep(2000); continue; }
    const b64 = (await res.json())?.data?.[0]?.b64_json;
    if (!b64) { console.log('✗ b64 없음'); fail++; continue; }
    writeFileSync(join(STAGING, `${t.id}.png`), Buffer.from(b64, 'base64'));
    console.log('✓ staged');
    ok++;
    await sleep(800);
  } catch (e) { console.log(`✗ ${String(e.message || e).slice(0, 120)}`); fail++; await sleep(2000); }
}

console.log(`\n생성 완료(스테이징): ✓${ok}  ✗${fail}  → art-staging/`);
console.log('\n다음 한 블록 실행 (256²·JPEG 변환 + 배선):');
console.log('  for f in art-staging/*.png; do id=$(basename "$f" .png); \\');
console.log('    sips -Z 256 -s format jpeg -s formatOptions 80 "$f" --out "public/assets/monsters/$id.jpg"; done');
console.log('  rm -rf art-staging && npm run check:portraits && npm run gen:portraits');
