import Phaser from 'phaser';
import { COLORS, CSS } from '../constants/colors';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../constants/layout';
import { STAGE_CONFIGS } from '../data/stageProgress';
import { CHAPTER_1, CHAPTER_2, CHAPTER_3, CHAPTER_4, CHAPTER_5, CHAPTER_6, CHAPTER_7, CHAPTER_8 } from '../data/stages';

const ALL_STAGES = [...CHAPTER_1, ...CHAPTER_2, ...CHAPTER_3, ...CHAPTER_4, ...CHAPTER_5, ...CHAPTER_6, ...CHAPTER_7, ...CHAPTER_8];

const CHAPTER_NAMES: Record<number, string> = {
  1: '버려진 던전', 2: '독사의 늪', 3: '화염 산맥',
  4: '달빛 숲', 5: '심해 궁전', 6: '마왕의 탑', 7: '천계', 8: '원초의 심연',
};

const PROGRESS_KEY = 'dungeonStageProgress';

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
    const stageDef = ALL_STAGES.find(s => s.id === cfg.stageNumber);
    const waveCount = stageDef?.waves.length ?? 10;
    const estimatedGold = stageDef
      ? stageDef.waves.reduce((sum, w) => sum + (w.clearReward ?? 80), 0) + 200
      : (() => { let g = 0; for (let w = 1; w <= waveCount; w++) g += 50 + w * 10 + (ch - 1) * 40; return g; })();
    const estimatedGems = cfg.bossWave ? 5 : 2;
    const isBoss = cfg.bossWave ?? false;

    // Load stage progress
    const raw = localStorage.getItem(PROGRESS_KEY);
    const progress: Array<{ unlocked?: boolean; bestStars?: number; bestHpPercent?: number }> =
      raw ? JSON.parse(raw) : [];
    const prog = progress[idx] ?? {};
    const bestStars  = prog.bestStars    ?? 0;
    const bestHpPct  = prog.bestHpPercent ?? null;
    const isCleared  = bestStars > 0;

    const cw = 280;
    const baseCh2 = 220;
    const ch2 = isCleared ? baseCh2 + 44 : baseCh2;
    const cx = CANVAS_WIDTH / 2 - cw / 2;
    const cy = CANVAS_HEIGHT / 2 - ch2 / 2;

    // Difficulty badge
    const diffLabel = isBoss ? '🔴 보스전' : ch <= 2 ? '🟢 입문' : ch <= 4 ? '🟡 보통' : '🔴 어려움';
    const diffColor = isBoss ? '#ff4444' : ch <= 2 ? '#44cc66' : ch <= 4 ? '#ffcc44' : '#ff6644';

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

    // Difficulty badge (top-right)
    this.add.text(cx + cw - 14, cy + 12, diffLabel, {
      fontFamily: 'sans-serif', fontSize: '10px', color: diffColor,
    }).setOrigin(1, 0);

    // Title
    this.add.text(CANVAS_WIDTH / 2, cy + 20, `⚔️ 스테이지 ${cfg.stageNumber}`, {
      fontFamily: 'Georgia, serif', fontSize: '16px', fontStyle: 'bold', color: CSS.TORCH_AMBER,
    }).setOrigin(0.5);

    // Chapter subtitle
    this.add.text(CANVAS_WIDTH / 2, cy + 34, CHAPTER_NAMES[ch] ?? `챕터 ${ch}`, {
      fontFamily: 'sans-serif', fontSize: '10px', color: '#664422',
    }).setOrigin(0.5);

    // Divider
    const dg = this.add.graphics();
    dg.lineStyle(1, COLORS.TORCH_GOLD, 0.2);
    dg.lineBetween(cx + 16, cy + 54, cx + cw - 16, cy + 54);

    // Reward rows
    const rows = [
      { label: '예상 골드', value: `~${estimatedGold.toLocaleString('ko-KR')} 💰`, color: '#ffcc44' },
      { label: '보석',      value: `+${estimatedGems} 💎`,                          color: '#aa88ff' },
      { label: '웨이브',    value: `${waveCount}파`,                                 color: CSS.PARCHMENT_MUTED },
      { label: '보스',      value: isBoss ? '있음 👹' : '없음',                       color: isBoss ? '#ff6655' : '#666666' },
    ];
    rows.forEach(({ label, value, color }, i) => {
      const ry = cy + 70 + i * 24;
      this.add.text(cx + 24, ry, label, { fontFamily: 'sans-serif', fontSize: '11px', color: '#886644' });
      this.add.text(cx + cw - 24, ry, value, { fontFamily: 'sans-serif', fontSize: '11px', color }).setOrigin(1, 0);
    });

    // Previous clear record section
    if (isCleared) {
      const recY = cy + ch2 - 38 - 44 - 8;

      // Thin divider
      const rdiv = this.add.graphics();
      rdiv.lineStyle(1, COLORS.TORCH_GOLD, 0.15);
      rdiv.lineBetween(cx + 16, recY, cx + cw - 16, recY);

      // Record label
      this.add.text(cx + 16, recY + 6, '이전 기록', {
        fontFamily: 'sans-serif', fontSize: '10px', color: '#664422',
      });

      // Stars
      const starStr = '★'.repeat(bestStars) + '☆'.repeat(3 - bestStars);
      this.add.text(cx + cw - 16, recY + 6, starStr, {
        fontFamily: 'sans-serif', fontSize: '12px', color: '#ffcc44',
      }).setOrigin(1, 0);

      // HP bar if available
      if (bestHpPct !== null) {
        const hpColor = bestHpPct >= 80 ? '#44ff88' : bestHpPct >= 40 ? '#ffcc44' : '#ff6644';
        this.add.text(cx + cw / 2, recY + 22, `❤ ${bestHpPct}% HP 잔존`, {
          fontFamily: 'sans-serif', fontSize: '10px', color: hpColor,
        }).setOrigin(0.5);
      }
    }

    // Start button
    const btnY = cy + ch2 - 38;
    const btnLabel = isCleared ? '🔄  재도전' : '⚔️  시작';
    const startBg = this.add.graphics();
    startBg.fillStyle(0x8b0000, 1);
    startBg.fillRoundedRect(cx + 20, btnY, cw - 40, 28, 6);
    this.add.text(CANVAS_WIDTH / 2, btnY + 14, btnLabel, {
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
