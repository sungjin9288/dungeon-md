# Dungeon Phaser Design Continuation Handoff

## Boot follow-up — 2026-09-07 (latest)

`docs/design/CHARACTER_B1_BOOT_PROFILE.md` supersedes the next-action suggestion
in the earlier B1 snapshot below. Alternating nine/96 versus four/48 response-only
ablation was completed without runtime edits. Two complete-inventory series
(16 contexts) recorded0 errors/source drift. Post-warm-up medians were693/661ms
and1086/1007ms. The previous2.4–3.8s delay did not reproduce; its cause is not
established. Do not interpret diagnostic variability as a proven optimization.

Next gate is a recorded production/device baseline and readiness budget before
performance acceptance or loading-architecture changes. Existing B1 functional
acceptance remains intact. Final profiler: `scripts/profile-character-b1-boot.mjs`;
latest receipt: `tools/character-b1-boot-profile-paired04.json`. Old receipts and
assets remain unchanged; no commit/push/native operation was performed.

## Current B1 verification — 2026-09-07

- Approved scope and live execution: `docs/design/CHARACTER_B1_SPEC.md` and
  `docs/design/CHARACTER_B1_IMPLEMENTATION.md` (Astra plan, model-routed implementation).
- Five B1 art exports accepted in `tools/character-b1-assets.json`; runtime code,
  command verification, browser functional gates and independent Astra review passed.
  IDs: `village_archer`,
  `dokkaebi_junior`, `gold_turtle`, `fire_dokkaebi`, `sage`.
- Current command receipt: `tools/character-b1-verification.json` records
  105 files / 2904 tests, build, exporter 13 tests and legacy136 checks. Its 12
  source hashes match the current runtime.
- `tools/character-b1-audit.json`: 27 captures, 5 contact sheets, 19 isolated
  fixtures at360×800/390×844/430×932 DPR2;0 failures/console/network/source drift.
  Normal/reduced motion each passed3 panel and3 route cycles; Quest55 objects
  leave0 live objects/input registrations/tween targets after close. Parent
  visually reviewed all5 contacts plus full-size edge-case captures.
- Browser fixture coverage is not organic acquisition/campaign/native evidence.
  Boot timings are reported separately, without a speed PASS; current context is
  WebGL1.0, while the historical baseline did not record its actual GL version.
- Next priority before B2: profile the boot slowdown. Exact baseline-matched
  samples in `tools/character-b1-boot-matched.json` are3391.4347/3759.0004/
  2399.6640ms, versus baseline1090.2105/615.749333/622.938542ms. Functional
  acceptance does not close this performance question. Use a controlled paired
  comparison, retain all observations, and identify the direct owner before fixes.
- Owned Vite PID27680 is stopped; TCP8083 has no listener. Restart a task-owned
  local server for the next diagnostic run; do not stop unrelated browser/server processes.
- Preserve the existing dirty checkout, all legacy136 JPGs, previous four master/
  runtime assets and old audits. B1 creates separate evidence; no new Goal or Git
  delivery/native/publishing action. Detailed ownership lives in the B1 plan.
- The dated September 5 record below remains historical evidence; its four-art
  count and 48px world-bake observation are not a current B1 completion claim.

> Snapshot: 2026-09-05, Asia/Seoul
> Workspace: `/Users/sungjin/dev/personal/dungeon md/dungeon-phaser`
> Branch/HEAD at snapshot: `main` / `68546cb feat: complete monster portrait integration`

이 문서는 다른 agent/tool이 현재 디자인 작업을 안전하게 이어가기 위한 내부
운영 문서다. 구현·검증 사실은 live code, `git diff`, 테스트 출력, 렌더 증빙이
이 문서보다 우선한다. 이 문서에 `완료`라고 적힌 항목도 commit, release,
store-ready를 뜻하지 않는다.

## 1. Outcome

최신 사용자 요청은 캐릭터와 전체 디자인의 게임 기획 정합성이다.
`docs/design/CHARACTER_ART_REVISION.md`가 이 후속 범위의 실행 계획이다.
기존 17개 web surface 완료와 캐릭터 전종 개정은 별개다. 현재 대표 네 종의
versioned art와 shared portrait/token/theatre 연결을 구현했고, 60개 browser capture와
75개 행동·fallback receipt를 검증했다. A0–A4, 독립 code/context/QA review와
인수인계 동기화가 완료되었다. 기존 136 JPG와 이전 evidence를 그대로 보존한다.

2026-09-05 web-completion implementation and verification are recorded in
`docs/design/WEB_COMPLETION_PLAN.md`. All 17 scoped surfaces now have contracts
and evidence in the current worktree, including EndlessResult/Cinematic and
three-viewport aggregate first-state smoke. G0–G5 and independent code/QA/context
reviews are COMPLETE/PASS; earlier dated surface records remain historical evidence.

390×844 portrait canvas에서 플레이어가 첫 화면부터 자신을 던전마스터로
인식하고 다음 loop를 잃지 않게 만든다.

```text
던전 약점 확인
  → 방/수호자/장비 보강
  → 준비도 변화 확인
  → 침입 방어
  → 보상과 군단 확장
  → 다음 보강 선택
```

화면은 generic dashboard나 bright card pack이 아니라 하나의 살아 있는
Korean-folklore dungeon으로 연결되어야 한다. 각 surface는 `현재 상태 → 다음
행동 → 예상 결과`를 한 번에 설명하고, primary action은 하나만 우세해야 한다.

## 2. Mandatory reading order

다른 agent는 수정 전에 아래 순서로 읽는다.

1. `AGENTS.md` — 작업 권한, 안전 규칙, 390×844 기준, verification 명령
2. `docs/design/AGENT_HANDOFF.md` — 현재 snapshot과 다음 작업 경계
3. `docs/MONSTER_DUNGEON_DESIGN.md` — 전역 design authority와 장기 roadmap
4. `docs/design/DESIGN.md` — 실제 완료 surface별 contract와 evidence
   현재 캐릭터 작업은 `docs/design/CHARACTER_ART_REVISION.md`도 읽는다.
5. `CLAUDE.md` — scene/data/runtime 구조 참고
6. 대상 scene, 연결 UI, data transaction, 관련 tests
7. `git status --short --branch`와 대상별 `git diff -- <paths>`

Authority 우선순위는 `AGENTS.md → live code/tests →
docs/MONSTER_DUNGEON_DESIGN.md → docs/design/DESIGN.md → 이 handoff →
README.md`다. `README.md`의 2026-06 “모든 pass 완료” 문구는 과거 roadmap
기록이며, 2026-09 redesign 완료 범위를 판단하는 근거로 사용하지 않는다.

## 3. Runtime and fixed constraints

- Runtime: Phaser 3.88 + TypeScript + Vite 5 + Capacitor 8
- Logical canvas: 390×844, FIT scale, DPR-aware rendering
- Main entry: `src/main.ts`; local dev server: `npm run dev` on port 8083
- Direct QA route: `?skipTutorial=1&scene=<SceneName>`
- Persistence: `dungeonGameState` through `loadGameState()` / `saveGameState()`
- Runtime color authority: `src/constants/colors.ts`
- Shared UI first: `src/ui/GameUiPrimitives.ts`
- Root navigation authority: `src/data/navigationContract.ts`
- Core text: 10px minimum; primary/tabs/reward/purchase targets: approximately
  44px or taller
- Motion: 120–320ms feedback by default; required information must appear without
  motion under `prefers-reduced-motion: reduce`

UI scene에서 `GameState`를 직접 mutate하지 않는다. 상태 변경은 기존
`src/data` transaction을 호출하고 반환된 새 객체만 저장한다. 새 dependency,
save field, balance, route, asset, native shell, store metadata는 별도 승인이 없는
한 추가하지 않는다. 2026-09-05 캐릭터 개정 요청에 따른 대표 네 종의
`ritual-v2` asset과 presentation registry는 명시된 예외다.

## 4. Worktree safety — highest priority

현재 checkout은 clean commit이 아니다. `main@68546cb` 위에 design, combat,
portrait, data, native 설정, 문서, screenshot 변경이 대량으로 섞인 dirty
worktree다.

- 현재 worktree가 이어서 작업할 기준이다. `git reset`, `git checkout --`,
  `git clean`, 광범위한 restore를 실행하지 않는다.
- 미추적 `docs/design/`, tests, helpers, screenshots도 사용자 작업으로 보존한다.
- Android/Capacitor/package와 기존 legacy monster-art 변경은 이번 캐릭터 개정의
  소유 범위가 아니다. 새 `ritual-v2` 경로만 추가하며 기존 JPG는 덮어쓰지 않는다.
- 변경 전후에 대상 path만 `git diff -- <paths>`로 비교한다.
- commit, stage, push, merge, PR, native sync, publishing은 명시 요청 전까지 하지
  않는다.
- 완료 보고는 `current worktree에서 구현·검증됨`으로 표현한다. `main에 반영됨`,
  `release-ready`, `native-ready`라고 표현하지 않는다.

## 5. Design contract already established

### Visual thesis

- Base surfaces: charcoal/indigo stone, soot, iron
- Interaction/reward: restrained brass
- Ready/production/success: jade
- Threat/damage/deficit: ember
- Summon/occult identity: moonlight accent
- Forge/equipment work: copper
- Rarity and chapter colors decorate identity; they do not replace labels
- Structure comes from composition, spacing, silhouette, and cutaway space before
  border, glow, bevel, or card count

