/** Hex numbers for Phaser Graphics (0x prefix) */
export const COLORS = {
  BLACK:           0x090a12,
  STONE_DARK:      0x151827,
  STONE_MID:       0x20243a,
  STONE_LIGHT:     0x303650,
  TORCH_GOLD:      0x80652e, // brass reward — deep
  TORCH_AMBER:     0xd2a84a, // brass reward — bright
  TORCH_GLOW:      0xe08a5a,
  BLOOD_RED:       0x853126, // vermilion danger — deep
  BLOOD_GLOW:      0xd9573f, // vermilion danger — signal
  MAGIC_PURPLE:    0x4d578f, // moonlight summon — deep
  MAGIC_GLOW:      0x8797d8, // moonlight summon — bright
  PARCHMENT:       0xf0e6c8,
  PARCHMENT_DIM:   0xc8b896,
  PARCHMENT_MUTED: 0x907a58,
  MOSS_GREEN:      0x2d4a1e,
  MOSS_LIGHT:      0x4a7a30,
  // 단청 옥색 — 정보/지원 계열 액센트 (구 커맨드룸 시안의 후계)
  JADE:            0x55b88a,
  JADE_DEEP:       0x2e6e54,
  // 기존 23-key public contract를 유지한다. Runtime Home base는 CASUAL에서 indigo로 매핑.
  PANEL_DEEP:      0x140c03,
  PANEL_BG:        0x1f1305,
  PANEL_MID:       0x2a1c0c,
  CARD_BG:         0x2c1d0d,
  CARD_DEEP:       0x190f06,
} as const;

/** 구역별 액센트 — 베이스 구조는 동일, 정체성은 이 색 하나로만 표현 */
export const ZONE_ACCENTS = {
  dungeon: COLORS.TORCH_AMBER,
  legion:  COLORS.MAGIC_GLOW,
  invasion: COLORS.BLOOD_GLOW,
  shop:    COLORS.MAGIC_GLOW,
  lab:     COLORS.JADE,
  forge:   0xc8794c, // copper forge
  wisdom:  COLORS.TORCH_GOLD,
  summon:  COLORS.MAGIC_GLOW,
} as const;

/** Dark companion accents used for selected-zone depth and pressed states. */
export const ZONE_ACCENT_DARK = {
  dungeon: COLORS.TORCH_GOLD,
  legion:  COLORS.MAGIC_PURPLE,
  forge:   0x70452b,
  invasion: COLORS.BLOOD_RED,
} as const;

/** CSS strings for Phaser Text game objects */
export const CSS = {
  PARCHMENT:       '#f0e6c8',
  PARCHMENT_DIM:   '#c8b896',
  PARCHMENT_MUTED: '#907a58',
  TORCH_AMBER:     '#d2a84a',
  TORCH_GOLD:      '#80652e',
  TORCH_GLOW:      '#e08a5a',
  BLOOD_RED:       '#853126',
  BLOOD_GLOW:      '#d9573f',
} as const;

/**
 * Dungeon management surfaces. These stay separate from rarity/chapter accents:
 * soot and iron carry structure, brass marks interaction, and jade marks a live room.
 */
export const DUNGEON_UI = {
  VOID:          0x030504,
  SOOT:          0x080b09,
  STONE:         0x101612,
  STONE_RAISED:  0x18211b,
  IRON:          0x29342c,
  EDGE:          0x526050,
  BRASS:         0xa98245,
  BRASS_BRIGHT:  0xd8b66b,
  JADE:          0x4f9b78,
  EMBER:         0xc95a42,
} as const;

export const DUNGEON_UI_CSS = {
  PARCHMENT: '#e7d6b5',
  TEXT:      '#d9d1bb',
  MUTED:     '#99a397',
  BRASS:     '#d8b66b',
  JADE:      '#76c6a0',
  EMBER:     '#ef846d',
} as const;

// ─── CASUAL compatibility keys, backed by the charcoal-indigo semantic palette ──
// 공개 key는 기존 호출부 호환을 위해 유지한다. 의미 역할은 이 파일에서만 매핑한다.
export const CASUAL = {
  BG_TOP:      0x171a2b,
  BG_BOTTOM:   0x090b14,
  BG_DOT:      0x8a96b8,
  // Legacy names remain public, but their runtime roles now use stone-indigo.
  PANEL:       COLORS.STONE_MID,
  PANEL_SOFT:  COLORS.STONE_DARK,
  EDGE:        0x353b56,
  EDGE_SOFT:   0x68708f,
  SHADOW:      0x05060c,
  INK:         0xf1ead9,
  INK_SOFT:    0xb8b7c6,
  GREEN:       COLORS.JADE,       GREEN_DK: COLORS.JADE_DEEP,
  GOLD:        COLORS.TORCH_AMBER,GOLD_DK:  COLORS.TORCH_GOLD,
  BLUE:        0x648fbe,          BLUE_DK:  0x365675,
  RED:         COLORS.BLOOD_GLOW, RED_DK:   COLORS.BLOOD_RED,
  PURPLE:      COLORS.MAGIC_GLOW, PURPLE_DK: COLORS.MAGIC_PURPLE,
} as const;

/** CASUAL CSS strings for Text — 다크 베이스이므로 텍스트 액센트는 밝게(대비) */
export const CASUAL_CSS = {
  INK:      '#f1ead9',
  INK_SOFT: '#b8b7c6',
  WHITE:    '#ffffff',
  CREAM:    '#171a2a',
  PANEL:    '#20243a',
  PANEL_SOFT: '#151827',
  GREEN:    '#78d0a4',
  GOLD:     '#e9c56a',
  BLUE:     '#8db8df',
  RED:      '#f28368',
  PURPLE:   '#b3bfff',
} as const;
