import Phaser from 'phaser';
import { CASUAL, CASUAL_CSS } from '../constants/colors';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../constants/layout';
import { type RoomType } from '../data/rooms';
import {
  type ElementId,
  type OwnedMonsterProfile,
} from '../data/monsters';
import { getMonsterPlacementOptions } from '../data/monsterPlacementOptions';
import { loadGameState } from '../data/wisdom';
import { getMonsterAtk } from '../data/barracks';
import { addFramedPanel, addPrimaryActionButton, GAME_UI } from './GameUiPrimitives';

// Darker companion of a casual accent → candy-button base edge.
function accentBase(accent: number): number {
  switch (accent) {
    case CASUAL.GOLD:   return CASUAL.GOLD_DK;
    case CASUAL.PURPLE: return CASUAL.PURPLE_DK;
    case CASUAL.BLUE:   return CASUAL.BLUE_DK;
    case CASUAL.GREEN:  return CASUAL.GREEN_DK;
    case CASUAL.RED:    return CASUAL.RED_DK;
    default:            return CASUAL.EDGE;
  }
}

const PANEL_H    = 286;
const CARD_W     = 90;
const CARD_H     = 206;
const CARD_GAP   = 6;
const HEADER_H   = 50;
const OPEN_MS    = 300;
const CLOSE_MS   = 250;
const MAX_VISIBLE_CARDS = 4;

const MONSTER_PANEL_ACCENT = CASUAL.PURPLE;

export class MonsterSelectPanel extends Phaser.GameObjects.Container {
  static readonly HEIGHT = PANEL_H;

  private pendingRow   = 0;
  private pendingCol   = 0;
  private isOpen       = false;
  private cardGroup:   Phaser.GameObjects.GameObject[] = [];
  private currentMonsters: OwnedMonsterProfile[] = [];
  private scrollIndex   = 0;
  private slotLabel!:    Phaser.GameObjects.Text;
  private countLabel?:   Phaser.GameObjects.Text;
  private onAssignCb:  (row: number, col: number, id: string) => void;
  private onCloseCb:   () => void;