### Rejected patterns

- glossy candy caps, cream card piles, pill soup, glassmorphism, neon dashboard
- emoji-only navigation or control affordances
- several CTAs with the same visual weight
- unavailable action that looks enabled
- color-only cost, rarity, readiness, damage, or lock state
- decorative infinite motion without reduced-motion handling
- presentation work that changes economy, eligibility, rewards, save schema, or route

## 6. Completed range in the current worktree

`COMPLETE` means the scoped surface was implemented and received its recorded
unit/build/browser evidence. It does not mean the repository is committed or the
whole game is finished.

| Surface | Status | Implemented outcome | Main code anchors | Evidence authority |
| --- | --- | --- | --- | --- |
| Dungeon Home | COMPLETE | Dashboard를 entrance→rooms→heart→next seal의 living dungeon overview로 변경; 하나의 readiness directive와 spatial target 유지 | `DungeonHomeScene.ts`, `HomeBoard*`, `HomeChrome.ts`, `HomeCommandDeck.ts`, `DungeonBoardLayout.ts` | `DESIGN.md` / Dungeon Home contract |
| Invasion path | COMPLETE | Stage Select를 gate/corridor frontier로, Pre-Battle을 threat→room weakness→launch briefing으로 정리 | `StageSelectScene.ts`, `PreBattleScene.ts`, `PreBattleDefenseUI.ts`, `InvasionUI.ts` | `DESIGN.md` / Invasion Readiness contract |
| Monster raising | COMPLETE | Barracks와 monster detail을 portrait-first growth, equipment, room recommendation 화면으로 변경 | `BarracksScene.ts`, `BarracksGrowthHall.ts`, `BarracksCard.ts`, `MonsterDetail*.ts` | `DESIGN.md` / Monster Raising contract |
| Forge | COMPLETE | target guardian, blueprint, materials, expected power delta, craft/equip/dismantle 흐름을 한 readiness surface로 연결 | `ForgeScene.ts`, `ForgeWorkbench.ts`, `ForgeTabs.ts`, `ForgeCraftFx.ts` | `DESIGN.md` / Forge Readiness contract |
| Room editing | COMPLETE | room detail 첫 viewport를 actual guardian/trap/equipment socket이 보이는 cutaway editor로 변경 | `RoomDetailOverlay.ts`, `RoomDetailInterior*.ts`, `RoomDetailOperations.ts`, `RoomPickerModals.ts` | `DESIGN.md` / Room Editing contract |
| Battle command/outcome | COMPLETE | formation/route/HUD/briefing/tactical dock/boss/result hierarchy를 같은 dungeon language로 통일 | `DungeonScene.ts`, `UIScene.ts`, `BossHud.ts`, `SkillHUD.ts`, `ResultPanel.ts`, `StageClearFlow.ts` | `DESIGN.md` / Battle Command & Outcome contract |
| Summon altar | COMPLETE | bright gacha cards를 physical altar, contract ledger, affordability/pity, history, bounded single/ten-pull result로 교체 | `SummonScene.ts`, `SummonShowcase.ts`, `SummonHistory.ts`, `SummonAnimations.ts`, `SummonPullLogic.ts` | `DESIGN.md` / Summon Altar contract |
| Fusion chamber | COMPLETE | bright emoji 연구소를 four-rite dungeon chamber로 교체하고, 비용·소비·결과·위험·persistent receipt를 한 viewport 흐름으로 연결 | `FusionScene.ts`, `FusionTabs.ts`, four `Fusion*Tab.ts` renderers, `FusionSelectionState.ts` | `DESIGN.md` / Fusion Chamber contract |
| Shop quartermaster | COMPLETE | unbounded bright catalog를 resource ledger, bounded shelves, safe preview, confirm/receipt가 연결된 dungeon quartermaster로 교체 | `ShopScene.ts`, three `Shop*Tab.ts` renderers, `ShopShared.ts` | `DESIGN.md` / Shop Quartermaster contract |
| Production district | COMPLETE | 반복 facility card를 one undercroft cutaway, capped collection cistern, selectable stations, exact command/receipt 흐름으로 교체 | `ProductionScene.ts` | `DESIGN.md` / Production District contract |
| Decoration reliquary | COMPLETE | long card catalog를 four set seals, three relic pedestals, tier ledger, exact acquire/place/remove command와 durable receipt로 교체 | `DecorationScene.ts` | `DESIGN.md` / Decoration Reliquary contract |
| Abyss expedition | COMPLETE | 60-card depth stack을 five-floor shaft window, threat/material ledger, one challenge-or-sweep command, durable return receipt와 supply routes로 교체 | `AbyssScene.ts` | `DESIGN.md` / Abyss Expedition contract |
| Achievement hall | COMPLETE | masked 79-card scroll을 eight category seals, all-84 bounded archive, selected reward ledger, once-only claim과 durable receipt로 교체 | `AchievementScene.ts` | `DESIGN.md` / Achievement Hall contract |
| Codex archive | COMPLETE | omitted/scrolling archive를 all-136 guardian registry, 52 invaders, 17 modifiers, 13 events의 bounded records와 fresh-save tribe reward command로 교체 | `CodexScene.ts`, `CodexMonsterDetail.ts`, `CodexShared.ts` | `DESIGN.md` / Codex Archive contract |
| Ancestral wisdom | COMPLETE | clipped emoji radial map을 four lineage seals, all-12 named branch tablets, exact current→next ledger, shielded once-only upgrade와 durable receipt가 있는 ritual chamber로 교체 | `AncestralWisdomScene.ts`, `AncestralWisdomShared.ts` | `DESIGN.md` / Ancestral Wisdom Chamber contract |
| Endless result | COMPLETE | 종료된 run의 기록·보상·modifier를 expedition memorial에 표시하고 중복 지급 없는 retry/return을 연결 | `EndlessResultScene.ts` | `DESIGN.md` / Endless Result contract, `tools/endless-result-audit.json` |
| Cinematic chronicle | COMPLETE | 원본 대사를 stone theatre와 speaker/folio로 표시하고 reveal·advance·skip·auto-pause를 owned lifecycle로 연결 | `CinematicScene.ts` | `DESIGN.md` / Cinematic contract, `tools/cinematic-audit.json` |

### Completion details that must be preserved

- Home, room, Barracks, Forge, Pre-Battle은 동일한 readiness vocabulary와
  focused-room return context를 사용한다.
- Root navigation은 `dungeon / legion / forge / invasion` 네 zone을 유지한다.
  Summon, Codex, Shop, Fusion, Skill은 Legion 내부 route이지 root zone이 아니다.
- Battle result와 Summon result의 background input shielding, once-only action,
  reduced-motion, delayed callback cleanup을 약화하지 않는다.
- Summon은 rapid cross-button input에도 transaction 한 번만 저장하도록
  scene-level in-flight latch를 사용한다.
- Fusion은 CTA `pointerdown`에서 scene-level transaction latch를 획득하고,
  confirmation/animation/result 전체에서 background input을 차단한다.
- Combination retained source는 live owned roster와 다시 결합한다. 선택한 copy가
  사라졌으면 같은 ID의 실제 남은 copy를 표시·사용하고, source가 없으면 slot을
  비운다. Transaction authority도 미보유 source를 거부한다.
- Shop은 card skin purchase와 preview purchase-and-equip을 구분한다. Theme purchase는
  즉시 equip하고, owned theme/skin의 equip·unequip은 추가 결제 없는 reversible action이다.
- Shop purchase confirmation은 scene-level latch와 full-screen shield를 유지한다.
  Daily offer는 confirm 시 현재 UTC catalog에 다시 포함되는지 검증하며, 자정에
  교체된 offer는 저장 없이 거부하고 latch 해제 뒤 한 개의 scene timer가 shelf를 갱신한다.
- Production은 selection을 저장하지 않고 build/upgrade와 collect만 기존 pure
  transaction으로 저장한다. 현재 render의 enabled action은 once-only이며, facility
  비용·rate·max와 idle cap/decoration multiplier는 data authority를 그대로 따른다.
- Decoration은 set/relic selection을 저장하지 않고 acquire/place/remove만 기존
  pure transaction 결과로 저장한다. 12개 catalog, 비용, slot scaling, tier와 bonus
  aggregation은 data authority를 그대로 따르며 transaction latch와 durable receipt를 유지한다.
- Abyss는 page/floor selection을 저장하지 않는다. Daily key refill, cleared-floor
  sweep, next-floor battle, first-clear loot/depth, 60-floor scaling/boss/loot/wave
  authority는 기존 data/transaction/result flow를 유지하며, rapid/cross-input latch와
  persistent sweep/return receipt를 보존한다.
- Achievement는 category/page/record selection을 저장하지 않는다. 79개 base와
  5개 epilogue definition, progress/unlock 계산, individual/claim-all reward
  transaction, save schema, previous-scene return은 기존 authority를 유지한다.
  Pointer-down transaction latch, 250ms cooldown, durable receipt, stale-claim
  non-mutation, all-84 reachability를 보존한다.
- Codex는 tab/group/page/record/filter selection을 저장하지 않는다. Eleven tribes와
  presentation-only `기타`가 136종을 모두 노출하고, nine chapters의 52 invaders,
  17 modifiers, 13 events를 bounded controls로 열어야 한다. Tribe requirement는
  mapped reward와 모든 `codex_reward` record를 제외하고 fresh save에서 다시 계산한다.
  Existing reward transaction, previous-scene return, four-zone root navigation,
  route/transaction shared latch, persistent receipt, all-record reachability를 보존한다.
