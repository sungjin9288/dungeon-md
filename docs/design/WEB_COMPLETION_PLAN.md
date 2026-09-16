# Web completion plan — 2026-09-05

## Decision and finish line

사용자 요청: “전체적인 설계하고 계획 수립해서 goal로 완성하자”.
이번 Goal은 기존 15개 완료 surface와 남은 EndlessResult/Cinematic을 하나의
검증된 web design baseline으로 묶는다. 플레이어는 base → reinforcement →
invasion → result → next run을 따라가며 현재 상태와 다음 행동을 읽을 수 있어야 한다.
이 문서는 실행 계획이며 color/data/navigation authority는 기존 파일에 유지한다.

### Architecture and ownership

- Presentation: Phaser scenes + existing `GameUiPrimitives` + `DUNGEON_UI`.
- State: `src/data` immutable transactions, then `saveGameState(result.state)`.
- Route context: transient Phaser registry/scene data; four root destinations.
- Render: 390×844 logical canvas, FIT scaling; browser viewports 360×800,
  390×844, 430×932 at DPR 2. Logical touch targets ≥44px. New scene contracts
  target core text ≥12px and secondary text ≥11px; earlier accepted 10–11px
  telemetry/support text remains recorded, not a universal 12px claim.
  Physical FIT scaling is recorded separately from logical target size.
- Motion: bounded feedback, immediate reduced-motion content, explicit cleanup.
- Receipts: result data is displayed as awarded upstream; a result view never
  re-applies rewards. Story seen-state retains mark-on-entry semantics.

## Ordered execution

| Step | Deliverable and acceptance | Status |
| --- | --- | --- |
| G0 | Live instructions/diff audit; this plan and two scoped contracts | COMPLETE |
| G1 | Endless result: new/tied/lower/first record, modifier, missing payload, retry/return, no duplicate reward or route | COMPLETE — 15 states, 17 modifiers, four route races, upstream +9 and redisplay neutral |
| G2 | Cinematic: all definitions and dialogue reachable, readable left/right speakers, reveal/advance/skip/auto-pause, reduced motion and stale-timer cleanup | COMPLETE — 21 definitions in both modes, 160 lines, six viewport states, races/lifecycle PASS |
| G3 | Reproducible browser audit for player scenes at three sizes, visible layout/console checks and core route/reward/save checks | COMPLETE — 45 initial states plus three banner states, four routes/four neutral selections PASS |
| G4 | Fix demonstrated in-scope defects; focused/full tests, TypeScript, build, evidence hashes, independent reviews | COMPLETE — focused/full/build/typecheck/diff checks and all three review angles PASS |
| G5 | Final design/handoff/progress synchronization, truthful coverage and follow-up release plan, Goal complete | COMPLETE — 17-surface handoff synchronized, evidence verified, owned server stopped |

G1 and G2 have independent scene ownership; G3/G4 depend on their verified source.
No step is complete until its evidence exists. A smoke of first-view surfaces is
not exhaustive verification of every nested modal, all campaign waves, or device
accessibility. The final report must retain that distinction.

## Writable boundary

- `src/scenes/EndlessResultScene.ts`, `src/scenes/CinematicScene.ts` and necessary
  scene-specific helpers/tests.
- A narrowly reproduced integration defect may change its direct scene/UI owner
  with a recorded cause and regression. Shared transaction hardening requires an
  explicit plan amendment grounded in a failing test; no economic rule changes.
- `scripts/` browser verification, `tools/screenshots/completion-*`,
  `tools/screenshots/endless-*`, `tools/screenshots/cinematic-*`, evidence JSON,
  `docs/design/DESIGN.md`, this plan, handoff and `progress.md`.
- Existing unrelated dirty files, source assets, native shells, dependencies,
  schema, content, balance and route destinations stay outside the edit boundary.

## Evidence and gates

Run the standard develop-web-game client and a repository-local Playwright audit
using the installed runtime; no new browser dependency is required. Isolate each
fixture in a fresh browser context and never use the user's saved game.

Record real screenshots, dimensions, SHA-256, viewport/canvas scale, errors and
state/route receipts. Tests: focused story/wave/result checks, `npm test`,
`npx tsc --noEmit`, `npm run build`, `git diff --check`. Existing bundle warnings
must be reported rather than hidden. Independent scope/code/QA verdicts must pass.

### G4 bounded regression amendments

The first aggregate render demonstrated name/EXP and rarity/stat overlap in
Barracks, 43px Home utilities and 28px Summon rate controls. The direct visual
owners were amended: `BarracksCard.ts`, `BarracksGrowthHall.ts`,
`HomeCommandDeck.ts`, `SummonScene.ts`, `SummonShared.ts`. Fixes adjust placement,
remove a redundant compact-preview rarity label (roster rarity is preserved), and
give rates a separate 44px footer within a 210px card. No transaction changes.

Latest automated gates: TypeScript PASS; focused wave/modifier 2 files/18 tests,
story/cinematic 2 files/76 tests, affected Barracks/Summon/HUD 4 files/186 tests;
full `npm test` 103 files/2,846 tests PASS; production build PASS with the existing
large-chunk advisory; `git diff --check` PASS.

### Final independent reviews and evidence integrity

| Angle | Verdict | Decisive evidence |
| --- | --- | --- |
| Code/authority | PASS | Final seven runtime source hashes; reward-neutral result, unchanged retry/seen/nextData authority; direct normal/reduced repeated-finish and stale-pause browser probes |
| QA/evidence | PASS | Independent Endless representative renders, aggregate artifact/geometry/receipt checks; historical StageRewardOverlay wording clarified without changing test logic |
| Goal/context | PASS | 17 completed rows, exact JSON counts, bounded writable changes, logical/CSS and seeded/organic distinctions, usable continuation prompt |

- All 34 recorded source-hash entries and 73 recorded image-hash entries matched
  current files. All 198 literal repository paths checked in the four coupled
  documents exist; Markdown fences and final diff-check passed.
- Ledgers: `tools/endless-result-audit.json`, `tools/cinematic-audit.json`,
  `tools/completion-web-audit.json`. The aggregate's metadata-only scope amendment
  is disclosed inside the JSON; screenshots, receipts and runtime did not change.
- The 48 aggregate screenshots and three contact sheets were opened by its
  author; parent independently inspected the 390 contact sheet, Barracks-360,
  active-banner Summon-430 and representative Endless/Cinematic captures.
- Owned browser sessions were closed; Vite was stopped and TCP 8083 had no
  listener. No commit, stage, push, merge, PR, native sync or publishing ran.
- Completion is a current-worktree web design baseline, not whole-game or
  store-release acceptance. There are no remaining blockers within this Goal.

## Follow-up product/release plan (outside this Goal)

1. Gameplay endurance: organic Abyss win/loss and full campaign/endless soak with
   progression-valid saves; measure balance and performance before changing either.
2. Device acceptance: physical iOS/Android touch, interruption/resume, safe areas,
   text scaling, memory/audio and save import/export recovery.
3. Packaging: review current native changes, then authorized Capacitor sync,
   signed device builds, store metadata/privacy and store validation.
4. Delivery: separately review accumulated dirty diffs, then explicitly authorized
   commits/PR/merge and release. This Goal performs none of those external actions.

No user decision is currently pending for the reversible web implementation.
