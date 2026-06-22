// ─── gen-art-brief.mjs ───────────────────────────────────────────────────────
// Generates docs/monster-art-brief.md — the work-list of collectible monsters
// that still lack an AI-illustration portrait (public/assets/monsters/{id}.jpg),
// each with a ready-to-paste image-generation prompt (Claude design / GPT image).
//
// Run:  node scripts/gen-art-brief.mjs   (or `npm run gen:art-brief` if wired)
//
// It parses MONSTER_DEFS out of src/data/monstersData*.ts (no TS runtime needed),
// diffs against the JPGs on disk, and writes the brief. Re-run after adding art
// or new monsters. Pairs with `npm run gen:portraits` (which wires the JPGs in).

import { readFileSync, readdirSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DATA_DIR = join(ROOT, 'src/data');
const ART_DIR  = join(ROOT, 'public/assets/monsters');
const OUT      = join(ROOT, 'docs/monster-art-brief.md');

// ── Korean display maps ──────────────────────────────────────────────────────
const TRIBE_KO = {
  dokkaebi: '도깨비', gumiho: '구미호', sansin: '산신', sea: '해신',
  underworld: '저승', mask: '탈', moonlight: '달', dragon: '용',
  celestial: '천상', primordial: '원초', void: '공허',
};
const ELEMENT_KO = {
  fire: '화염', water: '물', earth: '대지', wind: '바람', lightning: '번개',
  ice: '얼음', poison: '독', void: '공허', holy: '신성', dark: '암흑', light: '빛',
};
const RARITY_KO = { C: '일반', U: '고급', R: '희귀', E: '에픽', L: '전설' };
const RARITY_ORDER = { C: 0, U: 1, R: 2, E: 3, L: 4 };
const TYPE_KO = {
  melee: '근접 전사(탱커/돌격)', ranged: '원거리 궁수', magic: '마법사', support: '지원/힐러',
};

const COMMON = '한국 설화 기반 다크 던전 판타지, 페인터리 일러스트(픽셀아트 아님), 따뜻한 횃불 조명 + 깊은 그림자, 모바일 경영/수집 게임 품질(쿠키런 킹덤·AFK 저니 톤), 응집된 팔레트(먹색 베이스 + 황금/주황 토치 + 보라/청록 마법광), 한 세트로 보이는 일관성, 텍스트·UI 없음, 512×512 정사각 중앙 정렬 흉상';

// ── Parse monster defs ───────────────────────────────────────────────────────
function field(block, key) {
  const m = block.match(new RegExp(`\\b${key}:\\s*'([^']+)'`));
  return m ? m[1] : null;
}

// Authoritative monster id set — excludes skin defs (dok_warrior_gold, …) that
// also carry id+name in the data files but are NOT collectible monsters and do
// NOT use the monster-ai portrait slot.
const VALID_IDS = (() => {
  const t = readFileSync(join(DATA_DIR, 'monstersTypes.ts'), 'utf8');
  const m = t.match(/export type MonsterId\s*=\s*([\s\S]*?);/);
  return new Set(m ? [...m[1].matchAll(/'([a-z0-9_]+)'/g)].map(x => x[1]) : []);
})();

const monsters = [];
const seen = new Set();
for (const file of readdirSync(DATA_DIR)) {
  if (!/^monstersData.*\.ts$/.test(file) || file.includes('.test.')) continue;
  const src = readFileSync(join(DATA_DIR, file), 'utf8');
  // each def is a brace block (no nested braces inside a def) containing id: '...'
  for (const m of src.matchAll(/\{[^{}]*\bid:\s*'([^']+)'[^{}]*\}/g)) {
    const block = m[0];
    const id = m[1];
    if (seen.has(id)) continue;
    if (!VALID_IDS.has(id)) continue; // skip skin defs / non-monsters
    const name = field(block, 'name');
    if (!name) continue;              // skip non-monster objects
    seen.add(id);
    monsters.push({
      id, name,
      emoji:   field(block, 'emoji') ?? '',
      type:    field(block, 'type') ?? 'melee',
      tribe:   field(block, 'tribe'),
      element: field(block, 'element') ?? '',
      rarity:  field(block, 'rarityTier') ?? 'C',
    });
  }
}

// ── Diff against art on disk ─────────────────────────────────────────────────
const haveArt = new Set(
  (existsSync(ART_DIR) ? readdirSync(ART_DIR) : [])
    .filter(f => f.endsWith('.jpg'))
    .map(f => f.replace(/\.jpg$/, '')),
);
const missing = monsters.filter(m => !haveArt.has(m.id));
const done    = monsters.filter(m => haveArt.has(m.id));

// ── Build prompt per monster ─────────────────────────────────────────────────
function promptFor(m) {
  const tribe = m.tribe ? `${TRIBE_KO[m.tribe] ?? m.tribe}족 ` : '';
  const elem  = m.element ? `${ELEMENT_KO[m.element] ?? m.element}속성 ` : '';
  const rar   = `${RARITY_KO[m.rarity] ?? m.rarity}등급`;
  const role  = TYPE_KO[m.type] ?? m.type;
  return `${COMMON}, "${m.name}" — ${tribe}${elem}${rar}, ${role} 역할이 드러나는 포즈의 정면 흉상 초상.`;
}

// ── Emit markdown ────────────────────────────────────────────────────────────
const byTribe = {};
for (const m of missing) (byTribe[m.tribe ?? '기타'] ??= []).push(m);
for (const list of Object.values(byTribe)) list.sort((a, b) => (RARITY_ORDER[b.rarity] ?? 0) - (RARITY_ORDER[a.rarity] ?? 0));

const lines = [];
lines.push('# 던전 수호자 — 몬스터 일러스트 작업 브리프 (자동 생성)');
lines.push('');
lines.push('> `node scripts/gen-art-brief.mjs`로 재생성. 몬스터/에셋 변경 시 다시 실행.');
lines.push('');
lines.push(`- 수집 몬스터 총: **${monsters.length}종**`);
lines.push(`- 일러스트 완료(JPG 있음): **${done.length}종**`);
lines.push(`- **일러스트 필요(픽셀 폴백 중): ${missing.length}종**`);
lines.push('');
lines.push('## 워크플로 (이미지 생성 → 반영)');
lines.push('1. 아래 프롬프트로 이미지 생성 (Claude design / GPT image), **512×512 정사각 흉상**.');
lines.push('2. `public/assets/monsters/{id}.jpg` 로 저장 (파일명 = 표의 `id`, **반드시 정확히**).');
lines.push('3. `npm run gen:portraits` 실행 → `PORTRAIT_IDS` 자동 갱신 → 부팅 시 자동 로드.');
lines.push('4. 코드 변경 불필요 — 코덱스/병영/소환이 `monster-ai-{id}` 텍스처를 자동 우선 사용.');
lines.push('');
lines.push('## 공통 아트 디렉션');
lines.push(`> ${COMMON}`);
lines.push('');
lines.push('---');
lines.push('');
lines.push(`## 일러스트 필요 목록 (${missing.length}종) — 부족별`);

const tribeKeys = Object.keys(byTribe).sort((a, b) => byTribe[b].length - byTribe[a].length);
for (const tk of tribeKeys) {
  const list = byTribe[tk];
  const label = TRIBE_KO[tk] ? `${TRIBE_KO[tk]}족` : tk;
  lines.push('');
  lines.push(`### ${label} (${list.length}종)`);
  for (const m of list) {
    lines.push('');
    lines.push(`#### \`${m.id}.jpg\` — ${m.emoji} ${m.name}  ·  ${RARITY_KO[m.rarity] ?? m.rarity} · ${TYPE_KO[m.type] ?? m.type}${m.element ? ' · ' + (ELEMENT_KO[m.element] ?? m.element) : ''}`);
    lines.push('```');
    lines.push(promptFor(m));
    lines.push('```');
  }
}

lines.push('');
lines.push('---');
lines.push('');
lines.push(`## ✅ 이미 완료 (${done.length}종)`);
lines.push('');
lines.push(done.map(m => `\`${m.id}\``).sort().join(', '));
lines.push('');

if (!existsSync(dirname(OUT))) mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, lines.join('\n'));
console.log(`[art-brief] ${monsters.length} monsters | ${done.length} done | ${missing.length} missing → ${OUT.replace(ROOT + '/', '')}`);
