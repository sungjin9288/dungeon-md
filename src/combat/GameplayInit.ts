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
import { MONSTER_DEFS } from '../data/monsters';
import { ACTIVE_SKILLS } from '../data/barracks';
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

  setTargetingSkillId(v: string | null): void;
  setSkillHUD(v: SkillHUD): void;
  setSwapManager(v: MonsterSwapManager): void;
}

// ─── initSkillHUD ─────────────────────────────────────────────────────────────
// Resolves equipped skills from owned-monster data, fills up to 3 slots with
// available skills, then creates the HUD and wires selection callbacks.

export function initSkillHUD(ctx: GameplayInitContext, gameState: GameStateArg): void {
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
      // Highlight all rooms that have monsters
      for (let r = 0; r < ctx.roomGrid.length; r++) {
        for (let c = 0; c < ctx.effectiveCols; c++) {
          if (ctx.roomGrid[r][c]?.monsterSlot) {
            ctx.rooms[r]?.[c]?.setAlpha(1);
          }
        }
      }
    },
    onSkillCancelled: () => ctx.setTargetingSkillId(null),
  });

  ctx.setSkillHUD(hud);
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

      // Redraw sprite for cell 1
      if (data1.monsterSlot) {
        const def1 = MONSTER_DEFS[data1.monsterSlot as keyof typeof MONSTER_DEFS];
        ctx.rooms[r1]?.[c1]?.setMonsterSprite(data1.monsterSlot, def1?.emoji);
      } else {
        ctx.rooms[r1]?.[c1]?.setMonsterSprite(null);
      }
      // Redraw sprite for cell 2
      if (data2.monsterSlot) {
        const def2 = MONSTER_DEFS[data2.monsterSlot as keyof typeof MONSTER_DEFS];
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
