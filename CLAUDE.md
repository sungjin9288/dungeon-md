# 던전 수호자 — CLAUDE.md

Phaser 3 + TypeScript + Vite + Capacitor 모바일 게임.
Canvas 390×844 (iPhone 기준), FIT 스케일 모드.

---

## 실행

```bash
npm run dev        # 개발 서버 :8083
npm run build      # dist/ 생성
LANG=en_US.UTF-8 npx cap sync   # dist/ → android/ + ios/ 동기화 (CocoaPods가 UTF-8 로케일 요구)
```

dev 서버 전용 QA 파라미터 (프로덕션 빌드에선 제거됨):
- `?scene=SummonScene` — 부팅 후 해당 씬으로 바로 점프 (스크린샷/QA용)
- `?skipTutorial=1` — 튜토리얼 완료 상태로 시드

---

## 디렉토리 구조

```
src/
  main.ts              # Phaser.Game 초기화, 씬 등록, iOS 오디오 언락
  scenes/              # Phaser 씬 (16개)
  data/                # 게임 데이터 + 상태 관리
  audio/               # AudioManager (Tone.js 기반)
  art/                 # 절차적 픽셀아트 생성기
  combat/              # MonsterSwap, SkillHUD, SynergyManager
  ui/                  # 재사용 UI 컴포넌트
  constants/           # colors, layout, safeArea
  utils/               # logger
```

---

## 씬 목록 & 흐름

```
BootScene → DungeonHomeScene
  (컷씬은 부팅이 아니라 스테이지 진입 시 STAGE_CINEMATICS 기준으로 재생)

DungeonHomeScene          홈 허브. 퀘스트·침략 확인, 설정 오버레이, 세이브 관리
  → StageSelectScene      챕터별 스테이지 선택 (80개, 8챕터)
  → PreBattleScene        덱 편성 → DungeonScene
  → SummonScene           소환 (일반/특수/영혼/우정)
  → ShopScene             상점
  → BarracksScene         병영 (몬스터 육성·장비·각성·스킨)
  → FusionScene           합성
  → ForgeScene            제작
  → AncestralWisdomScene  지혜의 나무 (메타 업그레이드)
  → CodexScene            도감
  → AchievementScene      업적

DungeonScene              실전 배틀 (786줄, 전투 로직은 src/combat/ 분산)
  + UIScene               배틀 HUD 오버레이 (scene.launch로 병행)

CinematicScene            컷씬 (cinematics.ts 데이터 기반)
EndlessResultScene        엔드리스 결과
```

---

## 핵심 데이터 레이어

### `src/data/wisdom.ts` — 영속 상태
- **`GameState`** — localStorage 키 `dungeonGameState`
- **`loadGameState()`** — 불러오기 + 마이그레이션 (dungeonSlots 포맷, stageProgress 패딩)
- **`saveGameState()`** — 저장
- **`importGameState()`** — Base64 세이브 복원 (동일 마이그레이션 적용)
- **`StageProgressEntry`** — `{ unlocked, bestStars, bestHpPercent? }` (StageSelectScene과 공유)
- **`WisdomBonuses`** — 지혜의 나무 보너스 계산
- **`getUnlockedSlots(dmLevel)`** — DM레벨 → 방 슬롯 수

### `src/scenes/StageSelectScene.ts`
- **`STAGE_CONFIGS[80]`** — stageNumber 1–80, slots, chapter, bossWave (Ch1–Ch8)
- **`loadProgress() / saveProgress() / recordClear()`** — localStorage 키 `dungeonStageProgress`
- `StageProgress` = `StageProgressEntry` (wisdom.ts 타입 재사용)

### `src/data/quests.ts`
- `completeAndAdvance()` — 퀘스트 완료·보상·다음 퀘스트 시작
- `startQuest()` — activeMainQuestId 설정

### `src/audio/AudioManager.ts`
- Tone.js 기반 절차적 BGM + SFX
- `AudioSettings` — bgmVolume/sfxVolume/bgmEnabled/sfxEnabled (localStorage 키 `dungeonAudioSettings`)
- API: `setBgmVolume()`, `setSfxVolume()`, `setBgmEnabled()`, `setSfxEnabled()`, `playSfx(SfxId)`

