# Character B1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver five approved early guardian artworks, sharper Home sprites with unchanged geometry, and exact quest speaker illustrations in a readable folio.

**Architecture:** Extend the existing presentation registry only after parent-approved assets pass export validation. Keep a single code worker, an independently owned parent art stream, the existing fallback hierarchy, and scene/container lifecycle ownership. Add new B1 evidence without overwriting the September 5 audit.

**Tech Stack:** Phaser 3, TypeScript, Vite, Vitest, existing Playwright runtime, built-in image generation.

**Spec:** [CHARACTER_B1_SPEC.md](./CHARACTER_B1_SPEC.md).

## Current-worktree closeout — 2026-09-07

Tasks0–5 implementation, functional checks and scoped handoff are recorded below.
This is **not unconditional B1 completion**: boot-performance acceptance remains
open. Do not start B2 or claim device/release readiness from this result.

- Assets: five new/ nine total; parent alpha/visual/idempotent-export acceptance.
- Code: SOL high exporter and Quest, TERRA xhigh registry/density; Astra reviews.
- QA: LUNA max scaffold, SOL high integration;27 captures/5 contacts/19fixtures,
  zero enforced functional failures. Parent opened final images; Astra independently
  checked source/evidence.17 source and37 artifact hashes match the final audit.
- Commands:105files2904tests, focused3files61tests, exporter13tests, build,
  TypeScript, legacy136 and diff-check PASS. Existing bundle advisory remains.
- Preservation: baseline1006 paths →994 unchanged/12 authorized changes/0 missing.
  Failed-attempt records retained;66 attempt02/04 archive references hash-match.
- Final audit: `tools/character-b1-audit.json`, SHA-256
  `182c0c83d5346444cbec7731ec8347bfd8d14f0fe0f85de3b458a55513d34f6f`.
- Exact matched boot receipt: `tools/character-b1-boot-matched.json`,3391.4347/
  3759.0004/2399.6640ms versus baseline1090.2105/615.749333/622.938542ms.
  No causal or speed PASS claim; all slower supplemental samples are retained.
  The old baseline actual GL version and comparable frame dataset are unavailable.
- Parent-owned Vite PID27680 stopped; TCP8083 has no listener. No Git delivery,
  native sync, paid API fallback or publishing was performed.

### Required follow-up before B2

- [x] Profile boot phases and asset requests using alternating isolated arms.
  `CHARACTER_B1_BOOT_PROFILE.md` records16 complete-inventory samples, preserved
  intermediate attempts, source hashes and0 runtime edits. The old multi-second
  delay was not reproduced; current-versus-ablation median differences were33/79ms
  across the two series, not evidence of a seconds-scale B1 regression.
- [ ] Establish a recorded production/device baseline and readiness budget before
  broad performance acceptance or startup architecture changes. The historical
  slow-sample cause remains unproven; do not claim optimization from these diagnostics.

## Global Constraints

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

---

## Execution ledger and ownership

Status starts PLANNED; check boxes describe required actions, not completed evidence. The parent updates this ledger only after reviewing actual output. User-requested model routing is explicit; the parent model is not implicitly switched.

| Task | Model / owner | Dependencies | Independently reviewable result |
| --- | --- | --- | --- |
| 0 | Parent / Astra coordination | Approved spec | Protected baseline, owned server, comparable pre-change measurements |
| 1 | SOL high | Task 0 path baseline | Explicit batch export with safe arguments/no-clobber behavior |
| Art | Parent, built-in image tool | Approved five briefs | Five accepted masters, prompts, exports, alpha receipts |
| 2 | TERRA xhigh | Task 1; assets for registry portion | v2-only 96px bake, fixed display geometry, nine-entry registry |
| 3 | SOL high | Task 2 registry interface stable | Exact quest speaker rendering and narrow folio presentation |
| 4 | LUNA max draft → SOL high integration | Runtime tasks complete | New reproducible B1 browser audit and final validation |
| 5 | Astra review / parent closeout | Task 4 | Code/spec/QA review, reconciled docs and evidence |

