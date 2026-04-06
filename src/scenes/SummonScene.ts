import Phaser from 'phaser';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../constants/layout';
import { loadGameState, saveGameState, type SummonRarity, type SummonRecord } from '../data/wisdom';
import { updateQuestObjective, tickSubQuestProgress } from '../data/quests';
import { MONSTER_DEFS, type MonsterId } from '../data/monsters';
import { defaultOwnedMonster } from '../data/barracks';
import { audioManager } from '../audio/AudioManager';
import { getActiveBanner, getBannerTimeLeft, applyBannerBoost, type SeasonBanner } from '../data/banners';
import { logger } from '../utils/logger';
import {
  type SummonType, type SummonTypeDef, SUMMON_TYPE_DEFS,
  RARITY_RATES, RARITIES, RARITY_STARS, RARITY_CSS,
  RARITY_KO, SC_COMP, RARITY_POOLS, rollRarity,
} from '../data/summonPools';
import { playSinglePullAnimation, playMultiPullAnimation } from '../ui/SummonAnimations';

// ─── Layout constants ─────────────────────────────────────────────────────────

const CX        = CANVAS_WIDTH / 2;
const CARD_W    = 178;
const CARD_H    = 190;
const CARD_GAP  = 8;
const CARD_ML   = 11;  // left margin
const CARDS_Y   = 228; // top of first row
const PORTAL_CY = 130; // portal center Y
const TAB_Y     = 186; // tab bar top

// ─── Scene ────────────────────────────────────────────────────────────────────

export class SummonScene extends Phaser.Scene {
  private summonTabContainer!: Phaser.GameObjects.Container;
  private historyTabContainer!: Phaser.GameObjects.Container;
  private historyFilter: 'all' | 'new' | 'dupe' = 'all';
  private portalGraphics!: Phaser.GameObjects.Graphics;
  private runeGraphics!: Phaser.GameObjects.Graphics;

  constructor() { super({ key: 'SummonScene' }); }

  create(): void {
    this.drawBackground();
    this.drawPortal();
    this.drawHeader();
    this.drawTabBar();
    this.buildSummonTab();
    this.buildHistoryTab();
    this.showTab('summon');
    this.checkFreeReminderBadge();

    audioManager.resume().then(() => audioManager.playBgm('summon'));
  }

  // ─── Background ─────────────────────────────────────────────────────────────

  private drawBackground(): void {
    const g = this.add.graphics().setDepth(-10);
    g.fillStyle(0x0d0010, 1);
    g.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Stars
    for (let i = 0; i < 90; i++) {
      const sx = Phaser.Math.Between(0, CANVAS_WIDTH);
      const sy = Phaser.Math.Between(0, CANVAS_HEIGHT);
      const a  = Math.random() * 0.6 + 0.1;
      g.fillStyle(0xffffff, a);
      g.fillCircle(sx, sy, Math.random() * 1.2 + 0.3);
    }

    // Rune particles
    this.add.particles(CX, CANVAS_HEIGHT / 2, 'dust', {
      x: { min: -CX, max: CX },
      y: { min: -CANVAS_HEIGHT / 2, max: CANVAS_HEIGHT / 2 },
      alpha: { min: 0.03, max: 0.2 },
      scale: { min: 0.1, max: 0.4 },
      tint: [0x9966ff, 0xcc44ff, 0x4444ff, 0xffffff],
      lifespan: { min: 2500, max: 6000 },
      speedX: { min: -5, max: 5 },
      speedY: { min: -5, max: 5 },
      frequency: 120, quantity: 1,
    }).setDepth(0);
  }

  // ─── Portal animation ────────────────────────────────────────────────────────

