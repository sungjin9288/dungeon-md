/**
 * RoomVisuals.ts — free-function visual helpers extracted from Room.ts.
 *
 * All functions accept a `Room` instance as their first parameter and operate
 * on its (now @internal) fields.  Public method names on `Room` are unchanged;
 * the class methods are thin delegators that call these functions.
 *
 * Import the Room TYPE only (no runtime cycle):
 */
import type { Room } from './Room';
import { CASUAL, CASUAL_CSS } from '../constants/colors';
import { ROOM_DEFS } from '../data/rooms';
import { drawPixelRoom } from '../art/PixelRoom';
import { generateMonsterSprite, generateRoomToken } from '../art/PortraitGenerator';
import { resolveOwnedMonsterProfile } from '../data/monsters';
import type { RoomLoadoutVisualOptions } from './Room';
import { getReducedMotion } from '../utils/reducedMotion';
import { drawSigil } from '../ui/Sigils';
import { ROOM_TYPE_SIGILS, sigilFor } from '../ui/sigilMaps';

// ─── drawStone ───────────────────────────────────────────────────────────────

/**
 * Map a concrete combat RoomType to the abstract pixel-room fixture category.
 * Duplicated here (also lives in Room.ts) so RoomVisuals has no runtime import
 * from Room.  Both copies must stay in sync if types change.
 */
const ROOM_TYPE_TO_FIXTURE_VIS: Record<string, 'combat' | 'trap' | 'support' | 'magic'> = {
  guardian:         'combat',
  tower:            'combat',
  armory:           'combat',
  trap:             'trap',
  trap_corridor:    'trap',
  gold:             'support',
  medicine_hall:    'support',
  spirit_altar:     'support',
  scroll_library:   'magic',
  dragons_lair:     'magic',
  celestial_shrine: 'magic',
  void_forge:       'magic',
  grand_vault:      'support',
  elite_den:        'magic',
};

export function drawStoneVisual(room: Room): void {
  const g = room.bg;
  const s = room.cs;
  const inset = 7;
  g.clear();
  if (room.state === 'water') return;

  const occupied = room.state === 'occupied' && !!room.roomData;
  const accent = occupied && room.roomData
    ? ROOM_DEFS[room.roomData.type].accentColor
    : CASUAL.GOLD;
  const radius = 12;
  const cw  = s - inset * 2;
  const cx0 = -s / 2 + inset;
  const cy0 = -s / 2 + inset;

  g.fillStyle(CASUAL.SHADOW, 0.3);
  g.fillRoundedRect(cx0 + 1, cy0 + 3, cw, cw, radius);

  g.fillStyle(CASUAL.PANEL, 1);
  g.fillRoundedRect(cx0, cy0, cw, cw, radius);

  const fixture  = occupied && room.roomData
    ? ROOM_TYPE_TO_FIXTURE_VIS[room.roomData.type]
    : undefined;
  const readiness = occupied ? 74 : 26;
  drawPixelRoom(g, cx0, cy0, fixture, accent, readiness, cw);

  if (room.state === 'locked') {
    g.fillStyle(CASUAL.SHADOW, 0.5);
    g.fillRoundedRect(cx0, cy0, cw, cw, radius);
  }

  const borderColor = occupied ? accent : CASUAL.EDGE;
  g.lineStyle(2.5, borderColor, room.state === 'locked' ? 0.5 : 1);
  g.strokeRoundedRect(cx0, cy0, cw, cw, radius);
}

// ─── drawLevelBadge ──────────────────────────────────────────────────────────

export function drawLevelBadgeVisual(room: Room): void {
  const g = room.levelBadge;
  if (!g) return;
  g.clear();
  if (!room.roomData || room.roomData.level <= 1) return;
  const bx = room.cs / 2 - 14;
  const by = -room.cs / 2 + 6;
  const r  = 8;
  const col = room.roomData.level >= 3 ? CASUAL.GOLD : CASUAL.EDGE_SOFT;
  g.fillStyle(CASUAL.SHADOW, 0.4); g.fillCircle(bx + 1, by + 1, r);
  g.fillStyle(col, 1);             g.fillCircle(bx, by, r);
  g.lineStyle(2, CASUAL.EDGE, 0.9); g.strokeCircle(bx, by, r);
  g.lineStyle(1, 0xffffff, 0.4);   g.strokeCircle(bx, by - 0.5, r - 1.5);
}

// ─── drawRoomHpBar ───────────────────────────────────────────────────────────

