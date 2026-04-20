import { type OwnedMonster, STARTER_ROSTER, defaultOwnedMonster } from './barracks';
export type { OwnedMonster };

// ─── Branch definitions ───────────────────────────────────────────────────────

export interface BranchDef {
  id:           string;
  name:         string;          // Korean display name
  icon:         string;          // emoji
  effect:       string;          // description template (use {value})
  costPerTier:  number[];        // crystal cost for each tier upgrade (length = maxTier)
  getValue:     (tier: number) => number;
  position:     { x: number; y: number };  // on 390-wide canvas
}

export const MAX_WISDOM_TIER = 5;

export const BRANCH_DEFS: BranchDef[] = [
  {
    id: 'goldHands',
    name: '황금의 손',
    icon: '💰',
    effect: '시작 골드 +{value}',
    costPerTier: [5, 10, 20, 35, 50],
    getValue: (tier) => tier * 50,
    position: { x: 195, y: 180 },
  },
  {
    id: 'ironWalls',
    name: '강인한 성벽',
    icon: '🏰',
    effect: '던전 최대 HP +{value}',
    costPerTier: [5, 10, 20, 35, 50],
    getValue: (tier) => tier * 20,
    position: { x: 340, y: 260 },
  },
  {
    id: 'masterCraft',
    name: '장인의 솜씨',
    icon: '🔨',
    effect: '방 설치 비용 -{value}%',
    costPerTier: [5, 10, 20, 35, 50],
    getValue: (tier) => tier * 5,
    position: { x: 370, y: 422 },
  },
  {
    id: 'swiftVictory',
    name: '속전속결',
    icon: '⚡',
    effect: '웨이브 보상 +{value}%',
    costPerTier: [5, 10, 20, 35, 50],
    getValue: (tier) => tier * 10,
    position: { x: 340, y: 584 },
  },
  {
    id: 'ancestorsWisdom',
    name: '선조의 지혜',
    icon: '📜',
    effect: '추가 방 슬롯 +{value}',
    costPerTier: [5, 15, 25, 40, 60],
    getValue: (tier) => tier,
    position: { x: 195, y: 664 },
  },
  {
    id: 'crystalResonance',
    name: '결정 공명',
    icon: '💎',
    effect: '영혼 수정 획득 +{value}%',
    costPerTier: [5, 10, 20, 35, 50],
    getValue: (tier) => tier * 20,
    position: { x: 50, y: 584 },
  },
  {
    id: 'guardianBlessing',
    name: '수호신의 가호',
    icon: '🛡️',
    effect: '몬스터 피해 -{value}%',
    costPerTier: [5, 10, 20, 35, 50],
    getValue: (tier) => tier * 5,
    position: { x: 50, y: 260 },
  },
  // ─── 새 브랜치 (3개) ─────────────────────────────────────────────────────────
  {
    id: 'eliteTrainer',
    name: '정예 조련사',
    icon: '⚔️',
    effect: '모든 몬스터 공격력 +{value}%',
    costPerTier: [8, 15, 25, 40, 60],
    getValue: (tier) => tier * 3,
    position: { x: 50, y: 422 },
  },
  {
    id: 'celestialBlood',
    name: '천계의 혈통',
    icon: '✨',
    effect: '웨이브 클리어 시 소울 크리스탈 +{value}개',
    costPerTier: [10, 20, 35, 55, 80],
    getValue: (tier) => tier,
    position: { x: 340, y: 760 },
  },
  {
    id: 'dungeonFortress',
    name: '요새화된 던전',
    icon: '🏯',
    effect: '던전 시작 추가 HP +{value}',
    costPerTier: [8, 15, 25, 40, 60],
    getValue: (tier) => tier * 50,
    position: { x: 195, y: 760 },
  },
];

// ─── Game state ───────────────────────────────────────────────────────────────

// ─── Quest state ──────────────────────────────────────────────────────────────

export interface QuestProgress {
  objectives:   Record<string, number>;   // objId → current count
  completed:    boolean;
  completedAt?: number;
}

export interface AchievementEntry {
  unlocked:       boolean;
  current:        number;
  unlockedAt?:    number;   // timestamp ms
  rewardClaimed?: boolean;
}

// ─── Summon system ───────────────────────────────────────────────────────────

export type SummonRarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';

export interface SummonRecord {
  type:      'normal' | 'special' | 'soul' | 'friendship';
  monsterId: string;
  rarity:    SummonRarity;
  isNew:     boolean;
  timestamp: number;
  scCompensation?: number;
  ceilingHit?:     boolean;
}

// ─── Room slot type ──────────────────────────────────────────────────────────

