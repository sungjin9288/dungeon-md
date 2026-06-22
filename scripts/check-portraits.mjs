// ─── check-portraits.mjs ─────────────────────────────────────────────────────
// Validates the dropped-in monster portraits BEFORE they ship, catching the two
// silent footguns the art workflow is prone to:
//   1) filename typo — a jpg whose id is not a real MonsterId loads as an unused
//      'monster-ai-{typo}' texture, and the intended monster silently keeps its
//      pixel fallback. ("왜 안 바뀌지?")
//   2) oversized file — portraits > ~150KB risk the Phaser 3.90 loader stall
//      (see BootScene). Properly downscaled 256² JPEGs land well under this.
//
// Run:  npm run check:portraits        (report-only; exits 1 if problems found)
// Pairs with: npm run gen:art-brief (what to make) / gen:portraits (wire them in).

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ART_DIR = join(ROOT, 'public/assets/monsters');
const MAX_BYTES = 150 * 1024;   // 150KB — matches the existing 37-portrait ceiling

// Authoritative monster id set (excludes skins/non-monsters).
const VALID_IDS = (() => {
  const t = readFileSync(join(ROOT, 'src/data/monstersTypes.ts'), 'utf8');
  const m = t.match(/export type MonsterId\s*=\s*([\s\S]*?);/);
  return new Set(m ? [...m[1].matchAll(/'([a-z0-9_]+)'/g)].map(x => x[1]) : []);
})();

const jpgs = readdirSync(ART_DIR).filter(f => f.toLowerCase().endsWith('.jpg'));
const orphans = [];     // filename not a MonsterId (typo or skin)
const oversized = [];   // > MAX_BYTES
const ok = [];

for (const f of jpgs) {
  const id = f.replace(/\.jpg$/i, '');
  const bytes = statSync(join(ART_DIR, f)).size;
  if (!VALID_IDS.has(id)) orphans.push(f);
  if (bytes > MAX_BYTES) oversized.push({ f, kb: Math.round(bytes / 1024) });
  if (VALID_IDS.has(id) && bytes <= MAX_BYTES) ok.push(id);
}

const covered = new Set(jpgs.map(f => f.replace(/\.jpg$/i, '')).filter(id => VALID_IDS.has(id)));
const missing = [...VALID_IDS].filter(id => !covered.has(id));

const C = { red: s => `\x1b[31m${s}\x1b[0m`, yellow: s => `\x1b[33m${s}\x1b[0m`, green: s => `\x1b[32m${s}\x1b[0m`, dim: s => `\x1b[2m${s}\x1b[0m` };

console.log(`\n포트레이트 검사 — public/assets/monsters/`);
console.log(`  몬스터 총 ${VALID_IDS.size}종 · 일러스트 ${covered.size}종 · ${C.dim(`미완 ${missing.length}종`)}`);

let problems = 0;
if (orphans.length) {
  problems += orphans.length;
  console.log(C.red(`\n✗ MonsterId 아닌 파일 ${orphans.length}개 (오타? 스킨? — 몬스터 포트레이트로 안 쓰임):`));
  orphans.forEach(f => console.log(`    ${f}`));
  console.log(C.dim('    → 파일명을 정확한 monster id로 고치세요 (docs/monster-art-brief.md 참고).'));
}
if (oversized.length) {
  problems += oversized.length;
  console.log(C.red(`\n✗ 150KB 초과 ${oversized.length}개 (Phaser 로더 스톨 위험):`));
  oversized.forEach(({ f, kb }) => console.log(`    ${f}  (${kb}KB)`));
  console.log(C.dim('    → sips -Z 256 -s formatOptions 80 <file> 등으로 256²·≤150KB로 압축.'));
}

if (problems === 0) {
  console.log(C.green(`\n✓ 문제 없음. (다음: npm run gen:portraits 로 배선)`));
  process.exit(0);
} else {
  console.log(C.yellow(`\n${problems}건 정리 후 다시 실행하세요. (gen:portraits 전 권장)`));
  process.exit(1);
}
