import Phaser from 'phaser';
import { CASUAL, CASUAL_CSS } from '../constants/colors';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../constants/layout';
import {
  ROOM_DEFS, getUpgradeCost, getAttackDamage, MAX_ROOM_LEVEL,
  type RoomData,
} from '../data/rooms';
import {
  addFramedPanel,
  addInfoRow,
  addPrimaryActionButton,
} from './GameUiPrimitives';

const PANEL_H     = 360;
const OPEN_MS     = 250;
const CLOSE_MS    = 220;
const CONTENT_X   = 18;
const CONTENT_W   = CANVAS_WIDTH - CONTENT_X * 2;

type UpgradeRow = {
  readonly icon: string;
  readonly label: string;
  readonly value: string;
  readonly valueColor?: string;
};

export interface RoomUpgradeLoadoutSummary {
  readonly slotIcon: string;
  readonly slotName: string;
  readonly accentColor: number;
  readonly roomLevel: number;
  readonly monsters: readonly string[];
  readonly monsterCapacity: number;
  readonly traps: readonly string[];
  readonly trapCapacity: number;
  readonly hp: number;
  readonly maxHp: number;
}

export class RoomUpgradePanel extends Phaser.GameObjects.Container {
  private isOpen       = false;
  private title!:       Phaser.GameObjects.Text;
  private levelLabel!:  Phaser.GameObjects.Text;
  private contentGroup: Phaser.GameObjects.GameObject[] = [];

  private onUpgradeCb:  (row: number, col: number) => void;
  private onCloseCb:    () => void;

  constructor(
    scene:     Phaser.Scene,
    onUpgrade: (row: number, col: number) => void,
    onClose:   () => void,
  ) {
    super(scene, 0, CANVAS_HEIGHT);
    this.onUpgradeCb = onUpgrade;
    this.onCloseCb   = onClose;

    this.buildFrame(scene);
    scene.add.existing(this);
    this.setDepth(210);
  }

  open(
    row: number,
    col: number,
    data: RoomData,
    synergies?: Array<{ name: string; desc: string }>,
    loadout?: RoomUpgradeLoadoutSummary,
  ): void {
    if (this.isOpen) return;
    this.isOpen = true;

    this.clearContent();

    const def        = ROOM_DEFS[data.type];
    const isMaxLevel = data.level >= MAX_ROOM_LEVEL;

    this.title.setText(def.koreanName);
    this.levelLabel.setText(isMaxLevel ? `Lv.${MAX_ROOM_LEVEL} MAX` : `Lv.${data.level} → Lv.${data.level + 1}`);

    if (loadout) this.buildLoadoutSummary(loadout);

    if (isMaxLevel) {
      this.buildMaxLevelContent(synergies, Boolean(loadout));
    } else {
      this.buildUpgradeContent(row, col, data, synergies, Boolean(loadout));
    }

    this.scene.tweens.add({
      targets: this,
      y: CANVAS_HEIGHT - PANEL_H,
      duration: OPEN_MS,
      ease: 'Power2.easeOut',
    });
  }

