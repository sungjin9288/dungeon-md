import Phaser from 'phaser';
import { COLORS, CSS } from '../constants/colors';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../constants/layout';
import { loadGameState, saveGameState } from '../data/wisdom';
import {
  ACHIEVEMENT_DEFS,
  type AchievementCategory,
  type AchievementContext,
  type AchievementDef,
} from '../data/achievements';

// ─── AchievementScene ─────────────────────────────────────────────────────────

type Tab = { category: AchievementCategory | 'all'; label: string; icon: string };

const TABS: Tab[] = [
  { category: 'all',     label: '전체',   icon: '📋' },
  { category: 'combat',  label: '전투',   icon: '⚔️' },
  { category: 'economy', label: '경제',   icon: '💰' },
  { category: 'build',   label: '건설',   icon: '🏗️' },
  { category: 'endless', label: '무한',   icon: '♾️' },
  { category: 'mastery', label: '숙련',   icon: '🌟' },
];

const CARD_W   = 340;
const CARD_H   = 68;
const CARD_X   = (CANVAS_WIDTH - CARD_W) / 2;
const LIST_TOP = 160;
const LIST_BOT = CANVAS_HEIGHT - 60;
const VISIBLE_H = LIST_BOT - LIST_TOP;

export class AchievementScene extends Phaser.Scene {
  private activeTab: AchievementCategory | 'all' = 'all';
  private scrollY   = 0;
  private maxScroll = 0;

  private gameState = loadGameState();
  private ctx!: AchievementContext;

  // Containers
  private headerContainer!:  Phaser.GameObjects.Container;
  private tabContainer!:     Phaser.GameObjects.Container;
  private listContainer!:    Phaser.GameObjects.Container;
  private maskGraphics!:     Phaser.GameObjects.Graphics;

  constructor() { super({ key: 'AchievementScene' }); }

  create(): void {
    this.scrollY   = 0;
    this.gameState = loadGameState();
    this.ctx       = this.buildContext();

    this.drawBackground();
    this.buildHeader();
    this.buildTabs();
    this.buildList();
    this.setupScrollInput();
    this.drawBackButton();

    // Fade in
    this.cameras.main.setAlpha(0);
    this.tweens.add({ targets: this.cameras.main, alpha: 1, duration: 300 });
  }

  // ─── Context ────────────────────────────────────────────────────────────────

  private buildContext(): AchievementContext {
    const gs = this.gameState;
    return {
      totalKills:        gs.totalKills       ?? 0,
      totalGoldEarned:   gs.totalGoldEarned  ?? 0,
      roomsBuilt:        gs.roomsBuilt       ?? [],
      bossesKilled:      gs.bossesKilled     ?? [],
      endlessHighScore:  gs.endlessHighScore ?? 0,
      consecutiveDays:   gs.consecutiveDays  ?? 0,
      soulCrystals:      gs.soulCrystals     ?? 0,
      wisdomTree:        gs.wisdomTree       ?? {},
      stageProgress:     gs.stageProgress    ?? [],
      dmLevel:           gs.dmLevel          ?? 1,
      ownedMonsterCount: (gs.ownedMonsters ?? []).length,
      ownedSkinCount:    Object.values(gs.ownedSkins ?? {}).flat().length,
      totalFusions:      gs.totalFusions     ?? 0,
      completedTribes:   gs.completedTribes  ?? 0,
      totalSummons:      (gs.summonHistory ?? []).length,
    };
  }

  // ─── Background ────────────────────────────────────────────────────────────

  private drawBackground(): void {
    const g = this.add.graphics();
    g.fillStyle(0x0d0a04, 1);
    g.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    const ts = 40;
    for (let x = 0; x < CANVAS_WIDTH; x += ts) {
      for (let y = 0; y < CANVAS_HEIGHT; y += ts) {
        g.fillStyle(0x1a1208, 0.4);
        g.fillRect(x, y, ts - 1, ts - 1);
      }
    }
  }