---

## 게임 시스템 계약 (배틀 · 홈 · 메타)

각 절이 그 시스템의 단일 진실원이다. 배틀은 `DungeonScene.ts` + `src/combat/`,
홈·메타는 `src/data/*Transactions.ts`(순수) → 씬 순서로 배선한다.

### 씬 시작
```typescript
// registry에서 설정 읽기
const stageConfig = this.registry.get('stageConfig');
const hasInlineWaves = !stageConfig?.stageNumber; // true → 침략 배틀
const returnTo = this.registry.get('returnTo');   // 'DungeonHomeScene' → 침략 귀환
```

### 홈 던전 단일화 (2026-09-17, 옵션 B)

**전투 그리드 = 홈 슬롯.** 전투 중 건설·업그레이드·몬스터 배치는 없다.
`DungeonLayout.deployDungeonSlotsToGrid`가 `GameState.dungeonSlots`(가족·건물·
레벨·HP·몬스터·함정)를 그대로 시드하고, 빈 칸은 지을 수 없다. 전투 중 남는
행위는 액티브 스킬·몬스터 자리 교체(스왑)·긴급 수리뿐이다.

- 전투 골드 = **전리품**. 0에서 시작해 처치·웨이브 보상으로만 쌓이고, 소비처는
  긴급 수리뿐. 정산 시 남은 전리품이 `homeGold`로 귀속(`applyBattleReturnSettlement`).
  `StageConfig.startGold`는 존재하지 않는다.
- 슬롯 수의 단일 진실원은 `getUnlockedSlotCount(state)`(DM 레벨 + 지혜 `선조의
  지혜`, 9 캡). 홈 보드·전투 그리드·추천·직렬화 전부 이 함수를 쓴다. 스테이지
  설정에 슬롯 수를 넣지 말 것.
- 방 레벨 상한 `MAX_ROOM_LEVEL = 5`(wisdom.ts). 전투 피해는 `1.4^(lv-1)`이며
  방의 첫 몬스터에만 적용, 나머지 몬스터는 기본 피해(`runExtraMonsterAttacks`).
  몬스터가 없는 방도 `ROOM_DEFS`의 자체 공격으로 싸운다. **수호자 육성**은
  `guardianAtkMult(level, spentSkills)`(barracks.ts, `1.03^(lv-1)` × 강타 1.15)로
  전투(`guardianAtkMult` 맵, 첫/추가 몬스터 모두)와 `simulation.ts`에 같이 들어간다
  (2026-09-18, P3 첫 배선). `simulation.ts`는 이 넷을 그대로 모델링하므로 예측과
  실전이 같은 레버를 본다.
- 홈 방 = **가족 4종**(combat/trap/support/magic, 용량 보너스·픽셀 픽스처·추천)
  **× 건물 12종**(`ROOM_DEFS`, 실제로 싸우는 방). `DungeonSlot.building`이 없으면
  가족 기본 건물(`FAMILY_DEFAULT_ROOM`). 챕터 방은 도달한 챕터부터 해금
  (`roomBuildings.ts`). 첫 설계 시 `roomsBuilt`에 건물이 기록된다.
- 밸런스 가드 `campaignPacing.test.ts`: 스타터(시작 보드 방 3개·스타터 3체)가
  스테이지 1을, lean(퀘스트 0·클리어 XP/전리품만)이 1~80을, expected(메인 퀘스트
  진행)가 1~80을 여유 1.3×로, veteran(강한 로스터)이 Ch9를 클리어해야 한다.
  시뮬은 사거리/행 커버리지는 보지만 방의 단일 표적 처리량은 못 보므로 초반
  절대 난이도는 `scripts/verify-campaign-pacing.mjs`(실전 organic 주행)가 진실원.
  **organic 결과는 확률적이다** — 스폰 순서·패시브 발동·웨이브 사건이 매번 구른다.
  한계 스테이지(특히 20 lean, 26% HP 승으로 기록된 뒤 반복 패배)는 1회 주행으로
  판정하지 말 것. `PACING_REPEATS=n`으로 반복해 승률과 HP% 분포를 본다.

