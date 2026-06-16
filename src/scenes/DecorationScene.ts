/**
 * 던전 장식 (Decorations) hub — collect, place, and combine decorations/trap
 * tools for SET bonuses. Acquire by buying (gold) or crafting (materials); place
 * within your slots; matching sets grant escalating bonuses to idle income +
 * combat. Camera-drag scroll with scrollFactor-1 content (DPR-safe).
 */

import Phaser from 'phaser';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../constants/layout';
import { CASUAL, CASUAL_CSS } from '../constants/colors';
import { loadGameState, saveGameState, type GameState } from '../data/wisdom';
import { MATERIAL_DEFS } from '../data/fusion';
import {
  DECORATION_DEFS, SET_DEFS, SET_ORDER, decorationsInSet, activeSetTier,
  computeDecorationBonuses, decorationSlots, type DecorationDef, type DecorationBonuses,
} from '../data/decorations';
import { acquireDecoration, placeDecoration, unplaceDecoration } from '../data/decorationTransactions';
import { addSceneHeader, addPrimaryActionButton } from '../ui/GameUiPrimitives';

const PAD = 14;
const W = CANVAS_WIDTH - PAD * 2;
const TOP = 96;
const CARD_H = 64;
const CARD_GAP = 7;
const SET_HEAD_H = 26;
const SET_GAP = 12;

const SET_ACCENT: Record<string, number> = {
  bounty: CASUAL.GOLD, guardian: CASUAL.BLUE, trapper: CASUAL.GREEN,
};

const BONUS_LABELS: Array<{ key: keyof DecorationBonuses; label: string }> = [
  { key: 'idleGoldPct', label: '방치골드' },
  { key: 'idleProductionPct', label: '생산' },
  { key: 'dungeonHpPct', label: '던전HP' },
  { key: 'trapDmgPct', label: '함정' },
];

export class DecorationScene extends Phaser.Scene {
  private gs!: GameState;
  private maxScrollY = 0;
  private dragStartY = 0;
  private dragging = false;

  constructor() { super({ key: 'DecorationScene' }); }

  create(): void {
    this.gs = loadGameState();
    this.render();
  }

  private render(): void {
    this.children.removeAll();
    this.cameras.main.setScroll(0, 0);
    addSceneHeader(this, {
      title: '🎏 던전 장식',
      subtitle: '세트를 모아 배치 → 조합 효과',
      onBack: () => this.scene.start('StageSelectScene'),
    });

    let y = TOP;
    y = this.drawSummary(y) + SET_GAP;
    for (const setId of SET_ORDER) {
      y = this.drawSetHeader(setId, y);
      for (const id of decorationsInSet(setId)) {
        this.drawCard(id, y);
        y += CARD_H + CARD_GAP;
      }
      y += SET_GAP;
    }

    const contentBottom = y + 20;
    this.maxScrollY = Math.max(0, contentBottom - CANVAS_HEIGHT);
    this.cameras.main.setBounds(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT + this.maxScrollY);
    this.setupScroll();
  }

  // ─── Active set-bonus summary ──────────────────────────────────────────────
  private drawSummary(y: number): number {
    const h = 50;
    const placed = this.gs.placedDecorations ?? [];
    const cap = decorationSlots(this.gs.dmLevel);
    const bonuses = computeDecorationBonuses(placed);

    const g = this.add.graphics();
    g.fillStyle(CASUAL.SHADOW, 0.4); g.fillRoundedRect(PAD, y + 3, W, h, 12);
    g.fillStyle(CASUAL.PANEL, 1);    g.fillRoundedRect(PAD, y, W, h, 12);
    g.lineStyle(2, CASUAL.EDGE, 1);  g.strokeRoundedRect(PAD, y, W, h, 12);

    this.add.text(PAD + 12, y + 13, `배치 ${placed.length}/${cap}`, {
      fontFamily: 'sans-serif', fontSize: '12px', fontStyle: 'bold', color: CASUAL_CSS.GOLD,
    }).setOrigin(0, 0.5);

    const parts = BONUS_LABELS
      .filter(b => bonuses[b.key] > 0)
      .map(b => `${b.label}+${bonuses[b.key]}%`);
    this.add.text(PAD + 12, y + 33, parts.length ? `활성 효과  ${parts.join(' · ')}` : '세트를 2개 이상 배치하면 효과 발동', {
      fontFamily: 'sans-serif', fontSize: '10px', fontStyle: 'bold',
      color: parts.length ? CASUAL_CSS.GREEN : CASUAL_CSS.INK_SOFT,
    }).setOrigin(0, 0.5);

    return y + h;
  }

