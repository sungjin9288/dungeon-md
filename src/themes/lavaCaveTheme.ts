import type { DungeonTheme } from './DungeonTheme';

/** Lava cave theme — charcoal rock, molten rivers, ember glow */
export const LAVA_CAVE_THEME: DungeonTheme = {
  id:   'lava_cave',
  name: '용암 동굴',

  // Background — near-black charcoal
  bgPrimary:   0x100600,
  bgSecondary: 0x1e0c00,
  bgGridAlpha: 0.40,

  // Panel / UI chrome
  panelDark:      0x0e0400,
  panelBorder:    0xdd5500,
  panelBorderCSS: '#dd5500',

  // Room slot
  slotFill:   0x160800,
  slotBorder: 0xdd5500,
  slotLocked: 0x0c0400,

  // Igneous / basalt wall
  stoneDark:  0x1a0e00,
  stoneMid:   0x2e1a00,
  stoneLight: 0x4a2800,

  // Ambient — molten ember orange
  ambientColor: 0xff6600,
  glowColor:    0xff4400,
  glowAlpha:    0.18,

  // Text
  textPrimary:   '#f0c880',
  textSecondary: '#805030',
  textAccent:    '#ff8844',

  // Decorations — torches + stalagmites (no water)
  decorations: ['stalagmites', 'torches'],

  // Particles — red/orange embers rising upward
  particleTint:    [0xff4400, 0xff8800, 0xffcc44],
  particleGravity: -60,   // negative = float upward like embers
};