### 침입 예보 · 명성 (2026-09-18, Phase 2)

홈의 하루 결정 = **오늘의 손님 카드 3장**(`forecast.ts`, 날짜·명성 티어로 시드된
결정적 발급). 1번 = 일반 침입(현재 티어), 2번 = 정예(60%)/한 단계 위 일반, 3번 =
특수(상인·순례자·보물·일일 규칙) — 월요일은 주간 보스. 카드 전투는 스토리 침입과
같은 인라인 경로(`stageConfig{waves,dungeonHp}` + `returnTo` + `forecastCardId`)로
DungeonScene에 들어가고, 귀환 시 `HomeLifecycle.checkBattleReturn`이
`settleForecastBattle`로 정산한 뒤 `'forecast-return'` 계약대로 레지스트리를 비운다.
일일 규칙·주간 보스 카드는 `dailyMode/weeklyBossMode`를 세팅해 **전투 씬이 규칙과
보상을 소유**하고, 카드는 명성만 더한다(이중 지급 없음).

- **명성**(`notoriety.ts`): 포인트는 승리·최초 클리어로 쌓이고, **티어는 플레이어가
  '간판 올리기'로 승인**해야 오른다(자동 승격 없음). 밴드 10단계가 침입자 38종을
  `hp×speed/640` 임계로 누적 배치(무한 전용·소환 전용 제외). 패배 −10%, 7일
  유예 후 일 −5%(티어 유지), 주간 정산 tier×30 보석.
- 하루 시작은 `beginHomeForecastDay`(홈 `create()`의 `checkBattleReturn` 직후).
- 가드: `notorietyBands.test.ts` — 티어 n 편성을 기준 스테이지의 기대 홈이 막는지
  (9~10티어는 veteran). organic: `scripts/verify-forecast-playthrough.mjs`.
- 홈 `DailyContentPanel`은 도전 과제·출석만 남는다(일일 던전·주간 보스 진입은 카드로).

### 함정 제작 · 콤보 (2026-09-18, Phase 3)

함정은 골드 소모품이 아니라 **제작 자산**이다. `traps.ts`: 상태이상 6종(출혈·둔화·
중독·감전·화상·공포) × 함정 16종 — 1티어 6종(단일 상태이상, 트레이에서 골드로 즉시
설치), 2티어 6종(1티어 둘 융합), 3티어 4종(2티어 둘 + `boss_essence`). 제작·융합·
숙련은 공방 **'함정' 탭**(`ForgeTrapTab` ← `trapForgeView.ts` 투영 ←
`trapTransactions.ts`)에서 하고 결과는 `GameState.trapStock`(타입별 재고)에 쌓인다.
2·3티어 설치는 재고에서만(`installTrapInRoomSlot`, 골드 0), 해제·교체 시 재고로
복귀. 재고 없는 칩을 탭하면 `forgeTab` 레지스트리로 공방 함정 탭에 딥링크한다
(`forge-entry`가 소비).

- 숙련 `trapMastery[id]` 0~5, 효과 +15%/lv(`trapMasteryMult`), 비용 = 레시피 재료
  ×(1+lv). 전투에는 `DungeonScene.trapMastery` → `RoomMechanicsContext.trapMastery`
  로 들어가 `applyTrapToInvader` 배율에 곱한다.
- 콤보: 침입자가 2초 창 안에 받은 **상이한 상태이상 수**(`Invader.comboCount`)로
  수호자 피해 `1 + 0.25×(n−1)`, 최대 4종(`comboMultiplier`). `CombatResolver`(첫
  몬스터)·`runExtraMonsterAttacks`(나머지) 양쪽에 적용. 플레이어가 배울 수 있도록
  **단계가 오를 때만** 침입자 위에 `콤보 ×N` 플로트를 띄운다
  (`shouldAnnounceCombo` + `Invader.noteComboAnnounce`, 매 타격 스팸 방지).
- 시뮬은 `trapEffectiveDps`(상태이상 simDps 합 × 숙련)로 함정 가치를 본다. 콤보는
  시뮬에 없다(보수적).
