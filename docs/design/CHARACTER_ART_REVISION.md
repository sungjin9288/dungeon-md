# 설화 수호자 아트 개정 — 2026-09-05

## Boot follow-up — 2026-09-07

See `docs/design/CHARACTER_B1_BOOT_PROFILE.md`: two alternating ablation series
with full request inventories did not reproduce the old seconds-scale delay.
Current/comparison medians were693/661ms and1086/1007ms. No runtime or art change
was justified by this evidence. Historical cause and production/device performance
acceptance remain open; all previous observations below are preserved.

## B1 continuation — 2026-09-07 (local functional verification passed)

Approved B1 spec/implementation plan: `docs/design/CHARACTER_B1_SPEC.md` and
`docs/design/CHARACTER_B1_IMPLEMENTATION.md`. Five early guardian exports passed
parent asset acceptance (`tools/character-b1-assets.json`); Home density and Quest
speaker UI are implemented and command-verified (`tools/character-b1-verification.json`).
Its separate browser functional audit, regression checks, Astra review and parent
image review passed. The A0–A4 record below stays unchanged as September 5
evidence. B1 yields9 total v2 guardians;127 remain outside it.

### Implemented B1 delta

- New IDs: `village_archer`, `dokkaebi_junior`, `gold_turtle`,
  `fire_dokkaebi`, `sage`. Five exports total 1,216,268 bytes; all nine total
  2,386,361 bytes. Each new file is 512×512 RGBA, below 512 KiB, with at least
  42px transparent margins. Repeating the explicit export produced five
  byte-identical no-write results. Accepted/rejected provenance is in
  `output/character-art/ritual-v2/B1_PROMPTS.md`.
- Ritual Home sprite source is 96×96; procedural source remains 48×48.
  Logical Home / room fallback / token sizes remain 42 / 60 / 46px. Both
  `RoomSlotRenderer` and `RoomVisuals` fallback consumers use explicit 60px bounds.
- Quest uses the shared exact speaker map, adds `신선 도인 → sage`, and preserves
  unknown-name emoji and missing-source fallbacks. Main folio positions follow
  measured text bounds; core progress/reward text is 12px, speaker art is 48px,
  and close input is 44×44. The main heading preserves its scroll emoji without
  Phaser letter-spacing surrogate splitting. Gameplay/quest data are unchanged.
- Command proof: 105 files / 2,904 tests; focused 3 files / 61 tests; exporter
  13 tests; build, TypeScript, legacy136 check and diff-check passed. Existing
  Vite bundle-size advisory is not addressed by B1.
- Browser audit:27 captures/5 contact sheets/19 fixtures,0 enforced failures,
  console/network errors or source drift. Each motion mode repeats3 panel and3
  route cycles. Quest55 objects are all destroyed after close, with0 remaining
  input registrations/tween targets. Ambient waterdrip and idle-income resources
  are attributed separately, not counted as Quest leaks. All37 current artifact
  hashes and17 source hashes matched during parent review.
- Failed attempts are retained separately. The immutable attempt02/04 capture
  mapping is `output/character-art/b1/qa-attempt-archive-manifest.json`; parent
  verified all66 referenced archive hashes. The final browser audit hash is
  `182c0c83d5346444cbec7731ec8347bfd8d14f0fe0f85de3b458a55513d34f6f`.

### Explicit next boundary

Boot-performance verdict remains open. Preserved baseline samples were
1090.2105/615.749333/622.938542ms; the final audit recorded
1235.6331/788.1334/1250.0634ms. The first supplemental series was
3708.4613/1428.7949/1363.9199ms (`tools/character-b1-boot-recheck.json`), with
the audit's extra scene query/populated-Home wait. The exact baseline URL/single
wait supplement records3391.4347/3759.0004/2399.6640ms in
`tools/character-b1-boot-matched.json`. All series remain preserved.

