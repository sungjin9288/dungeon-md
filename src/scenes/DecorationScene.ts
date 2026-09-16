/**
 * Decoration reliquary — a fixed-view set composition and placement surface.
 *
 * Set/relic selection is presentation-only. Acquisition, placement, removal,
 * slot capacity, and bonus aggregation remain owned by the existing data layer.
 */

import Phaser from 'phaser';
import { CANVAS_HEIGHT, CANVAS_WIDTH } from '../constants/layout';
import { COLORS, DUNGEON_UI, DUNGEON_UI_CSS } from '../constants/colors';
import { loadGameState, saveGameState, type GameState } from '../data/wisdom';
import { MATERIAL_DEFS } from '../data/fusion';
import {
  DECORATION_DEFS,
  SET_DEFS,
  SET_ORDER,
  activeSetTier,
  computeDecorationBonuses,
  decorationSlots,
  decorationsInSet,
  type DecorationBonuses,
  type DecorationDef,
  type SetTier,
} from '../data/decorations';
import {
  acquireDecoration,
  placeDecoration,
  unplaceDecoration,
} from '../data/decorationTransactions';
import {
  addFramedPanel,
  addPrimaryActionButton,
  addSceneHeader,
} from '../ui/GameUiPrimitives';
import { formatHudResourceValue } from '../ui/HudResourceFormatting';

type ReceiptTone = 'success' | 'warning';
type RelicActionKind = 'acquire' | 'place' | 'remove';

interface DecorationReceipt {
  readonly text: string;
  readonly tone: ReceiptTone;
}

interface RelicActionView {
  readonly kind: RelicActionKind;
  readonly label: string;
  readonly enabled: boolean;
  readonly status: string;
  readonly fillColor: number;
  readonly borderColor: number;
}

const PANEL_X = 14;
const PANEL_W = CANVAS_WIDTH - PANEL_X * 2;
const STATUS_Y = 82;
const SET_SELECTOR_Y = 142;
const SET_LEDGER_Y = 208;
const RELIC_LIST_Y = 350;
const COMMAND_Y = 466;
const TRANSACTION_COOLDOWN_MS = 250;

const SET_SHORT_NAMES: Record<string, string> = {
  bounty: '풍요',
  guardian: '수호',
  trapper: '함정',
  abyssal: '심연',
};

const BONUS_LABELS: ReadonlyArray<{ key: keyof DecorationBonuses; label: string }> = [
  { key: 'idleGoldPct', label: '방치 골드' },
  { key: 'idleProductionPct', label: '생산' },
  { key: 'dungeonHpPct', label: '던전 HP' },
  { key: 'trapDmgPct', label: '함정 피해' },
];

function now(): number {
  return Date.now();
}

export class DecorationScene extends Phaser.Scene {
  private gs!: GameState;
  private selectedSetId = SET_ORDER[0];
  private selectedDecorationId = decorationsInSet(SET_ORDER[0])[0];
  private receipt: DecorationReceipt | null = null;
  private transactionPending = false;
  private lastTransactionAt = 0;

  constructor() {
    super({ key: 'DecorationScene' });
  }

