import Phaser from 'phaser';
import {
  addFramedPanel,
  addPrimaryActionButton,
  addSceneHeader,
  addTabBar,
} from '../ui/GameUiPrimitives';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../constants/layout';
import {
  DUNGEON_UI,
  DUNGEON_UI_CSS,
  ZONE_ACCENTS,
} from '../constants/colors';
import { applyCasualBackground } from '../ui/AmbientBackground';
import { loadGameState } from '../data/wisdom';
import { audioManager } from '../audio/AudioManager';
import { MONSTER_DEFS } from '../data/monsters';
import { getActiveBanner, type SeasonBanner } from '../data/banners';
import {
  type SummonType, type SummonTypeDef, SUMMON_TYPE_DEFS,
  RARITY_RATES, RARITIES, RARITY_COLORS,
} from '../data/summonPools';
import { buildBannerCard } from '../ui/SummonBannerCard';
import { executePull as runPull } from '../ui/SummonPullLogic';
import {
  RARITY_STARS, RARITY_CSS, RARITY_KO,
} from '../data/summonPools';
import { CX, CARD_W, CARD_H, CARD_GAP, CARD_ML, CARDS_Y, PORTAL_CY, TAB_Y } from '../ui/SummonShared';
import { drawCollectionShowcase } from '../ui/SummonShowcase';
import { getContextualBackTarget } from '../data/navigationContract';
import { getReducedMotion } from '../utils/reducedMotion';
import {
  buildHistoryTab, rebuildHistory,
  type SummonHistoryContext, type HistoryFilter,
} from '../ui/SummonHistory';

// ─── Scene ────────────────────────────────────────────────────────────────────

export class SummonScene extends Phaser.Scene {
  private summonTabContainer!: Phaser.GameObjects.Container;
  private historyTabContainer!: Phaser.GameObjects.Container;
  private historyFilter: HistoryFilter = 'all';
  private portalGraphics!: Phaser.GameObjects.Graphics;
  private runeGraphics!: Phaser.GameObjects.Graphics;
  private pullInFlight = false;

  constructor() { super({ key: 'SummonScene' }); }

  create(): void {
    this.pullInFlight = false;
    this.drawBackground();
    this.drawPortal();
    drawCollectionShowcase(this);
    this.drawHeader();
    this.drawTabBar();
    this.buildSummonTab();
    this.buildHistoryTabLocal();
    this.showTab('summon');
    this.checkFreeReminderBadge();

    audioManager.resume().then(() => audioManager.playBgm('summon'));
  }

  // ─── Background ─────────────────────────────────────────────────────────────

