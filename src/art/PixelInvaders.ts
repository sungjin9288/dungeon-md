/**
 * Procedural pixel-art invader sprites (24×24).
 *
 * Invaders share the player monsters' pixel DNA (same 24×24 grid, same 6-colour
 * palette indices, same drawMonsterSprite renderer) so the whole battle reads as
 * one cohesive pixel art style — the painted AI invader JPGs clashed with the
 * pixel monsters/rooms and are no longer used.
 *
 * Each invader type maps to one of a handful of archetype silhouettes + a
 * faction palette. Most humanoid archetypes reuse the player monster
 * silhouettes; KNIGHT (shield) and GOLEM (blocky stone) are built here so the
 * horde has its own distinct heavies.
 *
 * Palette indices: 0 = transparent, 1 = outline, 2 = primary, 3 = secondary,
 * 4 = highlight, 5 = shadow.
 */

import type { InvaderType } from '../data/invaders';
import {
  type Palette,
  type MonsterSpriteData,
  MELEE_SILHOUETTE,
  RANGED_SILHOUETTE,
  MAGIC_SILHOUETTE,
  WHITE_TIGER,
  DEATH_MESSENGER,
  GUMIHO_GUARDIAN,
} from './PixelMonsters';

// ─── Faction palettes ────────────────────────────────────────────────────────

export type FactionId =
  | 'human' | 'steel' | 'iron' | 'void' | 'undead'
  | 'golem' | 'beast' | 'celestial' | 'berserker' | 'venom';

//               transparent  outline    primary    secondary  highlight  shadow
export const INVADER_PALETTES: Record<FactionId, Palette> = {
  human:     [0x000000, 0x3a2a18, 0x9a6a3a, 0xc89a5a, 0xe8c890, 0x241a0e],
  steel:     [0x000000, 0x222830, 0x687480, 0x9aa6b2, 0xd4dce4, 0x12161c],
  iron:      [0x000000, 0x1c2430, 0x44566a, 0x7e90a6, 0xc2d0e0, 0x0e1218],
  void:      [0x000000, 0x1a0030, 0x5520a0, 0x9040d8, 0xc488ff, 0x0c0018],
  undead:    [0x000000, 0x283024, 0x5a6a50, 0x9aae88, 0xd8e6c4, 0x121810],
  golem:     [0x000000, 0x2a2620, 0x5e564a, 0x8e8676, 0xc4bca8, 0x16120e],
  beast:     [0x000000, 0x401400, 0xb04a1e, 0xe07a30, 0xffb060, 0x200800],
  celestial: [0x000000, 0x9a7800, 0xffd24a, 0xffe9a8, 0xffffff, 0x5a4810],
  berserker: [0x000000, 0x3a0c0c, 0xb83020, 0xe45438, 0xff8a66, 0x1c0606],
  venom:     [0x000000, 0x103010, 0x2a8a2a, 0x4fc24f, 0x9aff9a, 0x061806],
};

// ─── Grid helpers (programmatic silhouettes) ─────────────────────────────────

function blankGrid(): number[][] {
  return Array.from({ length: 24 }, () => Array<number>(24).fill(0));
}

function fillRect(g: number[][], x0: number, y0: number, w: number, h: number, v: number): void {
  for (let y = y0; y < y0 + h; y++) {
    for (let x = x0; x < x0 + w; x++) {
      if (y >= 0 && y < 24 && x >= 0 && x < 24) g[y][x] = v;
    }
  }
}

function outlineRect(g: number[][], x0: number, y0: number, w: number, h: number): void {
  for (let x = x0; x < x0 + w; x++) {
    if (y0 >= 0 && y0 < 24) g[y0][x] = 1;
    if (y0 + h - 1 >= 0 && y0 + h - 1 < 24) g[y0 + h - 1][x] = 1;
  }
  for (let y = y0; y < y0 + h; y++) {
    if (x0 >= 0 && x0 < 24) g[y][x0] = 1;
    if (x0 + w - 1 >= 0 && x0 + w - 1 < 24) g[y][x0 + w - 1] = 1;
  }
}

// Knight: the player melee figure + a plumed helm crest and a left-hand shield.
function buildKnight(): number[][] {
  const g = MELEE_SILHOUETTE.map(r => r.slice());
  // Plume crest above the helm.
  g[0][11] = 4; g[0][12] = 4;
  g[1][11] = 4; g[1][12] = 4;
  // Round shield on the left flank (cols 3-5, rows 9-14).
  for (let y = 9; y <= 14; y++) { g[y][3] = 1; g[y][4] = 3; g[y][5] = 3; }
  g[9][3] = 1; g[9][4] = 1; g[9][5] = 1;       // top rim
  g[14][3] = 1; g[14][4] = 1; g[14][5] = 1;    // bottom rim
  g[11][4] = 4; g[11][5] = 4;                   // boss highlight
  return g;
}

