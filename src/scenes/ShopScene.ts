import Phaser from 'phaser';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../constants/layout';
import { COLORS, CSS } from '../constants/colors';
import { loadGameState, saveGameState } from '../data/wisdom';
import { ACTIVE_SKILLS, EQUIPMENT_DEFS, type ActiveSkill, type Equipment } from '../data/barracks';
import { SKIN_DATA, MONSTER_DEFS, type MonsterSkin } from '../data/monsters';
import { ALL_THEMES, type DungeonTheme } from '../themes/themes';
import { addPanelShadow, addInnerGlow } from '../ui/PanelDepth';

// ─── Theme shop metadata ───────────────────────────────────────────────────────

interface ThemeListing {
  theme:   DungeonTheme;
  gemCost: number;   // 0 = free default
  emoji:   string;
  rarity:  'default' | 'rare' | 'epic' | 'legendary';
}

const THEME_LISTINGS: ThemeListing[] = [
  { theme: ALL_THEMES[0], gemCost: 0,   emoji: '🪨', rarity: 'default' },
  { theme: ALL_THEMES[1], gemCost: 150, emoji: '❄️', rarity: 'rare'    },
  { theme: ALL_THEMES[2], gemCost: 150, emoji: '🌋', rarity: 'rare'    },
  { theme: ALL_THEMES[3], gemCost: 300, emoji: '🌑', rarity: 'epic'    },
  { theme: ALL_THEMES[4], gemCost: 400, emoji: '✨', rarity: 'legendary' },
];

// ─── Daily rotation seeded by UTC day ─────────────────────────────────────────

function getDayIndex(): number {
  return Math.floor(Date.now() / 86_400_000);
}

function seededShuffle<T>(arr: T[], seed: number): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    seed = (seed * 1664525 + 1013904223) & 0xffffffff;
    const j = Math.abs(seed) % (i + 1);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function getDailyItems(): { skills: ActiveSkill[]; equipment: Equipment[] } {
  const day = getDayIndex();
  const skills    = seededShuffle(ACTIVE_SKILLS,  day).slice(0, 3);
  const equipment = seededShuffle(EQUIPMENT_DEFS, day + 7).slice(0, 3);
  return { skills, equipment };
}

// ─── Scene ────────────────────────────────────────────────────────────────────

type ShopTab = 'skin' | 'equipment' | 'skill' | 'theme';
type SkinFilter = 'all' | 'normal' | 'rare' | 'limited';

export class ShopScene extends Phaser.Scene {
  private activeTab:    ShopTab    = 'skin';
  private skinFilter:   SkinFilter = 'all';
  private contentCtr!:  Phaser.GameObjects.Container;
  private previewModal?: Phaser.GameObjects.Container;
  private gemsText!:    Phaser.GameObjects.Text;

  constructor() { super({ key: 'ShopScene' }); }

  create(): void {
    this.skinFilter = 'all';
    this.drawBackground();
    this.drawHeader();
    this.drawTabBar();
    this.buildContent();
  }

  // ─── Background ─────────────────────────────────────────────────────────────

  private drawBackground(): void {
    const g = this.add.graphics().setDepth(-10);
    g.fillStyle(0x050010, 1);
    g.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    g.lineStyle(1, 0x1a1a3a, 0.3);
    for (let y = 80; y < CANVAS_HEIGHT; y += 80) g.lineBetween(0, y, CANVAS_WIDTH, y);
    for (let i = 0; i < 30; i++) {
      const sx = Phaser.Math.Between(0, CANVAS_WIDTH);
      const sy = Phaser.Math.Between(0, CANVAS_HEIGHT);
      g.fillStyle(0xffffff, Math.random() * 0.15 + 0.05);
      g.fillCircle(sx, sy, Math.random() + 0.5);
    }
  }

  // ─── Header ─────────────────────────────────────────────────────────────────

  private drawHeader(): void {
    this.add.text(28, 24, '← 뒤로', {
      fontFamily: 'sans-serif', fontSize: '13px', color: CSS.PARCHMENT_MUTED,
      backgroundColor: '#2d2416', padding: { x: 8, y: 4 },
    }).setInteractive().setDepth(10)
      .on('pointerdown', () => this.scene.start('BarracksScene'));

    this.add.text(CANVAS_WIDTH / 2, 28, '🏪 상점', {
      fontFamily: 'Georgia, serif', fontSize: '20px', color: CSS.TORCH_AMBER,
    }).setOrigin(0.5).setDepth(10);

    const gs = loadGameState();
    this.gemsText = this.add.text(CANVAS_WIDTH / 2, 50, `💎 ${gs.gems} 젬`, {
      fontFamily: 'sans-serif', fontSize: '12px', color: '#88aaff',
    }).setOrigin(0.5).setDepth(10);

    // Daily refresh countdown — time until next UTC midnight
    const msUntilReset = 86_400_000 - (Date.now() % 86_400_000);
    const h = Math.floor(msUntilReset / 3_600_000);
    const m = Math.floor((msUntilReset % 3_600_000) / 60_000);
    const s = Math.floor((msUntilReset % 60_000) / 1000);
    const pad = (n: number) => String(n).padStart(2, '0');
    const timerText = this.add.text(CANVAS_WIDTH - 12, 52,
      `🔄 ${pad(h)}:${pad(m)}:${pad(s)}`, {
      fontFamily: 'monospace', fontSize: '10px', color: '#6688aa',
    }).setOrigin(1, 0.5).setDepth(10);

    // Live countdown tick
    let remaining = Math.floor(msUntilReset / 1000);
    const tick = this.time.addEvent({
      delay: 1000, loop: true, callback: () => {
        remaining = Math.max(0, remaining - 1);
        const th = Math.floor(remaining / 3600);
        const tm = Math.floor((remaining % 3600) / 60);
        const ts = remaining % 60;
        timerText.setText(`🔄 ${pad(th)}:${pad(tm)}:${pad(ts)}`);
      },
    });
    this.events.once('shutdown', () => tick.remove());
  }

