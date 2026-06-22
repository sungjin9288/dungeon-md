/**
 * 생산 시설 (Production facilities) hub — the dungeon's in-base farming/mining.
 *
 * Build & upgrade facilities (광산/약초원/직조실/마력 우물/보물고) that passively
 * produce crafting materials + gold over the shared idle clock. Collect the
 * accrued production here or from the home idle panel — whichever resets the
 * clock. Fits on one screen (5 facilities) so no scroll → no DPR camera pitfalls.
 */

import Phaser from 'phaser';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../constants/layout';
import { CASUAL, CASUAL_CSS } from '../constants/colors';
import { loadGameState, saveGameState, type GameState } from '../data/wisdom';
import { MATERIAL_DEFS } from '../data/fusion';
import {
  FACILITY_DEFS, FACILITY_ORDER, facilityRatePerHour, facilityUpgradeCost,
} from '../data/production';
import { buildOrUpgradeFacility } from '../data/productionTransactions';
import { computeIdleReward, collectIdleIncome, hasIdlePayout, type IdleReward } from '../data/idleIncome';
import { addSceneHeader, addPrimaryActionButton, addPillTag, addIconMedallion } from '../ui/GameUiPrimitives';
import { getReducedMotion } from '../utils/reducedMotion';

const CARD_X = 14;
const CARD_W = CANVAS_WIDTH - 28;
const CARD_H = 92;
const LIST_TOP = 214;
const CARD_GAP = 8;

function now(): number { return Date.now(); }

export class ProductionScene extends Phaser.Scene {
  private gs!: GameState;

  constructor() { super({ key: 'ProductionScene' }); }

  create(): void {
    this.gs = loadGameState();
    this.render();
  }

  private render(): void {
    this.children.removeAll();
    // NOTE: do NOT setScroll(0,0) here. main.ts applyDprCamera centers the camera
    // (zoom=dpr + centerOn) on scene CREATE only; this view doesn't scroll, so
    // resetting scroll on a re-render (after build/collect) would de-center the
    // whole scene until the next scene change. Leave the DPR-centered camera alone.

    addSceneHeader(this, {
      title: '🏭 생산 시설',
      subtitle: '방치 재료·골드 생산',
      onBack: () => this.scene.start('StageSelectScene'),
    });

    this.drawCollectBar();
    FACILITY_ORDER.forEach((id, i) => this.drawFacilityCard(id, LIST_TOP + i * (CARD_H + CARD_GAP)));
  }

