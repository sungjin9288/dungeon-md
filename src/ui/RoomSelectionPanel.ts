import Phaser from 'phaser';
import { CASUAL, CASUAL_CSS } from '../constants/colors';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../constants/layout';
import { ROOM_DEFS, type RoomType } from '../data/rooms';
import { addFramedPanel, addPrimaryActionButton, GAME_UI } from './GameUiPrimitives';

/** Saturated candy accent per room type (room def colors are too dark for cream cards). */
interface CasualAccent { readonly cap: number; readonly base: number }

const ROOM_ACCENT: Partial<Record<RoomType, CasualAccent>> = {
  guardian: { cap: CASUAL.RED,    base: CASUAL.RED_DK },
  trap:     { cap: CASUAL.PURPLE, base: CASUAL.PURPLE_DK },
  gold:     { cap: CASUAL.GOLD,   base: CASUAL.GOLD_DK },
  tower:    { cap: CASUAL.GREEN,  base: CASUAL.GREEN_DK },
};

function roomAccent(type: RoomType): CasualAccent {
  return ROOM_ACCENT[type] ?? { cap: CASUAL.GOLD, base: CASUAL.GOLD_DK };
}

const PANEL_H     = 286;
const CARD_W      = 90;
const CARD_H      = 218;
const CARD_GAP    = 6;
const CARD_START  = (CANVAS_WIDTH - 4 * CARD_W - 3 * CARD_GAP) / 2; // ≈ 6px
const HEADER_H    = 50;
const OPEN_MS     = 300;
const CLOSE_MS    = 250;

export class RoomSelectionPanel extends Phaser.GameObjects.Container {
  static readonly HEIGHT = PANEL_H;

  private pendingRow  = 0;
  private pendingCol  = 0;
  private isOpen      = false;
  private cardGroup:  Phaser.GameObjects.GameObject[] = [];
  private slotLabel!: Phaser.GameObjects.Text;
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
    this.slotLabel.setText(`R${row + 1} · C${col + 1}`);
    this.rebuildCards(playerGold);

