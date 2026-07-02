# 던전 수호자 — 몬스터 일러스트 제작 지시서 (GPT/Codex 실행용)

> 이 문서를 그대로 GPT Codex(또는 이미지 생성이 가능한 코딩 에이전트)에게 전달하세요.
> 사람 개입 없이 아래 절차를 그대로 따라가면 됩니다.

---

## 0. 프로젝트 컨텍스트

- 프로젝트: **던전 수호자** — 한국 전통 설화 기반 모바일 수집형 던전 디펜스 게임 (Phaser 3 + TypeScript)
- 저장소 루트: `/Users/sungjin/dev/personal/dungeon md/dungeon-phaser`
- 수집 몬스터 총 136종 중 **49종은 이미 일러스트 완료**, **87종이 미완**
- 이 지시서는 남은 87종의 일러스트를 생성해 정확한 경로/규격으로 저장하는 작업만 다룹니다.
- **게임 코드는 건드리지 않습니다.** 파일명 규칙만 정확히 지키면 게임이 자동으로 일러스트를 인식합니다(별도 코드 작업 불필요).

---

## 1. 입력 자료

- **프롬프트 원본**: `docs/monster-art-prompts-for-gpt.txt` (87개 블록, 몬스터 1종당 `파일명: {id}.jpg` 헤더 + 프롬프트 1개)
- **스타일 레퍼런스 이미지**(택1, 이미 완성된 기존 치비 일러스트):
  - `public/assets/monsters/dokkaebi_warrior.jpg`
  - `public/assets/monsters/gumiho_queen.jpg`
  - `public/assets/monsters/blue_dragon_archmage.jpg`

---

## 2. 출력 규격 (반드시 준수 — 하나라도 어기면 게임에서 깨짐)

| 항목 | 값 |
|---|---|
| 크기 | 정사각형 256×256px |
| 포맷 | JPEG |
| 용량 | **150KB 이하** |
| 저장 경로 | `public/assets/monsters/{id}.jpg` (하위 폴더 생성 금지) |
| 파일명 | 프롬프트 블록의 `파일명: {id}.jpg` 그대로, **정확히 일치**(오탈자·대소문자·언더스코어 변형 절대 금지 — 1글자만 달라도 게임이 인식 못 하고 조용히 실패함) |

생성 도구가 256×256을 직접 못 뽑으면, 아래 명령으로 다운스케일·압축하세요:
```bash
sips -s format jpeg -s formatOptions 82 -Z 256 원본파일.png --out "public/assets/monsters/{id}.jpg"
```
생성 후 반드시 `ls -la public/assets/monsters/{id}.jpg`로 150KB 이하인지 확인하세요.

---

## 3. 스타일 일관성 (매우 중요)

- 87종이 최종적으로 **하나의 세트처럼** 보여야 합니다.
- 이미지 생성 모델은 호출 간 스타일을 기억하지 않으므로, **매번 위 레퍼런스 이미지 1장을 함께 입력**하세요(가능한 도구라면 image-to-image / 참조 이미지 첨부 기능 사용).
- 참조 이미지 첨부가 안 되는 도구라면, 프롬프트 끝에 다음 문구를 덧붙이세요:
  > "기존 시리즈와 동일한 귀여운 치비/SD 아트 스타일, 동일한 굵은 외곽선·셀 셰이딩·2.5등신 비율·순수한 흰 배경을 유지할 것."

---

## 4. 실행 절차 (몬스터 1종당 반복)

1. 아래 §6 체크리스트에서 아직 `[ ]`(미완료)인 항목 하나를 선택한다.
2. `docs/monster-art-prompts-for-gpt.txt`에서 해당 `파일명:` 블록의 프롬프트를 그대로 복사한다.
3. §3의 레퍼런스 이미지 1장과 함께 이미지 생성을 요청한다.
4. 결과 이미지를 §2 규격(256×256 JPEG, ≤150KB)으로 저장한다 — 경로: `public/assets/monsters/{id}.jpg`.
5. §6 체크리스트에서 해당 항목을 `[x]`로 표시한다(중단 후 재개 시 진행 상황 추적용).
6. 다음 미완료 항목으로 이동해 반복한다.

한 세션에서 전부 끝내지 못해도 괜찮습니다 — 체크리스트가 진행 상황을 보존하므로, 다음 세션에서 `[ ]`인 항목부터 이어서 하면 됩니다.

---

## 5. 하지 말아야 할 것