- 가드: `traps.test.ts`(티어 구조·레시피 상속·콤보/숙련 수식), `trapTransactions.test.ts`,
  `trapForgeView.test.ts`, 추천 재고 인식(`roomLoadoutRecommendations.test.ts`). 모달
  하니스 `forge-trap-tab`/`forge-trap-fuse-result`.

### 운영 수익 · 몬스터 근무 (2026-09-18, Phase 3 / P1 ③④)

**운영수익 = (방 수익 + 보물고) × 명성 배수 × 장식 세트 배수** (`idleIncome.ts
computeIdleReward`). 명성 배수 `1 + 0.15×(티어−1)`(`notorietyIncomeMult`)는 골드에만
곱하고 재료에는 곱하지 않는다. 방치 상한 12h, 명성 티어 5부터 24h(`idleCapHours`) —
UI 문구는 상수가 아니라 이 함수를 쓴다. 홈에 지은 `황금 광맥`은 **수익 방**
(`IDLE_PER_GOLD_ROOM` 12/분)이며 전투 중 골드 생산은 없다(`runGoldVeins` 삭제 —
전투 골드는 전리품뿐).

**근무**(`productionTransactions.ts assignFacilityStaff/clearFacilityStaff`,
`GameState.facilityStaff: facilityId → monsterId`): 생산 시설마다 수호자 1체. 산출
×1.2, 적성 부족(`FACILITY_AFFINITY` 광산 용족·약초원 산신·직조실 탈족·마력우물
해신·보물고 도깨비)이면 ×1.5. **수호자는 방어하거나 일하거나 둘 중 하나** —
근무 배정은 방에서 빼고(`movedFromRoom`), 방 배치(`assignMonsterToRoomSlot`)는
근무를 끝낸다. 전투 배치(`deployDungeonSlotsToGrid.staffedMonsterIds`)와 추천
(`collectAssignedMonsterIds`)도 근무자를 제외한다. UI: 생산 구역 명령판의 '근무
수호자' 줄(`production-staff`) → `ProductionStaffPicker`(칩 `production-staff-<id>`),
배치 트레이 몬스터 칩은 '근무 중' 표기.

- 가드: `facilityStaff.test.ts`(배타성 양방향·추천 제외), `production.test.ts`(적성
  배율), `idleIncome.test.ts`(명성 배수·수익 방·상한). 모달 하니스
  `production-staff-picker`/`production-staff-assigned`.

### 교감 (2026-09-18, Phase 3 / P3 ②)

수호자의 세 번째 상태(방어·근무·**돌봄**). `GameState.monsterAffinity`(0~100, 각성이
100을 요구하던 죽은 필드)를 `bondTransactions.performBondAction`이 올린다. 행동 3종
(`bond.ts BOND_ACTIONS`): 간식 🍖 +8(약초 1 또는 일반 광석 1, 1일 3회 — 생산 시설의
두 번째 수요처), 대화 💬 +5(무료 1일 1회), 합동 훈련 ⚔️ +6(120골드, XP +10, 1일
2회). 일일 횟수는 `GameState.bondDaily[monsterId] = {date, counts}`(UTC 날짜, `daily.ts
getTodayString`). 임계 25/50/75/100 = 신뢰·우정·유대·일심: 공격 ×1.03/1.06/1.10/1.15
(`bondAtkMult` → `guardianAtkMult`의 세 번째 인자 → 전투·시뮬 동일), 50에서 부족별
이야기 한 줄(`BOND_STORY_BY_TRIBE`), 75에서 영혼 결정 30, 100에서 각성 가능.
UI: 수호자 상세 4번째 탭 '교감'(`MonsterDetailBond.ts`, 존 `monster-detail-tab-bond`,
버튼 `monster-bond-<action>`), 탭 안에서 커밋·토스트·재렌더(패널은 열린 채).

- 가드: `bond.test.ts`(임계·비용 대안·일일 한도·날짜 리셋·보상 1회·100 마감).
  모달 하니스 `barracks-bond-tab`/`barracks-bond-action`.

### 계보도 · 목표 핀 (2026-09-18, Phase 3 / P3 ①)

