import type { DungeonTheme } from './DungeonTheme';

/** Default cave theme — dark blue-gray rock, teal mineral veins, bioluminescent glow */
export const CAVE_THEME: DungeonTheme = {
  id:   'cave',
  name: '동굴',

  // Background — deep blue-gray cavern rock
  bgPrimary:   0x0a0e14,
  bgSecondary: 0x1a2030,
  bgGridAlpha: 0.45,

  // Panel / UI chrome
  panelDark:      0x080c12,
  panelBorder:    0x3a8890,
  panelBorderCSS: '#3a8890',

  // Room slot
  slotFill:   0x0e1218,
  slotBorder: 0x3a8890,
  slotLocked: 0x060a0e,

  // Stone / wall
  stoneDark:  0x1a1e24,
  stoneMid:   0x2a3038,
  stoneLight: 0x3a4248,

  // Ambient — cool bioluminescent teal
  ambientColor: 0x2288aa,
  glowColor:    0x2288aa,
  glowAlpha:    0.15,

  // Text
  textPrimary:   '#b8ccd8',
  textSecondary: '#607080',
  textAccent:    '#44ccaa',

  // Decorations
  decorations: ['stalactites', 'stalagmites', 'water_drips'],

  // Particles — blue water drips falling down
  particleTint:    [0x44aadd, 0x2288aa, 0x66ccee],
  particleGravity: 120,
};
