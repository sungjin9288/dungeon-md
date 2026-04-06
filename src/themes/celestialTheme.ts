import type { DungeonTheme } from './DungeonTheme';

/** Celestial Realm theme — ivory, gold, sky-blue accents, divine radiance */
export const CELESTIAL_THEME: DungeonTheme = {
  id:   'celestial_realm',
  name: '천상의 영역',

  // Background — deep heavenly sky, near-midnight blue
  bgPrimary:   0x090e24,
  bgSecondary: 0x10193a,
  bgGridAlpha: 0.28,

  // Panel / UI chrome — gold-bordered dark navy
  panelDark:      0x080c1e,
  panelBorder:    0xffd700,
  panelBorderCSS: '#ffd700',

  // Room slot — midnight blue with gold rim
  slotFill:   0x0c1228,
  slotBorder: 0xd4aa20,
  slotLocked: 0x07091a,

  // Stone — pale heavenly marble
  stoneDark:  0x0e1530,
  stoneMid:   0x1e2a50,
  stoneLight: 0x3a4880,

  // Ambient — golden divine light
  ambientColor: 0xffd700,
  glowColor:    0xffeebb,
  glowAlpha:    0.18,

  // Text
  textPrimary:   '#ffd700',
  textSecondary: '#7a8ecc',
  textAccent:    '#ffeebb',

  // Decorations — celestial crystals + torches (no drips)
  decorations: ['crystals', 'torches', 'stalactites'],

  // Particles — gold and sky-blue motes rising upward
  particleTint:    [0xffd700, 0xaaddff, 0xffeebb, 0xffcc44],
  particleGravity: -14,
};
