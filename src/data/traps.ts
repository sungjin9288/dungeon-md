// ─── Traps ────────────────────────────────────────────────────────────────────
// A trap is a crafted asset, not a gold consumable. Every trap applies one or
// more *afflictions* on entry; a room's monsters hit harder the more distinct
// afflictions an invader carries (the combo, see comboMultiplier). Tier-1
// traps are the six single afflictions; tier 2 fuses two tier-1 traps; tier 3
// fuses two tier-2 traps with a rare material. Mastery (+0..+5 per trap type)
// scales the trap's effect. Design: GAME_DESIGN_BENCHMARK.md §4.2.
//
// Save data keeps trap *ids* in DungeonSlot.trapIds; stock and mastery live
// per trap type in GameState (trapStock / trapMastery), so no slot migration.

export type AfflictionId = 'bleed' | 'slow' | 'poison' | 'shock' | 'burn' | 'fear';

export interface AfflictionDef {
  readonly id: AfflictionId;
  readonly name: string;
  readonly blurb: string;
  /** Flat sustained-DPS worth used by the forecast simulation (per trap, before mastery). */
  readonly simDps: number;
}

export const AFFLICTION_DEFS: Readonly<Record<AfflictionId, AfflictionDef>> = {
  bleed:  { id: 'bleed',  name: '출혈', blurb: '진입 시 즉시 피해',          simDps: 5 },
  slow:   { id: 'slow',   name: '둔화', blurb: '이동속도 -40%, 2초',         simDps: 4 },
  poison: { id: 'poison', name: '중독', blurb: '초당 피해, 4초',             simDps: 8 },
  shock:  { id: 'shock',  name: '감전', blurb: '기절 1초',                   simDps: 6 },
  burn:   { id: 'burn',   name: '화상', blurb: '불꽃 중첩 피해, 3초',        simDps: 6 },
  fear:   { id: 'fear',   name: '공포', blurb: '2초간 뒷걸음질',             simDps: 5 },
};

export const AFFLICTION_ORDER: readonly AfflictionId[] = ['bleed', 'slow', 'poison', 'shock', 'burn', 'fear'];

export interface TrapRecipe {
  /** Two lower-tier traps consumed from stock. */
  readonly traps: readonly [string, string];
  readonly materials: Readonly<Record<string, number>>;
}

export interface TrapDef {
  readonly id: string;
  readonly emoji: string;
  readonly name: string;
  readonly tier: 1 | 2 | 3;
  readonly afflictions: readonly AfflictionId[];
  /** Gold to install straight from the tray — tier 1 only; higher tiers install from stock. */
  readonly cost: number;
  readonly desc: string;
  readonly unlockLv: number;
  /** Materials to craft one into stock (tier 1), plus the two input traps (tier 2–3). */
  readonly recipe: TrapRecipe | { readonly materials: Readonly<Record<string, number>> };
}

