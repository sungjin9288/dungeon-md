import type { DungeonTheme } from './DungeonTheme';

/** Ice cave theme — frozen permafrost, glacial blue crystals, frost glow */
export const ICE_CAVE_THEME: DungeonTheme = {
  id:   'ice_cave',
  name: '얼음 동굴',

  // Background — near-black navy ice
  bgPrimary:   0x05090f,
  bgSecondary: 0x0a1828,
  bgGridAlpha: 0.55,

  // Panel / UI chrome
  panelDark:      0x04080e,
  panelBorder:    0x6ab4d8,
  panelBorderCSS: '#6ab4d8',

  // Room slot
  slotFill:   0x080e18,
  slotBorder: 0x6ab4d8,
  slotLocked: 0x040810,

  // Ice / frost wall
  stoneDark:  0x0d1520,
  stoneMid:   0x1a2d3e,
  stoneLight: 0x2e4d66,

  // Ambient — glacial frost shimmer
  ambientColor: 0x88d8f8,
  glowColor:    0x44aaee,
  glowAlpha:    0.20,

  // Text
  textPrimary:   '#c8e8f8',
  textSecondary: '#5080a0',
  textAccent:    '#80d8ff',

  // Decorations — ice crystals + icicles
  decorations: ['stalactites', 'stalagmites', 'crystals'],

  // Particles — icy white/blue flakes drifting down slowly
  particleTint:    [0xaaddff, 0x66bbee, 0xeef8ff],
  particleGravity: 40,
};
