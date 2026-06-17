/**
 * HomeCommandDeck — extracted private-method bodies from DungeonHomeScene.
 *
 * These were all PRIVATE methods; only DungeonHomeScene calls them (via
 * one-line delegators that keep the original `this.<name>(...)` call sites).
 * Import the DungeonHomeScene TYPE only to avoid a runtime circular dependency.
 */
import type { DungeonHomeScene } from './DungeonHomeScene';
import Phaser from 'phaser';
import { CANVAS_WIDTH } from '../constants/layout';
import { CASUAL, CASUAL_CSS } from '../constants/colors';
import {
  getUnlockedSlots,
  getRoomSlotCapacity,
  type DungeonSlot,
  type OwnedMonster,
} from '../data/wisdom';
import { calculateDungeonMetrics, calculateRoomMetrics } from '../data/dungeonMetrics';
import { getReadinessDirectiveCopy } from '../data/readinessDirectives';
import {
  getDungeonActionQueue,
  getRoomActionRecommendation,
} from '../data/roomActionRecommendations';
import { MONSTER_DEFS } from '../data/monsters';
import { audioManager } from '../audio/AudioManager';
import { addFramedPanel, addPrimaryActionButton } from '../ui/GameUiPrimitives';
import { goToPreBattle } from '../ui/InvasionUI';


// ─── Layout constants (must match DungeonHomeScene.ts) ──────────────────────

const BOT_H = 64;
const CANVAS_HEIGHT_LOCAL = 844;
const BOT_Y = CANVAS_HEIGHT_LOCAL - BOT_H;

// ─── Types local to this cluster ────────────────────────────────────────────

interface HomeDirective {
  readonly icon: string;
  readonly title: string;
  readonly body: string;
  readonly ctaLabel: string;
  readonly statLabel: string;
  readonly statValue: string;
  readonly accent: number;
  readonly onPress: () => void;
}

interface HomeFocusTarget {
  readonly monsterId: string;
  readonly sourceLabel: string;
  readonly slotIdx: number | null;
}

// ─── buildCommandDeck ────────────────────────────────────────────────────────

