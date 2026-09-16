// Fusion Chamber shared UI: ritual palette, guarded overlays, picker, and tab re-exports.

import Phaser from 'phaser';
import { CANVAS_HEIGHT, CANVAS_WIDTH } from '../constants/layout';
import { DUNGEON_UI, DUNGEON_UI_CSS } from '../constants/colors';
import { loadGameState } from '../data/wisdom';
import { type OwnedMonster } from '../data/barracks';
import {
  RARITY_STARS,
  getMonsterDisplayName,
  getMonsterRarity,
} from '../data/fusion';
import { getReducedMotion } from '../utils/reducedMotion';
import { addMonsterPortrait } from './MonsterPortraitView';
import { addPrimaryActionButton, type PrimaryActionButtonRefs } from './GameUiPrimitives';

const TABS = ['진화', '흡수', '조합', '각성'] as const;
export type TabId = typeof TABS[number];

export const TAB_ACCENT: Record<TabId, number> = {
  '진화': DUNGEON_UI.JADE,
  '흡수': 0xa66f45,
  '조합': DUNGEON_UI.BRASS,
  '각성': 0x727eb8,
};

export const TAB_ACCENT_CSS: Record<TabId, string> = {
  '진화': DUNGEON_UI_CSS.JADE,
  '흡수': '#d69a67',
  '조합': DUNGEON_UI_CSS.BRASS,
  '각성': '#aeb8ed',
};

export interface FusionTabContext {
  readonly scene: Phaser.Scene;
  readonly contentY: number;
  readonly refreshTab: () => void;
  readonly refreshHeader: () => void;
  readonly beginTransaction: () => boolean;
  readonly finishTransaction: () => void;
}

// OwnedMonster has no persisted instance id. The picker therefore keeps the
// source-array index as an ephemeral identity while one scene selection is in
// progress. It is never serialized or passed into the transaction state.
const pickerSourceIndices = new WeakMap<OwnedMonster, number>();

export function getFusionPickerSourceIndex(monster: OwnedMonster): number | undefined {
  return pickerSourceIndices.get(monster);
}

function addPanel(
  scene: Phaser.Scene,
  container: Phaser.GameObjects.Container,
  x: number,
  y: number,
  w: number,
  h: number,
  border: number,
  selected = false,
): void {
  const g = scene.add.graphics();
  g.fillStyle(DUNGEON_UI.VOID, 0.72);
  g.fillRoundedRect(x + 2, y + 3, w, h, 8);
  g.fillStyle(selected ? DUNGEON_UI.STONE_RAISED : DUNGEON_UI.STONE, 0.98);
  g.fillRoundedRect(x, y, w, h, 8);
  g.lineStyle(selected ? 2 : 1, border, selected ? 0.92 : 0.55);
  g.strokeRoundedRect(x, y, w, h, 8);
  g.lineStyle(1, 0xffffff, 0.06);
  g.lineBetween(x + 7, y + 5, x + w - 7, y + 5);
  container.add(g);
}

