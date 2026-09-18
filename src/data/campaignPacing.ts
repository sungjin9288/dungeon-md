// ─── Campaign pacing model ────────────────────────────────────────────────────
// The dungeon that fights a campaign stage is the *home* dungeon (nothing is
// built mid-battle), so stage balance is a statement about what a reasonable
// player's home looks like when they reach stage N. This module makes that
// expectation explicit, deterministic and cheap to evaluate, so the balance
// guard in campaignPacing.test.ts can hold every stage against it.
//
// The model is deliberately conservative where the real game is generous:
//   - DM XP counts stage clears and the main-quest chain only (no losses, no
//     sub-quests, no daily content).
//   - Gold counts battle loot and quest gold only (no idle income, no abyss),
//     and every coin goes into room upgrades — the one build-side sink.
//   - The roster grows at a fixed acquisition pace (EXPECTED_ROSTER_PER_STAGE)
//     and is filled with the *earliest-available* attackers, not the strongest:
//     a player who has simply kept playing, not one who rolled well. This pace
//     is a design lever — summon economy work (P4) must deliver at least it.
// A stage that clears under this model clears for a player who did at least
// this much. Pure: no scene, save or RNG access.

import { ALL_STAGES } from './allStages';
import { defaultOwnedMonster, STARTER_ROSTER, xpToNextLevel } from './barracks';
import { INVADER_DEFS } from './invaders';
import { TRAP_DEFS, trapEffectiveDps } from './traps';
import { STAGE_CLEAR_DM_XP, xpForDmLevel } from './invasionTransactions';
import { MONSTER_DEFS } from './monsterRegistry';
import type { MonsterDef, MonsterId } from './monstersTypes';
import { MAIN_QUESTS, type MainQuest } from './questData';
import { ROOM_UPGRADE_COSTS } from './roomSlotTransactions';
import { calcDungeonDps, simulateDungeon, simulateWavesAtDps, type SimResult } from './simulation';
import type { StageConfig } from './stages';
import {
  getMaxRoomLevel,
  getRoomSlotCapacity,
  getUnlockedSlots,
  type DungeonSlot,
  type OwnedMonster,
} from './wisdom';

/** Attackers a player is expected to own by stage N: the starters plus one per three stages. */
export function expectedRosterSize(stageNumber: number): number {
  return STARTER_ROSTER.length + Math.floor(stageNumber / 3);
}

export interface ExpectedHome {
  readonly stageNumber: number;
  readonly dmLevel: number;
  readonly slotCount: number;
  readonly roomLevel: number;
  /** Roster level from cumulative kill XP (see expectedGuardianLevel). */
  readonly guardianLevel: number;
  readonly roster: readonly MonsterId[];
  readonly dungeonSlots: DungeonSlot[];
  readonly ownedMonsters: OwnedMonster[];
}

export interface PacingRow {
  readonly stageNumber: number;
  readonly chapter: number;
  readonly dmLevel: number;
  readonly slotCount: number;
  readonly roomLevel: number;
  readonly rosterSize: number;
  readonly expectedDps: number;
  readonly requiredDps: number;
  /** expectedDps / requiredDps — above 1 the expected home clears without leaking to zero. */
  readonly margin: number;
  readonly winPct: number;
}

// ─── DM level ─────────────────────────────────────────────────────────────────

function questReachableByStage(quest: MainQuest, stageNumber: number, dmLevel: number): boolean {
  return quest.objectives.every(objective => {
    if (objective.type === 'complete_stage') return objective.target <= stageNumber;
    if (objective.type === 'reach_dm_level') return objective.target <= dmLevel;
    // build / assign / summon / feed / fuse / gold / defend / upgrade are grindable
    // at any point and are what a player does between stages anyway.
    return true;
  });
}

function dmLevelForXp(xp: number): number {
  let level = 1;
  let remaining = xp;
  while (remaining >= xpForDmLevel(level)) {
    remaining -= xpForDmLevel(level);
    level += 1;
  }
  return level;
}

/**
 * Main-quest DM XP the chain has paid out by stage N. Quests are sequential,
 * so the walk stops at the first quest the player cannot have finished yet.
 * `reach_dm_level` objectives depend on this very total, hence the fixpoint.
 */