  // ─── Tab bar ────────────────────────────────────────────────────────────────

  private drawTabBar(): void {
    const tabs: { id: ShopTab; label: string }[] = [
      { id: 'skin',      label: '🎨 스킨' },
      { id: 'theme',     label: '🏰 테마' },
      { id: 'equipment', label: '⚒️ 장비' },
      { id: 'skill',     label: '✨ 스킬' },
    ];
    const tabW = CANVAS_WIDTH / tabs.length;
    const tabY = 66;
    const g = this.add.graphics().setDepth(9);

    tabs.forEach(({ id, label }, i) => {
      const tx = i * tabW;
      const isActive = id === this.activeTab;

      g.fillStyle(isActive ? 0x1a1a3a : 0x0a0a18, 1);
      g.fillRect(tx, tabY, tabW, 28);
      g.lineStyle(1, isActive ? 0x8866ff : 0x2a2a4a, 0.8);
      if (isActive) {
        g.lineBetween(tx, tabY + 27, tx + tabW, tabY + 27);
      }

      this.add.text(tx + tabW / 2, tabY + 14, label, {
        fontFamily: 'Georgia, serif', fontSize: '11px',
        color: isActive ? '#cc88ff' : CSS.PARCHMENT_MUTED,
        fontStyle: isActive ? 'bold' : 'normal',
      }).setOrigin(0.5).setDepth(10);

      const zone = this.add.zone(tx + tabW / 2, tabY + 14, tabW, 28)
        .setInteractive().setDepth(11);
      zone.on('pointerdown', () => {
        if (this.activeTab !== id) {
          this.activeTab = id;
          this.scene.restart();
        }
      });
    });
  }

  // ─── Content dispatcher ─────────────────────────────────────────────────────

  private buildContent(): void {
    this.contentCtr?.destroy();
    this.contentCtr = this.add.container(0, 0).setDepth(5);

    if (this.activeTab === 'skin')      this.buildSkinTab();
    if (this.activeTab === 'theme')     this.buildThemeTab();
    if (this.activeTab === 'equipment') this.buildEquipmentTab();
    if (this.activeTab === 'skill')     this.buildSkillTab();
  }

  // ─── Skin tab ───────────────────────────────────────────────────────────────

  private buildSkinTab(): void {
    const gs = loadGameState();
    const TOP = 100;

    // Filter row
    const filters: { id: SkinFilter; label: string }[] = [
      { id: 'all',     label: '전체' },
      { id: 'normal',  label: '일반' },
      { id: 'rare',    label: '레어' },
      { id: 'limited', label: '한정' },
    ];
    const fW = CANVAS_WIDTH / filters.length;
    const fg = this.add.graphics();
    this.contentCtr.add(fg);

    filters.forEach(({ id, label }, i) => {
      const isActive = id === this.skinFilter;
      fg.fillStyle(isActive ? 0x220044 : 0x0a0010, 1);
      fg.fillRoundedRect(i * fW + 4, TOP, fW - 8, 26, 4);
      if (isActive) {
        fg.lineStyle(1, 0xaa44ff, 0.8);
        fg.strokeRoundedRect(i * fW + 4, TOP, fW - 8, 26, 4);
      }

      const ft = this.add.text(i * fW + fW / 2, TOP + 13, label, {
        fontFamily: 'sans-serif', fontSize: '11px',
        color: isActive ? '#dd88ff' : CSS.PARCHMENT_MUTED,
      }).setOrigin(0.5).setDepth(6);
      this.contentCtr.add(ft);

      const fz = this.add.zone(i * fW + fW / 2, TOP + 13, fW - 8, 26)
        .setInteractive().setDepth(7);
      this.contentCtr.add(fz);
      fz.on('pointerdown', () => {
        this.skinFilter = id;
        this.buildContent();
      });
    });

    // Skin cards grid (2 columns)
    const skins = SKIN_DATA.filter(s => this.skinFilter === 'all' || s.rarity === this.skinFilter);
    const COLS = 2;
    const CARD_W = (CANVAS_WIDTH - 24) / COLS;
    const CARD_H = 140;
    const START_Y = TOP + 34;

    skins.forEach((skin, idx) => {
      const col = idx % COLS;
      const row = Math.floor(idx / COLS);
      const cx  = 8 + col * (CARD_W + 8);
      const cy  = START_Y + row * (CARD_H + 8);
      this.drawSkinCard(skin, cx, cy, CARD_W, CARD_H, gs);
    });

    if (skins.length === 0) {
      const emptyT = this.add.text(CANVAS_WIDTH / 2, START_Y + 60, '해당 필터의 스킨이 없습니다.', {
        fontFamily: 'Georgia, serif', fontSize: '12px', color: CSS.PARCHMENT_MUTED,
      }).setOrigin(0.5).setDepth(6);
      this.contentCtr.add(emptyT);
    }
  }

