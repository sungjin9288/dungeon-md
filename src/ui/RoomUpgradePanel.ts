import Phaser from 'phaser';
import { COLORS, CSS } from '../constants/colors';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../constants/layout';
import {
  ROOM_DEFS, getUpgradeCost, getAttackDamage, MAX_ROOM_LEVEL,
  type RoomData,
} from '../data/rooms';

const PANEL_H = 340;  // extra 40px for synergy hints at bottom

export class RoomUpgradePanel extends Phaser.GameObjects.Container {
  private isOpen       = false;
  private title!:       Phaser.GameObjects.Text;
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

    // Background
    const bg = scene.add.graphics();
    bg.fillStyle(0x1a1008, 0.97);
    bg.fillRoundedRect(0, 0, CANVAS_WIDTH, PANEL_H, { tl: 14, tr: 14, bl: 0, br: 0 });
    bg.lineStyle(2, COLORS.TORCH_GOLD, 0.75);
    bg.strokeRoundedRect(0, 0, CANVAS_WIDTH, PANEL_H, { tl: 14, tr: 14, bl: 0, br: 0 });
    this.add(bg);

    // Title
    this.title = scene.add.text(CANVAS_WIDTH / 2, 20, '', {
      fontFamily: "Georgia, serif",
      fontSize: '15px', fontStyle: 'bold',
      color: CSS.TORCH_AMBER,
    }).setOrigin(0.5, 0);
    this.add(this.title);

    // Close button
    const closeBtn = scene.add.text(CANVAS_WIDTH - 16, 16, '✕', {
      fontFamily: 'sans-serif', fontSize: '14px', color: CSS.PARCHMENT_MUTED,
    }).setOrigin(1, 0).setInteractive({ useHandCursor: true });
    closeBtn.on('pointerdown', () => this.close());
    this.add(closeBtn);