신규 데이터 없음 — `lineage.ts`가 레지스트리·진화 티어(`EVOLUTION_TIERS`, 이제
export)·`COMBINATION_TABLE`에서 노드(`getLineageNode`: base/evolution/hybrid, parents,
children)를 파생한다. **목표 핀** `GameState.lineageGoal`(monster id | null):
`getLineageGoalPlan(state, goal)`이 보유 상태에서 목표까지의 단계(소환 → 진화 ×3 →
조합 영혼 결정 100)를 만들고, `getLineageNextStep`이 첫 단계를 준다. 홈 directive는
방 작업이 없을 때 `getLineageDirective`(kind `'lineage'`, destination `'codex'`)를
전투 준비 카드보다 먼저 보여준다(`HomeCommandDeck` → CodexScene). 방 작업은 거의
항상 있으므로 핀은 지시 헤더의 `📌 <이름>` 칩(`home-lineage-goal-chip`)으로도 항상
보인다. 도감 상세 하단
'계보' 스트립(`codex-lineage-pin`)이 `suggestLineageGoal`(미보유면 자기 자신, 보유면
다음 진화, 아니면 첫 하이브리드 자식)을 핀/해제한다.

- 가드: `lineage.test.ts`(노드 파생·계획·모으기 단계·핀 제안). 모달 하니스
  `codex-lineage-pin`/`home-lineage-goal-chip`.

### 중복 소환 → 각성석 · 부족 조각 (2026-09-18, Phase 4 / P4 ②)

중복 뽑기는 영혼 결정 보상(`SC_COMP`)에 더해 **각성석**(희귀도별 0/0/1/1/2)과
**부족 조각**(5/8/15/25/40, 그 몬스터의 `tribe`)을 준다(`tribeShards.ts
duplicateReward`, `applySummonPull` 중복 분기, `SummonPullResult.tribe/tribeShards/
awakeningStones`). `GameState.tribeShards[tribe]` 100개 → `redeemTribeShards`가 그
부족의 **미보유·소환 가능**(`RARITY_POOLS` ∪, 해금 스테이지 게이트) 1체를 확정 지급.
UI: 소환 탭 카드 아래 44px 스트립(`SummonTribeShards.ts`, 선두 부족 하나 + 바 +
`summon-shard-redeem` 버튼; 시즌 배너가 활성일 땐 공간이 없어 생략), 결과 뱃지에
`조각 +N · 각성석 +K`.

- 가드: `tribeShards.test.ts`(희귀도 표·중복 분기·100개/부족 완성 거절·정확히 100 소모),
  `summonTransactions.test.ts` 결과 필드 확장. 모달 하니스 `summon-shard-redeem`.
- **주간 무과금 보석 인플로우**(`gemInflow.ts estimateWeeklyFreeGems`): 출석 110 + 명성
  주간 정산 `100 + 30×티어`(`NOTORIETY_WEEKLY_GEMS_BASE`) + 보물 사냥꾼 카드 기대값
  (6일 × 15% × (50+5×티어)). 가드 `gemInflow.test.ts`: 티어 2~5가 300~450 밴드 안
  (티어 1 ≈ 290, 6+는 의도적으로 초과 — 밴드 폭 150에 티어당 +34.5).
- 배너 = 부족 픽업(기존 `SEASON_BANNERS`가 이미 부족 단위). `bannerSynergy.ts`가 피처드
  목록의 최빈 부족·보유 수·다음 시너지 단계(`synergy.ts`)를 내고, 배너 카드가 "저승 1체
  보유 · 2체면 저승 수확" 한 줄(≤196px, 초상 앞)로 보여준다(P4 ③).

### 배치 트레이 터치 타깃 (2026-09-18 수정)

배치 트레이는 하니스가 **열 수 없어서**(홈 방 카드에 존 이름이 없었다) 감사에서
빠져 있었고, 케이스를 추가하자마자 44px 미만 터치 타깃 7개가 나왔다: `상세 ▸`
47×28, 닫기 ✕ 44×28, `추천 배치` 92×22, `방 강화/수리` 96·104×22, 탭 3개 108×30.
트레이 높이를 238 → 272로 늘려 자리를 만들고, **보이는 박스는 그대로 두되 존만
`TOUCH_MIN`(44)** 으로 키웠다. 홈 보드의 침입 순서 마커 8px·가족 라벨 9px도 10px로.