  private drawSkinCard(
    skin: MonsterSkin,
    x: number, y: number, w: number, h: number,
    gs: ReturnType<typeof loadGameState>,
  ): void {
    const ownedList = gs.ownedSkins?.[skin.monsterId] ?? [];
    const isOwned   = ownedList.includes(skin.id);
    const equipped  = gs.equippedSkins?.[skin.monsterId] === skin.id;

    const rarityLabel = { normal: '일반', rare: '레어', limited: '한정' };
    const rarityStars = { normal: '⭐', rare: '⭐⭐⭐', limited: '⭐⭐⭐⭐⭐' };

    // Drop shadow behind card (adds depth)
    const shadow = addPanelShadow(this, x, y, w, h, 10, { offsetY: 3, opacity: 0.5 });
    this.contentCtr.add(shadow);

    // Card bg
    const g = this.add.graphics();
    g.fillStyle(isOwned ? 0x0a1a1a : 0x0d0d22, 1);
    g.fillRoundedRect(x, y, w, h, 10);
    g.lineStyle(1.5, isOwned ? 0x44aa88 : (skin.rarity === 'limited' ? 0xcc2222 : 0x4466aa), 0.7);
    g.strokeRoundedRect(x, y, w, h, 10);
    this.contentCtr.add(g);

    // Top inner glow (bevel highlight)
    const glowColor = skin.rarity === 'limited' ? 0xffaa88 : 0xaaccff;
    this.contentCtr.add(addInnerGlow(this, x, y, w, h, 10, glowColor, 0.14));

    // Limited banner
    if (skin.rarity === 'limited') {
      const badgeBg = this.add.graphics();
      badgeBg.fillStyle(0x880000, 1);
      badgeBg.fillRoundedRect(x + w - 44, y + 6, 38, 16, 4);
      this.contentCtr.add(badgeBg);
      this.contentCtr.add(this.add.text(x + w - 25, y + 14, '한정', {
        fontFamily: 'sans-serif', fontSize: '9px', color: '#ffaaaa',
      }).setOrigin(0.5).setDepth(6));
    }

    // Skin emoji (large)
    this.contentCtr.add(this.add.text(x + 36, y + h / 2 - 4, skin.emoji, {
      fontFamily: 'sans-serif', fontSize: '36px',
    }).setOrigin(0.5).setDepth(6));

    // Particle color dot
    const dotG = this.add.graphics();
    dotG.fillStyle(skin.particleColor, 0.9);
    dotG.fillCircle(x + 58, y + h / 2 + 20, 5);
    this.contentCtr.add(dotG);

    // Name
    this.contentCtr.add(this.add.text(x + 68, y + 12, skin.name, {
      fontFamily: 'Georgia, serif', fontSize: '12px', fontStyle: 'bold',
      color: isOwned ? '#88ddcc' : '#ffffff',
    }).setDepth(6));

    // Rarity + stars
    this.contentCtr.add(this.add.text(x + 68, y + 30, `${rarityStars[skin.rarity]}  ${rarityLabel[skin.rarity]}`, {
      fontFamily: 'sans-serif', fontSize: '10px', color: '#aaaacc',
    }).setDepth(6));

    // Monster name
    const mDef = MONSTER_DEFS[skin.monsterId];
    this.contentCtr.add(this.add.text(x + 68, y + 47, mDef ? mDef.name : skin.monsterId, {
      fontFamily: 'sans-serif', fontSize: '10px', color: CSS.PARCHMENT_MUTED,
    }).setDepth(6));

    if (isOwned) {
      // Owned: 보유중 badge + 장착/해제 button
      const owBadge = this.add.text(x + 68, y + 65, equipped ? '✓ 장착 중' : '보유 중', {
        fontFamily: 'sans-serif', fontSize: '10px',
        color: equipped ? '#44ffaa' : '#66aa66',
      }).setDepth(6);
      this.contentCtr.add(owBadge);

      // Equip / Unequip button
      const btnLabel = equipped ? '해제' : '장착';
      const btnColor = equipped ? 0x442200 : 0x002244;
      const btnBorderColor = equipped ? 0xcc6600 : 0x4488ff;
      const btnW2 = 56, btnH2 = 26;
      const bx = x + w - btnW2 - 8, by = y + h - btnH2 - 10;
      const bbg = this.add.graphics();
      bbg.fillStyle(btnColor, 1);
      bbg.fillRoundedRect(bx, by, btnW2, btnH2, 5);
      bbg.lineStyle(1, btnBorderColor, 0.8);
      bbg.strokeRoundedRect(bx, by, btnW2, btnH2, 5);
      this.contentCtr.add(bbg);
      this.contentCtr.add(this.add.text(bx + btnW2 / 2, by + btnH2 / 2, btnLabel, {
        fontFamily: 'sans-serif', fontSize: '11px',
        color: equipped ? '#ffaa44' : '#88bbff',
      }).setOrigin(0.5).setDepth(7));

      const zone = this.add.zone(bx + btnW2 / 2, by + btnH2 / 2, btnW2, btnH2)
        .setInteractive().setDepth(8);
      this.contentCtr.add(zone);
      zone.on('pointerdown', () => {
        const state = loadGameState();
        if (!state.equippedSkins) state.equippedSkins = {};
        if (equipped) {
          delete state.equippedSkins[skin.monsterId];
        } else {
          state.equippedSkins[skin.monsterId] = skin.id;
        }
        saveGameState(state);
        this.gemsText.setText(`💎 ${state.gems} 젬`);
        this.buildContent();
      });

      // Preview button
      const pbx = bx - 64, pby = by;
      const pbg = this.add.graphics();
      pbg.fillStyle(0x111133, 1);
      pbg.fillRoundedRect(pbx, pby, 56, 26, 5);
      pbg.lineStyle(1, 0x6644aa, 0.6);
      pbg.strokeRoundedRect(pbx, pby, 56, 26, 5);
      this.contentCtr.add(pbg);
      this.contentCtr.add(this.add.text(pbx + 28, pby + 13, '미리보기', {
        fontFamily: 'sans-serif', fontSize: '10px', color: '#9966cc',
      }).setOrigin(0.5).setDepth(7));
      const pz = this.add.zone(pbx + 28, pby + 13, 56, 26).setInteractive().setDepth(8);
      this.contentCtr.add(pz);
      pz.on('pointerdown', () => this.showPreviewModal(skin));

    } else {
      // Not owned: gem cost + buy button
      this.contentCtr.add(this.add.text(x + 68, y + 65, `💎 ${skin.gemCost} 젬`, {
        fontFamily: 'sans-serif', fontSize: '11px', color: '#cc88ff',
      }).setDepth(6));

      const btnW2 = 68, btnH2 = 26;
      const bx = x + w - btnW2 - 8, by = y + h - btnH2 - 10;

      // Preview button
      const pbx = bx - 64, pby = by;
      const pbg = this.add.graphics();
      pbg.fillStyle(0x111133, 1);
      pbg.fillRoundedRect(pbx, pby, 56, 26, 5);
      pbg.lineStyle(1, 0x6644aa, 0.6);
      pbg.strokeRoundedRect(pbx, pby, 56, 26, 5);
      this.contentCtr.add(pbg);
      this.contentCtr.add(this.add.text(pbx + 28, pby + 13, '미리보기', {
        fontFamily: 'sans-serif', fontSize: '10px', color: '#9966cc',
      }).setOrigin(0.5).setDepth(7));
      const pz = this.add.zone(pbx + 28, pby + 13, 56, 26).setInteractive().setDepth(8);
      this.contentCtr.add(pz);
      pz.on('pointerdown', () => this.showPreviewModal(skin));

      // Buy button
      const bbg = this.add.graphics();
      bbg.fillStyle(0x220044, 1);
      bbg.fillRoundedRect(bx, by, btnW2, btnH2, 5);
      bbg.lineStyle(1, 0xaa44ff, 0.8);
      bbg.strokeRoundedRect(bx, by, btnW2, btnH2, 5);
      this.contentCtr.add(bbg);
      this.contentCtr.add(this.add.text(bx + btnW2 / 2, by + btnH2 / 2, `💎 ${skin.gemCost} 구매`, {
        fontFamily: 'sans-serif', fontSize: '10px', color: '#cc88ff',
      }).setOrigin(0.5).setDepth(7));

      const zone = this.add.zone(bx + btnW2 / 2, by + btnH2 / 2, btnW2, btnH2)
        .setInteractive().setDepth(8);
      this.contentCtr.add(zone);
      zone.on('pointerdown', () => {
        const state = loadGameState();
        if ((state.gems ?? 0) < skin.gemCost) {
          this.showToast('젬 부족!');
          return;
        }
        state.gems -= skin.gemCost;
        if (!state.ownedSkins) state.ownedSkins = {};
        if (!state.ownedSkins[skin.monsterId]) state.ownedSkins[skin.monsterId] = [];
        if (!state.ownedSkins[skin.monsterId].includes(skin.id)) {
          state.ownedSkins[skin.monsterId].push(skin.id);
        }
        saveGameState(state);
        this.gemsText.setText(`💎 ${state.gems} 젬`);
        this.showPurchaseFlash(skin.gemCost, '💎', '#88aaff');
        this.showToast(`${skin.name} 구입 완료!`);
        this.buildContent();
      });
    }
  }