Task 2 may implement the density change while the parent finishes assets, but must wait for all five export acceptance receipts before adding registry entries. Task 3 never writes `characterArt.ts` or its test. Task 4 starts after the code worker has yielded its final file list. Parent may change documentation while a worker edits its assigned code; no two writers share a file.

The requested checkout contains substantial user work over `main@68546cb`. A comparison to HEAD alone includes unrelated historical changes. Each task therefore snapshots its input path hashes/diffs, reports its exact owned delta, and compares protected paths against the task-start baseline. Skill defaults suggesting commits, clean worktrees or automatic workspace deletion do not apply: current task authority explicitly requires this dirty checkout and no Git delivery. Do not create a Goal; use this document and `progress.md` as the ledger.

### Task 0: Preserve the baseline and capture comparable boot evidence

**Owner:** Parent. **Files:** new B1-only baseline artifacts under `output/character-art/b1/` and `tools/character-b1-baseline.json`; no runtime modifications.

**Interfaces:** Produces protected file hashes, pre-change runtime source hashes, fresh-browser boot samples, and existing-display bounds for Task 4. This artifact records actual measurements, never a synthetic performance pass.

- [x] Read this plan and spec; confirm the approved IDs are exactly `village_archer,dokkaebi_junior,gold_turtle,fire_dokkaebi,sage`.
- [x] Record exact current status and owned source diffs with native Git where complete output is needed:

```bash
git status --short --branch
git diff -- scripts/export-character-art.mjs src/art/PortraitGenerator.ts src/scenes/HomeRoomCards.ts src/ui/RoomSlotRenderer.ts src/data/characterArt.ts src/data/characterArt.test.ts src/ui/QuestLogPanel.ts
```

- [x] Hash the original four masters/PNGs, legacy JPGs, `scripts/verify-character-art.mjs`, historical audit JSONs and screenshots. Preserve the supplied historical hash values as historical evidence; do not rewrite them to match new code.
- [x] If using an existing Vite listener, identify its owner; otherwise start an owned server at `http://127.0.0.1:8083`. Record process ownership so only the owned process is stopped at closeout.
- [x] In three fresh isolated browser contexts at 390×844 DPR2, measure navigation-to-active `DungeonHomeScene` using the same save fixture. Record navigation elapsed ms, readiness condition, v2 assets/count/bytes, texture source dimensions and console/network errors. Optional frame samples use the same duration and environment before/after. Preserve values even if slow; no numerical speed threshold is assumed.
- [x] Capture pre-change Home guardian bounds, room fallback bounds, and MQ-008 quest panel at the three required sizes. A browser screenshot is the render evidence; black WebGL exports are excluded after inspection.

### Task 1: Export only an explicit, safe batch

**Model:** `gpt-5.6-sol`, reasoning `high`.

**Files:** Modify `scripts/export-character-art.mjs`; create `scripts/character-art-export-options.mjs` and `scripts/character-art-export-options.test.mjs` if needed to isolate argument/path logic from browser startup. Do not edit `scripts/verify-character-art.mjs`.

**Interfaces:**

- Consumes accepted `{id}-master.png` files inside `output/character-art/ritual-v2/` and explicit CLI arguments.
- Produces `public/assets/monsters/ritual-v2/{id}.png`, the existing 512/428/42 export geometry, per-ID result receipts, and the following pure options function if the helper is introduced:

```js
parseCharacterArtExportArgs(argv, root)
// => { ids: string[], masterDir: string }
// Throws Error for absent/duplicate/unknown flags, empty/duplicate/unsafe IDs,
// or a resolved masterDir outside root/output/character-art/ritual-v2.
```

- [x] Add narrow failing `node:test` cases for missing arguments, `../sage`, duplicate IDs, `--master-dir` outside the allowed root, unknown flags and a valid two-ID invocation. Pure options tests create no runtime assets.