  private drawPortal(): void {
    this.portalGraphics = this.add.graphics().setDepth(3);
    this.runeGraphics   = this.add.graphics().setDepth(4);

    // Portal + floating runes — redrawn every frame via time event
    this.time.addEvent({
      delay: 33, repeat: -1,
      callback: () => {
        if (!this.portalGraphics.active) return;
        const t = this.time.now * 0.001;
        this.portalGraphics.clear();

        // Outer glow rings (3 rings, different speeds + radii)
        const rings = [
          { r: 52, speed: 0.4,  color: 0x6600cc, alpha: 0.15 },
          { r: 40, speed: 0.7,  color: 0x9933ff, alpha: 0.25 },
          { r: 28, speed: 1.1,  color: 0xcc66ff, alpha: 0.40 },
        ];
        for (const ring of rings) {
          const pulse = 1 + 0.08 * Math.sin(t * ring.speed * 2.5);
          this.portalGraphics.lineStyle(3, ring.color, ring.alpha * (0.8 + 0.2 * Math.sin(t * ring.speed)));
          this.portalGraphics.strokeCircle(CX, PORTAL_CY, ring.r * pulse);
        }

        // Inner core glow
        for (let r = 18; r >= 4; r -= 3) {
          this.portalGraphics.fillStyle(0xcc44ff, 0.04 * (20 - r));
          this.portalGraphics.fillCircle(CX, PORTAL_CY, r);
        }

        // Center orb
        this.portalGraphics.fillStyle(0xffffff, 0.7 + 0.15 * Math.sin(t * 3));
        this.portalGraphics.fillCircle(CX, PORTAL_CY, 6);

        // Floating runes (8 small circles orbiting)
        this.runeGraphics.clear();
        for (let i = 0; i < 8; i++) {
          const angle = (i / 8) * Math.PI * 2 + t * 0.6;
          const rx    = CX + Math.cos(angle) * 60;
          const ry    = PORTAL_CY + Math.sin(angle) * 22;
          const alpha = 0.25 + 0.25 * Math.sin(t * 1.5 + i);
          this.runeGraphics.fillStyle(0xaa66ff, alpha);
          this.runeGraphics.fillCircle(rx, ry, 3.5);
        }
      },
    });

    // Portal emoji label above
    this.add.text(CX, PORTAL_CY - 22, '🌌', {
      fontFamily: 'sans-serif', fontSize: '32px',
    }).setOrigin(0.5).setDepth(5);
  }

  // ─── Header ─────────────────────────────────────────────────────────────────

  private drawHeader(): void {
    // Back button
    const backT = this.add.text(16, 14, '← 뒤로', {
      fontFamily: 'sans-serif', fontSize: '12px', color: '#9977cc',
      backgroundColor: '#1a0030', padding: { x: 8, y: 4 },
    }).setInteractive().setDepth(10);
    backT.on('pointerdown', () => this.scene.start('DungeonHomeScene'));

    // Title
    this.add.text(CX, 16, '✨ 몬스터 소환', {
      fontFamily: 'Georgia, serif', fontSize: '18px', color: '#cc88ff',
    }).setOrigin(0.5).setDepth(10);

    // Resource bar
    const gs = loadGameState();
    this.add.text(CX - 10, 47, `💎 ${gs.gems}`, {
      fontFamily: 'sans-serif', fontSize: '12px', color: '#88aaff',
    }).setOrigin(1, 0.5).setDepth(10);
    this.add.text(CX + 10, 47, `💠 ${gs.soulCrystals}`, {
      fontFamily: 'sans-serif', fontSize: '12px', color: '#44ffcc',
    }).setOrigin(0, 0.5).setDepth(10);
  }

  // ─── Tab bar ────────────────────────────────────────────────────────────────

  private summonTabBtn!: Phaser.GameObjects.Text;
  private historyTabBtn!: Phaser.GameObjects.Text;

  private drawTabBar(): void {
    const g = this.add.graphics().setDepth(6);
    g.fillStyle(0x0a0018, 1);
    g.fillRect(0, TAB_Y, CANVAS_WIDTH, 32);
    g.lineStyle(1, 0x4422aa, 0.5);
    g.lineBetween(0, TAB_Y, CANVAS_WIDTH, TAB_Y);
    g.lineBetween(0, TAB_Y + 32, CANVAS_WIDTH, TAB_Y + 32);

    this.summonTabBtn = this.add.text(CX - 60, TAB_Y + 16, '🌀 소환', {
      fontFamily: 'sans-serif', fontSize: '12px', color: '#cc88ff',
    }).setOrigin(0.5).setDepth(10).setInteractive();
    this.summonTabBtn.on('pointerdown', () => this.showTab('summon'));

    this.historyTabBtn = this.add.text(CX + 60, TAB_Y + 16, '📜 기록', {
      fontFamily: 'sans-serif', fontSize: '12px', color: '#664488',
    }).setOrigin(0.5).setDepth(10).setInteractive();
    this.historyTabBtn.on('pointerdown', () => this.showTab('history'));
  }

  private showTab(tab: 'summon' | 'history'): void {
    this.summonTabContainer.setVisible(tab === 'summon');
    this.historyTabContainer.setVisible(tab === 'history');
    this.summonTabBtn.setColor(tab === 'summon' ? '#cc88ff' : '#664488');
    this.historyTabBtn.setColor(tab === 'history' ? '#cc88ff' : '#664488');
  }

  // ─── Summon tab ─────────────────────────────────────────────────────────────

  private activeBanner: SeasonBanner | null = null;

  private buildSummonTab(): void {
    this.summonTabContainer = this.add.container(0, 0).setDepth(7);

    this.activeBanner = getActiveBanner();
    let cardsOffsetY = 0;

    if (this.activeBanner) {
      const BANNER_H = 96;
      this.buildBannerCard(this.activeBanner, CARDS_Y);
      cardsOffsetY = BANNER_H + 10;
    }

    SUMMON_TYPE_DEFS.forEach((def, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const cx  = CARD_ML + col * (CARD_W + CARD_GAP) + CARD_W / 2;
      const y   = CARDS_Y + cardsOffsetY + row * (CARD_H + CARD_GAP);
      this.buildSummonCard(def, cx, y);
    });
  }

