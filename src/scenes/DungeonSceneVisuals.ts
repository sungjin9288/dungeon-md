/**
 * DungeonSceneVisuals — extracted private-method bodies from DungeonScene.
 *
 * These were all PRIVATE methods; only DungeonScene calls them (via
 * one-line delegators that keep the original `this.<name>(...)` call sites).
 * Import the DungeonScene TYPE only to avoid a runtime circular dependency.
 */
import type { DungeonScene } from './DungeonScene';
import Phaser from 'phaser';
import { CASUAL, CASUAL_CSS } from '../constants/colors';
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
      color: summary.brokenRooms > 0 ? CASUAL_CSS.RED : CASUAL_CSS.INK,
      backgroundColor: CASUAL_CSS.CREAM,
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
        : '준비';
  const isWarning = summary.brokenRooms > 0 || durability < 50 || summary.assignedMonsters <= 0;
  const warningColor = isWarning ? CASUAL.RED : CASUAL.GREEN;

  const y = GRID_Y - 8;
  const strip = scene.add.container(CANVAS_WIDTH / 2, y).setDepth(76).setAlpha(0);
  const g = scene.add.graphics();
  const w = CANVAS_WIDTH - 24;
  const h = 22;
  // Cream strip with chunky brown edge + white top highlight (casual toy look).
  g.fillStyle(CASUAL.SHADOW, 0.18);
  g.fillRoundedRect(-w / 2, -h / 2 + 3, w, h, 8);
  g.fillStyle(CASUAL.PANEL, 0.98);
  g.fillRoundedRect(-w / 2, -h / 2, w, h, 8);
  g.lineStyle(2, CASUAL.EDGE, 0.92);
  g.strokeRoundedRect(-w / 2, -h / 2, w, h, 8);
  g.fillStyle(0xffffff, 0.12);
  g.fillRoundedRect(-w / 2 + 6, -h / 2 + 3, w - 12, 3, 2);
  strip.add(g);

  const title = scene.add.text(-w / 2 + 12, 0, '방어 진형', {
    fontFamily: 'Georgia, serif',
    fontSize: '10px',
    fontStyle: 'bold',
    color: CASUAL_CSS.INK,
  }).setOrigin(0, 0.5);
  strip.add(title);

  addCommandStripChip(scene, strip, -98, `방${summary.builtRooms}`, CASUAL.BLUE, CASUAL_CSS.BLUE);
  addCommandStripChip(scene, strip, -50, `수호${summary.assignedMonsters}`, CASUAL.RED, CASUAL_CSS.RED);
  addCommandStripChip(scene, strip, 2, `함정${summary.activeTraps}`, CASUAL.GREEN, CASUAL_CSS.GREEN);
  addCommandStripChip(scene, strip, 57, `장비${summary.equippedMonsters}`,
    summary.equippedMonsters > 0 ? CASUAL.GOLD : CASUAL.EDGE_SOFT,
    summary.equippedMonsters > 0 ? CASUAL_CSS.GOLD : CASUAL_CSS.INK_SOFT);
  addCommandStripChip(scene, strip, 115, `내구${durability}%`,
    durability < 50 ? CASUAL.RED : CASUAL.GOLD,
    durability < 50 ? CASUAL_CSS.RED : CASUAL_CSS.GOLD);
  addCommandStripChip(scene, strip, 172, warning, warningColor,
    isWarning ? CASUAL_CSS.RED : CASUAL_CSS.WHITE, true, !isWarning);

  scene.commandStrip = strip;
  scene.tweens.add({
    targets: strip,
    alpha: { from: 0, to: 0.96 },
    y: y - 2,
    duration: 220,
    ease: 'Cubic.easeOut',
  });
}

export function addCommandStripChip(
  scene: DungeonScene,
  strip: Phaser.GameObjects.Container,
  x: number,
  label: string,
  accent: number,
  textColor: string,
  alignRight = false,
  candy = false,
): void {
  const text = scene.add.text(x, 0, label, {
    fontFamily: 'Georgia, serif',
    fontSize: '9px',
    fontStyle: 'bold',
    // Candy "ready" pill gets white-on-saturated text; stat pills get their
    // saturated accent value as the label color over a cream body.
    color: candy ? CASUAL_CSS.WHITE : textColor,
  }).setOrigin(alignRight ? 1 : 0.5, 0.5);
  const b = text.getBounds();
  const padX = 8;
  const chipW = b.width + padX * 2;
  const chipX = alignRight ? x - b.width - padX * 2 : x - b.width / 2 - padX;
  const bg = scene.add.graphics();
  if (candy) {
    // Bright saturated candy pill (GREEN/GOLD when ready) with white highlight.
    bg.fillStyle(CASUAL.SHADOW, 0.22);
    bg.fillRoundedRect(chipX, -7, chipW, 16, 6);
    bg.fillStyle(accent, 1);
    bg.fillRoundedRect(chipX, -8, chipW, 16, 6);
    bg.lineStyle(2, CASUAL.EDGE, 0.85);
    bg.strokeRoundedRect(chipX, -8, chipW, 16, 6);
    bg.fillStyle(0xffffff, 0.12);
    bg.fillRoundedRect(chipX + 4, -6, chipW - 8, 3, 2);
  } else {
    // Cream stat pill: PANEL_SOFT body + 2px EDGE border + white top highlight.
    bg.fillStyle(CASUAL.PANEL_SOFT, 0.98);
    bg.fillRoundedRect(chipX, -8, chipW, 16, 6);
    bg.lineStyle(2, CASUAL.EDGE, 0.55);
    bg.strokeRoundedRect(chipX, -8, chipW, 16, 6);
    bg.fillStyle(0xffffff, 0.14);
    bg.fillRoundedRect(chipX + 4, -6, chipW - 8, 3, 2);
  }
  strip.add(bg);
  strip.add(text);
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
  scene.registry.events.on('changedata-battleSpeed',  (_: unknown, v: 1 | 2 | 3) => scene.setSpeed(v));
  scene.registry.events.on('changedata-battlePaused', (_: unknown, p: boolean) => scene.handleBattlePauseChange(p));
}