export function drawMonsterSlot(
  ctx: FusionTabContext,
  c: Phaser.GameObjects.Container,
  x: number,
  y: number,
  w: number,
  h: number,
  monster: OwnedMonster | null,
  tabId: TabId,
  onTap: () => void,
  label?: string,
): void {
  const accent = TAB_ACCENT[tabId];
  const accentCss = TAB_ACCENT_CSS[tabId];
  addPanel(ctx.scene, c, x, y, w, h, monster ? accent : DUNGEON_UI.EDGE, Boolean(monster));

  if (label) {
    c.add(ctx.scene.add.text(x + w / 2, y + 12, label, {
      fontFamily: 'sans-serif', fontSize: '10px', color: DUNGEON_UI_CSS.MUTED, fontStyle: 'bold',
    }).setOrigin(0.5));
  }

  if (monster) {
    const portraitY = y + (label ? 48 : 38);
    addMonsterPortrait(ctx.scene, c, x + w / 2, portraitY, monster.id, {
      size: Math.min(56, w - 18),
      frameColor: accent,
      glowColor: accent,
      bgColor: DUNGEON_UI.SOOT,
      equippedSkins: loadGameState().equippedSkins,
    });
    c.add(ctx.scene.add.text(x + w / 2, y + h - 28, getMonsterDisplayName(monster.id), {
      fontFamily: 'sans-serif', fontSize: '11px', color: DUNGEON_UI_CSS.TEXT,
      fontStyle: 'bold', wordWrap: { width: w - 8 }, align: 'center',
    }).setOrigin(0.5));
    c.add(ctx.scene.add.text(x + w / 2, y + h - 12, `Lv.${monster.level}`, {
      fontFamily: 'sans-serif', fontSize: '10px', color: accentCss, fontStyle: 'bold',
    }).setOrigin(0.5));
  } else {
    const cy = y + h / 2 + (label ? 7 : 0);
    const cross = ctx.scene.add.graphics();
    cross.lineStyle(2, accent, 0.8);
    cross.strokeCircle(x + w / 2, cy, 15);
    cross.lineBetween(x + w / 2 - 7, cy, x + w / 2 + 7, cy);
    cross.lineBetween(x + w / 2, cy - 7, x + w / 2, cy + 7);
    c.add(cross);
    c.add(ctx.scene.add.text(x + w / 2, y + h - 14, '선택', {
      fontFamily: 'sans-serif', fontSize: '10px', color: DUNGEON_UI_CSS.MUTED,
    }).setOrigin(0.5));
  }

  const zone = ctx.scene.add.zone(x, y, w, h).setOrigin(0).setInteractive({ useHandCursor: true });
  zone.once('pointerdown', onTap);
  c.add(zone);
}

function addInputShield(
  scene: Phaser.Scene,
  container: Phaser.GameObjects.Container,
): Phaser.GameObjects.Zone {
  const shield = scene.add.zone(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT).setOrigin(0)
    .setInteractive({ useHandCursor: false });
  container.add(shield);
  return shield;
}

export function showFusionAnimation(
  ctx: FusionTabContext,
  tabId: TabId,
  onComplete: () => void,
): void {
  const overlay = ctx.scene.add.container(0, 0).setDepth(90);
  const dim = ctx.scene.add.graphics();
  dim.fillStyle(DUNGEON_UI.VOID, 0.94);
  dim.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  overlay.add(dim);
  addInputShield(ctx.scene, overlay);

  const cx = CANVAS_WIDTH / 2;
  const cy = CANVAS_HEIGHT / 2 - 12;
  const seal = ctx.scene.add.graphics();
  seal.lineStyle(2, TAB_ACCENT[tabId], 0.95);
  seal.strokeCircle(cx, cy, 58);
  seal.lineStyle(1, TAB_ACCENT[tabId], 0.58);
  seal.strokeCircle(cx, cy, 42);
  for (let i = 0; i < 6; i++) {
    const angle = Phaser.Math.DegToRad(i * 60 - 90);
    seal.lineBetween(
      cx + Math.cos(angle) * 22,
      cy + Math.sin(angle) * 22,
      cx + Math.cos(angle) * 49,
      cy + Math.sin(angle) * 49,
    );
  }
  overlay.add(seal);
  overlay.add(ctx.scene.add.text(cx, cy + 86, '의식 진행 중', {
    fontFamily: 'sans-serif', fontSize: '16px', color: TAB_ACCENT_CSS[tabId], fontStyle: 'bold',
  }).setOrigin(0.5));
  overlay.add(ctx.scene.add.text(cx, cy + 112, '결계가 닫혀 있습니다', {
    fontFamily: 'sans-serif', fontSize: '11px', color: DUNGEON_UI_CSS.MUTED,
  }).setOrigin(0.5));

  const finish = (): void => {
    overlay.destroy(true);
    onComplete();
  };
  if (getReducedMotion()) {
    ctx.scene.time.delayedCall(40, finish);
    return;
  }
  overlay.setAlpha(0);
  ctx.scene.tweens.add({ targets: overlay, alpha: 1, duration: 140, ease: 'Quad.easeOut' });
  ctx.scene.tweens.add({ targets: seal, angle: 60, duration: 560, ease: 'Sine.easeInOut' });
  ctx.scene.time.delayedCall(720, finish);
}