  constructor(
    scene: Phaser.Scene,
    onAssign: (row: number, col: number, id: string) => void,
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
    const monsters = getMonsterPlacementOptions(
      loadGameState(),
      roomType,
      unlockedStage,
      elementFilter,
    );
    this.slotLabel.setText(`R${row + 1} · C${col + 1}`);
    this.rebuildCards(monsters);

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

  // ─── Static frame ─────────────────────────────────────────────────────────

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
      accentColor: MONSTER_PANEL_ACCENT,
      accentAlpha: 1,
      glowColor: 0xffffff,
      glowOpacity: 0.4,
      shadowOpacity: 0.4,
      shadowOffsetY: 4,
    });
    this.add(frame.shadow);
    this.add(frame.panel);
    this.add(frame.glow);

    const title = this.scene.add.text(18, 16, '몬스터 배치', {
      fontFamily: 'sans-serif',
      fontSize: '17px',
      fontStyle: 'bold',
      color: CASUAL_CSS.INK,
      stroke: '#ffffff',
      strokeThickness: 3,
    }).setOrigin(0, 0);
    this.add(title);

    const caption = this.scene.add.text(18, 36, '방에 배치할 수호자를 선택', {
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
      hoverBorderColor: CASUAL.PURPLE,
      textColor: CASUAL_CSS.INK,
      onPress: () => this.close(),
    });
    this.add(closeButton.bg);
    this.add(closeButton.text);
    this.add(closeButton.zone);
  }

  // ─── Cards ────────────────────────────────────────────────────────────────

  private rebuildCards(monsters: OwnedMonsterProfile[]): void {
    this.currentMonsters = monsters;
    this.scrollIndex = 0;
    this.renderCards();
  }

  private renderCards(): void {
    this.cardGroup.forEach(obj => obj.destroy());
    this.cardGroup = [];
    const monsters = this.currentMonsters;
    this.countLabel = undefined;

    if (monsters.length === 0) {
      const empty = this.scene.add.text(CANVAS_WIDTH / 2, PANEL_H / 2, '배치 가능한 몬스터 없음', {
        fontFamily: 'sans-serif', fontSize: '12px', fontStyle: 'bold', color: CASUAL_CSS.INK_SOFT,
      }).setOrigin(0.5);
      this.add(empty);
      this.cardGroup.push(empty);
      this.countLabel = this.scene.add.text(CANVAS_WIDTH - 74, 36, '0 / 0', {
        fontFamily: 'sans-serif', fontSize: '9px', fontStyle: 'bold', color: CASUAL_CSS.INK_SOFT,
      }).setOrigin(0.5, 0);
      this.add(this.countLabel);
      this.cardGroup.push(this.countLabel);
      return;
    }

    const visibleCount = Math.min(MAX_VISIBLE_CARDS, monsters.length);
    const maxStart = Math.max(0, monsters.length - visibleCount);
    this.scrollIndex = Phaser.Math.Clamp(this.scrollIndex, 0, maxStart);
    const visibleMonsters = monsters.slice(this.scrollIndex, this.scrollIndex + visibleCount);

    const totalW = visibleMonsters.length * CARD_W + (visibleMonsters.length - 1) * CARD_GAP;
    const startX = (CANVAS_WIDTH - totalW) / 2;

    visibleMonsters.forEach((def, i) => {
      this.buildCard(def, startX + i * (CARD_W + CARD_GAP), HEADER_H);
    });

    this.buildPager(monsters.length, visibleCount);
  }

  private buildCard(def: OwnedMonsterProfile, cx: number, cy: number): void {
    const accent = def.accentColor;

    const frame = addFramedPanel(this.scene, {
      x: cx,
      y: cy,
      w: CARD_W,
      h: CARD_H,
      radius: 10,
      fillColor: CASUAL.PANEL,
      borderColor: accent,
      borderAlpha: 1,
      borderWidth: 3,
      accentColor: accent,
      accentAlpha: 1,
      glowColor: 0xffffff,
      glowOpacity: 0.4,
      shadowOpacity: 0.3,
      shadowOffsetY: 3,
    });
    this.add(frame.shadow);
    this.add(frame.panel);
    this.add(frame.glow);
    this.cardGroup.push(frame.shadow, frame.panel, frame.glow);

    const stripe = this.scene.add.graphics();
    stripe.fillStyle(accent, 0.6);
    stripe.fillRoundedRect(cx + 5, cy + 18, 3, CARD_H - 34, 2);
    this.add(stripe); this.cardGroup.push(stripe);

    const icon = this.scene.add.text(cx + CARD_W / 2, cy + 16, def.emoji, {
      fontSize: '27px',
    }).setOrigin(0.5, 0);
    this.add(icon); this.cardGroup.push(icon);

    const badgeLabel = this.getTypeLabel(def.type);
    const badge = this.scene.add.text(cx + CARD_W / 2, cy + 54, badgeLabel, {
      fontFamily: 'sans-serif',
      fontSize: '9px',
      fontStyle: 'bold',
      color: this.getTypeColor(def.type),
    }).setOrigin(0.5, 0);
    this.add(badge); this.cardGroup.push(badge);

    const nameT = this.scene.add.text(cx + CARD_W / 2, cy + 68, def.name, {
      fontFamily: 'sans-serif',
      fontSize: '10px',
      fontStyle: 'bold',
      color: CASUAL_CSS.INK,
      wordWrap: { width: CARD_W - 10 },
      align: 'center',
    }).setOrigin(0.5, 0);
    this.add(nameT); this.cardGroup.push(nameT);

    const descT = this.scene.add.text(cx + CARD_W / 2, cy + 88, def.passiveDesc, {
      fontFamily: 'sans-serif',
      fontSize: '8px',
      fontStyle: 'bold',
      color: CASUAL_CSS.INK_SOFT,
      wordWrap: { width: CARD_W - 14 },
      align: 'center',
      lineSpacing: 2,
    }).setOrigin(0.5, 0).setAlpha(0.95);
    this.add(descT); this.cardGroup.push(descT);

    const gs = loadGameState();
    const owned = gs.ownedMonsters.find(m => m.id === def.id);
    if (owned) {
      const atk = getMonsterAtk(def.baseDamage, owned.level, owned.spentSkills);
      const atkBg = this.scene.add.graphics();
      atkBg.fillStyle(0xffffff, 0.9);
      atkBg.fillRoundedRect(cx + 18, cy + 137, CARD_W - 36, 20, GAME_UI.radius.row);
      atkBg.lineStyle(2, accent, 0.7);
      atkBg.strokeRoundedRect(cx + 18, cy + 137, CARD_W - 36, 20, GAME_UI.radius.row);
      this.add(atkBg); this.cardGroup.push(atkBg);

      const atkT = this.scene.add.text(cx + CARD_W / 2, cy + 147, `⚔ ${atk}`, {
        fontFamily: 'sans-serif',
        fontSize: '11px',
        fontStyle: 'bold',
        color: CASUAL_CSS.RED,
      }).setOrigin(0.5);
      this.add(atkT); this.cardGroup.push(atkT);
    }

    const assignSelected = (): void => {
      this.onAssignCb(this.pendingRow, this.pendingCol, def.id);
      this.close();
    };

    const zone = this.scene.add.zone(cx, cy, CARD_W, CARD_H - 48).setOrigin(0, 0)
      .setInteractive({ useHandCursor: true });
    zone.on('pointerdown', assignSelected);
    zone.on('pointerover', () => frame.panel.setAlpha(0.96));
    zone.on('pointerout', () => frame.panel.setAlpha(1));
    this.add(zone); this.cardGroup.push(zone);

    const button = addPrimaryActionButton(this.scene, {
      x: cx + 8,
      y: cy + CARD_H - 44,
      w: CARD_W - 16,
      h: GAME_UI.touch.compactHeight,
      label: '배치',
      fontSize: '12px',
      fillColor: accent,
      hoverFillColor: accent,
      borderColor: accentBase(accent),
      hoverBorderColor: accentBase(accent),
      onPress: assignSelected,
    });
    this.add(button.bg);
    this.add(button.text);
    this.add(button.zone);
    this.cardGroup.push(button.bg, button.text, button.zone);
  }

  private buildPager(total: number, visibleCount: number): void {
    this.countLabel = this.scene.add.text(CANVAS_WIDTH / 2, PANEL_H - 14,
      `${this.scrollIndex + 1}-${this.scrollIndex + visibleCount} / ${total}`, {
      fontFamily: 'sans-serif',
      fontSize: '9px',
      fontStyle: 'bold',
      color: CASUAL_CSS.INK_SOFT,
    }).setOrigin(0.5, 0.5);
    this.add(this.countLabel);
    this.cardGroup.push(this.countLabel);

    if (total <= visibleCount) return;

    const prev = addPrimaryActionButton(this.scene, {
      x: 10,
      y: PANEL_H - 34,
      w: 28,
      h: 26,
      label: '‹',
      fontSize: '15px',
      enabled: this.scrollIndex > 0,
      fillColor: CASUAL.PANEL,
      hoverFillColor: CASUAL.PANEL_SOFT,
      borderColor: CASUAL.EDGE,
      hoverBorderColor: CASUAL.PURPLE,
      textColor: CASUAL_CSS.INK,
      disabledFillColor: CASUAL.PANEL_SOFT,
      disabledBorderColor: CASUAL.EDGE_SOFT,
      onPress: () => {
        this.scrollIndex = Math.max(0, this.scrollIndex - 1);
        this.renderCards();
      },
    });
    const next = addPrimaryActionButton(this.scene, {
      x: CANVAS_WIDTH - 38,
      y: PANEL_H - 34,
      w: 28,
      h: 26,
      label: '›',
      fontSize: '15px',
      enabled: this.scrollIndex + visibleCount < total,
      fillColor: CASUAL.PANEL,
      hoverFillColor: CASUAL.PANEL_SOFT,
      borderColor: CASUAL.EDGE,
      hoverBorderColor: CASUAL.PURPLE,
      textColor: CASUAL_CSS.INK,
      disabledFillColor: CASUAL.PANEL_SOFT,
      disabledBorderColor: CASUAL.EDGE_SOFT,
      onPress: () => {
        const maxStart = Math.max(0, total - visibleCount);
        this.scrollIndex = Math.min(maxStart, this.scrollIndex + 1);
        this.renderCards();
      },
    });
    this.add(prev.bg); this.add(prev.text); this.add(prev.zone);
    this.add(next.bg); this.add(next.text); this.add(next.zone);
    this.cardGroup.push(prev.bg, prev.text, prev.zone, next.bg, next.text, next.zone);
  }

  private getTypeLabel(type: OwnedMonsterProfile['type']): string {
    const labels: Record<string, string> = {
      melee: '근접',
      ranged: '원거리',
      magic: '마법',
      support: '지원',
    };
    return labels[type] ?? String(type).toUpperCase();
  }

  private getTypeColor(type: OwnedMonsterProfile['type']): string {
    const colors: Record<string, string> = {
      melee:   CASUAL_CSS.RED,
      ranged:  CASUAL_CSS.GREEN,
      magic:   CASUAL_CSS.PURPLE,
      support: CASUAL_CSS.BLUE,
    };
    return colors[type] ?? CASUAL_CSS.INK_SOFT;
  }
}
