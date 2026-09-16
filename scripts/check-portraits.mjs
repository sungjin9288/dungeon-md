// ─── check-portraits.mjs ─────────────────────────────────────────────────────
// Validates the dropped-in monster portraits BEFORE they ship, catching the two
// silent footguns the art workflow is prone to:
//   1) filename typo — a jpg whose id is not a real MonsterId loads as an unused
//      'monster-ai-{typo}' texture, and the intended monster silently keeps its
//      pixel fallback. ("왜 안 바뀌지?")
//   2) wrong file encoding — a PNG renamed to .jpg is not a real JPEG
//   3) wrong dimensions — portraits must stay at the 256x256 runtime contract
//   4) oversized file — portraits > ~150KB risk the Phaser 3.90 loader stall
//      (see BootScene). Properly downscaled 256² JPEGs land well under this.
//
// Run:  npm run check:portraits        (report-only; exits 1 if problems found)
// Pairs with: npm run gen:art-brief (what to make) / gen:portraits (wire them in).

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ART_DIR = join(ROOT, 'public/assets/monsters');
const TARGET_SIZE = 256;
const MAX_BYTES = 150 * 1024;

const SOF_MARKERS = new Set([
  0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7,
  0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf,
]);

function readJpegDimensions(buffer) {
  if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) return null;

  let offset = 2;
  let dimensions = null;
  let sawScan = false;
  while (offset < buffer.length) {
    if (buffer[offset] !== 0xff) return null;
    while (buffer[offset] === 0xff) offset++;
    if (offset >= buffer.length) return null;
    const marker = buffer[offset++];
    if (marker === 0xd9) return sawScan ? dimensions : null;
    if (marker === 0x00 || marker === 0xd8) return null;
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    if (offset + 2 > buffer.length) return null;

    const segmentLength = buffer.readUInt16BE(offset);
    if (segmentLength < 2 || offset + segmentLength > buffer.length) return null;
    if (SOF_MARKERS.has(marker)) {
      if (segmentLength < 8) return null;
      const components = buffer[offset + 7];
      if (components === 0 || segmentLength !== 8 + components * 3) return null;
      dimensions = {
        width: buffer.readUInt16BE(offset + 5),
        height: buffer.readUInt16BE(offset + 3),
      };
      if (buffer[offset + 2] === 0 || dimensions.width === 0 || dimensions.height === 0) return null;
    }
    if (marker === 0xda) {
      if (!dimensions || segmentLength < 6) return null;
      const components = buffer[offset + 2];
      if (components === 0 || segmentLength !== 6 + components * 2) return null;
    }
    offset += segmentLength;
    if (marker === 0xda) {
      sawScan = true;
      // Skip entropy bytes, escaped FF and restart markers, then parse the
      // next segment (including additional progressive scans) through EOI.
      while (offset < buffer.length) {
        if (buffer[offset] !== 0xff) { offset++; continue; }
        const next = buffer[offset + 1];
        if (next === 0x00 || (next >= 0xd0 && next <= 0xd7)) { offset += 2; continue; }
        break;
      }
    }
  }
  return null;
}

// Authoritative monster id set (excludes skins/non-monsters).
const VALID_IDS = (() => {
  const t = readFileSync(join(ROOT, 'src/data/monstersTypes.ts'), 'utf8');
  const m = t.match(/export type MonsterId\s*=\s*([\s\S]*?);/);
  return new Set(m ? [...m[1].matchAll(/'([a-z0-9_]+)'/g)].map(x => x[1]) : []);
})();

const assetFiles = readdirSync(ART_DIR);
const jpgs = assetFiles.filter(f => f.endsWith('.jpg'));
const nonCanonicalJpegs = assetFiles.filter(f => /\.jpg$/i.test(f) && !f.endsWith('.jpg'));
const orphans = [];     // filename not a MonsterId (typo or skin)
const invalidJpegs = []; // .jpg extension without a decodable JPEG header
const wrongDimensions = [];
const oversized = [];   // > MAX_BYTES

