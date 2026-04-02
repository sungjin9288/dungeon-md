import type { DungeonTheme } from './DungeonTheme';

/** Void Throne theme — deep purple, gold accents, ethereal glow */
export const VOID_THRONE_THEME: DungeonTheme = {
  id:   'void_throne',
  name: '공허의 왕좌',

  // Background — near-black violet
  bgPrimary:   0x0a0018,
  bgSecondary: 0x180030,
  bgGridAlpha: 0.35,

  // Panel / UI chrome
  panelDark:      0x0c0016,
  panelBorder:    0x8844cc,
  panelBorderCSS: '#8844cc',

  // Room slot
  slotFill:   0x120024,
  slotBorder: 0x8844cc,
  slotLocked: 0x080012,

  // Deep purple stone walls
  stoneDark:  0x140028,
  stoneMid:   0x220040,
  stoneLight: 0x3a1060,

  // Ambient — purple glow with gold highlights
  ambientColor: 0x8844cc,
  glowColor:    0xd4af37,
  glowAlpha:    0.15,

  // Text
  textPrimary:   '#d4af37',
  textSecondary: '#6a3a8a',
  textAccent:    '#d4af37',

  // Decorations — crystals + torches + stalactites
  decorations: ['stalactites', 'crystals', 'torches'],

  // Particles — purple/gold motes floating upward
  particleTint:    [0x8844cc, 0xd4af37, 0x6622aa],
  particleGravity: -10,
};
