import Phaser from 'phaser';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../constants/layout';
import { COLORS, CSS } from '../constants/colors';
import { loadGameState, type OwnedMonster } from '../data/wisdom';
import { MONSTER_DEFS, getSkinForMonster, type MonsterId } from '../data/monsters';
import {
  ACTIVE_SKILLS, EQUIPMENT_DEFS,
  xpToNextLevel, getMonsterAtk,
} from '../data/barracks';
import { generatePortrait } from '../art/PortraitGenerator';
import { addPanelShadow, addInnerGlow } from '../ui/PanelDepth';
import { showMonsterDetailPanel, showSkillShopPanel } from '../ui/MonsterDetailPanel';

const CARD_W  = 162;
const CARD_H  = 210;
const CARD_PAD = 10;
const CARD_START_X = 14;
const CARD_START_Y = 100;

export class BarracksScene extends Phaser.Scene {
  private gs = loadGameState();
  private scrollY    = 0;
  private maxScrollY = 0;
  private contentContainer!: Phaser.GameObjects.Container;
  private detailOverlay?: Phaser.GameObjects.Container;
  private shopOverlay?:   Phaser.GameObjects.Container;
  private sortKey: 'level' | 'atk' | 'rarity' = 'level';
  private sortChips: Phaser.GameObjects.GameObject[] = [];
  private filterType: 'all' | 'melee' | 'ranged' | 'magic' | 'support' = 'all';
  private filterChips: Phaser.GameObjects.GameObject[] = [];

  constructor() { super({ key: 'BarracksScene' }); }

  create(): void {
    this.gs = loadGameState();
    this.scrollY = 0;

    this.drawBackground();
    this.drawHeader();
    this.buildSortChips();
    this.buildFilterChips();
    this.buildContent();
    this.buildBottomNav();
    this.setupScroll();
  }

  // ─── Background ──────────────────────────────────────────────────────────────

  private drawBackground(): void {
    const g = this.add.graphics().setDepth(-10);
    g.fillStyle(COLORS.BLACK, 1);
    g.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    // Stone tile grid
    for (let x = 0; x < CANVAS_WIDTH; x += 36)
      for (let y = 0; y < CANVAS_HEIGHT; y += 36) {
        g.lineStyle(0.3, COLORS.STONE_MID, 0.2);
        g.strokeRect(x, y, 36, 36);
      }
    // Top accent bar
    g.fillStyle(COLORS.STONE_DARK, 1);
    g.fillRect(0, 0, CANVAS_WIDTH, 88);
    g.lineStyle(2, COLORS.TORCH_GOLD, 0.6);
    g.lineBetween(0, 88, CANVAS_WIDTH, 88);
  }

  private drawHeader(): void {
    this.add.text(CANVAS_WIDTH / 2, 24, '⚔️ 몬스터 막사', {
      fontFamily: 'Georgia, serif', fontSize: '22px', fontStyle: 'bold',
      color: CSS.TORCH_AMBER,
    }).setOrigin(0.5).setDepth(10);

    const power = this.gs.ownedMonsters.reduce((s, m) => {
      const def = MONSTER_DEFS[m.id as keyof typeof MONSTER_DEFS];
      return s + getMonsterAtk(def?.baseDamage ?? 10, m.level, m.spentSkills);
    }, 0);

    this.add.text(CANVAS_WIDTH / 2, 52, `전투력: ${power}`, {
      fontFamily: 'sans-serif', fontSize: '13px', color: CSS.PARCHMENT_MUTED,
    }).setOrigin(0.5).setDepth(10);

    this.add.text(CANVAS_WIDTH / 2, 70, `몬스터 ${this.gs.ownedMonsters.length}체 보유`, {
      fontFamily: 'sans-serif', fontSize: '11px', color: CSS.PARCHMENT_MUTED,
    }).setOrigin(0.5).setDepth(10);

    // Back button
    this.buildBtn(24, 24, '← 뒤로', 0x2d2416, () => this.scene.start('DungeonHomeScene'));
  }

  // ─── Sort chips ───────────────────────────────────────────────────────────────