- **이미 완료된 49종**(§0 참고, `docs/monster-art-brief.md` 하단 "이미 완료" 목록)의 기존 파일을 덮어쓰거나 수정하지 않는다.
- `src/**`, `scripts/**` 등 **코드 파일은 절대 수정하지 않는다** — 이미지 파일 생성만 수행한다.
- `npm run gen:portraits` 등 빌드/스크립트 명령을 실행하지 않는다 — 배선은 별도로 처리된다.
- `git add`/`git commit`을 실행하지 않는다.
- `public/assets/monsters/` 외 다른 경로에 저장하지 않는다.

---

## 6. 진행 체크리스트 (87종)

완료한 항목은 `[ ]`를 `[x]`로 바꿔 표시하세요.

- [ ] `storm_dokkaebi.jpg` — 🌪️ 폭풍 도깨비  ·  에픽 · 마법사 · 번개
- [ ] `gold_dokkaebi.jpg` — 💰 황금 도깨비  ·  에픽 · 지원/힐러 · 신성
- [ ] `fire_dokkaebi_king.jpg` — 🔥 불꽃 도깨비 왕  ·  에픽 · 근접 전사(탱커/돌격) · 화염
- [ ] `dokkaebi_captain.jpg` — 👹 도깨비 대장  ·  희귀 · 근접 전사(탱커/돌격) · 화염
- [ ] `dokkaebi_bomber.jpg` — 💣 도깨비 폭격수  ·  희귀 · 원거리 궁수 · 번개
- [ ] `dokkaebi_duelist.jpg` — ⚔️ 도깨비 쌍검사  ·  희귀 · 근접 전사(탱커/돌격) · 암흑
- [ ] `poison_dokkaebi.jpg` — ☠️ 독 도깨비  ·  희귀 · 근접 전사(탱커/돌격) · 암흑
- [ ] `shadow_dokkaebi.jpg` — 🌑 그림자 도깨비  ·  희귀 · 근접 전사(탱커/돌격) · 암흑
- [ ] `shield_dokkaebi.jpg` — 🛡️ 방패 도깨비  ·  희귀 · 근접 전사(탱커/돌격) · 신성
- [ ] `thunder_dokkaebi.jpg` — ⚡ 번개 도깨비  ·  고급 · 근접 전사(탱커/돌격) · 번개
- [ ] `ice_dokkaebi.jpg` — ❄️ 얼음 도깨비  ·  고급 · 근접 전사(탱커/돌격) · frost
- [ ] `healer_dokkaebi.jpg` — 💚 치유 도깨비  ·  고급 · 지원/힐러 · 신성
- [ ] `sea_god_complete.jpg` — 👑 해신 완성체  ·  전설 · 지원/힐러 · frost
- [ ] `kraken_soldier.jpg` — 🦑 크라켄 병사  ·  에픽 · 근접 전사(탱커/돌격) · 암흑
- [ ] `dragon_king_guardian.jpg` — 🐉 용왕 수호자  ·  에픽 · 근접 전사(탱커/돌격) · frost
- [ ] `tide_leviathan.jpg` — 🐳 심해 거수  ·  에픽 · 마법사 · frost
- [ ] `sea_general.jpg` — 🐡 용궁 장수  ·  희귀 · 근접 전사(탱커/돌격) · frost
- [ ] `sea_witch.jpg` — 🧜 바다 마녀  ·  희귀 · 마법사 · 암흑
- [ ] `shark_warrior.jpg` — 🦈 상어 전사  ·  희귀 · 근접 전사(탱커/돌격) · frost
- [ ] `sea_dragon_archer.jpg` — 🏹 해룡 궁수  ·  고급 · 원거리 궁수 · frost
- [ ] `jellyfish_sorcerer.jpg` — 🪼 해파리 술사  ·  고급 · 마법사 · frost
- [ ] `underworld_complete.jpg` — 🌟 저승 완성체  ·  전설 · 지원/힐러 · 암흑
- [ ] `hell_guard.jpg` — ⛩️ 저승 문지기  ·  에픽 · 근접 전사(탱커/돌격) · 암흑
- [ ] `yomra_warrior.jpg` — 👺 염라 전사  ·  에픽 · 근접 전사(탱커/돌격) · 암흑
- [ ] `ghost_king.jpg` — 👑 귀왕  ·  에픽 · 마법사 · 암흑
- [ ] `spirit_summoner.jpg` — 📿 망자 소환사  ·  에픽 · 마법사 · 암흑
- [ ] `soul_guardian.jpg` — 💀 영혼 수호자  ·  희귀 · 지원/힐러 · 신성
- [ ] `underworld_archer.jpg` — 🏹 저승 궁수  ·  희귀 · 원거리 궁수 · 암흑
- [ ] `underworld_witch.jpg` — 🧙 저승 마녀  ·  희귀 · 마법사 · 암흑
- [ ] `skeleton_knight.jpg` — 💀 해골 기사  ·  고급 · 근접 전사(탱커/돌격) · 암흑
- [ ] `moonlight_complete.jpg` — ✨ 달빛 완성체  ·  전설 · 지원/힐러 · 신성
- [ ] `galaxy_warrior.jpg` — 🌌 은하 무사  ·  에픽 · 근접 전사(탱커/돌격) · frost
- [ ] `full_moon_sorcerer.jpg` — 🌕 보름달 술사  ·  에픽 · 마법사 · 신성
- [ ] `solar_eclipse_warrior.jpg` — 🌑 일식 전사  ·  에픽 · 근접 전사(탱커/돌격) · 암흑
- [ ] `lunar_eclipse_mage.jpg` — 🌒 월식 마법사  ·  에픽 · 마법사 · 암흑
- [ ] `moonlight_rabbit.jpg` — 🐇 달빛 토끼  ·  희귀 · 지원/힐러 · 신성
- [ ] `starlight_fairy.jpg` — 🌟 별빛 선녀  ·  희귀 · 지원/힐러 · 신성
- [ ] `crescent_archer.jpg` — 🌙 초승달 궁수  ·  희귀 · 원거리 궁수 · 암흑
- [ ] `moonlight_tiger.jpg` — 🐯 달빛 호랑이  ·  희귀 · 근접 전사(탱커/돌격) · frost
- [ ] `banya_guardian.jpg` — 🔱 반야 수호자  ·  전설 · 근접 전사(탱커/돌격) · 화염
- [ ] `dragon_avatar.jpg` — 🐉 용의 화신  ·  전설 · 근접 전사(탱커/돌격) · 화염
- [ ] `five_dragon_complete.jpg` — 🌟 오룡 완성체  ·  전설 · 지원/힐러 · 신성
- [ ] `red_dragon_warrior.jpg` — 🔴 적룡 전사  ·  에픽 · 근접 전사(탱커/돌격) · 화염
- [ ] `blue_dragon_guardian.jpg` — 🔵 청룡 수호자  ·  에픽 · 근접 전사(탱커/돌격) · frost
- [ ] `gold_dragon_sage.jpg` — 🟡 황룡 현자  ·  에픽 · 지원/힐러 · 신성
- [ ] `black_dragon_assassin.jpg` — ⚫ 흑룡 암살자  ·  에픽 · 근접 전사(탱커/돌격) · 암흑
- [ ] `white_dragon_healer.jpg` — ⚪ 백룡 치유사  ·  에픽 · 지원/힐러 · 신성
- [ ] `twilight_dragon.jpg` — 🐲 황혼룡  ·  에픽 · 마법사 · 암흑
- [ ] `mask_complete.jpg` — 🌟 탈족 완성체  ·  전설 · 지원/힐러 · 신성
- [ ] `thunder_mask_warrior.jpg` — ⚡ 번개 마스크 전사  ·  에픽 · 근접 전사(탱커/돌격) · 번개
- [ ] `glacier_warrior.jpg` — ❄️ 빙하 무사  ·  에픽 · 근접 전사(탱커/돌격) · frost
- [ ] `great_mask_god.jpg` — 🎭 대탈 신  ·  에픽 · 지원/힐러 · 신성
- [ ] `bongsan_maskman.jpg` — 🎭 봉산 탈꾼  ·  희귀 · 근접 전사(탱커/돌격) · 신성
- [ ] `cheoyong_warrior.jpg` — 🎭 처용 전사  ·  희귀 · 근접 전사(탱커/돌격) · 화염
- [ ] `mask_wizard.jpg` — 🎭 탈 마법사  ·  희귀 · 마법사 · 암흑
- [ ] `mask_archer.jpg` — 🎭 탈 궁수  ·  고급 · 원거리 궁수 · 번개
- [ ] `eternal_colossus.jpg` — 🗿 영원의 거신  ·  전설 · 근접 전사(탱커/돌격) · 암흑
- [ ] `primordial_devourer.jpg` — 🌌 원초 포식자  ·  전설 · 마법사 · 암흑
- [ ] `void_harbinger.jpg` — 🏹 공허 전령  ·  에픽 · 원거리 궁수 · 암흑
- [ ] `primordial_shaman.jpg` — 🌀 원초 주술사  ·  에픽 · 마법사 · 번개
- [ ] `abyssal_warden.jpg` — 🛡️ 심연 수호자  ·  에픽 · 근접 전사(탱커/돌격) · 암흑
- [ ] `soul_devourer.jpg` — ☠️ 영혼 포식자  ·  에픽 · 근접 전사(탱커/돌격) · 암흑
- [ ] `abyssal_seer.jpg` — 👁️ 심연 예언자  ·  희귀 · 지원/힐러 · 암흑
- [ ] `chaos_reaver.jpg` — 🌋 혼돈 약탈자  ·  희귀 · 근접 전사(탱커/돌격) · 화염
- [ ] `void_monarch.jpg` — 👑 공허 군왕  ·  전설 · 근접 전사(탱커/돌격) · 암흑
- [ ] `oblivion_devourer.jpg` — 🌌 망각의 포식자  ·  전설 · 마법사 · 암흑
- [ ] `void_archon.jpg` — 🏹 공허 집정관  ·  에픽 · 원거리 궁수 · 암흑
- [ ] `null_sorcerer.jpg` — 🌀 무의 술사  ·  에픽 · 마법사 · 암흑
- [ ] `abyss_titan.jpg` — 🗿 심연 거신  ·  에픽 · 근접 전사(탱커/돌격) · 암흑
- [ ] `soul_reaver.jpg` — ☠️ 영혼 약탈자  ·  에픽 · 근접 전사(탱커/돌격) · 암흑
- [ ] `void_acolyte.jpg` — 🕯️ 공허 추종자  ·  희귀 · 지원/힐러 · 암흑
- [ ] `rift_stalker.jpg` — 🌑 균열 추적자  ·  희귀 · 근접 전사(탱커/돌격) · 암흑
- [ ] `ice_gumiho.jpg` — ❄️ 빙설 구미호  ·  희귀 · 마법사 · frost
- [ ] `thunder_gumiho.jpg` — ⚡ 번개 구미호  ·  희귀 · 마법사 · 번개
- [ ] `fox_warrior.jpg` — 🦊 여우 전사  ·  희귀 · 근접 전사(탱커/돌격) · 화염
- [ ] `three_tail_fox.jpg` — 🦊 꼬리 3개 여우  ·  고급 · 마법사 · 암흑
- [ ] `spring_gumiho.jpg` — 🌸 봄 구미호  ·  고급 · 지원/힐러 · 신성
- [ ] `summer_gumiho.jpg` — 🌊 여름 구미호  ·  고급 · 지원/힐러 · 신성
- [ ] `one_tail_fox.jpg` — 🦊 꼬리 1개 여우  ·  일반 · 마법사 · 암흑
- [ ] `mountain_spirit.jpg` — ⛩️ 산신령  ·  전설 · 지원/힐러 · 신성
- [ ] `mountain_god_complete.jpg` — 🌄 산신 완성체  ·  전설 · 지원/힐러 · 신성
- [ ] `phoenix.jpg` — 🦅 봉황  ·  에픽 · 마법사 · 화염
- [ ] `thousand_pine.jpg` — 🌲 천년 소나무  ·  에픽 · 지원/힐러 · 신성
- [ ] `bear_god.jpg` — 🐻 곰 산신  ·  희귀 · 근접 전사(탱커/돌격) · 신성
- [ ] `mountain_spirit_boy.jpg` — ⛩️ 산신 도령  ·  희귀 · 지원/힐러 · 신성
- [ ] `deer_god.jpg` — 🦌 사슴 신  ·  고급 · 지원/힐러 · 신성
- [ ] `empyrean_sovereign.jpg` — 🌌 천계 군주  ·  전설 · 마법사 · 신성

---

## 7. 완료 후 보고

모든 항목(또는 이번 세션에서 할 수 있는 만큼) 완료 후, 다음만 알려주면 됩니다:
- 새로 생성한 파일 개수와 id 목록
- (있다면) 규격을 못 맞춘 항목과 이유

이후 배선(`gen:portraits`)·렌더 검증·커밋은 별도로 진행합니다.
