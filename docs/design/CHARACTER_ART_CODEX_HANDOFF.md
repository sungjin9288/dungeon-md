# 캐릭터 아트 ritual-v2 — Codex 실행 핸드오프

> 이 문서를 그대로 Codex에 전달한다. 이미지 생성 수단이 Codex에만 있으므로
> 마스터 PNG 생성은 Codex가 맡고, 배선·검증·커밋은 별도로 처리한다.

## 0. 왜 Codex인가 (판단 근거)

- Claude 측 세션에는 래스터 이미지 생성 도구가 없다. Canva `generate-design`은
  포스터/문서 템플릿, `design` 스킬은 HTML 아트보드, Figma는 Mermaid 다이어그램이다.
- 본 스펙은 **네이티브 알파 투명**을 요구한다. `scripts/export-character-art.mjs`
  첫 줄이 "Does not generate, repaint, segment, or remove backgrounds"로 못박고
  있어, 생성기가 배경 없는 컷아웃을 직접 내놔야 한다.
- Codex는 이 파이프라인에서 이미 검증됐다: 승인 9종의 master/runtime 해시와
  exporter 멱등 재실행 결과가 `tools/character-b1-assets.json`에 남아 있다.

## 1. 작업 범위

- 총 136종 중 **ritual-v2 완료 9종**, **남은 127종**이 대상이다.
- 완료 9종(건드리지 말 것): `dokkaebi_warrior`, `gumiho_guardian`,
  `death_messenger`, `mountain_spirit`, `village_archer`, `dokkaebi_junior`,
  `gold_turtle`, `fire_dokkaebi`, `sage`.
- 기존 136개 legacy JPG(`public/assets/monsters/*.jpg`)와 절차적 픽셀 폴백은
  **그대로 보존**한다. ritual-v2는 별도 versioned 경로에 추가되는 트랙이다.

## 2. 산출물 규격 (하나라도 어기면 exporter가 거부)

| 항목 | 값 |
| --- | --- |
| 마스터 경로 | `output/character-art/ritual-v2/{id}-master.png` |
| 캔버스 | 512×512 **RGBA** (PNG, colorType 6) |
| 용량 | 512 KiB 이하 (`MAX_RUNTIME_BYTES = 512 * 1024`) |
| 피사체 영역 | 428×428 이내 — 사방 **최소 42px 투명 여백** |
| 투명 비율 | 실측 승인분 기준 57.9–71.5% 완전 투명 |
| 내용 | 중앙 정렬 전신 1인, 배경·바닥 그림자·프레임·텍스트·UI·워터마크 **없음** |

파일명은 `{id}-master.png`로 정확히 일치해야 한다. exporter가 해당 이름으로만
마스터를 찾고, MonsterId 인벤토리에 없는 id는 `unknown character id`로 거부한다.

## 3. 아트 방향

`docs/design/CHARACTER_ART_REVISION.md`가 권위 문서이고,
`output/character-art/ritual-v2/PROMPTS.md`에 승인된 프롬프트가 있다.
**반드시 승인 9종을 스타일 앵커로 참조**해 한 세트로 보이게 유지한다.
한국 전통 설화 기반(도깨비·구미호·산신·해태 등), 한복/갓/노리개/단청/자개 등
한국 전통 의상·장식. 중국 황실 복식·중국 용·치파오, 일본 사무라이/기모노/오니는
배제한다.

## 4. 배치 단위와 실행 절차

부족 단위로 한 배치씩 닫는다. 배치마다:

1. 해당 부족 ID 목록을 확정한다(§6 표).
2. 마스터 PNG를 §2 규격으로 생성해 `output/character-art/ritual-v2/`에 둔다.
3. 런타임으로 내보낸다:

```bash
node scripts/export-character-art.mjs \
  --ids <id1>,<id2>,... \
  --master-dir output/character-art/ritual-v2
```

   exporter는 생성/리페인트/배경제거를 하지 않는 **기계적 복사**다. 규격 위반은
   여기서 throw된다. 동일 입력 재실행은 no-write(멱등)여야 한다.

4. 브라우저 수용 검증:

```bash
npm run dev   # 8083
GAME_URL=http://127.0.0.1:8083 node scripts/verify-character-art.mjs
```

5. 명령 검증: `npx tsc --noEmit`, `npx vitest run`, `npm run build`.

## 5. 금지

- 완료 9종 및 legacy 136 JPG 교체/삭제
- `src/**` 런타임 로직, balance/data/save schema, route 변경
- 배경 제거·리페인트·업스케일 등 마스터 후가공 (생성 단계에서 규격을 맞출 것)
- 선택한 배치 밖의 asset 교체
- commit/push/merge/cap sync/publishing
- 미추적 산출물 reset/clean

## 6. 대상 127종 — 부족별 체크리스트

완료한 항목은 `[ ]`를 `[x]`로 바꾼다.

### 도깨비족 (17종)

```
black_dragon_dokkaebi,dokkaebi_general,dokkaebi_god_king,dokkaebi_shaman,dokkaebi_king,storm_dokkaebi,gold_dokkaebi,fire_dokkaebi_king,dokkaebi_captain,dokkaebi_bomber,dokkaebi_duelist,poison_dokkaebi,shadow_dokkaebi,shield_dokkaebi,thunder_dokkaebi,ice_dokkaebi,healer_dokkaebi
```

- [ ] `black_dragon_dokkaebi` — 흑룡 도깨비 · 전설 · 근접 · dark
- [ ] `dokkaebi_general` — 도깨비 장군 · 전설 · 근접 · dark
- [ ] `dokkaebi_god_king` — 도깨비 신왕 · 전설 · 지원 · holy
- [ ] `dokkaebi_shaman` — 도깨비 주술사 · 에픽 · 마법 · dark
- [ ] `dokkaebi_king` — 도깨비 왕 · 에픽 · 근접 · fire
- [ ] `storm_dokkaebi` — 폭풍 도깨비 · 에픽 · 마법 · lightning
- [ ] `gold_dokkaebi` — 황금 도깨비 · 에픽 · 지원 · holy
- [ ] `fire_dokkaebi_king` — 불꽃 도깨비 왕 · 에픽 · 근접 · fire
- [ ] `dokkaebi_captain` — 도깨비 대장 · 희귀 · 근접 · fire
- [ ] `dokkaebi_bomber` — 도깨비 폭격수 · 희귀 · 원거리 · lightning
- [ ] `dokkaebi_duelist` — 도깨비 쌍검사 · 희귀 · 근접 · dark
- [ ] `poison_dokkaebi` — 독 도깨비 · 희귀 · 근접 · dark
- [ ] `shadow_dokkaebi` — 그림자 도깨비 · 희귀 · 근접 · dark
- [ ] `shield_dokkaebi` — 방패 도깨비 · 희귀 · 근접 · holy
- [ ] `thunder_dokkaebi` — 번개 도깨비 · 고급 · 근접 · lightning
- [ ] `ice_dokkaebi` — 얼음 도깨비 · 고급 · 근접 · frost
- [ ] `healer_dokkaebi` — 치유 도깨비 · 고급 · 지원 · holy

### 구미호족 (15종)

```
fox_spirit_elder,celestial_fairy,gumiho_demon,gumiho_queen,gumiho_goddess,gumiho_archmage,fox_shaman,five_tail_fox,ice_gumiho,thunder_gumiho,fox_warrior,three_tail_fox,spring_gumiho,summer_gumiho,one_tail_fox
```

