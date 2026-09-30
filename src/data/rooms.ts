export type RoomType = 'guardian' | 'trap' | 'gold' | 'tower' | 'scroll_library' | 'trap_corridor' | 'armory' | 'medicine_hall'
  | 'spirit_altar' | 'dragons_lair' | 'celestial_shrine' | 'void_forge'
  | 'grand_vault' | 'elite_den';

export interface RoomDef {
  type: RoomType;
  koreanName: string;
  description: string;
  emoji: string;
  cost: number;
  accentColor: number;   // Phaser hex
  accentCSS: string;     // CSS string
  attackDamage: number;
  attackRange: number;   // rows affected
  attackCooldown: number; // ms
  goldPerSec: number;
  baseHp: number;
  upgradeMult: number;
  chapter?: number;         // 1, 2, or 3; undefined = Ch1
  isPassive?: boolean;      // armory: no monster, no attack — pure buff
  healRate?: number;        // medicine_hall: HP/sec to adjacent rooms
}

export interface RoomData {
  type: RoomType;
  level: number;          // 1–3
  hp: number;
  maxHp: number;
  attackCooldown: number;
  lastAttackTime: number;
  goldPerSec: number;
  monsterSlot:          string | null;   // primary owned monster id (slot 0)
  monsterSlots:         (string | null)[];  // all owned monster ids incl. evolved/hybrid ids
  hasFirstStrikeUsed:   boolean;   // reset each wave
  lastScrollBurstTime:  number;    // scroll_library Lv3 burst cooldown
  scrollBurstActiveUntil: number;  // when the 2× magic-room buff expires
  foxCharmAttackCount:  number;    // FOX_FIRE_CHARM: every 3rd attack
  tideHitCount:         number;    // TIDE_THRUST: every 4th hit
  tauntLastTime:        number;    // TAUNTING_ROAR: 8000ms interval
  roomHp:     number;       // Ch3: actual structural HP of the room cell
  maxRoomHp:  number;       // max structural HP
  armoryDmgBonus:   number;   // cached bonus from adjacent armory (0 if none)
  roomTypeDmgMult: number;   // multiplier from adjacent support room (default 1.0)
  venomHitCount:  number;   // VENOM_STACK: hits mod 5
  whirlwindHitCount: number; // WHIRLWIND_DANCE: hits mod 5
  soulHarvestLastTime: number; // SOUL_HARVEST execute cooldown
  altarKillCount:       number;   // SPIRIT_ALTAR: kills toward next ghost summon
  altarGhostActiveUntil: number;  // timestamp until ghost expires (0 = none)
  dragonRoarLastTime:   number;   // DRAGONS_LAIR: last Dragon's Roar timestamp
  lunarResetLastTime:   number;   // MOON_RABBIT LUNAR_RHYTHM: last 30s reset
  deathRattleLastTime:  number;   // DEATH_RATTLE: last 30s burst timestamp
  // Active skill state
  nextAttack3x:    boolean;  // heavy_strike: next attack is 3×
  immuneUntil:     number;   // fortress/shield: take no damage until this timestamp
  speedBoostUntil: number;   // speed_up: monster attacks faster until this timestamp
  rageUntil:       number;   // rage: monster ATK ×2 until this timestamp
}

