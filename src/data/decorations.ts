/**
 * 던전 장식품 + 함정 도구 (Decorations & trap tools) with SET bonuses.
 *
 * The dungeon master decorates the dungeon with items obtained by crafting
 * (Forge materials) or purchase (Shop gold). Placing several pieces of the same
 * SET triggers escalating set bonuses — so what you collect AND which
 * combination you place both matter. Bonuses feed the idle economy (gold /
 * production) and combat (dungeon HP / trap damage).
 *
 * Pure data/logic only — no Phaser, no GameState mutation (see
 * decorationTransactions.ts). Bonus aggregation is deterministic + testable.
 */

export interface DecorationBonuses {
  idleGoldPct: number;        // +% to idle operation gold
  idleProductionPct: number;  // +% to facility (material + gold) production
  dungeonHpPct: number;       // +% starting dungeon HP in battle
  trapDmgPct: number;         // +% trap-room damage in battle
}

export const EMPTY_BONUSES: DecorationBonuses = {
  idleGoldPct: 0, idleProductionPct: 0, dungeonHpPct: 0, trapDmgPct: 0,
};

export type AcquireCost =
  | { readonly kind: 'gold'; readonly gold: number }
  | { readonly kind: 'craft'; readonly materials: Record<string, number> };

export interface DecorationDef {
  readonly id: string;
  readonly name: string;
  readonly emoji: string;
  readonly setId: string;
  readonly desc: string;
  readonly cost: AcquireCost;
}

export interface SetTier {
  readonly count: number;                  // pieces placed to unlock this tier
  readonly bonus: Partial<DecorationBonuses>;
}

export interface SetDef {
  readonly id: string;
  readonly name: string;
  readonly emoji: string;
  readonly desc: string;
  readonly tiers: readonly SetTier[];       // ascending by count
}

// ─── Sets ────────────────────────────────────────────────────────────────────
export const SET_DEFS: Record<string, SetDef> = {
  bounty: {
    id: 'bounty', name: '풍요의 정원', emoji: '🪴', desc: '방치 골드·생산 증가',
    tiers: [
      { count: 2, bonus: { idleGoldPct: 10 } },
      { count: 3, bonus: { idleGoldPct: 25, idleProductionPct: 15 } },
    ],
  },
  guardian: {
    id: 'guardian', name: '수호의 진영', emoji: '🛡', desc: '던전 내구도 강화',
    tiers: [
      { count: 2, bonus: { dungeonHpPct: 8 } },
      { count: 3, bonus: { dungeonHpPct: 20 } },
    ],
  },
  trapper: {
    id: 'trapper', name: '함정술사의 공방', emoji: '🕸', desc: '함정 위력 강화',
    tiers: [
      { count: 2, bonus: { trapDmgPct: 12 } },
      { count: 3, bonus: { trapDmgPct: 30 } },
    ],
  },
  abyssal: {
    id: 'abyssal', name: '심연의 보고', emoji: '🔮', desc: '골드·내구도 동시 강화',
    tiers: [
      { count: 2, bonus: { idleGoldPct: 8, dungeonHpPct: 6 } },
      { count: 3, bonus: { idleGoldPct: 20, dungeonHpPct: 18 } },
    ],
  },
};

export const SET_ORDER: readonly string[] = ['bounty', 'guardian', 'trapper', 'abyssal'];