export type RoomSlotType = 'combat' | 'trap' | 'support' | 'magic';

export interface RoomSlotTypeDef {
  id:       RoomSlotType;
  name:     string;
  icon:     string;
  bonus:    string;
}

export const ROOM_SLOT_TYPE_DEFS: RoomSlotTypeDef[] = [
  { id: 'combat',  name: '전투실',  icon: '👊',  bonus: '몬스터 슬롯 +1' },
  { id: 'trap',    name: '함정실',  icon: '🕸',  bonus: '함정 슬롯 +1 · 함정 피해 +20%' },
  { id: 'support', name: '지원실',  icon: '💚',  bonus: '인접 방 몬스터 ATK/HP +15%' },
  { id: 'magic',   name: '마법진',  icon: '🔮',  bonus: '스킬 쿨다운 -20%' },
];

/** Returns monster/trap slot count for a given room level and type. */
export function getRoomSlotCapacity(
  level: number,
  type?: RoomSlotType,
): { monsters: number; traps: number } {
  // Base capacity per level
  const BASE: [number, number][] = [
    [1, 1],  // Lv.1
    [2, 1],  // Lv.2
    [3, 2],  // Lv.3
    [4, 2],  // Lv.4
    [5, 3],  // Lv.5
  ];
  const [m, t] = BASE[Math.max(0, Math.min(level - 1, BASE.length - 1))];
  return {
    monsters: m + (type === 'combat' ? 1 : 0),
    traps:    t + (type === 'trap'   ? 1 : 0),
  };
}

/** Maximum room level allowed for a given DM level. */
export function getMaxRoomLevel(dmLevel: number): number {
  if (dmLevel >= 20) return 5;
  if (dmLevel >= 15) return 4;
  if (dmLevel >= 10) return 3;
  if (dmLevel >= 5)  return 2;
  return 1;
}

export interface DungeonSlot {
  roomType?:   RoomSlotType;
  monsterIds:  (string | undefined)[];  // ordered monster slots (length = capacity.monsters)
  trapIds:     (string | undefined)[];  // ordered trap slots    (length = capacity.traps)
  roomLevel:   number;   // 1–5
  hp:          number;
  maxHp:       number;
}

export interface StageProgressEntry {
  unlocked:       boolean;
  bestStars:      number;
  bestHpPercent?: number;
}

export interface GameState {
  soulCrystals:   number;
  wisdomTree:     Record<string, number>;   // branchId → tier (0–5)
  stageProgress:  StageProgressEntry[];
  // Endless mode
  endlessHighScore: number;   // highest wave reached
  // Achievement tracking counters
  totalKills:       number;
  totalGoldEarned:  number;
  roomsBuilt:       string[];   // room type ids placed (duplicates allowed)
  bossesKilled:     string[];   // invader type ids (e.g. 'knight')
  // Achievements
  achievements: Record<string, AchievementEntry>;
  // Streak tracking
  consecutiveDays: number;
  lastPlayDate:    string;   // ISO date string YYYY-MM-DD
  // Game completion
  gameCompleted?:  boolean;
  // Monster barracks
  ownedMonsters:   OwnedMonster[];
  ownedEquipment:  string[];    // equipment IDs in inventory
  ownedActiveSkills: string[];  // active skill IDs in inventory
  cinematicSeen:   string[];    // cinematic IDs already watched
  // Dungeon Home (persistent base)
  dmLevel:   number;   // Dungeon Master level
  dmXP:      number;   // current XP toward next level
  homeGold:  number;   // gold in home base
  gems:      number;   // premium gems
  // Quest system
  activeMainQuestId: string;
  questProgress:     Record<string, QuestProgress>;
  unlockedFeatures:  string[];   // e.g. ['summon_altar', 'affinity_system', 'research_lab']
  // Monster Life system (Phase 3)
  monsterAffinity:   Record<string, number>;   // monsterId → 0–100
  monsterAwakened:   Record<string, boolean>;
  personalStorySeen: Record<string, boolean>;
  lastTalkTime:      Record<string, number>;   // monsterId → timestamp ms
  lastFedTime:       Record<string, number>;   // monsterId → timestamp ms
  dailyTrainCount:   Record<string, number>;   // monsterId → count today
  trainLastReset:    string;                   // YYYY-MM-DD
  // Fusion / Forge system (Phase 4)
  discoveredCombinations: string[];            // hybrid monster IDs discovered
  awakeningStones:   number;
  blueprints:        string[];                 // blueprint IDs owned
  materials:         Record<string, number>;   // materialId → quantity
  craftedEquipment:  Array<{ id: string; name: string; type: string; rarity: number; emoji: string; stats: Record<string, number> }>;
  dungeonSlots:      DungeonSlot[];   // per-slot room config (indexed by slot position)
  // Summon system (Phase 5)
  summonPity: {
    normal:  { count: number; guaranteed: number };
    special: { count: number; guaranteed: number };
  };
  summonHistory:    SummonRecord[];
  friendshipPoints: number;
  lastFriendSummon: string;   // YYYY-MM-DD
  // Skin system (Phase 6A)
  ownedSkins:    Record<string, string[]>;  // monsterId → skinId[]
  equippedSkins: Record<string, string>;    // monsterId → skinId
  // Dungeon theme
  ownedThemes:   string[];   // theme ids purchased
  equippedTheme: string;     // theme id, default 'cave'
  // Game completion tracking (Phase 4)
  totalFusions:    number;
  completedTribes: number;
  codexRewardsClaimed: string[];  // tribe IDs whose codex reward has been claimed
  // Tutorial system
  tutorialStage:   number;   // 0 = not started, 1-4 = step shown, 99 = done
  // Daily content
  dailyDungeonCompleted: string;
  weeklyBossHpDealt:     number;
  weeklyBossResetDate:   string;
  dailyChallenges:       Record<string, { completed: boolean; progress: number }>;
  dailyChallengeDate:    string;
  // Sub-quest system
  activeSubQuestIds:    string[];             // up to 2 active sub-quest IDs
  subQuestProgress:     Record<string, number>; // sqId → current progress
  completedSubQuestIds: string[];             // claimed sub-quest IDs
  // New Game+ / Prestige
  prestigeLevel?: number;   // 0 = not prestiged, 1+ = prestige count
}

