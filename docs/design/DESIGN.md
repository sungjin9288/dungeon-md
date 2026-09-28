# Character B1 — 2026-09-07 (local functional verification passed)

Latest boot diagnostic: `docs/design/CHARACTER_B1_BOOT_PROFILE.md`. Two complete
paired resource-inventory series did not reproduce the earlier multi-second delay;
no runtime optimization was made. Profiling is done, while historical cause and
production/device acceptance remain unproven. Read this follow-up before the older
boot sample interpretation below.

Current scoped authority: `docs/design/CHARACTER_B1_SPEC.md` and
`docs/design/CHARACTER_B1_IMPLEMENTATION.md`. Five accepted exports are recorded
in `tools/character-b1-assets.json`. Runtime code, command checks, three-size
browser functional gates and independent review passed. Implemented scope: v2-only
96px world bake with42/60px display geometry, nine-entry art registry and exact
Quest speaker folio. Original-four records below are dated historical evidence,
not a claim of current B1 verification or complete136-character redesign.

Current evidence: `tools/character-b1-audit.json` (27 captures/5 contact sheets/
19 isolated fixtures,0 enforced failures), `tools/character-b1-verification.json`
(105 files/2904 tests and build), and the B1 implementation plan closeout.
Parent opened final portraits, world/room consumers and Quest edge cases; no
new required-content collision was observed at the three required sizes.
Boot observations are not a device performance PASS. Current WebGL1.0 context,
missing baseline GL-version/frame evidence and organic/native limits are explicit.
The exact matched boot supplement is `tools/character-b1-boot-matched.json`:
2.400–3.759s versus the old0.616–1.090s samples. Performance remains open;
controlled boot profiling takes precedence over B2 art expansion.

# Character and world art revision — 2026-09-05

Current execution authority: `docs/design/CHARACTER_ART_REVISION.md` and the
character amendment in `docs/MONSTER_DUNGEON_DESIGN.md`. The earlier 17-surface
web completion below remains dated evidence, not proof that all 136 characters
already meet the revised art direction.

- Visual thesis: compact, hand-painted Korean folk-craft guardians, with distinct
  species/role silhouettes in clay, worn wood, ink cloth, pine, brass and jade.
  Existing stone/indigo dungeon environments remain the setting; no scene, combat,
  rarity or progression rule is replaced to accommodate the art.
- First delivered asset IDs: `dokkaebi_warrior`, `gumiho_guardian`,
  `death_messenger`, `mountain_spirit`. Four versioned 512×512 RGBA exports with
  42px transparent padding and a 512 KiB ceiling; legacy 136 JPGs preserved.
- Shared portraits and room tokens prefer approved art, then legacy, then the
  existing procedural path. New world sprites preserve the existing 48px texture
  geometry. Explicit skins retain their existing rendering; the 24px combat
  texture registry is not rewritten.
- Theatre uses one persistent 248px speaker image for the four exact mapped
  names, preserving the original name/dialogue/side. Unknown speakers retain
  emoji identity, and missing new art falls back to legacy then emoji.
- State and lifecycle authority: original definitions, owned-copy resolution,
  role/element labels, transactions, seen-on-entry, reveal/advance/skip, caller
  payload and cleanup stay unchanged. No new save or balance contract.
- Current verification is tracked in `CHARACTER_ART_REVISION.md`; historical
  Cinematic hashes below deliberately refer to the pre-character-art version.

### Character verification record — 2026-09-05

- `HEADED=1 node scripts/verify-character-art.mjs`: 60 DPR2 page captures,
  360×800 / 390×844 / 430×932 product views and reduced-motion stories;
  390×844 normal-motion canonical/mirrored speaker and missing-art fixtures.
- Final source hashes, four asset hashes, PNG hashes, exact save-neutral input,
  gallery, fallback and stable three-entry lifecycle receipts are in
  `tools/character-art-audit.json`. No enforced failures/console errors/source drift.
- Full 104 files / 2,876 tests, focused 3 files / 40, TypeScript, build,
  legacy136 portrait check and diff-check passed. Existing large-chunk warning remains.
- Masters/prompts and exact export commands: `output/character-art/ritual-v2/PROMPTS.md`.
  Independent code/export, goal/context and final QA cross-reviews passed.
  All eight contact sheets were opened, 75 receipts passed, and 81 source/art/PNG
  hash entries matched. Evidence/handoff synchronization is complete; owned
  browsers/server closed. A0–A4 complete in the current worktree only.
- This is four-character presentation acceptance with isolated/labelled fixtures,
  not all-136 art, organic gameplay, every modal or native QA. The unchanged 8px
  decorative Home route-order marker and softer 48px world bake remain explicit
  observations; do not infer whole-app zero sub-10px text from this record.

# Web completion contracts — 2026-09-05

Execution authority: `docs/design/WEB_COMPLETION_PLAN.md`. Existing surface records
below remain dated evidence; the new aggregate run must describe its own coverage.

## Endless Result — expedition memorial

- Job: read the ended run's wave record, earned gold/crystals, challenge modifier
  and previous-best comparison; choose one new run or return to Stage Select.
- Hierarchy: stone title, large wave milestone, explicit record status, compact
  run ledger, current modifier, persistent awarded-result note, one dominant
  `다시 도전` action and a quiet `스테이지 선택` action.
- Token/geometry: existing DUNGEON_UI roles; fixed 390×844, 12px core/11px
  secondary text, at least 44×44 controls, bounded numeric display with exact
  reward values retained in the ledger. No new scenery assets or token authority.
- Authority: `WaveLifecycle.showEndlessResult` and `applyEndlessRunReward` own
  persistence and reward formula. The result scene displays the registry receipt,
  never loads/saves/rewards. Retry keeps `{ stageNumber: 0, slots: 9, endless: true }`
  and DungeonScene initialization rolls the next modifier. Missing result returns
  to StageSelect. The first route input wins before animation.
- States: first run, new/tied/lower record, zero/high rewards, all modifier
  descriptions, missing receipt, retry/return in both input orders, reduced motion,
  three restarts and upstream awarded receipt with no second grant.
- Must not have: copied reward formula text, infinite record flash, clipped or
  colliding ledger/modifier labels, equally dominant CTAs, duplicate transition.

### Endless verification record — 2026-09-05

- Source `src/scenes/EndlessResultScene.ts` SHA-256:
  `ac86e9acab0d3b4b1c104863b1fe22a628e809f644fdb970ffab7ad722d89d80`.
- Reproduce with Vite running: `HEADED=1 node scripts/verify-endless-result.mjs`.
  Complete machine ledger: `tools/endless-result-audit.json` (includes source and
  all 15 screenshot hashes). Each fixture uses a fresh browser save.
- Five states at all three browser viewports passed: first/zero, new record,
  tied, lower, and high values up to `999,999,999,999`. Every state remained
  save-neutral, with no logical text overflow/collision, sub-11px text, sub-44px
  enabled targets, or console/runtime error. All 17 modifier descriptions fit.
- Route admission was tested in both input orders and both motion settings;
  only the first retry/return ran. Retry kept the existing stageConfig, reward
  totals stayed unchanged, and missing payload opened StageSelect. Three restarts
  retained 33 children/two inputs/zero timers and tweens.
- The real `showEndlessResult` function was invoked in an isolated renderer with
  wave 20 and multiplier 1.5: soul crystals `100→109`, previous best `15→20`,
  receipt `crystalsEarned=9`. Redisplay remained byte-identical. This proves the
  upstream transaction-to-view handoff, not an organic endless defeat playthrough.
- Opened representative captures: `endless-record-390x844.png`
  (`ab545b8a867415842b09a5431415b63912f05b82ceb921978517e78a60c8e962`),
  `endless-high-360x800.png`
  (`dada144b5e5354644ffcfb77777ff6274047ffbd3ea97aaacf1718221f93db57`),
  `endless-first-430x932.png`
  (`91db5b9c492fcc72ae0f15eb0c8255e215ed34c55e350974d0463e8b5ac2169f`),
  plus tied/lower states under `tools/screenshots/`.
- Focused wave/modifier tests: 2 files / 18 passed. TypeScript, full 103-file /
  2,846-test suite, production build and diff-check passed. Shared reward/content
  authority files remained unchanged.

## Cinematic — dungeon chronicle

- Job: understand the active named speaker and complete dialogue, reveal text,
  advance the story, or skip to the caller's destination.
- Hierarchy: chapter/story context and progress, carved theatre with speaker
  identity, readable dialogue folio, explicit reveal/next/finish action and 44px
  skip. Existing emoji is an identity accent accompanied by the speaker's name.
- Visual rules: DUNGEON_UI stone/brass/parchment; fixed 390×844; dialogue ≥16px,
  supporting copy ≥11px; changing left/right speaker must not move text offscreen.
- Authority: all `CINEMATICS` text/order/side/pause and caller nextScene/nextData
  are unchanged. `markCinematicSeen` runs on entry and saves only changed state.
  Missing definition/data returns safely without inventing seen state.
- Lifecycle: one admitted advance/finish, line-owned typewriter and auto-pause
  timers, no stale auto-advance after a manual advance/skip/restart. Reduced motion
  immediately shows complete dialogue and has no decorative looping tween. Normal
  text reveal remains skippable; preserve auto-pause behavior from definitions.
- Evidence: all definitions/all lines, both speaker sides, manual reveal/advance,
  auto-pause plus manual input race, early/repeated skip, unknown definition,
  contextual nextData, seen-once persistence, normal/reduced motion, three restarts.
- Must not have: uncontrolled delayed callback, input before first line readiness,
  emoji-only advance, tiny skip glyph, duplicate finish or lost caller data.

### Cinematic verification record — 2026-09-05

- Source `src/scenes/CinematicScene.ts` SHA-256:
  `98bef173d462faec9ca03c8272195b429f8ca9e10f549890b224fcc12cf11560`.
- Reproduce with Vite running: `HEADED=1 node scripts/verify-cinematic.mjs`.
  `tools/cinematic-audit.json` records source/script/authority and seven PNG hashes.
- All 21 definitions and 80 lines passed in both normal and reduced motion:
  42 definition cases / 160 line checks. Original text, speaker side, order and
  pause are preserved. Seen-on-entry saves exactly once; subsequent lines and
  re-entry are save-neutral. Each completion routes once with identical nextData.
- Natural typing, reveal/advance, manual-versus-auto-pause, same-frame duplicate
  input, early/repeated skip, missing definition/data, and fresh missing payload
  passed. Three restarts per motion retained 15 children, three inputs, zero
  timers/tweens after reveal. Independent reviewer also directly invoked stale
  pause callbacks and repeated finish: one route, zero residual owned timers.
- Six left/right representative states at 360×800, 390×844 and 430×932, DPR 2,
  passed bounds/collision/11px-minimum/44px-target checks. Speaker and dialogue
  are 18px. All seven final PNGs were opened by the implementation reviewer;
  parent independently opened left-360, right-430 and finale-390.
- Representative PNGs under `tools/screenshots/`:
  `cinematic-left-final-360x800.png`
  (`b8c51f80c214af0ba0103e980d13653afcbf716cfb9c18f345c244dc888f2b6b`),
  `cinematic-right-final-430x932.png`
  (`71bc9c1ea623a7d6644cb1aebdb7f498ba249f4b74a53b66f1a02b04964edc4f`),
  `cinematic-finale-final-390x844.png`
  (`56dbdc77560da6278dd261022c0110e6c3d034d9bd31cb1b19662e7dd6adebc5`).
- Focused story/cinematic checks: 2 files / 76 passed. The standard game client
  organically reached Cinematic from StageSelect → stage 1 → start without
  reported errors. Its black WebGL export was opened and excluded as visual
  evidence; real browser page screenshots above are the rendering evidence.

## Aggregate web verification — 2026-09-05

- Reproduce: run `npm run dev`, then `node scripts/verify-web-surfaces.mjs`.
  `tools/completion-web-audit.json` is the exact machine ledger with source hashes,
  PNG dimensions/hashes, viewport/FIT scale, active scene sets, camera-transformed
  bounds, input labels/targets, errors, routes and save comparisons.
- Coverage: 15 initial states × three viewports = 45 captures. These are Home,
  StageSelect, PreBattle, Barracks, Forge, Summon, Shop, Fusion, Wisdom, Codex,
  Achievement, Abyss, Production, Decoration, and paired DungeonScene/UIScene.
  Three additional Summon active-banner states use a fixed 2026-09-20 clock and
  the authoritative `fall_underworld_2026` catalog. Total: 48 captures plus three
  contact sheets; final visuals are under `tools/screenshots/completion-*`.
- Every context is isolated from user saves. PreBattle uses the canonical MQ-003
  invasion registry payload through `startQuest`; it is a seeded entry, not
  proof of organic quest progression. This smoke does not reopen every modal or
  re-run historical Room Editing/Battle Result transaction matrices.
- All viewport captures use DPR 2: PNGs 720×1600, 780×1688, 860×1864. Logical
  canvas remains 390×844; FIT scales are about 0.9231, 1, 1.1026. A 44px logical
  target becomes about 40.6 CSS px at width 360; physical accessibility approval
  is not implied. Existing 10–11px telemetry/support text is recorded, not
  falsely claimed to meet the newer 12px core-text target everywhere.
- Final render has no fixed-layout overflow, rendered text below 10 logical px,
  enabled targets below 44 logical px, or console/runtime errors. Camera-scroll
  boundary partials are classified separately. Home's world room label behind
  its action pin and Shop's multi-emoji portrait/badge overlap candidates were
  visually reviewed as intentional layered art, not text/command collisions.
- Actual four-zone pointer navigation Home → Barracks → Forge → StageSelect →
  Home passed with exact active scenes and byte-identical saved state. Wisdom,
  Codex, Production and Decoration selection changes also remained byte-identical.
- Reproduced defects fixed in their direct owners: Barracks name/EXP and compact
  rarity/stat collisions, Home's 43px utility targets, Summon's 28px rate targets.
  Summon cards are now 210px high with separate 44px purchase/rate controls;
  the active-banner final row ends inside the 844px canvas. No economy changes.
- Focused affected checks: 4 files / 186 tests. Full suite: 103 files / 2,846
  tests; TypeScript, production build and diff-check passed. Existing Vite
  large-chunk advisory remains. Independent code/authority review passed against
  final source hashes; independent QA/evidence and goal/context reviews also
  passed. The plan records the separate verdicts and exact limitations.
- Standard game client also rendered the Summon route state twice with no error
  artifact. Its black WebGL PNG was excluded; page captures are the visual proof.
- Remaining acceptance: organic Abyss win/loss and full campaign/endless soak,
  exhaustive nested UI at alternate viewports, physical-device interruptions,
  accessibility, packaging/store validation and authorized delivery. No claim
  of native-ready, release-ready, clean Git history or whole-game completion.

# Dungeon Home Design Contract

> Scope: `DungeonHomeScene` at the 390×844 logical canvas. Runtime tokens remain
> owned by `src/constants/colors.ts`; this contract defines use, not a second token source.

## Product job

The first screen must make the player feel that they own and operate a living
Korean-folklore dungeon under imminent invasion. Within two seconds the player
must identify the entrance, the descending threat route, the room that needs
attention, the dungeon heart, and the next action.

## Reference synthesis

Only principles are adapted. No external code, art, layout, names, or tokens are copied.

