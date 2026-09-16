# Monster & Dungeon Design System

이 문서는 `dungeon-phaser`의 플레이 화면 디자인에 대한 유일한 권위 문서다. 런타임 color token의 권위는 `src/constants/colors.ts`이며, 이 문서는 token을 복제하지 않고 역할과 사용 규칙만 정의한다.

## Character art revision — 2026-09-05

사용자가 캐릭터 및 전체 디자인을 기획에 맞춰 다시 다듬도록 요청했다. 이전
136종 JPG의 파일 보유 완료는 새 아트 디렉션 적합을 뜻하지 않는다. 새 방향은
**아담하고 수집하고 싶은, 손으로 빚은 듯한 설화 수호자**다. 2.5–3등신과 표정은
유지하고, 인간형 코스튬 반복 대신 종족 silhouette·전투 역할·기와/목재/매듭/청동/
등불의 재질을 우선한다. Matte painterly character와 charcoal-indigo 공간을 연결한다.

이 요청은 아래 과거 environment-only 생성 범위를 **versioned character cutout**으로
확장한다. 구체 계획과 acceptance는 `docs/design/CHARACTER_ART_REVISION.md`에 있다.
현재 첫 배치는 `dokkaebi_warrior`, `gumiho_guardian`, `death_messenger`,
`mountain_spirit` 네 종뿐이며, 132종의 새 아트가 완료된 것은 아니다. 기존 모든 JPG와
MonsterDef/tribe/role/rarity/save/전투/route authority를 보존한다.

새 runtime 계약: `public/assets/monsters/ritual-v2/{id}.png`, 512×512 RGBA,
512 KiB 이하, 실제 alpha와 읽히는 작은 silhouette. `characterArt.ts`의 승인된
presentation registry만 preload한다. Portrait/room token은 v2→legacy JPG→기존
procedural 경로, Home world sprite는 v2→procedural(JPG 사용 안 함), Cinematic의
exact mapped speaker는 v2→legacy JPG→원래 emoji로 fallback한다. Unmapped
speaker는 원래 emoji를 유지한다. 원본 master와 exact prompt는 `output/character-art/ritual-v2/`
보존. 새 파일을 legacy `PORTRAIT_IDS`에 섞지 않는다. Story art mapping은 exact
speaker label에 한정하고, 관계가 다른 캐릭터에 같은 그림을 임의로 붙이지 않는다.

## D1 approved visual thesis

390×844 세로 화면은 dashboard가 아니라 살아 있는 몬스터 던전의 단면이다. 시각 언어는 **charcoal-indigo stone + Korean folk-craft**다. 숯빛과 쪽빛 석재가 조용한 깊이를 만들고, 단청에서 가져온 제한된 의미색과 손으로 새긴 듯한 얇은 기능선이 상태를 설명한다. 광택, candy button, 갈색 카드 더미보다 공간·크기·silhouette·짧은 label을 먼저 사용한다.

Home의 첫 읽기는 위에서 아래로 다음 순서를 따른다.

1. 침입문과 침공 방향
2. 하나의 연속된 침입 경로
3. 방 cutaway와 상주 수호자
4. 던전 심장부
5. 잠긴 다음 심도
6. 하나의 다음 수비 지시와 primary action

상단 resource/status와 하단 navigation은 지속 chrome이지만 lair보다 먼저 보이면 안 된다.

### Semantic accent roles

실제 값과 alias는 `src/constants/colors.ts`에서만 관리한다.

| Role | Meaning | Allowed Home use |
| --- | --- | --- |
| charcoal / indigo stone | background, tunnel, panel, quiet depth | 기본 표면과 비상호작용 배경 |
| vermilion danger | breach, broken room, urgent repair | 침입문·파손·위험. reward/rarity에 금지 |
| jade readiness / production | ready, active production, selected work target | 준비 완료·가동·선택 상태 |
| moonlight summon | summon and occult acquisition | 소환 destination과 관련 focus만 |
| brass reward | reward, earned value, primary defense readiness | 보상·재화·전투 준비. danger에 금지 |
| copper forge | forge, craft, equipment work | 제작 destination과 장비 보강만 |

상태는 색만으로 전달하지 않는다. 최소한 label, icon, shape, position 중 하나를 함께 사용한다. rarity, economy, gameplay 계산과 저장 의미는 이 시각 역할 변경으로 바꾸지 않는다.

### Home hierarchy contract

- 배경은 비상호작용 atmosphere다. 방, 적, 보상, button처럼 닫힌 card나 밝은 outline을 갖지 않는다.
- 침공 상태는 침입문과 첫 route segment에 붙인다. 전체 폭 red dashboard card는 사용하지 않는다.
- room은 cutaway alcove로 보이며, inhabited room은 기존 monster portrait presentation을 사용한다. 첫 inhabited room에는 다른 resident보다 큰 guardian anchor를 둔다.
- repair, empty/design, production/activity, ready, selected, locked는 label/icon/shape/position으로 구분한다.
- readiness source는 기존 `getHomeReadinessDirective` 계약이다. command surface의 primary directive와 board의 단 하나의 spatial target이 같은 recommendation의 kind, slot, copy를 사용한다.
- 모든 room action이 ready이면 warning marker를 만들지 않는다. entrance/route의 defense target과 `전투 준비` action을 사용한다.
- primary CTA는 하나이며 높이 44 logical px 이상이다. 변경된 interactive surface는 44×44 logical px 이상이다.
- core copy는 12px 이상, semantic secondary copy는 11px 이상이다. 10px은 비상호작용 micro telemetry에만 허용한다.
- reduced-motion에서는 새 decorative looping tween을 만들지 않는다. state, focus, route direction, action target은 정적으로 그대로 보인다.

### D1 navigation authority

현재 root navigation의 권위 있는 baseline은 정확히 네 zone이다: `dungeon`, `legion`, `forge`, `invasion`. 각 zone의 destination과 active-scene mapping은 protected `src/data/navigationContract.ts`가 소유하며, `DungeonHomeScene`, `BarracksScene`, `ForgeScene`, `StageSelectScene`은 동일한 fixed-camera four-zone builder를 사용한다.

- `dungeon` → `DungeonHomeScene` — 살아 있는 vertical dungeon board와 room focus.
- `legion` → `BarracksScene` — Legion 내부에서 `Summon`, `Codex`, `Shop`, `Fusion`, `Skill`로 이동한다. 이 nested route들은 root zone이 아니다.
- `forge` → `ForgeScene` — 기존 craft/equip/dismantle 흐름을 유지한다.
- `invasion` → `StageSelectScene` — `PreBattleScene`은 invasion-internal step이며 global bottom bar를 갖지 않는다.

`focusRoomSlotIdx`, `focusMonsterId`, `focusSourceLabel`, `forgeReturnScene`, `previousScene`, `preBattleEditReturn`, `returnTo`의 set/consume semantics와 registry field ordering은 기존 contract 그대로 유지한다. 이 handoff state는 transient scene registry context이며 `GameState`나 `localStorage`에 들어가지 않는다. Home ↔ root zones, focused-room Home ↔ Legion, Home/Barracks ↔ Forge, targeted PreBattle edit/resume/cancel, battle launch, direct scene entry는 모두 기존 destination과 feedback을 보존한다.

### Forbidden patterns

- glossy candy cap, thick brown bevel, every-region border, nested card/pill/glow soup
- 동일 visual weight의 여러 CTA 또는 서로 다른 다음 행동을 말하는 board와 command deck
- 전체 폭 red invasion dashboard, background를 room/control처럼 보이게 하는 frame
- 11px 미만의 새 semantic secondary text, 12px 미만의 새 core text, 44px 미만의 새 touch target
- decorative infinite motion without reduced-motion guard
- 새 token file, 저장/schema/balance/content/transaction 의미 변경, dependency/asset/native/store 변경
- root four-zone navigation을 scene마다 다른 geometry, label, destination으로 복제하는 것

### Observable D1 gates

- 실제 Vite renderer의 390×844 warning state에서 entrance threat, route, resident guardian, 하나의 spatial target, 같은 내용을 말하는 하나의 command directive가 동시에 보인다.
- 실제 390×844 ready/stable state에서 false warning target이 없고 route defense target과 reachable `전투 준비` action이 보인다.
- entrance, rooms, heart, locked depth를 chrome보다 먼저 공간적으로 구분할 수 있다.
- text/touch inventory가 위 최소값을 만족한다.
- reduced-motion에서 새 decorative loop가 없고, scene 재진입·room open/close·navigation 후 interactive blocker/timer/tween/console error가 증가하지 않는다.
- focused tests, full `npm test`, `npm run build`, `git diff --check`가 통과한다.
- changed source는 protected writable allowlist로 제한되고 forbidden effects는 0이다.

## 0. 결정 요약

### Objective

이 문서는 Phaser/Vite 기반 Dungeon Guardian의 390×844 portrait surface에서 플레이어가 한 화면 안에 다음을 판단하게 하는 원본 Monster & Dungeon Design System이다.

1. 던전의 지금 약점은 무엇인가.
2. 어느 방·몬스터·함정을 한 번 보강하면 되는가.
3. 그 보강이 침입 방어와 장기 수집 성장에 어떻게 이어지는가.

적용 범위는 monster identity, Dokkaebi lair Home, Chapter 1 battle, 승인된 FC1 Chapter 2와 FC3 Chapter 3 battle identity다. MonsterDef, room/combat balance, GameState와 save schema, touch input, scene lifecycle, native shell, store/monetization은 변경하지 않는다.

### Recommended decision

권장 product loop는 다음과 같다.

~~~text
둘러보기 → 약점 하나 선택 → 배치·성장·제작 → 준비도 변화 확인
        → 침입 방어 → 보상 → 다음 선택 확장
~~~