  private buildSortChips(): void {
    const KEYS: Array<{ key: 'level' | 'atk' | 'rarity'; label: string }> = [
      { key: 'level',  label: '레벨 ↓' },
      { key: 'atk',    label: '공격력' },
      { key: 'rarity', label: '희귀도' },
    ];
    const chipW = 88, chipH = 22, chipGap = 10;
    const totalW = KEYS.length * chipW + (KEYS.length - 1) * chipGap;
    const startX = (CANVAS_WIDTH - totalW) / 2;
    const chipY = 91;

    // Destroy previous chips
    this.sortChips.forEach(c => c.destroy());
    this.sortChips = [];

    KEYS.forEach(({ key, label }, i) => {
      const cx = startX + i * (chipW + chipGap);
      const isActive = this.sortKey === key;

      const bg = this.add.graphics().setDepth(11);
      bg.fillStyle(isActive ? COLORS.TORCH_GOLD : COLORS.STONE_DARK, 1);
      bg.fillRoundedRect(cx, chipY, chipW, chipH, 4);
      bg.lineStyle(1, isActive ? COLORS.TORCH_GOLD : COLORS.STONE_MID, isActive ? 1 : 0.5);
      bg.strokeRoundedRect(cx, chipY, chipW, chipH, 4);

      const t = this.add.text(cx + chipW / 2, chipY + chipH / 2, label, {
        fontFamily: 'sans-serif', fontSize: '11px', fontStyle: isActive ? 'bold' : 'normal',
        color: isActive ? '#1a0800' : CSS.PARCHMENT_MUTED,
      }).setOrigin(0.5).setDepth(12);

      const hitArea = this.add.rectangle(cx + chipW / 2, chipY + chipH / 2, chipW, chipH)
        .setDepth(13).setInteractive({ useHandCursor: true }).setAlpha(0.001);
      hitArea.on('pointerdown', () => {
        if (this.sortKey === key) return;
        this.sortKey = key;
        this.buildSortChips();
        this.buildContent();
        this.scrollY = 0;
        this.contentContainer.setY(0);
      });

      this.sortChips.push(bg, t, hitArea);
    });
  }

  // ─── Type filter chips ────────────────────────────────────────────────────────

  private buildFilterChips(): void {
    this.filterChips.forEach(c => (c as Phaser.GameObjects.GameObject).destroy());
    this.filterChips = [];

    const TYPES: Array<{ key: 'all' | 'melee' | 'ranged' | 'magic' | 'support'; label: string }> = [
      { key: 'all',     label: '전체' },
      { key: 'melee',   label: '⚔근접' },
      { key: 'ranged',  label: '🏹원거리' },
      { key: 'magic',   label: '✨마법' },
      { key: 'support', label: '💚지원' },
    ];
    const chipW = 66, chipH = 20, chipGap = 4;
    const totalW = TYPES.length * chipW + (TYPES.length - 1) * chipGap;
    const startX = (CANVAS_WIDTH - totalW) / 2;
    const chipY  = 117;

    TYPES.forEach(({ key, label }, i) => {
      const cx      = startX + i * (chipW + chipGap);
      const isActive = this.filterType === key;

      const bg = this.add.graphics().setDepth(11);
      bg.fillStyle(isActive ? 0x334466 : COLORS.STONE_DARK, 1);
      bg.fillRoundedRect(cx, chipY, chipW, chipH, 3);
      bg.lineStyle(1, isActive ? 0x6688cc : COLORS.STONE_MID, isActive ? 0.9 : 0.4);
      bg.strokeRoundedRect(cx, chipY, chipW, chipH, 3);

      const t = this.add.text(cx + chipW / 2, chipY + chipH / 2, label, {
        fontFamily: 'sans-serif', fontSize: '10px',
        color: isActive ? '#aaccff' : CSS.PARCHMENT_MUTED,
      }).setOrigin(0.5).setDepth(12);

      const hit = this.add.rectangle(cx + chipW / 2, chipY + chipH / 2, chipW, chipH)
        .setDepth(13).setInteractive({ useHandCursor: true }).setAlpha(0.001);
      hit.on('pointerdown', () => {
        if (this.filterType === key) return;
        this.filterType = key;
        this.buildFilterChips();
        this.buildContent();
        this.scrollY = 0;
        this.contentContainer.setY(0);
      });

      this.filterChips.push(bg, t, hit);
    });
  }

