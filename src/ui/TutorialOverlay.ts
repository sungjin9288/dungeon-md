import Phaser from 'phaser';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../constants/layout';
import { COLORS, CSS } from '../constants/colors';
import { TUTORIAL_DONE_STAGE } from '../data/tutorialTransactions';

// ─── Tutorial step definitions ────────────────────────────────────────────────

export interface TutorialStep {
  stage:     number;                               // tutorialStage value (1..4)
  title:     string;
  body:      string;
  highlight: { x: number; y: number; w: number; h: number } | null;  // region to cut out
  arrowFrom: { x: number; y: number };             // arrow tail
  arrowTo:   { x: number; y: number };             // arrow tip (near highlight)
  btnLabel:  string;
}

export const TUTORIAL_STEPS: TutorialStep[] = [
  {
    stage:     1,
    title:     '🏠 방을 건설하세요!',
    body:      '던전 그리드의 빈 슬롯을 눌러\n방을 지을 수 있습니다.\n방은 침략자를 막는 핵심 시설이에요.',
    highlight: { x: 10, y: 90, w: 370, h: 350 },   // dungeon grid (3×3)
    arrowFrom: { x: 195, y: 660 },
    arrowTo:   { x: 195, y: 580 },
    btnLabel:  '알겠어요!',
  },
  {
    stage:     2,
    title:     '👹 몬스터를 배치하세요!',
    body:      '방을 누르면 아래에 배치 트레이가 열려요.\n\'몬스터\' 탭에서 보유 몬스터를 탭해\n바로 배치할 수 있습니다.\n\'✨ 추천 배치\'로 한 번에 채우기도 가능!',
    highlight: { x: 8, y: 88, w: 122, h: 116 },      // first dungeon room (tap to open tray)
    arrowFrom: { x: 200, y: 320 },
    arrowTo:   { x: 72, y: 210 },
    btnLabel:  '확인!',
  },
  {
    stage:     3,
    title:     '⚔️ 침략을 방어하세요!',
    body:      '퀘스트 패널에서 침략대를\n확인하고 방어 버튼을 누르면\n전투가 시작됩니다.\n방과 몬스터가 자동으로 싸워요.',
    highlight: { x: 10, y: 560, w: 370, h: 120 },    // quest / battle area
    arrowFrom: { x: 195, y: 420 },
    arrowTo:   { x: 195, y: 565 },
    btnLabel:  '도전!',
  },
  {
    stage:     4,
    title:     '🌟 던전 마스터를 성장시키세요!',
    body:      '전투 후 획득한 영혼 수정으로\n지혜의 나무를 업그레이드하고\n소환 제단에서 새 몬스터를\n영입할 수 있어요!',
    highlight: { x: 312, y: 770, w: 78, h: 74 },     // 소환 bottom nav tab
    arrowFrom: { x: 195, y: 660 },
    arrowTo:   { x: 351, y: 773 },
    btnLabel:  '신난다!',
  },
];

export const TUTORIAL_DONE = TUTORIAL_DONE_STAGE;

// ─── TutorialOverlay class ────────────────────────────────────────────────────

export class TutorialOverlay {
  private scene:     Phaser.Scene;
  private container: Phaser.GameObjects.Container | null = null;
  private onDone:    (nextStage: number) => void;

  constructor(scene: Phaser.Scene, onDone: (nextStage: number) => void) {
    this.scene  = scene;
    this.onDone = onDone;
  }