  // ─── Skin preview modal ─────────────────────────────────────────────────────

  private showPreviewModal(skin: MonsterSkin): void {
    this.previewModal?.destroy();

    const ov = this.add.container(0, 0).setDepth(200);
    this.previewModal = ov;

    const dim = this.add.graphics();
    dim.fillStyle(0x000000, 0.9);
    dim.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    ov.add(dim);

    const pw = 340, ph = 360;
    const px = (CANVAS_WIDTH - pw) / 2;
    const py = (CANVAS_HEIGHT - ph) / 2;

    const panel = this.add.graphics();
    panel.fillStyle(0x0d0d2a, 1);
    panel.fillRoundedRect(px, py, pw, ph, 14);
    panel.lineStyle(2, 0x8844ff, 0.9);
    panel.strokeRoundedRect(px, py, pw, ph, 14);
    ov.add(panel);

    ov.add(this.add.text(px + pw / 2, py + 16, '🎨 스킨 미리보기', {
      fontFamily: 'Georgia, serif', fontSize: '14px', fontStyle: 'bold',
      color: '#dd88ff',
    }).setOrigin(0.5));

    // Left: default
    const halfW = pw / 2 - 20;
    const defaultBg = this.add.graphics();
    defaultBg.fillStyle(0x1a1a1a, 1);
    defaultBg.fillRoundedRect(px + 10, py + 36, halfW, 180, 8);
    defaultBg.lineStyle(1, 0x333333, 0.6);
    defaultBg.strokeRoundedRect(px + 10, py + 36, halfW, 180, 8);
    ov.add(defaultBg);

    const mDef = MONSTER_DEFS[skin.monsterId];
    ov.add(this.add.text(px + 10 + halfW / 2, py + 36 + 90 - 16, mDef?.emoji ?? '?', {
      fontFamily: 'sans-serif', fontSize: '56px',
    }).setOrigin(0.5));
    ov.add(this.add.text(px + 10 + halfW / 2, py + 36 + 150, '기본', {
      fontFamily: 'Georgia, serif', fontSize: '10px', color: CSS.PARCHMENT_MUTED,
    }).setOrigin(0.5));

    // Right: skin
    const skinBg = this.add.graphics();
    skinBg.fillStyle(0x080820, 1);
    skinBg.fillRoundedRect(px + pw / 2 + 10, py + 36, halfW, 180, 8);
    skinBg.lineStyle(1.5, skin.particleColor, 0.8);
    skinBg.strokeRoundedRect(px + pw / 2 + 10, py + 36, halfW, 180, 8);
    ov.add(skinBg);

    ov.add(this.add.text(px + pw / 2 + 10 + halfW / 2, py + 36 + 90 - 16, skin.emoji, {
      fontFamily: 'sans-serif', fontSize: '56px',
    }).setOrigin(0.5));
    ov.add(this.add.text(px + pw / 2 + 10 + halfW / 2, py + 36 + 150, skin.name, {
      fontFamily: 'Georgia, serif', fontSize: '10px', color: '#dd88ff',
    }).setOrigin(0.5));

    // Particle color indicator
    const pcG = this.add.graphics();
    pcG.fillStyle(skin.particleColor, 0.9);
    for (let i = 0; i < 5; i++) {
      const px2 = px + pw / 2 + 10 + 10 + i * 18;
      const py2 = py + 36 + 160;
      pcG.fillCircle(px2, py2, 5 - i * 0.5);
    }
    ov.add(pcG);
    ov.add(this.add.text(px + pw / 2 + 10 + 8, py + 36 + 173, '파티클', {
      fontFamily: 'sans-serif', fontSize: '8px', color: '#888888',
    }));

    // Skin info
    ov.add(this.add.text(px + pw / 2, py + 230, skin.name, {
      fontFamily: 'Georgia, serif', fontSize: '13px', fontStyle: 'bold',
      color: '#ffffff',
    }).setOrigin(0.5));

    const rarityLabel = { normal: '일반', rare: '레어', limited: '한정' };
    ov.add(this.add.text(px + pw / 2, py + 250, `${rarityLabel[skin.rarity]} | 💎 ${skin.gemCost} 젬`, {
      fontFamily: 'sans-serif', fontSize: '11px', color: '#aaaacc',
    }).setOrigin(0.5));

    // Buttons
    const gs = loadGameState();
    const isOwned = (gs.ownedSkins?.[skin.monsterId] ?? []).includes(skin.id);

    // Close button
    const closeBg = this.add.graphics();
    closeBg.fillStyle(0x222222, 1);
    closeBg.fillRoundedRect(px + 16, py + ph - 52, 100, 36, 6);
    ov.add(closeBg);
    ov.add(this.add.text(px + 16 + 50, py + ph - 34, '닫기', {
      fontFamily: 'sans-serif', fontSize: '12px', color: CSS.PARCHMENT_MUTED,
    }).setOrigin(0.5));
    const closeZ = this.add.zone(px + 16 + 50, py + ph - 34, 100, 36).setInteractive();
    ov.add(closeZ);
    closeZ.on('pointerdown', () => { ov.destroy(); this.previewModal = undefined; });

    // Action button
    const actW = 180;
    const actBg = this.add.graphics();
    actBg.fillStyle(isOwned ? 0x004422 : 0x220044, 1);
    actBg.fillRoundedRect(px + pw - actW - 16, py + ph - 52, actW, 36, 6);
    actBg.lineStyle(1.5, isOwned ? 0x44aa66 : 0xaa44ff, 0.9);
    actBg.strokeRoundedRect(px + pw - actW - 16, py + ph - 52, actW, 36, 6);
    ov.add(actBg);
    const actLabel = isOwned ? '장착하기' : `💎 ${skin.gemCost} 구매`;
    ov.add(this.add.text(px + pw - 16 - actW / 2, py + ph - 34, actLabel, {
      fontFamily: 'sans-serif', fontSize: '12px',
      color: isOwned ? '#44ffaa' : '#cc88ff',
    }).setOrigin(0.5));
    const actZ = this.add.zone(px + pw - 16 - actW / 2, py + ph - 34, actW, 36).setInteractive();
    ov.add(actZ);
    actZ.on('pointerdown', () => {
      const state = loadGameState();
      if (isOwned) {
        if (!state.equippedSkins) state.equippedSkins = {};
        state.equippedSkins[skin.monsterId] = skin.id;
        saveGameState(state);
        ov.destroy();
        this.previewModal = undefined;
        this.buildContent();
        this.showToast(`${skin.name} 장착!`);
      } else {
        if ((state.gems ?? 0) < skin.gemCost) { this.showToast('젬 부족!'); return; }
        state.gems -= skin.gemCost;
        if (!state.ownedSkins) state.ownedSkins = {};
        if (!state.ownedSkins[skin.monsterId]) state.ownedSkins[skin.monsterId] = [];
        if (!state.ownedSkins[skin.monsterId].includes(skin.id)) state.ownedSkins[skin.monsterId].push(skin.id);
        state.equippedSkins = state.equippedSkins ?? {};
        state.equippedSkins[skin.monsterId] = skin.id;
        saveGameState(state);
        this.gemsText.setText(`💎 ${state.gems} 젬`);
        this.showPurchaseFlash(skin.gemCost, '💎', '#88aaff');
        ov.destroy();
        this.previewModal = undefined;
        this.buildContent();
        this.showToast(`${skin.name} 구입 및 장착!`);
      }
    });
  }