- Ancestral Wisdom은 lineage/branch selection을 저장하지 않는다. Four lineages가
  authoritative 12 branches를 정확히 한 번씩 노출하고, live code에 실제 존재하는
  `upgradeWisdomBranch`만 호출한다. Confirm 당시 branch/tier/cost/balance snapshot과
  fresh save가 정확히 일치할 때만 returned success state를 한 번 저장하며,
  confirm/cancel shared admission, pending-render guard, 250ms cooldown, full-screen
  shield, durable success/stale receipt, previous-scene return을 보존한다. Equip/reset
  transaction이나 save field는 없으므로 새로 만들지 않는다.
- Portrait asset이 없으면 기존 procedural fallback이 동작해야 한다.
- EndlessResult는 upstream registry receipt만 표시하며 저장·보상을 재실행하지
  않는다. Retry의 `{ stageNumber: 0, slots: 9, endless: true }`, StageSelect return,
  첫 pointerdown route latch를 유지한다.
- Cinematic은 기존 text/order/side/pause와 caller nextScene/nextData, entry 시
  seen-once 저장을 유지한다. Phase/version admission과 line-owned timer/tween
  cleanup으로 중복 advance/finish와 stale auto-pause를 차단한다.

### Latest aggregate evidence

2026-09-05 character-art revision record:

- First four of136 redesigned; remaining132 and all existing JPGs preserved.
- Focused3files/40tests, full104files/2,876tests, TypeScript, production build,
  legacy portrait check and diff-check passed; large-chunk advisory remains.
- `tools/character-art-audit.json`:60 DPR2 captures,3 viewports, normal/reduced
  speaker input, exact save neutrality after entry, real renderer fallback and
  three-entry lifecycle. No console/runtime errors, enforced failures or source drift.
- 8 contact sheets visually reviewed;75 receipts passed;81 hash entries matched.
  Independent code/export, context and QA cross-reviews PASS. Owned browsers and
  dev server closed;TCP8083 listener absent. No stage/commit/push/native/publish.
- Exact scope and known observations: `CHARACTER_ART_REVISION.md`. Seeded fixtures
  are not organic campaign/acquisition; 8px decorative route-order and 48px world
  sprite softness remain pre-existing limitations, not covered-up zero-debt claims.

2026-09-05 overall web-completion record (before character-art revision):

- Focused wave/modifier 2 files / 18, story/cinematic 2 files / 76,
  Barracks/Summon/HUD 4 files / 186 tests passed.
- Full `npm test`: 103 files / 2,846 tests passed; TypeScript, production build
  and diff-check passed. Existing Vite large-chunk advisory remains.
- Aggregate browser smoke: 45 initial-state captures + three active-banner
  captures at 360×800 / 390×844 / 430×932, DPR 2. Four root routes and four
  selection-save neutrality checks passed; no runtime/console errors, fixed
  overflow, rendered sub-10px logical text or sub-44px logical targets.
- EndlessResult: 15 state captures, all 17 modifiers, normal/reduced route races,
  stable three restarts and upstream +9 crystals with neutral redisplay passed.
- Cinematic: all 21 definitions / 80 lines in both motion modes (160 checks),
  six alternate-size representative states, seen-once and exact contextual route,
  pause/input races and lifecycle checks passed.
- Reproducible scripts and exact source/PNG hashes are in `scripts/verify-*.mjs`
  and the three JSON ledgers referenced in section 18. Independent code/authority,
  QA/evidence and goal/context reviews passed. All 34 source-hash entries and 73
  image-hash entries matched; 198 literal document paths and fences passed.
- Verification browsers and the owned Vite server were closed; TCP 8083 listener
  absent. No commit/stage/push/merge/PR/native sync/publishing performed.
- This is first-state responsive smoke plus scoped interaction evidence, not
  every nested modal, organic campaign/endless/Abyss completion or native QA.

2026-09-03 current-worktree record:

- Full `npm test`: 99 files, 2,824 tests passed
- `npm run build`: passed
- `git diff --check`: passed
- Vite의 existing large-chunk advisory는 남아 있음
- 390×844, DPR 2 browser smoke에서 변경 scene의 application exception/console
  error가 보고되지 않음
- 세 독립 review angle(goal/context, code/security, QA/evidence)이 Summon close-out을
  PASS 처리함

2026-09-04 Fusion close-out record:

- Focused Fusion checks: 3 files, 128 tests passed
- `npx tsc --noEmit`: passed
- Full `npm test`: 100 files, 2,830 tests passed
- `npm run build`: passed; existing large-chunk advisory remains
- `git diff --check`: passed after implementation and evidence synchronization
- Final-source 390×844, DPR 2 browser harness: 19 state captures, transaction
  receipts, normal/reduced-motion race, three-cycle cleanup, stale-source guard,
  console/runtime audit passed; recorded SHA-256 values matched all PNGs
- Three independent review angles(goal/context, code/security, QA/evidence) passed
  after the stale-source fix and coupled-document synchronization

2026-09-04 Shop close-out record:

- Focused Shop checks: 3 files, 25 tests passed
- `npx tsc --noEmit`: passed
- Full `npm test`: 102 files, 2,837 tests passed
- `npm run build`: passed; existing large-chunk advisory remains
- `git diff --check`: passed
- Final-source 390×844, DPR 2 browser harness: four catalogs, bounded pagination,
  preview/confirm/result shields, cancel/success/failure, card-versus-preview skin
  semantics, theme fallback, daily purchases, rapid/cross-tab input, simulated UTC
  rollover rejection, Barracks return, and three-cycle cleanup passed
- Independent review angles found and closed the UTC rollover stale-offer edge;
  final goal/context, code/security, and QA/evidence verdicts are recorded at close-out

2026-09-04 Production close-out record:

- Focused Production/idle/HUD-formatting checks: 4 files, 39 tests passed
- `npx tsc --noEmit`: passed
- Full `npm test`: 102 files, 2,837 tests passed
- `npm run build`: passed; existing large-chunk advisory remains
- `git diff --check`: passed after implementation and evidence synchronization
- Final-source 390×844, DPR 2 browser harness: empty/deficit, operating/capped,
  maxed, build/upgrade/collect receipts, selection non-mutation, disabled actions,
  normal/reduced rapid and cross-input, post-cooldown retry, high-balance HUD,
  back route, and three-cycle lifecycle passed
- Eight screenshot hashes and exact transaction deltas are recorded in the
  Production District contract

2026-09-04 Decoration close-out record:

- Focused decoration/transaction/idle-income checks: 3 files, 43 tests passed
- `npx tsc --noEmit`: passed
- Full `npm test`: 102 files, 2,837 tests passed
- `npm run build`: passed; existing large-chunk advisory remains
- `git diff --check`: passed after implementation and evidence synchronization
- Final-source 390×844, DPR 2 browser harness: four sets, twelve relics,
  gold/craft acquisition, place/remove, tier transition, deficit/full-slot,
  normal/reduced rapid and cross-input, post-cooldown recovery, high-balance HUD,
  back route, and three-cycle lifecycle passed
- Eleven screenshot hashes and exact state deltas are recorded in the Decoration
  Reliquary contract
- Independent goal/context, code/transaction, and QA/evidence reviews passed
  after the contract/progress wording was synchronized to the implemented scope

2026-09-04 Abyss close-out record:

- Focused Abyss checks: 2 files, 34 tests passed
- `npx tsc --noEmit`: passed
- Full `npm test`: 102 files, 2,837 tests passed
- `npm run build`: passed; existing large-chunk advisory remains
- `git diff --check`: passed after implementation, evidence, and handoff synchronization
- Final-source 390×844, DPR 2 browser harness: five-floor paging through all 60
  targets, save-neutral selection, daily refill, no-key disabled action, sweep
  receipt/deltas, rapid/cross-input and cooldown recovery, boss challenge registry,
  returned win/loss one-time consumption, max floor, three routes, and three-cycle
  lifecycle passed
- Ten screenshot hashes and exact state/registry receipts are recorded in the
  Abyss Expedition contract
- Independent goal/context, code/transaction, and QA/evidence reviews passed after
  the route-listener race fix and final coupled-document synchronization

2026-09-04 Achievement close-out record:

- Focused achievement/progression/reward checks: 4 files, 187 tests passed
- `npx tsc --noEmit`: passed
- Full `npm test`: 102 files, 2,837 tests passed
- `npm run build`: passed; existing large-chunk advisory remains
- `git diff --check`: passed after implementation and evidence synchronization
- Final-source 390×844, DPR 2 browser harness: eight categories, all 84 unique
  records over 28 pages, save-neutral navigation, individual/cooldown/claim-all,
  epilogue and stale claims, claim/back race, exact receipts, reduced motion, and
  three-cycle lifecycle passed with zero timers/tweens/scene drag listeners
- Ten screenshot hashes and exact transaction deltas are recorded in the
  Achievement Hall contract
- Independent goal/context, code/transaction, and QA/evidence reviews passed
  after the reduced-motion latch-release fix, current-source browser regeneration,
  and coupled-document synchronization

2026-09-04 Codex close-out record:

