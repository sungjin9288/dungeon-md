/**
 * HomeCommandDeck — extracted private-method bodies from DungeonHomeScene.
 *
 * These were all PRIVATE methods; only DungeonHomeScene calls them (via
 * one-line delegators that keep the original `this.<name>(...)` call sites).
 * Import the DungeonHomeScene TYPE only to avoid a runtime circular dependency.
 */
import { getLineageNextStep } from '../data/lineage';
import { getHomeTodos } from '../data/homeTodos';
import { getMonsterDisplayName } from '../data/fusion';
import type { DungeonHomeScene } from './DungeonHomeScene';
import Phaser from 'phaser';
import { CANVAS_WIDTH, ROOT_NAV_Y } from '../constants/layout';
import { CASUAL, CASUAL_CSS } from '../constants/colors';
import {
  getUnlockedSlotCount,
  type OwnedMonster,
} from '../data/wisdom';
import { calculateDungeonMetrics } from '../data/dungeonMetrics';
import { getReadinessDirectiveCopy } from '../data/readinessDirectives';
import { getHomeReadinessDirective } from '../data/homeReadinessDirective';
import { audioManager } from '../audio/AudioManager';
import { addFramedPanel, addPrimaryActionButton } from '../ui/GameUiPrimitives';
import { goToPreBattle } from '../ui/InvasionUI';
import { showForecastTray } from '../ui/ForecastTray';
import { getNotorietyTier, canRaiseNotorietyTier } from '../data/notoriety';
import { isForecastExhausted } from '../data/forecastTransactions';
import { getTodayString } from '../data/daily';


// ─── Layout constants (must match DungeonHomeScene.ts) ──────────────────────

const BOT_Y = ROOT_NAV_Y;

// ─── Types local to this cluster ────────────────────────────────────────────

interface HomeDirective {
  readonly icon: string;
  readonly title: string;
  readonly body: string;
  readonly ctaLabel: string;
  readonly statLabel: string;
  readonly statValue: string;
  readonly accent: number;
  readonly slotIdx: number | null;
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
  const deckX = 8;
  const minDeckY = scene.boardLayout.contentBottomY + 8;
  const deckW = CANVAS_WIDTH - deckX * 2;
  const statsTopY = BOT_Y - 26;
  const availableDeckH = statsTopY - minDeckY - 10;
  const deckH = Math.min(142, availableDeckH);
  const deckY = Math.max(minDeckY, statsTopY - deckH - 10);
  if (deckH < 132) { scene.commandDeckRect = null; return; }
  const deck = scene.add.container(0, 0).setDepth(4);
  scene.commandDeckContainer = deck;
  scene.commandDeckRect = { x: deckX, y: deckY, w: deckW, h: deckH };

  const unlockedSlots = getUnlockedSlotCount(scene.gs);
  const visibleSlots = (scene.gs.dungeonSlots ?? []).slice(0, unlockedSlots);
  const builtRooms = visibleSlots.filter(slot => !!slot?.roomType).length;
  const dungeonMetrics = calculateDungeonMetrics(scene.gs, unlockedSlots);
  const directive = getHomeDirective(scene, unlockedSlots, dungeonMetrics.readiness);
  const frame = addFramedPanel(scene, {
    x: deckX,
    y: deckY,
    w: deckW,
    h: deckH,
    radius: 5,
    fillColor: 0x0a0c0b,
    borderColor: 0x6e5736,
    borderAlpha: 0.82,
    borderWidth: 1,
    accentColor: directive.accent,
    accentAlpha: 0.74,
    glowOpacity: 0,
    shadowOpacity: 0.16,
    shadowOffsetY: 2,
  });
  deck.add([frame.shadow, frame.panel, frame.glow]);

  const g = scene.add.graphics();
  deck.add(g);

