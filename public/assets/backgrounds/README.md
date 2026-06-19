# 던전 배경 아트 (선택) — 일러스트 배경 던전

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

## 3) 생성 프롬프트 (GPT Pro / DALL·E / 이미지 AI)

게임 톤: **어두운 횃불 던전, 따뜻한 석조, 손그림 일러스트(만화/AFK Journey 톤), UI 텍스트 없음.**

### dungeon-shaft.png (홈, 세로)
> A dark, atmospheric illustrated dungeon cross-section viewed from the side, a
> vertical multi-level stone shaft descending underground. Warm torchlight glow,
> weathered stone-block masonry, descending stone archways between levels, a faint
> glowing red "dungeon heart" core near the bottom, soft volumetric haze, painterly
> hand-drawn fantasy-game art (manhwa/AFK-Journey style). Muted warm browns and
> ambers, deep shadows, no characters, no text, no UI. Portrait 768×1280.

### dungeon-chamber.png (전투, 정사각)
> A dark illustrated underground dungeon hall / defensive chamber, stone-brick
> walls and arches lit by warm wall torches, atmospheric haze and deep shadows,
> painterly hand-drawn fantasy-game background (manhwa/AFK-Journey style). Keep the
> center relatively calm/empty (game pieces sit on top); richer detail toward the
> edges. Muted warm browns and ambers. No characters, no text, no UI. Square 1024×1024.

> 팁: 두 이미지의 팔레트(따뜻한 갈색·앰버·횃불 주황)를 맞춰 홈↔전투 톤이 이어지게 하세요.
