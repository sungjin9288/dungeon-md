# Dungeon Guardian

Phaser 3 + TypeScript + Vite + Capacitor 기반의 모바일 dungeon defense RPG입니다. 기준 화면은 iPhone 비율의 390x844 canvas이며, web build를 먼저 안정화한 뒤 Capacitor로 Android/iOS shell에 동기화합니다.

## Current Direction

현재 개발 방향은 release stability와 testable state transition입니다. 이미 전투, 스테이지, 퀘스트, 소환, 상점, 병영, 합성, 제작, 도감, 업적, daily/weekly 콘텐츠가 들어와 있으므로 신규 기능을 크게 늘리기보다 다음 순서로 완성도를 올립니다.

1. 플레이어 진행도에 영향을 주는 `GameState` 변경을 immutable update로 통일합니다.
2. UI scene 안의 구매, 보상, 퀘스트 완료 같은 상태 전이를 `src/data` pure function으로 분리합니다.
3. 분리한 상태 전이는 unit test로 고정합니다.
4. 모바일 viewport, safe-area, DPR rendering, touch target을 smoke check합니다.
5. web build가 통과한 뒤 필요한 경우에만 `npx cap sync`로 native shell을 갱신합니다.

## Design Direction

`Dungeon Guardian`의 UI/UX는 최신 roguelite, dungeon crawler, compact strategy 게임의 흐름을 참고하되, 390x844 portrait canvas에서 반복 플레이가 편한 운영형 dungeon defense 화면으로 해석합니다.

Reference anchors checked on 2026-05-14:

- [Hades II](https://www.supergiantgames.com/blog/hades2-faq/) / [Steam](https://store.steampowered.com/app/1145350/Hades_II/) - 2025년 v1.0 기준. 강한 silhouette, 고대 신화 tone, 전투 피드백의 즉시성을 참고합니다.
- [Blue Prince](https://www.pcgamer.com/games/pc-gamers-game-of-the-year-awards-2025/) - 2025년 Best Design 평가 기준. room/grid 기반 구조, 반복 run 안에서 축적되는 발견감, 정보의 단계적 공개를 참고합니다.
- [The King is Watching](https://www.gematsu.com/games/the-king-is-watching) - 2025년 roguelite kingdom builder. 제한된 화면에서 resource loop와 다음 선택지가 바로 보이는 compact management UI를 참고합니다.

Mobile reference audit checked on 2026-05-20:

- [CookieRun: Kingdom](https://play.google.com/store/apps/details?id=com.devsisters.ck) - character collection과 kingdom builder가 결합된 모바일 RPG입니다. `Dungeon Guardian`은 홈 화면을 정적인 메뉴가 아니라 몬스터 활동, 제작/생산, 방 확장 상태가 보이는 living dungeon overview로 발전시킵니다.
- [Monster Never Cry](https://play.google.com/store/apps/details?id=com.origin.rod) - Demon Lord가 monster legion을 모으고 ruined base를 재건하는 anti-hero RPG 방향을 참고합니다. 던전마스터 판타지를 더 직접적으로 드러내기 위해 홈, 방 상세, 성장 화면의 언어를 `군단`, `폐허 복구`, `침입 방어`, `방 보강` 중심으로 맞춥니다.
- [Dungeon Maker](https://play.google.com/store/apps/details?id=com.GameCoaster.DungeonMaker) - 다수의 monster, trap, facility 조합이 핵심인 dungeon-building reference입니다. 방 상세는 리스트 UI보다 방 내부 cutaway preview와 배치 가능한 슬롯을 우선 보여주는 편집 화면이어야 합니다.
- [Clash of Clans](https://en.wikipedia.org/wiki/Clash_of_Clans) - persistent base, upgrade loop, resource readability를 참고합니다. 수리/업그레이드/잠금/전투 준비 상태는 홈 던전 맵에서 한눈에 보여야 합니다.
- [AFK Journey](https://www.pocketgamer.com/afk-journey/out-now/) - painterly character presentation과 idle reward rhythm을 참고합니다. 막사와 공방은 spreadsheet형 관리 화면이 아니라 캐릭터 portrait, 성장 가능 상태, 장비 추천, 보상 회수를 중심으로 재구성합니다.

적용 원칙:

1. 홈/전투/관리 화면은 `현재 상태 -> 가능한 행동 -> 결과 피드백` 순서로 읽히게 구성합니다.
2. 하단 nav와 주요 CTA는 아이콘만 누르는 방식이 아니라 전체 탭/버튼 면적을 터치 가능하게 만듭니다.
3. 어두운 dungeon 배경은 유지하되, 챕터/rarity/status accent를 분산해 단일 색감으로 잠기지 않게 합니다.
4. 보상, 비용, 퀘스트, 전투 결과는 숫자와 iconography를 함께 사용해 색각 의존도를 낮춥니다.
5. 장식보다 feedback motion을 우선합니다. tab press, reward pop, unlock reveal, damage/heal tick처럼 상태 변화를 설명하는 애니메이션을 먼저 개선합니다.
6. 공통 panel, reward/info row, primary CTA는 `src/ui/GameUiPrimitives.ts`를 우선 사용해 화면별 custom graphics 중복을 줄입니다.

### Design Development Roadmap

현재 디자인 디벨롭의 1차 목표는 사용자가 첫 화면에서 바로 `던전마스터로서 던전을 키우고 있다`는 감각을 받게 만드는 것입니다. 우선순위는 다음 순서를 따릅니다.

1. `Dungeon overview`: 홈 화면은 방 카드 모음이 아니라 입구, 터널, 층, 잠긴 확장지, 심장부가 보이는 던전 전체 전경으로 읽히게 만듭니다.
2. `Room zoom`: 방을 누르면 전투실, 함정실, 지원실, 마법진의 내부 구조와 몬스터/함정 슬롯이 보이는 관리 화면으로 자연스럽게 확대됩니다.
3. `Monster raising`: 막사는 보유 몬스터 리스트가 아니라 성장 가능 몬스터, 장비 상태, 스킬 포인트, 다음 성장 액션이 우선 보이는 성장소로 정리합니다.
4. `Forge loop`: 제작 화면은 장비 목록보다 제작 가능 여부, 추천 장착 대상, 전투력 증가, 부족 재료를 먼저 보여주는 던전 공방 UI로 정리합니다.
5. `Combat readiness`: 홈 운영실, 방 상세, 제작, 전투 준비 화면이 모두 같은 readiness/directive 언어를 사용해 `부족한 곳 확인 -> 보강 -> 전투` 루프를 닫습니다.
6. `Casual polish`: 어두운 dungeon tone 위에 귀엽고 선명한 몬스터 silhouette, room-type accent, 짧은 unlock/reward motion을 얹어 캐주얼한 반복 플레이 감각을 강화합니다.

각 단계의 완료 기준은 390x844 viewport에서 텍스트 겹침 없이 읽히고, 핵심 CTA가 44px에 가까운 터치 영역을 가지며, `npm test`, `npm run build`, local browser smoke check를 통과하는 것입니다.

### Mobile Design Upgrade Program

모바일 게임 수준으로 끌어올리기 위한 디자인 작업은 다음 순서로 진행합니다.

1. `Base fantasy pass`: 홈 화면을 던전 운영실이 아니라 실제 base overview로 읽히게 만듭니다. 방마다 활동 aura, 입구/심장부 방향성, 잠긴 확장지, 다음 행동 pin을 유지하고, 화면 하단 command deck은 현재 최우선 행동만 강하게 노출합니다.
2. `Room editor pass`: 방 상세의 첫 화면은 내부 cutaway preview입니다. 몬스터/함정/장비 socket, 다음 행동 target ring, 방 역할별 fixture를 강화하고, 아래 리스트는 보조 편집 영역으로 둡니다.
3. `Monster raising pass`: 막사는 보유 목록보다 성장 가능한 몬스터 중심으로 재배치합니다. 각 몬스터 카드는 portrait, 레벨/전투력, 장비 상태, 추천 배치 방, 성장 CTA를 같은 카드 안에서 보여줍니다.
4. `Forge recommendation pass`: 공방은 제작 가능한 장비, 부족 재료, 추천 장착 몬스터, 방 readiness 상승량을 우선 보여줍니다. 장비 제작 후 바로 해당 방으로 돌아오는 흐름을 강화합니다.
5. `Readiness loop pass`: 홈, 방 상세, 막사, 공방, 전투 준비가 같은 `다음 행동` directive를 사용하도록 통일합니다. 플레이어는 어떤 화면에 있든 지금 해야 할 보강 작업을 잃지 않아야 합니다.
6. `Reward and unlock pass`: 방 해금, 방 레벨업, 몬스터 성장, 장비 장착, 함정 설치에는 120-320ms의 짧은 reward motion과 before/after 수치 피드백을 붙입니다.
7. `Mobile production pass`: 390x844, 360x800, 430x932 viewport에서 text overflow, touch target, safe-area, console error, build size warning을 반복 검증합니다.

디자인 로드맵 진행 상태 (2026-06): 위 6단계 + 모바일 7패스는 모두 완료되었습니다.

- 홈은 수직 던전 전경(`DungeonBoardLayout` 단일 진실원)으로 재구조화 — 입구/층/심장부, 방별 활동 aura, 다음 행동 pin.
- 막사는 캐릭터 중심 성장 화면, 공방은 추천 제작 + 즉시 장착 흐름, 홈/방/전투준비가 공통 readiness directive를 공유.
- 스테이지 선택은 세로 여정 지도(점등 트레일), 리워드/언락 모션은 `getReducedMotion()`·`popIn()`으로 중앙화.
- 코드 정비: `src/` 전체 800줄 초과 파일 0개 (대형 씬·오브젝트를 Shared 순수헬퍼 + 렌더 모듈로 분할).
- 밸런스 가드 상시화: 캠페인 난이도 곡선(`balanceAudit`), 지혜 트리 경제(`wisdomEconomy`), 골드 경제(`goldEconomy`).
- 무한 던전 도전 변수(런별 modifier) 등 기존 시스템 심화.

추가 작업은 신규 콘텐츠·출시 준비(native cap sync, 스토어 메타데이터) 중심으로 진행합니다.

## Project Layout

```text
src/
  main.ts             Phaser.Game initialization, global DPR/safe-area/audio handling
  scenes/             Phaser scenes and screen-level orchestration
  combat/             Battle logic, wave lifecycle, room actions, result flows
  data/               Game state, registries, content definitions, pure domain logic
  ui/                 Reusable Phaser UI panels and widgets
  art/                Procedural monster/invader/room art fallback
  themes/             Dungeon theme registry and theme definitions
  objects/            Phaser game objects
  constants/          Canvas layout, colors, safe-area helpers
  audio/              Tone.js-based AudioManager
  utils/              Shared utilities
```

Additional folders:

```text
public/assets/        Monster and invader image assets
android/              Capacitor Android shell
ios/                  Capacitor iOS shell
tools/                Release/store metadata and generated icon assets
```

The sibling folder `../dungeon-realm` is an Expo/React Native prototype. Unless a task explicitly targets it, active development should happen in this `dungeon-phaser` app.

## Requirements

- Node.js compatible with Vite 5 and TypeScript 5
- npm
- Xcode/CocoaPods only when working on iOS native packaging
- Android Studio/Gradle only when working on Android native packaging

Install dependencies:

```bash
npm install
```

## Common Commands

```bash
npm run dev        # Vite dev server on port 8083
npm test           # Vitest unit/consistency suite
npm run build      # TypeScript check + Vite production build
npm run preview    # Preview production build on port 8084
npx cap sync       # Sync dist/ into Android/iOS shells after a successful build
```

## Verification Baseline

Before considering a gameplay or persistence change complete, run:

```bash
npm test
npm run build
```

For UI or scene behavior, also run the app locally and smoke check the changed flow:

```bash
npm run dev
```

Then open `http://localhost:8083`.

## Architecture Notes

`src/data/wisdom.ts` owns persistent `GameState` through `loadGameState()` and `saveGameState()`. The localStorage key is `dungeonGameState`.

`src/data/stageProgress.ts` and stage config files model the 80-stage campaign progression. Stage progress is separate from the full game state, so stage-clear changes must check both persistence paths.

`DungeonScene` runs the battle, while `UIScene` is launched alongside it for battle HUD. Scene lifecycle changes must explicitly consider both scenes so overlay state does not leak.

Content registries such as monsters, invaders, rooms, themes, quests, banners, daily content, and stages are covered by consistency tests. Add or update tests when adding registry entries.

Balance is guarded by data-driven tests: `balanceAudit.test.ts` (campaign difficulty curve — chapter finale is the peak, no threatless stage), `wisdomEconomy.test.ts` (crystal cost-to-max pacing), and `goldEconomy.test.ts` (every stage affordable). Edits to stage waves, invader stats, room costs, or wisdom branch costs should keep these green.

## State Transition Pattern

Avoid mutating the loaded `GameState` directly inside UI callbacks.

Preferred:

```ts
const state = loadGameState();
const next = applySomeTransaction(state, input);
saveGameState(next);
```

Avoid:

```ts
const state = loadGameState();
state.gems -= cost;
state.ownedThemes.push(themeId);
saveGameState(state);
```

This keeps purchases, rewards, quest progression, and unlock behavior easier to test without running Phaser scenes.

## Release Notes

Current native metadata is documented in `CLAUDE.md` and `tools/store-metadata.md`. Treat `tools/release-checklist.md` as the release checklist when preparing a packaged build.
