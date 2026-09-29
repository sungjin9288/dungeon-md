/**
 * PreBattleDefenseUI.ts — draw helpers and the "MIDDLE: Dungeon defense loadout"
 * section extracted from PreBattleScene.create().
 * All functions take (scene, ctx, ...) — no `this` usage.
 */
import Phaser from 'phaser';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../constants/layout';
import { type GameState } from '../data/wisdom';
import type { InvasionConfig } from '../data/quests';
import { getDungeonActionQueue, type RoomActionRecommendation } from '../data/roomActionRecommendations';
import { getReducedMotion } from '../utils/reducedMotion';
import { addFramedPanel } from '../ui/GameUiPrimitives';
import { addMonsterPortrait } from '../ui/MonsterPortraitView';
import { drawSigil } from '../ui/Sigils';
import { ROOM_TYPE_SIGILS, sigilFor } from '../ui/sigilMaps';
import {
  CASUAL,
  CASUAL_CSS,
  DUNGEON_UI,
  DUNGEON_UI_CSS,
  ZONE_ACCENTS,
} from '../constants/colors';
import {
  ACCENT,
  type DefenseDirective,
  type DefenseRoomSummary,
  type DefenseTotals,
  getDefenseDirective,
  getDefenseRooms,
  getDefenseTotals,
  getDefenseQueueBadgeLabel,
  getDefenseDirectiveDisplayChip,
  formatDefenseReadinessPercent,
  ROOM_STYLE,
  getMonsterDisplayName,
  getMonsterDisplayEmoji,
  getTrapDisplay,
  getOwnedMonster,
  shortenLabel,
} from './PreBattleShared';

// ─── Context passed in from PreBattleScene ────────────────────────────────────


/** Route nodes sit below the title row so the queue pips (drawn 4px above a node) clear it. */
const RAIL_NODE_TOP = 25;
export interface PreBattleDefenseContext {
  readonly gs: GameState;
  readonly cfg: InvasionConfig | undefined;
  readonly invasionPanelBottom: number; // dY = iY + iH + 16
  readonly onReturnToDungeonRoom: (slotIdx: number) => void;
}

// ─── Draw helpers ─────────────────────────────────────────────────────────────

export function drawDefenseActionTargetBadge(
  scene: Phaser.Scene,
  x: number,
  y: number,
  w: number,
  h: number,
  directive: DefenseDirective,
  labelOverride?: string,
): void {
  if (directive.actionSlotIdx === undefined || !directive.actionLabel) return;

  const label = labelOverride ?? getDefenseActionVerb(directive);
  const badgeW = label.length > 3 ? 48 : 40;
  const ring = scene.add.graphics();
  ring.lineStyle(2, directive.accent, 0.92);
  ring.strokeRoundedRect(x - 3, y - 3, w + 6, h + 6, 8);
  ring.fillStyle(directive.accent, 0.08);
  ring.fillRoundedRect(x + 3, y + 3, w - 6, h - 6, 6);

  const badge = scene.add.graphics();
  badge.fillStyle(DUNGEON_UI.SOOT, 0.96);
  badge.fillRoundedRect(x + w - badgeW - 8, y + 3, badgeW, 18, 4);
  badge.lineStyle(1, directive.accent, 0.82);
  badge.strokeRoundedRect(x + w - badgeW - 8, y + 5, badgeW, 14, 4);

  const text = scene.add.text(x + w - badgeW / 2 - 8, y + 12, label, {
    fontFamily: 'Georgia, serif',
    fontSize: '11px',
    color: DUNGEON_UI_CSS.TEXT,
    fontStyle: 'bold',
  }).setOrigin(0.5);

  if (!getReducedMotion()) {
    scene.tweens.add({
      targets: [ring, badge, text],
      alpha: { from: 0.62, to: 1 },
      duration: 260,
      ease: 'Power2.Out',
    });
  }
}

export function drawDefenseQueueBadge(
  scene: Phaser.Scene,
  x: number,
  y: number,
  action: RoomActionRecommendation,
  rank: number,
): void {
  const label = `${rank} ${getDefenseQueueBadgeLabel(action)}`;
  const w = label.length > 3 ? 48 : 40;
  const g = scene.add.graphics();
  g.fillStyle(DUNGEON_UI.SOOT, 0.94);
  g.fillRoundedRect(x - w, y, w, 18, 4);
  g.lineStyle(1, action.accent, 0.62);
  g.strokeRoundedRect(x - w, y, w, 14, 4);
  scene.add.text(x - w / 2, y + 7, label, {
    fontFamily: 'Georgia, serif',
    fontSize: '11px',
    color: DUNGEON_UI_CSS.TEXT,
    fontStyle: 'bold',
  }).setOrigin(0.5);
}