```js
import assert from 'node:assert/strict';
import test from 'node:test';
import { parseCharacterArtExportArgs } from './character-art-export-options.mjs';
const root = '/repo';
test('requires an explicit batch', () => {
  assert.throws(() => parseCharacterArtExportArgs([], root));
  assert.throws(() => parseCharacterArtExportArgs([
    '--ids', '../sage', '--master-dir', 'output/character-art/ritual-v2',
  ], root));
});
test('resolves a named batch without broadening it', () => {
  assert.deepEqual(parseCharacterArtExportArgs([
    '--ids', 'sage,gold_turtle', '--master-dir', 'output/character-art/ritual-v2',
  ], root), {
    ids: ['sage', 'gold_turtle'], masterDir: '/repo/output/character-art/ritual-v2',
  });
});
```

- [x] Run `node --test scripts/character-art-export-options.test.mjs`; confirm the new cases fail for the missing validation before implementation.
- [x] Implement argument parsing with explicit flag cardinality, `^[a-z][a-z0-9_]*$` ID validation, a `Set` uniqueness check, `path.resolve` and `path.relative` containment. Validate real paths for master directories/files to reject symlink escapes. Validate every master and output target before launching the browser. Reject unknown registry IDs using the authoritative known-ID inventory without auto-expanding the requested list.

```js
const rel = path.relative(allowedMasterRoot, resolvedMasterDir);
if (rel === '..' || rel.startsWith(`..${path.sep}`) || path.isAbsolute(rel)) {
  throw new Error('master directory is outside the character-art source root');
}
// The same containment rule applies after realpath resolution.
```

- [x] Keep the existing Canvas export formula. Collect and validate PNG buffers before writing any output; validate PNG signature, dimensions, RGBA and byte budget. Existing equal bytes are an idempotent no-write result; existing different bytes or output symlinks fail. New file writes use exclusive creation.

```js
const scale = 428 / Math.max(image.width, image.height);
ctx.drawImage(image, (512 - image.width * scale) / 2,
  (512 - image.height * scale) / 2, image.width * scale, image.height * scale);
// After full-batch validation, a new target uses:
await writeFile(output, bytes, { flag: 'wx' });
```

- [x] Run the focused options tests and `node --check scripts/export-character-art.mjs`. Invalid-argument commands must exit nonzero before browser launch or file writes. Record actual exit reasons.
- [x] Hand the parent the exact valid B1 command. Parent runs it only after accepting masters:

```bash
node scripts/export-character-art.mjs --ids village_archer,dokkaebi_junior,gold_turtle,fire_dokkaebi,sage --master-dir output/character-art/ritual-v2
```

- [x] Review the task delta and report only assigned changed paths. No commit/checkpoint cleanup.

### Art stream: Produce and accept five masters

**Owner:** Parent only. **Files:** five new master PNGs under `output/character-art/ritual-v2/`, B1 prompt/provenance record `output/character-art/ritual-v2/B1_PROMPTS.md`, five new runtime PNGs. Preserve existing `PROMPTS.md`, the four original masters/PNGs and historical outputs.

**Interfaces:** Produces a five-ID approval receipt containing exact master/runtime paths, hashes, dimensions, bytes, transparent fraction, four margins and visual review result. Task 2 cannot register an asset based on an image-generation job starting or a filename alone.

- [x] Generate original compact 2.5–3-head-tall matte folk-craft characters from the exact briefs in the spec, using the built-in image tool and the accepted reference characters. No paid CLI/API fallback.
- [x] Inspect each output. Reject wrong species, cloned costumes, checkerboard/opaque background, missing dominant silhouette, cropped props and overly tall adult proportions; retain the rejected prompt/path/reason.
- [x] Keep accepted masters unchanged; run the explicit Task 1 exporter on only these five IDs.
- [x] Inspect runtime exports at full size and 48px. Measure actual alpha: fully transparent fraction within 0.30–0.85, minimum clear edge margin ≥42/512, max alpha ≥250. Check 512×512 RGBA and ≤524288 bytes.
- [x] Repeat the deterministic export into memory/comparison output or use its idempotent no-write path; require byte-identical results. Do not regenerate/re-export the original four runtime PNGs.
- [x] Give Task 2 the five-ID accepted receipt and registry ownership explicitly. Parent must not simultaneously edit the registry when TERRA owns it.