export function buildCommandDeck(scene: DungeonHomeScene): void {
  if (scene.commandDeckContainer) {
    scene.commandDeckContainer.destroy();
    scene.commandDeckContainer = null;
  }
  const deckX = 12;
  const minDeckY = scene.boardLayout.contentBottomY + 8;
  const deckW = CANVAS_WIDTH - deckX * 2;
  const statsTopY = BOT_Y - 26;
  const availableDeckH = statsTopY - minDeckY - 10;
  // Phase C: slim deck — target ~155px, was 218
  const deckH = Math.min(160, availableDeckH);
  const deckY = Math.max(minDeckY, statsTopY - deckH - 10);
  if (deckH < 140) return;
  const deck = scene.add.container(0, 0).setDepth(4);
  scene.commandDeckContainer = deck;

  const unlockedSlots = getUnlockedSlots(scene.gs.dmLevel);
  const visibleSlots = (scene.gs.dungeonSlots ?? []).slice(0, unlockedSlots);
  const builtRooms = visibleSlots.filter(slot => !!slot?.roomType).length;
  const ownedMonsters = scene.gs.ownedMonsters ?? [];
  const skillReady = ownedMonsters.filter(m => (m.skillPoints ?? 0) > 0).length;
  const collectionSummary = getMonsterCollectionSummary(ownedMonsters);
  const dungeonMetrics = calculateDungeonMetrics(scene.gs, unlockedSlots);
  // Keep getDungeonActionQueue for board rank markers; not rendered in deck.
  const _actionQueue = getDungeonActionQueue(scene.gs, unlockedSlots);
  const directive = getHomeDirective(
    scene,
    unlockedSlots,
    visibleSlots,
    dungeonMetrics.readiness,
    skillReady,
  );
  const frame = addFramedPanel(scene, {
    x: deckX,
    y: deckY,
    w: deckW,
    h: deckH,
    radius: 16,
    fillColor: CASUAL.PANEL,
    borderColor: CASUAL.EDGE,
    borderAlpha: 1,
    borderWidth: 3,
    accentColor: CASUAL.EDGE_SOFT,
    accentAlpha: 0.5,
    glowColor: CASUAL.EDGE_SOFT,
    glowOpacity: 0.06,
    shadowOpacity: 0.4,
    shadowOffsetY: 4,
  });
  deck.add([frame.shadow, frame.panel, frame.glow]);

  const g = scene.add.graphics();
  deck.add(g);

  // ── Header strip (deckY+8 … +28) ──────────────────────────────────────────
  g.fillStyle(CASUAL.PANEL_SOFT, 1);
  g.fillRoundedRect(deckX + 8, deckY + 8, deckW - 16, 26, 10);
  g.fillStyle(CASUAL.GOLD, 0.14);
  g.fillRoundedRect(deckX + 8, deckY + 8, deckW - 16, 26, 10);

  deck.add(scene.add.text(deckX + 16, deckY + 21, '던전 운영실', {
    fontFamily: 'sans-serif',
    fontSize: '13px',
    color: CASUAL_CSS.INK,
    fontStyle: 'bold',
  }).setOrigin(0, 0.5));

  // Compact 도감 pill (right of header) — replaces full chip
  drawHomeCollectionPill(scene, deck, g, deckX + deckW - 92, deckY + 11, 80, 18, collectionSummary);

  // ── Readiness inline line (deckY+36 … +54) ────────────────────────────────
  const readinessColor = dungeonMetrics.readiness >= 80
    ? CASUAL.GREEN : dungeonMetrics.readiness >= 55 ? CASUAL.GOLD : CASUAL.RED;
  const readinessCss = dungeonMetrics.readiness >= 80
    ? CASUAL_CSS.GREEN : dungeonMetrics.readiness >= 55 ? CASUAL_CSS.GOLD : CASUAL_CSS.RED;
  const readinessPct = Phaser.Math.Clamp(dungeonMetrics.readiness / 100, 0, 1);

  const barLineY = deckY + 37;
  const barLineX = deckX + 14;
  const barLineW = deckW - 28;
  g.fillStyle(CASUAL.PANEL_SOFT, 1);
  g.fillRoundedRect(barLineX, barLineY, barLineW, 14, 5);
  g.lineStyle(1, CASUAL.EDGE_SOFT, 0.4);
  g.strokeRoundedRect(barLineX, barLineY, barLineW, 14, 5);
  const fillW = Math.max(8, barLineW * readinessPct);
  g.fillStyle(readinessColor, 0.28);
  g.fillRoundedRect(barLineX, barLineY, fillW, 14, 5);

  deck.add(scene.add.text(barLineX + 6, barLineY + 7, '운영도', {
    fontFamily: 'sans-serif',
    fontSize: '8px',
    color: CASUAL_CSS.INK_SOFT,
    fontStyle: 'bold',
  }).setOrigin(0, 0.5));
  deck.add(scene.add.text(barLineX + 42, barLineY + 7, `${dungeonMetrics.readiness}%`, {
    fontFamily: 'Georgia, serif',
    fontSize: '10px',
    color: readinessCss,
    fontStyle: 'bold',
  }).setOrigin(0, 0.5));
  deck.add(scene.add.text(barLineX + barLineW - 6, barLineY + 7, `방 ${builtRooms}/${unlockedSlots}`, {
    fontFamily: 'monospace',
    fontSize: '8px',
    color: CASUAL_CSS.INK_SOFT,
    fontStyle: 'bold',
  }).setOrigin(1, 0.5));

  // ── Divider ────────────────────────────────────────────────────────────────
  g.lineStyle(1, CASUAL.EDGE_SOFT, 0.35);
  g.lineBetween(deckX + 14, deckY + 55, deckX + deckW - 14, deckY + 55);

  // ── Directive card — hero element (deckY+58 … +100) ───────────────────────
  const directiveY = deckY + 58;
  drawHomeDirectiveCard(scene, deck, deckX + 14, directiveY, deckW - 28, 40, directive);

  // ── Primary CTA (deckY+102 … +130) ────────────────────────────────────────
  const ctaY = directiveY + 44;
  const ctaH = 26;
  const { bg: ctaBg, text: ctaText, zone: ctaZone } = addPrimaryActionButton(scene, {
    x: deckX + 14,
    y: ctaY,
    w: deckW - 28,
    h: ctaH,
    label: directive.ctaLabel,
    fontSize: '12px',
    fillColor: directive.accent,
    hoverFillColor: directive.accent,
    borderColor: directive.accent,
    hoverBorderColor: directive.accent,
    onPress: () => directive.onPress(),
  });
  deck.add([ctaBg, ctaText, ctaZone]);

  // ── Divider ────────────────────────────────────────────────────────────────
  g.lineStyle(1, CASUAL.EDGE_SOFT, 0.35);
  g.lineBetween(deckX + 14, ctaY + ctaH + 4, deckX + deckW - 14, ctaY + ctaH + 4);

  // ── Secondary chip row (deckY+135 … +157): 방확대 · 몬스터성장 · 장비제작 ──
  const chipRowY = ctaY + ctaH + 8;
  const chipRowH = 20;
  const chipGap = 6;
  const chipW = (deckW - 28 - chipGap * 2) / 3;
  const secondaryChips: Array<{ label: string; icon: string; onPress: () => void }> = [
    { label: '방 확대', icon: '▣', onPress: () => openFirstDungeonSlot(scene) },
    { label: '몬스터 성장', icon: '👹', onPress: () => openFocusedMonsterGrowth(scene) },
    { label: '장비 제작', icon: '⚒', onPress: () => openFocusedForge(scene) },
  ];
  secondaryChips.forEach((chip, i) => {
    const chipX = deckX + 14 + i * (chipW + chipGap);
    const chipBg = scene.add.graphics();
    deck.add(chipBg);
    const drawChip = (hover = false): void => {
      chipBg.clear();
      chipBg.fillStyle(CASUAL.SHADOW, hover ? 0.28 : 0.18);
      chipBg.fillRoundedRect(chipX, chipRowY + 2, chipW, chipRowH, 5);
      chipBg.fillStyle(hover ? CASUAL.PANEL_SOFT : CASUAL.PANEL, 1);
      chipBg.fillRoundedRect(chipX, chipRowY, chipW, chipRowH, 5);
      chipBg.lineStyle(hover ? 2 : 1.5, CASUAL.EDGE_SOFT, hover ? 0.9 : 0.6);
      chipBg.strokeRoundedRect(chipX, chipRowY, chipW, chipRowH, 5);
      chipBg.fillStyle(0xffffff, hover ? 0.2 : 0.1);
      chipBg.fillRoundedRect(chipX + 3, chipRowY + 2, chipW - 6, 3, 2);
    };
    drawChip(false);
    const iconT = scene.add.text(chipX + 10, chipRowY + chipRowH / 2, chip.icon, {
      fontFamily: 'sans-serif', fontSize: '9px',
    }).setOrigin(0.5);
    const labelT = scene.add.text(chipX + chipW / 2 + 4, chipRowY + chipRowH / 2, chip.label, {
      fontFamily: 'sans-serif',
      fontSize: '8px',
      color: CASUAL_CSS.INK_SOFT,
      fontStyle: 'bold',
    }).setOrigin(0.5);
    const zone = scene.add.zone(chipX, chipRowY, chipW, chipRowH)
      .setOrigin(0, 0)
      .setInteractive({ useHandCursor: true });
    deck.add([iconT, labelT, zone]);
    zone.on('pointerover', () => {
      drawChip(true);
      labelT.setColor(CASUAL_CSS.INK);
    });
    zone.on('pointerout', () => {
      drawChip(false);
      labelT.setColor(CASUAL_CSS.INK_SOFT);
      iconT.setScale(1);
      labelT.setScale(1);
    });
    zone.on('pointerdown', () => {
      scene.tweens.add({ targets: [iconT, labelT], scaleX: 0.92, scaleY: 0.92, yoyo: true, duration: 80 });
      audioManager.playSfx('button_click');
      chip.onPress();
    });
  });

  // Suppress unused-variable warning — getDungeonActionQueue kept for board use.
  void _actionQueue;
}

