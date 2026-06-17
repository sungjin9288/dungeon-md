import Phaser from 'phaser';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../constants/layout';
import { COLORS, CSS, CASUAL, CASUAL_CSS } from '../constants/colors';
import { applyCasualBackground } from '../ui/AmbientBackground';
import {
  loadGameState,
  getUnlockedSlots,
  type OwnedMonster,
} from '../data/wisdom';
import { MONSTER_DEFS, type MonsterId } from '../data/monsters';
import { getMonsterAtk } from '../data/barracks';
import { showMonsterDetailPanel, showSkillShopPanel } from '../ui/MonsterDetailPanel';

import {
  CARD_W,
  CARD_H,
  CARD_PAD,
  CARD_START_X,
  CARD_START_Y,
  SORT_CHIP_Y,
  FILTER_CHIP_Y,
  compareGrowth,
  getDeployedMonsterIds,
  getEquipmentInventoryIds,
  type BarracksSortKey,
  type BarracksFilterType,
} from '../ui/BarracksShared';
import {
  buildMonsterCard,
  buildSummonSlot,
  type BarracksCardContext,
} from '../ui/BarracksCard';
import {
  drawGrowthHallPanel,
  computeBarracksStats,
  computeBarracksDirective,
  type BarracksGrowthHallContext,
} from '../ui/BarracksGrowthHall';

export class BarracksScene extends Phaser.Scene {
  private gs = loadGameState();
  private scrollY    = 0;
  private maxScrollY = 0;
  private contentContainer!: Phaser.GameObjects.Container;
  private detailOverlay?: Phaser.GameObjects.Container;
  private shopOverlay?:   Phaser.GameObjects.Container;
  private sortKey: BarracksSortKey = 'growth';
  private sortChips: Phaser.GameObjects.GameObject[] = [];
  private filterType: BarracksFilterType = 'all';
  private filterChips: Phaser.GameObjects.GameObject[] = [];
  private focusMonsterId: string | null = null;
  private focusSourceLabel: string | null = null;
  private focusRoomSlotIdx: number | null = null;

  constructor() { super({ key: 'BarracksScene' }); }

  create(): void {
    this.gs = loadGameState();
    this.scrollY = 0;
    this.focusMonsterId = this.consumeFocusMonsterId();
    this.focusSourceLabel = this.consumeFocusSourceLabel();
    this.focusRoomSlotIdx = this.consumeFocusRoomSlotIdx();
    if (this.focusMonsterId) this.filterType = 'all';

    this.drawBackground();
    this.drawHeader();
    this.drawGrowthHallPanel();
    this.buildSortChips();
    this.buildFilterChips();
    this.buildContent();
    this.buildBottomNav();
    this.setupScroll();

    if (this.focusMonsterId) {
      const focusId = this.focusMonsterId;
      this.time.delayedCall(260, () => this.openFocusedMonsterDetail(focusId));
    }
  }

  // ─── Background ──────────────────────────────────────────────────────────────

  private drawBackground(): void {
    applyCasualBackground(this);

    const g = this.add.graphics().setDepth(-10);
    const trayY = CARD_START_Y - 10;
    const trayH = CANVAS_HEIGHT - CARD_START_Y - 86;
    g.fillStyle(CASUAL.SHADOW, 0.16);
    g.fillRoundedRect(8, trayY + 4, CANVAS_WIDTH - 16, trayH, 18);
    g.fillStyle(CASUAL.PANEL_SOFT, 0.92);
    g.fillRoundedRect(8, trayY, CANVAS_WIDTH - 16, trayH, 18);
    g.lineStyle(3, CASUAL.EDGE, 0.9);
    g.strokeRoundedRect(8, trayY, CANVAS_WIDTH - 16, trayH, 18);
    g.fillStyle(0xffffff, 0.12);
    g.fillRoundedRect(13, trayY + 5, CANVAS_WIDTH - 26, 6, 3);
    g.fillStyle(CASUAL.PANEL, 1);
    g.fillRect(0, 0, CANVAS_WIDTH, 88);
    g.fillStyle(0xffffff, 0.12);
    g.fillRect(0, 0, CANVAS_WIDTH, 4);
    g.fillStyle(CASUAL.EDGE, 1);
    g.fillRect(0, 88 - 3, CANVAS_WIDTH, 3);
  }