  private buildBannerCard(banner: SeasonBanner, topY: number): void {
    const c     = this.summonTabContainer;
    const BANER_H = 92;
    const BW    = CANVAS_WIDTH - 22;  // full-width minus margins
    const BX    = 11;                  // left edge

    // ── Panel background ──────────────────────────────────────────
    const bg = this.add.graphics();
    bg.fillStyle(banner.bgColor, 1);
    bg.fillRoundedRect(BX, topY, BW, BANER_H, 10);
    c.add(bg);

    // ── Pulsing border (animated via time event) ──────────────────
    const borderG = this.add.graphics();
    c.add(borderG);
    let pulseT = 0;
    this.time.addEvent({
      delay: 33, repeat: -1,
      callback: () => {
        if (!borderG.active) return;
        pulseT += 0.05;
        const alpha = 0.55 + 0.45 * Math.sin(pulseT * 2.5);
        const glow  = 0.18 + 0.18 * Math.sin(pulseT * 1.8);
        borderG.clear();
        // Outer glow
        borderG.lineStyle(4, banner.borderColor, glow);
        borderG.strokeRoundedRect(BX - 1, topY - 1, BW + 2, BANER_H + 2, 11);
        // Main border
        borderG.lineStyle(1.5, banner.borderColor, alpha);
        borderG.strokeRoundedRect(BX, topY, BW, BANER_H, 10);
        // Inner highlight
        borderG.lineStyle(1, banner.glowColor, glow * 0.5);
        borderG.lineBetween(BX + 12, topY + 1, BX + BW - 12, topY + 1);
      },
    });

    // ── Season badge (top-left) ───────────────────────────────────
    const badgeBg = this.add.graphics();
    badgeBg.fillStyle(banner.borderColor, 0.25);
    badgeBg.fillRoundedRect(BX + 8, topY + 7, 70, 16, 8);
    c.add(badgeBg);
    c.add(this.add.text(BX + 43, topY + 15, banner.subname, {
      fontFamily: 'sans-serif', fontSize: '8px', color: banner.accentCss,
    }).setOrigin(0.5));

    // ── Banner name ───────────────────────────────────────────────
    c.add(this.add.text(BX + 16, topY + 30, banner.name, {
      fontFamily: 'Georgia, serif', fontSize: '14px',
      color: banner.accentCss, fontStyle: 'bold',
    }).setOrigin(0, 0.5));

    // ── Description ───────────────────────────────────────────────
    c.add(this.add.text(BX + 16, topY + 50, banner.description, {
      fontFamily: 'sans-serif', fontSize: '9px', color: '#bbbbbb',
    }).setOrigin(0, 0.5));

    // ── Countdown (bottom-left) ───────────────────────────────────
    const timeText = this.add.text(BX + 16, topY + BANER_H - 12, getBannerTimeLeft(banner), {
      fontFamily: 'sans-serif', fontSize: '8px', color: '#888888',
    }).setOrigin(0, 0.5);
    c.add(timeText);
    // Live update countdown
    this.time.addEvent({
      delay: 60_000, repeat: -1,
      callback: () => {
        if (timeText.active) timeText.setText(getBannerTimeLeft(banner));
      },
    });

    // ── Featured monster emojis (right side) ─────────────────────
    const shown = banner.featuredMonsters.slice(0, 4);
    const emojiStartX = CANVAS_WIDTH - 16 - shown.length * 34;
    shown.forEach((mId, idx) => {
      const def  = MONSTER_DEFS[mId as keyof typeof MONSTER_DEFS];
      const em   = def?.emoji ?? '👾';
      const ex   = emojiStartX + idx * 34;
      const ey   = topY + BANER_H / 2;

      // Glow circle under emoji
      const eg = this.add.graphics();
      eg.fillStyle(banner.glowColor, 0.12);
      eg.fillCircle(ex + 14, ey, 16);
      c.add(eg);

      c.add(this.add.text(ex + 14, ey, em, {
        fontFamily: 'sans-serif', fontSize: '22px',
      }).setOrigin(0.5));
    });
    if (banner.featuredMonsters.length > 4) {
      c.add(this.add.text(CANVAS_WIDTH - 14, topY + BANER_H / 2, `+${banner.featuredMonsters.length - 4}`, {
        fontFamily: 'sans-serif', fontSize: '9px', color: '#888888',
      }).setOrigin(1, 0.5));
    }

    // ── Rate boost badge ──────────────────────────────────────────
    const boostPct = Math.round(banner.rateMultiplier * 100);
    const boostBg  = this.add.graphics();
    boostBg.fillStyle(banner.borderColor, 0.3);
    boostBg.fillRoundedRect(BX + BW - 72, topY + 6, 62, 18, 9);
    c.add(boostBg);
    c.add(this.add.text(BX + BW - 41, topY + 15, `피처드 ${boostPct}%↑`, {
      fontFamily: 'sans-serif', fontSize: '8px', color: banner.accentCss, fontStyle: 'bold',
    }).setOrigin(0.5));
  }

