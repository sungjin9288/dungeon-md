import { type OwnedMonster, STARTER_ROSTER, defaultOwnedMonster } from './barracks';
import { type AbyssState, DEFAULT_ABYSS_STATE } from './abyss';
import type { RoomFamily, RoomType } from './rooms';
import type { ForecastCard } from './forecast';
import { loadProgress, saveProgress, STAGE_PROGRESS_KEY } from './stageProgress';
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
    effect: '던전 운영 수익 +{value}%',
    costPerTier: [5, 10, 20, 35, 50],
    getValue: (tier) => tier * 10,
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
    effect: '방 업그레이드 비용 -{value}%',
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
    effect: '추가 방 슬롯 +{value} · 초과 슬롯당 던전 HP +20',
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
    effect: '스테이지 클리어 시 소울 크리스탈 +{value}개',
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
  // ─── Chapter 8 — 심연 분기 ──────────────────────────────────────────────────
  {
    id: 'soulHarvest',
    name: '영혼 수확',
    icon: '🌑',
    effect: '소환 시 영혼 결정 +{value}개',
    costPerTier: [10, 20, 35, 55, 80],
    getValue: (tier) => tier * 2,
    position: { x: 195, y: 280 },
  },
  {
    id: 'forgeEnhancer',
    name: '심연의 단조',
    icon: '⚗️',
    effect: '제작 완료 시 영혼 결정 +{value}개',
    costPerTier: [10, 20, 35, 55, 80],
    getValue: (tier) => tier * 3,
    position: { x: 195, y: 564 },
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

/** A slot's family. Kept as its own name because save data and UI copy call it the slot "type". */
export type RoomSlotType = RoomFamily;

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

/** Hard cap on a home room's level; `getMaxRoomLevel` gates the climb by DM level. */
export const MAX_ROOM_LEVEL = 5;

/**
 * Maximum room level allowed for a given DM level.
 *
 * Level 2 opens at DM 3, not DM 5. DM 3 unlocks no slot of its own
 * (SLOT_UNLOCK_LEVELS jumps 0,0,0,2,4,…), and between stages 5 and 7 a lean
 * player has no growth lever at all while wave size climbs 8 → 13 invaders —
 * gold piles up unspent (~8,700 by stage 5, against 750 to raise the whole
 * board) because the one build-side sink is gated shut. Opening it here turns
 * a dead DM level into the chapter's answer to its own difficulty ramp.
 */
export function getMaxRoomLevel(dmLevel: number): number {
  if (dmLevel >= 20) return 5;
  if (dmLevel >= 15) return 4;
  if (dmLevel >= 10) return 3;
  if (dmLevel >= 3)  return 2;
  return 1;
}

export interface DungeonSlot {
  roomType?:   RoomSlotType;
  /** Concrete room that deploys; absent means the family's default (see roomBuildings.ts). */
  building?:   RoomType;
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
  // Daily attendance (login) rewards
  attendanceDay:       number;   // total attendance rewards claimed (drives the 7-day cycle)
  lastAttendanceClaim: string;   // ISO date of the last attendance claim ('' = never)
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
  monsterAffinity:   Record<string, number>;   // monsterId → 0–100 (교감; bondTransactions raises it, awakening needs 100)
  bondDaily:         Record<string, import('./bondTransactions').BondDayLog>;  // monsterId → today's care-action counts
  lineageGoal:       string | null;  // 계보도 목표 핀 — monster id the home directive steers toward
  monsterAwakened:   Record<string, boolean>;
  personalStorySeen: Record<string, boolean>;
  lastTalkTime:      Record<string, number>;   // monsterId → timestamp ms
  lastFedTime:       Record<string, number>;   // monsterId → timestamp ms
  dailyTrainCount:   Record<string, number>;   // monsterId → count today
  trainLastReset:    string;                   // YYYY-MM-DD
  // Fusion / Forge system (Phase 4)
  discoveredCombinations: string[];            // hybrid monster IDs discovered
  awakeningStones:   number;
  tribeShards:       Record<string, number>;   // 부족 조각 — 중복 소환이 쌓고 100개로 그 부족 미보유 1체
  blueprints:        string[];                 // blueprint IDs owned
  materials:         Record<string, number>;   // materialId → quantity
  abyss:             AbyssState;                // 심연 farming progress (depth + sweep keys)
  craftedEquipment:  Array<{ id: string; name: string; type: string; rarity: number; emoji: string; stats: Record<string, number> }>;
  dungeonSlots:      DungeonSlot[];   // per-slot room config (indexed by slot position)
  lastIdleCollect:   number;          // timestamp ms of last idle (offline) income collection (0 = uninitialized)
  /** Incomplete idle output carried between claims; absent in legacy saves. */
  idleRemainder?: { operationGold: number; productionGold: number; materials: Record<string, number> };
  productionFacilities: Record<string, number>;  // 생산 시설 facilityId → level (0/absent = not built)
  facilityStaff: Record<string, string>;         // 생산 시설 facilityId → 근무 몬스터 id (근무 중인 몬스터는 방어에 참여하지 않는다)
  ownedDecorations:  string[];        // 장식품 owned (decorationId)
  placedDecorations: string[];        // 장식품 currently placed (active for set bonuses)
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
  // Notoriety (명성) — the dungeon's name as a business; see notoriety.ts
  notoriety:          number;   // points, never below 0
  notorietyTier:      number;   // 1–10, raised only by the player's approval
  notorietyWeekStart: string;   // Monday YYYY-MM-DD of the last weekly settlement ('' = never)
  // Traps (함정) — crafted stock and per-type mastery; see traps.ts / trapTransactions.ts
  trapStock:   Record<string, number>;   // trapId → crafted traps not yet installed
  trapMastery: Record<string, number>;   // trapId → +0..+5
  // Invasion forecast (침입 예보) — today's three visitors; see forecast.ts
  forecast: {
    date:  string;          // YYYY-MM-DD the cards were issued for ('' = never)
    cards: ForecastCard[];
    taken: string[];        // card ids already chosen today
  };
}

const GAME_STATE_KEY = 'dungeonGameState';

function defaultGameState(): GameState {
  const tree: Record<string, number> = {};
  BRANCH_DEFS.forEach(b => { tree[b.id] = 0; });
  return {
    soulCrystals:     0,
    wisdomTree:       tree,
    stageProgress:    Array.from({ length: 90 }, (_, i) => ({ unlocked: i === 0, bestStars: 0 })),
    endlessHighScore: 0,
    totalKills:       0,
    totalGoldEarned:  0,
    roomsBuilt:       [],
    bossesKilled:     [],
    achievements:     {},
    consecutiveDays:   0,
    lastPlayDate:      '',
    attendanceDay:        0,
    lastAttendanceClaim:  '',
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
    bondDaily:         {},
    lineageGoal:       null,
    monsterAwakened:   {},
    personalStorySeen: {},
    lastTalkTime:      {},
    lastFedTime:       {},
    dailyTrainCount:   {},
    trainLastReset:    '',
    discoveredCombinations: [],
    awakeningStones:   0,
    tribeShards:       {},
    blueprints:        [],
    materials:         {},
    abyss:             { ...DEFAULT_ABYSS_STATE },
    craftedEquipment:  [],
    dungeonSlots:      [],
    lastIdleCollect:   0,
    productionFacilities: {},
    facilityStaff: {},
    ownedDecorations:  [],
    placedDecorations: [],
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
    notoriety:             0,
    notorietyTier:         1,
    notorietyWeekStart:    '',
    forecast:              { date: '', cards: [], taken: [] },
    trapStock:             {},
    trapMastery:           {},
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

const TOTAL_STAGES = 90;
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
        abyss:             { ...DEFAULT_ABYSS_STATE, ...(saved.abyss ?? {}) },
        dungeonSlots,
      };
    } catch { /* fall through */ }
  }
  return defaultGameState();
}