  /** Flash red + shake when player taps upgrade with insufficient gold. */
  shakeInsufficient(): void {
    this.scene.tweens.add({
      targets: this, x: { from: 0, to: 8 },
      duration: 45, yoyo: true, repeat: 4, ease: 'Linear',
      onComplete: () => { this.x = 0; },
    });
    const flash = this.scene.add.text(CANVAS_WIDTH / 2, CANVAS_HEIGHT - 300 + 24, '골드 부족!', {
      fontFamily: 'sans-serif', fontSize: '13px', fontStyle: 'bold',
      color: CASUAL_CSS.RED, stroke: '#ffffff', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(220);
    this.scene.tweens.add({
      targets: flash, alpha: 0, y: flash.y - 22, duration: 800,
      onComplete: () => flash.destroy(),
    });
  }

  close(): void {
    if (!this.isOpen) return;
    this.isOpen = false;
    this.scene.tweens.add({
      targets: this,
      y: CANVAS_HEIGHT,
      duration: CLOSE_MS,
      ease: 'Power2.easeIn',
      onComplete: () => this.onCloseCb(),
    });
  }

  private buildFrame(scene: Phaser.Scene): void {
    const frame = addFramedPanel(scene, {
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

    this.title = scene.add.text(CONTENT_X, 16, '', {
      fontFamily: 'sans-serif',
      fontSize: '17px',
      fontStyle: 'bold',
      color: CASUAL_CSS.INK,
      stroke: '#ffffff',
      strokeThickness: 3,
    }).setOrigin(0, 0);
    this.add(this.title);

    this.levelLabel = scene.add.text(CONTENT_X, 38, '', {
      fontFamily: 'sans-serif',
      fontSize: '10px',
      fontStyle: 'bold',
      color: CASUAL_CSS.INK_SOFT,
    }).setOrigin(0, 0);
    this.add(this.levelLabel);

    const closeButton = addPrimaryActionButton(scene, {
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

    const div = scene.add.graphics();
    div.lineStyle(2, CASUAL.EDGE_SOFT, 0.5);
    div.lineBetween(12, 54, CANVAS_WIDTH - 12, 54);
    this.add(div);
  }

  private buildUpgradeContent(
    row: number,
    col: number,
    data: RoomData,
    synergies?: Array<{ name: string; desc: string }>,
    hasLoadout = false,
  ): void {
    const def       = ROOM_DEFS[data.type];
    const nextLevel = data.level + 1;
    const cost      = getUpgradeCost(data.type, data.level);
    const rows      = this.getUpgradeRows(data, nextLevel);
    const previewY  = hasLoadout ? 136 : 66;
    const previewH  = hasLoadout ? 88 : 128;
    const costY     = hasLoadout ? 234 : 204;
    const buttonY   = hasLoadout ? 284 : 258;
    const synergyY  = hasLoadout ? 332 : 306;

    const preview = addFramedPanel(this.scene, {
      x: CONTENT_X,
      y: previewY,
      w: CONTENT_W,
      h: previewH,
      radius: 10,
      fillColor: CASUAL.PANEL,
      borderColor: def.accentColor,
      borderAlpha: 1,
      borderWidth: 3,
      accentColor: def.accentColor,
      accentAlpha: 1,
      glowColor: 0xffffff,
      glowOpacity: 0.4,
      shadowOpacity: 0.3,
      shadowOffsetY: 2,
    });
    this.addContent(preview.shadow, preview.panel, preview.glow);

    const header = this.scene.add.text(CONTENT_X + 14, previewY + 16, '업그레이드 미리보기', {
      fontFamily: 'sans-serif',
      fontSize: '10px',
      fontStyle: 'bold',
      color: CASUAL_CSS.INK_SOFT,
    }).setOrigin(0, 0);
    this.addContent(header);

    rows.slice(0, 3).forEach((stat, idx) => {
      const refs = addInfoRow(this.scene, {
        x: CONTENT_X + 12,
        y: previewY + 36 + idx * 27,
        w: CONTENT_W - 24,
        h: 23,
        icon: stat.icon,
        label: stat.label,
        value: stat.value,
        valueColor: stat.valueColor ?? CASUAL_CSS.GREEN,
        fillColor: CASUAL.PANEL_SOFT,
        borderColor: CASUAL.EDGE_SOFT,
      });
      this.addContent(refs.bg, refs.iconText, refs.labelText, refs.valueText);
    });

    const costPanel = addFramedPanel(this.scene, {
      x: CONTENT_X,
      y: costY,
      w: CONTENT_W,
      h: 44,
      radius: 9,
      fillColor: CASUAL.PANEL_SOFT,
      borderColor: CASUAL.GOLD_DK,
      borderAlpha: 1,
      borderWidth: 2,
      glowColor: 0xffffff,
      glowOpacity: 0.3,
      shadowOpacity: 0.22,
      shadowOffsetY: 1,
    });
    this.addContent(costPanel.shadow, costPanel.panel, costPanel.glow);

    const costLabel = this.scene.add.text(CONTENT_X + 14, costY + 22, '비용', {
      fontFamily: 'sans-serif',
      fontSize: '11px',
      fontStyle: 'bold',
      color: CASUAL_CSS.INK_SOFT,
    }).setOrigin(0, 0.5);
    const costText = this.scene.add.text(CANVAS_WIDTH - CONTENT_X - 14, costY + 22, `${cost} 골드`, {
      fontFamily: 'sans-serif',
      fontSize: '14px',
      fontStyle: 'bold',
      color: CASUAL_CSS.GOLD,
    }).setOrigin(1, 0.5);
    this.addContent(costLabel, costText);

    const button = addPrimaryActionButton(this.scene, {
      x: CONTENT_X,
      y: buttonY,
      w: CONTENT_W,
      h: 44,
      label: '업그레이드',
      fontSize: '15px',
      fillColor: CASUAL.GOLD,
      hoverFillColor: 0xffd24a,
      borderColor: CASUAL.GOLD_DK,
      hoverBorderColor: CASUAL.GOLD_DK,
      textColor: '#ffffff',
      onPress: () => {
        this.onUpgradeCb(row, col);
        this.close();
      },
    });
    this.addContent(button.bg, button.text, button.zone);

    this.buildSynergyHints(synergies, synergyY, 1);
  }

  private buildMaxLevelContent(synergies?: Array<{ name: string; desc: string }>, hasLoadout = false): void {
    const statusY = hasLoadout ? 142 : 74;
    const statusH = hasLoadout ? 116 : 136;
    const status = addFramedPanel(this.scene, {
      x: CONTENT_X,
      y: statusY,
      w: CONTENT_W,
      h: statusH,
      radius: 10,
      fillColor: CASUAL.PANEL,
      borderColor: CASUAL.GOLD_DK,
      borderAlpha: 1,
      borderWidth: 3,
      accentColor: CASUAL.GOLD,
      accentAlpha: 1,
      glowColor: 0xffffff,
      glowOpacity: 0.4,
      shadowOpacity: 0.3,
      shadowOffsetY: 2,
    });
    this.addContent(status.shadow, status.panel, status.glow);

    const icon = this.scene.add.text(CANVAS_WIDTH / 2, statusY + 32, '✨', {
      fontFamily: 'sans-serif',
      fontSize: hasLoadout ? '26px' : '30px',
    }).setOrigin(0.5);
    const title = this.scene.add.text(CANVAS_WIDTH / 2, statusY + 68, '최고 레벨 달성', {
      fontFamily: 'sans-serif',
      fontSize: '18px',
      fontStyle: 'bold',
      color: CASUAL_CSS.INK,
      stroke: '#ffffff',
      strokeThickness: 3,
    }).setOrigin(0.5);
    const sub = this.scene.add.text(CANVAS_WIDTH / 2, statusY + 94, '더 이상 업그레이드할 수 없습니다', {
      fontFamily: 'sans-serif',
      fontSize: '11px',
      fontStyle: 'bold',
      color: CASUAL_CSS.INK_SOFT,
    }).setOrigin(0.5);
    this.addContent(icon, title, sub);

    this.buildSynergyHints(synergies, hasLoadout ? 276 : 228, hasLoadout ? 2 : 3);
  }

  private buildLoadoutSummary(loadout: RoomUpgradeLoadoutSummary): void {
    const y = 62;
    const h = 64;
    const hpPct = Phaser.Math.Clamp(loadout.hp / Math.max(1, loadout.maxHp), 0, 1);
    const accentCSS = `#${loadout.accentColor.toString(16).padStart(6, '0')}`;

    const frame = addFramedPanel(this.scene, {
      x: CONTENT_X,
      y,
      w: CONTENT_W,
      h,
      radius: 10,
      fillColor: CASUAL.PANEL,
      borderColor: loadout.accentColor,
      borderAlpha: 1,
      borderWidth: 3,
      accentColor: loadout.accentColor,
      accentAlpha: 1,
      glowColor: 0xffffff,
      glowOpacity: 0.4,
      shadowOpacity: 0.28,
      shadowOffsetY: 2,
    });
    this.addContent(frame.shadow, frame.panel, frame.glow);

    const chip = this.scene.add.text(CONTENT_X + 14, y + 18, `${loadout.slotIcon} ${loadout.slotName}`, {
      fontFamily: 'sans-serif',
      fontSize: '12px',
      fontStyle: 'bold',
      color: CASUAL_CSS.INK,
    }).setOrigin(0, 0.5);
    const level = this.scene.add.text(CANVAS_WIDTH - CONTENT_X - 14, y + 18, `설계 Lv.${loadout.roomLevel}`, {
      fontFamily: 'sans-serif',
      fontSize: '10px',
      fontStyle: 'bold',
      color: accentCSS,
    }).setOrigin(1, 0.5);
    this.addContent(chip, level);

    const monsterText = this.scene.add.text(CONTENT_X + 14, y + 38, `수호자 ${loadout.monsters.length}/${loadout.monsterCapacity}`, {
      fontFamily: 'sans-serif',
      fontSize: '10px',
      fontStyle: 'bold',
      color: CASUAL_CSS.RED,
    }).setOrigin(0, 0.5);
    const monsterNames = this.scene.add.text(CONTENT_X + 86, y + 38, this.formatLoadoutNames(loadout.monsters, '미배치'), {
      fontFamily: 'sans-serif',
      fontSize: '10px',
      fontStyle: 'bold',
      color: CASUAL_CSS.INK,
    }).setOrigin(0, 0.5);
    this.addContent(monsterText, monsterNames);

    const trapText = this.scene.add.text(CONTENT_X + 14, y + 54, `함정 ${loadout.traps.length}/${loadout.trapCapacity}`, {
      fontFamily: 'sans-serif',
      fontSize: '10px',
      fontStyle: 'bold',
      color: CASUAL_CSS.GREEN,
    }).setOrigin(0, 0.5);
    const trapNames = this.scene.add.text(CONTENT_X + 86, y + 54, this.formatLoadoutNames(loadout.traps, '미설치'), {
      fontFamily: 'sans-serif',
      fontSize: '10px',
      fontStyle: 'bold',
      color: CASUAL_CSS.INK_SOFT,
    }).setOrigin(0, 0.5);
    this.addContent(trapText, trapNames);

    const bar = this.scene.add.graphics();
    const barX = CANVAS_WIDTH - CONTENT_X - 88;
    const barY = y + 48;
    bar.fillStyle(CASUAL.PANEL_SOFT, 1);
    bar.fillRoundedRect(barX, barY, 74, 6, 3);
    bar.lineStyle(1, CASUAL.EDGE_SOFT, 0.7);
    bar.strokeRoundedRect(barX, barY, 74, 6, 3);
    bar.fillStyle(hpPct > 0.6 ? CASUAL.GREEN : hpPct > 0.3 ? CASUAL.GOLD : CASUAL.RED, 1);
    bar.fillRoundedRect(barX, barY, Math.max(4, 74 * hpPct), 6, 3);
    const hpText = this.scene.add.text(CANVAS_WIDTH - CONTENT_X - 14, y + 38, `HP ${Math.round(loadout.hp)}/${Math.round(loadout.maxHp)}`, {
      fontFamily: 'sans-serif',
      fontSize: '8px',
      fontStyle: 'bold',
      color: CASUAL_CSS.INK_SOFT,
    }).setOrigin(1, 0.5);
    this.addContent(bar, hpText);
  }

  private formatLoadoutNames(items: readonly string[], emptyText: string): string {
    if (items.length === 0) return emptyText;
    const joined = items.slice(0, 2).join(' · ');
    return items.length > 2 ? `${joined} +${items.length - 2}` : joined;
  }

  private buildSynergyHints(
    synergies: Array<{ name: string; desc: string }> | undefined,
    y: number,
    maxShow = 2,
  ): void {
    if (!synergies || synergies.length === 0) return;

    const max = Math.min(synergies.length, maxShow);
    const panelH = 16 + max * 18;
    const frame = addFramedPanel(this.scene, {
      x: CONTENT_X,
      y,
      w: CONTENT_W,
      h: panelH,
      radius: 8,
      fillColor: CASUAL.PANEL_SOFT,
      borderColor: CASUAL.EDGE_SOFT,
      borderAlpha: 1,
      borderWidth: 2,
      glowColor: 0xffffff,
      glowOpacity: 0.3,
      shadowOpacity: 0.18,
      shadowOffsetY: 1,
    });
    this.addContent(frame.shadow, frame.panel, frame.glow);

    for (let i = 0; i < max; i++) {
      const syn = synergies[i];
      const sy = y + 10 + i * 18;
      const name = this.scene.add.text(CONTENT_X + 12, sy, syn.name, {
        fontFamily: 'sans-serif',
        fontSize: '10px',
        fontStyle: 'bold',
        color: CASUAL_CSS.GOLD,
      }).setOrigin(0, 0);
      const desc = this.scene.add.text(CANVAS_WIDTH - CONTENT_X - 12, sy, syn.desc, {
        fontFamily: 'sans-serif',
        fontSize: '10px',
        fontStyle: 'bold',
        color: CASUAL_CSS.INK_SOFT,
      }).setOrigin(1, 0);
      this.addContent(name, desc);
    }
  }

  private getUpgradeRows(data: RoomData, nextLevel: number): UpgradeRow[] {
    const def = ROOM_DEFS[data.type];

    if (def.attackDamage > 0) {
      const curDmg = getAttackDamage(data.type, data.level);
      const nxtDmg = getAttackDamage(data.type, nextLevel);
      const curCD  = (def.attackCooldown * Math.pow(0.75, data.level - 1) / 1000).toFixed(1);
      const nxtCD  = (def.attackCooldown * Math.pow(0.75, nextLevel - 1) / 1000).toFixed(1);
      return [
        { icon: '⚔', label: '공격력', value: `${curDmg} → ${nxtDmg}` },
        { icon: '⏱', label: '공격 주기', value: `${curCD}s → ${nxtCD}s` },
      ];
    }

    if (def.goldPerSec > 0) {
      const curG = Math.round(def.goldPerSec * Math.pow(1.5, data.level - 1));
      const nxtG = Math.round(def.goldPerSec * Math.pow(1.5, nextLevel - 1));
      return [
        { icon: '💰', label: '골드 생산', value: `${curG}/초 → ${nxtG}/초`, valueColor: CASUAL_CSS.GOLD },
        { icon: '✦', label: '방 레벨', value: `Lv.${data.level} → Lv.${nextLevel}` },
      ];
    }

    return [
      { icon: '✦', label: '방 레벨', value: `Lv.${data.level} → Lv.${nextLevel}` },
      { icon: '◇', label: '지원 효과', value: '효과 강화', valueColor: CASUAL_CSS.GOLD },
    ];
  }

  private clearContent(): void {
    this.contentGroup.forEach(obj => obj.destroy());
    this.contentGroup = [];
  }

  private addContent(...objects: Phaser.GameObjects.GameObject[]): void {
    objects.forEach(obj => {
      this.add(obj);
      this.contentGroup.push(obj);
    });
  }
}
