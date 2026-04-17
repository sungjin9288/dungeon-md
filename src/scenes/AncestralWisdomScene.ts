import Phaser from 'phaser';
import { COLORS, CSS }        from '../constants/colors';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../constants/layout';
import {
  BRANCH_DEFS, MAX_WISDOM_TIER,
  loadGameState, saveGameState,
  type BranchDef, type GameState,
} from '../data/wisdom';

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
    const g = this.add.graphics();
    g.fillStyle(0x0d0800, 1);
    g.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Subtle stone grid
    const ts = 44;
    for (let x = 0; x < CANVAS_WIDTH; x += ts) {
      for (let y = 0; y < CANVAS_HEIGHT; y += ts) {
        g.fillStyle(0x110c04, 0.6);
        g.fillRect(x, y, ts - 1, ts - 1);
      }
    }
  }

  // ─── Mist ────────────────────────────────────────────────────────────────────

  private spawnMist(): void {
    for (let i = 0; i < 18; i++) {
      const x = Phaser.Math.Between(20, CANVAS_WIDTH - 20);
      const y = Phaser.Math.Between(CANVAS_HEIGHT / 2, CANVAS_HEIGHT + 60);
      const r = Phaser.Math.Between(30, 80);
      const a = Phaser.Math.FloatBetween(0.04, 0.15);

      const g = this.add.graphics();
      g.fillStyle(0x4a0080, a);
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
    // Dark top bar
    const hdr = this.add.graphics();
    hdr.fillStyle(0x0a0600, 0.9);
    hdr.fillRect(0, 0, CANVAS_WIDTH, 80);
    hdr.lineStyle(1, COLORS.TORCH_GOLD, 0.35);
    hdr.lineBetween(20, 80, CANVAS_WIDTH - 20, 80);
    hdr.setDepth(10);

    this.add.text(CANVAS_WIDTH / 2, 22, '선조의 지혜', {
      fontFamily: 'Georgia, serif',
      fontSize: '22px', fontStyle: 'bold',
      color: CSS.TORCH_AMBER,
    }).setOrigin(0.5, 0).setDepth(11);

    // Crystal counter
    const crystalBg = this.add.graphics().setDepth(11);
    crystalBg.fillStyle(0x1a1008, 0.95);
    crystalBg.fillRoundedRect(CANVAS_WIDTH / 2 - 55, 50, 110, 24, 6);
    crystalBg.lineStyle(1, COLORS.MAGIC_GLOW, 0.6);
    crystalBg.strokeRoundedRect(CANVAS_WIDTH / 2 - 55, 50, 110, 24, 6);

    this.crystalText = this.add.text(CANVAS_WIDTH / 2, 62, `💠 ${this.state.soulCrystals} 영혼 수정`, {
      fontFamily: 'sans-serif', fontSize: '11px', color: '#c070ff',
    }).setOrigin(0.5).setDepth(12);

    // Back button
    const backBtn = this.add.text(18, 26, '← 던전으로', {
      fontFamily: 'sans-serif', fontSize: '12px', color: CSS.PARCHMENT_MUTED,
    }).setOrigin(0, 0.5).setInteractive({ useHandCursor: true }).setDepth(11);

    backBtn.on('pointerover',  () => backBtn.setColor(CSS.PARCHMENT));
    backBtn.on('pointerout',   () => backBtn.setColor(CSS.PARCHMENT_MUTED));
    backBtn.on('pointerdown',  () => this.scene.start((this.registry.get('previousScene') as string) ?? 'StageSelectScene'));
  }

  // ─── Altar ───────────────────────────────────────────────────────────────────

  private drawAltar(): void {
    // Outer glow ring
    const glow = this.add.graphics();
    glow.fillStyle(COLORS.MAGIC_GLOW, 0.06);
    glow.fillCircle(ALTAR_X, ALTAR_Y, 56);
    glow.fillStyle(COLORS.MAGIC_GLOW, 0.1);
    glow.fillCircle(ALTAR_X, ALTAR_Y, 40);

    // Stone circle
    const stone = this.add.graphics();
    stone.fillStyle(COLORS.STONE_MID, 1);
    stone.fillCircle(ALTAR_X, ALTAR_Y, 30);
    stone.lineStyle(2, COLORS.TORCH_GOLD, 0.8);
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

      // Static dim line
      const staticLine = this.add.graphics();
      staticLine.lineStyle(1.5, 0x3a2810, 0.6);
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
          pulseGfx.lineStyle(2, COLORS.TORCH_GOLD, 0.6);
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
    const fillCol = isMaxed ? COLORS.TORCH_GOLD
                  : hasAny  ? COLORS.MAGIC_GLOW
                  :           COLORS.STONE_DARK;
    const borderCol = isMaxed ? COLORS.TORCH_AMBER
                    : hasAny  ? 0x7a30c8
                    :           0x4a3820;

    // Shadow
    const shadow = this.add.graphics();
    shadow.fillStyle(0x000000, 0.4);
    shadow.fillCircle(2, 3, NODE_R);
    container.add(shadow);

    // Node circle
    const circle = this.add.graphics();
    circle.fillStyle(fillCol, 1);
    circle.fillCircle(0, 0, NODE_R);
    circle.lineStyle(2.5, borderCol, 1);
    circle.strokeCircle(0, 0, NODE_R);
    container.add(circle);

    // Glow for maxed
    if (isMaxed) {
      const glowRing = this.add.graphics();
      glowRing.fillStyle(COLORS.TORCH_GOLD, 0.18);
      glowRing.fillCircle(0, 0, NODE_R + 8);
      container.addAt(glowRing, 0);
    }

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
        dotG.fillStyle(isMaxed ? COLORS.TORCH_GOLD : COLORS.MAGIC_GLOW, 1);
      } else {
        dotG.fillStyle(0x2a1e10, 0.9);
        dotG.lineStyle(0.8, 0x5a3820, 0.7);
      }
      dotG.fillCircle(dotX, dotY, 3);
      if (i >= tier) dotG.strokeCircle(dotX, dotY, 3);
      container.add(dotG);
    }

    // Cost badge — shown below the node for non-maxed branches
    if (!isMaxed) {
      const nextCost = branch.costPerTier[tier];
      if (nextCost > 0) {
        const costBadge = this.add.text(0, NODE_R + 12, `💠${nextCost}`, {
          fontFamily: 'sans-serif',
          fontSize: '10px',
          color: '#88aacc',
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
    this.panelBg.fillStyle(0x1a1008, 0.97);
    this.panelBg.fillRoundedRect(0, 0, CANVAS_WIDTH, PANEL_H, { tl: 14, tr: 14, bl: 0, br: 0 });
    this.panelBg.lineStyle(2, COLORS.TORCH_GOLD, 0.75);
    this.panelBg.strokeRoundedRect(0, 0, CANVAS_WIDTH, PANEL_H, { tl: 14, tr: 14, bl: 0, br: 0 });
    this.panel.add(this.panelBg);

    // Close button (always visible after open)
    this.panelClose = this.add.text(CANVAS_WIDTH - 18, 18, '✕', {
      fontFamily: 'sans-serif', fontSize: '14px', color: CSS.PARCHMENT_MUTED,
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
      fontFamily: 'Georgia, serif', fontSize: '16px', fontStyle: 'bold',
      color: CSS.TORCH_AMBER,
    }).setOrigin(0.5, 0);
    this.addToPanel(iconT);

    // Tier indicator (Roman)
    const roman = ['0', 'Ⅰ', 'Ⅱ', 'Ⅲ', 'Ⅳ', 'Ⅴ'];
    const tierT = this.add.text(cx, 50, isMaxed ? '✨ 최고 등급' : `등급 ${roman[tier]}`, {
      fontFamily: 'sans-serif', fontSize: '12px',
      color: isMaxed ? CSS.TORCH_AMBER : CSS.PARCHMENT_MUTED,
    }).setOrigin(0.5, 0);
    this.addToPanel(tierT);

    // Tier dots (large)
    for (let i = 0; i < MAX_WISDOM_TIER; i++) {
      const dx = cx - (MAX_WISDOM_TIER - 1) * 10 + i * 20;
      const dy = 76;
      const dg = this.add.graphics();
      if (i < tier) {
        dg.fillStyle(isMaxed ? COLORS.TORCH_GOLD : COLORS.MAGIC_GLOW, 1);
        dg.fillCircle(dx, dy, 5);
      } else {
        dg.fillStyle(0x2a1e10, 1);
        dg.lineStyle(1, 0x5a3820, 0.8);
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
      fontFamily: 'sans-serif', fontSize: '13px', color: CSS.PARCHMENT,
    }).setOrigin(0.5, 0);
    this.addToPanel(effectT);

    if (!isMaxed) {
      const nextStr = `→ 다음: ${branch.effect.replace('{value}', String(nextVal))}`;
      const nextT = this.add.text(cx, 122, nextStr, {
        fontFamily: 'sans-serif', fontSize: '11px', color: '#88ff88',
      }).setOrigin(0.5, 0);
      this.addToPanel(nextT);

      // Cost line
      const cost      = branch.costPerTier[tier];
      const canAfford = this.state.soulCrystals >= cost;
      const costT = this.add.text(cx, 154, `업그레이드 비용: 💠 ${cost}`, {
        fontFamily: 'sans-serif', fontSize: '13px',
        color: canAfford ? CSS.TORCH_AMBER : '#aa4444',
      }).setOrigin(0.5, 0);
      this.addToPanel(costT);

      // Upgrade button
      const btnW = 210, btnH = 40, btnX = cx - btnW / 2, btnY = 188;
      const btnBg = this.add.graphics();
      btnBg.fillStyle(canAfford ? 0x5a3800 : 0x2a1a0a, 1);
      btnBg.fillRoundedRect(btnX, btnY, btnW, btnH, 6);
      btnBg.lineStyle(1.5, canAfford ? COLORS.TORCH_GOLD : 0x4a3020, 0.8);
      btnBg.strokeRoundedRect(btnX, btnY, btnW, btnH, 6);
      this.addToPanel(btnBg);

      const btnT = this.add.text(cx, btnY + btnH / 2, canAfford ? '업그레이드' : '수정 부족', {
        fontFamily: 'Georgia, serif', fontSize: '14px', fontStyle: 'bold',
        color: canAfford ? CSS.TORCH_AMBER : CSS.PARCHMENT_MUTED,
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
        fontFamily: 'Georgia, serif', fontSize: '13px', fontStyle: 'italic',
        color: CSS.TORCH_AMBER,
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
    dim.fillStyle(0x000000, 0.65);
    dim.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    ov.add(dim);

    const bg = this.add.graphics();
    bg.fillStyle(0x0d0800, 1);
    bg.fillRoundedRect(OX, OY, OW, OH, 8);
    bg.lineStyle(2, COLORS.TORCH_GOLD, 0.85);
    bg.strokeRoundedRect(OX, OY, OW, OH, 8);
    ov.add(bg);

    ov.add(this.add.text(CANVAS_WIDTH / 2, OY + 28, `${branch.icon} ${branch.name} 업그레이드`, {
      fontFamily: 'Georgia, serif', fontSize: '14px', fontStyle: 'bold', color: CSS.TORCH_AMBER,
    }).setOrigin(0.5));
    ov.add(this.add.text(CANVAS_WIDTH / 2, OY + 56, `💠 ${cost} 영혼 수정이 소모됩니다.`, {
      fontFamily: 'sans-serif', fontSize: '12px', color: '#c8b080',
    }).setOrigin(0.5));
    ov.add(this.add.text(CANVAS_WIDTH / 2, OY + 76, `보유: 💠 ${this.state.soulCrystals}`, {
      fontFamily: 'sans-serif', fontSize: '11px', color: '#886644',
    }).setOrigin(0.5));

    const confirmBtn = this.add.text(CANVAS_WIDTH / 2 - 52, OY + OH - 30, '확인', {
      fontFamily: 'Georgia, serif', fontSize: '13px', color: CSS.TORCH_AMBER,
      backgroundColor: '#2a1400', padding: { x: 20, y: 7 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    confirmBtn.on('pointerdown', () => {
      ov.destroy(true);
      this.performUpgrade(branch);
    });
    ov.add(confirmBtn);

    const cancelBtn = this.add.text(CANVAS_WIDTH / 2 + 52, OY + OH - 30, '취소', {
      fontFamily: 'Georgia, serif', fontSize: '13px', color: '#666666',
      backgroundColor: '#111111', padding: { x: 20, y: 7 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    cancelBtn.on('pointerdown', () => ov.destroy(true));
    ov.add(cancelBtn);

    this.tweens.add({ targets: ov, alpha: 1, duration: 180, ease: 'Quad.easeOut' });
  }

  // ─── Upgrade logic ────────────────────────────────────────────────────────────

  private performUpgrade(branch: BranchDef): void {
    const tier = this.state.wisdomTree[branch.id] ?? 0;
    if (tier >= MAX_WISDOM_TIER) return;
    const cost = branch.costPerTier[tier];
    if (this.state.soulCrystals < cost) return;

    // Deduct cost, increment tier
    this.state.soulCrystals -= cost;
    this.state.wisdomTree[branch.id] = tier + 1;
    saveGameState(this.state);

    // Update crystal display + cost deduction float + pop
    this.crystalText.setText(`💠 ${this.state.soulCrystals} 영혼 수정`);
    const costFloat = this.add.text(CANVAS_WIDTH / 2, 82, `-${cost}💠`, {
      fontFamily: 'sans-serif', fontSize: '13px', fontStyle: 'bold',
      color: '#aa88ff', stroke: '#000000', strokeThickness: 3,
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
      this.renderNode(branch, tier + 1, container);
      // Expanding ring
      const ring = this.add.graphics();
      ring.lineStyle(3, COLORS.TORCH_GOLD, 0.9);
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
    overlay.fillStyle(COLORS.TORCH_GOLD, 0);
    overlay.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    this.tweens.add({
      targets: overlay,
      alpha: { from: 0, to: 0.35 },
      duration: 400, yoyo: true,
      onComplete: () => overlay.destroy(),
    });

    const toast = this.add.text(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, '✨ 선조의 지혜 완전 해방! ✨', {
      fontFamily: 'Georgia, serif', fontSize: '18px', fontStyle: 'bold',
      color: CSS.TORCH_AMBER,
      backgroundColor: '#1a1008',
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
