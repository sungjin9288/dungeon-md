import Phaser from 'phaser';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../constants/layout';
import { COLORS, CSS } from '../constants/colors';
import {
  loadGameState,
  getRoomSlotCapacity,
  getUnlockedSlots,
  ROOM_SLOT_TYPE_DEFS,
  type DungeonSlot,
  type OwnedMonster,
  type RoomSlotType,
} from '../data/wisdom';
import { MONSTER_DEFS, getSkinForMonster, type MonsterDef, type MonsterId, type RarityId } from '../data/monsters';
import {
  ACTIVE_SKILLS, EQUIPMENT_DEFS,
  xpToNextLevel, getMonsterAtk,
} from '../data/barracks';
import { generatePortrait } from '../art/PortraitGenerator';
import { addPanelShadow, addInnerGlow } from '../ui/PanelDepth';
import { addFramedPanel } from '../ui/GameUiPrimitives';
import { showMonsterDetailPanel, showSkillShopPanel } from '../ui/MonsterDetailPanel';

const CARD_W  = 162;
const CARD_H  = 220;
const CARD_PAD = 10;
const CARD_START_X = 14;
const GROWTH_PANEL_Y = 88;
const GROWTH_PANEL_H = 112;
const SORT_CHIP_Y = GROWTH_PANEL_Y + GROWTH_PANEL_H + 8;
const FILTER_CHIP_Y = SORT_CHIP_Y + 28;
const CARD_START_Y = FILTER_CHIP_Y + 30;
const OWNED_RARITY_TO_TIER: readonly RarityId[] = ['C', 'U', 'R', 'E', 'L'];

const COLLECTION_RARITY_META: Record<RarityId, { rank: number; label: string; stars: string; color: number; css: string }> = {
  C: { rank: 0, label: 'COMMON', stars: '★',     color: 0x8f98a5, css: '#b9c0ca' },
  U: { rank: 1, label: 'UNIQUE', stars: '★★',    color: 0x58c681, css: '#8ff0ad' },
  R: { rank: 2, label: 'RARE',   stars: '★★★',   color: 0x62a8ff, css: '#9bc9ff' },
  E: { rank: 3, label: 'EPIC',   stars: '★★★★',  color: 0xc978ff, css: '#e3b4ff' },
  L: { rank: 4, label: 'LEGEND', stars: '★★★★★', color: 0xffc857, css: '#ffd878' },
};