  // ─── Theme tab ──────────────────────────────────────────────────────────────

  private buildThemeTab(): void {
    const gs = loadGameState();
    if (!gs.ownedThemes) gs.ownedThemes = ['cave'];

    this.contentCtr.add(this.add.text(CANVAS_WIDTH / 2, 108, '🏰 던전 테마', {
      fontFamily: 'Georgia, serif', fontSize: '14px', fontStyle: 'bold',
      color: '#ffcc88',
    }).setOrigin(0.5).setDepth(6));
    this.contentCtr.add(this.add.text(CANVAS_WIDTH / 2, 128, '던전 전체 외관을 변경합니다', {
      fontFamily: 'sans-serif', fontSize: '10px', color: '#666688',
    }).setOrigin(0.5).setDepth(6));

    const CARD_H = 148;
    THEME_LISTINGS.forEach((listing, i) => {
      this.drawThemeCard(listing, 8, 144 + i * (CARD_H + 8), CANVAS_WIDTH - 16, CARD_H, gs);
    });
  }

  private drawThemeCard(
    listing: ThemeListing,
    x: number, y: number, w: number, h: number,
    gs: ReturnType<typeof loadGameState>,
  ): void {
    const { theme, gemCost, emoji, rarity } = listing;
    const owned    = rarity === 'default' || (gs.ownedThemes ?? []).includes(theme.id);
    const equipped = (gs.equippedTheme ?? 'cave') === theme.id;

    // Drop shadow (depth)
    this.contentCtr.add(addPanelShadow(this, x, y, w, h, 10, { offsetY: 3, opacity: 0.5 }));

    // Card bg — tinted with theme's primary color
    const g = this.add.graphics();
    g.fillStyle(theme.bgSecondary, 1);
    g.fillRoundedRect(x, y, w, h, 10);
    g.lineStyle(2, equipped ? theme.panelBorder : (owned ? 0x446644 : 0x334), equipped ? 1 : 0.7);
    g.strokeRoundedRect(x, y, w, h, 10);
    this.contentCtr.add(g);

    // Bevel glow (uses theme accent when equipped)
    this.contentCtr.add(addInnerGlow(this, x, y, w, h, 10, equipped ? theme.panelBorder : 0xaaccff, 0.14));

    // Equipped badge
    if (equipped) {
      const bdg = this.add.graphics();
      bdg.fillStyle(0x003300, 1);
      bdg.fillRoundedRect(x + w - 64, y + 6, 58, 18, 4);
      this.contentCtr.add(bdg);
      this.contentCtr.add(this.add.text(x + w - 35, y + 15, '✓ 장착 중', {
        fontFamily: 'sans-serif', fontSize: '9px', color: '#44ff88',
      }).setOrigin(0.5).setDepth(7));
    }

    // Rarity badge
    const RARITY_CONFIG: Record<string, { bg: number; label: string; color: string } | undefined> = {
      rare:      { bg: 0x002244, label: '레어',   color: '#88aaff' },
      epic:      { bg: 0x220044, label: '에픽',   color: '#cc88ff' },
      legendary: { bg: 0x221100, label: '전설',   color: '#ffd700' },
    };
    const rarityConfig = RARITY_CONFIG[rarity];
    if (rarityConfig) {
      const rdg = this.add.graphics();
      rdg.fillStyle(rarityConfig.bg, 1);
      rdg.fillRoundedRect(x + 6, y + 6, 38, 18, 4);
      this.contentCtr.add(rdg);
      this.contentCtr.add(this.add.text(x + 25, y + 15, rarityConfig.label, {
        fontFamily: 'sans-serif', fontSize: '9px', color: rarityConfig.color,
      }).setOrigin(0.5).setDepth(7));
    }

    // Theme emoji (large)
    this.contentCtr.add(this.add.text(x + 36, y + h / 2 - 4, emoji, {
      fontFamily: 'sans-serif', fontSize: '36px',
    }).setOrigin(0.5).setDepth(6));

    // Theme name + id
    this.contentCtr.add(this.add.text(x + 64, y + 16, theme.name, {
      fontFamily: 'Georgia, serif', fontSize: '15px', fontStyle: 'bold',
      color: theme.textPrimary,
    }).setDepth(6));

    // Color swatches row
    const swatchColors = [theme.bgPrimary, theme.panelBorder, theme.ambientColor, theme.slotBorder];
    swatchColors.forEach((col, si) => {
      const sg = this.add.graphics();
      sg.fillStyle(col, 1);
      sg.fillRoundedRect(x + 64 + si * 26, y + 40, 20, 20, 4);
      sg.lineStyle(1, 0x333333, 0.5);
      sg.strokeRoundedRect(x + 64 + si * 26, y + 40, 20, 20, 4);
      this.contentCtr.add(sg);
    });

    // Accent text
    this.contentCtr.add(this.add.text(x + 64, y + 68, theme.textAccent + ' 색상 테마', {
      fontFamily: 'sans-serif', fontSize: '10px', color: theme.textSecondary,
    }).setDepth(6));

    // Price or status
    if (owned) {
      this.contentCtr.add(this.add.text(x + 64, y + 86, rarity === 'default' ? '기본 테마' : '✅ 보유 중', {
        fontFamily: 'sans-serif', fontSize: '10px',
        color: rarity === 'default' ? theme.textSecondary : '#66cc66',
      }).setDepth(6));
    } else {
      this.contentCtr.add(this.add.text(x + 64, y + 86, `💎 ${gemCost} 젬`, {
        fontFamily: 'sans-serif', fontSize: '11px', color: '#cc88ff',
      }).setDepth(6));
    }

    // Action button
    const btnW = 80, btnH = 30;
    const bx = x + w - btnW - 10;
    const by = y + h - btnH - 10;

    const canEquip  = owned && !equipped;
    const canBuy    = !owned;  // if !owned, rarity is guaranteed to be 'rare'
    const isDefault = rarity === 'default' && equipped;

    if (isDefault) {
      // No button — already equipped default
      return;
    }

    const btnBg = this.add.graphics();
    if (equipped) {
      btnBg.fillStyle(0x442200, 1);
      btnBg.fillRoundedRect(bx, by, btnW, btnH, 6);
      btnBg.lineStyle(1.5, 0xcc6600, 0.8);
      btnBg.strokeRoundedRect(bx, by, btnW, btnH, 6);
    } else if (canEquip) {
      btnBg.fillStyle(theme.bgSecondary, 1);
      btnBg.fillRoundedRect(bx, by, btnW, btnH, 6);
      btnBg.lineStyle(1.5, theme.panelBorder, 0.9);
      btnBg.strokeRoundedRect(bx, by, btnW, btnH, 6);
    } else if (canBuy) {
      btnBg.fillStyle(0x220044, 1);
      btnBg.fillRoundedRect(bx, by, btnW, btnH, 6);
      btnBg.lineStyle(1.5, 0xaa44ff, 0.8);
      btnBg.strokeRoundedRect(bx, by, btnW, btnH, 6);
    }
    this.contentCtr.add(btnBg);

    const btnLabel = equipped ? '해제' : canEquip ? '장착' : `💎 ${gemCost}`;
    this.contentCtr.add(this.add.text(bx + btnW / 2, by + btnH / 2, btnLabel, {
      fontFamily: 'sans-serif', fontSize: '11px',
      color: equipped ? '#ffaa44' : canEquip ? theme.textAccent : '#cc88ff',
    }).setOrigin(0.5).setDepth(7));

    const zone = this.add.zone(bx + btnW / 2, by + btnH / 2, btnW, btnH)
      .setInteractive().setDepth(8);
    this.contentCtr.add(zone);

    zone.on('pointerdown', () => {
      const state = loadGameState();
      if (!state.ownedThemes) state.ownedThemes = ['cave'];

      if (equipped && rarity !== 'default') {
        // Unequip → revert to cave
        state.equippedTheme = 'cave';
        saveGameState(state);
        this.showToast('기본 동굴 테마로 변경');
        this.buildContent();
      } else if (canEquip) {
        state.equippedTheme = theme.id;
        saveGameState(state);
        this.showToast(`${theme.name} 테마 장착!`);
        this.buildContent();
      } else if (canBuy) {
        if ((state.gems ?? 0) < gemCost) { this.showToast('젬 부족!'); return; }
        state.gems -= gemCost;
        if (!state.ownedThemes.includes(theme.id)) state.ownedThemes.push(theme.id);
        state.equippedTheme = theme.id;
        saveGameState(state);
        this.gemsText.setText(`💎 ${state.gems} 젬`);
        this.showPurchaseFlash(gemCost, '💎', '#88aaff');
        this.showToast(`${theme.name} 테마 구입 및 장착!`);
        this.buildContent();
      }
    });
  }