// ─── getMonsterCollectionSummary ─────────────────────────────────────────────

function getMonsterCollectionSummary(
  ownedMonsters: readonly OwnedMonster[],
): { owned: number; total: number; rareOwned: number; percent: number } {
  const ownedTypes = new Set<string>();
  for (const monster of ownedMonsters) {
    const typeId = Object.keys(MONSTER_DEFS).find(
      id => monster.id === id || monster.id.startsWith(`${id}_`),
    );
    if (typeId) ownedTypes.add(typeId);
  }
  const defs = Object.values(MONSTER_DEFS);
  const rareOwned = Array.from(ownedTypes).filter(id => {
    const rarity = MONSTER_DEFS[id as keyof typeof MONSTER_DEFS]?.rarityTier;
    return rarity === 'E' || rarity === 'L';
  }).length;
  const total = defs.length;
  return {
    owned: ownedTypes.size,
    total,
    rareOwned,
    percent: total > 0 ? ownedTypes.size / total : 0,
  };
}

// ─── drawHomeCollectionPill ──────────────────────────────────────────────────

function drawHomeCollectionPill(
  scene: DungeonHomeScene,
  deck: Phaser.GameObjects.Container,
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  w: number,
  h: number,
  summary: { owned: number; total: number; rareOwned: number; percent: number },
): void {
  const PINK = 0xe85fc0;
  const PINK_CSS = '#e06ab0';
  g.fillStyle(CASUAL.SHADOW, 0.18);
  g.fillRoundedRect(x, y + 1, w, h, 6);
  g.fillStyle(CASUAL.PANEL_SOFT, 1);
  g.fillRoundedRect(x, y, w, h, 6);
  g.lineStyle(1.5, PINK, 0.75);
  g.strokeRoundedRect(x, y, w, h, 6);
  g.fillStyle(PINK, 0.85);
  g.fillCircle(x + 9, y + h / 2, 5);
  deck.add(scene.add.text(x + 9, y + h / 2, '★', {
    fontFamily: 'sans-serif',
    fontSize: '7px',
    color: CASUAL_CSS.WHITE,
    fontStyle: 'bold',
  }).setOrigin(0.5));
  deck.add(scene.add.text(x + 17, y + h / 2, `도감 ${summary.owned}/${summary.total}`, {
    fontFamily: 'sans-serif',
    fontSize: '8px',
    color: PINK_CSS,
    fontStyle: 'bold',
  }).setOrigin(0, 0.5));
  deck.add(scene.add.text(x + w - 4, y + h / 2, `★${summary.rareOwned}`, {
    fontFamily: 'monospace',
    fontSize: '7px',
    color: CASUAL_CSS.GOLD,
    fontStyle: 'bold',
  }).setOrigin(1, 0.5));
  // Make the pill interactive → open Codex
  const zone = scene.add.zone(x, y, w, h).setOrigin(0, 0).setInteractive({ useHandCursor: true });
  deck.add(zone);
  zone.on('pointerdown', () => {
    audioManager.playSfx('button_click');
    scene.navigateFromHome('CodexScene');
  });
}

