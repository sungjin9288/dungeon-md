/**
 * Procedural pixel-art monster sprites (24x24).
 *
 * Each tribe has a 5-colour palette and base silhouettes for the four
 * monster types (melee / ranged / magic / support).  Individual monsters
 * can override with a unique silhouette or a recoloured palette.
 *
 * Silhouette grids use palette indices:
 *   0 = transparent, 1 = outline, 2 = primary, 3 = secondary,
 *   4 = highlight, 5 = shadow
 */

import type { TribeId, MonsterId } from '../data/monsters';
import { MONSTER_RECIPES, composeSilhouette } from './SilhouetteData';

// ─── Palette type ──────────────────────────────────────────────────────────────

export type Palette = [number, number, number, number, number, number];
// index 0 = transparent (not drawn), 1-5 = actual colours

// ─── Tribe palettes ────────────────────────────────────────────────────────────

export const TRIBE_PALETTES: Record<TribeId, Palette> = {
  //               transparent  outline    primary    secondary  highlight  shadow
  dokkaebi:  [0x000000, 0x4a0000, 0xcc3300, 0xff6600,  0xffaa44, 0x220000],
  gumiho:    [0x000000, 0x804020, 0xffeedd, 0xffccbb,  0xff8899, 0x402010],
  dragon:    [0x000000, 0x003300, 0x228844, 0x44cc66,  0xffdd00, 0x001100],
  underworld:[0x000000, 0x200040, 0x6020a0, 0x9944cc,  0xcc88ff, 0x100020],
  sansin:    [0x000000, 0x1a3a1a, 0x3a8a3a, 0x66cc66,  0x8b6040, 0x0a1a0a],
  sea:       [0x000000, 0x002040, 0x1060a0, 0x2090dd,  0x44ccff, 0x001020],
  mask:      [0x000000, 0x400000, 0x804040, 0xcc6644,  0xffcc00, 0x200000],
  moonlight: [0x000000, 0x1a1a40, 0x4040a0, 0x8888dd,  0xccccff, 0x0a0a20],
  celestial: [0x000000, 0xaa8800, 0xffd700, 0xffeebb,  0xffffff, 0x554400],
};

// ─── Default tribe for monsters without explicit tribe field ────────────────

const NO_TRIBE_PALETTE: Palette = [0x000000, 0x333333, 0x888888, 0xaaaaaa, 0xdddddd, 0x111111];

// ─── 24×24 Silhouette data ─────────────────────────────────────────────────────
// RLE helper: repeat a value N times
function r(v: number, n: number): number[] {
  return Array(n).fill(v);
}

// Build a row from segments: [value, count, value, count, ...]
function row(...segs: number[]): number[] {
  const out: number[] = [];
  for (let i = 0; i < segs.length; i += 2) {
    out.push(...r(segs[i], segs[i + 1]));
  }
  // Pad to 24
  while (out.length < 24) out.push(0);
  return out.slice(0, 24);
}

// ─── Generic silhouettes per monster type ──────────────────────────────────────

// Melee: stocky warrior with weapon
export const MELEE_SILHOUETTE: number[][] = [
  row(0,24),
  row(0,24),
  row(0,9, 1,1, 4,4, 1,1, 0,9),         // head top
  row(0,8, 1,1, 2,6, 1,1, 0,8),          // head
  row(0,8, 1,1, 3,2, 4,2, 3,2, 1,1, 0,8),// face
  row(0,8, 1,1, 2,6, 1,1, 0,8),          // chin
  row(0,9, 1,6, 0,9),                     // neck
  row(0,7, 1,1, 2,8, 1,1, 0,7),          // shoulders
  row(0,6, 1,1, 2,10, 1,1, 0,6),         // torso top
  row(0,6, 1,1, 3,4, 2,2, 3,4, 1,1, 0,6),// torso
  row(0,6, 1,1, 2,10, 1,1, 0,6),         // torso
  row(0,6, 1,1, 5,3, 2,4, 5,3, 1,1, 0,6),// belt
  row(0,7, 1,1, 2,8, 1,1, 0,7),          // waist
  row(0,7, 1,1, 2,3, 0,2, 2,3, 1,1, 0,7),// legs top
  row(0,7, 1,1, 2,3, 0,2, 2,3, 1,1, 0,7),// legs
  row(0,7, 1,1, 2,3, 0,2, 2,3, 1,1, 0,7),// legs
  row(0,7, 1,1, 5,3, 0,2, 5,3, 1,1, 0,7),// boots
  row(0,7, 1,1, 1,3, 0,2, 1,3, 1,1, 0,7),// feet
  // weapon (right side)
  row(0,18, 4,1, 1,1, 0,4),
  row(0,18, 1,1, 4,1, 0,4),
  row(0,18, 4,1, 1,1, 0,4),
  row(0,24),
  row(0,24),
  row(0,24),
];

