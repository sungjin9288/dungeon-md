// ─── Rarity constants ─────────────────────────────────────────────────────────

export const RARITY_NAMES     = ['일반', '언커먼', '레어', '에픽', '전설'] as const;
export const RARITY_STARS     = ['⭐', '⭐⭐', '⭐⭐⭐', '⭐⭐⭐⭐', '⭐⭐⭐⭐⭐'] as const;
export const RARITY_COLORS    = ['#aaaaaa', '#44cc44', '#4488cc', '#aa44ff', '#ffaa22'] as const;
export const RARITY_XP_VALUES = [30, 80, 200, 500, 1200] as const;

// ─── Monster display data ─────────────────────────────────────────────────────

interface MonsterBaseInfo { name: string; emoji: string; baseDamage: number }

const MONSTER_BASE_INFO: Record<string, MonsterBaseInfo> = {
  dokkaebi_warrior: { name: '도깨비 전사',   emoji: '👹', baseDamage: 20 },
  dokkaebi_junior:  { name: '꼬마 도깨비',   emoji: '👺', baseDamage: 12 },
  village_archer:   { name: '촌 궁수',       emoji: '🏹', baseDamage: 15 },
  gold_turtle:      { name: '황금 거북이',   emoji: '🐢', baseDamage: 0  },
  fire_dokkaebi:    { name: '화염 도깨비',   emoji: '🔥', baseDamage: 18 },
  sage:             { name: '신선 도인',     emoji: '🧙', baseDamage: 0  },
  gumiho_guardian:  { name: '구미호 수호자', emoji: '🦊', baseDamage: 22 },
  frost_spirit:     { name: '빙결 정령',     emoji: '❄️', baseDamage: 18 },
  white_tiger:      { name: '백호',          emoji: '🐯', baseDamage: 30 },
  sea_god_spear:    { name: '해신의 창',     emoji: '🔱', baseDamage: 25 },
  fox_shaman:       { name: '여우 무당',     emoji: '🎴', baseDamage: 20 },
  iron_mask:        { name: '철가면',        emoji: '🎭', baseDamage: 28 },
  death_messenger:  { name: '저승사자',      emoji: '💀', baseDamage: 22 },
  thunder_hero:     { name: '뇌신 영웅',     emoji: '⚡', baseDamage: 26 },
  ghost_hunter:     { name: '귀신 사냥꾼',   emoji: '👻', baseDamage: 20 },
  mask_dancer:      { name: '탈춤꾼',        emoji: '💃', baseDamage: 18 },
  venom_warrior:    { name: '독 전사',       emoji: '☠️', baseDamage: 24 },
};

const RARITY_PREFIXES = ['', '강화 ', '정예 ', '영웅 ', '전설 '];

export function getBaseId(id: string): string {
  return id.replace(/_(unc|rare|epic|leg)$/, '');
}
export function getMonsterRarity(id: string): number {
  if (id.endsWith('_leg'))  return 4;
  if (id.endsWith('_epic')) return 3;
  if (id.endsWith('_rare')) return 2;
  if (id.endsWith('_unc'))  return 1;
  return 0;
}
export function getMonsterEmoji(id: string): string {
  const base = MONSTER_BASE_INFO[getBaseId(id)];
  return base?.emoji ?? HYBRID_DEFS[id]?.emoji ?? '❓';
}
export function getMonsterDisplayName(id: string): string {
  const baseId = getBaseId(id);
  const rarity = getMonsterRarity(id);
  const base = MONSTER_BASE_INFO[baseId];
  if (base) return (RARITY_PREFIXES[rarity] ?? '') + base.name;
  return HYBRID_DEFS[id]?.name ?? id;
}
export function getMonsterBaseDamage(id: string): number {
  const baseId = getBaseId(id);
  const rarity = getMonsterRarity(id);
  const base = MONSTER_BASE_INFO[baseId];
  if (!base) return HYBRID_DEFS[id]?.baseDamage ?? 20;
  return Math.round(base.baseDamage * Math.pow(1.30, rarity));
}