  // ─── Header ─────────────────────────────────────────────────────────────────

  private buildHeader(): void {
    const totalCount   = ACHIEVEMENT_DEFS.length;
    const unlockedCount = ACHIEVEMENT_DEFS.filter(
      d => this.gameState.achievements?.[d.id]?.unlocked,
    ).length;

    this.headerContainer = this.add.container(0, 0);

    const title = this.add.text(CANVAS_WIDTH / 2, 36, '🏆 업적', {
      fontFamily: 'Georgia, serif', fontSize: '22px', fontStyle: 'bold',
      color: CSS.TORCH_AMBER,
    }).setOrigin(0.5);

    const counter = this.add.text(CANVAS_WIDTH / 2, 68, `${unlockedCount} / ${totalCount}`, {
      fontFamily: 'sans-serif', fontSize: '13px',
      color: CSS.PARCHMENT_MUTED,
    }).setOrigin(0.5);

    // Progress bar
    const pbg = this.add.graphics();
    pbg.fillStyle(0x1a1208, 1);
    pbg.fillRoundedRect(30, 86, CANVAS_WIDTH - 60, 8, 4);
    pbg.lineStyle(1, 0x4a3820, 0.7);
    pbg.strokeRoundedRect(30, 86, CANVAS_WIDTH - 60, 8, 4);

    const pct  = totalCount > 0 ? unlockedCount / totalCount : 0;
    const pfill = this.add.graphics();
    pfill.fillStyle(COLORS.TORCH_GOLD, 0.8);
    pfill.fillRoundedRect(31, 87, Math.max(0, (CANVAS_WIDTH - 62) * pct), 6, 3);

    const div = this.add.graphics();
    div.lineStyle(1, COLORS.TORCH_GOLD, 0.25);
    div.lineBetween(20, 104, CANVAS_WIDTH - 20, 104);

    this.headerContainer.add([title, counter, pbg, pfill, div]);
  }

  // ─── Tabs ────────────────────────────────────────────────────────────────────

  private buildTabs(): void {
    if (this.tabContainer) this.tabContainer.destroy();
    this.tabContainer = this.add.container(0, 108);

    const tabW = Math.floor(CANVAS_WIDTH / TABS.length);

    TABS.forEach((tab, i) => {
      const x    = i * tabW;
      const isActive = tab.category === this.activeTab;

      const bg = this.add.graphics();
      bg.fillStyle(isActive ? 0x3d3020 : 0x1a1208, 1);
      bg.fillRect(x, 0, tabW - 1, 40);
      if (isActive) {
        bg.lineStyle(2, COLORS.TORCH_GOLD, 0.6);
        bg.lineBetween(x, 40, x + tabW - 1, 40);
      }

      const txt = this.add.text(x + tabW / 2, 20, `${tab.icon}\n${tab.label}`, {
        fontFamily: 'sans-serif', fontSize: '9px',
        color: isActive ? CSS.TORCH_AMBER : CSS.PARCHMENT_MUTED,
        align: 'center',
      }).setOrigin(0.5);

      const zone = this.add.zone(x + tabW / 2, 20, tabW - 1, 40)
        .setInteractive({ useHandCursor: true });
      zone.on('pointerdown', () => {
        if (this.activeTab === tab.category) return;
        this.activeTab = tab.category;
        this.scrollY   = 0;
        this.buildTabs();
        this.buildList();
      });

      this.tabContainer.add([bg, txt, zone]);
    });
  }

  // ─── List ────────────────────────────────────────────────────────────────────