  private buildSummonCard(def: SummonTypeDef, cx: number, cardTop: number): void {
    const c = this.summonTabContainer;
    const gs = loadGameState();

    // ── Background ──────────────────────────────────────────────
    const bg = this.add.graphics();
    bg.fillStyle(def.bgColor, 1);
    bg.fillRoundedRect(cx - CARD_W / 2, cardTop, CARD_W, CARD_H, 10);
    bg.lineStyle(1.5, def.border, 0.9);
    bg.strokeRoundedRect(cx - CARD_W / 2, cardTop, CARD_W, CARD_H, 10);
    // Inner highlight line at top
    bg.lineStyle(1, def.border, 0.3);
    bg.lineBetween(cx - CARD_W / 2 + 10, cardTop + 1, cx + CARD_W / 2 - 10, cardTop + 1);
    c.add(bg);

    // ── Icon ─────────────────────────────────────────────────────
    c.add(this.add.text(cx, cardTop + 26, def.icon, {
      fontFamily: 'sans-serif', fontSize: '26px',
    }).setOrigin(0.5));

    // ── Name ─────────────────────────────────────────────────────
    c.add(this.add.text(cx, cardTop + 54, def.name, {
      fontFamily: 'Georgia, serif', fontSize: '12px', color: def.accent,
    }).setOrigin(0.5));

    // ── Cost ─────────────────────────────────────────────────────
    const currencyIcon = def.currency === 'gems' ? '💎' : def.currency === 'soul' ? '💠' : '🤝';
    if (def.currency === 'fp') {
      c.add(this.add.text(cx, cardTop + 70, '무료 1회/일', {
        fontFamily: 'sans-serif', fontSize: '9px', color: '#aaaaaa',
      }).setOrigin(0.5));
    } else {
      c.add(this.add.text(cx, cardTop + 70, `${currencyIcon} ${def.cost1}/뽑`, {
        fontFamily: 'sans-serif', fontSize: '9px', color: '#aaaaaa',
      }).setOrigin(0.5));
    }
    if (def.cost10 !== null) {
      c.add(this.add.text(cx, cardTop + 81, `×10: ${def.cost10}`, {
        fontFamily: 'sans-serif', fontSize: '8px', color: '#777777',
      }).setOrigin(0.5));
    }
    if (def.id === 'soul') {
      c.add(this.add.text(cx, cardTop + 81, '미보유만', {
        fontFamily: 'sans-serif', fontSize: '8px', color: '#44ffcc',
      }).setOrigin(0.5));
    }

    // ── Divider ──────────────────────────────────────────────────
    const dg = this.add.graphics();
    dg.lineStyle(1, def.border, 0.3);
    dg.lineBetween(cx - CARD_W / 2 + 10, cardTop + 90, cx + CARD_W / 2 - 10, cardTop + 90);
    c.add(dg);

    // ── Buttons ──────────────────────────────────────────────────
    const btnY = cardTop + 108;
    this.makeCardBtn(c, def, cx + (def.cost10 !== null ? -44 : 0), btnY, '1회', () => this.executePull(def.id, 1));
    if (def.cost10 !== null) {
      this.makeCardBtn(c, def, cx + 44, btnY, '10회', () => this.executePull(def.id, 10));
    } else if (def.id === 'friendship') {
      this.makeFriendBtn(c, def, cx, btnY, gs);
    }

    // ── 확률 보기 ────────────────────────────────────────────────
    if (def.id !== 'friendship') {
      const rateT = this.add.text(cx, cardTop + 130, '확률 보기 ▼', {
        fontFamily: 'sans-serif', fontSize: '8px', color: '#664488',
      }).setOrigin(0.5).setInteractive();
      rateT.on('pointerdown', () => this.showRatesModal(def.id));
      c.add(rateT);
    }

    // ── Pity bar (normal / special only) ─────────────────────────
    if (def.hasPity) {
      const pityKey = def.id as 'normal' | 'special';
      const pity    = gs.summonPity?.[pityKey] ?? { count: 0, guaranteed: def.id === 'normal' ? 50 : 80 };
      const pct     = pity.count / pity.guaranteed;
      const barX    = cx - CARD_W / 2 + 12;
      const barW    = CARD_W - 24;
      const barY    = cardTop + 144;

      const pg = this.add.graphics();
      pg.fillStyle(0x1a0030, 1);
      pg.fillRoundedRect(barX, barY, barW, 6, 3);
      pg.fillStyle(def.border, 0.8);
      pg.fillRoundedRect(barX, barY, barW * pct, 6, 3);
      c.add(pg);

      const remaining = pity.guaranteed - pity.count;
      c.add(this.add.text(cx, barY + 10, `천장까지 ${remaining}회`, {
        fontFamily: 'sans-serif', fontSize: '7px', color: '#664488',
      }).setOrigin(0.5));

      // desc badge
      c.add(this.add.text(cx, cardTop + 170, def.desc, {
        fontFamily: 'sans-serif', fontSize: '7px', color: '#444466',
      }).setOrigin(0.5));
    } else {
      c.add(this.add.text(cx, cardTop + 148, def.desc, {
        fontFamily: 'sans-serif', fontSize: '8px', color: '#444466',
      }).setOrigin(0.5));
    }
  }