- [ ] `fox_spirit_elder` — 구미호 장로 · 전설 · 마법 · dark
- [ ] `celestial_fairy` — 선녀 · 전설 · 지원 · holy
- [ ] `gumiho_demon` — 구미호 악신 · 전설 · 마법 · dark
- [ ] `gumiho_queen` — 구미호 여왕 · 에픽 · 마법 · dark
- [ ] `gumiho_goddess` — 구미호 여신 · 에픽 · 지원 · holy
- [ ] `gumiho_archmage` — 구미호 대마법사 · 에픽 · 마법 · dark
- [ ] `fox_shaman` — 여우 무당 · 희귀 · 마법 · dark
- [ ] `five_tail_fox` — 꼬리 5개 여우 · 희귀 · 마법 · dark
- [ ] `ice_gumiho` — 빙설 구미호 · 희귀 · 마법 · frost
- [ ] `thunder_gumiho` — 번개 구미호 · 희귀 · 마법 · lightning
- [ ] `fox_warrior` — 여우 전사 · 희귀 · 근접 · fire
- [ ] `three_tail_fox` — 꼬리 3개 여우 · 고급 · 마법 · dark
- [ ] `spring_gumiho` — 봄 구미호 · 고급 · 지원 · holy
- [ ] `summer_gumiho` — 여름 구미호 · 고급 · 지원 · holy
- [ ] `one_tail_fox` — 꼬리 1개 여우 · 일반 · 마법 · dark

### 해신족 (12종)

```
sea_dragon_lord,sea_god_complete,great_serpent,kraken_soldier,dragon_king_guardian,tide_leviathan,sea_god_spear,sea_general,sea_witch,shark_warrior,sea_dragon_archer,jellyfish_sorcerer
```

- [ ] `sea_dragon_lord` — 해룡왕 · 전설 · 원거리 · frost
- [ ] `sea_god_complete` — 해신 완성체 · 전설 · 지원 · frost
- [ ] `great_serpent` — 구렁이 · 에픽 · 근접 · dark
- [ ] `kraken_soldier` — 크라켄 병사 · 에픽 · 근접 · dark
- [ ] `dragon_king_guardian` — 용왕 수호자 · 에픽 · 근접 · frost
- [ ] `tide_leviathan` — 심해 거수 · 에픽 · 마법 · frost
- [ ] `sea_god_spear` — 해신 창병 · 희귀 · 원거리 · frost
- [ ] `sea_general` — 용궁 장수 · 희귀 · 근접 · frost
- [ ] `sea_witch` — 바다 마녀 · 희귀 · 마법 · dark
- [ ] `shark_warrior` — 상어 전사 · 희귀 · 근접 · frost
- [ ] `sea_dragon_archer` — 해룡 궁수 · 고급 · 원거리 · frost
- [ ] `jellyfish_sorcerer` — 해파리 술사 · 고급 · 마법 · frost

### 저승족 (12종)

```
underworld_complete,ghost_hunter,abyss_mage,hell_guard,yomra_warrior,ghost_king,spirit_summoner,venom_warrior,soul_guardian,underworld_archer,underworld_witch,skeleton_knight
```

- [ ] `underworld_complete` — 저승 완성체 · 전설 · 지원 · dark
- [ ] `ghost_hunter` — 귀신 포수 · 에픽 · 원거리 · dark
- [ ] `abyss_mage` — 심연 마법사 · 에픽 · 마법 · dark
- [ ] `hell_guard` — 저승 문지기 · 에픽 · 근접 · dark
- [ ] `yomra_warrior` — 염라 전사 · 에픽 · 근접 · dark
- [ ] `ghost_king` — 귀왕 · 에픽 · 마법 · dark
- [ ] `spirit_summoner` — 망자 소환사 · 에픽 · 마법 · dark
- [ ] `venom_warrior` — 독사 무사 · 희귀 · 근접 · dark
- [ ] `soul_guardian` — 영혼 수호자 · 희귀 · 지원 · holy
- [ ] `underworld_archer` — 저승 궁수 · 희귀 · 원거리 · dark
- [ ] `underworld_witch` — 저승 마녀 · 희귀 · 마법 · dark
- [ ] `skeleton_knight` — 해골 기사 · 고급 · 근접 · dark

### 달족 (12종)

```
moonlight_complete,celestial_dancer,three_legged_crow,storm_archer,galaxy_warrior,full_moon_sorcerer,solar_eclipse_warrior,lunar_eclipse_mage,moonlight_rabbit,starlight_fairy,crescent_archer,moonlight_tiger
```