  /** Show one tutorial step. Destroys any existing overlay first. */
  show(step: TutorialStep): void {
    this.destroy();

    const s = this.scene;
    const ctr = s.add.container(0, 0).setDepth(1000);
    this.container = ctr;

    // ── Dim mask with hole cutout ──────────────────────────────────────────
    const mask = s.add.graphics();
    mask.fillStyle(0x000000, 0.72);
    mask.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    if (step.highlight) {
      const { x, y, w, h } = step.highlight;
      // Erase hole by drawing matching rect with ERASE blend before adding to container
      // Phaser approach: use ERASE blendMode on a separate graphics object
      const hole = s.add.graphics();
      hole.fillStyle(0x000000, 1);
      hole.fillRoundedRect(x - 4, y - 4, w + 8, h + 8, 8);
      hole.setBlendMode(Phaser.BlendModes.ERASE);

      // Pulse border around highlight
      const border = s.add.graphics();
      border.lineStyle(2.5, COLORS.TORCH_GOLD, 0.9);
      border.strokeRoundedRect(x - 4, y - 4, w + 8, h + 8, 8);

      s.tweens.add({
        targets: border,
        alpha: { from: 0.4, to: 1 },
        yoyo: true,
        repeat: -1,
        duration: 700,
      });

      ctr.add([mask, hole, border]);
    } else {
      ctr.add(mask);
    }

    // ── Arrow ─────────────────────────────────────────────────────────────
    const arrow = s.add.graphics();
    this.drawArrow(arrow, step.arrowFrom, step.arrowTo);
    s.tweens.add({
      targets: arrow,
      alpha: { from: 0.5, to: 1 },
      yoyo: true,
      repeat: -1,
      duration: 600,
    });
    ctr.add(arrow);

    // ── Tooltip card ──────────────────────────────────────────────────────
    const cardW = 310;
    const cardH = 160;
    const cardX = (CANVAS_WIDTH - cardW) / 2;
    // Place card below center if highlight is in lower half, else in lower area
    const cardY = step.highlight && step.highlight.y < CANVAS_HEIGHT / 2 ? 590 : 220;

    const cardBg = s.add.graphics();
    cardBg.fillStyle(0x1a1208, 0.97);
    cardBg.fillRoundedRect(cardX, cardY, cardW, cardH, 12);
    cardBg.lineStyle(2, COLORS.TORCH_GOLD, 0.7);
    cardBg.strokeRoundedRect(cardX, cardY, cardW, cardH, 12);
    ctr.add(cardBg);

    // Title
    const titleTxt = s.add.text(cardX + cardW / 2, cardY + 22, step.title, {
      fontFamily: 'Georgia, serif',
      fontSize: '16px',
      fontStyle: 'bold',
      color: CSS.TORCH_AMBER,
    }).setOrigin(0.5, 0.5);
    ctr.add(titleTxt);

    // Divider
    const div = s.add.graphics();
    div.lineStyle(1, COLORS.TORCH_GOLD, 0.3);
    div.lineBetween(cardX + 16, cardY + 40, cardX + cardW - 16, cardY + 40);
    ctr.add(div);

    // Body text
    const bodyTxt = s.add.text(cardX + cardW / 2, cardY + 70, step.body, {
      fontFamily: 'sans-serif',
      fontSize: '12px',
      color: CSS.PARCHMENT,
      align: 'center',
      lineSpacing: 6,
      wordWrap: { width: cardW - 32 },
    }).setOrigin(0.5, 0.5);
    ctr.add(bodyTxt);

    // ── Confirm button ────────────────────────────────────────────────────
    const btnW = 120, btnH = 34;
    const btnX = cardX + (cardW - btnW) / 2;
    const btnY = cardY + cardH - btnH - 12;

    const btnBg = s.add.graphics();
    btnBg.fillStyle(COLORS.TORCH_GOLD, 0.9);
    btnBg.fillRoundedRect(btnX, btnY, btnW, btnH, 8);
    ctr.add(btnBg);

    const btnTxt = s.add.text(btnX + btnW / 2, btnY + btnH / 2, step.btnLabel, {
      fontFamily: 'sans-serif',
      fontSize: '13px',
      fontStyle: 'bold',
      color: '#1a0f00',
    }).setOrigin(0.5);
    ctr.add(btnTxt);

    const btnZone = s.add.zone(btnX + btnW / 2, btnY + btnH / 2, btnW, btnH)
      .setInteractive({ useHandCursor: true });
    btnZone.on('pointerover', () => {
      btnBg.clear();
      btnBg.fillStyle(0xffffff, 0.9);
      btnBg.fillRoundedRect(btnX, btnY, btnW, btnH, 8);
    });
    btnZone.on('pointerout', () => {
      btnBg.clear();
      btnBg.fillStyle(COLORS.TORCH_GOLD, 0.9);
      btnBg.fillRoundedRect(btnX, btnY, btnW, btnH, 8);
    });
    btnZone.on('pointerdown', () => {
      this.destroy();
      const nextStage = step.stage >= TUTORIAL_STEPS.length ? TUTORIAL_DONE : step.stage + 1;
      this.onDone(nextStage);
    });
    ctr.add(btnZone);

    // ── Slide-in animation ─────────────────────────────────────────────────
    ctr.setAlpha(0);
    s.tweens.add({ targets: ctr, alpha: 1, duration: 280, ease: 'Sine.easeOut' });
  }

  destroy(): void {
    if (this.container) {
      this.scene.tweens.killTweensOf(this.container);
      this.container.destroy(true);
      this.container = null;
    }
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  private drawArrow(g: Phaser.GameObjects.Graphics, from: { x: number; y: number }, to: { x: number; y: number }): void {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    const nx = dx / len;
    const ny = dy / len;

    // Shaft
    g.lineStyle(3, COLORS.TORCH_GOLD, 0.95);
    g.beginPath();
    g.moveTo(from.x, from.y);
    g.lineTo(to.x - nx * 14, to.y - ny * 14);
    g.strokePath();

    // Arrowhead triangle
    const headSize = 14;
    const perpX = -ny * headSize * 0.5;
    const perpY =  nx * headSize * 0.5;
    g.fillStyle(COLORS.TORCH_GOLD, 0.95);
    g.fillTriangle(
      to.x, to.y,
      to.x - nx * headSize + perpX, to.y - ny * headSize + perpY,
      to.x - nx * headSize - perpX, to.y - ny * headSize - perpY,
    );
  }
}
