/**
 * Abyss expedition room — fixed-view depth selection and material farming.
 *
 * Floor/page selection is presentation-only. Key refill, sweep rewards,
 * first-clear progression, and battle waves remain owned by the data layer.
 */

import Phaser from 'phaser';
import { BLUEPRINT_DEFS } from '../data/fusion';
import { abyssBlueprintFor } from '../data/blueprintSources';
import { CANVAS_HEIGHT, CANVAS_WIDTH } from '../constants/layout';
import { CASUAL_CSS, COLORS, DUNGEON_UI, DUNGEON_UI_CSS } from '../constants/colors';
import { loadGameState, saveGameState, type GameState } from '../data/wisdom';
import { MATERIAL_DEFS } from '../data/fusion';
import {
  ABYSS_KEY_MAX,
  ABYSS_MAX_FLOOR,
  abyssFloorDungeonHp,
  buildAbyssFloorWaves,
  canSweepAbyss,
  getAbyssFloorConfig,
  getAbyssFloorLoot,
  isAbyssBossFloor,
  nextAbyssFloor,
  refilledKeys,
  type AbyssLoot,
} from '../data/abyss';
import { settleAbyssBattle, sweepAbyssFloor } from '../data/abyssTransactions';
import type { BattleReturnResult } from '../data/invasionTransactions';
import { ABYSS_BACK_LABEL, ABYSS_RETURN_SCENE_KEY, nextAbyssReturnScene, type AbyssReturnScene } from '../data/abyssBattle';
import { FUSION_RETURN_SCENE_KEY } from '../data/fusionCandidates';
import { NAVIGATION_CONTEXT_OPERATIONS } from '../data/navigationContract';
import {
  addFramedPanel,
  addPrimaryActionButton,
  addSceneHeader,
} from '../ui/GameUiPrimitives';
import { formatHudResourceValue } from '../ui/HudResourceFormatting';

type ReceiptTone = 'success' | 'warning';
type AbyssActionKind = 'challenge' | 'sweep';

interface AbyssReceipt {
  readonly title: string;
  readonly detail: string;
  readonly tone: ReceiptTone;
}

interface AbyssActionView {
  readonly kind: AbyssActionKind;
  readonly label: string;
  readonly enabled: boolean;
  readonly status: string;
  readonly fillColor: number;
  readonly borderColor: number;
}

const PANEL_X = 14;
const PANEL_W = CANVAS_WIDTH - PANEL_X * 2;
const STATUS_Y = 76;
const DEPTH_Y = 144;
const INTEL_Y = 324;
const COMMAND_Y = 498;
const ROUTES_Y = 716;
const FLOORS_PER_PAGE = 5;
const TRANSACTION_COOLDOWN_MS = 250;

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function now(): number {
  return Date.now();
}

export class AbyssScene extends Phaser.Scene {
  private gs!: GameState;
  private selectedFloor = 1;
  private pageStart = 1;
  private receipt: AbyssReceipt | null = null;
  /** '← 뒤로' 목적지. 씬 인스턴스가 재사용되므로 원정 전투 왕복 동안 유지된다. */
  private returnScene: AbyssReturnScene = 'StageSelectScene';
  private transactionPending = false;
  private lastTransactionAt = 0;

  constructor() {
    super({ key: 'AbyssScene' });
  }

  create(): void {
    this.gs = loadGameState();
    this.receipt = null;
    this.transactionPending = false;
    this.lastTransactionAt = 0;

    const returningFromBattle = this.registry.get('abyssPendingFloor') !== undefined;
    const handoff = this.registry.get(ABYSS_RETURN_SCENE_KEY);
    NAVIGATION_CONTEXT_OPERATIONS['abyss-entry'].consume.forEach(field => this.registry.remove(field));
    this.returnScene = nextAbyssReturnScene(handoff, returningFromBattle, this.returnScene);

    const returnedFloor = this.resolveReturnedBattle();
    const refilled = refilledKeys(this.gs.abyss, today());
    if (refilled !== this.gs.abyss) {
      this.gs = { ...this.gs, abyss: refilled };
      saveGameState(this.gs);
    }

    this.selectedFloor = returnedFloor ?? nextAbyssFloor(this.gs.abyss);
    this.pageStart = this.pageStartFor(this.selectedFloor);
    this.resetCamera();
    this.render();
  }