### Task 2: Sharpen ritual world textures and register accepted art

**Model:** `gpt-5.6-terra`, reasoning `xhigh`.

**Files:** Modify `src/art/PortraitGenerator.ts`, `src/ui/RoomSlotRenderer.ts`, `src/data/characterArt.ts`, `src/data/characterArt.test.ts`. Inspect `src/scenes/HomeRoomCards.ts`; edit it only if needed to preserve explicit 42×42 geometry. `src/scenes/BootScene.ts` may receive an accurate registered-count comment only. Do not edit quest UI or old QA.

**Live audit amendment:** Also permit the single fallback scale expression in
`src/objects/RoomVisuals.ts` to become `.setDisplaySize(60, 60)`. Parent found this
third consumer during the required all-callsite search; preserve its other code.

**Interfaces:**

- Consumes `generateMonsterSprite(scene: Phaser.Scene, monsterId: MonsterId): string`, `selectCharacterArtSource`, approved art receipt.
- Preserves all existing runtime function signatures.
- Produces 96×96 ritual world textures, 48×48 procedural world textures; explicit 42px Home and 60px fallback display geometry.
- After asset acceptance, `CHARACTER_ART` has the original four plus exact B1 five. `getCharacterArtForSpeaker('신선 도인')` returns `getCharacterArt('sage')`; unknown exact strings still return null.

- [x] Read the existing mock-canvas cases in `characterArt.test.ts`; add a failing expectation that the ritual branch bakes 96×96 and the missing-v2 procedural branch remains 48×48. Preserve cache, explicit-skin and legacy source cases.

```ts
// Replace the existing four 48px assertions inside the real per-ID canvas test.
expect(canvas.width).toBe(96);
expect(canvas.height).toBe(96);
expect(context.drawImage).toHaveBeenCalledExactlyOnceWith(sourceImage, 0, 0, 96, 96);
expect(addCanvas).toHaveBeenCalledExactlyOnceWith(`sprite-ritual-v2-${id}`, canvas);
```

- [x] Run `npx vitest run src/data/characterArt.test.ts`; record the expected dimension mismatch before changing the renderer.
- [x] Change only ritual bake dimensions and its `drawImage` destination to 96. Keep source selection, transparent canvas, procedural 24×2 loop and texture keys intact. Search every consumer with `rg -n 'generateMonsterSprite' src scripts`; record exact display geometry for each.

```ts
const density = 96;
artCanvas.width = density;
artCanvas.height = density;
const sourceImage = scene.textures.get(source.textureKey).getSourceImage() as CanvasImageSource;
artContext.drawImage(sourceImage, 0, 0, density, density);
// RoomSlotRenderer fallback: 48 * 1.25 remains 60 logical pixels.
scene.add.image(cx, baseY, generateMonsterSprite(scene, occupantId))
  .setOrigin(0.5).setDisplaySize(60, 60);
```

- [x] Wait for the parent asset receipt. Add exactly the five immutable records using the existing path/key pattern, and add only `신선 도인: 'sage'` to the exact speaker map. Expand the existing registry and file tests from four to nine without changing the old four records.

```ts
sage: Object.freeze({
  monsterId: 'sage', version: 'ritual-v2',
  textureKey: 'monster-ritual-v2-sage',
  path: '/assets/monsters/ritual-v2/sage.png',
}),
// Existing exact speaker map receives:
'신선 도인': 'sage',
```

