import type { DungeonTheme } from './DungeonTheme';

/** Default cave theme — torch-lit brown rock, amber mineral veins, warm ember glow */
export const CAVE_THEME: DungeonTheme = {
  id:   'cave',
  name: '동굴',

  // Background — deep torch-lit cavern rock
  bgPrimary:   0x120b04,
  bgSecondary: 0x241808,
  bgGridAlpha: 0.45,

  // Panel / UI chrome
  panelDark:      0x0f0a04,
  panelBorder:    0x8a6e30,
  panelBorderCSS: '#8a6e30',

  // Room slot
  slotFill:   0x190f06,
  slotBorder: 0x8a6e30,
  slotLocked: 0x0b0703,

  // Stone / wall
  stoneDark:  0x241a10,
  stoneMid:   0x3d3020,
  stoneLight: 0x4d3e2a,

  // Ambient — warm torch ember
  ambientColor: 0xc8721a,
  glowColor:    0xc8721a,
  glowAlpha:    0.15,

  // Text
  textPrimary:   '#e8d5aa',
  textSecondary: '#907a58',
  textAccent:    '#e8a820',

  // Decorations
  decorations: ['stalactites', 'stalagmites', 'water_drips'],

  // Particles — amber ember drips falling down
  particleTint:    [0xe8a820, 0xc8721a, 0xffd060],
  particleGravity: 120,
};