export function questDmXpByStage(stageNumber: number): number {
  let dmLevel = dmLevelForXp(STAGE_CLEAR_DM_XP * stageNumber);
  let total = 0;
  for (let pass = 0; pass < 6; pass++) {
    let sum = 0;
    for (const quest of MAIN_QUESTS) {
      if (!questReachableByStage(quest, stageNumber, dmLevel)) break;
      sum += quest.reward.dmXP;
    }
    const nextLevel = dmLevelForXp(STAGE_CLEAR_DM_XP * stageNumber + sum);
    total = sum;
    if (nextLevel === dmLevel) break;
    dmLevel = nextLevel;
  }
  return total;
}

export function expectedDmLevel(stageNumber: number): number {
  return dmLevelForXp(STAGE_CLEAR_DM_XP * stageNumber + questDmXpByStage(stageNumber));
}

// ─── Gold ─────────────────────────────────────────────────────────────────────

/** Gold a stage can pay out: wave clear rewards plus every invader's bounty. */
export function stageLootPotential(stage: StageConfig): number {
  return stage.waves.reduce((sum, wave) => (
    sum
    + (wave.clearReward ?? 0)
    + wave.invaders.reduce((kills, group) => kills + group.count * (INVADER_DEFS[group.type]?.reward ?? 0), 0)
  ), 0);
}

/**
 * Every kill grants XP to the WHOLE roster (KillHandler: 5 per invader, 100 per
 * boss), so a player who cleared stages 1..N-1 once arrives with levelled
 * guardians. The model used to hand them Lv.1 monsters, which understated real
 * damage by `guardianAtkMult` — measurably so: stage 20 lost 0/4 (lean) and
 * 0/3 (expected) organically while the sim called it 80–100%.
 */
export const KILL_XP_PER_INVADER = 5;
export const KILL_XP_PER_BOSS = 100;

export function stageKillXp(stage: StageConfig): number {
  return stage.waves.reduce((sum, wave) => sum + wave.invaders.reduce((kills, group) => {
    const def = INVADER_DEFS[group.type];
    return kills + group.count * (def?.isBoss ? KILL_XP_PER_BOSS : KILL_XP_PER_INVADER);
  }, 0), 0);
}

/** Roster XP earned by clearing every stage below `stageNumber` once. */
export function cumulativeKillXpByStage(stageNumber: number): number {
  let xp = 0;
  for (const stage of ALL_STAGES) {
    if (stage.id >= stageNumber) break;
    xp += stageKillXp(stage);
  }
  return xp;
}

/** The level that much XP buys, using the barracks curve (100 × 1.18^(lv-1)). */
export function expectedGuardianLevel(stageNumber: number): number {
  let remaining = cumulativeKillXpByStage(stageNumber);
  let level = 1;
  while (level < 50) {
    const needed = xpToNextLevel(level);
    if (remaining < needed) break;
    remaining -= needed;
    level += 1;
  }
  return level;
}

/**
 * The trap a player would have in every room by this DM level: the strongest
 * tier-1 trap unlocked so far. Tier 1 is bought straight from the placement
 * tray for gold, and the gold is not the constraint — at stage 20 the model's
 * budget is ~95,000 while room level is capped at 2 by the DM gate, so nine
 * traps (~1,000) are rounding error. Leaving rooms trapless modelled a player
 * who ignores the game's own placement recommendation.
 */
export function expectedTrapId(dmLevel: number): string | undefined {
  return TRAP_DEFS
    .filter(trap => trap.tier === 1 && trap.unlockLv <= dmLevel)
    .sort((a, b) => trapEffectiveDps(b.id) - trapEffectiveDps(a.id) || a.cost - b.cost)[0]?.id;
}

function questGoldByStage(stageNumber: number): number {
  const dmLevel = expectedDmLevel(stageNumber);
  let sum = 0;
  for (const quest of MAIN_QUESTS) {
    if (!questReachableByStage(quest, stageNumber, dmLevel)) break;
    sum += quest.reward.gold ?? 0;
  }
  return sum;
}