// ─── Evolution chains ─────────────────────────────────────────────────────────

export interface EvolutionTier {
  resultId:      string;
  rarity:        number;
  atkMult:       number;
  unlockedSkill: string;
}

const EVOLUTION_TIERS: EvolutionTier[] = [
  { resultId: '_unc',  rarity: 1, atkMult: 1.30, unlockedSkill: 'A2' },
  { resultId: '_rare', rarity: 2, atkMult: 1.69, unlockedSkill: 'A3' },
  { resultId: '_epic', rarity: 3, atkMult: 2.20, unlockedSkill: 'B2' },
  { resultId: '_leg',  rarity: 4, atkMult: 2.86, unlockedSkill: 'C2' },
];

const EVOLVABLE_BASES = new Set([
  'dokkaebi_warrior', 'dokkaebi_junior', 'village_archer', 'gold_turtle',
  'fire_dokkaebi', 'sage', 'gumiho_guardian', 'frost_spirit',
  'white_tiger', 'sea_god_spear', 'fox_shaman', 'iron_mask',
]);

export function getNextEvolution(monsterId: string): (EvolutionTier & { resultId: string }) | null {
  const baseId = getBaseId(monsterId);
  if (!EVOLVABLE_BASES.has(baseId)) return null;
  const currentRarity = getMonsterRarity(monsterId);
  if (currentRarity >= 4) return null;
  const tier = EVOLUTION_TIERS[currentRarity];
  return { ...tier, resultId: baseId + tier.resultId };
}

// ─── Hybrid combinations ──────────────────────────────────────────────────────

export interface HybridDef {
  id:          string;
  name:        string;
  emoji:       string;
  rarity:      number;
  baseDamage:  number;
  passive:     string;
  passiveDesc: string;
  roomTypes:   string[];
}

