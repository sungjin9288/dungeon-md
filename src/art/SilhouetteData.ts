/**
 * Composable silhouette system for 102 monsters.
 *
 * Instead of hand-drawing each 24×24 grid, monsters are composed from
 * reusable parts: head + body + accessory + overlay pattern.
 *
 * Palette indices: 0=transparent, 1=outline, 2=primary, 3=secondary, 4=highlight, 5=shadow
 */

import type { MonsterId } from '../data/monsters';

// ─── RLE helpers (same as PixelMonsters.ts) ──────────────────────────────────

function r(v: number, n: number): number[] { return Array(n).fill(v); }
function row(...segs: number[]): number[] {
  const out: number[] = [];
  for (let i = 0; i < segs.length; i += 2) out.push(...r(segs[i], segs[i + 1]));
  while (out.length < 24) out.push(0);
  return out.slice(0, 24);
}

// ─── Part types ──────────────────────────────────────────────────────────────

export type HeadId =
  | 'horned' | 'horned_crown' | 'fox_ears' | 'fox_multi'
  | 'hood' | 'skull' | 'tiger_ears' | 'nature_crown'
  | 'deer_antlers' | 'bear_head' | 'mask_round' | 'mask_angular'
  | 'dragon_horns' | 'rabbit_ears' | 'aquatic' | 'bird_crest'
  | 'ethereal' | 'serpent';

export type BodyId =
  | 'melee_stocky' | 'melee_slim' | 'melee_heavy'
  | 'ranged_slim' | 'ranged_tall'
  | 'magic_robe' | 'magic_kimono'
  | 'support_short' | 'support_elder'
  | 'beast_quad';

export type AccessoryId =
  | 'club' | 'sword' | 'dual_swords' | 'spear' | 'bow'
  | 'staff' | 'orb' | 'scythe' | 'shield'
  | 'tails_1' | 'tails_3' | 'tails_5' | 'tails_9'
  | 'wings' | 'trident';

export type OverlayId =
  | 'stripes' | 'scales' | 'ice_crystals' | 'fire_aura'
  | 'dark_wisps' | 'holy_glow' | 'venom_drip' | 'moonlight_shimmer';

export interface SilhouetteRecipe {
  head: HeadId;
  body: BodyId;
  accessory?: AccessoryId;
  overlay?: OverlayId;
}

// ─── Part grid type ──────────────────────────────────────────────────────────
// Each part is a sparse 24×24 grid. 0 = "don't draw here" (transparent/pass-through).

type PartGrid = number[][];

// ═══════════════════════════════════════════════════════════════════════════════
//  HEAD PARTS (rows 0-7 primary, can extend to row 8)
// ═══════════════════════════════════════════════════════════════════════════════