  // ─── Equipment tab ──────────────────────────────────────────────────────────

  private buildEquipmentTab(): void {
    const gs = loadGameState();
    const { equipment } = getDailyItems();

    const titleT = this.add.text(CANVAS_WIDTH / 2, 104, '⚒️ 일일 장비', {
      fontFamily: 'Georgia, serif', fontSize: '14px', color: '#ffcc88',
    }).setOrigin(0.5).setDepth(6);
    this.contentCtr.add(titleT);

    const msUntilReset = 86_400_000 - (Date.now() % 86_400_000);
    const hh = Math.floor(msUntilReset / 3_600_000);
    const mm = Math.floor((msUntilReset % 3_600_000) / 60_000);
    this.contentCtr.add(this.add.text(CANVAS_WIDTH / 2, 124, `🕐 ${hh}시간 ${mm}분 후 재입고`, {
      fontFamily: 'sans-serif', fontSize: '10px', color: '#666688',
    }).setOrigin(0.5).setDepth(6));

    equipment.forEach((eq, i) => {
      const owned = gs.ownedEquipment.includes(eq.id);
      this.drawItemCard(
        CANVAS_WIDTH / 2, 180 + i * 104, eq.icon, eq.name, eq.desc,
        eq.goldCost, eq.gemCost, owned, 'equip',
        () => {
          const state = loadGameState();
          if (state.soulCrystals < eq.gemCost) { this.showToast('영혼 결정체 부족'); return; }
          state.soulCrystals -= eq.gemCost;
          if (!state.ownedEquipment.includes(eq.id)) state.ownedEquipment.push(eq.id);
          saveGameState(state);
          this.showToast(`${eq.name} 구입 완료!`);
          this.buildContent();
        },
      );
    });
  }

