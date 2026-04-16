import type { RoomType } from './rooms';

// ─── Tribe / Element / Rarity / Unlock types ─────────────────────────────────

export type TribeId =
  | 'dokkaebi'
  | 'gumiho'
  | 'dragon'
  | 'underworld'
  | 'sansin'
  | 'sea'
  | 'mask'
  | 'moonlight'
  | 'celestial';

export type ElementId =
  | 'fire'
  | 'frost'
  | 'lightning'
  | 'dark'
  | 'holy';

export type RarityId = 'C' | 'U' | 'R' | 'E' | 'L';

export type UnlockMethod = 'summon' | 'codex_reward' | 'fusion_combination' | 'seasonal';

// ─── Passive IDs ─────────────────────────────────────────────────────────────

export type PassiveId =
  | 'FIRST_STRIKE_STUN'   // first attack each wave: 2× dmg + stun 1500ms
  | 'PACK_FRENZY'         // +10% attack speed per adjacent dokkaebi
  | 'PINNING_SHOT'        // 20% chance to root invader 800ms
  | 'GILDED_KILL'         // +2g per kill in same row
  | 'EMBER_TRAIL'         // burn stacks: 10dmg/s × 3 stacks
  | 'MEDITATIVE_AURA'     // adjacent rooms get -15% cooldown
  // ─── Chapter 2 ───
  | 'FOX_FIRE_CHARM'      // hit charms 1 invader 3s: walks backward
  | 'PERMAFROST'          // hit freezes 2.5s; on death: AoE 60dmg within 80px
  | 'TIGERS_POUNCE'       // first attack: lunge 2 rows, 2× dmg
  | 'TIDE_THRUST'         // each hit: pushes invader back 60px
  | 'WAR_HEX'             // on attack: curse entire column, -30% max hp for 8s
  | 'TAUNTING_ROAR'       // on attack: nearby invaders slow 50% for 3s (120px radius)
  // ─── Chapter 3 ───
  | 'SOUL_HARVEST'        // execute invader at ≤15% HP; +5 bonus gold
  | 'CHAIN_LIGHTNING'     // attack chains to 3 nearby invaders at 40% damage
  | 'SPECTRAL_BOLT'       // projectile passes through all invaders in a line
  | 'WHIRLWIND_DANCE'     // every 5th hit: AoE across full row 150% damage
  | 'VENOM_STACK'         // 5 stacks → paralyzed 2s + 80 burst damage
  // ─── Chapter 4 ───
  | 'ENTRANCING_VEIL'     // global: all invaders speed ×0.88
  | 'SUN_DIVE'            // ignores row; targets closest-to-exit invader
  | 'CONSTRICT'           // 25% per attack: immobilize 3s + 15dmg/s DoT
  | 'LUNAR_RHYTHM'        // every 30s: reset adjacent room cooldowns
  | 'DIVINE_TERRITORY'    // global: all monsters +20% dmg/spd, gold +20%
  // ─── Chapter 6 — new passives ───
  | 'PHOENIX_REVIVAL'     // on death revive once at 50% HP
  | 'DRAGON_FURY'         // ATK doubles below 30% HP
  | 'MOONLIGHT_HEAL'      // heals all ally monsters 5HP/s
  | 'PACK_CAPTAIN'        // all same-tribe monsters in dungeon +15% ATK
  | 'AOE_BOMB'            // every 3rd attack: AoE explosion 80dmg 100px
  | 'DUAL_STRIKE'         // each attack hits twice (2nd hit 60% dmg)
  | 'SHADOW_STEP'         // 30% chance to avoid invader attack
  | 'SHIELD_BASH'         // 25% chance: stun 1.5s + 150% dmg
  | 'DOOM_CURSE'          // on attack: target takes +30% dmg for 10s
  | 'KINGS_RALLY'         // all monsters in dungeon +20% ATK/SPD for 8s (30s cd)
  | 'TEMPEST'             // attacks hit all invaders in column
  | 'GOLDEN_AURA'         // gold drop from kills in this room +3💰
  | 'FOX_CLONE'           // 20% chance: summon illusion copy for 5s
  | 'TAILS_POWER'         // each kill: +5% dmg stacking (max 50%)
  | 'FROST_CHARM'         // on hit: 40% chance freeze 2s + charm 3s
  | 'THUNDER_BOLT'        // every 4th attack: chain lightning 3 targets
  | 'FUSION_SOUL'         // adjacent different-tribe monsters share 10% stats
  | 'DRAGON_SCALE'        // blocks 20% of all incoming dungeon damage
  | 'MOONBEAM'            // heals weakest ally monster 15HP every 5s
  | 'UNDERWORLD_GRASP'    // hit: 15% chance immobilize 4s + 20dmg/s DoT
  | 'SEA_CURRENT'         // all pushback effects in dungeon +30%
  | 'MASK_MIMIC'          // copies the passive effect of adjacent monster
  | 'TRIBE_MASTERY'       // codex completion: tribe-wide stat buff
  | 'SEASONAL_BOON'       // seasonal limited: team-wide special buff
  | 'VENOM_BURST'         // poison stacks → burst damage
  | 'CHARM_GAZE'          // on-hit charm/mesmerize effect
  | 'GHOST_ARROW'         // piercing attacks that ignore armor
  | 'DEATH_RATTLE';       // on-death: one final attack

// ─── Monster IDs ─────────────────────────────────────────────────────────────