  // ─── Scrollable card grid ─────────────────────────────────────────────────────

  private buildContent(): void {
    this.contentContainer?.destroy();
    this.contentContainer = this.add.container(0, 0).setDepth(5);

    const sorted = [...this.gs.ownedMonsters]
      .filter(m => {
        if (this.filterType === 'all') return true;
        const def = MONSTER_DEFS[m.id as keyof typeof MONSTER_DEFS];
        return def?.type === this.filterType;
      })
      .sort((a, b) => {
        if (this.sortKey === 'level') return b.level - a.level;
        if (this.sortKey === 'rarity') return (b.rarity ?? 0) - (a.rarity ?? 0);
        const defA = MONSTER_DEFS[a.id as keyof typeof MONSTER_DEFS];
        const defB = MONSTER_DEFS[b.id as keyof typeof MONSTER_DEFS];
        return getMonsterAtk(defB?.baseDamage ?? 10, b.level, b.spentSkills)
             - getMonsterAtk(defA?.baseDamage ?? 10, a.level, a.spentSkills);
      });
    const cols = 2;
    const cardY0 = CARD_START_Y + 52; // extra 32px for filter chip row

    sorted.forEach((m, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x   = CARD_START_X + col * (CARD_W + CARD_PAD);
      const y   = cardY0 + row * (CARD_H + CARD_PAD);
      this.buildMonsterCard(m, x, y);
    });

    // "소환" empty slot at the end
    const nextIdx = sorted.length;
    const col = nextIdx % cols;
    const row = Math.floor(nextIdx / cols);
    const x   = CARD_START_X + col * (CARD_W + CARD_PAD);
    const y   = cardY0 + row * (CARD_H + CARD_PAD);
    this.buildSummonSlot(x, y);

    const rows = Math.ceil((sorted.length + 1) / cols);
    this.maxScrollY = Math.max(0, cardY0 + rows * (CARD_H + CARD_PAD) + 20 - (CANVAS_HEIGHT - 80));
  }