  // ─── Set header ────────────────────────────────────────────────────────────
  private drawSetHeader(setId: string, y: number): number {
    const set = SET_DEFS[setId];
    const accent = SET_ACCENT[setId] ?? CASUAL.GOLD;
    const placedInSet = (this.gs.placedDecorations ?? []).filter(id => DECORATION_DEFS[id]?.setId === setId).length;
    const tierIdx = activeSetTier(setId, placedInSet);

    const g = this.add.graphics();
    g.fillStyle(accent, 0.16); g.fillRoundedRect(PAD, y, W, SET_HEAD_H, 7);
    g.lineStyle(1.5, accent, 0.7); g.strokeRoundedRect(PAD, y, W, SET_HEAD_H, 7);

    this.add.text(PAD + 8, y + SET_HEAD_H / 2, `${set.emoji} ${set.name}  ${placedInSet}/3`, {
      fontFamily: 'sans-serif', fontSize: '12px', fontStyle: 'bold', color: CASUAL_CSS.INK,
    }).setOrigin(0, 0.5);

    const tierTxt = tierIdx >= 0 ? `Lv.${tierIdx + 1} 발동` : set.desc;
    this.add.text(PAD + W - 8, y + SET_HEAD_H / 2, tierTxt, {
      fontFamily: 'sans-serif', fontSize: '10px', fontStyle: 'bold',
      color: tierIdx >= 0 ? CASUAL_CSS.GREEN : CASUAL_CSS.INK_SOFT,
    }).setOrigin(1, 0.5);

    return y + SET_HEAD_H + 4;
  }

  // ─── Decoration card ───────────────────────────────────────────────────────
  private drawCard(id: string, y: number): void {
    const def = DECORATION_DEFS[id];
    const owned = (this.gs.ownedDecorations ?? []).includes(id);
    const placed = (this.gs.placedDecorations ?? []).includes(id);
    const accent = SET_ACCENT[def.setId] ?? CASUAL.GOLD;

    const g = this.add.graphics();
    g.fillStyle(CASUAL.SHADOW, 0.28); g.fillRoundedRect(PAD, y + 3, W, CARD_H, 10);
    g.fillStyle(placed ? CASUAL.PANEL : CASUAL.PANEL_SOFT, 1); g.fillRoundedRect(PAD, y, W, CARD_H, 10);
    g.lineStyle(2.5, placed ? accent : CASUAL.EDGE, placed ? 1 : 0.7); g.strokeRoundedRect(PAD, y, W, CARD_H, 10);

    // Emoji tile
    g.fillStyle(CASUAL.PANEL_SOFT, 1); g.fillRoundedRect(PAD + 8, y + 8, 48, 48, 8);
    g.lineStyle(1.5, accent, 0.8);     g.strokeRoundedRect(PAD + 8, y + 8, 48, 48, 8);
    this.add.text(PAD + 32, y + 32, def.emoji, { fontFamily: 'sans-serif', fontSize: '24px' }).setOrigin(0.5).setAlpha(owned ? 1 : 0.45);

    this.add.text(PAD + 66, y + 14, def.name, {
      fontFamily: 'sans-serif', fontSize: '13px', fontStyle: 'bold', color: owned ? CASUAL_CSS.INK : CASUAL_CSS.INK_SOFT,
    }).setOrigin(0, 0);
    this.add.text(PAD + 66, y + 33, def.desc, {
      fontFamily: 'sans-serif', fontSize: '9px', color: CASUAL_CSS.INK_SOFT,
    }).setOrigin(0, 0);
    if (placed) {
      this.add.text(PAD + 66, y + 47, '✔ 배치됨', {
        fontFamily: 'sans-serif', fontSize: '9px', fontStyle: 'bold', color: CASUAL_CSS.GREEN,
      }).setOrigin(0, 0);
    }

    // Action button (right)
    const btnX = PAD + W - 92, btnW = 84, btnY = y + 14, btnH = 36;
    if (!owned) {
      const affordable = this.canAfford(def);
      addPrimaryActionButton(this, {
        x: btnX, y: btnY, w: btnW, h: btnH, label: '획득', fontSize: '13px',
        enabled: affordable,
        fillColor: CASUAL.GOLD, hoverFillColor: 0xffd66a, borderColor: CASUAL.GOLD_DK,
        onPress: () => this.acquire(id),
      });
      this.add.text(btnX + btnW / 2, btnY + btnH + 4, this.costLabel(def), {
        fontFamily: 'sans-serif', fontSize: '9px', fontStyle: 'bold',
        color: affordable ? CASUAL_CSS.GOLD : CASUAL_CSS.RED,
      }).setOrigin(0.5);
    } else if (placed) {
      addPrimaryActionButton(this, {
        x: btnX, y: btnY, w: btnW, h: btnH, label: '해제', fontSize: '13px',
        fillColor: CASUAL.RED, hoverFillColor: 0xe06a5a, borderColor: CASUAL.RED_DK,
        onPress: () => this.unplace(id),
      });
    } else {
      const hasSlot = (this.gs.placedDecorations ?? []).length < decorationSlots(this.gs.dmLevel);
      addPrimaryActionButton(this, {
        x: btnX, y: btnY, w: btnW, h: btnH, label: '배치', fontSize: '13px',
        enabled: hasSlot,
        fillColor: CASUAL.GREEN, hoverFillColor: 0x6fdc70, borderColor: CASUAL.GREEN_DK,
        onPress: () => this.place(id),
      });
      if (!hasSlot) {
        this.add.text(btnX + btnW / 2, btnY + btnH + 4, '슬롯 부족', {
          fontFamily: 'sans-serif', fontSize: '9px', fontStyle: 'bold', color: CASUAL_CSS.RED,
        }).setOrigin(0.5);
      }
    }
  }

