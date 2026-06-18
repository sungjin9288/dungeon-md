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

// ─── CASUAL: 전통 한국 판타지 다크 베이스 + 캐주얼 폴리시 액센트 ──────────────────
// 어두운 던전 석재 베이스(횃불·양피지) 위에 채도 높은 액센트·청크 UI·캔디 CTA를
// '폴리시 레이어'로 얹는다 (기획 Design Direction: "어두운 dungeon 배경은 유지").
// 토큰 키는 그대로 — 호출부 변경 없이 값만 다크로 되돌린다. Graphics용 hex.
export const CASUAL = {
  BG_TOP:      0x241a0e,   // 던전 상단 (횃불에 데워진 석재)
  BG_BOTTOM:   0x100a05,   // 던전 하단 (심부 어둠)
  BG_DOT:      0xffc58a,   // 떠도는 불씨 (낮은 알파)
  PANEL:       0x2b2114,   // 석재 패널
  PANEL_SOFT:  0x3a2c19,   // 패널 보조면 (살짝 밝은 석재)
  EDGE:        0x7a4a22,   // 통통한 갈색 테두리
  EDGE_SOFT:   0xb98a52,   // 조명 받은 밝은 탄 테두리
  SHADOW:      0x070402,   // 드롭 섀도 (거의 검정)
  INK:         0xf0e6c8,   // 다크 면 위 양피지 글자
  INK_SOFT:    0xc8b896,   // 보조 글자 (양피지 디밍)
  // 던전 톤(Phase 2): 채움색을 횃불 아래 금속/이끼 톤으로 낮춤(캔디감 제거).
  // 텍스트 대비는 CASUAL_CSS(밝은 값)가 따로 담당 — 가독성 유지.
  GREEN:       0x44a05a,  GREEN_DK: 0x256434,   // 실행/긍정 — 깊은 이끼 에메랄드
  GOLD:        0xe0a52c,  GOLD_DK:  0xa9791a,   // 재화/보상 — 횃불 황동
  BLUE:        0x3f93cf,  BLUE_DK:  0x205f9e,   // 정보 — 차분한 강철 청
  RED:         0xd2503c,  RED_DK:   0x9e2e23,   // 경고/위험 — 핏빛
  PURPLE:      0x9a5fce,  PURPLE_DK: 0x66339e,  // 특수/소환 — 자수정
} as const;

/** CASUAL CSS strings for Text — 다크 베이스이므로 텍스트 액센트는 밝게(대비) */
export const CASUAL_CSS = {
  INK:      '#f0e6c8',   // 양피지 (다크 면 위 본문)
  INK_SOFT: '#c8b896',   // 양피지 디밍
  WHITE:    '#ffffff',
  CREAM:    '#2b2114',   // (구 크림 — 이제 다크 석재 칩 배경; INK 글자와 대비)
  GREEN:    '#7ad97b',
  GOLD:     '#ffd24a',
  BLUE:     '#6fc0ff',
  RED:      '#ff7a64',
  PURPLE:   '#c890f0',
} as const;