  private buildMonsterCard(m: OwnedMonster, x: number, y: number): void {
    const def = MONSTER_DEFS[m.id as keyof typeof MONSTER_DEFS];
    if (!def) return;

    // Card background — border color by rarity
    const rarityColors: number[] = [0x555555, 0x44aa44, 0x4488ff, 0xaa44ff, 0xffcc00];
    const rarityAlphas: number[] = [0.6,      0.85,    0.9,     0.9,     1.0   ];
    const rarity = m.rarity ?? 0;
    const borderColor = rarityColors[rarity] ?? rarityColors[0];
    const borderAlpha = rarityAlphas[rarity] ?? rarityAlphas[0];
    // Drop shadow beneath the card
    this.contentContainer.add(
      addPanelShadow(this, x, y, CARD_W, CARD_H, 10, { offsetY: 3, opacity: 0.55 }),
    );
    const bg = this.add.graphics();
    bg.fillStyle(rarity >= 3 ? 0x1a0d2e : COLORS.STONE_DARK, 1);
    bg.fillRoundedRect(x, y, CARD_W, CARD_H, 10);
    bg.lineStyle(rarity >= 4 ? 2.5 : 2, borderColor, borderAlpha);
    bg.strokeRoundedRect(x, y, CARD_W, CARD_H, 10);
    // Legendary: extra inner glow ring
    if (rarity >= 4) {
      bg.lineStyle(1, borderColor, 0.3);
      bg.strokeRoundedRect(x + 3, y + 3, CARD_W - 6, CARD_H - 6, 8);
    }
    this.contentContainer.add(bg);
    // Top bevel highlight (tinted to rarity color)
    this.contentContainer.add(
      addInnerGlow(this, x, y, CARD_W, CARD_H, 10, borderColor, rarity >= 3 ? 0.18 : 0.12),
    );

    // Monster portrait / emoji — apply skin if equipped
    const cardSkin = getSkinForMonster(m.id, this.gs.equippedSkins ?? {});
    const cardPortraitKey = generatePortrait(this, m.id as MonsterId, cardSkin?.id);
    if (this.textures.exists(cardPortraitKey)) {
      const cardPortrait = this.add.image(x + CARD_W / 2, y + 34, cardPortraitKey)
        .setOrigin(0.5).setDisplaySize(36, 36);
      this.contentContainer.add(cardPortrait);
    } else {
      const emoji = this.add.text(x + CARD_W / 2, y + 34, cardSkin ? cardSkin.emoji : def.emoji, {
        fontFamily: 'sans-serif', fontSize: '36px',
      }).setOrigin(0.5);
      this.contentContainer.add(emoji);
    }

    // Level badge
    const lvBg = this.add.graphics();
    lvBg.fillStyle(COLORS.STONE_MID, 1);
    lvBg.fillRoundedRect(x + CARD_W - 38, y + 6, 32, 18, 4);
    this.contentContainer.add(lvBg);
    const lvT = this.add.text(x + CARD_W - 22, y + 15, `Lv.${m.level}`, {
      fontFamily: 'sans-serif', fontSize: '10px', fontStyle: 'bold', color: CSS.TORCH_AMBER,
    }).setOrigin(0.5);
    this.contentContainer.add(lvT);

    // Name
    const nameT = this.add.text(x + CARD_W / 2, y + 70, def.name, {
      fontFamily: 'Georgia, serif', fontSize: '12px', color: CSS.PARCHMENT,
    }).setOrigin(0.5);
    this.contentContainer.add(nameT);

    // ATK stat
    const atk = getMonsterAtk(def.baseDamage, m.level, m.spentSkills);
    const atkT = this.add.text(x + CARD_W / 2, y + 88, `⚔️ ATK: ${atk}`, {
      fontFamily: 'sans-serif', fontSize: '11px', color: '#ff9944',
    }).setOrigin(0.5);
    this.contentContainer.add(atkT);

    // XP bar
    const xpNeeded = xpToNextLevel(m.level);
    const xpPct    = m.level >= 50 ? 1 : Math.min(1, m.xp / xpNeeded);
    const barW = CARD_W - 20;
    const barBg = this.add.graphics();
    barBg.fillStyle(0x1a1a1a, 1);
    barBg.fillRoundedRect(x + 10, y + 104, barW, 8, 3);
    barBg.fillStyle(0x44aa44, 1);
    barBg.fillRoundedRect(x + 10, y + 104, Math.round(barW * xpPct), 8, 3);
    this.contentContainer.add(barBg);

    const xpT = this.add.text(x + CARD_W / 2, y + 108, m.level >= 50 ? 'MAX' : `${m.xp}/${xpNeeded}`, {
      fontFamily: 'sans-serif', fontSize: '11px', color: '#88cc88',
    }).setOrigin(0.5);
    this.contentContainer.add(xpT);

    // Skill chips
    const skillsText = m.equippedSkills.length > 0
      ? m.equippedSkills.map(sk => ACTIVE_SKILLS.find(s => s.id === sk)?.icon ?? '?').join(' ')
      : '스킬 없음';
    const skillT = this.add.text(x + CARD_W / 2, y + 128, skillsText, {
      fontFamily: 'sans-serif', fontSize: '11px', color: '#aaaaff',
    }).setOrigin(0.5);
    this.contentContainer.add(skillT);

    // Equipment slot
    const eqId  = m.equipment;
    const eqDef = eqId ? EQUIPMENT_DEFS.find(e => e.id === eqId) : null;
    const eqBg  = this.add.graphics();
    eqBg.fillStyle(eqDef ? 0x3a2800 : 0x1a1a1a, 1);
    eqBg.fillRoundedRect(x + CARD_W / 2 - 30, y + 144, 60, 24, 6);
    eqBg.lineStyle(1.5, eqDef ? COLORS.TORCH_GOLD : 0x444444, 0.7);
    eqBg.strokeRoundedRect(x + CARD_W / 2 - 30, y + 144, 60, 24, 6);
    this.contentContainer.add(eqBg);
    const eqT = this.add.text(x + CARD_W / 2, y + 156, eqDef ? `${eqDef.icon} ${eqDef.name}` : '장비 없음', {
      fontFamily: 'sans-serif', fontSize: '9px', color: eqDef ? CSS.TORCH_AMBER : '#666666',
    }).setOrigin(0.5);
    this.contentContainer.add(eqT);

    // No-skill warning badge — orange "!" dot top-left
    if (m.equippedSkills.length === 0) {
      const nb = this.add.graphics();
      nb.fillStyle(0xff8800, 1);
      nb.fillCircle(x + 13, y + 13, 9);
      this.contentContainer.add(nb);
      const nt = this.add.text(x + 13, y + 13, '!', {
        fontFamily: 'sans-serif', fontSize: '11px', fontStyle: 'bold', color: '#000000',
      }).setOrigin(0.5);
      this.contentContainer.add(nt);
    }

    // Deployed badge — 🏰 bottom-right if monster is in an active dungeon slot
    const deployedIds = new Set(
      this.gs.dungeonSlots.flatMap(slot => slot.monsterIds.filter(Boolean) as string[])
    );
    if (deployedIds.has(m.id)) {
      const db = this.add.graphics();
      db.fillStyle(0x224488, 0.9);
      db.fillRoundedRect(x + CARD_W - 26, y + CARD_H - 22, 22, 18, 4);
      this.contentContainer.add(db);
      const dt = this.add.text(x + CARD_W - 15, y + CARD_H - 13, '🏰', {
        fontFamily: 'sans-serif', fontSize: '10px',
      }).setOrigin(0.5);
      this.contentContainer.add(dt);
    }

    // ATK quick-stat badge — bottom-right corner
    const atkBadge = this.add.text(x + CARD_W - 4, y + CARD_H - 4, `⚔${atk}`, {
      fontFamily: 'sans-serif', fontSize: '9px', color: '#cc8844',
    }).setOrigin(1, 1);
    this.contentContainer.add(atkBadge);

    // SP quick-stat badge — top-right corner (red circle, only when unspent SP > 0)
    const sp = m.skillPoints ?? 0;
    if (sp > 0) {
      const spBadgeBg = this.add.graphics();
      spBadgeBg.fillStyle(0xdd2222, 1);
      spBadgeBg.fillCircle(x + CARD_W - 5, y + 5, 7);
      this.contentContainer.add(spBadgeBg);
      const spBadgeT = this.add.text(x + CARD_W - 5, y + 5, String(sp > 9 ? '9+' : sp), {
        fontFamily: 'sans-serif', fontSize: '8px', color: '#ffffff',
      }).setOrigin(0.5);
      this.contentContainer.add(spBadgeT);
    }

    // SP upgrade hint — pulsing chip when unspent skill points exist
    if (sp > 0) {
      const spHint = this.add.text(x + CARD_W / 2, y + CARD_H - 24, `⬆ SP ×${sp} 사용가능`, {
        fontFamily: 'sans-serif', fontSize: '8px', color: '#cc88ff',
        backgroundColor: '#1a0028', padding: { x: 4, y: 2 },
      }).setOrigin(0.5);
      this.tweens.add({
        targets: spHint, alpha: { from: 0.45, to: 1.0 },
        duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
      });
      this.contentContainer.add(spHint);
    }

    // Tap zone
    const zone = this.add.zone(x + CARD_W / 2, y + CARD_H / 2, CARD_W, CARD_H).setInteractive();
    zone.on('pointerdown', () => this.showMonsterDetail(m));
    this.contentContainer.add(zone);
  }