Current context is WebGL1.0; the old baseline's WebGL2 label was inferred
incorrectly from Phaser renderer.type2, and its actual GL version is unavailable.
Texture source pixels were22,753,784 before and24,135,454 in the final audit
(24,142,876 in supplements); these are source estimates, not GPU-process memory.
No speed PASS, causal explanation or frame comparison is claimed. The next
priority is controlled paired boot profiling before extending the art batch.

B2 candidates are `one_tail_fox`, `thunder_dokkaebi`, `ice_dokkaebi`; they are
not B1 assets. Nine accepted v2 guardians does not mean every guardian available
by stage10 is redesigned. Remaining127, NPC/invader art, organic campaign soak,
bundle remediation and native/store readiness remain separate work.

## 요청과 완료 범위

사용자 요청: 캐릭터와 전체 디자인을 게임 기획에 맞게 다시 다듬는다.
이 문서는 이전 web layout 완료를 폐기하지 않고 **캐릭터와 공간의 일관성**을
추가로 검증하는 개정 계획이다. 이미지 파일 보유와 아트 디렉션 적합은 다른 gate다.
기존 136종 JPG는 모두 보존한다. 이번 1차 production slice는 대표 네 캐릭터의
versioned artwork, 공통 portrait/world-token integration, 이야기 속 speaker art,
관련 화면의 실제 렌더·행동 검증이다. 나머지 전종 교체 완료로 보고하지 않는다.

## 기획과 관찰

- 플레이어는 침입자로부터 오래된 설화 던전을 지키고, 수호자 수집·배치·성장으로
  방어를 개선한다. Guardian는 소비재 아이콘이 아니라 이 장소의 주인공이다.
- 현행 136종의 256px JPEG 보유율은 100%다. 흰 배경·인간형 얼굴·비슷한 의상과
  큰 이모지 speaker가 어두운 기와/석조 던전과 다른 미술 언어를 사용한다.
- 기존 small/chibi 수집성은 유지한다. 반실사 성인 비율로 바꾸지 않는다.
  아담한 2.5–3등신, 큰 형태·표정, 민속 기물에서 나온 재질과 역할별 자세로 구별한다.
- Runtime `DUNGEON_UI`, data/role/tribe/rarity, save, combat, route authority 유지.

## 새 시각 문법

**오래된 던전을 지키는, 손으로 빚은 듯한 설화 수호자.**

- Medium: original hand-painted stylized 2D; broad brush planes, warm readable
  faces, restrained dark outlines, matte wood/clay/cloth/aged bronze. Not glossy
  plastic, photorealism, generic anime cosplay, or a named game's imitation.
- Silhouette: one dominant identifying shape and one role prop; at 48px the
  creature/stance must remain distinct. Decorative embroidery is not identity.
- Palette: charcoal/ink-indigo body shadows; warm ochre/ivory faces; jade spirit
  light and aged brass accents. Tribe hue supports silhouette, never replaces it.
- Source asset: one centered full-body subject, transparent background, 8–12%
  safe margin, no cast-shadow floor, baked frame, text, UI, watermark or logo.
- Runtime export: 512×512 RGBA, at most 512 KiB per new character; contain the
  source within 428×428 to guarantee 42px transparent padding. The large theatre
  uses this source; the existing portrait/token canvas sizes remain unchanged.
- Collectible portrait: calm stone backing, creature fills frame; original
  role/element labels stay visible. Tiny world tokens keep the same silhouette
  without role/element badges.
- Theatre: visible character illustration paired with exact original speaker
  name/dialogue. Unknown/unmapped speakers keep an honest fallback, not an
  incorrectly assigned character. No story or reward changes.

## 11부족 확장 규칙

