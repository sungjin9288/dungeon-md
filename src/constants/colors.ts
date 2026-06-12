/** Hex numbers for Phaser Graphics (0x prefix) */
export const COLORS = {
  BLACK:           0x1a0f00,
  STONE_DARK:      0x2d2416,
  STONE_MID:       0x3d3020,
  STONE_LIGHT:     0x4d3e2a,
  TORCH_GOLD:      0xc8921a,
  TORCH_AMBER:     0xe8a820,
  TORCH_GLOW:      0xff6b1a,
  BLOOD_RED:       0x8b0000,
  BLOOD_GLOW:      0xcc2200,
  MAGIC_PURPLE:    0x4a0080,
  MAGIC_GLOW:      0x7a30c8,
  PARCHMENT:       0xf0e6c8,
  PARCHMENT_DIM:   0xc8b896,
  PARCHMENT_MUTED: 0x907a58,
  MOSS_GREEN:      0x2d4a1e,
  MOSS_LIGHT:      0x4a7a30,
  // 단청 옥색 — 정보/지원 계열 액센트 (구 커맨드룸 시안의 후계)
  JADE:            0x55b88a,
  JADE_DEEP:       0x2e6e54,
  // 통일 베이스 — 모든 씬 공통 패널/카드 (구역 정체성은 ZONE_ACCENTS로만)
  PANEL_DEEP:      0x140c03,
  PANEL_BG:        0x1f1305,
  PANEL_MID:       0x2a1c0c,
  CARD_BG:         0x2c1d0d,
  CARD_DEEP:       0x190f06,
} as const;

/** 구역별 액센트 — 베이스 구조는 동일, 정체성은 이 색 하나로만 표현 */
export const ZONE_ACCENTS = {
  dungeon: COLORS.TORCH_AMBER,   // 홈/전투 — 토치
  shop:    0x9a5fd0,             // 상점 — 자수정
  lab:     0x55b88a,             // 연구소 — 비취
  forge:   0xd9824a,             // 제작소 — 화로 구리
  wisdom:  0xc8921a,             // 지혜의 나무 — 금
  summon:  0x7a8fd8,             // 소환 — 달빛 청
} as const;

/** CSS strings for Phaser Text game objects */
export const CSS = {
  PARCHMENT:       '#f0e6c8',
  PARCHMENT_DIM:   '#c8b896',
  PARCHMENT_MUTED: '#907a58',
  TORCH_AMBER:     '#e8a820',
  TORCH_GOLD:      '#c8921a',
  TORCH_GLOW:      '#ff6b1a',
  BLOOD_RED:       '#8b0000',
  BLOOD_GLOW:      '#cc2200',
} as const;