  private buildSummonSlot(x: number, y: number): void {
    const bg = this.add.graphics();
    bg.lineStyle(2, COLORS.TORCH_GOLD, 0.4);
    bg.strokeRoundedRect(x, y, CARD_W, CARD_H, 10);
    bg.fillStyle(0x1a1000, 0.5);
    bg.fillRoundedRect(x, y, CARD_W, CARD_H, 10);
    this.contentContainer.add(bg);

    const t = this.add.text(x + CARD_W / 2, y + CARD_H / 2 - 16, '✨', {
      fontFamily: 'sans-serif', fontSize: '32px',
    }).setOrigin(0.5);
    this.contentContainer.add(t);

    const label = this.add.text(x + CARD_W / 2, y + CARD_H / 2 + 18, '새 몬스터 소환', {
      fontFamily: 'sans-serif', fontSize: '11px', color: CSS.TORCH_AMBER,
    }).setOrigin(0.5);
    this.contentContainer.add(label);

    const zone = this.add.zone(x + CARD_W / 2, y + CARD_H / 2, CARD_W, CARD_H).setInteractive();
    zone.on('pointerdown', () => this.scene.start('SummonScene'));
    this.contentContainer.add(zone);
  }

  // ─── Monster Detail Overlay ───────────────────────────────────────────────────