export const HEADS: Record<HeadId, PartGrid> = {
  horned: [
    row(0,24),
    row(0,8, 4,1, 0,5, 4,1, 0,9),               // horns
    row(0,9, 1,1, 4,4, 1,1, 0,9),
    row(0,8, 1,1, 2,6, 1,1, 0,8),
    row(0,8, 1,1, 4,1, 5,1, 4,2, 5,1, 4,1, 1,1, 0,8),
    row(0,8, 1,1, 2,2, 5,2, 2,2, 1,1, 0,8),
    row(0,9, 1,6, 0,9),
    row(0,24),
  ],
  horned_crown: [
    row(0,9, 4,1, 3,1, 4,1, 3,1, 4,1, 0,10),    // crown tips
    row(0,8, 4,1, 0,5, 4,1, 0,9),               // horns
    row(0,9, 1,1, 4,4, 1,1, 0,9),
    row(0,8, 1,1, 2,6, 1,1, 0,8),
    row(0,8, 1,1, 4,1, 5,1, 4,2, 5,1, 4,1, 1,1, 0,8),
    row(0,8, 1,1, 2,2, 5,2, 2,2, 1,1, 0,8),
    row(0,9, 1,6, 0,9),
    row(0,24),
  ],
  fox_ears: [
    row(0,24),
    row(0,8, 4,1, 0,5, 4,1, 0,9),               // fox ears
    row(0,8, 3,1, 4,1, 0,3, 4,1, 3,1, 0,9),
    row(0,9, 1,1, 2,4, 1,1, 0,9),
    row(0,9, 1,1, 4,1, 3,2, 4,1, 1,1, 0,9),
    row(0,9, 1,1, 2,1, 3,2, 2,1, 1,1, 0,9),
    row(0,10, 1,4, 0,10),
    row(0,24),
  ],
  fox_multi: [
    row(0,7, 4,1, 0,7, 4,1, 0,8),               // tall ears
    row(0,8, 3,1, 4,1, 0,3, 4,1, 3,1, 0,9),
    row(0,8, 3,1, 4,1, 0,3, 4,1, 3,1, 0,9),
    row(0,9, 1,1, 2,4, 1,1, 0,9),
    row(0,9, 1,1, 4,1, 3,2, 4,1, 1,1, 0,9),
    row(0,9, 1,1, 2,1, 3,2, 2,1, 1,1, 0,9),
    row(0,10, 1,4, 0,10),
    row(0,24),
  ],
  hood: [
    row(0,24),
    row(0,24),
    row(0,9, 1,1, 5,4, 1,1, 0,9),               // hood top
    row(0,8, 1,1, 5,1, 3,4, 5,1, 1,1, 0,8),
    row(0,8, 1,1, 3,2, 5,2, 3,2, 1,1, 0,8),     // shadowed face
    row(0,9, 1,1, 5,4, 1,1, 0,9),
    row(0,10, 1,4, 0,10),
    row(0,24),
  ],
  skull: [
    row(0,24),
    row(0,24),
    row(0,9, 1,1, 3,4, 1,1, 0,9),               // skull dome
    row(0,8, 1,1, 3,6, 1,1, 0,8),
    row(0,8, 1,1, 4,2, 5,2, 4,2, 1,1, 0,8),     // eye sockets
    row(0,9, 1,1, 5,1, 3,2, 5,1, 1,1, 0,9),     // teeth
    row(0,10, 1,4, 0,10),
    row(0,24),
  ],
  tiger_ears: [
    row(0,24),
    row(0,9, 4,1, 0,3, 4,1, 0,10),              // rounded ears
    row(0,8, 1,1, 2,6, 1,1, 0,8),
    row(0,8, 1,1, 4,2, 2,2, 4,2, 1,1, 0,8),     // tiger eyes
    row(0,8, 1,1, 2,2, 5,2, 2,2, 1,1, 0,8),     // snout
    row(0,9, 1,1, 2,4, 1,1, 0,9),
    row(0,10, 1,4, 0,10),
    row(0,24),
  ],
  nature_crown: [
    row(0,24),
    row(0,9, 4,2, 3,2, 4,2, 0,9),               // leaves
    row(0,9, 1,1, 2,4, 1,1, 0,9),
    row(0,8, 1,1, 2,6, 1,1, 0,8),
    row(0,8, 1,1, 4,1, 2,4, 4,1, 1,1, 0,8),
    row(0,8, 1,1, 2,6, 1,1, 0,8),
    row(0,9, 1,6, 0,9),
    row(0,24),
  ],
  deer_antlers: [
    row(0,7, 4,1, 3,1, 0,5, 3,1, 4,1, 0,8),     // antler tips
    row(0,8, 4,1, 3,1, 0,3, 3,1, 4,1, 0,9),     // antler base
    row(0,9, 1,1, 2,4, 1,1, 0,9),
    row(0,8, 1,1, 2,6, 1,1, 0,8),
    row(0,8, 1,1, 4,1, 2,4, 4,1, 1,1, 0,8),
    row(0,9, 1,1, 2,4, 1,1, 0,9),
    row(0,10, 1,4, 0,10),
    row(0,24),
  ],
  bear_head: [
    row(0,24),
    row(0,8, 3,1, 0,5, 3,1, 0,9),               // rounded ears
    row(0,7, 1,1, 2,8, 1,1, 0,7),                // wide head
    row(0,7, 1,1, 4,2, 2,4, 4,2, 1,1, 0,7),
    row(0,7, 1,1, 2,3, 5,2, 2,3, 1,1, 0,7),     // snout
    row(0,8, 1,1, 2,6, 1,1, 0,8),
    row(0,9, 1,6, 0,9),
    row(0,24),
  ],
  mask_round: [
    row(0,24),
    row(0,24),
    row(0,8, 1,1, 3,6, 1,1, 0,8),               // round mask top
    row(0,8, 1,1, 4,2, 3,2, 4,2, 1,1, 0,8),     // eye holes
    row(0,8, 1,1, 3,2, 2,2, 3,2, 1,1, 0,8),     // nose/mouth
    row(0,8, 1,1, 3,6, 1,1, 0,8),
    row(0,9, 1,1, 2,4, 1,1, 0,9),                // chin
    row(0,24),
  ],
  mask_angular: [
    row(0,24),
    row(0,9, 4,1, 3,4, 4,1, 0,9),               // angular top
    row(0,8, 1,1, 3,6, 1,1, 0,8),
    row(0,8, 1,1, 4,2, 5,2, 4,2, 1,1, 0,8),     // fierce eyes
    row(0,8, 1,1, 3,1, 2,4, 3,1, 1,1, 0,8),
    row(0,9, 1,1, 3,4, 1,1, 0,9),                // angular jaw
    row(0,10, 1,4, 0,10),
    row(0,24),
  ],
  dragon_horns: [
    row(0,7, 4,1, 0,7, 4,1, 0,8),               // tall horns
    row(0,8, 3,1, 0,5, 3,1, 0,9),
    row(0,8, 1,1, 2,6, 1,1, 0,8),
    row(0,8, 1,1, 4,2, 2,2, 4,2, 1,1, 0,8),     // dragon eyes
    row(0,8, 1,1, 2,2, 3,2, 2,2, 1,1, 0,8),     // scales on face
    row(0,9, 1,1, 2,4, 1,1, 0,9),
    row(0,10, 1,4, 0,10),
    row(0,24),
  ],
  rabbit_ears: [
    row(0,10, 4,1, 0,2, 4,1, 0,10),             // ear tips
    row(0,10, 3,1, 0,2, 3,1, 0,10),
    row(0,10, 3,1, 0,2, 3,1, 0,10),             // long ears
    row(0,9, 1,1, 2,4, 1,1, 0,9),
    row(0,9, 1,1, 4,1, 3,2, 4,1, 1,1, 0,9),
    row(0,9, 1,1, 2,4, 1,1, 0,9),
    row(0,10, 1,4, 0,10),
    row(0,24),
  ],
  aquatic: [
    row(0,24),
    row(0,10, 4,1, 3,3, 0,10),                  // dorsal fin
    row(0,9, 1,1, 3,1, 2,4, 1,1, 0,8),
    row(0,8, 1,1, 2,6, 1,1, 0,8),
    row(0,8, 1,1, 4,2, 3,2, 4,2, 1,1, 0,8),     // fish eyes
    row(0,9, 1,1, 2,4, 1,1, 0,9),
    row(0,10, 1,4, 0,10),
    row(0,24),
  ],
  bird_crest: [
    row(0,10, 4,1, 3,1, 4,1, 0,11),             // crest feathers
    row(0,9, 4,1, 3,1, 4,1, 0,12),
    row(0,9, 1,1, 2,4, 1,1, 0,9),
    row(0,8, 1,1, 2,6, 1,1, 0,8),
    row(0,8, 1,1, 4,2, 2,2, 4,2, 1,1, 0,8),     // keen eyes
    row(0,9, 1,1, 2,2, 4,2, 1,1, 0,9),           // beak
    row(0,10, 1,4, 0,10),
    row(0,24),
  ],
  ethereal: [
    row(0,9, 4,1, 3,4, 4,1, 0,9),               // halo glow
    row(0,10, 4,4, 0,10),
    row(0,9, 1,1, 2,4, 1,1, 0,9),
    row(0,9, 1,1, 4,1, 3,2, 4,1, 1,1, 0,9),
    row(0,9, 1,1, 2,4, 1,1, 0,9),
    row(0,9, 1,1, 3,4, 1,1, 0,9),
    row(0,10, 1,4, 0,10),
    row(0,24),
  ],
  serpent: [
    row(0,24),
    row(0,24),
    row(0,9, 1,1, 3,5, 1,1, 0,8),               // narrow elongated head
    row(0,8, 1,1, 4,2, 5,1, 4,2, 3,1, 1,1, 0,8),// slit eyes
    row(0,9, 1,1, 2,5, 1,1, 0,8),
    row(0,10, 1,1, 2,3, 1,1, 0,9),               // forked tongue hint
    row(0,11, 1,2, 0,11),
    row(0,24),
  ],
};

// ═══════════════════════════════════════════════════════════════════════════════
//  BODY PARTS (rows 7-17 primary)
// ═══════════════════════════════════════════════════════════════════════════════