- Focused Codex/monster/reward/navigation checks: 10 files, 500 tests passed
- `npx tsc --noEmit`: passed
- Full `npm test`: 102 files, 2,841 tests passed
- `npm run build`: passed; existing large-chunk advisory remains
- `git diff --check`: passed after implementation and evidence synchronization
- Browser evidence reached all 136 guardian records, twelve groups, all 52
  invaders/nine chapters, 17 modifiers, and 13 events without save mutation;
  the final source's two additional route-latch statements were covered by the
  subsequent current-source visual, transaction, modal, and route/race reruns.
  Individual/aggregate/already-owned/stale reward paths, duplicate/cross-input,
  cooldown retry, detail isolation, normal/reduced route races, contextual/root
  routes, and three-cycle lifecycle passed with exact receipts.
- Ten final screenshot hashes, four source hashes, exact transaction deltas, and
  the standard-client boundary are recorded in the Codex Archive contract.
- Independent goal/context, code/transaction, and QA/evidence reviews passed
  after closing a reduced-motion route-to-order race and synchronizing the
  three-versus-four page-size wording and completion records.

2026-09-04 Ancestral Wisdom close-out record:

- Focused Wisdom/presentation checks: 3 files, 96 tests passed
- `npx tsc --noEmit`: passed
- Full `npm test`: 103 files, 2,846 tests passed
- `npm run build`: passed; existing large-chunk advisory remains
- `git diff --check`: passed after implementation and evidence synchronization
- Final-source 390×844, DPR 2 browser harness: all four lineages/all twelve
  branches, save-neutral selection, affordable/deficit/maxed states, exact
  `goldHands 2→3` and soul-crystal `100→80` success, shield/cancel, exact stale
  snapshot rejection, normal/reduced cross-input, cooldown recovery, contextual
  and fallback return, and three-cycle lifecycle passed
- Seven final screenshot hashes, three source hashes, four authority hashes,
  exact transaction deltas, and the standard-client boundary are recorded in
  the Ancestral Wisdom Chamber contract
- Independent review findings closed the confirm/cancel admission race,
  fresh-save consequence drift, branch→obsolete-order lock, and coupled-document
  gaps; final goal/context, code/transaction, and QA/evidence verdicts passed

상세 screenshot path, SHA-256, interaction receipt, iOS 검증 여부는
`docs/design/DESIGN.md` 각 contract의 dated `Verification record`를 사용한다.
Fusion, Shop, Production, Decoration, Abyss, Achievement, Codex, Ancestral Wisdom은 2026-09-04 record,
이전 surface는 각 기록 날짜가 권위다. Battle, Summon, Fusion, Shop,
Production, Decoration, Abyss, Achievement, Codex, Ancestral Wisdom은 web renderer 기준이며 전체 native
release readiness를 의미하지 않는다.

## 7. What is not complete

현재 계획의 17개 surface redesign은 완료되었다. 아래는 후속 acceptance이며,
기능이 없다는 뜻이나 이미 검증한 화면을 다시 구현하라는 지시가 아니다.

- 현재 우선순위는 `CHARACTER_ART_REVISION.md`의 캐릭터 개정이다. 첫 네 종을
  기준으로 남은 132종과 NPC/invader의 batch acceptance를 순차 확정한다.
  네 종 완료를 all-136 redesign이나 전체 native-ready로 보고하지 않는다.
- 이전 추천인 progression-valid organic gameplay acceptance(Abyss win/loss,
  campaign/endless endurance)는 후속 목록에 유지한다. 캐릭터 요청이
  balance/data/native 변경 권한을 열지는 않는다.
- ~~Nested modal/selection/result states at 360×800 and 430×932~~
  → CLOSED 2026-09-16. Viewport 축은 구조적으로 닫혔고, modal/selection/result
  17개 상태를 재현 가능한 하네스로 감사했다. 아래 기록 참조.
- Abyss floor battle: hand-off seam은 닫혔고, 남은 것은 organic play-through
  (실제 wave를 싸워서 이기는 구간)이다. 아래 2026-09-16 기록 참조.
- Whole-app Android/iOS packaging and store release validation
- ~~Clean commit/merge/release history for the accumulated dirty worktree~~
  → CLOSED 2026-09-16. 아래 기록 참조.
- ~~Global performance/bundle remediation for the existing large-chunk advisory~~
  → CLOSED 2026-09-16. 아래 기록 참조.

### 2026-09-16 — worktree 정리 · 번들 · viewport/modal 검증

**Worktree (CLOSED).** 누적 dirty worktree를 4개 논리 commit으로 정리했다:
`f4ed54a` src 160개(신규 25개 포함) / `fb5e641` 설계 문서·검증 스크립트·
ritual-v2 아트 / `5e95f39` Capacitor 8 동기화 + native safe-area /
`34d59b6` 증빙·아트 마스터 + QA 캡처 gitignore. 정리 전 상태에서 신규 소스
25개가 미추적이었고 그 중 12개(`ShopShared` 5곳, `characterArt` 5곳,
`HudResourceFormatting` 8곳 등)가 이미 프로덕션 경로에서 import되고 있어
`git checkout`/`clean` 한 번에 앱이 깨지는 상태였다. 이제 worktree는 clean이다.
`tools/screenshots/`(117MB), `.playwright-cli/`, `output/playwright/`는
gitignore로 제외하고, 이미 추적 중이던 캡처 11장은 유지했다.

**Bundle (CLOSED).** `app-gameplay` 단일 청크가 858KB로 Vite 500KB 임계를
넘고 있었고 `vite.config.ts` 주석의 "stays under 500KB"는 사실과 달랐다.
`app-scenes`(265KB) / `app-ui`(392KB) / `app-combat`(206KB)로 분리해 모든 앱
청크를 임계 미만으로 내렸다(`d691af6`). 주석이 우려하던 circular-chunk 위험은
실측으로 반증했다 — 빌드 경고 0, built output 부팅 후 허브 12개 씬과
DungeonScene/UIScene 전환 전부 성공, console error 0. `phaser`(1.48MB)는 단일
vendor 라이브러리라 custom build 없이 분리 불가하며 advisory가 남는 것이
정상이다. `chunkSizeWarningLimit`은 앱 청크 회귀를 계속 잡기 위해 기본값을
유지했다. Scene lazy-load는 채택하지 않았다: 20개 씬이 `main.ts`에서 즉시
등록되고 Capacitor 셸에서 `dist/`를 로컬로 읽으므로, 81개 `scene.start`
호출부를 async로 바꾸는 위험 대비 전달 이득이 없다.

**Viewport 축 (CLOSED).** `main.ts`는 `Phaser.Scale.FIT` + 고정
`390×844` 논리 캔버스를 쓴다. 브라우저 viewport가 바뀌어도 논리 좌표계는
그대로이고 letterbox/scale만 변하므로, 360×800과 430×932는 레이아웃 reflow를
만들지 않는다. 즉 "360×800 / 430×932에서 다시 본다"는 별도 축이 아니다.
`verify-web-surfaces.mjs`가 bounds를 390×844로 재는 것도 이 때문에 올바르다.
디바이스별로 실제 달라지는 것은 safe-area inset이며, 이는 `index.html`의
`max(env(safe-area), --native-safe-*)`가 담당한다(`5e95f39`).

**Modal 검증 (PARTIAL).** `verify-web-surfaces.mjs` 재실행(현재 분리 빌드
기준): 45 initial captures / 3 viewports, errors 0, hardFailures 0,
fixedOverflow 0, scrollBoundaryPartials 0, undersizedTargets 0,
textBelow10 0. 유일한 flag는 ShopScene 6건 + DungeonHomeScene 1건의
`overlapCandidates`인데, 실물 확인 결과 썸네일 모서리에 의도적으로 겹쳐 둔
배지 칩(⚔/◆/✦/◐)이라 결함이 아니다. 중첩 modal은 Shop `외형 검수대`를
직접 열어 계측했다 — worldView 정확히 390×844, fixedOverflow 0,
undersized target 0, 10px 미만 텍스트 0, interactive 21개. Barracks 몬스터
상세 modal도 정상 개방(visible object 105→201)을 확인했다.
남은 것: 나머지 surface의 confirm/result/picker 상태 전수. 임시 probe가
보고하는 추가 overflow는 `scrollFactor:0` 고정 하단 내비의 월드 좌표
artifact이므로 실결함으로 계수하지 않는다.

**Abyss hand-off seam (CLOSED).** `AbyssScene.climb()` → `DungeonScene` →
`resolveReturnedBattle()` 왕복을 실제 런타임에서 세 경로 전부 태웠다:
승리 시 `clearAbyssFloor` 적용 + `highestFloor 0→1` + firstClear receipt,
패배 시 `highestFloor` 불변 + 재도전 안내, `battleResult` 부재 시 상태 불변
+ "결과 확인 불가". 세 경우 모두 `abyssPendingFloor`/`battleResult`/`returnTo`
잔여가 없음을 확인했다(console error 0).

이 과정에서 계약 결함을 하나 고쳤다: `navigationContract.ts`는 스스로를
"transient hand-off의 테스트 가능한 기록"이라 선언하면서도 `battle-result`가
`returnTo` 하나만 소비한다고 적어, 실제로 3개를 소비하는 abyss 복귀를
과소 선언하고 있었다. `abyssPendingFloor`/`battleResult` 필드와 `abyss-return`
연산을 추가하고, `AbyssScene`이 수동 `registry.remove` 3회 대신 그 계약을
순회하도록 바꿔 선언과 런타임이 갈라질 수 없게 했다. 회귀 테스트를
`navigationContract.test.ts`에 추가했다(6→7 케이스).

