# AGENTS.md

이 저장소의 기본 작업 단위는 `dungeon-phaser`입니다. 상위 폴더의 `dungeon-realm`은 Expo/React Native prototype 성격이므로, 명시 요청이 없으면 Phaser/Vite/Capacitor 앱을 기준으로 판단합니다.

## Role

- 실용적인 senior engineer처럼 행동한다.
- 먼저 기존 구조와 테스트를 확인하고, 작은 범위의 검증 가능한 변경을 선호한다.
- 사용자 변경사항과 미추적 산출물을 임의로 되돌리지 않는다.
- 확인되지 않은 추측을 사실처럼 문서화하거나 완료로 보고하지 않는다.

## Product Direction

이 프로젝트는 390x844 모바일 캔버스를 기준으로 한 Phaser 3 dungeon defense RPG입니다. 개발 방향은 다음 순서를 따른다.

1. Release stability: 저장/불러오기, 전투 결과, 보상, 상점, 퀘스트처럼 플레이어 진행도에 영향을 주는 흐름을 먼저 안정화한다.
2. Testable state transitions: UI scene 내부에서 직접 `GameState`를 mutate하지 말고, 가능하면 `src/data`의 pure function으로 상태 전이를 분리한다.
3. Mobile polish: safe-area, DPR rendering, text readability, touch target, scene cleanup을 모바일 기준으로 검증한다.
4. Content expansion: 신규 스테이지, 몬스터, 테마, daily/weekly 콘텐츠는 기존 data registry와 테스트 패턴을 따라 추가한다.
5. Platform packaging: web build가 안정적일 때만 Capacitor sync, Android/iOS asset, store metadata를 갱신한다.

## Design Direction

디자인 작업은 최신 모바일/PC roguelite와 strategy RPG의 장점을 참고하되, 이 프로젝트의 390x844 portrait canvas와 Phaser 3 제약에 맞게 적용한다.

- Reference anchors: `Hades II`는 손그림 질감, 강한 silhouette, 즉시 읽히는 combat feedback을 참고한다. `Blue Prince`는 grid/room 기반 탐험에서 오는 명확한 공간 정보와 점진적 발견감을 참고한다. `The King is Watching`은 kingdom-builder roguelite의 compact resource loop와 한눈에 읽히는 의사결정 UI를 참고한다.
- Mobile benchmark anchors checked on 2026-05-20:
  - `CookieRun: Kingdom`: kingdom builder + character collection hybrid. 홈은 생산/제작/장식/캐릭터 활동이 동시에 살아 있는 miniature world처럼 보여야 한다.
  - `Monster Never Cry`: Demon Lord fantasy, monster legion, ruined-base rebuild loop. 사용자는 던전마스터로서 폐허를 되살리고 군단을 키우는 감각을 첫 화면에서 받아야 한다.
  - `Dungeon Maker`: room/facility, trap, monster volume이 곧 게임성이다. 방 상세는 단순 카드 리스트가 아니라 방 내부에 몬스터와 함정이 실제 배치되는 편집 화면이어야 한다.
  - `Clash of Clans`: persistent base readability, upgrade affordance, resource loop. 잠금/업그레이드/수리/전투 준비 상태는 멀리서도 한눈에 읽혀야 한다.
  - `AFK Journey`: painterly Live Canvas, strong character presentation, idle reward rhythm. 몬스터 성장/장비 화면은 단순 spreadsheet가 아니라 캐릭터 중심의 수집 RPG 화면으로 보여야 한다.
- UI hierarchy: 화면마다 primary action, persistent status, optional management action을 시각적으로 분리한다. 모바일 첫 화면에서는 현재 할 일과 다음 전투 진입 경로가 즉시 보여야 한다.
- Readability: 390px 폭에서 10px 미만의 핵심 텍스트를 새로 추가하지 않는다. 숫자, 보상, 진행도, 비용은 색상만으로 구분하지 말고 위치/아이콘/라벨을 함께 사용한다.
- Touch ergonomics: 하단 nav, 주요 CTA, 보상 수령, 구매/장착 버튼은 실제 터치 영역을 최소 44px 높이에 가깝게 유지한다. 텍스트 또는 아이콘만 interactive로 두지 말고 전체 affordance를 터치 가능하게 만든다.
- Reusable primitives: 공통 panel, reward/info row, primary CTA는 먼저 `src/ui/GameUiPrimitives.ts`를 사용한다. 화면별 custom graphics는 이 primitive로 표현하기 어려운 특수 상태에만 추가한다.
- Visual language: 어두운 dungeon tone은 유지하되, 단일 보라/갈색 계열로 화면이 잠기지 않게 챕터/상태/rarity accent를 분산한다. 카드와 panel은 그림자, bevel, active strip처럼 기능적 depth만 사용한다.
- Motion: idle glow, reward pop, tab press, unlock reveal처럼 상태 변화를 설명하는 짧은 motion을 우선한다. 장식용 반복 애니메이션은 console/perf smoke에서 문제가 없을 때만 유지한다.

### Mobile Design Upgrade Rules