  private drawHeader(): void {
    this.add.text(CANVAS_WIDTH / 2, 24, '몬스터 성장소', {
      fontFamily: 'sans-serif', fontSize: '22px', fontStyle: 'bold',
      color: CASUAL_CSS.INK, stroke: '#ffffff', strokeThickness: 4,
    }).setOrigin(0.5).setDepth(10);

    const power = this.gs.ownedMonsters.reduce((s, m) => {
      const def = MONSTER_DEFS[m.id as keyof typeof MONSTER_DEFS];
      return s + getMonsterAtk(def?.baseDamage ?? 10, m.level, m.spentSkills);
    }, 0);

    this.add.text(CANVAS_WIDTH / 2, 52, `총 전투력 ${power}`, {
      fontFamily: 'sans-serif', fontSize: '13px', color: CASUAL_CSS.INK_SOFT, fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(10);

    if (this.focusSourceLabel) {
      this.drawHeaderStatusChip(
        CANVAS_WIDTH / 2 - 96, 62, 192, 18,
        `${this.focusSourceLabel} 성장 관리`, 0x66c08a,
      );
    } else {
      this.drawCollectionProgressChip(CANVAS_WIDTH / 2 - 96, 62, 192, 18);
    }

    this.buildBtn(24, 24, '← 뒤로', 0x2d2416, () => this.scene.start('DungeonHomeScene'));
    if (this.focusRoomSlotIdx !== null) {
      this.buildBtn(CANVAS_WIDTH - 76, 24, '방 복귀', 0x0c211b, () => this.returnToFocusedRoom());
    }
  }

  private drawHeaderStatusChip(
    x: number, y: number, w: number, h: number, label: string, accent: number,
  ): void {
    const g = this.add.graphics().setDepth(10);
    g.fillStyle(0x071512, 0.94);
    g.fillRoundedRect(x, y, w, h, 7);
    g.lineStyle(1, accent, 0.58);
    g.strokeRoundedRect(x, y, w, h, 7);
    g.fillStyle(accent, 0.16);
    g.fillCircle(x + 14, y + h / 2, 7);
    g.fillStyle(0xffffff, 0.18);
    g.fillCircle(x + 10, y + 6, 1.4);
    g.fillCircle(x + w - 14, y + 6, 1.2);

    this.add.text(x + 14, y + h / 2, '◆', {
      fontFamily: 'Georgia, serif', fontSize: '10px', color: '#d7fff4', fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(11);
    this.add.text(x + 29, y + h / 2, label, {
      fontFamily: 'sans-serif', fontSize: '10px', color: '#b8fff0', fontStyle: 'bold',
    }).setOrigin(0, 0.5).setDepth(11);
  }

  private drawCollectionProgressChip(x: number, y: number, w: number, h: number): void {
    const summary = this.getCollectionSummary();
    const g = this.add.graphics().setDepth(10);
    g.fillStyle(0x120b25, 0.92);
    g.fillRoundedRect(x, y, w, h, 7);
    g.lineStyle(1, 0xff9adf, 0.58);
    g.strokeRoundedRect(x, y, w, h, 7);
    g.fillStyle(0xff9adf, 0.17);
    g.fillCircle(x + 14, y + h / 2, 7);
    g.fillStyle(0xffffff, 0.22);
    g.fillCircle(x + 10, y + 6, 1.4);
    g.fillCircle(x + w - 14, y + 6, 1.2);
    g.fillStyle(0xe8d098, 0.22);
    g.fillRoundedRect(x + 31, y + h - 5, Math.max(5, (w - 84) * summary.percent), 3, 2);

    this.add.text(x + 14, y + h / 2, '★', {
      fontFamily: 'Georgia, serif', fontSize: '11px', color: '#ffe6ff', fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(11);
    this.add.text(x + 30, y + 7, `도감 ${summary.owned}/${summary.total}`, {
      fontFamily: 'sans-serif', fontSize: '9px', color: '#ffd6f6', fontStyle: 'bold',
    }).setOrigin(0, 0.5).setDepth(11);
    this.add.text(x + w - 36, y + 7, `R+ ${summary.rareOwned}`, {
      fontFamily: 'monospace', fontSize: '8px', color: '#e8d098', fontStyle: 'bold',
    }).setOrigin(1, 0.5).setDepth(11);
    this.add.text(x + w - 8, y + 7, `L ${summary.legendaryOwned}`, {
      fontFamily: 'monospace', fontSize: '8px', color: '#ffd878', fontStyle: 'bold',
    }).setOrigin(1, 0.5).setDepth(11);
  }

  private getCollectionSummary(): {
    owned: number; total: number; rareOwned: number; legendaryOwned: number; percent: number;
  } {
    const ownedTypes = new Set<string>();
    const allIds     = Object.keys(MONSTER_DEFS);
    for (const monster of this.gs.ownedMonsters) {
      const typeId = allIds.find(id => monster.id === id || monster.id.startsWith(`${id}_`));
      if (typeId) ownedTypes.add(typeId);
    }
    const rareOwned = Array.from(ownedTypes).filter(id => {
      const rarity = MONSTER_DEFS[id as MonsterId]?.rarityTier;
      return rarity === 'R' || rarity === 'E' || rarity === 'L';
    }).length;
    const legendaryOwned = Array.from(ownedTypes).filter(id => (
      MONSTER_DEFS[id as MonsterId]?.rarityTier === 'L'
    )).length;
    const total = allIds.length;
    return {
      owned: ownedTypes.size,
      total,
      rareOwned,
      legendaryOwned,
      percent: total > 0 ? ownedTypes.size / total : 0,
    };
  }

  private drawGrowthHallPanel(): void {
    const deployedIds         = getDeployedMonsterIds(this.gs);
    const equipmentInventory  = getEquipmentInventoryIds(this.gs);
    const stats               = computeBarracksStats(this.gs, deployedIds.size, equipmentInventory.length);
    const directive           = computeBarracksDirective(this.gs, stats, this.focusMonsterId);

    const ctx: BarracksGrowthHallContext = {
      gs:               this.gs,
      focusSourceLabel: this.focusSourceLabel,
      onCtaPress:       (m) => this.showMonsterDetail(m),
    };

    drawGrowthHallPanel(this, ctx, stats, directive);
  }

  // ─── Sort chips ───────────────────────────────────────────────────────────────

  private buildSortChips(): void {
    const KEYS: Array<{ key: BarracksSortKey; label: string }> = [
      { key: 'growth', label: '성장 우선' },
      { key: 'level',  label: '레벨 ↓' },
      { key: 'atk',    label: '공격력' },
      { key: 'rarity', label: '희귀도' },
    ];
    const chipW = 82, chipH = 22, chipGap = 6;
    const totalW = KEYS.length * chipW + (KEYS.length - 1) * chipGap;
    const startX = (CANVAS_WIDTH - totalW) / 2;
    const chipY  = SORT_CHIP_Y;

    this.sortChips.forEach(c => c.destroy());
    this.sortChips = [];

    KEYS.forEach(({ key, label }, i) => {
      const cx       = startX + i * (chipW + chipGap);
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

    const TYPES: Array<{ key: BarracksFilterType; label: string }> = [
      { key: 'all',     label: '전체' },
      { key: 'melee',   label: '⚔근접' },
      { key: 'ranged',  label: '🏹원거리' },
      { key: 'magic',   label: '✨마법' },
      { key: 'support', label: '💚지원' },
    ];
    const chipW = 66, chipH = 20, chipGap = 4;
    const totalW = TYPES.length * chipW + (TYPES.length - 1) * chipGap;
    const startX = (CANVAS_WIDTH - totalW) / 2;
    const chipY  = FILTER_CHIP_Y;

    TYPES.forEach(({ key, label }, i) => {
      const cx       = startX + i * (chipW + chipGap);
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
        if (this.sortKey === 'growth') return compareGrowth(a, b);
        if (this.sortKey === 'level')  return b.level - a.level;
        if (this.sortKey === 'rarity') return (b.rarity ?? 0) - (a.rarity ?? 0);
        const defA = MONSTER_DEFS[a.id as keyof typeof MONSTER_DEFS];
        const defB = MONSTER_DEFS[b.id as keyof typeof MONSTER_DEFS];
        return getMonsterAtk(defB?.baseDamage ?? 10, b.level, b.spentSkills)
             - getMonsterAtk(defA?.baseDamage ?? 10, a.level, a.spentSkills);
      });

    const cols = 2;
    let focusCardY: number | null = null;

    const cardCtx: BarracksCardContext = {
      gs:               this.gs,
      focusMonsterId:   this.focusMonsterId,
      contentContainer: this.contentContainer,
      onSelect:         (m) => this.showMonsterDetail(m),
      tweens:           this.tweens,
    };

    sorted.forEach((m, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x   = CARD_START_X + col * (CARD_W + CARD_PAD);
      const y   = CARD_START_Y + row * (CARD_H + CARD_PAD);
      if (this.focusMonsterId === m.id) focusCardY = y;
      buildMonsterCard(this, cardCtx, m, x, y);
    });

    // "소환" empty slot at the end
    const nextIdx = sorted.length;
    const col     = nextIdx % cols;
    const row     = Math.floor(nextIdx / cols);
    const x       = CARD_START_X + col * (CARD_W + CARD_PAD);
    const y       = CARD_START_Y + row * (CARD_H + CARD_PAD);
    buildSummonSlot(this, cardCtx, x, y);

    const rows     = Math.ceil((sorted.length + 1) / cols);
    this.maxScrollY = Math.max(
      0,
      CARD_START_Y + rows * (CARD_H + CARD_PAD) + 20 - (CANVAS_HEIGHT - 80),
    );

    if (focusCardY !== null) {
      this.scrollY = Phaser.Math.Clamp(focusCardY - CARD_START_Y + 12, 0, this.maxScrollY);
      this.contentContainer.setY(-this.scrollY);
    }
  }

  // ─── Monster Detail Overlay ───────────────────────────────────────────────────

  private showMonsterDetail(m: OwnedMonster): void {
    this.detailOverlay?.destroy();
    this.detailOverlay = showMonsterDetailPanel(
      {
        scene: this,
        focusSourceLabel: this.focusMonsterId === m.id ? this.focusSourceLabel ?? undefined : undefined,
        onClose:   () => { this.detailOverlay = undefined; },
        onRefresh: (updated) => { this.detailOverlay = undefined; this.showMonsterDetail(updated); },
        onOpenForge: (monster) => {
          this.detailOverlay = undefined;
          this.registry.set('forgeReturnScene', 'BarracksScene');
          this.registry.set('focusMonsterId', monster.id);
          if (this.focusSourceLabel)      this.registry.set('focusSourceLabel', this.focusSourceLabel);
          if (this.focusRoomSlotIdx !== null) this.registry.set('focusRoomSlotIdx', this.focusRoomSlotIdx);
          this.scene.start('ForgeScene');
        },
        onReturnToRoom: this.focusRoomSlotIdx !== null
          ? () => this.returnToFocusedRoom()
          : undefined,
      },
      m,
    );
  }

  private consumeFocusMonsterId(): string | null {
    const focus = this.registry.get('focusMonsterId');
    if (typeof focus !== 'string' || focus.length === 0) return null;
    this.registry.remove('focusMonsterId');
    return focus;
  }

  private consumeFocusSourceLabel(): string | null {
    const label = this.registry.get('focusSourceLabel');
    if (typeof label !== 'string' || label.length === 0) return null;
    this.registry.remove('focusSourceLabel');
    return label;
  }

  private consumeFocusRoomSlotIdx(): number | null {
    const raw = this.registry.get('focusRoomSlotIdx');
    this.registry.remove('focusRoomSlotIdx');
    const slotIdx = typeof raw === 'number' ? raw : Number(raw);
    if (!Number.isInteger(slotIdx)) return null;
    if (slotIdx < 0 || slotIdx >= getUnlockedSlots(this.gs.dmLevel)) return null;
    return slotIdx;
  }

  private returnToFocusedRoom(): void {
    if (this.focusRoomSlotIdx === null) {
      this.scene.start('DungeonHomeScene');
      return;
    }
    this.registry.set('focusRoomSlotIdx', this.focusRoomSlotIdx);
    this.scene.start('DungeonHomeScene');
  }

  private openFocusedMonsterDetail(monsterId: string): void {
    const target = this.gs.ownedMonsters.find(m => m.id === monsterId);
    if (!target) return;
    this.showMonsterDetail(target);
  }

  // ─── Bottom Nav ───────────────────────────────────────────────────────────────

  private buildBottomNav(): void {
    const navBg = this.add.graphics().setDepth(20);
    navBg.fillStyle(CASUAL.PANEL, 1);
    navBg.fillRect(0, CANVAS_HEIGHT - 72, CANVAS_WIDTH, 72);
    navBg.fillStyle(0xffffff, 0.14);
    navBg.fillRect(0, CANVAS_HEIGHT - 72, CANVAS_WIDTH, 4);
    navBg.fillStyle(CASUAL.EDGE, 1);
    navBg.fillRect(0, CANVAS_HEIGHT - 72, CANVAS_WIDTH, 1.5);

    const btnW = (CANVAS_WIDTH - 28) / 5;
    const btnDefs = [
      { label: '⚔️ 막사', accent: CASUAL.RED,    active: true,  action: () => { /* already here */ } },
      { label: '📖 도감', accent: CASUAL.BLUE,   active: false, action: () => { this.registry.set('previousScene', 'BarracksScene'); this.scene.start('CodexScene'); } },
      { label: '✨ 소환', accent: CASUAL.PURPLE, active: false, action: () => this.scene.start('SummonScene') },
      { label: '🛒 스킬', accent: CASUAL.GREEN,  active: false, action: () => this.showSkillShop() },
      { label: '🏪 상점', accent: CASUAL.GOLD,   active: false, action: () => this.scene.start('ShopScene') },
    ];

    btnDefs.forEach(({ label, accent, active, action }, i) => {
      const bx = 12 + i * (btnW + 4);
      const by = CANVAS_HEIGHT - 58;
      const bg = this.add.graphics().setDepth(21);
      if (active) {
        bg.fillStyle(CASUAL.EDGE, 0.3);
        bg.fillRoundedRect(bx, by + 3, btnW, 46, 13);
        bg.fillStyle(accent, 1);
        bg.fillRoundedRect(bx, by, btnW, 46, 13);
        bg.fillStyle(0xffffff, 0.3);
        bg.fillRoundedRect(bx + 6, by + 5, btnW - 12, 7, 3);
      }
      this.add.text(bx + btnW / 2, by + 23, label, {
        fontFamily: 'sans-serif', fontSize: '11px', fontStyle: 'bold',
        color: active ? '#ffffff' : CASUAL_CSS.INK_SOFT,
        stroke: active ? '#00000033' : undefined,
        strokeThickness: active ? 3 : 0,
      }).setOrigin(0.5).setDepth(22);
      const zone = this.add.zone(bx + btnW / 2, by + 23, btnW, 46)
        .setInteractive({ useHandCursor: true })
        .setDepth(23);
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
    let startY   = 0;
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

  private buildBtn(x: number, y: number, label: string, _bg: number, cb: () => void): void {
    const w = label.length * 8 + 18;
    const g = this.add.graphics().setDepth(15);
    g.fillStyle(CASUAL.EDGE, 1);
    g.fillRoundedRect(x - 4, y - 11, w, 28, 13);
    g.fillStyle(CASUAL.PANEL, 1);
    g.fillRoundedRect(x - 4, y - 14, w, 26, 13);
    g.fillStyle(0xffffff, 0.12);
    g.fillRoundedRect(x, y - 12, w - 8, 5, 3);
    this.add.text(x - 4 + w / 2, y - 1, label, {
      fontFamily: 'sans-serif', fontSize: '11px', color: CASUAL_CSS.INK, fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(16);
    const zone = this.add.zone(x - 4, y - 14, w, 28).setOrigin(0).setDepth(16)
      .setInteractive({ useHandCursor: true });
    zone.on('pointerdown', cb);
  }
}
