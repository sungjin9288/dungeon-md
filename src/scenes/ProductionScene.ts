/**
 * Production district — the dungeon's compact mine, workshop, and treasury loop.
 *
 * Facility selection is presentation-only. Build/upgrade and collection remain
 * owned by the existing immutable data transactions.
 */

import Phaser from 'phaser';
import { CANVAS_HEIGHT, CANVAS_WIDTH } from '../constants/layout';
import { DUNGEON_UI, DUNGEON_UI_CSS } from '../constants/colors';
import { loadGameState, saveGameState, type GameState } from '../data/wisdom';
import { MATERIAL_DEFS } from '../data/fusion';
import {
  FACILITY_DEFS,
  FACILITY_ORDER,
  builtFacilityCount,
  facilityUpgradeCost,
  type FacilityDef,
  facilityStaffMult,
} from '../data/production';
import { assignFacilityStaff, buildOrUpgradeFacility, clearFacilityStaff } from '../data/productionTransactions';
import { resolveOwnedMonsterProfile } from '../data/monsters';
import { openProductionStaffPicker } from '../ui/ProductionStaffPicker';
import {
  idleCapHours,
  productionRatePerHour,
  collectIdleIncome,
  computeIdleReward,
  hasIdlePayout,
  type IdleReward,
} from '../data/idleIncome';
import {
  addFramedPanel,
  addPrimaryActionButton,
  addSceneHeader,
} from '../ui/GameUiPrimitives';
import { formatHudResourceValue } from '../ui/HudResourceFormatting';

type ReceiptTone = 'success' | 'warning';

interface ProductionReceipt {
  readonly text: string;
  readonly tone: ReceiptTone;
}

const PANEL_X = 14;
const PANEL_W = CANVAS_WIDTH - PANEL_X * 2;
const STATUS_Y = 82;
const COLLECT_Y = 140;
const DISTRICT_Y = 260;
const COMMAND_Y = 570;
const TRANSACTION_COOLDOWN_MS = 250;

function now(): number {
  return Date.now();
}