// Forward-declare so getMonsterEmoji/getMonsterDisplayName can reference it
export const HYBRID_DEFS: Record<string, HybridDef> = {
  fox_warrior: {
    id: 'fox_warrior', name: '여우 전사', emoji: '🦊⚔️', rarity: 2, baseDamage: 26,
    passive: 'HYBRID_CHARM', passiveDesc: '일반 공격 + 20% 매혹 확률',
    roomTypes: ['guardian'],
  },
  storm_spirit: {
    id: 'storm_spirit', name: '폭풍 정령', emoji: '⚡', rarity: 2, baseDamage: 24,
    passive: 'CHAIN_BURN', passiveDesc: '연쇄 번개 + 각 연쇄마다 화상',
    roomTypes: ['scroll_library'],
  },
  soul_guardian: {
    id: 'soul_guardian', name: '영혼 수호자', emoji: '💀✨', rarity: 2, baseDamage: 22,
    passive: 'SOUL_HEAL', passiveDesc: '방 HP 회복 +2/초 + 15% 이하 처형',
    roomTypes: ['scroll_library'],
  },
  golden_dokkaebi: {
    id: 'golden_dokkaebi', name: '황금 도깨비', emoji: '👹💰', rarity: 2, baseDamage: 16,
    passive: 'GOLD_KILL', passiveDesc: '처치 당 +10💰',
    roomTypes: ['guardian', 'gold'],
  },
  thunder_knight: {
    id: 'thunder_knight', name: '천둥 기사', emoji: '⚡🛡', rarity: 3, baseDamage: 34,
    passive: 'POUNCE_PUSH', passiveDesc: '돌진 + 충격 시 밀어냄',
    roomTypes: ['guardian'],
  },
  gumiho_archmage: {
    id: 'gumiho_archmage', name: '구미호 대마법사', emoji: '🦊🔮', rarity: 3, baseDamage: 30,
    passive: 'CHARM_HEX', passiveDesc: '매혹 + 동일 대상 저주',
    roomTypes: ['scroll_library'],
  },
  glacier_warrior: {
    id: 'glacier_warrior', name: '빙하 무사', emoji: '❄️💃', rarity: 3, baseDamage: 28,
    passive: 'FREEZE_WHIRL', passiveDesc: '회오리로 모든 명중 대상 동결',
    roomTypes: ['guardian'],
  },
  lightning_mask: {
    id: 'lightning_mask', name: '번개 마스크 전사', emoji: '⚡🎭', rarity: 3, baseDamage: 32,
    passive: 'TAUNT_CHAIN', passiveDesc: '도발 + 도발된 대상에 연쇄 번개',
    roomTypes: ['guardian'],
  },
  flame_dokkaebi_king: {
    id: 'flame_dokkaebi_king', name: '불꽃 도깨비 왕', emoji: '👹🔥', rarity: 3, baseDamage: 30,
    passive: 'FIRST_BURN', passiveDesc: '첫 공격 기절 + 즉시 화상 3스택',
    roomTypes: ['guardian'],
  },
  fairy: {
    id: 'fairy', name: '선녀', emoji: '🧚', rarity: 4, baseDamage: 20,
    passive: 'DIVINE_SUPPORT', passiveDesc: '명상 오라 + 5번째마다 매혹',
    roomTypes: ['any'],
  },
  // ─── Ch3+ hybrids ─────────────────────────────────────────────────────────
  venom_ghost: {
    id: 'venom_ghost', name: '독혼 사냥꾼', emoji: '☠️👻', rarity: 3, baseDamage: 28,
    passive: 'POISON_EXECUTE', passiveDesc: '독 3스택 대상 즉사 (보스 제외)',
    roomTypes: ['guardian'],
  },
  thunder_serpent: {
    id: 'thunder_serpent', name: '뇌사', emoji: '⚡🐍', rarity: 3, baseDamage: 30,
    passive: 'VENOM_LIGHTNING', passiveDesc: '독 대상에 번개 적중 시 2배 피해',
    roomTypes: ['guardian', 'scroll_library'],
  },
  moon_dancer: {
    id: 'moon_dancer', name: '월무 탈선', emoji: '🌙🎭', rarity: 3, baseDamage: 26,
    passive: 'LUNAR_VEIL', passiveDesc: '밤 시간대 인접 방 공격력 +30%',
    roomTypes: ['guardian'],
  },
  celestial_phoenix: {
    id: 'celestial_phoenix', name: '천상 봉황', emoji: '🕊️🔥', rarity: 4, baseDamage: 32,
    passive: 'REBIRTH_BLAZE', passiveDesc: '방 파괴 시 부활 + 주변 적 200 피해',
    roomTypes: ['guardian'],
  },
  dragon_sage: {
    id: 'dragon_sage', name: '용현자', emoji: '🐉📜', rarity: 4, baseDamage: 24,
    passive: 'DRAGON_WISDOM', passiveDesc: '인접 방 쿨다운 -30% + 처치 보상 2배',
    roomTypes: ['scroll_library'],
  },
  storm_mountain: {
    id: 'storm_mountain', name: '폭풍 산신', emoji: '⛰️⚡', rarity: 3, baseDamage: 34,
    passive: 'QUAKE_STUN', passiveDesc: '5번째 공격마다 전체 적 1.5초 기절',
    roomTypes: ['guardian'],
  },
  shadow_fox: {
    id: 'shadow_fox', name: '암영 여우', emoji: '🦊🌑', rarity: 3, baseDamage: 28,
    passive: 'DARK_CHARM', passiveDesc: '매혹 + 매혹된 적이 아군 공격',
    roomTypes: ['guardian', 'scroll_library'],
  },
  ice_dragon_lord: {
    id: 'ice_dragon_lord', name: '빙룡왕', emoji: '🐉❄️', rarity: 4, baseDamage: 36,
    passive: 'GLACIAL_DOMAIN', passiveDesc: '전체 적 이동속도 -20% + 동결 확률',
    roomTypes: ['guardian'],
  },
};

