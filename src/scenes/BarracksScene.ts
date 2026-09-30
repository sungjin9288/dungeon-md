import Phaser from 'phaser';
import { groupOwnedCopies } from '../data/ownedCopies';
import { getDungeonRoomCount } from '../data/dungeonPlan';
import { getCharacterArtStreamer } from '../art/CharacterArtStreamer';
import { CANVAS_WIDTH, CANVAS_HEIGHT, ROOT_NAV_Y } from '../constants/layout';
import { DUNGEON_UI, DUNGEON_UI_CSS } from '../constants/colors';
import {
  loadGameState,
  type OwnedMonster,
} from '../data/wisdom';
import {
  MONSTER_DEFS,
  resolveMonsterTypeId,
  resolveOwnedMonsterProfile,
  type MonsterId,
} from '../data/monsters';
import { getOwnedMonsterBattleAtk } from '../data/barracks';
import { showMonsterDetailPanel, showSkillShopPanel, type MonsterDetailTab } from '../ui/MonsterDetailPanel';

import {
  CARD_START_X,
  CARD_START_Y,
  SUMMON_ROW_H,
  SORT_CHIP_Y,
  FILTER_CHIP_Y,
  compareGrowth,
  getDeployedMonsterIds,
  getEquipmentInventoryIds,
  type BarracksSortKey,
  type BarracksFilterType,
} from '../ui/BarracksShared';
import {
  buildMonsterTile,
  TILE_COLS,
  TILE_GAP,
  TILE_H,
  TILE_W,
  buildSummonSlot,
  type BarracksCardContext,
} from '../ui/BarracksCard';
import {
  drawGrowthHallPanel,
  computeBarracksStats,
  computeBarracksDirective,
  type BarracksGrowthHallContext,
} from '../ui/BarracksGrowthHall';
import {
  drawLegionActionSigil,
  drawLegionCrest,
  type LegionManagementAction,
} from '../ui/BarracksSkin';
import { getContextualBackTarget, getZoneDestination } from '../data/navigationContract';
import {
  buildHomeZoneNavigation,
  buildZoneBackButton,
  getSceneFixedShellViewportOffset,
} from '../ui/GameZoneNavigation';

export class BarracksScene extends Phaser.Scene {
  private gs = loadGameState();
  private scrollY    = 0;
  private maxScrollY = 0;
  private contentMask?: Phaser.GameObjects.Graphics;
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
  private legionMenuOverlay?: Phaser.GameObjects.Container;
  /** A ritual-v2 cutout for an owned guardian arrived after the roster was drawn. */
  private artDirty = false;

  constructor() { super({ key: 'BarracksScene' }); }