export const BODIES: Record<BodyId, PartGrid> = {
  melee_stocky: [
    row(0,24), row(0,24), row(0,24), row(0,24), row(0,24), row(0,24), row(0,24),
    row(0,7, 1,1, 2,8, 1,1, 0,7),               // shoulders
    row(0,6, 1,1, 2,10, 1,1, 0,6),              // torso top
    row(0,6, 1,1, 3,4, 2,2, 3,4, 1,1, 0,6),    // torso detail
    row(0,6, 1,1, 2,10, 1,1, 0,6),
    row(0,6, 1,1, 5,3, 2,4, 5,3, 1,1, 0,6),    // belt
    row(0,7, 1,1, 2,8, 1,1, 0,7),               // waist
    row(0,7, 1,1, 2,3, 0,2, 2,3, 1,1, 0,7),    // legs
    row(0,7, 1,1, 2,3, 0,2, 2,3, 1,1, 0,7),
    row(0,7, 1,1, 2,3, 0,2, 2,3, 1,1, 0,7),
    row(0,7, 1,1, 5,3, 0,2, 5,3, 1,1, 0,7),    // boots
    row(0,7, 1,1, 1,3, 0,2, 1,3, 1,1, 0,7),    // feet
    row(0,24), row(0,24), row(0,24), row(0,24), row(0,24), row(0,24),
  ],
  melee_slim: [
    row(0,24), row(0,24), row(0,24), row(0,24), row(0,24), row(0,24), row(0,24),
    row(0,8, 1,1, 2,6, 1,1, 0,8),               // narrower shoulders
    row(0,8, 1,1, 2,6, 1,1, 0,8),
    row(0,8, 1,1, 3,2, 2,2, 3,2, 1,1, 0,8),
    row(0,8, 1,1, 2,6, 1,1, 0,8),
    row(0,8, 1,1, 5,2, 2,2, 5,2, 1,1, 0,8),    // belt
    row(0,9, 1,1, 2,4, 1,1, 0,9),               // slim waist
    row(0,9, 1,1, 2,1, 0,2, 2,1, 1,1, 0,9),
    row(0,9, 1,1, 2,1, 0,2, 2,1, 1,1, 0,9),
    row(0,9, 1,1, 2,1, 0,2, 2,1, 1,1, 0,9),
    row(0,9, 1,1, 5,1, 0,2, 5,1, 1,1, 0,9),
    row(0,9, 1,2, 0,2, 1,2, 0,9),
    row(0,24), row(0,24), row(0,24), row(0,24), row(0,24), row(0,24),
  ],
  melee_heavy: [
    row(0,24), row(0,24), row(0,24), row(0,24), row(0,24), row(0,24), row(0,24),
    row(0,5, 1,1, 2,12, 1,1, 0,5),              // extra-wide shoulders
    row(0,5, 1,1, 2,12, 1,1, 0,5),
    row(0,5, 1,1, 3,4, 2,4, 3,4, 1,1, 0,5),    // armor plates
    row(0,5, 1,1, 2,12, 1,1, 0,5),
    row(0,6, 1,1, 5,3, 2,4, 5,3, 1,1, 0,6),    // heavy belt
    row(0,6, 1,1, 2,10, 1,1, 0,6),
    row(0,6, 1,1, 2,4, 0,2, 2,4, 1,1, 0,6),    // thick legs
    row(0,6, 1,1, 2,4, 0,2, 2,4, 1,1, 0,6),
    row(0,6, 1,1, 5,4, 0,2, 5,4, 1,1, 0,6),
    row(0,6, 1,1, 5,4, 0,2, 5,4, 1,1, 0,6),
    row(0,6, 1,4, 0,4, 1,4, 0,6),               // heavy boots
    row(0,24), row(0,24), row(0,24), row(0,24), row(0,24), row(0,24),
  ],
  ranged_slim: [
    row(0,24), row(0,24), row(0,24), row(0,24), row(0,24), row(0,24), row(0,24),
    row(0,8, 1,1, 2,6, 1,1, 0,8),
    row(0,8, 1,1, 3,6, 1,1, 0,8),
    row(0,9, 1,1, 2,4, 1,1, 0,9),
    row(0,9, 1,1, 2,4, 1,1, 0,9),
    row(0,9, 1,1, 5,4, 1,1, 0,9),               // belt
    row(0,9, 1,1, 2,4, 1,1, 0,9),
    row(0,9, 1,1, 2,1, 0,2, 2,1, 1,1, 0,9),
    row(0,9, 1,1, 2,1, 0,2, 2,1, 1,1, 0,9),
    row(0,9, 1,1, 2,1, 0,2, 2,1, 1,1, 0,9),
    row(0,9, 1,1, 5,1, 0,2, 5,1, 1,1, 0,9),
    row(0,9, 1,2, 0,2, 1,2, 0,9),
    row(0,24), row(0,24), row(0,24), row(0,24), row(0,24), row(0,24),
  ],
  ranged_tall: [
    row(0,24), row(0,24), row(0,24), row(0,24), row(0,24), row(0,24), row(0,24),
    row(0,8, 1,1, 2,6, 1,1, 0,8),               // leaner
    row(0,7, 1,1, 3,8, 1,1, 0,7),
    row(0,8, 1,1, 2,6, 1,1, 0,8),
    row(0,8, 1,1, 2,6, 1,1, 0,8),
    row(0,8, 1,1, 5,6, 1,1, 0,8),               // belt
    row(0,8, 1,1, 2,6, 1,1, 0,8),
    row(0,8, 1,1, 2,2, 0,2, 2,2, 1,1, 0,8),    // longer legs
    row(0,8, 1,1, 2,2, 0,2, 2,2, 1,1, 0,8),
    row(0,8, 1,1, 2,2, 0,2, 2,2, 1,1, 0,8),
    row(0,8, 1,1, 5,2, 0,2, 5,2, 1,1, 0,8),
    row(0,8, 1,2, 0,4, 1,2, 0,8),
    row(0,24), row(0,24), row(0,24), row(0,24), row(0,24), row(0,24),
  ],
  magic_robe: [
    row(0,24), row(0,24), row(0,24), row(0,24), row(0,24), row(0,24), row(0,24),
    row(0,7, 1,1, 3,8, 1,1, 0,7),               // robe shoulders
    row(0,6, 1,1, 3,10, 1,1, 0,6),
    row(0,6, 1,1, 2,4, 3,2, 2,4, 1,1, 0,6),
    row(0,7, 1,1, 3,8, 1,1, 0,7),
    row(0,7, 1,1, 5,8, 1,1, 0,7),               // belt
    row(0,7, 1,1, 3,8, 1,1, 0,7),
    row(0,7, 1,1, 3,8, 1,1, 0,7),
    row(0,7, 1,1, 3,8, 1,1, 0,7),
    row(0,8, 1,1, 2,6, 1,1, 0,8),               // robe bottom
    row(0,8, 1,1, 5,6, 1,1, 0,8),
    row(0,8, 1,8, 0,8),                          // hem
    row(0,24), row(0,24), row(0,24), row(0,24), row(0,24), row(0,24),
  ],
  magic_kimono: [
    row(0,24), row(0,24), row(0,24), row(0,24), row(0,24), row(0,24), row(0,24),
    row(0,6, 1,1, 3,10, 1,1, 0,6),              // wide sleeves
    row(0,5, 1,1, 3,2, 2,6, 3,2, 1,1, 0,6),    // hanbok cross wrap
    row(0,6, 1,1, 2,3, 4,1, 2,3, 3,2, 1,1, 0,6),
    row(0,6, 1,1, 3,10, 1,1, 0,6),
    row(0,7, 1,1, 4,1, 5,6, 4,1, 1,1, 0,7),    // sash
    row(0,7, 1,1, 3,8, 1,1, 0,7),               // flowing skirt
    row(0,6, 1,1, 3,10, 1,1, 0,6),
    row(0,6, 1,1, 3,10, 1,1, 0,6),
    row(0,7, 1,1, 2,8, 1,1, 0,7),
    row(0,7, 1,1, 5,8, 1,1, 0,7),
    row(0,7, 1,10, 0,7),                         // hem
    row(0,24), row(0,24), row(0,24), row(0,24), row(0,24), row(0,24),
  ],
  support_short: [
    row(0,24), row(0,24), row(0,24), row(0,24), row(0,24), row(0,24), row(0,24),
    row(0,24),                                   // no row 7 (shorter)
    row(0,8, 1,1, 3,6, 1,1, 0,8),
    row(0,8, 1,1, 2,6, 1,1, 0,8),
    row(0,8, 1,1, 3,6, 1,1, 0,8),
    row(0,9, 1,1, 5,4, 1,1, 0,9),               // belt
    row(0,9, 1,1, 2,4, 1,1, 0,9),
    row(0,9, 1,1, 2,1, 0,2, 2,1, 1,1, 0,9),
    row(0,9, 1,1, 2,1, 0,2, 2,1, 1,1, 0,9),
    row(0,9, 1,1, 5,1, 0,2, 5,1, 1,1, 0,9),
    row(0,9, 1,2, 0,2, 1,2, 0,9),
    row(0,24),
    row(0,24), row(0,24), row(0,24), row(0,24), row(0,24), row(0,24),
  ],
  support_elder: [
    row(0,24), row(0,24), row(0,24), row(0,24), row(0,24), row(0,24), row(0,24),
    row(0,8, 5,1, 2,1, 1,4, 2,1, 5,1, 0,8),    // beard
    row(0,8, 5,2, 1,4, 5,2, 0,8),               // long beard
    row(0,7, 1,1, 3,8, 1,1, 0,7),               // robes
    row(0,6, 1,1, 3,10, 1,1, 0,6),
    row(0,7, 1,1, 5,8, 1,1, 0,7),               // belt/sash
    row(0,7, 1,1, 3,8, 1,1, 0,7),
    row(0,7, 1,1, 3,8, 1,1, 0,7),
    row(0,8, 1,1, 3,6, 1,1, 0,8),
    row(0,8, 1,1, 5,6, 1,1, 0,8),
    row(0,8, 1,8, 0,8),
    row(0,24),
    row(0,24), row(0,24), row(0,24), row(0,24), row(0,24), row(0,24),
  ],
  beast_quad: [
    row(0,24), row(0,24), row(0,24), row(0,24), row(0,24), row(0,24), row(0,24),
    row(0,24),                                   // head handled by head part
    row(0,5, 1,1, 2,12, 1,1, 0,5),              // long body
    row(0,5, 1,1, 3,4, 2,4, 3,4, 1,1, 0,5),
    row(0,5, 1,1, 2,12, 1,1, 0,5),
    row(0,5, 1,1, 5,4, 2,4, 5,4, 1,1, 0,5),    // belly
    row(0,5, 1,1, 2,12, 1,1, 0,5),
    row(0,5, 1,2, 2,1, 0,2, 2,2, 0,2, 2,1, 1,2, 0,5),// 4 legs
    row(0,5, 1,1, 2,1, 0,3, 2,2, 0,3, 2,1, 1,1, 0,5),
    row(0,5, 1,1, 5,1, 0,3, 5,2, 0,3, 5,1, 1,1, 0,5),
    row(0,5, 1,2, 0,4, 1,2, 0,4, 1,2, 0,5),    // paws
    row(0,24),
    row(0,24), row(0,24), row(0,24), row(0,24), row(0,24), row(0,24),
  ],
};