- 존 이름: 홈 방 카드 `home-room-card-<idx>`, 트레이 탭 `placement-tab-<type>`.
  탭을 라벨로 누르면 방 제목 `방 #1 · 함정실`과 겹쳐 엉뚱한 곳을 눌렀다.
- 가드: 모달 하니스 `home-placement-trap-strip`.

### 홈 할 일 배지 (2026-09-18)

지시 카드는 한 건만 보여주는데 방 작업 큐가 거의 항상 이를 차지하므로, 새 시스템은
`homeTodos.ts`(순수 카운트)로 헤더·칩에 배지로 노출한다: 헤더 `⛏ 근무 N`
(`home-staffing-chip` → **ProductionScene의 유일한 홈 경로**; 그 전까지 생산 구역은
스테이지 지도에서만 갈 수 있었다), 칩 `육성 N`(오늘 교감 가능한 수호자)·`제작 N`
(지금 융합 가능한 2·3티어 함정). 가드: `homeTodos.test.ts`, 모달 하니스
`home-todo-badges`/`home-staffing-route`.

### 보스 처치 슬로모 (2026-09-18 수정)

`ImpactVfx.playBossKillReaction(scene, baseScale)`는 160ms 동안 `time/tweens.timeScale`
을 0.15로 떨어뜨리고 **wall-clock `setTimeout`**(게임 배속의 영향을 받지 않아야 하므로)
으로 되돌린다. 두 가지 함정이 있었고 둘 다 막아뒀다:

1. 이전 값을 캡처해 복원하면 **160ms 안에 보스가 둘 죽을 때** 두 번째가 0.15를
   "이전 값"으로 캡처해 전투가 영구히 0.15배로 고착된다(스테이지 90 후반 웨이브는
   거인을 연달아 잡는다). → 모듈 토큰으로 **최신 슬로모만** 복원한다.
2. 복원 시 `tweens.timeScale = 1`은 3배속 전투를 1배속 모션으로 되돌린다. →
   시계·트윈 모두 `baseScale`(= `DungeonScene.speedMult`)로 복원한다.

organic 하니스는 `page.evaluate` 안에서 동기 루프로 시간을 밀기 때문에 wall-clock
타이머가 굶는다. `verify-campaign-pacing.mjs`/`verify-forecast-playthrough.mjs`는
슬라이스마다 `await yieldToTimers()`로 이벤트 루프를 양보한다 — 이게 없으면 하니스가
0.15배에 갇혀 예산을 스폰 대기에만 쓴다(90 veteran 미정산의 실제 원인).

**배속의 단일 진실원은 `combat/BattleSpeed.ts applyBattleSpeed(scene, scale)`**이다.
Phaser는 `scene.time`(타이머·쿨다운)과 `scene.tweens`(이동·연출) 시계가 분리돼 있어
한쪽만 바꾸면 3배속 전투에서 침입자만 1배속으로 기어간다. `setSpeed`·일시정지·
**전투 재진입 리셋**·보스 슬로모 복원 네 곳이 전부 이 함수를 쓴다. 재진입 리셋이
필요한 이유: Phaser가 씬 인스턴스를 재사용하는데 시계는 클래스 필드가 아니라
재초기화되지 않는다 — 최종 보스를 잡고 160ms 안에 스테이지가 끝나면 **다음 전투가
0.15배로 시작**했다.

가드: `bossSlowMo.test.ts`(복원 대상·중첩·씬 종료·양 시계 동시 이동).

### 침입자 이동 잠금 (2026-09-18 수정)

군중 제어가 겹치는 게 **정상**이다 — 2·3티어 함정은 진입 한 번에 상태이상 2~3종을
건다(`storm_cage` = 둔화+감전+공포). `objects/movementLock.ts`(순수)가 두 규칙을 쥔다:

1. `isMovementLocked`(기절·속박·빙결·매혹) — **마지막 효과가 끝날 때만** 다시 걷는다.
   전에는 기절 해제가 무조건 `resume()`이라 빙결·매혹을 깨뜨렸고, 속박/빙결 해제는
   서로를 부분적으로만 확인했다(효과가 추가될 때마다 조건이 누적된 흔적).
2. `restingPathSpeed`(둔화 × 가속) — 무관한 효과가 끝날 때 `timeScale = 1`로
   되돌리면 살아 있는 둔화가 지워졌다. 이제 남은 수정자를 합성해 복원한다.

**속도 변경은 절대 일시정지를 풀지 않는다.** 도발·독 마비·부활 연출은 잠금 플래그
없이 트윈을 멈추므로, 둔화/가속/아우라가 `resume()`을 부르면 그 정지가 조기에
끊긴다(실측: 20 lean이 26% 승 → 0% 패로 뒤집혔다). 그래서 통로가 둘이다 —
`syncPathSpeed()`는 `timeScale`만, `resumePathIfFree()`는 군중 제어 만료에서만.

`Invader.resumePathIfFree()`가 이 둘을 적용하는 단일 통로이고, 모든 만료 콜백이
여기로 들어온다(사망·부활·독 폭발 경로는 원래부터 완전한 조건이었다). 용병 대장
아우라(`runMercenaryAuras`)도 `pathTween.timeScale`을 직접 쓰지 않고 `boostMult`를
설정한다 — 직접 쓰던 시절엔 아우라가 둔화를 덮어쓰고, 아우라를 벗어날 때 1로
되돌려 **둔화를 영구히 잃었다**.

**남은 빈틈(의도적).** 도발·독 마비·부활 연출은 여전히 잠금 *플래그 없이* 트윈만
멈춘다. 따라서 그 사이에 기절 등이 만료되면 `resumePathIfFree()`가 정지를 조기에
푼다 — 수정 전과 같은 동작이라 회귀는 아니지만 모델은 미완성이다. 완성하려면
`isTaunted`/`isParalyzed`를 잠금 집합에 넣어야 하고, 전투 동작 변경이므로 organic
회귀(20·42 lean)를 동반한 별도 슬라이스로 다뤄야 한다. `isMovementLocked`가 보는
플래그는 네 개뿐이라는 점을 하니스 불변식 (B) 해석 시 감안할 것.

가드: `movementLock.test.ts`(순수 규칙) + **organic
`scripts/verify-invader-movement.mjs`** — 유닛 테스트는 Phaser의 일시정지 의미를
보지 못해 두 결함을 모두 놓쳤다. 이 하니스가 실제 전투에서 (A) 정지된 트윈이
둔화·아우라 변경 후에도 정지 유지 + 속도 합성, (B) 겹친 잠금에서 잠긴 채 이동 0건 ·
잠금 없이 정지 0건을 확인한다(3티어 함정 2개를 깐 방으로 겹침을 강제).

### 전투 로직 위치 (src/combat/ 분산)
| 모듈 | 역할 |
|------|------|
| `DungeonLayout.ts` | 홈 슬롯 → 전투 방 배치(`deployDungeonSlotsToGrid`), 그리드 |
| `RoomInput.ts` | 방 탭 라우팅: 스왑 → 스킬 타깃 → 수리 → 스킬 팝업 → 점검 |
| `ActiveSkills.ts` | `activateSkillEffect` |
| `StageClearFlow.ts` | `showChapterClear` |
| `ResultFlow.ts` | `triggerWaveFail`, `showWaveClear` |
| `WaveEvents.ts` | `tryShowWaveEvent`, `applyWaveEvent` |
| `DungeonScene.ts ~316` | `shutdown()` — 씬 종료 정리 |

### 주의사항
- `scene.start(X)`는 현재 씬을 stop하지 않음 → DungeonScene.create()에서 명시적으로 `DungeonHomeScene` stop
- `UIScene`은 `scene.launch()`로 병행 실행 → `scene.stop('UIScene')` 별도 필요
- `time.delayedCall` / tween `onComplete`은 eval 컨텍스트에서 실행 안 됨

---

## 두 개의 진행도 저장소