export const TRAP_DEFS: ReadonlyArray<TrapDef> = [
  // ── Tier 1: one affliction each ─────────────────────────────────────────────
  { id: 'spike_trap',  emoji: '🗡', name: '가시 덫',   tier: 1, afflictions: ['bleed'],  cost:  50, unlockLv: 0,  desc: '진입 시 20 피해',
    recipe: { materials: { iron_shard: 2 } } },
  { id: 'slow_trap',   emoji: '🕸', name: '느림 덫',   tier: 1, afflictions: ['slow'],   cost:  80, unlockLv: 0,  desc: '이동속도 -40%, 2초',
    recipe: { materials: { old_cloth: 3 } } },
  { id: 'poison_trap', emoji: '☠️', name: '독 덫',     tier: 1, afflictions: ['poison'], cost: 120, unlockLv: 6,  desc: '8 피해/초, 4초',
    recipe: { materials: { herb: 3, old_cloth: 1 } } },
  { id: 'stun_trap',   emoji: '⚡', name: '감전 덫',   tier: 1, afflictions: ['shock'],  cost: 200, unlockLv: 10, desc: '기절 1초',
    recipe: { materials: { magic_dust: 2, iron_shard: 1 } } },
  { id: 'ember_trap',  emoji: '🔥', name: '불씨 덫',   tier: 1, afflictions: ['burn'],   cost: 150, unlockLv: 4,  desc: '불꽃 중첩 10 피해/초, 3초',
    recipe: { materials: { dok_fragment: 1, common_ore: 2 } } },
  { id: 'fear_trap',   emoji: '👁', name: '공포 덫',   tier: 1, afflictions: ['fear'],   cost: 180, unlockLv: 8,  desc: '2초간 뒷걸음질',
    recipe: { materials: { soul_fragment: 1, shadow_cloth: 1 } } },

  // ── Tier 2: two tier-1 traps fused ──────────────────────────────────────────
  { id: 'thorn_wall',    emoji: '🌵', name: '독가시 벽',   tier: 2, afflictions: ['bleed', 'poison'], cost: 0, unlockLv: 6,  desc: '출혈 + 중독',
    recipe: { traps: ['spike_trap', 'poison_trap'], materials: { iron_shard: 3, herb: 3 } } },
  { id: 'lightning_net', emoji: '🕸', name: '뇌전 그물',   tier: 2, afflictions: ['slow', 'shock'],   cost: 0, unlockLv: 10, desc: '둔화 + 감전',
    recipe: { traps: ['slow_trap', 'stun_trap'], materials: { magic_dust: 3, old_cloth: 2 } } },
  { id: 'wildfire_pit',  emoji: '🔥', name: '들불 구덩이', tier: 2, afflictions: ['burn', 'bleed'],   cost: 0, unlockLv: 6,  desc: '화상 + 출혈',
    recipe: { traps: ['ember_trap', 'spike_trap'], materials: { dok_fragment: 2, iron_shard: 2 } } },
  { id: 'dread_gas',     emoji: '☁️', name: '공포 안개',   tier: 2, afflictions: ['poison', 'fear'],  cost: 0, unlockLv: 10, desc: '중독 + 공포',
    recipe: { traps: ['poison_trap', 'fear_trap'], materials: { herb: 3, soul_fragment: 2 } } },
  { id: 'ember_chain',   emoji: '⛓', name: '불꽃 사슬',   tier: 2, afflictions: ['burn', 'shock'],   cost: 0, unlockLv: 12, desc: '화상 + 감전',
    recipe: { traps: ['ember_trap', 'stun_trap'], materials: { dok_fragment: 2, magic_dust: 2 } } },
  { id: 'quagmire',      emoji: '🐊', name: '수렁',        tier: 2, afflictions: ['slow', 'poison'],  cost: 0, unlockLv: 8,  desc: '둔화 + 중독',
    recipe: { traps: ['slow_trap', 'poison_trap'], materials: { old_cloth: 3, herb: 2 } } },

  // ── Tier 3: two tier-2 traps and a rare material ────────────────────────────
  { id: 'hellmouth',     emoji: '👹', name: '지옥 아가리', tier: 3, afflictions: ['burn', 'bleed', 'poison'], cost: 0, unlockLv: 14, desc: '화상 + 출혈 + 중독',
    recipe: { traps: ['wildfire_pit', 'thorn_wall'], materials: { boss_essence: 1, dok_fragment: 3 } } },
  { id: 'storm_cage',    emoji: '⛈', name: '폭풍 우리',   tier: 3, afflictions: ['slow', 'shock', 'fear'],  cost: 0, unlockLv: 14, desc: '둔화 + 감전 + 공포',
    recipe: { traps: ['lightning_net', 'dread_gas'], materials: { boss_essence: 1, magic_dust: 4 } } },
  { id: 'plague_tide',   emoji: '🌊', name: '역병 조수',   tier: 3, afflictions: ['poison', 'slow', 'bleed'], cost: 0, unlockLv: 16, desc: '중독 + 둔화 + 출혈',
    recipe: { traps: ['quagmire', 'thorn_wall'], materials: { boss_essence: 1, herb: 5 } } },
  { id: 'dokkaebi_fire', emoji: '🎆', name: '도깨비불',    tier: 3, afflictions: ['burn', 'fear', 'shock'],  cost: 0, unlockLv: 16, desc: '화상 + 공포 + 감전',
    recipe: { traps: ['ember_chain', 'dread_gas'], materials: { boss_essence: 1, soul_fragment: 3 } } },
];

export function getTrapDef(id: string | undefined | null): TrapDef | undefined {
  return id ? TRAP_DEFS.find(trap => trap.id === id) : undefined;
}

export function isTrapRecipeFusion(recipe: TrapDef['recipe']): recipe is TrapRecipe {
  return 'traps' in recipe;
}

// ─── Mastery ──────────────────────────────────────────────────────────────────

export const TRAP_MASTERY_MAX = 5;
/** Effect multiplier per mastery level: +15% damage/duration each. */
export const TRAP_MASTERY_STEP = 0.15;

export function trapMasteryMult(level: number): number {
  return 1 + Math.min(TRAP_MASTERY_MAX, Math.max(0, level)) * TRAP_MASTERY_STEP;
}

/** Materials to raise a trap type from `level` to `level + 1`: its own recipe, scaled. */
export function trapMasteryCost(def: TrapDef, level: number): Readonly<Record<string, number>> {
  const scale = 1 + level;
  return Object.fromEntries(Object.entries(def.recipe.materials).map(([id, qty]) => [id, qty * scale]));
}

// ─── Combo ────────────────────────────────────────────────────────────────────

/** Afflictions applied within this window count toward one combo. */
export const COMBO_WINDOW_MS = 2000;
export const COMBO_STEP = 0.25;
export const COMBO_MAX_AFFLICTIONS = 4;

/** Damage multiplier for a guardian hitting an invader under `distinct` afflictions. */
export function comboMultiplier(distinct: number): number {
  const n = Math.min(COMBO_MAX_AFFLICTIONS, Math.max(0, Math.floor(distinct)));
  return n <= 1 ? 1 : 1 + COMBO_STEP * (n - 1);
}

// ─── Simulation worth ─────────────────────────────────────────────────────────

/** Flat DPS a trap adds to the forecast: its afflictions' worth, scaled by mastery. */
export function trapEffectiveDps(id: string | undefined | null, masteryLevel = 0): number {
  const def = getTrapDef(id);
  if (!def) return 0;
  const base = def.afflictions.reduce((sum, affliction) => sum + AFFLICTION_DEFS[affliction].simDps, 0);
  return base * trapMasteryMult(masteryLevel);
}
