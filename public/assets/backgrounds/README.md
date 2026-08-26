# 던전 배경 아트 (선택) — 일러스트 배경 던전

> Runtime 규격과 originality의 최종 권위는 `docs/MONSTER_DUNGEON_DESIGN.md`다. 모든 per-chapter battle PNG는 정확히 1024×1024, 512 KiB 이하이며 중앙 70%×70%를 calm overlay zone으로 유지한다.

이 폴더에 PNG를 떨어뜨리면, 절차적 Canvas 페인팅(`src/art/DungeonBackdrop.ts`)
**대신** 그 이미지가 던전 배경으로 쓰입니다. 파일이 없으면 자동으로 Canvas 페인팅으로
폴백하므로, 아무 것도 안 넣어도 게임은 정상 동작합니다.

소비 측 코드는 이미 준비돼 있습니다(`bakeDungeonBackdrop(..., realAssetKey)`가 로드된
텍스처를 우선 사용). **활성화에 필요한 단 한 가지는 BootScene 프리로드 + PNG 배치입니다.**

## 1) 넣을 파일

| 파일 | 텍스처 키 | 쓰이는 곳 | 권장 해상도 / 비율 |
|------|-----------|-----------|--------------------|
| `dungeon-shaft.png`   | `bg-dungeon-shaft`   | 홈 보드(수직 던전 전경) | **768 × 1280** (세로 ~3:5) |
| `dungeon-chamber.png` | `bg-dungeon-chamber` | 전투 보드(3×3 방어 격자) | **1024 × 1024** (정사각) |
| `battle-ch1.png` | `bg-battle-ch1` | Chapter 1 전투 전용 | **1024 × 1024**, 512 KiB 이하 |
| `battle-ch2.png` | `bg-battle-ch2` | Chapter 2 구미호 계곡 전용 | **1024 × 1024**, 512 KiB 이하 |
| `battle-ch3.png` | `bg-battle-ch3` | Chapter 3 용왕 해저궁 전용 | **1024 × 1024**, 512 KiB 이하 |
| `battle-ch4.png` | `bg-battle-ch4` | Chapter 4 저승관문 전용 | **1024 × 1024**, 512 KiB 이하 |
| `battle-ch5.png` | `bg-battle-ch5` | Chapter 5 삼신산 전용 | **1024 × 1024**, 512 KiB 이하 |
| `battle-ch6.png` | `bg-battle-ch6` | Chapter 6 영원의 왕좌 전용 | **1024 × 1024**, 512 KiB 이하 |
| `battle-ch7.png` | `bg-battle-ch7` | Chapter 7 신계 침공 전용 | **1024 × 1024**, 512 KiB 이하 |
| `battle-ch8.png` | `bg-battle-ch8` | Chapter 8 원초의 심연 전용 | **1024 × 1024**, 512 KiB 이하 |
| `battle-ch9.png` | `bg-battle-ch9` | Chapter 9 공허 너머 전용 | **1024 × 1024**, 512 KiB 이하 |

- 포맷: PNG (불투명). 모바일 캔버스 390×844, 고DPR이라 위 해상도면 선명합니다.
- 이미지는 슬롯에 맞춰 자동 스케일(`setDisplaySize`)됩니다 — 비율이 위와 비슷할수록 덜 늘어납니다.
- **중앙에 핵심 디테일을 몰지 마세요**: 방 카드/셀이 그 위에 얹혀 일부를 가립니다.
  가장자리·상단·여백에 분위기(횃불·아치·석조)가 살아 있어야 비쳐 보입니다.

## 2) 활성화 — BootScene 프리로드 추가

PNG를 넣은 뒤 `src/scenes/BootScene.ts`의 `preload()` 안에 아래를 추가하세요
(파일이 실제로 존재할 때만 추가 — 없는 파일을 프리로드하면 콘솔 404가 납니다):

```ts
// 선택: 일러스트 던전 배경 (있으면 Canvas 페인팅을 대체)
this.load.image('bg-dungeon-shaft',   '/assets/backgrounds/dungeon-shaft.png');
this.load.image('bg-dungeon-chamber', '/assets/backgrounds/dungeon-chamber.png');
```