// ─── getHomeDirective ────────────────────────────────────────────────────────

function getHomeDirective(
  scene: DungeonHomeScene,
  unlockedSlots: number,
  visibleSlots: readonly (DungeonSlot | undefined)[],
  dungeonReadiness: number,
  skillReady: number,
): HomeDirective {
  const entries = Array.from({ length: unlockedSlots }, (_, idx) => ({
    idx,
    slot: visibleSlots[idx],
  }));
  const roomName = (idx: number): string => `방 #${idx + 1}`;
  const buildHomeDirective = (
    copy: ReturnType<typeof getReadinessDirectiveCopy>,
    statValue: string,
    onPress: () => void,
  ): HomeDirective => ({
    icon: copy.icon,
    title: copy.title,
    body: copy.body,
    ctaLabel: copy.ctaLabel,
    statLabel: copy.statLabel,
    statValue,
    accent: copy.accent,
    onPress,
  });
  const buildRoomActionDirective = (
    slotIdx: number,
    onPress: () => void,
  ): HomeDirective => {
    const action = getRoomActionRecommendation(scene.gs, slotIdx);
    return {
      icon: action.icon,
      title: action.title,
      body: action.body,
      ctaLabel: action.ctaLabel,
      statLabel: action.statLabel,
      statValue: action.statValue,
      accent: action.accent,
      onPress,
    };
  };

  const broken = entries.find(({ slot }) => !!slot?.roomType && slot.hp <= 0);
  if (broken) {
    return buildRoomActionDirective(broken.idx, () => scene.selectRoomForPlacement(broken.idx));
  }

  const monsterGap = entries.find(({ slot }) => {
    if (!slot?.roomType) return false;
    const cap = getRoomSlotCapacity(slot.roomLevel, slot.roomType);
    return (slot.monsterIds ?? []).filter(Boolean).length < cap.monsters;
  });
  if (monsterGap?.slot) {
    return buildRoomActionDirective(monsterGap.idx, () => scene.selectRoomForPlacement(monsterGap.idx));
  }

  const trapGap = entries.find(({ slot }) => {
    if (!slot?.roomType) return false;
    const cap = getRoomSlotCapacity(slot.roomLevel, slot.roomType);
    return (slot.trapIds ?? []).filter(Boolean).length < cap.traps;
  });
  if (trapGap?.slot) {
    return buildRoomActionDirective(trapGap.idx, () => scene.selectRoomForPlacement(trapGap.idx));
  }

  const empty = entries.find(({ slot }) => !slot?.roomType);
  if (empty) {
    return buildRoomActionDirective(empty.idx, () => scene.selectRoomForPlacement(empty.idx));
  }

  if (skillReady > 0) {
    return buildHomeDirective(
      getReadinessDirectiveCopy('grow-monster', { skillReady }),
      `${skillReady}`,
      () => scene.navigateFromHome('BarracksScene'),
    );
  }

  const weakestRoom = entries
    .filter((entry): entry is { idx: number; slot: DungeonSlot } => !!entry.slot?.roomType)
    .map(entry => ({
      idx: entry.idx,
      slot: entry.slot,
      readiness: calculateRoomMetrics(scene.gs, entry.slot).readiness,
    }))
    .sort((a, b) => a.readiness - b.readiness)[0];

  if (dungeonReadiness < 85 && weakestRoom) {
    return buildHomeDirective(
      getReadinessDirectiveCopy('forge-equipment', {
        roomLabel: roomName(weakestRoom.idx),
        readiness: weakestRoom.readiness,
      }),
      `${weakestRoom.readiness}%`,
      () => scene.navigateFromHome('ForgeScene'),
    );
  }

  return buildHomeDirective(
    getReadinessDirectiveCopy('battle-ready', { readiness: dungeonReadiness }),
    `${dungeonReadiness}%`,
    () => goToPreBattle(scene, scene.gs, scene.invasionState),
  );
}