export function drawDefenseQueuePip(
  scene: Phaser.Scene,
  x: number,
  y: number,
  action: RoomActionRecommendation,
  rank: number,
): void {
  const g = scene.add.graphics();
  g.fillStyle(action.accent, 0.92);
  g.fillRoundedRect(x, y, 14, 11, 4);
  g.lineStyle(1, CASUAL.SHADOW, 0.58);
  g.strokeRoundedRect(x, y, 14, 11, 4);
  scene.add.text(x + 7, y + 6, String(rank), {
    fontFamily: 'monospace',
    fontSize: '10px',
    color: DUNGEON_UI_CSS.TEXT,
    fontStyle: 'bold',
  }).setOrigin(0.5);
}

export function drawDefenseRouteActionRing(
  scene: Phaser.Scene,
  x: number,
  y: number,
  w: number,
  h: number,
  accent: number,
  rank: number,
): void {
  const isPrimary = rank === 1;
  const ring = scene.add.graphics();
  ring.lineStyle(isPrimary ? 2 : 1.2, accent, isPrimary ? 0.96 : 0.72);
  ring.strokeRoundedRect(x - 3, y - 4, w + 6, h + 8, 7);
  ring.fillStyle(accent, isPrimary ? 0.12 : 0.06);
  ring.fillRoundedRect(x + 2, y + 2, w - 4, h - 4, 5);

  const corner = scene.add.graphics();
  corner.fillStyle(accent, 0.92);
  corner.fillTriangle(x + w - 2, y + 2, x + w - 2, y + 12, x + w - 12, y + 2);
  corner.lineStyle(1, CASUAL.SHADOW, 0.46);
  corner.lineBetween(x + w - 2, y + 12, x + w - 12, y + 2);

  const pulse = scene.add.graphics();
  pulse.lineStyle(1, accent, isPrimary ? 0.36 : 0.22);
  pulse.strokeRoundedRect(x - 7, y - 8, w + 14, h + 16, 9);

  if (!getReducedMotion()) {
    scene.tweens.add({
      targets: [ring, pulse],
      alpha: { from: isPrimary ? 0.66 : 0.54, to: 1 },
      duration: 260,
      ease: 'Power2.Out',
    });
  }
}

export function drawDefenseRoomCardShell(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  w: number,
  h: number,
  accent: number,
  readinessRatio: number,
  highlighted: boolean,
): void {
  const ratio = Phaser.Math.Clamp(readinessRatio, 0, 1);
  g.fillStyle(DUNGEON_UI.SOOT, highlighted ? 0.7 : 0.5);
  g.fillRoundedRect(x + 4, y + 4, w - 8, h - 8, 6);
  g.lineStyle(highlighted ? 1.6 : 1, accent, highlighted ? 0.84 : 0.38);
  g.strokeRoundedRect(x + 3, y + 3, w - 6, h - 6, 6);

  g.fillStyle(accent, highlighted ? 0.2 : 0.1);
  g.fillRoundedRect(x + 8, y + 10, 25, h - 20, 5);
  g.fillStyle(0xffffff, 0.07);
  g.fillRoundedRect(x + 12, y + 15, 17, 7, 3);
  g.fillStyle(DUNGEON_UI.SOOT, 0.82);
  g.fillRoundedRect(x + 13, y + h - 23, 15, 10, 4);

  g.fillStyle(DUNGEON_UI.SOOT, 0.92);
  g.fillRoundedRect(x + 42, y + h - 12, w - 98, 4, 2);
  g.fillStyle(accent, highlighted ? 0.96 : 0.78);
  g.fillRoundedRect(x + 42, y + h - 12, Math.max(4, (w - 98) * ratio), 4, 2);

  const socketAlpha = highlighted ? 0.72 : 0.42;
  [[x + w - 14, y + 8], [x + w - 14, y + h - 18], [x + 8, y + 8], [x + 8, y + h - 18]].forEach(([sx, sy]) => {
    g.fillStyle(accent, socketAlpha);
    g.fillRoundedRect(sx, sy, 6, 6, 2);
    g.fillStyle(DUNGEON_UI.SOOT, 0.72);
    g.fillRoundedRect(sx + 1, sy + 1, 4, 4, 1);
  });
}

// ─── Internal helper (not exported; used only in this module) ─────────────────

function getDefenseActionVerb(directive: DefenseDirective): string {
  if (directive.title.includes('새 방')) return '설계';
  if (directive.title.includes('수호자')) return '배치';
  if (directive.title.includes('함정')) return '함정';
  if (directive.title.includes('복구')) return '수리';
  return '정비';
}

// ─── buildDefenseLoadout ──────────────────────────────────────────────────────

/**
 * Builds the "MIDDLE: Dungeon defense loadout" panel.
 * Returns the bottom Y of the section so callers can position what follows.
 */