  private canAfford(def: DecorationDef): boolean {
    if (def.cost.kind === 'gold') return this.gs.homeGold >= def.cost.gold;
    return Object.entries(def.cost.materials).every(([m, q]) => (this.gs.materials?.[m] ?? 0) >= q);
  }

  private costLabel(def: DecorationDef): string {
    if (def.cost.kind === 'gold') return `💰${def.cost.gold.toLocaleString('ko-KR')}`;
    return Object.entries(def.cost.materials)
      .map(([m, q]) => `${MATERIAL_DEFS[m]?.emoji ?? '❔'}${q}`).join(' ');
  }

  // ─── Actions ───────────────────────────────────────────────────────────────
  private acquire(id: string): void {
    const r = acquireDecoration(this.gs, id);
    if (!r.ok) {
      this.toast(r.reason === 'no_gold' ? '골드가 부족합니다' : r.reason === 'no_materials' ? '재료가 부족합니다' : '획득 불가', CASUAL_CSS.RED);
      return;
    }
    this.gs = r.state; saveGameState(this.gs);
    this.toast(`${DECORATION_DEFS[id].emoji} ${DECORATION_DEFS[id].name} 획득`, CASUAL_CSS.GOLD);
    this.render();
  }

  private place(id: string): void {
    const r = placeDecoration(this.gs, id);
    if (!r.ok) { this.toast(r.reason === 'no_slots' ? '배치 슬롯이 가득 찼습니다' : '배치 불가', CASUAL_CSS.RED); return; }
    this.gs = r.state; saveGameState(this.gs);
    this.render();
  }

  private unplace(id: string): void {
    this.gs = unplaceDecoration(this.gs, id); saveGameState(this.gs);
    this.render();
  }

  // ─── Toast ─────────────────────────────────────────────────────────────────
  private toast(msg: string, color: string): void {
    const t = this.add.text(CANVAS_WIDTH / 2, CANVAS_HEIGHT - 70, msg, {
      fontFamily: 'sans-serif', fontSize: '14px', color, fontStyle: 'bold',
      backgroundColor: CASUAL_CSS.CREAM, padding: { x: 16, y: 9 }, align: 'center',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(80).setAlpha(0);
    this.tweens.add({ targets: t, alpha: 1, y: t.y - 14, duration: 220, ease: 'Back.easeOut' });
    this.time.delayedCall(1600, () => this.tweens.add({ targets: t, alpha: 0, duration: 280, onComplete: () => t.destroy() }));
  }

  // ─── Scroll ────────────────────────────────────────────────────────────────
  private setupScroll(): void {
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      this.dragging = true; this.dragStartY = p.y + this.cameras.main.scrollY;
    });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (!this.dragging) return;
      this.cameras.main.setScroll(0, Phaser.Math.Clamp(this.dragStartY - p.y, 0, this.maxScrollY));
    });
    this.input.on('pointerup', () => { this.dragging = false; });
  }
}
