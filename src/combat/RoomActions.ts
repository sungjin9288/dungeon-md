// ─── Room Actions ──────────────────────────────────────────────────────────────
// Extracted from DungeonScene: placeRoom(), assignMonster(), upgradeRoom().
// Owns all side-effects triggered when the player builds, populates or upgrades
// a room grid cell: cost deduction, quest ticks, monster assignment, synergy
// recalc, and auto-assign from pre-configured dungeon slot data.

import Phaser from 'phaser';
import { Room } from '../objects/Room';
import { ROOM_DEFS, getUpgradeCost, MAX_ROOM_LEVEL, type RoomData, type RoomType } from '../data/rooms';
import { MONSTER_DEFS, getMonstersForRoom, type MonsterId } from '../data/monsters';
import { HYBRID_DEFS } from '../data/fusion';
import { loadGameState, saveGameState, ROOM_SLOT_TYPE_DEFS, type DungeonSlot } from '../data/wisdom';
import type { EquipmentStats } from '../data/barracks';
import {
  applyCombatMonsterAssignmentProgress,
  applyCombatRoomBuildProgress,
  applyCombatRoomUpgradeProgress,
  type CombatRoomActionProgressResult,
} from '../data/progressionTransactions';
import { audioManager } from '../audio/AudioManager';
import { showFloatText } from './VisualEffects';
import { showQuestCompleteToast } from './QuestTracker';
import { logger } from '../utils/logger';

// ─── Context ─────────────────────────────────────────────────────────────────

export interface RoomActionsContext {
  readonly scene:            Phaser.Scene;
  readonly rooms:            Room[][];
  readonly roomGrid:         (RoomData | null)[][];
  readonly stageChapter:     number;
  readonly effectiveCols:    number;
  readonly unlockedStage:    number;
  readonly dungeonTrapSlots: DungeonSlot[];
  readonly equipmentMap:     Map<string, EquipmentStats>;
  readonly wisdomBonuses:    { roomCostMult: number };

  get gold(): number; set gold(v: number);

  setGoldRegistry(v: number): void;
  setGoldWarn(): void;
  setSelectedRoom(room: Room | null): void;
  spawnBuildParticles(x: number, y: number): void;
  recalcRoomTypeBonuses(): void;
  recalcSynergies(): void;
  checkAchievementsAndToast(gs: ReturnType<typeof loadGameState>): void;
  openMonsterPanel(row: number, col: number, type: RoomType, unlockedStage: number): void;
  shakeRoomSelectionPanel(): void;
  shakeUpgradePanel(): void;
}

function persistRoomActionProgress(
  ctx: RoomActionsContext,
  result: CombatRoomActionProgressResult,
): ReturnType<typeof loadGameState> {
  if (result.changed) saveGameState(result.state);
  if (result.questCompleted) {
    ctx.scene.time.delayedCall(600, () => showQuestCompleteToast(ctx));
  }
  return result.state;
}

// ─── placeRoom ────────────────────────────────────────────────────────────────