Home은 dashboard가 아니라 살아 있는 수직 던전, 방 상세는 cutaway editor, 몬스터는 수집 RPG의 주체, 전투는 보강 가설을 검증하는 결과 화면이어야 한다. 이것은 완성 게임 선언이 아니다. 아래 D1-D6 evidence gate를 통과한 surface만 다음 단계로 진행한다.

### Existing architecture fit

| Existing authority | This system may do | It must not do |
| --- | --- | --- |
| src/data/monsterVisualIdentity.ts | save와 분리된 pure visual registry를 제공한다. | MonsterDef, stats, rarity, element, save를 mutate하지 않는다. |
| src/ui/MonsterPortraitView.ts | non-interactive identity cue를 render한다. | input zone, press callback, caller input, gameplay state를 바꾸지 않는다. |
| src/ui/RoomPickerModals.ts | enabled/disabled visual state를 일관되게 표현한다. | assignment transaction, cost, eligibility, touch behavior를 바꾸지 않는다. |
| Home / room UI | existing GameUiPrimitives와 readiness data를 조합한다. | UI에서 GameState를 직접 mutate하지 않는다. |
| DungeonScene + UIScene | room/formation 결과를 battle feedback으로 보인다. | cleanup 또는 HUD ownership contract를 우회하지 않는다. |

## 1. Evidence model and official benchmark

### Source labels

- **[FACT]**: 2026-08-17에 확인한 official product/store/update source가 명시한 구조다. source가 바뀌면 재확인한다.
- **[INFERENCE]**: FACT를 이 repository의 390×844, Phaser architecture, existing player loop에 맞춰 해석한 product decision이다.
- **[CONTRACT]**: 이 repository가 실제 구현에서 지켜야 할 rule이다.

### Current official benchmark matrix