남은 것: organic play-through. 위 검증은 hand-off 계약과 정산을 닫은 것이지,
실제 wave를 싸워 이기는 전투 구간을 대체하지 않는다.

**Modal/selection/result 전수 (CLOSED).** `scripts/verify-modal-states.mjs`를
신설해 각 surface의 초기 상태에서 한 단계 더 들어간 17개 상태를 감사했다:
`{cases:17, fixedOverflow:0, undersizedTargets:0, textBelow10:0, errors:0,
hardFailures:0}` (`tools/modal-state-audit.json`).

덮은 상태 유형:
- 오버레이 modal — Shop 외형 검수대/구매 확인, Codex 수호자 상세,
  Fusion 재료 피커, Summon 확률 상세, Barracks 관리
- 인라인 selection — Wisdom 가지, Achievement 기록, Production 시설,
  Decoration 유물 (텍스트 수가 1:1 교체되어 개수는 불변이나 선택은 반영됨)
- 탭 전환 — Codex 침략자, Fusion 흡수, Forge 분해
- **자원 게이트 뒤 confirm 레이어** — 기본 픽스처는 보석/영혼수정이 0이라
  도달 자체가 불가능했다. 해당 게이트가 요구하는 자원만 시드해 열었고,
  Wisdom `의식 승인` modal이 등급 0→1·소모 5·보유 500→495의 정확한
  스냅샷을 렌더하는 것을 확인했다.

구조 변경: `verify-web-surfaces.mjs`의 `openScene`/`inventory`/`logicalClick`/
`namedClick`을 `scripts/lib/web-audit.mjs`로 **순수 추출**해 두 하네스가 동일
기하로 측정하도록 했다(갈라지면 두 감사 수치가 비교 불가능해진다). 추출은
동작 변경이 없음을 실증했다 — 추출 전후 표면 하네스 summary가
`{45,3,0,0,4,4}`로 동일하다. `openScene`에 선택적 `seed`를 추가했고 기본값은
기존과 같다. 입력 탐색용 `scripts/discover-inputs.mjs`도 추가해 트리거를
추측이 아니라 실측 라벨로 고르게 했다.

남은 것: overlapCandidates 48건은 hardFailure가 아닌 review candidate이며,
표본 확인 결과 썸네일 배지·아이콘 칩의 bounding-box 중첩이었다. 전수 육안
심사는 하지 않았다.

현재 사용자 요청과 `CHARACTER_ART_REVISION.md`에 따라 다음 한 batch의 exact IDs,
acceptance와 허용 파일을 먼저 확정한다. Packaging/publishing 권한은 포함되지 않는다.

## 8. Completed implementation record: Fusion Chamber

사용자가 2026-09-04에 Fusion continuation을 승인했고, 아래 F0–F4 slice는 current
worktree에서 구현·검증되었다. 이 절은 동일 작업을 다시 실행하라는 지시가 아니라
완료 당시의 product/behavior/verification boundary를 보존하는 기록이다.

### Product job

Fusion은 bright emoji 연구소가 아니라 군단을 재구성하는 dungeon ritual chamber다.
플레이어는 무엇을 잃는지, 무엇이 생성되거나 성장하는지, 비용과 실패 가능성이
무엇인지 확인한 뒤 하나의 irreversible action을 실행해야 한다.

### Existing authoritative behavior

`src/data/fusionTransactions.ts`가 아래 상태 전이를 이미 pure function으로
소유한다. UI redesign은 이를 변경하지 않는다.

| Tab | Existing rule to preserve |
| --- | --- |
| 진화 | 같은 monster 3개를 소비해 다음 evolution을 만들고 선택 재료 중 최고 level을 유지한다. |
| 흡수 | target과 sacrifices를 분리하고, 희생체를 제거해 XP/absorption stack을 적용한다. Target을 sacrifice로 선택할 수 없다. |
| 조합 | owned roster의 서로 다른 2개와 soul crystal 100을 사용한다. Known recipe는 hybrid/discovery를 만들고, unknown recipe는 crystal을 소비하지만 fusion progress를 올리지 않는다. |
| 각성 | owned target, affinity 100, awakening stone 1, not-awakened 조건을 모두 검증한다. |

`totalFusions`, quest progress, `discoveredCombinations`, owned monster copy,
equipment/skill fields의 성공 의미는 보존했다. 독립 review에서 확인된 stale-source
integrity defect에 한해 `combination_source_not_owned` rejection을 추가했다. 이
guard는 crystal이나 roster를 변경하지 않으며 focused regression으로 고정했다.

### Baseline design debt closed in this record

- `FusionScene.ts`가 `CASUAL` cream tray와 bright storybook background를 사용한다.
- header와 ritual focus가 `🔬 연구소`, `🪄` emoji에 의존한다.
- 네 tab의 target/material/result/destructive consequence hierarchy가 분리되어 있다.
- 일부 codex text는 9px이며 close action이 44px surface가 아니다.
- combination/confirmation/result UI가 text objects와 scene-local custom drawing을
  반복한다.
- motion guard가 일부 존재하지만 tab focus, confirm, success/failure, picker,
  lifecycle 전체의 reduced-motion/browser evidence는 없다.

### Implementation phases

F0–F4는 2026-09-04 current-worktree record에서 모두 완료했다.

#### F0 — Read-only audit

1. `FusionScene`을 390×844 real renderer로 연다.
2. 진화/흡수/조합/각성, monster picker, combination codex, confirm, success/fail을
   각각 캡처한다.
3. empty, eligible, insufficient, destructive, known/unknown result 상태를 분리한다.
4. current click destinations, saved fields, timers/tweens, text/touch inventory를
   기록한다.

#### F1 — Contract and shell

1. `docs/design/DESIGN.md`에 `Fusion Chamber Design Contract`를 추가한다.
2. stone lintel, resource/status rail, 44px four-tab bar, ritual chamber shell을
   existing tokens/primitives로 교체한다.
3. default 진화 tab에서 target/material/result/consequence/one CTA가 첫 viewport에
   읽히게 한다.
4. 이 단계에서 transaction/data/recipe/economy를 수정하지 않는다.

#### F2 — Four transaction surfaces

1. 진화: 세 matching slots, resulting guardian preview, consumed identities
2. 흡수: primary target, sacrifice volume, XP/stack delta, irreversible warning
3. 조합: two source guardians, crystal cost, known/unknown outcome language,
   unknown failure still consumes 100 crystals라는 explicit warning
4. 각성: portrait-first target, affinity, stone state, already-awakened state,
   affected result

각 tab은 empty/disabled information을 숨기지 않고 action만 비활성화한다.

#### F3 — Shared overlays and lifecycle

Picker, confirm, codex, success/failure result의 input shield와 44px action을
통일한다. rapid double-tap 또는 서로 다른 tab action race로 transaction이 두 번
실행되지 않아야 한다. scene exit/re-entry 후 timer, tween, listener, blocker가
증가하지 않아야 한다.

#### F4 — Evidence and close-out

- exact 390×844 screenshots and SHA-256
- empty/eligible/insufficient/confirm/success/fail/known/unknown/awakened states
- one real transaction per tab where safe fixtures are available
- destructive cancel and confirm paths
- reduced-motion result/picker/confirm checks
- three-cycle scene restart cleanup and console audit
- focused fusion tests, full tests, build, diff check
- independent goal, code/security, QA evidence review

## 9. Fusion implementation files and completed boundary

### Read first

- `src/scenes/FusionScene.ts`
- `src/ui/FusionTabs.ts`
- `src/ui/FusionEvolutionTab.ts`
- `src/ui/FusionAbsorptionTab.ts`
- `src/ui/FusionCombinationTab.ts`
- `src/ui/FusionAwakeningTab.ts`
- `src/data/fusion.ts`
- `src/data/fusionTransactions.ts`
- `src/data/fusionTransactions.test.ts`
- `src/ui/GameUiPrimitives.ts`
- `src/constants/colors.ts`
- `src/utils/reducedMotion.ts`

### Writable boundary used for this close-out

- `src/scenes/FusionScene.ts`
- `src/ui/FusionTabs.ts`
- the four `src/ui/Fusion*Tab.ts` renderers
- a small Fusion-specific presentation helper/test only when duplication proves it
  necessary
- `src/ui/FusionSelectionState.ts` and its focused test
- `docs/design/DESIGN.md`
- `tools/screenshots/fusion-*.png`

`src/data/fusion.ts` and `src/data/fusionTransactions.ts` are read-only behavior
authority for a visual pass. A verified transaction defect requires a separate,
explicitly explained change and focused tests.

이번 close-out에서는 independent code review가 stale Combination source로
미보유 guardian을 합성할 수 있는 defect를 재현해 `src/data/fusionTransactions.ts`
와 focused test만 예외적으로 수정했다. 다음 surface의 writable boundary는 아직
승인되지 않았다.

## 10. Verification commands and evidence contract

Run the smallest focused check first, then the aggregate gate.

```bash
npm test -- --run src/data/fusion.test.ts src/data/fusionTransactions.test.ts
npx tsc --noEmit
npm test
npm run build
git diff --check
```