export function saveGameState(state: GameState): void {
  localStorage.setItem(GAME_STATE_KEY, JSON.stringify(state));
}

/** Save a whole-run replacement; undo the campaign write if game-state storage fails. */
export function saveGameStateWithCampaign(state: GameState, campaignProgress: StageProgressEntry[]): void {
  const previousProgress = localStorage.getItem(STAGE_PROGRESS_KEY);
  saveProgress(campaignProgress);
  try {
    saveGameState(state);
  } catch (error) {
    // Each localStorage write is atomic. Restore the first key's exact previous value.
    if (previousProgress === null) localStorage.removeItem(STAGE_PROGRESS_KEY);
    else localStorage.setItem(STAGE_PROGRESS_KEY, previousProgress);
    throw error;
  }
}

// ─── Save Export / Import ────────────────────────────────────────────────────

export function exportGameState(): string {
  const backup = {
    format: 'dungeon-guardian-save', version: 1,
    gameState: loadGameState(), campaignProgress: loadProgress(),
  };
  return btoa(unescape(encodeURIComponent(JSON.stringify(backup))));
}

function isStageProgress(value: unknown): value is StageProgressEntry[] {
  return Array.isArray(value) && value.every(entry =>
    entry !== null && typeof entry === 'object'
    && typeof entry.unlocked === 'boolean'
    && Number.isInteger(entry.bestStars) && entry.bestStars >= 0 && entry.bestStars <= 3
    && (entry.bestHpPercent === undefined
      || (Number.isFinite(entry.bestHpPercent) && entry.bestHpPercent >= 0 && entry.bestHpPercent <= 100)),
  );
}

