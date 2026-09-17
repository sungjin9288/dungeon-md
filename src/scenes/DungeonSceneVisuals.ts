/**
 * DungeonSceneVisuals — extracted private-method bodies from DungeonScene.
 *
 * These were all PRIVATE methods; only DungeonScene calls them (via
 * one-line delegators that keep the original `this.<name>(...)` call sites).
 * Import the DungeonScene TYPE only to avoid a runtime circular dependency.
 */
import type { DungeonScene } from './DungeonScene';
import Phaser from 'phaser';
import { DUNGEON_UI, DUNGEON_UI_CSS } from '../constants/colors';
import { CANVAS_WIDTH, GRID_Y, GRID_ROWS } from '../constants/layout';
import { type DungeonSlotDeploymentSummary, deployDungeonSlotsToGrid } from '../combat/DungeonLayout';
import { buildRoomMechanicsCtx, buildCombatResolverCtx } from '../combat/DungeonSceneCtx';
import { recalcRoomTypeBonuses as _recalcRoomTypeBonuses } from '../combat/RoomTriggers';
import { runExtraMonsterAttacks as _runExtraMonsterAttacks } from '../combat/RoomMechanics';
import { findTarget as _findTarget, resolveAttack as _resolveAttack } from '../combat/CombatResolver';
import { resolveMonsterDef } from '../data/monsters';
import type { Invader } from '../objects/Invader';

// ─── Deployment ────────────────────────────────────────────────────────────

export function deployDungeonSlots(scene: DungeonScene): DungeonSlotDeploymentSummary {
  const summary = deployDungeonSlotsToGrid({
    rooms:            scene.rooms,
    roomGrid:         scene.roomGrid,
    effectiveCols:    scene.effectiveCols,
    dungeonTrapSlots: scene.dungeonTrapSlots,
    equipmentMap:     scene.equipmentMap,
    elementRestrict:  scene.dailyMode?.elementRestrict,
  });

  if (summary.builtRooms > 0) {
    scene.synergyManager.recalc(scene.roomGrid, scene.effectiveCols);
    _recalcRoomTypeBonuses(buildRoomMechanicsCtx(scene));
  }

  return summary;
}

// ─── Deployment Toast ──────────────────────────────────────────────────────

export function showDungeonDeploymentToast(
  scene: DungeonScene,
  summary: DungeonSlotDeploymentSummary,
): void {
  if (summary.builtRooms <= 0) return;
  const toastY = GRID_Y + GRID_ROWS * scene.effectiveCellSize + 5;

  const toast = scene.add.text(
    CANVAS_WIDTH / 2,
    toastY,
    `던전 전개 완료 · 방 ${summary.builtRooms} · 수호자 ${summary.assignedMonsters} · 장비 ${summary.equippedMonsters} · 함정 ${summary.activeTraps}`,
    {
      fontFamily: 'Georgia, serif',
      fontSize: '11px',
      color: summary.brokenRooms > 0 ? DUNGEON_UI_CSS.EMBER : DUNGEON_UI_CSS.TEXT,
      backgroundColor: '#080b09',
      padding: { x: 10, y: 5 },
    },
  ).setOrigin(0.5).setDepth(120).setAlpha(0);

  scene.tweens.add({
    targets: toast,
    alpha: { from: 0, to: 0.94 },
    y: toastY - 6,
    duration: 220,
    ease: 'Cubic.easeOut',
    yoyo: true,
    hold: 1250,
    onComplete: () => toast.destroy(),
  });
}

// ─── Command Strip ─────────────────────────────────────────────────────────

