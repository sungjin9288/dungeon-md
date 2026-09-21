import Phaser from 'phaser';
import { COLORS, CSS } from '../constants/colors';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../constants/layout';
import { STAGE_CONFIGS } from '../data/stageProgress';
import { ALL_STAGES } from '../data/allStages';
import { stageLootPotential } from '../data/campaignPacing';
import { addFramedPanel, addInfoRow, addPrimaryActionButton, type InfoRowOptions } from '../ui/GameUiPrimitives';

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
    // Loot = wave clear rewards PLUS every invader's bounty; KillHandler credits
    // `inv.def.reward` on each kill. Summing clearReward alone (and adding a
    // phantom +200) understated the payout by 4.9% at stage 1 and 74.0% at
    // stage 90 — and it mis-ranked stages against each other, which is what
    // this card is for. `stageLootPotential` is the repo's own formula for
    // exactly this and is what the pacing model budgets with.
    const estimatedGold = stageDef
      ? stageLootPotential(stageDef)
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

    const cw = 300;
    const baseCh2 = 254;
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

    const dismiss = () => this.scene.stop();
    const dismissZone = this.add.zone(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, CANVAS_WIDTH, CANVAS_HEIGHT)
      .setOrigin(0.5)
      .setInteractive();
    dismissZone.once('pointerdown', dismiss);

    // Card
    const { glow } = addFramedPanel(this, {
      x: cx,
      y: cy,
      w: cw,
      h: ch2,
      radius: 10,
      fillColor: 0x1a1208,
      borderColor: COLORS.TORCH_GOLD,
      borderAlpha: 0.85,
      glowColor: COLORS.TORCH_GOLD,
      glowOpacity: 0.14,
      shadowOpacity: 0.72,
      shadowOffsetY: 5,
    });

    // Difficulty badge (top-right)
    const badgeBg = this.add.graphics();
    badgeBg.fillStyle(isBoss ? 0x341010 : 0x102010, 0.95);
    badgeBg.fillRoundedRect(cx + cw - 78, cy + 11, 62, 18, 9);
    badgeBg.lineStyle(1, isBoss ? 0xff4444 : 0x44cc66, 0.6);
    badgeBg.strokeRoundedRect(cx + cw - 78, cy + 11, 62, 18, 9);
    this.add.text(cx + cw - 47, cy + 20, diffLabel, {
      fontFamily: 'sans-serif', fontSize: '10px', color: diffColor,
    }).setOrigin(0.5);

    // Title
    this.add.text(cx + 18, cy + 20, `스테이지 ${cfg.stageNumber}`, {
      fontFamily: 'Georgia, serif',
      fontSize: '18px',
      fontStyle: 'bold',
      color: CSS.TORCH_AMBER,
    }).setOrigin(0, 0.5);

    // Chapter subtitle
    this.add.text(cx + 19, cy + 38, CHAPTER_NAMES[ch] ?? `챕터 ${ch}`, {
      fontFamily: 'sans-serif', fontSize: '10px', color: '#9a7650',
    }).setOrigin(0, 0.5);

    // Divider
    const dg = this.add.graphics();
    dg.lineStyle(1, COLORS.TORCH_GOLD, 0.2);
    dg.lineBetween(cx + 16, cy + 58, cx + cw - 16, cy + 58);

    // Reward rows
    const rows = [
      { icon: '💰', label: '예상 골드', value: `~${estimatedGold.toLocaleString('ko-KR')}`, valueColor: '#ffcc44' },
      { icon: '💎', label: '보석', value: `+${estimatedGems}`, valueColor: '#aa88ff' },
      { icon: '〰', label: '웨이브', value: `${waveCount}파`, valueColor: CSS.PARCHMENT_DIM },
      { icon: '👹', label: '보스', value: isBoss ? '있음' : '없음', valueColor: isBoss ? '#ff6655' : '#6f5a45' },
    ] satisfies Array<Omit<InfoRowOptions, 'x' | 'y' | 'w'>>;
    rows.forEach((row, i) => addInfoRow(this, { ...row, x: cx + 18, y: cy + 72 + i * 25, w: cw - 36 }));

    // Previous clear record section
    if (isCleared) {
      const recY = cy + ch2 - 48 - 44 - 8;

      // Thin divider
      const rdiv = this.add.graphics();
      rdiv.lineStyle(1, COLORS.TORCH_GOLD, 0.15);
      rdiv.lineBetween(cx + 16, recY, cx + cw - 16, recY);

      // Record label
      this.add.text(cx + 16, recY + 6, '이전 기록', {
        fontFamily: 'sans-serif', fontSize: '10px', color: '#9a7650',
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
    const btnY = cy + ch2 - 54;
    const btnLabel = isCleared ? '🔄  재도전' : '⚔️  시작';
    addPrimaryActionButton(this, {
      x: cx + 18,
      y: btnY,
      w: cw - 36,
      h: 44,
      label: btnLabel,
      fontSize: '14px',
      once: true,
      onPress: () => {
        this.scene.stop();
        const stageScene = this.scene.get('StageSelectScene') as Phaser.Scene & { launchStage?: (i: number) => void };
        stageScene?.launchStage?.(idx);
      },
    });

    // Fade-in via container alpha
    const all = this.children.list.slice();
    all.forEach((o: Phaser.GameObjects.GameObject) => { (o as Phaser.GameObjects.GameObject & { setAlpha?: (a: number) => void }).setAlpha?.(0); });
    glow.setAlpha(0);
    this.tweens.add({ targets: all, alpha: 1, duration: 180 });
  }
}