- [x] Add speaker tests for exact sage, unchanged four, rejected `신선 도인 ` and related unknown identities. Run `npx vitest run src/data/characterArt.test.ts src/data/portraitManifest.test.ts src/data/monsterVisualIdentity.test.ts` and `npx tsc --noEmit`.
- [x] Inspect a real Home render and forced room-token fallback; require 42×42 and 60×60 image bounds, unchanged action-pin/room layout and no console errors. Report new-source and procedural texture dimensions separately.
- [x] Deliver the updated interfaces and file diff to the parent, then release all code ownership before Task 3 starts.

### Task 3: Render exact quest speakers in a readable folio

**Model:** `gpt-5.6-sol`, reasoning `high`.

**Files:** Modify `src/ui/QuestLogPanel.ts`; create `src/ui/QuestSpeakerView.ts` and `src/ui/QuestSpeakerView.test.ts`. Read existing `src/ui/GameUiPrimitives.ts` and `src/constants/colors.ts`; reuse their APIs/tokens. Do not modify registry, quest data, transactions, other scenes or the original QA script.

**Interfaces:**

- Consumes `getCharacterArtForSpeaker(speaker: unknown): CharacterArt | null` and `selectCharacterArtSource(monsterId, textureExists): CharacterArtSource | null` from Task 2.
- Preserve `openQuestLog`, `closeQuestLog`, `QuestLogState` and existing overlay public interfaces.
- New helper exports the following pure resolver and renderer; the original `npcSpeaker` label is rendered by the caller:

```ts
export type QuestSpeakerVisual =
  | { kind: 'image'; textureKey: string }
  | { kind: 'emoji'; emoji: string };
export function resolveQuestSpeakerVisual(
  speaker: string, emoji: string, textureExists: (key: string) => boolean,
): QuestSpeakerVisual;
export function addQuestSpeakerVisual(
  scene: Phaser.Scene, container: Phaser.GameObjects.Container,
  x: number, y: number, size: number, speaker: string, emoji: string,
): Phaser.GameObjects.Image | Phaser.GameObjects.Text;
```

- [x] Add failing resolver tests for five exact names, unknown names, missing-v2 legacy, missing-both emoji, and false fuzzy matches. No scene/timer setup is required for resolver tests.

```ts
expect(resolveQuestSpeakerVisual('신선 도인', '🧙', () => true))
  .toEqual({ kind: 'image', textureKey: 'monster-ritual-v2-sage' });
expect(resolveQuestSpeakerVisual('신선 도인', '🧙', key => key === 'monster-ai-sage'))
  .toEqual({ kind: 'image', textureKey: 'monster-ai-sage' });
expect(resolveQuestSpeakerVisual('신선 도인', '🧙', () => false))
  .toEqual({ kind: 'emoji', emoji: '🧙' });
expect(resolveQuestSpeakerVisual('신선 도인 ', '🧙', () => true))
  .toEqual({ kind: 'emoji', emoji: '🧙' });
```

- [x] Run `npx vitest run src/ui/QuestSpeakerView.test.ts`; confirm failure for the absent helper.
- [x] Implement exact-map selection using the shared registry. The helper adds one image or emoji to the passed container, uses an explicit display size, and creates no input, storage access, timers or tweens.

```ts
const art = getCharacterArtForSpeaker(speaker);
const source = art
  ? selectCharacterArtSource(art.monsterId, textureExists)
  : null;
return source
  ? { kind: 'image', textureKey: source.textureKey }
  : { kind: 'emoji', emoji };
```

- [x] In `drawMainQuestCard`, use a bounded 48px illustration with the exact speaker name; put metadata/title above, description beside/below art, objective rows below, reward ledger last. Use existing stone/indigo and brass token roles. Preserve the first description line and all existing objective/reward strings. Measure wrapped title/description height before computing objective positions and returned card bottom.