// Ranged: slimmer figure with bow
export const RANGED_SILHOUETTE: number[][] = [
  row(0,24),
  row(0,24),
  row(0,10, 1,1, 4,2, 1,1, 0,10),        // head top
  row(0,9, 1,1, 2,4, 1,1, 0,9),           // head
  row(0,9, 1,1, 3,1, 4,2, 3,1, 1,1, 0,9),// face
  row(0,9, 1,1, 2,4, 1,1, 0,9),           // chin
  row(0,10, 1,4, 0,10),                    // neck
  row(0,8, 1,1, 2,6, 1,1, 0,8),           // shoulders
  row(0,8, 1,1, 3,6, 1,1, 0,8),           // torso
  row(0,9, 1,1, 2,4, 1,1, 0,9),           // torso
  row(0,9, 1,1, 2,4, 1,1, 0,9),           // waist
  row(0,9, 1,1, 5,4, 1,1, 0,9),           // belt
  row(0,9, 1,1, 2,4, 1,1, 0,9),           // hips
  row(0,9, 1,1, 2,1, 0,2, 2,1, 1,1, 0,9),// legs
  row(0,9, 1,1, 2,1, 0,2, 2,1, 1,1, 0,9),
  row(0,9, 1,1, 2,1, 0,2, 2,1, 1,1, 0,9),
  row(0,9, 1,1, 5,1, 0,2, 5,1, 1,1, 0,9),// boots
  row(0,9, 1,2, 0,2, 1,2, 0,9),           // feet
  // bow (left side)
  row(0,3, 4,1, 0,20),
  row(0,2, 1,1, 4,1, 1,1, 0,19),
  row(0,3, 4,1, 0,20),
  row(0,24),
  row(0,24),
  row(0,24),
];

// Magic: robed figure with staff/aura
export const MAGIC_SILHOUETTE: number[][] = [
  row(0,24),
  row(0,10, 4,1, 3,2, 4,1, 0,10),         // hat tip
  row(0,9, 1,1, 3,4, 1,1, 0,9),            // hat
  row(0,9, 1,1, 2,4, 1,1, 0,9),            // head
  row(0,9, 1,1, 4,1, 3,2, 4,1, 1,1, 0,9), // face
  row(0,9, 1,1, 2,4, 1,1, 0,9),            // chin
  row(0,10, 1,4, 0,10),                     // neck
  row(0,7, 1,1, 3,8, 1,1, 0,7),            // robe shoulders
  row(0,6, 1,1, 3,10, 1,1, 0,6),           // robe
  row(0,6, 1,1, 2,4, 3,2, 2,4, 1,1, 0,6), // robe middle
  row(0,7, 1,1, 3,8, 1,1, 0,7),            // robe
  row(0,7, 1,1, 5,8, 1,1, 0,7),            // belt
  row(0,7, 1,1, 3,8, 1,1, 0,7),            // robe lower
  row(0,7, 1,1, 3,8, 1,1, 0,7),
  row(0,7, 1,1, 3,8, 1,1, 0,7),
  row(0,8, 1,1, 2,6, 1,1, 0,8),            // robe bottom
  row(0,8, 1,1, 5,6, 1,1, 0,8),
  row(0,8, 1,8, 0,8),                       // hem
  // staff (right side)
  row(0,19, 4,1, 0,4),
  row(0,19, 1,1, 0,4),
  row(0,19, 4,1, 0,4),
  row(0,19, 1,1, 0,4),
  row(0,19, 4,1, 0,4),
  row(0,24),
];