/**
 * Rebinds a primary CTA so the scene latch is acquired on the originating
 * pointerdown, before the visual press tween. This closes the short interval in
 * which a user could otherwise switch tabs before the confirmation appeared.
 */
export function bindFusionTransactionAction(
  ctx: FusionTabContext,
  button: PrimaryActionButtonRefs,
  onPress: () => void,
): void {
  if (!button.zone.input?.enabled) return;
  button.zone.removeAllListeners('pointerdown');
  button.zone.once('pointerdown', () => {
    if (!ctx.beginTransaction()) return;
    if (getReducedMotion()) {
      onPress();
      return;
    }
    ctx.scene.tweens.add({
      targets: [button.bg, button.text],
      alpha: 0.7,
      duration: 70,
      yoyo: true,
      onComplete: () => {
        button.bg.setAlpha(1);
        button.text.setAlpha(1);
        onPress();
      },
    });
  });
}

export interface FusionResultPanelOptions {
  readonly title: string;
  readonly detail: string;
  readonly tabId: TabId;
  readonly status?: 'success' | 'failure' | 'discovery';
}

export function showFusionResultPanel(
  ctx: FusionTabContext,
  options: FusionResultPanelOptions,
): void {
  const { title, detail, tabId, status = 'success' } = options;
  const ov = ctx.scene.add.container(0, 0).setDepth(95);
  const dim = ctx.scene.add.graphics();
  dim.fillStyle(DUNGEON_UI.VOID, 0.9);
  dim.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  ov.add(dim);
  addInputShield(ctx.scene, ov);

  const px = 28;
  const py = 252;
  const pw = CANVAS_WIDTH - px * 2;
  const ph = 286;
  addPanel(ctx.scene, ov, px, py, pw, ph, TAB_ACCENT[tabId], true);

  const markColor = status === 'failure' ? DUNGEON_UI.EMBER : TAB_ACCENT[tabId];
  const mark = ctx.scene.add.graphics();
  mark.lineStyle(3, markColor, 0.95);
  mark.strokeCircle(CANVAS_WIDTH / 2, py + 62, 27);
  if (status === 'failure') {
    mark.lineBetween(CANVAS_WIDTH / 2 - 9, py + 53, CANVAS_WIDTH / 2 + 9, py + 71);
    mark.lineBetween(CANVAS_WIDTH / 2 + 9, py + 53, CANVAS_WIDTH / 2 - 9, py + 71);
  } else {
    mark.lineBetween(CANVAS_WIDTH / 2 - 11, py + 62, CANVAS_WIDTH / 2 - 2, py + 71);
    mark.lineBetween(CANVAS_WIDTH / 2 - 2, py + 71, CANVAS_WIDTH / 2 + 13, py + 52);
  }
  ov.add(mark);

  ov.add(ctx.scene.add.text(CANVAS_WIDTH / 2, py + 112,
    status === 'discovery' ? '신규 기록' : status === 'failure' ? '의식 불발' : '의식 완료', {
      fontFamily: 'sans-serif', fontSize: '11px', color: DUNGEON_UI_CSS.MUTED,
      fontStyle: 'bold', letterSpacing: 2,
    }).setOrigin(0.5));
  ov.add(ctx.scene.add.text(CANVAS_WIDTH / 2, py + 142, title, {
    fontFamily: 'sans-serif', fontSize: '19px', color: status === 'failure'
      ? DUNGEON_UI_CSS.EMBER
      : TAB_ACCENT_CSS[tabId],
    fontStyle: 'bold', align: 'center', wordWrap: { width: pw - 42 },
  }).setOrigin(0.5));
  ov.add(ctx.scene.add.text(CANVAS_WIDTH / 2, py + 180, detail, {
    fontFamily: 'sans-serif', fontSize: '12px', color: DUNGEON_UI_CSS.TEXT,
    align: 'center', lineSpacing: 5, wordWrap: { width: pw - 44 },
  }).setOrigin(0.5));

  const close = addPrimaryActionButton(ctx.scene, {
    x: px + 24, y: py + ph - 66, w: pw - 48, h: 44,
    label: '의식실로 돌아가기', fontSize: '14px', once: true, showArrow: false,
    fillColor: TAB_ACCENT[tabId], borderColor: DUNGEON_UI.BRASS_BRIGHT,
    hoverFillColor: TAB_ACCENT[tabId], hoverBorderColor: DUNGEON_UI.BRASS_BRIGHT,
    onPress: () => {
      ov.destroy(true);
      ctx.finishTransaction();
      ctx.refreshHeader();
      ctx.refreshTab();
    },
  });
  ov.add([close.bg, close.text, close.zone]);

  if (!getReducedMotion()) {
    ov.setAlpha(0);
    ctx.scene.tweens.add({ targets: ov, alpha: 1, duration: 160, ease: 'Quad.easeOut' });
  }
}