// ═══════════════════════════════════════════════════════════════════════════════
//  ACCESSORY PARTS (rows 14-23 primary, weapon/tail overlays)
// ═══════════════════════════════════════════════════════════════════════════════

export const ACCESSORIES: Record<AccessoryId, PartGrid> = {
  club: [
    ...Array(18).fill(row(0,24)),
    row(0,18, 4,2, 1,1, 0,3),
    row(0,18, 4,3, 0,3),
    row(0,18, 4,2, 1,1, 0,3),
    row(0,19, 1,1, 0,4),
    row(0,19, 1,1, 0,4),
    row(0,24),
  ],
  sword: [
    ...Array(18).fill(row(0,24)),
    row(0,19, 4,1, 0,4),
    row(0,19, 1,1, 0,4),
    row(0,19, 4,1, 0,4),
    row(0,19, 1,1, 0,4),
    row(0,18, 5,1, 4,1, 0,4),
    row(0,24),
  ],
  dual_swords: [
    ...Array(18).fill(row(0,24)),
    row(0,2, 4,1, 0,16, 4,1, 0,4),
    row(0,3, 1,1, 0,15, 1,1, 0,4),
    row(0,4, 4,1, 0,14, 4,1, 0,3),
    row(0,5, 1,1, 0,14, 1,1, 0,2),
    row(0,24),
    row(0,24),
  ],
  spear: [
    ...Array(17).fill(row(0,24)),
    row(0,19, 4,2, 0,3),
    row(0,19, 4,1, 1,1, 0,3),
    row(0,20, 1,1, 0,3),
    row(0,20, 1,1, 0,3),
    row(0,20, 1,1, 0,3),
    row(0,20, 1,1, 0,3),
    row(0,24),
  ],
  bow: [
    ...Array(18).fill(row(0,24)),
    row(0,3, 4,1, 0,20),
    row(0,2, 1,1, 4,1, 1,1, 0,19),
    row(0,3, 4,1, 0,20),
    row(0,24),
    row(0,24),
    row(0,24),
  ],
  staff: [
    ...Array(18).fill(row(0,24)),
    row(0,19, 4,2, 0,3),
    row(0,19, 1,1, 4,1, 0,3),
    row(0,19, 1,1, 0,4),
    row(0,19, 1,1, 0,4),
    row(0,19, 4,1, 0,4),
    row(0,24),
  ],
  orb: [
    ...Array(18).fill(row(0,24)),
    row(0,4, 4,1, 3,1, 4,1, 0,17),
    row(0,4, 3,1, 4,1, 3,1, 0,17),
    row(0,4, 4,1, 3,1, 4,1, 0,17),
    row(0,24),
    row(0,24),
    row(0,24),
  ],
  scythe: [
    ...Array(18).fill(row(0,24)),
    row(0,1, 4,3, 0,20),
    row(0,1, 1,1, 0,1, 4,1, 1,1, 0,19),
    row(0,4, 1,1, 0,19),
    row(0,4, 1,1, 0,19),
    row(0,24),
    row(0,24),
  ],
  shield: [
    ...Array(7).fill(row(0,24)),
    row(0,2, 4,1, 3,2, 4,1, 0,18),              // shield top
    row(0,2, 3,1, 2,2, 3,1, 0,18),
    row(0,2, 3,1, 4,2, 3,1, 0,18),              // shield emblem
    row(0,2, 3,1, 2,2, 3,1, 0,18),
    row(0,3, 1,1, 3,2, 1,1, 0,17),
    row(0,4, 1,2, 0,18),                         // shield bottom
    ...Array(11).fill(row(0,24)),
  ],
  tails_1: [
    ...Array(17).fill(row(0,24)),
    row(0,3, 3,2, 0,19),
    row(0,2, 4,1, 3,1, 0,20),
    row(0,2, 3,2, 0,20),
    row(0,24), row(0,24), row(0,24), row(0,24),
  ],
  tails_3: [
    ...Array(17).fill(row(0,24)),
    row(0,2, 3,2, 0,3, 4,1, 0,9, 3,2, 0,5),
    row(0,1, 4,1, 3,1, 0,3, 3,1, 4,1, 0,7, 4,1, 3,1, 0,5),
    row(0,1, 3,2, 0,4, 3,2, 0,7, 3,2, 0,4),
    row(0,24), row(0,24), row(0,24), row(0,24),
  ],
  tails_5: [
    ...Array(17).fill(row(0,24)),
    row(0,1, 3,2, 0,2, 4,1, 0,3, 4,1, 0,6, 3,2, 0,6),
    row(0,1, 4,1, 3,1, 0,1, 3,2, 0,2, 3,2, 0,4, 4,1, 3,1, 0,5),
    row(0,1, 3,2, 0,1, 4,1, 3,1, 0,2, 4,1, 3,1, 0,3, 3,2, 0,5),
    row(0,24), row(0,24), row(0,24), row(0,24),
  ],
  tails_9: [
    ...Array(16).fill(row(0,24)),
    row(0,1, 3,1, 0,1, 3,1, 0,1, 4,1, 0,1, 3,1, 0,1, 4,1, 0,5, 3,1, 0,1, 3,1, 0,5),
    row(0,1, 4,1, 3,1, 0,1, 3,1, 4,1, 0,1, 4,1, 3,1, 4,1, 0,3, 4,1, 3,1, 0,1, 3,1, 0,4),
    row(0,1, 3,2, 0,1, 4,1, 3,1, 0,2, 3,2, 0,4, 3,1, 4,1, 0,1, 4,1, 0,4),
    row(0,2, 3,1, 0,2, 3,1, 0,3, 3,1, 0,5, 3,1, 0,2, 3,1, 0,3),
    row(0,24), row(0,24), row(0,24), row(0,24),
  ],
  wings: [
    ...Array(7).fill(row(0,24)),
    row(0,2, 4,1, 3,2, 0,8, 3,2, 4,1, 0,8),    // wing tips
    row(0,3, 3,2, 0,8, 3,2, 0,9),
    row(0,4, 3,1, 0,8, 3,1, 0,10),
    ...Array(14).fill(row(0,24)),
  ],
  trident: [
    ...Array(17).fill(row(0,24)),
    row(0,18, 4,1, 1,1, 4,1, 0,3),              // prongs
    row(0,19, 4,1, 0,4),
    row(0,19, 1,1, 0,4),
    row(0,19, 1,1, 0,4),
    row(0,19, 1,1, 0,4),
    row(0,19, 5,1, 0,4),
    row(0,24),
  ],
};