export function drawRoomHpBarVisual(room: Room): void {
  const g = room.roomHpBar;
  if (!g) return;
  g.clear();
  const s    = room.cs;
  const bw   = s - 16;
  const bh   = 4;
  const bx   = -bw / 2;
  const by   = s / 2 - 8;
  const pct  = room.roomHpMax > 0 ? room.roomHpValue / room.roomHpMax : 1;
  g.fillStyle(CASUAL.EDGE, 1);
  g.fillRoundedRect(bx - 1.5, by - 1.5, bw + 3, bh + 3, 3);
  g.fillStyle(CASUAL.PANEL_SOFT, 1);
  g.fillRoundedRect(bx, by, bw, bh, 2);
  const col = pct > 0.6 ? CASUAL.GREEN : pct > 0.3 ? CASUAL.GOLD : CASUAL.RED;
  g.fillStyle(col, 1);
  g.fillRoundedRect(bx, by, Math.max(0, Math.round(bw * pct)), bh, 2);
  g.setAlpha(pct < 1 ? 1 : 0);

  if (pct <= 0.3 && pct > 0 && !room.hpCriticalTween) {
    room.hpCriticalTween = room.scene.tweens.add({
      targets: g,
      alpha: { from: 1, to: 0.25 },
      duration: 350, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    });
  } else if ((pct > 0.3 || pct <= 0) && room.hpCriticalTween) {
    room.hpCriticalTween.stop();
    room.hpCriticalTween = undefined;
    g.setAlpha(pct < 1 ? 1 : 0);
  }
}

// ─── _flashDamage ────────────────────────────────────────────────────────────

export function flashDamageVisual(room: Room): void {
  if (!room.damageFlash) {
    room.damageFlash = room.scene.add.graphics();
    room.add(room.damageFlash);
  }
  const s = room.cs;
  const inset = 7;
  room.damageFlash.clear();
  room.damageFlash.fillStyle(CASUAL.RED, 0.55);
  room.damageFlash.fillRoundedRect(-s / 2 + inset, -s / 2 + inset, s - inset * 2, s - inset * 2, 12);
  room.damageFlash.setDepth(room.depth + 4).setAlpha(1);
  room.scene.tweens.add({
    targets: room.damageFlash,
    alpha: 0,
    duration: 280,
    ease: 'Power2.easeOut',
  });
}

// ─── collapseRoom ────────────────────────────────────────────────────────────

export function collapseRoomVisual(room: Room): void {
  room.isDestroyed = true;
  const s = room.cs;

  const rubble = room.scene.add.graphics().setDepth(room.depth + 3);
  const inset = 7;
  rubble.fillStyle(CASUAL.EDGE_SOFT, 0.8);
  rubble.fillRoundedRect(-s / 2 + inset, -s / 2 + inset, s - inset * 2, s - inset * 2, 12);
  rubble.lineStyle(2, CASUAL.RED_DK, 0.9);
  rubble.lineBetween(-s / 2 + 10, -s / 2 + 6,  0,  8);
  rubble.lineBetween(0,  8,  s / 2 - 8,  -s / 2 + 14);
  rubble.lineBetween(0,  8,  -6,  s / 2 - 10);
  rubble.lineBetween(-6, s / 2 - 10,  s / 2 - 12,  s / 2 - 5);
  rubble.lineStyle(2.5, CASUAL.RED, 0.7);
  rubble.strokeRoundedRect(-s / 2 + inset, -s / 2 + inset, s - inset * 2, s - inset * 2, 12);
  room.add(rubble);

  const spawnSmoke = () => {
    if (!room.active) return;
    for (let i = 0; i < 3; i++) {
      const sx = room.x + (Math.random() - 0.5) * (s * 0.6);
      const sy = room.y + (Math.random() - 0.5) * (s * 0.3);
      const smoke = room.scene.add.graphics().setDepth(room.depth + 10);
      const r = 3 + Math.random() * 4;
      smoke.fillStyle(CASUAL.PANEL_SOFT, 0.7);
      smoke.fillCircle(0, 0, r);
      smoke.setPosition(sx, sy);
      room.scene.tweens.add({
        targets: smoke,
        y: sy - 30 - Math.random() * 20,
        alpha: 0,
        scaleX: 1.8, scaleY: 1.8,
        duration: 700 + Math.random() * 500,
        ease: 'Quad.easeOut',
        onComplete: () => smoke.destroy(),
      });
    }
  };
  spawnSmoke();
  room.scene.time.delayedCall(300, spawnSmoke);
  room.scene.time.delayedCall(700, spawnSmoke);

  room.scene.tweens.add({
    targets: room, x: room.x - 4, y: room.y - 4,
    duration: 50, yoyo: true, repeat: 3,
    onComplete: () => { room.scene.events.emit('roomDestroyed', room.row, room.col); },
  });
}

// ─── clearDungeonSlotLoadoutVisual ───────────────────────────────────────────