export function importGameState(encoded: string): { success: boolean; error?: string } {
  try {
    const json = decodeURIComponent(escape(atob(encoded)));
    const payload = JSON.parse(json);
    const isBackup = payload?.format === 'dungeon-guardian-save';
    const parsed = (isBackup ? payload.gameState : payload) as Partial<GameState> | null;
    if (!parsed || typeof parsed.dmLevel !== 'number' || !Array.isArray(parsed.ownedMonsters)
      || (isBackup && (payload.version !== 1 || !isStageProgress(payload.campaignProgress)))
      || (parsed.stageProgress !== undefined && !isStageProgress(parsed.stageProgress))) {
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
      abyss:         { ...DEFAULT_ABYSS_STATE, ...(parsed.abyss ?? {}) },
      dungeonSlots,
    };
    // Old flat exports only contain GameState progress. Replace the destination's
    // campaign too; retaining it would mix two different players' progression.
    const campaignProgress = migrateStageProgress(isBackup ? payload.campaignProgress : merged.stageProgress);
    saveGameStateWithCampaign(merged, campaignProgress);
    return { success: true };
  } catch {
    return { success: false, error: '데이터 파싱 실패' };
  }
}

// ─── DM Level → Room Slot progression ────────────────────────────────────────

/** [minDmLevel, slotsUnlocked] — must be sorted ascending by level. Max 9 (3×3 grid). */
// One entry per board cell: [DM level required, slots unlocked once reached].
// The board fills out early — three rooms from the first day, all nine by
// DM 8 — because the campaign's 90 stages were tuned around that allowance
// (the retired per-stage build budget: 3 rooms at stage 1, 9 by stage 9).
// Nothing is built mid-battle any more, so the home has to be that dungeon.
// Later DM levels deepen the dungeon instead: room level caps (getMaxRoomLevel).
export const SLOT_UNLOCK_LEVELS: [number, number][] = [
  [0, 1], [0, 2], [0, 3], [2, 4], [4, 5], [5, 6],
  [6, 7], [7, 8], [8, 9],
];

/** Returns how many dungeon room slots a DM level unlocks on its own. */
export function getUnlockedSlots(dmLevel: number): number {
  let slots = 1;
  for (const [reqLevel, count] of SLOT_UNLOCK_LEVELS) {
    if (dmLevel >= reqLevel) slots = count;
  }
  return slots;
}

export const MAX_DUNGEON_SLOTS = 9;

/**
 * The home board's actual slot count: DM-level unlocks plus the wisdom-tree
 * `선조의 지혜` branch, capped at the 3×3 board. Every surface that draws or
 * validates home slots — and the battle grid, which mirrors the home board —
 * must use this rather than `getUnlockedSlots` so the two never disagree.
 */
export function getUnlockedSlotCount(state: Readonly<Pick<GameState, 'dmLevel' | 'wisdomTree'>>): number {
  const extra = BRANCH_DEFS[4].getValue(state.wisdomTree?.['ancestorsWisdom'] ?? 0);
  return Math.min(MAX_DUNGEON_SLOTS, getUnlockedSlots(state.dmLevel ?? 1) + extra);
}

/** Each purchased slot still has value after DM progression fills the board.
 * Derived from the existing tier: no migration, refund, or persisted conversion.
 */
export function getAncestorsWisdomEffect(
  state: Readonly<Pick<GameState, 'wisdomTree'> & Partial<Pick<GameState, 'dmLevel'>>>,
): { extraSlots: number; hpBonus: number } {
  const purchased = BRANCH_DEFS[4].getValue(state.wisdomTree?.ancestorsWisdom ?? 0);
  const remaining = Math.max(0, MAX_DUNGEON_SLOTS - getUnlockedSlots(state.dmLevel ?? 1));
  const extraSlots = Math.min(purchased, remaining);
  return { extraSlots, hpBonus: (purchased - extraSlots) * 20 };
}

// ─── Bonus computation ────────────────────────────────────────────────────────