  private buildList(): void {
    if (this.listContainer) this.listContainer.destroy();
    if (this.maskGraphics)  this.maskGraphics.destroy();

    this.listContainer = this.add.container(0, LIST_TOP);

    const filtered = this.activeTab === 'all'
      ? ACHIEVEMENT_DEFS
      : ACHIEVEMENT_DEFS.filter(d => d.category === this.activeTab);

    // Sort: unlocked first, then by progress descending
    const gs = this.gameState;
    const sorted = [...filtered].sort((a, b) => {
      const ua = gs.achievements?.[a.id]?.unlocked ? 1 : 0;
      const ub = gs.achievements?.[b.id]?.unlocked ? 1 : 0;
      if (ub !== ua) return ub - ua;
      const pa = a.getProgress(this.ctx) / a.target;
      const pb = b.getProgress(this.ctx) / b.target;
      return pb - pa;
    });

    const GAP = 8;
    let offsetY = 0;

    sorted.forEach(def => {
      const entry  = gs.achievements?.[def.id];
      const unlocked = entry?.unlocked ?? false;
      const current  = def.getProgress(this.ctx);
      const pct      = Math.min(1, current / def.target);

      this.drawCard(def, current, pct, unlocked, entry?.rewardClaimed ?? false, offsetY);
      offsetY += CARD_H + GAP;
    });

    const totalHeight = offsetY;
    this.maxScroll    = Math.max(0, totalHeight - VISIBLE_H);

    // Apply mask so cards clip at list boundaries
    this.maskGraphics = this.add.graphics();
    this.maskGraphics.fillStyle(0xffffff, 1);
    this.maskGraphics.fillRect(0, LIST_TOP, CANVAS_WIDTH, VISIBLE_H);
    const mask = this.maskGraphics.createGeometryMask();
    this.listContainer.setMask(mask);

    this.applyScroll();
  }