  private resolveReturnedBattle(): number | null {
    const pendingFloor = this.registry.get('abyssPendingFloor') as number | undefined;
    const result = this.registry.get('battleResult') as BattleReturnResult | undefined;
    if (pendingFloor === undefined) return null;

    // Drop every field the abyss hand-off owns. Driving this from the shared
    // contract keeps the declared rule and the runtime behavior from drifting.
    NAVIGATION_CONTEXT_OPERATIONS['abyss-return'].consume.forEach(field => {
      this.registry.remove(field);
    });

    const deepestBefore = this.gs.abyss.highestFloor;
    if (!result) {
      this.receipt = {
        title: `${pendingFloor}층 원정 결과 확인 불가`,
        detail: '진행과 보상은 변경되지 않았습니다',
        tone: 'warning',
      };
      return pendingFloor;
    }

    // The battle's own loot (gold, DM XP, drops) settles win or lose, like every other battle.
    const settled = settleAbyssBattle(this.gs, pendingFloor, result, { now: Date.now() });
    this.gs = settled.state;
    saveGameState(this.gs);
    const levelUp = settled.didLevelUp ? `DM Lv.${this.gs.dmLevel}` : null;
    const clear = settled.clear;
    if (clear) {
      const floorLoot = clear.blueprint
        ? `설계도 「${BLUEPRINT_DEFS[clear.blueprint]?.name ?? clear.blueprint}」 획득 · ${this.formatLoot(clear.loot, result.goldEarned)}`
        : this.formatLoot(clear.loot, result.goldEarned);
      this.receipt = {
        title: clear.firstClear
          ? `${pendingFloor}층 정복 완료 · 최심 ${deepestBefore}→${this.gs.abyss.highestFloor}`
          : `${pendingFloor}층 원정 완료 · 최심 ${this.gs.abyss.highestFloor}층`,
        detail: [floorLoot, levelUp].filter(Boolean).join(' · '),
        tone: 'success',
      };
      return pendingFloor;
    }

    this.receipt = {
      title: `${pendingFloor}층 원정 실패 · 최심 ${deepestBefore}층 유지`,
      detail: [
        result.goldEarned > 0 ? `전리품 골드 +${result.goldEarned.toLocaleString('ko-KR')}` : '정복 보상 없음',
        levelUp,
        '같은 층에 다시 도전할 수 있습니다',
      ].filter(Boolean).join(' · '),
      tone: 'warning',
    };
    return pendingFloor;
  }