  private makeCardBtn(
    c: Phaser.GameObjects.Container,
    def: SummonTypeDef,
    cx: number, y: number,
    label: string,
    cb: () => void,
  ): void {
    const w = 68, h = 24;
    const bg = this.add.graphics();
    bg.fillStyle(def.border, 0.2);
    bg.fillRoundedRect(cx - w / 2, y - h / 2, w, h, 6);
    bg.lineStyle(1, def.border, 0.7);
    bg.strokeRoundedRect(cx - w / 2, y - h / 2, w, h, 6);
    c.add(bg);

    const t = this.add.text(cx, y, label, {
      fontFamily: 'sans-serif', fontSize: '11px', color: def.accent,
    }).setOrigin(0.5).setInteractive();
    t.on('pointerdown', cb);
    c.add(t);

    // Hit zone
    const zone = this.add.zone(cx, y, w + 4, h + 4).setInteractive();
    zone.on('pointerdown', cb);
    c.add(zone);
  }

  private makeFriendBtn(
    c: Phaser.GameObjects.Container,
    def: SummonTypeDef,
    cx: number, y: number,
    gs: ReturnType<typeof loadGameState>,
  ): void {
    const today = new Date().toISOString().slice(0, 10);
    const used  = gs.lastFriendSummon === today;

    if (used) {
      // Show countdown
      const now     = new Date();
      const midnight = new Date(now);
      midnight.setHours(24, 0, 0, 0);
      const secsLeft = Math.floor((midnight.getTime() - now.getTime()) / 1000);
      const hh = String(Math.floor(secsLeft / 3600)).padStart(2, '0');
      const mm = String(Math.floor((secsLeft % 3600) / 60)).padStart(2, '0');
      const ss = String(secsLeft % 60).padStart(2, '0');
      c.add(this.add.text(cx, y, `⏰ ${hh}:${mm}:${ss}`, {
        fontFamily: 'sans-serif', fontSize: '11px', color: '#666644',
      }).setOrigin(0.5));
    } else {
      this.makeCardBtn(c, def, cx, y, '1회 (무료)', () => this.executePull('friendship', 1));
    }
  }

  // ─── Rates modal ────────────────────────────────────────────────────────────

