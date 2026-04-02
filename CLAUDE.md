# 던전 수호자 — CLAUDE.md

Phaser 3 + TypeScript + Vite + Capacitor 모바일 게임.
Canvas 390×844 (iPhone 기준), FIT 스케일 모드.

---

## 실행

```bash
npm run dev        # 개발 서버 :8083
npm run build      # dist/ 생성
npx cap sync       # dist/ → android/ + ios/ 동기화
```

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
BootScene
  → (첫 실행) CinematicScene(ch1_opening) → DungeonHomeScene
  → (재실행)  DungeonHomeScene

DungeonHomeScene          홈 허브. 퀘스트·침략 확인, 설정 오버레이, 세이브 관리
  → StageSelectScene      챕터별 스테이지 선택 (62개, 6챕터)
  → PreBattleScene        덱 편성 → DungeonScene
  → SummonScene           소환 (일반/특수/영혼/우정)
  → ShopScene             상점
  → BarracksScene         병영 (몬스터 육성·장비·각성·스킨)
  → FusionScene           합성
  → ForgeScene            제작
  → AncestralWisdomScene  지혜의 나무 (메타 업그레이드)
  → CodexScene            도감
  → AchievementScene      업적

DungeonScene              실전 배틀 (4597줄, 메인 게임 루프)
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
- **`STAGE_CONFIGS[62]`** — stageNumber 1–62, slots, chapter, bossWave
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

### 중요 메서드 위치 (대략적 라인)
| 메서드 | 역할 |
|--------|------|
| `placeRoom()` ~839 | 방 설치 |
| `upgradeRoom()` ~949 | 방 업그레이드 |
| `assignMonster()` ~925 | 몬스터 배치 |
| `activateSkill()` ~714 | 스킬 발동 |
| `showChapterClear()` ~2834 | 스테이지 클리어 처리 |
| `triggerWaveFail()` ~2554 | 웨이브 실패 처리 |
| `shutdown()` ~274 | 씬 종료 정리 |

### 주의사항
- `scene.start(X)`는 현재 씬을 stop하지 않음 → DungeonScene.create()에서 명시적으로 `DungeonHomeScene` stop
- `UIScene`은 `scene.launch()`로 병행 실행 → `scene.stop('UIScene')` 별도 필요
- `time.delayedCall` / tween `onComplete`은 eval 컨텍스트에서 실행 안 됨

---

## 두 개의 진행도 저장소

| 키 | 파일 | 내용 |
|----|------|------|
| `dungeonGameState` | wisdom.ts | 전체 게임 상태 (골드·XP·퀘스트·몬스터 등) |
| `dungeonStageProgress` | StageSelectScene.ts | 62개 스테이지 별/HP% |

둘은 독립적. `DungeonScene.showChapterClear()`에서 둘 다 업데이트.

---

## 침략 배틀 vs 일반 스테이지

| 구분 | stageConfig | returnTo | 클리어 후 |
|------|-------------|----------|-----------|
| 일반 스테이지 | `{ stageNumber: N, ... }` | undefined | StageSelectScene or 다음스테이지 |
| 침략 배틀 | `{ waves: [...], ... }` (inline) | `'DungeonHomeScene'` | DungeonHomeScene |

침략 클리어는 `stageProgress` 기록 안 함 (stageNumber 없음).

---

## 에셋

- `public/assets/monsters/{id}.jpg` — AI 생성 몬스터 초상화 (Ch1–5 29종)
- `public/assets/invaders/{type}.jpg` — AI 생성 인베이더 스프라이트 (35종)
- 없을 경우 절차적 픽셀아트 폴백 (`src/art/`)

---

## 앱 설정

- Bundle ID: `com.dungeon.guardian`
- 버전: 1.0 / build 1
- iOS deployment target: 13.0
- Android minSdk: 22 / targetSdk: 34
- Capacitor: core/android/ios `^8.2.0`
