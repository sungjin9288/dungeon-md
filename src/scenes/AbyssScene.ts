/**
 * 심연 (The Abyss) — material-farming hub scene.
 *
 * A descending tower of floors. Climb the next floor (battle) to advance depth
 * and earn a first-clear bonus; SWEEP any cleared floor instantly (spends an
 * Abyss Key) to farm its materials for evolution (Fusion) + crafting (Forge).
 */

import Phaser from 'phaser';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../constants/layout';
import { CASUAL, CASUAL_CSS } from '../constants/colors';
import { loadGameState, saveGameState, type GameState } from '../data/wisdom';
import { MATERIAL_DEFS } from '../data/fusion';
import {
  ABYSS_MAX_FLOOR, ABYSS_KEY_MAX,
  getAbyssFloorConfig, getAbyssFloorLoot, isAbyssBossFloor,
  refilledKeys, canSweepAbyss, nextAbyssFloor,
} from '../data/abyss';
import { sweepAbyssFloor } from '../data/abyssTransactions';
import { addSceneHeader, addPrimaryActionButton } from '../ui/GameUiPrimitives';

const CARD_X = 14;
const CARD_W = CANVAS_WIDTH - 28;
const CARD_H = 86;
const LIST_TOP = 150;
const CARD_GAP = 10;

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export class AbyssScene extends Phaser.Scene {
  private gs!: GameState;
  private maxScrollY = 0;
  private dragStartY = 0;
  private dragging = false;

  constructor() { super({ key: 'AbyssScene' }); }

  create(): void {
    this.gs = loadGameState();
    // Daily key refill on entry.
    const refilled = refilledKeys(this.gs.abyss, today());
    if (refilled !== this.gs.abyss) {
      this.gs = { ...this.gs, abyss: refilled };
      saveGameState(this.gs);
    }
    this.render();
  }

  private render(): void {
    this.children.removeAll();
    this.cameras.main.setScroll(0, 0);

    addSceneHeader(this, {
      title: '심연',
      subtitle: '재료 파밍 · 진화 · 장비 제작',
      onBack: () => this.scene.start('StageSelectScene'),
    });

    this.drawStatusBar();
    this.drawFloorList();
    this.setupScroll();
  }

  // ─── Status bar: depth + keys ──────────────────────────────────────────────
  private drawStatusBar(): void {
    const y = 92, w = CANVAS_WIDTH - 28;
    const g = this.add.graphics().setScrollFactor(0).setDepth(20);
    g.fillStyle(CASUAL.SHADOW, 0.4); g.fillRoundedRect(14, y + 3, w, 40, 12);
    g.fillStyle(CASUAL.PANEL, 1);    g.fillRoundedRect(14, y, w, 40, 12);
    g.fillStyle(0xffffff, 0.08);     g.fillRoundedRect(18, y + 3, w - 8, 4, 2);
    g.lineStyle(2.5, CASUAL.EDGE, 1);g.strokeRoundedRect(14, y, w, 40, 12);

    this.add.text(28, y + 20, `🗝 심연 열쇠  ${this.gs.abyss.keys}/${ABYSS_KEY_MAX}`, {
      fontFamily: 'sans-serif', fontSize: '13px', color: CASUAL_CSS.GOLD, fontStyle: 'bold',
    }).setOrigin(0, 0.5).setScrollFactor(0).setDepth(21);

    const deepest = this.gs.abyss.highestFloor;
    this.add.text(CANVAS_WIDTH - 28, y + 20, `최심 도달  ${deepest}/${ABYSS_MAX_FLOOR}층`, {
      fontFamily: 'sans-serif', fontSize: '13px', color: CASUAL_CSS.INK, fontStyle: 'bold',
    }).setOrigin(1, 0.5).setScrollFactor(0).setDepth(21);
  }

  // ─── Floor list (descent) ──────────────────────────────────────────────────
  private drawFloorList(): void {
    const next = nextAbyssFloor(this.gs.abyss);
    // Show every reachable floor (1..next), shallowest at top → descend downward.
    const floors: number[] = [];
    for (let f = 1; f <= next; f++) floors.push(f);

    floors.forEach((floor, i) => {
      const y = LIST_TOP + i * (CARD_H + CARD_GAP);
      this.drawFloorCard(floor, y);
    });

    const contentBottom = LIST_TOP + floors.length * (CARD_H + CARD_GAP) + 20;
    this.maxScrollY = Math.max(0, contentBottom - CANVAS_HEIGHT);
    this.cameras.main.setBounds(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT + this.maxScrollY);
  }

  private drawFloorCard(floor: number, y: number): void {
    const cfg = getAbyssFloorConfig(floor);
    const cleared = floor <= this.gs.abyss.highestFloor;
    const isNext = floor === this.gs.abyss.highestFloor + 1;
    const boss = isAbyssBossFloor(floor);
    const accent = boss ? CASUAL.PURPLE : cleared ? CASUAL.GREEN : CASUAL.GOLD;

    const g = this.add.graphics();
    g.fillStyle(CASUAL.SHADOW, 0.35); g.fillRoundedRect(CARD_X, y + 4, CARD_W, CARD_H, 12);
    g.fillStyle(CASUAL.PANEL, 1);     g.fillRoundedRect(CARD_X, y, CARD_W, CARD_H, 12);
    g.fillStyle(0xffffff, 0.07);      g.fillRoundedRect(CARD_X + 5, y + 4, CARD_W - 10, 5, 3);
    g.lineStyle(3, accent, 1);        g.strokeRoundedRect(CARD_X, y, CARD_W, CARD_H, 12);

    // Floor number plate (pixel-ish stone tile)
    g.fillStyle(CASUAL.PANEL_SOFT, 1); g.fillRoundedRect(CARD_X + 10, y + 12, 54, 54, 8);
    g.lineStyle(2, accent, 0.9);       g.strokeRoundedRect(CARD_X + 10, y + 12, 54, 54, 8);
    this.add.text(CARD_X + 37, y + 32, `${floor}`, {
      fontFamily: 'sans-serif', fontSize: '22px', fontStyle: 'bold',
      color: CASUAL_CSS.INK, stroke: '#000000', strokeThickness: 2,
    }).setOrigin(0.5);
    this.add.text(CARD_X + 37, y + 54, boss ? '보스' : '층', {
      fontFamily: 'sans-serif', fontSize: '10px', fontStyle: 'bold',
      color: boss ? CASUAL_CSS.PURPLE : CASUAL_CSS.INK_SOFT,
    }).setOrigin(0.5);

    // Band label + recommended power
    this.add.text(CARD_X + 76, y + 16, `${cfg.bandLabel}${boss ? ' · 보스' : ''}`, {
      fontFamily: 'sans-serif', fontSize: '12px', fontStyle: 'bold', color: CASUAL_CSS.INK,
    }).setOrigin(0, 0);
    this.add.text(CARD_X + 76, y + 34, `권장 전투력 ${cfg.recommendedPower}`, {
      fontFamily: 'sans-serif', fontSize: '10px', color: CASUAL_CSS.INK_SOFT,
    }).setOrigin(0, 0);

    // Loot preview (material emojis)
    const lootIds = [...new Set(getAbyssFloorLoot(floor).map(e => e.id))].slice(0, 6);
    const emojis = lootIds.map(id => MATERIAL_DEFS[id]?.emoji ?? '❔').join(' ');
    this.add.text(CARD_X + 76, y + 52, emojis, {
      fontFamily: 'sans-serif', fontSize: '14px',
    }).setOrigin(0, 0);

    // Action button
    const btnX = CARD_X + CARD_W - 96, btnW = 88, btnY = y + 24, btnH = 38;
    if (isNext) {
      addPrimaryActionButton(this, {
        x: btnX, y: btnY, w: btnW, h: btnH, label: '⚔ 도전', fontSize: '14px',
        fillColor: CASUAL.GOLD, hoverFillColor: 0xffd66a, borderColor: CASUAL.GOLD_DK,
        onPress: () => this.climb(floor),
      });
    } else if (cleared) {
      const canSweep = canSweepAbyss(this.gs.abyss, floor).ok;
      addPrimaryActionButton(this, {
        x: btnX, y: btnY, w: btnW, h: btnH, label: '🗝 소탕', fontSize: '14px',
        enabled: canSweep,
        fillColor: CASUAL.GREEN, hoverFillColor: 0x6fdc70, borderColor: CASUAL.GREEN_DK,
        onPress: () => this.sweep(floor),
      });
    }
  }

  // ─── Actions ───────────────────────────────────────────────────────────────
  private sweep(floor: number): void {
    const result = sweepAbyssFloor(this.gs, floor, today());
    if (!result.ok || !result.loot) {
      this.showToast(result.reason === 'no_keys' ? '열쇠가 부족합니다' : '아직 잠긴 층입니다', CASUAL_CSS.RED);
      return;
    }
    this.gs = result.state;
    saveGameState(this.gs);
    this.showLootToast(result.loot.materials, result.loot.awakeningStones, result.loot.gold);
    this.render();
  }

  private climb(floor: number): void {
    // TODO(next): launch the scaled floor battle (inline abyss waves) and, on
    // victory return, apply clearAbyssFloor() to advance depth + grant the
    // first-clear bonus. Needs the battle clear-flow to honour returnTo +
    // surface an abyss win signal. Stubbed for now to avoid a broken battle.
    void floor;
    this.showToast('층 전투는 다음 업데이트에서 연결됩니다 ⚔', CASUAL_CSS.GOLD);
  }

  // ─── Toasts ────────────────────────────────────────────────────────────────
  private showLootToast(materials: Record<string, number>, stones: number, gold: number): void {
    const parts: string[] = [];
    for (const [id, qty] of Object.entries(materials)) parts.push(`${MATERIAL_DEFS[id]?.emoji ?? '❔'}${qty}`);
    if (stones > 0) parts.push(`🔯${stones}`);
    if (gold > 0) parts.push(`💰${gold}`);
    this.showToast(`획득  ${parts.join('  ')}`, CASUAL_CSS.GOLD);
  }

  private showToast(msg: string, color: string): void {
    const t = this.add.text(CANVAS_WIDTH / 2, CANVAS_HEIGHT - 80, msg, {
      fontFamily: 'sans-serif', fontSize: '14px', color, fontStyle: 'bold',
      backgroundColor: CASUAL_CSS.CREAM, padding: { x: 16, y: 9 },
      align: 'center', wordWrap: { width: CANVAS_WIDTH - 60 },
    }).setOrigin(0.5).setScrollFactor(0).setDepth(80).setAlpha(0);
    this.tweens.add({ targets: t, alpha: 1, y: t.y - 14, duration: 250, ease: 'Back.easeOut' });
    this.time.delayedCall(1900, () => {
      this.tweens.add({ targets: t, alpha: 0, duration: 300, onComplete: () => t.destroy() });
    });
  }

  // ─── Scroll (camera drag) ──────────────────────────────────────────────────
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
