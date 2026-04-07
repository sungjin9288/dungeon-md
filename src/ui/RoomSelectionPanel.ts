import Phaser from 'phaser';
import { COLORS, CSS } from '../constants/colors';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../constants/layout';
import { ROOM_DEFS, type RoomType } from '../data/rooms';

const PANEL_H     = 286;
const CARD_W      = 90;
const CARD_H      = 218;
const CARD_GAP    = 6;
const CARD_START  = (CANVAS_WIDTH - 4 * CARD_W - 3 * CARD_GAP) / 2; // ≈ 6px
const HEADER_H    = 50;

export class RoomSelectionPanel extends Phaser.GameObjects.Container {
  static readonly HEIGHT = PANEL_H;

  private pendingRow  = 0;
  private pendingCol  = 0;
  private isOpen      = false;
  private cardGroup:  Phaser.GameObjects.GameObject[] = [];
  private onPlaceCb:  (row: number, col: number, type: RoomType) => void;
  private onCloseCb:  () => void;

  constructor(
    scene: Phaser.Scene,
    onPlace: (row: number, col: number, type: RoomType) => void,
    onClose: () => void,
  ) {
    super(scene, 0, CANVAS_HEIGHT);
    this.onPlaceCb = onPlace;
    this.onCloseCb = onClose;
    this.buildFrame();
    this.setDepth(200);
    scene.add.existing(this);
  }

  // ─── Public API ───────────────────────────────────────────────────────────

  open(row: number, col: number, playerGold: number): void {
    this.pendingRow = row;
    this.pendingCol = col;
    this.rebuildCards(playerGold);

    if (this.isOpen) return;
    this.isOpen = true;
    this.scene.tweens.add({
      targets: this,
      y: CANVAS_HEIGHT - PANEL_H,
      duration: 300,
      ease: 'Power2.easeOut',
    });
  }

  close(): void {
    if (!this.isOpen) return;
    this.isOpen = false;
    this.onCloseCb();
    this.scene.tweens.add({
      targets: this, y: CANVAS_HEIGHT, duration: 250, ease: 'Power2.easeIn',
    });
  }

  // ─── Static frame (drawn once) ───────────────────────────────────────────

  private buildFrame(): void {
    const bg = this.scene.add.graphics();

    // Main slab
    bg.fillStyle(COLORS.BLACK, 0.97);
    bg.fillRoundedRect(0, 0, CANVAS_WIDTH, PANEL_H, { tl: 16, tr: 16, bl: 0, br: 0 });

    // Stone texture rows
    for (let y = 4; y < PANEL_H; y += 10) {
      bg.fillStyle(COLORS.STONE_DARK, 0.18);
      bg.fillRect(0, y, CANVAS_WIDTH, 5);
    }

    // Gold top border
    bg.fillStyle(COLORS.TORCH_GOLD, 0.9);
    bg.fillRoundedRect(0, 0, CANVAS_WIDTH, 3, { tl: 16, tr: 16, bl: 0, br: 0 });

    // Inner top glow
    bg.fillStyle(COLORS.TORCH_AMBER, 0.2);
    bg.fillRoundedRect(0, 3, CANVAS_WIDTH, 3, { tl: 12, tr: 12, bl: 0, br: 0 });

    this.add(bg);

    // Header title
    const title = this.scene.add.text(CANVAS_WIDTH / 2, 18, '🕯  소환 제단  🕯', {
      fontFamily: "Georgia, 'Times New Roman', serif",
      fontSize: '16px',
      color: CSS.TORCH_AMBER,
    }).setOrigin(0.5, 0);
    this.add(title);

    // Divider line
    const div = this.scene.add.graphics();
    div.lineStyle(1, COLORS.TORCH_GOLD, 0.3);
    div.lineBetween(12, HEADER_H - 4, CANVAS_WIDTH - 12, HEADER_H - 4);
    this.add(div);

    // Close button
    const closeBg = this.scene.add.graphics();
    closeBg.fillStyle(COLORS.STONE_DARK, 0.8);
    closeBg.fillRoundedRect(CANVAS_WIDTH - 40, 6, 32, 32, 4);
    closeBg.lineStyle(1, COLORS.TORCH_GOLD, 0.4);
    closeBg.strokeRoundedRect(CANVAS_WIDTH - 40, 6, 32, 32, 4);
    this.add(closeBg);

    const closeText = this.scene.add.text(CANVAS_WIDTH - 24, 22, '✕', {
      fontFamily: 'sans-serif', fontSize: '14px', color: CSS.PARCHMENT_MUTED,
    }).setOrigin(0.5);
    this.add(closeText);

    const closeZone = this.scene.add.zone(CANVAS_WIDTH - 44, 0, 44, 44)
      .setOrigin(0, 0).setInteractive();
    closeZone.on('pointerdown', () => {
      this.scene.tweens.add({ targets: closeText, scaleX: 0.75, scaleY: 0.75, duration: 80, yoyo: true });
      this.close();
    });
    closeZone.on('pointerover', () => closeText.setColor(CSS.TORCH_AMBER));
    closeZone.on('pointerout',  () => closeText.setColor(CSS.PARCHMENT_MUTED));
    this.add(closeZone);
  }

  // ─── Cards (rebuilt on each open) ─────────────────────────────────────────

  private rebuildCards(playerGold: number): void {
    this.cardGroup.forEach(obj => obj.destroy());
    this.cardGroup = [];

    (['guardian', 'trap', 'gold', 'tower'] as RoomType[]).forEach((type, i) => {
      this.buildCard(type, i, playerGold);
    });
  }