Browser route:

```text
http://127.0.0.1:8083/?skipTutorial=1&scene=FusionScene
```

For every rendered state, record:

- fixture/state and whether it mutates isolated localStorage
- viewport and DPR
- screenshot path and SHA-256
- primary/recovery/destructive interaction result
- visible text below 10px and touch targets below 44px
- overlap/clipping/horizontal overflow
- reduced-motion behavior
- console/runtime exceptions
- remaining unverified device or state

Do not run `npx cap sync`, Xcode/Gradle build, asset generation, or store tooling as
part of Fusion F0–F4 unless the user separately includes native/release work.

## 11. Completed implementation record: Shop Quartermaster

사용자가 2026-09-04에 다음 step 진행을 승인했고, Shop을 Legion economy의 남은
핵심 transaction surface로 선택했다. 이 절은 완료 당시의 scope와 invariant를
보존하는 기록이며 다시 구현하라는 지시가 아니다.

### Product job and preserved behavior

Shop은 bright card catalog가 아니라 군단의 resource와 보급 결정을 처리하는
dungeon quartermaster다. 첫 viewport에서 gem, soul crystal, UTC restock, 현재
department, merchandise state, cost, 다음 action을 함께 읽을 수 있어야 한다.

| Surface | Existing rule preserved |
| --- | --- |
| Skin card | 구매는 owned skin에만 추가하고 자동 장착하지 않는다. |
| Skin preview | 미보유 구매는 purchase-and-equip, 보유 skin은 무료 equip이다. |
| Theme | 구매 시 즉시 equip; owned equip과 non-default unequip은 추가 결제가 없다. |
| Daily equipment | current UTC offer만 soul crystal로 한 번 구매해 unique inventory에 추가한다. |
| Daily skill | current UTC offer만 soul crystal로 한 번 구매해 unique inventory에 추가한다. |

`src/data/shopTransactions.ts`, prices, skin/theme/item registries, UTC shuffle/seed,
save schema, and `BarracksScene` back destination remain authoritative and unchanged.

### Baseline debt closed

- Skin controls/text reached y=1,161/y=1,311 and Theme text reached y=898 without
  scrolling or pagination.
- Skin/theme/preview contained sub-10px labels, and visible 26–30px buttons relied
  on invisible 44px zones.
- Skin preview did not block background tab input.
- Equipment/Skill each added a second reset timer and successful daily purchase did
  not refresh the header crystal balance.

The completed layout uses one ledger, four 44px tabs, Skin shelves of four, Theme
shelves of three, one scene-owned recurring timer, a shielded portrait preview,
and a shared purchase confirm/persistent receipt. Ordinary tab/filter/page refresh
does not restart the scene.

### Implementation and writable boundary used

- `src/scenes/ShopScene.ts`
- `src/ui/ShopSkinTab.ts`
- `src/ui/ShopThemeTab.ts`
- `src/ui/ShopDailyTab.ts`
- `src/ui/ShopShared.ts`
- `src/ui/ShopShared.test.ts`
- `src/ui/ShopDailyTab.test.ts`
- `docs/design/DESIGN.md`
- `docs/design/AGENT_HANDOFF.md`
- `progress.md`
- `tools/screenshots/shop-*-final-390x844.png`

No Shop work was authorized in `src/data/shopTransactions.ts`, catalog/price files,
navigation authority, package manifests, assets, Capacitor/native projects, or
unrelated dirty paths. The implemented UTC boundary guard is UI-layer validation:
an offer removed by the current daily rotation returns a persistent non-mutating
receipt, and the pending day index is accepted only after the transaction latch
releases.

### Verification commands and browser evidence

```bash
npm test -- --run src/data/shopTransactions.test.ts src/ui/ShopShared.test.ts src/ui/ShopDailyTab.test.ts
npx tsc --noEmit
npm test
npm run build
git diff --check
```

Browser route:

```text
http://127.0.0.1:8083/?skipTutorial=1&scene=ShopScene
```

Exact screenshots, SHA-256 values, transaction receipts, state deltas, UI metric
counts, and lifecycle signature are in `docs/design/DESIGN.md` under
`Shop Quartermaster Design Contract / Verification record — 2026-09-04`.
Native packaging and alternate whole-app viewport regression remain outside this
web-only slice. Battle handoff/return은 browser registry simulation과 source-flow
대조로 검증했으며 실제 floor battle 전체 play-through는 아직 수행하지 않았다.

## 12. Completed implementation record: Production District

사용자가 2026-09-04에 다음 step 진행을 승인했고, Production을 completed Home과
Forge/Fusion 사이의 bounded resource loop로 선택했다. 이 절은 완료 당시의 scope와
invariant를 보존하는 기록이며 다시 구현하라는 지시가 아니다.

### Product job and preserved behavior

Production은 facility catalog가 아니라 광산, 약초원, 직조실, 마력 우물, 보물고가
한 생산망으로 연결된 working undercroft다. 모든 station을 한 번에 읽되, 선택한
facility의 current→next output, exact cost/shortage, and one order만 command plate에서
우세하게 보여 준다. Claimable payout은 별도 jade collection action이 우선한다.

`src/data/production.ts`, `src/data/productionTransactions.ts`,
`src/data/idleIncome.ts`, save schema, decoration bonus, and `StageSelectScene` back
destination은 authority로 유지되며 변경되지 않았다. Facility selection은 저장하지
않는다. Build/upgrade와 collect만 반환된 새 `GameState`를 저장한다.

### Implementation and writable boundary used

- `src/scenes/ProductionScene.ts`
- `docs/design/DESIGN.md`
- `docs/design/AGENT_HANDOFF.md`
- `progress.md`
- `tools/screenshots/production-*-390x844.png`

No Production work was authorized in data authorities, `wisdom.ts`, navigation,
package manifests, assets, Capacitor/native projects, or unrelated dirty paths.
Enabled transaction controls lock through the press tween and admit one commit per
250ms gesture burst. A rejected duplicate leaves the rebuilt control usable; a
successful action destroys the old display/input objects before rebuilding the
scene, and its receipt remains visible.

### Verification commands and browser evidence

```bash
npm test -- --run src/data/production.test.ts src/data/productionTransactions.test.ts src/data/idleIncome.test.ts src/ui/HudResourceFormatting.test.ts
npx tsc --noEmit
npm test
npm run build
git diff --check
```

Browser route:

```text
http://127.0.0.1:8083/?skipTutorial=1&scene=ProductionScene
```

Exact screenshots, SHA-256 values, transaction deltas, UI metric counts, and
lifecycle signatures are in `docs/design/DESIGN.md` under
`Production District Design Contract / Verification record — 2026-09-04`.
Native packaging and alternate whole-app viewport regression remain outside this
web-only slice.

## 13. Completed implementation record: Decoration Reliquary

사용자가 2026-09-04에 다음 step 진행을 승인했고, Decoration을 completed Production
economy와 battle readiness를 연결하는 bounded bonus-composition surface로 선택했다.
이 절은 완료 당시 scope와 invariant를 보존하는 기록이며 다시 구현하라는 지시가 아니다.

### Product job and preserved behavior

Decoration은 product-card catalog가 아니라 수집한 전리품을 세트로 조율하는 dungeon
reliquary다. 네 set을 한 화면에서 비교하고, 선택한 set의 세 relic과 2/3-piece tier,
exact cost 또는 slot consequence, acquire/place/remove 명령 하나를 함께 읽는다.

`src/data/decorations.ts`, `src/data/decorationTransactions.ts`, save schema,
Production/Battle bonus consumers, and `StageSelectScene` back destination은 authority로
유지되며 변경되지 않았다. Set/relic selection은 저장하지 않는다. 기존 pure
transaction이 반환한 새 `GameState`만 저장한다.

### Implementation and writable boundary used

- `src/scenes/DecorationScene.ts`
- `docs/design/DESIGN.md`
- `docs/design/AGENT_HANDOFF.md`
- `progress.md`
- `tools/screenshots/decoration-*.png`

No Decoration work was authorized in data authorities, `wisdom.ts`, bonus consumers,
navigation, package manifests, assets, Capacitor/native projects, or unrelated dirty
paths. Enabled orders lock through the press tween and admit one commit per 250ms
gesture burst. Rerender destroys old display/input objects, retains the receipt, and
adds no scene-level drag listener, recurring timer, or infinite tween.

### Verification commands and browser evidence

```bash
npm test -- --run src/data/decorations.test.ts src/data/decorationTransactions.test.ts src/data/idleIncome.test.ts
npx tsc --noEmit
npm test
npm run build
git diff --check
```

Browser route:

```text
http://127.0.0.1:8083/?skipTutorial=1&scene=DecorationScene
```

Exact screenshots, SHA-256 values, transaction deltas, UI metric counts, and
lifecycle signatures are in `docs/design/DESIGN.md` under
`Decoration Reliquary Design Contract / Verification record — 2026-09-04`.
Native packaging and alternate whole-app viewport regression remain outside this
web-only slice.

## 14. Completed implementation record: Abyss Expedition

사용자가 2026-09-04에 다음 step 진행을 승인했고, Abyss를 completed Forge/Fusion
supply loop와 shared battle result flow를 연결하는 bounded farming surface로 선택했다.
이 절은 완료 당시 scope와 invariant를 보존하는 기록이며 다시 구현하라는 지시가 아니다.