// Golem: a blocky stone bruiser — wide torso, slab arms, stumpy legs.
function buildGolem(): number[][] {
  const g = blankGrid();
  // Head
  fillRect(g, 9, 3, 6, 5, 2); outlineRect(g, 9, 3, 6, 5);
  g[5][10] = 4; g[5][13] = 4;                   // glowing eyes
  // Torso
  fillRect(g, 5, 8, 14, 9, 2); outlineRect(g, 5, 8, 14, 9);
  fillRect(g, 10, 9, 4, 6, 5);                  // chest fissure
  // Slab arms
  fillRect(g, 2, 9, 3, 7, 2); outlineRect(g, 2, 9, 3, 7);
  fillRect(g, 19, 9, 3, 7, 2); outlineRect(g, 19, 9, 3, 7);
  // Stumpy legs
  fillRect(g, 7, 17, 4, 5, 2); outlineRect(g, 7, 17, 4, 5);
  fillRect(g, 13, 17, 4, 5, 2); outlineRect(g, 13, 17, 4, 5);
  return g;
}

// ─── Archetype silhouettes ───────────────────────────────────────────────────

const SOLDIER = MELEE_SILHOUETTE;   // helmeted footman + weapon
const ARCHER  = RANGED_SILHOUETTE;  // slim figure + bow → rogues/assassins too
const MAGE    = MAGIC_SILHOUETTE;   // robed caster + staff
const WRAITH  = DEATH_MESSENGER;    // hooded skeleton + scythe → undead/void
const BEAST   = WHITE_TIGER;        // feral creature → dragons/swarm
const FOX     = GUMIHO_GUARDIAN;    // fox-tailed → fox_queen
const KNIGHT  = buildKnight();
const GOLEM   = buildGolem();

// ─── Type → (silhouette, faction) map ────────────────────────────────────────

type Look = readonly [number[][], FactionId];

const INVADER_LOOK: Partial<Record<InvaderType, Look>> = {
  // ── Chapter 1 ──
  peasant:              [SOLDIER, 'human'],
  soldier:              [SOLDIER, 'steel'],
  knight:               [KNIGHT,  'iron'],
  shaman:               [MAGE,    'void'],
  void:                 [WRAITH,  'void'],
  undying:              [WRAITH,  'undead'],
  // ── Chapter 2 ──
  berserker:            [SOLDIER, 'berserker'],
  shadow_ninja:         [ARCHER,  'void'],
  siege_soldier:        [SOLDIER, 'steel'],
  holy_paladin:         [KNIGHT,  'celestial'],
  iron_golem:           [GOLEM,   'golem'],
  high_priest:          [MAGE,    'celestial'],
  mercenary_captain:    [SOLDIER, 'berserker'],
  trap_breaker:         [SOLDIER, 'steel'],
  fox_queen:            [FOX,     'beast'],
  // ── Chapter 3 ──
  undying_knight:       [KNIGHT,  'undead'],
  scarecrow_mage:       [MAGE,    'undead'],
  venom_dancer:         [ARCHER,  'venom'],
  void_assassin:        [ARCHER,  'void'],
  dragon_king:          [BEAST,   'beast'],
  // ── Chapter 4 ──
  void_assassin_elite:  [ARCHER,  'void'],
  death_emissary:       [WRAITH,  'undead'],
  ghost_add:            [WRAITH,  'undead'],
  // ── Chapter 5 ──
  void_invader:         [WRAITH,  'void'],
  undying_warrior:      [SOLDIER, 'undead'],
  three_god_destroyer:  [MAGE,    'celestial'],
  // ── Chapter 6 ──
  mirror_knight:        [KNIGHT,  'steel'],
  swarm_larva:          [BEAST,   'beast'],
  swarm_spawn:          [BEAST,   'beast'],
  shadow_wraith:        [WRAITH,  'void'],
  celestial_crusader:   [KNIGHT,  'celestial'],
  void_colossus:        [GOLEM,   'void'],
  plague_herald:        [MAGE,    'venom'],
  titan_sentinel:       [GOLEM,   'golem'],
  eternal_emperor:      [MAGE,    'celestial'],
  // ── Chapter 7 ──
  celestial_knight:     [KNIGHT,  'celestial'],
  divine_archer:        [ARCHER,  'celestial'],
  heaven_general:       [KNIGHT,  'celestial'],
  sky_titan:            [GOLEM,   'celestial'],
  radiant_seraph:       [MAGE,    'celestial'],
  celestial_dragon:     [BEAST,   'celestial'],
  god_emperor:          [KNIGHT,  'celestial'],
  // ── Chapter 8 ──
  void_soldier:         [SOLDIER, 'void'],
  abyss_berserker:      [SOLDIER, 'berserker'],
  primordial_guard:     [KNIGHT,  'golem'],
  primordial_titan:     [GOLEM,   'golem'],
};

const DEFAULT_LOOK: Look = [SOLDIER, 'steel'];

/** Pixel sprite data (palette + 24×24 silhouette) for an invader type. */
export function getInvaderSpriteData(type: InvaderType): MonsterSpriteData {
  const [silhouette, faction] = INVADER_LOOK[type] ?? DEFAULT_LOOK;
  return { palette: [...INVADER_PALETTES[faction]] as Palette, silhouette };
}
