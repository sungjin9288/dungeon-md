import Phaser from 'phaser';
import { COLORS, CASUAL, CASUAL_CSS } from '../constants/colors';
import { applyCasualBackground } from '../ui/AmbientBackground';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../constants/layout';
import {
  BRANCH_DEFS, MAX_WISDOM_TIER,
  loadGameState, saveGameState, upgradeWisdomBranch,
  type BranchDef, type GameState,
} from '../data/wisdom';
import { addSceneHeader } from '../ui/GameUiPrimitives';

const ALTAR_X  = 195;
const ALTAR_Y  = 422;
const NODE_R   = 28;

export class AncestralWisdomScene extends Phaser.Scene {
  private state!: GameState;
  private crystalText!:  Phaser.GameObjects.Text;
  private nodeContainers: Map<string, Phaser.GameObjects.Container> = new Map();
  private linePulses:     Map<string, Phaser.Tweens.Tween>         = new Map();

  // detail panel
  private panel?:        Phaser.GameObjects.Container;
  private panelBg?:      Phaser.GameObjects.Graphics;
  private panelClose?:   Phaser.GameObjects.Text;
  private panelContent:  Phaser.GameObjects.GameObject[] = [];
  private panelOpen    = false;
  private activeBranch?: BranchDef;

  constructor() { super({ key: 'AncestralWisdomScene' }); }

  create(): void {
    this.state = loadGameState();
    this.nodeContainers.clear();
    this.linePulses.clear();

    this.drawBackground();
    this.spawnMist();
    this.drawConnectingLines();
    this.drawAltar();
    this.drawBranches();
    this.drawHeader();

    this.buildDetailPanel();
  }

  // ─── Background ─────────────────────────────────────────────────────────────

  private drawBackground(): void {
    // Bright casual storybook backdrop (gradient + sun glow + polka dots).
    applyCasualBackground(this);
  }

  // ─── Mist ────────────────────────────────────────────────────────────────────

  private spawnMist(): void {
    for (let i = 0; i < 18; i++) {
      const x = Phaser.Math.Between(20, CANVAS_WIDTH - 20);
      const y = Phaser.Math.Between(CANVAS_HEIGHT / 2, CANVAS_HEIGHT + 60);
      const r = Phaser.Math.Between(30, 80);
      const a = Phaser.Math.FloatBetween(0.04, 0.15);

      const g = this.add.graphics();
      g.fillStyle(CASUAL.PURPLE, a);
      g.fillCircle(0, 0, r);
      g.x = x;
      g.y = y;

      const dur   = Phaser.Math.Between(6000, 12000);
      const moveY = Phaser.Math.Between(80, 160);

      this.tweens.add({
        targets: g,
        y: y - moveY,
        alpha: 0,
        duration: dur,
        repeat: -1,
        repeatDelay: Phaser.Math.Between(0, 4000),
        onRepeat: () => {
          g.y     = Phaser.Math.Between(CANVAS_HEIGHT / 2, CANVAS_HEIGHT + 60);
          g.alpha = Phaser.Math.FloatBetween(0.04, 0.15);
        },
      });
    }
  }

  // ─── Header ──────────────────────────────────────────────────────────────────

  private drawHeader(): void {
    const { title: headerTitle } = addSceneHeader(this, {
      title:  '🌳 선조의 지혜',
      y:      28,
      depth:  11,
      onBack: () => this.scene.start(
        (this.registry.get('previousScene') as string) ?? 'StageSelectScene',
      ),
    });

    // Crystal counter pill — sits right of header title, acts as live subtitle.
    const crystalBg = this.add.graphics().setDepth(11);
    crystalBg.fillStyle(CASUAL.SHADOW, 0.18);
    crystalBg.fillRoundedRect(CANVAS_WIDTH / 2 - 58, 44 + 2, 116, 22, 8);
    crystalBg.fillStyle(CASUAL.PANEL_SOFT, 1);
    crystalBg.fillRoundedRect(CANVAS_WIDTH / 2 - 58, 44, 116, 22, 8);
    crystalBg.lineStyle(2.5, CASUAL.PURPLE, 1);
    crystalBg.strokeRoundedRect(CANVAS_WIDTH / 2 - 58, 44, 116, 22, 8);
    crystalBg.fillStyle(0xffffff, 0.10);
    crystalBg.fillRoundedRect(CANVAS_WIDTH / 2 - 53, 47, 106, 4, 2);

    this.crystalText = this.add.text(CANVAS_WIDTH / 2, 55, `💠 ${this.state.soulCrystals} 영혼 수정`, {
      fontFamily: 'sans-serif', fontSize: '11px', fontStyle: 'bold', color: CASUAL_CSS.PURPLE,
    }).setOrigin(0.5).setDepth(12);

    // Suppress TS "unused" warning — headerTitle is used by addSceneHeader internally.
    void headerTitle;
  }