export const ROOM_DEFS: Record<RoomType, RoomDef> = {
  guardian: {
    type: 'guardian', koreanName: '수호 방', description: '몬스터가 침략자를 공격',
    emoji: '⚔️', cost: 100, accentColor: 0x8b0000, accentCSS: '#8b0000',
    attackDamage: 20, attackRange: 1, attackCooldown: 1500,
    goldPerSec: 0, baseHp: 200, upgradeMult: 1.6,
  },
  trap: {
    type: 'trap', koreanName: '영혼 덫', description: '침략자를 감속/기절',
    emoji: '🕸', cost: 80, accentColor: 0x4a0080, accentCSS: '#4a0080',
    attackDamage: 10, attackRange: 1, attackCooldown: 3000,
    goldPerSec: 0, baseHp: 100, upgradeMult: 1.5,
  },
  gold: {
    type: 'gold', koreanName: '황금 광맥', description: '홈 운영 수익 +12 황금/분 (전투 중 생산 없음)',
    emoji: '💰', cost: 120, accentColor: 0xc8921a, accentCSS: '#c8921a',
    attackDamage: 0, attackRange: 0, attackCooldown: 0,
    goldPerSec: 10, baseHp: 120, upgradeMult: 1.4,
  },
  tower: {
    type: 'tower', koreanName: '봉화 망루', description: '2열 원거리 공격',
    emoji: '🏹', cost: 130, accentColor: 0x2d4a1e, accentCSS: '#2d4a1e',
    attackDamage: 15, attackRange: 2, attackCooldown: 2000,
    goldPerSec: 0, baseHp: 150, upgradeMult: 1.5,
  },

  // ─── Chapter 2 rooms ───────────────────────────────────────────────────────

  scroll_library: {
    type: 'scroll_library', koreanName: '마법 서고', chapter: 2,
    description: '인접 마법 몬스터 공격력 +15/25/40%; Lv3: 파동 폭발 (2× 공격, 4s)',
    emoji: '📚', cost: 120, accentColor: 0x7a20c0, accentCSS: '#7a20c0',
    attackDamage: 0, attackRange: 0, attackCooldown: 0,   // no direct attack — monsters do the damage
    goldPerSec: 0, baseHp: 160, upgradeMult: 1.5,
  },
  trap_corridor: {
    type: 'trap_corridor', koreanName: '함정 복도', chapter: 2,
    description: 'Lv1: 감속+가시; Lv2: +독; Lv3: +화염, 빙결 2× 피해',
    emoji: '⚙️', cost: 110, accentColor: 0x2a7a30, accentCSS: '#2a7a30',
    attackDamage: 15, attackRange: 1, attackCooldown: 2500,
    goldPerSec: 0, baseHp: 130, upgradeMult: 1.5,
  },

  // ─── Chapter 3 rooms ───────────────────────────────────────────────────────

  armory: {
    type: 'armory', koreanName: '무기고', chapter: 3, isPassive: true,
    description: '인접 수호 방 공격력 강화 (Lv1: 반경1 +25%, Lv2: 반경2 +35%, Lv3: +50%+쿨감)',
    emoji: '⚒️', cost: 90, accentColor: 0x8b6914, accentCSS: '#8b6914',
    attackDamage: 0, attackRange: 0, attackCooldown: 0,
    goldPerSec: 0, baseHp: 180, upgradeMult: 1.5,
  },
  medicine_hall: {
    type: 'medicine_hall', koreanName: '의술 방', chapter: 3,
    description: 'Lv1: 인접 방 2HP/초, Lv2: 5HP/초+자가회복, Lv3: 10HP/초+15s 전체 회복',
    emoji: '🌿', cost: 100, accentColor: 0x228b22, accentCSS: '#228b22',
    attackDamage: 0, attackRange: 0, attackCooldown: 0,
    goldPerSec: 0, baseHp: 140, upgradeMult: 1.5, healRate: 2,
  },
  spirit_altar: {
    type: 'spirit_altar', koreanName: '제단', chapter: 4,
    description: 'Lv1: 10킬→유령 전사 소환 (HP100, 10s); Lv2: 8킬→유령 2체; Lv3: 6킬→유령 장군 (기절)',
    emoji: '⛩️', cost: 150, accentColor: 0x7700cc, accentCSS: '#7700cc',
    attackDamage: 0, attackRange: 0, attackCooldown: 0,
    goldPerSec: 0, baseHp: 160, upgradeMult: 1.5,
  },
  dragons_lair: {
    type: 'dragons_lair', koreanName: '용의 둥지', chapter: 4,
    description: 'Lv1: 보스에게 2× 피해; Lv2: +방 HP 400, 보스 처치 +100g; Lv3: 10% 확률 드래곤 포효 (적 -50% 속도 3s)',
    emoji: '🐲', cost: 200, accentColor: 0x440088, accentCSS: '#440088',
    attackDamage: 30, attackRange: 1, attackCooldown: 5000,
    goldPerSec: 0, baseHp: 300, upgradeMult: 1.6,
  },

  // ─── Chapter 5 rooms ───────────────────────────────────────────────────────

  celestial_shrine: {
    type: 'celestial_shrine', koreanName: '천상 신전', chapter: 5,
    description: 'Lv1: 성스러운 피해+감속; Lv2: +50% 피해, 신성 면역 감소; Lv3: 전열 성스러운 파동 (2× 피해)',
    emoji: '🕌', cost: 160, accentColor: 0xe8c060, accentCSS: '#e8c060',
    attackDamage: 22, attackRange: 1, attackCooldown: 3000,
    goldPerSec: 0, baseHp: 180, upgradeMult: 1.5,
  },

  // ─── Chapter 6 rooms ───────────────────────────────────────────────────────

  void_forge: {
    type: 'void_forge', koreanName: '공허 용광로', chapter: 6,
    description: 'Lv1: 3행 관통 공허 포화 (5s 쿨타임); Lv2: 피해 +70%, 쿨타임 4s; Lv3: 전열 공허 폭발 + 1s 기절',
    emoji: '🔥', cost: 190, accentColor: 0x3300aa, accentCSS: '#3300aa',
    attackDamage: 260, attackRange: 3, attackCooldown: 5500,
    goldPerSec: 0, baseHp: 220, upgradeMult: 1.6,
  },

  // ─── Gem-unlocked special rooms (roomBuildings.ts PREMIUM_BUILDING_GEMS) ──────
  // Not chapter-gated: bought once with gems, kept forever (also through prestige).

  grand_vault: {
    type: 'grand_vault', koreanName: '대형 보물고',
    description: '보석 특수 방 · 홈 운영 수익 +24 황금/분(황금 광맥의 2배) · 모험가가 노린다',
    emoji: '🏦', cost: 200, accentColor: 0xe0b040, accentCSS: '#e0b040',
    attackDamage: 0, attackRange: 0, attackCooldown: 0,
    goldPerSec: 0, baseHp: 180, upgradeMult: 1.4,
  },
  elite_den: {
    type: 'elite_den', koreanName: '고급 몬스터 굴',
    description: '보석 특수 방 · 떠돌이 몬스터 포섭 70%·부족 조각 +20 · 근접 방어',
    emoji: '🐺', cost: 200, accentColor: 0x8a5cc8, accentCSS: '#8a5cc8',
    attackDamage: 24, attackRange: 1, attackCooldown: 3500,
    goldPerSec: 0, baseHp: 280, upgradeMult: 1.5,
  },
};

