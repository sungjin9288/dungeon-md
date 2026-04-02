/** Theme configuration for dungeon visuals — swappable via shop skins */
export interface DungeonTheme {
  id: string;
  name: string;

  // ── Background ──────────────────────────────────────────────────────────
  bgPrimary:    number;   // main fill color
  bgSecondary:  number;   // grid lines / subtle pattern
  bgGridAlpha:  number;   // grid line opacity

  // ── Panel / UI chrome ───────────────────────────────────────────────────
  panelDark:      number;   // header bar, top bar bg
  panelBorder:    number;   // accent border color
  panelBorderCSS: string;   // CSS version of panelBorder

  // ── Room slot ───────────────────────────────────────────────────────────
  slotFill:    number;   // empty slot background
  slotBorder:  number;   // slot stroke color
  slotLocked:  number;   // locked overlay tint

  // ── Stone / wall ────────────────────────────────────────────────────────
  stoneDark:   number;
  stoneMid:    number;
  stoneLight:  number;

  // ── Ambient lighting ────────────────────────────────────────────────────
  ambientColor: number;   // point-light color
  glowColor:    number;   // glow circle fill
  glowAlpha:    number;

  // ── Text (CSS strings) ──────────────────────────────────────────────────
  textPrimary:   string;   // main UI text
  textSecondary: string;   // dim labels
  textAccent:    string;   // highlighted / accent text

  // ── Decorations to draw ─────────────────────────────────────────────────
  decorations: DecorationType[];

  // ── Particles ───────────────────────────────────────────────────────────
  particleTint:    number[];   // tint array for ambient particle emitters
  particleGravity: number;     // positive = drips down, negative = rises up
}

export type DecorationType =
  | 'stalactites'
  | 'stalagmites'
  | 'torches'
  | 'water_drips'
  | 'crystals'
  | 'moss';