추가 후 리로드하면 홈/전투 배경이 자동으로 교체됩니다. (둘 중 하나만 넣어도 됩니다.)

## 3) 생성 프롬프트 (GPT Pro / DALL·E / Midjourney)

### 느낌(무드) — 두 이미지 공통
이 게임에서 던전은 **플레이어가 직접 키우는 자기 소굴**입니다. 그래서 무섭고 음산한
호러가 아니라, **다크하지만 따뜻하고 정든(cozy-ominous) 키퍼의 보금자리** — 깊은 어둠을
횃불의 따뜻한 빛 웅덩이가 파고드는, 조용한 암흑 권능의 공간이어야 합니다.

**Shared style (두 프롬프트에 공통으로 붙이세요):**
> Original painterly hand-drawn dark-fantasy game background with a cohesive Korean
> folk-craft vocabulary; do not imitate a named game, artwork, artist, or trade dress.
> Mood: an ancient underground dungeon that is the player's OWN lair — ominous and
> mysterious yet warm and lived-in, a place of quiet dark power, NOT gory horror.
> Deep shadow carved by warm pools of torchlight (strong chiaroscuro), drifting dust
> motes and faint floating embers, soft volumetric haze, weathered hand-laid stone
> masonry, aged iron fixtures, creeping moss and tree-roots in the damp corners.
> Color palette: deep warm browns to near-black (#0e0805–#33240f), amber/orange
> torch glow (#ff8a2a, #ffb347), a faint crimson ember glow rising from the depths
> (#3a0a0a). Rich, atmospheric, high production-value. No text, no UI, no logos, no
> watermark, no characters, no creatures.

### dungeon-shaft.png — 홈 (세로 768×1280)
> A side cutaway cross-section of a vertical dungeon descending deep underground — a
> layered stronghold seen from the side, like a dollhouse / ant-farm view. At the very
> TOP, a heavy iron portcullis gate where pale daylight spills in from the surface
> (the entrance invaders breach). Below it, 2–3 stacked stone chambers connected by
> descending archways and worn stairs, each level lit by bracketed wall torches.
> Hanging chains and tattered banners, tree roots cracking through the masonry, moss
> in the damp corners, scattered rubble. At the very BOTTOM, a glowing crimson
> "dungeon heart" core pulsing with dark power, casting red light upward into the
> lowest chamber. Strong vertical composition with deep shadow between the lit levels.
> [+ Shared style above]. Portrait 768×1280.
>
> Midjourney 꼬리표: `--ar 3:5 --style raw --v 6`

### dungeon-chamber.png — 전투 (정사각 1024×1024)
> A grand underground dungeon defensive hall — a wide stone-brick chamber with tall
> arches and thick pillars, viewed straight-on or slightly elevated. Wall-mounted iron
> torches and a couple of standing braziers cast warm overlapping pools of light;
> the deep corners fall into shadow. Worn flagstone floor with cracks and rubble,
> faint haze drifting through the torchlight, moss along the base of the walls. This
> is the front line where invaders breach the dungeon — tense but warmly lit.
> **Compose so the CENTER stays open and calm (a clear floor area); put the richer
> architecture — arches, pillars, braziers, banners — around the EDGES and top**
> (game pieces overlay the middle). [+ Shared style above]. Square 1:1, 1024×1024.
>
> Midjourney 꼬리표: `--ar 1:1 --style raw --v 6`

### Negative prompt (지원 모델에서)
> text, letters, watermark, signature, UI, HUD, buttons, frame, border, people,
> characters, monsters, creatures, modern objects, bright daylight, flat cartoon
> colors, low detail, blurry, oversaturated

### 팁
- **중앙은 비워두기**: 방 카드·셀이 중앙을 덮으므로, 핵심 분위기(횃불·아치·심장부)는
  가장자리·상단·하단에 배치되게 하세요. 중앙이 너무 복잡하면 가려져 아깝습니다.
- **두 장의 팔레트·조명을 맞추세요** — 홈↔전투가 한 던전으로 이어져 보이게.
- 3~4장 뽑아 **중앙이 가장 차분한 컷**을 고르세요.
- 너무 밝거나 산만하면 프롬프트에 `darker, more negative space, calmer center, muted`를 추가.
- PNG로 위 해상도에 맞춰 내보내기.
