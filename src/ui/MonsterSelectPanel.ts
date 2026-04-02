import Phaser from 'phaser';
import { COLORS, CSS } from '../constants/colors';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../constants/layout';
import { type RoomType } from '../data/rooms';
import { getMonstersForRoom, type MonsterDef, type MonsterId, type ElementId } from '../data/monsters';

const PANEL_H    = 286;
const CARD_W     = 90;
const CARD_H     = 218;
const CARD_GAP   = 6;
const HEADER_H   = 50;

export class MonsterSelectPanel extends Phaser.GameObjects.Container {
  static readonly HEIGHT = PANEL_H;

  private pendingRow   = 0;
  private pendingCol   = 0;
  private isOpen       = false;
  private cardGroup:   Phaser.GameObjects.GameObject[] = [];
  private onAssignCb:  (row: number, col: number, id: MonsterId) => void;
  private onCloseCb:   () => void;

  constructor(
    scene: Phaser.Scene,
    onAssign: (row: number, col: number, id: MonsterId) => void,
    onClose: () => void,
  ) {
    super(scene, 0, CANVAS_HEIGHT);
    this.onAssignCb = onAssign;
    this.onCloseCb  = onClose;
    this.buildFrame();
    this.setDepth(210);
    scene.add.existing(this);
  }

  // ─── Public API ───────────────────────────────────────────────────────────