  create(): void {
    this.gs = loadGameState();
    this.selectedSetId = this.initialSetId();
    this.selectedDecorationId = decorationsInSet(this.selectedSetId)[0];
    this.receipt = null;
    this.transactionPending = false;
    this.lastTransactionAt = 0;
    this.cameras.main.setBounds(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    this.cameras.main.centerOn(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);
    this.render();
  }

  private initialSetId(): string {
    const placed = this.gs.placedDecorations ?? [];
    return SET_ORDER.find((setId) => placed.some((id) => DECORATION_DEFS[id]?.setId === setId))
      ?? SET_ORDER[0];
  }

  private render(): void {
    this.clearRenderedObjects();
    this.drawBackdrop();

    addSceneHeader(this, {
      title: '장식 보관실',
      subtitle: '전리품을 조율해 세트 효과를 활성화',
      onBack: () => {
        if (!this.transactionPending) this.scene.start('StageSelectScene');
      },
    });

    this.drawStatusRail();
    this.drawSetSelector();
    this.drawSetLedger();
    this.drawRelicSelector();
    this.drawCommandPlate();
  }

  private clearRenderedObjects(): void {
    this.tweens.killAll();
    for (const child of [...this.children.list]) child.destroy();
  }

  private drawBackdrop(): void {
    const g = this.add.graphics().setDepth(-900);
    g.fillStyle(DUNGEON_UI.VOID, 1);
    g.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    g.fillStyle(DUNGEON_UI.SOOT, 1);
    g.fillRect(0, 70, CANVAS_WIDTH, CANVAS_HEIGHT - 70);

    g.lineStyle(1, DUNGEON_UI.IRON, 0.24);
    for (let y = 80; y < CANVAS_HEIGHT; y += 34) {
      g.lineBetween(0, y, CANVAS_WIDTH, y);
      const offset = ((y - 80) / 34) % 2 === 0 ? 24 : 0;
      for (let x = offset; x < CANVAS_WIDTH; x += 52) g.lineBetween(x, y, x, y + 34);
    }

    g.lineStyle(2, DUNGEON_UI.BRASS, 0.16);
    g.beginPath();
    g.arc(CANVAS_WIDTH / 2, 430, 216, Phaser.Math.DegToRad(204), Phaser.Math.DegToRad(336));
    g.strokePath();
    g.fillStyle(COLORS.MAGIC_GLOW, 0.035);
    g.fillCircle(CANVAS_WIDTH / 2, 508, 176);
  }

  private drawStatusRail(): void {
    addFramedPanel(this, {
      x: PANEL_X,
      y: STATUS_Y,
      w: PANEL_W,
      h: 50,
      fillColor: DUNGEON_UI.STONE,
      borderColor: DUNGEON_UI.IRON,
      shadowOpacity: 0.28,
    });

    const owned = this.gs.ownedDecorations ?? [];
    const placed = this.gs.placedDecorations ?? [];
    const bonuses = computeDecorationBonuses(placed);
    const activeBonusCount = BONUS_LABELS.filter(({ key }) => bonuses[key] > 0).length;
    const items = [
      { label: '보유 골드', value: formatHudResourceValue(this.gs.homeGold), color: DUNGEON_UI_CSS.BRASS },
      { label: '보유 유물', value: `${owned.length} / ${Object.keys(DECORATION_DEFS).length}`, color: owned.length > 0 ? DUNGEON_UI_CSS.TEXT : DUNGEON_UI_CSS.MUTED },
      { label: '배치 슬롯', value: `${placed.length} / ${decorationSlots(this.gs.dmLevel)}`, color: placed.length > 0 ? DUNGEON_UI_CSS.JADE : DUNGEON_UI_CSS.MUTED },
      { label: '활성 효과', value: `${activeBonusCount}종`, color: activeBonusCount > 0 ? DUNGEON_UI_CSS.JADE : DUNGEON_UI_CSS.MUTED },
    ];

    items.forEach((item, index) => {
      const cellW = PANEL_W / items.length;
      const x = PANEL_X + cellW * index;
      if (index > 0) {
        const divider = this.add.graphics();
        divider.lineStyle(1, DUNGEON_UI.IRON, 0.7);
        divider.lineBetween(x, STATUS_Y + 10, x, STATUS_Y + 40);
      }
      this.add.text(x + cellW / 2, STATUS_Y + 15, item.label, {
        fontFamily: 'sans-serif', fontSize: '10px', color: DUNGEON_UI_CSS.MUTED,
      }).setOrigin(0.5);
      this.add.text(x + cellW / 2, STATUS_Y + 34, item.value, {
        fontFamily: 'sans-serif', fontSize: '13px', fontStyle: 'bold', color: item.color,
      }).setOrigin(0.5);
    });
  }

  private drawSetSelector(): void {
    const tabW = PANEL_W / SET_ORDER.length;
    const placed = this.gs.placedDecorations ?? [];

    SET_ORDER.forEach((setId, index) => {
      const selected = setId === this.selectedSetId;
      const placedCount = placed.filter((id) => DECORATION_DEFS[id]?.setId === setId).length;
      const active = activeSetTier(setId, placedCount) >= 0;
      const x = PANEL_X + index * tabW;
      const inset = 3;
      const tone = selected ? DUNGEON_UI.BRASS : active ? DUNGEON_UI.JADE : DUNGEON_UI.IRON;
      const g = this.add.graphics();
      g.fillStyle(selected ? DUNGEON_UI.STONE_RAISED : DUNGEON_UI.STONE, 1);
      g.fillRoundedRect(x + inset, SET_SELECTOR_Y, tabW - inset * 2, 54, 8);
      g.lineStyle(selected ? 2 : 1, tone, selected || active ? 0.95 : 0.7);
      g.strokeRoundedRect(x + inset, SET_SELECTOR_Y, tabW - inset * 2, 54, 8);
      if (selected) {
        g.fillStyle(DUNGEON_UI.BRASS, 1);
        g.fillTriangle(x + tabW / 2 - 5, SET_SELECTOR_Y, x + tabW / 2 + 5, SET_SELECTOR_Y, x + tabW / 2, SET_SELECTOR_Y + 7);
      }

      this.drawSetSigil(x + 20, SET_SELECTOR_Y + 27, setId, tone);
      this.add.text(x + 34, SET_SELECTOR_Y + 19, SET_SHORT_NAMES[setId] ?? setId, {
        fontFamily: 'sans-serif', fontSize: '11px', fontStyle: 'bold',
        color: selected ? DUNGEON_UI_CSS.PARCHMENT : DUNGEON_UI_CSS.TEXT,
      }).setOrigin(0, 0.5);
      this.add.text(x + 34, SET_SELECTOR_Y + 38, `${placedCount} / 3${active ? ' · 활성' : ''}`, {
        fontFamily: 'sans-serif', fontSize: '10px', fontStyle: active ? 'bold' : 'normal',
        color: active ? DUNGEON_UI_CSS.JADE : DUNGEON_UI_CSS.MUTED,
      }).setOrigin(0, 0.5);

      const zone = this.add.zone(x, SET_SELECTOR_Y, tabW, 54).setOrigin(0)
        .setInteractive({ useHandCursor: true });
      zone.setName(`decoration-set-${setId}`);
      zone.on('pointerdown', () => {
        if (this.transactionPending || this.selectedSetId === setId) return;
        this.selectedSetId = setId;
        this.selectedDecorationId = decorationsInSet(setId)[0];
        this.render();
      });
    });
  }

  private drawSetSigil(cx: number, cy: number, setId: string, tone: number): void {
    const g = this.add.graphics();
    g.lineStyle(2, tone, 0.95);
    if (setId === 'bounty') {
      g.strokeRoundedRect(cx - 7, cy - 4, 14, 12, 3);
      g.lineBetween(cx, cy - 4, cx, cy - 12);
      g.lineBetween(cx, cy - 9, cx - 6, cy - 13);
      g.lineBetween(cx, cy - 8, cx + 6, cy - 13);
    } else if (setId === 'guardian') {
      g.beginPath();
      g.moveTo(cx, cy - 13);
      g.lineTo(cx + 9, cy - 8);
      g.lineTo(cx + 7, cy + 7);
      g.lineTo(cx, cy + 13);
      g.lineTo(cx - 7, cy + 7);
      g.lineTo(cx - 9, cy - 8);
      g.closePath();
      g.strokePath();
    } else if (setId === 'trapper') {
      g.strokeTriangle(cx, cy - 13, cx + 11, cy + 10, cx - 11, cy + 10);
      g.lineBetween(cx - 6, cy + 2, cx + 6, cy + 2);
      g.lineBetween(cx, cy - 7, cx, cy + 9);
    } else {
      g.strokeTriangle(cx, cy - 13, cx + 10, cy, cx, cy + 13);
      g.strokeTriangle(cx, cy - 13, cx - 10, cy, cx, cy + 13);
      g.lineBetween(cx - 10, cy, cx + 10, cy);
    }
  }

  private drawSetLedger(): void {
    const set = SET_DEFS[this.selectedSetId];
    const placedCount = (this.gs.placedDecorations ?? [])
      .filter((id) => DECORATION_DEFS[id]?.setId === this.selectedSetId).length;
    const tierActive = activeSetTier(this.selectedSetId, placedCount) >= 0;
    addFramedPanel(this, {
      x: PANEL_X,
      y: SET_LEDGER_Y,
      w: PANEL_W,
      h: 112,
      fillColor: DUNGEON_UI.STONE_RAISED,
      borderColor: tierActive ? DUNGEON_UI.JADE : DUNGEON_UI.IRON,
      accentColor: DUNGEON_UI.BRASS,
      glowColor: DUNGEON_UI.JADE,
      glowOpacity: tierActive ? 0.06 : 0,
    });

    this.add.text(PANEL_X + 16, SET_LEDGER_Y + 21, set.name, {
      fontFamily: 'sans-serif', fontSize: '15px', fontStyle: 'bold', color: DUNGEON_UI_CSS.PARCHMENT,
    }).setOrigin(0, 0.5);
    this.add.text(PANEL_X + PANEL_W - 16, SET_LEDGER_Y + 21, `현재 ${placedCount} / 3`, {
      fontFamily: 'sans-serif', fontSize: '11px', fontStyle: 'bold',
      color: placedCount >= 2 ? DUNGEON_UI_CSS.JADE : DUNGEON_UI_CSS.MUTED,
    }).setOrigin(1, 0.5);
    this.add.text(PANEL_X + 16, SET_LEDGER_Y + 41, set.desc, {
      fontFamily: 'sans-serif', fontSize: '10px', color: DUNGEON_UI_CSS.MUTED,
    }).setOrigin(0, 0.5);

    set.tiers.forEach((tier, index) => {
      this.drawTierRow(SET_LEDGER_Y + 54 + index * 27, tier, placedCount);
    });
  }

  private drawTierRow(y: number, tier: SetTier, placedCount: number): void {
    const active = placedCount >= tier.count;
    const g = this.add.graphics();
    g.fillStyle(DUNGEON_UI.SOOT, 0.78);
    g.fillRoundedRect(PANEL_X + 14, y, PANEL_W - 28, 23, 6);
    g.lineStyle(1, active ? DUNGEON_UI.JADE : DUNGEON_UI.IRON, active ? 0.9 : 0.65);
    g.strokeRoundedRect(PANEL_X + 14, y, PANEL_W - 28, 23, 6);
    this.add.text(PANEL_X + 25, y + 11.5, active ? `${tier.count}개 · 활성` : `${tier.count}개 · ${Math.max(0, tier.count - placedCount)}개 필요`, {
      fontFamily: 'sans-serif', fontSize: '10px', fontStyle: 'bold',
      color: active ? DUNGEON_UI_CSS.JADE : DUNGEON_UI_CSS.MUTED,
    }).setOrigin(0, 0.5);
    this.add.text(PANEL_X + PANEL_W - 25, y + 11.5, this.formatBonuses(tier.bonus), {
      fontFamily: 'sans-serif', fontSize: '10px', fontStyle: 'bold', color: DUNGEON_UI_CSS.TEXT,
    }).setOrigin(1, 0.5);
  }

  private drawRelicSelector(): void {
    this.add.text(PANEL_X + 2, RELIC_LIST_Y - 11, '세트 유물 · 하나를 선택해 명령을 내리세요', {
      fontFamily: 'sans-serif', fontSize: '10px', fontStyle: 'bold', color: DUNGEON_UI_CSS.MUTED,
    }).setOrigin(0, 0.5);

    const ids = decorationsInSet(this.selectedSetId);
    const gap = 8;
    const cardW = (PANEL_W - gap * 2) / 3;
    ids.forEach((id, index) => {
      const def = DECORATION_DEFS[id];
      const selected = id === this.selectedDecorationId;
      const owned = (this.gs.ownedDecorations ?? []).includes(id);
      const placed = (this.gs.placedDecorations ?? []).includes(id);
      const x = PANEL_X + index * (cardW + gap);
      const tone = selected ? DUNGEON_UI.BRASS : placed ? DUNGEON_UI.JADE : DUNGEON_UI.IRON;
      const g = this.add.graphics();
      g.fillStyle(selected ? DUNGEON_UI.STONE_RAISED : DUNGEON_UI.STONE, 1);
      g.fillRoundedRect(x, RELIC_LIST_Y, cardW, 104, 10);
      g.lineStyle(selected ? 2 : 1, tone, selected || placed ? 0.95 : 0.7);
      g.strokeRoundedRect(x, RELIC_LIST_Y, cardW, 104, 10);
      if (placed) {
        g.fillStyle(DUNGEON_UI.JADE, 0.12);
        g.fillRoundedRect(x + 4, RELIC_LIST_Y + 4, cardW - 8, 28, 7);
      }
      if (selected) {
        g.fillStyle(DUNGEON_UI.BRASS, 1);
        g.fillTriangle(x + cardW / 2 - 6, RELIC_LIST_Y, x + cardW / 2 + 6, RELIC_LIST_Y, x + cardW / 2, RELIC_LIST_Y + 8);
      }

      this.add.text(x + cardW / 2, RELIC_LIST_Y + 29, def.emoji, {
        fontFamily: 'sans-serif', fontSize: '24px',
      }).setOrigin(0.5);
      this.add.text(x + cardW / 2, RELIC_LIST_Y + 62, def.name, {
        fontFamily: 'sans-serif', fontSize: '12px', fontStyle: 'bold',
        color: owned ? DUNGEON_UI_CSS.PARCHMENT : DUNGEON_UI_CSS.TEXT,
        align: 'center', wordWrap: { width: cardW - 10 },
      }).setOrigin(0.5);
      this.add.text(x + cardW / 2, RELIC_LIST_Y + 88, placed ? '배치 중' : owned ? '보유' : '미보유', {
        fontFamily: 'sans-serif', fontSize: '10px', fontStyle: 'bold',
        color: placed ? DUNGEON_UI_CSS.JADE : owned ? DUNGEON_UI_CSS.BRASS : DUNGEON_UI_CSS.MUTED,
      }).setOrigin(0.5);

      const zone = this.add.zone(x, RELIC_LIST_Y, cardW, 104).setOrigin(0)
        .setInteractive({ useHandCursor: true });
      zone.setName(`decoration-relic-${id}`);
      zone.on('pointerdown', () => {
        if (this.transactionPending || this.selectedDecorationId === id) return;
        this.selectedDecorationId = id;
        this.render();
      });
    });
  }

  private drawCommandPlate(): void {
    const def = DECORATION_DEFS[this.selectedDecorationId];
    const action = this.getActionView(def);
    const placed = this.gs.placedDecorations ?? [];
    const currentSetCount = placed.filter((id) => DECORATION_DEFS[id]?.setId === def.setId).length;
    const nextSetCount = action.kind === 'place'
      ? currentSetCount + 1
      : action.kind === 'remove'
        ? Math.max(0, currentSetCount - 1)
        : currentSetCount;
    const panelTone = action.enabled
      ? action.kind === 'place' ? DUNGEON_UI.JADE : action.kind === 'remove' ? DUNGEON_UI.EMBER : DUNGEON_UI.BRASS
      : DUNGEON_UI.EMBER;

    addFramedPanel(this, {
      x: PANEL_X,
      y: COMMAND_Y,
      w: PANEL_W,
      h: 362,
      fillColor: DUNGEON_UI.STONE_RAISED,
      borderColor: panelTone,
      accentColor: panelTone,
      glowColor: panelTone,
      glowOpacity: action.enabled ? 0.07 : 0,
    });

    const iconG = this.add.graphics();
    iconG.fillStyle(DUNGEON_UI.SOOT, 1);
    iconG.fillCircle(PANEL_X + 37, COMMAND_Y + 30, 22);
    iconG.lineStyle(1.5, panelTone, 0.85);
    iconG.strokeCircle(PANEL_X + 37, COMMAND_Y + 30, 22);
    this.add.text(PANEL_X + 37, COMMAND_Y + 30, def.emoji, {
      fontFamily: 'sans-serif', fontSize: '23px',
    }).setOrigin(0.5);

    this.add.text(PANEL_X + 70, COMMAND_Y + 22, def.name, {
      fontFamily: 'sans-serif', fontSize: '17px', fontStyle: 'bold', color: DUNGEON_UI_CSS.PARCHMENT,
    }).setOrigin(0, 0.5);
    this.add.text(PANEL_X + 70, COMMAND_Y + 46, def.desc, {
      fontFamily: 'sans-serif', fontSize: '10px', color: DUNGEON_UI_CSS.MUTED,
    }).setOrigin(0, 0.5);
    this.add.text(PANEL_X + PANEL_W - 16, COMMAND_Y + 24, this.relicStateLabel(def.id), {
      fontFamily: 'sans-serif', fontSize: '11px', fontStyle: 'bold',
      color: action.kind === 'remove' ? DUNGEON_UI_CSS.JADE : action.kind === 'place' ? DUNGEON_UI_CSS.BRASS : DUNGEON_UI_CSS.MUTED,
    }).setOrigin(1, 0.5);

    this.drawCommandRow(COMMAND_Y + 70, '현재 세트', this.formatSetState(def.setId, currentSetCount), DUNGEON_UI_CSS.TEXT);
    this.drawCommandRow(
      COMMAND_Y + 103,
      action.kind === 'acquire' ? '획득 이후' : action.kind === 'place' ? '배치 이후' : '해제 이후',
      action.kind === 'acquire' ? '획득 후 배치 필요' : this.formatSetState(def.setId, nextSetCount),
      action.kind === 'place' ? DUNGEON_UI_CSS.JADE : action.kind === 'remove' ? DUNGEON_UI_CSS.EMBER : DUNGEON_UI_CSS.MUTED,
    );

    this.drawCostBlock(def, action, COMMAND_Y + 151);
    this.add.text(PANEL_X + 16, COMMAND_Y + 225, action.status, {
      fontFamily: 'sans-serif', fontSize: '10px', fontStyle: 'bold',
      color: action.enabled ? (action.kind === 'place' ? DUNGEON_UI_CSS.JADE : DUNGEON_UI_CSS.BRASS) : DUNGEON_UI_CSS.EMBER,
      wordWrap: { width: PANEL_W - 32 },
      lineSpacing: 2,
    }).setOrigin(0, 0.5);

    this.add.text(PANEL_X + 16, COMMAND_Y + 292, this.receipt?.text ?? '선택한 유물의 비용과 세트 영향을 확인하세요', {
      fontFamily: 'sans-serif', fontSize: '10px', fontStyle: this.receipt ? 'bold' : 'normal',
      color: this.receipt?.tone === 'warning' ? DUNGEON_UI_CSS.EMBER : this.receipt ? DUNGEON_UI_CSS.JADE : DUNGEON_UI_CSS.MUTED,
      wordWrap: { width: 184 },
      lineSpacing: 2,
    }).setOrigin(0, 0.5);

    const button = addPrimaryActionButton(this, {
      x: 226,
      y: COMMAND_Y + 271,
      w: 136,
      h: 54,
      label: action.label,
      fontSize: '14px',
      enabled: action.enabled,
      once: true,
      fillColor: action.fillColor,
      hoverFillColor: action.kind === 'place' ? 0x63ad89 : action.kind === 'remove' ? 0xd06c56 : DUNGEON_UI.BRASS_BRIGHT,
      borderColor: action.borderColor,
      disabledFillColor: DUNGEON_UI.STONE,
      disabledBorderColor: DUNGEON_UI.EMBER,
      textColor: '#fff6dc',
      onPress: () => this.executeAction(def.id, action.kind),
    });
    button.zone.setName('decoration-order');
    this.bindTransactionAction(button.zone);
  }

  private drawCommandRow(y: number, label: string, value: string, valueColor: string): void {
    const g = this.add.graphics();
    g.fillStyle(DUNGEON_UI.SOOT, 0.78);
    g.fillRoundedRect(PANEL_X + 14, y, PANEL_W - 28, 25, 6);
    g.lineStyle(1, DUNGEON_UI.IRON, 0.7);
    g.strokeRoundedRect(PANEL_X + 14, y, PANEL_W - 28, 25, 6);
    this.add.text(PANEL_X + 26, y + 12.5, label, {
      fontFamily: 'sans-serif', fontSize: '10px', color: DUNGEON_UI_CSS.MUTED,
    }).setOrigin(0, 0.5);
    this.add.text(PANEL_X + PANEL_W - 26, y + 12.5, value, {
      fontFamily: 'sans-serif', fontSize: '10px', fontStyle: 'bold', color: valueColor,
    }).setOrigin(1, 0.5);
  }

  private drawCostBlock(def: DecorationDef, action: RelicActionView, y: number): void {
    this.add.text(PANEL_X + 16, y, action.kind === 'acquire' ? '획득 비용' : '배치 조건', {
      fontFamily: 'sans-serif', fontSize: '10px', fontStyle: 'bold', color: DUNGEON_UI_CSS.MUTED,
    }).setOrigin(0, 0.5);

    if (action.kind !== 'acquire') {
      const placed = (this.gs.placedDecorations ?? []).length;
      const cap = decorationSlots(this.gs.dmLevel);
      const value = action.kind === 'remove' ? `해제 후 ${Math.max(0, placed - 1)} / ${cap}` : `현재 ${placed} / ${cap}`;
      this.add.text(PANEL_X + 16, y + 26, `배치 슬롯 · ${value}`, {
        fontFamily: 'sans-serif', fontSize: '11px', fontStyle: 'bold',
        color: action.enabled ? DUNGEON_UI_CSS.TEXT : DUNGEON_UI_CSS.EMBER,
      }).setOrigin(0, 0.5);
      return;
    }

    if (def.cost.kind === 'gold') {
      const shortage = Math.max(0, def.cost.gold - this.gs.homeGold);
      const values = [
        { label: '보유', value: formatHudResourceValue(this.gs.homeGold), ok: this.gs.homeGold >= def.cost.gold },
        { label: '필요', value: def.cost.gold.toLocaleString('ko-KR'), ok: true },
        { label: '부족', value: shortage.toLocaleString('ko-KR'), ok: shortage === 0 },
      ];
      values.forEach((item, index) => this.drawCostChip(PANEL_X + 16 + index * 108, y + 15, 100, item.label, item.value, item.ok));
      return;
    }

    const entries = Object.entries(def.cost.materials);
    const chipW = entries.length === 3 ? 104 : 158;
    entries.forEach(([id, need], index) => {
      const have = this.gs.materials?.[id] ?? 0;
      this.drawCostChip(
        PANEL_X + 16 + index * (chipW + 6),
        y + 15,
        chipW,
        MATERIAL_DEFS[id]?.name ?? id,
        `${have.toLocaleString('ko-KR')} / ${need.toLocaleString('ko-KR')}`,
        have >= need,
      );
    });
  }

  private drawCostChip(x: number, y: number, w: number, label: string, value: string, ok: boolean): void {
    const g = this.add.graphics();
    g.fillStyle(DUNGEON_UI.SOOT, 0.75);
    g.fillRoundedRect(x, y, w, 40, 6);
    g.lineStyle(1, ok ? DUNGEON_UI.IRON : DUNGEON_UI.EMBER, ok ? 0.75 : 0.95);
    g.strokeRoundedRect(x, y, w, 40, 6);
    this.add.text(x + 8, y + 11, label, {
      fontFamily: 'sans-serif', fontSize: '10px', color: DUNGEON_UI_CSS.MUTED,
    }).setOrigin(0, 0.5);
    this.add.text(x + w - 8, y + 28, value, {
      fontFamily: 'sans-serif', fontSize: '10px', fontStyle: 'bold',
      color: ok ? DUNGEON_UI_CSS.TEXT : DUNGEON_UI_CSS.EMBER,
    }).setOrigin(1, 0.5);
  }

  private getActionView(def: DecorationDef): RelicActionView {
    const owned = (this.gs.ownedDecorations ?? []).includes(def.id);
    const placed = (this.gs.placedDecorations ?? []).includes(def.id);
    if (!owned) {
      const affordable = this.canAfford(def);
      return {
        kind: 'acquire',
        label: '유물 획득',
        enabled: affordable,
        status: affordable ? this.affordableStatus(def) : this.shortageStatus(def),
        fillColor: DUNGEON_UI.BRASS,
        borderColor: 0x705126,
      };
    }
    if (placed) {
      return {
        kind: 'remove',
        label: '배치 해제',
        enabled: true,
        status: '해제 가능 · 세트 효과가 감소할 수 있습니다',
        fillColor: DUNGEON_UI.EMBER,
        borderColor: COLORS.BLOOD_RED,
      };
    }

    const placedCount = (this.gs.placedDecorations ?? []).length;
    const cap = decorationSlots(this.gs.dmLevel);
    const enabled = placedCount < cap;
    return {
      kind: 'place',
      label: '전시 배치',
      enabled,
      status: enabled ? `배치 가능 · 남은 슬롯 ${cap - placedCount}` : `배치 슬롯 ${placedCount} / ${cap} · 다른 유물을 먼저 해제하세요`,
      fillColor: DUNGEON_UI.JADE,
      borderColor: 0x2d6c52,
    };
  }

  private canAfford(def: DecorationDef): boolean {
    if (def.cost.kind === 'gold') return this.gs.homeGold >= def.cost.gold;
    return Object.entries(def.cost.materials)
      .every(([id, need]) => (this.gs.materials?.[id] ?? 0) >= need);
  }

  private affordableStatus(def: DecorationDef): string {
    if (def.cost.kind === 'gold') return `획득 가능 · 골드 ${def.cost.gold.toLocaleString('ko-KR')} 소모`;
    return '제작 가능 · 표시된 재료를 정확히 소모합니다';
  }

  private shortageStatus(def: DecorationDef): string {
    if (def.cost.kind === 'gold') {
      return `골드 ${(def.cost.gold - this.gs.homeGold).toLocaleString('ko-KR')} 부족 · 필요 ${def.cost.gold.toLocaleString('ko-KR')}`;
    }
    const missing = Object.entries(def.cost.materials)
      .filter(([id, need]) => (this.gs.materials?.[id] ?? 0) < need)
      .map(([id, need]) => `${MATERIAL_DEFS[id]?.name ?? id} ${need - (this.gs.materials?.[id] ?? 0)} 부족`);
    return missing.join(' · ');
  }

  private relicStateLabel(id: string): string {
    if ((this.gs.placedDecorations ?? []).includes(id)) return '배치 중';
    if ((this.gs.ownedDecorations ?? []).includes(id)) return '보유';
    return '미보유';
  }

  private formatBonuses(bonuses: Partial<DecorationBonuses>): string {
    const parts = BONUS_LABELS
      .filter(({ key }) => (bonuses[key] ?? 0) > 0)
      .map(({ key, label }) => `${label} +${bonuses[key]}%`);
    return parts.join(' · ') || '효과 없음';
  }

  private formatSetState(setId: string, placedCount: number): string {
    const tierIndex = activeSetTier(setId, placedCount);
    if (tierIndex < 0) return `${placedCount} / 3 · 효과 대기`;
    return `${placedCount} / 3 · ${this.formatBonuses(SET_DEFS[setId].tiers[tierIndex].bonus)}`;
  }

  private costReceipt(def: DecorationDef): string {
    if (def.cost.kind === 'gold') return `골드 ${def.cost.gold.toLocaleString('ko-KR')} 소모`;
    return Object.entries(def.cost.materials)
      .map(([id, quantity]) => `${MATERIAL_DEFS[id]?.name ?? id} ${quantity}`)
      .join(' · ');
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

  private beginTransaction(): boolean {
    this.transactionPending = false;
    const timestamp = now();
    if (timestamp - this.lastTransactionAt < TRANSACTION_COOLDOWN_MS) return false;
    this.lastTransactionAt = timestamp;
    return true;
  }

  private executeAction(id: string, kind: RelicActionKind): void {
    if (!this.beginTransaction()) return;
    if (kind === 'acquire') this.acquire(id);
    else if (kind === 'place') this.place(id);
    else this.remove(id);
  }

  private acquire(id: string): void {
    const result = acquireDecoration(this.gs, id);
    if (!result.ok) {
      this.receipt = {
        text: result.reason === 'no_gold'
          ? '명령 실패 · 골드가 부족합니다'
          : result.reason === 'no_materials'
            ? '명령 실패 · 재료가 부족합니다'
            : result.reason === 'owned'
              ? '명령 실패 · 이미 보유한 유물입니다'
              : '명령 실패 · 알 수 없는 유물입니다',
        tone: 'warning',
      };
      this.render();
      return;
    }

    this.gs = result.state;
    saveGameState(this.gs);
    const def = DECORATION_DEFS[id];
    this.receipt = { text: `${def.name} 획득 완료 · ${this.costReceipt(def)}`, tone: 'success' };
    this.render();
  }

  private place(id: string): void {
    const result = placeDecoration(this.gs, id);
    if (!result.ok) {
      this.receipt = {
        text: result.reason === 'no_slots'
          ? '명령 실패 · 배치 슬롯이 가득 찼습니다'
          : result.reason === 'not_owned'
            ? '명령 실패 · 보유하지 않은 유물입니다'
            : '명령 실패 · 배치 상태를 다시 확인하세요',
        tone: 'warning',
      };
      this.render();
      return;
    }

    this.gs = result.state;
    saveGameState(this.gs);
    const def = DECORATION_DEFS[id];
    const count = (this.gs.placedDecorations ?? []).filter((item) => DECORATION_DEFS[item]?.setId === def.setId).length;
    this.receipt = { text: `${def.name} 배치 완료 · ${this.formatSetState(def.setId, count)}`, tone: 'success' };
    this.render();
  }

  private remove(id: string): void {
    const next = unplaceDecoration(this.gs, id);
    if (next === this.gs) {
      this.receipt = { text: '명령 실패 · 배치 상태를 다시 확인하세요', tone: 'warning' };
      this.render();
      return;
    }

    this.gs = next;
    saveGameState(this.gs);
    const def = DECORATION_DEFS[id];
    const count = (this.gs.placedDecorations ?? []).filter((item) => DECORATION_DEFS[item]?.setId === def.setId).length;
    this.receipt = { text: `${def.name} 배치 해제 · ${this.formatSetState(def.setId, count)}`, tone: 'success' };
    this.render();
  }
}