// ═══════════════════════════════════════════════════════════════════════════════
//  OVERLAY PATTERNS (modify existing pixel palette indices)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Overlay functions modify palette indices on filled pixels.
 * They receive the grid AFTER head+body+accessory composition,
 * and return a modified grid.
 */
export type OverlayFn = (grid: number[][]) => number[][];

function makeStripedOverlay(): OverlayFn {
  return (grid) => {
    const out = grid.map(r => [...r]);
    for (let y = 8; y < 18; y += 2) {
      for (let x = 0; x < 24; x++) {
        if (out[y][x] === 2) out[y][x] = 5; // primary → shadow
      }
    }
    return out;
  };
}

function makeScalesOverlay(): OverlayFn {
  return (grid) => {
    const out = grid.map(r => [...r]);
    for (let y = 8; y < 17; y++) {
      for (let x = 0; x < 24; x++) {
        if (out[y][x] === 2 && (x + y) % 3 === 0) out[y][x] = 3;
      }
    }
    return out;
  };
}

function makeIceCrystalsOverlay(): OverlayFn {
  return (grid) => {
    const out = grid.map(r => [...r]);
    for (let y = 7; y < 18; y++) {
      for (let x = 0; x < 24; x++) {
        if (out[y][x] === 2 && (x * 7 + y * 13) % 11 === 0) out[y][x] = 4;
      }
    }
    return out;
  };
}