  private drawCard(
    def: AchievementDef,
    current: number, pct: number,
    unlocked: boolean, rewardClaimed: boolean,
    offsetY: number,
  ): void {
    const { icon, name, description: desc, target, reward } = def;
    const x = CARD_X;
    const y = offsetY;

    const canClaim = unlocked && !rewardClaimed;

    // Card bg
    const bg = this.add.graphics();
    if (canClaim) {
      bg.fillStyle(0x1a2a10, 1);
      bg.fillRoundedRect(x, y, CARD_W, CARD_H, 6);
      bg.lineStyle(2, 0x44cc44, 0.8);
      bg.strokeRoundedRect(x, y, CARD_W, CARD_H, 6);
    } else if (unlocked) {
      bg.fillStyle(0x2a2010, 1);
      bg.fillRoundedRect(x, y, CARD_W, CARD_H, 6);
      bg.lineStyle(1.5, COLORS.TORCH_GOLD, 0.65);
      bg.strokeRoundedRect(x, y, CARD_W, CARD_H, 6);
    } else {
      bg.fillStyle(0x141008, 1);
      bg.fillRoundedRect(x, y, CARD_W, CARD_H, 6);
      bg.lineStyle(1, 0x3a2810, 0.5);
      bg.strokeRoundedRect(x, y, CARD_W, CARD_H, 6);
    }

    // Pulsing glow ring + "NEW" badge for claimable cards
    if (canClaim) {
      const glowRing = this.add.graphics();
      glowRing.lineStyle(3, 0x44ff88, 0.6);
      glowRing.strokeRoundedRect(x - 2, y - 2, CARD_W + 4, CARD_H + 4, 9);
      this.tweens.add({
        targets: glowRing,
        alpha: { from: 0.25, to: 0.85 },
        duration: 750,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });

      const badgeBg = this.add.graphics();
      badgeBg.fillStyle(0x22aa44, 1);
      badgeBg.fillRoundedRect(x + CARD_W - 32, y - 7, 30, 14, 3);

      const badgeLabel = this.add.text(x + CARD_W - 17, y, 'NEW', {
        fontFamily: 'sans-serif', fontSize: '8px', fontStyle: 'bold',
        color: '#ffffff',
      }).setOrigin(0.5);

      this.listContainer.add([glowRing, badgeBg, badgeLabel]);
    }

    // Icon
    const iconTxt = this.add.text(x + 20, y + CARD_H / 2, icon, {
      fontFamily: 'sans-serif', fontSize: '22px',
    }).setOrigin(0.5).setAlpha(unlocked ? 1 : 0.35);

    // Name
    const nameT = this.add.text(x + 42, y + 13, name, {
      fontFamily: 'Georgia, serif', fontSize: '12px', fontStyle: 'bold',
      color: canClaim ? '#88ff88' : unlocked ? CSS.TORCH_AMBER : CSS.PARCHMENT_MUTED,
    }).setOrigin(0, 0.5);

    // Description
    const descT = this.add.text(x + 42, y + 29, desc, {
      fontFamily: 'sans-serif', fontSize: '9px',
      color: unlocked ? CSS.PARCHMENT : '#5a4020',
      wordWrap: { width: CARD_W - 130 },
    }).setOrigin(0, 0.5);

    // Reward badge (top-right area)
    const rewardParts: string[] = [];
    if (reward.gems)         rewardParts.push(`💎${reward.gems}`);
    if (reward.soulCrystals) rewardParts.push(`💠${reward.soulCrystals}`);
    const rewardStr = rewardParts.join(' ');
    const rewardT = this.add.text(x + CARD_W - 8, y + 13, rewardStr, {
      fontFamily: 'sans-serif', fontSize: '9px',
      color: canClaim ? '#88ff88' : rewardClaimed ? '#445544' : CSS.PARCHMENT_MUTED,
    }).setOrigin(1, 0.5);

    // Progress bar
    const pbx = x + 42;
    const pby = y + CARD_H - 16;
    const pbw = CARD_W - 130;

    const pbg2 = this.add.graphics();
    pbg2.fillStyle(0x0a0804, 1);
    pbg2.fillRoundedRect(pbx, pby, pbw, 6, 3);

    const pfill = this.add.graphics();
    pfill.fillStyle(unlocked ? COLORS.TORCH_GOLD : 0x6a5030, unlocked ? 0.85 : 0.7);
    pfill.fillRoundedRect(pbx, pby, pbw * pct, 6, 3);

    const progressTxt = unlocked ? '완료!' : `${current} / ${target}`;
    const progressT = this.add.text(x + 42 + pbw + 4, y + CARD_H - 13, progressTxt, {
      fontFamily: 'sans-serif', fontSize: '9px',
      color: unlocked ? CSS.TORCH_AMBER : '#5a4020',
    }).setOrigin(0, 0.5);

    // Claim button OR claimed badge
    const btnW = 52, btnH = 22;
    const bx = x + CARD_W - btnW - 6;
    const by = y + CARD_H - btnH - 8;

    if (canClaim) {
      const btnBg = this.add.graphics();
      btnBg.fillStyle(0x1a4a00, 1);
      btnBg.fillRoundedRect(bx, by, btnW, btnH, 5);
      btnBg.lineStyle(1.5, 0x44dd44, 0.9);
      btnBg.strokeRoundedRect(bx, by, btnW, btnH, 5);
      const claimT = this.add.text(bx + btnW / 2, by + btnH / 2, '수령', {
        fontFamily: 'sans-serif', fontSize: '10px', fontStyle: 'bold',
        color: '#88ff88',
      }).setOrigin(0.5);
      const zone = this.add.zone(bx + btnW / 2, by + btnH / 2, btnW, btnH).setInteractive();
      zone.on('pointerdown', () => this.claimReward(def.id, reward));
      this.listContainer.add([btnBg, claimT, zone]);
    } else if (rewardClaimed) {
      const claimedT = this.add.text(x + CARD_W - 10, y + CARD_H - 13, '✓ 수령', {
        fontFamily: 'sans-serif', fontSize: '9px', color: '#445544',
      }).setOrigin(1, 0.5);
      this.listContainer.add([claimedT]);
    }

    this.listContainer.add([bg, iconTxt, nameT, descT, rewardT, pbg2, pfill, progressT]);
  }