  // ─── Altar ───────────────────────────────────────────────────────────────────

  private drawAltar(): void {
    // Outer glow ring — soft golden halo readable on cream.
    const glow = this.add.graphics();
    glow.fillStyle(CASUAL.GOLD, 0.12);
    glow.fillCircle(ALTAR_X, ALTAR_Y, 56);
    glow.fillStyle(CASUAL.GOLD, 0.2);
    glow.fillCircle(ALTAR_X, ALTAR_Y, 40);

    // Stone circle — keep dark interior, saturated gold rim + soft shadow.
    const stone = this.add.graphics();
    stone.fillStyle(CASUAL.SHADOW, 0.28);
    stone.fillCircle(ALTAR_X + 2, ALTAR_Y + 3, 30);
    stone.fillStyle(COLORS.STONE_MID, 1);
    stone.fillCircle(ALTAR_X, ALTAR_Y, 30);
    stone.lineStyle(3, CASUAL.GOLD, 1);
    stone.strokeCircle(ALTAR_X, ALTAR_Y, 30);

    // Altar icon
    this.add.text(ALTAR_X, ALTAR_Y, '⛩', { fontSize: '24px' }).setOrigin(0.5);

    // Rotating outer ring tween
    this.tweens.add({
      targets: glow,
      alpha: { from: 0.5, to: 1 },
      duration: 2200,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  // ─── Connecting lines ────────────────────────────────────────────────────────

  private drawConnectingLines(): void {
    BRANCH_DEFS.forEach(branch => {
      const { x, y } = branch.position;

      // Static connector line — readable brown on cream.
      const staticLine = this.add.graphics();
      staticLine.lineStyle(2.5, CASUAL.EDGE_SOFT, 0.85);
      staticLine.lineBetween(ALTAR_X, ALTAR_Y, x, y);

      // Animated gold pulse line (travels from altar to node)
      const pulseGfx = this.add.graphics();
      let progress = Math.random(); // stagger starts

      const tween = this.tweens.add({
        targets: { t: progress },
        t: progress + 1,
        duration: 1800,
        repeat: -1,
        ease: 'Linear',
        onUpdate: (_tw, target) => {
          const t = (target.t as number) % 1;
          pulseGfx.clear();
          // Draw a short glowing segment at position t along the line
          const segLen = 0.22;
          const t0 = t;
          const t1 = Math.min(t + segLen, 1);
          const px0 = ALTAR_X + (x - ALTAR_X) * t0;
          const py0 = ALTAR_Y + (y - ALTAR_Y) * t0;
          const px1 = ALTAR_X + (x - ALTAR_X) * t1;
          const py1 = ALTAR_Y + (y - ALTAR_Y) * t1;
          pulseGfx.lineStyle(3, CASUAL.GOLD, 0.95);
          pulseGfx.lineBetween(px0, py0, px1, py1);
        },
      });

      this.linePulses.set(branch.id, tween);
    });
  }

  // ─── Branch nodes ────────────────────────────────────────────────────────────

  private drawBranches(): void {
    BRANCH_DEFS.forEach(branch => {
      const { x, y } = branch.position;
      const tier = this.state.wisdomTree[branch.id] ?? 0;

      const container = this.add.container(x, y);
      this.nodeContainers.set(branch.id, container);
      this.renderNode(branch, tier, container);

      // Interactive hit area
      const zone = this.add.zone(0, 0, NODE_R * 2 + 10, NODE_R * 2 + 10).setInteractive({ useHandCursor: true });
      container.add(zone);

      zone.on('pointerdown', () => this.openDetailPanel(branch));
      zone.on('pointerover',  () => this.setNodeHighlight(container, true));
      zone.on('pointerout',   () => this.setNodeHighlight(container, false));
    });
  }

  private renderNode(branch: BranchDef, tier: number, container: Phaser.GameObjects.Container): void {
    container.removeAll(true);

    const isMaxed = tier >= MAX_WISDOM_TIER;
    const hasAny  = tier > 0;
    // Keep dark node interiors; differentiate state via the saturated rim.
    const fillCol = isMaxed ? 0x3a2a08
                  : hasAny  ? 0x231038
                  :           COLORS.STONE_DARK;
    // Unlocked nodes glow with a saturated CASUAL accent; locked nodes muted brown.
    const borderCol = isMaxed ? CASUAL.GOLD
                    : hasAny  ? CASUAL.PURPLE
                    :           CASUAL.EDGE_SOFT;

    // Soft drop shadow on cream.
    const shadow = this.add.graphics();
    shadow.fillStyle(CASUAL.SHADOW, 0.35);
    shadow.fillCircle(2, 4, NODE_R);
    container.add(shadow);

    // Glow halo behind unlocked nodes so they pop on cream.
    if (hasAny) {
      const glowRing = this.add.graphics();
      glowRing.fillStyle(isMaxed ? CASUAL.GOLD : CASUAL.PURPLE, 0.22);
      glowRing.fillCircle(0, 0, NODE_R + 8);
      container.add(glowRing);
    }

    // Node circle — dark interior, chunky saturated rim.
    const circle = this.add.graphics();
    circle.fillStyle(fillCol, 1);
    circle.fillCircle(0, 0, NODE_R);
    circle.lineStyle(isMaxed ? 3.5 : 3, borderCol, hasAny ? 1 : 0.85);
    circle.strokeCircle(0, 0, NODE_R);
    // Top highlight sliver.
    circle.fillStyle(0xffffff, 0.1);
    circle.fillEllipse(0, -NODE_R * 0.5, NODE_R * 1.1, NODE_R * 0.4);
    container.add(circle);

    // Icon
    const icon = this.add.text(0, -6, branch.icon, { fontSize: '18px' }).setOrigin(0.5);
    container.add(icon);

    // Tier dots
    const dotY = NODE_R - 7;
    const dotSpacing = 8;
    const totalWidth = (MAX_WISDOM_TIER - 1) * dotSpacing;
    for (let i = 0; i < MAX_WISDOM_TIER; i++) {
      const dotX = -totalWidth / 2 + i * dotSpacing;
      const dotG = this.add.graphics();
      if (i < tier) {
        dotG.fillStyle(isMaxed ? CASUAL.GOLD : CASUAL.PURPLE, 1);
      } else {
        dotG.fillStyle(0x000000, 0.45);
        dotG.lineStyle(1, 0xffffff, 0.4);
      }
      dotG.fillCircle(dotX, dotY, 3);
      if (i >= tier) dotG.strokeCircle(dotX, dotY, 3);
      container.add(dotG);
    }

    // Cost badge — shown below the node for non-maxed branches.
    // Sits on cream, so wrap in a small cream chip with ink text.
    if (!isMaxed) {
      const nextCost = branch.costPerTier[tier];
      if (nextCost > 0) {
        const badgeText = `💠${nextCost}`;
        const badgeW = badgeText.length * 7 + 12;
        const badgeY = NODE_R + 6;
        const badgeBg = this.add.graphics();
        badgeBg.fillStyle(CASUAL.PANEL, 1);
        badgeBg.fillRoundedRect(-badgeW / 2, badgeY, badgeW, 16, 6);
        badgeBg.lineStyle(2, CASUAL.EDGE, 1);
        badgeBg.strokeRoundedRect(-badgeW / 2, badgeY, badgeW, 16, 6);
        container.add(badgeBg);
        const costBadge = this.add.text(0, badgeY + 8, badgeText, {
          fontFamily: 'sans-serif',
          fontSize: '10px',
          fontStyle: 'bold',
          color: CASUAL_CSS.PURPLE,
        }).setOrigin(0.5);
        container.add(costBadge);
      }
    }

    // Re-add zone on top
    const zone = this.add.zone(0, 0, NODE_R * 2 + 10, NODE_R * 2 + 10).setInteractive({ useHandCursor: true });
    container.add(zone);
    zone.on('pointerdown', () => this.openDetailPanel(branch));
    zone.on('pointerover',  () => this.setNodeHighlight(container, true));
    zone.on('pointerout',   () => this.setNodeHighlight(container, false));
  }

  private setNodeHighlight(container: Phaser.GameObjects.Container, on: boolean): void {
    this.tweens.add({
      targets: container,
      scaleX: on ? 1.08 : 1,
      scaleY: on ? 1.08 : 1,
      duration: 100,
      ease: 'Linear',
    });
  }

  // ─── Detail panel ────────────────────────────────────────────────────────────

  private buildDetailPanel(): void {
    const PANEL_H = 280;
    this.panel = this.add.container(0, CANVAS_HEIGHT);
    this.panel.setDepth(300);

    this.panelBg = this.add.graphics();
    this.panelBg.fillStyle(CASUAL.SHADOW, 0.3);
    this.panelBg.fillRoundedRect(0, -4, CANVAS_WIDTH, PANEL_H + 4, { tl: 16, tr: 16, bl: 0, br: 0 });
    this.panelBg.fillStyle(CASUAL.PANEL, 1);
    this.panelBg.fillRoundedRect(0, 0, CANVAS_WIDTH, PANEL_H, { tl: 16, tr: 16, bl: 0, br: 0 });
    this.panelBg.lineStyle(3, CASUAL.EDGE, 1);
    this.panelBg.strokeRoundedRect(0, 0, CANVAS_WIDTH, PANEL_H, { tl: 16, tr: 16, bl: 0, br: 0 });
    this.panelBg.fillStyle(0xffffff, 0.12);
    this.panelBg.fillRoundedRect(8, 5, CANVAS_WIDTH - 16, 6, 3);
    this.panel.add(this.panelBg);

    // Close button (always visible after open)
    this.panelClose = this.add.text(CANVAS_WIDTH - 18, 18, '✕', {
      fontFamily: 'sans-serif', fontSize: '16px', fontStyle: 'bold', color: CASUAL_CSS.INK_SOFT,
    }).setOrigin(1, 0).setInteractive({ useHandCursor: true });
    this.panelClose.on('pointerdown', () => this.closeDetailPanel());
    this.panel.add(this.panelClose);

    this.add.existing(this.panel);
  }

  private openDetailPanel(branch: BranchDef): void {
    if (!this.panel) return;
    this.activeBranch = branch;

    // Destroy only previously added content items (not bg/closeBtn)
    this.panelContent.forEach(go => {
      (go as Phaser.GameObjects.GameObject & { destroy(): void }).destroy();
    });
    this.panelContent = [];

    this.rebuildPanelContent(branch);

    if (!this.panelOpen) {
      this.panelOpen = true;
      this.tweens.add({
        targets: this.panel,
        y: CANVAS_HEIGHT - 280,
        duration: 250,
        ease: 'Power2.easeOut',
      });
    }
  }

  /** Add a game object to the panel AND track it for cleanup */
  private addToPanel(go: Phaser.GameObjects.GameObject): void {
    this.panel!.add(go);
    this.panelContent.push(go);
  }

  private rebuildPanelContent(branch: BranchDef): void {
    if (!this.panel) return;
    const tier    = this.state.wisdomTree[branch.id] ?? 0;
    const isMaxed = tier >= MAX_WISDOM_TIER;
    const cx      = CANVAS_WIDTH / 2;

    // Icon + Name
    const iconT = this.add.text(cx, 22, `${branch.icon} ${branch.name}`, {
      fontFamily: 'sans-serif', fontSize: '16px', fontStyle: 'bold',
      color: CASUAL_CSS.INK,
    }).setOrigin(0.5, 0);
    this.addToPanel(iconT);

    // Tier indicator (Roman)
    const roman = ['0', 'Ⅰ', 'Ⅱ', 'Ⅲ', 'Ⅳ', 'Ⅴ'];
    const tierT = this.add.text(cx, 50, isMaxed ? '✨ 최고 등급' : `등급 ${roman[tier]}`, {
      fontFamily: 'sans-serif', fontSize: '12px', fontStyle: 'bold',
      color: isMaxed ? CASUAL_CSS.GOLD : CASUAL_CSS.INK_SOFT,
    }).setOrigin(0.5, 0);
    this.addToPanel(tierT);

    // Tier dots (large)
    for (let i = 0; i < MAX_WISDOM_TIER; i++) {
      const dx = cx - (MAX_WISDOM_TIER - 1) * 10 + i * 20;
      const dy = 76;
      const dg = this.add.graphics();
      if (i < tier) {
        dg.fillStyle(isMaxed ? CASUAL.GOLD : CASUAL.PURPLE, 1);
        dg.fillCircle(dx, dy, 5);
        dg.lineStyle(1.5, CASUAL.EDGE, 0.6);
        dg.strokeCircle(dx, dy, 5);
      } else {
        dg.fillStyle(CASUAL.PANEL_SOFT, 1);
        dg.lineStyle(2, CASUAL.EDGE_SOFT, 0.9);
        dg.fillCircle(dx, dy, 5);
        dg.strokeCircle(dx, dy, 5);
      }
      this.addToPanel(dg);
    }

    // Effect line
    const curVal  = branch.getValue(tier);
    const nextVal = branch.getValue(Math.min(tier + 1, MAX_WISDOM_TIER));
    const effectStr = branch.effect.replace('{value}', String(curVal));
    const effectT = this.add.text(cx, 100, effectStr, {
      fontFamily: 'sans-serif', fontSize: '13px', fontStyle: 'bold', color: CASUAL_CSS.INK,
    }).setOrigin(0.5, 0);
    this.addToPanel(effectT);

    if (!isMaxed) {
      const nextStr = `→ 다음: ${branch.effect.replace('{value}', String(nextVal))}`;
      const nextT = this.add.text(cx, 122, nextStr, {
        fontFamily: 'sans-serif', fontSize: '11px', fontStyle: 'bold', color: CASUAL_CSS.GREEN,
      }).setOrigin(0.5, 0);
      this.addToPanel(nextT);

      // Cost line
      const cost      = branch.costPerTier[tier];
      const canAfford = this.state.soulCrystals >= cost;
      const costT = this.add.text(cx, 154, `업그레이드 비용: 💠 ${cost}`, {
        fontFamily: 'sans-serif', fontSize: '13px', fontStyle: 'bold',
        color: canAfford ? CASUAL_CSS.PURPLE : CASUAL_CSS.RED,
      }).setOrigin(0.5, 0);
      this.addToPanel(costT);

      // Upgrade button — casual chunky pill.
      const btnW = 210, btnH = 40, btnX = cx - btnW / 2, btnY = 188;
      const btnBg = this.add.graphics();
      btnBg.fillStyle(canAfford ? CASUAL.PURPLE_DK : CASUAL.EDGE, 0.45);
      btnBg.fillRoundedRect(btnX, btnY + 3, btnW, btnH, 12);
      btnBg.fillStyle(canAfford ? CASUAL.PURPLE : CASUAL.PANEL_SOFT, 1);
      btnBg.fillRoundedRect(btnX, btnY, btnW, btnH, 12);
      btnBg.fillStyle(0xffffff, canAfford ? 0.3 : 0.4);
      btnBg.fillRoundedRect(btnX + 8, btnY + 5, btnW - 16, 6, 3);
      btnBg.lineStyle(3, canAfford ? CASUAL.PURPLE_DK : CASUAL.EDGE, 1);
      btnBg.strokeRoundedRect(btnX, btnY, btnW, btnH, 12);
      this.addToPanel(btnBg);

      const btnT = this.add.text(cx, btnY + btnH / 2, canAfford ? '업그레이드' : '수정 부족', {
        fontFamily: 'sans-serif', fontSize: '14px', fontStyle: 'bold',
        color: canAfford ? CASUAL_CSS.WHITE : CASUAL_CSS.INK_SOFT,
        stroke: canAfford ? '#00000033' : undefined,
        strokeThickness: canAfford ? 3 : 0,
      }).setOrigin(0.5);
      this.addToPanel(btnT);

      if (canAfford) {
        const zone = this.add.zone(cx, btnY + btnH / 2, btnW, btnH)
          .setInteractive({ useHandCursor: true });
        zone.on('pointerdown', () => this.showUpgradeConfirm(branch, cost));
        this.addToPanel(zone);
      }
    } else {
      // Max level celebration text
      const maxT = this.add.text(cx, 160, '모든 잠재력이 해방되었습니다!', {
        fontFamily: 'sans-serif', fontSize: '13px', fontStyle: 'bold',
        color: CASUAL_CSS.GOLD,
      }).setOrigin(0.5, 0);
      this.addToPanel(maxT);
    }
  }

  private closeDetailPanel(): void {
    if (!this.panelOpen || !this.panel) return;
    this.panelOpen = false;
    this.tweens.add({
      targets: this.panel,
      y: CANVAS_HEIGHT,
      duration: 220,
      ease: 'Power2.easeIn',
    });
  }

  // ─── Upgrade confirm dialog ───────────────────────────────────────────────────

  private showUpgradeConfirm(branch: BranchDef, cost: number): void {
    const OW = 290, OH = 170;
    const OX = (CANVAS_WIDTH  - OW) / 2;
    const OY = (CANVAS_HEIGHT - OH) / 2;

    const ov = this.add.container(0, 0).setDepth(120).setAlpha(0);

    const dim = this.add.graphics();
    dim.fillStyle(0x000000, 0.5);
    dim.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    ov.add(dim);

    const bg = this.add.graphics();
    bg.fillStyle(CASUAL.SHADOW, 0.35);
    bg.fillRoundedRect(OX, OY + 4, OW, OH, 16);
    bg.fillStyle(CASUAL.PANEL, 1);
    bg.fillRoundedRect(OX, OY, OW, OH, 16);
    bg.lineStyle(3, CASUAL.EDGE, 1);
    bg.strokeRoundedRect(OX, OY, OW, OH, 16);
    bg.fillStyle(0xffffff, 0.12);
    bg.fillRoundedRect(OX + 10, OY + 6, OW - 20, 6, 3);
    ov.add(bg);

    ov.add(this.add.text(CANVAS_WIDTH / 2, OY + 28, `${branch.icon} ${branch.name} 업그레이드`, {
      fontFamily: 'sans-serif', fontSize: '14px', fontStyle: 'bold', color: CASUAL_CSS.INK,
    }).setOrigin(0.5));
    ov.add(this.add.text(CANVAS_WIDTH / 2, OY + 56, `💠 ${cost} 영혼 수정이 소모됩니다.`, {
      fontFamily: 'sans-serif', fontSize: '12px', fontStyle: 'bold', color: CASUAL_CSS.INK_SOFT,
    }).setOrigin(0.5));
    ov.add(this.add.text(CANVAS_WIDTH / 2, OY + 76, `보유: 💠 ${this.state.soulCrystals}`, {
      fontFamily: 'sans-serif', fontSize: '11px', color: CASUAL_CSS.INK_SOFT,
    }).setOrigin(0.5));

    this.buildDialogButton(
      CANVAS_WIDTH / 2 - 56, OY + OH - 30, '확인', CASUAL.PURPLE, CASUAL.PURPLE_DK, CASUAL_CSS.WHITE,
      () => { ov.destroy(true); this.performUpgrade(branch); },
      ov,
    );
    this.buildDialogButton(
      CANVAS_WIDTH / 2 + 56, OY + OH - 30, '취소', CASUAL.PANEL_SOFT, CASUAL.EDGE, CASUAL_CSS.INK,
      () => ov.destroy(true),
      ov,
    );

    this.tweens.add({ targets: ov, alpha: 1, duration: 180, ease: 'Quad.easeOut' });
  }

  private buildDialogButton(
    cx: number,
    cy: number,
    label: string,
    fill: number,
    edge: number,
    textColor: string,
    cb: () => void,
    container: Phaser.GameObjects.Container,
  ): void {
    const w = 86, h = 34;
    const bx = cx - w / 2, by = cy - h / 2;
    const g = this.add.graphics();
    g.fillStyle(edge, 1);
    g.fillRoundedRect(bx, by + 3, w, h, 11);
    g.fillStyle(fill, 1);
    g.fillRoundedRect(bx, by, w, h, 11);
    g.fillStyle(0xffffff, 0.35);
    g.fillRoundedRect(bx + 6, by + 4, w - 12, 5, 3);
    g.lineStyle(2.5, edge, 1);
    g.strokeRoundedRect(bx, by, w, h, 11);
    container.add(g);
    container.add(this.add.text(cx, cy, label, {
      fontFamily: 'sans-serif', fontSize: '13px', fontStyle: 'bold', color: textColor,
    }).setOrigin(0.5));
    const zone = this.add.zone(cx, cy, w, h).setInteractive({ useHandCursor: true });
    zone.on('pointerdown', cb);
    container.add(zone);
  }

  // ─── Upgrade logic ────────────────────────────────────────────────────────────

  private performUpgrade(branch: BranchDef): void {
    const result = upgradeWisdomBranch(this.state, branch.id);
    if (!result.ok) return;

    this.state = result.state;
    saveGameState(this.state);

    // Update crystal display + cost deduction float + pop
    this.crystalText.setText(`💠 ${this.state.soulCrystals} 영혼 수정`);
    const costFloat = this.add.text(CANVAS_WIDTH / 2, 82, `-${result.cost}💠`, {
      fontFamily: 'sans-serif', fontSize: '13px', fontStyle: 'bold',
      color: CASUAL_CSS.PURPLE, stroke: '#ffffff', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(250).setAlpha(0);
    this.tweens.add({
      targets: costFloat, y: 106, alpha: { from: 1, to: 0 },
      duration: 900, ease: 'Cubic.easeOut',
      onComplete: () => costFloat.destroy(),
    });
    this.tweens.killTweensOf(this.crystalText);
    this.crystalText.setScale(1.3);
    this.tweens.add({
      targets: this.crystalText, scaleX: 1, scaleY: 1,
      duration: 260, ease: 'Back.easeIn',
    });

    // Animate node
    const container = this.nodeContainers.get(branch.id);
    if (container) {
      this.renderNode(branch, result.nextTier, container);
      // Expanding ring
      const ring = this.add.graphics();
      ring.lineStyle(3, CASUAL.GOLD, 0.95);
      ring.strokeCircle(branch.position.x, branch.position.y, NODE_R);
      this.tweens.add({
        targets: ring,
        scaleX: 2.8, scaleY: 2.8,
        alpha: 0,
        duration: 500,
        ease: 'Power2.easeOut',
        onComplete: () => ring.destroy(),
      });
      // Node bounce
      this.tweens.add({
        targets: container,
        scaleX: 1.25, scaleY: 1.25,
        duration: 120, ease: 'Back.easeOut',
        yoyo: true,
      });
    }

    // Rebuild panel for updated state
    this.closeDetailPanel();
    this.time.delayedCall(240, () => {
      if (this.activeBranch?.id === branch.id) {
        this.openDetailPanel(branch);
      }
    });

    // Check all-maxed
    this.checkAllMaxed();
  }

  private checkAllMaxed(): void {
    const allMaxed = BRANCH_DEFS.every(b => (this.state.wisdomTree[b.id] ?? 0) >= MAX_WISDOM_TIER);
    if (!allMaxed) return;

    // Celebration beam overlay
    const overlay = this.add.graphics().setDepth(400);
    overlay.fillStyle(CASUAL.GOLD, 0);
    overlay.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    this.tweens.add({
      targets: overlay,
      alpha: { from: 0, to: 0.35 },
      duration: 400, yoyo: true,
      onComplete: () => overlay.destroy(),
    });

    const toast = this.add.text(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, '✨ 선조의 지혜 완전 해방! ✨', {
      fontFamily: 'sans-serif', fontSize: '18px', fontStyle: 'bold',
      color: CASUAL_CSS.GOLD, stroke: '#2a1606', strokeThickness: 4,
      backgroundColor: '#1c1408',
      padding: { x: 16, y: 10 },
    }).setOrigin(0.5).setDepth(401).setAlpha(0);

    this.tweens.add({
      targets: toast,
      alpha: 1, duration: 300,
      onComplete: () => {
        this.tweens.add({
          targets: toast, alpha: 0, duration: 400, delay: 2000,
          onComplete: () => toast.destroy(),
        });
      },
    });
  }
}