```ts
// Each subsequent block starts after the actual previous text bounds.
const descriptionBottom = description.y + description.height;
let objectiveY = Math.max(speakerY + speakerSize, descriptionBottom) + 12;
// Rows reserve separate description and progress bands; advance by measured height.
const progressBandHeight = 24;
const rowBottom = objectiveText.y + objectiveText.height + progressBandHeight;
objectiveY = rowBottom + 12;
```

- [x] Keep existing claim handlers, daily/subquest preparation, section ordering, scrolling ownership and close/restart behavior. Restyle only surrounding chrome needed by this folio; no full Quest subsystem refactor. Ensure added art is noninteractive and does not obscure any existing target.
- [x] Run `npx vitest run src/ui/QuestSpeakerView.test.ts src/data/characterArt.test.ts src/data/quests.test.ts src/data/questRewardTransactions.test.ts` and `npx tsc --noEmit`. Inspect MQ-008, a long/multiple-objective quest, no active quest, and an unknown speaker in a real page.
- [x] Hand parent exact changed paths, helper interfaces, meaningful check results and any unreproduced issue. Release code ownership before QA modifies its script.

### Task 4: Produce new B1 verification without rewriting historical evidence

**Model:** `gpt-5.6-luna`, reasoning `max`, for the initial QA scaffold; parent
reassigned remaining integration to `gpt-5.6-sol`, reasoning `high`, after the
first run exposed harness pointer/layout faults and review found comparison gaps.
The draft and attempt-01 evidence remain preserved; runtime authority is unchanged.

**Files:** Create `scripts/verify-character-b1.mjs`, `tools/character-b1-audit.json`, new `tools/screenshots/character-b1-*` captures/contact sheets. Read `tools/character-b1-baseline.json`. Original `scripts/verify-character-art.mjs`, its old JSON and old PNGs remain byte-identical.

**Interfaces:** The new script imports the existing Playwright runtime via `PLAYWRIGHT_MODULE`, accepts `GAME_URL`, uses isolated saves, and exits nonzero on enforced failures/source drift. Its JSON separates fixtures, source assets, geometry, input, save, fallback, lifecycle, boot samples, protected hashes and explicitly unverified areas.

- [x] Base the harness on observed production renderer entry paths; use new B1 filenames and exact batch arrays. Never overwrite old artifacts to make their hashes match changed code.

```js
const ids = ['village_archer', 'dokkaebi_junior', 'gold_turtle', 'fire_dokkaebi', 'sage'];
const viewports = [{ width: 360, height: 800 }, { width: 390, height: 844 }, { width: 430, height: 932 }];
const failures = [];
// Every receipt stores fixture kind, viewport/motion, source keys and observed result.
if (failures.length || sourceDrift.length) process.exitCode = 1;
```

- [x] Enforce five new assets/nine approved registry IDs, exact asset dimensions/RGBA/bytes/alpha margins, and byte-identical protected originals. Generate actual portrait/gallery previews for all five and open their contact sheets.
- [x] At all three DPR2 sizes capture Home, Barracks/detail, room placement/token/fallback and quest folio with real production renderers. Verify 96px ritual versus 48px procedural bakes and 42/60/46 logical display bounds. New 48px art in quest must not create an interactive target.
- [x] Exercise MQ-008 sage, the four existing mapped speaker labels, unknown label, missing-v2 and missing-both source cases. Clear corresponding derived caches before fault injection. Retain exact supplied speaker name/emoji and record the selected source key. Check an explicit skin and the original four portrait/source fallbacks.
- [x] Exercise real pointer quest open/close and Home→Barracks navigation. Take storage snapshots after legitimate entry preparation, perform presentation actions, compare exact saved bytes, and report any expected preparation writes separately. Do not invoke a reward claim simply to call a presentation path save-neutral.
- [x] Repeat Home/quest open-close/Barracks three times in normal and reduced motion; count inputs, relevant owned timers/tweens/listeners at equivalent settled points. No accumulating object/resource trend is accepted. Capture long title/objectives, no-active-quest and scroll reachability; inspect text/controls and console/page errors.
- [x] Repeat Task 0 fresh-browser boot samples in the same fixture/environment. Report before/after elapsed samples, registered art count/bytes, estimated texture pixels and error/frame measurements. A source RGBA estimate is not GPU-process memory. If comparable baseline is missing, label boot comparison unavailable and return the missing condition to parent.
- [x] Run syntax, focused tests and final required commands after runtime source stops changing:

```bash
node --check scripts/verify-character-b1.mjs
node --test scripts/character-art-export-options.test.mjs
npx vitest run src/data/characterArt.test.ts src/ui/QuestSpeakerView.test.ts src/data/portraitManifest.test.ts
npm test
npm run build
npm run check:portraits
git diff --check
HEADED=1 node scripts/verify-character-b1.mjs
```

- [x] Inspect real page captures, exclude black renderer-export artifacts, validate source/art/PNG hashes again, and publish a result identifying every failed/unavailable check. Report only performed checks. Fixtures do not prove organic acquisition/campaign or native behavior.

### Task 5: Review, reconcile evidence, and close the approved scope

**Owner:** Astra review, parent integration. **Files:** this plan, `CHARACTER_B1_SPEC.md`, `docs/design/CHARACTER_ART_REVISION.md`, `docs/design/DESIGN.md`, `docs/design/AGENT_HANDOFF.md`, `progress.md`, and B1 evidence metadata only. Preserve old dated records.

**Interfaces:** Consumes final worker diffs, exact accepted asset receipts, Task 4 JSON and protected-baseline comparison. Produces a scoped B1 verdict with separate code, spec and evidence findings.

- [x] Review code against the spec: only five new IDs; registry write after export approval; exact shared speaker map; no transaction/schema/route change; v2-only density; every consumer keeps geometry; exporter no-clobber/path constraints.
- [x] Review actual before/after images at 48px and the three viewport sizes. Reject art that loses identity or crowds title/objective/action content even when geometry checks pass.
- [x] Check final source hashes match the source used for screenshots; list protected original hash mismatches and any unowned changed path. Resolve only directly caused defects through the assigned owner, then repeat only affected checks plus required final consistency gates.
- [x] Append B1 evidence to the coupled docs with exact file counts, measured boot comparison, actual tests and remaining limits. Change A0–A4 historical prose only by adding a dated B1 section, never by rewriting past hash/test claims.
- [x] Mark checked tasks complete only after their evidence exists. Keep B2 three IDs, all-136, NPC/invader, gameplay soak, bundle remediation and device/store work explicitly later.
- [x] Stop only parent-owned browser/server processes. Final user report states current-worktree B1 results, important verification and any remaining condition; no commit/push/native/release completion claim.

## Plan self-review

- [x] Spec coverage: asset/export identity and provenance → Task 1/Art; registry/density/geometry → Task 2; exact quest/folio → Task 3; three-size fallback/storage/lifecycle/boot/protected evidence → Tasks 0/4; reconciled delivery → Task 5.
- [x] Interfaces: Task 2 preserves existing `getCharacterArtForSpeaker` and `selectCharacterArtSource`; Task 3 alone owns `QuestSpeakerView` exports; Task 4 imports production functions and records the actual nine-entry registry.
- [x] Scope: only B1 five plus existing-four rendering, explicit Home density and quest folio. B2/NPC/invader/loading architecture/native/Git delivery remain excluded.
- [x] Ownership: one code implementer, parent-only master generation; parent/TERRA registry ownership must be explicit; old verification script and evidence are protected.
- [x] No new approval ceremony: user approved the concrete B1 scope and model routing. Execute through the agreed sequence; seek direction only for a material new authority boundary.
- [x] Evidence honesty: historical counts are history, boot has measurements without an invented budget, and labelled fixtures remain distinct from organic gameplay.