    if (this.isOpen) return;
    this.isOpen = true;
    this.scene.tweens.add({
      targets: this,
      y: CANVAS_HEIGHT - PANEL_H,
      duration: OPEN_MS,
      ease: 'Power2.easeOut',
    });
  }

  close(): void {
    if (!this.isOpen) return;
    this.isOpen = false;
    this.onCloseCb();
    this.scene.tweens.add({
      targets: this, y: CANVAS_HEIGHT, duration: CLOSE_MS, ease: 'Power2.easeIn',
    });
  }

  // ─── Static frame (drawn once) ───────────────────────────────────────────

  private buildFrame(): void {
    const frame = addFramedPanel(this.scene, {
      x: 0,
      y: 0,
      w: CANVAS_WIDTH,
      h: PANEL_H + 18,
      radius: 16,
      fillColor: CASUAL.PANEL,
      borderColor: CASUAL.EDGE,
      borderAlpha: 1,
      borderWidth: 3,
      accentColor: CASUAL.GOLD,
      accentAlpha: 1,
      glowColor: 0xffffff,
      glowOpacity: 0.4,
      shadowOpacity: 0.4,
      shadowOffsetY: 4,
    });
    this.add(frame.shadow);
    this.add(frame.panel);
    this.add(frame.glow);

    const title = this.scene.add.text(18, 16, '소환 제단', {
      fontFamily: 'sans-serif',
      fontSize: '17px',
      fontStyle: 'bold',
      color: CASUAL_CSS.INK,
      stroke: '#ffffff',
      strokeThickness: 3,
    }).setOrigin(0, 0);
    this.add(title);

    const caption = this.scene.add.text(18, 36, '방 타입을 선택해 빈 슬롯에 배치', {
      fontFamily: 'sans-serif',
      fontSize: '9px',
      fontStyle: 'bold',
      color: CASUAL_CSS.INK_SOFT,
    }).setOrigin(0, 0);
    this.add(caption);

    this.slotLabel = this.scene.add.text(CANVAS_WIDTH - 86, 18, 'R1 · C1', {
      fontFamily: 'sans-serif',
      fontSize: '10px',
      color: CASUAL_CSS.INK,
      fontStyle: 'bold',
    }).setOrigin(0.5, 0);
    this.add(this.slotLabel);

    const div = this.scene.add.graphics();
    div.lineStyle(2, CASUAL.EDGE_SOFT, 0.5);
    div.lineBetween(12, HEADER_H - 4, CANVAS_WIDTH - 12, HEADER_H - 4);
    this.add(div);

    const closeButton = addPrimaryActionButton(this.scene, {
      x: CANVAS_WIDTH - 43,
      y: 8,
      w: 34,
      h: 30,
      label: '×',
      fontSize: '16px',
      fillColor: CASUAL.PANEL,
      hoverFillColor: CASUAL.PANEL_SOFT,
      borderColor: CASUAL.EDGE,
      hoverBorderColor: CASUAL.RED,
      textColor: CASUAL_CSS.INK,
      onPress: () => this.close(),
    });
    this.add(closeButton.bg);
    this.add(closeButton.text);
    this.add(closeButton.zone);
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
    const accent    = roomAccent(type);

    const frame = addFramedPanel(this.scene, {
      x: cx,
      y: cy,
      w: CARD_W,
      h: CARD_H,
      radius: 10,
      fillColor: canAfford ? CASUAL.PANEL : CASUAL.PANEL_SOFT,
      borderColor: canAfford ? accent.cap : CASUAL.EDGE_SOFT,
      borderAlpha: 1,
      borderWidth: canAfford ? 3 : 2,
      accentColor: canAfford ? accent.cap : CASUAL.EDGE_SOFT,
      accentAlpha: canAfford ? 1 : 0.6,
      glowColor: 0xffffff,
      glowOpacity: canAfford ? 0.4 : 0.2,
      shadowOpacity: 0.3,
      shadowOffsetY: 3,
    });
    this.add(frame.shadow);
    this.add(frame.panel);
    this.add(frame.glow);
    this.cardGroup.push(frame.shadow, frame.panel, frame.glow);

    const stripe = this.scene.add.graphics();
    stripe.fillStyle(canAfford ? accent.cap : CASUAL.EDGE_SOFT, canAfford ? 0.6 : 0.3);
    stripe.fillRoundedRect(cx + 5, cy + 18, 3, CARD_H - 34, 2);
    this.add(stripe); this.cardGroup.push(stripe);

    const icon = this.scene.add.text(cx + CARD_W / 2, cy + 18, def.emoji, {
      fontSize: '27px',
    }).setOrigin(0.5, 0).setAlpha(canAfford ? 1 : 0.45);
    this.add(icon); this.cardGroup.push(icon);

    const nameT = this.scene.add.text(cx + CARD_W / 2, cy + 58, def.koreanName, {
      fontFamily: 'sans-serif',
      fontSize: '11px',
      fontStyle: 'bold',
      color: canAfford ? CASUAL_CSS.INK : CASUAL_CSS.INK_SOFT,
    }).setOrigin(0.5, 0);
    this.add(nameT); this.cardGroup.push(nameT);

    const descT = this.scene.add.text(cx + CARD_W / 2, cy + 77, def.description, {
      fontFamily: 'sans-serif',
      fontSize: '8px',
      fontStyle: 'bold',
      color: CASUAL_CSS.INK_SOFT,
      wordWrap: { width: CARD_W - 14 },
      align: 'center',
      lineSpacing: 2,
    }).setOrigin(0.5, 0).setAlpha(canAfford ? 0.95 : 0.55);
    this.add(descT); this.cardGroup.push(descT);

    const costBg = this.scene.add.graphics();
    costBg.fillStyle(0xffffff, canAfford ? 0.9 : 0.5);
    costBg.fillRoundedRect(cx + 15, cy + 123, CARD_W - 30, 20, GAME_UI.radius.row);
    costBg.lineStyle(2, canAfford ? accent.cap : CASUAL.EDGE_SOFT, canAfford ? 0.7 : 0.4);
    costBg.strokeRoundedRect(cx + 15, cy + 123, CARD_W - 30, 20, GAME_UI.radius.row);
    this.add(costBg); this.cardGroup.push(costBg);

    const costT = this.scene.add.text(cx + CARD_W / 2, cy + 133, `💰 ${def.cost}`, {
      fontFamily: 'sans-serif',
      fontSize: '11px',
      fontStyle: 'bold',
      color: canAfford ? CASUAL_CSS.GOLD : CASUAL_CSS.RED,
    }).setOrigin(0.5);
    this.add(costT); this.cardGroup.push(costT);

    const placeSelected = (): void => {
      this.onPlaceCb(this.pendingRow, this.pendingCol, type);
      this.close();
    };

    if (canAfford) {
      const cardZone = this.scene.add.zone(cx, cy, CARD_W, CARD_H).setOrigin(0, 0)
        .setInteractive({ useHandCursor: true });
      cardZone.on('pointerover', () => frame.panel.setAlpha(0.96));
      cardZone.on('pointerout', () => frame.panel.setAlpha(1));
      cardZone.on('pointerdown', placeSelected);
      this.add(cardZone);
      this.cardGroup.push(cardZone);
    }

    const button = addPrimaryActionButton(this.scene, {
      x: cx + 8,
      y: cy + CARD_H - 44,
      w: CARD_W - 16,
      h: GAME_UI.touch.compactHeight,
      label: canAfford ? '선택' : '부족',
      fontSize: '12px',
      enabled: canAfford,
      fillColor: accent.cap,
      hoverFillColor: accent.cap,
      borderColor: accent.base,
      hoverBorderColor: accent.base,
      disabledFillColor: CASUAL.PANEL_SOFT,
      disabledBorderColor: CASUAL.EDGE_SOFT,
      onPress: placeSelected,
    });
    this.add(button.bg);
    this.add(button.text);
    this.add(button.zone);
    this.cardGroup.push(button.bg, button.text, button.zone);
  }

  // ─── Gold insufficient shake ───────────────────────────────────────────────

  shakeInsufficient(): void {
    this.scene.tweens.add({
      targets: this, x: { from: 0, to: 8 },
      duration: 45, yoyo: true, repeat: 4, ease: 'Linear',
      onComplete: () => { this.x = 0; },
    });

    const flash = this.scene.add.text(CANVAS_WIDTH / 2, 24, '골드 부족!', {
      fontFamily: 'sans-serif', fontSize: '13px', fontStyle: 'bold',
      color: CASUAL_CSS.RED, stroke: '#ffffff', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(201);
    this.scene.tweens.add({
      targets: flash, alpha: 0, y: flash.y - 20, duration: 800,
      onComplete: () => flash.destroy(),
    });
  }
}
