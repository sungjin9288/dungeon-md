import Phaser from 'phaser';
import { COLORS, CSS } from '../constants/colors';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../constants/layout';

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
    const g = this.add.graphics();
    g.fillStyle(0x080412, 1);
    g.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    // Subtle grid overlay
    const ts = 40;
    for (let x = 0; x < CANVAS_WIDTH; x += ts) {
      for (let y = 0; y < CANVAS_HEIGHT; y += ts) {
        g.fillStyle(0x120820, 0.5);
        g.fillRect(x, y, ts - 1, ts - 1);
      }
    }
  }

  // ─── Stone tablet ──────────────────────────────────────────────────────────

  private drawTablet(result: EndlessResult): void {
    const tw = 300, th = 440;
    const tx = (CANVAS_WIDTH - tw) / 2;
    const ty = 80;

    // Stone tablet body
    const g = this.add.graphics();
    g.fillStyle(0x2a2018, 1);
    g.fillRoundedRect(tx, ty, tw, th, 12);
    g.lineStyle(2.5, COLORS.TORCH_GOLD, 0.5);
    g.strokeRoundedRect(tx, ty, tw, th, 12);
    // Inner border
    g.lineStyle(1, 0x6a5030, 0.4);
    g.strokeRoundedRect(tx + 8, ty + 8, tw - 16, th - 16, 8);

    // Title
    const cx = CANVAS_WIDTH / 2;
    this.add.text(cx, ty + 36, '무한 던전 결과', {
      fontFamily: 'Georgia, serif', fontSize: '20px', fontStyle: 'bold',
      color: CSS.TORCH_AMBER,
    }).setOrigin(0.5);

    // Divider
    const dg = this.add.graphics();
    dg.lineStyle(1, COLORS.TORCH_GOLD, 0.35);
    dg.lineBetween(tx + 20, ty + 56, tx + tw - 20, ty + 56);

    // New record flash
    if (result.isNewRecord) {
      const flash = this.add.text(cx, ty + 76, '★ 신기록 ★', {
        fontFamily: 'Georgia, serif', fontSize: '15px', fontStyle: 'bold',
        color: '#ffdd00',
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

    this.drawStat(cx, rowY,       '⚔ 도달 웨이브',  String(result.wave),          CSS.PARCHMENT);
    this.drawStat(cx, rowY + 56,  '💀 처치 수',      result.kills.toLocaleString(), CSS.PARCHMENT);
    this.drawStat(cx, rowY + 112, '🪙 획득 골드',    result.goldEarned.toLocaleString(), '#f0d060');
    this.drawStat(cx, rowY + 168, '💎 획득 수정',    String(result.crystalsEarned), '#cc88ff');

    // Crystal formula hint
    this.add.text(cx, rowY + 215, `(웨이브÷5 + 마일스톤 보너스 × 선조의 지혜)`, {
      fontFamily: 'sans-serif', fontSize: '9px', color: '#7a5090',
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
      const deltaColor = delta > 0 ? '#44ff88' : delta === 0 ? '#ffcc44' : '#ff6666';

      this.add.text(cx, compY, `이전 최고: ${result.previousBest}파`, {
        fontFamily: 'sans-serif', fontSize: '11px', color: '#886644',
      }).setOrigin(0.5);

      this.add.text(cx, compY + 18, deltaText, {
        fontFamily: 'sans-serif', fontSize: '12px', fontStyle: 'bold', color: deltaColor,
      }).setOrigin(0.5);
    }
  }

  private drawStat(cx: number, y: number, label: string, value: string, valueColor: string): void {
    this.add.text(cx, y, label, {
      fontFamily: 'sans-serif', fontSize: '11px', color: CSS.PARCHMENT_MUTED,
    }).setOrigin(0.5);
    this.add.text(cx, y + 24, value, {
      fontFamily: 'Georgia, serif', fontSize: '26px', fontStyle: 'bold',
      color: valueColor,
    }).setOrigin(0.5);
  }

  // ─── Buttons ────────────────────────────────────────────────────────────────

  private drawButtons(): void {
    const cx  = CANVAS_WIDTH / 2;
    const by  = 548;
    const bw  = 130, bh = 44;

    // [다시 도전] — retry endless
    this.makeButton(
      cx - bw / 2 - 6, by, bw, bh,
      '다시 도전',
      0x1a0808, 0xcc2200, '#ff6644',
      () => {
        this.registry.set('stageConfig', { stageNumber: 0, slots: 9, endless: true });
        this.scene.start('DungeonScene');
      },
    );

    // [스테이지 선택으로]
    this.makeButton(
      cx + 6, by, bw, bh,
      '스테이지 선택',
      0x141008, 0x7a5820, CSS.PARCHMENT,
      () => this.scene.start('StageSelectScene'),
    );
  }

  private makeButton(
    x: number, y: number, w: number, h: number,
    label: string,
    fillColor: number, borderColor: number, textColor: string,
    onClick: () => void,
  ): void {
    const bg = this.add.graphics();
    const draw = (hovered: boolean) => {
      bg.clear();
      bg.fillStyle(hovered ? 0x2a2010 : fillColor, 1);
      bg.fillRoundedRect(x, y, w, h, 8);
      bg.lineStyle(2, hovered ? COLORS.TORCH_GOLD : borderColor, 0.85);
      bg.strokeRoundedRect(x, y, w, h, 8);
    };
    draw(false);

    this.add.text(x + w / 2, y + h / 2, label, {
      fontFamily: 'Georgia, serif', fontSize: '12px', fontStyle: 'bold',
      color: textColor,
    }).setOrigin(0.5);

    const zone = this.add.zone(x + w / 2, y + h / 2, w, h)
      .setInteractive({ useHandCursor: true });
    zone.on('pointerover',  () => draw(true));
    zone.on('pointerout',   () => draw(false));
    zone.on('pointerdown',  onClick);
  }
}