function formatRate(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function formatElapsed(reward: IdleReward, clockStarted: boolean, capHours: number): string {
  if (!clockStarted) return '첫 시설 가동 후 적립을 시작합니다';
  if (reward.capped) return `${capHours}시간 적립 상한 도달`;

  const minutes = Math.floor(reward.creditedMs / 60_000);
  if (minutes < 1) return '1분 미만 누적';
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest}분 누적`;
  return rest > 0 ? `${hours}시간 ${rest}분 누적` : `${hours}시간 누적`;
}

export class ProductionScene extends Phaser.Scene {
  private gs!: GameState;
  private selectedFacilityId = FACILITY_ORDER[0];
  private receipt: ProductionReceipt | null = null;
  private transactionPending = false;
  private lastTransactionAt = 0;

  constructor() {
    super({ key: 'ProductionScene' });
  }

  create(): void {
    this.gs = loadGameState();
    this.selectedFacilityId = FACILITY_ORDER[0];
    this.receipt = null;
    this.transactionPending = false;
    this.lastTransactionAt = 0;
    this.render();
  }

  private render(): void {
    this.clearRenderedObjects();
    this.drawBackdrop();

    addSceneHeader(this, {
      title: '생산 구역',
      subtitle: '던전의 자원맥과 저장고',
      onBack: () => {
        if (!this.transactionPending) this.scene.start('StageSelectScene');
      },
    });

    const reward = computeIdleReward(this.gs, now());
    this.drawStatusRail();
    this.drawCollectionCistern(reward);
    this.drawDistrict();
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
    g.lineStyle(1, DUNGEON_UI.IRON, 0.28);
    for (let y = 78; y < CANVAS_HEIGHT; y += 34) {
      g.lineBetween(0, y, CANVAS_WIDTH, y);
      const offset = ((y - 78) / 34) % 2 === 0 ? 22 : 0;
      for (let x = offset; x < CANVAS_WIDTH; x += 52) g.lineBetween(x, y, x, y + 34);
    }

    g.lineStyle(2, DUNGEON_UI.BRASS, 0.22);
    g.beginPath();
    g.arc(CANVAS_WIDTH / 2, 345, 214, Phaser.Math.DegToRad(205), Phaser.Math.DegToRad(335));
    g.strokePath();
    g.fillStyle(DUNGEON_UI.JADE, 0.05);
    g.fillCircle(CANVAS_WIDTH / 2, 430, 178);
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

    const built = builtFacilityCount(this.gs.productionFacilities);
    let materialRate = 0;
    let treasuryRate = 0;
    for (const id of FACILITY_ORDER) {
      const def = FACILITY_DEFS[id];
      const rate = productionRatePerHour(this.gs, def);
      if (def.output.kind === 'gold') treasuryRate += rate;
      else materialRate += rate;
    }

    const items = [
      { label: '보유 골드', value: formatHudResourceValue(this.gs.homeGold), color: DUNGEON_UI_CSS.BRASS },
      { label: '가동 시설', value: `${built} / ${FACILITY_ORDER.length}`, color: built > 0 ? DUNGEON_UI_CSS.JADE : DUNGEON_UI_CSS.MUTED },
      { label: '재료 / 시간', value: formatRate(materialRate), color: DUNGEON_UI_CSS.TEXT },
      { label: '보물고 / 시간', value: formatRate(treasuryRate), color: DUNGEON_UI_CSS.TEXT },
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

  private drawCollectionCistern(reward: IdleReward): void {
    const payable = hasIdlePayout(reward);
    addFramedPanel(this, {
      x: PANEL_X,
      y: COLLECT_Y,
      w: PANEL_W,
      h: 110,
      fillColor: DUNGEON_UI.STONE_RAISED,
      borderColor: payable ? DUNGEON_UI.JADE : DUNGEON_UI.IRON,
      accentColor: payable ? DUNGEON_UI.JADE : DUNGEON_UI.BRASS,
      glowColor: DUNGEON_UI.JADE,
      glowOpacity: payable ? 0.08 : 0,
    });

    this.drawCisternGauge(38, COLLECT_Y + 54, payable);
    this.add.text(65, COLLECT_Y + 19, '누적 생산 저장조', {
      fontFamily: 'sans-serif', fontSize: '14px', fontStyle: 'bold', color: DUNGEON_UI_CSS.PARCHMENT,
    }).setOrigin(0, 0.5);
    this.add.text(PANEL_X + PANEL_W - 14, COLLECT_Y + 19, `최대 ${idleCapHours(this.gs)}시간`, {
      fontFamily: 'sans-serif', fontSize: '10px', fontStyle: 'bold', color: DUNGEON_UI_CSS.MUTED,
    }).setOrigin(1, 0.5);

    this.add.text(65, COLLECT_Y + 42, formatElapsed(reward, (this.gs.lastIdleCollect ?? 0) > 0, idleCapHours(this.gs)), {
      fontFamily: 'sans-serif', fontSize: '10px', color: reward.capped ? DUNGEON_UI_CSS.EMBER : DUNGEON_UI_CSS.MUTED,
    }).setOrigin(0, 0.5);

    const rewardLines = this.rewardLines(reward);
    this.add.text(65, COLLECT_Y + 64, rewardLines[0], {
      fontFamily: 'sans-serif', fontSize: '11px', fontStyle: 'bold', color: payable ? DUNGEON_UI_CSS.TEXT : DUNGEON_UI_CSS.MUTED,
    }).setOrigin(0, 0.5);
    if (rewardLines[1]) {
      this.add.text(65, COLLECT_Y + 82, rewardLines[1], {
        fontFamily: 'sans-serif', fontSize: '10px', fontStyle: 'bold', color: DUNGEON_UI_CSS.TEXT,
      }).setOrigin(0, 0.5);
    }

    const button = addPrimaryActionButton(this, {
      x: 250,
      y: COLLECT_Y + 48,
      w: 112,
      h: 48,
      label: payable ? '생산 수령' : '대기 중',
      fontSize: '13px',
      enabled: payable,
      once: true,
      fillColor: DUNGEON_UI.JADE,
      hoverFillColor: 0x63ad89,
      borderColor: 0x2d6c52,
      disabledFillColor: DUNGEON_UI.STONE,
      disabledBorderColor: DUNGEON_UI.IRON,
      onPress: () => this.collect(),
    });
    button.zone.setName('production-collect');
    this.bindTransactionAction(button.zone);
  }

  private drawCisternGauge(cx: number, cy: number, active: boolean): void {
    const g = this.add.graphics();
    const tone = active ? DUNGEON_UI.JADE : DUNGEON_UI.EDGE;
    g.lineStyle(2, tone, 0.9);
    g.strokeRoundedRect(cx - 15, cy - 22, 30, 44, 7);
    g.fillStyle(tone, active ? 0.55 : 0.14);
    g.fillRoundedRect(cx - 11, cy + (active ? -7 : 9), 22, active ? 25 : 7, 4);
    g.lineStyle(1, DUNGEON_UI.BRASS, 0.7);
    g.lineBetween(cx - 7, cy - 28, cx + 7, cy - 28);
    g.lineBetween(cx, cy - 28, cx, cy - 22);
  }

  private rewardLines(reward: IdleReward): readonly [string, string?] {
    const values: string[] = [];
    if (reward.gold > 0) values.push(`골드 +${reward.gold.toLocaleString('ko-KR')}`);
    for (const [id, quantity] of Object.entries(reward.materials)) {
      values.push(`${MATERIAL_DEFS[id]?.name ?? id} +${quantity}`);
    }
    if (values.length === 0) return ['저장된 자원이 없습니다'];
    return [values.slice(0, 2).join(' · '), values.slice(2).join(' · ') || undefined];
  }

  private drawDistrict(): void {
    addFramedPanel(this, {
      x: PANEL_X,
      y: DISTRICT_Y,
      w: PANEL_W,
      h: 300,
      fillColor: DUNGEON_UI.STONE,
      borderColor: DUNGEON_UI.IRON,
      shadowOpacity: 0.32,
    });

    this.add.text(PANEL_X + 14, DISTRICT_Y + 18, '지하 생산망', {
      fontFamily: 'sans-serif', fontSize: '14px', fontStyle: 'bold', color: DUNGEON_UI_CSS.PARCHMENT,
    }).setOrigin(0, 0.5);
    this.add.text(PANEL_X + PANEL_W - 14, DISTRICT_Y + 18, '시설을 선택해 명령을 내리세요', {
      fontFamily: 'sans-serif', fontSize: '10px', color: DUNGEON_UI_CSS.MUTED,
    }).setOrigin(1, 0.5);

    this.drawDistrictConduits();
    const positions = [
      { x: 18, y: DISTRICT_Y + 40 },
      { x: 141, y: DISTRICT_Y + 40 },
      { x: 264, y: DISTRICT_Y + 40 },
      { x: 80, y: DISTRICT_Y + 168 },
      { x: 203, y: DISTRICT_Y + 168 },
    ];
    FACILITY_ORDER.forEach((id, index) => this.drawFacilityNode(id, positions[index].x, positions[index].y));
  }

  private drawDistrictConduits(): void {
    const g = this.add.graphics();
    g.lineStyle(5, DUNGEON_UI.SOOT, 1);
    g.lineBetween(72, DISTRICT_Y + 154, 318, DISTRICT_Y + 154);
    g.lineBetween(134, DISTRICT_Y + 154, 134, DISTRICT_Y + 168);
    g.lineBetween(257, DISTRICT_Y + 154, 257, DISTRICT_Y + 168);
    g.lineStyle(1, DUNGEON_UI.BRASS, 0.42);
    g.lineBetween(72, DISTRICT_Y + 154, 318, DISTRICT_Y + 154);
    g.fillStyle(DUNGEON_UI.BRASS, 0.7);
    for (const x of [72, 195, 318]) g.fillCircle(x, DISTRICT_Y + 154, 3);
  }

  private drawFacilityNode(id: string, x: number, y: number): void {
    const def = FACILITY_DEFS[id];
    const level = this.gs.productionFacilities?.[id] ?? 0;
    const built = level > 0;
    const selected = id === this.selectedFacilityId;
    const accent = selected ? DUNGEON_UI.BRASS_BRIGHT : built ? DUNGEON_UI.JADE : DUNGEON_UI.EDGE;
    const w = 108;
    const h = 112;

    const g = this.add.graphics();
    g.fillStyle(selected ? DUNGEON_UI.STONE_RAISED : DUNGEON_UI.SOOT, 1);
    g.fillRoundedRect(x, y, w, h, 10);
    g.lineStyle(selected ? 2 : 1, accent, selected ? 1 : 0.75);
    g.strokeRoundedRect(x, y, w, h, 10);
    if (built) {
      g.fillStyle(DUNGEON_UI.JADE, 0.13);
      g.fillRect(x + 6, y + 6, w - 12, 3);
    }
    if (selected) {
      g.fillStyle(DUNGEON_UI.BRASS_BRIGHT, 0.9);
      g.fillTriangle(x + w / 2 - 5, y + 2, x + w / 2 + 5, y + 2, x + w / 2, y + 9);
    }

    this.drawFacilitySigil(id, x + w / 2, y + 31, accent);
    this.add.text(x + w / 2, y + 58, def.name, {
      fontFamily: 'sans-serif', fontSize: '13px', fontStyle: 'bold', color: DUNGEON_UI_CSS.PARCHMENT,
    }).setOrigin(0.5);
    this.add.text(x + w / 2, y + 78, built ? `가동 · Lv.${level}` : '미건설', {
      fontFamily: 'sans-serif', fontSize: '10px', fontStyle: 'bold', color: built ? DUNGEON_UI_CSS.JADE : DUNGEON_UI_CSS.MUTED,
    }).setOrigin(0.5);
    const buildCost = built ? null : facilityUpgradeCost(def, 0);
    const canBuild = buildCost !== null && this.gs.homeGold >= buildCost;
    const footer = built
      ? this.outputLabel(def, productionRatePerHour(this.gs, def, level), true)
      : buildCost === null ? '건설 불가' : `건설 ${buildCost.toLocaleString('ko-KR')}골드`;
    this.add.text(x + w / 2, y + 97, footer, {
      fontFamily: 'sans-serif', fontSize: '10px', fontStyle: canBuild ? 'bold' : 'normal',
      color: built ? DUNGEON_UI_CSS.TEXT : canBuild ? DUNGEON_UI_CSS.BRASS : DUNGEON_UI_CSS.MUTED,
    }).setOrigin(0.5);

    const zone = this.add.zone(x, y, w, h).setOrigin(0).setName(`production-facility-${id}`)
      .setInteractive({ useHandCursor: true });
    zone.on('pointerdown', () => {
      if (this.transactionPending || id === this.selectedFacilityId) return;
      this.selectedFacilityId = id;
      this.render();
    });
  }

  private drawFacilitySigil(id: string, cx: number, cy: number, accent: number): void {
    const g = this.add.graphics();
    g.lineStyle(2, accent, 1);
    g.fillStyle(accent, 0.16);
    g.fillCircle(cx, cy, 20);

    if (id === 'mine') {
      g.lineBetween(cx - 10, cy + 10, cx + 8, cy - 10);
      g.lineBetween(cx - 5, cy - 8, cx + 11, cy + 9);
      g.lineStyle(3, accent, 1);
      g.lineBetween(cx + 2, cy - 11, cx + 12, cy - 4);
    } else if (id === 'herb_garden') {
      g.lineBetween(cx, cy + 12, cx, cy - 10);
      g.fillStyle(accent, 0.82);
      g.fillEllipse(cx - 7, cy - 3, 12, 7);
      g.fillEllipse(cx + 7, cy + 3, 12, 7);
      g.fillEllipse(cx + 5, cy - 9, 10, 6);
    } else if (id === 'weavery') {
      g.strokeRect(cx - 11, cy - 11, 22, 22);
      for (const dx of [-7, -2, 3, 8]) g.lineBetween(cx + dx, cy - 9, cx + dx, cy + 9);
      g.lineBetween(cx - 11, cy - 3, cx + 11, cy + 5);
    } else if (id === 'mana_well') {
      g.strokeCircle(cx, cy - 3, 10);
      g.lineBetween(cx - 13, cy + 9, cx + 13, cy + 9);
      g.lineBetween(cx - 8, cy + 4, cx - 8, cy + 13);
      g.lineBetween(cx + 8, cy + 4, cx + 8, cy + 13);
      g.fillStyle(accent, 0.9);
      g.fillCircle(cx, cy - 3, 3);
    } else {
      g.fillStyle(accent, 0.2);
      g.fillRoundedRect(cx - 13, cy - 7, 26, 19, 3);
      g.lineStyle(2, accent, 1);
      g.strokeRoundedRect(cx - 13, cy - 7, 26, 19, 3);
      g.lineBetween(cx - 13, cy - 1, cx + 13, cy - 1);
      g.fillStyle(accent, 1);
      g.fillRect(cx - 2, cy - 2, 4, 7);
    }
  }

  private drawCommandPlate(): void {
    const def = FACILITY_DEFS[this.selectedFacilityId];
    const level = this.gs.productionFacilities?.[def.id] ?? 0;
    const staffId = this.gs.facilityStaff?.[def.id];
    const staffMult = facilityStaffMult(def.id, staffId);
    const currentRate = productionRatePerHour(this.gs, def, level);
    const cost = facilityUpgradeCost(def, level);
    const nextRate = cost === null ? currentRate : productionRatePerHour(this.gs, def, level + 1);
    const affordable = cost !== null && this.gs.homeGold >= cost;
    const accent = affordable ? DUNGEON_UI.BRASS_BRIGHT : cost === null ? DUNGEON_UI.JADE : DUNGEON_UI.EMBER;

    addFramedPanel(this, {
      x: PANEL_X,
      y: COMMAND_Y,
      w: PANEL_W,
      h: 256,
      fillColor: DUNGEON_UI.STONE_RAISED,
      borderColor: accent,
      accentColor: accent,
      glowColor: accent,
      glowOpacity: affordable ? 0.06 : 0,
      shadowOpacity: 0.38,
    });

    this.drawFacilitySigil(def.id, 43, COMMAND_Y + 35, accent);
    this.add.text(72, COMMAND_Y + 22, def.name, {
      fontFamily: 'sans-serif', fontSize: '16px', fontStyle: 'bold', color: DUNGEON_UI_CSS.PARCHMENT,
    });
    this.add.text(PANEL_X + PANEL_W - 16, COMMAND_Y + 29, level > 0 ? `Lv.${level} / ${def.maxLevel}` : '미건설', {
      fontFamily: 'sans-serif', fontSize: '11px', fontStyle: 'bold', color: level > 0 ? DUNGEON_UI_CSS.JADE : DUNGEON_UI_CSS.MUTED,
    }).setOrigin(1, 0.5);
    this.add.text(72, COMMAND_Y + 47, def.desc, {
      fontFamily: 'sans-serif', fontSize: '10px', color: DUNGEON_UI_CSS.MUTED,
    });

    this.drawOutputRow(COMMAND_Y + 76, '현재 생산', level > 0 ? this.outputLabel(def, currentRate) : '생산 중지', level > 0 ? DUNGEON_UI_CSS.JADE : DUNGEON_UI_CSS.MUTED);
    this.drawOutputRow(COMMAND_Y + 108, cost === null ? '시설 상태' : '다음 단계', cost === null ? '최대 효율 도달' : this.outputLabel(def, nextRate), cost === null ? DUNGEON_UI_CSS.JADE : DUNGEON_UI_CSS.TEXT);

    const status = cost === null
      ? '추가 명령 없음 · 최대 레벨'
      : affordable
        ? `명령 가능 · 골드 ${cost.toLocaleString('ko-KR')} 소모`
        : `골드 ${(cost - this.gs.homeGold).toLocaleString('ko-KR')} 부족 · 필요 ${cost.toLocaleString('ko-KR')}`;
    this.drawStaffStrip(COMMAND_Y + 138, def.id, level, staffId, staffMult);

    // 영수증이 없으면 상태 줄 하나를 강화 버튼 높이 가운데에 둔다.
    this.add.text(PANEL_X + 16, COMMAND_Y + (this.receipt ? 196 : 217), status, {
      fontFamily: 'sans-serif', fontSize: '11px', fontStyle: 'bold',
      color: cost === null ? DUNGEON_UI_CSS.JADE : affordable ? DUNGEON_UI_CSS.BRASS : DUNGEON_UI_CSS.EMBER,
    }).setOrigin(0, 0.5);

    const receiptText = this.receipt?.text ?? '';
    this.add.text(PANEL_X + 16, COMMAND_Y + 224, receiptText, {
      fontFamily: 'sans-serif', fontSize: '10px', fontStyle: this.receipt ? 'bold' : 'normal',
      color: this.receipt?.tone === 'warning' ? DUNGEON_UI_CSS.EMBER : this.receipt ? DUNGEON_UI_CSS.JADE : DUNGEON_UI_CSS.MUTED,
      wordWrap: { width: 194 },
      lineSpacing: 2,
    }).setOrigin(0, 0.5);

    const action = addPrimaryActionButton(this, {
      x: 226,
      y: COMMAND_Y + 190,
      w: 136,
      h: 54,
      label: cost === null ? 'MAX' : level > 0 ? `Lv.${level + 1} 강화` : '시설 건설',
      fontSize: '14px',
      enabled: affordable,
      once: true,
      fillColor: DUNGEON_UI.BRASS,
      hoverFillColor: DUNGEON_UI.BRASS_BRIGHT,
      borderColor: 0x705126,
      textColor: '#fff6dc',
      disabledFillColor: DUNGEON_UI.STONE,
      disabledBorderColor: cost === null ? DUNGEON_UI.JADE : DUNGEON_UI.EMBER,
      onPress: () => this.buildOrUpgrade(def.id),
    });
    action.zone.setName('production-order');
    this.bindTransactionAction(action.zone);
  }

  /** The guardian on shift here. Tapping opens the picker; an unbuilt facility only explains. */
  private drawStaffStrip(y: number, facilityId: string, level: number, staffId: string | undefined, staffMult: number): void {
    const h = 44;
    const profile = staffId ? resolveOwnedMonsterProfile(staffId) : null;
    const accent = profile ? DUNGEON_UI.JADE : level > 0 ? DUNGEON_UI.BRASS : DUNGEON_UI.IRON;
    const g = this.add.graphics();
    g.fillStyle(DUNGEON_UI.SOOT, 0.86);
    g.fillRoundedRect(PANEL_X + 14, y, PANEL_W - 28, h, 7);
    g.lineStyle(1.2, accent, level > 0 ? 0.8 : 0.4);
    g.strokeRoundedRect(PANEL_X + 14, y, PANEL_W - 28, h, 7);
    this.add.text(PANEL_X + 26, y + h / 2, '근무 수호자', {
      fontFamily: 'sans-serif', fontSize: '10px', color: DUNGEON_UI_CSS.MUTED,
    }).setOrigin(0, 0.5);
    const value = profile
      ? `${profile.emoji} ${profile.name} · 산출 ×${staffMult.toFixed(1)}`
      : level > 0 ? '없음 · 탭하여 배정' : '시설 건설 후 배정';
    this.add.text(PANEL_X + PANEL_W - 26, y + h / 2, value, {
      fontFamily: 'sans-serif', fontSize: '11px', fontStyle: 'bold',
      color: profile ? DUNGEON_UI_CSS.JADE : level > 0 ? DUNGEON_UI_CSS.BRASS : DUNGEON_UI_CSS.MUTED,
    }).setOrigin(1, 0.5);
    if (level <= 0) return;
    const zone = this.add.zone(PANEL_X + 14, y, PANEL_W - 28, h).setOrigin(0).setName('production-staff')
      .setInteractive({ useHandCursor: true });
    zone.on('pointerdown', () => {
      if (this.transactionPending) return;
      openProductionStaffPicker(this, {
        gs: this.gs,
        facilityId,
        onAssign: (monsterId) => this.assignStaff(facilityId, monsterId),
        onClear:  () => this.clearStaff(facilityId),
        onClose:  () => this.render(),
      });
    });
  }

  private drawOutputRow(y: number, label: string, value: string, valueColor: string): void {
    const g = this.add.graphics();
    g.fillStyle(DUNGEON_UI.SOOT, 0.78);
    g.fillRoundedRect(PANEL_X + 14, y, PANEL_W - 28, 25, 6);
    g.lineStyle(1, DUNGEON_UI.IRON, 0.7);
    g.strokeRoundedRect(PANEL_X + 14, y, PANEL_W - 28, 25, 6);
    this.add.text(PANEL_X + 26, y + 12.5, label, {
      fontFamily: 'sans-serif', fontSize: '10px', color: DUNGEON_UI_CSS.MUTED,
    }).setOrigin(0, 0.5);
    this.add.text(PANEL_X + PANEL_W - 26, y + 12.5, value, {
      fontFamily: 'sans-serif', fontSize: '11px', fontStyle: 'bold', color: valueColor,
    }).setOrigin(1, 0.5);
  }

  private outputLabel(def: FacilityDef, rate: number, compact = false): string {
    const amount = formatRate(rate);
    if (def.output.kind === 'gold') return compact ? `골드 +${amount}/h` : `골드 +${amount} / 시간`;
    const name = MATERIAL_DEFS[def.output.materialId]?.name ?? def.output.materialId;
    return compact ? `${name} +${amount}/h` : `${name} +${amount} / 시간`;
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

  private buildOrUpgrade(id: string): void {
    if (!this.beginTransaction()) return;
    const result = buildOrUpgradeFacility(this.gs, id, now());
    if (!result.ok) {
      this.receipt = {
        text: result.reason === 'no_gold' ? '명령 실패 · 골드가 부족합니다' : result.reason === 'maxed' ? '명령 실패 · 최대 레벨입니다' : '명령 실패 · 알 수 없는 시설입니다',
        tone: 'warning',
      };
      this.render();
      return;
    }

    if (!this.persistGameState(result.state)) return;
    const def = FACILITY_DEFS[id];
    this.receipt = {
      text: `${def.name} ${result.newLevel === 1 ? '건설' : `Lv.${result.newLevel} 강화`} 완료 · 골드 ${result.spent.toLocaleString('ko-KR')} 소모${hasIdlePayout(result.idleReward) ? ' · 적립분 수령' : ''}`,
      tone: 'success',
    };
    this.render();
  }

  private assignStaff(facilityId: string, monsterId: string): void {
    if (!this.beginTransaction()) return;
    const result = assignFacilityStaff(this.gs, facilityId, monsterId, now());
    if (!result.ok) {
      this.receipt = { text: result.reason === 'not_built' ? '배정 실패 · 시설을 먼저 건설하세요' : result.reason === 'not_owned' ? '배정 실패 · 보유하지 않은 수호자입니다' : '배정 실패 · 알 수 없는 시설입니다', tone: 'warning' };
      this.render();
      return;
    }
    if (!this.persistGameState(result.state)) return;
    const name = resolveOwnedMonsterProfile(monsterId)?.name ?? monsterId;
    const moved = result.movedFromRoom ? ' · 방에서 이동' : result.movedFromFacility ? ` · ${FACILITY_DEFS[result.movedFromFacility]?.name ?? ''}에서 이동` : '';
    this.receipt = { text: `${name} 근무 시작 · 산출 ×${result.staffMult.toFixed(1)}${moved}${hasIdlePayout(result.idleReward) ? ' · 적립분 수령' : ''}`, tone: 'success' };
    this.render();
  }

  private clearStaff(facilityId: string): void {
    if (!this.beginTransaction()) return;
    const result = clearFacilityStaff(this.gs, facilityId, now());
    if (!result.ok) { this.render(); return; }
    if (!this.persistGameState(result.state)) return;
    this.receipt = { text: `${FACILITY_DEFS[facilityId].name} 근무 해제 · 수호자가 대기로 돌아왔습니다${hasIdlePayout(result.idleReward) ? ' · 적립분 수령' : ''}`, tone: 'success' };
    this.render();
  }

  private collect(): void {
    if (!this.beginTransaction()) return;
    const { state, reward } = collectIdleIncome(this.gs, now());
    if (!hasIdlePayout(reward)) {
      this.receipt = { text: '수령 대기 · 아직 저장된 생산이 없습니다', tone: 'warning' };
      this.render();
      return;
    }

    if (!this.persistGameState(state)) return;
    this.receipt = {
      text: `수령 완료 · ${this.rewardLines(reward).filter(Boolean).join(' · ')}`,
      tone: 'success',
    };
    this.render();
  }

  private persistGameState(nextState: GameState): boolean {
    try {
      saveGameState(nextState);
    } catch {
      this.receipt = { text: '저장 실패 · 다시 시도해주세요', tone: 'warning' };
      this.render();
      return false;
    }
    this.gs = nextState;
    return true;
  }
}