- [ ] `moonlight_complete` — 달빛 완성체 · 전설 · 지원 · holy
- [ ] `celestial_dancer` — 천녀 무희 · 에픽 · 지원 · holy
- [ ] `three_legged_crow` — 삼족오 · 에픽 · 원거리 · holy
- [ ] `storm_archer` — 폭풍 궁수 · 에픽 · 원거리 · lightning
- [ ] `galaxy_warrior` — 은하 무사 · 에픽 · 근접 · frost
- [ ] `full_moon_sorcerer` — 보름달 술사 · 에픽 · 마법 · holy
- [ ] `solar_eclipse_warrior` — 일식 전사 · 에픽 · 근접 · dark
- [ ] `lunar_eclipse_mage` — 월식 마법사 · 에픽 · 마법 · dark
- [ ] `moonlight_rabbit` — 달빛 토끼 · 희귀 · 지원 · holy
- [ ] `starlight_fairy` — 별빛 선녀 · 희귀 · 지원 · holy
- [ ] `crescent_archer` — 초승달 궁수 · 희귀 · 원거리 · dark
- [ ] `moonlight_tiger` — 달빛 호랑이 · 희귀 · 근접 · frost

### 산신족 (11종)

```
mountain_god_complete,moon_rabbit_sage,volcanic_warrior,celestial_healer,phoenix,thousand_pine,frost_spirit,white_tiger,bear_god,mountain_spirit_boy,deer_god
```

- [ ] `mountain_god_complete` — 산신 완성체 · 전설 · 지원 · holy
- [ ] `moon_rabbit_sage` — 토끼 달인 · 에픽 · 지원 · holy
- [ ] `volcanic_warrior` — 화산 전사 · 에픽 · 근접 · fire
- [ ] `celestial_healer` — 천상 치유사 · 에픽 · 지원 · holy
- [ ] `phoenix` — 봉황 · 에픽 · 마법 · fire
- [ ] `thousand_pine` — 천년 소나무 · 에픽 · 지원 · holy
- [ ] `frost_spirit` — 빙결 산령 · 희귀 · 마법 · frost
- [ ] `white_tiger` — 백호 검사 · 희귀 · 근접 · lightning
- [ ] `bear_god` — 곰 산신 · 희귀 · 근접 · holy
- [ ] `mountain_spirit_boy` — 산신 도령 · 희귀 · 지원 · holy
- [ ] `deer_god` — 사슴 신 · 고급 · 지원 · holy

### 탈족 (11종)

```
mask_complete,mask_dancer,mask_berserker,thunder_mask_warrior,glacier_warrior,great_mask_god,iron_mask,bongsan_maskman,cheoyong_warrior,mask_wizard,mask_archer
```

- [ ] `mask_complete` — 탈족 완성체 · 전설 · 지원 · holy
- [ ] `mask_dancer` — 탈 춤꾼 · 에픽 · 근접 · fire
- [ ] `mask_berserker` — 탈 광전사 · 에픽 · 근접 · fire
- [ ] `thunder_mask_warrior` — 번개 마스크 전사 · 에픽 · 근접 · lightning
- [ ] `glacier_warrior` — 빙하 무사 · 에픽 · 근접 · frost
- [ ] `great_mask_god` — 대탈 신 · 에픽 · 지원 · holy
- [ ] `iron_mask` — 철갑 탈 · 희귀 · 근접 · dark
- [ ] `bongsan_maskman` — 봉산 탈꾼 · 희귀 · 근접 · holy
- [ ] `cheoyong_warrior` — 처용 전사 · 희귀 · 근접 · fire
- [ ] `mask_wizard` — 탈 마법사 · 희귀 · 마법 · dark
- [ ] `mask_archer` — 탈 궁수 · 고급 · 원거리 · lightning

### 용족 (11종)

```
mountain_god,blue_dragon_archmage,banya_guardian,dragon_avatar,five_dragon_complete,red_dragon_warrior,blue_dragon_guardian,gold_dragon_sage,black_dragon_assassin,white_dragon_healer,twilight_dragon
```

