import Phaser from 'phaser';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../constants/layout';
import { COLORS } from '../constants/colors';
import { TUTORIAL_DONE_STAGE } from '../data/tutorialTransactions';
import { getReducedMotion } from '../utils/reducedMotion';

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
    title:     '첫 수호실을 건설하세요',
    body:      '빛나는 빈 터를 눌러 방을 건설하세요.\n방은 침입 경로를 끊는 핵심 시설입니다.',
    highlight: { x: 10, y: 90, w: 370, h: 350 },   // upper dungeon cutaway
    arrowFrom: { x: 195, y: 660 },
    arrowTo:   { x: 195, y: 580 },
    btnLabel:  '알겠어요!',
  },
  {
    stage:     2,
    title:     '수호자를 배치하세요',
    body:      '방을 누르면 배치 트레이가 열립니다.\n보유 몬스터를 직접 고르거나\n추천 배치로 수비선을 빠르게 완성하세요.',
    highlight: { x: 8, y: 88, w: 122, h: 116 },      // first dungeon room (tap to open tray)
    arrowFrom: { x: 200, y: 320 },
    arrowTo:   { x: 72, y: 210 },
    btnLabel:  '확인!',
  },
  {
    stage:     3,
    title:     '침입을 방어하세요',
    body:      '퀘스트 패널에서 침략대를\n확인하고 방어 버튼을 누르면\n전투가 시작됩니다.\n방과 몬스터가 자동으로 싸워요.',
    highlight: { x: 10, y: 560, w: 370, h: 120 },    // quest / battle area
    arrowFrom: { x: 195, y: 420 },
    arrowTo:   { x: 195, y: 565 },
    btnLabel:  '도전!',
  },
  {
    stage:     4,
    title:     '다음 침공을 준비하세요',
    body:      '군단을 성장시키고 공방 장비를 갖춘 뒤\n침공 탭에서 다음 전투를 선택하세요.\n강한 수비선이 더 깊은 던전을 엽니다.',
    highlight: { x: 292, y: 770, w: 98, h: 74 },     // invasion bottom nav tab
    arrowFrom: { x: 195, y: 660 },
    arrowTo:   { x: 351, y: 773 },
    btnLabel:  '준비 완료',
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

    if (step.highlight) {
      const { x, y, w, h } = step.highlight;
      const left = Math.max(0, x - 4);
      const top = Math.max(0, y - 4);
      const right = Math.min(CANVAS_WIDTH, x + w + 4);
      const bottom = Math.min(CANVAS_HEIGHT, y + h + 4);
      mask.fillRect(0, 0, CANVAS_WIDTH, top);
      mask.fillRect(0, top, left, bottom - top);
      mask.fillRect(right, top, CANVAS_WIDTH - right, bottom - top);
      mask.fillRect(0, bottom, CANVAS_WIDTH, CANVAS_HEIGHT - bottom);

      // Pulse border around highlight
      const border = s.add.graphics();
      border.lineStyle(2.5, 0x4f9b78, 0.94);
      border.strokeRoundedRect(x - 4, y - 4, w + 8, h + 8, 6);

      // Decorative highlight pulse — the static border still marks the target.
      if (!getReducedMotion()) {
        s.tweens.add({
          targets: border,
          alpha: { from: 0.4, to: 1 },
          yoyo: true,
          repeat: -1,
          duration: 700,
        });
      }

      ctr.add([mask, border]);
    } else {
      mask.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      ctr.add(mask);
    }

    // ── Arrow ─────────────────────────────────────────────────────────────
    const arrow = s.add.graphics();
    this.drawArrow(arrow, step.arrowFrom, step.arrowTo);
    // Decorative arrow pulse — the static arrow still points at the target.
    if (!getReducedMotion()) {
      s.tweens.add({
        targets: arrow,
        alpha: { from: 0.5, to: 1 },
        yoyo: true,
        repeat: -1,
        duration: 600,
      });
    }
    ctr.add(arrow);

    // ── Tooltip card ──────────────────────────────────────────────────────
    const cardW = 320;
    const cardH = 190;
    const cardX = (CANVAS_WIDTH - cardW) / 2;
    // Keep the plaque clear of the highlighted architecture and global navigation.
    const cardY = step.highlight && step.highlight.y < CANVAS_HEIGHT / 2 ? 550 : 210;

    const cardBg = s.add.graphics();
    cardBg.fillStyle(0x070908, 0.98);
    cardBg.fillRoundedRect(cardX, cardY, cardW, cardH, 6);
    cardBg.lineStyle(2, 0xa98245, 0.82);
    cardBg.strokeRoundedRect(cardX, cardY, cardW, cardH, 6);
    cardBg.lineStyle(1, 0x4f9b78, 0.54);
    cardBg.strokeRoundedRect(cardX + 5, cardY + 5, cardW - 10, cardH - 10, 3);
    cardBg.fillStyle(0xa98245, 0.72);
    cardBg.fillCircle(cardX + 11, cardY + 11, 2);
    cardBg.fillCircle(cardX + cardW - 11, cardY + 11, 2);
    cardBg.fillCircle(cardX + 11, cardY + cardH - 11, 2);
    cardBg.fillCircle(cardX + cardW - 11, cardY + cardH - 11, 2);
    ctr.add(cardBg);

    const stageTxt = s.add.text(cardX + 18, cardY + 16, `각인 ${step.stage}/${TUTORIAL_STEPS.length}`, {
      fontFamily: 'sans-serif', fontSize: '10px', fontStyle: 'bold', color: '#6eaa8c',
    }).setOrigin(0, 0.5);
    ctr.add(stageTxt);

    // Title
    const titleTxt = s.add.text(cardX + cardW / 2, cardY + 31, step.title, {
      fontFamily: 'sans-serif',
      fontSize: '15px',
      fontStyle: 'bold',
      color: '#e7d6b5',
    }).setOrigin(0.5, 0.5);
    ctr.add(titleTxt);

    // Divider
    const div = s.add.graphics();
    div.lineStyle(1, 0xa98245, 0.42);
    div.lineBetween(cardX + 16, cardY + 50, cardX + cardW - 16, cardY + 50);
    ctr.add(div);

    // Body text
    const bodyTxt = s.add.text(cardX + cardW / 2, cardY + 91, step.body, {
      fontFamily: 'sans-serif',
      fontSize: '12px',
      color: '#c7baa2',
      align: 'center',
      lineSpacing: 5,
      wordWrap: { width: cardW - 32 },
    }).setOrigin(0.5, 0.5);
    ctr.add(bodyTxt);

    // ── Confirm button ────────────────────────────────────────────────────
    const btnW = 144, btnH = 44;
    const btnX = cardX + (cardW - btnW) / 2;
    const btnY = cardY + cardH - btnH - 12;

    const btnBg = s.add.graphics();
    btnBg.fillStyle(0x16231d, 1);
    btnBg.fillRoundedRect(btnX, btnY, btnW, btnH, 5);
    btnBg.lineStyle(1.5, 0x66b58c, 0.92);
    btnBg.strokeRoundedRect(btnX, btnY, btnW, btnH, 5);
    ctr.add(btnBg);

    const btnTxt = s.add.text(btnX + btnW / 2, btnY + btnH / 2, step.btnLabel, {
      fontFamily: 'sans-serif',
      fontSize: '13px',
      fontStyle: 'bold',
      color: '#e7d6b5',
    }).setOrigin(0.5);
    ctr.add(btnTxt);

    const btnZone = s.add.zone(btnX + btnW / 2, btnY + btnH / 2, btnW, btnH)
      .setInteractive({ useHandCursor: true });
    btnZone.on('pointerover', () => {
      btnBg.clear();
      btnBg.fillStyle(0x234133, 1);
      btnBg.fillRoundedRect(btnX, btnY, btnW, btnH, 5);
      btnBg.lineStyle(2, 0x8bd2aa, 1);
      btnBg.strokeRoundedRect(btnX, btnY, btnW, btnH, 5);
    });
    btnZone.on('pointerout', () => {
      btnBg.clear();
      btnBg.fillStyle(0x16231d, 1);
      btnBg.fillRoundedRect(btnX, btnY, btnW, btnH, 5);
      btnBg.lineStyle(1.5, 0x66b58c, 0.92);
      btnBg.strokeRoundedRect(btnX, btnY, btnW, btnH, 5);
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
