import Phaser from 'phaser';
import {
  getUnlockedSlotCount,
  ROOM_SLOT_TYPE_DEFS,
  SLOT_UNLOCK_LEVELS,
  type GameState,
  type RoomSlotType,
} from '../data/wisdom';
import {
  calculateDungeonMetrics,
  calculateRoomMetrics,
} from '../data/dungeonMetrics';
import type { DungeonTheme } from '../themes/themes';

export interface DungeonBlueprintPanelOptions {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

interface DungeonBuildSummary {
  readonly unlockedSlots: number;
  readonly builtRooms: number;
  readonly monsterCount: number;
  readonly trapCount: number;
  readonly threatScore: number;
  readonly lootPotential: number;
  readonly readiness: number;
  readonly nextUnlockLevel: number | null;
  readonly nextUnlockCount: number | null;
  readonly unlockProgress: number;
}

const ROOM_PREVIEW_STYLE: Record<RoomSlotType | 'empty' | 'locked', { fill: number; accent: number; text: string }> = {
  combat:  { fill: 0x38291f, accent: 0xff8a45, text: '#ffd3a6' },
  trap:    { fill: 0x173527, accent: 0x5fb854, text: '#b9ffd8' },
  support: { fill: 0x2a1c0e, accent: 0x55b88a, text: '#dce8c8' },
  magic:   { fill: 0x2c1f10, accent: 0x9a6cd8, text: '#d6ccff' },
  empty:   { fill: 0x261808, accent: 0x907a58, text: '#b8cfdd' },
  locked:  { fill: 0x111a22, accent: 0x3d3020, text: '#617586' },
};

function getRoomVisual(roomType: RoomSlotType | undefined): { icon: string; name: string } {
  const def = ROOM_SLOT_TYPE_DEFS.find(t => t.id === roomType);
  return {
    icon: def?.icon ?? '+',
    name: def?.name ?? '미설계',
  };
}

function getDungeonBuildSummary(gs: GameState): DungeonBuildSummary {
  const unlockedSlots = getUnlockedSlotCount(gs);
  const visibleSlots = (gs.dungeonSlots ?? []).slice(0, unlockedSlots);
  const builtRooms = visibleSlots.filter(slot => !!slot?.roomType).length;
  const monsterCount = visibleSlots.reduce(
    (sum, slot) => sum + (slot?.monsterIds ?? []).filter(Boolean).length,
    0,
  );
  const trapCount = visibleSlots.reduce(
    (sum, slot) => sum + (slot?.trapIds ?? []).filter(Boolean).length,
    0,
  );
  const dungeonMetrics = calculateDungeonMetrics(gs, unlockedSlots);
  const nextUnlock = SLOT_UNLOCK_LEVELS.find(([, count]) => count > unlockedSlots);
  const currentUnlock = [...SLOT_UNLOCK_LEVELS]
    .reverse()
    .find(([level, count]) => gs.dmLevel >= level && count <= unlockedSlots);
  const currentLevel = currentUnlock?.[0] ?? 0;
  const nextLevel = nextUnlock?.[0] ?? null;
  const unlockProgress = nextLevel === null
    ? 1
    : Phaser.Math.Clamp((gs.dmLevel - currentLevel) / Math.max(1, nextLevel - currentLevel), 0, 1);

  return {
    unlockedSlots,
    builtRooms,
    monsterCount,
    trapCount,
    threatScore: dungeonMetrics.threatScore,
    lootPotential: dungeonMetrics.lootPotential,
    readiness: dungeonMetrics.readiness,
    nextUnlockLevel: nextLevel,
    nextUnlockCount: nextUnlock?.[1] ?? null,
    unlockProgress,
  };
}

export function buildDungeonBlueprintPanel(
  scene: Phaser.Scene,
  gs: GameState,
  theme: DungeonTheme,
  options: DungeonBlueprintPanelOptions,
): Phaser.GameObjects.Container {
  const { x, y, w, h } = options;
  const t = theme;
  const summary = getDungeonBuildSummary(gs);
  const c = scene.add.container(0, 0).setDepth(2);
  const g = scene.add.graphics();
  c.add(g);

  g.fillStyle(t.panelDark, 0.94);
  g.fillRoundedRect(x, y, w, h, 7);
  g.lineStyle(1.4, t.panelBorder, 0.54);
  g.strokeRoundedRect(x, y, w, h, 7);
  g.fillStyle(t.panelBorder, 0.08);
  g.fillRoundedRect(x + 8, y + 5, w - 16, 4, 2);

  c.add(scene.add.text(x + 13, y + 14, '던전 전경', {
    fontFamily: 'Georgia, serif',
    fontSize: '12px',
    color: t.panelBorderCSS,
    fontStyle: 'bold',
  }).setOrigin(0, 0.5));

  c.add(scene.add.text(x + 13, y + 31, `방 ${summary.builtRooms}/${summary.unlockedSlots} · 위협 ${summary.threatScore}`, {
    fontFamily: 'sans-serif',
    fontSize: '9px',
    color: t.textSecondary,
  }).setOrigin(0, 0.5));

  const nextText = summary.nextUnlockLevel === null
    ? '전체 개방'
    : `다음 확장 Lv.${summary.nextUnlockLevel}`;
  c.add(scene.add.text(x + 13, y + 48, `${nextText} · 준비 ${summary.readiness}%`, {
    fontFamily: 'sans-serif',
    fontSize: '8px',
    color: summary.nextUnlockLevel === null ? '#88ffcc' : '#ffcc66',
    fontStyle: 'bold',
  }).setOrigin(0, 0.5));

  const progressX = x + 13;
  const progressY = y + h - 12;
  const progressW = 72;
  g.fillStyle(t.stoneDark, 1);
  g.fillRoundedRect(progressX, progressY, progressW, 5, 3);
  g.fillStyle(summary.nextUnlockLevel === null ? 0x66c08a : 0xffcc66, 0.92);
  g.fillRoundedRect(progressX, progressY, Math.max(5, progressW * summary.unlockProgress), 5, 3);

  const caveX = x + 94;
  const caveY = y + 14;
  const caveW = w - 106;
  const caveH = h - 24;
  g.fillStyle(t.bgPrimary, 0.48);
  g.fillRoundedRect(caveX, caveY, caveW, caveH, 8);
  g.lineStyle(1.2, t.panelBorder, 0.18);
  g.strokeRoundedRect(caveX, caveY, caveW, caveH, 8);
  g.fillStyle(t.stoneDark, 0.42);
  g.fillRoundedRect(caveX + 6, caveY + 5, caveW - 12, caveH - 10, 7);
  g.lineStyle(1, t.stoneMid, 0.38);
  g.lineBetween(caveX + 12, caveY + 16, caveX + caveW - 12, caveY + 16);
  g.lineBetween(caveX + 12, caveY + 35, caveX + caveW - 12, caveY + 35);

  const roomW = Math.floor((caveW - 28) / 3);
  const roomH = 14;
  const gapX = 6;
  const gapY = 5;
  const roomStartX = caveX + 9;
  const roomStartY = caveY + 9;
  g.lineStyle(4, t.panelBorder, 0.1);
  for (let row = 0; row < 3; row++) {
    const cy = roomStartY + row * (roomH + gapY) + roomH / 2;
    g.lineBetween(roomStartX + roomW / 2, cy, roomStartX + 2 * (roomW + gapX) + roomW / 2, cy);
  }
  for (let col = 0; col < 3; col++) {
    const cx = roomStartX + col * (roomW + gapX) + roomW / 2;
    g.lineBetween(cx, roomStartY + roomH / 2, cx, roomStartY + 2 * (roomH + gapY) + roomH / 2);
  }

  const roomMetrics = Array.from({ length: 9 }, (_, i) =>
    calculateRoomMetrics(gs, gs.dungeonSlots?.[i]),
  );
  const maxRoomThreat = Math.max(1, ...roomMetrics.map(metrics => metrics.threatScore));

  for (let i = 0; i < 9; i++) {
    const row = Math.floor(i / 3);
    const col = i % 3;
    const rx = roomStartX + col * (roomW + gapX);
    const ry = roomStartY + row * (roomH + gapY);
    const unlocked = i < summary.unlockedSlots;
    const isNext = i + 1 === summary.nextUnlockCount;
    const slot = gs.dungeonSlots?.[i];
    const style = unlocked
      ? ROOM_PREVIEW_STYLE[slot?.roomType ?? 'empty']
      : ROOM_PREVIEW_STYLE.locked;
    const roomVisual = getRoomVisual(slot?.roomType);
    const monsterCount = (slot?.monsterIds ?? []).filter(Boolean).length;
    const trapCount = (slot?.trapIds ?? []).filter(Boolean).length;
    const built = unlocked && !!slot?.roomType;
    const metrics = roomMetrics[i];

    g.fillStyle(style.fill, unlocked ? 0.98 : 0.72);
    g.fillRoundedRect(rx, ry, roomW, roomH, 4);
    g.lineStyle(1.1, isNext ? 0xffcc66 : style.accent, isNext ? 0.95 : built ? 0.78 : 0.36);
    g.strokeRoundedRect(rx, ry, roomW, roomH, 4);
    if (built) {
      g.fillStyle(style.accent, 0.8);
      g.fillRoundedRect(rx + 4, ry + 3, 4, roomH - 6, 2);
      if (metrics.threatScore > 0) {
        g.fillStyle(style.accent, 0.88);
        g.fillRoundedRect(rx + 9, ry + roomH - 4, Math.max(4, (roomW - 16) * metrics.threatScore / maxRoomThreat), 2, 1);
      }
    }

    c.add(scene.add.text(rx + roomW / 2, ry + roomH / 2, unlocked ? roomVisual.icon : '🔒', {
      fontFamily: 'sans-serif',
      fontSize: built ? '9px' : '8px',
      color: style.text,
    }).setOrigin(0.5));

    if (monsterCount > 0) {
      g.fillStyle(0xe8c468, 0.95);
      g.fillCircle(rx + roomW - 11, ry + roomH - 4, 2.5);
    }
    if (trapCount > 0) {
      g.fillStyle(0x5fb854, 0.95);
      g.fillCircle(rx + roomW - 5, ry + roomH - 4, 2.5);
    }
  }

  c.add(scene.add.text(caveX + 9, caveY + caveH - 6, `함정 ${summary.trapCount} · 전리품 +${summary.lootPotential}`, {
    fontFamily: 'sans-serif',
    fontSize: '7px',
    color: '#8fd8a8',
  }).setOrigin(0, 1));
  c.add(scene.add.text(caveX + caveW - 9, caveY + caveH - 6, '방 탭 = 확대/배치', {
    fontFamily: 'sans-serif',
    fontSize: '7px',
    color: '#ffd166',
  }).setOrigin(1, 1));

  return c;
}