// ─── drawHomeDirectiveCard ───────────────────────────────────────────────────

function drawHomeDirectiveCard(
  scene: DungeonHomeScene,
  deck: Phaser.GameObjects.Container,
  x: number,
  y: number,
  w: number,
  h: number,
  directive: HomeDirective,
): void {
  const accentCss = `#${directive.accent.toString(16).padStart(6, '0')}`;
  const bg = scene.add.graphics();
  deck.add(bg);
  // Cream casual card, accent-bordered, with a candy accent icon cap.
  bg.fillStyle(CASUAL.SHADOW, 0.22);
  bg.fillRoundedRect(x, y + 2, w, h, 7);
  bg.fillStyle(CASUAL.PANEL, 1);
  bg.fillRoundedRect(x, y, w, h, 7);
  bg.lineStyle(2.5, directive.accent, 0.9);
  bg.strokeRoundedRect(x, y, w, h, 7);
  bg.fillStyle(0xffffff, 0.12);
  bg.fillRoundedRect(x + 5, y + 4, w - 10, 4, 2);
  bg.fillStyle(directive.accent, 0.95);
  bg.fillRoundedRect(x + 6, y + 6, 24, h - 12, 6);
  bg.fillStyle(0xffffff, 0.35);
  bg.fillRoundedRect(x + 8, y + 8, 20, 4, 2);

  deck.add(scene.add.text(x + 18, y + h / 2, directive.icon, {
    fontFamily: 'Georgia, serif',
    fontSize: '14px',
    color: CASUAL_CSS.WHITE,
    fontStyle: 'bold',
  }).setOrigin(0.5));

  deck.add(scene.add.text(x + 38, y + 10, directive.title, {
    fontFamily: 'Georgia, serif',
    fontSize: '11px',
    color: accentCss,
    fontStyle: 'bold',
  }).setOrigin(0, 0.5));
  deck.add(scene.add.text(x + 38, y + 24, directive.body, {
    fontFamily: 'sans-serif',
    fontSize: '10px',
    color: CASUAL_CSS.INK_SOFT,
    wordWrap: { width: Math.max(120, w - 164), useAdvancedWrap: true },
  }).setOrigin(0, 0.5));
  deck.add(scene.add.text(x + w - 104, y + 10, directive.statLabel, {
    fontFamily: 'sans-serif',
    fontSize: '10px',
    color: CASUAL_CSS.INK_SOFT,
  }).setOrigin(0.5));
  deck.add(scene.add.text(x + w - 104, y + 24, directive.statValue, {
    fontFamily: 'Georgia, serif',
    fontSize: '12px',
    color: accentCss,
    fontStyle: 'bold',
  }).setOrigin(0.5));

  const ctaX = x + w - 78;
  const ctaY = y + 5;
  const ctaW = 70;
  const ctaH = h - 10;
  const ctaBg = scene.add.graphics();
  deck.add(ctaBg);
  // Saturated candy pill — accent cap over the same accent base, white label.
  const drawCta = (hover = false): void => {
    ctaBg.clear();
    ctaBg.fillStyle(CASUAL.SHADOW, hover ? 0.3 : 0.22);
    ctaBg.fillRoundedRect(ctaX, ctaY + 2, ctaW, ctaH, 6);
    ctaBg.fillStyle(directive.accent, hover ? 1 : 0.92);
    ctaBg.fillRoundedRect(ctaX, ctaY, ctaW, ctaH, 6);
    ctaBg.fillStyle(0xffffff, hover ? 0.5 : 0.38);
    ctaBg.fillRoundedRect(ctaX + 5, ctaY + 4, ctaW - 10, 5, 3);
    ctaBg.lineStyle(1.5, directive.accent, 1);
    ctaBg.strokeRoundedRect(ctaX, ctaY, ctaW, ctaH, 6);
  };
  drawCta(false);

  const ctaText = scene.add.text(ctaX + ctaW / 2, ctaY + ctaH / 2, directive.ctaLabel, {
    fontFamily: 'sans-serif',
    fontSize: '10px',
    color: CASUAL_CSS.WHITE,
    fontStyle: 'bold',
  }).setOrigin(0.5);
  const zone = scene.add.zone(ctaX, ctaY, ctaW, ctaH)
    .setOrigin(0, 0)
    .setInteractive({ useHandCursor: true });
  deck.add([ctaText, zone]);
  zone.on('pointerover', () => {
    drawCta(true);
  });
  zone.on('pointerout', () => {
    drawCta(false);
    ctaText.setScale(1);
  });
  zone.on('pointerdown', () => {
    scene.tweens.add({ targets: ctaText, scaleX: 0.92, scaleY: 0.92, yoyo: true, duration: 80 });
    audioManager.playSfx('button_click');
    directive.onPress();
  });
}