| 키 | 파일 | 내용 |
|----|------|------|
| `dungeonGameState` | wisdom.ts | 전체 게임 상태 (골드·XP·퀘스트·몬스터 등) |
| `dungeonStageProgress` | StageSelectScene.ts | 80개 스테이지 별/HP% |

둘은 독립적. `StageClearFlow.showChapterClear()`에서 둘 다 업데이트.

---

## 침략 배틀 vs 일반 스테이지

| 구분 | stageConfig | returnTo | 클리어 후 |
|------|-------------|----------|-----------|
| 일반 스테이지 | `{ stageNumber: N, ... }` | undefined | StageSelectScene or 다음스테이지 |
| 침략 배틀 | `{ waves: [...], ... }` (inline) | `'DungeonHomeScene'` | DungeonHomeScene |

침략 클리어는 `stageProgress` 기록 안 함 (stageNumber 없음).

---

## 에셋

- `public/assets/monsters/{id}.jpg` — AI 생성 몬스터 초상화 (Ch1–5 29종). 없을 경우 절차적 픽셀아트 폴백 (`src/art/PixelMonsters.ts`)
- 인베이더는 `src/art/PixelInvaders.ts`의 절차적 픽셀아트로만 렌더 (BootScene에서 베이킹). AI JPG 에셋은 사용하지 않음

---

## 앱 설정

2026-09-16 네이티브 프로젝트 실측 기준.

- Bundle ID / applicationId: `com.dungeon.guardian`
- 버전: **1.1 / build 2** (`MARKETING_VERSION` 1.1 · `CURRENT_PROJECT_VERSION` 2 /
  `versionName "1.1"` · `versionCode 2`)
- iOS deployment target: **15.0** (Podfile `platform :ios, '15.0'`과 동일)
- Android **minSdk 24 / compileSdk 36 / targetSdk 36** — Capacitor 8 기본값과 일치
  (`android/variables.gradle`이 단일 진실원, `app/build.gradle`은 여기서 읽어감)
- Capacitor: core/android/ios/cli 모두 `8.2.0`
- Gradle wrapper 8.14.3 · Capacitor 8은 **Java 21**을 요구
  (`sourceCompatibility/targetCompatibility VERSION_21`)

### 네이티브 빌드 전제조건

2026-09-17 양 플랫폼 빌드 + 실제 구동까지 실측 확인.

| 대상 | 필요한 것 | 검증 명령 |
|------|-----------|-----------|
| 동기화 | 없음 (`dist/` 최신이면 됨) | `npm run build && LANG=en_US.UTF-8 npx cap sync` |
| iOS 빌드 | Xcode + CocoaPods | `xcodebuild -workspace ios/App/App.xcworkspace -scheme App -configuration Debug -sdk iphonesimulator build` |
| Android 빌드 | **JDK 21** + SDK(platform 36, build-tools 36.x) | `cd android && ./gradlew assembleDebug` |

`ANDROID_HOME`은 필요 없다 — `android/local.properties`의 `sdk.dir`가 Gradle에
SDK 위치를 알려준다. Capacitor 8이 Java 21을 요구하므로 JDK만 맞추면 된다.

동기화 산출물(`android/app/src/main/assets/public`, `ios/App/App/public`)은
Capacitor가 생성한 중첩 `.gitignore`가 제외하므로 커밋되지 않는다. 네이티브
빌드 전에는 반드시 `cap sync`를 먼저 돌려야 최신 `dist/`가 들어간다.

### 번들에 실리는 것 / 안 실리는 것

`public/`은 Vite가 `dist/`로 그대로 복사하고, Capacitor가 그 `dist/`를 APK/IPA에
패키징한다. 즉 `public/`에 둔 파일은 전부 출하된다. 기여자용 `.md` 가이드
(`assets/ASSET_GUIDE.md`, `assets/backgrounds/README.md`)는 문서화 대상 폴더
옆에 두되, `vite.config.ts`의 `strip-bundled-docs` 플러그인이 빌드 산출물에서
`.md`를 제거한다. `public/`에 새 기여자 문서를 추가할 때는 `.md`로 두면 된다.