function makeFireAuraOverlay(): OverlayFn {
  return (grid) => {
    const out = grid.map(r => [...r]);
    // Add flickering highlight at edges
    for (let y = 7; y < 18; y++) {
      for (let x = 1; x < 23; x++) {
        if (out[y][x] === 0 && out[y][x - 1] >= 1 && out[y][x - 1] <= 5) {
          if ((x + y) % 3 === 0) out[y][x] = 4; // highlight at edges
        }
      }
    }
    return out;
  };
}

function makeDarkWispsOverlay(): OverlayFn {
  return (grid) => {
    const out = grid.map(r => [...r]);
    for (let y = 7; y < 18; y++) {
      for (let x = 0; x < 24; x++) {
        if (out[y][x] === 2 && (x * 3 + y * 7) % 5 === 0) out[y][x] = 5;
        if (out[y][x] === 3 && (x * 5 + y * 3) % 7 === 0) out[y][x] = 5;
      }
    }
    return out;
  };
}

function makeHolyGlowOverlay(): OverlayFn {
  return (grid) => {
    const out = grid.map(r => [...r]);
    for (let y = 7; y < 18; y++) {
      for (let x = 0; x < 24; x++) {
        if (out[y][x] === 2 && (x + y) % 4 === 0) out[y][x] = 4;
        if (out[y][x] === 5 && (x + y) % 3 === 0) out[y][x] = 3;
      }
    }
    return out;
  };
}

function makeVenomDripOverlay(): OverlayFn {
  return (grid) => {
    const out = grid.map(r => [...r]);
    // Drip marks on lower body
    for (let y = 13; y < 18; y++) {
      for (let x = 0; x < 24; x++) {
        if (out[y][x] === 2 && (x * 11 + y * 3) % 7 === 0) out[y][x] = 3;
      }
    }
    return out;
  };
}

function makeMoonlightShimmerOverlay(): OverlayFn {
  return (grid) => {
    const out = grid.map(r => [...r]);
    for (let y = 5; y < 18; y++) {
      for (let x = 0; x < 24; x++) {
        if (out[y][x] === 2 && (x * 5 + y * 11) % 9 === 0) out[y][x] = 4;
      }
    }
    return out;
  };
}

export const OVERLAYS: Record<OverlayId, OverlayFn> = {
  stripes:            makeStripedOverlay(),
  scales:             makeScalesOverlay(),
  ice_crystals:       makeIceCrystalsOverlay(),
  fire_aura:          makeFireAuraOverlay(),
  dark_wisps:         makeDarkWispsOverlay(),
  holy_glow:          makeHolyGlowOverlay(),
  venom_drip:         makeVenomDripOverlay(),
  moonlight_shimmer:  makeMoonlightShimmerOverlay(),
};

// ═══════════════════════════════════════════════════════════════════════════════
//  COMPOSITION ENGINE
// ═══════════════════════════════════════════════════════════════════════════════

const compositionCache = new Map<string, number[][]>();

export function composeSilhouette(recipe: SilhouetteRecipe): number[][] {
  const key = `${recipe.head}|${recipe.body}|${recipe.accessory ?? ''}|${recipe.overlay ?? ''}`;
  const cached = compositionCache.get(key);
  if (cached) return cached;

  // Start with blank 24×24
  const grid: number[][] = Array.from({ length: 24 }, () => Array(24).fill(0));

  // Layer 1: Body
  const body = BODIES[recipe.body];
  if (body) {
    for (let y = 0; y < 24; y++)
      for (let x = 0; x < 24; x++)
        if (body[y]?.[x]) grid[y][x] = body[y][x];
  }

  // Layer 2: Head (overwrites non-zero pixels)
  const head = HEADS[recipe.head];
  if (head) {
    for (let y = 0; y < 8; y++)
      for (let x = 0; x < 24; x++)
        if (head[y]?.[x]) grid[y][x] = head[y][x];
  }

  // Layer 3: Accessory (overwrites non-zero pixels)
  if (recipe.accessory) {
    const acc = ACCESSORIES[recipe.accessory];
    if (acc) {
      for (let y = 0; y < 24; y++)
        for (let x = 0; x < 24; x++)
          if (acc[y]?.[x]) grid[y][x] = acc[y][x];
    }
  }

  // Layer 4: Overlay pattern
  let result = grid;
  if (recipe.overlay) {
    const fn = OVERLAYS[recipe.overlay];
    if (fn) result = fn(grid);
  }

  compositionCache.set(key, result);
  return result;
}

// ═══════════════════════════════════════════════════════════════════════════════
//  MONSTER RECIPES — all 102 monsters
// ═══════════════════════════════════════════════════════════════════════════════