// Support: shorter figure with glowing hands
const SUPPORT_SILHOUETTE: number[][] = [
  row(0,24),
  row(0,24),
  row(0,24),
  row(0,10, 1,1, 4,2, 1,1, 0,10),          // head
  row(0,9, 1,1, 2,4, 1,1, 0,9),
  row(0,9, 1,1, 3,1, 4,2, 3,1, 1,1, 0,9), // face
  row(0,9, 1,1, 2,4, 1,1, 0,9),            // chin
  row(0,10, 1,4, 0,10),                     // neck
  row(0,8, 1,1, 3,6, 1,1, 0,8),            // body
  row(0,8, 1,1, 2,6, 1,1, 0,8),
  row(0,8, 1,1, 3,6, 1,1, 0,8),
  row(0,9, 1,1, 5,4, 1,1, 0,9),            // belt
  row(0,9, 1,1, 2,4, 1,1, 0,9),
  row(0,9, 1,1, 2,1, 0,2, 2,1, 1,1, 0,9), // legs
  row(0,9, 1,1, 2,1, 0,2, 2,1, 1,1, 0,9),
  row(0,9, 1,1, 5,1, 0,2, 5,1, 1,1, 0,9),
  row(0,9, 1,2, 0,2, 1,2, 0,9),            // feet
  // glowing hands
  row(0,5, 4,2, 0,10, 4,2, 0,5),
  row(0,5, 4,1, 3,1, 0,10, 3,1, 4,1, 0,5),
  row(0,24),
  row(0,24),
  row(0,24),
  row(0,24),
  row(0,24),
];

const BASE_SILHOUETTES: Record<string, number[][]> = {
  melee: MELEE_SILHOUETTE,
  ranged: RANGED_SILHOUETTE,
  magic: MAGIC_SILHOUETTE,
  support: SUPPORT_SILHOUETTE,
};

// ─── Unique silhouettes for specific Ch1-5 monsters ────────────────────────────

// Dokkaebi warrior: horned head + club (override top rows of melee)
const DOKKAEBI_WARRIOR: number[][] = [
  row(0,24),
  row(0,8, 4,1, 0,5, 4,1, 0,9),           // horns
  row(0,9, 1,1, 4,4, 1,1, 0,9),
  row(0,8, 1,1, 2,6, 1,1, 0,8),
  row(0,8, 1,1, 4,1, 5,1, 4,2, 5,1, 4,1, 1,1, 0,8),// angry face
  row(0,8, 1,1, 2,2, 5,2, 2,2, 1,1, 0,8),// mouth
  row(0,9, 1,6, 0,9),
  row(0,7, 1,1, 2,8, 1,1, 0,7),
  row(0,6, 1,1, 2,10, 1,1, 0,6),
  row(0,6, 1,1, 3,4, 2,2, 3,4, 1,1, 0,6),
  row(0,6, 1,1, 2,10, 1,1, 0,6),
  row(0,6, 1,1, 5,3, 2,4, 5,3, 1,1, 0,6),
  row(0,7, 1,1, 2,8, 1,1, 0,7),
  row(0,7, 1,1, 2,3, 0,2, 2,3, 1,1, 0,7),
  row(0,7, 1,1, 2,3, 0,2, 2,3, 1,1, 0,7),
  row(0,7, 1,1, 2,3, 0,2, 2,3, 1,1, 0,7),
  row(0,7, 1,1, 5,3, 0,2, 5,3, 1,1, 0,7),
  row(0,7, 1,1, 1,3, 0,2, 1,3, 1,1, 0,7),
  // club
  row(0,18, 4,2, 1,1, 0,3),
  row(0,18, 4,3, 0,3),
  row(0,18, 4,2, 1,1, 0,3),
  row(0,19, 1,1, 0,4),
  row(0,19, 1,1, 0,4),
  row(0,24),
];

