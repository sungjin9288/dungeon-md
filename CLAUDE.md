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

## 배틀 씬 핵심 패턴 (DungeonScene.ts)

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
  몬스터가 없는 방도 `ROOM_DEFS`의 자체 공격으로 싸운다. `simulation.ts`는 이
  셋을 그대로 모델링하므로 예측과 실전이 같은 레버를 본다.
- 홈 방 = **가족 4종**(combat/trap/support/magic, 용량 보너스·픽셀 픽스처·추천)
  **× 건물 12종**(`ROOM_DEFS`, 실제로 싸우는 방). `DungeonSlot.building`이 없으면
  가족 기본 건물(`FAMILY_DEFAULT_ROOM`). 챕터 방은 도달한 챕터부터 해금
  (`roomBuildings.ts`). 첫 설계 시 `roomsBuilt`에 건물이 기록된다.
- 밸런스 가드 `campaignPacing.test.ts`: 스타터(시작 보드 방 3개·스타터 3체)가
  스테이지 1을, lean(퀘스트 0·클리어 XP/전리품만)이 1~80을, expected(메인 퀘스트
  진행)가 1~80을 여유 1.3×로, veteran(강한 로스터)이 Ch9를 클리어해야 한다.
  시뮬은 사거리/행 커버리지는 보지만 방의 단일 표적 처리량은 못 보므로 초반
  절대 난이도는 `scripts/verify-campaign-pacing.mjs`(실전 organic 주행)가 진실원.

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