  // ─── Accrued-production collect bar ────────────────────────────────────────
  private drawCollectBar(): void {
    const y = 92, w = CANVAS_WIDTH - 28;
    const reward = computeIdleReward(this.gs, now());

    const g = this.add.graphics();
    g.fillStyle(CASUAL.SHADOW, 0.4); g.fillRoundedRect(14, y + 3, w, 56, 12);
    g.fillStyle(CASUAL.PANEL, 1);    g.fillRoundedRect(14, y, w, 56, 12);
    g.fillStyle(0xffffff, 0.07);     g.fillRoundedRect(18, y + 3, w - 8, 4, 2);
    g.lineStyle(2, CASUAL.EDGE, 1);  g.strokeRoundedRect(14, y, w, 56, 12);

    this.add.text(26, y + 13, '🪙 보유 골드', {
      fontFamily: 'sans-serif', fontSize: '10px', color: CASUAL_CSS.INK_SOFT, fontStyle: 'bold',
    }).setOrigin(0, 0.5);
    this.add.text(26, y + 33, `${this.gs.homeGold.toLocaleString('ko-KR')}`, {
      fontFamily: 'sans-serif', fontSize: '15px', color: CASUAL_CSS.GOLD, fontStyle: 'bold',
    }).setOrigin(0, 0.5);

    // Accrued production preview + collect button.
    const parts = this.rewardParts(reward);
    this.add.text(150, y + 13, '방치 누적', {
      fontFamily: 'sans-serif', fontSize: '10px', color: CASUAL_CSS.INK_SOFT, fontStyle: 'bold',
    }).setOrigin(0, 0.5);
    this.add.text(150, y + 33, parts.length ? parts : '—', {
      fontFamily: 'sans-serif', fontSize: '12px', color: CASUAL_CSS.INK, fontStyle: 'bold',
    }).setOrigin(0, 0.5);

    const payable = hasIdlePayout(reward);
    const btnX = CANVAS_WIDTH - 14 - 86;
    // pulsing glow when production is ready to collect — the tycoon "come tap me" cue
    if (payable) {
      const glow = this.add.graphics();
      glow.fillStyle(CASUAL.GOLD, 0.34);
      glow.fillRoundedRect(btnX - 5, y + 9, 96, 40, 16);
      // perpetual pulse is decorative → gate behind reduced-motion (static glow stays)
      if (!getReducedMotion()) {
        this.tweens.add({ targets: glow, alpha: { from: 0.45, to: 1 }, duration: 760, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      }
    }
    addPrimaryActionButton(this, {
      x: btnX, y: y + 11, w: 86, h: 34, label: payable ? '✨ 수령' : '수령', fontSize: '14px',
      enabled: payable,
      fillColor: CASUAL.GREEN, hoverFillColor: 0x6fdc70, borderColor: CASUAL.GREEN_DK,
      onPress: () => this.collect(),
    });
  }

  private rewardParts(reward: IdleReward): string {
    const parts: string[] = [];
    if (reward.gold > 0) parts.push(`💰${reward.gold.toLocaleString('ko-KR')}`);
    for (const [id, qty] of Object.entries(reward.materials)) {
      parts.push(`${MATERIAL_DEFS[id]?.emoji ?? '❔'}${qty}`);
    }
    return parts.join('  ');
  }

  // ─── Facility card ─────────────────────────────────────────────────────────
  private drawFacilityCard(id: string, y: number): void {
    const def = FACILITY_DEFS[id];
    const level = this.gs.productionFacilities?.[id] ?? 0;
    const built = level > 0;
    const accent = built ? CASUAL.GOLD : CASUAL.EDGE_SOFT;

    // Card body — raised stone with chiseled bottom + lit top bevel.
    const g = this.add.graphics();
    g.fillStyle(CASUAL.SHADOW, 0.34); g.fillRoundedRect(CARD_X, y + 4, CARD_W, CARD_H, 14);
    g.fillStyle(CASUAL.PANEL, 1);     g.fillRoundedRect(CARD_X, y, CARD_W, CARD_H, 14);
    // built facilities glow with a warm gold tint so "active" cards read at a glance
    if (built) { g.fillStyle(CASUAL.GOLD, 0.07); g.fillRoundedRect(CARD_X, y, CARD_W, CARD_H, 14); }
    g.fillStyle(0xffffff, 0.06);      g.fillRoundedRect(CARD_X + 6, y + 4, CARD_W - 12, 5, 3);
    // bottom inner shade for depth
    g.fillStyle(CASUAL.SHADOW, 0.22);  g.fillRoundedRect(CARD_X + 6, y + CARD_H * 0.62, CARD_W - 12, CARD_H * 0.34, 8);
    g.lineStyle(3, accent, built ? 1 : 0.75); g.strokeRoundedRect(CARD_X, y, CARD_W, CARD_H, 14);
    // left accent strip — "active production" signal on built cards
    if (built) { g.fillStyle(CASUAL.GOLD, 0.9); g.fillRoundedRect(CARD_X + 3, y + 10, 4, CARD_H - 20, 2); }

    // Icon medallion (accent ring + glow) instead of a flat dark tile
    addIconMedallion(this, { cx: CARD_X + 42, cy: y + CARD_H / 2, size: 58, emoji: def.emoji, accent, glow: built });

    // Name
    const nameText = this.add.text(CARD_X + 82, y + 15, def.name, {
      fontFamily: 'sans-serif', fontSize: '15px', fontStyle: 'bold', color: CASUAL_CSS.INK,
    }).setOrigin(0, 0);
    // State badge pill — Lv.N (gold) / 미건설 (muted)
    addPillTag(this, {
      x: CARD_X + 82 + Math.ceil(nameText.width) + 8, y: y + 22,
      label: built ? `Lv.${level}` : '미건설',
      fillColor: built ? CASUAL.GOLD : CASUAL.PANEL_SOFT,
      borderColor: built ? CASUAL.GOLD_DK : CASUAL.EDGE_SOFT,
      textColor: built ? '#2b2114' : CASUAL_CSS.INK_SOFT,
      fontSize: '10px', height: 17,
    });

    // Production-rate chip (icon + per-hour output)
    const rate = facilityRatePerHour(def, built ? level : 1);
    const outIcon = def.output.kind === 'gold' ? '💰' : (MATERIAL_DEFS[def.output.materialId]?.emoji ?? '❔');
    addPillTag(this, {
      x: CARD_X + 82, y: y + 44,
      icon: outIcon, label: `${built ? '' : '건설 시 '}+${rate}/시간`,
      fillColor: CASUAL.PANEL_SOFT,
      borderColor: built ? CASUAL.GOLD_DK : CASUAL.EDGE_SOFT,
      textColor: built ? CASUAL_CSS.GOLD : CASUAL_CSS.INK_SOFT,
      fontSize: '10px', height: 18,
    });
    this.add.text(CARD_X + 82, y + 66, def.desc, {
      fontFamily: 'sans-serif', fontSize: '9px', color: CASUAL_CSS.INK_SOFT,
    }).setOrigin(0, 0);

    // Build / upgrade button
    const cost = facilityUpgradeCost(def, level);
    const btnX = CARD_X + CARD_W - 102, btnW = 92, btnY = y + 26, btnH = 40;
    if (cost === null) {
      addPillTag(this, {
        x: btnX + 22, y: btnY + btnH / 2, icon: '👑', label: 'MAX',
        fillColor: CASUAL.GOLD, borderColor: CASUAL.GOLD_DK, textColor: '#2b2114',
        fontSize: '12px', height: 26, glowColor: CASUAL.GOLD,
      });
    } else {
      const affordable = this.gs.homeGold >= cost;
      // affordable CTA glow — draws the eye to the actionable button
      if (affordable) {
        const glow = this.add.graphics();
        glow.fillStyle(built ? CASUAL.BLUE : CASUAL.GREEN, 0.30);
        glow.fillRoundedRect(btnX - 4, btnY - 2, btnW + 8, btnH + 10, 16);
      }
      addPrimaryActionButton(this, {
        x: btnX, y: btnY, w: btnW, h: btnH,
        label: built ? `Lv.${level}→${level + 1}` : '건설',
        fontSize: '12px',
        enabled: affordable,
        fillColor: built ? CASUAL.BLUE : CASUAL.GREEN,
        hoverFillColor: built ? 0x6aa8e0 : 0x6fdc70,
        borderColor: built ? CASUAL.BLUE_DK : CASUAL.GREEN_DK,
        onPress: () => this.build(id),
      });
      this.add.text(btnX + btnW / 2, btnY + btnH + 7, `💰${cost.toLocaleString('ko-KR')}`, {
        fontFamily: 'sans-serif', fontSize: '10px', fontStyle: 'bold',
        color: affordable ? CASUAL_CSS.GOLD : CASUAL_CSS.RED,
      }).setOrigin(0.5);
    }
  }

  // ─── Actions ───────────────────────────────────────────────────────────────
  private build(id: string): void {
    const r = buildOrUpgradeFacility(this.gs, id);
    if (!r.ok) {
      this.showToast(r.reason === 'no_gold' ? '골드가 부족합니다' : r.reason === 'maxed' ? '최대 레벨입니다' : '건설 불가', CASUAL_CSS.RED);
      return;
    }
    // First build initializes the idle clock so production starts accruing now.
    const seeded = (this.gs.lastIdleCollect ?? 0) > 0 ? r.state : { ...r.state, lastIdleCollect: now() };
    this.gs = seeded;
    saveGameState(this.gs);
    const def = FACILITY_DEFS[id];
    this.showToast(`${def.emoji} ${def.name} ${r.newLevel === 1 ? '건설' : `Lv.${r.newLevel}`} 완료`, CASUAL_CSS.GOLD);
    this.render();
  }

  private collect(): void {
    const { state, reward } = collectIdleIncome(this.gs, now());
    if (!hasIdlePayout(reward)) { this.showToast('아직 모인 생산이 없습니다', CASUAL_CSS.INK_SOFT); return; }
    this.gs = state;
    saveGameState(this.gs);
    this.showToast(`방치 수령  ${this.rewardParts(reward)}`, CASUAL_CSS.GOLD);
    this.render();
  }

  // ─── Toast ─────────────────────────────────────────────────────────────────
  private showToast(msg: string, color: string): void {
    const t = this.add.text(CANVAS_WIDTH / 2, CANVAS_HEIGHT - 90, msg, {
      fontFamily: 'sans-serif', fontSize: '14px', color, fontStyle: 'bold',
      backgroundColor: CASUAL_CSS.CREAM, padding: { x: 16, y: 9 },
      align: 'center', wordWrap: { width: CANVAS_WIDTH - 60 },
    }).setOrigin(0.5).setDepth(80).setAlpha(0);
    this.tweens.add({ targets: t, alpha: 1, y: t.y - 14, duration: 250, ease: 'Back.easeOut' });
    this.time.delayedCall(1700, () => {
      this.tweens.add({ targets: t, alpha: 0, duration: 300, onComplete: () => t.destroy() });
    });
  }
}
