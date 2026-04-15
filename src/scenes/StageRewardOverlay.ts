import Phaser from 'phaser';
import { COLORS, CSS } from '../constants/colors';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../constants/layout';
import { STAGE_CONFIGS } from '../data/stageProgress';

export class StageRewardOverlay extends Phaser.Scene {
  constructor() { super({ key: 'StageRewardOverlay' }); }

  create(): void {
    this.cameras.main.backgroundColor.alpha = 0;
    // Phaser 3 worldView formula: worldView.x = scrollX + (width/2) - (width/2)/zoom
    // With DPR zoom=2, width=780: worldView.x = scrollX + 195, worldView.y = scrollY + 422
    // To map world (0,0)→(390,844) onto screen (= CANVAS dimensions), set:
    this.cameras.main.setScroll(-195, -422);
    const idx = this.registry.get('_rewardPreviewIdx') as number ?? 0;
    const cfg = STAGE_CONFIGS[idx];
    const ch = cfg.chapter ?? 1;
    const waveCount = 10;
    let estimatedGold = 0;
    for (let w = 1; w <= waveCount; w++) estimatedGold += 50 + w * 10 + (ch - 1) * 40;
    const estimatedGems = cfg.bossWave ? 5 : 2;
    const isBoss = cfg.bossWave ?? false;

    const cw = 280, ch2 = 200;
    const cx = CANVAS_WIDTH / 2 - cw / 2;
    const cy = CANVAS_HEIGHT / 2 - ch2 / 2;

    // Dim
    const dim = this.add.graphics();
    dim.fillStyle(0x000000, 0.6);
    dim.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Card
    const card = this.add.graphics();
    card.fillStyle(0x1a1208, 1);
    card.fillRoundedRect(cx, cy, cw, ch2, 10);
    card.lineStyle(2, COLORS.TORCH_GOLD, 0.85);
    card.strokeRoundedRect(cx, cy, cw, ch2, 10);

    // Title
    this.add.text(CANVAS_WIDTH / 2, cy + 20, `⚔️ 스테이지 ${cfg.stageNumber}`, {
      fontFamily: 'Georgia, serif', fontSize: '16px', fontStyle: 'bold', color: CSS.TORCH_AMBER,
    }).setOrigin(0.5);

    // Divider
    const dg = this.add.graphics();
    dg.lineStyle(1, COLORS.TORCH_GOLD, 0.2);
    dg.lineBetween(cx + 16, cy + 38, cx + cw - 16, cy + 38);

    // Reward rows
    const rows = [
      { label: '예상 골드', value: `~${estimatedGold.toLocaleString('ko-KR')} 💰`, color: '#ffcc44' },
      { label: '보석',      value: `+${estimatedGems} 💎`,                          color: '#aa88ff' },
      { label: '웨이브',    value: `${waveCount}파`,                                 color: CSS.PARCHMENT_MUTED },
      { label: '보스',      value: isBoss ? '있음 👹' : '없음',                       color: isBoss ? '#ff6655' : '#666666' },
    ];
    rows.forEach(({ label, value, color }, i) => {
      const ry = cy + 54 + i * 24;
      this.add.text(cx + 24, ry, label, { fontFamily: 'sans-serif', fontSize: '11px', color: '#886644' });
      this.add.text(cx + cw - 24, ry, value, { fontFamily: 'sans-serif', fontSize: '11px', color }).setOrigin(1, 0);
    });

    // Start button
    const btnY = cy + ch2 - 38;
    const startBg = this.add.graphics();
    startBg.fillStyle(0x8b0000, 1);
    startBg.fillRoundedRect(cx + 20, btnY, cw - 40, 28, 6);
    this.add.text(CANVAS_WIDTH / 2, btnY + 14, '⚔️  시작', {
      fontFamily: 'Georgia, serif', fontSize: '14px', fontStyle: 'bold', color: '#f0e6c8',
    }).setOrigin(0.5);

    const dismiss = () => this.scene.stop();

    const startZone = this.add.zone(CANVAS_WIDTH / 2, btnY + 14, cw - 40, 28).setInteractive({ useHandCursor: true });
    startZone.once('pointerdown', () => {
      this.scene.stop();
      const stageScene = this.scene.get('StageSelectScene') as Phaser.Scene & { launchStage?: (i: number) => void };
      stageScene?.launchStage?.(idx);
    });

    const dismissZone = this.add.zone(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, CANVAS_WIDTH, CANVAS_HEIGHT)
      .setOrigin(0.5).setInteractive();
    dismissZone.once('pointerdown', dismiss);

    // Fade-in via container alpha
    const all = this.children.list.slice();
    all.forEach((o: Phaser.GameObjects.GameObject) => { (o as Phaser.GameObjects.GameObject & { setAlpha?: (a: number) => void }).setAlpha?.(0); });
    this.tweens.add({ targets: all, alpha: 1, duration: 180 });
  }
}
