import Phaser from 'phaser';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../constants/layout';
import { loadGameState } from '../data/wisdom';
import { MONSTER_DEFS, type MonsterId } from '../data/monsters';
import { audioManager } from '../audio/AudioManager';
import { getActiveBanner, type SeasonBanner } from '../data/banners';
import {
  type SummonType, type SummonTypeDef, SUMMON_TYPE_DEFS,
  RARITY_RATES, RARITIES, RARITY_STARS, RARITY_COLORS, RARITY_CSS, RARITY_KO,
} from '../data/summonPools';
import { buildBannerCard } from '../ui/SummonBannerCard';
import { executePull as runPull } from '../ui/SummonPullLogic';

// ─── Layout constants ─────────────────────────────────────────────────────────

const CX        = CANVAS_WIDTH / 2;
const CARD_W    = 178;
const CARD_H    = 190;
const CARD_GAP  = 8;
const CARD_ML   = 11;  // left margin
const CARDS_Y   = 228; // top of first row
const PORTAL_CY = 130; // portal center Y
const TAB_Y     = 186; // tab bar top
const SUMMON_TRIBE_LABELS: Record<string, string> = {
  dokkaebi: '도깨비',
  gumiho: '구미호',
  dragon: '용족',
  underworld: '저승',
  sansin: '산신',
  sea: '해신',
  mask: '탈족',
  moonlight: '달빛',
  celestial: '천상',
};
const SUMMON_ELEMENT_LABELS: Record<string, string> = {
  fire: '화염',
  frost: '서리',
  lightning: '번개',
  dark: '암흑',
  holy: '신성',
};

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
    this.drawCollectionShowcase();
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
    g.fillStyle(0x100903, 1);
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

  private drawCollectionShowcase(): void {
    const gs = loadGameState();
    const summary = this.getCollectionSummary(gs);
    const g = this.add.graphics().setDepth(2);

    const progress = summary.total > 0 ? summary.owned / summary.total : 0;
    const barW = 92;
    this.drawShowcasePanel(g, 14, 78, 112, 78, 0x2b1a09, 0x7755ff);
    this.add.text(28, 91, '도감 수집', {
      fontFamily: 'sans-serif', fontSize: '10px', color: '#bca8ff',
    }).setDepth(6);
    this.add.text(28, 109, `${summary.owned}/${summary.total}`, {
      fontFamily: 'Georgia, serif', fontSize: '18px', color: '#ffffff',
    }).setDepth(6);

    const pg = this.add.graphics().setDepth(6);
    pg.fillStyle(0x0f0903, 0.85);
    pg.fillRoundedRect(28, 134, barW, 7, 4);
    pg.fillStyle(0xffd45c, 0.95);
    pg.fillRoundedRect(28, 134, Phaser.Math.Clamp(barW * progress, 3, barW), 7, 4);
    pg.lineStyle(1, 0xffffff, 0.12);
    pg.strokeRoundedRect(28, 134, barW, 7, 4);

    this.drawShowcasePanel(g, CANVAS_WIDTH - 126, 78, 112, 78, 0x261022, 0xff66aa);
    this.add.text(CANVAS_WIDTH - 112, 91, '레어 획득', {
      fontFamily: 'sans-serif', fontSize: '10px', color: '#ffc0df',
    }).setDepth(6);
    this.add.text(CANVAS_WIDTH - 112, 111, `E ${summary.epics}`, {
      fontFamily: 'Georgia, serif', fontSize: '14px', color: '#dd88ff',
    }).setDepth(6);
    this.add.text(CANVAS_WIDTH - 60, 111, `L ${summary.legends}`, {
      fontFamily: 'Georgia, serif', fontSize: '14px', color: '#ffb066',
    }).setDepth(6);
    this.add.text(CANVAS_WIDTH - 112, 134, `${summary.totalPulls} pulls`, {
      fontFamily: 'sans-serif', fontSize: '10px', color: '#aa8aa8',
    }).setDepth(6);

    this.drawRecentPullChips(summary.recent);
  }

  private drawShowcasePanel(
    g: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    w: number,
    h: number,
    bg: number,
    border: number,
  ): void {
    g.fillStyle(0x000000, 0.22);
    g.fillRoundedRect(x + 2, y + 3, w, h, 8);
    g.fillStyle(bg, 0.84);
    g.fillRoundedRect(x, y, w, h, 8);
    g.lineStyle(1, border, 0.55);
    g.strokeRoundedRect(x, y, w, h, 8);
    g.lineStyle(1, 0xffffff, 0.08);
    g.lineBetween(x + 10, y + 2, x + w - 10, y + 2);
  }

  private drawRecentPullChips(recent: NonNullable<ReturnType<typeof loadGameState>['summonHistory']>): void {
    const y = 162;
    const title = recent.length > 0 ? '최근 획득' : '첫 소환 보상 대기';
    this.add.text(CX, y - 12, title, {
      fontFamily: 'sans-serif', fontSize: '9px', color: '#9070bb',
    }).setOrigin(0.5).setDepth(6);

    const chips = recent.slice(0, 3);
    if (chips.length === 0) {
      const emptyG = this.add.graphics().setDepth(5);
      emptyG.fillStyle(0x1d1106, 0.86);
      emptyG.fillRoundedRect(CX - 53, y - 1, 106, 20, 10);
      emptyG.lineStyle(1, 0x7a55ff, 0.35);
      emptyG.strokeRoundedRect(CX - 53, y - 1, 106, 20, 10);
      this.add.text(CX, y + 9, 'NEW 카드팩 OPEN', {
        fontFamily: 'sans-serif', fontSize: '10px', color: '#ffd86b',
      }).setOrigin(0.5).setDepth(6);
      return;
    }

    const startX = CX - ((chips.length - 1) * 42) / 2;
    chips.forEach((rec, i) => {
      const def = MONSTER_DEFS[rec.monsterId as MonsterId];
      if (!def) return;
      const rarityIdx = RARITIES.indexOf(rec.rarity);
      const color = RARITY_COLORS[rarityIdx] ?? 0x8866ff;
      const x = startX + i * 42;
      const chipG = this.add.graphics().setDepth(5);
      chipG.fillStyle(0x1d1106, 0.92);
      chipG.fillRoundedRect(x - 17, y - 2, 34, 24, 9);
      chipG.lineStyle(1.2, color, 0.8);
      chipG.strokeRoundedRect(x - 17, y - 2, 34, 24, 9);
      chipG.fillStyle(color, rec.isNew ? 0.24 : 0.12);
      chipG.fillCircle(x + 11, y + 3, rec.isNew ? 4 : 2);
      this.add.text(x, y + 9, def.emoji, {
        fontFamily: 'sans-serif', fontSize: '15px',
      }).setOrigin(0.5).setDepth(6);
    });
  }

  private getCollectionSummary(gs: ReturnType<typeof loadGameState>): {
    owned: number;
    total: number;
    totalPulls: number;
    epics: number;
    legends: number;
    recent: NonNullable<ReturnType<typeof loadGameState>['summonHistory']>;
  } {
    const validIds = new Set(Object.keys(MONSTER_DEFS));
    const ownedIds = new Set(
      (gs.ownedMonsters ?? [])
        .map(monster => monster.id)
        .filter(id => validIds.has(id)),
    );
    const history = gs.summonHistory ?? [];
    return {
      owned:      ownedIds.size,
      total:      validIds.size,
      totalPulls: history.length,
      epics:      history.filter(record => record.rarity === 'epic').length,
      legends:    history.filter(record => record.rarity === 'legendary').length,
      recent:     history.slice().reverse().slice(0, 3),
    };
  }

  private getDexNo(monsterId: MonsterId): string {
    const index = Object.keys(MONSTER_DEFS).indexOf(monsterId);
    return String(Math.max(0, index) + 1).padStart(3, '0');
  }

  private getMonsterTagLine(def: (typeof MONSTER_DEFS)[MonsterId]): string {
    const tribe = def.tribe ? SUMMON_TRIBE_LABELS[def.tribe] ?? def.tribe : '던전';
    const element = def.element ? SUMMON_ELEMENT_LABELS[def.element] ?? def.element : '중립';
    return `${tribe} · ${element}`;
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
    g.fillStyle(0x180e05, 1);
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
    buildBannerCard(this, this.summonTabContainer, banner, topY);
  }

  private buildSummonCard(def: SummonTypeDef, cx: number, cardTop: number): void {
    const c = this.summonTabContainer;
    const gs = loadGameState();

    // ── Background ──────────────────────────────────────────────
    const bg = this.add.graphics();
    bg.fillStyle(0x000000, 0.22);
    bg.fillRoundedRect(cx - CARD_W / 2 + 2, cardTop + 3, CARD_W, CARD_H, 8);
    bg.fillStyle(def.bgColor, 1);
    bg.fillRoundedRect(cx - CARD_W / 2, cardTop, CARD_W, CARD_H, 8);
    bg.lineStyle(1.5, def.border, 0.9);
    bg.strokeRoundedRect(cx - CARD_W / 2, cardTop, CARD_W, CARD_H, 8);
    // Inner highlight line at top
    bg.lineStyle(1, def.border, 0.3);
    bg.lineBetween(cx - CARD_W / 2 + 10, cardTop + 1, cx + CARD_W / 2 - 10, cardTop + 1);
    bg.fillStyle(def.border, 0.08);
    bg.fillCircle(cx, cardTop + 36, 38);
    c.add(bg);

    this.drawSummonPackSkin(c, def, cx, cardTop);

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
        fontFamily: 'sans-serif', fontSize: '11px', color: '#aaaaaa',
      }).setOrigin(0.5));
    } else {
      c.add(this.add.text(cx, cardTop + 70, `${currencyIcon} ${def.cost1}/뽑`, {
        fontFamily: 'sans-serif', fontSize: '11px', color: '#aaaaaa',
      }).setOrigin(0.5));
    }
    if (def.cost10 !== null) {
      c.add(this.add.text(cx, cardTop + 81, `×10: ${def.cost10}`, {
        fontFamily: 'sans-serif', fontSize: '11px', color: '#777777',
      }).setOrigin(0.5));
    }
    if (def.id === 'soul') {
      c.add(this.add.text(cx, cardTop + 81, '미보유만', {
        fontFamily: 'sans-serif', fontSize: '11px', color: '#44ffcc',
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
        fontFamily: 'sans-serif', fontSize: '11px', color: '#664488',
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
      pg.fillStyle(0x1c1208, 1);
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
        fontFamily: 'sans-serif', fontSize: '11px', color: '#444466',
      }).setOrigin(0.5));
    }
  }

  private drawSummonPackSkin(
    c: Phaser.GameObjects.Container,
    def: SummonTypeDef,
    cx: number,
    cardTop: number,
  ): void {
    const gs = loadGameState();
    const rates = RARITY_RATES[def.id];
    const highRate = (rates[3] ?? 0) + (rates[4] ?? 0);
    const rateLabel = def.id === 'friendship' ? 'C/U' : `E+ ${highRate}%`;
    const today = new Date().toISOString().slice(0, 10);
    const isFriendReady = def.id === 'friendship' && gs.lastFriendSummon !== today;
    const pity = def.hasPity
      ? gs.summonPity?.[def.id as 'normal' | 'special'] ?? { count: 0, guaranteed: def.id === 'normal' ? 50 : 80 }
      : null;
    const pityPct = pity ? Phaser.Math.Clamp(pity.count / pity.guaranteed, 0, 1) : 0;
    const stateAccent = isFriendReady ? 0x66ffcc : pityPct >= 0.75 ? 0xffd66b : def.border;

    const deco = this.add.graphics();
    deco.fillStyle(0xffffff, 0.08);
    deco.fillRoundedRect(cx - 28, cardTop + 10, 56, 44, 8);
    deco.lineStyle(1, def.border, 0.35);
    deco.strokeRoundedRect(cx - 28, cardTop + 10, 56, 44, 8);
    deco.fillStyle(def.border, 0.10);
    deco.fillRoundedRect(cx - 20, cardTop + 16, 40, 32, 6);
    deco.fillStyle(def.border, 0.06);
    deco.fillCircle(cx, cardTop + 32, 42);
    deco.lineStyle(1, def.border, 0.22);
    deco.strokeCircle(cx, cardTop + 32, 35);
    deco.lineStyle(1.5, stateAccent, def.hasPity || isFriendReady ? 0.68 : 0.34);
    deco.beginPath();
    deco.arc(
      cx,
      cardTop + 32,
      41,
      Phaser.Math.DegToRad(-92),
      Phaser.Math.DegToRad(-92 + 360 * (def.hasPity ? pityPct : isFriendReady ? 1 : highRate / 100)),
    );
    deco.strokePath();
    deco.fillStyle(0x0a0602, 0.82);
    deco.fillRoundedRect(cx - CARD_W / 2 + 9, cardTop + 9, 47, 16, 6);
    deco.fillRoundedRect(cx + CARD_W / 2 - 58, cardTop + 9, 49, 16, 6);
    deco.lineStyle(1, def.border, 0.42);
    deco.strokeRoundedRect(cx - CARD_W / 2 + 9, cardTop + 9, 47, 16, 6);
    deco.strokeRoundedRect(cx + CARD_W / 2 - 58, cardTop + 9, 49, 16, 6);
    deco.fillStyle(0x0a0602, 0.88);
    deco.fillRoundedRect(cx + 34, cardTop + 62, 47, 15, 6);
    deco.lineStyle(1, stateAccent, 0.52);
    deco.strokeRoundedRect(cx + 34, cardTop + 62, 47, 15, 6);
    deco.fillStyle(stateAccent, 0.12);
    deco.fillCircle(cx + 43, cardTop + 69.5, 4.2);
    c.add(deco);

    const packBadge = this.add.text(cx - CARD_W / 2 + 32, cardTop + 17, 'PACK', {
      fontFamily: 'sans-serif', fontSize: '8px', color: '#f6eaff',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    c.add(packBadge);

    const rateBadge = this.add.text(cx + CARD_W / 2 - 33.5, cardTop + 17, rateLabel, {
      fontFamily: 'sans-serif', fontSize: '8px', color: def.accent,
      fontStyle: 'bold',
    }).setOrigin(0.5);
    c.add(rateBadge);
    c.add(this.add.text(cx + 58, cardTop + 69.5, def.hasPity ? `천장 ${Math.round(pityPct * 100)}%` : isFriendReady ? '무료' : '팩', {
      fontFamily: 'sans-serif',
      fontSize: '8px',
      color: isFriendReady ? '#b8fff0' : def.accent,
      fontStyle: 'bold',
    }).setOrigin(0.5));

    const rarityY = cardTop + 92;
    const activeRates = rates
      .map((rate, idx) => ({ rate, idx }))
      .filter(item => item.rate > 0);
    const startX = cx - ((activeRates.length - 1) * 20) / 2;
    activeRates.forEach((item, i) => {
      const dot = this.add.graphics();
      const x = startX + i * 20;
      dot.fillStyle(RARITY_COLORS[item.idx] ?? def.border, item.idx >= 3 ? 0.18 : 0.08);
      dot.fillCircle(x, rarityY, item.idx >= 3 ? 6.2 : 4.8);
      dot.fillStyle(RARITY_COLORS[item.idx] ?? def.border, item.idx >= 3 ? 0.9 : 0.55);
      dot.fillCircle(x, rarityY, item.idx >= 3 ? 3.6 : 2.7);
      dot.lineStyle(0.8, RARITY_COLORS[item.idx] ?? def.border, item.idx >= 3 ? 0.54 : 0.26);
      dot.strokeCircle(x, rarityY, item.idx >= 3 ? 6.2 : 4.8);
      c.add(dot);
    });

    c.add(this.add.text(cx - 50, cardTop + 32, '✦', {
      fontFamily: 'sans-serif', fontSize: '10px', color: def.accent,
    }).setOrigin(0.5));
    c.add(this.add.text(cx + 50, cardTop + 38, '✦', {
      fontFamily: 'sans-serif', fontSize: '8px', color: def.accent,
    }).setOrigin(0.5));
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
    panel.fillStyle(0x281808, 1);
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
        fontFamily: 'sans-serif', fontSize: '11px', color: '#aaaaaa',
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
      fg.fillStyle(isActive ? 0x4422aa : 0x1c1208, 1);
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
      filtered.slice(0, 11).forEach(rec => {
        const def = MONSTER_DEFS[rec.monsterId as MonsterId];
        if (!def) return;
        const rarityIdx = RARITIES.indexOf(rec.rarity);
        const rarityColor = RARITY_COLORS[rarityIdx] ?? 0x6644ff;
        const rarityCss = RARITY_CSS[rarityIdx] ?? '#9977cc';
        const rowX = 12;
        const rowW = CANVAS_WIDTH - 24;
        const rowH = 42;
        const statusLabel = rec.isNew ? 'NEW' : rec.scCompensation ? `+${rec.scCompensation}💠` : 'DUP';

        // Row bg
        const rbg = this.add.graphics();
        rbg.fillStyle(0x000000, 0.18);
        rbg.fillRoundedRect(rowX + 1, ry + 2, rowW, rowH, 8);
        rbg.fillStyle(0x1a1005, 0.96);
        rbg.fillRoundedRect(rowX, ry, rowW, rowH, 8);
        rbg.fillStyle(rarityColor, rec.isNew ? 0.17 : 0.08);
        rbg.fillRoundedRect(rowX + 6, ry + 6, 50, rowH - 12, 8);
        rbg.fillStyle(rarityColor, rec.isNew ? 0.08 : 0.035);
        rbg.fillRoundedRect(rowX + 64, ry + 6, rowW - 140, rowH - 12, 8);
        for (let i = 0; i < 6; i++) {
          rbg.lineStyle(0.8, rarityColor, rec.isNew ? 0.10 : 0.045);
          rbg.lineBetween(rowX + 70 + i * 28, ry + rowH - 8, rowX + 108 + i * 28, ry + 8);
        }
        rbg.lineStyle(1, rarityColor, rec.isNew ? 0.82 : 0.42);
        rbg.strokeRoundedRect(rowX, ry, rowW, rowH, 8);
        rbg.lineStyle(1, 0xffffff, 0.10);
        rbg.strokeRoundedRect(rowX + 4, ry + 4, rowW - 8, rowH - 8, 6);
        rbg.fillStyle(0x110a03, 0.94);
        rbg.fillRoundedRect(rowX + 17, ry + 5, 42, 12, 5);
        rbg.lineStyle(1, rarityColor, 0.48);
        rbg.strokeRoundedRect(rowX + 17, ry + 5, 42, 12, 5);
        rbg.fillStyle(rec.isNew ? 0x3b2500 : 0x180e05, 0.94);
        rbg.fillRoundedRect(CANVAS_WIDTH - 78, ry + 10, 56, 22, 7);
        rbg.lineStyle(1, rec.isNew ? 0xffd45c : 0x44ffcc, rec.isNew ? 0.72 : 0.54);
        rbg.strokeRoundedRect(CANVAS_WIDTH - 78, ry + 10, 56, 22, 7);
        c.add(rbg);

        c.add(this.add.text(38, ry + 11, `도감 ${this.getDexNo(rec.monsterId as MonsterId)}`, {
          fontFamily: 'sans-serif',
          fontSize: '7px',
          color: rarityCss,
          fontStyle: 'bold',
        }).setOrigin(0.5));
        c.add(this.add.text(37, ry + 27, def.emoji, {
          fontFamily: 'sans-serif', fontSize: '18px',
        }).setOrigin(0.5));

        c.add(this.add.text(72, ry + 11, def.name, {
          fontFamily: 'sans-serif',
          fontSize: '11px',
          color: rec.isNew ? '#ffffff' : '#b6a9c8',
          fontStyle: rec.isNew ? 'bold' : 'normal',
        }).setOrigin(0, 0.5));
        c.add(this.add.text(72, ry + 28, this.getMonsterTagLine(def), {
          fontFamily: 'sans-serif',
          fontSize: '8px',
          color: '#9d86be',
        }).setOrigin(0, 0.5));

        c.add(this.add.text(202, ry + 11, RARITY_STARS[rarityIdx] ?? '', {
          fontFamily: 'sans-serif',
          fontSize: '10px',
          color: rarityCss,
        }).setOrigin(0.5));
        c.add(this.add.text(202, ry + 28, RARITY_KO[rarityIdx] ?? '획득', {
          fontFamily: 'sans-serif',
          fontSize: '8px',
          color: rarityCss,
          fontStyle: 'bold',
        }).setOrigin(0.5));

        c.add(this.add.text(CANVAS_WIDTH - 50, ry + 21, statusLabel, {
          fontFamily: 'sans-serif',
          fontSize: rec.isNew ? '10px' : '9px',
          color: rec.isNew ? '#ffe8a3' : '#b8fff0',
          fontStyle: 'bold',
        }).setOrigin(0.5));
        ry += 46;
      });
    }

    // Lifetime stats
    const total  = gs.summonHistory?.length ?? 0;
    const epics  = gs.summonHistory?.filter(r => r.rarity === 'epic').length ?? 0;
    const legs   = gs.summonHistory?.filter(r => r.rarity === 'legendary').length ?? 0;
    c.add(this.add.text(CX, CANVAS_HEIGHT - 52, `총 소환: ${total}회  |  에픽: ${epics}회  |  전설: ${legs}회`, {
      fontFamily: 'sans-serif', fontSize: '11px', color: '#443355',
    }).setOrigin(0.5));
  }

  // ─── Execute pull ────────────────────────────────────────────────────────────

  private executePull(type: SummonType, count: number): void {
    runPull(
      { scene: this, activeBanner: this.activeBanner, showToast: (msg) => this.showToast(msg) },
      type,
      count,
    );
  }

  // ─── Animation delegates ────────────────────────────────────────────────────

  // ─── Friend summon reminder ────────────────────────────────────────────────

  private checkFreeReminderBadge(): void {
    const gs    = loadGameState();
    const today = new Date().toISOString().slice(0, 10);
    if (gs.lastFriendSummon !== today) {
      // Brief toast reminder
      this.time.delayedCall(1200, () => {
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