    scene.add.existing(this);
    this.setDepth(210);
  }

  open(row: number, col: number, data: RoomData, synergies?: Array<{ name: string; desc: string }>): void {
    if (this.isOpen) return;
    this.isOpen = true;

    // Rebuild content
    this.contentGroup.forEach(g => (g as Phaser.GameObjects.GameObject & { destroy(): void }).destroy());
    this.contentGroup = [];

    const def        = ROOM_DEFS[data.type];
    const isMaxLevel = data.level >= MAX_ROOM_LEVEL;
    const romanNums  = ['Ⅰ', 'Ⅱ', 'Ⅲ'];
    this.title.setText(`${def.koreanName}  ${romanNums[data.level - 1]}`);

    if (isMaxLevel) {
      const t = this.scene.add.text(CANVAS_WIDTH / 2, 90, '✨ 최고 레벨 달성', {
        fontFamily: "Georgia, serif", fontSize: '18px', fontStyle: 'bold',
        color: CSS.TORCH_AMBER,
      }).setOrigin(0.5);
      this.add(t);
      this.contentGroup.push(t);

      const sub = this.scene.add.text(CANVAS_WIDTH / 2, 126, '더 이상 업그레이드할 수 없습니다', {
        fontFamily: 'sans-serif', fontSize: '11px', color: CSS.PARCHMENT_MUTED,
      }).setOrigin(0.5);
      this.add(sub);
      this.contentGroup.push(sub);

    } else {
      const nextLevel = data.level + 1;
      const cost      = getUpgradeCost(data.type, data.level);

      // ── Stat table ───────────────────────────────────────────────────────
      const tableX = 24;
      let ty = 56;

      // Headers
      const headers = ['스탯', '현재', `레벨 ${nextLevel}`];
      const headerX = [tableX, tableX + 148, tableX + 252];
      headers.forEach((h, i) => {
        const t = this.scene.add.text(headerX[i], ty, h, {
          fontFamily: 'sans-serif', fontSize: '10px', color: CSS.PARCHMENT_MUTED,
        });
        this.add(t); this.contentGroup.push(t);
      });
      ty += 16;

      // Divider
      const div = this.scene.add.graphics();
      div.lineStyle(1, COLORS.STONE_MID, 0.45);
      div.lineBetween(tableX, ty, CANVAS_WIDTH - 20, ty);
      this.add(div); this.contentGroup.push(div);
      ty += 8;

      // Rows
      const rows: Array<{ label: string; cur: string; nxt: string }> = [];
      if (def.attackDamage > 0) {
        const curDmg = getAttackDamage(data.type, data.level);
        const nxtDmg = getAttackDamage(data.type, nextLevel);
        // Cooldown: base * 0.75^(level-1)
        const curCD = (def.attackCooldown * Math.pow(0.75, data.level - 1) / 1000).toFixed(1);
        const nxtCD = (def.attackCooldown * Math.pow(0.75, nextLevel - 1) / 1000).toFixed(1);
        rows.push({ label: '공격력',   cur: `${curDmg} dmg`, nxt: `${nxtDmg} dmg` });
        rows.push({ label: '공격속도', cur: `${curCD}s`,      nxt: `${nxtCD}s` });
      } else if (def.goldPerSec > 0) {
        const curG = Math.round(def.goldPerSec * Math.pow(1.5, data.level - 1));
        const nxtG = Math.round(def.goldPerSec * Math.pow(1.5, nextLevel - 1));
        rows.push({ label: '골드/초', cur: `${curG}💰`, nxt: `${nxtG}💰` });
      }

      rows.forEach(({ label, cur, nxt }) => {
        const lT = this.scene.add.text(tableX,          ty, label, { fontFamily: 'sans-serif', fontSize: '12px', color: CSS.PARCHMENT });
        const cT = this.scene.add.text(tableX + 148,    ty, cur,   { fontFamily: 'sans-serif', fontSize: '12px', color: CSS.PARCHMENT });
        const nT = this.scene.add.text(tableX + 252,    ty, `${nxt} ↑`, { fontFamily: 'sans-serif', fontSize: '12px', color: '#88ff88' });
        [lT, cT, nT].forEach(t => { this.add(t); this.contentGroup.push(t); });
        ty += 26;
      });

      // Cost line
      const costT = this.scene.add.text(CANVAS_WIDTH / 2, ty + 8, `업그레이드 비용: ${cost}💰`, {
        fontFamily: 'sans-serif', fontSize: '13px', color: CSS.TORCH_AMBER,
      }).setOrigin(0.5);
      this.add(costT); this.contentGroup.push(costT);

      // ── Upgrade button ────────────────────────────────────────────────────
      const btnY  = ty + 42;
      const btnW  = 220, btnH = 40;
      const btnCX = CANVAS_WIDTH / 2;

      const btnBg = this.scene.add.graphics();
      btnBg.fillStyle(0x5a3800, 1);
      btnBg.fillRoundedRect(btnCX - btnW / 2, btnY, btnW, btnH, 6);
      btnBg.lineStyle(1.5, COLORS.TORCH_GOLD, 0.8);
      btnBg.strokeRoundedRect(btnCX - btnW / 2, btnY, btnW, btnH, 6);
      this.add(btnBg); this.contentGroup.push(btnBg);

      const btnT = this.scene.add.text(btnCX, btnY + btnH / 2, '업그레이드', {
        fontFamily: "Georgia, serif", fontSize: '14px', fontStyle: 'bold',
        color: CSS.TORCH_AMBER,
      }).setOrigin(0.5);
      this.add(btnT); this.contentGroup.push(btnT);

      const zone = this.scene.add.zone(btnCX, btnY + btnH / 2, btnW, btnH)
        .setInteractive({ useHandCursor: true });
      zone.on('pointerdown', () => {
        this.onUpgradeCb(row, col);
        this.close();
      });
      this.add(zone); this.contentGroup.push(zone);

      // ── Active synergy hints ──────────────────────────────────────────────
      if (synergies && synergies.length > 0) {
        const synY = btnY + btnH + 10;
        const divS = this.scene.add.graphics();
        divS.lineStyle(1, COLORS.STONE_MID, 0.3);
        divS.lineBetween(tableX, synY, CANVAS_WIDTH - 20, synY);
        this.add(divS); this.contentGroup.push(divS);

        const hdr = this.scene.add.text(CANVAS_WIDTH / 2, synY + 7, '✨ 활성 시너지', {
          fontFamily: 'sans-serif', fontSize: '10px', color: CSS.PARCHMENT_MUTED,
        }).setOrigin(0.5);
        this.add(hdr); this.contentGroup.push(hdr);

        const maxShow = Math.min(synergies.length, 3);
        for (let si = 0; si < maxShow; si++) {
          const syn = synergies[si];
          const sy  = synY + 20 + si * 18;
          const nT  = this.scene.add.text(tableX, sy, `• ${syn.name}`, {
            fontFamily: 'sans-serif', fontSize: '10px', color: '#ffcc88',
          });
          const dT  = this.scene.add.text(CANVAS_WIDTH - 20, sy, syn.desc, {
            fontFamily: 'sans-serif', fontSize: '10px', color: CSS.PARCHMENT_MUTED,
          }).setOrigin(1, 0);
          [nT, dT].forEach(t => { this.add(t); this.contentGroup.push(t); });
        }
      }
    }

    // Slide up
    this.scene.tweens.add({
      targets: this,
      y: CANVAS_HEIGHT - PANEL_H,
      duration: 250,
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
      duration: 220,
      ease: 'Power2.easeIn',
      onComplete: () => this.onCloseCb(),
    });
  }
}