- [ ] `mountain_god` — 산신 · 전설 · 지원 · holy
- [ ] `blue_dragon_archmage` — 청룡 대마법사 · 전설 · 마법 · lightning
- [ ] `banya_guardian` — 반야 수호자 · 전설 · 근접 · fire
- [ ] `dragon_avatar` — 용의 화신 · 전설 · 근접 · fire
- [ ] `five_dragon_complete` — 오룡 완성체 · 전설 · 지원 · holy
- [ ] `red_dragon_warrior` — 적룡 전사 · 에픽 · 근접 · fire
- [ ] `blue_dragon_guardian` — 청룡 수호자 · 에픽 · 근접 · frost
- [ ] `gold_dragon_sage` — 황룡 현자 · 에픽 · 지원 · holy
- [ ] `black_dragon_assassin` — 흑룡 암살자 · 에픽 · 근접 · dark
- [ ] `white_dragon_healer` — 백룡 치유사 · 에픽 · 지원 · holy
- [ ] `twilight_dragon` — 황혼룡 · 에픽 · 마법 · dark

### 천상족 (9종)

```
god_realm_general,empyrean_sovereign,solar_warrior,divine_healer,starlight_knight,celestial_sage,celestial_guardian,sky_archer,heaven_mage
```

- [ ] `god_realm_general` — 신계 대장군 · 전설 · 근접 · holy
- [ ] `empyrean_sovereign` — 천계 군주 · 전설 · 마법 · holy
- [ ] `solar_warrior` — 태양 전사 · 에픽 · 근접 · fire
- [ ] `divine_healer` — 신성 치유자 · 에픽 · 지원 · holy
- [ ] `starlight_knight` — 별빛 기사 · 에픽 · 근접 · lightning
- [ ] `celestial_sage` — 천상 현인 · 에픽 · 마법 · holy
- [ ] `celestial_guardian` — 천상 수호자 · 희귀 · 근접 · holy
- [ ] `sky_archer` — 창공 궁수 · 희귀 · 원거리 · holy
- [ ] `heaven_mage` — 천계 마법사 · 희귀 · 마법 · lightning

### 원초족 (8종)

```
eternal_colossus,primordial_devourer,void_harbinger,primordial_shaman,abyssal_warden,soul_devourer,abyssal_seer,chaos_reaver
```

- [ ] `eternal_colossus` — 영원의 거신 · 전설 · 근접 · dark
- [ ] `primordial_devourer` — 원초 포식자 · 전설 · 마법 · dark
- [ ] `void_harbinger` — 공허 전령 · 에픽 · 원거리 · dark
- [ ] `primordial_shaman` — 원초 주술사 · 에픽 · 마법 · lightning
- [ ] `abyssal_warden` — 심연 수호자 · 에픽 · 근접 · dark
- [ ] `soul_devourer` — 영혼 포식자 · 에픽 · 근접 · dark
- [ ] `abyssal_seer` — 심연 예언자 · 희귀 · 지원 · dark
- [ ] `chaos_reaver` — 혼돈 약탈자 · 희귀 · 근접 · fire

### 공허족 (8종)

```
void_monarch,oblivion_devourer,void_archon,null_sorcerer,abyss_titan,soul_reaver,void_acolyte,rift_stalker
```

- [ ] `void_monarch` — 공허 군왕 · 전설 · 근접 · dark
- [ ] `oblivion_devourer` — 망각의 포식자 · 전설 · 마법 · dark
- [ ] `void_archon` — 공허 집정관 · 에픽 · 원거리 · dark
- [ ] `null_sorcerer` — 무의 술사 · 에픽 · 마법 · dark
- [ ] `abyss_titan` — 심연 거신 · 에픽 · 근접 · dark
- [ ] `soul_reaver` — 영혼 약탈자 · 에픽 · 근접 · dark
- [ ] `void_acolyte` — 공허 추종자 · 희귀 · 지원 · dark
- [ ] `rift_stalker` — 균열 추적자 · 희귀 · 근접 · dark

### 기타족 (1종)

```
thunder_hero
```

- [ ] `thunder_hero` — 벼락 용사 · 희귀 · 근접 · lightning

## 7. 완료 후 보고

- 이번 배치에서 생성한 id 목록과 각 런타임 바이트
- exporter 멱등 재실행 결과(no-write 여부)
- 규격을 못 맞춘 항목과 사유

배선 확인·회귀 검증·커밋은 별도로 진행한다.