// Canonical 10-entry lookup: sort both IDs alphabetically → join with '+'
export const COMBINATION_TABLE: Record<string, string> = {
  'dokkaebi_warrior+gumiho_guardian': 'fox_warrior',
  'fire_dokkaebi+frost_spirit':       'storm_spirit',
  'death_messenger+sage':             'soul_guardian',
  'dokkaebi_junior+gold_turtle':      'golden_dokkaebi',
  'sea_god_spear+white_tiger':        'thunder_knight',
  'fox_shaman+gumiho_guardian':       'gumiho_archmage',
  'frost_spirit+mask_dancer':         'glacier_warrior',
  'iron_mask+thunder_hero':           'lightning_mask',
  'dokkaebi_warrior+fire_dokkaebi':   'flame_dokkaebi_king',
  'gumiho_guardian+sage':             'fairy',
  // ─── Ch3+ combinations ───
  'ghost_hunter+venom_warrior':       'venom_ghost',
  'great_serpent+thunder_hero':       'thunder_serpent',
  'mask_dancer+moon_rabbit_sage':     'moon_dancer',
  'celestial_dancer+three_legged_crow': 'celestial_phoenix',
  'mountain_god+sage':                'dragon_sage',
  'mountain_god+storm_archer':        'storm_mountain',
  'gumiho_guardian+shadow_dokkaebi':  'shadow_fox',
  'frost_spirit+sea_dragon_lord':     'ice_dragon_lord',
};

export function combinationKey(idA: string, idB: string): string {
  return [getBaseId(idA), getBaseId(idB)].sort().join('+');
}

// ─── Awakened passives ────────────────────────────────────────────────────────

export const AWAKENED_PASSIVES: Record<string, { desc: string }> = {
  // ─── Ch1 ──────────────────────────────────────────────────────────────────
  dokkaebi_warrior: { desc: '첫 공격 3× 피해 + 3초 기절'   },
  dokkaebi_junior:  { desc: '인접 도깨비 당 공속 +20%'     },
  village_archer:   { desc: '30% 확률 2초 속박'             },
  gold_turtle:      { desc: '처치 당 +5💰'                  },
  fire_dokkaebi:    { desc: '화상 15/초 × 5스택'            },
  sage:             { desc: '인접 방 공속 -25%'             },
  // ─── Ch2 ──────────────────────────────────────────────────────────────────
  gumiho_guardian:  { desc: '매혹 시간 5초로 증가'          },
  frost_spirit:     { desc: '동결 + 사망시 AoE 90피해'      },
  white_tiger:      { desc: '돌진 피해 2.5× + 밀어내기 거리 2배' },
  sea_god_spear:    { desc: '관통 공격: 1열 모든 적 동시 타격' },
  fox_shaman:       { desc: '주술 적중 시 30% 추가 매혹'    },
  iron_mask:        { desc: '체력 50% 이하 시 철벽 모드 (피해 -60%)' },
  // ─── Ch3 ──────────────────────────────────────────────────────────────────
  death_messenger:  { desc: '처형 임계치 20% → 30%로 상승'  },
  thunder_hero:     { desc: '연쇄 번개 대상 수 3 → 6, 각 80피해' },
  ghost_hunter:     { desc: '퇴마 공격 보스 추가 피해 +50%' },
  mask_dancer:      { desc: '회오리 범위 2배 + 이동속도 감소' },
  venom_warrior:    { desc: '독 스택 최대 8 + 스택당 피해 증가' },
  // ─── Ch4 ──────────────────────────────────────────────────────────────────
  celestial_dancer: { desc: '전체 적 이동속도 -25% (영구 오라)' },
  three_legged_crow:{ desc: '태양 화염 범위 공격 + 화상 3스택' },
  great_serpent:    { desc: '독아 치명타 시 즉사 (보스 제외)' },
  moon_rabbit_sage: { desc: '달빛 회복 2배 + 인접 방 쿨다운 -20%' },
  // ─── Ch5 ──────────────────────────────────────────────────────────────────
  mountain_god:     { desc: '산신 영역: 인접 모든 방 ATK +30%' },
  volcanic_warrior: { desc: '용암 폭발 범위 3× + 잔류 화상 5초' },
  storm_archer:     { desc: '폭풍 화살 3연사 + 각 15% 기절' },
  abyss_mage:       { desc: '심연 마법 관통 + 마법 저항 무시' },
  celestial_healer: { desc: '천상 치유 전체 방 동시 회복'    },
  mask_berserker:   { desc: '광전 모드: 체력 30% 이하 시 ATK 3배' },
  sea_dragon_lord:  { desc: '해룡 일격 보스 추가 피해 +80%' },
  fox_spirit_elder: { desc: '장로 결계: 인접 방 피해 면역 3초/웨이브' },
};

