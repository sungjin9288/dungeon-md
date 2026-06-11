import Phaser from 'phaser';
import { COLORS, CSS } from '../constants/colors';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../constants/layout';
import { ROOM_DEFS, type RoomType } from '../data/rooms';
import { addFramedPanel, addPrimaryActionButton, GAME_UI } from './GameUiPrimitives';

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
      fillColor: 0x0e0903,
      borderColor: COLORS.TORCH_GOLD,
      borderAlpha: 0.9,
      borderWidth: 2,
      accentColor: COLORS.TORCH_GOLD,
      accentAlpha: 0.95,
      glowColor: COLORS.TORCH_AMBER,
      glowOpacity: 0.14,
      shadowOpacity: 0.68,
      shadowOffsetY: 4,
    });
    this.add(frame.shadow);
    this.add(frame.panel);
    this.add(frame.glow);

    const title = this.scene.add.text(18, 16, '소환 제단', {
      fontFamily: "Georgia, 'Times New Roman', serif",
      fontSize: '17px',
      fontStyle: 'bold',
      color: CSS.TORCH_AMBER,
    }).setOrigin(0, 0);
    this.add(title);

    const caption = this.scene.add.text(18, 35, '방 타입을 선택해 빈 슬롯에 배치', {
      fontFamily: 'sans-serif',
      fontSize: '9px',
      color: CSS.PARCHMENT_MUTED,
    }).setOrigin(0, 0);
    this.add(caption);

    this.slotLabel = this.scene.add.text(CANVAS_WIDTH - 86, 18, 'R1 · C1', {
      fontFamily: 'sans-serif',
      fontSize: '10px',
      color: CSS.PARCHMENT_DIM,
      fontStyle: 'bold',
    }).setOrigin(0.5, 0);
    this.add(this.slotLabel);

    const div = this.scene.add.graphics();
    div.lineStyle(1, COLORS.TORCH_GOLD, 0.3);
    div.lineBetween(12, HEADER_H - 4, CANVAS_WIDTH - 12, HEADER_H - 4);
    this.add(div);

    const closeButton = addPrimaryActionButton(this.scene, {
      x: CANVAS_WIDTH - 43,
      y: 8,
      w: 34,
      h: 30,
      label: '×',
      fontSize: '16px',
      fillColor: 0x1a1208,
      hoverFillColor: 0x24170a,
      borderColor: COLORS.STONE_MID,
      hoverBorderColor: COLORS.TORCH_AMBER,
      textColor: CSS.PARCHMENT_MUTED,
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

    const frame = addFramedPanel(this.scene, {
      x: cx,
      y: cy,
      w: CARD_W,
      h: CARD_H,
      radius: 8,
      fillColor: canAfford ? 0x181008 : 0x0b0907,
      borderColor: canAfford ? def.accentColor : COLORS.STONE_MID,
      borderAlpha: canAfford ? 0.72 : 0.36,
      borderWidth: 1.5,
      accentColor: canAfford ? def.accentColor : COLORS.STONE_MID,
      accentAlpha: canAfford ? 0.78 : 0.22,
      glowColor: canAfford ? def.accentColor : COLORS.STONE_MID,
      glowOpacity: canAfford ? 0.1 : 0.03,
      shadowOpacity: 0.24,
      shadowOffsetY: 2,
    });
    this.add(frame.shadow);
    this.add(frame.panel);
    this.add(frame.glow);
    this.cardGroup.push(frame.shadow, frame.panel, frame.glow);

    const stripe = this.scene.add.graphics();
    stripe.fillStyle(def.accentColor, canAfford ? 0.7 : 0.18);
    stripe.fillRoundedRect(cx + 5, cy + 16, 3, CARD_H - 32, 2);
    this.add(stripe); this.cardGroup.push(stripe);

    const icon = this.scene.add.text(cx + CARD_W / 2, cy + 18, def.emoji, {
      fontSize: '27px',
    }).setOrigin(0.5, 0).setAlpha(canAfford ? 1 : 0.35);
    this.add(icon); this.cardGroup.push(icon);

    const nameT = this.scene.add.text(cx + CARD_W / 2, cy + 58, def.koreanName, {
      fontFamily: "Georgia, serif",
      fontSize: '11px',
      fontStyle: 'bold',
      color: canAfford ? CSS.PARCHMENT : CSS.PARCHMENT_MUTED,
    }).setOrigin(0.5, 0);
    this.add(nameT); this.cardGroup.push(nameT);

    const descT = this.scene.add.text(cx + CARD_W / 2, cy + 77, def.description, {
      fontFamily: 'sans-serif',
      fontSize: '8px',
      color: CSS.PARCHMENT_MUTED,
      wordWrap: { width: CARD_W - 14 },
      align: 'center',
      lineSpacing: 2,
    }).setOrigin(0.5, 0).setAlpha(canAfford ? 0.8 : 0.4);
    this.add(descT); this.cardGroup.push(descT);

    const costBg = this.scene.add.graphics();
    costBg.fillStyle(canAfford ? COLORS.BLACK : COLORS.STONE_DARK, canAfford ? 0.28 : 0.42);
    costBg.fillRoundedRect(cx + 15, cy + 123, CARD_W - 30, 20, GAME_UI.radius.row);
    costBg.lineStyle(1, canAfford ? def.accentColor : COLORS.STONE_MID, canAfford ? 0.45 : 0.25);
    costBg.strokeRoundedRect(cx + 15, cy + 123, CARD_W - 30, 20, GAME_UI.radius.row);
    this.add(costBg); this.cardGroup.push(costBg);

    const costT = this.scene.add.text(cx + CARD_W / 2, cy + 133, `💰 ${def.cost}`, {
      fontFamily: 'sans-serif',
      fontSize: '11px',
      fontStyle: 'bold',
      color: canAfford ? CSS.TORCH_AMBER : '#cc4444',
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
      fillColor: def.accentColor,
      hoverFillColor: def.accentColor,
      borderColor: def.accentColor,
      hoverBorderColor: COLORS.TORCH_AMBER,
      disabledFillColor: 0x18100a,
      disabledBorderColor: COLORS.STONE_MID,
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
      fontFamily: "Georgia, serif", fontSize: '13px', color: '#ff4444',
    }).setOrigin(0.5).setDepth(201);
    this.scene.tweens.add({
      targets: flash, alpha: 0, y: flash.y - 20, duration: 800,
      onComplete: () => flash.destroy(),
    });
  }
}