  private drawBackground(): void {
    applyCasualBackground(this);

    // The altar remains part of the physical dungeon: deep masonry, a central
    // ritual aisle, and sparse brass markers instead of a floating dashboard.
    const masonry = this.add.graphics().setDepth(-20);
    masonry.fillStyle(DUNGEON_UI.VOID, 0.34);
    masonry.fillRect(0, 82, CANVAS_WIDTH, CANVAS_HEIGHT - 82);
    masonry.lineStyle(1, DUNGEON_UI.IRON, 0.24);
    for (let y = 92; y < CANVAS_HEIGHT; y += 42) {
      masonry.lineBetween(0, y, CANVAS_WIDTH, y);
      const offset = Math.floor((y - 92) / 42) % 2 === 0 ? 0 : 34;
      for (let x = offset; x < CANVAS_WIDTH; x += 68) masonry.lineBetween(x, y, x, y + 42);
    }
    masonry.fillStyle(DUNGEON_UI.BRASS, 0.24);
    masonry.fillTriangle(18, 204, 24, 194, 30, 204);
    masonry.fillTriangle(CANVAS_WIDTH - 30, 204, CANVAS_WIDTH - 24, 194, CANVAS_WIDTH - 18, 204);

    // Rune particles are decorative; reduced-motion keeps the static portal only.
    if (!getReducedMotion()) {
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
  }

  // ─── Portal animation ────────────────────────────────────────────────────────

  private drawPortal(): void {
    const altar = this.add.graphics().setDepth(1);
    altar.fillStyle(DUNGEON_UI.SOOT, 0.96);
    altar.fillRoundedRect(CX - 64, 96, 128, 96, 46);
    altar.lineStyle(5, DUNGEON_UI.IRON, 0.92);
    altar.beginPath();
    altar.arc(CX, PORTAL_CY, 48, Math.PI, Math.PI * 2);
    altar.strokePath();
    altar.lineBetween(CX - 48, PORTAL_CY, CX - 48, 184);
    altar.lineBetween(CX + 48, PORTAL_CY, CX + 48, 184);
    altar.lineStyle(1, DUNGEON_UI.BRASS, 0.48);
    altar.lineBetween(CX - 58, 188, CX + 58, 188);

    this.portalGraphics = this.add.graphics().setDepth(3);
    this.runeGraphics   = this.add.graphics().setDepth(4);

    // Portal + floating runes — reduced-motion draws one stable frame.
    const drawPortalFrame = (t: number): void => {
      if (!this.portalGraphics.active) return;
      this.portalGraphics.clear();

      // Moonlight contracts glow inside the stone arch.
      const rings = [
        { r: 38, speed: 0.4, color: DUNGEON_UI.IRON, alpha: 0.72 },
        { r: 29, speed: 0.7, color: ZONE_ACCENTS.summon, alpha: 0.42 },
        { r: 19, speed: 1.1, color: DUNGEON_UI.BRASS_BRIGHT, alpha: 0.34 },
      ];
      for (const ring of rings) {
        const pulse = 1 + 0.035 * Math.sin(t * ring.speed * 2.5);
        this.portalGraphics.lineStyle(3, ring.color, ring.alpha * (0.8 + 0.2 * Math.sin(t * ring.speed)));
        this.portalGraphics.strokeCircle(CX, PORTAL_CY, ring.r * pulse);
      }

      for (let r = 16; r >= 4; r -= 3) {
        this.portalGraphics.fillStyle(ZONE_ACCENTS.summon, 0.028 * (18 - r));
        this.portalGraphics.fillCircle(CX, PORTAL_CY, r);
      }

      this.portalGraphics.lineStyle(1.5, DUNGEON_UI.BRASS_BRIGHT, 0.72);
      this.portalGraphics.beginPath();
      this.portalGraphics.moveTo(CX, PORTAL_CY - 8);
      this.portalGraphics.lineTo(CX + 8, PORTAL_CY);
      this.portalGraphics.lineTo(CX, PORTAL_CY + 8);
      this.portalGraphics.lineTo(CX - 8, PORTAL_CY);
      this.portalGraphics.closePath();
      this.portalGraphics.strokePath();
      this.portalGraphics.fillStyle(DUNGEON_UI.BRASS_BRIGHT, 0.66 + 0.12 * Math.sin(t * 3));
      this.portalGraphics.fillCircle(CX, PORTAL_CY, 3.5);

      // Eight triangular contract marks orbit the altar core.
      this.runeGraphics.clear();
      for (let i = 0; i < 8; i++) {
        const angle = (i / 8) * Math.PI * 2 + t * 0.6;
        const rx    = CX + Math.cos(angle) * 43;
        const ry    = PORTAL_CY + Math.sin(angle) * 28;
        const alpha = 0.3 + 0.18 * Math.sin(t * 1.5 + i);
        this.runeGraphics.fillStyle(ZONE_ACCENTS.summon, alpha);
        this.runeGraphics.fillTriangle(rx, ry - 3, rx + 3, ry + 3, rx - 3, ry + 3);
      }
    };
    if (getReducedMotion()) {
      drawPortalFrame(0);
    } else {
      this.time.addEvent({
        delay: 33,
        repeat: -1,
        callback: () => drawPortalFrame(this.time.now * 0.001),
      });
    }

    this.add.text(CX, PORTAL_CY + 53, '계약 핵', {
      fontFamily: 'sans-serif', fontSize: '10px', fontStyle: 'bold', color: DUNGEON_UI_CSS.BRASS,
      stroke: '#030504', strokeThickness: 2,
    }).setOrigin(0.5).setDepth(5);
  }

  // ─── Header ─────────────────────────────────────────────────────────────────

  private drawHeader(): void {
    addSceneHeader(this, {
      title: '소환 제단',
      titleCSS: DUNGEON_UI_CSS.BRASS,
      backLabel: '← 군단',
      onBack: () => this.scene.start(getContextualBackTarget('SummonScene')),
    });

    const gs = loadGameState();
    const resources = this.add.graphics().setDepth(9);
    resources.fillStyle(DUNGEON_UI.SOOT, 0.96);
    resources.fillRoundedRect(98, 54, 278, 31, 6);
    resources.lineStyle(1, DUNGEON_UI.EDGE, 0.72);
    resources.strokeRoundedRect(98, 54, 278, 31, 6);
    resources.lineBetween(237, 60, 237, 79);
    this.add.text(111, 69, `보석  ${gs.gems}`, {
      fontFamily: 'sans-serif', fontSize: '11px', fontStyle: 'bold', color: '#9fb7eb',
    }).setOrigin(0, 0.5).setDepth(10);
    this.add.text(251, 69, `영혼 결정  ${gs.soulCrystals}`, {
      fontFamily: 'sans-serif', fontSize: '11px', fontStyle: 'bold', color: DUNGEON_UI_CSS.JADE,
    }).setOrigin(0, 0.5).setDepth(10);
  }

  // ─── Tab bar ────────────────────────────────────────────────────────────────

  private activeTab: 'summon' | 'history' = 'summon';
  private tabBarContainer!: Phaser.GameObjects.Container;

  private drawTabBar(): void {
    const { container } = addTabBar(this, {
      tabs: [
        { id: 'summon',  label: '소환 계약', accent: ZONE_ACCENTS.summon },
        { id: 'history', label: '계약 기록', accent: DUNGEON_UI.BRASS },
      ],
      active:   this.activeTab,
      y:        TAB_Y,
      accent:   ZONE_ACCENTS.summon,
      height:   44,
      fontSize: '13px',
      depth:    8,
      onSelect: (id) => this.showTab(id as 'summon' | 'history'),
    });
    this.tabBarContainer = container;
  }

  private showTab(tab: 'summon' | 'history'): void {
    this.activeTab = tab;
    this.summonTabContainer.setVisible(tab === 'summon');
    this.historyTabContainer.setVisible(tab === 'history');

    // Rebuild tab bar to reflect new active state
    this.tabBarContainer.destroy();
    this.drawTabBar();
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
    const left = cx - CARD_W / 2;
    const frame = addFramedPanel(this, {
      x: left,
      y: cardTop,
      w: CARD_W,
      h: CARD_H,
      radius: 8,
      fillColor: DUNGEON_UI.STONE,
      borderColor: DUNGEON_UI.EDGE,
      borderAlpha: 0.86,
      accentColor: def.border,
      accentAlpha: 0.9,
      glowColor: def.border,
      glowOpacity: 0.025,
      shadowOpacity: 0.55,
    });
    c.add([frame.shadow, frame.panel, frame.glow]);

    const rates = RARITY_RATES[def.id];
    const highRate = (rates[3] ?? 0) + (rates[4] ?? 0);
    const today = new Date().toISOString().slice(0, 10);
    const friendReady = def.id === 'friendship' && gs.lastFriendSummon !== today;
    const balance = def.currency === 'gems' ? gs.gems
      : def.currency === 'soul' ? gs.soulCrystals
        : friendReady ? 1 : 0;
    const canPull = (cost: number): boolean => def.currency === 'fp' ? friendReady : balance >= cost;

    c.add(this.add.text(left + 13, cardTop + 18, def.name, {
      fontFamily: 'sans-serif', fontSize: '13px', fontStyle: 'bold', color: DUNGEON_UI_CSS.TEXT,
    }).setOrigin(0, 0.5));
    c.add(this.add.text(left + CARD_W - 12, cardTop + 18,
      def.id === 'friendship' ? '일반 · 고급' : `에픽+ ${highRate}%`, {
        fontFamily: 'sans-serif', fontSize: '10px', fontStyle: 'bold', color: def.accent,
      }).setOrigin(1, 0.5));

    const headerRule = this.add.graphics();
    headerRule.lineStyle(1, def.border, 0.35);
    headerRule.lineBetween(left + 12, cardTop + 35, left + CARD_W - 12, cardTop + 35);
    c.add(headerRule);

    this.drawSummonSigil(c, def.id, left + 37, cardTop + 67, def.border);

    const currencyIcon = def.currency === 'gems' ? '💎' : def.currency === 'soul' ? '💠' : '🤝';
    const costLabel = def.currency === 'fp'
      ? friendReady ? '오늘 무료 계약 가능' : '오늘 계약 완료'
      : def.cost10 !== null
        ? `${currencyIcon} ${def.cost1} / ${def.cost10}`
        : `${currencyIcon} ${def.cost1} · 미보유 우선`;
    c.add(this.add.text(left + 70, cardTop + 57, costLabel, {
      fontFamily: 'sans-serif', fontSize: '11px', fontStyle: 'bold',
      color: canPull(def.cost1) ? DUNGEON_UI_CSS.TEXT : DUNGEON_UI_CSS.EMBER,
    }).setOrigin(0, 0.5));
    c.add(this.add.text(left + 70, cardTop + 76, def.desc, {
      fontFamily: 'sans-serif', fontSize: '10px', color: DUNGEON_UI_CSS.MUTED,
    }).setOrigin(0, 0.5));

    if (def.hasPity) {
      const pityKey = def.id as 'normal' | 'special';
      const pity = gs.summonPity?.[pityKey] ?? { count: 0, guaranteed: def.id === 'normal' ? 50 : 80 };
      const pct = Phaser.Math.Clamp(pity.count / pity.guaranteed, 0, 1);
      const barX = left + 12;
      const barW = CARD_W - 24;
      const barY = cardTop + 94;
      const progress = this.add.graphics();
      progress.fillStyle(DUNGEON_UI.SOOT, 1);
      progress.fillRoundedRect(barX, barY, barW, 6, 3);
      progress.fillStyle(pct >= 0.75 ? DUNGEON_UI.BRASS_BRIGHT : def.border, 0.9);
      progress.fillRoundedRect(barX, barY, Math.max(2, barW * pct), 6, 3);
      progress.lineStyle(1, DUNGEON_UI.IRON, 1);
      progress.strokeRoundedRect(barX, barY, barW, 6, 3);
      c.add(progress);
      c.add(this.add.text(cx, cardTop + 108, `보장까지 ${pity.guaranteed - pity.count}회`, {
        fontFamily: 'sans-serif', fontSize: '10px', fontStyle: 'bold',
        color: pct >= 0.75 ? DUNGEON_UI_CSS.BRASS : DUNGEON_UI_CSS.MUTED,
      }).setOrigin(0.5));
    } else {
      c.add(this.add.text(cx, cardTop + 101,
        def.id === 'friendship' ? (friendReady ? '무료 계약 준비' : '자정에 다시 개방') : '새 계약 우선 탐색', {
          fontFamily: 'sans-serif', fontSize: '10px', fontStyle: 'bold',
          color: friendReady ? DUNGEON_UI_CSS.JADE : DUNGEON_UI_CSS.MUTED,
        }).setOrigin(0.5));
    }

    const btnY = cardTop + 119;
    if (def.cost10 !== null) {
      this.makeCardBtn(c, def, left + 10, btnY, 76, '1회', () => this.executePull(def.id, 1), canPull(def.cost1), false);
      this.makeCardBtn(c, def, left + 92, btnY, 76, '10회', () => this.executePull(def.id, 10), canPull(def.cost10), true);
    } else if (def.id === 'friendship') {
      this.makeFriendBtn(c, def, left + 10, btnY, CARD_W - 20, gs);
    } else {
      this.makeCardBtn(c, def, left + 10, btnY, CARD_W - 20, '영혼 계약', () => this.executePull(def.id, 1), canPull(def.cost1), true);
    }

    if (def.id !== 'friendship') {
      const footer = this.add.graphics();
      footer.fillStyle(DUNGEON_UI.SOOT, 0.8);
      footer.fillRoundedRect(left + 10, cardTop + 165, CARD_W - 20, 44, 4);
      c.add(footer);
      const rateT = this.add.text(cx, cardTop + 187, '확률 상세  ›', {
        fontFamily: 'sans-serif', fontSize: '11px', fontStyle: 'bold', color: def.accent,
      }).setOrigin(0.5);
      c.add(rateT);
      const rateZone = this.add.zone(cx, cardTop + 187, CARD_W - 20, 44)
        .setInteractive({ useHandCursor: true });
      rateZone.on('pointerdown', () => this.showRatesModal(def.id));
      c.add(rateZone);
    } else {
      c.add(this.add.text(cx, cardTop + 187, friendReady ? '매일 자정 갱신' : '다음 무료 계약 대기', {
        fontFamily: 'sans-serif', fontSize: '10px', color: DUNGEON_UI_CSS.MUTED,
      }).setOrigin(0.5));
    }
  }

  private drawSummonSigil(
    c: Phaser.GameObjects.Container,
    type: SummonType,
    x: number,
    y: number,
    accent: number,
  ): void {
    const sigil = this.add.graphics();
    sigil.fillStyle(DUNGEON_UI.SOOT, 1);
    sigil.fillCircle(x, y, 24);
    sigil.fillStyle(accent, 0.1);
    sigil.fillCircle(x, y, 20);
    sigil.lineStyle(1.5, accent, 0.82);
    sigil.strokeCircle(x, y, 23);
    sigil.strokeCircle(x, y, 15);
    if (type === 'normal') {
      sigil.beginPath();
      sigil.arc(x, y, 9, -0.8, 3.8);
      sigil.strokePath();
      sigil.fillCircle(x + 6, y - 6, 2.5);
    } else if (type === 'special') {
      sigil.lineBetween(x - 12, y, x + 12, y);
      sigil.lineBetween(x, y - 12, x, y + 12);
      sigil.lineBetween(x - 8, y - 8, x + 8, y + 8);
      sigil.lineBetween(x + 8, y - 8, x - 8, y + 8);
      sigil.fillCircle(x, y, 3);
    } else if (type === 'soul') {
      sigil.beginPath();
      sigil.moveTo(x, y - 13);
      sigil.lineTo(x + 10, y);
      sigil.lineTo(x, y + 13);
      sigil.lineTo(x - 10, y);
      sigil.closePath();
      sigil.strokePath();
      sigil.fillCircle(x, y, 3);
    } else {
      sigil.strokeCircle(x - 6, y, 7);
      sigil.strokeCircle(x + 6, y, 7);
      sigil.fillCircle(x, y, 2.5);
    }
    c.add(sigil);
  }

  private makeCardBtn(
    c: Phaser.GameObjects.Container,
    def: SummonTypeDef,
    x: number,
    y: number,
    w: number,
    label: string,
    cb: () => void,
    enabled: boolean,
    primary: boolean,
  ): void {
    const button = addPrimaryActionButton(this, {
      x,
      y,
      w,
      h: 44,
      label,
      fontSize: '11px',
      enabled,
      once: true,
      fillColor: primary ? def.border : DUNGEON_UI.SOOT,
      hoverFillColor: primary ? def.border : DUNGEON_UI.STONE_RAISED,
      borderColor: enabled ? def.border : DUNGEON_UI.IRON,
      hoverBorderColor: DUNGEON_UI.BRASS_BRIGHT,
      disabledFillColor: DUNGEON_UI.SOOT,
      disabledBorderColor: DUNGEON_UI.IRON,
      textColor: primary ? '#ffffff' : def.accent,
      disabledTextColor: DUNGEON_UI_CSS.MUTED,
      showArrow: false,
      onPress: cb,
    });
    c.add([button.bg, button.text, button.zone]);
  }

  private makeFriendBtn(
    c: Phaser.GameObjects.Container,
    def: SummonTypeDef,
    x: number,
    y: number,
    w: number,
    gs: ReturnType<typeof loadGameState>,
  ): void {
    const today = new Date().toISOString().slice(0, 10);
    const used  = gs.lastFriendSummon === today;

    if (used) {
      // Show countdown
      const now      = new Date();
      const midnight = new Date(now);
      midnight.setHours(24, 0, 0, 0);
      const secsLeft = Math.floor((midnight.getTime() - now.getTime()) / 1000);
      const hh = String(Math.floor(secsLeft / 3600)).padStart(2, '0');
      const mm = String(Math.floor((secsLeft % 3600) / 60)).padStart(2, '0');
      const ss = String(secsLeft % 60).padStart(2, '0');
      this.makeCardBtn(c, def, x, y, w, `${hh}:${mm}:${ss} 후`, () => {}, false, false);
    } else {
      this.makeCardBtn(c, def, x, y, w, '무료 계약', () => this.executePull('friendship', 1), true, true);
    }
  }

  // ─── Rates modal ────────────────────────────────────────────────────────────

  private showRatesModal(type: SummonType): void {
    const overlay = this.add.container(0, 0).setDepth(80);

    const dim = this.add.graphics();
    dim.fillStyle(DUNGEON_UI.VOID, 0.86);
    dim.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    overlay.add(dim);
    const closeOverlay = (): void => overlay.destroy(true);
    const blocker = this.add.zone(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)
      .setOrigin(0)
      .setInteractive();
    blocker.on('pointerdown', closeOverlay);
    overlay.add(blocker);

    const def = SUMMON_TYPE_DEFS.find(d => d.id === type)!;
    const showsBanner = Boolean(
      this.activeBanner && (this.activeBanner.validSummonTypes as string[]).includes(type),
    );
    const panelW = 300, panelH = showsBanner ? 360 : 310;
    const panelX = (CANVAS_WIDTH - panelW) / 2;
    const panelY = (CANVAS_HEIGHT - panelH) / 2;

    const frame = addFramedPanel(this, {
      x: panelX,
      y: panelY,
      w: panelW,
      h: panelH,
      radius: 9,
      fillColor: DUNGEON_UI.STONE,
      borderColor: def.border,
      borderAlpha: 0.86,
      accentColor: def.border,
      accentAlpha: 0.92,
      shadowOpacity: 0.72,
      shadowOffsetY: 5,
    });
    overlay.add([frame.shadow, frame.panel, frame.glow]);
    // Consume taps within the panel; only the surrounding dim or close action dismisses it.
    overlay.add(this.add.zone(panelX, panelY, panelW, panelH).setOrigin(0).setInteractive());

    overlay.add(this.add.text(CANVAS_WIDTH / 2, panelY + 27, `${def.name} · 확률 정보`, {
      fontFamily: 'sans-serif', fontSize: '18px', fontStyle: 'bold', color: def.accent,
      stroke: '#030504', strokeThickness: 2,
    }).setOrigin(0.5));

    const rates = RARITY_RATES[type];
    let rowY = panelY + 56;
    RARITIES.forEach((_rarity, idx) => {
      if (rates[idx] === 0) return;
      const row = this.add.graphics();
      row.fillStyle(DUNGEON_UI.SOOT, 0.72);
      row.fillRoundedRect(panelX + 18, rowY - 5, panelW - 36, 22, 4);
      row.fillStyle(RARITY_COLORS[idx], 0.8);
      row.fillRect(panelX + 18, rowY - 5, 3, 22);
      overlay.add(row);
      overlay.add(this.add.text(panelX + 30, rowY + 6, RARITY_STARS[idx], {
        fontFamily: 'sans-serif', fontSize: '10px',
      }).setOrigin(0, 0.5));
      overlay.add(this.add.text(panelX + 94, rowY + 6, RARITY_KO[idx], {
        fontFamily: 'sans-serif', fontSize: '11px', color: RARITY_CSS[idx], fontStyle: 'bold',
      }).setOrigin(0, 0.5));
      overlay.add(this.add.text(panelX + panelW - 28, rowY + 6, `${rates[idx]}%`, {
        fontFamily: 'sans-serif', fontSize: '11px', color: DUNGEON_UI_CSS.TEXT, fontStyle: 'bold',
      }).setOrigin(1, 0.5));
      rowY += 26;
    });

    if (def.hasPity) {
      overlay.add(this.add.text(CANVAS_WIDTH / 2, rowY + 9, `보장 계약 · ${def.id === 'normal' ? 50 : 80}회째 ${def.pityRarity}`, {
        fontFamily: 'sans-serif', fontSize: '10px', color: DUNGEON_UI_CSS.BRASS, fontStyle: 'bold',
      }).setOrigin(0.5));
      rowY += 30;
    }

    if (this.activeBanner && showsBanner) {
      const b = this.activeBanner;
      const divG = this.add.graphics();
      divG.lineStyle(1, b.borderColor, 0.4);
      divG.lineBetween(panelX + 20, rowY + 3, panelX + panelW - 20, rowY + 3);
      overlay.add(divG);

      overlay.add(this.add.text(CANVAS_WIDTH / 2, rowY + 17, `${b.name} · 피처드`, {
        fontFamily: 'sans-serif', fontSize: '10px', color: b.accentCss, fontStyle: 'bold',
      }).setOrigin(0.5));

      const boostPct = Math.round(b.rateMultiplier * 100);
      overlay.add(this.add.text(CANVAS_WIDTH / 2, rowY + 33, `${RARITY_KO[RARITIES.indexOf(b.boostedRarity)]} 획득 시 피처드 ${boostPct}%`, {
        fontFamily: 'sans-serif', fontSize: '10px', color: DUNGEON_UI_CSS.MUTED,
      }).setOrigin(0.5));

      const emojis = b.featuredMonsters.slice(0, 5).map(id => {
        const md = MONSTER_DEFS[id as keyof typeof MONSTER_DEFS];
        return md?.emoji ?? '👾';
      }).join(' ');
      overlay.add(this.add.text(CANVAS_WIDTH / 2, rowY + 51, emojis, {
        fontFamily: 'sans-serif', fontSize: '16px',
      }).setOrigin(0.5));
    }

    const close = addPrimaryActionButton(this, {
      x: panelX + 20,
      y: panelY + panelH - 58,
      w: panelW - 40,
      h: 44,
      label: '확률 정보 닫기',
      fontSize: '13px',
      fillColor: DUNGEON_UI.STONE_RAISED,
      hoverFillColor: DUNGEON_UI.IRON,
      borderColor: def.border,
      hoverBorderColor: DUNGEON_UI.BRASS_BRIGHT,
      textColor: DUNGEON_UI_CSS.TEXT,
      once: true,
      showArrow: false,
      onPress: closeOverlay,
    });
    overlay.add([close.bg, close.text, close.zone]);
  }

  // ─── History tab ─────────────────────────────────────────────────────────────

  private buildHistoryTabLocal(): void {
    const ctx: SummonHistoryContext = {
      historyFilter: this.historyFilter,
      onFilterChange: (filter: HistoryFilter) => {
        this.historyFilter = filter;
        const updatedCtx: SummonHistoryContext = {
          historyFilter: this.historyFilter,
          onFilterChange: ctx.onFilterChange,
        };
        rebuildHistory(this, this.historyTabContainer, updatedCtx);
      },
    };
    this.historyTabContainer = buildHistoryTab(this, ctx);
  }

  // ─── Execute pull ────────────────────────────────────────────────────────────

  private executePull(type: SummonType, count: number): void {
    if (this.pullInFlight) return;
    this.pullInFlight = true;
    const started = runPull(
      { scene: this, activeBanner: this.activeBanner, showToast: (msg) => this.showToast(msg) },
      type,
      count,
    );
    if (!started) this.pullInFlight = false;
  }

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
    const t = this.add.text(CX, CANVAS_HEIGHT - 72, msg, {
      fontFamily: 'sans-serif', fontSize: '12px', fontStyle: 'bold', color: DUNGEON_UI_CSS.TEXT,
      backgroundColor: '#080b09', padding: { x: 14, y: 9 },
    }).setOrigin(0.5).setDepth(200);
    if (getReducedMotion()) {
      this.time.delayedCall(1800, () => t.destroy());
    } else {
      this.tweens.add({ targets: t, alpha: 0, duration: 220, delay: 1800, onComplete: () => t.destroy() });
    }
  }
}