export const MONSTER_RECIPES: Partial<Record<MonsterId, SilhouetteRecipe>> = {
  // ─── Chapter 1 ─────────────────────────────────────────────────────────────
  // dokkaebi_warrior: has UNIQUE_SILHOUETTE (skip)
  dokkaebi_junior:       { head: 'horned',        body: 'melee_slim' },
  village_archer:        { head: 'nature_crown',   body: 'ranged_slim',   accessory: 'bow' },
  gold_turtle:           { head: 'nature_crown',   body: 'support_short' },
  fire_dokkaebi:         { head: 'horned',        body: 'magic_robe',    accessory: 'orb',   overlay: 'fire_aura' },
  sage:                  { head: 'nature_crown',   body: 'support_elder', accessory: 'staff' },

  // ─── Chapter 2 ─────────────────────────────────────────────────────────────
  // gumiho_guardian: has UNIQUE_SILHOUETTE (skip)
  frost_spirit:          { head: 'ethereal',      body: 'magic_robe',    accessory: 'orb',   overlay: 'ice_crystals' },
  // white_tiger: has UNIQUE_SILHOUETTE (skip)
  iron_mask:             { head: 'mask_angular',  body: 'melee_heavy',   accessory: 'shield' },

  // ─── Chapter 3 ─────────────────────────────────────────────────────────────
  // death_messenger: has UNIQUE_SILHOUETTE (skip)
  // thunder_hero: has UNIQUE_SILHOUETTE (skip)
  ghost_hunter:          { head: 'hood',          body: 'ranged_slim',   accessory: 'bow',   overlay: 'dark_wisps' },
  mask_dancer:           { head: 'mask_round',    body: 'melee_slim',    accessory: 'dual_swords' },
  venom_warrior:         { head: 'serpent',       body: 'melee_slim',    accessory: 'sword', overlay: 'venom_drip' },

  // ─── Chapter 4 ─────────────────────────────────────────────────────────────
  celestial_dancer:      { head: 'ethereal',      body: 'magic_kimono',  accessory: 'orb',   overlay: 'holy_glow' },
  three_legged_crow:     { head: 'bird_crest',    body: 'ranged_tall',   accessory: 'bow' },
  great_serpent:         { head: 'serpent',        body: 'melee_heavy',                       overlay: 'scales' },
  moon_rabbit_sage:      { head: 'rabbit_ears',   body: 'support_elder', accessory: 'staff', overlay: 'moonlight_shimmer' },

  // ─── Chapter 5 ─────────────────────────────────────────────────────────────
  // mountain_god: has UNIQUE_SILHOUETTE (skip)
  volcanic_warrior:      { head: 'horned',         body: 'melee_heavy',   accessory: 'sword',  overlay: 'fire_aura' },
  storm_archer:          { head: 'ethereal',       body: 'ranged_tall',   accessory: 'bow',    overlay: 'moonlight_shimmer' },
  abyss_mage:            { head: 'skull',          body: 'magic_robe',    accessory: 'staff',  overlay: 'dark_wisps' },
  celestial_healer:      { head: 'ethereal',       body: 'support_elder', accessory: 'orb',    overlay: 'holy_glow' },
  mask_berserker:        { head: 'mask_angular',   body: 'melee_slim',    accessory: 'dual_swords', overlay: 'fire_aura' },
  sea_dragon_lord:       { head: 'dragon_horns',   body: 'ranged_tall',   accessory: 'trident', overlay: 'ice_crystals' },
  fox_spirit_elder:      { head: 'fox_multi',      body: 'magic_kimono',  accessory: 'tails_5', overlay: 'dark_wisps' },

  // ─── Chapter 6 — dokkaebi tribe ───────────────────────────────────────────
  thunder_dokkaebi:      { head: 'horned',         body: 'melee_stocky',  accessory: 'club' },
  ice_dokkaebi:          { head: 'horned',         body: 'melee_stocky',  accessory: 'club',  overlay: 'ice_crystals' },
  healer_dokkaebi:       { head: 'horned',         body: 'support_short', accessory: 'staff', overlay: 'holy_glow' },
  dokkaebi_captain:      { head: 'horned',         body: 'melee_heavy',   accessory: 'sword' },
  dokkaebi_bomber:       { head: 'horned',         body: 'ranged_slim',   accessory: 'orb',   overlay: 'fire_aura' },
  dokkaebi_duelist:      { head: 'horned',         body: 'melee_slim',    accessory: 'dual_swords' },
  poison_dokkaebi:       { head: 'horned',         body: 'melee_slim',    accessory: 'sword', overlay: 'venom_drip' },
  shadow_dokkaebi:       { head: 'horned',         body: 'melee_slim',    accessory: 'sword', overlay: 'dark_wisps' },
  shield_dokkaebi:       { head: 'horned',         body: 'melee_heavy',   accessory: 'shield' },
  dokkaebi_shaman:       { head: 'horned',         body: 'magic_robe',    accessory: 'staff' },
  dokkaebi_king:         { head: 'horned_crown',   body: 'melee_heavy',   accessory: 'club' },
  storm_dokkaebi:        { head: 'horned',         body: 'ranged_slim',   accessory: 'orb' },
  gold_dokkaebi:         { head: 'horned',         body: 'support_short', accessory: 'orb' },
  fire_dokkaebi_king:    { head: 'horned_crown',   body: 'magic_robe',    accessory: 'orb',   overlay: 'fire_aura' },
  black_dragon_dokkaebi: { head: 'dragon_horns',   body: 'melee_heavy',   accessory: 'sword', overlay: 'scales' },
  dokkaebi_general:      { head: 'horned_crown',   body: 'melee_heavy',   accessory: 'spear' },
  dokkaebi_god_king:     { head: 'horned_crown',   body: 'melee_heavy',   accessory: 'club',  overlay: 'fire_aura' },

  // ─── Chapter 6 — gumiho tribe ─────────────────────────────────────────────
  one_tail_fox:          { head: 'fox_ears',       body: 'melee_slim',    accessory: 'tails_1' },
  three_tail_fox:        { head: 'fox_ears',       body: 'magic_robe',    accessory: 'tails_3' },
  five_tail_fox:         { head: 'fox_multi',      body: 'magic_robe',    accessory: 'tails_5' },
  spring_gumiho:         { head: 'fox_ears',       body: 'magic_kimono',  accessory: 'orb',   overlay: 'holy_glow' },
  summer_gumiho:         { head: 'fox_ears',       body: 'magic_kimono',  accessory: 'orb',   overlay: 'fire_aura' },
  ice_gumiho:            { head: 'fox_ears',       body: 'magic_kimono',  accessory: 'orb',   overlay: 'ice_crystals' },
  thunder_gumiho:        { head: 'fox_ears',       body: 'magic_robe',    accessory: 'staff' },
  fox_warrior:           { head: 'fox_ears',       body: 'melee_slim',    accessory: 'dual_swords' },
  gumiho_queen:          { head: 'fox_multi',      body: 'magic_kimono',  accessory: 'tails_5', overlay: 'moonlight_shimmer' },
  gumiho_goddess:        { head: 'fox_multi',      body: 'magic_kimono',  accessory: 'tails_9', overlay: 'holy_glow' },
  gumiho_archmage:       { head: 'fox_multi',      body: 'magic_robe',    accessory: 'staff',  overlay: 'fire_aura' },
  celestial_fairy:       { head: 'ethereal',       body: 'magic_kimono',  accessory: 'wings',  overlay: 'holy_glow' },
  gumiho_demon:          { head: 'fox_multi',      body: 'magic_robe',    accessory: 'tails_9', overlay: 'dark_wisps' },

  // ─── Chapter 6 — sansin tribe ─────────────────────────────────────────────
  deer_god:              { head: 'deer_antlers',   body: 'support_elder', accessory: 'staff',  overlay: 'holy_glow' },
  bear_god:              { head: 'bear_head',      body: 'beast_quad' },
  mountain_spirit_boy:   { head: 'nature_crown',   body: 'support_short', accessory: 'staff' },
  phoenix:               { head: 'bird_crest',     body: 'ranged_tall',   accessory: 'wings',  overlay: 'fire_aura' },
  thousand_pine:         { head: 'nature_crown',   body: 'support_elder', accessory: 'staff',  overlay: 'holy_glow' },
  mountain_spirit:       { head: 'nature_crown',   body: 'support_elder', accessory: 'staff' },
  mountain_god_complete: { head: 'nature_crown',   body: 'support_elder', accessory: 'staff',  overlay: 'holy_glow' },

  // ─── Chapter 6 — sea tribe ────────────────────────────────────────────────
  sea_dragon_archer:     { head: 'aquatic',        body: 'ranged_tall',   accessory: 'bow',    overlay: 'scales' },
  jellyfish_sorcerer:    { head: 'ethereal',       body: 'magic_robe',    accessory: 'orb',    overlay: 'moonlight_shimmer' },
  sea_general:           { head: 'aquatic',        body: 'melee_heavy',   accessory: 'trident', overlay: 'scales' },
  sea_witch:             { head: 'aquatic',        body: 'magic_kimono',  accessory: 'staff',  overlay: 'dark_wisps' },
  shark_warrior:         { head: 'aquatic',        body: 'melee_heavy',   accessory: 'sword',  overlay: 'scales' },
  kraken_soldier:        { head: 'aquatic',        body: 'melee_heavy',   accessory: 'trident' },
  dragon_king_guardian:  { head: 'dragon_horns',   body: 'melee_heavy',   accessory: 'trident', overlay: 'scales' },
  sea_god_complete:      { head: 'aquatic',        body: 'melee_heavy',   accessory: 'trident', overlay: 'moonlight_shimmer' },

  // ─── Chapter 6 — underworld tribe ─────────────────────────────────────────
  skeleton_knight:       { head: 'skull',          body: 'melee_heavy',   accessory: 'sword',  overlay: 'dark_wisps' },
  soul_guardian:         { head: 'skull',          body: 'melee_heavy',   accessory: 'shield', overlay: 'dark_wisps' },
  underworld_archer:     { head: 'hood',           body: 'ranged_slim',   accessory: 'bow',    overlay: 'dark_wisps' },
  underworld_witch:      { head: 'hood',           body: 'magic_robe',    accessory: 'staff',  overlay: 'dark_wisps' },
  hell_guard:            { head: 'skull',          body: 'melee_heavy',   accessory: 'spear' },
  yomra_warrior:         { head: 'skull',          body: 'melee_stocky',  accessory: 'club',   overlay: 'fire_aura' },
  ghost_king:            { head: 'hood',           body: 'magic_robe',    accessory: 'scythe', overlay: 'dark_wisps' },
  spirit_summoner:       { head: 'hood',           body: 'magic_robe',    accessory: 'orb',    overlay: 'dark_wisps' },
  underworld_complete:   { head: 'skull',          body: 'melee_heavy',   accessory: 'scythe', overlay: 'fire_aura' },

  // ─── Chapter 6 — mask tribe ───────────────────────────────────────────────
  mask_archer:           { head: 'mask_round',     body: 'ranged_slim',   accessory: 'bow' },
  bongsan_maskman:       { head: 'mask_round',     body: 'melee_slim',    accessory: 'dual_swords' },
  cheoyong_warrior:      { head: 'mask_angular',   body: 'melee_stocky',  accessory: 'sword' },
  mask_wizard:           { head: 'mask_round',     body: 'magic_robe',    accessory: 'staff' },
  thunder_mask_warrior:  { head: 'mask_angular',   body: 'melee_heavy',   accessory: 'sword' },
  glacier_warrior:       { head: 'mask_angular',   body: 'melee_heavy',   accessory: 'sword',  overlay: 'ice_crystals' },
  great_mask_god:        { head: 'mask_angular',   body: 'melee_heavy',   accessory: 'club',   overlay: 'fire_aura' },
  mask_complete:         { head: 'mask_angular',   body: 'melee_heavy',   accessory: 'dual_swords', overlay: 'holy_glow' },

  // ─── Chapter 6 — moonlight tribe ──────────────────────────────────────────
  moonlight_rabbit:      { head: 'rabbit_ears',    body: 'support_short', accessory: 'staff',  overlay: 'moonlight_shimmer' },
  starlight_fairy:       { head: 'ethereal',       body: 'magic_kimono',  accessory: 'wings',  overlay: 'moonlight_shimmer' },
  crescent_archer:       { head: 'ethereal',       body: 'ranged_tall',   accessory: 'bow',    overlay: 'moonlight_shimmer' },
  moonlight_tiger:       { head: 'tiger_ears',     body: 'beast_quad',                          overlay: 'stripes' },
  galaxy_warrior:        { head: 'ethereal',       body: 'melee_stocky',  accessory: 'sword',  overlay: 'moonlight_shimmer' },
  full_moon_sorcerer:    { head: 'ethereal',       body: 'magic_robe',    accessory: 'orb',    overlay: 'moonlight_shimmer' },
  solar_eclipse_warrior: { head: 'ethereal',       body: 'melee_heavy',   accessory: 'sword',  overlay: 'fire_aura' },
  lunar_eclipse_mage:    { head: 'ethereal',       body: 'magic_robe',    accessory: 'staff',  overlay: 'dark_wisps' },
  moonlight_complete:    { head: 'ethereal',       body: 'melee_heavy',   accessory: 'dual_swords', overlay: 'moonlight_shimmer' },

  // ─── Chapter 6 — dragon tribe ─────────────────────────────────────────────
  red_dragon_warrior:    { head: 'dragon_horns',   body: 'melee_stocky',  accessory: 'sword',  overlay: 'fire_aura' },
  blue_dragon_guardian:  { head: 'dragon_horns',   body: 'melee_heavy',   accessory: 'shield', overlay: 'ice_crystals' },
  gold_dragon_sage:      { head: 'dragon_horns',   body: 'support_elder', accessory: 'staff',  overlay: 'holy_glow' },
  black_dragon_assassin: { head: 'dragon_horns',   body: 'melee_slim',    accessory: 'dual_swords', overlay: 'dark_wisps' },
  white_dragon_healer:   { head: 'dragon_horns',   body: 'support_short', accessory: 'orb',    overlay: 'holy_glow' },
  blue_dragon_archmage:  { head: 'dragon_horns',   body: 'magic_robe',    accessory: 'staff',  overlay: 'ice_crystals' },
  banya_guardian:        { head: 'dragon_horns',   body: 'melee_heavy',   accessory: 'trident', overlay: 'scales' },
  dragon_avatar:         { head: 'dragon_horns',   body: 'melee_heavy',   accessory: 'wings',  overlay: 'fire_aura' },
  five_dragon_complete:  { head: 'dragon_horns',   body: 'melee_heavy',   accessory: 'wings',  overlay: 'scales' },
};