export type MonsterId =
  // ─── Chapter 1 ───
  | 'dokkaebi_warrior'
  | 'dokkaebi_junior'
  | 'village_archer'
  | 'gold_turtle'
  | 'fire_dokkaebi'
  | 'sage'
  // ─── Chapter 2 ───
  | 'gumiho_guardian'
  | 'frost_spirit'
  | 'white_tiger'
  | 'sea_god_spear'
  | 'fox_shaman'
  | 'iron_mask'
  // ─── Chapter 3 ───
  | 'death_messenger'
  | 'thunder_hero'
  | 'ghost_hunter'
  | 'mask_dancer'
  | 'venom_warrior'
  // ─── Chapter 4 ───
  | 'celestial_dancer'
  | 'three_legged_crow'
  | 'great_serpent'
  | 'moon_rabbit_sage'
  // ─── Chapter 5 ───
  | 'mountain_god'
  | 'volcanic_warrior'
  | 'storm_archer'
  | 'abyss_mage'
  | 'celestial_healer'
  | 'mask_berserker'
  | 'sea_dragon_lord'
  | 'fox_spirit_elder'
  // ─── Chapter 6 — dokkaebi tribe ───
  | 'thunder_dokkaebi'
  | 'ice_dokkaebi'
  | 'healer_dokkaebi'
  | 'dokkaebi_captain'
  | 'dokkaebi_bomber'
  | 'dokkaebi_duelist'
  | 'poison_dokkaebi'
  | 'shadow_dokkaebi'
  | 'shield_dokkaebi'
  | 'dokkaebi_shaman'
  | 'dokkaebi_king'
  | 'storm_dokkaebi'
  | 'gold_dokkaebi'
  | 'fire_dokkaebi_king'
  | 'black_dragon_dokkaebi'
  | 'dokkaebi_general'
  | 'dokkaebi_god_king'
  // ─── Chapter 6 — gumiho tribe ───
  | 'one_tail_fox'
  | 'three_tail_fox'
  | 'five_tail_fox'
  | 'spring_gumiho'
  | 'summer_gumiho'
  | 'ice_gumiho'
  | 'thunder_gumiho'
  | 'fox_warrior'
  | 'gumiho_queen'
  | 'gumiho_goddess'
  | 'gumiho_archmage'
  | 'celestial_fairy'
  | 'gumiho_demon'
  // ─── Chapter 6 — sansin tribe ───
  | 'deer_god'
  | 'bear_god'
  | 'mountain_spirit_boy'
  | 'phoenix'
  | 'thousand_pine'
  | 'mountain_spirit'
  | 'mountain_god_complete'
  // ─── Chapter 6 — sea tribe ───
  | 'sea_dragon_archer'
  | 'jellyfish_sorcerer'
  | 'sea_general'
  | 'sea_witch'
  | 'shark_warrior'
  | 'kraken_soldier'
  | 'dragon_king_guardian'
  | 'sea_god_complete'
  // ─── Chapter 6 — underworld tribe ───
  | 'skeleton_knight'
  | 'soul_guardian'
  | 'underworld_archer'
  | 'underworld_witch'
  | 'hell_guard'
  | 'yomra_warrior'
  | 'ghost_king'
  | 'spirit_summoner'
  | 'underworld_complete'
  // ─── Chapter 6 — mask tribe ───
  | 'mask_archer'
  | 'bongsan_maskman'
  | 'cheoyong_warrior'
  | 'mask_wizard'
  | 'thunder_mask_warrior'
  | 'glacier_warrior'
  | 'great_mask_god'
  | 'mask_complete'
  // ─── Chapter 6 — moonlight tribe ───
  | 'moonlight_rabbit'
  | 'starlight_fairy'
  | 'crescent_archer'
  | 'moonlight_tiger'
  | 'galaxy_warrior'
  | 'full_moon_sorcerer'
  | 'solar_eclipse_warrior'
  | 'lunar_eclipse_mage'
  | 'moonlight_complete'
  // ─── Chapter 6 — dragon tribe ───
  | 'red_dragon_warrior'
  | 'blue_dragon_guardian'
  | 'gold_dragon_sage'
  | 'black_dragon_assassin'
  | 'white_dragon_healer'
  | 'blue_dragon_archmage'
  | 'banya_guardian'
  | 'dragon_avatar'
  | 'five_dragon_complete'
  // ─── Chapter 7: 천계족 ───
  | 'celestial_guardian'
  | 'sky_archer'
  | 'heaven_mage'
  | 'solar_warrior'
  | 'divine_healer'
  | 'starlight_knight'
  | 'celestial_sage'
  | 'god_realm_general';

// ─── Interfaces ───────────────────────────────────────────────────────────────

export interface MonsterDef {
  id:             MonsterId;
  name:           string;        // Korean display name
  emoji:          string;
  type:           'melee' | 'ranged' | 'magic' | 'support';
  roomTypes:      RoomType[];    // which room types can house this monster
  baseDamage:     number;        // base attack damage (0 = support / no attack)
  attackCooldown: number;        // ms between attacks (0 = non-attacker)
  range:          number;        // row-units of reach (1 = same row, 2 = 2 rows)
  passive:        PassiveId;
  passiveDesc:    string;        // short description for UI
  accentColor:    number;        // Phaser hex for card accent
  unlockStage:    number;        // minimum stage required
  chapter?:       number;        // 1, 2, 3, 4, 5, or 6
  // ─── Extended metadata (Chapter 6+) ───
  tribe?:        TribeId;
  element?:      ElementId;
  rarityTier?:   RarityId;
  unlockMethod?: UnlockMethod;
  season?:       'spring' | 'summer' | 'fall' | 'winter';
}

export interface MonsterSkin {
  id:                string;
  monsterId:         MonsterId;
  name:              string;
  emoji:             string;
  particleColor:     number;
  attackEffectColor: number;
  idleVariant:       'normal' | 'special' | 'limited';
  rarity:            'normal' | 'rare' | 'limited';
  gemCost:           number;
  season?:           'spring' | 'summer' | 'fall' | 'winter';
  available:         boolean;   // false = expired limited skin
}