/** Loot from every stage up to and including N, plus quest gold — the upgrade budget. */
export function cumulativeGoldByStage(stageNumber: number): number {
  let loot = 0;
  for (const stage of ALL_STAGES) {
    if (stage.id > stageNumber) break;
    loot += stageLootPotential(stage);
  }
  return loot + questGoldByStage(stageNumber);
}

/**
 * Room level the budget buys when every slot is raised together, capped by
 * the DM-level gate. Raising all slots at once is what the readiness directive
 * steers players toward, so it is the fair expectation.
 */
export function expectedRoomLevel(budget: number, slotCount: number, dmLevel: number): number {
  const cap = getMaxRoomLevel(dmLevel);
  let level = 1;
  let remaining = budget;
  while (level < cap) {
    const step = slotCount * ROOM_UPGRADE_COSTS[level - 1];
    if (remaining < step) break;
    remaining -= step;
    level += 1;
  }
  return level;
}

// ─── Roster ───────────────────────────────────────────────────────────────────

function monsterDps(def: MonsterDef): number {
  if (def.baseDamage <= 0 || def.attackCooldown <= 0) return 0;
  return def.baseDamage / (def.attackCooldown / 1000);
}

const RARITY_RANK: Record<string, number> = { C: 0, U: 1, R: 2, E: 3, L: 4 };

/**
 * The expected roster by stage N: the starters, then the attackers that opened
 * earliest (then the commonest, then the weakest), as many as the pace allows.
 */
export function expectedRoster(stageNumber: number): MonsterId[] {
  const starters = STARTER_ROSTER.filter(id => monsterDps(MONSTER_DEFS[id]) > 0);
  const rest = (Object.values(MONSTER_DEFS) as MonsterDef[])
    .filter(def => !STARTER_ROSTER.includes(def.id) && def.unlockStage <= stageNumber && monsterDps(def) > 0)
    .sort((a, b) => (
      a.unlockStage - b.unlockStage
      || (RARITY_RANK[a.rarityTier ?? 'C'] ?? 0) - (RARITY_RANK[b.rarityTier ?? 'C'] ?? 0)
      || monsterDps(a) - monsterDps(b)
    ))
    .map(def => def.id);
  return [...starters, ...rest].slice(0, expectedRosterSize(stageNumber));
}

// ─── Home ─────────────────────────────────────────────────────────────────────

function buildHome(
  stageNumber: number,
  dmLevel: number,
  slotCount: number,
  roomLevel: number,
  roster: readonly MonsterId[],
  /**
   * Day-one boards get no traps. The starter home is the floor — the board the
   * game hands a brand-new player — and its whole wealth is the 200 starting
   * gold, so buying three traps with it would quietly soften the stage-1 guard.
   * Lean and expected homes have cleared stages and sit on real surplus.
   */
  { traps = true }: { traps?: boolean } = {},
): ExpectedHome {
  const capacity = getRoomSlotCapacity(roomLevel, 'combat').monsters;
  // Spread guardians one per room before doubling up: every armed room covers
  // more of the invasion path, which is how a player fills a board too.
  const perSlot: (string | undefined)[][] = Array.from({ length: slotCount }, () => Array(capacity).fill(undefined));
  roster.forEach((id, index) => {
    const slot = index % slotCount;
    const seat = Math.floor(index / slotCount);
    if (seat < capacity) perSlot[slot][seat] = id;
  });
  const trapId = traps ? expectedTrapId(dmLevel) : undefined;
  const dungeonSlots: DungeonSlot[] = perSlot.map(monsterIds => {
    return {
      roomType: 'combat',
      building: 'guardian',
      monsterIds,
      trapIds: [trapId],
      roomLevel,
      hp: 200,
      maxHp: 200,
    };
  });
  const placed = dungeonSlots.flatMap(slot => slot.monsterIds).filter((id): id is string => Boolean(id));
  const guardianLevel = expectedGuardianLevel(stageNumber);
  return {
    stageNumber,
    dmLevel,
    slotCount,
    roomLevel,
    guardianLevel,
    roster: placed as MonsterId[],
    dungeonSlots,
    ownedMonsters: placed.map(id => ({ ...defaultOwnedMonster(id), level: guardianLevel })),
  };
}