  private showRatesModal(type: SummonType): void {
    const overlay = this.add.container(0, 0).setDepth(80);

    const dim = this.add.graphics();
    dim.fillStyle(0x000000, 0.85);
    dim.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    overlay.add(dim);

    // Panel
    const panelW = 280, panelH = 280;
    const panelX = (CANVAS_WIDTH - panelW) / 2;
    const panelY = (CANVAS_HEIGHT - panelH) / 2;

    const panel = this.add.graphics();
    panel.fillStyle(0x0d0028, 1);
    panel.fillRoundedRect(panelX, panelY, panelW, panelH, 12);
    panel.lineStyle(1.5, 0x8866ff, 0.9);
    panel.strokeRoundedRect(panelX, panelY, panelW, panelH, 12);
    overlay.add(panel);

    const def = SUMMON_TYPE_DEFS.find(d => d.id === type)!;
    overlay.add(this.add.text(CANVAS_WIDTH / 2, panelY + 20, `${def.icon} ${def.name} 확률`, {
      fontFamily: 'Georgia, serif', fontSize: '14px', color: '#cc88ff',
    }).setOrigin(0.5));

    const rates = RARITY_RATES[type];
    let rowY = panelY + 46;
    RARITIES.forEach((_rarity, idx) => {
      if (rates[idx] === 0) return;
      overlay.add(this.add.text(panelX + 24, rowY, RARITY_STARS[idx], {
        fontFamily: 'sans-serif', fontSize: '11px',
      }));
      overlay.add(this.add.text(panelX + 80, rowY, RARITY_KO[idx], {
        fontFamily: 'sans-serif', fontSize: '11px', color: RARITY_CSS[idx],
      }));
      overlay.add(this.add.text(panelX + panelW - 20, rowY, `${rates[idx]}%`, {
        fontFamily: 'sans-serif', fontSize: '11px', color: '#ffffff',
      }).setOrigin(1, 0));
      rowY += 24;
    });

    // Pity note
    if (def.hasPity) {
      overlay.add(this.add.text(CANVAS_WIDTH / 2, rowY + 10, `천장: ${def.id === 'normal' ? 50 : 80}회 → ${def.pityRarity} 보장`, {
        fontFamily: 'sans-serif', fontSize: '10px', color: '#8866aa',
      }).setOrigin(0.5));
      rowY += 28;
    }

    // Banner featured info
    if (this.activeBanner && (this.activeBanner.validSummonTypes as string[]).includes(type)) {
      const b = this.activeBanner;
      const divG = this.add.graphics();
      divG.lineStyle(1, b.borderColor, 0.4);
      divG.lineBetween(panelX + 16, rowY + 4, panelX + panelW - 16, rowY + 4);
      overlay.add(divG);

      overlay.add(this.add.text(CANVAS_WIDTH / 2, rowY + 16, `${b.icon} ${b.name} 피처드`, {
        fontFamily: 'sans-serif', fontSize: '10px', color: b.accentCss, fontStyle: 'bold',
      }).setOrigin(0.5));

      const boostPct = Math.round(b.rateMultiplier * 100);
      overlay.add(this.add.text(CANVAS_WIDTH / 2, rowY + 30, `${RARITY_KO[RARITIES.indexOf(b.boostedRarity)]} 등급 뽑기 시 ${boostPct}% 확률로 피처드`, {
        fontFamily: 'sans-serif', fontSize: '9px', color: '#aaaaaa',
      }).setOrigin(0.5));

      const emojis = b.featuredMonsters.slice(0, 5).map(id => {
        const md = MONSTER_DEFS[id as keyof typeof MONSTER_DEFS];
        return md?.emoji ?? '👾';
      }).join(' ');
      overlay.add(this.add.text(CANVAS_WIDTH / 2, rowY + 44, emojis, {
        fontFamily: 'sans-serif', fontSize: '16px',
      }).setOrigin(0.5));
    }

    // Close button
    const closeT = this.add.text(CANVAS_WIDTH / 2, panelY + panelH - 22, '닫기  ✕', {
      fontFamily: 'sans-serif', fontSize: '12px', color: '#9966cc',
      backgroundColor: '#1a0030', padding: { x: 14, y: 6 },
    }).setOrigin(0.5).setInteractive();
    closeT.on('pointerdown', () => overlay.destroy());
    overlay.add(closeT);

    // tap dim to close
    const closeZone = this.add.zone(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT).setInteractive().setOrigin(0);
    closeZone.on('pointerdown', () => overlay.destroy());
    overlay.add(closeZone);
    closeZone.setDepth(-1); // behind close btn
  }

  // ─── History tab ─────────────────────────────────────────────────────────────

  private buildHistoryTab(): void {
    this.historyTabContainer = this.add.container(0, 0).setDepth(7);
    this.rebuildHistory();
  }

