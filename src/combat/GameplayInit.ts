// ─── Gameplay Init ─────────────────────────────────────────────────────────────
// One-time initializers extracted from DungeonScene.create():
//   initSkillHUD()    — builds the SkillHUD and wires skill-select callbacks
//   initSwapManager() — builds the MonsterSwapManager and wires swap callbacks
//
// Both need the scene, roomGrid, and rooms grid; they write back exactly one
// manager reference each via the setter callbacks.

import Phaser from 'phaser';
import { Room } from '../objects/Room';
import type { RoomData } from '../data/rooms';
import { resolveMonsterAttackCooldown, resolveOwnedMonsterProfile } from '../data/monsters';
import { ACTIVE_SKILLS } from '../data/barracks';
import { COLORS, CSS } from '../constants/colors';
import { loadGameState } from '../data/wisdom';
import { SkillHUD } from './SkillHUD';
import { MonsterSwapManager } from './MonsterSwap';
import { showFloatText } from './VisualEffects';

// Re-export type alias so callers don't need a separate import
export type GameStateArg = ReturnType<typeof loadGameState>;

// ─── Context ─────────────────────────────────────────────────────────────────

export interface GameplayInitContext {
  readonly scene:         Phaser.Scene;
  readonly roomGrid:      (RoomData | null)[][];
  readonly rooms:         Room[][];
  readonly effectiveCols: number;
  readonly effectiveCellSize: number;

  setTargetingSkillId(v: string | null): void;
  setSkillHUD(v: SkillHUD): void;
  setSwapManager(v: MonsterSwapManager): void;
}

interface SkillTargetMarkerRefs {
  readonly container: Phaser.GameObjects.Container;
  readonly tweens: Phaser.Tweens.Tween[];
}

// ─── initSkillHUD ─────────────────────────────────────────────────────────────
// Resolves equipped skills from owned-monster data, fills up to 3 slots with
// available skills, then creates the HUD and wires selection callbacks.

export function initSkillHUD(ctx: GameplayInitContext, gameState: GameStateArg): void {
  let targetMarkers: SkillTargetMarkerRefs | undefined;
  const clearTargetMarkers = () => {
    targetMarkers?.tweens.forEach(tween => tween.remove());
    targetMarkers?.container.destroy();
    targetMarkers = undefined;
  };

  // Collect up to 3 equipped skill IDs from owned monsters
  const equippedSkillIds: string[] = [];
  for (const m of gameState.ownedMonsters ?? []) {
    for (const sid of m.equippedSkills ?? []) {
      if (!equippedSkillIds.includes(sid) && equippedSkillIds.length < 3) {
        equippedSkillIds.push(sid);
      }
    }
  }
  // Fill remaining slots with first available active skills
  for (const sk of ACTIVE_SKILLS) {
    if (equippedSkillIds.length >= 3) break;
    if (!equippedSkillIds.includes(sk.id)) equippedSkillIds.push(sk.id);
  }

  const hud = new SkillHUD(ctx.scene, equippedSkillIds, {
    onSkillSelected: (skillId) => {
      ctx.setTargetingSkillId(skillId);
      clearTargetMarkers();
      targetMarkers = createSkillTargetMarkers(ctx, skillId);
      // Highlight all rooms that have monsters
      for (let r = 0; r < ctx.roomGrid.length; r++) {
        for (let c = 0; c < ctx.effectiveCols; c++) {
          if (ctx.roomGrid[r][c]?.monsterSlot) {
            ctx.rooms[r]?.[c]?.setAlpha(1);
          }
        }
      }
    },
    onSkillCancelled: () => {
      ctx.setTargetingSkillId(null);
      clearTargetMarkers();
    },
  });

  ctx.setSkillHUD(hud);
}