export function clearSlotLoadoutVisual(room: Room): void {
  room.slotLoadoutTween?.stop();
  room.slotLoadoutTween = undefined;
  room.slotLoadoutSprite?.destroy();
  room.slotLoadoutSprite = undefined;
  room.slotLoadoutGfx?.destroy();
  room.slotLoadoutGfx = undefined;
  room.slotLoadoutLabels.forEach(label => label.destroy());
  room.slotLoadoutLabels = [];
  room.baseRoomIcon?.setVisible(true);
  room.baseRoomNameLabel?.setVisible(true);
  room.roomTypeBadge?.setVisible(true);
}

// ─── setDungeonSlotLoadoutVisual ─────────────────────────────────────────────

export function setSlotLoadoutVisual(room: Room, options: RoomLoadoutVisualOptions): void {
  clearSlotLoadoutVisual(room);
  if (room.state !== 'occupied') return;
  room.baseRoomIcon?.setVisible(false);
  room.baseRoomNameLabel?.setVisible(false);
  room.roomTypeBadge?.setVisible(false);

  const s = room.cs;
  const accent = options.accentColor;
  const g = room.scene.add.graphics();
  room.slotLoadoutGfx = g;
  room.add(g);

  const inset = 7;
  const cw  = s - inset * 2;
  const cx0 = -s / 2 + inset;
  const cy0 = -s / 2 + inset;
  const floorY  = s / 2 - 26;
  const centerY = -2;

  g.fillStyle(CASUAL.PANEL, 1);
  g.fillRoundedRect(cx0, cy0, cw, cw, 12);
  drawPixelRoom(g, cx0, cy0, options.slotRoomType, accent, 78, cw);

  const hasGuardian = options.monsterCount > 0;
  g.fillStyle(CASUAL.SHADOW, 0.4);
  g.fillEllipse(0, floorY + 5, 38, 9);
  g.fillStyle(hasGuardian ? accent : CASUAL.SHADOW, hasGuardian ? 0.28 : 0.18);
  g.fillEllipse(0, floorY + 3, 30, 6);

  if (options.equipmentCount > 0) {
    g.lineStyle(2, CASUAL.GOLD, 0.55);
    g.strokeCircle(0, centerY + 3, 18);
    g.lineStyle(1, CASUAL.GOLD, 0.32);
    g.strokeCircle(0, centerY + 3, 22);
    g.fillStyle(CASUAL.GOLD_DK, 0.85);
    g.fillCircle(-19, centerY - 6, 1.8);
    g.fillCircle(19, centerY + 7, 1.6);
    g.fillCircle(8, centerY - 17, 1.5);
  }

  const trapFixtures = Math.min(4, options.trapCount);
  for (let i = 0; i < trapFixtures; i++) {
    const fixtureX = cx0 + 12 + i * ((cw - 24) / Math.max(1, trapFixtures - 1));
    g.fillStyle(CASUAL.GREEN, 0.28);
    g.fillCircle(fixtureX, floorY + 2, 5);
    g.fillStyle(CASUAL.GREEN, 0.95);
    g.fillTriangle(fixtureX - 4, floorY + 5, fixtureX, floorY - 6, fixtureX + 4, floorY + 5);
    g.lineStyle(1, CASUAL.GREEN_DK, 0.55);
    g.lineBetween(fixtureX - 5, floorY + 5, fixtureX + 5, floorY + 5);
  }

  g.lineStyle(2, accent, 0.5);
  g.strokeRoundedRect(-s / 2 + 5, -s / 2 + 5, s - 10, s - 10, 11);
  g.fillStyle(accent, 0.85);
  g.fillRoundedRect(-s / 2 + 17, -s / 2 + 8, s - 34, 14, 5);
  g.fillStyle(0xffffff, 0.3);
  g.fillRoundedRect(-s / 2 + 20, -s / 2 + 9, s - 40, 5, 3);

  // Family sigil + name, centred as one group. The emoji prefix drew at its own
  // size and covered part of the 10px name on the ribbon.
  const title = room.scene.add.text(0, -s / 2 + 15, options.roomTypeName, {
    fontFamily: 'Georgia, serif',
    fontSize: '10px',
    color: CASUAL_CSS.WHITE,
    fontStyle: 'bold',
  }).setOrigin(0.5);
  if (options.slotRoomType) {
    const sigilSize = 10;
    const groupW = sigilSize + 3 + title.width;
    title.setX(-groupW / 2 + sigilSize + 3 + title.width / 2);
    drawSigil(g, sigilFor(ROOM_TYPE_SIGILS, options.slotRoomType, 'shield'), -groupW / 2 + sigilSize / 2, -s / 2 + 15, sigilSize, 0xffffff, { disc: false });
  }
  room.slotLoadoutLabels.push(title);
  room.add(title);

  const monsterProfile = options.primaryMonsterId
    ? resolveOwnedMonsterProfile(options.primaryMonsterId)
    : null;
  const spriteId = monsterProfile?.registryId ?? null;
  if (hasGuardian && spriteId) {
    // Illustrated guardians (AI portrait loaded) stand as a framed medallion;
    // monsters without art fall back to the procedural pixel body sprite.
    const tokenKey = generateRoomToken(room.scene, spriteId);
    const sprite = tokenKey
      ? room.scene.add.image(0, centerY, tokenKey).setOrigin(0.5).setDisplaySize(46, 46)
      : room.scene.add.image(0, centerY, generateMonsterSprite(room.scene, spriteId))
          .setOrigin(0.5).setDisplaySize(60, 60);
    room.slotLoadoutSprite = sprite;
    room.add(sprite);
    // Idle bob is decorative — under reduced motion the guardian stands still.
    if (!getReducedMotion()) {
      room.slotLoadoutTween = room.scene.tweens.add({
        targets: sprite,
        y: centerY - 4,
        duration: 1300 + (room.row * 3 + room.col) % 4 * 130,
        yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
      });
    }
  } else {
    const guardianGlyph = monsterProfile?.emoji ?? options.primaryMonsterEmoji ?? (hasGuardian ? '👾' : '◇');
    const guardian = room.scene.add.text(0, centerY + (hasGuardian ? -1 : 0), guardianGlyph, {
      fontFamily: 'Apple Color Emoji, Segoe UI Emoji, sans-serif',
      fontSize: hasGuardian ? '22px' : '15px',
      color: hasGuardian ? CASUAL_CSS.WHITE : CASUAL_CSS.INK_SOFT,
      stroke: hasGuardian ? '#4a3016' : '#8a6238',
      strokeThickness: hasGuardian ? 3 : 1,
    }).setOrigin(0.5);
    room.slotLoadoutLabels.push(guardian);
    room.add(guardian);
  }

  if (options.monsterCount > 1) {
    g.fillStyle(CASUAL.RED, 0.95);
    g.fillRoundedRect(9, centerY - 18, 22, 15, 4);
    g.lineStyle(1, CASUAL.RED_DK, 0.6);
    g.strokeRoundedRect(9, centerY - 18, 22, 15, 4);
    const count = room.scene.add.text(20, centerY - 10.5, `x${options.monsterCount}`, {
      fontFamily: 'Georgia, serif',
      fontSize: '10px',
      color: CASUAL_CSS.WHITE,
      fontStyle: 'bold',
    }).setOrigin(0.5);
    room.slotLoadoutLabels.push(count);
    room.add(count);
  }

  const stripY = s / 2 - 26;
  g.fillStyle(CASUAL.PANEL_SOFT, 1);
  g.fillRoundedRect(-s / 2 + 11, stripY, s - 22, 14, 5);
  g.lineStyle(1.5, CASUAL.EDGE, 0.85);
  g.strokeRoundedRect(-s / 2 + 11, stripY, s - 22, 14, 5);

  if (options.equipmentCount > 0) {
    g.fillStyle(CASUAL.GOLD, 0.35);
    g.fillRoundedRect(-s / 2 + 12, stripY - 18, 32, 15, 4);
    g.lineStyle(1, CASUAL.GOLD_DK, 0.7);
    g.strokeRoundedRect(-s / 2 + 12, stripY - 18, 32, 15, 4);
    const equipment = room.scene.add.text(-s / 2 + 28, stripY - 10.5, `⚙${options.equipmentCount}`, {
      fontFamily: 'Georgia, serif',
      fontSize: '10px',
      color: CASUAL_CSS.GOLD,
      fontStyle: 'bold',
    }).setOrigin(0.5);
    room.slotLoadoutLabels.push(equipment);
    room.add(equipment);
  }

  const loadoutLabel = options.equipmentCount > 0
    ? `수호${options.monsterCount}/${options.monsterCapacity} 장비${options.equipmentCount} 함정${options.trapCount}/${options.trapCapacity}`
    : `수호 ${options.monsterCount}/${options.monsterCapacity} · 함정 ${options.trapCount}/${options.trapCapacity}`;
  const loadout = room.scene.add.text(0, stripY + 7, loadoutLabel, {
    fontFamily: 'sans-serif',
    fontSize: '10px',
    color: CASUAL_CSS.INK,
    fontStyle: 'bold',
  }).setOrigin(0.5);
  room.slotLoadoutLabels.push(loadout);
  room.add(loadout);
}