  private render(): void {
    this.clearRenderedObjects();
    this.resetCamera();
    this.drawBackdrop();

    addSceneHeader(this, {
      title: '심연 원정실',
      subtitle: '깊이를 정찰하고 재료 보급선을 확보',
      backLabel: ABYSS_BACK_LABEL[this.returnScene],
      onBack: () => {
        if (!this.transactionPending) this.scene.start(this.returnScene);
      },
    });

    this.drawStatusRail();
    this.drawDepthWindow();
    this.drawFloorIntel();
    this.drawCommandPlate();
    this.drawSupplyRoutes();
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

    g.lineStyle(1, DUNGEON_UI.IRON, 0.3);
    for (let y = 84; y < CANVAS_HEIGHT; y += 38) {
      g.lineBetween(0, y, CANVAS_WIDTH, y);
      const offset = ((y - 84) / 38) % 2 === 0 ? 26 : 0;
      for (let x = offset; x < CANVAS_WIDTH; x += 58) g.lineBetween(x, y, x, y + 38);
    }

    g.fillStyle(DUNGEON_UI.STONE, 0.72);
    g.fillRect(0, 68, 20, CANVAS_HEIGHT - 68);
    g.fillRect(CANVAS_WIDTH - 20, 68, 20, CANVAS_HEIGHT - 68);
    g.lineStyle(2, DUNGEON_UI.BRASS, 0.12);
    g.lineBetween(29, 72, 29, CANVAS_HEIGHT);
    g.lineBetween(CANVAS_WIDTH - 29, 72, CANVAS_WIDTH - 29, CANVAS_HEIGHT);

    g.fillStyle(COLORS.MAGIC_GLOW, 0.035);
    g.fillCircle(CANVAS_WIDTH / 2, DEPTH_Y + 80, 150);
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

    const deepest = this.gs.abyss.highestFloor;
    const items = [
      { label: '심연 열쇠', value: `${this.gs.abyss.keys} / ${ABYSS_KEY_MAX}`, color: this.gs.abyss.keys > 0 ? DUNGEON_UI_CSS.BRASS : DUNGEON_UI_CSS.EMBER },
      { label: '최심 정복', value: `${deepest} / ${ABYSS_MAX_FLOOR}층`, color: deepest > 0 ? DUNGEON_UI_CSS.JADE : DUNGEON_UI_CSS.MUTED },
      { label: '다음 원정', value: deepest >= ABYSS_MAX_FLOOR ? '완주' : `${deepest + 1}층`, color: deepest >= ABYSS_MAX_FLOOR ? DUNGEON_UI_CSS.JADE : DUNGEON_UI_CSS.TEXT },
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
        fontFamily: 'sans-serif', fontSize: '14px', fontStyle: 'bold', color: item.color,
      }).setOrigin(0.5);
    });
  }

  private drawDepthWindow(): void {
    addFramedPanel(this, {
      x: PANEL_X,
      y: DEPTH_Y,
      w: PANEL_W,
      h: 170,
      fillColor: DUNGEON_UI.STONE_RAISED,
      borderColor: DUNGEON_UI.IRON,
      accentColor: DUNGEON_UI.BRASS,
      glowColor: COLORS.MAGIC_GLOW,
      glowOpacity: 0.04,
    });

    const reachable = nextAbyssFloor(this.gs.abyss);
    this.add.text(PANEL_X + 16, DEPTH_Y + 19, '심도 관측창 · 정복층은 소탕, 다음 층은 원정', {
      fontFamily: 'sans-serif', fontSize: '11px', fontStyle: 'bold', color: DUNGEON_UI_CSS.TEXT,
    }).setOrigin(0, 0.5);
    this.add.text(PANEL_X + PANEL_W - 16, DEPTH_Y + 19, `${this.pageStart}–${Math.min(ABYSS_MAX_FLOOR, this.pageStart + FLOORS_PER_PAGE - 1)}층`, {
      fontFamily: 'sans-serif', fontSize: '11px', fontStyle: 'bold', color: DUNGEON_UI_CSS.BRASS,
    }).setOrigin(1, 0.5);

    const gap = 8;
    const nodeW = (PANEL_W - 16 - gap * (FLOORS_PER_PAGE - 1)) / FLOORS_PER_PAGE;
    for (let index = 0; index < FLOORS_PER_PAGE; index++) {
      const floor = this.pageStart + index;
      const x = PANEL_X + 8 + index * (nodeW + gap);
      this.drawFloorNode(floor, x, DEPTH_Y + 36, nodeW, 64, reachable);
    }

    const maxPageStart = this.pageStartFor(reachable);
    const previousEnabled = this.pageStart > 1;
    const nextEnabled = this.pageStart < maxPageStart;
    const previous = addPrimaryActionButton(this, {
      x: PANEL_X + 10,
      y: DEPTH_Y + 112,
      w: 88,
      h: 44,
      label: '← 이전 5층',
      fontSize: '11px',
      enabled: previousEnabled,
      showArrow: false,
      fillColor: DUNGEON_UI.STONE,
      hoverFillColor: DUNGEON_UI.IRON,
      borderColor: DUNGEON_UI.EDGE,
      disabledFillColor: DUNGEON_UI.SOOT,
      disabledBorderColor: DUNGEON_UI.IRON,
      onPress: () => this.changePage(-1),
    });
    previous.zone.setName('abyss-page-previous');

    this.add.text(CANVAS_WIDTH / 2, DEPTH_Y + 134, `선택 ${this.selectedFloor}층 · 도달 ${reachable}층`, {
      fontFamily: 'sans-serif', fontSize: '10px', fontStyle: 'bold', color: DUNGEON_UI_CSS.MUTED,
    }).setOrigin(0.5);

    const next = addPrimaryActionButton(this, {
      x: PANEL_X + PANEL_W - 98,
      y: DEPTH_Y + 112,
      w: 88,
      h: 44,
      label: '다음 5층 →',
      fontSize: '11px',
      enabled: nextEnabled,
      showArrow: false,
      fillColor: DUNGEON_UI.STONE,
      hoverFillColor: DUNGEON_UI.IRON,
      borderColor: DUNGEON_UI.EDGE,
      disabledFillColor: DUNGEON_UI.SOOT,
      disabledBorderColor: DUNGEON_UI.IRON,
      onPress: () => this.changePage(1),
    });
    next.zone.setName('abyss-page-next');
  }

  private drawFloorNode(floor: number, x: number, y: number, w: number, h: number, reachable: number): void {
    const withinRange = floor <= ABYSS_MAX_FLOOR;
    const cleared = withinRange && floor <= this.gs.abyss.highestFloor;
    const available = withinRange && floor <= reachable;
    const selected = floor === this.selectedFloor;
    const boss = withinRange && isAbyssBossFloor(floor);
    const isNext = withinRange && this.gs.abyss.highestFloor < ABYSS_MAX_FLOOR && floor === this.gs.abyss.highestFloor + 1;
    const semanticTone = boss ? COLORS.MAGIC_GLOW : cleared ? DUNGEON_UI.JADE : isNext ? DUNGEON_UI.BRASS : DUNGEON_UI.IRON;
    const borderTone = selected ? DUNGEON_UI.BRASS_BRIGHT : semanticTone;

    const g = this.add.graphics();
    g.fillStyle(selected ? DUNGEON_UI.STONE : DUNGEON_UI.SOOT, 1);
    g.fillRoundedRect(x, y, w, h, 8);
    g.lineStyle(selected ? 2 : 1, borderTone, available || selected ? 0.95 : 0.55);
    g.strokeRoundedRect(x, y, w, h, 8);
    if (selected) {
      g.fillStyle(DUNGEON_UI.BRASS, 1);
      g.fillRect(x + 7, y + h - 5, w - 14, 2);
    }

    this.add.text(x + w / 2, y + 23, withinRange ? `${floor}` : '—', {
      fontFamily: 'sans-serif', fontSize: '18px', fontStyle: 'bold',
      color: available ? DUNGEON_UI_CSS.PARCHMENT : DUNGEON_UI_CSS.MUTED,
    }).setOrigin(0.5);
    // A boss floor whose blueprint is still missing says so on the chip (cleared ones too: replay pays it).
    const blueprintAhead = withinRange && boss && abyssBlueprintFor(this.gs, floor) !== null;
    const stateLabel = !withinRange ? '봉인' : boss ? (blueprintAhead ? '📜 보스' : '보스') : cleared ? '정복' : isNext ? '원정' : '잠김';
    this.add.text(x + w / 2, y + 47, stateLabel, {
      fontFamily: 'sans-serif', fontSize: '10px', fontStyle: 'bold',
      color: boss ? CASUAL_CSS.PURPLE : cleared ? DUNGEON_UI_CSS.JADE : isNext ? DUNGEON_UI_CSS.BRASS : DUNGEON_UI_CSS.MUTED,
    }).setOrigin(0.5);

    if (!available) return;
    const zone = this.add.zone(x, y, w, h).setOrigin(0)
      .setInteractive({ useHandCursor: true });
    zone.setName(`abyss-floor-${floor}`);
    zone.on('pointerdown', () => {
      if (this.transactionPending || this.selectedFloor === floor) return;
      this.selectedFloor = floor;
      this.render();
    });
  }

  private drawFloorIntel(): void {
    const config = getAbyssFloorConfig(this.selectedFloor);
    const boss = config.isBoss;
    const cleared = this.selectedFloor <= this.gs.abyss.highestFloor;
    const stateLabel = boss ? '보스 심도' : cleared ? '정복 심도' : '다음 원정';
    const tone = boss ? COLORS.MAGIC_GLOW : cleared ? DUNGEON_UI.JADE : DUNGEON_UI.BRASS;

    addFramedPanel(this, {
      x: PANEL_X,
      y: INTEL_Y,
      w: PANEL_W,
      h: 164,
      fillColor: DUNGEON_UI.STONE_RAISED,
      borderColor: tone,
      accentColor: tone,
      glowColor: tone,
      glowOpacity: 0.05,
    });

    this.add.text(PANEL_X + 16, INTEL_Y + 21, `${this.selectedFloor}층 · ${config.bandLabel}`, {
      fontFamily: 'sans-serif', fontSize: '16px', fontStyle: 'bold', color: DUNGEON_UI_CSS.PARCHMENT,
    }).setOrigin(0, 0.5);
    this.add.text(PANEL_X + PANEL_W - 16, INTEL_Y + 21, stateLabel, {
      fontFamily: 'sans-serif', fontSize: '11px', fontStyle: 'bold',
      color: boss ? CASUAL_CSS.PURPLE : cleared ? DUNGEON_UI_CSS.JADE : DUNGEON_UI_CSS.BRASS,
    }).setOrigin(1, 0.5);

    this.drawIntelRow(INTEL_Y + 40, '권장 전투력', formatHudResourceValue(config.recommendedPower), DUNGEON_UI_CSS.TEXT);
    const materialNames = [...new Set(getAbyssFloorLoot(this.selectedFloor).map((entry) => entry.id))]
      .map((id) => MATERIAL_DEFS[id]?.name ?? id)
      .join(' · ');
    this.drawIntelRow(INTEL_Y + 73, '획득 자원', materialNames, DUNGEON_UI_CSS.TEXT, 44);
    const blueprintId = abyssBlueprintFor(this.gs, this.selectedFloor);
    const rewardNote = blueprintId
      ? `격파 시 설계도 「${BLUEPRINT_DEFS[blueprintId]?.name ?? blueprintId}」 · 보스 정수 확정`
      : boss
      ? '보스 정수 확정 · 각성석 획득 가능'
      : cleared
        ? '심연 열쇠 1개로 즉시 소탕'
        : '승리 시 첫 정복 보너스 · 열쇠 소모 없음';
    this.drawIntelRow(INTEL_Y + 122, '원정 규칙', rewardNote, boss ? CASUAL_CSS.PURPLE : DUNGEON_UI_CSS.MUTED, 28);
  }

  private drawIntelRow(y: number, label: string, value: string, valueColor: string, h = 28): void {
    const x = PANEL_X + 14;
    const w = PANEL_W - 28;
    const g = this.add.graphics();
    g.fillStyle(DUNGEON_UI.SOOT, 0.78);
    g.fillRoundedRect(x, y, w, h, 6);
    g.lineStyle(1, DUNGEON_UI.IRON, 0.72);
    g.strokeRoundedRect(x, y, w, h, 6);
    this.add.text(x + 11, y + h / 2, label, {
      fontFamily: 'sans-serif', fontSize: '10px', color: DUNGEON_UI_CSS.MUTED,
    }).setOrigin(0, 0.5);
    this.add.text(x + 82, y + h / 2, value, {
      fontFamily: 'sans-serif', fontSize: '10px', fontStyle: 'bold', color: valueColor,
      align: 'right', wordWrap: { width: w - 94 }, lineSpacing: 2,
    }).setOrigin(0, 0.5);
  }

  private drawCommandPlate(): void {
    const action = this.getActionView();
    const tone = action.enabled
      ? action.kind === 'challenge' ? DUNGEON_UI.BRASS : DUNGEON_UI.JADE
      : DUNGEON_UI.EMBER;

    addFramedPanel(this, {
      x: PANEL_X,
      y: COMMAND_Y,
      w: PANEL_W,
      h: 208,
      fillColor: DUNGEON_UI.STONE_RAISED,
      borderColor: tone,
      accentColor: tone,
      glowColor: tone,
      glowOpacity: action.enabled ? 0.06 : 0,
    });

    this.add.text(PANEL_X + 16, COMMAND_Y + 22, action.kind === 'challenge' ? '심층 원정 명령' : '정복층 소탕 명령', {
      fontFamily: 'sans-serif', fontSize: '15px', fontStyle: 'bold', color: DUNGEON_UI_CSS.PARCHMENT,
    }).setOrigin(0, 0.5);
    this.add.text(PANEL_X + PANEL_W - 16, COMMAND_Y + 22, `${this.selectedFloor}층`, {
      fontFamily: 'sans-serif', fontSize: '13px', fontStyle: 'bold', color: action.enabled ? DUNGEON_UI_CSS.BRASS : DUNGEON_UI_CSS.EMBER,
    }).setOrigin(1, 0.5);
    this.add.text(PANEL_X + 16, COMMAND_Y + 49, action.status, {
      fontFamily: 'sans-serif', fontSize: '10px', fontStyle: 'bold',
      color: action.enabled ? DUNGEON_UI_CSS.TEXT : DUNGEON_UI_CSS.EMBER,
      wordWrap: { width: PANEL_W - 32 },
    }).setOrigin(0, 0.5);

    const receiptTone = this.receipt?.tone === 'warning' ? DUNGEON_UI.EMBER : this.receipt ? DUNGEON_UI.JADE : DUNGEON_UI.IRON;
    const receiptG = this.add.graphics();
    receiptG.fillStyle(DUNGEON_UI.SOOT, 0.78);
    receiptG.fillRoundedRect(PANEL_X + 14, COMMAND_Y + 68, PANEL_W - 28, 66, 7);
    receiptG.lineStyle(1, receiptTone, this.receipt ? 0.9 : 0.65);
    receiptG.strokeRoundedRect(PANEL_X + 14, COMMAND_Y + 68, PANEL_W - 28, 66, 7);
    this.add.text(PANEL_X + 26, COMMAND_Y + 84, this.receipt?.title ?? '원정 기록 대기', {
      fontFamily: 'sans-serif', fontSize: '10px', fontStyle: 'bold',
      color: this.receipt?.tone === 'warning' ? DUNGEON_UI_CSS.EMBER : this.receipt ? DUNGEON_UI_CSS.JADE : DUNGEON_UI_CSS.MUTED,
    }).setOrigin(0, 0.5);
    this.add.text(PANEL_X + 26, COMMAND_Y + 111, this.receipt?.detail ?? '명령 후 보상과 진행 결과가 이곳에 유지됩니다', {
      fontFamily: 'sans-serif', fontSize: '10px', color: this.receipt ? DUNGEON_UI_CSS.TEXT : DUNGEON_UI_CSS.MUTED,
      wordWrap: { width: PANEL_W - 52 }, lineSpacing: 2,
    }).setOrigin(0, 0.5);

    const button = addPrimaryActionButton(this, {
      x: PANEL_X + 16,
      y: COMMAND_Y + 145,
      w: PANEL_W - 32,
      h: 50,
      label: action.label,
      fontSize: '14px',
      enabled: action.enabled,
      once: true,
      fillColor: action.fillColor,
      hoverFillColor: action.kind === 'challenge' ? DUNGEON_UI.BRASS_BRIGHT : 0x63ad89,
      borderColor: action.borderColor,
      disabledFillColor: DUNGEON_UI.STONE,
      disabledBorderColor: DUNGEON_UI.EMBER,
      textColor: '#fff6dc',
      onPress: () => this.executeAction(this.selectedFloor, action.kind),
    });
    button.zone.setName('abyss-order');
    this.bindTransactionAction(button.zone);
  }

  private drawSupplyRoutes(): void {
    addFramedPanel(this, {
      x: PANEL_X,
      y: ROUTES_Y,
      w: PANEL_W,
      h: 114,
      fillColor: DUNGEON_UI.STONE,
      borderColor: DUNGEON_UI.IRON,
      shadowOpacity: 0.24,
    });
    this.add.text(PANEL_X + 16, ROUTES_Y + 20, '보급선 · 획득한 재료와 각성석을 사용', {
      fontFamily: 'sans-serif', fontSize: '10px', fontStyle: 'bold', color: DUNGEON_UI_CSS.MUTED,
    }).setOrigin(0, 0.5);

    const gap = 8;
    const buttonW = (PANEL_W - 24 - gap) / 2;
    const forge = addPrimaryActionButton(this, {
      x: PANEL_X + 12,
      y: ROUTES_Y + 44,
      w: buttonW,
      h: 52,
      label: '제작소 · 장비 제작',
      fontSize: '12px',
      once: true,
      fillColor: DUNGEON_UI.STONE_RAISED,
      hoverFillColor: DUNGEON_UI.IRON,
      borderColor: DUNGEON_UI.BRASS,
      textColor: DUNGEON_UI_CSS.PARCHMENT,
      onPress: () => {
        this.registry.set('forgeReturnScene', 'AbyssScene');
        this.scene.start('ForgeScene');
      },
    });
    forge.zone.setName('abyss-route-forge');
    this.bindRouteAction(forge.zone);

    const fusion = addPrimaryActionButton(this, {
      x: PANEL_X + 20 + buttonW,
      y: ROUTES_Y + 44,
      w: buttonW,
      h: 52,
      label: '의식실 · 진화 각성',
      fontSize: '12px',
      once: true,
      fillColor: DUNGEON_UI.STONE_RAISED,
      hoverFillColor: DUNGEON_UI.IRON,
      borderColor: COLORS.MAGIC_GLOW,
      textColor: DUNGEON_UI_CSS.PARCHMENT,
      onPress: () => {
        this.registry.set(FUSION_RETURN_SCENE_KEY, 'AbyssScene');
        this.scene.start('FusionScene');
      },
    });
    fusion.zone.setName('abyss-route-fusion');
    this.bindRouteAction(fusion.zone);
  }

  private pageStartFor(floor: number): number {
    const clamped = Phaser.Math.Clamp(Math.floor(floor), 1, ABYSS_MAX_FLOOR);
    return Math.floor((clamped - 1) / FLOORS_PER_PAGE) * FLOORS_PER_PAGE + 1;
  }

  private changePage(direction: -1 | 1): void {
    if (this.transactionPending) return;
    const reachable = nextAbyssFloor(this.gs.abyss);
    const maxPageStart = this.pageStartFor(reachable);
    const nextPage = Phaser.Math.Clamp(
      this.pageStart + direction * FLOORS_PER_PAGE,
      1,
      maxPageStart,
    );
    if (nextPage === this.pageStart) return;
    this.pageStart = nextPage;
    const lastReachableOnPage = Math.min(reachable, nextPage + FLOORS_PER_PAGE - 1);
    this.selectedFloor = direction > 0 ? nextPage : lastReachableOnPage;
    this.render();
  }

  private getActionView(): AbyssActionView {
    const cleared = this.selectedFloor <= this.gs.abyss.highestFloor;
    if (cleared) {
      const check = canSweepAbyss(this.gs.abyss, this.selectedFloor);
      return {
        kind: 'sweep',
        label: check.ok ? `선택 ${this.selectedFloor}층 소탕 · 열쇠 1` : '소탕 불가 · 심연 열쇠 없음',
        enabled: check.ok,
        status: check.ok
          ? `즉시 파밍 · 열쇠 ${this.gs.abyss.keys}→${this.gs.abyss.keys - 1} · 정복 깊이는 유지됩니다`
          : `심연 열쇠 0 / ${ABYSS_KEY_MAX} · 다음 일일 refill 후 소탕할 수 있습니다`,
        fillColor: DUNGEON_UI.JADE,
        borderColor: 0x2d6c52,
      };
    }

    return {
      kind: 'challenge',
      label: `${this.selectedFloor}층 심층 원정 시작`,
      enabled: this.selectedFloor === this.gs.abyss.highestFloor + 1 && this.selectedFloor <= ABYSS_MAX_FLOOR,
      status: `승리 시 ${this.selectedFloor}층 정복 · 첫 정복 보너스 · 심연 열쇠 소모 없음`,
      fillColor: DUNGEON_UI.BRASS,
      borderColor: 0x705126,
    };
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

  private bindRouteAction(zone: Phaser.GameObjects.Zone): void {
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

  private executeAction(floor: number, kind: AbyssActionKind): void {
    if (!this.beginTransaction()) return;
    if (kind === 'sweep') this.sweep(floor);
    else this.climb(floor);
  }

  private sweep(floor: number): void {
    const keysBefore = this.gs.abyss.keys;
    const result = sweepAbyssFloor(this.gs, floor, today());
    if (!result.ok || !result.loot) {
      this.gs = result.state;
      this.receipt = {
        title: result.reason === 'no_keys' ? `${floor}층 소탕 불가 · 열쇠 없음` : `${floor}층 소탕 불가 · 잠긴 심도`,
        detail: '진행과 보상은 변경되지 않았습니다',
        tone: 'warning',
      };
      this.render();
      return;
    }

    this.gs = result.state;
    saveGameState(this.gs);
    this.receipt = {
      title: `${floor}층 소탕 완료 · 열쇠 ${keysBefore}→${this.gs.abyss.keys}`,
      detail: this.formatLoot(result.loot),
      tone: 'success',
    };
    this.render();
  }

  private climb(floor: number): void {
    this.registry.remove('battleResult');
    this.registry.set('abyssPendingFloor', floor);
    this.registry.set('returnTo', 'AbyssScene');
    this.registry.set('stageConfig', {
      stageNumber: 0,
      waves: buildAbyssFloorWaves(floor),
      dungeonHp: abyssFloorDungeonHp(floor),
    });
    this.scene.start('DungeonScene');
  }

  /** `battleGold` — 같은 원정의 전투 전리품. 층 보상 골드와 한 숫자로 보여 준다. */
  private formatLoot(loot: AbyssLoot, battleGold = 0): string {
    const parts = Object.entries(loot.materials)
      .map(([id, quantity]) => `${MATERIAL_DEFS[id]?.name ?? id} +${quantity}`);
    if (loot.awakeningStones > 0) parts.push(`각성석 +${loot.awakeningStones}`);
    const gold = loot.gold + battleGold;
    if (gold > 0) parts.push(`골드 +${gold.toLocaleString('ko-KR')}`);
    return parts.length > 0 ? parts.join(' · ') : '획득 보상 없음';
  }
}