  private claimReward(achievementId: string, reward: AchievementDef['reward']): void {
    const gs = loadGameState();
    const entry = gs.achievements?.[achievementId];
    if (!entry?.unlocked || entry.rewardClaimed) return;

    const updated = {
      ...gs,
      gems:         (gs.gems         ?? 0) + (reward.gems         ?? 0),
      soulCrystals: (gs.soulCrystals ?? 0) + (reward.soulCrystals ?? 0),
      achievements: {
        ...gs.achievements,
        [achievementId]: { ...entry, rewardClaimed: true },
      },
    };
    saveGameState(updated);

    // Rebuild list to reflect claimed state
    this.gameState = updated;
    this.buildList();

    // Toast feedback
    const parts: string[] = [];
    if (reward.gems)         parts.push(`💎 +${reward.gems} 젬`);
    if (reward.soulCrystals) parts.push(`💠 +${reward.soulCrystals} SC`);
    this.showRewardToast(parts.join('  '));
  }

  private showRewardToast(msg: string): void {
    const t = this.add.text(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 60, msg, {
      fontFamily: 'sans-serif', fontSize: '14px', fontStyle: 'bold',
      color: '#88ff88',
      backgroundColor: '#0a2a0a',
      padding: { x: 14, y: 8 },
    }).setOrigin(0.5).setDepth(500);
    this.tweens.add({
      targets: t, y: t.y - 30, alpha: 0,
      duration: 600, delay: 1200,
      onComplete: () => t.destroy(),
    });
  }

  // ─── Scroll ──────────────────────────────────────────────────────────────────

  private applyScroll(): void {
    this.scrollY = Math.max(0, Math.min(this.scrollY, this.maxScroll));
    this.listContainer.setY(LIST_TOP - this.scrollY);
  }

  private setupScrollInput(): void {
    this.input.on('wheel', (_ptr: unknown, _go: unknown, _dx: number, dy: number) => {
      this.scrollY += dy * 0.8;
      this.applyScroll();
    });

    // Touch drag
    let lastY = 0;
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => { lastY = p.y; });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (!p.isDown) return;
      const dy = lastY - p.y;
      lastY     = p.y;
      if (Math.abs(dy) > 2) {
        this.scrollY += dy;
        this.applyScroll();
      }
    });
  }

  // ─── Back button ─────────────────────────────────────────────────────────────

  private drawBackButton(): void {
    const btnW = 100, btnH = 36;
    const btnX = (CANVAS_WIDTH - btnW) / 2;
    const btnY = CANVAS_HEIGHT - 50;

    const bg = this.add.graphics();
    bg.fillStyle(0x1a1208, 1);
    bg.fillRoundedRect(btnX, btnY, btnW, btnH, 8);
    bg.lineStyle(1.5, 0x6a5030, 0.7);
    bg.strokeRoundedRect(btnX, btnY, btnW, btnH, 8);

    this.add.text(btnX + btnW / 2, btnY + btnH / 2, '← 뒤로', {
      fontFamily: 'sans-serif', fontSize: '11px',
      color: CSS.PARCHMENT_MUTED,
    }).setOrigin(0.5);

    const zone = this.add.zone(btnX + btnW / 2, btnY + btnH / 2, btnW, btnH)
      .setInteractive({ useHandCursor: true });
    zone.on('pointerover', () => {
      bg.clear();
      bg.fillStyle(0x2a2010, 1);
      bg.fillRoundedRect(btnX, btnY, btnW, btnH, 8);
      bg.lineStyle(1.5, COLORS.TORCH_GOLD, 0.6);
      bg.strokeRoundedRect(btnX, btnY, btnW, btnH, 8);
    });
    zone.on('pointerout', () => {
      bg.clear();
      bg.fillStyle(0x1a1208, 1);
      bg.fillRoundedRect(btnX, btnY, btnW, btnH, 8);
      bg.lineStyle(1.5, 0x6a5030, 0.7);
      bg.strokeRoundedRect(btnX, btnY, btnW, btnH, 8);
    });
    zone.on('pointerdown', () => this.scene.start((this.registry.get('previousScene') as string) ?? 'StageSelectScene'));
  }
}