// ─── Materials ────────────────────────────────────────────────────────────────

export interface MaterialDef {
  id:    string;
  name:  string;
  emoji: string;
}

export const MATERIAL_DEFS: Record<string, MaterialDef> = {
  dok_fragment:  { id: 'dok_fragment',  name: '도깨비 파편', emoji: '🔴' },
  iron_shard:    { id: 'iron_shard',    name: '철 조각',     emoji: '⚫' },
  fox_fur:       { id: 'fox_fur',       name: '여우 털',     emoji: '🟠' },
  ice_crystal:   { id: 'ice_crystal',   name: '얼음 결정',   emoji: '🔵' },
  soul_fragment: { id: 'soul_fragment', name: '영혼 파편',   emoji: '💜' },
  shadow_cloth:  { id: 'shadow_cloth',  name: '어둠 천',     emoji: '⬛' },
  old_cloth:     { id: 'old_cloth',     name: '낡은 천',     emoji: '🟤' },
  herb:          { id: 'herb',          name: '약초',        emoji: '🌿' },
  common_ore:    { id: 'common_ore',    name: '일반 광석',   emoji: '🪨' },
  magic_dust:    { id: 'magic_dust',    name: '마법 가루',   emoji: '✨' },
  boss_essence:  { id: 'boss_essence',  name: '보스 정수',   emoji: '💠' },
};