function createSkillTargetMarkers(
  ctx: GameplayInitContext,
  skillId: string,
): SkillTargetMarkerRefs | undefined {
  const skill = ACTIVE_SKILLS.find(s => s.id === skillId);
  const accent = getSkillTargetAccent(skill?.category);
  const size = Math.max(58, ctx.effectiveCellSize - 10);
  const corner = 13;
  const tweens: Phaser.Tweens.Tween[] = [];
  const container = ctx.scene.add.container(0, 0).setName('skillTargetMarkers').setDepth(88);

  for (let r = 0; r < ctx.roomGrid.length; r++) {
    for (let c = 0; c < ctx.effectiveCols; c++) {
      const room = ctx.rooms[r]?.[c];
      if (!room || room.state !== 'occupied' || !room.roomData) continue;

      const marker = ctx.scene.add.container(room.x, room.y).setAlpha(0.78).setScale(0.98);
      const g = ctx.scene.add.graphics();
      const half = size / 2;
      const top = -half;
      const left = -half;
      const right = half;
      const bottom = half;

      g.fillStyle(accent, 0.075);
      g.fillRoundedRect(left + 5, top + 5, size - 10, size - 10, 9);
      g.lineStyle(2, accent, 0.88);
      g.lineBetween(left + 5, top + 5, left + corner, top + 5);
      g.lineBetween(left + 5, top + 5, left + 5, top + corner);
      g.lineBetween(right - 5, top + 5, right - corner, top + 5);
      g.lineBetween(right - 5, top + 5, right - 5, top + corner);
      g.lineBetween(left + 5, bottom - 5, left + corner, bottom - 5);
      g.lineBetween(left + 5, bottom - 5, left + 5, bottom - corner);
      g.lineBetween(right - 5, bottom - 5, right - corner, bottom - 5);
      g.lineBetween(right - 5, bottom - 5, right - 5, bottom - corner);

      g.lineStyle(1.25, 0xffffff, 0.34);
      g.strokeCircle(0, 0, 10);
      g.lineStyle(1, accent, 0.72);
      g.lineBetween(-15, 0, -6, 0);
      g.lineBetween(6, 0, 15, 0);
      g.lineBetween(0, -15, 0, -6);
      g.lineBetween(0, 6, 0, 15);

      const badge = ctx.scene.add.graphics();
      badge.fillStyle(0x050301, 0.78);
      badge.fillRoundedRect(-17, top + 10, 34, 20, 8);
      badge.lineStyle(1, COLORS.TORCH_GOLD, 0.48);
      badge.strokeRoundedRect(-17, top + 10, 34, 20, 8);

      const icon = ctx.scene.add.text(0, top + 20, skill?.icon ?? '✦', {
        fontFamily: 'sans-serif',
        fontSize: '14px',
        color: CSS.PARCHMENT,
      }).setOrigin(0.5);
      icon.setShadow(0, 1, '#000000', 0.45, true, true);

      marker.add([g, badge, icon]);
      container.add(marker);
      tweens.push(ctx.scene.tweens.add({
        targets: marker,
        alpha: { from: 0.58, to: 1 },
        scaleX: { from: 0.96, to: 1.03 },
        scaleY: { from: 0.96, to: 1.03 },
        duration: 620,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      }));
    }
  }

  if (container.length <= 0) {
    container.destroy();
    return undefined;
  }

  return { container, tweens };
}

function getSkillTargetAccent(category: typeof ACTIVE_SKILLS[number]['category'] | undefined): number {
  switch (category) {
    case 'combat':
      return 0xff7a2c;
    case 'defense':
      return 0x55ccff;
    case 'support':
      return 0x5cff9b;
    default:
      return COLORS.TORCH_GOLD;
  }
}

// ─── initSwapManager ──────────────────────────────────────────────────────────
// Registers the global pointerup listener that cancels long-press, then
// creates the MonsterSwapManager with grid-read and swap-execute callbacks.

export function initSwapManager(ctx: GameplayInitContext): void {
  let swapMgr: MonsterSwapManager | undefined;

  ctx.scene.input.on('pointerup', () => swapMgr?.onRoomPointerUp());

  swapMgr = new MonsterSwapManager(ctx.scene, {
    getMonsterAt: (row, col) => ctx.roomGrid[row]?.[col]?.monsterSlot ?? null,

    executeSwap: (r1, c1, r2, c2) => {
      const data1 = ctx.roomGrid[r1]?.[c1];
      const data2 = ctx.roomGrid[r2]?.[c2];
      if (!data1 || !data2) return;

      // Swap monster slot references
      const temp      = data1.monsterSlot;
      data1.monsterSlot = data2.monsterSlot;
      data2.monsterSlot = temp;
      data1.attackCooldown = resolveMonsterAttackCooldown(data1.monsterSlot, data1.type);
      data2.attackCooldown = resolveMonsterAttackCooldown(data2.monsterSlot, data2.type);

      // Redraw sprite for cell 1
      if (data1.monsterSlot) {
        const def1 = resolveOwnedMonsterProfile(data1.monsterSlot);
        ctx.rooms[r1]?.[c1]?.setMonsterSprite(data1.monsterSlot, def1?.emoji);
      } else {
        ctx.rooms[r1]?.[c1]?.setMonsterSprite(null);
      }
      // Redraw sprite for cell 2
      if (data2.monsterSlot) {
        const def2 = resolveOwnedMonsterProfile(data2.monsterSlot);
        ctx.rooms[r2]?.[c2]?.setMonsterSprite(data2.monsterSlot, def2?.emoji);
      } else {
        ctx.rooms[r2]?.[c2]?.setMonsterSprite(null);
      }

      showFloatText(
        ctx.scene,
        ctx.rooms[r1]?.[c1]?.x ?? 0,
        ctx.rooms[r1]?.[c1]?.y ?? 0,
        '🔄 교체!', '#44ccff',
      );
    },
  });

  ctx.setSwapManager(swapMgr);
}