export function openMonsterPicker(
  ctx: FusionTabContext,
  filter: ((m: OwnedMonster) => boolean) | undefined,
  onSelect: (m: OwnedMonster) => void,
): void {
  const gs = loadGameState();
  gs.ownedMonsters.forEach((monster, index) => pickerSourceIndices.set(monster, index));
  const monsters = filter ? gs.ownedMonsters.filter(filter) : gs.ownedMonsters;
  const pageSize = 8;
  const pageCount = Math.max(1, Math.ceil(monsters.length / pageSize));
  let page = 0;
  let closing = false;

  const sheetH = 400;
  const targetY = CANVAS_HEIGHT - sheetH;
  const sheet = ctx.scene.add.container(0, getReducedMotion() ? targetY : CANVAS_HEIGHT).setDepth(80);
  const dim = ctx.scene.add.graphics();
  dim.fillStyle(DUNGEON_UI.VOID, 0.82);
  dim.fillRect(0, -CANVAS_HEIGHT, CANVAS_WIDTH, CANVAS_HEIGHT);
  sheet.add(dim);
  // The sheet itself animates from below the viewport, so the shield must span
  // both its travel distance and the final full-screen position.
  sheet.add(ctx.scene.add.zone(0, -CANVAS_HEIGHT, CANVAS_WIDTH, CANVAS_HEIGHT + sheetH)
    .setOrigin(0).setInteractive({ useHandCursor: false }));

  const bg = ctx.scene.add.graphics();
  bg.fillStyle(DUNGEON_UI.SOOT, 1);
  bg.fillRoundedRect(0, 0, CANVAS_WIDTH, sheetH, { tl: 14, tr: 14, bl: 0, br: 0 });
  bg.lineStyle(2, DUNGEON_UI.BRASS, 0.7);
  bg.strokeRoundedRect(0, 0, CANVAS_WIDTH, sheetH, { tl: 14, tr: 14, bl: 0, br: 0 });
  sheet.add(bg);
  sheet.add(ctx.scene.add.zone(0, 0, CANVAS_WIDTH, sheetH).setOrigin(0).setInteractive());

  sheet.add(ctx.scene.add.text(20, 24, '의식 대상 선택', {
    fontFamily: 'sans-serif', fontSize: '16px', color: DUNGEON_UI_CSS.BRASS, fontStyle: 'bold',
  }).setOrigin(0, 0.5));

  const pageContainer = ctx.scene.add.container(0, 0);
  sheet.add(pageContainer);

  const closeSheet = (): void => {
    if (closing) return;
    closing = true;
    const done = (): void => {
      sheet.destroy(true);
      ctx.refreshTab();
    };
    if (getReducedMotion()) done();
    else ctx.scene.tweens.add({ targets: sheet, y: CANVAS_HEIGHT, duration: 180, ease: 'Quad.easeIn', onComplete: done });
  };

  const drawPage = (): void => {
    pageContainer.removeAll(true);
    const visible = monsters.slice(page * pageSize, (page + 1) * pageSize);
    if (visible.length === 0) {
      pageContainer.add(ctx.scene.add.text(CANVAS_WIDTH / 2, 182, '조건에 맞는 몬스터가 없습니다', {
        fontFamily: 'sans-serif', fontSize: '13px', color: DUNGEON_UI_CSS.MUTED,
      }).setOrigin(0.5));
    }

    const cols = 4;
    const cellW = 80;
    const cellH = 108;
    const gapX = 10;
    const startX = (CANVAS_WIDTH - (cols * cellW + (cols - 1) * gapX)) / 2;
    visible.forEach((monster, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = startX + col * (cellW + gapX);
      const y = 52 + row * 116;
      addPanel(ctx.scene, pageContainer, x, y, cellW, cellH, DUNGEON_UI.EDGE);
      addMonsterPortrait(ctx.scene, pageContainer, x + cellW / 2, y + 38, monster.id, {
        size: 54,
        frameColor: DUNGEON_UI.BRASS,
        glowColor: DUNGEON_UI.BRASS,
        bgColor: DUNGEON_UI.VOID,
        equippedSkins: gs.equippedSkins,
      });
      pageContainer.add(ctx.scene.add.text(x + cellW / 2, y + 76, getMonsterDisplayName(monster.id), {
        fontFamily: 'sans-serif', fontSize: '10px', color: DUNGEON_UI_CSS.TEXT,
        fontStyle: 'bold', align: 'center', wordWrap: { width: cellW - 8 },
      }).setOrigin(0.5));
      const rarity = monster.rarity ?? getMonsterRarity(monster.id);
      pageContainer.add(ctx.scene.add.text(x + cellW / 2, y + 96, `Lv.${monster.level} · ${RARITY_STARS[rarity]}`, {
        fontFamily: 'sans-serif', fontSize: '10px', color: DUNGEON_UI_CSS.MUTED,
      }).setOrigin(0.5));
      const zone = ctx.scene.add.zone(x, y, cellW, cellH).setOrigin(0)
        .setInteractive({ useHandCursor: true });
      zone.once('pointerdown', () => {
        if (closing) return;
        closing = true;
        const select = (): void => {
          sheet.destroy(true);
          onSelect(monster);
        };
        if (getReducedMotion()) select();
        else ctx.scene.tweens.add({ targets: sheet, y: CANVAS_HEIGHT, duration: 160, ease: 'Quad.easeIn', onComplete: select });
      });
      pageContainer.add(zone);
    });

    pageContainer.add(ctx.scene.add.text(CANVAS_WIDTH / 2, 306, `${page + 1} / ${pageCount}`, {
      fontFamily: 'sans-serif', fontSize: '11px', color: DUNGEON_UI_CSS.MUTED, fontStyle: 'bold',
    }).setOrigin(0.5));

    const prev = addPrimaryActionButton(ctx.scene, {
      x: 20, y: 284, w: 76, h: 44, label: '이전', fontSize: '12px', once: true, showArrow: false,
      enabled: page > 0, fillColor: DUNGEON_UI.STONE_RAISED, borderColor: DUNGEON_UI.EDGE,
      hoverFillColor: DUNGEON_UI.IRON, hoverBorderColor: DUNGEON_UI.BRASS,
      disabledFillColor: DUNGEON_UI.SOOT, disabledBorderColor: DUNGEON_UI.IRON,
      disabledTextColor: '#596359',
      onPress: () => { page--; drawPage(); },
    });
    const next = addPrimaryActionButton(ctx.scene, {
      x: CANVAS_WIDTH - 96, y: 284, w: 76, h: 44, label: '다음', fontSize: '12px', once: true, showArrow: false,
      enabled: page < pageCount - 1, fillColor: DUNGEON_UI.STONE_RAISED, borderColor: DUNGEON_UI.EDGE,
      hoverFillColor: DUNGEON_UI.IRON, hoverBorderColor: DUNGEON_UI.BRASS,
      disabledFillColor: DUNGEON_UI.SOOT, disabledBorderColor: DUNGEON_UI.IRON,
      disabledTextColor: '#596359',
      onPress: () => { page++; drawPage(); },
    });
    pageContainer.add([prev.bg, prev.text, prev.zone, next.bg, next.text, next.zone]);
  };
  drawPage();

  const close = addPrimaryActionButton(ctx.scene, {
    x: 20, y: 340, w: CANVAS_WIDTH - 40, h: 44, label: '선택 닫기', fontSize: '13px',
    once: true, showArrow: false, fillColor: DUNGEON_UI.STONE_RAISED,
    borderColor: DUNGEON_UI.EDGE, hoverFillColor: DUNGEON_UI.IRON,
    hoverBorderColor: DUNGEON_UI.BRASS, onPress: closeSheet,
  });
  sheet.add([close.bg, close.text, close.zone]);

  if (!getReducedMotion()) {
    ctx.scene.tweens.add({ targets: sheet, y: targetY, duration: 220, ease: 'Quad.easeOut' });
  }
}