  private buildCard(type: RoomType, idx: number, playerGold: number): void {
    const def       = ROOM_DEFS[type];
    const cx        = CARD_START + idx * (CARD_W + CARD_GAP);
    const cy        = HEADER_H;
    const canAfford = playerGold >= def.cost;

    // ── Background ──
    const bg = this.scene.add.graphics();
    this.drawCardBg(bg, cx, cy, def.accentColor, canAfford, false);
    this.add(bg); this.cardGroup.push(bg);

    // ── Left accent stripe ──
    const stripe = this.scene.add.graphics();
    stripe.fillStyle(def.accentColor, canAfford ? 0.75 : 0.2);
    stripe.fillRect(cx, cy + 5, 3, CARD_H - 10);
    this.add(stripe); this.cardGroup.push(stripe);

    // ── Emoji icon ──
    const icon = this.scene.add.text(cx + CARD_W / 2, cy + 14, def.emoji, {
      fontSize: '26px',
    }).setOrigin(0.5, 0).setAlpha(canAfford ? 1 : 0.35);
    this.add(icon); this.cardGroup.push(icon);

    // ── Korean name ──
    const nameT = this.scene.add.text(cx + CARD_W / 2, cy + 52, def.koreanName, {
      fontFamily: "Georgia, serif", fontSize: '10px',
      color: canAfford ? CSS.PARCHMENT : CSS.PARCHMENT_MUTED,
    }).setOrigin(0.5, 0);
    this.add(nameT); this.cardGroup.push(nameT);

    // ── Description (word-wrapped) ──
    const descT = this.scene.add.text(cx + CARD_W / 2, cy + 68, def.description, {
      fontFamily: 'sans-serif', fontSize: '8px',
      color: CSS.PARCHMENT_MUTED,
      wordWrap: { width: CARD_W - 10 }, align: 'center',
    }).setOrigin(0.5, 0).setAlpha(canAfford ? 0.8 : 0.4);
    this.add(descT); this.cardGroup.push(descT);

    // ── Cost ──
    const costT = this.scene.add.text(cx + CARD_W / 2, cy + 104, `💰 ${def.cost}`, {
      fontFamily: 'sans-serif', fontSize: '11px', fontStyle: 'bold',
      color: canAfford ? CSS.TORCH_AMBER : '#cc4444',
    }).setOrigin(0.5, 0);
    this.add(costT); this.cardGroup.push(costT);

    // ── [선택] button ──
    const btnY   = cy + CARD_H - 40;
    const btnBg  = this.scene.add.graphics();
    btnBg.fillStyle(canAfford ? def.accentColor : COLORS.STONE_MID, canAfford ? 0.85 : 0.4);
    btnBg.fillRoundedRect(cx + 5, btnY, CARD_W - 10, 28, 3);
    this.add(btnBg); this.cardGroup.push(btnBg);

    const btnT = this.scene.add.text(cx + CARD_W / 2, btnY + 14, canAfford ? '선택' : '부족', {
      fontFamily: 'sans-serif', fontSize: '11px', fontStyle: 'bold',
      color: canAfford ? CSS.PARCHMENT : CSS.PARCHMENT_MUTED,
    }).setOrigin(0.5);
    this.add(btnT); this.cardGroup.push(btnT);

    // ── Interactive zone ──
    const zone = this.scene.add.zone(cx, cy, CARD_W, CARD_H).setOrigin(0, 0);
    if (canAfford) {
      zone.setInteractive();
      zone.on('pointerdown', () => {
        this.scene.tweens.add({ targets: btnBg, scaleX: 0.95, scaleY: 0.95, duration: 80, yoyo: true });
        this.onPlaceCb(this.pendingRow, this.pendingCol, type);
        this.close();
      });
      zone.on('pointerover', () => {
        this.drawCardBg(bg, cx, cy, def.accentColor, true, true);
        btnBg.clear();
        btnBg.fillStyle(def.accentColor, 1);
        btnBg.fillRoundedRect(cx + 5, btnY, CARD_W - 10, 28, 3);
      });
      zone.on('pointerout', () => {
        this.drawCardBg(bg, cx, cy, def.accentColor, true, false);
        btnBg.clear();
        btnBg.fillStyle(def.accentColor, 0.85);
        btnBg.fillRoundedRect(cx + 5, btnY, CARD_W - 10, 28, 3);
      });
    }
    this.add(zone); this.cardGroup.push(zone);
  }

  private drawCardBg(
    g: Phaser.GameObjects.Graphics,
    cx: number, cy: number,
    accent: number,
    canAfford: boolean,
    hover: boolean,
  ): void {
    g.clear();
    const fillAlpha = hover ? 0.2 : 0.08;
    g.fillStyle(canAfford ? accent : COLORS.STONE_DARK, fillAlpha);
    g.fillRoundedRect(cx, cy, CARD_W, CARD_H, 4);
    g.lineStyle(1, canAfford ? accent : COLORS.STONE_MID, hover ? 0.9 : 0.55);
    g.strokeRoundedRect(cx, cy, CARD_W, CARD_H, 4);
  }

  // ─── Gold insufficient shake ───────────────────────────────────────────────

  shakeInsufficient(): void {
    this.scene.tweens.add({
      targets: this, x: { from: 0, to: 8 },
      duration: 45, yoyo: true, repeat: 4, ease: 'Linear',
      onComplete: () => { this.x = 0; },
    });

    const flash = this.scene.add.text(CANVAS_WIDTH / 2, 24, '골드 부족!', {
      fontFamily: "Georgia, serif", fontSize: '13px', color: '#ff4444',
    }).setOrigin(0.5).setDepth(201);
    this.scene.tweens.add({
      targets: flash, alpha: 0, y: flash.y - 20, duration: 800,
      onComplete: () => flash.destroy(),
    });
  }
}