export function placeRoom(ctx: RoomActionsContext, row: number, col: number, type: RoomType): void {
  const def           = ROOM_DEFS[type];
  const effectiveCost = Math.round(def.cost * ctx.wisdomBonuses.roomCostMult);

  if (ctx.gold < effectiveCost) {
    ctx.shakeRoomSelectionPanel();
    ctx.setGoldWarn();
    return;
  }

  ctx.gold -= effectiveCost;
  ctx.setGoldRegistry(ctx.gold);
  audioManager.playSfx('room_build');

  const room = ctx.rooms[row][col];
  room.occupyWith(type);
  room.deselect();
  ctx.setSelectedRoom(null);
  ctx.roomGrid[row][col] = room.roomData;

  if (ctx.stageChapter >= 3) {
    room.initRoomHp(ROOM_DEFS[type].baseHp);
  }

  ctx.spawnBuildParticles(room.x, room.y);
  showFloatText(ctx.scene, room.x, room.y - 20, `-${effectiveCost} 💰`, '#ff8866');
  logger.debug(`[PLACE] ${type} at [${row},${col}] | gold left: ${ctx.gold}`);

  const trackedState = persistRoomActionProgress(
    ctx,
    applyCombatRoomBuildProgress(loadGameState(), type),
  );
  ctx.checkAchievementsAndToast(trackedState);

  // Auto-assign pre-configured monsters from home slot data
  const flatIdx  = row * ctx.effectiveCols + col;
  const homeSlot = ctx.dungeonTrapSlots[flatIdx];
  const data     = ctx.roomGrid[row][col];
  if (homeSlot && data) {
    if (homeSlot.hp <= 0) {
      // Broken room: HP depleted — show crack visual, skip all assignment
      ctx.rooms[row][col].setBrokenState();
      logger.debug(`[BROKEN] slot ${flatIdx}: room destroyed, skipping assignment`);
      ctx.recalcRoomTypeBonuses();
      return;
    }

    const typeDef = ROOM_SLOT_TYPE_DEFS.find(d => d.id === homeSlot.roomType);
    if (typeDef) ctx.rooms[row][col].setRoomTypeBadge(typeDef.icon);

    const validIds = (homeSlot.monsterIds ?? []).filter(Boolean) as MonsterId[];
    if (validIds.length > 0) {
      assignMonster(ctx, row, col, validIds[0]);
      if (homeSlot.roomType === 'magic') {
        data.attackCooldown = Math.round(data.attackCooldown * 0.8);
        logger.debug(`[MAGIC ROOM] slot ${flatIdx}: cd → ${data.attackCooldown}ms`);
      }
      data.monsterSlots = validIds;
      logger.debug(`[AUTO-ASSIGN] slot ${flatIdx}: ${validIds.join(', ')}`);
      ctx.recalcRoomTypeBonuses();
      return;
    }
    ctx.recalcRoomTypeBonuses();
  }

  // Open monster panel if this room type supports monsters (including owned hybrids)
  const available   = getMonstersForRoom(type, ctx.unlockedStage);
  const ownedHybrid = Object.values(HYBRID_DEFS)
    .some(h => h.roomTypes.includes(type as string) && loadGameState().ownedMonsters.some(m => m.id === h.id));
  if (available.length > 0 || ownedHybrid) {
    ctx.scene.time.delayedCall(200, () => ctx.openMonsterPanel(row, col, type, ctx.unlockedStage));
  }
}

// ─── assignMonster ────────────────────────────────────────────────────────────

export function assignMonster(ctx: RoomActionsContext, row: number, col: number, id: MonsterId): void {
  const data = ctx.roomGrid[row][col];
  if (!data) return;

  data.monsterSlot          = id;
  data.hasFirstStrikeUsed   = false;

  const mDef  = MONSTER_DEFS[id];
  const hbDef = mDef ? null : HYBRID_DEFS[id];
  if (!mDef && !hbDef) return;

  const emoji = mDef?.emoji ?? hbDef!.emoji;
  if (mDef?.attackCooldown && mDef.attackCooldown > 0) data.attackCooldown = mDef.attackCooldown;

  const eqS = ctx.equipmentMap.get(id);
  if (eqS?.roomHpBonus) ctx.rooms[row][col].addBonusHp(eqS.roomHpBonus);

  ctx.rooms[row][col].setMonsterSprite(id, emoji);
  audioManager.playSfx('monster_place');

  {
    const gs_q   = loadGameState();
    const ownedM = gs_q.ownedMonsters.find(m => m.id === id);
    const level  = ownedM?.level ?? 1;
    showFloatText(
      ctx.scene,
      ctx.rooms[row][col].x,
      ctx.rooms[row][col].y,
      `${emoji} Lv.${level} 배치됨!`,
      '#d0a0ff',
    );
    persistRoomActionProgress(ctx, applyCombatMonsterAssignmentProgress(gs_q));
  }

  logger.debug(`[MONSTER] ${id} → [${row},${col}]`);
  ctx.recalcSynergies();
}

// ─── upgradeRoom ─────────────────────────────────────────────────────────────

export function upgradeRoom(ctx: RoomActionsContext, row: number, col: number): void {
  const data = ctx.roomGrid[row][col];
  const room = ctx.rooms[row][col];
  if (!data || !room.roomData || data.level >= MAX_ROOM_LEVEL) return;

  const cost = getUpgradeCost(data.type, data.level);
  if (ctx.gold < cost) {
    ctx.shakeUpgradePanel();
    ctx.setGoldWarn();
    return;
  }

  ctx.gold -= cost;
  ctx.setGoldRegistry(ctx.gold);
  audioManager.playSfx('room_upgrade');
  {
    persistRoomActionProgress(ctx, applyCombatRoomUpgradeProgress(loadGameState()));
  }

  data.level++;

  if (!data.monsterSlot) {
    const def = ROOM_DEFS[data.type];
    data.attackCooldown = Math.round(def.attackCooldown * Math.pow(0.75, data.level - 1));
  }

  room.upgrade();
  ctx.spawnBuildParticles(room.x, room.y);

  logger.debug(`[UPGRADE] ${data.type} → Lv${data.level} cooldown=${data.attackCooldown}ms at [${row},${col}]`);
}
