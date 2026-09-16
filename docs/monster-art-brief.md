# 던전 수호자 — 몬스터 일러스트 작업 브리프 (자동 생성)

> `node scripts/gen-art-brief.mjs`로 재생성. 몬스터/에셋 변경 시 다시 실행.
> Legacy JPG inventory only. 새 캐릭터 아트 개정은 `docs/design/CHARACTER_ART_REVISION.md`를 따른다.
> 아래 흰 배경 제작 규칙/완료 수는 새 ritual-v2 아트의 제작·검증 상태가 아니다. 기존 JPG를 일괄 덮어쓰지 않는다.

- 수집 몬스터 총: **136종**
- 일러스트 완료(JPG 있음): **136종**
- **일러스트 필요(픽셀 폴백 중): 0종**

## 워크플로 (이미지 생성 → 반영)
1. 누락 목록이 있을 때만 아래 프롬프트 **블록 하나씩** 복붙해 생성 (Claude design / GPT image) — 모델당 1프롬프트=1장. 고해상도 정사각 전신 치비로 생성.
2. **반드시 다운스케일·압축**: runtime contract는 정확히 `256×256` JPEG, **≤150KB**. 안 그러면 Phaser loader stall 위험(BootScene 주석 참고). `sips -z 256 256 -s format jpeg in.png --out {id}.jpg` 활용 가능.
3. `public/assets/monsters/{id}.jpg` 로 저장 (파일명 = 각 항목의 `id`, **반드시 정확히** — 1글자 달라도 조용히 픽셀 폴백).
4. `npm run gen:portraits` 실행 → `PORTRAIT_IDS` 자동 갱신 → 부팅 시 자동 로드.
5. 수동 코드 변경은 불필요 — 코덱스/병영/소환이 `monster-ai-{id}` 텍스처를 자동 우선 사용.

> **현재 상태**: 누락 portrait가 없으므로 추가 생성 작업은 필요하지 않음.

## Legacy JPG 아트 디렉션 (과거 배치 보존)
> 귀여운 치비/SD(super-deformed) 캐릭터 일러스트, 전신(머리 크고 몸 작은 약 2.5등신 비율), 순수한 흰 배경(단순 배경, 부드러운 그림자 약간), 쿠키런 킹덤 같은 모바일 수집형 게임 마스콧 캐릭터 아트톤, 맑고 산뜻하고 사랑스러운, 또렷한 굵은 외곽선과 깔끔한 셀 셰이딩, 큰 눈·귀엽고 매력적인 얼굴(플레이어가 소장하고 싶을 만큼), 한국 전통 설화·민화 기반의 한국 고유 요괴/신령(도깨비·구미호·산신·해태 등의 결), 한복·갓·노리개·단청 문양·자개·한국식 갑주 같은 한국 전통 의상/장식, 반드시 한국적 — 중국 황실 복식·중국 용·치파오·중국식 구름 소용돌이·일본 사무라이/기모노/오니 풍은 절대 배제, 고어·공포 없음, 텍스트·UI·워터마크 없음, 정사각 중앙 정렬 단일 캐릭터 포커스

---

## 일러스트 필요 목록 (0종) — 부족별

현재 누락 항목이 없습니다.

---

## ✅ 이미 완료 (136종)

`abyss_mage`, `abyss_titan`, `abyssal_seer`, `abyssal_warden`, `banya_guardian`, `bear_god`, `black_dragon_assassin`, `black_dragon_dokkaebi`, `blue_dragon_archmage`, `blue_dragon_guardian`, `bongsan_maskman`, `celestial_dancer`, `celestial_fairy`, `celestial_guardian`, `celestial_healer`, `celestial_sage`, `chaos_reaver`, `cheoyong_warrior`, `crescent_archer`, `death_messenger`, `deer_god`, `divine_healer`, `dokkaebi_bomber`, `dokkaebi_captain`, `dokkaebi_duelist`, `dokkaebi_general`, `dokkaebi_god_king`, `dokkaebi_junior`, `dokkaebi_king`, `dokkaebi_shaman`, `dokkaebi_warrior`, `dragon_avatar`, `dragon_king_guardian`, `empyrean_sovereign`, `eternal_colossus`, `fire_dokkaebi_king`, `fire_dokkaebi`, `five_dragon_complete`, `five_tail_fox`, `fox_shaman`, `fox_spirit_elder`, `fox_warrior`, `frost_spirit`, `full_moon_sorcerer`, `galaxy_warrior`, `ghost_hunter`, `ghost_king`, `glacier_warrior`, `god_realm_general`, `gold_dokkaebi`, `gold_dragon_sage`, `gold_turtle`, `great_mask_god`, `great_serpent`, `gumiho_archmage`, `gumiho_demon`, `gumiho_goddess`, `gumiho_guardian`, `gumiho_queen`, `healer_dokkaebi`, `heaven_mage`, `hell_guard`, `ice_dokkaebi`, `ice_gumiho`, `iron_mask`, `jellyfish_sorcerer`, `kraken_soldier`, `lunar_eclipse_mage`, `mask_archer`, `mask_berserker`, `mask_complete`, `mask_dancer`, `mask_wizard`, `moon_rabbit_sage`, `moonlight_complete`, `moonlight_rabbit`, `moonlight_tiger`, `mountain_god_complete`, `mountain_god`, `mountain_spirit_boy`, `mountain_spirit`, `null_sorcerer`, `oblivion_devourer`, `one_tail_fox`, `phoenix`, `poison_dokkaebi`, `primordial_devourer`, `primordial_shaman`, `red_dragon_warrior`, `rift_stalker`, `sage`, `sea_dragon_archer`, `sea_dragon_lord`, `sea_general`, `sea_god_complete`, `sea_god_spear`, `sea_witch`, `shadow_dokkaebi`, `shark_warrior`, `shield_dokkaebi`, `skeleton_knight`, `sky_archer`, `solar_eclipse_warrior`, `solar_warrior`, `soul_devourer`, `soul_guardian`, `soul_reaver`, `spirit_summoner`, `spring_gumiho`, `starlight_fairy`, `starlight_knight`, `storm_archer`, `storm_dokkaebi`, `summer_gumiho`, `thousand_pine`, `three_legged_crow`, `three_tail_fox`, `thunder_dokkaebi`, `thunder_gumiho`, `thunder_hero`, `thunder_mask_warrior`, `tide_leviathan`, `twilight_dragon`, `underworld_archer`, `underworld_complete`, `underworld_witch`, `venom_warrior`, `village_archer`, `void_acolyte`, `void_archon`, `void_harbinger`, `void_monarch`, `volcanic_warrior`, `white_dragon_healer`, `white_tiger`, `yomra_warrior`