export const DROP_TABLE: Record<string, Array<{ id: string; chance: number }>> = {
  // ── Quest invasion invaders ───────────────────────────────────────────────
  peasant_soldier: [{ id: 'old_cloth',    chance: 0.15 }, { id: 'iron_shard',  chance: 0.10 }],
  shield_knight:   [{ id: 'iron_shard',   chance: 0.20 }, { id: 'dok_fragment', chance: 0.05 }],
  shadow_thief:    [{ id: 'shadow_cloth', chance: 0.20 }, { id: 'dok_fragment', chance: 0.05 }],
  field_medic:     [{ id: 'herb',         chance: 0.25 }, { id: 'old_cloth',   chance: 0.10 }],
  // ── Chapter 1 ─────────────────────────────────────────────────────────────
  peasant:         [{ id: 'old_cloth',     chance: 0.12 }],
  soldier:         [{ id: 'iron_shard',    chance: 0.12 }, { id: 'old_cloth',     chance: 0.08 }],
  knight:          [{ id: 'iron_shard',    chance: 0.18 }, { id: 'dok_fragment',  chance: 0.05 }],
  shaman:          [{ id: 'herb',          chance: 0.18 }, { id: 'soul_fragment', chance: 0.05 }],
  void:            [{ id: 'soul_fragment', chance: 0.15 }, { id: 'shadow_cloth',  chance: 0.10 }],
  undying:         [{ id: 'soul_fragment', chance: 0.20 }, { id: 'dok_fragment',  chance: 0.08 }],
  // ── Chapter 2 ─────────────────────────────────────────────────────────────
  berserker:          [{ id: 'iron_shard',    chance: 0.18 }, { id: 'dok_fragment',  chance: 0.08 }],
  shadow_ninja:       [{ id: 'shadow_cloth',  chance: 0.20 }, { id: 'soul_fragment', chance: 0.08 }],
  siege_soldier:      [{ id: 'iron_shard',    chance: 0.22 }, { id: 'old_cloth',     chance: 0.10 }],
  holy_paladin:       [{ id: 'ice_crystal',   chance: 0.15 }, { id: 'herb',          chance: 0.10 }],
  iron_golem:         [{ id: 'iron_shard',    chance: 0.25 }, { id: 'dok_fragment',  chance: 0.10 }],
  high_priest:        [{ id: 'herb',          chance: 0.20 }, { id: 'soul_fragment', chance: 0.10 }],
  mercenary_captain:  [{ id: 'iron_shard',    chance: 0.20 }, { id: 'fox_fur',       chance: 0.08 }],
  trap_breaker:       [{ id: 'iron_shard',    chance: 0.18 }, { id: 'shadow_cloth',  chance: 0.10 }],
  fox_queen:          [{ id: 'fox_fur',       chance: 0.25 }, { id: 'soul_fragment', chance: 0.12 }],
  // ── Chapter 3 ─────────────────────────────────────────────────────────────
  undying_knight:     [{ id: 'soul_fragment', chance: 0.22 }, { id: 'iron_shard',    chance: 0.12 }],
  scarecrow_mage:     [{ id: 'shadow_cloth',  chance: 0.20 }, { id: 'herb',          chance: 0.12 }],
  venom_dancer:       [{ id: 'herb',          chance: 0.22 }, { id: 'shadow_cloth',  chance: 0.10 }],
  void_assassin:      [{ id: 'shadow_cloth',  chance: 0.25 }, { id: 'soul_fragment', chance: 0.12 }],
  dragon_king:        [{ id: 'dok_fragment',  chance: 0.25 }, { id: 'ice_crystal',   chance: 0.15 }],
  // ── Chapter 4 ─────────────────────────────────────────────────────────────
  void_assassin_elite:[{ id: 'shadow_cloth',  chance: 0.28 }, { id: 'soul_fragment', chance: 0.15 }],
  death_emissary:     [{ id: 'soul_fragment', chance: 0.28 }, { id: 'dok_fragment',  chance: 0.12 }],
  ghost_add:          [{ id: 'soul_fragment', chance: 0.20 }, { id: 'shadow_cloth',  chance: 0.12 }],
  // ── Chapter 5 ─────────────────────────────────────────────────────────────
  void_invader:          [{ id: 'soul_fragment', chance: 0.30 }, { id: 'shadow_cloth',  chance: 0.15 }],
  undying_warrior:       [{ id: 'iron_shard',    chance: 0.25 }, { id: 'soul_fragment', chance: 0.15 }],
  three_god_destroyer:   [{ id: 'dok_fragment',  chance: 0.30 }, { id: 'ice_crystal',   chance: 0.18 }],
  // ── Chapter 6 ─────────────────────────────────────────────────────────────
  mirror_knight:         [{ id: 'iron_shard',    chance: 0.28 }, { id: 'ice_crystal',   chance: 0.15 }],
  swarm_larva:           [{ id: 'old_cloth',     chance: 0.20 }, { id: 'herb',          chance: 0.12 }],
  swarm_spawn:           [{ id: 'old_cloth',     chance: 0.22 }, { id: 'shadow_cloth',  chance: 0.12 }],
  shadow_wraith:         [{ id: 'shadow_cloth',  chance: 0.30 }, { id: 'soul_fragment', chance: 0.18 }],
  celestial_crusader:    [{ id: 'ice_crystal',   chance: 0.25 }, { id: 'iron_shard',    chance: 0.15 }],
  void_colossus:         [{ id: 'soul_fragment', chance: 0.32 }, { id: 'dok_fragment',  chance: 0.18 }],
  plague_herald:         [{ id: 'herb',          chance: 0.30 }, { id: 'shadow_cloth',  chance: 0.15 }],
  titan_sentinel:        [{ id: 'iron_shard',    chance: 0.32 }, { id: 'dok_fragment',  chance: 0.18 }],
  eternal_emperor:       [{ id: 'dok_fragment',  chance: 0.35 }, { id: 'soul_fragment', chance: 0.20 }],
};