// ─── openFirstDungeonSlot ────────────────────────────────────────────────────

function openFirstDungeonSlot(scene: DungeonHomeScene): void {
  const unlockedSlots = getUnlockedSlots(scene.gs.dmLevel);
  const queuedAction = getDungeonActionQueue(scene.gs, unlockedSlots)[0];
  if (queuedAction) {
    scene.selectRoomForPlacement(queuedAction.slotIdx);
    return;
  }

  const slots = scene.gs.dungeonSlots ?? [];
  let idx = 0;
  for (let i = 0; i < unlockedSlots; i++) {
    const slot = slots[i];
    const hasMonster = (slot?.monsterIds ?? []).some(Boolean);
    if (!slot?.roomType || !hasMonster || slot.hp <= 0) {
      idx = i;
      break;
    }
  }
  scene.selectRoomForPlacement(idx);
}

// ─── openFocusedMonsterGrowth ────────────────────────────────────────────────

function openFocusedMonsterGrowth(scene: DungeonHomeScene): void {
  const target = getFocusedMonsterGrowthTarget(scene);

  if (target) {
    applyHomeFocusTarget(scene, target);
  } else {
    clearHomeFocusTarget(scene);
  }
  scene.navigateFromHome('BarracksScene');
}

// ─── openFocusedForge ────────────────────────────────────────────────────────