const GAME_STATE_KEY = 'dungeonGameState';

function defaultGameState(): GameState {
  const tree: Record<string, number> = {};
  BRANCH_DEFS.forEach(b => { tree[b.id] = 0; });
  return {
    soulCrystals:     0,
    wisdomTree:       tree,
    stageProgress:    Array.from({ length: 80 }, (_, i) => ({ unlocked: i === 0, bestStars: 0 })),
    endlessHighScore: 0,
    totalKills:       0,
    totalGoldEarned:  0,
    roomsBuilt:       [],
    bossesKilled:     [],
    achievements:     {},
    consecutiveDays:   0,
    lastPlayDate:      '',
    ownedMonsters:     STARTER_ROSTER.map(id => defaultOwnedMonster(id)),
    ownedEquipment:    ['dokkaebi_club', 'golden_armor', 'lucky_charm'],   // starter equipment
    ownedActiveSkills: ['fire_burst', 'heal_room'],                         // starter active skills
    cinematicSeen:     [],
    dmLevel:   1,
    dmXP:      0,
    homeGold:  200,
    gems:      0,
    activeMainQuestId: '',
    questProgress:     {},
    unlockedFeatures:  [],
    monsterAffinity:   {},
    monsterAwakened:   {},
    personalStorySeen: {},
    lastTalkTime:      {},
    lastFedTime:       {},
    dailyTrainCount:   {},
    trainLastReset:    '',
    discoveredCombinations: [],
    awakeningStones:   0,
    blueprints:        [],
    materials:         {},
    craftedEquipment:  [],
    dungeonSlots:      [],
    summonPity:        { normal: { count: 0, guaranteed: 50 }, special: { count: 0, guaranteed: 80 } },
    summonHistory:     [],
    friendshipPoints:  10,
    lastFriendSummon:  '',
    ownedSkins:        {},
    equippedSkins:     {},
    ownedThemes:       ['cave'],
    equippedTheme:     'cave',
    totalFusions:      0,
    completedTribes:   0,
    codexRewardsClaimed: [],
    tutorialStage:     0,
    dailyDungeonCompleted: '',
    weeklyBossHpDealt:     0,
    weeklyBossResetDate:   '',
    dailyChallenges:       {},
    dailyChallengeDate:    '',
    activeSubQuestIds:     [],
    subQuestProgress:      {},
    completedSubQuestIds:  [],
  };
}