| Reference | Source fact | Decision | Repository consequence |
| --- | --- | --- | --- |
| [Dungeon Maker](https://play.google.com/store/apps/details?hl=en_US&id=com.GameCoaster.DungeonMaker) | The official listing centers trap, facility, and monster placement against invading heroes. | ADAPT | Room state must be visible inside the dungeon world, not only in a management card. |
| [KeeperRL](https://keeperrl.com/) | Its official page describes digging deep, building rooms, corridors and traps, and minions training and producing gear. | ADAPT | Preserve a continuous descent and show rooms as inhabited operational spaces. |
| [The King is Watching](https://store.steampowered.com/app/2753900/The_King_is_Watching/) | The official listing puts resource production, military training, repairs, and defense choices in one compact loop. | ADAPT | Show one current directive with readiness and consequence next to its action. |
| [Hades II](https://www.supergiantgames.com/blog/hades2-faq/) | Supergiant describes an Underworld rooted in a specific mythic viewpoint and witchcraft. | ADAPT | Keep a specific dokkaebi identity, strong silhouettes, and selective ritual light instead of generic fantasy chrome. |
| [Darkest Dungeon II](https://www.darkestdungeon.com/darkest-dungeon-2/) | The official page frames darker enemies, hazardous locations, and an arduous journey. | ADAPT | Use darkness to frame danger and depth; reserve ember red for threat and damage. |
| [Blue Prince](https://www.blueprincegame.org/) | The official overview emphasizes distinctive rooms, hidden passages, environmental lighting, and discovery. | ADAPT | Each visible room must differ through architecture, occupant, trap, light, or seal—not just its label. |
| [Monster Never Cry](https://play.google.com/store/apps/details?hl=en_AU&id=com.origin.rod) | The developer listing centers rebuilding a ruined demon city and deploying monsters to work there. | ADAPT | Locked areas read as ruins to reclaim; built rooms read as restored and occupied. |

### Rejected or deferred

- REJECT PC-scale dense grids, tiny counters, and simultaneous production panels.
- REJECT cloned visual assets, trademarked characters, and another game's exact layout.
- DEFER broad redesign of Barracks, Forge, Stage Select, and combat until Home proves the language.

## Visual thesis

`public/assets/backgrounds/dokkaebi-lair-shaft.png` is the primary surface. UI is
weathered dungeon hardware attached to that place. Teal-black stone and jade fog
carry depth; soot iron contains information; oxidized brass signals interaction;
warm amber marks inhabited rooms; ember red appears only for invasion, damage,
or a vulnerable heart.

The implementation reference is `home-reboot-concept-v2.png`. Generated text,
numbers, characters, and decorative geometry are illustrative only.

## Composition contract

1. Keep at least 65% of the board region visually open to the illustrated shaft.
2. The entrance sits above all rooms and a continuous route descends to the heart.
3. Render unlocked rooms and only the next sealed expansion. Do not fill the world
   with every future locked slot.
4. Rooms are cutaway chambers: arch, floor, occupant/trap, short name, and readiness.
   No opaque 3×3 card mosaic.
5. One next-action plate sits directly above navigation. It owns the dominant CTA.
6. Top status and bottom navigation use carved, code-native sigils; no emoji icons.
7. Primary and navigation targets remain at least 44 logical pixels high. Essential
   text remains at least 10px on the 390px canvas.

## State language

| State | World treatment | Required non-color cue |
| --- | --- | --- |
| Empty/unlocked | Open dark arch, scaffold rune, cool jade edge | `방 설계` label |
| Built/ready | Warm occupied chamber, visible guardian or trap | room name and readiness value |
| Built/incomplete | Dimmer chamber, action pin at the real room | literal next-action label |
| Damaged | Broken arch, fracture marks, ember signal | `수리 필요` label |
| Next locked | Chained stone seal in the world | required level label |
| Distant locked | Not rendered as a card | floor/depth remains visible |
| Focused | Brass corner/ring response on the room | spatial focus motion, 120–260ms |

## Shell and copy

- Top: dungeon-master level/XP, three resources, quest and settings controls.
- World: entrance → rooms → heart. The world is the primary interaction surface.
- Command: directive title, short consequence, readiness, one 44px-or-taller CTA.
- Utility management stays available without competing with the primary action.
- Bottom: `던전`, `군단`, `공방`, `침공`; active state uses shape, position, and label,
  not color alone.

## Must not have

- Generic indigo dashboard panels or bright purple as the base surface
- Emoji navigation, resource, room, or settings icons
- Glassmorphism, neon, pill soup, or borders around every region
- A 3×3 wall of opaque future-room locks
- New persistence fields, progression rules, navigation destinations, dependencies,
  or store packaging changes in this visual slice
- Native changes beyond the verified iOS safe-frame boundary

## Acceptance and evidence

- Inspect the real Home renderer at 390×844 and one iOS portrait simulator.
- Verify entrance, current room, next seal, route, heart, directive, and navigation
  remain visible without overlap or horizontal clipping.
- Verify empty, built, damaged, and locked states when fixtures are available.
- Verify changed controls retain their existing destinations and 44px hit areas.
- Run `npm test`, `npm run build`, and `git diff --check`.
- Record exact screenshot paths and any state/device that could not be verified.

## Source and concept provenance

- Reviewed-source ledger: `source-ledger.json`
- Concept v2: generated with the built-in image tool from the repository background
  and v1 concept; 853×1844; SHA-256
  `89acb9002c6035303f36ea559cbcae190dec0c0e27de41dd6d560ec2d71fee38`.
- Final image prompt: `home-reboot-concept-v2-prompt.md`

## Verification record — 2026-09-03

- Default Home, exact 390×844 crop: `tools/screenshots/home-reboot-web-390x844.png`
- Built trap room + damaged combat room + next seal:
  `tools/screenshots/home-reboot-web-states-390x844.png`
- Restyled idle-reward plaque: `tools/screenshots/home-reboot-web-idle-390x844.png`
- iOS 26.5 portrait, safe-framed Home: `tools/screenshots/home-reboot-ios-v2-clean.png`
- iOS 26.5 portrait, first tutorial plaque:
  `tools/screenshots/home-reboot-ios-v2-tutorial.png`
- `npm test`: 98 files, 2,823 tests passed.
- `npm run build`: passed; Vite retained its existing large-chunk advisory.
- `npx cap sync ios`: passed.
- iOS Simulator `xcodebuild`: passed; CocoaPods embed-script output warning remains.
- `git diff --check`: passed.

# Shop Quartermaster Design Contract

## Product job and scope

`ShopScene` is the Legion economy's quartermaster room: the player must be able
to understand their two spendable balances, compare the current catalog, and
complete a purchase or reversible equip action without leaving the 390x844
viewport. This slice covers the existing Skin, Theme, Equipment, and Skill tabs.

The behavior authority remains `src/data/shopTransactions.ts` and the existing
UTC-day rotation in `src/ui/ShopDailyTab.ts`. Prices, catalog registries,
ownership semantics, save fields, and the contextual back route to
`BarracksScene` are outside the redesign boundary.

## S0 audit — 2026-09-04

- The Skin catalog rendered controls to y=1,161 and text to y=1,311 without a
  scrolling mechanism. The Theme catalog reached y=898. Products below the
  viewport were unreachable.
- Skin rarity/quest labels, Theme state/rarity labels, and the preview particle
  label rendered below the 10px text floor.
- The Skin preview dimmer did not own a full-screen input shield. A tap on the
  obscured Theme tab changed the active tab while the preview was open.
- Equipment and Skill each created a second recurring reset timer even though
  the scene header already owned one. Their successful purchases rebuilt only
  the content, leaving the header crystal balance stale.
- Existing card buttons used a 44px input zone around a 26px visual button.
  The redesign makes the visible action itself at least 44px high.

## Reference-to-interface decisions

The reference is the repository's established dungeon UI language rather than
an external visual source: stone lintels, iron dividers, warm forge light,
compact resource ledgers, portrait-first inventory cards, and explicit ritual
receipts. `DUNGEON_UI`, `DUNGEON_UI_CSS`, `GameUiPrimitives`, and
`MonsterPortraitView` remain the implementation vocabulary.

The shop is differentiated as a military supply room: a masonry header and
quartermaster subtitle establish place, the resource rail reads as a ledger,
and merchandise sits on bounded shelves. Accent color communicates currency or
state; it does not replace labels.

## First-viewport hierarchy

1. Stone lintel: contextual return, `군수 상점`, and `DUNGEON QUARTERMASTER`.
2. Live ledger rail: gems, soul crystals, and one UTC restock countdown.
3. Four equal tabs with visible 44px targets: Skin, Theme, Equipment, Skill.
4. Active-department summary: catalog rule, ownership count, and page state.
5. Bounded merchandise shelf with product identity, effect/state, cost, and an
   explicit 44px action.
6. Page controls when the current filtered catalog exceeds the shelf capacity.

Core labels are at least 10px and primary text is at least 11px. All catalog
content, actions, page controls, and overlay actions remain within 390x844.

## State and interaction matrix

| Surface | Required visible state | Preserved transaction rule |
| --- | --- | --- |
| Skin catalog | filter, bounded page, monster/skin identity, rarity, price or quest condition, owned/equipped state | card purchase buys only; owned action equips or unequips |
| Skin preview | selected portrait, base/skin comparison, exact cost/action, close control | unowned preview purchases and equips; owned preview equips |
| Theme catalog | bounded page, palette swatches, rarity, price, owned/equipped state | purchase equips; owned equips; equipped non-default theme can return to Cave |
| Equipment | three deterministic daily products, effect, crystal cost, owned state | successful purchase appends one unique equipment ID |
| Skill | three deterministic daily products, effect, crystal cost, owned state | successful purchase appends one unique active-skill ID |
| Confirm | product, exact currency/cost, cancel, one execute action | cancel never saves; execute invokes the existing pure transaction once |
| Receipt | persistent success or failure message and one acknowledgement action | latch remains held until acknowledgement; failure preserves state |

## Input, motion, and lifecycle contract

- A purchase action acquires one scene-level transaction latch on its originating
  `pointerdown`. Back, tab, filter, page, preview, and another purchase cannot
  enter the confirmation gap or execute in parallel.
- Preview, confirmation, and receipt layers own full-screen input shields.
  Background taps cannot change tabs or activate merchandise.
- Cancel releases the latch without persistence. Confirm executes once, redraws
  both the live ledger and active catalog, then presents a persistent receipt.
- Reversible equip/unequip actions execute once and refresh the same live chrome;
  they do not use a destructive-purchase confirmation.
- Reduced-motion mode retains complete static confirmation and receipt states.
  Feedback does not depend on an animation completing.
- The scene owns exactly one recurring UTC countdown. Tab redraws do not add
  timers; scene shutdown removes the countdown and clears overlay/latch state.

## Must not have

- Direct `GameState` mutation, duplicated price/ownership rules, changed UTC seed,
  or altered transaction failure semantics.
- New save fields, dependency, route, asset, catalog item, balance value, or
  native-project change.
- Emoji-only controls, sub-10px visible labels, hidden disabled reasons,
  auto-dismissed transaction receipts, unbounded content, or an
  input-transparent overlay.
- A scene restart for ordinary tab, filter, page, purchase, or equip refresh.

## Acceptance and evidence gate

Completion requires focused Shop transaction/presentation tests, TypeScript,
the full test suite, production build, and `git diff --check`. Real-browser
evidence must cover all four tabs, filter/page bounds, preview shielding,
purchase cancel/success/failure, equip/unequip, rapid/cross-tab input, live
resource refresh, reduced motion, three restart cycles, and the Barracks back
route at exact 390x844 with runtime DPR 2. The final record must report visible
text below 10px, interactive bounds below 44px, overflow, console/runtime
errors, recurring timers, and screenshot SHA-256 values.

## Verification record — 2026-09-04

All evidence below is an exact 390×844 browser capture at runtime DPR 2. Isolated
localStorage fixtures were used for each purchase path; no production or shared
account state was involved.

| Evidence | SHA-256 |
| --- | --- |
| `tools/screenshots/shop-skin-catalog-final-390x844.png` | `93c389fb9c0662afd86c6648816aee6bfd882a1aa0b69dd01aa13ee463ff20f3` |
| `tools/screenshots/shop-skin-quest-final-390x844.png` | `84a2139c27a9108261bcc0d9fcd7bfe5e5f58eb08df932eb816af19fa7305085` |
| `tools/screenshots/shop-skin-preview-final-390x844.png` | `83ac029649e40988fb49455af812c195a0669fe834f7f030e33cf8ccbfabfe90` |
| `tools/screenshots/shop-theme-catalog-final-390x844.png` | `cdc543518bb00660028e3d27d5d684ef8c79df8c09d9b8f97933a448bcc69b9e` |
| `tools/screenshots/shop-equipment-final-390x844.png` | `09aba758d919a4f6a54fdcf89171756f6e6482da7d80fd55d916ec51e7e18654` |
| `tools/screenshots/shop-skill-final-390x844.png` | `4d988bfd7cc8f9a1d3d6f2b3fcf85dd2c320be625ff4a91ac0dfed2ce28d649e` |
| `tools/screenshots/shop-purchase-confirm-final-390x844.png` | `84958c7beb49e256e490e7374d8df240a0ba2048997b3ccaad8a549dc6350356` |
| `tools/screenshots/shop-purchase-success-final-390x844.png` | `03be0bd51ee0dc08d67d5de03f8f2bf17540a08bcb5861c3cb919270c0fe8aa4` |
| `tools/screenshots/shop-purchase-failure-final-390x844.png` | `ba5cccf43239aaf0bd560fb0156f32b8c992606ee09072d7e03ed506929809ed` |

- Skin uses five bounded shelves for all 17 current entries and preserves four
  rarity filters. Page 5 exposes the final quest-only entry without overflow;
  the quest preview has one full-screen shield and a visibly disabled quest CTA.
- A card purchase cancel retained gems `500` and an empty owned-skin map. Rapid
  confirm plus a cross-tab tap executed once: gems `500→350`, added
  `dok_warrior_gold`, and did not equip it. The header immediately read `350`.
- Preview purchase preserved the separate purchase-and-equip rule: gems
  `500→350`, the same skin was added once, and `equippedSkins.dokkaebi_warrior`
  became `dok_warrior_gold`.
- A zero-gem confirmation produced a persistent failure receipt with an X seal;
  gems and owned skins remained unchanged. Preview, confirm, success, and failure
  overlays each owned exactly one full-screen input shield.
- Buying `ice_cave` changed gems `500→350`, added ownership, equipped it, and
  refreshed the ledger. The reversible action returned to `cave` without another
  charge. Equipment and Skill purchases each appended one unique ID, spent only
  soul crystals, refreshed the live ledger, and ignored rapid duplicate confirm.
- Sixteen audited catalog/filter/page/preview/confirm/result states reported
  visible text below 10px `0`, interactive bounds below 44px `0`, text overflow
  `0`, recurring timers `1`, active tweens `0`, and console/runtime errors `0`.
  Background tab input did not cross preview or transaction overlays.
- Three reduced-motion restarts retained the same signature each cycle:
  `children 8`, `interactive 18`, `timers 1`, `tweens 0`, `shutdown listeners 15`,
  `busy false`, `overlay false`. The UTC day index is intentionally deferred while
  a transaction owns the scene, so the next clock tick refreshes a daily shelf
  after a midnight-spanning confirmation.
- A browser-simulated UTC rollover removed the captured equipment ID before
  confirmation. The stale offer returned a persistent `재입고 완료` receipt,
  retained the original soul-crystal balance and inventory, then accepted the new
  day and rebuilt the shelf on the first post-acknowledgement clock tick.
- Focused Shop checks: 3 files, 25 tests passed. `npx tsc --noEmit`: passed.
  Full `npm test`: 102 files, 2,837 tests passed. `npm run build`: passed with the
  existing Vite large-chunk advisory. `git diff --check`: passed. The standard
  web-game client retained `ShopScene` as the only/top scene at 390×844, DPR 2.
- Native packaging, Capacitor sync, and whole-app 360×800/430×932 regression were
  not run because they are outside this web-only surface slice.

# Invasion Readiness Design Contract

> Scope: `StageSelectScene` and `PreBattleScene` at the 390×844 logical canvas.
> Stage registry content, progression, reward preview, cinematic handoff,
> `invasionConfig`, `questId`, `preBattleEditReturn`, `focusRoomSlotIdx`,
> `returnTo`, forecast arithmetic, launch destination, and cancel behavior remain
> authoritative and unchanged.

## Product job

The invasion zone must feel like a frontier cut through the dungeon, followed by
a concrete defense briefing. Stage Select answers where the army has reached and
which gate opens next. Pre-Battle answers who is coming, where the current defense
line is weak, which room to change, and whether the invasion target can launch.

## Reference-to-interface decisions

- Adapt Blue Prince's spatial clarity as a continuous gate-and-corridor route;
  locked progress remains visible as sealed architecture instead of disappearing.
- Adapt Dungeon Maker's placement-first defense loop as a nine-slot spatial route
  with the canonical room action attached to the actual slot.
- Adapt The King is Watching's compact decision hierarchy: one readiness order,
  quiet forecast/edit utilities, and one visually dominant launch command.
- Use Hades II and Darkest Dungeon II as tone anchors only: strong gate silhouettes,
  soot depth, restrained brass, and ember reserved for frontier, threat, or failure.
- Use code-drawn seals, gates, and enemy markers for navigation and status; monster,
  trap, and equipment identity may retain their existing content icons.

## Scene hierarchy

### Stage Select

1. Fixed invasion lintel: dungeon return, zone title, chapter range, progress.
2. Continuous corridor: cleared gates, one ember frontier, sealed future gates.
3. Chapter thresholds and existing stage reward-preview interaction.
4. Fixed four-zone navigation with Invasion selected.

### Pre-Battle

1. Invasion intelligence: target, quest context, first-wave composition, follow-up waves.
2. Defense operation board: exactly one readiness directive and spatial room route.
3. Existing synergy/active-skill context as secondary information.
4. Command plate: quiet forecast, optional room edit, one dominant launch CTA.

Pre-Battle has no global bottom navigation. Core labels are 12px or larger,
secondary semantic labels may be 11px, telemetry may be 10px, and every command
surface is at least 44px high.

## State contract

| State | Required proof |
| --- | --- |
| Initial frontier | Gate 1 is the only playable frontier; later gates remain visible and sealed. |
| Advanced frontier | Clears, stars, HP record, lit corridor, and the next ember gate remain distinct. |
| Warning | One room directive, its route/card target, risk status, and launch command are visible together. |
| Ready | Jade readiness language replaces warning language without moving the launch command. |
| Invalid target | Launch is visibly disabled, has no input handler, and command status reports target failure. |

## Verification requirements

- Capture exact 390×844 renders for initial/advanced frontier and warning/ready/invalid target.
- Confirm header and bottom navigation do not start map dragging.
- Confirm reward preview, room-edit return, forecast, cancel, and valid launch retain their destinations and registry handoffs.
- Confirm Pre-Battle has no global navigation, no duplicated primary CTA, and no clipped or overlapping controls.
- Run focused readiness/navigation/progression tests, `npm test`, `npm run build`, and `git diff --check`.

## Verification record — 2026-09-03

- Stage initial and advanced-frontier states, exact 390×844 renders:
  `tools/screenshots/stage-select-initial-final-390x844.png`
  (`68d6d65ce61ca66fa597ff43d7d55a48af0eb33f0c8476dea08763f881902ded`)
  and `tools/screenshots/stage-select-frontier-final-390x844.png`
  (`8a0ce293d28fc085159ad47922160a3cfc7af0fde8b5426e3a9e86ddd80d32b4`).
- Pre-Battle warning, ready, and invalid-target states, exact 390×844 renders:
  `tools/screenshots/prebattle-warning-final-390x844.png`
  (`fc4df587cdc3550c82986b42dc75adf85724fc7b510799ca879f7b4110b75bc0`),
  `tools/screenshots/prebattle-ready-final-390x844.png`
  (`87c00d66b021c9c5195fcc3d23bfde600ce3c5b7e01b7cd05f693e2e69f4181a`),
  and `tools/screenshots/prebattle-invalid-final-390x844.png`
  (`8808e692fe6fde6eae25274d112a602176ed0c98aa77cd8601c62f502460546b`).
- Forecast, room-detail, and maximum-intelligence states, exact 390×844 renders:
  `tools/screenshots/prebattle-forecast-final-390x844.png`
  (`a0359b8505fa0bf258f3c4364f13c2c89daf08a51241993c27ce2dcdf7020452`),
  `tools/screenshots/prebattle-room-detail-final-390x844.png`
  (`b1c8d0c2533bfc88e5af4b65daa89514d1354a903aeb1139a69dab21694b289d`),
  and `tools/screenshots/prebattle-max-intel-final-390x844.png`
  (`b963fa29fe5860e1239ae04fa3c17b064bf80fffe5dd3fd28383cd3b9cd9653b`).
- Header and root-nav drags kept camera scroll at `-422`; a content drag moved it
  to `-322`. Frontier gate 5 opened reward preview index `4`.
- Room edit opened `DungeonHomeScene` with room detail slot `0` and retained
  `preBattleEditReturn`, `invasionConfig`, and `questId`. Forecast opened and
  closed; cancel retained invasion context.
- Valid launch produced story stage `999`, `returnTo: DungeonHomeScene`, and the
  existing quest ID, then removed `invasionConfig`. Invalid launch rendered the
  target-error command with `input: false` on its 228×48 hit surface.
- Browser smoke produced no runtime exception or console error. Chrome retained
  one pre-existing `apple-mobile-web-app-capable` deprecation warning.
- Focused readiness/forecast/navigation/progression tests: 4 files, 111 tests passed.
  Full `npm test`: 99 files, 2,824 tests passed.
- `npm run build`: passed; Vite retained its existing large-chunk advisory.
- `npx cap sync ios`: passed without tracked iOS changes.
- iOS Simulator `xcodebuild`: passed; only existing AppIntents-skip and CocoaPods
  always-run warnings remained.
- `git diff --check`: passed.

# Monster Raising Design Contract

> Scope: `BarracksScene` and its monster-detail growth overlay at the 390×844
> logical canvas. Existing growth, equipment, skill, summon, fusion, room-return,
> persistence, and focus-context behavior remain authoritative.

## Product job

The Barracks must feel like the dungeon master's living guard chamber, not a
spreadsheet or card-pack storefront. The player first identifies one guardian
that can improve the defense line, then sees the exact growth cost, equipment
state, and recommended room before choosing an action.

## Reference-to-interface decisions

- Adapt Monster Never Cry's demon-legion fantasy as ownership and deployment
  context, without copying its characters or layout.
- Adapt AFK Journey's character-first presentation: the current growth target
  receives the largest portrait and the strongest silhouette.
- Keep Dungeon Maker and KeeperRL's operational relationship between monster,
  equipment, and room placement visible on every roster entry.
- Keep The King is Watching's compact decision loop: one growth command owns
  the reason, cost or deficit, projected defense effect, and primary CTA.
- Preserve the Home and Room language: soot stone, iron, brass interaction,
  jade readiness, ember risk, code-drawn sigils, and restrained rarity color.

## First-viewport hierarchy

1. Guard-chamber lintel: back action, title, total power, roster status, management.
2. Growth dais: one large guardian portrait and one actionable growth order.
3. Compact sort and role controls, each with a 44px touch target.
4. Full-width guardian roster: portrait, level/power, EXP, equipment, room plan,
   and one next-action rail.
5. Summon is a compact secondary reinforcement route below the owned roster.

The collection pack must never compete visually with an owned guardian. Core
labels are at least 10px. Rarity and role accents decorate identity but do not
replace status labels or action copy.

## State evidence matrix

| State | Required proof |
| --- | --- |
| Growth target | portrait, reason, cost/deficit, room context, and 44px CTA |
| Owned/deployed | level, power, EXP, equipment, assigned room, next action |
| Undeployed | recommended/open/blocked room expressed with label and accent |
| Empty roster | clear summon route without an empty decorative tray |
| Monster detail | portrait-led growth decision plus equipment and skill continuity |
| Focus return | room-origin context and return route remain visible and functional |

## Verification requirements

- Capture exact 390×844 renders of the main Barracks and monster detail.
- Confirm growth CTA, roster card, summon route, management disclosure, and one
  detail action retain their existing destination or transaction.
- Confirm no horizontal clipping, overlapping controls, or emoji navigation marks.
- Run focused Barracks tests, `npm test`, `npm run build`, and `git diff --check`.

## Verification record — 2026-09-03

- Main Barracks, exact 390×844 crop:
  `tools/screenshots/barracks-final-390x844.png`; SHA-256
  `9a2c2b06730be43159a04cb4d584bee1f7b24bfaf00f037d021fac834d55764e`.
- Empty legion and first-summon directive, exact 390×844 crop:
  `tools/screenshots/barracks-empty-final-390x844.png`; SHA-256
  `57f80f9c114704998f4735ebdac55b8663aadfd7706089b727d694a12964720e`.
- Growth detail, exact 390×844 crop:
  `tools/screenshots/monster-detail-final-v2-390x844.png`; SHA-256
  `b854b4545ba53a7300631aaa910caf57bf5b771206aa67b6a5ce67f6e14a3bee`.
- Room-focused growth detail, exact 390×844 crop:
  `tools/screenshots/monster-detail-focused-room-390x844.png`; SHA-256
  `5718db64907a38146df582fa105ec9f28aab97c451fe86e7f5d8a83250fa264a`.
- Loadout, appearance, management, and skill-tactics evidence:
  `tools/screenshots/monster-detail-loadout-390x844.png`,
  `tools/screenshots/monster-detail-appearance-390x844.png`,
  `tools/screenshots/barracks-management-390x844.png`, and
  `tools/screenshots/skill-tactics-final-390x844.png`.
- Interaction smoke confirmed empty-legion `소환` → `SummonScene`, all three
  detail tabs, feed transaction `XP 0 → 20`, focused room context, and
  `방으로 복귀` → the originating room detail.
- Runtime console smoke produced no application exception. Browser policy emitted
  only the existing Web Audio autoplay and mobile-web-app meta warnings.
- Focused Barracks tests: 3 files, 44 tests passed.
- `npm test`: 99 files, 2,824 tests passed.
- `npm run build`: passed; Vite retained its existing large-chunk advisory.
- `npx cap sync ios`: passed.
- iOS Simulator `xcodebuild`: passed; only existing destination, Capacitor
  deprecation, AppIntents-skip, and CocoaPods always-run warnings remained.
- `git diff --check`: passed.

# Forge Readiness Design Contract

> Scope: `ForgeScene` at the 390×844 logical canvas. Existing blueprint order,
> material accounting, craft/equip/dismantle transactions, direct entry,
> focused-room return, and feedback registries remain authoritative.

## Product job

The Forge is the dungeon master's working smithy. The first viewport must answer
four questions without opening another panel: which guardian needs equipment,
which blueprint best addresses that need, whether it can be crafted now, and how
the assigned room's power changes after equipping it.

## Reference-to-interface decisions

- Preserve the established dungeon language: soot and iron carry the workshop,
  copper/brass marks craft actions, jade marks an actionable reinforcement, and
  ember marks a material deficit or destructive dismantle action.
- Adapt The King is Watching's compact resource loop into one forge order that
  owns the target, reason, material state, projected room effect, and CTA.
- Continue AFK Journey's character-first hierarchy by keeping the recommended
  guardian portrait ahead of the equipment catalogue.
- Keep Dungeon Maker's operational connection between rooms, guardians, and
  equipment visible; an equipment recommendation without its room context is
  incomplete.
- Use code-drawn anvil, blueprint, and equipment sigils instead of emoji for
  navigation, status, and control affordances.

## First-viewport hierarchy

1. Forge lintel: return action, smithy title, material summary, and Abyss supply route.
2. Craft/dismantle tabs with 44px touch targets and explicit active state.
3. Forge order: target portrait, selected blueprint, why-now, current equipment,
   craftability or exact deficit, room readiness, expected power delta, and one CTA.
4. Target selector: one active guardian plus a stable next-target action.
5. Result-first blueprint rows with a repeated 44px craft CTA.

Core labels are at least 10px. Disabled craft controls retain cost and outcome
information but have no interactive hit zone. Rarity color decorates equipment
identity and never replaces text labels.

## State evidence matrix

| State | Required proof |
| --- | --- |
| Craftable | target, materials satisfied, room context, expected delta, active CTA |
| Material deficit | exact missing quantity, disabled CTA, visible supply route |
| Empty blueprints | acquisition instruction and existing Abyss route |
| Focused room | source room, guardian, expected room effect, and return action |
| Craft success | crafted item, effects, recommended bearer, equip/recovery actions |
| Dismantle | holder warning, material return, and explicit destructive confirmation |

## Verification requirements

- Capture exact 390×844 renders for craftable, deficit/empty, focused-room,
  craft-confirm/success, and dismantle states affected by this pass.
- Confirm primary craft, immediate equip, room return, supply route, and one
  dismantle transaction retain their existing behavior.
- Confirm no horizontal clipping, overlapping controls, or emoji navigation marks.
- Run focused Forge tests, `npm test`, `npm run build`, and `git diff --check`.

## Verification record — 2026-09-03

- Empty blueprint state, exact 390×844 render:
  `tools/screenshots/forge-empty-final-390x844.png`; SHA-256
  `0ff9b91c7536ee06fa93e91de5d6df0c54d1ef2eba7c258519b9c43553fd6c26`.
- Craftable and material-deficit states, exact 390×844 renders:
  `tools/screenshots/forge-craftable-final-390x844.png` (`8893aa2523a9ef8f86ad3d6068ebbbf4511d52eb701b2c8a7a96d70edd1ff7c7`)
  and `tools/screenshots/forge-deficit-final-390x844.png`
  (`a63b34b6f7c0a30a615a7a329fc25b2777895587e4204c4e8f22cecdbe715e9e`).
- Focused-room and bounded page-navigation states, exact 390×844 renders:
  `tools/screenshots/forge-focused-final-390x844.png` (`08af59c36db866b07348a60e9bb6681841d2305dd14550138271944f6bb3ab52`)
  and `tools/screenshots/forge-page2-final-390x844.png`
  (`177f0467402e4ca9fda240b9f46b2c9a1f9a0997874eb082c26793d5f899c521`).
- Craft confirmation and completion states, exact 390×844 renders:
  `tools/screenshots/forge-confirm-final-390x844.png` (`ef35dbf0acecd4dd5200b24e2f0d9b393420b0165efdfc15748c14722dba7609`)
  and `tools/screenshots/forge-complete-final-390x844.png`
  (`d776d21a281b3311c19f6e8aa2e397d8e6efa3cf1b7423c463d2a54afa0538f0`).
- Dismantle confirmation, exact 390×844 render:
  `tools/screenshots/forge-dismantle-confirm-final-390x844.png`; SHA-256
  `8d6fbc47edf41fb3c008235ee589cf906794b98e687f7ddc11967f0992c813e5`.
- Browser interaction smoke passed without runtime exceptions or console errors:
  five blueprints reached page `2 / 3`; craft consumed `dok_fragment 3→0` and
  `iron_shard 6→4`; the crafted club was immediately equipped and returned to
  `DungeonHomeScene`; dismantling an equipped club cleared its holder, removed
  it from storage, and returned `dok_fragment +1` plus `iron_shard +1`; the
  supply action opened `AbyssScene`.
- Focused Forge tests: 3 files, 45 tests passed. Full `npm test`: 99 files,
  2,824 tests passed.
- `npm run build`: passed; Vite retained its existing large-chunk advisory.
- `npx cap sync ios`: passed without tracked iOS changes.
- iOS Simulator `xcodebuild`: passed; only the existing destination,
  AppIntents-skip, and CocoaPods always-run warnings remained.
- `git diff --check`: passed.

# Room Editing Design Contract

> Scope: the first viewport of `openRoomDetail()` at 390×844. Room transactions,
> recommendations, picker callbacks, and navigation destinations are unchanged.

## Product job

Opening a room must feel like descending into that room and issuing a concrete
order. The cutaway is the main surface; the player sees the invasion lane, trap
sockets, guardian positions, equipment state, damage, and the highlighted next
target before reading management controls.

## Reference-to-interface decisions

- Adapt Dungeon Maker's placement-first loop: sockets remain directly actionable
  inside the chamber instead of being represented only by rows below it.
- Adapt KeeperRL's rooms-and-corridors legibility: `IN` and `OUT`, the trap line,
  guardian line, and room fixture form one architectural cross-section.
- Adapt The King is Watching's compact choice loop: one command plate owns the
  next directive, readiness, consequence, and 44px CTA.
- Adapt Blue Prince's distinctive-room principle: combat, trap, support, and magic
  use code-drawn architectural sigils and fixtures, not emoji or interchangeable cards.
- Keep Hades II and Darkest Dungeon II as tone anchors only: strong silhouette,
  selective ritual light, soot-black depth, and restrained danger red.

## First-viewport hierarchy

1. Stone lintel: back action, room number/type, room level, scroll controls.
2. Dominant cutaway: real guardian/trap/equipment sockets and spatial target ring.
3. Single next-order plate: directive, readiness, loadout summary, one primary CTA.
4. Carved room-role selector.
5. Below the fold: growth, forge, detailed loadout, repair, and upgrade utilities.

The cutaway and command plate must not repeat as separate “operations” dashboards.
Core labels are at least 10px; primary and navigation hit areas are 44px. Soot and
iron carry structure, brass marks interaction, jade marks a live room, and ember
is reserved for damage or risk.

## Room-state evidence matrix

| State | Cutaway proof | Action proof |
| --- | --- | --- |
| Built | Guardian/trap appears at its actual socket | growth, replace, or forge target remains clickable |
| Empty | Blueprint scaffold and four role sigils | recommended design CTA and role selector |
| Incomplete | Open socket plus target ring | one placement/install directive |
| Damaged | Fractures and ember wash | repair directive and cost-enabled state |
| Ready | Filled loadout/readiness marks | next queued room or invasion action |

## Verification requirements

- Capture exact 390×844 renders for built/incomplete and empty or damaged states.
- Confirm no horizontal clipping, emoji room/navigation marks, or overlapping hit areas.
- Confirm cutaway sockets still open their existing monster/trap/growth/forge flows.
- Run `npm test`, `npm run build`, and `git diff --check` before close-out.

## Verification record — 2026-09-03

- Built/incomplete room, exact 390×844 crop:
  `tools/screenshots/room-detail-final-built-390x844.png`; SHA-256
  `794d6ad894c7c1a9850c56ddcabc7410969b918acfcd2fddba1eca1bf711ffb6`.
- Empty room blueprint, exact 390×844 crop:
  `tools/screenshots/room-detail-final-empty-390x844.png`; SHA-256
  `4f4049bd94b115bd7bb002407912132caafdb20df57ad615994802253d55920c`.
- Damaged room and repair order, exact 390×844 crop:
  `tools/screenshots/room-detail-final-damaged-390x844.png`; SHA-256
  `4737aae87d985c156079b09151a686beb33e9c040e026f6acc6146be7469b446`.
- Below-fold management actions, exact 390×844 crop:
  `tools/screenshots/room-detail-final-management-390x844.png`; SHA-256
  `fc27979a1a7a53d42bace38c0a032a7048e6203aacc173aa3a98e70bf9a8d6f1`.
- The rendered `성장 관리` control was clicked after scrolling and opened the
  existing focused monster detail in Barracks; no destination or focus-context
  change was introduced.
- `npm test -- --reporter=dot`: 98 files, 2,823 tests passed.
- `npm run build`: passed; Vite retained its existing large-chunk advisory.
- `npx cap sync ios`: passed without tracked iOS changes.
- iOS Simulator `xcodebuild`: passed; only the existing destination, Capacitor
  deprecation, AppIntents-skip, and CocoaPods always-run warnings remained.
- `git diff --check`: passed.

# Battle Command & Outcome Design Contract

> Scope: the 390×844 battle HUD, wave briefing, tactical skill surfaces, boss
> status, and wave/stage outcomes. Combat math, rewards, progression, and
> destination callbacks remain owned by their existing data and flow modules.

## Product job

The battle screen is the operational view of the same dungeon base seen on
Home and PreBattle. Before combat, the player reads the defended rooms and one
clear invasion command. During combat, dungeon HP, wave pressure, remaining
invaders, speed, pause, and tactical skills stay visible without hiding the
room route. After combat, the result states explain the consequence and expose
one dominant next action.

## Reference-to-interface decisions

- Carry Dungeon Maker's room-and-trap legibility into the live snake route:
  rooms remain the main battlefield rather than becoming a generic combat
  backdrop.
- Adapt The King is Watching's compact decision loop into the wave briefing:
  threat, force size, breakthrough damage, enemy rows, and the start command
  are contained in one report.
- Use Hades II and Darkest Dungeon II as tone anchors: strong silhouettes,
  soot-black depth, restrained brass, jade readiness, and ember danger.
- Keep AFK Journey's character-first tactical affordance by attaching each
  active-skill command to its guardian and room position.
- Remove glossy candy panels from battle-critical surfaces. Category colors
  identify attack, defense, and support, while stone and iron own structure.

## Battle hierarchy

1. Persistent lintel: battle identity, gold, gems, wave, speed, pause, dungeon
   HP, and remaining invaders.
2. Compact formation strip: deployed rooms, guardians, traps, equipment, and
   durability without covering the route.
3. Live dungeon route: room state, invader movement, entry/exit direction, and
   boss status.
4. Primary command plate: start the invasion before combat; show a disabled
   in-progress state during combat.
5. Tactical dock and room skill panel: three global commands plus the selected
   guardian's equipped skills.
6. Outcome command: consequence and rewards first, then one dominant next
   action and clearly secondary recovery or inspection actions.

## State and interaction matrix

| State | Required proof | Primary interaction |
| --- | --- | --- |
| Idle | formation, room route, HP, and ready command | open wave briefing |
| Briefing | threat, size, damage, enemy rows, route consequence | start defense |
| Active | current wave, remaining force, live HP, disabled start plate | speed, pause, skills |
| Paused | play affordance and frozen combat clocks | resume |
| Boss | named boss HP and current/max value in the command strip, clear of rooms | continue tactics |
| Wave clear | stars, reward, combat stats, materials, damage state | next wave or inspect defense |
| Wave fail | failure consequence and recovery hierarchy | revive, reset, or return |
| Reset confirm | explicit lost progress and gold | reset or retain fail state |
| Stage clear | chapter result, crystals, run stats, materials, guardian growth | next gate or front |

Core labels are at least 10px. Speed and pause controls are 50×50px; result,
confirmation, and briefing actions are 44px or taller. Reduced-motion mode
must avoid continuous HP pulsing, reveal tactical popups without movement, and
activate outcome actions without delayed animation. Scene shutdown must remove
HUD registry listeners before another battle starts.

## Verification record — 2026-09-03

- Idle, active, and paused battle states, exact 390×844 renders:
  `tools/screenshots/battle-command-idle-final-390x844.png`
  (`bdc2d070fb95be191e0a982b8c5f62d824da76796049ff91c26022137cf0d684`),
  `tools/screenshots/battle-command-active-final-390x844.png`
  (`623a1e32ccb01152f9d035b9e02d711c926d23c6fe6df2aa0b5167b94406b800`),
  and `tools/screenshots/battle-command-paused-final-390x844.png`
  (`76e44f918348060111fcf5ed502ca93530cff114d7e98142a70bd03da74569ed`).
- Wave briefing, tactical skill panel, and boss status, exact 390×844 renders:
  `tools/screenshots/battle-wave-preview-final-390x844.png`
  (`191e08574e94947f8fff74380be4280aa647a2e6b674887d8aaf1682b8e1f8e6`),
  `tools/screenshots/battle-skill-command-final-390x844.png`
  (`c1f98d7ee1b82ef17be2ab0f0ae8bd78df2428d3c9da582f182398cd623e2e51`),
  and `tools/screenshots/battle-boss-command-final-390x844.png`
  (`6052a82236017a91fc8b351db33099255f463e42e47d4d4071aa87dba6ca528e`).
- Wave success, generic fail, and invasion fail, exact 390×844 renders:
  `tools/screenshots/battle-outcome-success-final-390x844.png`
  (`cb7866168bbe15a227c486d10ea967d9e0f5686d22715dc0da1b6a98b472f998`),
  `tools/screenshots/battle-outcome-fail-final-390x844.png`
  (`57488a8e445c279018d6e33b7e605e0a39ba26a7aac982c69c400b3ba9ee9d2a`),
  and `tools/screenshots/battle-outcome-invasion-fail-final-390x844.png`
  (`7d6c35f3ffe4db8f3d938b889e3b221d076f0206a9ccf60666bbc2c0a686e9d6`).
- Reset confirmation and stage clear, exact 390×844 renders:
  `tools/screenshots/battle-reset-confirm-final-390x844.png`
  (`43aa8f910b1865670eca06514273c75321b9887930144a829cf430340599032b`)
  and `tools/screenshots/battle-stage-clear-final-390x844.png`
  (`e43465c035ec573ee5f36da8b8d49dfca9265376cf84622f494a855416197ab5`).
- Daily reward plus a four-of-five active guardian summary, exact 390×844 render:
  `tools/screenshots/battle-stage-clear-daily-roster-final-390x844.png`
  (`fe17f67c98b74593c5b742d93c50065e7b79aa5f9051f9743c6b7918878440f7`).
- Browser interaction smoke passed with no runtime exceptions or console errors:
  the command plate opened the briefing and started wave 1; speed changed
  1×→2×; pause set battle time and tween scales to 0 and resume restored both
  to 2; the immediate-next action started wave 2; defense inspection restored
  the ready command; reset cancel retained the fail panel; invasion return
  stopped `UIScene` and opened `DungeonHomeScene`; stage return opened
  `StageSelectScene`. A zero-gem revive retained the fail panel and emitted
  `보석 부족!`; the reset modal consumed outside taps before they reached the
  live recovery actions below it. A rapid double-tap on revive invoked its
  callback once.
- Reduced-motion smoke passed: the skill popup appeared at alpha 1 with zero
  popup tweens, low-HP pulse remained disabled, and both result actions were
  immediately interactive. Stage-clear content also rendered fully at alpha 1
  with no active reveal tweens and an immediately interactive enabled action.
- Three consecutive `DungeonScene`/`UIScene` stop-start cycles retained the
  same shutdown-listener counts (`DungeonScene` 15, `UIScene` 21) and one
  registry listener each for gold, gems, HP, wave, and pause.
- Focused battle checks: 6 files, 24 tests passed. Full `npm test`: 99 files,
  2,824 tests passed.
- `npm run build`: passed; Vite retained its existing large-chunk advisory.
- `git diff --check`: passed.

# Fusion Chamber Design Contract

> Scope: `FusionScene`, its four transaction tabs, monster picker, combination
> codex, destructive confirmation, and persistent result panels at the 390×844
> logical canvas. Recipes, costs, quest progress, persistence, and successful
> owned-monster semantics remain authoritative in `src/data/fusion.ts` and
> `src/data/fusionTransactions.ts`. One verified stale-source rejection is
> recorded below.

## Product job

Fusion is the dungeon master's ritual chamber for restructuring the legion, not
a bright emoji laboratory. Before one irreversible action, the player must be
able to identify the targets and materials, the exact resource or monster loss,
the expected result, and any failure condition.

## F0 read-only audit

- The previous shell mixed a cream `CASUAL` tray, `🔬 연구소`, and a floating
  `🪄` with the otherwise dark dungeon product language.
- Target, material, result, consequence, and action were separated by large
  empty regions. Evolution's result card could collide with its CTA.
- Combination's header used a hard-coded `/10` while the live recipe table had
  23 entries. The unpaginated codex extended below the canvas.
- Picker, codex close, confirmation, and awakening utility actions did not share
  a 44px input contract. Visible 9px text remained in the old codex/awakening UI.
- Two rapid evolution CTA taps produced two live confirmation containers. The
  animation overlay was visual only, so underlying tab/actions could receive input.
- Existing destinations were retained: back opens `DungeonHomeScene`, the header
  opens the combination codex, slots open the monster picker, and the awakening
  acquisition action opens `AbyssScene`.
- Existing persistence ownership was recorded before editing: evolution and
  absorption update owned monsters plus fusion/quest progress; known combination
  also updates crystals/discovery, unknown combination only spends 100 crystals,
  and awakening updates stones, awakened state, and matching-copy stacks without
  incrementing `totalFusions`.
- Independent code review found one integrity gap: Combination selections could
  outlive a source consumed in another ritual, while the transaction accepted a
  source absent from the live roster.

## Reference-to-interface decisions

- Soot masonry, iron edges, restrained brass, jade, copper, and moonlight accents
  use the existing `DUNGEON_UI` authority. No new token or image asset was added.
- A code-drawn chamber arch and triangular ritual seal replace the laboratory
  emoji focus. Monster identity uses the existing generated portrait pipeline.
- The stone lintel contains return/title/codex; a separate status rail exposes
  soul crystals, awakening stones, and completed fusions; the four tabs retain a
  46px input height.
- Every tab uses the same first-viewport reading order: ritual identity, selected
  actors, predicted delta/result, explicit consequence, then one primary CTA.
- A bounded eight-item picker and seven-row codex use 44px paging and close
  actions. Unknown codex entries do not reveal recipes.

## First-viewport hierarchy

1. Stone lintel: dungeon return, `융합 의식실`, and live codex progress.
2. Resource/status rail: soul crystals, awakening stones, completed fusions.
3. Four equal tabs with visible availability counts.
4. Static ritual seal and a one-line explanation of the active rite.
5. Tab workbench: targets/materials, computed result/delta, irreversible warning,
   and one 48px primary action.

Core and telemetry labels are at least 10px. Disabled states retain the missing
condition and predicted outcome but attach no input handler. Selected monster
copies keep an ephemeral picker index so the same owned instance cannot fill
multiple evolution or sacrifice slots; this index is never serialized.

## State and interaction matrix

| Surface | Required visible state | Preserved transaction rule |
| --- | --- | --- |
| Evolution | three matching slots, exact selected levels, evolved portrait/rarity/ATK, permanent-loss warning | consume three matching copies; create the next tier at the highest selected level |
| Absorption | primary target, up to five sacrifices, XP and stack delta, permanent-loss warning | target cannot be a sacrifice; remove sacrifices and apply XP/same-lineage stacks |
| Combination | two live owned sources, live balance and 100 cost, known or unknown result language | known adds hybrid/discovery/progress; unknown spends 100 but adds no fusion progress |
| Awakening | portrait-first target, affinity, stone count, already-awakened state, affected-copy count/passive | require owned target, affinity 100, one stone, and not-awakened; apply +3 stacks to matching IDs |
| Picker | zero to eight visible items and bounded pagination | selection changes presentation state only |
| Confirm | exact loss/cost, cancel, one execute action | background taps are consumed; cancel does not mutate persistence |
| Result | static success/discovery/failure receipt and one completion action | transaction latch remains held until acknowledgement |

## Input, motion, and lifecycle contract

- The primary CTA acquires one scene-level latch on its originating
  `pointerdown`, before the 70ms press tween. Tab switching and another action
  cannot enter the confirmation gap.
- CTA, confirmation, animation, and result callbacks are once-only. Picker,
  codex, confirm, animation, and result layers own full-screen input shields.
- Cancel releases the latch and rebuilds the current header/tab action. Result
  acknowledgement releases the latch only after the saved receipt is visible.
- Reduced-motion mode keeps the ritual seal, confirmation, and complete result
  state, removes travel/rotation, and settles the guarded animation in 40ms.
- Scene shutdown clears local selection/latch references. There are no recurring
  Fusion timers or infinite Fusion tweens.
- Retained Combination slots reconcile to live owned copies using exact ID/level
  first and same-ID fallback second. Missing sources clear the slot; the pure
  transaction independently rejects insufficient owned-source counts without
  spending crystals.

## Must not have

- Direct `GameState` mutation, duplicated recipe/economy logic, or unrelated
  transaction failure changes. The reviewed `combination_source_not_owned`
  integrity guard is the only exception in this slice.
- New save fields, dependency, route, asset, rarity/balance value, or root navigation item.
- Emoji-only controls, hidden disabled-state information, auto-dismissed transaction
  receipts, unbounded picker/codex content, or an input-transparent overlay.

## Verification record — 2026-09-04

All screenshots below are exact 390×844 browser captures at runtime DPR 2 from
isolated localStorage fixtures. The deterministic evidence captures use
`prefers-reduced-motion: reduce`; a separate normal-motion race pass exercised
the live press tween and picker travel. A final-source recapture after the
stale-source guard produced the same hashes recorded below.

| Evidence | SHA-256 |
| --- | --- |
| `tools/screenshots/fusion-evolution-empty-390x844.png` | `36b9a644e9b38d1b54442ec0b42ff9603e1f496937030d7db84a5ce5b07bfd57` |
| `tools/screenshots/fusion-absorption-empty-390x844.png` | `631e0351a7a4699f315b04e308de9a14214bdd756337dfb5f86baf254a49aec7` |
| `tools/screenshots/fusion-combination-empty-390x844.png` | `426beacf32868d73be625380f894fb7d6c007caaa679af47562bff685f0cfe7c` |
| `tools/screenshots/fusion-awakening-empty-390x844.png` | `3543790a8fe59c15296db79a52522139551d05027f44920761ae14d7ef706ed7` |
| `tools/screenshots/fusion-codex-390x844.png` | `a36b41c6e87e937b471df3ced2c578cddb0ea62a4707a55faf14e28b26fa02ef` |
| `tools/screenshots/fusion-picker-390x844.png` | `93d6360c8bab969d949cd3cfa5e2166d0424d02224dd91c19139122e5221958f` |
| `tools/screenshots/fusion-evolution-eligible-390x844.png` | `bc20b412a95e287fc8c07baee259b7fd1a8e9703b280ad5059f470a7f5766c1c` |
| `tools/screenshots/fusion-confirm-destructive-390x844.png` | `29626de033ababf01732cf0e4c283e2c070727439ad24ef86dd25a3a0dede48a` |
| `tools/screenshots/fusion-evolution-success-390x844.png` | `483a5199e98d63df46bfd0c627f01175474ae1ce5e92577db4263c3f4520ec82` |
| `tools/screenshots/fusion-absorption-eligible-390x844.png` | `9ccfbe61cfaa756f92627cdca800a2837d6b2215252482060979c43681a28eeb` |
| `tools/screenshots/fusion-absorption-success-390x844.png` | `232a5297b013be94e9bbe3039227d46d7cd1b8ec8d26a6d93a0f08b497adcace` |
| `tools/screenshots/fusion-combination-insufficient-390x844.png` | `df36f29a1866b2d922aaa69bfe3c51b9de9e9bdd6468663fbf739ee66d05dbdd` |
| `tools/screenshots/fusion-combination-known-390x844.png` | `631f2dd3c97baf06a276056f44162ee6c401d7f753ba4b33294923f19be16cb6` |
| `tools/screenshots/fusion-combination-discovery-390x844.png` | `464b8ddddd5f6bfd0ddec4fc65193f6871600175705a62b257422389e02c77ba` |
| `tools/screenshots/fusion-combination-unknown-390x844.png` | `94454ba8ba48c6b75156d824c21f0c7e4199a1c32ec3ac3f389f3e470c1f09af` |
| `tools/screenshots/fusion-combination-fail-390x844.png` | `2447c76dc77527fb38f9097971d7a30355e94c954def4556f7fcc24b191f060b` |
| `tools/screenshots/fusion-awakening-eligible-390x844.png` | `11188807fe87dda2f232ffd2a1ff060234cef412ed646cac73816ae68e10525f` |
| `tools/screenshots/fusion-awakening-success-390x844.png` | `c7ad81ecb4f8306fe8475ba1a5e29d059deb958b4ec20bb31e1b436d5c0e0347` |
| `tools/screenshots/fusion-awakening-complete-390x844.png` | `78067a6aa073de5b3c88fc51e326d80461584c44812d0ac1f2b1c610d006eb23` |

- Evolution fixture selected levels `3/7/5`, consumed three
  `dokkaebi_warrior` copies, created `dokkaebi_warrior_unc` at level 7, and
  incremented `totalFusions 0→1`. The destructive cancel path preserved all
  four original monsters; rapid double-tap plus a cross-tab tap produced one
  confirmation and one eventual transaction.
- Absorption removed one `dokkaebi_warrior_unc`, applied `+80 XP` and stack
  `2→3` to the target, and incremented `totalFusions 2→3`.
- Known combination retained both source guardians, spent crystals `150→50`,
  added `fox_warrior`, recorded discovery, and incremented `totalFusions 4→5`.
  Unknown `dokkaebi_warrior + village_archer` retained both sources, spent
  crystals `150→50`, and retained `totalFusions 2`.
- A stale or missing Combination source now returns
  `combination_source_not_owned` with the original state object, crystal balance,
  and roster unchanged. Same-ID stale selections rebind to the actual live copy,
  so the displayed source level and the saved hybrid level use the same input.
- Awakening spent stones `1→0`, marked `dokkaebi_warrior` awakened, changed two
  matching-copy stacks `[2,1]→[5,4]`, and retained `totalFusions 7`.
- Across empty, eligible, insufficient, picker, codex, confirm, success,
  discovery, failure, and awakened captures: visible text below 10px `0`,
  interactive bounds below 44px `0`, text overflow `0`, console/runtime errors `0`.
- Reduced-motion picker, confirm, animation, and result content remained complete
  and interactive. Normal-motion CTA/cross-tab racing retained the evolution tab,
  one latch, and one confirmation; cancel released it.
- Three reduced-motion restarts produced the same signature each cycle:
  `children 9`, `interactive 9`, `timers 0`, `tweens 0`, `shutdown listeners 15`,
  `overlay blockers 0`. The standard web-game client also retained
  `FusionScene` as the only/top scene at 390×844, DPR 2, with no error artifact.
- Focused Fusion checks: 3 files, 128 tests passed. `npx tsc --noEmit`: passed.
  Full `npm test`: 100 files, 2,830 tests passed.
- `npm run build`: passed; Vite retained the existing large-chunk advisory.
- `git diff --check`: passed.
- Independent goal/context, code/security, and QA/evidence reviews passed after
  the stale-source fix and dated handoff synchronization.

Unverified by this web-only slice: 360×800 and 430×932 app-wide regression,
physical-device accessibility, native Android/iOS packaging, and store release.

# Summon Altar Design Contract

> Scope: `SummonScene`, its probability panel, contract history, and single/
> ten-pull result overlays at the 390×844 logical canvas. Summon odds, pity,
> costs, banner selection, collection ownership, duplicate compensation,
> persistence, and navigation remain authoritative in the existing data layer.

## Product job

Summoning must feel like expanding the dungeon master's legion through a
dangerous altar contract, not opening a bright card pack. The first viewport
must show the physical contract core, collection progress, current resources,
the four contract paths, their affordability, and any approaching guarantee.

## Reference-to-interface decisions

- Carry Monster Never Cry's dungeon-master and monster-legion fantasy into a
  physical altar, contract ledger, and army-growth language.
- Adapt Dungeon Maker's room-and-monster volume as distinct contract paths with
  explicit tactical purpose, rather than a generic rotating banner.
- Adapt AFK Journey's strong character reveal only inside the result stage; the
  altar and transaction hierarchy remain dominant before a pull.
- Adapt Clash of Clans' persistent resource and upgrade readability: price,
  shortage, free state, and guarantee distance remain readable without relying
  on accent color alone.
- Keep Hades II as a tone anchor: soot-black masonry, strong ritual silhouette,
  restrained brass and moonlight, and short high-contrast reveal feedback.

## First-viewport hierarchy

1. Stone lintel: legion return, altar title, gems, and soul crystals.
2. Physical altar chamber: collection ledger, contract core, lifetime legion record.
3. Two 44px tabs: summon contracts and persistent contract history.
4. Four contract plates: identity sigil, purpose, price, guarantee or daily state,
   one/two 44px actions, and a broad probability affordance.
5. Empty lower dungeon depth remains visible; future content does not become
   filler cards.

Core labels are at least 10px. Disabled actions retain their price and purpose
but have no input handler. Rarity accents identify contract/result class while
stone and iron continue to own structure. Brass marks interaction, jade marks
free or successful progression, and ember marks resource shortage.

## State and interaction matrix

| State | Required proof | Interaction rule |
| --- | --- | --- |
| No resources | exact shortage, disabled 1/10/soul actions, free route visible | disabled zones do not mutate state |
| Contract ready | balance, filled guarantee rail, enabled costs and CTA | transaction remains owned by `applySummonPull` |
| Probability detail | rarity label, stars, percentage, guarantee rule | panel consumes inside taps; outside or close dismisses |
| History | filters, monster identity, rarity, NEW/duplicate reward, totals | filter changes presentation only |
| Single result | bounded portrait, identity, rarity, contract status, outcome | one 44px completion CTA, once-only callback |
| Ten-pull result | all ten plates, best pull, duplicate/new summary | one 44px completion CTA, once-only callback |

Reduced-motion mode removes particles, the recurring portal orbit, charge/flash,
flip, focus scaling, and reveal travel. Result content and its completion action
must be present within the shortened deterministic sequence.

## Verification record — 2026-09-03

- Empty and transaction-ready altar states, exact 390×844 renders:
  `tools/screenshots/summon-altar-empty-final-390x844.png`
  (`3a70f2cbeba9c7f061124870a7fe1f82e5b69960b2bf2652882e2d551508b314`)
  and `tools/screenshots/summon-altar-ready-final-390x844.png`
  (`36957d99605d2251e1dfff6c2deadee23a568853b9e37e494fab23d18addfdb2`).
- Active featured-banner state, exact 390×844 render:
  `tools/screenshots/summon-banner-final-390x844.png`
  (`8c00707808470e020897ca4ec725e20a2f951efce25618496d51dbe1ce044f68`).
- Base probability, active-banner probability, and populated history states,
  exact 390×844 renders:
  `tools/screenshots/summon-rates-final-390x844.png`
  (`c6b3905c6eb8dd159f0ae70cce8817b06a1b58aaa5086bc8219d322919e05007`),
  `tools/screenshots/summon-banner-rates-final-390x844.png`
  (`3cdf95ce30d4cf2b0ad659c6ff439db34e54fc1e64e35b649730f5e877f0137c`),
  and `tools/screenshots/summon-history-final-390x844.png`
  (`8a11ef15f6bb4c30c73ad99d5f5aab04c7e20244d1623ae6b06da07a60173612`).
- Single and ten-pull outcomes, exact 390×844 renders:
  `tools/screenshots/summon-result-single-final-390x844.png`
  (`c4b3c755b3bf7cba559fae230834c9230b8d118f76c3e0ba899430ec188cce48`)
  and `tools/screenshots/summon-result-multi-final-390x844.png`
  (`87baf504b682f2d12c10ac5510fa2b3d693661a26924792a4a0b3dcf09e76be2`).
- Browser smoke confirmed probability-panel inside/outside input isolation,
  result-overlay background shielding, history filters, no sub-10px visible
  contract/result text, and a fixed 112×112 generated portrait stage. Background
  taps did not reach an underlying contract or tab; rapid double-taps invoked each
  completion callback once. Normal-motion taps before the 1.5s/3s skip thresholds
  were ignored; taps after each threshold dismissed once with no delayed overlay return.
- A disabled ten-pull retained gems `0` and history `0`; an enabled ten-pull
  changed gems `500→250`, appended ten records, and presented the result action.
- A 10ms cross-button burst on normal 1/10 actions produced exactly one
  transaction (`gems 1000→970`, history and pity `0→1`). A rejected zero-gem
  pull released the scene latch without creating an overlay or history record.
- Reduced-motion smoke rendered all ten contract plates and both result actions
  within 300ms, with no summon particles or recurring altar timer. Three reduced-
  motion restarts retained `27` children, zero particles, and zero recurring timers.
- Three normal-motion restarts retained `29` children, two scene particles, and
  one recurring portal timer. Browser runtime smoke produced no exception or
  console error; logical viewport remained 390×844 at DPR 2.
- Focused summon checks: 3 files, 87 tests passed. Full `npm test`: 99 files,
  2,824 tests passed.
- `npm run build`: passed; Vite retained its existing large-chunk advisory.
- `git diff --check`: passed.

# Production District Design Contract

> Scope: `ProductionScene` at the 390×844 logical canvas. Facility definitions,
> build/upgrade costs, hourly output, idle-income cap, decoration multipliers,
> persistence, and the `StageSelectScene` return route remain authoritative in
> `src/data/production.ts`, `src/data/productionTransactions.ts`, and
> `src/data/idleIncome.ts`.

## Product job

Production is the dungeon master's working undercroft: a compact district where
the player reads what is operating, what has accumulated, and which single
facility order best advances the Forge/Fusion supply loop. It must feel like a
connected mine, garden, loom, mana well, and treasury rather than five unrelated
store cards.

## P0 read-only audit

- The previous surface presented five raised catalog cards with large emoji
  medallions and repeated build buttons, so facility relationships and one next
  decision were weak.
- Five facility descriptions rendered at 9px. The two affordable build actions
  at the default 200-gold state used 40px hit areas; the disabled collect action
  used a 34px visual surface.
- The collection panel exposed the reward total but not elapsed/credited time or
  the existing eight-hour cap.
- Build/upgrade and collect completed through the correct pure transactions, but
  the scene rebuilt its children after creating a transient toast, making the
  result feedback effectively disappear.
- Baseline exact 390×844 / DPR 2 capture:
  `tools/screenshots/production-before-390x844.png`. The standard web-game client
  independently confirmed `ProductionScene` as the only active/top scene with a
  390×844 logical canvas and no console error artifact; its WebGL canvas export
  was black, so visual evidence uses a browser page capture.

## Reference-to-interface decisions

- Carry Dungeon Maker's room-and-facility legibility into one code-drawn
  undercroft map: all five stations remain visible and their connecting conduit
  makes the supply chain spatial rather than card-based.
- Adapt The King is Watching's compact decision loop: selecting a station changes
  one command plate containing current output, next output, exact cost, shortage,
  and one build/upgrade action.
- Use Clash of Clans' persistent production readability: built/idle/max states,
  level, hourly rate, accrued reward, and the eight-hour cap stay visible without
  depending on color alone.
- Keep the established dungeon language: soot and iron own the structure, brass
  marks selection/action, jade marks an operating or claimable facility, and
  ember marks a resource deficit. Facility identity uses code-drawn silhouettes,
  not emoji-only controls or a new asset/dependency.

## First-viewport hierarchy

1. Stone lintel: return action, `생산 구역`, and working-undercroft purpose.
2. Status rail: current gold, built count, aggregate facility rate, and eight-hour cap.
3. Collection cistern: elapsed/credited state, complete accrued reward, and one
   48px claim action when a payout exists.
4. District cutaway: five 44px-or-larger station targets with name, level/state,
   and current hourly output.
5. Selected-facility command plate: description, current→next output, exact cost
   or MAX state, affordability/shortage, persistent receipt, and one 48px order.

When a payout exists, collection is the dominant jade action; otherwise the
selected facility order owns the dominant brass action. Disabled actions retain
the missing condition and predicted result but have no input handler. Core text
is at least 10px.

## State and interaction matrix

| State | Required visible proof | Preserved behavior |
| --- | --- | --- |
| Empty district | five unbuilt stations, build output, exact cost, affordable/deficit | first successful build spends exact gold and initializes an unset idle clock |
| Operating | built count, level, current rate, next rate/cost | upgrade spends exact scaled cost and increments only the selected facility |
| Claimable | elapsed or capped duration plus all gold/material outputs | `collectIdleIncome` credits once and resets the shared idle clock |
| No payout | zero-production explanation and disabled claim action | no state mutation occurs |
| Deficit | exact shortage and disabled order | pure transaction remains the authority and state is unchanged |
| Maxed | level 5, current rate, MAX command | no input handler and no spend |
| Receipt | facility or collection outcome remains readable after rerender | saved state and visible result describe the same transaction |

## Input, motion, and lifecycle contract

- Facility targets only change ephemeral selection; they never mutate or save
  `GameState`.
- Enabled claim/build/upgrade controls lock during the press tween. A 250ms
  transaction latch permits one commit per gesture burst, preserves the current
  listener after a rejected duplicate, and a successful commit consumes the
  current render by rebuilding the scene.
- Rerender destroys the prior display/input objects before rebuilding the scene;
  repeated collect/build/re-entry must not accumulate zones, timers, or tweens.
- Reduced-motion presents the same complete state without decorative pulses or
  delayed result information. Production adds no recurring scene timer.

## Must not have

- Direct `GameState` mutation, duplicated economy calculations, or changes to
  facility costs/rates/order, idle cap, decoration multipliers, save schema, or routes.
- New dependency, image asset, root navigation item, native/platform change, or
  content outside `ProductionScene` and its narrowly scoped presentation evidence.
- Hidden cap/shortage/result information, sub-10px core text, sub-44px changed
  targets, emoji-only controls, infinite pulse, or auto-dismissed transaction proof.

## Verification requirements

- Capture exact 390×844 / DPR 2 renders for empty/deficit, operating/claimable,
  maxed, build receipt, upgrade receipt, and collection receipt states.
- Exercise facility selection, affordable build, scaled upgrade, insufficient
  gold, maxed state, one capped idle collection, rapid-tap protection, return
  navigation, reduced motion, and three restart/rerender cycles.
- Record visible text below 10px, interactive bounds below 44px, clipping/overflow,
  console/runtime errors, and lifecycle signatures.
- Run focused production/idle tests, the standard web-game client, TypeScript,
  full tests, production build, and `git diff --check` before close-out.

## Verification record — 2026-09-04

All final screenshots below are exact 390×844 browser captures at runtime DPR 2
from isolated localStorage fixtures with `prefers-reduced-motion: reduce`. The
normal-motion rapid/cross-input passes used the live 70ms shared-button press
tween; the reduced-motion recovery pass exercised its immediate path.

| Evidence | SHA-256 |
| --- | --- |
| `tools/screenshots/production-before-390x844.png` | `89b8e05561b4af384a475f0b7f1d3e54feea47e95896c9606011e61882e00ed7` |
| `tools/screenshots/production-empty-final-390x844.png` | `7ba37adb43c2fe04993af29c9be9a1285de41c1eb1a649e916002d5736b03a9e` |
| `tools/screenshots/production-deficit-final-390x844.png` | `81380f02722ad95b9c31e4a77e3ea511f252bd1e9effd743e03c25d85b77758b` |
| `tools/screenshots/production-operating-final-390x844.png` | `df37a956c2310f10b293202aa90140afb11d13fcc9acb7daa38a57cae0fb31c5` |
| `tools/screenshots/production-maxed-final-390x844.png` | `8f684dd0adb366b1bec21426f0257e2e1deeadfef0233e572be1089f1e3c5d1c` |
| `tools/screenshots/production-build-receipt-final-390x844.png` | `91fc2502c1182f859ded19dde2af25d52776a75dc98d17a16b49d9fba12b7c3b` |
| `tools/screenshots/production-upgrade-receipt-final-390x844.png` | `b42b40149551d40266488aea6c6ce6e09b6673d23389fa2efe4dbb209877e61f` |
| `tools/screenshots/production-collect-receipt-final-390x844.png` | `716c8e02d24a39848f4c798de1a93e1791ece39208cf6f668b9ea31189a9b8c7` |

- Empty and zero-gold fixtures exposed all five stations, exact next output and
  cost, and no input handler for the disabled order. Selecting Treasury changed
  only `selectedFacilityId`; the serialized save string remained byte-identical.
- The operating fixture showed `5 / 5` facilities, material rate `12.5 / hour`,
  Treasury rate `100 / hour`, and the explicit eight-hour cap. The maxed fixture
  showed Mine `Lv.5 / 5`, `+10 / hour`, `최대 효율 도달`, and a non-interactive
  `MAX` command.
- A first Mine build spent gold `200→50`, set Mine `0→1`, initialized an unset
  idle clock, and retained a visible `골드 150 소모` receipt after rerender.
- A Mine upgrade spent gold `1,000→730`, changed Mine `1→2`, retained the existing
  idle timestamp, and showed the exact `골드 270 소모` receipt.
- One capped collection changed gold `5,100→9,644` and materials
  `common_ore 3→35`, `herb 4→20`, `old_cloth 0→36`, and
  `magic_dust 0→16`; the visible receipt listed the same `+4,544 / +32 / +16 /
  +36 / +16` deltas and reset the shared idle timestamp.
- Two immediate normal-motion order taps produced one transaction only: gold
  `1,000→850` and Mine `0→1`. A facility tap during the order tween could not
  cancel or redirect the build, and the equivalent collect cross-input retained
  one exact capped payout. Reduced-motion immediate duplicate input was also
  blocked without consuming the rebuilt CTA: after 300ms the same control
  recovered and upgraded Mine `1→2`, spending gold `850→580`.
- A high-balance fixture formatted gold `999,999,999,999` as `1조`; its text
  bounds remained inside the first status cell without changing stored value.
- Empty, deficit, operating, maxed, build, upgrade, and collect audits found
  visible text below 10px `0`, interactive bounds below 44px `0`, text overflow
  `0`, and console/runtime errors `0`. Back opened `StageSelectScene`.
- Three selection rerenders retained `children 81`, zero timers, zero settled
  tweens, and 14 shutdown listeners; the interactive count was six or seven only
  according to whether the selected order was enabled. Three scene restarts
  retained `children 84`, seven interactive targets, zero timers/tweens, and 14
  shutdown listeners on every cycle.
- The standard web-game client confirmed `ProductionScene` as the only/top scene
  with a 390×844 logical canvas at DPR 2 and produced no console error artifact.
  Its WebGL canvas-export PNG was black, so it was excluded from visual evidence;
  the page-level captures above were opened and inspected instead.
- Focused production/idle/HUD-formatting checks: 4 files, 39 tests passed.
  `npx tsc --noEmit`: passed. Full `npm test`: 102 files, 2,837 tests passed.
- `npm run build`: passed; Vite retained the existing large-chunk advisory.
- `git diff --check`: passed after the implementation and evidence update.

Unverified by this web-only slice: whole-app 360×800 and 430×932 regression,
physical-device accessibility/text scaling, Android/iOS packaging, and store release.

# Ancestral Wisdom Chamber Design Contract

### 2026-09-22 선조의 지혜 효용 보완

슬롯 상한 초과분은 1칸당 던전 최대 HP +20으로 적용한다. 이 노드의 표시 권위는
`getAncestorsWisdomEffect`이며, 실제 DM 레벨 기준 슬롯/HP를 현재·다음 효과에 함께
표시한다. 다음 효과와 비용은 별도 줄에 배치한다. 확인 dialog는 효과도 snapshot에
포함해 DM 성장으로 내용이 달라진 거래를 거절한다. 기존 배치·보드·비용·저장 형식은
유지한다. 아래 W0~W5는 당시 기록이며 최신 구현·검증은 결함 스윕 인계 §14를 따른다.


> Scope: `AncestralWisdomScene` at the 390×844 logical canvas. The twelve
> branch definitions, five-tier ceiling, tier costs, effect formulas, upgrade
> transaction, computed bonuses, save schema, and previous-scene return remain
> authoritative in `src/data/wisdom.ts` and `src/data/navigationContract.ts`.

## Product job

Ancestral Wisdom is the dungeon master's permanent-growth ritual chamber:
inspect one lineage, understand the current and next effect, see the exact soul
crystal consequence, then authorize one irreversible tier upgrade. The chamber
must expose all twelve branches as named decisions rather than an unlabeled
radial ornament.

## W0 read-only audit — 2026-09-04

- The prior screen placed twelve emoji-only nodes around one altar. Two right
  nodes extended beyond the 390px viewport, multiple central nodes competed on
  one vertical axis, and the player could not identify a branch without opening
  it.
- `drawBranches()` added a node input after `renderNode()` had already added the
  same input. The initial scene therefore owned 24 branch zones for 12 branches.
- The detail close affordance used the text glyph's roughly 13×16 bounds. The
  upgrade target was 210×40, and confirm/cancel targets were 86×34. The confirm
  overlay rendered at depth 120 while the open detail sheet rendered at depth
  300, leaving both transaction surfaces visible at once.
- The old surface created up to 31 decorative infinite tweens in normal motion:
  18 mist drifts, 12 connector pulses, and one altar pulse. Upgrade feedback also
  depended on delayed sheet closure/reopening and transient floating/toast text.
- Live source exposes one wisdom mutation only: `upgradeWisdomBranch`. There is
  no wisdom equip or reset state, transaction, or save field. The handoff phrase
  `purchase/equip/reset` is stale; this slice preserves the real upgrade
  authority and does not invent equip/reset behavior.
- Focused baseline passed: 2 files, 91 tests. Exact 390×844 / DPR 2 baseline
  captures are `tools/screenshots/wisdom-before-initial-390x844.png`
  (`4c72cc06564178cf870858ac9bc8680790975a37d5da1530a9ee9aaba3c6feb8`),
  `tools/screenshots/wisdom-before-detail-390x844.png`
  (`0a616b23ed63a740383b3974b5f7e81dad8da0fe63e89c59d7e8673c08893899`),
  and `tools/screenshots/wisdom-before-confirm-390x844.png`
  (`7baa2d7dbd697334a9d89bc2335405546f5cdeffd932aadb02e30d7e903e9446`).

## Reference-to-interface decisions

- Use the established `DUNGEON_UI` ritual language: soot and iron define the
  chamber, brass marks the selected lineage and authorization command, jade
  marks invested/maxed growth, and ember marks shortage or a stale rejection.
- Divide the existing ordered registry into four presentation-only lineage
  seals of three branches each. Every branch ID, name, icon, tier, cost, effect,
  and formula remains sourced from `BRANCH_DEFS`; the grouping writes no save.
- Replace the radial map and bottom sheet with one fixed chamber: four lineage
  seals, three named branch tablets, one selected-branch ledger, a persistent
  transaction receipt, and one dominant upgrade command.

## First-viewport hierarchy

1. Stone lintel: 44px return action, `선조의 의식실`, and permanent-growth purpose.
2. Status rail: soul crystals, invested tiers out of 60, and maxed branches out of 12.
3. Four 44px lineage seals and three 64px-or-larger named branch tablets.
4. Selected ledger: current tier, five-step progress, current effect, next
   effect, exact cost/deficit, and persistent result receipt.
5. One 48px upgrade authorization command. Confirmation uses a full-screen input
   shield and two 48px actions, with the exact before/after effect and currency.

All core text is at least 10px. Every changed enabled target is at least 44px in
both dimensions. Lineage and branch selection are presentation-only.

## State and interaction matrix

| State | Required visible proof | Preserved behavior |
| --- | --- | --- |
| Fresh | 0/60 tiers, 0/12 maxed, all four lineages | selection writes no save |
| Affordable | current→next effect, exact cost, post-spend balance | confirmation calls `upgradeWisdomBranch` once |
| Deficit | exact cost and missing crystals | no enabled upgrade handler and byte-identical save |
| Maxed | tier 5/5 and current final effect | no cost access and no transaction |
| Success | retained tier/cost/crystal delta receipt | returned immutable state is saved once |
| Stale | retained non-mutating rejection receipt | commit reloads save and requires the approved branch/tier/cost/balance snapshot to match before calling the transaction |
| Confirm/cancel | selected branch, consequence, 48px actions | cancel and background shield never mutate |
| Return | previous-scene destination is explicit | registry `previousScene` fallback remains `StageSelectScene` |

## Input, motion, and lifecycle contract

- A shared action latch owns an admitted upgrade before button feedback starts.
  Lineage, branch, return, or repeated confirm input cannot redirect or duplicate
  the transaction. Rejected input remains usable after a short cooldown.
- Confirm and cancel share one overlay-local pointer-down admission. The first
  decision disables both targets, and a pending selection rerender cannot admit
  an obsolete upgrade control.
- Confirmation is the only overlay and owns a 390×844 interactive shield above
  the fixed chamber. Rebuilding after success retains the receipt.
- No scroll/mask/drag/wheel listener, recurring timer, decorative infinite tween,
  or auto-dismiss transaction proof is allowed. Reduced motion retains every
  state and consequence.

## Writable boundary

- Allowed: `src/scenes/AncestralWisdomScene.ts`, a Wisdom-only presentation
  helper/test if needed, this contract, `docs/design/AGENT_HANDOFF.md`,
  `progress.md`, and `tools/screenshots/wisdom-*.png`.
- Read-only: `src/data/wisdom.ts`, wisdom economy/bonus tests, persistence,
  navigation authority, achievement consumers, summon/forge/combat consumers,
  balance, assets, dependencies, native/platform files, and unrelated dirty paths.

## Must not have

- Direct `GameState` mutation or duplicated branch, cost, effect, bonus,
  transaction, persistence, route, equip, or reset authority.
- New save field, dependency, route, asset, branch, balance value, native change,
  or unrelated dirty-path edit.
- Emoji-only branch identity, clipped nodes, duplicate input zones, sub-10px core
  text, sub-44px changed targets, transient-only receipt, or decorative loop growth.

## Verification requirements

- Capture exact 390×844 / DPR 2 renders for fresh, affordable, confirm, success
  receipt, deficit, maxed, and a non-default lineage.
- Exercise all four lineage seals and all twelve branch tablets without save
  mutation; verify exact cost/tier/crystal deltas, cancel, disabled deficit/max,
  stale source, duplicate/cross-input protection, cooldown recovery, return,
  reduced motion, and three rerender/restart cycles.
- Record text below 10px, targets below 44px, clipping/overflow, timers/tweens/
  listeners, console/runtime errors, and final authority-file hashes.
- Run focused Wisdom tests and presentation tests, the standard web-game client,
  TypeScript, full tests, production build, and `git diff --check` before close-out.

## Verification record — 2026-09-04

Final source SHA-256:

- `src/scenes/AncestralWisdomScene.ts`:
  `6230bd0d84ed9e8d1cc9288f33d51b0bc6680414281a91647d3a2cbbaa6b4af5`
- `src/ui/AncestralWisdomShared.ts`:
  `e3e38c8ed76e20ae9c4ab01c9bb81ddde74d6da4bd6773886050d0d4f25f187b`
- `src/ui/AncestralWisdomShared.test.ts`:
  `52cb00b0b8b31196afc1f3ac0c644da2b9a571b4d7b17d6f53a9c9aba1cc4d85`

All captures below were regenerated from that source, are 780×1688 physical
pixels for the exact 390×844 logical canvas at DPR 2, and were opened for visual
inspection.

| State | Evidence | SHA-256 |
| --- | --- | --- |
| Fresh | `tools/screenshots/wisdom-initial-final-390x844.png` | `0929d4e7c17838c0442243493c0a186901bf62e16d1f9f520de9f94a92148da7` |
| Affordable | `tools/screenshots/wisdom-affordable-final-390x844.png` | `2972fd9ec20b9cbd42a0181348ab3c8e03485fcfb4616e4ab410bfaac4a797d1` |
| Confirm | `tools/screenshots/wisdom-confirm-final-390x844.png` | `060567ba8622dbb7b7a5ef3623d3e02e9a3db479dd711c9fe6bd924a06e31456` |
| Success receipt | `tools/screenshots/wisdom-upgrade-receipt-final-390x844.png` | `eda8f45c765b54c4d78a94f7fb06a88d95daa4086d37734786c999a05fb3e964` |
| Deficit | `tools/screenshots/wisdom-deficit-final-390x844.png` | `1516a294d068cc255ac1958fb883395b7c90071215a7540d873ba9b7bb30a3ae` |
| All maxed | `tools/screenshots/wisdom-maxed-final-390x844.png` | `9890011b10b77606cb9c669ee29dc0b3f20b9aef165b64af7888bef271df7d13` |
| Abyss lineage | `tools/screenshots/wisdom-abyss-final-390x844.png` | `dc1622410f71ea49153c8341bc59427946ea5fcc9f46fd97bdb82ba1d1bcb7a3` |

- Browser traversal reached all twelve unique branch IDs across all four
  lineages with byte-identical persistence. Twelve selected-state audits found
  zero text below 10px, viewport overflow, or text collision. Enabled targets
  below 44px and console/runtime errors were also zero.
- The confirmation shield measured 390×844; confirm/cancel measured 146×48.
  Shield input retained the selected branch and open confirmation without save
  mutation. Cancel remained save-neutral. Success changed `goldHands 2→3` and
  soul crystals `100→80` exactly once for cost 20 and retained the receipt.
- Deficit and maxed fixtures exposed no upgrade input. Fresh-save tier, balance,
  and invalid-tier drift each remained byte-identical and produced the durable
  stale warning before transaction entry. Normal/reduced branch→upgrade and
  order→lineage races recovered without redirect or lock; cancel→confirm was
  save-neutral, while confirm→cancel admitted one exact upgrade only. Duplicate
  confirm spent once and the rebuilt action worked after its 250ms cooldown.
- Fallback return opened `StageSelectScene`; explicit `previousScene=ForgeScene`
  opened `ForgeScene`. Both were save-neutral. Three direct rerenders retained
  69 children and nine inputs; three restarts retained 72 children and nine
  inputs, including the expected three global ambient objects. Every cycle had
  zero timers, tweens, and scene-level pointer/drag/wheel listeners.
- The standard web-game client ran three final-source iterations and confirmed
  `AncestralWisdomScene` as the only/top scene at 390×844 and DPR 2 with no error
  artifact. Its known black WebGL canvas exports were inspected and excluded
  from visual evidence in favor of the page captures above.
- Focused Wisdom/presentation checks: 3 files, 96 tests passed.
  `npx tsc --noEmit`: passed. Full `npm test`: 103 files, 2,846 tests passed.
  `npm run build`: passed with the existing large-chunk advisory.
  `git diff --check`: passed.
- Read-only authority hashes remained: `wisdom.ts`
  `dd93e5bf52b2e33a48ff80d7042fb71c18e6becde6a3be7fffa516b3c5b58b3c`,
  `wisdom.test.ts`
  `f3539134247c10f7633e5f0206bbc8be8b491e452b580a094d4c51412d933400`,
  `wisdomEconomy.test.ts`
  `03729a1500b8befe0a961019869a69202b2bccff2587fb0c9c921c532a6bdb42`,
  and `navigationContract.ts`
  `5ec825a71831804d210db008fd9afa028f2959699677d28a20943a3255211f7d`.
- Independent code/transaction review passed after the three race/stale guards.
  Goal/context and QA/evidence review findings were documentation-only and were
  closed by synchronizing this final-source ledger and the handoff records.

Unverified by this web-only slice: whole-app 360×800 and 430×932 regression,
physical-device accessibility/text scaling, Android/iOS packaging, native/store
release, and the pre-existing malformed-tier validation debt inside the shared
`upgradeWisdomBranch` authority. The redesigned scene blocks that malformed tier
before transaction entry; authority hardening remains a separate scope.

# Codex Archive Design Contract

> Scope: `CodexScene` at the 390×844 logical canvas. The 136-entry monster
> registry, invader/modifier/event registries, existing tribe reward mapping and
> transactions, save schema, Legion membership, and contextual `previousScene`
> return remain authoritative in their current source files.

## Product job

Codex is the Legion's intelligence archive and reward vault. The player must be
able to reach every recorded guardian or threat, understand one selected record,
see the exact remaining tribe requirement, and issue one eligible tribe-reward
order without dragging through a catalogue.

## C0 read-only audit — 2026-09-04

- The live registry contains 136 monsters. The prior eleven-tribe accordion
  exposed 134 and permanently omitted the tribe-less `village_archer` and
  `thunder_hero` entries.
- The default guardian view stacked the expanded 20-entry Dokkaebi tribe into
  `maxScrollY=720`; the invader archive reached `maxScrollY=1,852`. Runtime
  inspection found 61 guardian and 95 invader labels below 10px.
- The 34px claim-all bar and 24px individual reward visual were smaller than the
  changed-surface target standard. Individual claim required `owned === total`
  while the scene's claim-all eligibility excluded its mapped reward, so the two
  controls disagreed. Success and failure had no persistent receipt.
- Reward transactions intentionally trust their caller. The scene calculated
  eligibility from a cached snapshot but submitted a freshly loaded save, which
  could grant a stale order after the live roster had become incomplete.
- Three tribes contain an additional unmapped `codex_reward` monster, and three
  mapped rewards are ordinary summon-pool entries. No combat consumer was found
  for the old UI-only `bonus` copy, so this surface must not describe a set effect
  as active gameplay authority.
- Baseline exact 390×844 / DPR 2 captures:
  `tools/screenshots/codex-before-current-390x844.png` (`b08df242aaf6a8f819605fab17306ba5c0c0cc53bb62d517ce31f681aba811e6`)
  and `tools/screenshots/codex-before-claimable-390x844.png`
  (`8c03191253dd5415d52d0fb93e559de62ef30b327925be26a0be5b30d1dfec17`).

## Reference-to-interface decisions

- Continue the completed Legion architecture: soot and iron own the archive,
  brass marks selection/reward readiness, jade marks owned/claimed records, and
  ember marks an invalid or stale order. Literal labels accompany every sigil.
- Replace scroll and accordion state with bounded archive controls. Four mode
  seals choose guardians, invaders, challenge modifiers, or wave events; each
  archive uses explicit selectors and previous/next paging.
- Guardians use twelve visible archive seals: the eleven authoritative tribes
  plus a presentation-only `기타` group for the two tribe-less registry entries.
  Tribe selection, page selection, record selection, active tab, and owned-only
  filtering remain ephemeral and never enter `GameState`.
- A tribe requirement excludes its mapped reward and every registry entry whose
  `unlockMethod` is `codex_reward`, because such entries cannot be prerequisites
  for a reward order. The mapped reward label is derived from `MONSTER_DEFS`, not
  duplicated display copy. This is a UI eligibility repair; reward mutation still
  delegates unchanged to `claimCodexTribeReward` / `claimAllCodexTribeRewards`.
- Before either transaction, eligibility is recomputed from the same freshly
  loaded save passed into the existing transaction. A stale or already-claimed
  request changes nothing and leaves a durable warning receipt.

## First-viewport hierarchy

1. Stone lintel: contextual return, `군단 도감`, and archive purpose.
2. Status rail: owned monster types, claimed tribes, and current archive count.
3. Four 44px-or-larger mode seals.
4. Mode-specific bounded selector: twelve guardian groups or nine invader chapters.
5. Selected archive ledger with completion/threat context and page position.
6. Three selectable guardian/invader plates or four modifier/event plates, with
   explicit previous/next controls.
7. Selected-record intelligence panel or guardian detail action.
8. Guardian-only reward command plate with exact requirement, reward identity,
   persistent receipt, and one 48px-or-larger selected/aggregate claim action.
9. Shared four-zone root navigation with Legion active.

Core text is at least 10px. Disabled actions retain the exact missing condition
but attach no input handler. Every record remains reachable without camera drag.

## State and interaction matrix

| State | Required visible proof | Preserved behavior |
| --- | --- | --- |
| Initial guardian | all twelve groups, owned/required count, mapped reward | selection does not mutate save |
| Tribe-less | `기타` group and both named records | no reward action is fabricated |
| Incomplete tribe | exact remaining eligible requirement and disabled order | state remains unchanged |
| Claimable tribe | required collection complete, mapped reward, selected claim | existing per-tribe transaction grants once |
| Multiple claimable | exact eligible count and aggregate action | existing claim-all fold grants each mapped reward once |
| Claimed | claimed state and reward ownership | duplicate request changes nothing |
| Stale request | latest-save revalidation warning | transaction is not called and save is unchanged |
| Invader | nine chapters, every chapter record, stats and behavior | invader data remains read-only |
| Modifier/event | every definition through bounded pages and selected detail | combat selection/effect authority is unchanged |
| Detail overlay | owned guardian stats, passive, deployment, growth preview | modal blocks underlying input and closes with a 44px target |

## Input, motion, and lifecycle contract

- One scene-level transaction latch blocks rapid and cross-selection duplicate
  reward orders. A rejected order preserves the rebuilt control for a later retry.
- View controls cannot redirect an admitted transaction. Successful and failed
  orders rebuild from current state while preserving their receipt.
- Rerender destroys prior display/input objects and creates no camera drag/wheel
  listener, recurring timer, decorative infinite tween, or hidden mask object.
- Reduced motion retains every state and result without depending on animation.
  Back, tabs, selectors, paging, records, detail, close, and reward controls are
  literal and at least 44px in both dimensions.

## Must not have

- Direct `GameState` mutation or duplicated reward grant, save, ownership,
  invader, modifier, event, progression, achievement, summon, or combat rules.
- A claim based on cached eligibility, arbitrary tribe/reward pair, UI-only set
  bonus presented as live combat effect, or silent transaction failure.
- New dependency, save field, monster/invader/content definition, balance value,
  route, root navigation item, asset, native/platform change, or unrelated edit.
- Sub-10px core text, sub-44px changed target, omitted registry record, hidden
  shortage/consequence, unbounded content, transient proof, or lifecycle growth.

## Verification requirements

- Capture exact 390×844 / DPR 2 renders for initial guardian, tribe-less,
  claimable, claimed/receipt, owned detail, invader, modifier, and event states.
- Reach all 136 monsters, eleven tribes plus the `기타` group, all nine invader
  chapters, and every modifier/event definition through bounded controls without
  changing persistence.
- Exercise individual and aggregate reward deltas, duplicate/cooldown behavior,
  stale-save rejection, already-owned mapped rewards, rapid/cross-input blocking,
  modal input isolation, contextual back, root routes, reduced motion, and three
  rerender/restart cycles.
- Record text below 10px, enabled targets below 44px, clipping/overflow, exact
  state/receipt deltas, timers/tweens/listeners, and console/runtime errors.
- Run focused Codex/monster/reward/navigation checks, the standard web-game
  client, TypeScript, full tests, production build, and `git diff --check`.

## Verification record — 2026-09-04

- Final source SHA-256: `CodexScene.ts`
  `d4588b5c999d8b0906db9d0cab9961dd431ae8c36f2c130a8452bbc8115b2b88`,
  `CodexMonsterDetail.ts`
  `69867508eb84528edce44ab8f665e3a1005304b4dc34e9e2377482da634827f3`,
  `CodexShared.ts`
  `f0746803cd61bccabcc499ab9da20935048fb98d01523b5aa36fc4c69f021b5b`,
  and `CodexShared.test.ts`
  `4c9d70f6e9d1373e5d2d19094b278f36aac79aac0048514bbe04af55a2b92672`.
- The fixed archive exposes twelve guardian groups, including `기타`, and uses
  three-record guardian/invader pages plus four-record modifier/event pages.
  The complete bounded-control traversal reached all 136 monsters, all 52
  invaders in nine chapters, all 17 modifiers, and all 13 events. The save string
  remained byte-identical. The final source changed only the two route-latch
  statements after this traversal; all ten rendered states, transactions, modal,
  and route/race cases were then regenerated or rerun at the final source SHA.
- Across the 84 settled archive states, runtime audits reported sub-10px text `0`,
  enabled targets below 44px `0`, logical-viewport overflow `0`, timers `0`,
  tweens `0`, scene-level pointer/drag/wheel listeners `0`, and console/runtime
  errors `0`. Three rerenders and three restarts retained stable child, input,
  timer, tween, and shutdown-listener signatures.
- The owned-detail control opened a 390×844 blocker with a 44×44 close target.
  Real pointer input against the underlying mode seal and root navigation was
  blocked, close restored the archive, and all 136 detail layouts passed the
  text-size and section/canvas overflow audit.
- Individual claim changed completed tribes `0→1`, added exactly one mapped
  reward, and retained `완료 부족 0→1 · 보유 수호자 18→19`. Claim-all changed
  `0→2`, added the two exact mapped rewards once, and retained
  `완료 부족 0→2 · 보유 수호자 32→34`. An already-owned exact canonical reward
  changed claims/completion but added no roster copy. A stale visible action
  changed nothing and retained the exact one-record-short warning.
- Same-frame duplicate and cross-group input issued one order, stayed on the
  admitted group, then accepted the second eligible order after cooldown. Normal
  and reduced-motion `order→back/root` kept Codex active and granted once;
  `back/root→order` entered the route and granted zero. This final result follows
  a review-found fix that makes back and root routes acquire the shared latch
  before queuing `scene.start`, rather than relying on normal-motion tween teardown.
- `previousScene=StageSelectScene`, the default Barracks return, and Dungeon,
  Forge, and Invasion root destinations each resolved to the existing single
  authoritative scene. Route-only browsing did not change the save.
- The standard web-game client ran four iterations with `CodexScene` as the only
  active/top scene at logical 390×844 and DPR 2. Its four identical WebGL exports
  were black and are excluded from visual proof; the inspected real page captures
  below are the rendering authority.
- Final exact 390×844 / DPR 2 captures, all 780×1688 and visually inspected:
  - `tools/screenshots/codex-initial-final-390x844.png`
    (`01aace6e592462904f688a17fb431c569cfbd0fc8cdf3ed72e6bcb3ce1b2cd40`)
  - `tools/screenshots/codex-unaffiliated-final-390x844.png`
    (`0b85bac45d647d63d10ea2293160c2095ff544783874d7ca7a9b75bb7837d1b9`)
  - `tools/screenshots/codex-detail-final-390x844.png`
    (`66ff1dcd8002f1289d64307cbb3a86ca6baab9fd8badf7b4202c5a44c794c61b`)
  - `tools/screenshots/codex-invader-final-390x844.png`
    (`c30787a12ab61059e700f478bfb0fe8487f079b5c93fb35c0baae33252ec6dd5`)
  - `tools/screenshots/codex-modifier-final-390x844.png`
    (`668fa01cc1b9716a5505aaa807dbec2beb6c2bf14a178b81186adc334689bfdd`)
  - `tools/screenshots/codex-event-final-390x844.png`
    (`545313c5a8de39c5bcc3bb0644a1c404082b400cab748dcf389022db185888b9`)
  - `tools/screenshots/codex-claimable-final-390x844.png`
    (`fc6c9c4879c1d3c3b582642c1e8d95ac52cb2df30ca5c8e00c96ed21b4b1a593`)
  - `tools/screenshots/codex-claim-receipt-final-390x844.png`
    (`ce9b49df7064aaa67b5c988898aef75d7e41a14db93ca8af3813a4c4d775c05c`)
  - `tools/screenshots/codex-claim-all-receipt-final-390x844.png`
    (`07f06049a36e44fc138d3a12d78e1dd37d28ec6219fd5480e030e7d056d5c18a`)
  - `tools/screenshots/codex-stale-warning-final-390x844.png`
    (`c06f31d883822328ff25a3aeba2ba5d84ec04240098badde7b2e5027e531dd18`)
- Focused Codex/monster/reward/navigation verification passed: 10 files, 500
  tests. `npx tsc --noEmit` passed. Full `npm test` passed: 102 files, 2,841
  tests. `npm run build` passed with the existing large-chunk advisory.
  `git diff --check` passed, and reward/invader/modifier/event/save/navigation/
  summon authority files remained diff-empty for this slice.
- Independent goal/context, code/transaction, and QA/evidence reviews passed
  after the page-size contract correction, reduced-motion route-latch fix, and
  final-source screenshot/route/transaction regeneration.
- The old unused `CodexCell`/`isTribeClaimable` presentation path and existing
  transaction behavior for evolved-only reward IDs or malformed legacy claim
  arrays remain outside this visual slice. Alternate whole-app viewports, native
  packaging, physical-device accessibility, and store release are not verified.

# Achievement Hall Design Contract

> Scope: `AchievementScene` at the 390×844 logical canvas. Achievement IDs,
> category membership, targets, progress calculations, rewards, unlock state,
> reward transactions, save schema, and the existing previous-scene return
> contract remain authoritative in `src/data/achievementData.ts`,
> `src/data/achievementDefsEpilogue.ts`, `src/data/achievements.ts`,
> `src/data/progressionTransactions.ts`, and `src/data/rewardTransactions.ts`.

## Product job

Achievement is the dungeon master's hall of records: inspect one meaningful
milestone, understand current progress and exact reward, then claim an earned
reward with durable proof. The surface must expose every authoritative record
without turning the portrait viewport into a long trophy feed.

## H0 read-only audit — 2026-09-04

- The prior scene created 79 stacked cards with 8px `NEW` badges, 9px
  descriptions/reward/progress labels, and roughly 6,004px of list content.
  Claimable cards used 52×22 targets and the claim-all control used 104×30.
- The geometry-mask source stayed visible as an opaque white rectangle over the
  list. Exact browser captures show the empty fixture as a blank white archive
  and the claimable fixture as a washed-out scroll stack under that mask.
- Only `all`, `combat`, `economy`, `build`, `endless`, and `mastery` tabs were
  reachable. `collection` and `growth` were visible only inside the unfiltered
  list, so their category navigation was missing.
- Runtime unlock authority checks 84 unique definitions: 79 base records plus
  five epilogue records. The scene header, list, and claim-all flow used only
  the base array, making unlocked epilogue rewards invisible and unclaimable.
- Claim feedback was an auto-dismiss toast, while normal-motion claimable rows
  added one infinite pulse tween per reward. Touch scrolling added scene-level
  pointer and wheel listeners even though the content model can be paged.
- Baseline exact 390×844 / DPR 2 captures:
  `tools/screenshots/achievement-before-390x844.png` (`60c32bfe9680597f72f14e4fcbaeaf9e8d23d1b4b7830f45b19ea03d46893a4e`)
  and `tools/screenshots/achievement-before-claimable-390x844.png`
  (`68094eff0b90e64cc75d13c434e717e00d78c9b939dba5716373b58487d23ce1`).
  The standard web-game client confirmed `AchievementScene` as the only/top
  scene at DPR 2; its WebGL canvas export was black and is not visual evidence.

## Reference-to-interface decisions

- Use the established `DUNGEON_UI` hall language: soot and iron own the archive,
  brass marks the selected record and claim command, jade marks earned or paid
  milestones, and ember marks a stale or unavailable claim. Existing emoji may
  remain beside literal achievement names but never serve as the only label.
- Replace scrolling with eight category seals, a bounded three-record page, one
  selected-record ledger, and explicit previous/next controls. All 84 base and
  epilogue definitions must be reachable without changing their definitions or data.
- Preserve one dominant selected-reward action. Claim-all remains a secondary
  convenience only when at least one reward is claimable and must report the
  same exact aggregate reward saved by the existing transaction primitive.

## First-viewport hierarchy

1. Stone lintel: 44px return action, `명예 기록실`, and the archive purpose.
2. Status rail: achieved/84, unclaimed count, and current gems/soul crystals.
3. Eight 44px category seals: all seven authoritative categories plus `전체`.
4. Archive page header and three 64px-or-larger record tablets with explicit
   `진행 중 / 수령 가능 / 수령 완료` state.
5. Selected-record ledger: name, description, bounded progress, exact reward,
   and a persistent transaction receipt.
6. One 48px selected-reward command and optional 44px secondary claim-all action.

All core text is at least 10px. Every changed enabled target is at least 44px in
both dimensions. Selection and paging are presentation-only and never write save.

## State and interaction matrix

| State | Required visible proof | Preserved behavior |
| --- | --- | --- |
| Initial | 84 total records, eight categories, selected nearest-progress item | create-time pure sweep unlocks newly qualified records once |
| In progress | current/target, percent bar, exact reward, disabled claim | no handler and byte-identical save |
| Claimable | earned state, reward amounts, selected claim command | `claimAchievementReward` applies reward and claimed flag once |
| Claimed | paid state and exact reward retained | duplicate claim is rejected without mutation |
| Claim all | exact count and aggregate gems/crystals | `claimAllAchievementRewards` folds the same per-record guards |
| Epilogue | five records reachable in economy/collection/growth | existing 84-definition unlock authority and reward data are reused |
| Category/page | all eight seals and every record reachable | filter, selection, and page changes never save |
| Stale claim | persistent non-mutating rejection receipt | data-layer failure reason remains authoritative |
| Return | previous-scene destination is explicit | registry `previousScene` fallback remains `StageSelectScene` |

## Input, motion, and lifecycle contract

- A scene-level pointer-down latch owns individual and claim-all transactions
  before shared press feedback starts. Category, page, record, or return input
  cannot redirect an admitted transaction; rejected input cannot consume the
  next valid control.
- A successful or rejected transaction rebuilds one fixed surface and retains
  its receipt. A 250ms cooldown blocks rebuilt-control duplicates, then the same
  action remains usable.
- No scene drag/wheel listener, visible mask source, recurring timer, decorative
  infinite tween, or auto-dismiss receipt is allowed. Reduced motion retains all
  state and feedback.

## Must not have

- Direct `GameState` mutation or duplicated reward, unlock, progress, target,
  category, sorting authority, or claimed-state rules.
- New achievement, reward value, save field, dependency, route, root navigation,
  asset, native/platform change, or unrelated dirty-path edit.
- Sub-10px core text, sub-44px changed targets, unbounded scrolling, hidden
  epilogue record, transient-only reward proof, or input/listener growth.

## Verification requirements

- Capture exact 390×844 / DPR 2 renders for initial/in-progress, claimable,
  claimed receipt, claim-all receipt, epilogue, and late-page states.
- Exercise all eight category seals, every one of the 84 records, page bounds,
  selection save neutrality, individual and aggregate exact reward deltas,
  disabled/duplicate/stale claims, rapid/cross-input protection, cooldown retry,
  previous-scene return, reduced motion, and three rerender/restart cycles.
- Record text below 10px, targets below 44px, clipping/overflow, transaction
  deltas, timers/tweens/listeners, and console/runtime errors.
- Run focused achievement/progression/reward tests, the standard web-game client,
  TypeScript, full tests, production build, and `git diff --check` before close-out.

## Verification record — 2026-09-04

All final screenshots below are exact 390×844 browser captures at runtime DPR 2
(780×1688 physical pixels) from isolated localStorage fixtures. The two baseline
captures preserve the prior archive failure; the other eight captures come from
the final `AchievementScene.ts` source (`68def60b5474e74b071c012141799b4cc6447f0f7954ec639d00c5530e9870ac`).

| Evidence | SHA-256 |
| --- | --- |
| `tools/screenshots/achievement-before-390x844.png` | `60c32bfe9680597f72f14e4fcbaeaf9e8d23d1b4b7830f45b19ea03d46893a4e` |
| `tools/screenshots/achievement-before-claimable-390x844.png` | `68094eff0b90e64cc75d13c434e717e00d78c9b939dba5716373b58487d23ce1` |
| `tools/screenshots/achievement-initial-final-390x844.png` | `db7793a13a5d4cf6f7cbad3db202f3f44ba7e94fe1332ac379d238a5228895eb` |
| `tools/screenshots/achievement-late-page-final-390x844.png` | `144f91ca6581da3d406824403953dcc86463661313dbab0e4179af124bbe2fa1` |
| `tools/screenshots/achievement-claimable-final-390x844.png` | `bc0a88a09d134544e7ae994f96660808e9a17e51d374239f5b64c685fd942191` |
| `tools/screenshots/achievement-claim-receipt-final-390x844.png` | `0da63aff938227732c9c7fc9c06bd57c78c59225e3a022a8947b96c21c32ec52` |
| `tools/screenshots/achievement-claim-all-receipt-final-390x844.png` | `1cac3443124d2fc5b38af160bd9e581cbd17e430edc05fb703af124f60765ab5` |
| `tools/screenshots/achievement-epilogue-final-390x844.png` | `89b53875ed1a2df9ae347d7602567f67e1f52b8485b8ea8c6112e10fcac24d6d` |
| `tools/screenshots/achievement-epilogue-claim-receipt-final-390x844.png` | `8cab070aa9eec09dfed33ebf090ae8a0fa0df8b44ed3f56d3fbc1642eaf1b472` |
| `tools/screenshots/achievement-stale-claim-final-390x844.png` | `2804161523b751bb3ed9926d9734f7b3d19a87592c07e682dca5a7e50fd5de01` |

- Bounded paging traversed all 28 pages and exposed 84 unique IDs exactly once.
  The eight seals exposed `combat 11`, `economy 11`, `build 14`, `endless 9`,
  `mastery 13`, `collection 13`, `growth 13`, and `all 84`; navigation and
  selection kept the serialized save byte-identical.
- Normal-motion claim plus simultaneous category input admitted only
  `first_blood`: gems changed `7→12`, soul crystals remained `11`, and the
  filter stayed `all`. Its retained receipt reported the same `젬 5`; a retry
  after the transaction changed the filter to `combat`.
- Reduced-motion same-tick `claim→category` and `claim→back` sequences retained
  the admitted transaction through the post-update rebuild: the filter stayed
  `all`, Achievement remained active, gems changed `7→12` exactly once, and the
  success receipt persisted. Subsequent category and back retries opened
  `combat` and `StageSelectScene` respectively.
- An immediate rebuilt-control action inside the 250ms cooldown changed no save
  field and did not consume the control. After recovery, `crystal_10` remained
  usable and changed soul crystals `11→31`. Claim-all over the same two records
  reported exactly `2건`, gems `7→12`, and soul crystals `11→31`.
- The previously hidden epilogue record `fusion_30` was reachable in collection,
  selected at `totalFusions=30`, and claimed through the existing transaction.
  Gems changed `100→160`, soul crystals `40→70`, and the retained receipt listed
  the authoritative `젬 60 · 수정 30` reward.
- A stale rendered `first_blood` claim, externally marked claimed before commit,
  produced `이미 수령 완료`; storage remained byte-identical. Claim→back overlap
  retained `AchievementScene`, while the subsequent retry opened the registry
  `previousScene` fallback `StageSelectScene`.
- Seventeen state audits reported visible text below 10px `0`, enabled targets
  below 44px `0`, text overflow `0`, console/runtime errors `0`, scene-level
  pointer/drag/wheel listeners `0`, timers `0`, and tweens `0`.
- Three direct rerenders retained `children 96`, 13 enabled targets, zero
  timers/tweens, and 14 shutdown listeners. Three restarts retained the stable
  `children 99` signature and the same listener/timer/tween counts.
- The standard web-game client confirmed `AchievementScene` as the only/top
  scene with a 390×844 logical canvas at DPR 2. Its diagnostic script capture
  rendered dimmer than the real page and was excluded from evidence; all final
  page captures above were opened and inspected.
- Focused achievement/progression/reward checks: 4 files, 187 tests passed.
  `npx tsc --noEmit`: passed. Full `npm test`: 102 files, 2,837 tests passed.
  `npm run build`: passed with the existing large-chunk advisory.
  `git diff --check`: passed after implementation and evidence synchronization.
- Independent goal/context, code/transaction, and QA/evidence reviews passed.
  Code review found and closed the reduced-motion latch-release race; scope review
  synchronized the dated handoff summary; QA review required current-source
  harness/client regeneration and verified the deterministic retry evidence.

Unverified by this web-only slice: whole-app 360×800 and 430×932 regression,
physical-device accessibility/text scaling, Android/iOS packaging, and store release.

# Abyss Expedition Design Contract

> Scope: `AbyssScene` at the 390×844 logical canvas. Daily key refill,
> cleared-floor sweep, next-floor battle, first-clear loot/depth progression,
> floor bands, boss cadence, reward tables, save schema, and battle handoff remain
> authoritative in `src/data/abyss.ts`, `src/data/abyssTransactions.ts`, and the
> existing `DungeonScene` result flow.

## Product job

Abyss is the dungeon master's deep-expedition control room: choose a reachable
floor, read its threat and material yield, then issue exactly one challenge or
sweep order. It must close the farm → Forge/Fusion loop without presenting up to
sixty equal action cards or changing the underlying economy.

## D0 read-only audit — 2026-09-04

- The previous deep fixture (`highestFloor=30`) created 31 floor cards, 191 text
  objects, 33 enabled targets, and a camera content height of 3,212 logical px.
  Every enabled floor/shortcut target was under 44px high.
- The initial fixture left most of the first viewport empty while separating the
  depth/key status from the selected threat and reward decision. At depth, fixed
  header/status content was no longer reliably visible in the page capture.
- A successful sweep created its toast before `render()`, so the rebuild removed
  the transaction proof. Returned battle proof auto-dismissed through a timer.
  Every render also registered another scene-level pointerdown/move/up drag set.
- Exact 390×844 / DPR 2 baseline captures:
  `tools/screenshots/abyss-before-initial-390x844.png` (`cb41e9954fd62583ce8f274243ccc519df93e509981fd72e3606bc0756fb3f1b`)
  and `tools/screenshots/abyss-before-deep-390x844.png`
  (`8c237ace6c4dafae3e788a5fce418cb19a9f42cddb077654b214c07b9d33893e`).
  The standard web-game client confirmed `AbyssScene` as the only/top scene at
  390×844 and DPR 2; its WebGL canvas export was black, so page-level browser
  captures remain the visual authority.

## Reference-to-interface decisions

- Continue the completed dungeon surfaces' `DUNGEON_UI` hierarchy: soot and iron
  form the shaft, brass marks the selected expedition, jade marks cleared/farmable
  depth, and ember marks a blocked order. Boss identity may use restrained arcane
  purple without becoming a second primary action.
- Replace the unbounded list with a five-floor depth window. Every cleared floor
  and the one next floor remain reachable through bounded five-floor paging;
  locked future nodes provide context but own no input handler.
- Keep one selection-driven command plate. A selected cleared floor offers sweep;
  the exact next floor offers battle; an unavailable state names the missing key
  or lock condition and attaches no transaction handler.
- Preserve Forge and Fusion as secondary 44px-or-larger routes. Floor/page
  selection is ephemeral and never enters `GameState`.

## First-viewport hierarchy

1. Stone lintel: return action, `심연 원정실`, and farming purpose.
2. Status rail: remaining keys, deepest clear, and next expedition.
3. Five-floor shaft window: clear/selected/next/boss/locked states plus bounded
   previous/next-page controls.
4. Selected-floor intelligence: band, boss signal, recommended power, and the
   existing material pool with literal names.
5. One command plate: order kind, exact key or battle consequence, persistent
   receipt, and one 48px-or-larger primary action.
6. Secondary Forge/Fusion supply routes.

Core text is at least 10px. All changed interactive targets are at least 44px.
The fixed surface creates no camera drag, vertical overflow, or recurring motion.

## State and interaction matrix

| State | Required visible proof | Preserved behavior |
| --- | --- | --- |
| Initial | keys `12/12`, deepest `0/60`, floor 1 next, floors 2–5 locked | no saved mutation beyond existing daily refill |
| Cleared | selected floor, farmable state, key cost, material pool | `sweepAbyssFloor` spends one key and applies its rolled loot once |
| No keys | selected cleared floor and explicit `0/12` shortage | disabled action has no handler and state remains unchanged |
| Next floor | exact next floor, band/power/boss signal, battle consequence | existing registry contract starts `DungeonScene` once |
| Returned win | cleared depth advance and exact first-clear reward receipt | `clearAbyssFloor` remains the only loot/depth authority |
| Returned loss | attempted floor and unchanged-depth receipt | pending/result/return registry keys are consumed once |
| Maximum depth | floor 60 remains selectable and sweepable | no floor 61 route or save field is created |
| Paging | every floor `1..next` reachable in groups of five | page/floor selection never writes storage |

## Input, motion, and lifecycle contract

- One scene-level transaction latch prevents rapid or cross-selection input from
  issuing duplicate sweep/battle orders. A rejected duplicate cannot consume the
  next valid command after the short recovery interval.
- Successful sweep and returned battle rebuild the fixed surface while retaining
  a visible receipt whose values agree with the saved transaction.
- Rerender destroys prior display/input objects and creates no scene-level drag
  listener, recurring timer, auto-dismiss receipt, or infinite tween.
- Reduced-motion preserves all information and transaction results. Back, floor,
  paging, primary order, Forge, and Fusion controls remain literal and usable.

## Must not have

- Direct `GameState` mutation or duplicated refill, sweep, clear, floor scaling,
  loot, boss, key, first-clear, save, or battle-wave rules.
- New dependency, save field, balance value, material, route, root navigation
  item, asset, native/platform change, or unrelated dirty-path edit.
- Sub-10px core text, sub-44px changed targets, multiple equal transaction CTAs,
  inaccessible cleared floors, hidden shortage/consequence, unbounded content,
  transient proof, or listener/timer/tween growth.

## Verification requirements

- Capture exact 390×844 / DPR 2 renders for initial, deep/selected, no-key,
  boss, sweep receipt, and returned-win/returned-loss states.
- Exercise all page/floor controls through floor 60, save-neutral selection,
  sweep deltas, no-key disabled behavior, rapid/cross-input protection, battle
  registry handoff, one-time returned result consumption, Forge/Fusion/back routes,
  reduced motion, and three rerender/restart cycles.
- Record text below 10px, targets below 44px, clipping/overflow, transaction and
  registry deltas, timers/tweens/listeners, and console/runtime errors.
- Run focused Abyss tests, the standard web-game client, TypeScript, full tests,
  production build, and `git diff --check` before close-out.

## Verification record — 2026-09-04

All final screenshots below are exact 390×844 browser captures at runtime DPR 2
(780×1688 physical pixels) from isolated localStorage fixtures. Reduced-motion
fixtures exercise immediate selection; the sweep/challenge race fixture retains
the shared 70ms press feedback.

| Evidence | SHA-256 |
| --- | --- |
| `tools/screenshots/abyss-before-initial-390x844.png` | `cb41e9954fd62583ce8f274243ccc519df93e509981fd72e3606bc0756fb3f1b` |
| `tools/screenshots/abyss-before-deep-390x844.png` | `8c237ace6c4dafae3e788a5fce418cb19a9f42cddb077654b214c07b9d33893e` |
| `tools/screenshots/abyss-initial-final-390x844.png` | `0e92b1fa01e8bbfef79004b8a0631a069e8846c101fdf845a53f0a5c271d0b48` |
| `tools/screenshots/abyss-deep-final-390x844.png` | `746183c77f0f3457b3e97d248d79553258dbde1cd8c33213e014791c599611f2` |
| `tools/screenshots/abyss-no-key-final-390x844.png` | `81cc325c970639dac303920b872cc1def2f77b6620151f6874af5d6a131df94e` |
| `tools/screenshots/abyss-boss-final-390x844.png` | `f0b5c7a9e273318f29ef4ebc9b5790f81cb09c734a796ab76bae86a7ebe10b4b` |
| `tools/screenshots/abyss-max-final-390x844.png` | `add8d53b8d3f69419e66b72a85d70b88f794c6a0ec9e058b27006471f90b6df6` |
| `tools/screenshots/abyss-sweep-receipt-final-390x844.png` | `0e38fad0080d8c8a88f2606d97e3406b7d44a99e5b9a1fa0d154941e2a522462` |
| `tools/screenshots/abyss-returned-win-final-390x844.png` | `10ad903139e5499fa72964c04c6e61cc3df90167688055d3c7a843343316776b` |
| `tools/screenshots/abyss-returned-loss-final-390x844.png` | `42b8201593dd5b01a15d54531de7130363c39e36c8830d6d08decf4474c4e32d` |

- The fixed five-floor window traversed page starts `56→51→…→1→…→56` in
  reduced motion and exposed every named floor target `1..60`. Page and floor
  selection kept the serialized save byte-identical.
- One floor-5 sweep changed keys `2→1`, gold `200→250`, and materials
  `common_ore 0→1` and `herb 0→2`. Its retained receipt
  listed the same deltas. Two immediate order events plus a page event admitted
  that transaction once and kept floor 5 selected.
- An immediate rebuilt-control retry during the 250ms cooldown changed nothing.
  After recovery, the same control remained usable and changed keys `1→0`, gold
  `250→300` and `common_ore 1→4` with a matching
  persistent receipt.
- A cleared-floor fixture at keys `0/12` exposed the exact daily-refill condition,
  attached no order listener, and retained a byte-identical save. A stale-day
  fixture refilled keys `0→12`, updated `lastRefill` to `2026-09-04`, and changed
  no other inspected Abyss field.
- Rapid floor-10 challenge input called `DungeonScene` once and wrote the existing
  registry contract exactly: `abyssPendingFloor=10`, `returnTo=AbyssScene`,
  `stageNumber=0`, `slots=9`, and the unchanged three generated boss waves.
- Returned win advanced highest floor `9→10`, retained keys at 4, granted gold
  `+120` and the rolled material reward, and showed the same first-clear receipt.
  Returned loss retained depth, keys, gold, and materials and showed a warning
  receipt. Both consumed pending/result/return registry keys once; an immediate
  scene restart did not apply either result again.
- Initial, deep, no-key, boss, max, sweep, and returned-result audits reported
  visible text below 10px `0`, enabled targets below 44px `0`, text overflow `0`,
  and console/runtime errors `0`. All cameras stayed at fixed 390×844 bounds.
- Three direct rerenders retained `children 77`, six enabled targets in the deep
  fixture, zero timers/tweens, 14 shutdown listeners, and zero scene-level drag
  listeners. Three restarts retained the stable `children 80` signature and the
  same input/timer/tween counts on every cycle.
- Forge, Fusion, and back controls opened `ForgeScene`, `FusionScene`, and
  `StageSelectScene` respectively. Post-sweep route→order overlap opened the
  selected Forge/Fusion route once; the reverse rejected order→route sequence
  left the route listener usable for a successful retry. The standard web-game client confirmed
  `AbyssScene` as the only/top scene with a 390×844 logical canvas at DPR 2; its
  WebGL canvas-export PNG remained black and was excluded from visual evidence.
- Focused Abyss checks: 2 files, 34 tests passed. `npx tsc --noEmit`: passed.
  Full `npm test`: 102 files, 2,837 tests passed. `npm run build`: passed with the
  existing large-chunk advisory. `git diff --check`: passed after implementation,
  evidence, and coupled-document synchronization.
- Independent goal/context, code/transaction, and QA/evidence reviews passed.
  Code review found a route-to-order cooldown race that could consume a one-shot
  route listener; the final pointer-down latch preserves the rejected control and
  both Forge/Fusion overlap directions passed live retry verification.

Unverified by this web-only slice: full floor battle play-through from launch to
organic win/loss return, whole-app 360×800 and 430×932 regression, physical-device
accessibility/text scaling, Android/iOS packaging, and store release.

# Decoration Reliquary Design Contract

> Scope: `DecorationScene` at the 390×844 logical canvas. Decoration catalog,
> acquisition costs, set tiers, placement slots, bonus aggregation, persistence,
> and the `StageSelectScene` return route remain authoritative in
> `src/data/decorations.ts` and `src/data/decorationTransactions.ts`.

## Product job

Decoration is the dungeon master's reliquary for deciding which trophies become
active infrastructure. The player must be able to compare one set, select one
relic, understand its acquisition or placement consequence, and issue one order
without scrolling through a storefront-like list.

## D0 read-only audit — 2026-09-04

- The previous surface stacked four set headers and twelve equal product cards.
  Runtime content reached text y≈1,154 and action y≈1,145 with `maxScrollY=354`,
  so the screen read as a long catalog rather than a set-composition decision.
- Twenty-four visible description/cost labels used 9px text. In a fully
  affordable fixture, all twelve product actions used 84×36 hit areas.
- Set thresholds and aggregate bonuses were separated from the item being acted
  on. Acquisition, placement, and removal rebuilt the surface without a durable
  receipt, and ordinary rerenders added another scene-level drag listener set.
- Baseline exact 390×844 / DPR 2 capture:
  `tools/screenshots/decoration-before-390x844.png`; SHA-256
  `05ef313ba85f0532e46a9e75680adc0f2ff57dd276ba11e1e6190aaec0809e1c`.
  The standard web-game client confirmed `DecorationScene` as the only/top scene
  at 390×844 and DPR 2; its WebGL canvas export was black, so page-level browser
  captures remain the visual authority.

## Reference-to-interface decisions

- Continue the completed Production district's connected-resource language:
  decoration bonuses must visibly point back to idle gold, production, dungeon
  durability, or trap damage without changing those calculations.
- Adapt the existing one-decision hierarchy: four set seals choose context,
  three relic pedestals choose the item, and one command plate owns the exact
  cost, shortage, placement consequence, and action.
- Use the established `DUNGEON_UI` authority. Soot and iron own the reliquary,
  brass marks selection/acquisition, jade marks active placement, and ember marks
  shortage. Relic identity may retain its catalog emoji beside literal labels;
  no control is emoji-only.
- Remove camera dragging and unbounded stacking. All four sets and all twelve
  relics remain reachable through bounded selection inside one fixed viewport.

## First-viewport hierarchy

1. Stone lintel: return action, `장식 보관실`, and set-composition purpose.
2. Status rail: gold, owned relic count, placed/capacity, and active bonus count.
3. Four 44px-or-larger set seals with placed count and explicit selected state.
4. Selected-set ledger: full name, purpose, current count, two-piece and
   three-piece thresholds.
5. Three relic pedestals with name and `미보유 / 보유 / 배치 중` state.
6. One selected-relic command plate: description, current/next set consequence,
   exact gold/material cost or slot condition, persistent receipt, and one
   48px-or-larger acquire/place/remove action.

Core text is at least 10px. Disabled actions retain the exact missing condition
but attach no input handler. Set and relic selection are ephemeral and never save.

## State and interaction matrix

| State | Required visible proof | Preserved behavior |
| --- | --- | --- |
| Empty | four sets, twelve reachable relics, first selected cost, no active bonus | selection does not mutate persistence |
| Affordable gold | exact balance/cost and acquisition command | `acquireDecoration` spends exact gold and adds ownership once |
| Affordable craft | every required material with have/need | existing craft transaction deducts exact material quantities |
| Deficit | exact gold or material shortage plus disabled action | state and serialized save remain unchanged |
| Owned | owned state, placement slot consequence, place command | `placeDecoration` adds only the selected owned ID |
| Slot full | selected owned item and explicit capacity block | disabled action has no handler or save |
| Placed | active set count/bonus, removal consequence, remove command | `unplaceDecoration` removes only the selected ID |
| Tier transition | selected-set before→after tier/effect and updated aggregate active-effect count | existing highest-tier aggregation remains authoritative |
| Receipt | acquisition/place/remove result survives rerender | visible receipt and saved state describe the same transaction |

## Input, motion, and lifecycle contract

- Set/relic selection changes presentation only. One scene-level transaction
  latch prevents rapid or cross-selection input from issuing duplicate orders.
- A successful action rebuilds the fixed surface and keeps its receipt visible.
  A failed transaction reports the exact reason without changing persistence.
- Rerender destroys prior display/input objects and creates no recurring timer,
  camera-drag handler, or decorative infinite tween.
- Reduced-motion retains every state and result without depending on animation.
  Back, set, relic, and transaction targets remain usable at 44px or larger.

## Must not have

- Direct `GameState` mutation or duplicated transaction, price, set-tier, slot,
  idle-income, combat-bonus, or bonus-aggregation rules.
- New save fields, dependency, route, asset, catalog item, balance value, root
  navigation item, native/platform change, or unrelated dirty-path edit.
- Sub-10px core text, sub-44px changed targets, hidden shortage/tier/consequence,
  auto-dismissed transaction proof, unbounded content, or input listener growth.

## Verification requirements

- Capture exact 390×844 / DPR 2 renders for empty/deficit, gold acquisition,
  craft acquisition, owned/place, active tier, slot-full, and removal receipt.
- Exercise all four set selectors, all twelve relics, gold and craft transactions,
  place/remove, disabled deficit and full-slot actions, rapid/cross-selection
  protection, back navigation, reduced motion, and three rerender/restart cycles.
- Record text below 10px, targets below 44px, clipping/overflow, transaction
  deltas, timers/tweens/listeners, and console/runtime errors.
- Run focused decoration tests, the standard web-game client, TypeScript, full
  tests, production build, and `git diff --check` before close-out.

## Verification record — 2026-09-04

All final screenshots below are exact 390×844 browser captures at runtime DPR 2
(780×1688 physical pixels) from isolated localStorage fixtures. Reduced-motion
fixtures exercise the immediate action path; normal-motion fixtures retain the
live 70ms shared-button press tween for rapid and cross-input checks.

| Evidence | SHA-256 |
| --- | --- |
| `tools/screenshots/decoration-before-390x844.png` | `05ef313ba85f0532e46a9e75680adc0f2ff57dd276ba11e1e6190aaec0809e1c` |
| `tools/screenshots/decoration-empty-final-390x844.png` | `7d74afba398a159a42357e86cab0976efbafb336ea82714b28dffc018ef96f4c` |
| `tools/screenshots/decoration-deficit-final-390x844.png` | `fa8c89ea9cb44ddf5f49846ad04b433022a74cec9a2a2b4a484cf4821895d019` |
| `tools/screenshots/decoration-owned-final-390x844.png` | `5a27fd591ac8d07e1ba2e3267c01f39d23697d64f77e9e2f48f0f76a2c067323` |
| `tools/screenshots/decoration-tier-active-final-390x844.png` | `56b58975859376b8f66f4c9d4f9ada4be75308ebac111da634773039ffb52ce4` |
| `tools/screenshots/decoration-slot-full-final-390x844.png` | `7aece415e87cf2ac5b937b96ac574a56ee06be378b70a0ed8fee668946dbf8a9` |
| `tools/screenshots/decoration-acquire-receipt-final-390x844.png` | `04e81fc6f4c4b230deed96e071ea6fa67eabc7b7894426a8a52e074254611adc` |
| `tools/screenshots/decoration-craft-receipt-final-390x844.png` | `6caefcbdac2afb41988cc27416775fc0bb029608f17fa5e6b86b220d4fc709c2` |
| `tools/screenshots/decoration-place-receipt-final-390x844.png` | `1b4802a6355c5fb05ef7cf89b21aba62e5b0d9ac61c9176e2cf31330506c2b51` |
| `tools/screenshots/decoration-remove-receipt-final-390x844.png` | `10ec18099f580f13431bd35be83e6e154ab62a6599d363d30dc4b3b9349b8175` |
| `tools/screenshots/decoration-tier-transition-final-390x844.png` | `8a06e175240a4505a1de32bca1f6a3ae94af6c1b34fbe33739f98daf676f6f5c` |

- All four set selectors exposed their three named relic targets, so all twelve
  catalog entries were reachable without scrolling. Traversing every selector
  kept the serialized save byte-identical.
- Gold acquisition changed `500→200` and added only `golden_pot`. Crafting
  `war_banner` changed `old_cloth 9→4` and `common_ore 9→6`; both receipts listed
  the same exact cost retained in saved state.
- The rebuilt gold-relic action placed `golden_pot` after the cooldown. Placing
  `bounty_totem` beside it changed the set from one to two pieces and exposed
  `방치 골드 +10%`; removing it returned to one piece and `효과 대기` without
  changing ownership.
- A DM-level-1 fixture with four occupied slots exposed `4 / 4`, attached no
  order handler, and did not mutate storage. Gold and material deficit states
  likewise showed exact shortages with no enabled transaction action.
- Two immediate normal-motion order taps spent gold once (`1,000→700`) and
  acquired one relic. A set tap during the order tween neither redirected nor
  cancelled that transaction. Reduced-motion duplicate input was rejected, and
  after 300ms the rebuilt action remained usable and placed the owned relic.
- A `999,999,999,999` gold fixture rendered as bounded `1조` inside the first
  status cell without modifying the stored value. Back opened `StageSelectScene`.
- The status rail's active-effect count came from `computeDecorationBonuses`;
  current→next command text intentionally described only the selected set, while
  the existing data authority continued to aggregate all placed-set bonuses.
- Sixteen state audits found visible text below 10px `0`, interactive bounds
  below 44px `0`, text overflow `0`, and console/runtime errors `0`.
- Three direct rerenders retained `children 93`, eight enabled targets, zero
  timers/tweens, 14 shutdown listeners, and zero scene-level pointer/drag
  listeners. Three restarts retained the stable `children 96` signature with the
  same input/timer/tween counts on every cycle.
- The standard web-game client confirmed `DecorationScene` as the only/top scene
  with a 390×844 logical canvas at DPR 2. Its WebGL canvas-export PNG remained
  black, so it was excluded from visual evidence; all page-level captures above
  were opened and inspected.
- Focused decoration/transaction/idle-income checks: 3 files, 43 tests passed.
  `npx tsc --noEmit`: passed. Full `npm test`: 102 files, 2,837 tests passed.
- `npm run build`: passed; Vite retained the existing large-chunk advisory.
- `git diff --check`: passed after implementation and evidence synchronization.

Unverified by this web-only slice: whole-app 360×800 and 430×932 regression,
physical-device accessibility/text scaling, Android/iOS packaging, and store release.


## Defect sweep presentation follow-up — 2026-09-21

사용자 요청 `CODEX_HANDOFF_DEFECT_SWEEP.md` §2 범위의 변경이다. 생산 구역의 레일,
시설 타일, 현재/다음 단계는 실제 수령과 같은 근무·장식·명성 배수를 반영한다.
방치 보상은 보물고를 포함한 총 골드/분을 표시한다. 레벨업 모달은 지혜를 포함한
정산 전후 슬롯을 표시하고, 천계의 혈통은 지급을 유지한 채 스테이지 클리어로
설명을 정정한다. 침입 권장 DEF는 실제 스폰 HP에서 파생하며 전체 전력 공식의
재정의(§3-3)는 포함하지 않는다. 스킨 전체 수집은 현재 카탈로그 크기를 따른다.

`WEB_AUDIT_HEADLESS=1 node scripts/verify-defect-sweep.mjs`: 390×844의 7개 경우 통과,
해당 화면의 viewport overflow 및 console/runtime errors 0. 생산/방치/슬롯/후반 DEF
PNG를 직접 확인했다. 근거는 `output/playwright/defect-sweep/audit.json`의 source/PNG
SHA-256 및 같은 폴더의 캡처다. 무효화 검사, 경제 영향, 전체 테스트/빌드 결과와
범위 제한은 `CODEX_HANDOFF_DEFECT_SWEEP.md` §8을 따른다. 과거 surface evidence와
네이티브·운영·organic 검증을 이번 결과로 대체하지 않는다.