| Tribe | Main silhouette | Material / motif | Avoid |
| --- | --- | --- | --- |
| dokkaebi | squat heavy body, tile-curled horns, asymmetric club | baked clay, rope, worn wood, brass bell | identical horned human boys |
| gumiho | narrow ears, distinct authored tail count, sweeping fan | ivory fur, ink-indigo cloth, jade foxfire | identical dress with color swaps |
| dragon | long crest and coiled scaled mass | celadon, cloud braid, weathered bronze | winged western lizard defaults |
| underworld | tapering robe, broad gat, lantern negative space | ink cloth, paper lantern, pale jade smoke | skull/scythe-only costume shorthand |
| sansin | broad pine-crowned elder, mountain-like shoulders | bark, moss, stone, ochre cloth | ornamental hat as only distinction |
| sea | fins, shells, wave-shaped stance | nacre, wet stone, tide knots | generic mermaid silhouette for all |
| mask | carved expressive face plate, open dance stance | painted wood, tassels, hemp | borrowed historical mask traced exactly |
| moonlight | crescent contour, rabbit/tiger species shapes | ivory fur, muted silver, moon threads | human avatar for every animal |
| celestial | tall airy crown, cloud-sleeve silhouette | pale cloth, cloud braid, sun-brass | crowns and glow without role cues |
| primordial | asymmetrical monumental mass | cracked relic stone, roots, ember seams | humanoid recolors of other tribes |
| void | broken contour, controlled inner gaps | ink glass, ash cloth, dark crystal | unreadable black blob / neon overload |

Rarity adds authored craft/scale and deliberate detail; it never changes stats or
the monster identity. Melee owns weight/weapon, ranged owns reach, magic owns a
focus/foxfire shape, support owns an open protective silhouette.

## Execution and ownership

First four exact registry IDs: `dokkaebi_warrior` (도깨비 전사 / melee/fire/C),
`gumiho_guardian` (구미호 수호자 / magic/dark/R), `death_messenger`
(저승사자 / magic/dark/R), `mountain_spirit` (산신령 / support/holy/L).
Story name `구미호` uses the existing guardian identity, not the separate queen.
The full roster is 134 entries in eleven tribes plus two unassigned entries;
`village_archer` and `thunder_hero` remain explicit independent human allies.
No tribe reclassification is part of this art task.

| Step | Acceptance | Status |
| --- | --- | --- |
| A0 | Live art/source audit and this whole-roster direction | COMPLETE |
| A1 | Four distinct reference-quality generated characters, originals and export provenance | COMPLETE |
| A2 | Versioned PNG override, safe legacy/procedural fallback, portrait/token/theatre integration | COMPLETE |
| A3 | Real multi-size roster/detail/story/world render, state neutrality, input/lifecycle, missing-art check | COMPLETE |
| A4 | Focused/full tests, build, independent review, inventory/evidence/handoff sync | COMPLETE |

Allowed: `public/assets/monsters/ritual-v2/`, local master/prompt/evidence artifacts,
BootScene asset selection, PortraitGenerator composition, speaker presentation,
small presentation registry/tests, related doc/generator provenance updates.
No changes to monster definitions, save schema, balance, collection eligibility,
transactions, routes, native packaging, paid CLI/API fallback, commit/push/publish.
Runtime tokens remain in the existing colors file; no competing token system.

## Later expansion (not delivered by four-character slice)

1. Extend the verified style through Chapter 1 roster and remaining story leads.
2. Produce each remaining tribe in batches with source→thumbnail→runtime review;
   use the selected new source as style reference, never regenerate legacy blindly.
3. Align authored NPC/invader art and decorative scene signage only after role and
   target readability pass. Keep existing battlefield input and simulation rules.
4. Re-run whole-roster and whole-surface acceptance, then physical-device QA.

## Evidence and prompts

Generation used the built-in image tool. Exact accepted/rejected prompts and
source filenames: `output/character-art/ritual-v2/PROMPTS.md`; unchanged masters
are alongside that file. `node scripts/export-character-art.mjs` exports only the
four selected assets without repainting or background removal. A read-only second
export reproduced all four runtime files byte for byte.