/** Migrate a raw saved DungeonSlot (old or new format) to the current schema. */
function migrateDungeonSlot(raw: Record<string, unknown>): DungeonSlot {
  // Old format had monsterId / trapId / trapId2
  if (!Array.isArray(raw['monsterIds'])) {
    const cap = getRoomSlotCapacity(
      (raw['roomLevel'] as number) ?? 1,
      raw['roomType'] as RoomSlotType | undefined,
    );
    const monsterIds: (string | undefined)[] = Array(cap.monsters).fill(undefined);
    const trapIds:    (string | undefined)[] = Array(cap.traps).fill(undefined);
    if (raw['monsterId']) monsterIds[0] = raw['monsterId'] as string;
    if (raw['trapId'])    trapIds[0]    = raw['trapId']    as string;
    if (raw['trapId2'])   trapIds[1]    = raw['trapId2']   as string;
    return {
      roomType:   raw['roomType'] as RoomSlotType | undefined,
      monsterIds,
      trapIds,
      roomLevel: (raw['roomLevel'] as number) ?? 1,
      hp:        (raw['hp']       as number) ?? 200,
      maxHp:     (raw['maxHp']    as number) ?? 200,
    };
  }
  return raw as unknown as DungeonSlot;
}

const TOTAL_STAGES = 80;
function migrateStageProgress(arr: GameState['stageProgress']): GameState['stageProgress'] {
  if (arr.length >= TOTAL_STAGES) return arr;
  return [
    ...arr,
    ...Array.from({ length: TOTAL_STAGES - arr.length }, () => ({ unlocked: false, bestStars: 0 })),
  ];
}

export function loadGameState(): GameState {
  const raw = localStorage.getItem(GAME_STATE_KEY);
  if (raw) {
    try {
      const saved = JSON.parse(raw) as Partial<GameState>;
      const defaults = defaultGameState();
      // Migrate dungeonSlots (old flat format → new array format)
      const rawSlots = saved.dungeonSlots as unknown[] | undefined;
      const dungeonSlots: DungeonSlot[] = (rawSlots ?? []).map(s =>
        migrateDungeonSlot(s as Record<string, unknown>),
      );
      return {
        ...defaults,
        ...saved,
        wisdomTree:        { ...defaults.wisdomTree, ...(saved.wisdomTree ?? {}) },
        stageProgress:     migrateStageProgress(saved.stageProgress ?? defaults.stageProgress),
        achievements:      saved.achievements       ?? defaults.achievements,
        ownedMonsters:     saved.ownedMonsters      ?? defaults.ownedMonsters,
        ownedEquipment:    saved.ownedEquipment     ?? defaults.ownedEquipment,
        ownedActiveSkills: saved.ownedActiveSkills  ?? defaults.ownedActiveSkills,
        dungeonSlots,
      };
    } catch { /* fall through */ }
  }
  return defaultGameState();
}

export function saveGameState(state: GameState): void {
  localStorage.setItem(GAME_STATE_KEY, JSON.stringify(state));
}

// ─── Save Export / Import ────────────────────────────────────────────────────

export function exportGameState(): string {
  const gs = loadGameState();
  return btoa(unescape(encodeURIComponent(JSON.stringify(gs))));
}

export function importGameState(encoded: string): { success: boolean; error?: string } {
  try {
    const json = decodeURIComponent(escape(atob(encoded)));
    const parsed = JSON.parse(json) as Partial<GameState>;
    if (typeof parsed.dmLevel !== 'number' || !Array.isArray(parsed.ownedMonsters)) {
      return { success: false, error: '유효하지 않은 세이브 데이터' };
    }
    const defaults = defaultGameState();
    // Apply same migrations as loadGameState
    const rawSlots = parsed.dungeonSlots as unknown[] | undefined;
    const dungeonSlots: DungeonSlot[] = (rawSlots ?? []).map(s =>
      migrateDungeonSlot(s as Record<string, unknown>),
    );
    const merged: GameState = {
      ...defaults,
      ...parsed,
      wisdomTree:    { ...defaults.wisdomTree, ...(parsed.wisdomTree ?? {}) },
      stageProgress: migrateStageProgress(parsed.stageProgress ?? defaults.stageProgress),
      dungeonSlots,
    };
    saveGameState(merged);
    return { success: true };
  } catch {
    return { success: false, error: '데이터 파싱 실패' };
  }
}

// ─── DM Level → Room Slot progression ────────────────────────────────────────

/** [minDmLevel, slotsUnlocked] — must be sorted ascending by level. Max 9 (3×3 grid). */
export const SLOT_UNLOCK_LEVELS: [number, number][] = [
  [0, 1], [2, 2], [4, 3], [6, 4], [8, 5], [10, 6],
  [12, 7], [15, 8], [18, 9],
];

/** Returns how many dungeon room slots are unlocked for a given DM level. */
export function getUnlockedSlots(dmLevel: number): number {
  let slots = 1;
  for (const [reqLevel, count] of SLOT_UNLOCK_LEVELS) {
    if (dmLevel >= reqLevel) slots = count;
  }
  return slots;
}

// ─── Bonus computation ────────────────────────────────────────────────────────