  // ─── Skill tab ──────────────────────────────────────────────────────────────

  private buildSkillTab(): void {
    const gs = loadGameState();
    const { skills } = getDailyItems();

    const titleT = this.add.text(CANVAS_WIDTH / 2, 104, '✨ 일일 스킬', {
      fontFamily: 'Georgia, serif', fontSize: '14px', color: '#aaffcc',
    }).setOrigin(0.5).setDepth(6);
    this.contentCtr.add(titleT);

    skills.forEach((sk, i) => {
      const owned = gs.ownedActiveSkills.includes(sk.id);
      this.drawItemCard(
        CANVAS_WIDTH / 2, 168 + i * 104, sk.icon, sk.name, sk.desc,
        sk.goldCost, sk.gemCost, owned, 'skill',
        () => {
          const state = loadGameState();
          if (state.soulCrystals < sk.gemCost) { this.showToast('영혼 결정체 부족'); return; }
          state.soulCrystals -= sk.gemCost;
          if (!state.ownedActiveSkills.includes(sk.id)) state.ownedActiveSkills.push(sk.id);
          saveGameState(state);
          this.showToast(`${sk.name} 습득!`);
          this.buildContent();
        },
      );
    });
  }

  // ─── Item card (equipment / skill) ──────────────────────────────────────────

