import Phaser from 'phaser';
import { CASUAL, CASUAL_CSS } from '../constants/colors';
import { applyCasualBackground } from '../ui/AmbientBackground';
import { CANVAS_WIDTH } from '../constants/layout';

// ─── EndlessResultScene ───────────────────────────────────────────────────────
//
// Shown when the player dies in endless mode.
// Displays stone-tablet stats: wave reached, kills, gold earned, crystals earned.
// Crystal formula: base = floor(wave/5) + milestone bonuses, scaled by crystalEarnMult.

interface EndlessResult {
  wave:           number;
  kills:          number;
  goldEarned:     number;
  crystalsEarned: number;
  isNewRecord:    boolean;
  previousBest:   number;
}

export class EndlessResultScene extends Phaser.Scene {
  constructor() { super({ key: 'EndlessResultScene' }); }

  create(): void {
    const result = this.registry.get('endlessResult') as EndlessResult | undefined;
    if (!result) {
      // Fallback — shouldn't happen
      this.scene.start('StageSelectScene');
      return;
    }

    this.drawBackground();
    this.drawTablet(result);
    this.drawButtons();

    // Slide-in animation
    this.cameras.main.setAlpha(0);
    this.tweens.add({
      targets: this.cameras.main,
      alpha: 1,
      duration: 400,
      ease: 'Power2',
    });
  }

  // ─── Background ────────────────────────────────────────────────────────────

  private drawBackground(): void {
    // Bright casual storybook backdrop (gradient + sun glow + polka dots).
    applyCasualBackground(this);
  }

  // ─── Stone tablet ──────────────────────────────────────────────────────────

  private drawTablet(result: EndlessResult): void {
    const tw = 300, th = 440;
    const tx = (CANVAS_WIDTH - tw) / 2;
    const ty = 80;

    // Cream result card
    const g = this.add.graphics();
    g.fillStyle(CASUAL.SHADOW, 0.22);
    g.fillRoundedRect(tx, ty + 6, tw, th, 16);
    g.fillStyle(CASUAL.PANEL, 1);
    g.fillRoundedRect(tx, ty, tw, th, 16);
    g.lineStyle(3, CASUAL.EDGE, 1);
    g.strokeRoundedRect(tx, ty, tw, th, 16);
    // White top highlight
    g.fillStyle(0xffffff, 0.4);
    g.fillRoundedRect(tx + 6, ty + 6, tw - 12, 7, 4);
    // Soft inner border
    g.lineStyle(1.5, CASUAL.EDGE_SOFT, 0.5);
    g.strokeRoundedRect(tx + 8, ty + 8, tw - 16, th - 16, 11);

    // Title
    const cx = CANVAS_WIDTH / 2;
    this.add.text(cx, ty + 36, '무한 던전 결과', {
      fontFamily: 'sans-serif', fontSize: '20px', fontStyle: 'bold',
      color: CASUAL_CSS.INK, stroke: '#ffffff', strokeThickness: 4,
    }).setOrigin(0.5);

    // Divider
    const dg = this.add.graphics();
    dg.lineStyle(1.5, CASUAL.EDGE_SOFT, 0.5);
    dg.lineBetween(tx + 20, ty + 56, tx + tw - 20, ty + 56);

    // New record flash
    if (result.isNewRecord) {
      const flash = this.add.text(cx, ty + 76, '★ 신기록 ★', {
        fontFamily: 'sans-serif', fontSize: '15px', fontStyle: 'bold',
        color: CASUAL_CSS.GOLD, stroke: '#ffffff', strokeThickness: 3,
      }).setOrigin(0.5);
      this.tweens.add({
        targets: flash,
        alpha: { from: 1, to: 0.3 },
        duration: 600,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.InOut',
      });
    }

    const rowY = result.isNewRecord ? ty + 108 : ty + 84;

    this.drawStat(cx, rowY,       '⚔ 도달 웨이브',  String(result.wave),          CASUAL_CSS.INK);
    this.drawStat(cx, rowY + 56,  '💀 처치 수',      result.kills.toLocaleString(), CASUAL_CSS.INK);
    this.drawStat(cx, rowY + 112, '🪙 획득 골드',    result.goldEarned.toLocaleString(), CASUAL_CSS.GOLD);
    this.drawStat(cx, rowY + 168, '💠 획득 수정',    String(result.crystalsEarned), CASUAL_CSS.PURPLE);

    // Crystal formula hint
    this.add.text(cx, rowY + 215, `(웨이브÷5 + 마일스톤 보너스 × 선조의 지혜)`, {
      fontFamily: 'sans-serif', fontSize: '9px', color: CASUAL_CSS.INK_SOFT,
    }).setOrigin(0.5);

    // Previous best comparison
    if (result.previousBest > 0) {
      const compY = rowY + 240;
      const delta = result.wave - result.previousBest;
      const deltaText = delta > 0
        ? `▲ ${delta}웨이브 신기록!`
        : delta === 0
        ? `= 이전 기록 타이`
        : `▼ ${Math.abs(delta)}웨이브 (이전: ${result.previousBest}파)`;
      const deltaColor = delta > 0 ? CASUAL_CSS.GREEN : delta === 0 ? CASUAL_CSS.GOLD : CASUAL_CSS.RED;

      this.add.text(cx, compY, `이전 최고: ${result.previousBest}파`, {
        fontFamily: 'sans-serif', fontSize: '11px', color: CASUAL_CSS.INK_SOFT,
      }).setOrigin(0.5);

      this.add.text(cx, compY + 18, deltaText, {
        fontFamily: 'sans-serif', fontSize: '12px', fontStyle: 'bold', color: deltaColor,
      }).setOrigin(0.5);
    }
  }