export function expectedHome(stageNumber: number): ExpectedHome {
  const dmLevel = expectedDmLevel(stageNumber);
  const slotCount = getUnlockedSlots(dmLevel);
  const roomLevel = expectedRoomLevel(cumulativeGoldByStage(stageNumber - 1), slotCount, dmLevel);
  return buildHome(stageNumber, dmLevel, slotCount, roomLevel, expectedRoster(stageNumber));
}

/**
 * A veteran's home for the final chapter: the expected DM / board / room level
 * with the *strongest* attackers the registry has opened, not the earliest.
 * Chapter 9 is the campaign's endgame and is tuned for a grown roster.
 */
export function veteranHome(stageNumber: number): ExpectedHome {
  const dmLevel = expectedDmLevel(stageNumber);
  const slotCount = getUnlockedSlots(dmLevel);
  const roomLevel = expectedRoomLevel(cumulativeGoldByStage(stageNumber - 1), slotCount, dmLevel);
  const roster = (Object.values(MONSTER_DEFS) as MonsterDef[])
    .filter(def => def.unlockStage <= stageNumber && monsterDps(def) > 0)
    .sort((a, b) => monsterDps(b) - monsterDps(a))
    .slice(0, expectedRosterSize(stageNumber))
    .map(def => def.id);
  return buildHome(stageNumber, dmLevel, slotCount, roomLevel, roster);
}

/**
 * The floor of what a player can bring: DM XP from stage clears alone, gold
 * from stage loot alone, the same roster pace. No quest has been finished.
 * Every stage must be winnable from here — this is the hard balance guard.
 */
export function leanHome(stageNumber: number): ExpectedHome {
  const clearsBefore = Math.max(0, stageNumber - 1);
  const dmLevel = dmLevelForXp(STAGE_CLEAR_DM_XP * clearsBefore);
  const slotCount = getUnlockedSlots(dmLevel);
  let loot = 0;
  for (const stage of ALL_STAGES) {
    if (stage.id >= stageNumber) break;
    loot += stageLootPotential(stage);
  }
  const roomLevel = expectedRoomLevel(loot, slotCount, dmLevel);
  return buildHome(stageNumber, dmLevel, slotCount, roomLevel, expectedRoster(stageNumber));
}

/** The very first home: the DM-1 board (three level-1 guardian rooms) with the starter roster, nothing else. */
export function starterHome(): ExpectedHome {
  return buildHome(1, 1, getUnlockedSlots(1), 1, STARTER_ROSTER, { traps: false });
}

// ─── Evaluation ───────────────────────────────────────────────────────────────

export function simulateHome(home: ExpectedHome, stage: StageConfig): SimResult {
  return simulateDungeon(home.dungeonSlots, home.ownedMonsters, stage.waves, stage.dungeonHp);
}

/** Least sustained DPS at which the stage ends with dungeon HP above zero. */
export function requiredDps(stage: StageConfig, upper = 20_000): number {
  let lo = 0;
  let hi = upper;
  if (simulateWavesAtDps(hi, stage.waves, stage.dungeonHp).finalHp <= 0) return Infinity;
  for (let i = 0; i < 40 && hi - lo > 0.05; i++) {
    const mid = (lo + hi) / 2;
    if (simulateWavesAtDps(mid, stage.waves, stage.dungeonHp).finalHp > 0) hi = mid;
    else lo = mid;
  }
  return hi;
}

export function pacingRow(stage: StageConfig, home: ExpectedHome = expectedHome(stage.id)): PacingRow {
  const expectedDps = calcDungeonDps(home.dungeonSlots, home.ownedMonsters);
  const required = requiredDps(stage);
  return {
    stageNumber: stage.id,
    chapter: stage.chapter,
    dmLevel: home.dmLevel,
    slotCount: home.slotCount,
    roomLevel: home.roomLevel,
    rosterSize: home.roster.length,
    expectedDps,
    requiredDps: required,
    margin: required > 0 ? expectedDps / required : Infinity,
    winPct: simulateHome(home, stage).winPct,
  };
}

export function campaignPacingTable(homeFor: (stageNumber: number) => ExpectedHome = expectedHome): PacingRow[] {
  return ALL_STAGES.map(stage => pacingRow(stage, homeFor(stage.id)));
}