// Gumiho guardian: fox ears + 3 tails
export const GUMIHO_GUARDIAN: number[][] = [
  row(0,24),
  row(0,8, 4,1, 0,5, 4,1, 0,9),           // fox ears
  row(0,8, 3,1, 4,1, 0,3, 4,1, 3,1, 0,9),
  row(0,9, 1,1, 2,4, 1,1, 0,9),
  row(0,9, 1,1, 4,1, 3,2, 4,1, 1,1, 0,9),// fox face
  row(0,9, 1,1, 2,1, 3,2, 2,1, 1,1, 0,9),
  row(0,10, 1,4, 0,10),
  row(0,7, 1,1, 3,8, 1,1, 0,7),            // elegant robe
  row(0,7, 1,1, 2,2, 3,4, 2,2, 1,1, 0,7),
  row(0,7, 1,1, 3,8, 1,1, 0,7),
  row(0,8, 1,1, 2,6, 1,1, 0,8),
  row(0,8, 1,1, 5,6, 1,1, 0,8),
  row(0,8, 1,1, 3,6, 1,1, 0,8),
  row(0,8, 1,1, 3,2, 0,2, 3,2, 1,1, 0,8),
  row(0,8, 1,1, 2,2, 0,2, 2,2, 1,1, 0,8),
  row(0,8, 1,1, 5,2, 0,2, 5,2, 1,1, 0,8),
  row(0,8, 1,2, 0,4, 1,2, 0,8),
  // 3 tails
  row(0,2, 3,2, 0,3, 4,1, 0,9, 3,2, 0,5),
  row(0,1, 4,1, 3,1, 0,3, 3,1, 4,1, 0,7, 4,1, 3,1, 0,5),
  row(0,1, 3,2, 0,4, 3,2, 0,7, 3,2, 0,4),
  row(0,24),
  row(0,24),
  row(0,24),
  row(0,24),
];

// White tiger: tiger stripes, powerful stance
export const WHITE_TIGER: number[][] = [
  row(0,24),
  row(0,9, 4,1, 0,3, 4,1, 0,10),          // ears
  row(0,8, 1,1, 2,6, 1,1, 0,8),            // head
  row(0,8, 1,1, 4,2, 2,2, 4,2, 1,1, 0,8), // tiger eyes
  row(0,8, 1,1, 2,2, 5,2, 2,2, 1,1, 0,8), // mouth
  row(0,9, 1,1, 2,4, 1,1, 0,9),
  row(0,10, 1,4, 0,10),
  row(0,6, 1,1, 2,10, 1,1, 0,6),           // big shoulders
  row(0,5, 1,1, 2,4, 5,2, 2,4, 1,1, 0,6), // stripe
  row(0,5, 1,1, 2,12, 1,1, 0,5),
  row(0,5, 1,1, 2,4, 5,2, 2,4, 1,1, 0,6), // stripe
  row(0,6, 1,1, 2,10, 1,1, 0,6),
  row(0,6, 1,1, 5,10, 1,1, 0,6),
  row(0,7, 1,1, 2,3, 0,2, 2,3, 1,1, 0,7),
  row(0,7, 1,1, 2,3, 0,2, 2,3, 1,1, 0,7),
  row(0,7, 1,1, 5,3, 0,2, 5,3, 1,1, 0,7),
  row(0,6, 1,1, 2,4, 0,2, 2,4, 1,1, 0,6), // paws
  row(0,6, 1,4, 0,4, 1,4, 0,6),
  row(0,24),
  row(0,24),
  row(0,24),
  row(0,24),
  row(0,24),
  row(0,24),
];