// Per-level effect tables. Home rooms climb to MAX_ROOM_LEVEL (5); a level past
// the end of a table holds the last value rather than falling off a cliff.
function atLevel<T>(table: readonly T[], level: number): T {
  return table[Math.min(Math.max(level, 1), table.length) - 1];
}

/** Aura bonus (as a multiplier) that a scroll_library grants adjacent rooms */
export function getScrollAuraBonus(level: number): number {
  return atLevel([0.15, 0.25, 0.40, 0.50, 0.60], level);
}

/** Heal rate (HP/sec) that a medicine_hall grants adjacent rooms at given level */
export function getMedicineHealRate(level: number): number {
  return atLevel([2, 5, 10, 15, 20], level);
}

/** Damage bonus multiplier that an armory grants to adjacent guardian rooms */
export function getArmoryDmgBonus(level: number): number {
  return atLevel([0.25, 0.35, 0.50, 0.60, 0.70], level);
}

/** Armory radius in grid tiles */
export function getArmoryRadius(level: number): number {
  return level >= 2 ? 2 : 1;
}

/** Kills needed per level to summon a ghost from spirit_altar */
export function getAltarKillsNeeded(level: number): number {
  return atLevel([10, 8, 6, 5, 4], level);
}

/** Dragon's Lair attack cooldown (ms) per level */
export function getDragonsLairCooldown(level: number): number {
  return atLevel([5000, 4000, 3000, 2500, 2000], level);
}

/** Room structural HP for Ch3 — returns baseHp from RoomDef */
export function getRoomStructuralHp(type: RoomType): number {
  return ROOM_DEFS[type]?.baseHp ?? 100;
}

// ─── Room families ────────────────────────────────────────────────────────────
// The home board designs a slot by *family* (what role the room plays, which
// also fixes its monster/trap capacity bonus) and then by *building* (which of
// the concrete rooms above actually fights). Every building belongs to exactly
// one family; a family's default building is the one a fresh design gets.

export type RoomFamily = 'combat' | 'trap' | 'support' | 'magic';

export const ROOM_FAMILY: Record<RoomType, RoomFamily> = {
  guardian:         'combat',
  tower:            'combat',
  dragons_lair:     'combat',
  celestial_shrine: 'combat',
  void_forge:       'combat',
  elite_den:        'combat',
  trap:             'trap',
  trap_corridor:    'trap',
  gold:             'support',
  medicine_hall:    'support',
  armory:           'support',
  grand_vault:      'support',
  scroll_library:   'magic',
  spirit_altar:     'magic',
};

export const FAMILY_DEFAULT_ROOM: Record<RoomFamily, RoomType> = {
  combat:  'guardian',
  trap:    'trap',
  support: 'medicine_hall',
  magic:   'scroll_library',
};

export const ROOM_FAMILY_ORDER: readonly RoomFamily[] = ['combat', 'trap', 'support', 'magic'];

/** Shared room-level curve for combat damage and comparative room power. */
export function getRoomLevelDamageMult(level: number): number {
  return Math.pow(1.4, Math.max(0, level - 1));
}