| Character | Runtime bytes | Source canvas / safe margin |
| --- | ---: | --- |
| dokkaebi_warrior | 300,116 | 512×512 / 42px |
| gumiho_guardian | 308,894 | 512×512 / 42px |
| death_messenger | 223,858 | 512×512 / 42px |
| mountain_spirit | 337,225 | 512×512 / 42px |

Command evidence on final runtime: focused 3 files / 40 tests, full 104 files /
2,876 tests, `npx tsc --noEmit`, `npm run build`, `npm run check:portraits` and
`git diff --check` passed. Existing Vite large-chunk advisory is unchanged.
The portrait inventory checks legacy file presence/format, not all-136 new style.
Independent code/export review passed; whole dirty diff and native QA are excluded.

### Browser acceptance record

Reproduce with Vite running: `HEADED=1 node scripts/verify-character-art.mjs`.
`tools/character-art-audit.json` contains exact source/PNG SHA-256, alpha geometry,
scene bounds, input, storage and lifecycle receipts. No new dependency is required;
`PLAYWRIGHT_MODULE` and `GAME_URL` can select the existing local runtime/server.

- 60 final page captures: 16 states at each of 360×800 / 390×844 / 430×932,
  plus four canonical and four mirrored speaker states in normal motion at
  390×844, plus four missing-texture fault states. All use WebGL and DPR 2.
- Seeded Home, Barracks, detail, Codex, Forge, Fusion picker/selection and supplied
  Summon result show the actual production renderer. The gallery invokes actual
  portrait sizes 24/46/64/104, disabled alpha, 46px token and Home sprite paths.
- Real pointer Home→Barracks, detail open/close, Fusion selection, story
  reveal/advance/skip and return preserve save bytes after scene-entry work.
  Cinematic still marks seen on entry; this is not a no-save cinematic contract.
- Texture-removal fixtures exercise new-source loss and both-source loss:
  portrait/token legacy then procedural consumer fallback, Home procedural
  fallback, mapped story legacy then emoji. Unknown canonical speakers use emoji.
- Source pixels have 57.9–71.5% fully transparent area and at least 42px clear
  margin. No console/runtime errors, enforced gate failures or source drift.
- Three Barracks restarts at each size retain 61 children/9 inputs/0 timers;
  three normal Cinematic entries retain 16 children/3 inputs/one typing timer.
- The saved roster, supplied SummonResult, isolated gallery and mirrored dialogue
  are labelled fixtures, not organic acquisition, paid pulls, campaign completion,
  every nested screen state, or physical-device acceptance. The 21-definition /
  160-line historical Cinematic run was not repeated as part of this art slice.
- Standard-client final state exports reached Barracks twice without error
  artifacts; black WebGL image exports were opened and excluded. Actual browser
  page screenshots provide the visual evidence instead.

All 60 captures were visually reviewed through eight contact sheets, with key
full-size product/story images also opened. The final Summon capture waits for
name, footer and close CTA visibility; real close is save-neutral. All 75 receipts
pass their enforced gates. Independent code/export, goal/context and final
QA/evidence cross-reviews passed. All 81 source/script/asset/PNG hash entries match.

Final JSON SHA-256:
`9c9a1e755c22de60836462572a51122db048df92e767c2122a0d52cb58ccd6c7`.
Script SHA-256:
`6b372a698a4c3e79bf785977812b0367f0833a732df9928bd5f5a516fc96d8ed`.
Six coupled documents passed 253 literal path checks and Markdown fence checks.
Owned browsers and the Vite server were closed; TCP8083 listener absent. A0–A4
are complete for this four-character slice in the current worktree only. No
stage/commit/push/merge/PR/native sync or publishing was performed.

Known pre-existing observations, not a claim of whole-app zero visual debt:
`HomeBoardRoute.ts` retains an 8px decorative route-order marker. The existing
48px Home sprite bake is softer than the 96px token on DPR 2. A future density
change must preserve existing sprite display geometry before raising resolution.