export function showConfirmDialog(
  ctx: FusionTabContext,
  title: string,
  detail: string,
  tabId: TabId,
  onConfirm: () => void,
): void {
  const pw = 320;
  const ph = 238;
  const px = (CANVAS_WIDTH - pw) / 2;
  const py = (CANVAS_HEIGHT - ph) / 2;
  const ov = ctx.scene.add.container(0, 0).setDepth(85);
  let settled = false;

  const dim = ctx.scene.add.graphics();
  dim.fillStyle(DUNGEON_UI.VOID, 0.88);
  dim.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  ov.add(dim);
  addInputShield(ctx.scene, ov);
  addPanel(ctx.scene, ov, px, py, pw, ph, TAB_ACCENT[tabId], true);
  ov.add(ctx.scene.add.zone(px, py, pw, ph).setOrigin(0).setInteractive());

  ov.add(ctx.scene.add.text(CANVAS_WIDTH / 2, py + 34, '최종 확인', {
    fontFamily: 'sans-serif', fontSize: '11px', color: DUNGEON_UI_CSS.MUTED,
    fontStyle: 'bold', letterSpacing: 2,
  }).setOrigin(0.5));
  ov.add(ctx.scene.add.text(CANVAS_WIDTH / 2, py + 65, title, {
    fontFamily: 'sans-serif', fontSize: '17px', color: TAB_ACCENT_CSS[tabId],
    fontStyle: 'bold', align: 'center', wordWrap: { width: pw - 36 },
  }).setOrigin(0.5));
  ov.add(ctx.scene.add.text(CANVAS_WIDTH / 2, py + 115, detail, {
    fontFamily: 'sans-serif', fontSize: '12px', color: DUNGEON_UI_CSS.TEXT,
    align: 'center', lineSpacing: 5, wordWrap: { width: pw - 40 },
  }).setOrigin(0.5));

  const cancel = addPrimaryActionButton(ctx.scene, {
    x: px + 18, y: py + ph - 62, w: 132, h: 44, label: '취소', fontSize: '13px',
    once: true, showArrow: false, fillColor: DUNGEON_UI.STONE_RAISED,
    borderColor: DUNGEON_UI.EDGE, hoverFillColor: DUNGEON_UI.IRON,
    hoverBorderColor: DUNGEON_UI.BRASS,
    onPress: () => {
      if (settled) return;
      settled = true;
      ov.destroy(true);
      ctx.finishTransaction();
      ctx.refreshHeader();
      ctx.refreshTab();
    },
  });
  const confirm = addPrimaryActionButton(ctx.scene, {
    x: px + pw - 150, y: py + ph - 62, w: 132, h: 44, label: '의식 실행', fontSize: '13px',
    once: true, showArrow: false, fillColor: TAB_ACCENT[tabId],
    borderColor: DUNGEON_UI.BRASS_BRIGHT, hoverFillColor: TAB_ACCENT[tabId],
    hoverBorderColor: DUNGEON_UI.BRASS_BRIGHT,
    onPress: () => {
      if (settled) return;
      settled = true;
      ov.destroy(true);
      onConfirm();
    },
  });
  ov.add([cancel.bg, cancel.text, cancel.zone, confirm.bg, confirm.text, confirm.zone]);

  if (!getReducedMotion()) {
    ov.setAlpha(0);
    ctx.scene.tweens.add({ targets: ov, alpha: 1, duration: 140, ease: 'Quad.easeOut' });
  }
}

export { buildEvolutionTab, type EvolutionState } from './FusionEvolutionTab';
export { buildAbsorptionTab, type AbsorptionState } from './FusionAbsorptionTab';
export { buildCombinationTab, type CombinationState } from './FusionCombinationTab';
export { buildAwakeningTab, type AwakeningState } from './FusionAwakeningTab';
