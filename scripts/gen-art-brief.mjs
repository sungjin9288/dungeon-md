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

// 부족별 한국 고유 시각 모티프 — 모델이 "동아시아=중국 황실"로 새는 걸 막는 핵심 앵커.
const TRIBE_MOTIF = {
  dokkaebi:   '한국 도깨비 — 머리에 뿔 1~2개, 가시 박힌 도깨비 방망이, 호피/누더기, 험상궂지만 익살스러운 한국 특유 인상(중국 귀신·일본 오니 아님)',
  gumiho:     '한국 구미호 — 여우 귀와 여러 개의 꼬리, 한복, 요염하고 신비로운 분위기',
  sansin:     '한국 산신령 — 백호랑이를 거느림, 도포와 갓·긴 흰 수염, 지팡이, 산속 신령의 기품',
  sea:        '한국 용왕/해신 — 자개·물고기 비늘·조개·산호 장식, 청록 물빛, 토속 용왕(중국 용 금지)',
  underworld: '한국 저승 존재 — 저승사자의 검은 갓과 도포, 창백한 기운, 한국 무속 결',
  mask:       '한국 전통 탈 — 하회탈/봉산탈 모티프, 탈춤 의상, 신명나는 익살',
  moonlight:  '한국 달 신령 — 옥토끼/달토끼, 한복, 은은한 달빛 청백',
  dragon:     '한국 이무기/용 — 여의주, 토속적 형태의 한국 용(중국 용과 명확히 다름)',
  celestial:  '한국 신선/선녀 — 도포와 너울, 단청 색, 구름 위 천상의 기품(중국 황제·도교 신선 아님)',
  primordial: '한국 창세 설화 결의 태초 신수/거신 — 원시 토템과 신화적 위압',
  void:       '공허·무(無)를 두른 한국적 어둠의 군주 — 먹빛과 청록 마법, 토속적이되 초월적',
};

// 아트 스타일: 귀여운 치비/SD 전신 + 흰 배경 (기존 42종과 통일 — 쿠키런 킹덤 결).
// 사용자 결정: 페인터리 반실사 흉상이 아니라 치비로 136종 통일.
const COMMON = '귀여운 치비/SD(super-deformed) 캐릭터 일러스트, 전신(머리 크고 몸 작은 약 2.5등신 비율), 순수한 흰 배경(단순 배경, 부드러운 그림자 약간), 쿠키런 킹덤 같은 모바일 수집형 게임 마스콧 캐릭터 아트톤, 맑고 산뜻하고 사랑스러운, 또렷한 굵은 외곽선과 깔끔한 셀 셰이딩, 큰 눈·귀엽고 매력적인 얼굴(플레이어가 소장하고 싶을 만큼), 한국 전통 설화·민화 기반의 한국 고유 요괴/신령(도깨비·구미호·산신·해태 등의 결), 한복·갓·노리개·단청 문양·자개·한국식 갑주 같은 한국 전통 의상/장식, 반드시 한국적 — 중국 황실 복식·중국 용·치파오·중국식 구름 소용돌이·일본 사무라이/기모노/오니 풍은 절대 배제, 고어·공포 없음, 텍스트·UI·워터마크 없음, 정사각 중앙 정렬 단일 캐릭터 포커스';

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
  const motif = m.tribe && TRIBE_MOTIF[m.tribe] ? ` 【한국 모티프: ${TRIBE_MOTIF[m.tribe]}】` : '';
  const elem  = m.element ? `${ELEMENT_KO[m.element] ?? m.element}속성 ` : '';
  const rar   = `${RARITY_KO[m.rarity] ?? m.rarity}등급`;
  const role  = TYPE_KO[m.type] ?? m.type;
  return `${COMMON}, "${m.name}" — ${tribe}${elem}${rar}, ${role} 컨셉이 드러나는 귀여운 전신 치비 포즈.${motif}`;
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
lines.push('1. 아래 프롬프트 **블록 하나씩** 복붙해 생성 (Claude design / GPT image) — 모델당 1프롬프트=1장. 고해상도 정사각 전신 치비로 생성.');
lines.push('2. **반드시 다운스케일·압축**: `256×256` JPEG, 품질 ~85%, **≤150KB** (기존 37종 실측 규격). 안 그러면 Phaser 3.90 로더 스톨 위험(BootScene 주석 참고). `sips -z 256 256 -s format jpeg in.png --out {id}.jpg` 활용 가능.');
lines.push('3. `public/assets/monsters/{id}.jpg` 로 저장 (파일명 = 각 항목의 `id`, **반드시 정확히** — 1글자 달라도 조용히 픽셀 폴백).');
lines.push('4. `npm run gen:portraits` 실행 → `PORTRAIT_IDS` 자동 갱신 → 부팅 시 자동 로드.');
lines.push('5. 코드 변경 불필요 — 코덱스/병영/소환이 `monster-ai-{id}` 텍스처를 자동 우선 사용.');
lines.push('');
lines.push(`> **일관성 팁**: ${missing.length}종이 "한 세트"로 보여야 함. 모델은 호출 간 스타일을 기억하지 않으니, 먼저 1~2종을 생성해 스타일 앵커로 확정한 뒤 이후 생성 때 그 결과(또는 기존 ${done.length}종 중 1장)를 레퍼런스 이미지로 첨부 권장.`);
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