export function buildDungeonCommandStrip(
  scene: DungeonScene,
  summary: DungeonSlotDeploymentSummary,
): void {
  scene.commandStrip?.destroy();
  if (summary.builtRooms <= 0) return;

  const builtSlots = scene.dungeonTrapSlots.filter(slot => Boolean(slot.roomType));
  const totalMaxHp = builtSlots.reduce((sum, slot) => sum + Math.max(1, slot.maxHp), 0);
  const totalHp = builtSlots.reduce((sum, slot) => sum + Phaser.Math.Clamp(slot.hp, 0, Math.max(1, slot.maxHp)), 0);
  const durability = totalMaxHp > 0 ? Math.round((totalHp / totalMaxHp) * 100) : 100;
  const warning = summary.brokenRooms > 0
    ? `파손${summary.brokenRooms}`
    : summary.assignedMonsters <= 0
      ? '수호 없음'
      : durability < 50
        ? '수리'
        : '정상';
  const isWarning = summary.brokenRooms > 0 || durability < 50 || summary.assignedMonsters <= 0;
  const warningColor = isWarning ? DUNGEON_UI.EMBER : DUNGEON_UI.JADE;

  const y = GRID_Y - 8;
  const strip = scene.add.container(CANVAS_WIDTH / 2, y).setDepth(76).setAlpha(0);
  const g = scene.add.graphics();
  const w = CANVAS_WIDTH - 24;
  const h = 24;
  g.fillStyle(DUNGEON_UI.VOID, 0.55);
  g.fillRoundedRect(-w / 2 + 1, -h / 2 + 2, w, h, 5);
  g.fillStyle(DUNGEON_UI.STONE, 0.98);
  g.fillRoundedRect(-w / 2, -h / 2, w, h, 5);
  g.lineStyle(1, DUNGEON_UI.IRON, 0.94);
  g.strokeRoundedRect(-w / 2, -h / 2, w, h, 5);
  g.fillStyle(warningColor, 0.88);
  g.fillRect(-w / 2 + 1, -h / 2 + 5, 3, h - 10);
  g.lineStyle(1, DUNGEON_UI.EDGE, 0.5);
  g.lineBetween(-116, -7, -116, 7);
  strip.add(g);

  const title = scene.add.text(-w / 2 + 12, 0, '방어 진형', {
    fontFamily: 'Georgia, serif',
    fontSize: '10px',
    fontStyle: 'bold',
    color: DUNGEON_UI_CSS.PARCHMENT,
  }).setOrigin(0, 0.5);
  strip.add(title);

  strip.add(scene.add.text(-107, 0,
    `방 ${summary.builtRooms} · 수호 ${summary.assignedMonsters} · 함정 ${summary.activeTraps}`, {
      fontFamily: 'sans-serif', fontSize: '10px', fontStyle: 'bold', color: DUNGEON_UI_CSS.TEXT,
    }).setOrigin(0, 0.5));
  strip.add(scene.add.text(22, 0, `장비 ${summary.equippedMonsters} · 내구 ${durability}%`, {
    fontFamily: 'sans-serif', fontSize: '10px', fontStyle: 'bold',
    color: durability < 50 ? DUNGEON_UI_CSS.EMBER : DUNGEON_UI_CSS.MUTED,
  }).setOrigin(0, 0.5));

  const statusBg = scene.add.graphics();
  statusBg.fillStyle(warningColor, isWarning ? 0.18 : 0.86);
  statusBg.fillRoundedRect(131, -8, 44, 16, 4);
  statusBg.lineStyle(1, warningColor, 0.95);
  statusBg.strokeRoundedRect(131, -8, 44, 16, 4);
  strip.add(statusBg);
  strip.add(scene.add.text(153, 0, warning, {
    fontFamily: 'sans-serif', fontSize: '10px', fontStyle: 'bold',
    color: isWarning ? DUNGEON_UI_CSS.EMBER : '#ffffff',
  }).setOrigin(0.5));

  scene.commandStrip = strip;
  scene.tweens.add({
    targets: strip,
    alpha: { from: 0, to: 0.96 },
    y: y - 2,
    duration: 220,
    ease: 'Cubic.easeOut',
  });
}

// ─── Combat loop ───────────────────────────────────────────────────────────

export function runCombat(scene: DungeonScene, now: number): void {
  const cs  = scene.effectiveCellSize;
  const ctx = buildCombatResolverCtx(scene);
  const rmCtx = buildRoomMechanicsCtx(scene);
  for (let row = 0; row < GRID_ROWS; row++) {
    for (let col = 0; col < scene.effectiveCols; col++) {
      const data = scene.roomGrid[row][col];
      if (!data || !data.attackCooldown) continue;
      if (now - data.lastAttackTime < data.attackCooldown) continue;

      const mDef        = resolveMonsterDef(data.monsterSlot ?? undefined);
      const range       = mDef ? mDef.range : 1;
      const cellCenterY = GRID_Y + row * cs + cs / 2;
      const rowRange    = cs * Math.max(range - 0.2, 0.8);

      const target = _findTarget(
        scene.activeInvaders, data, mDef,
        scene.rooms[row][col].x, cellCenterY, rowRange, now,
      );
      if (target && _resolveAttack(ctx, row, col, data, mDef, target, cellCenterY, now)) continue;
    }
  }
  _runExtraMonsterAttacks(rmCtx, now);
}

// ─── Event Registration ────────────────────────────────────────────────────

export function setupEvents(scene: DungeonScene): void {
  scene.events.on('invaderKilled',    (inv: Invader)               => scene.handleInvaderKilled(inv));
  scene.events.on('invaderReachedEnd',(inv: Invader)               => scene.handleInvaderReachedEnd(inv));
  scene.events.on('mirrorReflect',    (_inv: Invader, dmg: number) => scene.handleMirrorReflect(dmg));
  scene.events.on('invaderKilledRow', (_inv: Invader, row: number) => scene.handleInvaderKilledRow(row));
  scene.events.on('roomDestroyed',    (row: number, col: number)   => scene.handleRoomDestroyed(row, col));
  scene.events.on('permafrostShatter',(source: Invader)            => scene.handlePermafrostShatter(source));

  // `registry.events` is GAME-global: unlike `scene.events`, its listeners are
  // NOT torn down on scene shutdown, so without explicit cleanup they stack on
  // every battle (endless 재도전 등) and fire stale handlers on the reused
  // DungeonScene instance. Remove them on SHUTDOWN (mirrors UIScene's `on()`).
  const onSpeed  = (_: unknown, v: 1 | 2 | 3) => scene.setSpeed(v);
  const onPaused = (_: unknown, p: boolean)   => scene.handleBattlePauseChange(p);
  scene.registry.events.on('changedata-battleSpeed',  onSpeed);
  scene.registry.events.on('changedata-battlePaused', onPaused);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    scene.registry.events.off('changedata-battleSpeed',  onSpeed);
    scene.registry.events.off('changedata-battlePaused', onPaused);
  });
}