  private rebuildHistory(): void {
    this.historyTabContainer.removeAll(true);
    const c = this.historyTabContainer;
    const gs = loadGameState();
    const history = (gs.summonHistory ?? []).slice().reverse().slice(0, 100);

    // Filter tabs
    const filterY = CARDS_Y - 4;
    const self = this;
    const filters: Array<{ label: string; val: typeof self.historyFilter }> = [
      { label: '전체', val: 'all' }, { label: '새 몬스터', val: 'new' }, { label: '중복', val: 'dupe' },
    ];
    filters.forEach((f, i) => {
      const fx = 50 + i * 110;
      const isActive = this.historyFilter === f.val;
      const fg = this.add.graphics();
      fg.fillStyle(isActive ? 0x4422aa : 0x1a0030, 1);
      fg.fillRoundedRect(fx - 40, filterY - 10, 80, 24, 5);
      fg.lineStyle(1, 0x6644ff, isActive ? 0.9 : 0.3);
      fg.strokeRoundedRect(fx - 40, filterY - 10, 80, 24, 5);
      c.add(fg);
      const ft = this.add.text(fx, filterY + 2, f.label, {
        fontFamily: 'sans-serif', fontSize: '10px', color: isActive ? '#cc88ff' : '#554466',
      }).setOrigin(0.5).setInteractive();
      ft.on('pointerdown', () => { this.historyFilter = f.val; this.rebuildHistory(); });
      c.add(ft);
    });

    const filtered = history.filter(r => {
      if (this.historyFilter === 'new')  return r.isNew;
      if (this.historyFilter === 'dupe') return !r.isNew;
      return true;
    });

    if (filtered.length === 0) {
      c.add(this.add.text(CX, CARDS_Y + 80, '소환 기록이 없습니다', {
        fontFamily: 'sans-serif', fontSize: '13px', color: '#554466',
      }).setOrigin(0.5));
    } else {
      let ry = CARDS_Y + 26;
      filtered.slice(0, 18).forEach(rec => {
        const def = MONSTER_DEFS[rec.monsterId as MonsterId];
        if (!def) return;
        const rarityIdx = RARITIES.indexOf(rec.rarity);

        // Row bg
        const rbg = this.add.graphics();
        rbg.fillStyle(0x0a0018, 1);
        rbg.fillRect(8, ry - 1, CANVAS_WIDTH - 16, 26);
        rbg.lineStyle(1, 0x2a1044, 0.5);
        rbg.lineBetween(8, ry + 25, CANVAS_WIDTH - 8, ry + 25);
        c.add(rbg);

        c.add(this.add.text(28, ry + 12, def.emoji, {
          fontFamily: 'sans-serif', fontSize: '16px',
        }).setOrigin(0.5));
        c.add(this.add.text(48, ry + 12, def.name, {
          fontFamily: 'sans-serif', fontSize: '10px', color: rec.isNew ? '#ffdd44' : '#888888',
        }).setOrigin(0, 0.5));
        c.add(this.add.text(160, ry + 12, RARITY_STARS[rarityIdx] ?? '', {
          fontFamily: 'sans-serif', fontSize: '9px',
        }).setOrigin(0, 0.5));
        if (!rec.isNew && rec.scCompensation) {
          c.add(this.add.text(CANVAS_WIDTH - 12, ry + 12, `+${rec.scCompensation}💠`, {
            fontFamily: 'sans-serif', fontSize: '9px', color: '#44ffcc',
          }).setOrigin(1, 0.5));
        } else if (rec.isNew) {
          c.add(this.add.text(CANVAS_WIDTH - 12, ry + 12, 'NEW', {
            fontFamily: 'sans-serif', fontSize: '9px', color: '#ffdd44',
          }).setOrigin(1, 0.5));
        }
        ry += 27;
      });
    }

    // Lifetime stats
    const total  = gs.summonHistory?.length ?? 0;
    const epics  = gs.summonHistory?.filter(r => r.rarity === 'epic').length ?? 0;
    const legs   = gs.summonHistory?.filter(r => r.rarity === 'legendary').length ?? 0;
    c.add(this.add.text(CX, CANVAS_HEIGHT - 52, `총 소환: ${total}회  |  에픽: ${epics}회  |  전설: ${legs}회`, {
      fontFamily: 'sans-serif', fontSize: '9px', color: '#443355',
    }).setOrigin(0.5));
  }

  // ─── Execute pull ────────────────────────────────────────────────────────────