// ─── Decorations (3 sets × 3 pieces) ──────────────────────────────────────────
export const DECORATION_DEFS: Record<string, DecorationDef> = {
  // 풍요의 정원 — bought with gold
  golden_pot:    { id: 'golden_pot',    name: '황금 화분',   emoji: '🪴', setId: 'bounty',   desc: '반짝이는 황금빛 화분', cost: { kind: 'gold', gold: 300 } },
  bounty_totem:  { id: 'bounty_totem',  name: '풍요의 토템', emoji: '🗿', setId: 'bounty',   desc: '풍요를 부르는 토템',   cost: { kind: 'gold', gold: 500 } },
  treasure_chest:{ id: 'treasure_chest',name: '보물 상자',   emoji: '🎁', setId: 'bounty',   desc: '금화가 가득한 상자',   cost: { kind: 'gold', gold: 800 } },
  // 수호의 진영 — crafted from materials
  war_banner:    { id: 'war_banner',    name: '전쟁 깃발',   emoji: '🚩', setId: 'guardian', desc: '수호병의 사기를 높임', cost: { kind: 'craft', materials: { old_cloth: 5, common_ore: 3 } } },
  brazier:       { id: 'brazier',       name: '화톳불',      emoji: '🔥', setId: 'guardian', desc: '던전을 밝히는 화톳불', cost: { kind: 'craft', materials: { common_ore: 6, magic_dust: 2 } } },
  guardian_statue:{ id: 'guardian_statue',name: '수호 석상', emoji: '🗽', setId: 'guardian', desc: '굳건한 수호의 석상',   cost: { kind: 'craft', materials: { common_ore: 10, iron_shard: 4 } } },
  // 함정술사의 공방 — crafted from materials
  spike_rack:    { id: 'spike_rack',    name: '가시 거치대', emoji: '🦔', setId: 'trapper',  desc: '날카로운 가시 거치대', cost: { kind: 'craft', materials: { iron_shard: 5, common_ore: 4 } } },
  poison_vat:    { id: 'poison_vat',    name: '독 항아리',   emoji: '🧪', setId: 'trapper',  desc: '맹독이 든 항아리',     cost: { kind: 'craft', materials: { herb: 6, magic_dust: 3 } } },
  mana_snare:    { id: 'mana_snare',    name: '마력 덫',     emoji: '🕸', setId: 'trapper',  desc: '마력으로 짠 덫',       cost: { kind: 'craft', materials: { magic_dust: 5, old_cloth: 4 } } },
  // 심연의 보고 — crafted from high-tier materials
  abyss_crystal: { id: 'abyss_crystal', name: '심연 수정',     emoji: '🔮', setId: 'abyssal', desc: '심연의 기운이 깃든 수정', cost: { kind: 'craft', materials: { soul_fragment: 4, magic_dust: 3 } } },
  void_chalice:  { id: 'void_chalice',  name: '공허의 성배',   emoji: '🏆', setId: 'abyssal', desc: '공허를 담은 성배',       cost: { kind: 'craft', materials: { boss_essence: 1, soul_fragment: 5 } } },
  abyss_obelisk: { id: 'abyss_obelisk', name: '심연 오벨리스크', emoji: '🗿', setId: 'abyssal', desc: '심연을 향해 솟은 비석',   cost: { kind: 'craft', materials: { boss_essence: 2, iron_shard: 6, magic_dust: 4 } } },
};

/** Number of decoration slots (max placed at once) for a DM level. */
export function decorationSlots(dmLevel: number): number {
  return Math.min(9, 4 + Math.floor(Math.max(0, dmLevel) / 3));
}

/** All decoration ids belonging to a set, in catalog order. */
export function decorationsInSet(setId: string): string[] {
  return Object.values(DECORATION_DEFS).filter(d => d.setId === setId).map(d => d.id);
}

/** Active tier index for a set given how many of its pieces are placed (-1 = none). */
export function activeSetTier(setId: string, placedCount: number): number {
  const tiers = SET_DEFS[setId]?.tiers ?? [];
  let idx = -1;
  for (let i = 0; i < tiers.length; i++) {
    if (placedCount >= tiers[i].count) idx = i;
  }
  return idx;
}

/**
 * Aggregate the set bonuses from the placed decorations. Counts placed pieces
 * per set, applies that set's highest reached tier, and sums across sets.
 */
export function computeDecorationBonuses(placed: readonly string[] | undefined): DecorationBonuses {
  const out: DecorationBonuses = { ...EMPTY_BONUSES };
  if (!placed?.length) return out;

  const countBySet: Record<string, number> = {};
  for (const id of placed) {
    const def = DECORATION_DEFS[id];
    if (def) countBySet[def.setId] = (countBySet[def.setId] ?? 0) + 1;
  }

  for (const [setId, count] of Object.entries(countBySet)) {
    const tierIdx = activeSetTier(setId, count);
    if (tierIdx < 0) continue;
    const bonus = SET_DEFS[setId].tiers[tierIdx].bonus;
    out.idleGoldPct       += bonus.idleGoldPct ?? 0;
    out.idleProductionPct += bonus.idleProductionPct ?? 0;
    out.dungeonHpPct      += bonus.dungeonHpPct ?? 0;
    out.trapDmgPct        += bonus.trapDmgPct ?? 0;
  }
  return out;
}