### Product job and preserved behavior

Abyss는 floor-card catalog가 아니라 정복 깊이와 보급 대상을 선택하는 dungeon
expedition room이다. 다섯 층 window로 모든 `1..next` floor를 탐색하고, 선택한 층의
band, boss, recommended power, material pool, key/battle consequence를 읽은 뒤 하나의
challenge 또는 sweep 명령을 실행한다.

`src/data/abyss.ts`, `src/data/abyssTransactions.ts`, save schema, daily 12-key
refill, 60-floor power/loot/boss/wave rules, `DungeonScene` battle handoff, result
return, and Forge/Fusion/StageSelect destinations은 authority로 유지되며 변경되지
않았다. Page/floor selection은 저장하지 않는다. 기존 transaction/result flow가
반환한 새 `GameState`만 저장한다.

### Implementation and writable boundary used

- `src/scenes/AbyssScene.ts`
- `docs/design/DESIGN.md`
- `docs/design/AGENT_HANDOFF.md`
- `progress.md`
- `tools/screenshots/abyss-*-390x844.png`

No Abyss work was authorized in data authorities, `wisdom.ts`, battle/result code,
navigation, package manifests, assets, Capacitor/native projects, or unrelated dirty
paths. The selected order acquires a scene-level pointerdown latch and admits one
commit per 250ms gesture burst. Rerender destroys prior display/input objects,
retains the receipt, and adds no camera-drag listener, recurring timer,
auto-dismiss callback, or infinite tween.

### Verification commands and browser evidence

```bash
npm test -- --run src/data/abyss.test.ts src/data/abyssTransactions.test.ts
npx tsc --noEmit
npm test
npm run build
git diff --check
```

Browser route:

```text
http://127.0.0.1:8083/?skipTutorial=1&scene=AbyssScene
```

Exact screenshots, SHA-256 values, selection/transaction deltas, registry receipts,
and lifecycle signatures are in `docs/design/DESIGN.md` under
`Abyss Expedition Design Contract / Verification record — 2026-09-04`.
Native packaging and alternate whole-app viewport regression remain outside this
web-only slice.

## 15. Completed implementation record: Achievement Hall

사용자가 2026-09-04에 다음 step 진행을 승인했고, Achievement를 completed
progression/economy surfaces의 보상 증거를 모으는 bounded archive로 선택했다. 이
절은 완료 당시 scope와 invariant를 보존하는 기록이며 다시 구현하라는 지시가 아니다.

### Product job and preserved behavior

Achievement는 long trophy feed가 아니라 하나의 milestone 진행·보상·수령 상태를
읽고 회수하는 dungeon hall of records다. Eight category seals와 three-record window로
79개 base와 5개 epilogue definition을 모두 탐색하고, selected ledger에서 exact
progress/reward와 persistent receipt를 확인한다.

`src/data/achievementData.ts`, `src/data/achievementDefsEpilogue.ts`,
`src/data/achievements.ts`, `src/data/progressionTransactions.ts`,
`src/data/rewardTransactions.ts`, save schema, reward amounts, category/target,
unlock calculation, and registry `previousScene` return은 authority로 유지되며
변경되지 않았다. Category/page/record selection은 저장하지 않고 existing pure
transaction이 반환한 새 `GameState`만 저장한다.

### Implementation and writable boundary used

- `src/scenes/AchievementScene.ts`
- `docs/design/DESIGN.md`
- `docs/design/AGENT_HANDOFF.md`
- `progress.md`
- `tools/screenshots/achievement-*-390x844.png`

No Achievement work was authorized in definition/progression/reward authorities,
persistence, routes, package manifests, assets, Capacitor/native projects, or
unrelated dirty paths. Individual and claim-all commands acquire a scene-level
pointer-down latch, block cross-view input through commit, and retain a receipt.
Rerender happens once on post-update and leaves no recurring timer, infinite tween,
visible mask source, or scene-level drag/wheel listener.

### Verification commands and browser evidence

```bash
npm test -- --run src/data/achievements.test.ts src/data/achievementsEpilogue.test.ts src/data/progressionTransactions.test.ts src/data/rewardTransactions.test.ts
npx tsc --noEmit
npm test
npm run build
git diff --check
```

Browser route:

```text
http://127.0.0.1:8083/?skipTutorial=1&scene=AchievementScene
```

Exact screenshots, SHA-256 values, all-84/category reachability, individual and
aggregate reward deltas, stale-state and input-race receipts, and lifecycle
signatures are in `docs/design/DESIGN.md` under
`Achievement Hall Design Contract / Verification record — 2026-09-04`.
Native packaging and alternate whole-app viewport regression remain outside this
web-only slice.

## 16. Completed implementation record: Codex Archive

사용자가 2026-09-04에 다음 step 진행을 승인했고, Codex를 completed Legion and
reward surfaces의 roster/threat intelligence archive로 선택했다. 이 절은 완료 당시
scope와 invariant를 보존하는 기록이며 다시 구현하라는 지시가 아니다.

### Product job and preserved behavior

Codex는 long accordion/list가 아니라 하나의 guardian and threat archive다. Twelve
guardian seals, nine invader chapters, and four fixed modes를 통해 all 136 monsters,
52 invaders, 17 endless modifiers, and 13 wave events를 bounded paging으로 열고,
selected ledger에서 exact stats, acquisition or threat context, and tribe reward
receipt를 확인한다.

`MONSTER_DEFS`, `INVADER_DEFS`, `ENDLESS_MODIFIERS`, `WAVE_EVENTS`, existing reward
transactions, save schema, summon pools, combat consumers, Legion membership,
root destinations, and registry `previousScene` return은 authority로 유지되며
변경되지 않았다. Tab/group/page/record/filter state는 저장하지 않고 existing pure
transaction이 반환한 새 `GameState`만 저장한다.

Tribe eligibility는 view helper에서 fresh save를 기준으로 canonical ownership을
resolve하고, mapped reward와 모든 `unlockMethod=codex_reward` record를 requirement에서
제외한다. Existing transaction이 caller를 신뢰하므로 selected/aggregate command는
같은 fresh state에서 계산한 exact tribe/reward pair만 전달한다. 이 UI guard가
transaction authority 자체를 변경하거나 일반 API를 harden한 것으로 해석하면 안 된다.

### Implementation and writable boundary used

- `src/scenes/CodexScene.ts`
- `src/ui/CodexMonsterDetail.ts`
- `src/ui/CodexShared.ts`
- `src/ui/CodexShared.test.ts`
- `docs/design/DESIGN.md`
- `docs/design/AGENT_HANDOFF.md`
- `progress.md`
- `tools/screenshots/codex-*-390x844.png`

No Codex work was authorized in monster/invader/modifier/event definitions,
reward/progression transactions, persistence, summon pools, combat, routes,
package manifests, assets, Capacitor/native projects, or unrelated dirty paths.
The active scene no longer imports the old `CodexCell`; its unused legacy helper/
renderer remains existing debt rather than current authority.

Reward and route actions acquire one shared latch before animation or
reduced-motion dispatch. An admitted order blocks group/tab/back/root redirection;
an admitted back/root route blocks a same-frame order. Rerender is queued once on
post-update after a reward result and leaves no recurring timer, infinite tween,
mask object, or scene-level pointer/drag/wheel listener.

### Verification commands and browser evidence

```bash
npm test -- --run src/ui/CodexShared.test.ts src/data/rewardTransactions.test.ts src/data/monsters.test.ts src/data/summonPools.test.ts src/data/wisdom.test.ts src/data/wisdomEconomy.test.ts src/data/achievements.test.ts src/data/achievementsEpilogue.test.ts src/data/progressionTransactions.test.ts src/data/navigationContract.test.ts
npx tsc --noEmit
npm test
npm run build
git diff --check
```

Browser route:

```text
http://127.0.0.1:8083/?skipTutorial=1&scene=CodexScene
```

Exact screenshots, SHA-256 values, all-136/52/17/13 reachability, individual and
aggregate reward deltas, stale-state and route-race receipts, modal isolation, and
lifecycle signatures are in `docs/design/DESIGN.md` under
`Codex Archive Design Contract / Verification record — 2026-09-04`.
Evolved-only reward dedupe and malformed legacy claim-array reconciliation remain
pre-existing transaction/data debt outside this visual slice. Native packaging
and alternate whole-app viewport regression also remain unverified.

## 17. Completed implementation record: Ancestral Wisdom Chamber

사용자가 2026-09-04에 다음 step 진행을 승인했고, Ancestral Wisdom을 permanent
progression ritual chamber로 선택했다. 이 절은 완료 당시 scope와 invariant를
보존하는 기록이며 다시 구현하라는 지시가 아니다.

### Product job and preserved behavior

Ancestral Wisdom은 branch identity를 숨기는 radial ornament가 아니라 영구 성장을
승인하는 ritual chamber다. Four presentation-only lineages와 three named tablets를
통해 authoritative twelve branches를 모두 열고, selected ledger에서 current effect,
next effect, tier, exact cost/deficit, and post-spend balance를 확인한 뒤 하나의
irreversible upgrade를 승인한다.

`BRANCH_DEFS`, five-tier ceiling, tier costs, effect formulas, computed bonuses,
`upgradeWisdomBranch`, save schema, and `previousScene` return은 authority로 유지되며
변경되지 않았다. Live source에는 wisdom equip/reset transaction이나 save field가
없다. 과거 handoff의 `purchase/equip/reset` 표현은 stale requirement였으며 이
redesign은 존재하지 않는 behavior를 추가하지 않았다.