  private drawStat(cx: number, y: number, label: string, value: string, valueColor: string): void {
    this.add.text(cx, y, label, {
      fontFamily: 'sans-serif', fontSize: '11px', color: CASUAL_CSS.INK_SOFT,
    }).setOrigin(0.5);
    this.add.text(cx, y + 24, value, {
      fontFamily: 'sans-serif', fontSize: '26px', fontStyle: 'bold',
      color: valueColor,
    }).setOrigin(0.5);
  }

  // ─── Buttons ────────────────────────────────────────────────────────────────

  private drawButtons(): void {
    const cx  = CANVAS_WIDTH / 2;
    const by  = 548;
    const bw  = 130, bh = 44;

    // [다시 도전] — retry endless (primary: green candy)
    this.makeButton(
      cx - bw / 2 - 6, by, bw, bh,
      '다시 도전',
      CASUAL.GREEN, CASUAL.GREEN_DK, CASUAL_CSS.WHITE, true,
      () => {
        this.registry.set('stageConfig', { stageNumber: 0, slots: 9, endless: true });
        this.scene.start('DungeonScene');
      },
    );

    // [스테이지 선택으로] (secondary: cream pill)
    this.makeButton(
      cx + 6, by, bw, bh,
      '스테이지 선택',
      CASUAL.PANEL, CASUAL.EDGE, CASUAL_CSS.INK, false,
      () => this.scene.start('StageSelectScene'),
    );
  }

  private makeButton(
    x: number, y: number, w: number, h: number,
    label: string,
    capColor: number, baseColor: number, textColor: string, primary: boolean,
    onClick: () => void,
  ): void {
    const r = 12;
    const bg = this.add.graphics();
    const draw = (hovered: boolean) => {
      bg.clear();
      // thick colored bottom edge (candy-button base)
      bg.fillStyle(baseColor, 1);
      bg.fillRoundedRect(x, y + 4, w, h, r);
      // bright cap
      bg.fillStyle(capColor, 1);
      bg.fillRoundedRect(x, y, w, h - 2, r);
      // glossy top highlight
      bg.fillStyle(0xffffff, primary ? 0.32 : 0.5);
      bg.fillRoundedRect(x + 5, y + 4, w - 10, Math.max(8, h * 0.36), Math.max(5, r - 4));
      // hover: bright outline
      if (hovered) {
        bg.lineStyle(2, 0xffffff, 0.6);
        bg.strokeRoundedRect(x, y, w, h - 2, r);
      }
    };
    draw(false);

    this.add.text(x + w / 2, y + (h - 2) / 2, label, {
      fontFamily: 'sans-serif', fontSize: '13px', fontStyle: 'bold',
      color: textColor,
      stroke: primary ? '#00000033' : undefined,
      strokeThickness: primary ? 3 : 0,
    }).setOrigin(0.5);

    const zone = this.add.zone(x + w / 2, y + h / 2, w, h)
      .setInteractive({ useHandCursor: true });
    zone.on('pointerover',  () => draw(true));
    zone.on('pointerout',   () => draw(false));
    zone.on('pointerdown',  onClick);
  }
}