  // One operating directive. Header is a ledger line, not another card.
  deck.add(scene.add.text(deckX + 13, deckY + 15, '다음 수비 지시', {
    fontFamily: 'sans-serif',
    fontSize: '12px',
    color: '#e7d6b5',
    fontStyle: 'bold',
  }).setOrigin(0, 0.5));
  const exhausted = isForecastExhausted(scene.gs, getTodayString());
  const tierLabel = `명성 ${getNotorietyTier(scene.gs)}단계${canRaiseNotorietyTier(scene.gs) ? ' ▲' : ''}`;
  // Sits after the '다음 수비 지시' header label (≈80px at 11px bold).
  const tierText = scene.add.text(deckX + 104, deckY + 15, `· ${tierLabel}`, {
    fontFamily: 'sans-serif',
    fontSize: '11px',
    color: canRaiseNotorietyTier(scene.gs) ? CASUAL_CSS.GOLD : '#a89c86',
    fontStyle: 'bold',
  }).setOrigin(0, 0.5);
  deck.add(tierText);
  // A pinned 계보 goal stays visible here even while room work owns the directive card.
  const goalStep = scene.gs.lineageGoal ? getLineageNextStep(scene.gs, scene.gs.lineageGoal) : null;
  let headerX = tierText.x + tierText.width + 6;
  if (scene.gs.lineageGoal && goalStep) {
    const goalChip = scene.add.text(headerX, deckY + 15, `· 📌 ${getMonsterDisplayName(scene.gs.lineageGoal)}`, {
      fontFamily: 'sans-serif',
      fontSize: '11px',
      color: '#c9a8ff',
      fontStyle: 'bold',
    }).setOrigin(0, 0.5).setName('home-lineage-goal-chip');
    deck.add(goalChip);
    headerX += goalChip.width + 6;
  }
  // 생산 구역 is otherwise only reachable from the stage map, so home says when
  // a built facility has nobody on shift and offers the route.
  const todos = getHomeTodos(scene.gs, getTodayString());
  if (todos.unstaffedFacilities > 0 && headerX < deckX + deckW - 150) {
    const staffChip = scene.add.text(headerX, deckY + 15, `· ⛏ 근무 ${todos.unstaffedFacilities}`, {
      fontFamily: 'sans-serif',
      fontSize: '11px',
      color: CASUAL_CSS.GOLD,
      fontStyle: 'bold',
    }).setOrigin(0, 0.5);
    deck.add(staffChip);
    const staffZone = scene.add.zone(headerX - 4, deckY - 7, staffChip.width + 12, 44)
      .setOrigin(0, 0).setName('home-staffing-chip').setInteractive({ useHandCursor: true });
    staffZone.on('pointerdown', () => scene.navigateFromHome('ProductionScene'));
    deck.add(staffZone);
  }

  const readinessCss = dungeonMetrics.readiness >= 80
    ? CASUAL_CSS.GREEN : dungeonMetrics.readiness >= 55 ? CASUAL_CSS.GOLD : CASUAL_CSS.RED;
  deck.add(scene.add.text(deckX + deckW - 98, deckY + 15, '준비도', {
    fontFamily: 'sans-serif',
    fontSize: '11px',
    color: '#a89c86',
    fontStyle: 'bold',
  }).setOrigin(1, 0.5));
  deck.add(scene.add.text(deckX + deckW - 56, deckY + 15, `${dungeonMetrics.readiness}%`, {
    fontFamily: 'sans-serif',
    fontSize: '12px',
    color: readinessCss,
    fontStyle: 'bold',
  }).setOrigin(1, 0.5));
  deck.add(scene.add.text(deckX + deckW - 12, deckY + 15, `방 ${builtRooms}/${unlockedSlots}`, {
    fontFamily: 'sans-serif',
    fontSize: '11px',
    color: '#a89c86',
    fontStyle: 'bold',
  }).setOrigin(1, 0.5));

  const directiveY = deckY + 25;
  drawHomeDirectiveCard(scene, deck, deckX + 12, directiveY, deckW - 24, 30, directive);