export function rollMaterialDrop(invaderType: string): string | null {
  const table = DROP_TABLE[invaderType];
  if (!table) return null;
  for (const e of table) { if (Math.random() < e.chance) return e.id; }
  return null;
}

// ─── Blueprints ───────────────────────────────────────────────────────────────

export interface BlueprintDef {
  id:          string;
  name:        string;
  type:        'weapon' | 'armor' | 'accessory';
  rarity:      number;
  statDesc:    string;
  stats:       Record<string, number>;
  materials:   Record<string, number>;
  resultId:    string;
  resultEmoji: string;
}

export const BLUEPRINT_DEFS: Record<string, BlueprintDef> = {
  bp_dokkaebi_club: {
    id: 'bp_dokkaebi_club', name: '도깨비 방망이', type: 'weapon', rarity: 1,
    statDesc: 'ATK +20% · 기절 +0.5초',
    stats: { atkBonus: 0.20, stunDuration: 0.5 },
    materials: { dok_fragment: 3, iron_shard: 2 },
    resultId: 'eq_dokkaebi_club', resultEmoji: '🪓',
  },
  bp_iron_armor: {
    id: 'bp_iron_armor', name: '철 갑옷', type: 'armor', rarity: 1,
    statDesc: '방 HP +100 · 골드 +10%',
    stats: { roomHPBonus: 100, goldBonus: 0.10 },
    materials: { iron_shard: 4, old_cloth: 2 },
    resultId: 'eq_iron_armor', resultEmoji: '🥋',
  },
  bp_fox_robe: {
    id: 'bp_fox_robe', name: '구미호 로브', type: 'armor', rarity: 2,
    statDesc: '스킬 쿨다운 -20%',
    stats: { skillCDReduction: 0.20 },
    materials: { fox_fur: 2, shadow_cloth: 3 },
    resultId: 'eq_fox_robe', resultEmoji: '🥻',
  },
  bp_frost_lance: {
    id: 'bp_frost_lance', name: '빙하 창', type: 'weapon', rarity: 2,
    statDesc: 'ATK +10% · 동결 +15%',
    stats: { atkBonus: 0.10, freezeChance: 0.15 },
    materials: { ice_crystal: 3, iron_shard: 3 },
    resultId: 'eq_frost_lance', resultEmoji: '🔱',
  },
  bp_soul_ring: {
    id: 'bp_soul_ring', name: '영혼 반지', type: 'accessory', rarity: 2,
    statDesc: '스킬 쿨다운 -15% · 수정 +15%',
    stats: { skillCDReduction: 0.15, scEarnBonus: 0.15 },
    materials: { soul_fragment: 4, herb: 2 },
    resultId: 'eq_soul_ring', resultEmoji: '💍',
  },
  bp_shadow_blade: {
    id: 'bp_shadow_blade', name: '그림자 칼날', type: 'weapon', rarity: 2,
    statDesc: 'ATK +25%',
    stats: { atkBonus: 0.25 },
    materials: { shadow_cloth: 4, iron_shard: 2 },
    resultId: 'eq_shadow_blade', resultEmoji: '🗡️',
  },
  bp_herb_potion: {
    id: 'bp_herb_potion', name: '약초 포션', type: 'accessory', rarity: 1,
    statDesc: '방 HP +50 · 수정 +10%',
    stats: { roomHPBonus: 50, scEarnBonus: 0.10 },
    materials: { herb: 4, old_cloth: 2 },
    resultId: 'eq_herb_potion', resultEmoji: '🧪',
  },
  bp_ice_shield: {
    id: 'bp_ice_shield', name: '얼음 방패', type: 'armor', rarity: 2,
    statDesc: '방 HP +150 · 동결 +10%',
    stats: { roomHPBonus: 150, freezeChance: 0.10 },
    materials: { ice_crystal: 4, iron_shard: 2 },
    resultId: 'eq_ice_shield', resultEmoji: '🛡️',
  },
  // ─── Rarity 3 (Epic) ───────────────────────────────────────────────────────
  bp_dragon_fang: {
    id: 'bp_dragon_fang', name: '용아검', type: 'weapon', rarity: 3,
    statDesc: 'ATK +40% · 보스 추가 피해 +25%',
    stats: { atkMultiplier: 0.40, bossDmgBonus: 0.25 },
    materials: { dok_fragment: 8, iron_shard: 6, soul_fragment: 4 },
    resultId: 'eq_dragon_fang', resultEmoji: '🗡️',
  },
  bp_spirit_robe: {
    id: 'bp_spirit_robe', name: '영혼 법의', type: 'armor', rarity: 3,
    statDesc: '방 HP +300 · 피해 감소 +15%',
    stats: { roomHPBonus: 300, dmgReduction: 0.15 },
    materials: { soul_fragment: 8, shadow_cloth: 5, old_cloth: 3 },
    resultId: 'eq_spirit_robe', resultEmoji: '👘',
  },
  bp_moonstone_pendant: {
    id: 'bp_moonstone_pendant', name: '월석 목걸이', type: 'accessory', rarity: 3,
    statDesc: '공속 +20% · 스킬 쿨다운 -15%',
    stats: { atkSpeedBonus: 0.20, cdReduction: 0.15 },
    materials: { ice_crystal: 6, fox_fur: 4, herb: 3 },
    resultId: 'eq_moonstone_pendant', resultEmoji: '📿',
  },
  // ─── Rarity 4 (Legendary) ──────────────────────────────────────────────────
  bp_heavenly_blade: {
    id: 'bp_heavenly_blade', name: '천상의 검', type: 'weapon', rarity: 4,
    statDesc: 'ATK +60% · 5번째 공격 전체 적 피해',
    stats: { atkMultiplier: 0.60, aoeEvery: 5 },
    materials: { dok_fragment: 15, iron_shard: 10, soul_fragment: 8, ice_crystal: 5 },
    resultId: 'eq_heavenly_blade', resultEmoji: '⚔️',
  },
  bp_guardian_crown: {
    id: 'bp_guardian_crown', name: '수호자의 왕관', type: 'accessory', rarity: 4,
    statDesc: '인접 방 ATK +25% · 방 HP +200',
    stats: { adjacentAtkBonus: 0.25, roomHPBonus: 200 },
    materials: { dok_fragment: 12, fox_fur: 8, soul_fragment: 6, shadow_cloth: 5 },
    resultId: 'eq_guardian_crown', resultEmoji: '👑',
  },
  // ─── 주간 보스 전용 레시피 ─────────────────────────────────────────────────
  bp_boss_amulet: {
    id: 'bp_boss_amulet', name: '보스 부적', type: 'accessory', rarity: 3,
    statDesc: '보스 추가 피해 +40% · 스킬 쿨다운 -20%',
    stats: { bossDmgBonus: 0.40, skillCDReduction: 0.20 },
    materials: { boss_essence: 2, soul_fragment: 5, dok_fragment: 4 },
    resultId: 'eq_boss_amulet', resultEmoji: '🔮',
  },
  bp_arcane_core: {
    id: 'bp_arcane_core', name: '마법 핵심', type: 'weapon', rarity: 3,
    statDesc: 'ATK +30% · 마법 가루 3개 소모',
    stats: { atkMultiplier: 0.30, magicBoost: 1 },
    materials: { magic_dust: 3, common_ore: 4, soul_fragment: 3 },
    resultId: 'eq_arcane_core', resultEmoji: '💫',
  },
  bp_ore_plate: {
    id: 'bp_ore_plate', name: '광석 흉갑', type: 'armor', rarity: 2,
    statDesc: '방 HP +200 · 피해 감소 +10%',
    stats: { roomHPBonus: 200, dmgReduction: 0.10 },
    materials: { common_ore: 5, iron_shard: 3 },
    resultId: 'eq_ore_plate', resultEmoji: '🪖',
  },
};

export const STARTER_BLUEPRINTS = ['bp_dokkaebi_club', 'bp_iron_armor'];