// Death messenger: skeleton with scythe
export const DEATH_MESSENGER: number[][] = [
  row(0,24),
  row(0,24),
  row(0,9, 1,1, 3,4, 1,1, 0,9),           // hood
  row(0,8, 1,1, 5,1, 3,4, 5,1, 1,1, 0,8),
  row(0,8, 1,1, 4,2, 5,2, 4,2, 1,1, 0,8),// skull eyes
  row(0,9, 1,1, 5,1, 3,2, 5,1, 1,1, 0,9),// teeth
  row(0,10, 1,4, 0,10),
  row(0,6, 1,1, 3,10, 1,1, 0,6),           // cloak
  row(0,5, 1,1, 5,2, 3,8, 1,1, 0,7),
  row(0,5, 1,1, 3,12, 1,1, 0,5),
  row(0,5, 1,1, 5,2, 3,8, 5,2, 1,1, 0,5),
  row(0,6, 1,1, 3,10, 1,1, 0,6),
  row(0,6, 1,1, 3,10, 1,1, 0,6),
  row(0,7, 1,1, 3,8, 1,1, 0,7),
  row(0,7, 1,1, 3,8, 1,1, 0,7),
  row(0,8, 1,1, 3,6, 1,1, 0,8),
  row(0,8, 1,1, 5,6, 1,1, 0,8),
  row(0,8, 1,8, 0,8),
  // scythe
  row(0,1, 4,3, 0,20),
  row(0,1, 1,1, 0,1, 4,1, 1,1, 0,19),
  row(0,4, 1,1, 0,19),
  row(0,4, 1,1, 0,19),
  row(0,24),
  row(0,24),
];

// Thunder hero: lightning motif
const THUNDER_HERO: number[][] = [
  row(0,24),
  row(0,10, 4,4, 0,10),                    // lightning crown
  row(0,9, 1,1, 4,4, 1,1, 0,9),
  row(0,9, 1,1, 2,4, 1,1, 0,9),            // head
  row(0,9, 1,1, 4,1, 3,2, 4,1, 1,1, 0,9),
  row(0,9, 1,1, 2,4, 1,1, 0,9),
  row(0,10, 1,4, 0,10),
  row(0,7, 1,1, 2,8, 1,1, 0,7),
  row(0,6, 1,1, 4,1, 2,8, 4,1, 1,1, 0,6), // lightning shoulders
  row(0,6, 1,1, 2,3, 4,2, 2,3, 1,1, 0,6), // lightning chest
  row(0,6, 1,1, 2,10, 1,1, 0,6),
  row(0,7, 1,1, 5,8, 1,1, 0,7),
  row(0,7, 1,1, 2,8, 1,1, 0,7),
  row(0,7, 1,1, 2,3, 0,2, 2,3, 1,1, 0,7),
  row(0,7, 1,1, 4,1, 2,2, 0,2, 2,2, 4,1, 1,1, 0,7),// lightning legs
  row(0,7, 1,1, 2,3, 0,2, 2,3, 1,1, 0,7),
  row(0,7, 1,1, 5,3, 0,2, 5,3, 1,1, 0,7),
  row(0,7, 1,4, 0,2, 1,4, 0,7),
  row(0,24),
  row(0,24),
  row(0,24),
  row(0,24),
  row(0,24),
  row(0,24),
];

// Mountain god: nature-bearded elder with staff
const MOUNTAIN_GOD: number[][] = [
  row(0,24),
  row(0,9, 4,2, 3,2, 4,2, 0,9),            // leaf crown
  row(0,9, 1,1, 2,4, 1,1, 0,9),
  row(0,8, 1,1, 2,6, 1,1, 0,8),            // head
  row(0,8, 1,1, 4,1, 2,4, 4,1, 1,1, 0,8),
  row(0,8, 1,1, 2,6, 1,1, 0,8),
  row(0,8, 5,1, 2,1, 1,4, 2,1, 5,1, 0,8), // beard
  row(0,8, 5,2, 1,4, 5,2, 0,8),            // beard
  row(0,7, 1,1, 3,8, 1,1, 0,7),            // robe
  row(0,6, 1,1, 3,10, 1,1, 0,6),
  row(0,6, 1,1, 2,4, 3,2, 2,4, 1,1, 0,6),
  row(0,6, 1,1, 3,10, 1,1, 0,6),
  row(0,7, 1,1, 5,8, 1,1, 0,7),
  row(0,7, 1,1, 3,8, 1,1, 0,7),
  row(0,7, 1,1, 3,8, 1,1, 0,7),
  row(0,8, 1,1, 3,6, 1,1, 0,8),
  row(0,8, 1,1, 5,6, 1,1, 0,8),
  row(0,8, 1,8, 0,8),
  // staff
  row(0,19, 4,2, 0,3),
  row(0,19, 1,1, 4,1, 0,3),
  row(0,19, 1,1, 0,4),
  row(0,19, 1,1, 0,4),
  row(0,19, 1,1, 0,4),
  row(0,24),
];