export interface WisdomBonuses {
  startingGold:       number;   // extra flat gold at stage start
  dungeonMaxHpBonus:  number;   // extra flat HP
  roomCostMult:       number;   // multiplier on room build cost (< 1 = cheaper)
  waveRewardMult:     number;   // multiplier on wave gold reward
  extraSlots:         number;   // additional room slots unlocked
  crystalEarnMult:    number;   // multiplier on soul crystal drops
  monsterDmgMult:     number;   // multiplier on incoming monster damage
  monsterAtkMult:     number;   // multiplier on monster attack damage (>= 1)
  crystalPerWave:     number;   // flat soul crystals earned on each wave clear
  fortressHp:         number;   // extra HP added at dungeon start
}

export function getWisdomBonuses(state: GameState): WisdomBonuses {
  const t = state.wisdomTree;
  return {
    startingGold:      BRANCH_DEFS[0].getValue(t['goldHands']         ?? 0),
    dungeonMaxHpBonus: BRANCH_DEFS[1].getValue(t['ironWalls']          ?? 0),
    roomCostMult:      1 - BRANCH_DEFS[2].getValue(t['masterCraft']    ?? 0) / 100,
    waveRewardMult:    1 + BRANCH_DEFS[3].getValue(t['swiftVictory']   ?? 0) / 100,
    extraSlots:        BRANCH_DEFS[4].getValue(t['ancestorsWisdom']    ?? 0),
    crystalEarnMult:   1 + BRANCH_DEFS[5].getValue(t['crystalResonance'] ?? 0) / 100,
    monsterDmgMult:    1 - BRANCH_DEFS[6].getValue(t['guardianBlessing'] ?? 0) / 100,
    monsterAtkMult:    1 + BRANCH_DEFS[7].getValue(t['eliteTrainer']   ?? 0) / 100,
    crystalPerWave:        BRANCH_DEFS[8].getValue(t['celestialBlood'] ?? 0),
    fortressHp:            BRANCH_DEFS[9].getValue(t['dungeonFortress'] ?? 0),
  };
}

// ── New Game+ / Prestige ──────────────────────────────────────────────────────

/** Returns a flat damage multiplier bonus from prestige (10% per level). */
export function getPrestigeDmgMult(state: GameState): number {
  return 1 + (state.prestigeLevel ?? 0) * 0.10;
}

/**
 * Starts a New Game+ run: resets run-specific progress while keeping
 * permanent progression (wisdom tree, DM level, crystals, equipment).
 * Increments prestigeLevel and saves state.
 *
 * Returns the new state (does NOT call saveGameState — caller must save).
 */
export function startPrestige(state: GameState): GameState {
  const nextPrestige = (state.prestigeLevel ?? 0) + 1;

  // Build a fresh default to reset run-specific fields
  const fresh = defaultGameState();

  return {
    ...state,
    // ── Reset ──────────────────────────────────────────────────────────────
    stageProgress:          fresh.stageProgress,
    homeGold:               fresh.homeGold,
    activeMainQuestId:      'MQ-001',
    questProgress:          {},
    activeSubQuestIds:      [],
    subQuestProgress:       {},
    completedSubQuestIds:   [],
    dungeonSlots:           fresh.dungeonSlots,
    gameCompleted:          false,
    cinematicSeen:          [],           // re-watch all cinematics
    dailyDungeonCompleted:  '',
    weeklyBossHpDealt:      0,
    weeklyBossResetDate:    '',
    dailyChallenges:        {},
    dailyChallengeDate:     '',
    // ── Keep ───────────────────────────────────────────────────────────────
    soulCrystals:           state.soulCrystals,
    wisdomTree:             state.wisdomTree,
    dmLevel:                state.dmLevel,
    dmXP:                   state.dmXP,
    ownedMonsters:          state.ownedMonsters,
    ownedEquipment:         state.ownedEquipment,
    ownedActiveSkills:      state.ownedActiveSkills,
    ownedSkins:             state.ownedSkins,
    equippedSkins:          state.equippedSkins,
    ownedThemes:            state.ownedThemes,
    equippedTheme:          state.equippedTheme,
    achievements:           state.achievements,
    gems:                   state.gems,
    discoveredCombinations: state.discoveredCombinations,
    blueprints:             state.blueprints,
    materials:              state.materials,
    craftedEquipment:       state.craftedEquipment,
    endlessHighScore:       state.endlessHighScore,
    consecutiveDays:        state.consecutiveDays,
    lastPlayDate:           state.lastPlayDate,
    // ── Prestige level ─────────────────────────────────────────────────────
    prestigeLevel: nextPrestige,
  };
}