| Reference | [FACT] current official structure | [INFERENCE] retained player need | Project adaptation | Borrow / do-not-copy boundary |
| --- | --- | --- | --- | --- |
| [Dungeon Maker](https://play.google.com/store/apps/details/?hl=en-US&id=com.GameCoaster.DungeonMaker) | Hero invasion에 대비해 trap/facility를 만들고 monster를 고용·배치하며 relic을 발견하는 dungeon-defense loop를 설명한다. Placement strategy가 survival과 unlock에 이어진다. | 배치가 메뉴 선택이 아니라 방의 전술적 저자성으로 느껴져야 한다. | Room cutaway에서 monster/trap socket과 예상 readiness delta를 먼저 보인다. | Dark Lord, heroes, monster/trap design, screen composition, names, UI, cards, assets를 복제하지 않는다. |
| [The King is Watching](https://store.steampowered.com/app/2753900/The_King_is_Watching/) | Resource production, army training, run event 적응 사이를 선택하는 roguelite kingdom builder이며, 보고 있는 구역만 progress하는 gaze rule을 설명한다. | 제한된 attention에서 가장 중요한 decision 하나를 먼저 읽고 싶다. | Home command deck과 action pin은 single highest-impact reinforcement 하나만 dominant하게 한다. | King/gaze mechanic, kingdom layout, UI, pixel art, terminology, iconography를 사용하지 않는다. |
| [CookieRun: Kingdom About](https://hub.cookierun-kingdom.com/about), [July 29 update](https://hub.cookierun-kingdom.com/news/updates/july-29-update-notice), [July 2 update](https://hub.cookierun-kingdom.com/news/updates/july-2-update-notice) | Kingdom building과 character collection/team combination을 함께 제시한다. Current updates는 forked node, battle/healing/reward node, per-wave recovery, upgrade-linked collection reward, adjacency synergy를 보인다. | base·collection·run 보상이 떨어져 보이지 않고 실패 뒤에도 다음 선택을 알 수 있어야 한다. | Dungeon board의 repair/lock/readiness를 persistent progress로, placement와 battle reward를 짧은 recovery loop로 연결한다. | Cookie character, kingdom architecture, collection, mode, art, proportions, update copy, economy를 가져오지 않는다. |
| [Legend of Keepers](https://store.steampowered.com/app/978520/Legend_of_Keepers_Career_of_a_Dungeon_Manager/) | Adventurer stats/resistances를 보고 trap과 monster를 배치한 뒤 crawl을 시작하는 dungeon phase와 run 간 Master bonus를 설명한다. | 전투 전 왜 이 배치가 맞는지와 결과를 비교하고 싶다. | Pre-battle/room picker에서 role, room fit, status, delta를 함께 표시하고 battle 후 같은 readiness language로 귀환한다. | Corporate dungeon framing, adventurer/monster/trap art, turn-based encounter, UI, naming을 재현하지 않는다. |
| [Apple Game HIG](https://developer.apple.com/design/human-interface-guidelines/games) | Apple의 official game guidance는 명확한 hierarchy, 즉시 이해 가능한 feedback, 적절한 touch target, 짧은 전환과 접근 가능한 표현을 game surface의 기본 원칙으로 둔다. | 390×844에서도 현재 목표와 결과를 한 번에 이해하고, 손가락으로 안전하게 조작해야 한다. | Shared primitive, four-zone shell, label/shape/position 보조 상태, 44×44 target, reduced-motion fallback을 적용한다. | Apple UI나 특정 game의 layout, icon, typography, palette, copy, trade dress를 복제하지 않는다. |

### Benchmark decision log

| Candidate structure | Decision | Reason and implementation consequence |
| --- | --- | --- |
| Room-level placement clarity | **KEEP** | Existing roomSlotTransactions와 RoomPicker가 이미 transaction boundary를 가진다. Preview/delta만 그 boundary 앞에 표현한다. |
| One dominant readiness action | **ADAPT** | Existing readiness directive를 사용한다. 외부 game의 gaze/resource rule은 이식하지 않는다. |
| Collection-to-growth feedback | **ADAPT** | Existing monster/skin/equipment presentation에 portrait and recommendation hierarchy를 더한다. shared level, gacha, economy는 추가하지 않는다. |
| Persistent upgrade across runs | **DEFER** | Existing save/progression system은 이 slice 범위 밖이다. 새 currency/schema 없이 현재 reward path의 legibility만 검증한다. |
| New run mini-game / random node map | **REJECT** | Chapter loop, balance, save, QA를 크게 넓힌다. Existing stage/invasion loop를 먼저 안정화한다. |

## 2. Player-needs synthesis

| Player need | Observable 390×844 answer | Original dokkaebi / folk-craft rule | Evidence gate |
| --- | --- | --- | --- |
| **공간 저자성** — 내 던전이 방어한다 | Home first read에서 entrance, route, rooms, heart, locked expansion, current pin이 보인다. | carved club, bell, rope, roof-tile curl, pottery, ember는 edge detail로만 쓴다. | Board path·room state·primary pin이 art보다 먼저 읽힌다. |
| **한 번의 다음 행동** — 지금 뭘 하지 | CTA와 action pin이 같은 directive를 말한다. | Bright accent는 current action 한 곳에만 쓴다. Decoration은 status처럼 보이면 안 된다. | CTA는 약 44px high이며 label/icon/position 중 둘 이상으로 state를 표현한다. |
| **수집 캐릭터성** — 이 몬스터는 누구인가 | Portrait에 shape, role, element, name, level, room fit가 충돌 없이 보인다. | Tribe는 silhouette/motif, role·element는 compact badge로 구분한다. Color만으로 tribe를 구분하지 않는다. | 24px world token에는 badge 없음; 34px 이상 portrait에는 14px+ badge와 10px+ glyph. |
| **안전한 비교** — 배치 전에 결과를 예측한다 | Candidate card는 eligibility, current room, fit, delta, action state를 함께 보인다. | Folk-craft texture는 panel hierarchy보다 약해야 한다. | Disabled card는 visual layer 전체가 same alpha family로 dim되고 input은 disabled다. |
| **회복 가능한 실패** — 전투 후 무엇을 바꾸나 | Battle result/return path가 shortage 또는 ready condition 하나를 말한다. | Core/entrance/route contrast는 failure/recovery를 위치로 보인다. | No save schema change; existing result and cleanup path remains intact. |

## 3. Originality and visual language

### Non-negotiable provenance rules

- Reference에서 feature structure만 학습한다. Character, creature, prop, pose, composition, map, screen layout, logo, typography, copy, palette, UI, screenshot, asset file, name, sound, trade dress를 copy/trace/import하지 않는다.
- Dokkaebi는 project-original folk-craft vocabulary다: brass bell, roof-tile curl, rope, stone, ember, pottery, carved-club abstraction, dancheong-inspired geometric rhythm. 특정 historical artwork, ritual object, living tradition의 exact pattern을 copy하지 않는다.
- Environment raster에는 text, UI, watermark, logo, person, monster, signature,
  protected character, named-game similarity가 없어야 한다. 2026-09-05에 승인된
  character cutout은 별도 versioned asset이며 환경에 baked-in하지 않는다.
- Reference URL은 provenance record일 뿐 runtime dependency 또는 art source가 아니다. New art starts from this contract, not a reference screenshot.

### Tone and hierarchy

| Role | Contract |
| --- | --- |
| Base surface | Charcoal stone와 dark teal depth로 dungeon을 읽는다. |
| Primary accent | Amber/green action 또는 readiness signal; 한 번에 primary action 하나만 경쟁한다. |
| Semantic accent | Rarity/role/element는 보조하며 color-only status가 되지 않는다. |
| Depth | Quiet shadow, bevel, active strip을 쓴다. persistent bloom, glass, decorative motion을 피한다. |
| Motion | Existing 120–320ms feedback이 state change를 설명할 수 있다. 이 slice는 tween/timer/listener를 추가하지 않는다. |
| Copy | Korean utility label은 cost, consequence, next action을 말한다. Core text는 12px 이상, semantic secondary text는 11px 이상이며 10px은 non-interactive telemetry에만 허용한다. |

## 4. Original Monster System

### 4.1 Data contract

src/data/monsterVisualIdentity.ts는 pure presentation registry다. 모든 identity는 deterministic Phaser hex color, glyph, silhouetteCue, motif를 가진다. Resolver는 own-property semantics를 사용한다. 따라서 unknown/legacy metadata와 inherited name인 constructor, toString, __proto__는 prototype chain을 읽지 않고 stable neutral fallback으로 간다.

Identity lookup은 save data를 쓰지 않고 combat input, balance, monster definition을 바꾸지 않는다.

### 4.2 Identity grammar

| Layer | Job | Contract |
| --- | --- | --- |
| Tribe | 무엇이며 큰 모양은 어떤가 | silhouette/motif first; color는 보조다. |
| Role | 지금 어떻게 기여하는가 | readable portrait의 compact left badge; stance가 large-shape cue다. |
| Element | 어떤 affinity로 읽는가 | compact right badge; edge/light motif이며 새 combat rule이 아니다. |
| Rarity | 얼마나 희소하고 꾸며졌는가 | existing rarity presentation remains authoritative; role/element를 덮지 않는다. |
| State | 지금 action 가능한가 | enabled/assigned/current을 label, position, button state, alpha로 표현한다. |

### 4.3 Tribe visual contract

| Tribe | Glyph | Shape read at 24px/64px | Original motif |
| --- | --- | --- | --- |
| dokkaebi | ◇ | horned head / club-like asymmetry | brass bell, tile curl |
| gumiho | ◒ | narrow ears / tail fan | foxfire ribbon |
| dragon | ≋ | long crest / scaled mass | jade scale, cloud curl |
| underworld | ✦ | hooded taper / spectral gap | lantern, smoke trail |
| sansin | ⌁ | broad shoulder / pine crown | pine needle, mountain stone |
| sea | ≈ | fin / wave sweep | tide knot, shell line |
| mask | ◉ | plate face / wide eye void | painted mask, tassel |
| moonlight | ☾ | crescent negative space | moon disc, star thread |
| celestial | ✧ | tall haloed crown | cloud braid, sun ray |
| primordial | ✹ | uneven colossal mass | cracked relic, ember vein |
| void | ◌ | broken contour / inner void | rift ring, dark crystal |

Tribe는 24px sprite와 64px portrait에서 distinguishable해야 한다. Color는 shape read를 보조하지만 tribe meaning의 유일한 channel이 아니다.

### 4.4 Role and element cues

| Role | Glyph / shape priority | Placement |
| --- | --- | --- |
| melee | ⚔ / forward-wide stance | portrait bottom-left |
| ranged | ➹ / tall narrow reach | portrait bottom-left |
| magic | ✦ / raised focus shape | portrait bottom-left |
| support | + / open centred stance | portrait bottom-left |

| Element | Glyph / edge treatment | Placement |
| --- | --- | --- |
| fire | ◆ / warm lower rim, ember fleck | portrait bottom-right |
| frost | ✦ / cool upper rim, ice shard | portrait bottom-right |
| lightning | ϟ / sharp side flash, forked spark | portrait bottom-right |
| dark | ◐ / violet shadow edge, smoke curl | portrait bottom-right |
| holy | ✧ / pale crown light, sun thread | portrait bottom-right |

### 4.5 Portrait behavior and disabled state

addMonsterPortrait keeps its existing caller inputs and adds no input zone. size 34 이상에서는 non-interactive cue disc와 glyph 두 개를 만들며, 더 작은 world token에서는 badge를 만들지 않아 pixel silhouette을 보존한다.

Disabled portrait는 frame, portrait image/fallback, cue graphic, role cue, element cue에 같은 alpha를 setMonsterPortraitAlpha로 적용한다. 이는 presentation-only operation이다. Assignment eligibility와 disabled input은 existing picker transaction path가 계속 소유한다.

## 5. Original Dungeon System

### 5.1 Home: Dokkaebi lair shaft

Home은 vertical cutaway이며 card dashboard가 아니다.

| Layer order | Contract |
| --- | --- |
| 1. Navigation and status | entrance, route, rooms, core, lock/repair state, current action pin이 첫 read다. |
| 2. Action | 가장 중요한 action은 target room과 bottom command deck 양쪽에서 같은 directive로 보인다. |
| 3. Atmosphere | bell, rope, tiled eave, pottery, dark stone, amber flame은 edge/top/bottom에 둔다. |
| 4. Negative space | central 55% width는 low-detail, low-contrast이며 baked label/control이 없다. |

Art가 clickable room, enemy, reward, button, status signal로 오인되어서는 안 된다. Home primary action은 background asset에 의존하지 않고 사용할 수 있어야 한다.

### 5.2 Room editor

방 상세의 first frame은 interior cutaway preview다. Monster/trap/equipment position은 list row보다 먼저 공간으로 읽힌다. Next valid slot은 existing room UI에서 target ring 또는 directive로 안내한다. 이후 구현은 GameUiPrimitives, pure transaction function, existing room-detail cleanup route를 사용한다.

Candidate card order는 다음이다.

~~~text
eligibility → role/rarity/fit → portrait → level/ATK/equipment
            → predicted delta → full-card action
~~~

### 5.3 Chapter 1–9 battle identity

battle-ch1.png는 Chapter 1, battle-ch2.png는 승인된 FC1 Chapter 2, battle-ch3.png는 승인된 FC3 Chapter 3, battle-ch4.png는 승인된 FC4 Chapter 4, battle-ch5.png는 승인된 FC5 Chapter 5, battle-ch6.png는 승인된 FC6 Chapter 6, battle-ch7.png는 승인된 FC7 Chapter 7, battle-ch8.png는 승인된 FC8 Chapter 8, battle-ch9.png는 승인된 FC9 Chapter 9 backdrop만 담당한다. Central 70% × 70%는 broad, dark, low-contrast field여야 하며 cell border와 creature silhouette은 그 위에서 읽혀야 한다. Chapter 2는 charcoal-indigo stone, misty valley depth, restrained jade-teal foxfire, roof-tile curl, rope, brass bell을 perimeter detail로만 사용한다. Chapter 3는 near-black navy와 charcoal-indigo stone, restrained jade-teal/cyan caustic light, dark coral, shell inlay, oxidized bronze, 용왕궁 처마를 perimeter detail로만 사용한다. Chapter 4는 near-black charcoal과 muted oxblood stone, restrained ember orange, weathered bronze, 저승관문 기와·방울·석등·사슬을 perimeter detail로만 사용한다. Chapter 5는 near-black mountain stone과 deep pine green, restrained jade와 ivory-gold dawn light, 세 봉우리·운해·한국식 석등·처마를 perimeter detail로만 사용한다. Chapter 6은 near-black obsidian과 desaturated midnight indigo, restrained cold silver-blue와 aged bronze, 먼 빈 왕좌·한국식 처마·난간·기둥·cosmic mist를 perimeter detail로만 사용한다. Chapter 7은 rain-darkened slate와 deep storm navy, restrained pale jade·cold cyan·ivory-gold, 신성한 관문·한국식 처마·난간·cloud bridge·perimeter lightning을 edge detail로만 사용한다. Chapter 8은 near-black basalt와 charcoal slate, deep aubergine·muted oxblood·restrained cold mineral teal, dolmen-inspired lintel·curved stone eave·mineral column·abyss mist를 perimeter detail로만 사용한다. Chapter 9는 near-black ink와 smoked slate, desaturated ash-white·muted dark crimson·restrained antique silver, 끊어진 검은 옻칠 처마·한지 같은 잔해 층·bronze joinery·dim eclipsed horizon을 perimeter detail로만 사용한다. 모든 campaign chapter에 전용 backdrop이 있고, asset load 실패 시에만 shared chamber로 폴백한다.

Battle은 사전 배치의 결과를 보인다. Defender silhouette, invader path/target, room cell, existing primary control이 visible해야 한다. Decorative art가 target 또는 control이 되면 안 된다.

### 5.4 Raster asset contract

| Asset | Runtime key / scope | Exact dimensions | Byte ceiling | Calm overlay zone |
| --- | --- | ---: | ---: | --- |
| dokkaebi-lair-shaft.png | bg-dungeon-shaft, Home | 768×1280 | 512 KiB | central 55% width |
| battle-ch1.png | bg-battle-ch1, Chapter 1 only | 1024×1024 | 512 KiB | central 70% × 70% |
| battle-ch2.png | bg-battle-ch2, Chapter 2 only | 1024×1024 | 512 KiB | central 70% × 70% |
| battle-ch3.png | bg-battle-ch3, Chapter 3 only | 1024×1024 | 512 KiB | central 70% × 70% |
| battle-ch4.png | bg-battle-ch4, Chapter 4 only | 1024×1024 | 512 KiB | central 70% × 70% |
| battle-ch5.png | bg-battle-ch5, Chapter 5 only | 1024×1024 | 512 KiB | central 70% × 70% |
| battle-ch6.png | bg-battle-ch6, Chapter 6 only | 1024×1024 | 512 KiB | central 70% × 70% |
| battle-ch7.png | bg-battle-ch7, Chapter 7 only | 1024×1024 | 512 KiB | central 70% × 70% |
| battle-ch8.png | bg-battle-ch8, Chapter 8 only | 1024×1024 | 512 KiB | central 70% × 70% |
| battle-ch9.png | bg-battle-ch9, Chapter 9 only | 1024×1024 | 512 KiB | central 70% × 70% |

src/art/designAssets.test.ts는 PNG signature, exact size, 512 KiB ceiling, legacy fallback presence를 검사한다. dungeon-shaft.png와 dungeon-chamber.png는 unchanged로 보존한다.

## 6. Recommended product loop

~~~text
Home overview
  └─ readiness directive identifies one weak/blocked room
       └─ Room cutaway: slot + candidate fit + predicted delta
            ├─ Barracks: level / equipment / recommended room
            └─ Forge: craftability / missing materials / recommended bearer
                 └─ return with one changed readiness value
                      └─ Pre-battle: confirm formation
                           └─ Chapter / invasion battle
                                └─ result + reward + next shortage
                                     └─ Home overview
~~~

| Loop boundary | Existing authority | Acceptance meaning |
| --- | --- | --- |
| Diagnose | readiness directives, dungeon metrics | 하나의 primary action이 list를 열지 않아도 보인다. |
| Commit | src/data immutable transaction + saveGameState(nextState) | UI는 GameState를 in-place mutate하지 않는다. |
| Explain | RoomPicker/portrait/feedback UI | action state와 expected delta가 press 전에 보인다. |
| Verify | DungeonScene + UIScene result flow | battle이 같은 preparation language를 증명/반박한다. |
| Recover | current rewards, rooms, monsters, forge routes | result가 다음 강화 위치를 말하며 schema expansion은 없다. |

## 7. D1–D6 evidence-driven roadmap

이 roadmap은 현재 D1 overhaul을 기준으로 이후의 검증 가능한 순서를 고정한다. 각 단계는 이 문서와 `src/constants/colors.ts`, protected `navigationContract`, existing data/transaction authority 사이에 두 번째 design authority를 만들지 않는다.

### D1 — Four-zone shell and visual authority

**Objective:** `dungeon`, `legion`, `forge`, `invasion`을 네 root zone의 유일한 navigation baseline으로 고정하고, Home/Barracks/Forge/StageSelect에 shared fixed-camera shell을 적용한다. Summon/Codex/Shop/Fusion/Skill은 Legion-internal route로 유지하고 PreBattle은 invasion-internal step으로 유지한다.

**Exact scope:** `docs/MONSTER_DUNGEON_DESIGN.md`, `src/constants/colors.ts`, `src/constants/layout.ts`, protected D1 scene/UI allowlist only. `src/data/navigationContract.ts`, GameState, localStorage, schema, gameplay, assets, native shell, dependencies는 read-only authority다.

**Acceptance gates:**

- colors.ts가 runtime token authority이며 existing public keys와 semantic four-zone accents를 보존한다. Legacy brown `PANEL`/`CARD` roles are remapped through the approved charcoal-indigo stone hierarchy; state never depends on color alone.
- shared shell constants do not change battle or room-grid geometry. Changed targets are ≥44×44 logical px, core labels ≥12px, semantic secondary ≥11px, and 10px only for non-interactive telemetry.
- all four root scenes use exact navigation-contract destinations; StageSelect drag ignores fixed header and nav. Legion disclosure has ≥44px target and ≥44px rows with no new route.
- Home board/pin/command use the same existing readiness recommendation and one dominant action. Barracks, Forge, StageSelect, and PreBattle preserve existing calculations, transactions, registry handoffs, and feedback.
- no unmanaged timer/tween/listener/overlay blocker or registry key is introduced; reduced motion retains state information; disabled actions are visually and interactively disabled.
- focused shell/readiness/forge/barracks/forecast tests, full Vitest, build, diff check, real renders, lifecycle re-entry, direct-entry compatibility, protected baseline audit, and canonical post-sync verification all pass before D1 is marked complete.

**Rollback:** Revert only D1 allowlisted presentation/doc changes. Do not alter protected dirty paths, data contracts, save state, package files, native shells, or reference assets.

### D2 — Spatial dungeon and room-editor clarity

**Objective:** Make entrance, route, rooms, heart, and locked depth read as one living vertical dungeon board, while keeping room-grid geometry and existing room-detail transaction boundaries unchanged.

**Exact work:** Audit `DungeonHomeScene`, `HomeTopBar`, `HomeRoomCards`, and focused-room return. Keep target room/action pin and command directive on the same existing recommendation kind, slot, and copy. Use existing `addFramedPanel`, `addSceneHeader`, `addPrimaryActionButton`, and room helpers before adding any custom graphics.

**Acceptance gate:** 390×844 warning and ready states show one unambiguous target, no false warning, no clipping/overlap, and no direct UI mutation of `GameState`; assignment/repair/equip return paths and lifecycle cleanup remain exact.

**Risk:** Art or utility chrome can hide the route. If so, reduce decoration and restore spatial contrast before changing gameplay or data.

### D3 — Legion growth and Forge readiness

**Objective:** At first viewport, Barracks shows context → portrait/recommendation → why-now → cost/room/delta → one existing growth action; Forge shows context → tabs → target/blueprint → craftability/material deficit → readiness delta → one existing craft action.

**Exact work:** Preserve existing growth calculations, equip/craft/dismantle transactions, focused-room return, direct entry, blueprint registry, material accounting, and feedback. Use one Legion management disclosure for Codex/Summon/Fusion/Skill/Shop; add no destination.

**Acceptance gate:** default and focused-room Barracks, craftable and deficit/empty Forge, and direct Summon/Codex/Shop/Fusion smoke are legible and operable at 390×844 with no new console error.

**Risk:** Recommendation can overpromise. Label effects as current/expected deltas from existing calculations and never introduce a new progression or currency rule.

### D4 — Invasion path and battle readiness

**Objective:** StageSelect presents invasion context, frontier path, existing stage action, and fixed invasion-zone nav. PreBattle presents enemy summary, spatial defense route, exactly one canonical readiness directive, secondary forecast/edit actions, and one dominant launch CTA.

**Exact work:** Preserve `preBattleEditReturn`, `focusRoomSlotIdx`, `returnTo`, stage registry data, existing forecast data, launch destination, cancel behavior, and no global bottom bar in PreBattle. Do not fabricate resistance, enemy, or combat data.

**Acceptance gate:** StageSelect initial/frontier and PreBattle warning/ready renders have no drag-start from header/nav, no duplicated primary CTA, no control overlap, and launch remains disabled both visually and interactively when no stage exists.

**Risk:** Forecast can compete with readiness. Keep it secondary and derive all readiness text from existing `battleForecast`/readiness helpers.

### D5 — Lifecycle, accessibility, and compatibility

**Objective:** Prove that the shell remains safe under repeated entry and across old deep links.

**Exact work:** Enter and leave each representative scene three times; inspect pointer handlers, timers, tweens, scene transitions, overlay blockers, and console output. Verify reduced-motion, disabled actions, touch areas, text sizes, direct Summon/Codex/Shop/Fusion entry, and all protected registry handoffs.

**Acceptance gate:** No accumulation after three cycles; all required root-to-root and focused-room routes return to the same context; no route state enters GameState/localStorage; compatibility smoke has no new runtime or console error.

**Risk:** Cleanup fixes can change scene ownership. Prefer existing `scene`/`registry` lifecycle patterns and stop for a plan review if ownership must change.

### D6 — Evidence, release, and future content gate

**Objective:** Make D1–D5 auditable and keep later content expansion behind release-stability evidence.

**Required evidence:** worker source snapshot, route receipt, exact writable-path inventory, design authority/roadmap, focused and full test output, build output, `git diff --check`, protected dirty-baseline byte/mode audit, 390×844 renders and text/touch/console audit for Home/Barracks/Forge/StageSelect/PreBattle, lifecycle transcript, compatibility smoke, and canonical post-sync fingerprints.

**Acceptance gate:** All required evidence is current and each claim is marked pass or unverified. Missing render, console, lifecycle, or protected-baseline evidence blocks progression; a passing unit test alone is not a substitute.

**Rollback:** Preserve evidence and return to the smallest failing surface. Do not add a new asset, registry key, schema field, dependency, native sync, or content phase to hide an evidence gap.

### D7 / FC1 — Chapter 2 battle identity

**Objective:** Give the existing Chapter 2 구미호 계곡 stages a distinct, original battle environment without changing stage, wave, reward, monster, progression, or save semantics.

**Exact scope:** Add `public/assets/backgrounds/battle-ch2.png`, preload chapter 2 through the existing `BATTLE_BG_CHAPTERS` list, extend the existing design-asset contract, and align the two asset guides with this document. `DungeonLayout` fallback behavior, Chapters 1 and 3–9, combat/data registries, dependencies, native shells, and all transaction/save paths remain unchanged.

**Acceptance gate:** The PNG is exactly 1024×1024 and at most 512 KiB; it contains no text, UI, watermark, character, or creature; its central 70% × 70% remains calm and low-contrast. Chapter 2 uses `bg-battle-ch2`, Chapter 1 retains `bg-battle-ch1`, and Chapter 3 retains `bg-dungeon-chamber`. Asset/focused/full tests, build, `git diff --check`, 390×844 WebGL render, network/console audit, reduced-motion state, and three-entry lifecycle evidence all pass.

**Rollback:** Remove `battle-ch2.png`, remove `2` from `BATTLE_BG_CHAPTERS`, and remove the coupled asset-contract/doc rows. The existing chamber fallback resumes automatically; no save migration or data rollback is required.

### D8 / FC2 — Chapter 3 water-cell integrity

**Objective:** Make every authored Chapter 3 water blocker reachable on the shipped 4-column × 3-row mobile battle grid before adding more visual content.

**Evidence and decision:** `GRID_ROWS` is fixed at 3 and `buildDungeonGrid()` visits only `row 0..2`, so a four-column stage accepts flat indices `0..11`. Stages 24–32 contained 13 references in `12..15` that never rendered. FC2 keeps the existing 4×3 geometry and explicitly remaps those entries into `0..11`, preserving per-stage water-cell counts `[1, 1, 2, 2, 3, 3, 3, 4, 5, 5, 5, 6]`. A 4×4 runtime expansion is rejected because it would change touch geometry, pathing, capacity, layout, and balance beyond this repair.

**Exact scope:** Change only the nine affected arrays in `stagesChapter3.ts`, add registry-wide integer/uniqueness/bounds coverage plus the exact Chapter 3 layouts in `stages.test.ts`, and record this contract here. Do not add runtime clamping that hides invalid registry data.

**Acceptance gate:** All 90 stages satisfy `0 <= waterCell < (gridCols ?? GRID_COLS) * GRID_ROWS` with integer, unique entries. Stages 24, 29, and 32 render exactly 2, 5, and 6 visible water rooms at 390×844 without control overlap. Focused stage tests, full tests, production build, `git diff --check`, and exact three-path/protected-baseline audit pass.

**Risk and rollback:** Making previously unreachable blockers visible increases placement pressure in affected Chapter 3 stages. Verify early/mid/boss representatives without changing waves, rewards, HP, starting gold, monster/invader stats, progression, save/schema, navigation, dependencies, native shells, or art. Roll back the nine arrays, coupled tests, and this D8 block; no save migration is required.

### D9 / FC3 — Chapter 3 battle identity

**Objective:** Give the corrected Chapter 3 용왕 해저궁 stages an original, immediately distinct underwater-palace battle field without changing placement, combat, progression, or save semantics.

**Evidence and decision:** The FC2 390×844 playtest confirms stages 24, 29, and 32 render their exact corrected water rooms and keep the 270×60 defense control inside the canvas under WebGL/DPR2/reduced motion. FC3 therefore changes only the visual backdrop. The asset uses a project-specific, non-referential generation prompt: dark Korean folk-craft underwater royal courtyard, calm central field, perimeter-only palace eaves/coral/bronze/shell detail, and explicit exclusions for named works, characters, creatures, text, UI, logos, watermarks, and baked grid cells. The selected output is resized to 1024×1024 and palette-optimized below the mobile byte ceiling without changing composition.

**Exact scope:** Add `public/assets/backgrounds/battle-ch3.png`, add chapter `3` to the existing `BATTLE_BG_CHAPTERS` preload list, extend the existing asset contract, and align the two asset guides plus this document. Chapters 1–2 retain their own assets; Chapters 4–9 retain `bg-dungeon-chamber`. Stage/wave/reward/HP/gold, room/grid geometry, water cells, monster/invader data, progression, save/schema, route, dependency, native shell, and store metadata remain unchanged.

**Acceptance gate:** The PNG is exactly 1024×1024 and at most 512 KiB, contains no text/UI/logo/watermark/character/creature, and keeps its central 70% × 70% calm enough for the 4×3 board. Stages 24, 29, and 32 use `bg-battle-ch3`; Chapter 1 retains `bg-battle-ch1`, Chapter 2 retains `bg-battle-ch2`, and Chapter 4 retains `bg-dungeon-chamber`. Asset/focused/full tests, production build, `git diff --check`, exact six-path/protected-baseline audit, 390×844 WebGL render, network/console audit, reduced-motion state, defense-control reachability, and three-entry lifecycle evidence all pass.

**Risk and rollback:** Cyan highlights or perimeter detail can compete with room silhouettes after mobile scaling; render early/mid/boss layouts before close-out and reject the asset if the center reads as an interactive grid. Roll back by removing `battle-ch3.png`, removing `3` from `BATTLE_BG_CHAPTERS`, and removing the coupled asset-contract/doc rows. The shared chamber fallback resumes automatically; no data or save migration is required.

### D10 / FC4 — Chapter 4 battle identity after real-time combat gate

**Objective:** Close the Chapter 3 runtime release gate, then give the existing Chapter 4 저승관문 stages an original battle field without changing balance, progression, or save semantics.

**Evidence and decision:** A real wall-clock Stage 24 fail-fast initially cleared Wave 1 after only `1/7` configured invaders because `processSpawnQueue()` erased timer-scheduled items immediately and `checkWaveEnd()` could not see pending spawns. Keeping each item queued until its timer fires and checking pending work before both clear guards restores `configured = kills + breakthroughs`. The first consecutive Stage 24→29 run then exposed doubled kill listeners (`18/9`) because the reused `DungeonScene` class cleanup method was not bound to Phaser's `SHUTDOWN` event. Binding it once per activation removes listeners, timers, and overlays before restart. The final Stage 24→29→32 wall-clock run completed all 30 waves with exact accounting, full HP, Clock/Tweens at 1×, combat `speedMult=3`, and no console/runtime/network error. FC4 therefore proceeds as an additive visual slice.

**Exact scope:** Preserve pending spawns in `SpawnPipeline`, gate wave clear on that pending queue, expose the queue through the existing lifecycle context, bind existing `DungeonScene.shutdown()` cleanup on every activation, and add the pending-spawn regression test. Add `public/assets/backgrounds/battle-ch4.png`, add chapter `4` to `BATTLE_BG_CHAPTERS`, extend the design-asset contract, and align both asset guides plus this document. Stage/wave/reward/HP/gold, room/grid geometry, monster/invader data, progression, save/schema, routes, dependencies, native shells, and store metadata remain unchanged. Chapters 1–3 retain their own assets; Chapters 5–9 retain `bg-dungeon-chamber`.

**Acceptance gate:** The final consecutive Stage 24/29/32 run completes 30/30 real-time waves with exact enemy accounting and no lifecycle accumulation. The Chapter 4 PNG is exactly 1024×1024 and at most 512 KiB, contains no text/UI/logo/watermark/character/creature, and keeps its central 70% × 70% calm enough for the 4×3 board. Stages 33, 37, and 42 use `bg-battle-ch4`; Chapters 1–3 retain their chapter assets; Chapter 5 retains `bg-dungeon-chamber`. Focused/full tests, production build, `git diff --check`, exact changed-path/protected-baseline audit, 390×844 WebGL render, network/console audit, reduced-motion state, defense-control reachability, and three-entry lifecycle evidence all pass.

**Risk and rollback:** Pending timers must not leak into a later wave, and ember perimeter detail must not read as a target or obscure room silhouettes after mobile scaling. Roll back combat files together if the accounting invariant regresses. Roll back the visual slice by removing `battle-ch4.png`, removing `4` from `BATTLE_BG_CHAPTERS`, and removing its coupled contract/doc rows; the shared chamber fallback resumes without save migration.

### D11 / FC5 — Chapter 5 battle identity after dynamic-spawn accounting gate

**Objective:** Close the Chapter 4 runtime release gate, then give the existing Chapter 5 삼신산 stages an original battle field without changing balance, progression, or save semantics.

**Evidence and decision:** The first Stage 33 wall-clock attempt timed out because the isolated headless WebGL page was background-throttled to 1.13 FPS while Phaser clamped timer delta to 16.67 ms; foregrounding the page and disabling background throttling restored 55+ FPS and 10–14 second regular waves without a source change. The corrected Stage 33→37→42 run then exposed a real counter contract defect on Stage 42 Wave 10: `death_emissary` intentionally summons a `ghost_add`, but the HUD denominator remained the static configured total and displayed `10 / 9`. Every runtime summon already enters through `DungeonScene.spawnInvader()`, so that single boundary now increments `waveInvaderTotal` and refreshes the kill-counter denominator through a pure tested helper. The final consecutive run completed 30/30 waves with exact runtime accounting; the boss wave recorded static 9 + dynamic 1 = 10/10, final HP 3100/3500, Clock/Tweens at 1×, combat `speedMult=3`, WebGLRenderer2, and no console/runtime/network error. FC5 therefore proceeds as an additive visual slice.

**Exact scope:** Add pure dynamic-spawn accounting and call it only from the existing runtime summon boundary, plus its regression test. Add `public/assets/backgrounds/battle-ch5.png`, add chapter `5` to `BATTLE_BG_CHAPTERS`, extend the design-asset contract, and align both asset guides plus this document. Stage/wave/reward/HP/gold, room/grid geometry, monster/invader stats and behaviors, progression, save/schema, routes, dependencies, native shells, and store metadata remain unchanged. Chapters 1–4 retain their own assets; Chapters 6–9 retain `bg-dungeon-chamber`.

**Acceptance gate:** The final consecutive Stage 33/37/42 run completes 30/30 real-time waves with runtime totals equal to kills + breakthroughs and no lifecycle accumulation. The Chapter 5 PNG is exactly 1024×1024 and at most 512 KiB, contains no text/UI/logo/watermark/character/creature, and keeps its central 70% × 70% calm enough for the 4×3 board. Stages 43, 47, and 52 use `bg-battle-ch5`; Chapters 1–4 retain their chapter assets; Chapter 6 retains `bg-dungeon-chamber`. Focused/full tests, production build, `git diff --check`, exact changed-path/protected-baseline audit, 390×844 WebGL render, network/console audit, reduced-motion state, defense-control reachability, and three-entry lifecycle evidence all pass.

**Risk and rollback:** A dynamic spawn must increment the runtime denominator exactly once, while static queue spawns must not. The pale cloud horizon must not reduce top-row readability after mobile scaling. Roll back accounting by removing the helper call and regression test together. Roll back the visual slice by removing `battle-ch5.png`, removing `5` from `BATTLE_BG_CHAPTERS`, and removing its coupled contract/doc rows; the shared chamber fallback resumes without save migration.

### D12 / FC6 — Chapter 6 battle identity after 35-wave Chapter 5 gate

**Objective:** Close the Chapter 5 runtime release gate, then give the existing Chapter 6 영원의 왕좌 stages an original battle field without changing balance, progression, or save semantics.

**Evidence and decision:** A consecutive real wall-clock Stage 43→47→52 run completed all 35/35 waves with runtime totals equal to kills + breakthroughs. Stages 43 and 47 retained full HP at 4000/4000 and 4400/4400. Stage 52 completed 15/15 waves at 4600/5000 HP; Wave 10 recorded configured 8 + one runtime summon = 9/9. Clock/Tweens remained at 1×, combat `speedMult=3`, the renderer was WebGLRenderer2 at DPR 2 with reduced motion, and console/runtime/network errors were all zero. No new source defect was found, so FC6 proceeds as an additive visual slice only.

**Exact scope:** Add `public/assets/backgrounds/battle-ch6.png`, add chapter `6` to `BATTLE_BG_CHAPTERS`, extend the design-asset contract, and align both asset guides plus this document. Combat lifecycle and accounting code remain unchanged. Stage/wave/reward/HP/gold, room/grid geometry, monster/invader stats and behaviors, progression, save/schema, routes, dependencies, native shells, and store metadata remain unchanged. Chapters 1–5 retain their own assets; Chapters 7–9 retain `bg-dungeon-chamber`.

**Acceptance gate:** The final consecutive Stage 43/47/52 run completes 35/35 real-time waves with runtime totals equal to kills + breakthroughs and no lifecycle accumulation. The Chapter 6 PNG is exactly 1024×1024 and at most 512 KiB, contains no text/UI/logo/watermark/character/creature, and keeps its central 70% × 70% calm enough for the 4×3 board. Stages 53, 57, and 62 use `bg-battle-ch6`; Chapters 1–5 retain their chapter assets; Chapter 7 Stage 63 retains `bg-dungeon-chamber`. Focused/full tests, production build, `git diff --check`, exact changed-path/protected-baseline audit, 390×844 WebGL render, network/console audit, reduced-motion state, defense-control reachability, and three-entry lifecycle evidence all pass.

**Risk and rollback:** The circular perimeter must remain environmental architecture rather than read as an interactive target, while the dark indigo field must preserve room and invader silhouettes. Roll back the visual slice by removing `battle-ch6.png`, removing `6` from `BATTLE_BG_CHAPTERS`, and removing its coupled contract/doc rows; the shared chamber fallback resumes without save migration.

### D13 / FC7 — Chapter 7 battle identity after dynamic-heavy Chapter 6 gate

**Objective:** Close the Chapter 6 runtime release gate, then give the existing Chapter 7 신계 침공 stages an original battle field without changing balance, progression, or save semantics.

**Evidence and decision:** A consecutive real wall-clock Stage 53→57→62 run completed all 35/35 waves with runtime totals equal to kills + breakthroughs. Stage 53 finished at 4767/5000 HP, Stage 57 at 5010/5400, and Stage 62 completed 15/15 waves at 5355/6000. Eight dynamic-summon waves remained exact; the final Stage 62 Wave 15 recorded configured 8 + two runtime summons = 10/10. Clock/Tweens remained at 1×, combat `speedMult=3`, the renderer was WebGLRenderer2 at DPR 2 with reduced motion, and console/runtime/network errors were all zero. No new source defect was found, so FC7 proceeds as an additive visual slice only.

**Exact scope:** Add `public/assets/backgrounds/battle-ch7.png`, add chapter `7` to `BATTLE_BG_CHAPTERS`, extend the design-asset contract, and align both asset guides plus this document. Combat lifecycle and accounting code remain unchanged. Stage/wave/reward/HP/gold, room/grid geometry, monster/invader stats and behaviors, progression, save/schema, routes, dependencies, native shells, and store metadata remain unchanged. Chapters 1–6 retain their own assets; Chapters 8–9 retain `bg-dungeon-chamber`.

**Acceptance gate:** The final consecutive Stage 53/57/62 run completes 35/35 real-time waves with runtime totals equal to kills + breakthroughs and no lifecycle accumulation. The Chapter 7 PNG is exactly 1024×1024 and at most 512 KiB, contains no text/UI/logo/watermark/character/creature, and keeps its central 70% × 70% calm enough for the 4×3 board. Stages 63, 67, and 72 use `bg-battle-ch7`; Chapters 1–6 retain their chapter assets; Chapter 8 Stage 73 retains `bg-dungeon-chamber`. Focused/full tests, production build, `git diff --check`, exact changed-path/protected-baseline audit, 390×844 WebGL render, network/console audit, reduced-motion state, defense-control reachability, and three-entry lifecycle evidence all pass.

**Risk and rollback:** The wet stone highlight and perimeter lightning must not reduce room or invader silhouette contrast, and the gate must remain scenery rather than read as a control. Roll back the visual slice by removing `battle-ch7.png`, removing `7` from `BATTLE_BG_CHAPTERS`, and removing its coupled contract/doc rows; the shared chamber fallback resumes without save migration.

### D14 / FC8 — Chapter 8 battle identity after Chapter 7 boss-wave gate

**Objective:** Close the Chapter 7 runtime release gate, then give the existing Chapter 8 원초의 심연 stages an original battle field without changing balance, progression, or save semantics.

**Evidence and decision:** A consecutive real wall-clock Stage 63→67→72 run completed all 35/35 waves with runtime totals equal to kills + breakthroughs. Stage 63 finished at 5988/6500 HP, Stage 67 retained 7100/7100 HP, and Stage 72 completed 15/15 waves at 6559/8000 HP. Stage 72 Wave 15 recorded configured 4 + four runtime summons = 8, with 7 kills + 1 breakthrough = 8/8. Clock/Tweens remained at 1×, combat `speedMult=3`, the renderer was WebGLRenderer2 at DPR 2 with reduced motion, and console/runtime/network errors were all zero. No new source defect was found, so FC8 proceeds as an additive visual slice only.

**Exact scope:** Add `public/assets/backgrounds/battle-ch8.png`, add chapter `8` to `BATTLE_BG_CHAPTERS`, extend the design-asset contract, and align both asset guides plus this document. Combat lifecycle and accounting code remain unchanged. Stage/wave/reward/HP/gold, room/grid geometry, monster/invader stats and behaviors, progression, save/schema, routes, dependencies, native shells, and store metadata remain unchanged. Chapters 1–7 retain their own assets; Chapter 9 retains `bg-dungeon-chamber`.

**Acceptance gate:** The final consecutive Stage 63/67/72 run completes 35/35 real-time waves with runtime totals equal to kills + breakthroughs and no lifecycle accumulation. The Chapter 8 PNG is exactly 1024×1024 and at most 512 KiB, contains no text/UI/logo/watermark/character/creature, and keeps its central 70% × 70% calm enough for the 4×3 board. Stages 73, 77, and 80 use `bg-battle-ch8`; Chapters 1–7 retain their chapter assets; Chapter 9 Stage 81 retains `bg-dungeon-chamber`. Focused/full tests, production build, `git diff --check`, exact changed-path/protected-baseline audit, 390×844 WebGL render, network/console audit, reduced-motion state, defense-control reachability, and three-entry lifecycle evidence all pass.

**Risk and rollback:** The basalt cracks and perimeter mineral glow must not read as a path, target, or control, while the very dark field must preserve room and invader silhouettes. Roll back the visual slice by removing `battle-ch8.png`, removing `8` from `BATTLE_BG_CHAPTERS`, and removing its coupled contract/doc rows; the shared chamber fallback resumes without save migration.

### D15 / FC9 — Chapter 9 battle identity after Chapter 8 progression gate

**Objective:** Close the Chapter 8 runtime release gate, then give the existing Chapter 9 공허 너머 stages an original final-campaign battle field without changing balance, progression, or save semantics.

**Evidence and decision:** An inherited level-20 diagnostic fixture completed Stage 73 and 77 but was defeated at Stage 80 Wave 14; the final wave still recorded 10 kills + 12 breakthroughs = 22/22 configured spawns, with zero console/runtime/network errors. Source progression supports monster levels through 50, milestone achievements at Dungeon Master levels 25 and 30, Home readiness guidance near the current Dungeon Master level, and repeated Chapter 8 upgrade directives, so level 20 under-represented the late-Chapter 8 state. The representative level-30 fixture kept the same nine level-3 rooms and added no equipment or traps, then completed the consecutive real wall-clock Stage 73→77→80 run at 37/37 waves: 8500/8500, 7180/9400, and 285/11000 HP. Every wave matched configured/runtime spawns to kills + breakthroughs; renderer was WebGLRenderer2 at DPR 2 with reduced motion, and console/runtime/network errors were all zero. No production combat defect was found, so FC9 proceeds as an additive visual slice only.

**Exact scope:** Add `public/assets/backgrounds/battle-ch9.png`, add chapter `9` to `BATTLE_BG_CHAPTERS`, extend the design-asset contract, and align both asset guides plus this document. Combat lifecycle and accounting code remain unchanged. Stage/wave/reward/HP/gold, room/grid geometry, monster/invader stats and behaviors, progression, save/schema, routes, dependencies, native shells, and store metadata remain unchanged. Chapters 1–8 retain their own assets.

**Acceptance gate:** The final consecutive Stage 73/77/80 run completes 37/37 real-time waves with runtime totals equal to kills + breakthroughs and no lifecycle accumulation. The Chapter 9 PNG is exactly 1024×1024, opaque, and at most 512 KiB; it contains no text/UI/logo/watermark/character/creature and keeps its central 70% × 70% calm enough for the 4×3 board. Stages 81, 85, and 90 use `bg-battle-ch9`, while Stage 80 retains `bg-battle-ch8`. Focused/full tests, production build, `git diff --check`, exact changed-path/protected-baseline audit, 390×844 WebGL renders, network/console audit, reduced-motion state, defense-control reachability, and four-entry texture-selection evidence all pass.

**Risk and rollback:** The eclipsed horizon and pale torn-paper perimeter must remain scenery rather than read as a target or lane, while the matte field must preserve room and invader silhouettes. Roll back the visual slice by removing `battle-ch9.png`, removing `9` from `BATTLE_BG_CHAPTERS`, and removing its coupled contract/doc rows; the shared chamber fallback resumes without save migration.

### D16 / FC10 — Chapter 9 completion close-out after full-capacity runtime gate

**Objective:** Close the final Chapter 9 combat and completion route with a progression-valid endgame defense, then make first-clear and repeat-clear rewards truthful and operable without changing balance, progression, save schema, or New Game+ semantics.

**Evidence and decision:** Two diagnostic Stage 90 runs separated fixture failure from production failure. A level-30 roster with nine level-5 rooms but only one monster per room was defeated at Wave 13; all processed enemies still matched runtime accounting. The repository contract allows 50 distinct monsters across the nine room capacities, nine equipped primaries, and 28 legal traps, so the official isolated endgame fixture filled those existing slots without stat injection. The consecutive real wall-clock Stage 81→85→90 run then completed 35/35 waves at full HP, with every configured/runtime total equal to kills + breakthroughs, WebGLRenderer2 at DPR 2/reduced motion, and zero console/runtime/network errors. First clear persisted `+5` stage reward, `+1500` MQ-047 reward, and the once-only `+50` completion reward (`+1555` total), advanced to EQ-001, recorded Stage 90, and opened `game_complete`. Repeat clear persisted only `+5`, but the summary hard-coded `+50` and paused its scene before its tweens/input could run. Binding the summary to `completionResult.soulCrystalBonus`, keeping the scene live, and adding a full-screen input blocker makes the repeat result visible, operable, and truthful at `+0`. Actual pointer input completed Cinematic SKIP → Stage Select → Home → New Game+ modal; `시작하기` was not invoked, so prestige and Stage 90 progress remained unchanged.

**Exact scope:** Change only `GameCompleteFlow.ts`, its focused regression test, and this decision contract. Preserve all Stage 81–90 wave/reward/HP/gold data, room and monster capacity rules, quest rewards, `applyGameCompletionReward`, cinematic data, Stage Select/Home navigation, prestige transactions, save shape, dependencies, native shells, assets, and store metadata. No balance reduction is justified by the under-filled diagnostic fixtures.

**Acceptance gate:** The isolated full-capacity Stage 81/85/90 run completes 35/35 real-time waves with exact accounting and no runtime errors. First clear produces the exact `5 + 1500 + 50 = 1555` crystal delta, Stage 90 progress, EQ-001, and `game_complete`; repeat clear produces a persisted `+5` stage delta and displays `+0` completion bonus. Its summary must render after animation, block underlying battle input, and keep Stage Select/Home buttons actionable. Cinematic → Stage Select → Home → New Game+ modal must be reachable by pointer without confirming prestige. Focused/full tests, production build, `git diff --check`, exact-path canonical sync, 390×844 screenshots, and console/runtime/network audits all pass.

**Risk and rollback:** A live result scene must not leak pointer events to the underlying battle UI; retain the full-screen blocker and keep result actions at higher depth. Roll back `GameCompleteFlow.ts` and its regression test together if overlay ownership changes. No save migration, reward rollback, or content-data rollback is required.

### D17 / FC11 — New Game+ confirmation lifecycle close-out

**Objective:** Close the existing New Game+ confirmation, persistence, restart, and permanent-damage lifecycle without changing prestige reset policy, balance, save schema, or post-campaign content.

**Evidence and decision:** Existing prestige transaction and wisdom tests passed 89/89 before mutation, so the established reset/preserve contract remained authoritative. An isolated 390×844 pointer run reproduced a presentation-layer defect: tapping the Home New Game+ coordinate while the modal was open increased the modal title count from one to two because the visual dim did not own input. Adding one full-screen interactive zone as the modal container's bottom child changes that count to one-to-one while leaving both action buttons above it. The post-fix run then closed via Cancel, reopened, confirmed prestige, persisted level 1, reset Stage 6/gold/main-quest/run records, preserved DM/currency/wisdom/collection/meta records, restarted Home, and loaded `1.1×` in `DungeonScene`. Console, runtime, and network failure lists were empty. Home legitimately assigns a fresh pair of sub-quests after the prestige reset; the old sentinel quests do not survive.

**Exact scope:** Change only `PrestigeModal.ts`, its focused regression test, and this decision contract. Preserve `startPrestige`, `applyPrestigeStart`, every existing reset/preserve field, the 10%-per-level multiplier, save key/shape, quest and daily lifecycle initialization, combat/content/balance data, dependencies, native shells, assets, and store metadata.

**Acceptance gate:** Before the fix, the isolated repeated New Game+ pointer path must reproduce one-to-two modal stacking. After the fix it must remain one-to-one, Cancel must leave zero modals, and Confirm must save before the Home restart callback. Persisted state must match the established reset/preserve contract, and the next `DungeonScene` must load a `1.1×` multiplier at prestige level 1. Focused/full tests, production build, `git diff --check`, exact-path canonical sync, 390×844 screenshots, and console/runtime/network audits all pass.

**Risk and rollback:** The blocker must remain the first modal child so action zones rendered later retain priority while Home controls cannot receive input. Roll back `PrestigeModal.ts` and its focused test together if modal ownership moves to a shared overlay manager. No save migration, balance rollback, or player-data rewrite is required.

### D18 / FC12 — Persistent prestige status without Home control collision

**Objective:** Keep the earned prestige level visible throughout the next Home run while preserving the existing 44px quest, settings, and New Game+ controls on the 390×844 top bar.

**Evidence and decision:** The isolated pre-fix audit found zero prestige badges when `prestigeLevel=1` and `gameCompleted=false`. In the completed state the badge appeared only inside the New Game+ branch, and its runtime text bounds at `x=241..269` intersected the settings/New Game+ action zones. The smallest stable placement is a compact 52×20 status attached to the DM seal at `x=2..54`, outside the right-side control cluster. Post-fix new-run and completed states each contain exactly one badge; runtime text bounds are `x=15..41`, neither state intersects an action zone, and pointer input at the unchanged New Game+ coordinate opens exactly one modal. Console, runtime, and network failure lists remain empty.

**Exact scope:** Change only `HomeTopBar.ts`, the existing `buildPrestigeBadge` presentation in `PrestigeModal.ts`, focused tests for both components, and this decision contract. Preserve prestige arithmetic and transactions, save/schema, all quest/settings/New Game+ zone coordinates and callbacks, currencies, DM/XP values, theme/content/balance data, dependencies, native shells, assets, and store metadata.

**Acceptance gate:** Prestige level zero renders no badge. Any positive prestige level renders exactly one compact badge at the DM seal anchor whether the campaign is complete or a new run is active. Its frame stays within `x=2..54` at the 64px Home header and does not intersect any top-bar action zone. Completed-state pointer input still opens one New Game+ modal. Focused/full tests, production build, `git diff --check`, exact-path canonical sync, 390×844 screenshots, and console/runtime/network audits all pass.

**Risk and rollback:** The badge must remain non-interactive and below the 10px core-text minimum is forbidden; its high visual depth may cover only the decorative avatar/torch edge, never XP or controls. Roll back the Home anchor and compact badge dimensions together if the top-bar shell is redesigned. No save migration or gameplay rollback is required.

### D19 / FC13 — Prestige combat feedback at the launch decision

**Objective:** Connect the permanent prestige damage reward to the existing pre-battle launch decision without changing combat arithmetic, forecast coverage, balance, or save data.

**Evidence and decision:** `DungeonScene` already loads `getPrestigeDmgMult(state)` and `CombatResolver` multiplies every normal room attack by that value. The isolated pre-fix 390×844 run at prestige level 1 rendered zero prestige combat messages. The smallest truthful presentation is one non-interactive 10px gold status line in the unused bottom 33px of the existing launch command panel. It calls the same production multiplier helper and states both the derived bonus and applied multiplier: `👑 명성 Lv.1 · 공격 피해 +10% · 전투 배율 ×1.1`. Post-fix runtime renders exactly one line within the viewport, with no launch/forecast action overlap and no console, runtime, or network error.

**Exact scope:** Change only `PreBattleShared.ts`, its focused test, `PreBattleScene.ts`, and this decision contract. Preserve `getPrestigeDmgMult`, `DungeonScene` and `CombatResolver` arithmetic, deterministic forecast exclusions, every command/action coordinate and callback, prestige transaction/reset policy, save/schema, content/balance data, dependencies, native shells, assets, and store metadata.

**Acceptance gate:** Prestige level zero produces no pre-battle bonus copy. Positive prestige uses the production multiplier and reports matching level, percentage, and multiplier values. At 390×844 the status renders exactly once, remains non-interactive and unclipped, and does not intersect the forecast or launch actions. Focused/full tests, production build, exact-path canonical sync, `git diff --check`, screenshot inspection, and console/runtime/network audits all pass.

**Risk and rollback:** The line must remain secondary to the launch CTA and fit inside the command panel; do not expand the panel or move controls to accommodate it. Roll back the formatter, its test, and the scene line together if the command panel is redesigned. No save migration, balance rollback, or player-data rewrite is required.

## 8. Alternatives and tradeoffs

| Option | Benefit | Cost / decision |
| --- | --- | --- |
| **Recommended: additive presentation layer** | Existing registry, data transaction, scene, mobile contract를 활용한다. Smallest reversible blast radius다. | 즉시 모든 화면을 새 game처럼 만들지는 않는다. Phased evidence가 필요하다. |
| Bespoke drag-and-drop room board | 강한 spatial fantasy를 준다. | touch ergonomics, transaction divergence, accessibility, mobile QA risk가 커서 D2 evidence 전에는 defer한다. |
| New meta-progression/run system | Long-term loop를 깊게 할 수 있다. | save schema, balance, reward, economy decision이 필요하므로 이 slice에서는 forbidden이다. |
| Reference-game reskin | 빠른 visual coherence처럼 보일 수 있다. | Originality를 위반하고 이 프로젝트 readiness loop를 해결하지 못하므로 reject한다. |

Reusable principle: **기존 game loop 안에서 다음 decision을 먼저 보이게 하고, 그 다음에 system이나 ornament를 추가한다.**

## 9. Verification contract

### Required evidence per material claim

| Claim | Target state | Evidence | Limitation |
| --- | --- | --- | --- |
| Registry는 inherited metadata를 identity로 해석하지 않는다 | unknown + constructor/toString/__proto__ | focused Vitest test | future registry content는 consistency test가 계속 유지되어야 한다. |
| Disabled portrait는 visual hierarchy가 일관된다 | assigned/current RoomPicker candidate | focused alpha regression + 390×844 screenshot | exact visual contrast는 human render review가 필요하다. |
| Home은 usable board다 | 390×844 Home | screenshot, action pin/CTA interaction, console capture | tablet/landscape는 이 slice 범위 밖이다. |
| Chapter 1은 usable battle field다 | 390×844 Chapter 1 battle | screenshot, primary control interaction, console capture | Chapters 2–9는 승인된 per-chapter asset을 유지한다. |
| Chapter 2는 distinct but safe battle field다 | 390×844 Chapter 2 stage 11 | screenshot, texture selection, network/console capture, lifecycle transcript | Chapters 3–9는 승인된 per-chapter asset을 유지한다. |
| Chapter 3 water blockers는 runtime grid 안에 있다 | all 90 stage registries + stages 24/29/32 | bounds/uniqueness tests, exact-layout regression, 390×844 visible-room audit | placement pressure는 기존 accidental runtime보다 높아진다. |
| Chapter 3는 distinct but safe battle field다 | 390×844 Chapter 3 stages 24/29/32 | screenshot, texture selection, defense-control reachability, network/console capture, lifecycle transcript | Chapters 4–9는 승인된 per-chapter asset을 유지한다. |
| Chapter 4는 distinct but safe battle field다 | 390×844 Chapter 4 stages 33/37/42 | screenshot, texture selection, defense-control reachability, network/console capture, lifecycle transcript | Chapters 5–9는 승인된 per-chapter asset을 유지한다. |
| Chapter 5는 distinct but safe battle field다 | 390×844 Chapter 5 stages 43/47/52 | screenshot, texture selection, defense-control reachability, network/console capture, lifecycle transcript | Chapters 6–9는 승인된 per-chapter asset을 유지한다. |
| Chapter 6는 distinct but safe battle field다 | 390×844 Chapter 6 stages 53/57/62 | screenshot, texture selection, defense-control reachability, network/console capture, lifecycle transcript | Chapters 7–9는 승인된 per-chapter asset을 유지한다. |
| Chapter 7은 distinct but safe battle field다 | 390×844 Chapter 7 stages 63/67/72 | screenshot, texture selection, defense-control reachability, network/console capture, lifecycle transcript | Chapters 8–9는 승인된 per-chapter asset을 유지한다. |
| Chapter 8은 distinct but safe battle field다 | 390×844 Chapter 8 stages 73/77/80 | screenshot, texture selection, defense-control reachability, network/console capture, lifecycle transcript | Chapter 9는 separate FC9 asset을 사용하며 Chapter 8 asset과 격리된다. |
| Chapter 9는 distinct but safe final battle field다 | 390×844 Chapter 9 stages 81/85/90 | screenshot, texture selection, defense-control reachability, network/console capture | Stage 80의 Chapter 8 asset을 보존하며 campaign 이후 확장은 이 contract 밖이다. |
| Chapter 9 completion은 truthful and reachable하다 | Stage 90 first/repeat clear + completion route | 35-wave transcript, reward-state audit, repeat-summary screenshot, pointer route, focused regression | New Game+ modal reachability까지만 검증하며 prestige confirm/reset은 수행하지 않는다. |
| New Game+ confirm은 modal-isolated and transactional하다 | modal repeat/cancel/confirm + post-prestige DungeonScene | pre/post pointer count, persisted state audit, focused regression, damage-multiplier runtime read | 기존 reset/preserve field 정책만 검증하며 새 campaign content나 schema는 정의하지 않는다. |
| Prestige status는 새 run에서도 visible and non-blocking하다 | prestige 0/1+ Home top bar + completed NG+ route | pre/post badge count/bounds, action-zone overlap audit, 390×844 screenshots, pointer route | status presentation만 다루며 prestige 효과나 progression 정책은 변경하지 않는다. |
| Prestige damage reward는 launch 전에 truthful하다 | prestige 0/1+ PreBattle command panel | focused formatter regression, production calculation trace, 390×844 bounds/overlap screenshot, console audit | deterministic forecast 계산에는 기존처럼 prestige·장비·스킬 등 runtime modifier를 포함하지 않는다. |
| Asset은 safe하다 | ten project-bound PNGs | dimension, byte size, asset test, visual review | automatic test는 provenance/cultural judgment를 대체하지 않는다. |

### Commands

~~~bash
npx vitest run src/data/monsterVisualIdentity.test.ts src/art/designAssets.test.ts src/combat/spawnPipeline.test.ts src/combat/GameCompleteFlow.test.ts src/ui/HomeTopBar.test.ts src/ui/PrestigeModal.test.ts src/ui/PreBattleShared.test.ts src/data/prestigeTransactions.test.ts src/data/storyTransactions.test.ts
npx vitest run src/data/stages.test.ts
npm test
npm run build
git diff --check
git status --short --branch
~~~

UI smoke는 real Vite surface 390×844를 사용한다. Source inspection과 unit test는 screenshot, primary-control, console evidence를 대체하지 않는다.

## 10. Exact next actions

1. D1 evidence review를 마친다: 네 root zone route receipt와 Home/Barracks/Forge/StageSelect/PreBattle의 390×844 states, text/touch audit, console result를 기록한다.
2. D1 focused/full test와 build가 통과하면 D2에서 Home spatial board와 focused-room return만 inspect한다. 새 readiness/data mapping 전 pure test를 고정한다.
3. D2–D4에서 hierarchy가 즉시 readable하지 않으면 existing primitive/pin treatment 하나만 바꾸고 re-render한다. New resource, timer, save field, route를 추가하지 않는다.
4. D5 전에 all root/deep-link paths와 three-cycle scene cleanup을 확인하고, route state가 GameState/localStorage로 새어 나가지 않는지 audit한다.
5. D6 evidence가 완전할 때만 future content를 검토한다. reward, cost, progression, save, balance, native, asset에 닿으면 별도 decision brief와 approval gate를 먼저 만든다.
6. 승인된 FC1은 Chapter 2 battle identity만 구현한다. Chapter 3–9 art, portrait batch, reward/balance/save/native 확장은 새 decision brief 전까지 시작하지 않는다.
7. 승인된 FC2는 Chapter 3의 unreachable water-cell data만 4×3 runtime contract로 교정한다. Grid geometry와 stage wave/reward/HP/gold는 바꾸지 않는다.
8. 승인된 FC3는 Chapter 3 battle backdrop만 구현한다. Chapter 4–9 art와 balance/save/native 확장은 새 decision brief 전까지 시작하지 않는다.
9. 승인된 FC4는 real-time combat lifecycle gate를 닫고 Chapter 4 battle backdrop만 구현한다. Chapter 5–9 art와 balance/save/native 확장은 새 decision brief 전까지 시작하지 않는다.
10. 승인된 FC5는 dynamic summon accounting gate를 닫고 Chapter 5 battle backdrop만 구현한다. Chapter 6–9 art와 balance/save/native 확장은 새 decision brief 전까지 시작하지 않는다.
11. 승인된 FC6는 Chapter 5 real-time 35-wave gate를 닫고 Chapter 6 battle backdrop만 구현한다. Chapter 7–9 art와 balance/save/native 확장은 새 decision brief 전까지 시작하지 않는다.
12. 승인된 FC7은 Chapter 6 dynamic-heavy real-time 35-wave gate를 닫고 Chapter 7 battle backdrop만 구현한다. Chapter 8–9 art와 balance/save/native 확장은 새 decision brief 전까지 시작하지 않는다.
13. 승인된 FC8은 Chapter 7 boss-wave real-time 35-wave gate를 닫고 Chapter 8 battle backdrop만 구현한다. Chapter 9 art와 balance/save/native 확장은 새 decision brief 전까지 시작하지 않는다.
14. 승인된 FC9은 Chapter 8 progression-aware real-time 37-wave gate를 닫고 Chapter 9 battle backdrop만 구현한다. Campaign 이후 content와 balance/save/native 확장은 새 decision brief 전까지 시작하지 않는다.
15. 승인된 FC10은 Chapter 9 full-capacity real-time 35-wave gate와 first/repeat completion route를 닫는다. New Game+ confirm, campaign 이후 content, balance/save/native 확장은 새 decision brief 전까지 시작하지 않는다.
16. 승인된 FC11은 isolated save에서 New Game+ repeat/cancel/confirm, reset/preserve persistence, Home restart, prestige combat multiplier를 닫는다. Campaign 이후 content와 reset 정책 변경, balance/save/native 확장은 새 decision brief 전까지 시작하지 않는다.
17. 승인된 FC12는 새 run/완료 Home에서 prestige status를 DM seal에 고정하고 top-bar action-zone 충돌을 제거한다. Campaign 이후 content, prestige 효과 변경, balance/save/native 확장은 새 decision brief 전까지 시작하지 않는다.
18. 승인된 FC13은 PreBattle 출격 명령에서 production prestige multiplier를 player-facing 피해 보너스로 표시한다. Forecast 계산 확대, prestige 효과 변경, campaign 이후 content, balance/save/native 확장은 새 decision brief 전까지 시작하지 않는다.

## 11. Risks and stop conditions

| Risk | Stop condition | Recovery |
| --- | --- | --- |
| Visual cue가 portrait를 압도하거나 disabled state가 오도한다 | cue가 name/fit를 가리거나 disabled card가 actionable로 보인다 | presentation만 줄이고 transaction/input state는 보존한다. |
| Art가 gameplay를 가린다 | grid/board/CTA overlap, contrast fail, art-control ambiguity가 있다 | asset override를 revert하거나 safe zone을 조정한다. Gameplay를 art에 맞추어 patch하지 않는다. |
| Design drift / reference copying | source screenshot 또는 distinctive reference expression이 implementation 방향이 된다 | stop하고 original folk-craft brief로 교체한 뒤 provenance를 review한다. |
| Progression scope creep | save, balance, economy, native, monetization change가 제안된다 | phase를 stop하고 separate approved plan을 만든다. |
| Evidence incomplete | test는 pass지만 render/console capture가 없다 | unverified claim으로 기록하고 phase를 advance하지 않는다. |