export function buildDefenseLoadout(
  scene: Phaser.Scene,
  ctx: PreBattleDefenseContext,
): { defenseRooms: DefenseRoomSummary[]; defenseTotals: DefenseTotals; directive: DefenseDirective; dY: number; dH: number } {
  const { gs, cfg, invasionPanelBottom, onReturnToDungeonRoom } = ctx;
  const defenseRooms = getDefenseRooms(gs);
  const defenseTotals = getDefenseTotals(gs, defenseRooms);
  const directive = getDefenseDirective(defenseRooms, defenseTotals, gs, cfg);
  const actionQueue = getDungeonActionQueue(gs, defenseTotals.unlockedSlots);
  const actionBySlot = new Map(
    actionQueue.map((action, index) => [action.slotIdx, { action, rank: index + 1 }]),
  );
  const readinessAccent = directive.severity === 'ready'
    ? DUNGEON_UI.JADE
    : directive.severity === 'warning'
      ? DUNGEON_UI.BRASS_BRIGHT
      : DUNGEON_UI.EMBER;
  const directiveExtraH = 18;
  const dY = invasionPanelBottom, dH = 348 + directiveExtraH;
  const { panel: dg } = addFramedPanel(scene, {
    x: 12,
    y: dY,
    w: CANVAS_WIDTH - 24,
    h: dH,
    radius: 8,
    fillColor: DUNGEON_UI.STONE,
    borderColor: DUNGEON_UI.IRON,
    borderAlpha: 0.96,
    borderWidth: 1.5,
    accentColor: ZONE_ACCENTS.invasion,
    accentAlpha: 1,
    glowColor: ZONE_ACCENTS.invasion,
    glowOpacity: 0.04,
    shadowOpacity: 0.3,
    shadowOffsetY: 3,
  });
  dg.fillStyle(DUNGEON_UI.SOOT, 0.62);
  dg.fillRoundedRect(22, dY + 38, CANVAS_WIDTH - 44, dH - 50, 6);
  dg.lineStyle(1, DUNGEON_UI.IRON, 0.64);
  dg.strokeRoundedRect(22, dY + 38, CANVAS_WIDTH - 44, dH - 50, 6);

  scene.add.text(28, dY + 17, '던전 방어 작전판', {
    fontFamily: 'sans-serif', fontSize: '14px', color: DUNGEON_UI_CSS.PARCHMENT, fontStyle: 'bold',
    stroke: '#030504', strokeThickness: 2,
  }).setOrigin(0, 0.5);

  scene.add.text(CANVAS_WIDTH - 28, dY + 16, `DM Lv.${gs.dmLevel}`, {
    fontFamily: 'monospace', fontSize: '11px', color: DUNGEON_UI_CSS.MUTED, fontStyle: 'bold',
  }).setOrigin(1, 0.5);

  const directiveY = dY + 42;
  const directiveIcon = directive.severity === 'ready' ? '✓' : '!';
  dg.fillStyle(DUNGEON_UI.STONE_RAISED, 1);
  dg.fillRoundedRect(24, directiveY, CANVAS_WIDTH - 48, 64, 8);
  dg.fillStyle(readinessAccent, 0.9);
  dg.fillRect(24, directiveY + 5, 3, 54);
  dg.lineStyle(1.5, readinessAccent, 0.9);
  dg.strokeRoundedRect(24, directiveY, CANVAS_WIDTH - 48, 64, 8);
  dg.fillStyle(DUNGEON_UI.SOOT, 0.92);
  dg.fillCircle(47, directiveY + 23, 15);
  dg.lineStyle(1.5, readinessAccent, 0.9);
  dg.strokeCircle(47, directiveY + 23, 15);
  scene.add.text(47, directiveY + 23, directiveIcon, {
    fontFamily: 'sans-serif',
    fontSize: '17px',
    color: directive.severity === 'ready' ? DUNGEON_UI_CSS.JADE : DUNGEON_UI_CSS.EMBER,
    fontStyle: 'bold',
  }).setOrigin(0.5);
  scene.add.text(72, directiveY + 12, '전투 지휘', {
    fontFamily: 'sans-serif',
    fontSize: '11px',
    color: DUNGEON_UI_CSS.MUTED,
    fontStyle: 'bold',
  }).setOrigin(0, 0.5);
  scene.add.text(72, directiveY + 25, directive.title, {
    fontFamily: 'sans-serif',
    fontSize: '12px',
    color: DUNGEON_UI_CSS.PARCHMENT,
    fontStyle: 'bold',
  }).setOrigin(0, 0.5);
  scene.add.text(72, directiveY + 35, directive.body, {
    fontFamily: 'sans-serif',
    fontSize: '11px',
    color: DUNGEON_UI_CSS.MUTED,
    wordWrap: { width: 218 },
  }).setOrigin(0, 0);

  const readyRatio = Math.max(0, Math.min(1, directive.readiness / 100));
  const readinessText = formatDefenseReadinessPercent(directive.readiness);
  const directiveChip = getDefenseDirectiveDisplayChip(directive);
  // Size the chip to its text ("보강 100%+" overflowed a fixed 50px pill); right edge stays put.
  const chipText = scene.add.text(0, directiveY + 20, `${directiveChip} ${readinessText}`, {
    fontFamily: 'monospace',
    fontSize: '10px',
    color: `#${readinessAccent.toString(16).padStart(6, '0')}`,
    fontStyle: 'bold',
  }).setOrigin(0.5);
  const chipW = Math.max(50, Math.ceil(chipText.width) + 14);
  const chipRight = CANVAS_WIDTH - 38;
  chipText.setX(chipRight - chipW / 2).setDepth(1);
  dg.fillStyle(DUNGEON_UI.SOOT, 1);
  dg.fillRoundedRect(chipRight - chipW, directiveY + 10, chipW, 20, 6);
  dg.lineStyle(1.5, readinessAccent, 0.9);
  dg.strokeRoundedRect(chipRight - chipW, directiveY + 10, chipW, 20, 6);
  dg.fillStyle(DUNGEON_UI.IRON, 0.9);
  dg.fillRoundedRect(CANVAS_WIDTH - 88, directiveY + 34, 50, 4, 2);
  if (readyRatio > 0) {
    dg.fillStyle(readinessAccent, 1);
    dg.fillRoundedRect(CANVAS_WIDTH - 88, directiveY + 34, Math.max(3, 50 * readyRatio), 4, 2);
  }

  const statY = dY + 98 + directiveExtraH;
  const drawStatPill = (x: number, label: string, value: string, color: number): void => {
    const w = 66, h = 24;
    dg.fillStyle(DUNGEON_UI.STONE_RAISED, 1);
    dg.fillRoundedRect(x, statY, w, h, 7);
    dg.fillStyle(color, 0.82);
    dg.fillRect(x, statY + 5, 2, h - 10);
    dg.lineStyle(1, DUNGEON_UI.IRON, 0.9);
    dg.strokeRoundedRect(x, statY, w, h, 7);
    scene.add.text(x + 8, statY + 7, label, {
      fontFamily: 'sans-serif', fontSize: '11px', color: DUNGEON_UI_CSS.MUTED, fontStyle: 'bold',
    }).setOrigin(0, 0.5);
    scene.add.text(x + w - 8, statY + 15, value, {
      fontFamily: 'monospace', fontSize: '10px', color: `#${color.toString(16).padStart(6, '0')}`,
      fontStyle: 'bold',
    }).setOrigin(1, 0.5);
  };

  drawStatPill(24,  '방',   `${defenseTotals.builtRooms}/${defenseTotals.unlockedSlots}`, DUNGEON_UI.EMBER);
  drawStatPill(94,  '수호', `${defenseTotals.monsterCount}`, DUNGEON_UI.BRASS);
  drawStatPill(164, '장비', `${defenseTotals.equipmentCount}`, DUNGEON_UI.BRASS_BRIGHT);
  drawStatPill(234, '함정', `${defenseTotals.trapCount}`, DUNGEON_UI.JADE);
  drawStatPill(304, 'DEF',  `${defenseTotals.totalPower}`, readinessAccent);

  const roomByIndex = new Map(defenseRooms.map(room => [room.index, room]));
  const railY = dY + 134 + directiveExtraH;
  const cellW = 29, cellH = 28, cellGap = 5;
  const railX = Math.floor((CANVAS_WIDTH - (9 * cellW + 8 * cellGap)) / 2);
  dg.fillStyle(DUNGEON_UI.STONE, 1);
  dg.fillRoundedRect(24, railY, CANVAS_WIDTH - 48, 58, 10);
  dg.fillStyle(ZONE_ACCENTS.invasion, 0.64);
  dg.fillRect(24, railY + 7, 2, 44);
  dg.lineStyle(1, DUNGEON_UI.IRON, 0.88);
  dg.strokeRoundedRect(24, railY, CANVAS_WIDTH - 48, 58, 10);
  // Direction lives in the title: end labels under the nodes collided with the
  // active node's ring.
  scene.add.text(32, railY + 10, '침략 루트 · 입구 → 던전 심장', {
    fontFamily: 'sans-serif', fontSize: '11px', color: DUNGEON_UI_CSS.TEXT, fontStyle: 'bold',
  }).setOrigin(0, 0.5);
  scene.add.text(CANVAS_WIDTH - 32, railY + 10, `권장 DEF ${directive.pressure || '-'}`, {
    fontFamily: 'monospace', fontSize: '10px', color: DUNGEON_UI_CSS.BRASS, fontStyle: 'bold',
  }).setOrigin(1, 0.5);
  dg.lineStyle(3, DUNGEON_UI.IRON, 0.72);
  dg.lineBetween(railX + cellW / 2, railY + RAIL_NODE_TOP + cellH / 2, railX + 8 * (cellW + cellGap) + cellW / 2, railY + RAIL_NODE_TOP + cellH / 2);
  for (let i = 0; i < 9; i++) {
    const slot = gs.dungeonSlots?.[i];
    const style = ROOM_STYLE[slot?.roomType ?? 'empty'];
    const queueItem = actionBySlot.get(i);
    const unlocked = i < defenseTotals.unlockedSlots;
    const built = unlocked && !!slot?.roomType;
    const room = roomByIndex.get(i);
    const isActionTarget = directive.actionSlotIdx === i && Boolean(directive.actionLabel);
    const cx = railX + i * (cellW + cellGap);
    const cy = railY + RAIL_NODE_TOP;
    dg.fillStyle(built ? style.bg : unlocked ? DUNGEON_UI.STONE_RAISED : DUNGEON_UI.SOOT, 1);
    dg.fillRoundedRect(cx, cy, cellW, cellH, 6);
    if (built) {
      dg.fillStyle(0xffffff, 0.05);
      dg.fillRoundedRect(cx + 3, cy + 4, cellW - 6, 8, 3);
      dg.fillStyle(style.accent, 0.16);
      dg.fillRoundedRect(cx + 4, cy + cellH - 7, cellW - 8, 3, 2);
    } else if (unlocked) {
      dg.fillStyle(DUNGEON_UI.EDGE, 0.42);
      dg.fillRect(cx + 4, cy + 4, 2, cellH - 8);
    }
    dg.lineStyle(built ? 1.5 : 1, built ? style.accent : DUNGEON_UI.IRON, built ? 0.85 : unlocked ? 0.9 : 0.52);
    dg.strokeRoundedRect(cx, cy, cellW, cellH, 6);
    if (built) {
      drawSigil(dg, sigilFor(ROOM_TYPE_SIGILS, slot?.roomType ?? '', 'shield'), cx + cellW / 2, cy + 12, 14, style.accent, { disc: false });
    } else {
      scene.add.text(cx + cellW / 2, cy + 12, String(i + 1), {
        fontFamily: 'sans-serif', fontSize: '11px',
        color: unlocked ? DUNGEON_UI_CSS.TEXT : '#526158', fontStyle: 'bold',
      }).setOrigin(0.5);
    }
    if (built && room) {
      const roomTarget = Math.max(35, Math.round((directive.pressure || defenseTotals.totalPower || 1) / Math.max(1, defenseTotals.builtRooms)));
      const roomRatio = Math.max(0, Math.min(1, room.power / roomTarget));
      dg.fillStyle(DUNGEON_UI.SOOT, 0.92);
      dg.fillRoundedRect(cx + 4, cy + cellH - 5, cellW - 8, 3, 2);
      dg.fillStyle(roomRatio >= 1 ? ACCENT.mint : roomRatio >= 0.7 ? ACCENT.gold : ACCENT.coral, 0.9);
      dg.fillRoundedRect(cx + 4, cy + cellH - 5, Math.max(3, (cellW - 8) * roomRatio), 3, 2);
    }
    if (queueItem) {
      drawDefenseRouteActionRing(scene, cx, cy, cellW, cellH, queueItem.action.accent, queueItem.rank);
      drawDefenseQueuePip(scene, cx + cellW - 10, cy - 4, queueItem.action, queueItem.rank);
    } else if (isActionTarget) {
      drawDefenseRouteActionRing(scene, cx, cy, cellW, cellH, directive.accent, 1);
    }
  }

  const showRoomInfo = (room: DefenseRoomSummary): void => {
    scene.children.getByName('defenseRoomInfoOv')?.destroy();
    scene.children.getByName('defenseRoomInfoDim')?.destroy();

    const dim = scene.add.graphics().setName('defenseRoomInfoDim').setDepth(198);
    dim.fillStyle(0x000000, 0.46);
    dim.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    const ov = scene.add.container(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2)
      .setName('defenseRoomInfoOv').setDepth(200);
    const monsterLines = room.monsterIds.length > 0
      ? room.monsterIds.slice(0, 4).map(id => {
          const owned = getOwnedMonster(gs, id);
          return `${getMonsterDisplayEmoji(id)} ${getMonsterDisplayName(id)}  Lv.${owned?.level ?? 1}`;
        })
      : ['수호자 미배치'];
    const trapLines = room.trapIds.length > 0
      ? room.trapIds.slice(0, 4).map(id => {
          const trap = getTrapDisplay(id);
          return `${trap.emoji} ${trap.name}`;
        })
      : ['함정 미배치'];
    const equipmentLines = room.equipment.length > 0
      ? room.equipment.slice(0, 3).map(equipment => `${equipment.name}  ${equipment.effect}`)
      : ['장비 미장착'];
    const popH = 232 + Math.max(monsterLines.length, trapLines.length) * 16 + Math.min(3, equipmentLines.length) * 14;
    let dismissZone: Phaser.GameObjects.Zone | null = null;
    const dismiss = (): void => {
      ov.destroy();
      dim.destroy();
      dismissZone?.destroy();
    };
    const addModalButton = (
      x: number,
      y: number,
      w: number,
      label: string,
      accent: number,
      onPress: () => void,
    ): void => {
      const h = 44;
      const btnBg = scene.add.graphics();
      const draw = (fillAlpha = 0.94, borderAlpha = 0.76): void => {
        btnBg.clear();
        btnBg.fillStyle(DUNGEON_UI.SOOT, 0.82);
        btnBg.fillRoundedRect(x + 2, y + 3, w, h, 6);
        btnBg.fillStyle(DUNGEON_UI.STONE_RAISED, fillAlpha);
        btnBg.fillRoundedRect(x, y, w, h, 7);
        btnBg.fillStyle(accent, 0.82);
        btnBg.fillRect(x, y + 7, 3, h - 14);
        btnBg.lineStyle(1, accent, borderAlpha);
        btnBg.strokeRoundedRect(x, y, w, h, 7);
      };
      draw();
      ov.add(btnBg);
      const btnText = scene.add.text(x + w / 2, y + h / 2, label, {
        fontFamily: 'Georgia, serif',
        fontSize: '11px',
        color: DUNGEON_UI_CSS.TEXT,
        fontStyle: 'bold',
      }).setOrigin(0.5);
      ov.add(btnText);
      const btnZone = scene.add.zone(x, y, w, h).setOrigin(0).setInteractive({ useHandCursor: true });
      btnZone.on('pointerover', () => draw(1, 0.96));
      btnZone.on('pointerout', () => draw());
      btnZone.once('pointerdown', () => {
        scene.tweens.add({
          targets: [btnBg, btnText],
          alpha: 0.72,
          duration: 60,
          yoyo: true,
          onComplete: onPress,
        });
      });
      ov.add(btnZone);
    };
    const ovBg = scene.add.graphics();
    ovBg.fillStyle(DUNGEON_UI.STONE, 0.98);
    ovBg.fillRoundedRect(-142, -popH / 2, 284, popH, 8);
    ovBg.lineStyle(1.5, room.style.accent, 0.86);
    ovBg.strokeRoundedRect(-142, -popH / 2, 284, popH, 8);
    ovBg.fillStyle(DUNGEON_UI.SOOT, 0.72);
    ovBg.fillRoundedRect(-128, -popH / 2 + 12, 256, 34, 6);
    ov.add(ovBg);

    ov.add(scene.add.text(0, -popH / 2 + 29, `#${room.index + 1} ${room.typeName}`, {
      fontFamily: 'sans-serif', fontSize: '14px', color: DUNGEON_UI_CSS.PARCHMENT, fontStyle: 'bold',
    }).setOrigin(0.5));
    ov.add(scene.add.text(0, -popH / 2 + 58, `Lv.${room.slot.roomLevel}  HP ${room.slot.hp}/${room.slot.maxHp}  DEF ${room.power}`, {
      fontFamily: 'monospace', fontSize: '10px', color: room.style.text,
    }).setOrigin(0.5));

    ov.add(scene.add.text(0, -popH / 2 + 73, `장비 ${room.equipment.length}/${room.monsterIds.length}  DEF +${room.equipmentPower}`, {
      fontFamily: 'monospace',
      fontSize: '10px',
      color: room.equipment.length > 0 ? CASUAL_CSS.GOLD : CASUAL_CSS.INK_SOFT,
    }).setOrigin(0.5));

    ov.add(scene.add.text(-118, -popH / 2 + 96, `수호자 ${room.monsterIds.length}/${room.capacity.monsters}`, {
      fontFamily: 'sans-serif', fontSize: '11px', color: CASUAL_CSS.GOLD, fontStyle: 'bold',
    }));
    ov.add(scene.add.text(18, -popH / 2 + 96, `함정 ${room.trapIds.length}/${room.capacity.traps}`, {
      fontFamily: 'sans-serif', fontSize: '11px', color: CASUAL_CSS.GREEN, fontStyle: 'bold',
    }));
    monsterLines.forEach((line, i) => {
      ov.add(scene.add.text(-118, -popH / 2 + 116 + i * 16, line, {
        fontFamily: 'sans-serif', fontSize: '11px', color: CASUAL_CSS.INK,
      }));
    });
    trapLines.forEach((line, i) => {
      ov.add(scene.add.text(18, -popH / 2 + 116 + i * 16, line, {
        fontFamily: 'sans-serif', fontSize: '11px', color: CASUAL_CSS.GREEN,
      }));
    });

    const equipmentY = -popH / 2 + 128 + Math.max(monsterLines.length, trapLines.length) * 16;
    ov.add(scene.add.text(-118, equipmentY, '장비 효과', {
      fontFamily: 'sans-serif',
      fontSize: '11px',
      color: CASUAL_CSS.GOLD,
      fontStyle: 'bold',
    }));
    equipmentLines.forEach((line, i) => {
      ov.add(scene.add.text(-118, equipmentY + 16 + i * 14, line, {
        fontFamily: 'sans-serif',
        fontSize: '11px',
        color: room.equipment.length > 0 ? CASUAL_CSS.GOLD : CASUAL_CSS.INK_SOFT,
      }));
    });

    addModalButton(-118, popH / 2 - 52, 112, '방 편집', room.style.accent, () => {
      dismiss();
      onReturnToDungeonRoom(room.index);
    });
    addModalButton(8, popH / 2 - 52, 110, '닫기', CASUAL.EDGE, dismiss);

    scene.tweens.add({ targets: ov, alpha: { from: 0, to: 1 }, duration: 180 });

    dismissZone = scene.add.zone(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)
      .setOrigin(0).setInteractive().setDepth(199);
    scene.time.delayedCall(80, () => {
      dismissZone?.once('pointerdown', dismiss);
    });
  };

  for (let i = 0; i < 9; i++) {
    const queueItem = actionBySlot.get(i);
    const unlocked = i < defenseTotals.unlockedSlots;
    const room = roomByIndex.get(i);
    if (!unlocked) continue;
    const cx = railX + i * (cellW + cellGap);
    const cy = railY + RAIL_NODE_TOP;
    const routeHitZone = scene.add.zone(cx - 8, cy - 8, cellW + 16, cellH + 16)
      .setOrigin(0)
      .setInteractive({ useHandCursor: true });
    routeHitZone.on('pointerdown', () => {
      if (queueItem || !room) {
        onReturnToDungeonRoom(i);
        return;
      }
      showRoomInfo(room);
    });
  }

  const cardW = 166, cardH = 64, cardGap = 10;
  const cardsY = dY + 206 + directiveExtraH;
  const emptyEntries = Array.from({ length: defenseTotals.unlockedSlots }, (_, index) => index)
    .filter(index => !roomByIndex.has(index));
  const cardEntries = [
    ...defenseRooms.map(room => ({ index: room.index, room })),
    ...emptyEntries.map(index => ({ index, room: undefined })),
  ].slice(0, 4);

  cardEntries.forEach(({ index, room }, pos) => {
    const cx = 24 + (pos % 2) * (cardW + cardGap);
    const cy = cardsY + Math.floor(pos / 2) * (cardH + 6);
    const queueItem = actionBySlot.get(index);
    const isActionTarget = directive.actionSlotIdx === index && Boolean(directive.actionLabel);

    if (!room) {
      const slotAccent = isActionTarget ? directive.accent : DUNGEON_UI.EDGE;
      dg.fillStyle(DUNGEON_UI.STONE_RAISED, 1);
      dg.fillRoundedRect(cx, cy, cardW, cardH, 8);
      dg.fillStyle(slotAccent, 0.66);
      dg.fillRect(cx, cy + 7, 3, cardH - 14);
      dg.fillStyle(DUNGEON_UI.SOOT, 1);
      dg.fillRoundedRect(cx + 6, cy + 8, 30, cardH - 16, 6);
      dg.lineStyle(1, DUNGEON_UI.IRON, 0.86);
      dg.strokeRoundedRect(cx + 6, cy + 8, 30, cardH - 16, 6);
      dg.lineStyle(isActionTarget ? 2 : 1, slotAccent, isActionTarget ? 1 : 0.74);
      dg.strokeRoundedRect(cx, cy, cardW, cardH, 8);
      scene.add.text(cx + 21, cy + 32, '+', {
        fontFamily: 'sans-serif', fontSize: '22px', color: DUNGEON_UI_CSS.BRASS, fontStyle: 'bold',
      }).setOrigin(0.5);
      scene.add.text(cx + 42, cy + 15, `#${index + 1} 미설계`, {
        fontFamily: 'sans-serif', fontSize: '11px', color: DUNGEON_UI_CSS.TEXT, fontStyle: 'bold',
      }).setOrigin(0, 0.5);
      scene.add.text(cx + 42, cy + 30, '타입 미정', {
        fontFamily: 'sans-serif', fontSize: '11px', color: DUNGEON_UI_CSS.MUTED, fontStyle: 'bold',
      }).setOrigin(0, 0.5);
      scene.add.text(cx + 42, cy + 45, 'M -/- · T -/-', {
        fontFamily: 'monospace', fontSize: '10px', color: DUNGEON_UI_CSS.MUTED,
      }).setOrigin(0, 0.5);
      dg.fillStyle(DUNGEON_UI.BRASS, 1);
      dg.fillRoundedRect(cx + cardW - 54, cy + 22, 44, 17, 6);
      dg.lineStyle(1, DUNGEON_UI.BRASS_BRIGHT, 0.9);
      dg.strokeRoundedRect(cx + cardW - 54, cy + 22, 44, 17, 6);
      scene.add.text(cx + cardW - 32, cy + 30.5, '바로 설계', {
        fontFamily: 'sans-serif', fontSize: '11px', color: '#120e08', fontStyle: 'bold',
      }).setOrigin(0.5);
      const emptyHitZone = scene.add.zone(cx, cy, cardW, cardH)
        .setOrigin(0).setInteractive({ useHandCursor: true });
      emptyHitZone.on('pointerdown', () => onReturnToDungeonRoom(index));
      if (isActionTarget) {
        drawDefenseActionTargetBadge(scene, cx, cy, cardW, cardH, directive, queueItem
          ? `${queueItem.rank} ${getDefenseQueueBadgeLabel(queueItem.action)}`
          : undefined);
      } else if (queueItem) {
        drawDefenseQueueBadge(scene, cx + cardW - 8, cy + 5, queueItem.action, queueItem.rank);
      }
      return;
    }

    const roomTarget = Math.max(35, Math.round((directive.pressure || defenseTotals.totalPower || 1) / Math.max(1, defenseTotals.builtRooms)));
    const cardRatio = Math.max(0, Math.min(1, room.power / roomTarget));

    dg.fillStyle(room.style.bg, 1);
    dg.fillRoundedRect(cx, cy, cardW, cardH, 6);
    drawDefenseRoomCardShell(
      dg,
      cx,
      cy,
      cardW,
      cardH,
      isActionTarget ? directive.accent : room.style.accent,
      cardRatio,
      isActionTarget || Boolean(queueItem),
    );
    dg.fillStyle(DUNGEON_UI.SOOT, 0.82);
    dg.fillRoundedRect(cx + 6, cy + 9, 31, cardH - 18, 6);
    dg.fillStyle(0xffffff, 0.06);
    dg.fillRoundedRect(cx + 42, cy + 10, cardW - 94, 12, 4);
    dg.fillStyle(room.style.accent, 0.1);
    dg.fillRoundedRect(cx + 42, cy + cardH - 14, cardW - 96, 5, 3);
    dg.lineStyle(1.2, room.style.accent, 0.62);
    dg.strokeRoundedRect(cx, cy, cardW, cardH, 6);
    dg.fillStyle(room.style.accent, 0.72);
    dg.fillRoundedRect(cx + 7, cy + 5, cardW - 14, 3, 2);

    const primaryMonsterId = room.monsterIds[0];
    if (primaryMonsterId) {
      addMonsterPortrait(scene, null, cx + 21, cy + 33, primaryMonsterId, {
        size: 30,
        frameColor: room.style.accent,
        glowColor: room.style.accent,
      bgColor: DUNGEON_UI.SOOT,
        equippedSkins: gs.equippedSkins,
      });
    } else {
      drawSigil(dg, sigilFor(ROOM_TYPE_SIGILS, room.slot.roomType ?? '', 'shield'), cx + 21, cy + 33, 26, room.style.accent);
    }

    scene.add.text(cx + 42, cy + 15, `#${room.index + 1} ${shortenLabel(room.typeName, 6)}`, {
      fontFamily: 'Georgia, serif', fontSize: '11px', color: CASUAL_CSS.INK, fontStyle: 'bold',
    }).setOrigin(0, 0.5);
    scene.add.text(cx + 42, cy + 30, `Lv.${room.slot.roomLevel}  HP ${room.slot.hp}/${room.slot.maxHp}`, {
      fontFamily: 'monospace', fontSize: '10px', color: room.style.text,
    }).setOrigin(0, 0.5);
    const trap = room.trapIds[0] ? getTrapDisplay(room.trapIds[0]) : null;
    // The trap badge sat where the action pin ("1 배치") is drawn; the stats line carries it.
    scene.add.text(cx + 42, cy + 45, `M${room.monsterIds.length}/${room.capacity.monsters} E${room.equipment.length} T${room.trapIds.length}/${room.capacity.traps}${trap ? ` ${trap.emoji}` : ''}`, {
      fontFamily: 'monospace', fontSize: '10px', color: CASUAL_CSS.BLUE,
    }).setOrigin(0, 0.5);

    if (room.equipment.length > 0) {
      dg.fillStyle(ACCENT.gold, 0.2);
      dg.fillRoundedRect(cx + 7, cy + cardH - 16, 30, 11, 4);
      dg.lineStyle(1, ACCENT.gold, 0.5);
      dg.strokeRoundedRect(cx + 7, cy + cardH - 16, 30, 11, 4);
      scene.add.text(cx + 22, cy + cardH - 10.5, `⚙${room.equipment.length}`, {
        fontFamily: 'Georgia, serif',
        fontSize: '10px',
        color: CASUAL_CSS.GOLD,
        fontStyle: 'bold',
      }).setOrigin(0.5);
    }

    dg.fillStyle(room.style.accent, 0.18);
    dg.fillRoundedRect(cx + cardW - 52, cy + 40, 42, 15, 4);
    scene.add.text(cx + cardW - 31, cy + 47.5, `DEF ${room.power}`, {
      fontFamily: 'monospace', fontSize: '10px', color: room.style.text, fontStyle: 'bold',
    }).setOrigin(0.5);

    dg.fillStyle(DUNGEON_UI.SOOT, 0.92);
    dg.fillRoundedRect(cx + 42, cy + cardH - 8, cardW - 98, 4, 2);
    dg.fillStyle(cardRatio >= 1 ? ACCENT.mint : cardRatio >= 0.7 ? ACCENT.gold : ACCENT.coral, 0.95);
    dg.fillRoundedRect(cx + 42, cy + cardH - 8, Math.max(4, (cardW - 98) * cardRatio), 4, 2);

    if (isActionTarget) {
      drawDefenseActionTargetBadge(scene, cx, cy, cardW, cardH, directive, queueItem
        ? `${queueItem.rank} ${getDefenseQueueBadgeLabel(queueItem.action)}`
        : undefined);
    } else if (queueItem) {
      drawDefenseQueueBadge(scene, cx + cardW - 8, cy + 5, queueItem.action, queueItem.rank);
    }

    const hitZone = scene.add.zone(cx, cy, cardW, cardH)
      .setOrigin(0).setInteractive({ useHandCursor: true });
    hitZone.on('pointerdown', () => {
      if (queueItem) {
        onReturnToDungeonRoom(index);
        return;
      }
      showRoomInfo(room);
    });
  });

  return { defenseRooms, defenseTotals, directive, dY, dH };
}
