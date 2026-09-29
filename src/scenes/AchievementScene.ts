/**
 * Achievement hall — fixed-view archive and reward claiming surface.
 *
 * Category, page, and record selection are presentation-only. Achievement
 * progress, unlocks, and reward claims remain owned by pure data transactions.
 */

import Phaser from 'phaser';
import { CANVAS_HEIGHT, CANVAS_WIDTH } from '../constants/layout';
import { COLORS, DUNGEON_UI, DUNGEON_UI_CSS } from '../constants/colors';
import { loadGameState, saveGameState, type GameState } from '../data/wisdom';
import {
  ACHIEVEMENT_DEFS,
  EPILOGUE_ACHIEVEMENT_DEFS,
  type AchievementCategory,
  type AchievementContext,
  type AchievementDef,
} from '../data/achievements';
import { buildAchievementContext, unlockAvailableAchievements } from '../data/progressionTransactions';
import { claimAchievementReward, claimAllAchievementRewards } from '../data/rewardTransactions';
import {
  addFramedPanel,
  addPrimaryActionButton,
  addProgressBar,
  addSceneHeader,
} from '../ui/GameUiPrimitives';
import { formatHudResourceValue } from '../ui/HudResourceFormatting';
import { addSigil } from '../ui/Sigils';
import { ACHIEVEMENT_CATEGORY_SIGILS } from '../ui/sigilMaps';

type AchievementFilter = AchievementCategory | 'all';
type ReceiptTone = 'success' | 'warning';
type RecordState = 'claimable' | 'claimed' | 'progress';

interface CategorySeal {
  readonly id: AchievementFilter;
  readonly label: string;
}

interface AchievementReceipt {
  readonly title: string;
  readonly detail: string;
  readonly tone: ReceiptTone;
}

const ALL_ACHIEVEMENT_DEFS: readonly AchievementDef[] = [
  ...ACHIEVEMENT_DEFS,
  ...EPILOGUE_ACHIEVEMENT_DEFS,
];

const CATEGORY_SEALS: readonly CategorySeal[] = [
  { id: 'all', label: '전체' },
  { id: 'combat', label: '전투' },
  { id: 'economy', label: '경제' },
  { id: 'build', label: '건설' },
  { id: 'endless', label: '무한' },
  { id: 'mastery', label: '숙련' },
  { id: 'collection', label: '수집' },
  { id: 'growth', label: '성장' },
];

const FILTER_LABELS: Record<AchievementFilter, string> = {
  all: '전체 기록',
  combat: '전투 기록',
  economy: '경제 기록',
  build: '건설 기록',
  endless: '무한 기록',
  mastery: '숙련 기록',
  collection: '수집 기록',
  growth: '성장 기록',
};

const PANEL_X = 14;
const PANEL_W = CANVAS_WIDTH - PANEL_X * 2;
const STATUS_Y = 76;
const CATEGORY_Y = 144;
const ARCHIVE_Y = 246;
const RECORDS_Y = 306;
const RECORD_H = 64;
const RECORD_GAP = 8;
const DETAIL_Y = 524;
const COMMAND_Y = 728;
const RECORDS_PER_PAGE = 3;
const TRANSACTION_COOLDOWN_MS = 250;

function now(): number {
  return Date.now();
}

export class AchievementScene extends Phaser.Scene {
  private gameState!: GameState;
  private context!: AchievementContext;
  private activeFilter: AchievementFilter = 'all';
  private selectedId = '';
  private pageIndex = 0;
  private receipt: AchievementReceipt | null = null;
  private transactionPending = false;
  private lastTransactionAt = 0;

  constructor() {
    super({ key: 'AchievementScene' });
  }

  create(): void {
    this.receipt = null;
    this.transactionPending = false;
    this.lastTransactionAt = 0;
    this.activeFilter = 'all';
    this.pageIndex = 0;

    const sweep = unlockAvailableAchievements(loadGameState());
    if (sweep.changed) saveGameState(sweep.state);
    this.gameState = sweep.state;
    this.context = buildAchievementContext(this.gameState);

    const initial = this.getFilteredRecords()[0];
    this.selectedId = initial?.id ?? '';
    this.resetCamera();
    this.render();
  }