export interface WisdomBonuses {
  idleIncomeMult:     number;   // multiplier on dungeon operating (idle) income (>= 1)
  dungeonMaxHpBonus:  number;   // extra flat HP
  roomCostMult:       number;   // multiplier on home room upgrade cost (< 1 = cheaper)
  waveRewardMult:     number;   // multiplier on wave gold reward
  extraSlots:         number;   // effective extra room slots, excluding HP-converted overflow
  crystalEarnMult:    number;   // multiplier on soul crystal drops
  monsterDmgMult:     number;   // multiplier on incoming monster damage
  monsterAtkMult:     number;   // multiplier on monster attack damage (>= 1)
  crystalPerWave:        number;   // legacy field name: flat soul crystals earned once on stage clear
  fortressHp:            number;   // extra HP added at dungeon start
  summonBonusCrystal:    number;   // flat crystals added per summon pull
  forgeBonusCrystal:     number;   // flat crystals added on each craft completion
}

export function getWisdomBonuses(state: Readonly<Pick<GameState, 'wisdomTree'> & Partial<Pick<GameState, 'dmLevel'>>>): WisdomBonuses {
  // Partial states (tests, imported saves mid-migration) may lack the tree;
  // an absent tree simply means no branch has been raised.
  const t: Record<string, number> = state.wisdomTree ?? {};
  const ancestors = getAncestorsWisdomEffect(state);
  return {
    idleIncomeMult:    1 + BRANCH_DEFS[0].getValue(t['goldHands']     ?? 0) / 100,
    dungeonMaxHpBonus: BRANCH_DEFS[1].getValue(t['ironWalls']          ?? 0) + ancestors.hpBonus,
    roomCostMult:      1 - BRANCH_DEFS[2].getValue(t['masterCraft']    ?? 0) / 100,
    waveRewardMult:    1 + BRANCH_DEFS[3].getValue(t['swiftVictory']   ?? 0) / 100,
    extraSlots:        ancestors.extraSlots,
    crystalEarnMult:   1 + BRANCH_DEFS[5].getValue(t['crystalResonance'] ?? 0) / 100,
    monsterDmgMult:    1 - BRANCH_DEFS[6].getValue(t['guardianBlessing'] ?? 0) / 100,
    monsterAtkMult:    1 + BRANCH_DEFS[7].getValue(t['eliteTrainer']   ?? 0) / 100,
    crystalPerWave:        BRANCH_DEFS[8].getValue(t['celestialBlood']  ?? 0),
    fortressHp:            BRANCH_DEFS[9].getValue(t['dungeonFortress'] ?? 0),
    summonBonusCrystal:    BRANCH_DEFS[10].getValue(t['soulHarvest']    ?? 0),
    forgeBonusCrystal:     BRANCH_DEFS[11].getValue(t['forgeEnhancer']  ?? 0),
  };
}

export type WisdomUpgradeFailureReason =
  | 'unknown_branch'
  | 'max_tier'
  | 'insufficient_soul_crystals';

export type WisdomUpgradeResult =
  | {
      ok: true;
      state: GameState;
      branch: BranchDef;
      previousTier: number;
      nextTier: number;
      cost: number;
    }
  | {
      ok: false;
      state: GameState;
      reason: WisdomUpgradeFailureReason;
      branch?: BranchDef;
      currentTier?: number;
      cost?: number;
    };

export function upgradeWisdomBranch(state: GameState, branchId: string): WisdomUpgradeResult {
  const branch = BRANCH_DEFS.find(b => b.id === branchId);
  if (!branch) return { ok: false, state, reason: 'unknown_branch' };

  const currentTier = state.wisdomTree[branch.id] ?? 0;
  if (currentTier >= MAX_WISDOM_TIER) {
    return { ok: false, state, reason: 'max_tier', branch, currentTier };
  }

  const cost = branch.costPerTier[currentTier];
  if (state.soulCrystals < cost) {
    return { ok: false, state, reason: 'insufficient_soul_crystals', branch, currentTier, cost };
  }

  return {
    ok: true,
    state: {
      ...state,
      soulCrystals: state.soulCrystals - cost,
      wisdomTree: { ...state.wisdomTree, [branch.id]: currentTier + 1 },
    },
    branch,
    previousTier: currentTier,
    nextTier: currentTier + 1,
    cost,
  };
}

export function recordBuiltRoom(state: GameState, roomType: string): GameState {
  return {
    ...state,
    roomsBuilt: [...(state.roomsBuilt ?? []), roomType],
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
    idleRemainder:          state.idleRemainder ? { ...state.idleRemainder, operationGold: 0, productionGold: 0 } : undefined,
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
    attendanceDay:          state.attendanceDay ?? 0,
    lastAttendanceClaim:    state.lastAttendanceClaim ?? '',
    // ── Prestige level ─────────────────────────────────────────────────────
    prestigeLevel: nextPrestige,
  };
}