function openFocusedForge(scene: DungeonHomeScene): void {
  const target = getFocusedForgeTarget(scene);

  if (target) {
    applyHomeFocusTarget(scene, target);
  } else {
    clearHomeFocusTarget(scene);
  }
  scene.registry.set('forgeReturnScene', 'DungeonHomeScene');
  scene.navigateFromHome('ForgeScene');
}

// ─── getFocusedMonsterGrowthTarget ───────────────────────────────────────────

function getFocusedMonsterGrowthTarget(scene: DungeonHomeScene): HomeFocusTarget | null {
  return findQueuedGrowthTarget(scene, 'level')
    ?? findQueuedGrowthTarget(scene, 'readiness')
    ?? findSkillReadyMonsterTarget(scene)
    ?? findLowestLevelMonsterTarget(scene);
}

// ─── getFocusedForgeTarget ───────────────────────────────────────────────────

function getFocusedForgeTarget(scene: DungeonHomeScene): HomeFocusTarget | null {
  return findQueuedGrowthTarget(scene, 'equipment')
    ?? findFirstUnequippedMonsterTarget(scene);
}

// ─── findQueuedGrowthTarget ──────────────────────────────────────────────────

function findQueuedGrowthTarget(
  scene: DungeonHomeScene,
  kind: 'equipment' | 'level' | 'readiness',
): HomeFocusTarget | null {
  const unlockedSlots = getUnlockedSlots(scene.gs.dmLevel);
  const actions = getDungeonActionQueue(scene.gs, unlockedSlots).filter(action => action.kind === 'growth');

  for (const action of actions) {
    if (kind === 'equipment' && action.statLabel !== 'E') continue;
    if (kind === 'level' && action.statLabel !== 'Lv') continue;
    if (kind === 'readiness' && action.statLabel === 'E') continue;

    const target = kind === 'equipment'
      ? findUnequippedRoomMonsterTarget(scene, action.slotIdx)
      : findUnderleveledRoomMonsterTarget(scene, action.slotIdx) ?? findFirstRoomMonsterTarget(scene, action.slotIdx);
    if (target) return target;
  }

  return null;
}

// ─── findUnequippedRoomMonsterTarget ─────────────────────────────────────────

function findUnequippedRoomMonsterTarget(scene: DungeonHomeScene, slotIdx: number): HomeFocusTarget | null {
  const monster = findRoomMonster(scene, slotIdx, owned => !owned.equipment);
  return monster ? buildRoomFocusTarget(slotIdx, monster.id) : null;
}

// ─── findUnderleveledRoomMonsterTarget ───────────────────────────────────────

function findUnderleveledRoomMonsterTarget(scene: DungeonHomeScene, slotIdx: number): HomeFocusTarget | null {
  const targetLevel = Math.max(2, scene.gs.dmLevel - 1);
  const monster = findRoomMonster(scene, slotIdx, owned => owned.level < targetLevel);
  return monster ? buildRoomFocusTarget(slotIdx, monster.id) : null;
}

// ─── findFirstRoomMonsterTarget ──────────────────────────────────────────────

function findFirstRoomMonsterTarget(scene: DungeonHomeScene, slotIdx: number): HomeFocusTarget | null {
  const monster = findRoomMonster(scene, slotIdx, () => true);
  return monster ? buildRoomFocusTarget(slotIdx, monster.id) : null;
}

// ─── findRoomMonster ─────────────────────────────────────────────────────────

