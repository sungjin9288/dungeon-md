# 함정 16종 · 상태이상 아이콘 6종 — Codex 아트 핸드오프

> `CHARACTER_ART_CODEX_HANDOFF.md`와 같은 계약으로 Codex에 전달한다. 이미지 생성은 Codex,
> 런타임 배선(로더·폴백)은 별도 슬라이스에서 처리한다. 2026-09-18 Phase 3 함정 데이터(`src/data/traps.ts`) 기준.

## 0. 현재 상태

- 함정과 상태이상은 아직 **이모지**로만 표시된다(배치 트레이 칩, 공방 '함정' 탭, 콤보/상태이상 표시 없음).
- 이 문서는 아이콘 22장의 규격·목록·스타일만 고정한다. 로더(`public/assets/traps/{id}.png` → 이모지 폴백)는
  아트가 도착한 뒤 `src/` 슬라이스로 배선한다. 그 전까지 `src/**`는 건드리지 않는다.

## 1. 산출물 규격

| 항목 | 값 |
| --- | --- |
| 경로 | `output/trap-art/v1/{id}-master.png` (Codex 산출) → 런타임 `public/assets/traps/{id}.png` (배선 슬라이스가 복사) |
| 캔버스 | 256×256 **RGBA** PNG, 피사체 216×216 이내(사방 20px 투명 여백) |
| 용량 | 128 KiB 이하 |
| 내용 | 아이콘 1개, 배경·프레임·텍스트·워터마크 없음, 정면/약간 위에서 본 시점 |
| 스타일 | 캐릭터 ritual-v2와 같은 결(치비/SD 채도, 두꺼운 외곽선 없음). 한국 전통 기물(대나무 죽창·짚·옹기·부적·놋쇠·자개) 소재. 중국·일본 기물 배제 |
| 티어 표현 | T1 단색 소재 / T2 두 소재 결합 + 은은한 발광 / T3 금속·보스 정수(보라 불꽃) 장식 |

## 2. 상태이상 아이콘 6종 (전투 중 침입자 머리 위 · 콤보 표시용, 64×64로도 읽혀야 함)

- [ ] `affliction_bleed` — 출혈 · 진입 시 즉시 피해
- [ ] `affliction_slow` — 둔화 · 이동속도 -40%, 2초
- [ ] `affliction_poison` — 중독 · 초당 피해, 4초
- [ ] `affliction_shock` — 감전 · 기절 1초
- [ ] `affliction_burn` — 화상 · 불꽃 중첩 피해, 3초
- [ ] `affliction_fear` — 공포 · 2초간 뒷걸음질

## 3. 함정 아이콘 16종

각 항목: id — 이름 · 티어 · 상태이상 · 레시피(소재 힌트). 상위 티어는 하위 두 함정의 시각 요소를 물려받아야 한다(융합이 보이게).


### T1

- [ ] `spike_trap` — 가시 덫 · T1 · 출혈 · 현재 이모지 🗡 · 레시피 `materials: { iron_shard: 2 }`
- [ ] `slow_trap` — 느림 덫 · T1 · 둔화 · 현재 이모지 🕸 · 레시피 `materials: { old_cloth: 3 }`
- [ ] `poison_trap` — 독 덫 · T1 · 중독 · 현재 이모지 ☠️ · 레시피 `materials: { herb: 3, old_cloth: 1 }`
- [ ] `stun_trap` — 감전 덫 · T1 · 감전 · 현재 이모지 ⚡ · 레시피 `materials: { magic_dust: 2, iron_shard: 1 }`
- [ ] `ember_trap` — 불씨 덫 · T1 · 화상 · 현재 이모지 🔥 · 레시피 `materials: { dok_fragment: 1, common_ore: 2 }`
- [ ] `fear_trap` — 공포 덫 · T1 · 공포 · 현재 이모지 👁 · 레시피 `materials: { soul_fragment: 1, shadow_cloth: 1 }`

### T2

- [ ] `thorn_wall` — 독가시 벽 · T2 · 출혈 + 중독 · 현재 이모지 🌵 · 레시피 `traps: ['spike_trap', 'poison_trap'], materials: { iron_shard: 3, herb: 3 }`
- [ ] `lightning_net` — 뇌전 그물 · T2 · 둔화 + 감전 · 현재 이모지 🕸 · 레시피 `traps: ['slow_trap', 'stun_trap'], materials: { magic_dust: 3, old_cloth: 2 }`
- [ ] `wildfire_pit` — 들불 구덩이 · T2 · 화상 + 출혈 · 현재 이모지 🔥 · 레시피 `traps: ['ember_trap', 'spike_trap'], materials: { dok_fragment: 2, iron_shard: 2 }`
- [ ] `dread_gas` — 공포 안개 · T2 · 중독 + 공포 · 현재 이모지 ☁️ · 레시피 `traps: ['poison_trap', 'fear_trap'], materials: { herb: 3, soul_fragment: 2 }`
- [ ] `ember_chain` — 불꽃 사슬 · T2 · 화상 + 감전 · 현재 이모지 ⛓ · 레시피 `traps: ['ember_trap', 'stun_trap'], materials: { dok_fragment: 2, magic_dust: 2 }`
- [ ] `quagmire` — 수렁 · T2 · 둔화 + 중독 · 현재 이모지 🐊 · 레시피 `traps: ['slow_trap', 'poison_trap'], materials: { old_cloth: 3, herb: 2 }`

### T3

- [ ] `hellmouth` — 지옥 아가리 · T3 · 화상 + 출혈 + 중독 · 현재 이모지 👹 · 레시피 `traps: ['wildfire_pit', 'thorn_wall'], materials: { boss_essence: 1, dok_fragment: 3 }`
- [ ] `storm_cage` — 폭풍 우리 · T3 · 둔화 + 감전 + 공포 · 현재 이모지 ⛈ · 레시피 `traps: ['lightning_net', 'dread_gas'], materials: { boss_essence: 1, magic_dust: 4 }`
- [ ] `plague_tide` — 역병 조수 · T3 · 중독 + 둔화 + 출혈 · 현재 이모지 🌊 · 레시피 `traps: ['quagmire', 'thorn_wall'], materials: { boss_essence: 1, herb: 5 }`
- [ ] `dokkaebi_fire` — 도깨비불 · T3 · 화상 + 공포 + 감전 · 현재 이모지 🎆 · 레시피 `traps: ['ember_chain', 'dread_gas'], materials: { boss_essence: 1, soul_fragment: 3 }`

## 4. 검증 (배선 슬라이스에서)

1. 22장 규격 검사 스크립트(캔버스·알파·용량) — `scripts/export-character-art.mjs`를 본떠 `scripts/export-trap-art.mjs`로 추가.
2. 배치 트레이·공방 함정 탭이 PNG를 쓰고 없으면 이모지 폴백 — 모달 하니스 `forge-trap-tab`·`home-placement` 케이스 통과.
3. `npx tsc --noEmit`, `npx vitest run`, `npm run build`.

## 5. 금지

- `src/**`·balance·save schema·route 변경(아트 배치 전까지)
- 캐릭터 아트 산출물(`output/character-art/**`) 접촉
- commit/push/merge/cap sync/publishing