- Home first read: 첫 화면은 dashboard가 아니라 dungeon base overview다. 입구, 방, 통로, 심장부, 잠긴 확장지가 보여야 하고, 최우선 행동은 방 위 action pin과 하단 command deck 양쪽에서 확인 가능해야 한다.
- Room editing: 방 상세의 상단은 내부 cutaway preview가 중심이다. 몬스터/함정/장비 슬롯은 리스트보다 먼저 시각적으로 보여야 하며, 다음 행동 target ring이 실제 배치 위치를 가리켜야 한다.
- Monster raising: 막사/성장 화면은 캐릭터 portrait, 성장 가능성, 장비 상태, 다음 성장 비용을 우선 표시한다. 장문의 설명보다 `레벨업`, `장착`, `진화/합성`, `추천 배치 방`을 빠르게 판단하게 만든다.
- Forge loop: 공방은 제작 가능/부족 재료/추천 장착 대상/전력 증가를 한 화면에서 보여야 한다. 장비 목록은 결과 중심으로 정리하고, 추천 장착 CTA를 반복 노출한다.
- Combat readiness: 홈, 방 상세, 막사, 공방, 전투 준비 화면은 동일한 readiness language를 공유한다. `부족한 방 확인 -> 배치/성장/제작 -> 준비도 상승 -> 침입 방어` 흐름이 끊기면 안 된다.
- Casual mobile polish: 390x844에서 핵심 텍스트는 10px 이상, 주요 CTA는 44px 근처 touch target, 화면 전환은 120-320ms 안의 짧은 focus/reward motion을 기본값으로 한다.

## Repository Map

- `src/main.ts`: Phaser game 생성, scene 등록, DPR/safe-area/audio unlock 전역 처리.
- `src/scenes`: 화면 단위 Phaser scene. 큰 scene은 orchestration 중심으로 유지한다.
- `src/combat`: 전투 흐름, room action, wave lifecycle, result flow.
- `src/data`: game state, stage/content/quest/shop 관련 순수 데이터와 테스트 대상 로직.
- `src/ui`: scene에서 재사용하는 UI component와 panel rendering.
- `src/art`, `src/themes`: 절차적 art, invader/monster shape, dungeon theme registry.
- `public/assets`: 실제 monster/invader image asset. 누락 시 procedural fallback이 동작한다.
- `android`, `ios`: Capacitor native shell. web 변경 후 필요할 때만 sync한다.
- `tools`: release checklist, store metadata, generated icon assets.

## Working Rules

- 기존 `CLAUDE.md`는 프로젝트 구조 설명으로 유지하되, Codex 작업 규칙은 이 파일을 우선한다.
- 상태 저장 변경은 `loadGameState()`로 읽고, 새 객체를 만들어 `saveGameState(nextState)`로 저장한다.
- 배열/객체 필드는 in-place `push`, `splice`, 직접 대입보다 immutable copy를 기본값으로 한다.
- UI 파일이 길어질 때는 렌더링만 남기고 계산/상태 전이는 `src/data` 또는 작은 helper로 이동한다.
- 씬 전환을 바꿀 때는 `DungeonScene`과 `UIScene` cleanup 여부를 같이 확인한다.
- 새 data registry 항목을 추가하면 해당 registry의 기존 `*.test.ts`에 최소 smoke/consistency test를 추가한다.
- native platform 파일, store metadata, asset generation 결과는 필요할 때만 수정한다.

## Commands

```bash
npm run dev
npm test
npm run build
npx cap sync
```

검증 기본값은 `npm test`와 `npm run build`이다. UI/scene 변경은 가능하면 local dev server에서 직접 smoke check를 추가한다.

## Development Checklist

변경 전:

- `git status --short --branch`로 사용자 변경과 미추적 파일을 확인한다.
- 관련 scene/data/ui 파일과 해당 테스트 파일을 먼저 읽는다.
- 저장 데이터, 보상, 구매, progression에 닿는 변경인지 확인한다.

변경 중:

- pure function으로 분리 가능한 상태 전이는 먼저 분리한다.
- 기존 naming, constants, registry 구조를 따른다.
- nullable/legacy save 대응이 필요한 필드는 migration 또는 fallback을 함께 고려한다.

변경 후:

- 관련 unit test를 추가하거나 갱신한다.
- 최소 `npm test`를 실행한다.
- production bundle 영향이 있으면 `npm run build`도 실행한다.
- 검증하지 못한 항목은 final response에 명확히 남긴다.

## Example Pattern

상점/보상/퀘스트처럼 저장 상태를 바꾸는 로직은 다음 구조를 우선한다.

```ts
// src/data/exampleTransactions.ts
export function applyPurchase(state: GameState, itemId: string): GameState {
  if (state.ownedEquipment.includes(itemId)) return state;
  return {
    ...state,
    ownedEquipment: [...state.ownedEquipment, itemId],
  };
}
```

UI에서는 결과만 저장하고 toast/refresh를 처리한다.

```ts
const state = loadGameState();
const next = applyPurchase(state, itemId);
saveGameState(next);
ctx.refreshContent();
```
