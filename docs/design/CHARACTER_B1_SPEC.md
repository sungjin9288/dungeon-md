# Character B1 Design Spec

> Approved scope: early five guardians, Home sprite clarity, and quest speaker presentation.
> Date: 2026-09-07, Asia/Seoul. Status: local implementation and functional verification accepted; boot-performance verdict remains open.
> Workspace: `/Users/sungjin/dev/personal/dungeon md/dungeon-phaser`.

## Product outcome

초반 수호자 수집·배치·성장과 퀘스트를 이미 승인된 compact Korean folk-craft art로 연결한다. 첫 네 종의 스타일을 유지하면서 다음 다섯 종의 작은 silhouette를 구별하고, Home에서 선명하게 표시하며, 정확한 퀘스트 화자를 illustration과 이름으로 전달한다.

이 범위는 모든 초반 획득 결과, 136종 전체, 모든 NPC/invader, organic campaign completion 또는 native readiness의 완료를 뜻하지 않는다.

## Authority and exact scope

- Runtime: Phaser 3 + TypeScript + Vite; existing dependencies only.
- Logical canvas: 390×844; browser acceptance at 360×800 / 390×844 / 430×932, DPR 2.
- Assets: 512×512 RGBA PNG; at most 512 KiB per file; at least 42px transparent padding on every side.
- Export: contain the unchanged accepted master inside 428×428; no repainting, segmentation, or background removal in the export script.
- New core text ≥12 logical px; supporting text ≥11 logical px; new enabled controls ≥44 logical px.
- Normal and reduced motion preserve the same required information and actions.
- Preserve MonsterDef, tribe, role, element, rarity, save schema, balance, acquisition eligibility, transactions, quest definitions, routes, explicit skins, and 24px battle texture authority.
- Preserve all legacy136 JPGs, the four accepted masters/runtime PNGs, old audit JSON/PNGs, and `scripts/verify-character-art.mjs` byte for byte.
- No new dependency, paid CLI/API image fallback, native sync, branch, stage, commit, push, merge, PR, or publishing.
- Work in the existing dirty checkout. No reset, clean, restore, or replacement of unrelated tracked/untracked work.
- One code implementer at a time. Parent image generation may proceed alongside the single code implementer because their file ownership is disjoint.

## B1 identity contract

| ID | Registry name | Role / element / rarity | Existing availability | Art direction |
| --- | --- | --- | --- | --- |
| `village_archer` | 촌 궁수 | ranged / holy / C | unlockStage 2; Common pool | Human ally; long bow, straw/cloth, open shooting stance. Keep tribe unassigned. |
| `dokkaebi_junior` | 막내 도깨비 | melee / fire / C | unlockStage 3; Common pool | Smaller than warrior; short horns, light club, quick posture. |
| `gold_turtle` | 황금 거북이 | support / holy / U | unlockStage 4; Uncommon pool | Broad low shell, aged brass, unmistakably a turtle. |
| `fire_dokkaebi` | 화염 도깨비 | magic / fire / U | unlockStage 6; Uncommon pool | Kiln-like body, ember hands; different mass and prop from warrior/junior. |
| `sage` | 신선 도인 | support / holy / U | unlockStage 8; Uncommon pool; MQ-008 speaker | Slender scroll-bearing elder, cloth and wood; distinct from mountain_spirit. |

Source authority: `src/data/monstersDataCh1to5.ts`, `src/data/summonPools.ts`, `src/data/questData.ts`. All five are presentation additions only. The previous four remain `dokkaebi_warrior`, `gumiho_guardian`, `death_messenger`, `mountain_spirit`.

The next three, outside B1, are `one_tail_fox` (unlockStage 5), `thunder_dokkaebi` and `ice_dokkaebi` (unlockStage 10). They live in Chapter 6 data. B1 therefore yields 9 approved v2 guardians total, not all guardians available by stage 10. The starter roster contains only `dokkaebi_warrior`; a summon before any cleared stage currently uses the complete rarity pool. Art work does not revise that rule.

## Source and runtime architecture