  private showMonsterDetail(m: OwnedMonster): void {
    this.detailOverlay?.destroy();
    this.detailOverlay = showMonsterDetailPanel(
      {
        scene: this,
        onClose: () => { this.detailOverlay = undefined; },
        onRefresh: (updated) => { this.detailOverlay = undefined; this.showMonsterDetail(updated); },
      },
      m,
    );
  }

  // ─── Bottom Nav ───────────────────────────────────────────────────────────────

  private buildBottomNav(): void {
    const navBg = this.add.graphics().setDepth(20);
    navBg.fillStyle(COLORS.STONE_DARK, 1);
    navBg.fillRect(0, CANVAS_HEIGHT - 72, CANVAS_WIDTH, 72);
    navBg.lineStyle(1, COLORS.TORCH_GOLD, 0.4);
    navBg.lineBetween(0, CANVAS_HEIGHT - 72, CANVAS_WIDTH, CANVAS_HEIGHT - 72);

    const btnW = (CANVAS_WIDTH - 28) / 5;
    const btnDefs = [
      { label: '⚔️ 막사',  active: true,  action: () => { /* already here */ } },
      { label: '📖 도감',  active: false, action: () => { this.registry.set('previousScene', 'BarracksScene'); this.scene.start('CodexScene'); } },
      { label: '✨ 소환',  active: false, action: () => this.scene.start('SummonScene') },
      { label: '🛒 스킬',  active: false, action: () => this.showSkillShop() },
      { label: '🏪 상점',  active: false, action: () => this.scene.start('ShopScene') },
    ];

    btnDefs.forEach(({ label, active, action }, i) => {
      const bx = 12 + i * (btnW + 4);
      const by = CANVAS_HEIGHT - 56;
      const bg = this.add.graphics().setDepth(21);
      bg.fillStyle(active ? 0x3a2800 : 0x1a1a1a, 1);
      bg.fillRoundedRect(bx, by, btnW, 44, 6);
      this.add.text(bx + btnW / 2, by + 22, label, {
        fontFamily: 'sans-serif', fontSize: '11px',
        color: active ? CSS.TORCH_AMBER : CSS.PARCHMENT_MUTED,
      }).setOrigin(0.5).setDepth(22);
      const zone = this.add.zone(bx + btnW / 2, by + 22, btnW, 44).setInteractive().setDepth(23);
      zone.on('pointerdown', action);
    });
  }

  // ─── Skill Shop Overlay ───────────────────────────────────────────────────────

  private showSkillShop(): void {
    this.shopOverlay?.destroy();
    this.shopOverlay = showSkillShopPanel(
      this,
      () => { this.shopOverlay = undefined; },
      () => { this.shopOverlay = undefined; this.showSkillShop(); },
    );
  }

  // ─── Scroll ───────────────────────────────────────────────────────────────────

  private setupScroll(): void {
    let startY = 0;
    let dragging = false;

    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (this.detailOverlay || this.shopOverlay) return;
      startY   = p.y;
      dragging = true;
    });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (!dragging || !p.isDown) return;
      const dy = p.y - startY;
      startY   = p.y;
      this.scrollY = Phaser.Math.Clamp(this.scrollY - dy, 0, this.maxScrollY);
      this.contentContainer.setY(-this.scrollY);
    });
    this.input.on('pointerup', () => { dragging = false; });
  }

  // ─── Utility ─────────────────────────────────────────────────────────────────

  private buildBtn(x: number, y: number, label: string, bg: number, cb: () => void): void {
    const g = this.add.graphics().setDepth(15);
    g.fillStyle(bg, 1);
    g.fillRoundedRect(x - 4, y - 14, label.length * 8 + 16, 28, 6);
    const t = this.add.text(x + 4, y, label, {
      fontFamily: 'sans-serif', fontSize: '11px', color: CSS.PARCHMENT_MUTED,
    }).setOrigin(0, 0.5).setDepth(16).setInteractive();
    t.on('pointerdown', cb);
  }
}