const TRIBE_LABELS: Record<string, string> = {
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

const ELEMENT_META: Record<string, { label: string; icon: string; color: number }> = {
  fire:      { label: '화염', icon: '🔥', color: 0xff7a3d },
  frost:     { label: '서리', icon: '❄',  color: 0x7bdcff },
  lightning: { label: '번개', icon: '⚡', color: 0xffdf64 },
  dark:      { label: '암흑', icon: '☾',  color: 0xc181ff },
  holy:      { label: '신성', icon: '✦',  color: 0xffe8a3 },
};

type BarracksSortKey = 'level' | 'atk' | 'rarity';
type BarracksFilterType = 'all' | 'melee' | 'ranged' | 'magic' | 'support';

interface BarracksStats {
  totalPower: number;
  ownedCount: number;
  spReady: number;
  levelReady: number;
  equippedCount: number;
  deployedCount: number;
  equipmentInventory: number;
  strongest?: OwnedMonster;
  skillTarget?: OwnedMonster;
  levelTarget?: OwnedMonster;
  gearTarget?: OwnedMonster;
}

interface BarracksDirective {
  title: string;
  body: string;
  cta: string;
  accent: number;
  targetMonster?: OwnedMonster;
}

interface MonsterRoomPlan {
  label: string;
  subLabel: string;
  accent: number;
  kind: 'deployed' | 'recommended' | 'repair' | 'design' | 'locked';
}

interface MonsterCardActionCue {
  icon: string;
  label: string;
  subLabel: string;
  chip: string;
  accent: number;
  fill: number;
  textColor: string;
}

export class BarracksScene extends Phaser.Scene {
  private gs = loadGameState();
  private scrollY    = 0;
  private maxScrollY = 0;
  private contentContainer!: Phaser.GameObjects.Container;
  private detailOverlay?: Phaser.GameObjects.Container;
  private shopOverlay?:   Phaser.GameObjects.Container;
  private sortKey: BarracksSortKey = 'level';
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
    const g = this.add.graphics().setDepth(-10);
    g.fillStyle(COLORS.BLACK, 1);
    g.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    // Stone tile grid
    for (let x = 0; x < CANVAS_WIDTH; x += 36)
      for (let y = 0; y < CANVAS_HEIGHT; y += 36) {
        g.lineStyle(0.3, COLORS.STONE_MID, 0.2);
        g.strokeRect(x, y, 36, 36);
      }
    // Training hall floor behind the roster.
    g.fillStyle(0x17120c, 0.64);
    g.fillRoundedRect(8, CARD_START_Y - 10, CANVAS_WIDTH - 16, CANVAS_HEIGHT - CARD_START_Y - 86, 12);
    g.lineStyle(1, COLORS.STONE_LIGHT, 0.16);
    for (let y = CARD_START_Y + 22; y < CANVAS_HEIGHT - 92; y += 46) {
      g.lineBetween(18, y, CANVAS_WIDTH - 18, y);
    }
    for (const x of [42, CANVAS_WIDTH - 42]) {
      g.fillStyle(COLORS.TORCH_GLOW, 0.14);
      g.fillCircle(x, 142, 38);
      g.fillStyle(COLORS.TORCH_AMBER, 0.74);
      g.fillCircle(x, 142, 4);
    }
    // Top accent bar
    g.fillStyle(COLORS.STONE_DARK, 1);
    g.fillRect(0, 0, CANVAS_WIDTH, 88);
    g.lineStyle(2, COLORS.TORCH_GOLD, 0.6);
    g.lineBetween(0, 88, CANVAS_WIDTH, 88);
  }

  private drawHeader(): void {
    this.add.text(CANVAS_WIDTH / 2, 24, '몬스터 성장소', {
      fontFamily: 'Georgia, serif', fontSize: '22px', fontStyle: 'bold',
      color: CSS.TORCH_AMBER,
    }).setOrigin(0.5).setDepth(10);

    const power = this.gs.ownedMonsters.reduce((s, m) => {
      const def = MONSTER_DEFS[m.id as keyof typeof MONSTER_DEFS];
      return s + getMonsterAtk(def?.baseDamage ?? 10, m.level, m.spentSkills);
    }, 0);

    this.add.text(CANVAS_WIDTH / 2, 52, `총 전투력 ${power}`, {
      fontFamily: 'sans-serif', fontSize: '13px', color: CSS.PARCHMENT_MUTED,
    }).setOrigin(0.5).setDepth(10);

    if (this.focusSourceLabel) {
      this.drawHeaderStatusChip(
        CANVAS_WIDTH / 2 - 96,
        62,
        192,
        18,
        `${this.focusSourceLabel} 성장 관리`,
        0x44ccaa,
      );
    } else {
      this.drawCollectionProgressChip(CANVAS_WIDTH / 2 - 96, 62, 192, 18);
    }

    // Back button
    this.buildBtn(24, 24, '← 뒤로', 0x2d2416, () => this.scene.start('DungeonHomeScene'));
    if (this.focusRoomSlotIdx !== null) {
      this.buildBtn(CANVAS_WIDTH - 76, 24, '방 복귀', 0x0c211b, () => this.returnToFocusedRoom());
    }
  }

  private drawHeaderStatusChip(
    x: number,
    y: number,
    w: number,
    h: number,
    label: string,
    accent: number,
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
      fontFamily: 'Georgia, serif',
      fontSize: '10px',
      color: '#d7fff4',
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(11);
    this.add.text(x + 29, y + h / 2, label, {
      fontFamily: 'sans-serif',
      fontSize: '10px',
      color: '#b8fff0',
      fontStyle: 'bold',
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
    g.fillStyle(0x8bdcff, 0.22);
    g.fillRoundedRect(x + 31, y + h - 5, Math.max(5, (w - 84) * summary.percent), 3, 2);

    this.add.text(x + 14, y + h / 2, '★', {
      fontFamily: 'Georgia, serif',
      fontSize: '11px',
      color: '#ffe6ff',
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(11);
    this.add.text(x + 30, y + 7, `도감 ${summary.owned}/${summary.total}`, {
      fontFamily: 'sans-serif',
      fontSize: '9px',
      color: '#ffd6f6',
      fontStyle: 'bold',
    }).setOrigin(0, 0.5).setDepth(11);
    this.add.text(x + w - 36, y + 7, `R+ ${summary.rareOwned}`, {
      fontFamily: 'monospace',
      fontSize: '8px',
      color: '#8bdcff',
      fontStyle: 'bold',
    }).setOrigin(1, 0.5).setDepth(11);
    this.add.text(x + w - 8, y + 7, `L ${summary.legendaryOwned}`, {
      fontFamily: 'monospace',
      fontSize: '8px',
      color: '#ffd878',
      fontStyle: 'bold',
    }).setOrigin(1, 0.5).setDepth(11);
  }

  private getCollectionSummary(): {
    owned: number;
    total: number;
    rareOwned: number;
    legendaryOwned: number;
    percent: number;
  } {
    const ownedTypes = new Set<string>();
    const allIds = Object.keys(MONSTER_DEFS);
    for (const monster of this.gs.ownedMonsters) {
      const typeId = allIds.find(id => monster.id === id || monster.id.startsWith(`${id}_`));
      if (typeId) ownedTypes.add(typeId);
    }
    const rareOwned = Array.from(ownedTypes).filter(id => {
      const rarity = MONSTER_DEFS[id as keyof typeof MONSTER_DEFS]?.rarityTier;
      return rarity === 'R' || rarity === 'E' || rarity === 'L';
    }).length;
    const legendaryOwned = Array.from(ownedTypes).filter(id => (
      MONSTER_DEFS[id as keyof typeof MONSTER_DEFS]?.rarityTier === 'L'
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
    const stats = this.getBarracksStats();
    const directive = this.getBarracksDirective(stats);
    const x = 14, y = GROWTH_PANEL_Y, w = CANVAS_WIDTH - 28, h = GROWTH_PANEL_H;

    const frame = addFramedPanel(this, {
      x,
      y,
      w,
      h,
      radius: 10,
      fillColor: 0x1a1712,
      borderColor: directive.accent,
      borderAlpha: 0.74,
      borderWidth: 1.5,
      accentColor: directive.accent,
      accentAlpha: 0.52,
      glowColor: directive.accent,
      glowOpacity: 0.09,
      shadowOpacity: 0.46,
      shadowOffsetY: 4,
    });
    frame.shadow.setDepth(7);
    frame.panel.setDepth(8);
    frame.glow.setDepth(9);

    const displayMonster = directive.targetMonster ?? stats.strongest;
    const roomPlan = displayMonster ? this.getMonsterRoomPlan(displayMonster) : null;
    this.drawTrainingFocusStage(displayMonster, x + 12, y + 12, 78, h - 24, directive.accent);

    this.add.text(x + 94, y + 17, this.focusSourceLabel ? this.focusSourceLabel : '성장 지휘', {
      fontFamily: 'sans-serif', fontSize: '10px', fontStyle: 'bold', color: '#89d6c2',
    }).setOrigin(0, 0.5).setDepth(11);
    this.add.text(x + 94, y + 34, directive.title, {
      fontFamily: 'Georgia, serif', fontSize: '15px', fontStyle: 'bold', color: CSS.PARCHMENT,
    }).setOrigin(0, 0.5).setDepth(11);
    this.add.text(x + 94, y + 52, directive.body, {
      fontFamily: 'sans-serif', fontSize: '10px', color: CSS.PARCHMENT_DIM,
    }).setOrigin(0, 0.5).setDepth(11);

    const opsScore = this.getTrainingOpsScore(stats);
    this.drawTrainingOpsMeter(x + 94, y + 64, 178, opsScore, directive.accent);
    const statY = y + 86;
    this.drawMiniStat(x + 92, statY, 44, '전투', String(stats.totalPower), 0xff9d41);
    this.drawMiniStat(x + 140, statY, 44, '대기', String(stats.spReady + stats.levelReady), 0x88ddff);
    this.drawMiniStat(x + 188, statY, 44, '배치', `${stats.deployedCount}/${stats.ownedCount}`, 0xa4e06f);
    this.drawMiniStat(x + 236, statY, 44, '장비', `${stats.equippedCount}/${Math.max(1, stats.ownedCount)}`, COLORS.TORCH_AMBER);

    const ctaX = x + w - 72;
    const ctaY = y + 13;
    const cta = this.add.graphics().setDepth(10);
    cta.fillStyle(0x020609, 0.34);
    cta.fillRoundedRect(ctaX, ctaY + 3, 58, 30, 7);
    cta.fillStyle(directive.accent, directive.targetMonster ? 0.95 : 0.36);
    cta.fillRoundedRect(ctaX, ctaY, 58, 30, 7);
    cta.fillStyle(0xffffff, directive.targetMonster ? 0.14 : 0.07);
    cta.fillRoundedRect(ctaX + 5, ctaY + 5, 48, 6, 3);
    cta.lineStyle(1, 0xffffff, 0.26);
    cta.strokeRoundedRect(ctaX, ctaY, 58, 30, 7);
    this.add.text(ctaX + 29, ctaY + 15, directive.cta, {
      fontFamily: 'sans-serif', fontSize: '10px', fontStyle: 'bold',
      color: directive.targetMonster ? '#10110b' : CSS.PARCHMENT_DIM,
    }).setOrigin(0.5).setDepth(11);

    const cue = this.add.text(ctaX + 29, y + 68, roomPlan?.label ?? `${stats.equippedCount}/${stats.equipmentInventory} 장비`, {
      fontFamily: 'sans-serif', fontSize: '9px', color: roomPlan ? `#${roomPlan.accent.toString(16).padStart(6, '0')}` : CSS.PARCHMENT_MUTED,
      fontStyle: roomPlan ? 'bold' : 'normal',
    }).setOrigin(0.5).setDepth(11);
    cue.setAlpha(0.9);
    if (roomPlan) {
      this.add.text(ctaX + 29, y + 84, this.truncateLabel(roomPlan.subLabel, 10), {
        fontFamily: 'sans-serif',
        fontSize: '8px',
        color: CSS.PARCHMENT_DIM,
      }).setOrigin(0.5).setDepth(11);
    }

    if (directive.targetMonster) {
      const target = directive.targetMonster;
      const zone = this.add.zone(ctaX + 29, ctaY + 15, 64, 38)
        .setDepth(12)
        .setInteractive({ useHandCursor: true });
      zone.on('pointerdown', () => this.showMonsterDetail(target));
    }
  }

  private drawTrainingFocusStage(
    monster: OwnedMonster | undefined,
    x: number,
    y: number,
    w: number,
    h: number,
    accent: number,
  ): void {
    const g = this.add.graphics().setDepth(10);
    g.fillStyle(0x07110f, 0.96);
    g.fillRoundedRect(x, y, w, h, 9);
    g.fillStyle(accent, 0.09);
    g.fillRoundedRect(x + 6, y + 17, w - 12, h - 29, 8);
    g.lineStyle(1, accent, 0.36);
    g.strokeRoundedRect(x, y, w, h, 9);
    g.lineStyle(1, 0xffffff, 0.12);
    g.strokeRoundedRect(x + 4, y + 4, w - 8, h - 8, 6);
    g.fillStyle(0xffffff, 0.07);
    g.fillRoundedRect(x + 8, y + 7, w - 16, 3, 2);
    g.fillStyle(accent, 0.18);
    g.fillEllipse(x + w / 2, y + 55, w - 22, 14);
    g.fillStyle(0x020609, 0.42);
    g.fillEllipse(x + w / 2, y + 58, w - 30, 7);

    this.add.text(x + w / 2, y + 10, monster ? '성장 대상' : '대기 슬롯', {
      fontFamily: 'sans-serif',
      fontSize: '8px',
      fontStyle: 'bold',
      color: monster ? '#b8fff0' : CSS.PARCHMENT_MUTED,
    }).setOrigin(0.5).setDepth(12);

    if (!monster) {
      this.add.text(x + w / 2, y + 43, '소환', {
        fontFamily: 'sans-serif',
        fontSize: '16px',
        fontStyle: 'bold',
        color: CSS.TORCH_AMBER,
      }).setOrigin(0.5).setDepth(12);
      this.add.text(x + w / 2, y + h - 15, '군단 확장', {
        fontFamily: 'sans-serif',
        fontSize: '9px',
        color: CSS.PARCHMENT_MUTED,
      }).setOrigin(0.5).setDepth(12);
      return;
    }

    const def = MONSTER_DEFS[monster.id as keyof typeof MONSTER_DEFS];
    const collectionMeta = def ? this.getMonsterCollectionMeta(monster, def) : null;
    const atk = getMonsterAtk(def?.baseDamage ?? 10, monster.level, monster.spentSkills);
    this.drawMonsterBust(monster, x + w / 2, y + 43, 52, 12);
    if (collectionMeta) {
      g.fillStyle(collectionMeta.color, 0.20);
      g.fillRoundedRect(x + w - 30, y + 18, 23, 14, 5);
      g.lineStyle(1, collectionMeta.color, 0.68);
      g.strokeRoundedRect(x + w - 30, y + 18, 23, 14, 5);
      g.fillStyle(collectionMeta.elementColor, 0.20);
      g.fillCircle(x + w - 15, y + h - 18, 8);
      g.lineStyle(1, collectionMeta.elementColor, 0.46);
      g.strokeCircle(x + w - 15, y + h - 18, 8);
      g.fillStyle(0xffffff, 0.14);
      g.fillCircle(x + w - 18, y + h - 21, 2);

      this.add.text(x + w - 18.5, y + 25, collectionMeta.tier, {
        fontFamily: 'monospace',
        fontSize: '8px',
        fontStyle: 'bold',
        color: collectionMeta.css,
      }).setOrigin(0.5).setDepth(12);
      this.add.text(x + w - 15, y + h - 18, collectionMeta.elementIcon, {
        fontFamily: 'sans-serif',
        fontSize: '9px',
        color: '#ffffff',
      }).setOrigin(0.5).setDepth(12);
      this.add.text(x + 10, y + h - 18, collectionMeta.stars, {
        fontFamily: 'Georgia, serif',
        fontSize: '7px',
        color: collectionMeta.css,
      }).setOrigin(0, 0.5).setDepth(12);
    }

    const name = this.truncateLabel(def?.name ?? '수호자', 6);
    this.add.text(x + w / 2, y + h - 24, name, {
      fontFamily: 'sans-serif',
      fontSize: '9px',
      fontStyle: 'bold',
      color: CSS.PARCHMENT,
    }).setOrigin(0.5).setDepth(12);
    this.add.text(x + w / 2, y + h - 10, `Lv.${monster.level}  ATK ${atk}`, {
      fontFamily: 'monospace',
      fontSize: '8px',
      color: '#ffcf78',
    }).setOrigin(0.5).setDepth(12);
  }

  private drawTrainingOpsMeter(x: number, y: number, w: number, pct: number, color: number): void {
    const clamped = Phaser.Math.Clamp(pct, 0, 100);
    const g = this.add.graphics().setDepth(9);
    g.fillStyle(0x0a1110, 0.92);
    g.fillRoundedRect(x, y, w, 16, 5);
    g.lineStyle(1, color, 0.38);
    g.strokeRoundedRect(x, y, w, 16, 5);
    g.fillStyle(0x1d2722, 1);
    g.fillRoundedRect(x + 46, y + 6, w - 88, 4, 2);
    g.fillStyle(color, 0.86);
    g.fillRoundedRect(x + 46, y + 6, Math.max(5, (w - 88) * (clamped / 100)), 4, 2);

    this.add.text(x + 8, y + 8, '육성도', {
      fontFamily: 'sans-serif',
      fontSize: '8px',
      color: CSS.PARCHMENT_MUTED,
    }).setOrigin(0, 0.5).setDepth(10);
    this.add.text(x + w - 8, y + 8, `${clamped}%`, {
      fontFamily: 'sans-serif',
      fontSize: '9px',
      fontStyle: 'bold',
      color: `#${color.toString(16).padStart(6, '0')}`,
    }).setOrigin(1, 0.5).setDepth(10);
  }

  private drawMiniStat(x: number, y: number, w: number, label: string, value: string, color: number): void {
    const g = this.add.graphics().setDepth(9);
    g.fillStyle(0x0d1110, 0.86);
    g.fillRoundedRect(x, y, w, 22, 5);
    g.lineStyle(1, color, 0.32);
    g.strokeRoundedRect(x, y, w, 22, 5);
    this.add.text(x + 6, y + 7, label, {
      fontFamily: 'sans-serif', fontSize: w < 50 ? '7px' : '8px', color: CSS.PARCHMENT_MUTED,
    }).setOrigin(0, 0.5).setDepth(10);
    this.add.text(x + w - 6, y + 14, value, {
      fontFamily: 'sans-serif', fontSize: w < 50 ? '9px' : '10px', fontStyle: 'bold',
      color: `#${color.toString(16).padStart(6, '0')}`,
    }).setOrigin(1, 0.5).setDepth(10);
  }

  // ─── Sort chips ───────────────────────────────────────────────────────────────

  private buildSortChips(): void {
    const KEYS: Array<{ key: BarracksSortKey; label: string }> = [
      { key: 'level',  label: '레벨 ↓' },
      { key: 'atk',    label: '공격력' },
      { key: 'rarity', label: '희귀도' },
    ];
    const chipW = 88, chipH = 22, chipGap = 10;
    const totalW = KEYS.length * chipW + (KEYS.length - 1) * chipGap;
    const startX = (CANVAS_WIDTH - totalW) / 2;
    const chipY = SORT_CHIP_Y;

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
    let focusCardY: number | null = null;

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
    const cardY0 = CARD_START_Y;

    sorted.forEach((m, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x   = CARD_START_X + col * (CARD_W + CARD_PAD);
      const y   = cardY0 + row * (CARD_H + CARD_PAD);
      if (this.focusMonsterId === m.id) focusCardY = y;
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
    if (focusCardY !== null) {
      this.scrollY = Phaser.Math.Clamp(focusCardY - CARD_START_Y + 12, 0, this.maxScrollY);
      this.contentContainer.setY(-this.scrollY);
    }
  }

  private buildMonsterCard(m: OwnedMonster, x: number, y: number): void {
    const def = MONSTER_DEFS[m.id as keyof typeof MONSTER_DEFS];
    if (!def) return;
    const isFocused = this.focusMonsterId === m.id;
    const collectionMeta = this.getMonsterCollectionMeta(m, def);

    // Card background — border color by rarity
    const rarity = collectionMeta.rank;
    const borderColor = collectionMeta.color;
    const borderAlpha = rarity >= 4 ? 1 : rarity >= 2 ? 0.9 : 0.72;
    const xpNeeded = xpToNextLevel(m.level);
    const xpPct    = m.level >= 50 ? 1 : Math.min(1, m.xp / xpNeeded);
    const sp = m.skillPoints ?? 0;
    const typeMeta = this.getMonsterTypeMeta(def.type);
    const deployedIds = this.getDeployedMonsterIds();
    const isDeployed = deployedIds.has(m.id);
    // Drop shadow beneath the card
    this.contentContainer.add(
      addPanelShadow(this, x, y, CARD_W, CARD_H, 10, { offsetY: 3, opacity: 0.55 }),
    );
    if (isFocused) {
      const focus = this.add.graphics();
      focus.fillStyle(0x44ccaa, 0.08);
      focus.fillRoundedRect(x - 4, y - 4, CARD_W + 8, CARD_H + 8, 12);
      focus.lineStyle(2, 0x88ffdd, 0.92);
      focus.strokeRoundedRect(x - 4, y - 4, CARD_W + 8, CARD_H + 8, 12);
      focus.lineStyle(1, 0xffffff, 0.24);
      focus.strokeRoundedRect(x + 2, y + 2, CARD_W - 4, CARD_H - 4, 8);
      this.tweens.add({
        targets: focus,
        alpha: { from: 0.72, to: 1 },
        duration: 720,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
      this.contentContainer.add(focus);
    }
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

    const chamber = this.add.graphics();
    chamber.fillStyle(0x071010, 0.86);
    chamber.fillRoundedRect(x + 9, y + 20, CARD_W - 18, 62, 8);
    chamber.fillStyle(typeMeta.color, 0.10);
    chamber.fillRoundedRect(x + 14, y + 27, CARD_W - 28, 41, 7);
    chamber.fillStyle(0xffffff, 0.06);
    chamber.fillRoundedRect(x + 18, y + 25, CARD_W - 36, 4, 2);
    chamber.fillStyle(typeMeta.color, 0.18);
    chamber.fillEllipse(x + CARD_W / 2, y + 68, CARD_W - 54, 12);
    chamber.fillStyle(0x020609, 0.35);
    chamber.fillEllipse(x + CARD_W / 2, y + 72, CARD_W - 72, 6);
    chamber.lineStyle(1, typeMeta.color, 0.34);
    chamber.strokeRoundedRect(x + 9, y + 20, CARD_W - 18, 62, 8);
    chamber.fillStyle(typeMeta.color, 0.18);
    chamber.fillRoundedRect(x + 14, y + 75, CARD_W - 28, 4, 2);
    this.contentContainer.add(chamber);
    this.drawMonsterCardPortraitHalo(x, y, collectionMeta, typeMeta.color, xpPct, isDeployed, sp);
    this.drawMonsterCardCollectionHeader(x, y, collectionMeta, typeMeta.color, isDeployed, xpPct, sp);

    const typeRibbon = this.add.text(x + 10, y + 10, typeMeta.label, {
      fontFamily: 'sans-serif', fontSize: '8px', fontStyle: 'bold',
      color: typeMeta.text,
      backgroundColor: '#111615',
      padding: { x: 4, y: 2 },
    }).setOrigin(0, 0.5);
    this.contentContainer.add(typeRibbon);

    if (isFocused) {
      const focusChip = this.add.text(x + 10, y + 12, '방 선택', {
        fontFamily: 'sans-serif',
        fontSize: '9px',
        color: '#061016',
        fontStyle: 'bold',
        backgroundColor: '#88ffdd',
        padding: { x: 5, y: 2 },
      }).setOrigin(0, 0.5);
      this.contentContainer.add(focusChip);
    }

    // Monster portrait / emoji — apply skin if equipped
    const cardSkin = getSkinForMonster(m.id, this.gs.equippedSkins ?? {});
    const cardPortraitKey = generatePortrait(this, m.id as MonsterId, cardSkin?.id);
    if (this.textures.exists(cardPortraitKey)) {
      const cardPortrait = this.add.image(x + CARD_W / 2, y + 48, cardPortraitKey)
        .setOrigin(0.5).setDisplaySize(54, 54);
      this.contentContainer.add(cardPortrait);
    } else {
      const emoji = this.add.text(x + CARD_W / 2, y + 48, cardSkin ? cardSkin.emoji : def.emoji, {
        fontFamily: 'sans-serif', fontSize: '48px',
      }).setOrigin(0.5);
      this.contentContainer.add(emoji);
    }
    this.drawCollectionCardStickers(x, y, collectionMeta, typeMeta.color);

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
    const nameT = this.add.text(x + CARD_W / 2, y + 91, def.name, {
      fontFamily: 'Georgia, serif', fontSize: '12px', color: CSS.PARCHMENT,
    }).setOrigin(0.5);
    this.contentContainer.add(nameT);

    // ATK stat
    const atk = getMonsterAtk(def.baseDamage, m.level, m.spentSkills);
    const atkT = this.add.text(x + CARD_W / 2, y + 106, `ATK ${atk}`, {
      fontFamily: 'sans-serif', fontSize: '11px', color: '#ff9944',
    }).setOrigin(0.5);
    this.contentContainer.add(atkT);

    // XP bar
    const barW = CARD_W - 20;
    const barBg = this.add.graphics();
    barBg.fillStyle(0x1a1a1a, 1);
    barBg.fillRoundedRect(x + 10, y + 121, barW, 9, 3);
    barBg.fillStyle(xpPct >= 0.82 ? 0x55d4ff : 0x44aa44, 1);
    barBg.fillRoundedRect(x + 10, y + 121, Math.round(barW * xpPct), 9, 3);
    this.contentContainer.add(barBg);

    const xpT = this.add.text(x + CARD_W / 2, y + 125, m.level >= 50 ? 'MAX' : `XP ${Math.round(xpPct * 100)}%`, {
      fontFamily: 'sans-serif', fontSize: '10px', color: '#dfffe0',
    }).setOrigin(0.5);
    this.contentContainer.add(xpT);

    // Room assignment / recommendation chip
    const roomPlan = this.getMonsterRoomPlan(m);
    const roomPlanG = this.add.graphics();
    roomPlanG.fillStyle(0x0b1010, 0.92);
    roomPlanG.fillRoundedRect(x + 13, y + 138, CARD_W - 26, 17, 5);
    roomPlanG.lineStyle(1, roomPlan.accent, roomPlan.kind === 'deployed' ? 0.66 : 0.42);
    roomPlanG.strokeRoundedRect(x + 13, y + 138, CARD_W - 26, 17, 5);
    roomPlanG.fillStyle(roomPlan.accent, roomPlan.kind === 'deployed' ? 0.16 : 0.08);
    roomPlanG.fillRoundedRect(x + 16, y + 141, 4, 11, 3);
    this.contentContainer.add(roomPlanG);
    const roomPlanT = this.add.text(x + CARD_W / 2, y + 146.5, this.truncateLabel(roomPlan.label, 13), {
      fontFamily: 'sans-serif',
      fontSize: '8px',
      color: roomPlan.kind === 'deployed' ? '#e8fff3' : '#d8c7a0',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    this.contentContainer.add(roomPlanT);

    // Skill chips
    const equippedSkills = m.equippedSkills ?? [];
    const skillsText = equippedSkills.length > 0
      ? equippedSkills.map(sk => ACTIVE_SKILLS.find(s => s.id === sk)?.icon ?? '?').join(' ')
      : '스킬';
    const skillT = this.add.text(x + 20, y + 164, skillsText, {
      fontFamily: 'sans-serif', fontSize: '9px', color: equippedSkills.length > 0 ? '#aaaaff' : '#cc9060',
    }).setOrigin(0.5);
    this.contentContainer.add(skillT);

    // Equipment slot
    const eqId  = m.equipment;
    const eqDef = this.getEquipmentDisplay(eqId);
    const eqBg  = this.add.graphics();
    eqBg.fillStyle(eqDef ? 0x3a2800 : 0x1a1a1a, 1);
    eqBg.fillRoundedRect(x + 35, y + 156, CARD_W - 50, 21, 6);
    eqBg.lineStyle(1.5, eqDef ? COLORS.TORCH_GOLD : 0x444444, 0.7);
    eqBg.strokeRoundedRect(x + 35, y + 156, CARD_W - 50, 21, 6);
    this.contentContainer.add(eqBg);
    const eqT = this.add.text(x + CARD_W / 2 + 10, y + 166.5, eqDef ? `${eqDef.icon} ${this.truncateLabel(eqDef.name, 7)}` : '장비 제작 추천', {
      fontFamily: 'sans-serif', fontSize: '9px', color: eqDef ? CSS.TORCH_AMBER : '#666666',
    }).setOrigin(0.5);
    this.contentContainer.add(eqT);

    const actionCue = this.getMonsterCardActionCue(m, xpPct, Boolean(eqDef), isDeployed, roomPlan);
    const actionBg = this.add.graphics();
    actionBg.fillStyle(0x020609, 0.34);
    actionBg.fillRoundedRect(x + 12, y + 187, CARD_W - 24, 25, 7);
    actionBg.fillStyle(actionCue.fill, 0.98);
    actionBg.fillRoundedRect(x + 10, y + 184, CARD_W - 20, 27, 7);
    actionBg.fillStyle(actionCue.accent, 0.16);
    actionBg.fillRoundedRect(x + 15, y + 189, 27, 17, 6);
    actionBg.fillStyle(0x070b08, 0.78);
    actionBg.fillRoundedRect(x + CARD_W - 55, y + 189, 38, 16, 6);
    actionBg.lineStyle(1.3, actionCue.accent, 0.62);
    actionBg.strokeRoundedRect(x + 10, y + 184, CARD_W - 20, 27, 7);
    actionBg.lineStyle(1, 0xffffff, 0.10);
    actionBg.lineBetween(x + 47, y + 190, x + 47, y + 205);
    this.contentContainer.add(actionBg);
    this.contentContainer.add(this.add.text(x + 28.5, y + 197, actionCue.icon, {
      fontFamily: 'sans-serif',
      fontSize: '13px',
    }).setOrigin(0.5));
    this.contentContainer.add(this.add.text(x + 53, y + 193, this.truncateLabel(actionCue.label, 7), {
      fontFamily: 'sans-serif',
      fontSize: '9px',
      fontStyle: 'bold',
      color: actionCue.textColor,
    }).setOrigin(0, 0.5));
    this.contentContainer.add(this.add.text(x + 53, y + 204, this.truncateLabel(actionCue.subLabel, 10), {
      fontFamily: 'sans-serif',
      fontSize: '7px',
      color: CSS.PARCHMENT_MUTED,
    }).setOrigin(0, 0.5));
    this.contentContainer.add(this.add.text(x + CARD_W - 36, y + 197, actionCue.chip, {
      fontFamily: 'sans-serif',
      fontSize: '8px',
      fontStyle: 'bold',
      color: `#${actionCue.accent.toString(16).padStart(6, '0')}`,
    }).setOrigin(0.5));

    // SP quick-stat badge — top-right corner (red circle, only when unspent SP > 0)
    if (sp > 0) {
      const spBadgeBg = this.add.graphics();
      spBadgeBg.fillStyle(0xdd2222, 1);
      spBadgeBg.fillRoundedRect(x + CARD_W - 38, y + 27, 32, 15, 4);
      this.contentContainer.add(spBadgeBg);
      const spBadgeT = this.add.text(x + CARD_W - 22, y + 34, `SP ${sp > 9 ? '9+' : sp}`, {
        fontFamily: 'sans-serif', fontSize: '8px', fontStyle: 'bold', color: '#ffffff',
      }).setOrigin(0.5);
      this.contentContainer.add(spBadgeT);
    }

    // Tap zone
    const zone = this.add.zone(x + CARD_W / 2, y + CARD_H / 2, CARD_W, CARD_H).setInteractive();
    zone.on('pointerdown', () => this.showMonsterDetail(m));
    this.contentContainer.add(zone);
  }

  private getMonsterCollectionMeta(monster: OwnedMonster, def: MonsterDef): {
    indexLabel: string;
    tier: RarityId;
    rank: number;
    label: string;
    stars: string;
    color: number;
    css: string;
    tribeLabel: string;
    elementLabel: string;
    elementIcon: string;
    elementColor: number;
  } {
    const allIds = Object.keys(MONSTER_DEFS);
    const index = Math.max(0, allIds.indexOf(def.id));
    const tier = def.rarityTier ?? OWNED_RARITY_TO_TIER[monster.rarity ?? 0] ?? 'C';
    const rarity = COLLECTION_RARITY_META[tier];
    const element = def.element ? ELEMENT_META[def.element] : null;
    return {
      indexLabel:  `No.${String(index + 1).padStart(3, '0')}`,
      tier,
      rank:        rarity.rank,
      label:       rarity.label,
      stars:       rarity.stars,
      color:       rarity.color,
      css:         rarity.css,
      tribeLabel:  def.tribe ? TRIBE_LABELS[def.tribe] ?? '수호' : '수호',
      elementLabel: element?.label ?? '무속',
      elementIcon:  element?.icon ?? '◆',
      elementColor: element?.color ?? COLORS.TORCH_AMBER,
    };
  }

  private drawMonsterCardCollectionHeader(
    x: number,
    y: number,
    meta: ReturnType<BarracksScene['getMonsterCollectionMeta']>,
    typeColor: number,
    isDeployed: boolean,
    xpPct: number,
    skillPoints: number,
  ): void {
    const g = this.add.graphics();
    const readyColor = skillPoints > 0 ? 0xff5f5f : xpPct >= 0.82 ? 0x55d4ff : typeColor;
    const railW = CARD_W - 16;
    const fillW = Math.max(18, Math.round((railW - 42) * Phaser.Math.Clamp(xpPct, 0, 1)));

    g.fillStyle(0x030706, 0.92);
    g.fillRoundedRect(x + 8, y + 6, railW, 18, 6);
    g.fillStyle(meta.color, meta.rank >= 3 ? 0.20 : 0.12);
    g.fillRoundedRect(x + 11, y + 9, railW - 6, 5, 3);
    g.fillStyle(readyColor, 0.24);
    g.fillRoundedRect(x + 38, y + 17, fillW, 3, 2);
    g.lineStyle(meta.rank >= 4 ? 1.4 : 1, meta.color, meta.rank >= 3 ? 0.82 : 0.54);
    g.strokeRoundedRect(x + 8, y + 6, railW, 18, 6);

    g.fillStyle(meta.color, 0.20);
    g.fillCircle(x + 19, y + 15, 8);
    g.lineStyle(1, meta.color, 0.62);
    g.strokeCircle(x + 19, y + 15, 8);
    g.fillStyle(0xffffff, 0.22);
    g.fillCircle(x + 16, y + 12, 1.6);

    if (isDeployed) {
      g.fillStyle(0x071611, 0.98);
      g.fillRoundedRect(x + CARD_W - 58, y + 25, 48, 14, 5);
      g.lineStyle(1, 0x89f0b8, 0.62);
      g.strokeRoundedRect(x + CARD_W - 58, y + 25, 48, 14, 5);
    }
    this.contentContainer.add(g);

    this.contentContainer.add(this.add.text(x + 19, y + 15, meta.tier, {
      fontFamily: 'Georgia, serif',
      fontSize: '8px',
      fontStyle: 'bold',
      color: meta.css,
    }).setOrigin(0.5));
    this.contentContainer.add(this.add.text(x + 32, y + 15, meta.label, {
      fontFamily: 'sans-serif',
      fontSize: '7px',
      fontStyle: 'bold',
      color: meta.css,
    }).setOrigin(0, 0.5));
    this.contentContainer.add(this.add.text(x + CARD_W / 2, y + 20, meta.stars, {
      fontFamily: 'Georgia, serif',
      fontSize: '7px',
      color: meta.css,
    }).setOrigin(0.5));

    if (isDeployed) {
      this.contentContainer.add(this.add.text(x + CARD_W - 34, y + 32, '배치중', {
        fontFamily: 'sans-serif',
        fontSize: '7px',
        fontStyle: 'bold',
        color: '#b8ffd8',
      }).setOrigin(0.5));
    }
  }

  private drawMonsterCardPortraitHalo(
    x: number,
    y: number,
    meta: ReturnType<BarracksScene['getMonsterCollectionMeta']>,
    typeColor: number,
    xpPct: number,
    isDeployed: boolean,
    skillPoints: number,
  ): void {
    const g = this.add.graphics();
    const cx = x + CARD_W / 2;
    const cy = y + 49;
    const ready = skillPoints > 0 || xpPct >= 0.82;
    const haloColor = skillPoints > 0 ? 0xff5f5f : xpPct >= 0.82 ? 0x55d4ff : meta.color;

    g.fillStyle(typeColor, 0.055);
    g.fillCircle(cx, cy, 35);
    g.lineStyle(meta.rank >= 3 ? 1.5 : 1, meta.color, meta.rank >= 3 ? 0.52 : 0.30);
    g.strokeCircle(cx, cy, 31);
    g.lineStyle(1, typeColor, 0.26);
    g.strokeCircle(cx, cy, 24);
    g.fillStyle(0x020609, 0.42);
    g.fillEllipse(cx, cy + 27, 68, 12);

    if (ready) {
      g.fillStyle(haloColor, 0.14);
      g.fillCircle(cx, cy, 38);
      g.lineStyle(1.4, haloColor, 0.62);
      g.beginPath();
      g.arc(cx, cy, 35, Phaser.Math.DegToRad(-88), Phaser.Math.DegToRad(64 + xpPct * 210));
      g.strokePath();
    }

    if (isDeployed) {
      g.fillStyle(0x89f0b8, 0.88);
      g.fillCircle(cx + 31, cy + 23, 5.5);
      g.lineStyle(1, 0x06100d, 0.62);
      g.strokeCircle(cx + 31, cy + 23, 5.5);
    }
    this.contentContainer.add(g);

    if (ready) {
      this.contentContainer.add(this.add.text(cx - 31, cy + 24, skillPoints > 0 ? 'SP' : 'UP', {
        fontFamily: 'sans-serif',
        fontSize: '7px',
        fontStyle: 'bold',
        color: skillPoints > 0 ? '#ffd8d8' : '#d7f7ff',
        backgroundColor: '#07100f',
        padding: { x: 3, y: 1 },
      }).setOrigin(0.5));
    }
  }

  private drawCollectionCardStickers(
    x: number,
    y: number,
    meta: ReturnType<BarracksScene['getMonsterCollectionMeta']>,
    typeColor: number,
  ): void {
    const g = this.add.graphics();
    const collectionNumber = meta.indexLabel.replace('No.', '');

    g.lineStyle(1, meta.color, meta.rank >= 3 ? 0.22 : 0.12);
    for (let i = 0; i < Math.max(2, meta.rank + 1); i += 1) {
      const sx = x + 18 + i * 23;
      g.lineBetween(sx, y + 25, sx + 24, y + 12);
    }
    g.fillStyle(0x020609, 0.58);
    g.fillRoundedRect(x + 14, y + 29, 50, 14, 5);
    g.lineStyle(1, meta.color, 0.38);
    g.strokeRoundedRect(x + 14, y + 29, 50, 14, 5);
    g.fillStyle(meta.color, 0.18);
    g.fillRoundedRect(x + 18, y + 33, 4, 6, 2);
    g.fillStyle(meta.color, 0.16);
    g.fillRoundedRect(x + CARD_W - 54, y + 47, 40, 14, 5);
    g.lineStyle(1, meta.color, 0.62);
    g.strokeRoundedRect(x + CARD_W - 54, y + 47, 40, 14, 5);
    g.fillStyle(0x020609, 0.54);
    g.fillRoundedRect(x + 17, y + 63, 48, 15, 6);
    g.lineStyle(1, typeColor, 0.32);
    g.strokeRoundedRect(x + 17, y + 63, 48, 15, 6);
    g.fillStyle(meta.elementColor, 0.20);
    g.fillCircle(x + CARD_W - 27, y + 70, 10);
    g.lineStyle(1, meta.elementColor, 0.68);
    g.strokeCircle(x + CARD_W - 27, y + 70, 10);
    g.fillStyle(0x020609, 0.66);
    g.fillRoundedRect(x + CARD_W / 2 - 27, y + 74, 54, 13, 5);
    g.lineStyle(1, meta.color, 0.42);
    g.strokeRoundedRect(x + CARD_W / 2 - 27, y + 74, 54, 13, 5);
    this.contentContainer.add(g);

    this.contentContainer.add(this.add.text(x + 39, y + 36, `도감 ${collectionNumber}`, {
      fontFamily: 'monospace',
      fontSize: '7px',
      color: '#d6d4c8',
    }).setOrigin(0.5));
    this.contentContainer.add(this.add.text(x + CARD_W - 34, y + 54, `등급 ${meta.tier}`, {
      fontFamily: 'Georgia, serif',
      fontSize: '7px',
      fontStyle: 'bold',
      color: meta.css,
    }).setOrigin(0.5));
    this.contentContainer.add(this.add.text(x + 41, y + 70.5, meta.tribeLabel, {
      fontFamily: 'sans-serif',
      fontSize: '8px',
      fontStyle: 'bold',
      color: '#d8fff2',
    }).setOrigin(0.5));
    this.contentContainer.add(this.add.text(x + CARD_W - 27, y + 70, meta.elementIcon, {
      fontFamily: 'sans-serif',
      fontSize: '10px',
      color: `#${meta.elementColor.toString(16).padStart(6, '0')}`,
    }).setOrigin(0.5));
    this.contentContainer.add(this.add.text(x + CARD_W / 2, y + 80, meta.stars, {
      fontFamily: 'sans-serif',
      fontSize: '8px',
      color: meta.css,
    }).setOrigin(0.5));
  }

  private getBarracksStats(): BarracksStats {
    const deployedIds = this.getDeployedMonsterIds();
    const equipmentIds = this.getEquipmentInventoryIds();
    let totalPower = 0;
    let strongest: OwnedMonster | undefined;
    let strongestAtk = -1;
    let skillTarget: OwnedMonster | undefined;
    let levelTarget: OwnedMonster | undefined;
    let bestLevelPct = -1;

    this.gs.ownedMonsters.forEach(monster => {
      const def = MONSTER_DEFS[monster.id as keyof typeof MONSTER_DEFS];
      const atk = getMonsterAtk(def?.baseDamage ?? 10, monster.level, monster.spentSkills);
      totalPower += atk;
      if (atk > strongestAtk) {
        strongest = monster;
        strongestAtk = atk;
      }
      if ((monster.skillPoints ?? 0) > 0 && (!skillTarget || (monster.skillPoints ?? 0) > (skillTarget.skillPoints ?? 0))) {
        skillTarget = monster;
      }
      const needed = xpToNextLevel(monster.level);
      const pct = monster.level >= 50 ? 1 : monster.xp / needed;
      if (monster.level < 50 && pct >= 0.78 && pct > bestLevelPct) {
        levelTarget = monster;
        bestLevelPct = pct;
      }
    });

    const gearTarget = equipmentIds.length > 0
      ? this.gs.ownedMonsters.find(monster => !monster.equipment)
      : undefined;

    return {
      totalPower,
      ownedCount: this.gs.ownedMonsters.length,
      spReady: this.gs.ownedMonsters.filter(monster => (monster.skillPoints ?? 0) > 0).length,
      levelReady: this.gs.ownedMonsters.filter(monster => {
        if (monster.level >= 50) return false;
        return monster.xp / xpToNextLevel(monster.level) >= 0.78;
      }).length,
      equippedCount: this.gs.ownedMonsters.filter(monster => Boolean(monster.equipment)).length,
      deployedCount: deployedIds.size,
      equipmentInventory: equipmentIds.length,
      strongest,
      skillTarget,
      levelTarget,
      gearTarget,
    };
  }

  private getTrainingOpsScore(stats: BarracksStats): number {
    if (stats.ownedCount <= 0) return 0;

    const deploymentPct = stats.deployedCount / stats.ownedCount;
    const equipmentPct = stats.equippedCount / stats.ownedCount;
    const readyPressure = Phaser.Math.Clamp((stats.spReady + stats.levelReady) / stats.ownedCount, 0, 1);
    const growthCoverage = 1 - readyPressure * 0.45;

    return Math.round(Phaser.Math.Clamp(
      deploymentPct * 42 + equipmentPct * 34 + growthCoverage * 24,
      0,
      100,
    ));
  }

  private getBarracksDirective(stats: BarracksStats): BarracksDirective {
    const focused = this.focusMonsterId
      ? this.gs.ownedMonsters.find(monster => monster.id === this.focusMonsterId)
      : undefined;
    if (focused) {
      const def = MONSTER_DEFS[focused.id as keyof typeof MONSTER_DEFS];
      const name = this.truncateLabel(def?.name ?? '수호자', 7);
      const xpNeeded = xpToNextLevel(focused.level);
      const xpPct = focused.level >= 50 ? 1 : focused.xp / xpNeeded;
      const sp = focused.skillPoints ?? 0;
      const nextAction = sp > 0
        ? `SP ${sp} 사용 가능`
        : focused.level < 50 && xpPct >= 0.75
          ? `레벨업 ${Math.round(xpPct * 100)}%`
          : focused.equipment
            ? '장비 장착 완료'
            : '장비 제작 추천';
      return {
        title: '방 수호자 성장',
        body: `${name} · ${nextAction}`,
        cta: '상세',
        accent: 0x44ccaa,
        targetMonster: focused,
      };
    }
    if (stats.skillTarget) {
      const def = MONSTER_DEFS[stats.skillTarget.id as keyof typeof MONSTER_DEFS];
      const name = this.truncateLabel(def?.name ?? '몬스터', 7);
      return {
        title: '스킬 성장 대기',
        body: `${name} SP 대기. 핵심 스킬 우선.`,
        cta: '성장',
        accent: 0xc978ff,
        targetMonster: stats.skillTarget,
      };
    }
    if (stats.levelTarget) {
      const def = MONSTER_DEFS[stats.levelTarget.id as keyof typeof MONSTER_DEFS];
      const name = this.truncateLabel(def?.name ?? '몬스터', 7);
      return {
        title: '레벨업 임박',
        body: `${name} 레벨업 임박. 주력 후보.`,
        cta: '확인',
        accent: 0x55d4ff,
        targetMonster: stats.levelTarget,
      };
    }
    if (stats.gearTarget && stats.equipmentInventory > stats.equippedCount) {
      const def = MONSTER_DEFS[stats.gearTarget.id as keyof typeof MONSTER_DEFS];
      const name = this.truncateLabel(def?.name ?? '몬스터', 7);
      return {
        title: '장비 장착 추천',
        body: `${name} 장비 장착 추천.`,
        cta: '장착',
        accent: COLORS.TORCH_AMBER,
        targetMonster: stats.gearTarget,
      };
    }
    return {
      title: '훈련 안정 상태',
      body: '새 소환·장비 제작으로 전력 확장.',
      cta: '대기',
      accent: 0x8bbf6a,
      targetMonster: stats.strongest,
    };
  }

  private getMonsterRoomPlan(monster: OwnedMonster): MonsterRoomPlan {
    const deployed = this.findMonsterRoom(monster.id);
    if (deployed) {
      const room = this.getRoomTypeDisplay(deployed.slot.roomType);
      return {
        label: `방 #${deployed.index + 1} 배치중`,
        subLabel: `${room.name} · Lv.${deployed.slot.roomLevel}`,
        accent: room.accent,
        kind: 'deployed',
      };
    }

    const def = MONSTER_DEFS[monster.id as keyof typeof MONSTER_DEFS];
    const preferredType = this.getPreferredRoomType(def?.type);
    const unlockedSlots = getUnlockedSlots(this.gs.dmLevel);
    const slots = this.gs.dungeonSlots ?? [];
    const viableRooms = slots
      .slice(0, unlockedSlots)
      .map((slot, index) => ({ slot, index }))
      .filter((entry): entry is { slot: DungeonSlot; index: number } => Boolean(entry.slot));

    const preferredRoom = viableRooms.find(({ slot }) =>
      slot.hp > 0 && slot.roomType === preferredType && this.hasOpenMonsterSlot(slot),
    );
    if (preferredRoom) {
      const room = this.getRoomTypeDisplay(preferredRoom.slot.roomType);
      return {
        label: `방 #${preferredRoom.index + 1} 추천`,
        subLabel: `${room.name} 빈 슬롯`,
        accent: room.accent,
        kind: 'recommended',
      };
    }

    const anyOpenRoom = viableRooms.find(({ slot }) =>
      slot.hp > 0 && Boolean(slot.roomType) && this.hasOpenMonsterSlot(slot),
    );
    if (anyOpenRoom) {
      const room = this.getRoomTypeDisplay(anyOpenRoom.slot.roomType);
      return {
        label: `방 #${anyOpenRoom.index + 1} 대기`,
        subLabel: `${room.name} 임시 배치 가능`,
        accent: room.accent,
        kind: 'recommended',
      };
    }

    const repairRoom = viableRooms.find(({ slot }) =>
      slot.hp <= 0 && Boolean(slot.roomType) && this.hasOpenMonsterSlot(slot),
    );
    if (repairRoom) {
      return {
        label: `방 #${repairRoom.index + 1} 수리 후 배치`,
        subLabel: '파손 방 복구 필요',
        accent: 0xff5544,
        kind: 'repair',
      };
    }

    const designRoom = viableRooms.find(({ slot }) => !slot.roomType);
    if (designRoom) {
      return {
        label: `방 #${designRoom.index + 1} 설계 필요`,
        subLabel: `${this.getRoomTypeDisplay(preferredType).name} 추천`,
        accent: 0x4bd5ff,
        kind: 'design',
      };
    }

    return {
      label: '방 해금 대기',
      subLabel: '던전 레벨업 필요',
      accent: 0x8a6a4a,
      kind: 'locked',
    };
  }

  private findMonsterRoom(monsterId: string): { slot: DungeonSlot; index: number } | null {
    const slots = this.gs.dungeonSlots ?? [];
    for (let index = 0; index < slots.length; index++) {
      const slot = slots[index];
      if (!slot) continue;
      if ((slot.monsterIds ?? []).some(id => id === monsterId)) return { slot, index };
    }
    return null;
  }

  private hasOpenMonsterSlot(slot: DungeonSlot): boolean {
    const cap = getRoomSlotCapacity(slot.roomLevel, slot.roomType);
    return (slot.monsterIds ?? []).filter(Boolean).length < cap.monsters;
  }

  private getPreferredRoomType(monsterType?: string): RoomSlotType {
    if (monsterType === 'magic') return 'magic';
    if (monsterType === 'support') return 'support';
    return 'combat';
  }

  private getRoomTypeDisplay(roomType?: RoomSlotType): { name: string; accent: number } {
    const def = ROOM_SLOT_TYPE_DEFS.find(room => room.id === roomType);
    if (roomType === 'combat') return { name: def?.name ?? '전투실', accent: 0xff9354 };
    if (roomType === 'trap') return { name: def?.name ?? '함정실', accent: COLORS.TORCH_AMBER };
    if (roomType === 'support') return { name: def?.name ?? '지원실', accent: 0x89e06f };
    if (roomType === 'magic') return { name: def?.name ?? '마법진', accent: 0xc978ff };
    return { name: '미설계 방', accent: 0x4bd5ff };
  }

  private drawMonsterBust(monster: OwnedMonster, x: number, y: number, size: number, depth: number): void {
    const def = MONSTER_DEFS[monster.id as keyof typeof MONSTER_DEFS];
    const skin = getSkinForMonster(monster.id, this.gs.equippedSkins ?? {});
    const portraitKey = generatePortrait(this, monster.id as MonsterId, skin?.id);
    if (this.textures.exists(portraitKey)) {
      this.add.image(x, y, portraitKey)
        .setOrigin(0.5)
        .setDisplaySize(size, size)
        .setDepth(depth);
      return;
    }
    this.add.text(x, y, skin ? skin.emoji : def?.emoji ?? '?', {
      fontFamily: 'sans-serif',
      fontSize: `${size}px`,
    }).setOrigin(0.5).setDepth(depth);
  }

  private getMonsterTypeMeta(type?: string): { label: string; color: number; text: string } {
    if (type === 'melee') return { label: '근접 훈련', color: 0xff9354, text: '#ffd0a6' };
    if (type === 'ranged') return { label: '원거리 훈련', color: 0x7bbcff, text: '#c9e4ff' };
    if (type === 'magic') return { label: '마력 증폭', color: 0xc978ff, text: '#edd1ff' };
    if (type === 'support') return { label: '지원 의식', color: 0x89e06f, text: '#d8ffd1' };
    return { label: '혼합 훈련', color: COLORS.TORCH_AMBER, text: CSS.TORCH_AMBER };
  }

  private getMonsterCardActionCue(
    monster: OwnedMonster,
    xpPct: number,
    hasEquipment: boolean,
    isDeployed: boolean,
    roomPlan: MonsterRoomPlan,
  ): MonsterCardActionCue {
    const sp = monster.skillPoints ?? 0;
    if (sp > 0) {
      return {
        icon: '✦',
        label: `SP ${sp} 사용`,
        subLabel: '스킬 노드 해금',
        chip: '성장',
        accent: 0xc978ff,
        fill: 0x2b123b,
        textColor: '#e7c2ff',
      };
    }
    if (monster.level >= 50) {
      return {
        icon: '👑',
        label: '최대 레벨',
        subLabel: hasEquipment ? '배치 최적화' : '장비 보강',
        chip: 'MAX',
        accent: 0xffc857,
        fill: 0x26200f,
        textColor: '#ffe6a3',
      };
    }
    if (xpPct >= 0.82) {
      return {
        icon: '🥩',
        label: '레벨업 임박',
        subLabel: `EXP ${Math.round(xpPct * 100)}%`,
        chip: '훈련',
        accent: 0x55d4ff,
        fill: 0x102638,
        textColor: '#bcefff',
      };
    }
    if (!hasEquipment) {
      return {
        icon: '⚒',
        label: '장비 보강',
        subLabel: '전력 상승 추천',
        chip: '제작',
        accent: COLORS.TORCH_AMBER,
        fill: 0x241707,
        textColor: '#ffd08a',
      };
    }
    if (!isDeployed && roomPlan.kind !== 'locked') {
      return {
        icon: '▣',
        label: roomPlan.kind === 'design' ? '방 설계' : '방 배치',
        subLabel: roomPlan.subLabel,
        chip: '배치',
        accent: roomPlan.accent,
        fill: 0x0e1f1d,
        textColor: '#c9fff2',
      };
    }
    if (isDeployed) {
      return {
        icon: '✓',
        label: '방어선 합류',
        subLabel: roomPlan.subLabel,
        chip: '활동',
        accent: 0x89e06f,
        fill: 0x142314,
        textColor: '#d4ffd0',
      };
    }
    return {
      icon: '◆',
      label: '훈련 대기',
      subLabel: '상세 성장 확인',
      chip: '대기',
      accent: 0x8bbf6a,
      fill: 0x131714,
      textColor: '#c9e8b8',
    };
  }

  private getEquipmentDisplay(equipmentId: string | null): { icon: string; name: string } | null {
    if (!equipmentId) return null;
    const staticDef = EQUIPMENT_DEFS.find(equipment => equipment.id === equipmentId);
    if (staticDef) return { icon: staticDef.icon, name: staticDef.name };
    const craftedDef = [...(this.gs.craftedEquipment ?? [])]
      .reverse()
      .find(equipment => equipment.id === equipmentId);
    if (!craftedDef) return null;
    return { icon: craftedDef.emoji, name: craftedDef.name };
  }

  private getEquipmentInventoryIds(): string[] {
    return Array.from(new Set([
      ...(this.gs.ownedEquipment ?? []),
      ...(this.gs.craftedEquipment ?? []).map(equipment => equipment.id),
    ]));
  }

  private getDeployedMonsterIds(): Set<string> {
    return new Set(
      (this.gs.dungeonSlots ?? []).flatMap(slot => slot.monsterIds.filter(Boolean) as string[]),
    );
  }

  private truncateLabel(value: string, maxChars: number): string {
    return value.length > maxChars ? `${value.slice(0, maxChars)}…` : value;
  }

  private buildSummonSlot(x: number, y: number): void {
    const bg = this.add.graphics();
    bg.fillStyle(0x000000, 0.22);
    bg.fillRoundedRect(x + 2, y + 3, CARD_W, CARD_H, 10);
    bg.fillStyle(0x1b1021, 0.88);
    bg.fillRoundedRect(x, y, CARD_W, CARD_H, 10);
    bg.lineStyle(2, COLORS.TORCH_GOLD, 0.62);
    bg.strokeRoundedRect(x, y, CARD_W, CARD_H, 10);
    bg.lineStyle(1, 0xffffff, 0.10);
    bg.strokeRoundedRect(x + 5, y + 5, CARD_W - 10, CARD_H - 10, 8);
    bg.fillStyle(0xc978ff, 0.10);
    bg.fillCircle(x + CARD_W / 2, y + 78, 46);
    bg.fillStyle(COLORS.TORCH_GOLD, 0.16);
    bg.fillRoundedRect(x + 18, y + 22, CARD_W - 36, 92, 10);
    bg.lineStyle(1, COLORS.TORCH_GOLD, 0.36);
    bg.strokeRoundedRect(x + 18, y + 22, CARD_W - 36, 92, 10);
    this.contentContainer.add(bg);

    this.contentContainer.add(this.add.text(x + 14, y + 15, 'PACK', {
      fontFamily: 'sans-serif',
      fontSize: '8px',
      fontStyle: 'bold',
      color: '#f6eaff',
      backgroundColor: '#2a1838',
      padding: { x: 5, y: 2 },
    }).setOrigin(0, 0.5));

    this.contentContainer.add(this.add.text(x + CARD_W - 14, y + 15, 'NEW', {
      fontFamily: 'sans-serif',
      fontSize: '8px',
      fontStyle: 'bold',
      color: '#241300',
      backgroundColor: '#ffd878',
      padding: { x: 5, y: 2 },
    }).setOrigin(1, 0.5));

    const t = this.add.text(x + CARD_W / 2, y + 68, '✨', {
      fontFamily: 'sans-serif', fontSize: '38px',
    }).setOrigin(0.5);
    this.contentContainer.add(t);

    const label = this.add.text(x + CARD_W / 2, y + 124, '새 몬스터 카드팩', {
      fontFamily: 'Georgia, serif', fontSize: '13px', fontStyle: 'bold', color: CSS.TORCH_AMBER,
    }).setOrigin(0.5);
    this.contentContainer.add(label);

    const sub = this.add.text(x + CARD_W / 2, y + 144, '도감 확장 · 성장 후보 획득', {
      fontFamily: 'sans-serif',
      fontSize: '9px',
      color: CSS.PARCHMENT_MUTED,
    }).setOrigin(0.5);
    this.contentContainer.add(sub);

    const dots = this.add.graphics();
    [0x8f98a5, 0x58c681, 0x62a8ff, 0xc978ff, 0xffc857].forEach((color, i) => {
      const cx = x + CARD_W / 2 - 28 + i * 14;
      dots.fillStyle(color, i >= 3 ? 0.92 : 0.58);
      dots.fillCircle(cx, y + 166, i >= 3 ? 3.2 : 2.5);
    });
    this.contentContainer.add(dots);

    const cta = this.add.graphics();
    cta.fillStyle(0x271536, 1);
    cta.fillRoundedRect(x + 22, y + 184, CARD_W - 44, 24, 7);
    cta.lineStyle(1, COLORS.TORCH_GOLD, 0.48);
    cta.strokeRoundedRect(x + 22, y + 184, CARD_W - 44, 24, 7);
    this.contentContainer.add(cta);
    this.contentContainer.add(this.add.text(x + CARD_W / 2, y + 196, '소환하러 가기', {
      fontFamily: 'sans-serif',
      fontSize: '10px',
      fontStyle: 'bold',
      color: '#ffe4a8',
    }).setOrigin(0.5));

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
        focusSourceLabel: this.focusMonsterId === m.id ? this.focusSourceLabel ?? undefined : undefined,
        onClose: () => { this.detailOverlay = undefined; },
        onRefresh: (updated) => { this.detailOverlay = undefined; this.showMonsterDetail(updated); },
        onOpenForge: (monster) => {
          this.detailOverlay = undefined;
          this.registry.set('forgeReturnScene', 'BarracksScene');
          this.registry.set('focusMonsterId', monster.id);
          if (this.focusSourceLabel) this.registry.set('focusSourceLabel', this.focusSourceLabel);
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
    navBg.fillStyle(0x10130f, 1);
    navBg.fillRect(0, CANVAS_HEIGHT - 72, CANVAS_WIDTH, 72);
    navBg.fillStyle(COLORS.TORCH_GOLD, 0.08);
    navBg.fillRect(0, CANVAS_HEIGHT - 72, CANVAS_WIDTH, 3);
    navBg.lineStyle(1, COLORS.TORCH_GOLD, 0.42);
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
      bg.fillStyle(0x020609, 0.36);
      bg.fillRoundedRect(bx, by + 3, btnW, 44, 7);
      bg.fillStyle(active ? 0x3a2800 : 0x151817, active ? 1 : 0.92);
      bg.fillRoundedRect(bx, by, btnW, 44, 7);
      bg.lineStyle(1, active ? COLORS.TORCH_GOLD : COLORS.STONE_MID, active ? 0.82 : 0.34);
      bg.strokeRoundedRect(bx, by, btnW, 44, 7);
      if (active) {
        bg.fillStyle(COLORS.TORCH_GOLD, 0.18);
        bg.fillRoundedRect(bx + 7, by + 5, btnW - 14, 4, 2);
      }
      this.add.text(bx + btnW / 2, by + 22, label, {
        fontFamily: 'sans-serif', fontSize: '11px',
        color: active ? CSS.TORCH_AMBER : CSS.PARCHMENT_MUTED,
      }).setOrigin(0.5).setDepth(22);
      const zone = this.add.zone(bx + btnW / 2, by + 22, btnW, 44)
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
    g.fillStyle(0x020609, 0.36);
    g.fillRoundedRect(x - 4, y - 11, label.length * 8 + 16, 28, 6);
    g.fillStyle(bg, 1);
    g.fillRoundedRect(x - 4, y - 14, label.length * 8 + 16, 28, 6);
    g.lineStyle(1, COLORS.TORCH_GOLD, 0.36);
    g.strokeRoundedRect(x - 4, y - 14, label.length * 8 + 16, 28, 6);
    const t = this.add.text(x + 4, y, label, {
      fontFamily: 'sans-serif', fontSize: '11px', color: CSS.PARCHMENT_MUTED,
    }).setOrigin(0, 0.5).setDepth(16).setInteractive({ useHandCursor: true });
    t.on('pointerdown', cb);
  }
}