  // The only dominant action: 48px high and tied to the canonical directive.
  const ctaY = deckY + 55;
  const ctaH = 44;
  const { bg: ctaBg, text: ctaText, zone: ctaZone } = addPrimaryActionButton(scene, {
    x: deckX + 12,
    y: ctaY,
    w: deckW - 24,
    h: ctaH,
    label: directive.ctaLabel,
    fontSize: '14px',
    fillColor: 0x242219,
    hoverFillColor: 0x302d21,
    borderColor: directive.accent,
    hoverBorderColor: directive.accent,
    textColor: '#f4dfb5',
    onPress: () => directive.onPress(),
  });
  deck.add([ctaBg, ctaText, ctaZone]);

  // Plain utility links preserve existing destinations without CTA soup.
  const chipRowY = deckY + 99;
  const chipRowH = 44;
  const chipW = (deckW - 24) / 5;
  const directiveSlotIdx = directive.slotIdx ?? 0;
  // A chip carries a count when its destination has something waiting today
  // (교감 가능 수호자 / 지금 융합 가능한 함정) — the directive card has room for one thing only.
  const secondaryChips: Array<{ label: string; todo?: number; onPress: () => void }> = [
    { label: '도감', onPress: () => scene.navigateFromHome('CodexScene') },
    { label: '방 관리', onPress: () => openFirstDungeonSlot(scene, directiveSlotIdx) },
    { label: '육성', todo: todos.bondGuardians, onPress: () => openFocusedMonsterGrowth(scene, directiveSlotIdx) },
    { label: '제작', todo: todos.trapFusions, onPress: () => openFocusedForge(scene, directiveSlotIdx) },
    { label: exhausted ? '손님 완료' : '오늘의 손님', onPress: () => showForecastTray(scene) },
  ];
  secondaryChips.forEach((chip, i) => {
    const chipX = deckX + 12 + i * chipW;
    if (i > 0) {
      g.lineStyle(1, 0x6e5736, 0.32);
      g.lineBetween(chipX, chipRowY + 11, chipX, chipRowY + chipRowH - 11);
    }
    const pending = chip.todo ?? 0;
    g.fillStyle(pending > 0 ? CASUAL.GOLD : 0xa98245, pending > 0 ? 1 : 0.62);
    g.fillCircle(chipX + chipW / 2, chipRowY + 9, pending > 0 ? 2.8 : 1.8);
    const labelT = scene.add.text(chipX + chipW / 2, chipRowY + 27, pending > 0 ? `${chip.label} ${pending}` : chip.label, {
      fontFamily: 'sans-serif',
      fontSize: '10px',
      color: pending > 0 ? CASUAL_CSS.GOLD : '#b8aa91',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    const zone = scene.add.zone(chipX, chipRowY, chipW, chipRowH)
      .setOrigin(0, 0)
      .setInteractive({ useHandCursor: true });
    deck.add([labelT, zone]);
    zone.on('pointerover', () => labelT.setColor('#ead9b8'));
    zone.on('pointerout', () => labelT.setColor(pending > 0 ? CASUAL_CSS.GOLD : '#b8aa91'));
    zone.on('pointerdown', () => {
      audioManager.playSfx('button_click');
      chip.onPress();
    });
  });
}

// ─── getHomeDirective ────────────────────────────────────────────────────────

function getHomeDirective(
  scene: DungeonHomeScene,
  unlockedSlots: number,
  dungeonReadiness: number,
): HomeDirective {
  const canonical = getHomeReadinessDirective(scene.gs, unlockedSlots);
  const action = canonical.roomAction;
  if (action) {
    const onPress = canonical.destination === 'room-detail'
      ? () => scene.selectRoomForPlacement(action.slotIdx)
      : canonical.destination === 'summon'
        ? () => scene.navigateFromHome('SummonScene')
      : canonical.destination === 'forge'
        ? () => openFocusedForge(scene, action.slotIdx)
        : () => openFocusedMonsterGrowth(scene, action.slotIdx);
    return {
      icon: action.icon,
      title: action.title,
      body: action.body,
      ctaLabel: action.ctaLabel,
      statLabel: action.statLabel,
      statValue: action.statValue,
      accent: action.accent,
      slotIdx: action.slotIdx,
      onPress,
    };
  }

  if (canonical.kind === 'lineage') {
    return {
      icon: canonical.icon,
      title: canonical.title,
      body: canonical.body,
      ctaLabel: canonical.ctaLabel,
      statLabel: canonical.statLabel,
      statValue: canonical.statValue,
      accent: canonical.accent,
      slotIdx: null,
      onPress: () => scene.navigateFromHome('CodexScene'),
    };
  }

  const readyCopy = getReadinessDirectiveCopy('battle-ready', { readiness: dungeonReadiness });
  return {
    ...readyCopy,
    statValue: `${dungeonReadiness}%`,
    slotIdx: null,
    onPress: () => goToPreBattle(scene, scene.gs, scene.invasionState),
  };
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
  bg.fillStyle(directive.accent, 0.12);
  bg.fillRect(x, y, 3, h);
  bg.lineStyle(1, CASUAL.EDGE_SOFT, 0.24);
  bg.lineBetween(x + 8, y + h, x + w, y + h);

  bg.fillStyle(directive.accent, 0.72);
  bg.fillCircle(x + 7, y + 9, 2.2);
  deck.add(scene.add.text(x + 14, y + 9, directive.title, {
    fontFamily: 'sans-serif',
    fontSize: '12px',
    color: accentCss,
    fontStyle: 'bold',
  }).setOrigin(0, 0.5));
  deck.add(scene.add.text(x + 14, y + 22, directive.body, {
    fontFamily: 'sans-serif',
    fontSize: '11px',
    color: '#aaa08d',
    wordWrap: { width: Math.max(120, w - 128), useAdvancedWrap: true },
  }).setOrigin(0, 0.5));
  deck.add(scene.add.text(x + w - 62, y + 9, directive.statLabel, {
    fontFamily: 'sans-serif',
    fontSize: '11px',
    color: CASUAL_CSS.INK_SOFT,
  }).setOrigin(1, 0.5));
  deck.add(scene.add.text(x + w - 18, y + 9, directive.statValue, {
    fontFamily: 'sans-serif',
    fontSize: '12px',
    color: accentCss,
    fontStyle: 'bold',
  }).setOrigin(1, 0.5));
}

// ─── openFirstDungeonSlot ────────────────────────────────────────────────────

function openFirstDungeonSlot(scene: DungeonHomeScene, preferredSlotIdx: number): void {
  const unlockedSlots = getUnlockedSlotCount(scene.gs);
  const idx = Phaser.Math.Clamp(preferredSlotIdx, 0, Math.max(0, unlockedSlots - 1));
  scene.selectRoomForPlacement(idx);
}

// ─── openFocusedMonsterGrowth ────────────────────────────────────────────────

function openFocusedMonsterGrowth(scene: DungeonHomeScene, slotIdx: number): void {
  const target = findUnderleveledRoomMonsterTarget(scene, slotIdx)
    ?? findFirstRoomMonsterTarget(scene, slotIdx);

  if (target) {
    applyHomeFocusTarget(scene, target);
  } else {
    clearHomeFocusTarget(scene);
  }
  scene.navigateFromHome('BarracksScene');
}

// ─── openFocusedForge ────────────────────────────────────────────────────────

function openFocusedForge(scene: DungeonHomeScene, slotIdx: number): void {
  const target = findUnequippedRoomMonsterTarget(scene, slotIdx);

  if (target) {
    applyHomeFocusTarget(scene, target);
  } else {
    clearHomeFocusTarget(scene);
  }
  scene.registry.set('forgeReturnScene', 'DungeonHomeScene');
  scene.navigateFromHome('ForgeScene');
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

// ─── buildRoomFocusTarget ────────────────────────────────────────────────────

function buildRoomFocusTarget(slotIdx: number, monsterId: string): HomeFocusTarget {
  return {
    monsterId,
    sourceLabel: `방 #${slotIdx + 1} 수호자`,
    slotIdx,
  };
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