  create(data?: { scrollY?: number }): void {
    this.gs = loadGameState();
    // Normally already streamed from Home; covers direct entry and new arrivals.
    // A cutout that lands after the roster was drawn redraws it once (or on the
    // detail panel's close, if one is open) instead of leaving the legacy JPEG.
    this.artDirty = false;
    const streamer = getCharacterArtStreamer(this.game);
    // Owned guardians plus their equipped skins: either cutout landing redraws.
    const owned = new Set([...this.gs.ownedMonsters.map(monster => monster.id), ...Object.values(this.gs.equippedSkins ?? {})]);
    let redraw: Phaser.Time.TimerEvent | null = null;
    const off = streamer.onLoaded(id => {
      if (!owned.has(id)) return;
      this.artDirty = true;
      if (redraw) return;
      redraw = this.time.delayedCall(300, () => {
        redraw = null;
        if (!this.detailOverlay && !this.shopOverlay && !this.legionMenuOverlay) this.scene.restart({ scrollY: this.scrollY });
      });
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, off);
    streamer.request(owned);
    this.legionMenuOverlay = undefined;
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
    this.buildRootNavigation();
    if (this.focusRoomSlotIdx === null) this.buildLegionManagementDisclosure();
    this.setupScroll();
    if (data?.scrollY) {
      this.scrollY = Phaser.Math.Clamp(data.scrollY, 0, this.maxScrollY);
      this.contentContainer.setY(-this.scrollY);
    }

    if (this.focusMonsterId) {
      const focusId = this.focusMonsterId;
      this.time.delayedCall(260, () => this.openFocusedMonsterDetail(focusId));
    }
  }

  // ─── Background ──────────────────────────────────────────────────────────────

  private drawBackground(): void {
    const g = this.add.graphics().setDepth(-10);
    g.fillStyle(DUNGEON_UI.VOID, 1);
    g.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    g.fillStyle(DUNGEON_UI.SOOT, 1);
    g.fillRect(0, 0, CANVAS_WIDTH, 88);
    g.fillStyle(DUNGEON_UI.STONE, 0.94);
    g.fillRect(0, 88, CANVAS_WIDTH, ROOT_NAV_Y - 88);

    g.lineStyle(1, DUNGEON_UI.IRON, 0.36);
    for (let y = 112; y < ROOT_NAV_Y; y += 64) {
      g.lineBetween(0, y, CANVAS_WIDTH, y);
      const offset = Math.floor((y - 112) / 64) % 2 === 0 ? 34 : 76;
      for (let x = offset; x < CANVAS_WIDTH; x += 92) g.lineBetween(x, y - 64, x, y);
    }

    const trayY = CARD_START_Y - 8;
    const trayH = ROOT_NAV_Y - trayY - 7;
    g.fillStyle(DUNGEON_UI.VOID, 0.48);
    g.fillRoundedRect(8, trayY + 4, CANVAS_WIDTH - 16, trayH, 10);
    g.fillStyle(DUNGEON_UI.SOOT, 0.9);
    g.fillRoundedRect(8, trayY, CANVAS_WIDTH - 16, trayH, 10);
    g.lineStyle(1.5, DUNGEON_UI.IRON, 0.86);
    g.strokeRoundedRect(8, trayY, CANVAS_WIDTH - 16, trayH, 10);

    g.fillStyle(DUNGEON_UI.BRASS, 0.72);
    g.fillRect(0, 85, CANVAS_WIDTH, 3);
    g.fillStyle(DUNGEON_UI.EDGE, 0.34);
    g.fillRect(0, 88, CANVAS_WIDTH, 2);
    [8, CANVAS_WIDTH - 8].forEach(x => {
      g.fillStyle(DUNGEON_UI.BRASS, 0.34);
      g.fillCircle(x, 87, 4);
    });
  }

  private drawHeader(): void {
    this.add.text(CANVAS_WIDTH / 2, 22, '군단 훈련소', {
      fontFamily: 'sans-serif', fontSize: '18px', fontStyle: 'bold',
      color: DUNGEON_UI_CSS.PARCHMENT,
    }).setOrigin(0.5).setDepth(10);

    // Spare copies are evolution/absorption material, not extra fighters: count each kind once.
    const power = groupOwnedCopies(this.gs.ownedMonsters).map(group => group.monster).reduce((s, m) => {
      const def = resolveOwnedMonsterProfile(m.id);
      return def ? s + getOwnedMonsterBattleAtk(def.baseDamage, m, this.gs) : s;
    }, 0);

    this.add.text(CANVAS_WIDTH / 2, 45, `총 전투력  ${power}`, {
      fontFamily: 'sans-serif', fontSize: '11px', color: DUNGEON_UI_CSS.BRASS, fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(10);

    if (this.focusSourceLabel) {
      this.drawHeaderStatusChip(
        CANVAS_WIDTH / 2 - 77, 58, 154, 21,
        `${this.focusSourceLabel} 성장 관리`, DUNGEON_UI.JADE,
      );
    } else {
      this.drawCollectionProgressChip(CANVAS_WIDTH / 2 - 77, 58, 154, 21);
    }

    buildZoneBackButton(this, {
      label: '← 던전',
      width: 86,
      fillColor: DUNGEON_UI.STONE,
      borderColor: DUNGEON_UI.IRON,
      textColor: DUNGEON_UI_CSS.TEXT,
      onBack: () => this.scene.start(getContextualBackTarget('BarracksScene')),
    });
    if (this.focusRoomSlotIdx !== null) {
      this.buildBtn(CANVAS_WIDTH - 75, 30, '방 복귀', DUNGEON_UI.JADE, () => this.returnToFocusedRoom());
    }
  }

  private drawHeaderStatusChip(
    x: number, y: number, w: number, h: number, label: string, accent: number,
  ): void {
    const g = this.add.graphics().setDepth(10);
    g.fillStyle(DUNGEON_UI.VOID, 0.96);
    g.fillRoundedRect(x, y, w, h, 5);
    g.lineStyle(1, accent, 0.58);
    g.strokeRoundedRect(x, y, w, h, 5);
    g.fillStyle(accent, 0.16);
    g.fillCircle(x + 14, y + h / 2, 8);
    drawLegionCrest(g, x + 14, y + h / 2 - 1, accent, 0.92, 0.48);
    this.add.text(x + 28, y + h / 2, label, {
      fontFamily: 'sans-serif', fontSize: '10px', color: DUNGEON_UI_CSS.JADE, fontStyle: 'bold',
    }).setOrigin(0, 0.5).setDepth(11);
  }

  private drawCollectionProgressChip(x: number, y: number, w: number, h: number): void {
    const summary = this.getCollectionSummary();
    const g = this.add.graphics().setDepth(10);
    g.fillStyle(DUNGEON_UI.VOID, 0.96);
    g.fillRoundedRect(x, y, w, h, 5);
    g.lineStyle(1, DUNGEON_UI.BRASS, 0.58);
    g.strokeRoundedRect(x, y, w, h, 5);
    g.fillStyle(DUNGEON_UI.BRASS, 0.14);
    g.fillRoundedRect(x + 4, y + h - 5, Math.max(4, (w - 8) * summary.percent), 2, 1);
    drawLegionCrest(g, x + 14, y + h / 2 - 1, DUNGEON_UI.BRASS_BRIGHT, 0.88, 0.46);

    this.add.text(x + 29, y + h / 2, `도감 ${summary.owned}/${summary.total} · R+ ${summary.rareOwned} · L ${summary.legendaryOwned}`, {
      fontFamily: 'sans-serif', fontSize: '10px', color: DUNGEON_UI_CSS.TEXT, fontStyle: 'bold',
    }).setOrigin(0, 0.5).setDepth(11);
  }

  private getCollectionSummary(): {
    owned: number; total: number; rareOwned: number; legendaryOwned: number; percent: number;
  } {
    const ownedTypes = new Set<MonsterId>();
    const allIds     = Object.keys(MONSTER_DEFS) as MonsterId[];
    for (const monster of this.gs.ownedMonsters) {
      const typeId = resolveMonsterTypeId(monster.id);
      if (typeId) ownedTypes.add(typeId);
    }
    const rareOwned = Array.from(ownedTypes).filter(id => {
      const rarity = MONSTER_DEFS[id]?.rarityTier;
      return rarity === 'R' || rarity === 'E' || rarity === 'L';
    }).length;
    const legendaryOwned = Array.from(ownedTypes).filter(id => (
      MONSTER_DEFS[id]?.rarityTier === 'L'
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
      onSummonPress:    () => this.scene.start('SummonScene'),
    };

    drawGrowthHallPanel(this, ctx, stats, directive);
  }

  // ─── Sort chips ───────────────────────────────────────────────────────────────

  private buildSortChips(): void {
    const KEYS: Array<{ key: BarracksSortKey; label: string }> = [
      { key: 'growth', label: '성장' },
      { key: 'level',  label: '레벨' },
      { key: 'atk',    label: '전력' },
      { key: 'rarity', label: '등급' },
    ];
    const chipW = 82, chipH = 44, chipGap = 6;
    const totalW = KEYS.length * chipW + (KEYS.length - 1) * chipGap;
    const startX = (CANVAS_WIDTH - totalW) / 2;
    const chipY  = SORT_CHIP_Y;

    this.sortChips.forEach(c => c.destroy());
    this.sortChips = [];

    KEYS.forEach(({ key, label }, i) => {
      const cx       = startX + i * (chipW + chipGap);
      const isActive = this.sortKey === key;

      const bg = this.add.graphics().setDepth(11);
      bg.fillStyle(isActive ? DUNGEON_UI.STONE_RAISED : DUNGEON_UI.SOOT, 1);
      bg.fillRoundedRect(cx, chipY, chipW, chipH, 4);
      if (isActive) {
        bg.fillStyle(DUNGEON_UI.BRASS, 0.92);
        bg.fillRect(cx + 9, chipY + 3, chipW - 18, 3);
      }
      bg.lineStyle(1, isActive ? DUNGEON_UI.BRASS : DUNGEON_UI.IRON, isActive ? 0.9 : 0.66);
      bg.strokeRoundedRect(cx, chipY, chipW, chipH, 4);

      const t = this.add.text(cx + chipW / 2, chipY + chipH / 2, label, {
        fontFamily: 'sans-serif', fontSize: '12px', fontStyle: isActive ? 'bold' : 'normal',
        color: isActive ? DUNGEON_UI_CSS.BRASS : DUNGEON_UI_CSS.MUTED,
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
      { key: 'melee',   label: '근접' },
      { key: 'ranged',  label: '원거리' },
      { key: 'magic',   label: '마법' },
      { key: 'support', label: '지원' },
    ];
    const chipW = 66, chipH = 44, chipGap = 4;
    const totalW = TYPES.length * chipW + (TYPES.length - 1) * chipGap;
    const startX = (CANVAS_WIDTH - totalW) / 2;
    const chipY  = FILTER_CHIP_Y;

    TYPES.forEach(({ key, label }, i) => {
      const cx       = startX + i * (chipW + chipGap);
      const isActive = this.filterType === key;

      const bg = this.add.graphics().setDepth(11);
      bg.fillStyle(isActive ? DUNGEON_UI.STONE_RAISED : DUNGEON_UI.SOOT, 1);
      bg.fillRoundedRect(cx, chipY, chipW, chipH, 3);
      if (isActive) {
        bg.fillStyle(DUNGEON_UI.JADE, 0.86);
        bg.fillRect(cx + 8, chipY + chipH - 5, chipW - 16, 3);
      }
      bg.lineStyle(1, isActive ? DUNGEON_UI.JADE : DUNGEON_UI.IRON, isActive ? 0.88 : 0.62);
      bg.strokeRoundedRect(cx, chipY, chipW, chipH, 3);

      const t = this.add.text(cx + chipW / 2, chipY + chipH / 2, label, {
        fontFamily: 'sans-serif', fontSize: '11px',
        color: isActive ? DUNGEON_UI_CSS.JADE : DUNGEON_UI_CSS.MUTED,
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
    // The roster scrolls by moving this container, so clip it to the list's
    // viewport: cards past the fold stay hidden instead of painting under the
    // bottom navigation (and the audit no longer reads them as overflow).
    this.contentMask?.destroy();
    this.contentMask = this.make.graphics({ x: 0, y: 0 }, false);
    this.contentMask.fillStyle(0xffffff, 1);
    this.contentMask.fillRect(0, CARD_START_Y - 8, CANVAS_WIDTH, (ROOT_NAV_Y - 8) - (CARD_START_Y - 8));
    this.contentContainer.setMask(this.contentMask.createGeometryMask());

    const groups = groupOwnedCopies(this.gs.ownedMonsters);
    const copyCounts = new Map(groups.map(group => [group.monster.id, group.copies]));
    const sorted = groups.map(group => group.monster)
      .filter(m => {
        const def = resolveOwnedMonsterProfile(m.id);
        if (!def) return false;
        return this.filterType === 'all' || def.type === this.filterType;
      })
      .sort((a, b) => {
        if (this.sortKey === 'growth') return compareGrowth(a, b);
        if (this.sortKey === 'level')  return b.level - a.level;
        if (this.sortKey === 'rarity') return (b.rarity ?? 0) - (a.rarity ?? 0);
        const defA = resolveOwnedMonsterProfile(a.id);
        const defB = resolveOwnedMonsterProfile(b.id);
        return getOwnedMonsterBattleAtk(defB?.baseDamage ?? 0, b, this.gs)
             - getOwnedMonsterBattleAtk(defA?.baseDamage ?? 0, a, this.gs);
      });

    let focusCardY: number | null = null;

    const cardCtx: BarracksCardContext = {
      gs:               this.gs,
      focusMonsterId:   this.focusMonsterId,
      contentContainer: this.contentContainer,
      onSelect:         (m) => this.showMonsterDetail(m),
      tweens:           this.tweens,
      copyCounts,
    };

    sorted.forEach((m, i) => {
      const x = CARD_START_X + (i % TILE_COLS) * (TILE_W + TILE_GAP);
      const y = CARD_START_Y + Math.floor(i / TILE_COLS) * (TILE_H + TILE_GAP);
      if (this.focusMonsterId === m.id) focusCardY = y;
      buildMonsterTile(this, cardCtx, m, x, y);
    });

    const rows = Math.ceil(sorted.length / TILE_COLS);
    const summonY = CARD_START_Y + rows * (TILE_H + TILE_GAP);
    buildSummonSlot(this, cardCtx, CARD_START_X, summonY);

    const contentBottom = summonY + SUMMON_ROW_H;
    this.maxScrollY = Math.max(
      0,
      contentBottom + 14 - (ROOT_NAV_Y - 8),
    );

    if (focusCardY !== null) {
      this.scrollY = Phaser.Math.Clamp(focusCardY - CARD_START_Y + 12, 0, this.maxScrollY);
      this.contentContainer.setY(-this.scrollY);
    }
  }

  // ─── Monster Detail Overlay ───────────────────────────────────────────────────

  private showMonsterDetail(m: OwnedMonster, tab?: MonsterDetailTab): void {
    if (!resolveOwnedMonsterProfile(m.id)) return;
    this.detailOverlay?.destroy();
    this.detailOverlay = showMonsterDetailPanel(
      {
        scene: this,
        focusSourceLabel: this.focusMonsterId === m.id ? this.focusSourceLabel ?? undefined : undefined,
        onClose:   () => {
          this.detailOverlay = undefined;
          // Feeding/equipping/skills saved from the detail; the roster, header power
          // and growth hall still showed the state from scene start.
          if (this.artDirty || JSON.stringify(loadGameState()) !== JSON.stringify(this.gs)) {
            this.scene.restart({ scrollY: this.scrollY });
          }
        },
        onRefresh: (updated, refreshTab) => { this.detailOverlay = undefined; this.showMonsterDetail(updated, refreshTab); },
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
      tab,
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
    if (slotIdx < 0 || slotIdx >= getDungeonRoomCount(this.gs)) return null;
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

  // ─── Root navigation + Legion disclosure ─────────────────────────────────────

  private buildRootNavigation(): void {
    buildHomeZoneNavigation(this, 'legion', (zone) => {
      this.legionMenuOverlay?.destroy();
      this.scene.start(getZoneDestination(zone));
    });
  }

  /** One compact disclosure keeps Legion-internal routes reachable without a five-tab footer. */
  private buildLegionManagementDisclosure(): void {
    const offset = getSceneFixedShellViewportOffset(this);
    const shell = this.add.container(offset.x, offset.y).setDepth(26).setScrollFactor(0);
    const x = CANVAS_WIDTH - 82;
    const y = 8;
    const w = 72;
    const h = 44;
    const bg = this.add.graphics();
    shell.add(bg);
    const draw = (active = false): void => {
      bg.clear();
      bg.fillStyle(DUNGEON_UI.VOID, 0.5);
      bg.fillRoundedRect(x, y + 3, w, h, 9);
      bg.fillStyle(active ? DUNGEON_UI.STONE_RAISED : DUNGEON_UI.STONE, 1);
      bg.fillRoundedRect(x, y, w, h, 9);
      bg.lineStyle(1.5, active ? DUNGEON_UI.BRASS : DUNGEON_UI.IRON, 1);
      bg.strokeRoundedRect(x, y, w, h, 9);
      drawLegionCrest(bg, x + 18, y + h / 2 - 1,
        active ? DUNGEON_UI.BRASS_BRIGHT : DUNGEON_UI.EDGE, 0.9, 0.52);
    };
    draw();
    const label = this.add.text(x + 48, y + h / 2, '관리', {
      fontFamily: 'sans-serif', fontSize: '11px', fontStyle: 'bold', color: DUNGEON_UI_CSS.TEXT,
    }).setOrigin(0.5).setDepth(27);
    shell.add(label);
    const zone = this.add.zone(x, y, w, h).setOrigin(0).setDepth(28)
      .setScrollFactor(0)
      .setInteractive({ useHandCursor: true });
    shell.add(zone);
    zone.on('pointerover', () => { draw(true); label.setColor(DUNGEON_UI_CSS.BRASS); });
    zone.on('pointerout', () => { draw(false); label.setColor(DUNGEON_UI_CSS.TEXT); });
    zone.on('pointerdown', () => this.toggleLegionManagementMenu());
  }

  private toggleLegionManagementMenu(): void {
    if (this.legionMenuOverlay) {
      this.legionMenuOverlay.destroy();
      this.legionMenuOverlay = undefined;
      return;
    }

    const rows: ReadonlyArray<{
      label: string;
      action: LegionManagementAction;
      onPress: () => void;
    }> = [
      { label: '도감', action: 'codex', onPress: () => {
        this.registry.set('previousScene', 'BarracksScene');
        this.scene.start('CodexScene');
      } },
      { label: '소환', action: 'summon', onPress: () => this.scene.start('SummonScene') },
      { label: '융합', action: 'fusion', onPress: () => this.scene.start('FusionScene') },
      { label: '스킬', action: 'skill', onPress: () => this.showSkillShop() },
      { label: '상점', action: 'shop', onPress: () => this.scene.start('ShopScene') },
    ];
    const rowH = 46;
    const panelW = 196;
    const panelH = 44 + rows.length * rowH + 10;
    const panelX = CANVAS_WIDTH - panelW - 10;
    const panelY = ROOT_NAV_Y - panelH - 8;
    const offset = getSceneFixedShellViewportOffset(this);
    const overlay = this.add.container(offset.x, offset.y).setDepth(120).setScrollFactor(0);
    this.legionMenuOverlay = overlay;

    const dismiss = this.add.zone(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT).setOrigin(0)
      .setInteractive().setDepth(0).setScrollFactor(0);
    dismiss.on('pointerdown', () => {
      this.legionMenuOverlay?.destroy();
      this.legionMenuOverlay = undefined;
    });
    overlay.add(dismiss);

    const panel = this.add.graphics().setDepth(1);
    panel.fillStyle(DUNGEON_UI.VOID, 0.78);
    panel.fillRoundedRect(panelX + 3, panelY + 4, panelW, panelH, 12);
    panel.fillStyle(DUNGEON_UI.STONE, 1);
    panel.fillRoundedRect(panelX, panelY, panelW, panelH, 12);
    panel.lineStyle(1.5, DUNGEON_UI.BRASS, 0.82);
    panel.strokeRoundedRect(panelX, panelY, panelW, panelH, 12);
    overlay.add(panel);
    overlay.add(this.add.text(panelX + 14, panelY + 20, '군단 관리', {
      fontFamily: 'sans-serif', fontSize: '14px', fontStyle: 'bold', color: DUNGEON_UI_CSS.PARCHMENT,
    }).setOrigin(0, 0.5));
    overlay.add(this.add.text(panelX + panelW - 14, panelY + 20, '경로 선택', {
      fontFamily: 'sans-serif', fontSize: '10px', color: DUNGEON_UI_CSS.MUTED,
    }).setOrigin(1, 0.5));

    rows.forEach((row, index) => {
      const rowY = panelY + 34 + index * rowH;
      const rowBg = this.add.graphics().setDepth(1);
      rowBg.fillStyle(index % 2 === 0 ? DUNGEON_UI.SOOT : DUNGEON_UI.STONE_RAISED, 1);
      rowBg.fillRoundedRect(panelX + 8, rowY, panelW - 16, rowH - 2, 7);
      rowBg.lineStyle(1, DUNGEON_UI.IRON, 0.72);
      rowBg.strokeRoundedRect(panelX + 8, rowY, panelW - 16, rowH - 2, 7);
      drawLegionActionSigil(rowBg, row.action, panelX + 28, rowY + 22,
        index === 1 ? DUNGEON_UI.BRASS_BRIGHT : DUNGEON_UI.JADE, 0.88);
      overlay.add(rowBg);
      overlay.add(this.add.text(panelX + 50, rowY + (rowH - 2) / 2, row.label, {
        fontFamily: 'sans-serif', fontSize: '12px', fontStyle: 'bold', color: DUNGEON_UI_CSS.TEXT,
      }).setOrigin(0, 0.5));
      overlay.add(this.add.text(panelX + panelW - 22, rowY + (rowH - 2) / 2, '›', {
        fontFamily: 'sans-serif', fontSize: '20px', color: DUNGEON_UI_CSS.MUTED,
      }).setOrigin(0.5));
      const rowZone = this.add.zone(panelX + 8, rowY, panelW - 16, rowH - 2).setOrigin(0)
        .setDepth(2).setScrollFactor(0).setInteractive({ useHandCursor: true });
      rowZone.on('pointerdown', () => {
        overlay.destroy();
        this.legionMenuOverlay = undefined;
        row.onPress();
      });
      overlay.add(rowZone);
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
      if (this.detailOverlay || this.shopOverlay || this.legionMenuOverlay) return;
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

  private buildBtn(x: number, y: number, label: string, bgColor: number, cb: () => void): void {
    const w = label.length * 8 + 18;
    const g = this.add.graphics().setDepth(15);
    g.fillStyle(DUNGEON_UI.VOID, 1);
    g.fillRoundedRect(x - 4, y - 19, w, 44, 13);
    g.fillStyle(DUNGEON_UI.STONE, 1);
    g.fillRoundedRect(x - 4, y - 22, w, 44, 13);
    g.fillStyle(bgColor, 0.18);
    g.fillRoundedRect(x, y - 18, w - 8, 7, 3);
    g.lineStyle(1.5, bgColor, 0.78);
    g.strokeRoundedRect(x - 4, y - 22, w, 44, 13);
    this.add.text(x - 4 + w / 2, y, label, {
      fontFamily: 'sans-serif', fontSize: '11px', color: DUNGEON_UI_CSS.TEXT, fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(16);
    const zone = this.add.zone(x - 4, y - 22, w, 44).setOrigin(0).setDepth(16)
      .setInteractive({ useHandCursor: true });
    zone.on('pointerdown', cb);
  }
}