  private render(): void {
    this.clearRenderedObjects();
    this.resetCamera();
    this.context = buildAchievementContext(this.gameState);
    const records = this.getFilteredRecords();
    this.reconcileSelection(records);

    this.drawBackdrop();
    this.drawHeader();
    this.drawStatusRail();
    this.drawCategorySeals();
    this.drawArchivePage(records);
    this.drawSelectedRecord(records);
    this.drawCommands();
  }

  private clearRenderedObjects(): void {
    this.tweens.killAll();
    for (const child of [...this.children.list]) child.destroy();
  }

  private resetCamera(): void {
    this.cameras.main.setBounds(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    this.cameras.main.centerOn(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);
  }

  private drawBackdrop(): void {
    const g = this.add.graphics().setDepth(-900);
    g.fillStyle(DUNGEON_UI.VOID, 1);
    g.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    g.fillStyle(DUNGEON_UI.SOOT, 1);
    g.fillRect(0, 68, CANVAS_WIDTH, CANVAS_HEIGHT - 68);

    g.lineStyle(1, DUNGEON_UI.IRON, 0.32);
    for (let y = 86; y < CANVAS_HEIGHT; y += 42) {
      g.lineBetween(0, y, CANVAS_WIDTH, y);
      const offset = ((y - 86) / 42) % 2 === 0 ? 24 : 0;
      for (let x = offset; x < CANVAS_WIDTH; x += 58) g.lineBetween(x, y, x, y + 42);
    }

    g.fillStyle(DUNGEON_UI.STONE, 0.78);
    g.fillRect(0, 68, 18, CANVAS_HEIGHT - 68);
    g.fillRect(CANVAS_WIDTH - 18, 68, 18, CANVAS_HEIGHT - 68);
    g.lineStyle(2, DUNGEON_UI.BRASS, 0.12);
    g.lineBetween(27, 72, 27, CANVAS_HEIGHT);
    g.lineBetween(CANVAS_WIDTH - 27, 72, CANVAS_WIDTH - 27, CANVAS_HEIGHT);

    g.fillStyle(COLORS.TORCH_AMBER, 0.028);
    g.fillCircle(CANVAS_WIDTH / 2, 365, 164);
  }

  private drawHeader(): void {
    const header = addSceneHeader(this, {
      title: '명예 기록실',
      subtitle: '전과를 확인하고 봉인된 보상을 회수',
      onBack: () => {
        if (this.transactionPending) return;
        this.scene.start((this.registry.get('previousScene') as string) ?? 'StageSelectScene');
      },
    });
    const backZone = header.container.list.find(child => child.type === 'Zone') as Phaser.GameObjects.Zone | undefined;
    backZone?.setName('achievement-back');
  }

  private drawStatusRail(): void {
    addFramedPanel(this, {
      x: PANEL_X,
      y: STATUS_Y,
      w: PANEL_W,
      h: 58,
      fillColor: DUNGEON_UI.STONE,
      borderColor: DUNGEON_UI.IRON,
      shadowOpacity: 0.28,
    });

    const achieved = ALL_ACHIEVEMENT_DEFS.filter(def => this.isUnlocked(def)).length;
    const claimable = ALL_ACHIEVEMENT_DEFS.filter(def => this.isClaimable(def)).length;
    const items = [
      { label: '달성 기록', value: `${achieved} / ${ALL_ACHIEVEMENT_DEFS.length}`, color: achieved > 0 ? DUNGEON_UI_CSS.JADE : DUNGEON_UI_CSS.TEXT },
      { label: '미수령', value: `${claimable}건`, color: claimable > 0 ? DUNGEON_UI_CSS.BRASS : DUNGEON_UI_CSS.MUTED },
      { label: '보유 재화', value: `젬 ${formatHudResourceValue(this.gameState.gems ?? 0)} · 수정 ${formatHudResourceValue(this.gameState.soulCrystals ?? 0)}`, color: DUNGEON_UI_CSS.TEXT },
    ];

    items.forEach((item, index) => {
      const cellW = PANEL_W / items.length;
      const x = PANEL_X + cellW * index;
      if (index > 0) {
        const divider = this.add.graphics();
        divider.lineStyle(1, DUNGEON_UI.IRON, 0.85);
        divider.lineBetween(x, STATUS_Y + 10, x, STATUS_Y + 48);
      }
      this.add.text(x + cellW / 2, STATUS_Y + 18, item.label, {
        fontFamily: 'sans-serif', fontSize: '10px', color: DUNGEON_UI_CSS.MUTED,
      }).setOrigin(0.5);
      this.add.text(x + cellW / 2, STATUS_Y + 40, item.value, {
        fontFamily: 'sans-serif', fontSize: index === 2 ? '10px' : '14px', fontStyle: 'bold', color: item.color,
      }).setOrigin(0.5);
    });
  }

  private drawCategorySeals(): void {
    const gap = 4;
    const rowGap = 6;
    const buttonW = (PANEL_W - gap * 3) / 4;
    CATEGORY_SEALS.forEach((seal, index) => {
      const column = index % 4;
      const row = Math.floor(index / 4);
      const active = seal.id === this.activeFilter;
      const button = addPrimaryActionButton(this, {
        x: PANEL_X + column * (buttonW + gap),
        y: CATEGORY_Y + row * (44 + rowGap),
        w: buttonW,
        h: 44,
        label: seal.label,
        fontSize: '11px',
        once: true,
        showArrow: false,
        fillColor: active ? DUNGEON_UI.BRASS : DUNGEON_UI.STONE,
        hoverFillColor: active ? DUNGEON_UI.BRASS_BRIGHT : DUNGEON_UI.IRON,
        borderColor: active ? DUNGEON_UI.BRASS_BRIGHT : DUNGEON_UI.EDGE,
        textColor: active ? '#171006' : DUNGEON_UI_CSS.TEXT,
        onPress: () => this.selectFilter(seal.id),
      });
      button.zone.setName(`achievement-category-${seal.id}`);
      this.bindViewAction(button.zone);
    });
  }

  private drawArchivePage(records: readonly AchievementDef[]): void {
    addFramedPanel(this, {
      x: PANEL_X,
      y: ARCHIVE_Y,
      w: PANEL_W,
      h: 52,
      fillColor: DUNGEON_UI.STONE_RAISED,
      borderColor: DUNGEON_UI.IRON,
      accentColor: DUNGEON_UI.BRASS,
      shadowOpacity: 0.22,
    });

    const pageCount = Math.max(1, Math.ceil(records.length / RECORDS_PER_PAGE));
    const start = this.pageIndex * RECORDS_PER_PAGE;
    const end = Math.min(records.length, start + RECORDS_PER_PAGE);
    this.add.text(PANEL_X + 16, ARCHIVE_Y + 17, FILTER_LABELS[this.activeFilter], {
      fontFamily: 'sans-serif', fontSize: '12px', fontStyle: 'bold', color: DUNGEON_UI_CSS.PARCHMENT,
    }).setOrigin(0, 0.5);
    this.add.text(PANEL_X + 16, ARCHIVE_Y + 36, records.length > 0 ? `${start + 1}–${end} / ${records.length}` : '기록 없음', {
      fontFamily: 'sans-serif', fontSize: '10px', color: DUNGEON_UI_CSS.MUTED,
    }).setOrigin(0, 0.5);
    this.add.text(PANEL_X + PANEL_W - 112, ARCHIVE_Y + 26, `${this.pageIndex + 1} / ${pageCount}`, {
      fontFamily: 'sans-serif', fontSize: '10px', fontStyle: 'bold', color: DUNGEON_UI_CSS.MUTED,
    }).setOrigin(1, 0.5);

    const previous = addPrimaryActionButton(this, {
      x: PANEL_X + PANEL_W - 98,
      y: ARCHIVE_Y + 4,
      w: 44,
      h: 44,
      label: '‹',
      fontSize: '19px',
      enabled: this.pageIndex > 0,
      once: true,
      showArrow: false,
      fillColor: DUNGEON_UI.STONE,
      hoverFillColor: DUNGEON_UI.IRON,
      borderColor: DUNGEON_UI.EDGE,
      disabledFillColor: DUNGEON_UI.SOOT,
      disabledBorderColor: DUNGEON_UI.IRON,
      onPress: () => this.changePage(-1),
    });
    previous.zone.setName('achievement-page-previous');
    this.bindViewAction(previous.zone);

    const next = addPrimaryActionButton(this, {
      x: PANEL_X + PANEL_W - 48,
      y: ARCHIVE_Y + 4,
      w: 44,
      h: 44,
      label: '›',
      fontSize: '19px',
      enabled: this.pageIndex < pageCount - 1,
      once: true,
      showArrow: false,
      fillColor: DUNGEON_UI.STONE,
      hoverFillColor: DUNGEON_UI.IRON,
      borderColor: DUNGEON_UI.EDGE,
      disabledFillColor: DUNGEON_UI.SOOT,
      disabledBorderColor: DUNGEON_UI.IRON,
      onPress: () => this.changePage(1),
    });
    next.zone.setName('achievement-page-next');
    this.bindViewAction(next.zone);

    records.slice(start, end).forEach((def, index) => {
      this.drawRecord(def, RECORDS_Y + index * (RECORD_H + RECORD_GAP));
    });
  }

  private drawRecord(def: AchievementDef, y: number): void {
    const selected = def.id === this.selectedId;
    const state = this.getRecordState(def);
    const tone = state === 'claimable'
      ? DUNGEON_UI.BRASS
      : state === 'claimed'
        ? DUNGEON_UI.JADE
        : DUNGEON_UI.IRON;
    const progress = this.getProgress(def);

    const g = this.add.graphics();
    g.fillStyle(selected ? DUNGEON_UI.STONE_RAISED : DUNGEON_UI.STONE, 1);
    g.fillRoundedRect(PANEL_X, y, PANEL_W, RECORD_H, 8);
    g.lineStyle(selected ? 2 : 1, selected ? DUNGEON_UI.BRASS_BRIGHT : tone, selected ? 1 : 0.78);
    g.strokeRoundedRect(PANEL_X, y, PANEL_W, RECORD_H, 8);
    if (selected) {
      g.fillStyle(DUNGEON_UI.BRASS, 1);
      g.fillRect(PANEL_X + 6, y + 8, 3, RECORD_H - 16);
    }

    addSigil(this, ACHIEVEMENT_CATEGORY_SIGILS[def.category], PANEL_X + 30, y + RECORD_H / 2, 28,
      state === 'claimed' ? DUNGEON_UI.JADE : state === 'claimable' ? DUNGEON_UI.BRASS_BRIGHT : DUNGEON_UI.BRASS,
      { alpha: state === 'progress' ? 0.72 : 1 });
    this.add.text(PANEL_X + 54, y + 18, def.name, {
      fontFamily: 'sans-serif', fontSize: '12px', fontStyle: 'bold', color: DUNGEON_UI_CSS.PARCHMENT,
    }).setOrigin(0, 0.5);
    this.add.text(PANEL_X + PANEL_W - 12, y + 18, this.getStateLabel(state), {
      fontFamily: 'sans-serif', fontSize: '10px', fontStyle: 'bold',
      color: state === 'claimable' ? DUNGEON_UI_CSS.BRASS : state === 'claimed' ? DUNGEON_UI_CSS.JADE : DUNGEON_UI_CSS.MUTED,
    }).setOrigin(1, 0.5);

    addProgressBar(this, {
      x: PANEL_X + 54,
      y: y + 39,
      w: 168,
      h: 7,
      ratio: progress.ratio,
      fillColor: state === 'claimable' || state === 'claimed' ? DUNGEON_UI.JADE : DUNGEON_UI.BRASS,
      trackColor: DUNGEON_UI.SOOT,
      borderColor: DUNGEON_UI.EDGE,
      animate: false,
    });
    this.add.text(PANEL_X + PANEL_W - 12, y + 43, `${this.formatNumber(progress.current)} / ${this.formatNumber(def.target)}`, {
      fontFamily: 'sans-serif', fontSize: '10px', fontStyle: 'bold', color: DUNGEON_UI_CSS.MUTED,
    }).setOrigin(1, 0.5);
    this.add.text(PANEL_X + PANEL_W - 12, y + 55, this.formatReward(def), {
      fontFamily: 'sans-serif', fontSize: '10px', fontStyle: 'bold',
      color: state === 'claimed' ? DUNGEON_UI_CSS.MUTED : DUNGEON_UI_CSS.BRASS,
    }).setOrigin(1, 0.5);

    const zone = this.add.zone(PANEL_X, y, PANEL_W, RECORD_H).setOrigin(0)
      .setInteractive({ useHandCursor: true });
    zone.setName(`achievement-record-${def.id}`);
    zone.on('pointerdown', () => {
      if (this.transactionPending || this.selectedId === def.id) return;
      this.selectedId = def.id;
      this.render();
    });
  }

  private drawSelectedRecord(records: readonly AchievementDef[]): void {
    const selected = records.find(def => def.id === this.selectedId) ?? records[0];
    const state = selected ? this.getRecordState(selected) : 'progress';
    const tone = state === 'claimable'
      ? DUNGEON_UI.BRASS
      : state === 'claimed'
        ? DUNGEON_UI.JADE
        : DUNGEON_UI.IRON;

    addFramedPanel(this, {
      x: PANEL_X,
      y: DETAIL_Y,
      w: PANEL_W,
      h: 194,
      fillColor: DUNGEON_UI.STONE_RAISED,
      borderColor: tone,
      accentColor: tone,
      glowColor: tone,
      glowOpacity: state === 'claimable' ? 0.06 : 0.02,
    });

    if (!selected) {
      this.add.text(CANVAS_WIDTH / 2, DETAIL_Y + 78, '선택 가능한 기록이 없습니다', {
        fontFamily: 'sans-serif', fontSize: '12px', color: DUNGEON_UI_CSS.MUTED,
      }).setOrigin(0.5);
      return;
    }

    const progress = this.getProgress(selected);
    addSigil(this, ACHIEVEMENT_CATEGORY_SIGILS[selected.category], PANEL_X + 30, DETAIL_Y + 22, 22, tone, { disc: false });
    this.add.text(PANEL_X + 46, DETAIL_Y + 22, selected.name, {
      fontFamily: 'sans-serif', fontSize: '15px', fontStyle: 'bold', color: DUNGEON_UI_CSS.PARCHMENT,
    }).setOrigin(0, 0.5);
    this.add.text(PANEL_X + PANEL_W - 16, DETAIL_Y + 22, this.getStateLabel(state), {
      fontFamily: 'sans-serif', fontSize: '10px', fontStyle: 'bold',
      color: state === 'claimable' ? DUNGEON_UI_CSS.BRASS : state === 'claimed' ? DUNGEON_UI_CSS.JADE : DUNGEON_UI_CSS.MUTED,
    }).setOrigin(1, 0.5);
    this.add.text(PANEL_X + 18, DETAIL_Y + 49, selected.description, {
      fontFamily: 'sans-serif', fontSize: '10px', color: DUNGEON_UI_CSS.TEXT,
      wordWrap: { width: PANEL_W - 36 }, lineSpacing: 2,
    }).setOrigin(0, 0.5);

    addProgressBar(this, {
      x: PANEL_X + 18,
      y: DETAIL_Y + 72,
      w: PANEL_W - 36,
      h: 9,
      ratio: progress.ratio,
      fillColor: state === 'claimable' || state === 'claimed' ? DUNGEON_UI.JADE : DUNGEON_UI.BRASS,
      trackColor: DUNGEON_UI.SOOT,
      borderColor: DUNGEON_UI.EDGE,
      animate: false,
    });
    this.add.text(PANEL_X + 18, DETAIL_Y + 95, `진행 ${this.formatNumber(progress.current)} / ${this.formatNumber(selected.target)}`, {
      fontFamily: 'sans-serif', fontSize: '10px', fontStyle: 'bold', color: DUNGEON_UI_CSS.MUTED,
    }).setOrigin(0, 0.5);
    this.add.text(PANEL_X + PANEL_W - 18, DETAIL_Y + 95, `보상 ${this.formatReward(selected)}`, {
      fontFamily: 'sans-serif', fontSize: '10px', fontStyle: 'bold',
      color: state === 'claimed' ? DUNGEON_UI_CSS.MUTED : DUNGEON_UI_CSS.BRASS,
    }).setOrigin(1, 0.5);

    const receiptTone = this.receipt?.tone === 'warning'
      ? DUNGEON_UI.EMBER
      : this.receipt
        ? DUNGEON_UI.JADE
        : DUNGEON_UI.IRON;
    const receiptG = this.add.graphics();
    receiptG.fillStyle(DUNGEON_UI.SOOT, 0.8);
    receiptG.fillRoundedRect(PANEL_X + 14, DETAIL_Y + 112, PANEL_W - 28, 66, 7);
    receiptG.lineStyle(1, receiptTone, this.receipt ? 0.9 : 0.65);
    receiptG.strokeRoundedRect(PANEL_X + 14, DETAIL_Y + 112, PANEL_W - 28, 66, 7);
    this.add.text(PANEL_X + 26, DETAIL_Y + 130, this.receipt?.title ?? '보상 기록 대기', {
      fontFamily: 'sans-serif', fontSize: '10px', fontStyle: 'bold',
      color: this.receipt?.tone === 'warning' ? DUNGEON_UI_CSS.EMBER : this.receipt ? DUNGEON_UI_CSS.JADE : DUNGEON_UI_CSS.MUTED,
    }).setOrigin(0, 0.5);
    this.add.text(PANEL_X + 26, DETAIL_Y + 157, this.receipt?.detail ?? '수령 결과와 재화 변동이 이곳에 유지됩니다', {
      fontFamily: 'sans-serif', fontSize: '10px', color: this.receipt ? DUNGEON_UI_CSS.TEXT : DUNGEON_UI_CSS.MUTED,
      wordWrap: { width: PANEL_W - 52 }, lineSpacing: 2,
    }).setOrigin(0, 0.5);
  }

  private drawCommands(): void {
    const records = this.getFilteredRecords();
    const selected = records.find(def => def.id === this.selectedId);
    const selectedClaimable = selected ? this.isClaimable(selected) : false;
    const claimableCount = ALL_ACHIEVEMENT_DEFS.filter(def => this.isClaimable(def)).length;

    addFramedPanel(this, {
      x: PANEL_X,
      y: COMMAND_Y,
      w: PANEL_W,
      h: 102,
      fillColor: DUNGEON_UI.STONE,
      borderColor: selectedClaimable ? DUNGEON_UI.BRASS : DUNGEON_UI.IRON,
      shadowOpacity: 0.24,
    });
    this.add.text(PANEL_X + 16, COMMAND_Y + 19, selectedClaimable ? '선택 기록의 보상을 회수할 수 있습니다' : this.commandStatus(selected), {
      fontFamily: 'sans-serif', fontSize: '10px', fontStyle: 'bold',
      color: selectedClaimable ? DUNGEON_UI_CSS.BRASS : DUNGEON_UI_CSS.MUTED,
    }).setOrigin(0, 0.5);

    const gap = 8;
    const hasClaimAll = claimableCount > 0;
    const secondaryW = 116;
    const primaryW = hasClaimAll ? PANEL_W - 28 - gap - secondaryW : PANEL_W - 28;
    const primary = addPrimaryActionButton(this, {
      x: PANEL_X + 14,
      y: COMMAND_Y + 40,
      w: primaryW,
      h: 48,
      label: selectedClaimable && selected ? `${selected.name} 보상 수령` : this.commandLabel(selected),
      fontSize: selectedClaimable ? '12px' : '11px',
      enabled: selectedClaimable,
      once: true,
      fillColor: DUNGEON_UI.BRASS,
      hoverFillColor: DUNGEON_UI.BRASS_BRIGHT,
      borderColor: 0x705126,
      disabledFillColor: DUNGEON_UI.SOOT,
      disabledBorderColor: DUNGEON_UI.IRON,
      textColor: '#171006',
      showArrow: false,
      onPress: () => {
        if (selected) this.claimSelected(selected);
      },
    });
    primary.zone.setName('achievement-claim-selected');
    this.bindTransactionAction(primary.zone);

    if (!hasClaimAll) return;
    const claimAll = addPrimaryActionButton(this, {
      x: PANEL_X + 14 + primaryW + gap,
      y: COMMAND_Y + 40,
      w: secondaryW,
      h: 48,
      label: `전체 수령 ${claimableCount}`,
      fontSize: '11px',
      once: true,
      fillColor: DUNGEON_UI.STONE_RAISED,
      hoverFillColor: DUNGEON_UI.IRON,
      borderColor: DUNGEON_UI.JADE,
      textColor: DUNGEON_UI_CSS.JADE,
      showArrow: false,
      onPress: () => this.claimAll(),
    });
    claimAll.zone.setName('achievement-claim-all');
    this.bindTransactionAction(claimAll.zone);
  }

  private getFilteredRecords(): AchievementDef[] {
    const records = this.activeFilter === 'all'
      ? [...ALL_ACHIEVEMENT_DEFS]
      : ALL_ACHIEVEMENT_DEFS.filter(def => def.category === this.activeFilter);

    return records.sort((a, b) => {
      const stateDelta = this.stateRank(a) - this.stateRank(b);
      if (stateDelta !== 0) return stateDelta;
      const progressDelta = this.getProgress(b).ratio - this.getProgress(a).ratio;
      if (progressDelta !== 0) return progressDelta;
      return ALL_ACHIEVEMENT_DEFS.indexOf(a) - ALL_ACHIEVEMENT_DEFS.indexOf(b);
    });
  }

  private reconcileSelection(records: readonly AchievementDef[]): void {
    if (records.length === 0) {
      this.selectedId = '';
      this.pageIndex = 0;
      return;
    }

    let selectedIndex = records.findIndex(def => def.id === this.selectedId);
    if (selectedIndex < 0) {
      this.selectedId = records[0].id;
      selectedIndex = 0;
    }
    const pageCount = Math.max(1, Math.ceil(records.length / RECORDS_PER_PAGE));
    this.pageIndex = Phaser.Math.Clamp(Math.floor(selectedIndex / RECORDS_PER_PAGE), 0, pageCount - 1);
  }

  private selectFilter(filter: AchievementFilter): void {
    if (this.transactionPending || this.activeFilter === filter) return;
    this.activeFilter = filter;
    this.pageIndex = 0;
    this.selectedId = '';
    this.render();
  }

  private changePage(direction: -1 | 1): void {
    if (this.transactionPending) return;
    const records = this.getFilteredRecords();
    const pageCount = Math.max(1, Math.ceil(records.length / RECORDS_PER_PAGE));
    const nextPage = Phaser.Math.Clamp(this.pageIndex + direction, 0, pageCount - 1);
    if (nextPage === this.pageIndex) return;
    this.pageIndex = nextPage;
    this.selectedId = records[nextPage * RECORDS_PER_PAGE]?.id ?? this.selectedId;
    this.render();
  }

  private getProgress(def: AchievementDef): { current: number; ratio: number } {
    const raw = def.getProgress(this.context);
    const current = Number.isFinite(raw) ? Math.max(0, raw) : 0;
    return { current, ratio: Phaser.Math.Clamp(current / def.target, 0, 1) };
  }

  private isUnlocked(def: AchievementDef): boolean {
    return this.gameState.achievements?.[def.id]?.unlocked ?? false;
  }

  private isClaimable(def: AchievementDef): boolean {
    const entry = this.gameState.achievements?.[def.id];
    return Boolean(entry?.unlocked && !entry.rewardClaimed);
  }

  private getRecordState(def: AchievementDef): RecordState {
    if (this.isClaimable(def)) return 'claimable';
    if (this.gameState.achievements?.[def.id]?.rewardClaimed) return 'claimed';
    return 'progress';
  }

  private stateRank(def: AchievementDef): number {
    const state = this.getRecordState(def);
    if (state === 'claimable') return 0;
    if (state === 'progress') return 1;
    return 2;
  }

  private getStateLabel(state: RecordState): string {
    if (state === 'claimable') return '수령 가능';
    if (state === 'claimed') return '수령 완료';
    return '진행 중';
  }

  private formatReward(def: AchievementDef): string {
    const parts: string[] = [];
    if (def.reward.gems) parts.push(`젬 ${this.formatNumber(def.reward.gems)}`);
    if (def.reward.soulCrystals) parts.push(`수정 ${this.formatNumber(def.reward.soulCrystals)}`);
    return parts.join(' · ');
  }

  private formatNumber(value: number): string {
    return value.toLocaleString('ko-KR');
  }

  private commandStatus(def: AchievementDef | undefined): string {
    if (!def) return '선택 가능한 기록이 없습니다';
    if (this.gameState.achievements?.[def.id]?.rewardClaimed) return '이미 보상을 회수한 기록입니다';
    const progress = this.getProgress(def);
    return `목표까지 ${this.formatNumber(Math.max(0, def.target - progress.current))} 남음`;
  }

  private commandLabel(def: AchievementDef | undefined): string {
    if (!def) return '보상 수령 불가';
    return this.gameState.achievements?.[def.id]?.rewardClaimed ? '보상 수령 완료' : '목표 달성 전';
  }

  private bindTransactionAction(zone: Phaser.GameObjects.Zone): void {
    const press = zone.listeners('pointerdown')[0] as ((...args: unknown[]) => void) | undefined;
    if (!press) return;
    zone.removeAllListeners('pointerdown');
    zone.on('pointerdown', (...args: unknown[]) => {
      if (this.transactionPending) return;
      this.transactionPending = true;
      press(...args);
    });
  }

  private bindViewAction(zone: Phaser.GameObjects.Zone): void {
    const press = zone.listeners('pointerdown')[0] as ((...args: unknown[]) => void) | undefined;
    if (!press) return;
    zone.removeAllListeners('pointerdown');
    zone.on('pointerdown', (...args: unknown[]) => {
      if (this.transactionPending) return;
      press(...args);
    });
  }

  private beginTransaction(): boolean {
    const timestamp = now();
    if (timestamp - this.lastTransactionAt < TRANSACTION_COOLDOWN_MS) {
      this.transactionPending = false;
      return false;
    }
    this.lastTransactionAt = timestamp;
    return true;
  }

  private queueRender(): void {
    this.events.once(Phaser.Scenes.Events.POST_UPDATE, () => {
      this.transactionPending = false;
      if (this.sys.isActive()) this.render();
    });
  }

  private claimSelected(def: AchievementDef): void {
    if (!this.beginTransaction()) return;
    const before = loadGameState();
    const result = claimAchievementReward(before, def.id, def.reward);
    if (!result.ok) {
      this.gameState = result.state;
      this.receipt = {
        title: result.reason === 'achievement_reward_already_claimed' ? `${def.name} · 이미 수령 완료` : `${def.name} · 수령 불가`,
        detail: '재화와 업적 진행은 변경되지 않았습니다',
        tone: 'warning',
      };
      this.queueRender();
      return;
    }

    saveGameState(result.state);
    this.gameState = result.state;
    this.receipt = {
      title: `${def.name} · 보상 수령 완료`,
      detail: `${this.formatReward(def)} · 젬 ${this.formatNumber(before.gems ?? 0)}→${this.formatNumber(result.state.gems ?? 0)} · 수정 ${this.formatNumber(before.soulCrystals ?? 0)}→${this.formatNumber(result.state.soulCrystals ?? 0)}`,
      tone: 'success',
    };
    this.queueRender();
  }

  private claimAll(): void {
    if (!this.beginTransaction()) return;
    const before = loadGameState();
    const result = claimAllAchievementRewards(before, ALL_ACHIEVEMENT_DEFS);
    this.gameState = result.state;
    if (result.claimedCount === 0) {
      this.receipt = {
        title: '전체 수령 · 회수 가능한 보상 없음',
        detail: '재화와 업적 진행은 변경되지 않았습니다',
        tone: 'warning',
      };
      this.queueRender();
      return;
    }

    saveGameState(result.state);
    this.receipt = {
      title: `전체 수령 완료 · ${result.claimedCount}건`,
      detail: `젬 +${this.formatNumber(result.gems)} · 수정 +${this.formatNumber(result.soulCrystals)} · 보유 ${this.formatNumber(before.gems ?? 0)}→${this.formatNumber(result.state.gems ?? 0)} / ${this.formatNumber(before.soulCrystals ?? 0)}→${this.formatNumber(result.state.soulCrystals ?? 0)}`,
      tone: 'success',
    };
    this.queueRender();
  }
}
