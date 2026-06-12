import Phaser from 'phaser';
import { COLORS, CSS } from '../constants/colors';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../constants/layout';
import {
  ROOM_DEFS, getUpgradeCost, getAttackDamage, MAX_ROOM_LEVEL,
  type RoomData,
} from '../data/rooms';
import {
  addFramedPanel,
  addInfoRow,
  addPrimaryActionButton,
  GAME_UI,
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
      fontFamily: "Georgia, serif", fontSize: '13px', color: '#ff4444',
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

    this.title = scene.add.text(CONTENT_X, 16, '', {
      fontFamily: "Georgia, 'Times New Roman', serif",
      fontSize: '17px',
      fontStyle: 'bold',
      color: CSS.TORCH_AMBER,
    }).setOrigin(0, 0);
    this.add(this.title);

    this.levelLabel = scene.add.text(CONTENT_X, 37, '', {
      fontFamily: 'sans-serif',
      fontSize: '10px',
      fontStyle: 'bold',
      color: CSS.PARCHMENT_DIM,
    }).setOrigin(0, 0);
    this.add(this.levelLabel);

    const closeButton = addPrimaryActionButton(scene, {
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

    const div = scene.add.graphics();
    div.lineStyle(1, COLORS.TORCH_GOLD, 0.3);
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
      fillColor: GAME_UI.colors.panelFill,
      borderColor: def.accentColor,
      borderAlpha: 0.62,
      borderWidth: 1.5,
      accentColor: def.accentColor,
      accentAlpha: 0.72,
      glowColor: def.accentColor,
      glowOpacity: 0.08,
      shadowOpacity: 0.24,
      shadowOffsetY: 2,
    });
    this.addContent(preview.shadow, preview.panel, preview.glow);

    const header = this.scene.add.text(CONTENT_X + 14, previewY + 14, '업그레이드 미리보기', {
      fontFamily: 'sans-serif',
      fontSize: '10px',
      fontStyle: 'bold',
      color: CSS.PARCHMENT_MUTED,
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
        valueColor: stat.valueColor ?? '#88ff88',
        fillColor: 0x120c05,
        borderColor: 0x3a2810,
      });
      this.addContent(refs.bg, refs.iconText, refs.labelText, refs.valueText);
    });

    const costPanel = addFramedPanel(this.scene, {
      x: CONTENT_X,
      y: costY,
      w: CONTENT_W,
      h: 44,
      radius: 9,
      fillColor: 0x120b03,
      borderColor: COLORS.TORCH_GOLD,
      borderAlpha: 0.52,
      borderWidth: 1,
      glowColor: COLORS.TORCH_GOLD,
      glowOpacity: 0.06,
      shadowOpacity: 0.18,
      shadowOffsetY: 1,
    });
    this.addContent(costPanel.shadow, costPanel.panel, costPanel.glow);

    const costLabel = this.scene.add.text(CONTENT_X + 14, costY + 22, '비용', {
      fontFamily: 'sans-serif',
      fontSize: '11px',
      color: CSS.PARCHMENT_MUTED,
    }).setOrigin(0, 0.5);
    const costText = this.scene.add.text(CANVAS_WIDTH - CONTENT_X - 14, costY + 22, `${cost} 골드`, {
      fontFamily: 'sans-serif',
      fontSize: '14px',
      fontStyle: 'bold',
      color: CSS.TORCH_AMBER,
    }).setOrigin(1, 0.5);
    this.addContent(costLabel, costText);

    const button = addPrimaryActionButton(this.scene, {
      x: CONTENT_X,
      y: buttonY,
      w: CONTENT_W,
      h: 44,
      label: '업그레이드',
      fontSize: '15px',
      fillColor: 0x6a3f00,
      hoverFillColor: 0x8a5600,
      borderColor: COLORS.TORCH_GOLD,
      hoverBorderColor: COLORS.TORCH_AMBER,
      textColor: CSS.TORCH_AMBER,
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
      fillColor: GAME_UI.colors.panelFill,
      borderColor: COLORS.TORCH_GOLD,
      borderAlpha: 0.65,
      borderWidth: 1.5,
      accentColor: COLORS.TORCH_GOLD,
      accentAlpha: 0.82,
      glowColor: COLORS.TORCH_AMBER,
      glowOpacity: 0.1,
      shadowOpacity: 0.24,
      shadowOffsetY: 2,
    });
    this.addContent(status.shadow, status.panel, status.glow);

    const icon = this.scene.add.text(CANVAS_WIDTH / 2, statusY + 32, '✨', {
      fontFamily: 'sans-serif',
      fontSize: hasLoadout ? '26px' : '30px',
    }).setOrigin(0.5);
    const title = this.scene.add.text(CANVAS_WIDTH / 2, statusY + 68, '최고 레벨 달성', {
      fontFamily: "Georgia, serif",
      fontSize: '18px',
      fontStyle: 'bold',
      color: CSS.TORCH_AMBER,
    }).setOrigin(0.5);
    const sub = this.scene.add.text(CANVAS_WIDTH / 2, statusY + 94, '더 이상 업그레이드할 수 없습니다', {
      fontFamily: 'sans-serif',
      fontSize: '11px',
      color: CSS.PARCHMENT_MUTED,
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
      fillColor: 0x101f2c,
      borderColor: loadout.accentColor,
      borderAlpha: 0.7,
      borderWidth: 1.5,
      accentColor: loadout.accentColor,
      accentAlpha: 0.78,
      glowColor: loadout.accentColor,
      glowOpacity: 0.08,
      shadowOpacity: 0.22,
      shadowOffsetY: 2,
    });
    this.addContent(frame.shadow, frame.panel, frame.glow);

    const chip = this.scene.add.text(CONTENT_X + 14, y + 17, `${loadout.slotIcon} ${loadout.slotName}`, {
      fontFamily: 'Trebuchet MS, Apple SD Gothic Neo, sans-serif',
      fontSize: '12px',
      fontStyle: 'bold',
      color: '#f0e6c8',
    }).setOrigin(0, 0.5);
    const level = this.scene.add.text(CANVAS_WIDTH - CONTENT_X - 14, y + 17, `설계 Lv.${loadout.roomLevel}`, {
      fontFamily: 'monospace',
      fontSize: '10px',
      fontStyle: 'bold',
      color: accentCSS,
    }).setOrigin(1, 0.5);
    this.addContent(chip, level);

    const monsterText = this.scene.add.text(CONTENT_X + 14, y + 38, `수호자 ${loadout.monsters.length}/${loadout.monsterCapacity}`, {
      fontFamily: 'sans-serif',
      fontSize: '10px',
      color: '#ffd3a6',
    }).setOrigin(0, 0.5);
    const monsterNames = this.scene.add.text(CONTENT_X + 86, y + 38, this.formatLoadoutNames(loadout.monsters, '미배치'), {
      fontFamily: 'sans-serif',
      fontSize: '10px',
      color: CSS.PARCHMENT,
    }).setOrigin(0, 0.5);
    this.addContent(monsterText, monsterNames);

    const trapText = this.scene.add.text(CONTENT_X + 14, y + 54, `함정 ${loadout.traps.length}/${loadout.trapCapacity}`, {
      fontFamily: 'sans-serif',
      fontSize: '10px',
      color: '#b9ffd8',
    }).setOrigin(0, 0.5);
    const trapNames = this.scene.add.text(CONTENT_X + 86, y + 54, this.formatLoadoutNames(loadout.traps, '미설치'), {
      fontFamily: 'sans-serif',
      fontSize: '10px',
      color: CSS.PARCHMENT_DIM,
    }).setOrigin(0, 0.5);
    this.addContent(trapText, trapNames);

    const bar = this.scene.add.graphics();
    const barX = CANVAS_WIDTH - CONTENT_X - 88;
    const barY = y + 48;
    bar.fillStyle(0x140c03, 0.92);
    bar.fillRoundedRect(barX, barY, 74, 6, 3);
    bar.fillStyle(hpPct > 0.6 ? 0x5fb854 : hpPct > 0.3 ? 0xe8c468 : 0xd9594a, 0.95);
    bar.fillRoundedRect(barX, barY, Math.max(4, 74 * hpPct), 6, 3);
    const hpText = this.scene.add.text(CANVAS_WIDTH - CONTENT_X - 14, y + 38, `HP ${Math.round(loadout.hp)}/${Math.round(loadout.maxHp)}`, {
      fontFamily: 'monospace',
      fontSize: '8px',
      color: '#e8d5aa',
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
      fillColor: 0x0d0a07,
      borderColor: COLORS.STONE_MID,
      borderAlpha: 0.36,
      borderWidth: 1,
      glowColor: COLORS.TORCH_AMBER,
      glowOpacity: 0.04,
      shadowOpacity: 0.12,
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
        color: '#ffcc88',
      }).setOrigin(0, 0);
      const desc = this.scene.add.text(CANVAS_WIDTH - CONTENT_X - 12, sy, syn.desc, {
        fontFamily: 'sans-serif',
        fontSize: '10px',
        color: CSS.PARCHMENT_MUTED,
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
        { icon: '💰', label: '골드 생산', value: `${curG}/초 → ${nxtG}/초`, valueColor: CSS.TORCH_AMBER },
        { icon: '✦', label: '방 레벨', value: `Lv.${data.level} → Lv.${nextLevel}` },
      ];
    }

    return [
      { icon: '✦', label: '방 레벨', value: `Lv.${data.level} → Lv.${nextLevel}` },
      { icon: '◇', label: '지원 효과', value: '효과 강화', valueColor: CSS.TORCH_AMBER },
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