The parent generates each B1 master using the built-in image tool and reviews the result against the four accepted references. Accepted masters and exact prompts remain in `output/character-art/ritual-v2/`; rejected outputs retain a rejection reason and never enter the runtime registry.

`scripts/export-character-art.mjs` accepts explicit `--ids` and `--master-dir` inputs. It validates every ID/path/master/target before exporting only the requested batch to `public/assets/monsters/ritual-v2/{id}.png`. Existing different output bytes are never overwritten. An identical existing output is reported as an idempotent no-write result. The command cannot silently fall back to the original four IDs.

Only after all five runtime exports pass the asset gate does the parent or the single TERRA worker add those five records to `CHARACTER_ART`. The registry owner also adds the exact `신선 도인 → sage` entry to `SPEAKER_ART`. The Quest worker consumes these helpers and does not edit either map. Boot continues loading registered art only; no 136-entry preload expansion is part of B1.

Portrait and room token fallback remains v2 → legacy → existing procedural renderer. Home remains v2 → procedural; JPG must not become a Home cutout. Explicit skins keep their current rendering path.

## Home clarity and geometry

Only the ritual-v2 branch of `generateMonsterSprite(scene, monsterId): string` changes from a 48×48 bake to 96×96. The procedural branch remains 48×48. Preserve the versioned texture key and source selection behavior unless a demonstrated cache defect requires a scoped correction.

Every call site must declare its intended logical display size. `HomeRoomCards.ts` stays 42×42. The fallback branch in `RoomSlotRenderer.ts` currently uses `.setScale(1.25)` on a 48px texture; replace that expression with `.setDisplaySize(60, 60)` so both 48px procedural and 96px ritual textures occupy the same existing geometry. Room tokens remain 46×46. Search all `generateMonsterSprite` consumers before claiming coverage.

Live consumer audit amendment (2026-09-07): `src/objects/RoomVisuals.ts` contains
the same fallback scale expression. Task 2 may change only that expression to
`.setDisplaySize(60, 60)` as well; no room behavior or 24px battle texture changes.

World clarity does not add residents, alter slots, move action pins, change 24px battle art, or modify gameplay. Normal idle motion remains owned by the existing scene and reduced-motion stays static.

## Quest speaker and folio

Scope is `QuestLogPanel.ts` main quest presentation and only the surrounding panel chrome needed for a coherent folio. Keep existing public functions, scrolling, main/sub/daily ordering, claim admission, preparation transactions, reward calculations, close/restart behavior, and caller payloads.

Show the original `npcSpeaker` name beside its art. Exact supported labels are `도깨비 전사`, `구미호`, `저승사자`, `산신령`, and, after registration, `신선 도인`. Use `getCharacterArtForSpeaker`; do not duplicate a second name-to-ID map in Quest UI. Do not trim labels, fuzzy-match, or conflate related characters. Unknown labels use the supplied original `npcEmoji`. A mapped missing v2 source uses its existing legacy portrait; missing both uses the original emoji.

A small `QuestSpeakerView.ts` helper owns this renderer selection and illustration insertion. It adds no interactive target, timer, tween, storage access, or persistent listener. The parent quest container owns the returned display object. `QuestSpeakerView.test.ts` checks selection/fallback without requiring a complete Phaser scene.

Layout is a stone/indigo folio using existing `DUNGEON_UI` and primitive roles: chapter/quest context, full quest title, speaker/first description line, objectives and values, reward preview. Derive vertical positions from wrapped text bounds before placing the next block. Keep the current first-description-line semantics. Each objective places description and progress/value in separate vertical bands when needed; do not squeeze text to make an illustration fit. The speaker illustration has a bounded footprint and yields space to text at all three browser sizes.

Completion overlays, sub/daily transaction logic, other screens, NPC definition inventories, and invader art are outside this visual change unless a directly caused regression must be fixed in its immediate owner.

Visual review amendment: the main heading must render its existing `📜` as one
Unicode glyph. Phaser's nonzero letterSpacing path splits this surrogate pair;
remove spacing only from this heading, preserving its original wording. The B1
browser regression observes actual canvas draws and rejects lone surrogate calls.