// ─── Per-monster unique silhouette map ──────────────────────────────────────────

const UNIQUE_SILHOUETTES: Partial<Record<MonsterId, number[][]>> = {
  dokkaebi_warrior: DOKKAEBI_WARRIOR,
  gumiho_guardian: GUMIHO_GUARDIAN,
  white_tiger: WHITE_TIGER,
  death_messenger: DEATH_MESSENGER,
  thunder_hero: THUNDER_HERO,
  mountain_god: MOUNTAIN_GOD,
};

// ─── Rarity palette modifiers ──────────────────────────────────────────────────
// Shift palette colours to be brighter/more saturated for higher rarities

function shiftColour(colour: number, amount: number): number {
  const r = Math.min(255, ((colour >> 16) & 0xff) + amount);
  const g = Math.min(255, ((colour >> 8) & 0xff) + amount);
  const b = Math.min(255, (colour & 0xff) + amount);
  return (r << 16) | (g << 8) | b;
}

const RARITY_SHIFTS: Record<string, number> = {
  C: 0,
  U: 15,
  R: 30,
  E: 45,
  L: 60,
};

export function getRarityPalette(basePalette: Palette, rarity?: string): Palette {
  const shift = RARITY_SHIFTS[rarity ?? 'C'] ?? 0;
  if (shift === 0) return basePalette;
  return basePalette.map((c, i) => i === 0 ? c : shiftColour(c, shift)) as Palette;
}

// ─── Public API ────────────────────────────────────────────────────────────────

export interface MonsterSpriteData {
  palette: Palette;
  silhouette: number[][];
}

/**
 * Get the pixel sprite data for a given monster.
 * Returns palette (6 colours) and 24x24 silhouette grid.
 */
export function getMonsterSpriteData(
  monsterId: MonsterId,
  tribe?: TribeId,
  monsterType?: string,
  rarity?: string,
): MonsterSpriteData {
  // Select palette
  const basePalette = tribe ? TRIBE_PALETTES[tribe] : NO_TRIBE_PALETTE;
  const palette = getRarityPalette(basePalette, rarity);

  // Select silhouette: unique > composed recipe > base by type > melee fallback
  const recipe = MONSTER_RECIPES[monsterId];
  const silhouette =
    UNIQUE_SILHOUETTES[monsterId] ??
    (recipe ? composeSilhouette(recipe) : null) ??
    BASE_SILHOUETTES[monsterType ?? 'melee'] ??
    MELEE_SILHOUETTE;

  return { palette, silhouette };
}

/**
 * Draw a monster sprite onto a Phaser Graphics object at (0,0).
 * The graphics should be sized 24x24 minimum.
 */
export function drawMonsterSprite(
  g: Phaser.GameObjects.Graphics,
  data: MonsterSpriteData,
  scale: number = 1,
): void {
  const { palette, silhouette } = data;
  for (let y = 0; y < 24; y++) {
    const row = silhouette[y];
    if (!row) continue;
    for (let x = 0; x < 24; x++) {
      const idx = row[x];
      if (!idx || idx === 0) continue; // transparent
      g.fillStyle(palette[idx] ?? 0xff00ff, 1);
      g.fillRect(x * scale, y * scale, scale, scale);
    }
  }
}