  open(row: number, col: number, roomType: RoomType, unlockedStage: number, elementFilter?: ElementId): void {
    this.pendingRow = row;
    this.pendingCol = col;
    const monsters = getMonstersForRoom(roomType, unlockedStage, elementFilter);
    this.rebuildCards(monsters);

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

  // ─── Static frame ─────────────────────────────────────────────────────────

  private buildFrame(): void {
    const bg = this.scene.add.graphics();
    bg.fillStyle(COLORS.BLACK, 0.97);
    bg.fillRoundedRect(0, 0, CANVAS_WIDTH, PANEL_H, { tl: 16, tr: 16, bl: 0, br: 0 });

    for (let y = 4; y < PANEL_H; y += 10) {
      bg.fillStyle(COLORS.STONE_DARK, 0.18);
      bg.fillRect(0, y, CANVAS_WIDTH, 5);
    }

    // Purple top border for monster theme
    bg.fillStyle(0x6020a0, 0.9);
    bg.fillRoundedRect(0, 0, CANVAS_WIDTH, 3, { tl: 16, tr: 16, bl: 0, br: 0 });
    bg.fillStyle(0x9040e0, 0.2);
    bg.fillRoundedRect(0, 3, CANVAS_WIDTH, 3, { tl: 12, tr: 12, bl: 0, br: 0 });
    this.add(bg);

    const title = this.scene.add.text(CANVAS_WIDTH / 2, 18, '👹  몬스터 배치  👹', {
      fontFamily: "Georgia, 'Times New Roman', serif",
      fontSize: '16px',
      color: '#d080ff',
    }).setOrigin(0.5, 0);
    this.add(title);

    const div = this.scene.add.graphics();
    div.lineStyle(1, 0x6020a0, 0.4);
    div.lineBetween(12, HEADER_H - 4, CANVAS_WIDTH - 12, HEADER_H - 4);
    this.add(div);

    // Close button
    const closeBg = this.scene.add.graphics();
    closeBg.fillStyle(COLORS.STONE_DARK, 0.8);
    closeBg.fillRoundedRect(CANVAS_WIDTH - 40, 6, 32, 32, 4);
    closeBg.lineStyle(1, 0x6020a0, 0.5);
    closeBg.strokeRoundedRect(CANVAS_WIDTH - 40, 6, 32, 32, 4);
    this.add(closeBg);

    const closeText = this.scene.add.text(CANVAS_WIDTH - 24, 22, '✕', {
      fontFamily: 'sans-serif', fontSize: '14px', color: CSS.PARCHMENT_MUTED,
    }).setOrigin(0.5);
    this.add(closeText);

    const closeZone = this.scene.add.zone(CANVAS_WIDTH - 40, 6, 32, 32)
      .setOrigin(0, 0).setInteractive();
    closeZone.on('pointerdown', () => this.close());
    closeZone.on('pointerover', () => closeText.setColor('#d080ff'));
    closeZone.on('pointerout',  () => closeText.setColor(CSS.PARCHMENT_MUTED));
    this.add(closeZone);
  }

  // ─── Cards ────────────────────────────────────────────────────────────────

  private rebuildCards(monsters: MonsterDef[]): void {
    this.cardGroup.forEach(obj => obj.destroy());
    this.cardGroup = [];

    if (monsters.length === 0) {
      const empty = this.scene.add.text(CANVAS_WIDTH / 2, PANEL_H / 2, '배치 가능한 몬스터 없음', {
        fontFamily: 'sans-serif', fontSize: '12px', color: CSS.PARCHMENT_MUTED,
      }).setOrigin(0.5);
      this.add(empty);
      this.cardGroup.push(empty);
      return;
    }

    // Center cards horizontally
    const totalW = monsters.length * CARD_W + (monsters.length - 1) * CARD_GAP;
    const startX = (CANVAS_WIDTH - totalW) / 2;

    monsters.forEach((def, i) => {
      this.buildCard(def, startX + i * (CARD_W + CARD_GAP), HEADER_H);
    });
  }

  private buildCard(def: MonsterDef, cx: number, cy: number): void {
    const accent = def.accentColor;

    // Background
    const bg = this.scene.add.graphics();
    this.drawCardBg(bg, cx, cy, accent, false);
    this.add(bg); this.cardGroup.push(bg);

    // Left accent stripe
    const stripe = this.scene.add.graphics();
    stripe.fillStyle(accent, 0.75);
    stripe.fillRect(cx, cy + 5, 3, CARD_H - 10);
    this.add(stripe); this.cardGroup.push(stripe);

    // Monster emoji
    const icon = this.scene.add.text(cx + CARD_W / 2, cy + 14, def.emoji, {
      fontSize: '26px',
    }).setOrigin(0.5, 0);
    this.add(icon); this.cardGroup.push(icon);

    // Type badge
    const typeColor: Record<string, string> = {
      melee: '#cc4444', ranged: '#44aa44', magic: '#9944cc', support: '#44aacc',
    };
    const badge = this.scene.add.text(cx + CARD_W / 2, cy + 48, def.type.toUpperCase(), {
      fontFamily: 'sans-serif', fontSize: '7px', fontStyle: 'bold',
      color: typeColor[def.type] ?? CSS.PARCHMENT_MUTED,
    }).setOrigin(0.5, 0);
    this.add(badge); this.cardGroup.push(badge);

    // Korean name
    const nameT = this.scene.add.text(cx + CARD_W / 2, cy + 60, def.name, {
      fontFamily: "Georgia, serif", fontSize: '10px', color: CSS.PARCHMENT,
    }).setOrigin(0.5, 0);
    this.add(nameT); this.cardGroup.push(nameT);

    // Passive description
    const descT = this.scene.add.text(cx + CARD_W / 2, cy + 76, def.passiveDesc, {
      fontFamily: 'sans-serif', fontSize: '8px',
      color: CSS.PARCHMENT_MUTED,
      wordWrap: { width: CARD_W - 10 }, align: 'center',
    }).setOrigin(0.5, 0).setAlpha(0.85);
    this.add(descT); this.cardGroup.push(descT);

    // [배치] button
    const btnY   = cy + CARD_H - 40;
    const btnBg  = this.scene.add.graphics();
    btnBg.fillStyle(accent, 0.85);
    btnBg.fillRoundedRect(cx + 5, btnY, CARD_W - 10, 28, 3);
    this.add(btnBg); this.cardGroup.push(btnBg);

    const btnT = this.scene.add.text(cx + CARD_W / 2, btnY + 14, '배치', {
      fontFamily: 'sans-serif', fontSize: '12px', fontStyle: 'bold', color: CSS.PARCHMENT,
    }).setOrigin(0.5);
    this.add(btnT); this.cardGroup.push(btnT);

    // Interactive zone
    const zone = this.scene.add.zone(cx, cy, CARD_W, CARD_H).setOrigin(0, 0).setInteractive();
    zone.on('pointerdown', () => {
      this.onAssignCb(this.pendingRow, this.pendingCol, def.id);
      this.close();
    });
    zone.on('pointerover', () => {
      this.drawCardBg(bg, cx, cy, accent, true);
      btnBg.clear();
      btnBg.fillStyle(accent, 1);
      btnBg.fillRoundedRect(cx + 5, btnY, CARD_W - 10, 28, 3);
    });
    zone.on('pointerout', () => {
      this.drawCardBg(bg, cx, cy, accent, false);
      btnBg.clear();
      btnBg.fillStyle(accent, 0.85);
      btnBg.fillRoundedRect(cx + 5, btnY, CARD_W - 10, 28, 3);
    });
    this.add(zone); this.cardGroup.push(zone);
  }

  private drawCardBg(
    g: Phaser.GameObjects.Graphics,
    cx: number, cy: number,
    accent: number,
    hover: boolean,
  ): void {
    g.clear();
    g.fillStyle(accent, hover ? 0.2 : 0.08);
    g.fillRoundedRect(cx, cy, CARD_W, CARD_H, 4);
    g.lineStyle(1, accent, hover ? 0.9 : 0.55);
    g.strokeRoundedRect(cx, cy, CARD_W, CARD_H, 4);
  }
}