  private drawItemCard(
    cx: number, cy: number,
    icon: string, name: string, desc: string,
    goldCost: number, gemCost: number,
    owned: boolean, _type: 'equip' | 'skill',
    onBuy: () => void,
  ): void {
    const w = 330, h = 88;
    const bg = this.add.graphics().setDepth(6);
    bg.fillStyle(owned ? 0x1a3a1a : 0x1a1a2e, 1);
    bg.fillRoundedRect(cx - w / 2, cy - h / 2, w, h, 10);
    bg.lineStyle(1.5, owned ? 0x44aa44 : COLORS.TORCH_GOLD, 0.5);
    bg.strokeRoundedRect(cx - w / 2, cy - h / 2, w, h, 10);
    this.contentCtr.add(bg);

    this.contentCtr.add(this.add.text(cx - w / 2 + 20, cy, icon, {
      fontFamily: 'sans-serif', fontSize: '28px',
    }).setOrigin(0.5).setDepth(7));

    this.contentCtr.add(this.add.text(cx - w / 2 + 46, cy - 22, name, {
      fontFamily: 'Georgia, serif', fontSize: '13px', fontStyle: 'bold',
      color: owned ? '#88dd88' : '#ffffff',
    }).setDepth(7));

    this.contentCtr.add(this.add.text(cx - w / 2 + 46, cy - 4, desc, {
      fontFamily: 'sans-serif', fontSize: '10px', color: '#aaaacc',
      wordWrap: { width: 180 },
    }).setDepth(7));

    if (owned) {
      this.contentCtr.add(this.add.text(cx + w / 2 - 12, cy, '✅ 보유 중', {
        fontFamily: 'sans-serif', fontSize: '10px', color: '#66cc66',
      }).setOrigin(1, 0.5).setDepth(7));
    } else {
      this.contentCtr.add(this.add.text(cx - w / 2 + 46, cy + 18, `💰${goldCost}  💎${gemCost}`, {
        fontFamily: 'sans-serif', fontSize: '10px', color: '#ccaa44',
      }).setDepth(7));

      const btnW = 72, btnH = 26;
      const btnX = cx + w / 2 - btnW - 8;
      const btnBg = this.add.graphics().setDepth(7);
      btnBg.fillStyle(0x220044, 1);
      btnBg.fillRoundedRect(btnX, cy - btnH / 2, btnW, btnH, 6);
      btnBg.lineStyle(1, 0xaa44ff, 0.8);
      btnBg.strokeRoundedRect(btnX, cy - btnH / 2, btnW, btnH, 6);
      this.contentCtr.add(btnBg);

      this.contentCtr.add(this.add.text(btnX + btnW / 2, cy, `💎 ${gemCost}`, {
        fontFamily: 'sans-serif', fontSize: '11px', color: '#cc88ff',
      }).setOrigin(0.5).setDepth(8));

      const zone = this.add.zone(btnX + btnW / 2, cy, btnW, btnH)
        .setInteractive().setDepth(9);
      this.contentCtr.add(zone);
      zone.on('pointerdown', onBuy);
    }
  }

  // ─── Purchase flash (cost float + currency pop) ────────────────────────────

  private showPurchaseFlash(cost: number, icon: string, color: string): void {
    // Float: "-N💎" rising above the currency text
    const f = this.add.text(CANVAS_WIDTH / 2, 68, `-${cost}${icon}`, {
      fontFamily: 'sans-serif', fontSize: '13px', fontStyle: 'bold',
      color, stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(250).setAlpha(0);
    this.tweens.add({
      targets: f, y: 92, alpha: { from: 1, to: 0 },
      duration: 900, ease: 'Cubic.easeOut',
      onComplete: () => f.destroy(),
    });

    // Currency text scale pop
    if (this.gemsText) {
      this.tweens.killTweensOf(this.gemsText);
      this.gemsText.setScale(1.3);
      this.tweens.add({
        targets: this.gemsText, scaleX: 1, scaleY: 1,
        duration: 260, ease: 'Back.easeIn',
      });
    }
  }

  // ─── Toast ──────────────────────────────────────────────────────────────────

  private showToast(msg: string): void {
    const t = this.add.text(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 50, msg, {
      fontFamily: 'sans-serif', fontSize: '14px', color: '#88ffaa',
      backgroundColor: '#002200', padding: { x: 14, y: 8 },
    }).setOrigin(0.5).setDepth(300);
    this.tweens.add({ targets: t, alpha: 0, duration: 500, delay: 1500, onComplete: () => t.destroy() });
  }
}