  private executePull(type: SummonType, count: number): void {
    const gs = loadGameState();

    // ── Currency check ────────────────────────────────────────────
    const def = SUMMON_TYPE_DEFS.find(d => d.id === type)!;
    if (type === 'friendship') {
      const today = new Date().toISOString().slice(0, 10);
      if (gs.lastFriendSummon === today) {
        this.showToast('오늘의 무료 소환을 이미 사용했습니다');
        return;
      }
    } else {
      const cost = count === 1 ? def.cost1 : (def.cost10 ?? def.cost1 * count);
      if (def.currency === 'gems') {
        if (gs.gems < cost) { this.showToast(`💎 부족 (${gs.gems}/${cost})`); return; }
        gs.gems -= cost;
      } else if (def.currency === 'soul') {
        if (gs.soulCrystals < cost) { this.showToast(`💠 부족 (${gs.soulCrystals}/${cost})`); return; }
        gs.soulCrystals -= cost;
      }
    }

    // ── Unlock-gated pool helper ──────────────────────────────────
    // Filter each rarity pool to monsters whose unlockStage <= player's highest cleared stage.
    const highestCleared = (gs.stageProgress ?? []).reduce(
      (max: number, p: { bestStars?: number }, idx: number) => (p?.bestStars ?? 0) > 0 ? idx + 1 : max, 0,
    );
    const getPool = (rarity: SummonRarity): MonsterId[] => {
      const base = RARITY_POOLS[rarity];
      if (highestCleared <= 0) return base;
      return base.filter(id => {
        const def = MONSTER_DEFS[id as keyof typeof MONSTER_DEFS];
        return !def || (def.unlockStage ?? 1) <= highestCleared;
      });
    };

    // ── Roll results ──────────────────────────────────────────────
    const results: Array<{
      monsterId: MonsterId;
      rarity:    SummonRarity;
      rarityIdx: number;
      isNew:     boolean;
      scComp:    number;
      ceilingHit: boolean;
    }> = [];

    if (!gs.summonPity) {
      gs.summonPity = { normal: { count: 0, guaranteed: 50 }, special: { count: 0, guaranteed: 80 } };
    }

    for (let i = 0; i < count; i++) {
      let rarityIdx: number;
      let ceilingHit = false;

      // Pity check
      if ((type === 'normal' || type === 'special') && gs.summonPity[type]) {
        gs.summonPity[type].count++;
        if (gs.summonPity[type].count >= gs.summonPity[type].guaranteed) {
          rarityIdx    = type === 'normal' ? 3 : 4; // epic / legendary
          ceilingHit   = true;
          gs.summonPity[type].count = 0;
        } else {
          rarityIdx = rollRarity(RARITY_RATES[type]);
        }
      } else {
        rarityIdx = rollRarity(RARITY_RATES[type]);
      }

      const rarity = RARITIES[rarityIdx];
      const pool   = getPool(rarity);

      // Soul summon: prefer unowned
      let monsterId: MonsterId;
      if (type === 'soul') {
        const ownedIds = new Set(gs.ownedMonsters.map(m => m.id));
        const unowned = pool.filter(id => !ownedIds.has(id));
        const pick    = unowned.length > 0 ? unowned : pool;
        monsterId = pick[Math.floor(Math.random() * pick.length)] as MonsterId;
      } else if (
        this.activeBanner &&
        (this.activeBanner.validSummonTypes as string[]).includes(type) &&
        !ceilingHit
      ) {
        // ── Banner boost: bias towards featured monsters ───────────
        monsterId = applyBannerBoost(this.activeBanner, rarity, pool) as MonsterId;
      } else {
        monsterId = pool[Math.floor(Math.random() * pool.length)] as MonsterId;
      }

      const alreadyOwned = gs.ownedMonsters.some(m => m.id === monsterId);
      let scComp = 0;

      if (!alreadyOwned) {
        gs.ownedMonsters.push(defaultOwnedMonster(monsterId));
      } else {
        scComp = SC_COMP[rarityIdx];
        gs.soulCrystals += scComp;
      }

      // Friendship summon: mark used today
      if (type === 'friendship') {
        gs.lastFriendSummon = new Date().toISOString().slice(0, 10);
      }

      const record: SummonRecord = {
        type, monsterId, rarity, isNew: !alreadyOwned,
        timestamp: Date.now(), scCompensation: scComp || undefined,
        ceilingHit: ceilingHit || undefined,
      };
      if (!gs.summonHistory) gs.summonHistory = [];
      gs.summonHistory.push(record);

      results.push({ monsterId, rarity, rarityIdx, isNew: !alreadyOwned, scComp, ceilingHit });

      const logRarity = RARITY_KO[rarityIdx];
      logger.debug(
        `[SUMMON] type:${type} rarity:${rarity}(${logRarity}) monster:${monsterId}` +
        ` new:${!alreadyOwned}` +
        (ceilingHit ? ' 천장달성!' : '') +
        ((type === 'normal' || type === 'special')
          ? ` pity:${gs.summonPity[type as 'normal' | 'special'].count}/${gs.summonPity[type as 'normal' | 'special'].guaranteed}`
          : '') +
        (!alreadyOwned ? '' : ` compensation:+${scComp}💠 totalSC:${gs.soulCrystals}`)
      );
    }

    updateQuestObjective(gs, 'summon', count);
    tickSubQuestProgress(gs, 'summon', count);
    saveGameState(gs);

    // ── SFX ───────────────────────────────────────────────────────
    const hasLegendary = results.some(r => r.rarity === 'legendary');
    audioManager.playSfx(hasLegendary ? 'summon_legendary' : 'summon_pull');

    // ── Trigger animation ─────────────────────────────────────────
    const onAnimComplete = () => this.scene.restart();
    if (count === 1) {
      playSinglePullAnimation(this, results[0], onAnimComplete);
    } else {
      playMultiPullAnimation(this, results, onAnimComplete);
    }
  }

  // ─── Animation delegates ────────────────────────────────────────────────────

  // ─── Friend summon reminder ────────────────────────────────────────────────

  private checkFreeReminderBadge(): void {
    const gs    = loadGameState();
    const today = new Date().toISOString().slice(0, 10);
    if (gs.lastFriendSummon !== today) {
      // Brief toast reminder
      wait(1200, () => {
        if (this.scene.isActive()) {
          this.showToast('🤝 오늘의 무료 소환이 준비됐습니다!');
        }
      });
    }
  }

  // ─── Toast ─────────────────────────────────────────────────────────────────

  private showToast(msg: string): void {
    const t = this.add.text(CX, CANVAS_HEIGHT - 80, msg, {
      fontFamily: 'sans-serif', fontSize: '12px', color: '#ffaaff',
      backgroundColor: '#1a0030', padding: { x: 12, y: 6 },
    }).setOrigin(0.5).setDepth(200);
    this.tweens.add({ targets: t, alpha: 0, duration: 500, delay: 2000, onComplete: () => t.destroy() });
  }
}

function wait(ms: number, cb: () => void): void { window.setTimeout(cb, ms); }