function findRoomMonster(
  scene: DungeonHomeScene,
  slotIdx: number,
  predicate: (monster: OwnedMonster) => boolean,
): OwnedMonster | null {
  const slot = scene.gs.dungeonSlots?.[slotIdx];
  if (!slot) return null;

  for (const monsterId of slot.monsterIds ?? []) {
    if (!monsterId) continue;
    const owned = scene.gs.ownedMonsters.find(monster => monster.id === monsterId);
    if (owned && predicate(owned)) return owned;
  }

  return null;
}

// ─── findFirstUnequippedMonsterTarget ────────────────────────────────────────

function findFirstUnequippedMonsterTarget(scene: DungeonHomeScene): HomeFocusTarget | null {
  const target = (scene.gs.ownedMonsters ?? [])
    .find(monster => !monster.equipment);
  return target ? buildMonsterFocusTarget(scene, target.id, '장비 지휘') : null;
}

// ─── findSkillReadyMonsterTarget ─────────────────────────────────────────────

function findSkillReadyMonsterTarget(scene: DungeonHomeScene): HomeFocusTarget | null {
  const target = [...(scene.gs.ownedMonsters ?? [])]
    .filter(monster => (monster.skillPoints ?? 0) > 0)
    .sort((a, b) =>
      ((b.skillPoints ?? 0) - (a.skillPoints ?? 0))
      || (b.level - a.level)
      || (b.xp - a.xp),
    )[0];
  return target ? buildMonsterFocusTarget(scene, target.id, '성장 지휘') : null;
}

// ─── findLowestLevelMonsterTarget ────────────────────────────────────────────

function findLowestLevelMonsterTarget(scene: DungeonHomeScene): HomeFocusTarget | null {
  const target = [...(scene.gs.ownedMonsters ?? [])]
    .sort((a, b) =>
      (a.level - b.level)
      || (a.xp - b.xp)
      || a.id.localeCompare(b.id),
    )[0];
  return target ? buildMonsterFocusTarget(scene, target.id, '성장 지휘') : null;
}

// ─── buildRoomFocusTarget ────────────────────────────────────────────────────

function buildRoomFocusTarget(slotIdx: number, monsterId: string): HomeFocusTarget {
  return {
    monsterId,
    sourceLabel: `방 #${slotIdx + 1} 수호자`,
    slotIdx,
  };
}

// ─── buildMonsterFocusTarget ─────────────────────────────────────────────────

function buildMonsterFocusTarget(
  scene: DungeonHomeScene,
  monsterId: string,
  fallbackSourceLabel: string,
): HomeFocusTarget {
  const slotIdx = findMonsterRoomSlotIdx(scene, monsterId);
  if (slotIdx !== null) return buildRoomFocusTarget(slotIdx, monsterId);
  return {
    monsterId,
    sourceLabel: fallbackSourceLabel,
    slotIdx: null,
  };
}

// ─── findMonsterRoomSlotIdx ──────────────────────────────────────────────────

function findMonsterRoomSlotIdx(scene: DungeonHomeScene, monsterId: string): number | null {
  const slots = scene.gs.dungeonSlots ?? [];
  const idx = slots.findIndex(slot => (slot?.monsterIds ?? []).includes(monsterId));
  return idx >= 0 ? idx : null;
}

// ─── applyHomeFocusTarget ────────────────────────────────────────────────────

function applyHomeFocusTarget(scene: DungeonHomeScene, target: HomeFocusTarget): void {
  scene.registry.set('focusMonsterId', target.monsterId);
  scene.registry.set('focusSourceLabel', target.sourceLabel);
  if (target.slotIdx === null) {
    scene.registry.remove('focusRoomSlotIdx');
  } else {
    scene.registry.set('focusRoomSlotIdx', target.slotIdx);
  }
}

// ─── clearHomeFocusTarget ────────────────────────────────────────────────────

function clearHomeFocusTarget(scene: DungeonHomeScene): void {
  scene.registry.remove('focusMonsterId');
  scene.registry.remove('focusSourceLabel');
  scene.registry.remove('focusRoomSlotIdx');
}