### Implementation and writable boundary used

- `src/scenes/AncestralWisdomScene.ts`
- `src/ui/AncestralWisdomShared.ts`
- `src/ui/AncestralWisdomShared.test.ts`
- `docs/design/DESIGN.md`
- `docs/design/AGENT_HANDOFF.md`
- `progress.md`
- `tools/screenshots/wisdom-*.png`

No Wisdom work was authorized in branch/economy definitions, shared transaction,
bonus consumers, persistence, navigation authority, achievement/summon/forge/combat
consumers, balance, package manifests, dependencies, assets, Capacitor/native files,
or unrelated dirty paths.

Selection is ephemeral. Upgrade admission begins on the command's pointer-down and
blocks lineage/branch/back input. Confirm and cancel share a second overlay-local
first-decision admission. Commit reloads the save and compares the approved
branch/tier/cost/balance snapshot before calling the existing transaction; only its
returned success state is saved. A mismatched or invalid fresh state is rejected
without mutation and remains visible as a durable receipt. Pending selection render
also blocks admission from an obsolete command, and a rejected rebuilt action becomes
available after the 250ms cooldown.

### Verification commands and browser evidence

```bash
npm test -- --run src/data/wisdom.test.ts src/data/wisdomEconomy.test.ts src/ui/AncestralWisdomShared.test.ts
npx tsc --noEmit
npm test
npm run build
git diff --check
```

Browser route:

```text
http://127.0.0.1:8083/?skipTutorial=1&scene=AncestralWisdomScene
```

Exact final screenshots and SHA-256 values, all-twelve reachability, selected-state
layout audits, success/deficit/max/stale deltas, both confirm/cancel decision orders,
normal/reduced cross-input, contextual/fallback routes, cooldown, and lifecycle
signatures are in `docs/design/DESIGN.md` under
`Ancestral Wisdom Chamber Design Contract / Verification record — 2026-09-04`.
Malformed-tier validation inside the shared transaction remains pre-existing authority
debt; this scene blocks it before transaction entry. Alternate whole-app viewports,
physical-device accessibility, native packaging, store release, and commit history
remain unverified or out of scope.

## 18. Completed implementation record: Overall Web Completion

2026-09-05 사용자가 전체 설계·계획을 Goal로 완성하도록 요청했다. G0–G5는 기존
15개 surface를 재구현하지 않고 남은 두 presentation scene과 aggregate regression을
닫는 범위다. Runtime/data/navigation authority는 그대로 유지했다.

- EndlessResult: expedition memorial, exact awarded ledger, bounded modifier,
  separated retry/return and first-input admission. No persistence calls.
- Cinematic: 18px dialogue, left/right speaker seal, explicit action/skip,
  phase/version admission and owned timer/tween cleanup. Original content and
  mark-seen-on-entry behavior preserved.
- Demonstrated integration fixes only: Barracks roster/compact-preview label
  spacing, Home 44px utility controls, Summon 210px card and 44px rate footer.
- Reproducible isolated audits (start `npm run dev` first):

```bash
HEADED=1 node scripts/verify-endless-result.mjs
HEADED=1 node scripts/verify-cinematic.mjs
node scripts/verify-web-surfaces.mjs
npx tsc --noEmit
npm test
npm run build
git diff --check
```

The scripts use the locally installed Playwright runtime. `PLAYWRIGHT_MODULE`
overrides its absolute module path; `GAME_URL` overrides the two scoped scripts'
server, and `WEB_AUDIT_URL` overrides the aggregate server. No dependency added.

Machine evidence: `tools/endless-result-audit.json`, `tools/cinematic-audit.json`,
`tools/completion-web-audit.json`. Each records source and final screenshot hashes.
The dated contracts above define exact counts, receipts and boundaries. Standard
game-client text/state passed, but its black WebGL image exports were excluded;
real page screenshots provide the visual evidence.

Writable boundary used: the two scenes, `HomeCommandDeck.ts`, `BarracksCard.ts`,
`BarracksGrowthHall.ts`, `SummonScene.ts`, `SummonShared.ts`, three verification
scripts, scoped evidence images/JSON, design/plan/handoff/progress. No dependency,
schema, balance, content, route authority, asset, native or store changes.

## 19. Paste-ready continuation prompt

```text
작업 경로는 /Users/sungjin/dev/personal/dungeon md/dungeon-phaser 이다.
다른 sibling prototype이 아니라 이 Phaser/Vite/Capacitor app에서만 작업한다.

먼저 다음 순서로 전부 읽어라.
1. AGENTS.md
2. docs/design/AGENT_HANDOFF.md
3. docs/MONSTER_DUNGEON_DESIGN.md
4. docs/design/DESIGN.md
5. docs/design/CHARACTER_ART_REVISION.md와 output/character-art/ritual-v2/PROMPTS.md
   이전 web 완료는 WEB_COMPLETION_PLAN.md와 handoff 18절을 참고한다.
6. git status --short --branch와 대상 파일의 live diff

현재 completed table의 17개 surface는 current worktree에서 COMPLETE다.
EndlessResult와 Cinematic도 완료되었으므로 다시 구현하지 마라. 세 크기에서
45개 첫 상태와 Summon active banner 3개를 확인했지만 모든 modal/full gameplay
또는 native-ready를 의미하지 않는다. Live source/hash/evidence를 회귀 기준으로 보존하라.
최신 사용자 요청은 캐릭터 및 전체 디자인을 게임 기획에 맞게 다듬는 것이다.
대표 dokkaebi_warrior / gumiho_guardian / death_messenger / mountain_spirit의
ritual-v2 아트와 공통 초상화·world token·speaker 연결을 기준으로 이어간다.
기존 136 JPG는 그대로이며 나머지 132종은 새 아트로 교체되지 않았다.
먼저 live source와 character-art audit의 완료 상태를 확인하라. 다음 기본 후보는
Chapter 1 roster 및 남은 주요 speaker의 한 batch다. Exact IDs, silhouette,
role/material, 512px RGBA/512KiB, provenance와 browser acceptance를 먼저 고정하라.
새 자산은 versioned 경로에 추가하고 legacy/procedural/skin fallback을 보존하라.

반드시 보존할 것:
- 완료된 17개 surface의 contract, evidence, navigation, transaction 의미
- Fusion unknown combination의 soul crystal 100 소비 규칙과 stale-source
  ownership guard
- Shop의 card-purchase/preview-purchase-and-equip 구분, current UTC offer guard,
  one recurring timer, confirm/receipt latch와 overlay shielding
- Production의 facility selection non-mutation, press/cooldown transaction latch,
  persistent receipt, cost/rate/max/cap와 shared idle clock authority
- Decoration의 set/relic selection non-mutation, acquire/place/remove transaction
  authority, 12개 catalog/cost/slot/tier/bonus와 persistent receipt
- Abyss의 page/floor selection non-mutation, daily refill/sweep/clear transaction,
  all-60-floor reachability, battle registry handoff, persistent return receipt
- Achievement의 category/page/record selection non-mutation, all-84 reachability,
  existing unlock/reward transaction, stale-claim guard와 persistent receipt
- Codex의 all-136 guardian / 52 invader / 17 modifier / 13 event reachability,
  fresh-save tribe eligibility, exact mapped reward pair, stale guard, route/order
  shared latch, owned-detail isolation, persistent receipt
- Ancestral Wisdom의 all-12 branch/four-lineage reachability, selection non-mutation,
  upgrade-only authority, exact confirm snapshot guard, confirm/cancel shared admission,
  pending-render guard, cooldown, full-screen shield, persistent receipt
- EndlessResult의 reward-neutral presentation, exact retry payload와 route latch
- Cinematic의 원본 대사/pause, mark-seen-on-entry, nextData와 owned callback cleanup
- 승인된 네 종의 source/master/prompt provenance와 정확한 speaker identity
- root four-zone navigation과 기존 back/codex/picker destinations
- 현재 dirty worktree와 모든 미추적 산출물

금지:
- reset/checkout/clean, unrelated restore
- direct GameState mutation
- 선택되지 않은 다음 surface의 구현 또는 writable boundary 확장
- 새 dependency, token authority, save schema, balance, recipe, route,
  native/store 변경; 선택한 character batch 밖의 asset 교체
- commit/stage/push/merge/PR/cap sync/publishing
- source diff나 mock만 보고 완료 선언

선택된 acceptance의 repo-specific tests와 실제 browser/gameplay evidence를 통과시키고,
`docs/design/DESIGN.md`와 이 handoff의 completed/not-complete/next-boundary 기록을
현재 증빙에 맞게 동기화하라. 완료 보고는 current worktree 기준으로만 하라.
```

## 20. Handoff maintenance

다음 agent는 한 surface를 닫을 때 아래만 갱신한다.

1. 이 문서의 `Completed range`와 `What is not complete`
2. 다음 target과 writable boundary
3. `docs/design/DESIGN.md`의 surface contract/evidence
4. current branch/HEAD, aggregate test/build 결과, unverified targets

과거 evidence를 현재 결과처럼 덮어쓰지 않는다. 날짜별 record를 남기고, 실패한
gate가 있으면 `PARTIAL` 또는 `BLOCKED`로 표시한다.