for (const f of jpgs) {
  const id = f.replace(/\.jpg$/, '');
  const portraitPath = join(ART_DIR, f);
  const bytes = statSync(portraitPath).size;
  if (!VALID_IDS.has(id)) orphans.push(f);
  if (bytes > MAX_BYTES) {
    oversized.push({ f, kb: Math.round(bytes / 1024) });
    continue;
  }
  const dimensions = readJpegDimensions(readFileSync(portraitPath));
  if (!dimensions) invalidJpegs.push(f);
  if (dimensions && (dimensions.width !== TARGET_SIZE || dimensions.height !== TARGET_SIZE)) {
    wrongDimensions.push({ f, ...dimensions });
  }
}

const covered = new Set(jpgs.map(f => f.replace(/\.jpg$/, '')).filter(id => VALID_IDS.has(id)));
const missing = [...VALID_IDS].filter(id => !covered.has(id));

const C = { red: s => `\x1b[31m${s}\x1b[0m`, yellow: s => `\x1b[33m${s}\x1b[0m`, green: s => `\x1b[32m${s}\x1b[0m`, dim: s => `\x1b[2m${s}\x1b[0m` };

console.log(`\n포트레이트 검사 — public/assets/monsters/`);
console.log(`  몬스터 총 ${VALID_IDS.size}종 · 일러스트 ${covered.size}종 · ${C.dim(`미완 ${missing.length}종`)}`);

let problems = 0;
if (missing.length) {
  problems += missing.length;
  console.log(C.red(`\n✗ 누락된 몬스터 포트레이트 ${missing.length}개:`));
  missing.forEach(id => console.log(`    ${id}.jpg`));
  console.log(C.dim('    → 누락 파일을 추가한 뒤 npm run gen:portraits 를 실행하세요.'));
}
if (nonCanonicalJpegs.length) {
  problems += nonCanonicalJpegs.length;
  console.log(C.red(`\n✗ 소문자 .jpg 확장자가 아닌 파일 ${nonCanonicalJpegs.length}개:`));
  nonCanonicalJpegs.forEach(f => console.log(`    ${f}`));
  console.log(C.dim('    → case-sensitive 배포 환경을 위해 확장자를 정확히 .jpg로 고치세요.'));
}
if (orphans.length) {
  problems += orphans.length;
  console.log(C.red(`\n✗ MonsterId 아닌 파일 ${orphans.length}개 (오타? 스킨? — 몬스터 포트레이트로 안 쓰임):`));
  orphans.forEach(f => console.log(`    ${f}`));
  console.log(C.dim('    → 파일명을 정확한 monster id로 고치세요 (docs/monster-art-brief.md 참고).'));
}
if (invalidJpegs.length) {
  problems += invalidJpegs.length;
  console.log(C.red(`\n✗ 실제 JPEG가 아닌 .jpg 파일 ${invalidJpegs.length}개:`));
  invalidJpegs.forEach(f => console.log(`    ${f}`));
  console.log(C.dim('    → 실제 JPEG로 변환하세요: sips -s format jpeg <file> --out <file>.'));
}
if (wrongDimensions.length) {
  problems += wrongDimensions.length;
  console.log(C.red(`\n✗ 256x256가 아닌 파일 ${wrongDimensions.length}개:`));
  wrongDimensions.forEach(({ f, width, height }) => console.log(`    ${f}  (${width}x${height})`));
  console.log(C.dim('    → sips -z 256 256 <file> 등으로 정확히 256x256으로 맞추세요.'));
}
if (oversized.length) {
  problems += oversized.length;
  console.log(C.red(`\n✗ 150KB 초과 ${oversized.length}개 (Phaser 로더 스톨 위험):`));
  oversized.forEach(({ f, kb }) => console.log(`    ${f}  (${kb}KB)`));
  console.log(C.dim('    → sips -Z 256 -s formatOptions 80 <file> 등으로 256²·≤150KB로 압축.'));
}

if (problems === 0) {
  console.log(C.green(`\n✓ 문제 없음. ${VALID_IDS.size}종 portrait asset contract 충족.`));
  process.exit(0);
} else {
  console.log(C.yellow(`\n${problems}건 정리 후 다시 실행하세요. (gen:portraits 전 권장)`));
  process.exit(1);
}