## Acceptance and evidence

1. Exactly five new approved runtime files, nine total registered v2 guardians, all original asset/audit hashes unchanged. Every new PNG passes dimensions, RGBA, byte ceiling, alpha margin, and reproducible export checks.
2. The five species/roles remain visually distinct at 48px. Review final source, 24/46/64/104px portraits, 46px room token, 42px Home, 60px fallback, and a large source preview. Screenshot fixtures must be labelled.
3. Ritual world bake is 96×96; procedural world bake remains 48×48. Logical Home/fallback/token bounds stay 42/60/46px respectively.
4. Quest art supports all five exact names; unmapped and missing-source cases use the honest fallback. No source lookup adds inputs or mutates saved state.
5. At 360×800 / 390×844 / 430×932 DPR2, changed core text/controls meet the limits above, titles/objectives/rewards remain reachable, and there are no new fixed-layout collisions or hidden required actions.
6. Normal/reduced motion, three consecutive relevant scene/panel entries, pointer open/close, and quest selection show no accumulating owned input, timer, tween or listener. Storage comparisons occur after legitimate scene-entry preparation; never claim a preparation transaction is save-neutral.
7. Missing-new and missing-both fault cases remove the relevant generated caches before invoking the actual renderer. Existing skin fallback and original four portraits remain correct.
8. Focused tests, full `npm test`, `npm run build`, `npm run check:portraits`, and `git diff --check` pass. Existing bundle advisory is reported rather than relabelled as solved.
9. `scripts/verify-character-b1.mjs` creates new B1 artifacts only. Baseline and final source/PNG hashes, viewport, storage, lifecycle, network and console receipts are stored separately. Old verification scripts and ledgers remain historical evidence.
10. Capture comparable fresh-browser boot measurements before and after runtime changes: elapsed navigation-to-Home readiness, actual registered v2 count/bytes, texture source pixel estimates, error counts and frame timing where measurable. Use the same environment and fixture; report samples and differences without inventing a device performance budget.

## Rework and stop conditions

- Checkerboard/opaque floor, wrong silhouette, identity drift, missing transparency or over-budget asset: reject the master/export before registry registration; regenerate only that character through the built-in tool.
- Different bytes already at a runtime target: stop that export with the exact target; parent determines provenance and authorizes a versioned replacement if needed.
- UI collision: change presentation geometry/wrapping, preserving text and transactions. New sprite dimensions must not change display geometry.
- Source loading failure: preserve the existing fallback and report the failed asset. Do not weaken the image gate.
- Boot or lifecycle regression: reproduce with the same fixture; fix the direct owner before acceptance. Do not invent a demand-loading subsystem within B1.
- Missing render or authority evidence: mark that check unavailable and keep B1 acceptance open.
- NPC/invader identity, 136-art loading, economy/save/balance/native or external delivery change: retain as a separate later decision.

## Traceability

Follow-up: `CHARACTER_B1_BOOT_PROFILE.md` records the completed alternating local
ablation and full request inventory. The old seconds-scale delay did not reproduce;
no runtime fix was justified. Historical cause and production/device acceptance
remain open. The earlier closeout observations below are retained, not overwritten.

Closeout limitation (2026-09-07): the final browser functional audit and independent
review pass, but baseline-matched boot samples increased to2399.6640–3759.0004ms
from the preserved615.749333–1090.2105ms baseline. The baseline has no actual GL
version/frame dataset and the shared host was not a controlled benchmark.
No speed PASS, causal diagnosis or device-readiness claim is made. Profile boot
phases and asset loading under a controlled paired baseline before B2; do not
silently loosen this gate or introduce demand-loading architecture without review.

`CHARACTER_B1_IMPLEMENTATION.md` tasks 0–5 implement this spec. The approved scope authorizes execution; repeated broad design approval is unnecessary. A new authority boundary still requires a separate concrete decision. Completion records must say current-worktree B1 implementation/verification and list any remaining checks.
