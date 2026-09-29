/**
 * Permanent-growth ritual chamber.
 *
 * Lineage and branch selection are presentation-only. Branch definitions,
 * costs, effects, and the immutable upgrade transaction remain data-owned.
 */

import Phaser from 'phaser';
import { CANVAS_HEIGHT, CANVAS_WIDTH } from '../constants/layout';
import { COLORS, DUNGEON_UI, DUNGEON_UI_CSS } from '../constants/colors';
import {
  loadGameState,
  MAX_WISDOM_TIER,
  saveGameState,
  upgradeWisdomBranch,
  type BranchDef,
  type GameState,
  type WisdomUpgradeFailureReason,
} from '../data/wisdom';
import { addSigil } from '../ui/Sigils';
import { sigilFor, WISDOM_SIGILS } from '../ui/sigilMaps';
import {
  addFramedPanel,
  addPrimaryActionButton,
  addProgressBar,
  addSceneHeader,
} from '../ui/GameUiPrimitives';
import { formatHudResourceValue } from '../ui/HudResourceFormatting';
import {
  WISDOM_LINEAGES,
  getWisdomBranchView,
  getWisdomLineageBranches,
  getWisdomSummary,
  isWisdomUpgradeSnapshotCurrent,
  type WisdomBranchView,
  type WisdomLineageId,
  type WisdomUpgradeSnapshot,
} from '../ui/AncestralWisdomShared';
import { settleIdleAcrossChange } from '../data/idleIncome';

type ReceiptTone = 'success' | 'warning';

interface WisdomReceipt {
  readonly title: string;
  readonly detail: string;
  readonly tone: ReceiptTone;
}

const PANEL_X = 14;
const PANEL_W = CANVAS_WIDTH - PANEL_X * 2;
const STATUS_Y = 76;
const LINEAGE_Y = 142;
const BRANCH_Y = 202;
const BRANCH_H = 66;
const BRANCH_GAP = 7;
const DETAIL_Y = 421;
const DETAIL_H = 242;
const COMMAND_Y = 675;
const TRANSACTION_COOLDOWN_MS = 250;

function now(): number {
  return Date.now();
}

export class AncestralWisdomScene extends Phaser.Scene {
  private gameState!: GameState;
  private activeLineage: WisdomLineageId = 'foundation';
  private selectedBranchId = '';
  private receipt: WisdomReceipt | null = null;
  private actionLocked = false;
  private renderQueued = false;
  private lastTransactionAt = 0;
  private confirmOverlay?: Phaser.GameObjects.Container;

  constructor() {
    super({ key: 'AncestralWisdomScene' });
  }

  create(): void {
    this.gameState = loadGameState();
    this.activeLineage = 'foundation';
    this.selectedBranchId = getWisdomLineageBranches(this.activeLineage)[0]?.id ?? '';
    this.receipt = null;
    this.actionLocked = false;
    this.renderQueued = false;
    this.lastTransactionAt = 0;
    this.confirmOverlay = undefined;
    this.resetCamera();
    this.render();
  }

  private render(): void {
    this.clearRenderedObjects();
    this.resetCamera();
    this.reconcileSelection();
    this.drawBackdrop();
    this.drawHeader();
    this.drawStatusRail();
    this.drawLineages();
    this.drawBranchTablets();
    this.drawSelectedLedger();
    this.drawCommand();
  }

  private clearRenderedObjects(): void {
    this.tweens.killAll();
    this.confirmOverlay = undefined;
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
    for (let y = 88; y < CANVAS_HEIGHT; y += 42) {
      g.lineBetween(0, y, CANVAS_WIDTH, y);
      const offset = ((y - 88) / 42) % 2 === 0 ? 25 : 0;
      for (let x = offset; x < CANVAS_WIDTH; x += 58) g.lineBetween(x, y, x, y + 42);
    }

    g.fillStyle(DUNGEON_UI.STONE, 0.82);
    g.fillRect(0, 68, 18, CANVAS_HEIGHT - 68);
    g.fillRect(CANVAS_WIDTH - 18, 68, 18, CANVAS_HEIGHT - 68);
    g.lineStyle(2, DUNGEON_UI.BRASS, 0.16);
    g.lineBetween(27, 72, 27, CANVAS_HEIGHT);
    g.lineBetween(CANVAS_WIDTH - 27, 72, CANVAS_WIDTH - 27, CANVAS_HEIGHT);

    g.fillStyle(COLORS.TORCH_AMBER, 0.035);
    g.fillCircle(CANVAS_WIDTH / 2, 488, 172);
    g.lineStyle(2, DUNGEON_UI.BRASS, 0.16);
    g.strokeCircle(CANVAS_WIDTH / 2, 488, 126);
    g.strokeCircle(CANVAS_WIDTH / 2, 488, 158);
  }

  private drawHeader(): void {
    const header = addSceneHeader(this, {
      title: '선조의 의식실',
      subtitle: '영혼 수정을 바쳐 영구 가호를 해방',
      onBack: () => this.returnToPreviousScene(),
    });
    const backZone = header.container.list.find(child => child.type === 'Zone') as Phaser.GameObjects.Zone | undefined;
    if (!backZone) return;
    backZone.setName('wisdom-back');
    this.bindViewAction(backZone);
  }

  private drawStatusRail(): void {
    addFramedPanel(this, {
      x: PANEL_X,
      y: STATUS_Y,
      w: PANEL_W,
      h: 54,
      fillColor: DUNGEON_UI.STONE,
      borderColor: DUNGEON_UI.IRON,
      shadowOpacity: 0.28,
    });

    const summary = getWisdomSummary(this.gameState);
    const items = [
      { label: '영혼 수정', value: formatHudResourceValue(this.gameState.soulCrystals), color: DUNGEON_UI_CSS.BRASS },
      { label: '해방 단계', value: `${summary.totalTiers} / ${summary.totalTierCapacity}`, color: DUNGEON_UI_CSS.TEXT },
      { label: '완성 가호', value: `${summary.maxedBranches} / ${summary.branchCount}`, color: summary.maxedBranches > 0 ? DUNGEON_UI_CSS.JADE : DUNGEON_UI_CSS.MUTED },
    ];

    items.forEach((item, index) => {
      const cellW = PANEL_W / items.length;
      const x = PANEL_X + cellW * index;
      if (index > 0) {
        const divider = this.add.graphics();
        divider.lineStyle(1, DUNGEON_UI.IRON, 0.9);
        divider.lineBetween(x, STATUS_Y + 9, x, STATUS_Y + 45);
      }
      this.add.text(x + cellW / 2, STATUS_Y + 17, item.label, {
        fontFamily: 'sans-serif', fontSize: '10px', color: DUNGEON_UI_CSS.MUTED,
      }).setOrigin(0.5);
      this.add.text(x + cellW / 2, STATUS_Y + 37, item.value, {
        fontFamily: 'sans-serif', fontSize: '14px', fontStyle: 'bold', color: item.color,
      }).setOrigin(0.5);
    });
  }

  private drawLineages(): void {
    const gap = 5;
    const buttonW = (PANEL_W - gap * 3) / 4;
    WISDOM_LINEAGES.forEach((lineage, index) => {
      const active = lineage.id === this.activeLineage;
      const button = addPrimaryActionButton(this, {
        x: PANEL_X + index * (buttonW + gap),
        y: LINEAGE_Y,
        w: buttonW,
        h: 44,
        label: lineage.label,
        fontSize: '11px',
        once: true,
        showArrow: false,
        fillColor: active ? DUNGEON_UI.BRASS : DUNGEON_UI.STONE,
        hoverFillColor: active ? DUNGEON_UI.BRASS_BRIGHT : DUNGEON_UI.IRON,
        borderColor: active ? DUNGEON_UI.BRASS_BRIGHT : DUNGEON_UI.EDGE,
        textColor: active ? '#171006' : DUNGEON_UI_CSS.TEXT,
        onPress: () => this.selectLineage(lineage.id),
      });
      button.zone.setName(`wisdom-lineage-${lineage.id}`);
      this.bindViewAction(button.zone);
    });
  }

  private drawBranchTablets(): void {
    const branches = getWisdomLineageBranches(this.activeLineage);
    branches.forEach((branch, index) => {
      this.drawBranchTablet(branch, BRANCH_Y + index * (BRANCH_H + BRANCH_GAP));
    });
  }

  private drawBranchTablet(branch: BranchDef, y: number): void {
    const view = getWisdomBranchView(this.gameState, branch);
    const selected = branch.id === this.selectedBranchId;
    const tone = !view.validTier
      ? DUNGEON_UI.EMBER
      : view.isMaxed
        ? DUNGEON_UI.JADE
        : DUNGEON_UI.IRON;

    const g = this.add.graphics();
    g.fillStyle(selected ? DUNGEON_UI.STONE_RAISED : DUNGEON_UI.STONE, 1);
    g.fillRoundedRect(PANEL_X, y, PANEL_W, BRANCH_H, 8);
    g.lineStyle(selected ? 2 : 1, selected ? DUNGEON_UI.BRASS_BRIGHT : tone, selected ? 1 : 0.82);
    g.strokeRoundedRect(PANEL_X, y, PANEL_W, BRANCH_H, 8);
    if (selected) {
      g.fillStyle(DUNGEON_UI.BRASS, 1);
      g.fillRect(PANEL_X + 6, y + 8, 3, BRANCH_H - 16);
    }

    const sigilColor = !view.validTier ? DUNGEON_UI.EMBER
      : view.isMaxed ? DUNGEON_UI.JADE
        : selected ? DUNGEON_UI.BRASS_BRIGHT : DUNGEON_UI.BRASS;
    addSigil(this, sigilFor(WISDOM_SIGILS, branch.id), PANEL_X + 34, y + BRANCH_H / 2, 30, sigilColor);
    this.add.text(PANEL_X + 60, y + 19, branch.name, {
      fontFamily: 'sans-serif', fontSize: '12px', fontStyle: 'bold', color: DUNGEON_UI_CSS.PARCHMENT,
    }).setOrigin(0, 0.5);
    this.add.text(PANEL_X + PANEL_W - 14, y + 19, view.validTier ? `등급 ${view.tier} / ${MAX_WISDOM_TIER}` : '저장 확인', {
      fontFamily: 'sans-serif', fontSize: '10px', fontStyle: 'bold',
      color: !view.validTier ? DUNGEON_UI_CSS.EMBER : view.isMaxed ? DUNGEON_UI_CSS.JADE : DUNGEON_UI_CSS.MUTED,
    }).setOrigin(1, 0.5);
    this.add.text(PANEL_X + 60, y + 46, view.currentEffect, {
      fontFamily: 'sans-serif', fontSize: '10px', color: DUNGEON_UI_CSS.TEXT,
    }).setOrigin(0, 0.5);
    this.add.text(PANEL_X + PANEL_W - 14, y + 46, this.branchCostLabel(view), {
      fontFamily: 'sans-serif', fontSize: '10px', fontStyle: 'bold',
      color: view.isMaxed ? DUNGEON_UI_CSS.JADE : view.canUpgrade ? DUNGEON_UI_CSS.BRASS : DUNGEON_UI_CSS.EMBER,
    }).setOrigin(1, 0.5);

    const zone = this.add.zone(PANEL_X, y, PANEL_W, BRANCH_H).setOrigin(0)
      .setInteractive({ useHandCursor: true });
    zone.setName(`wisdom-branch-${branch.id}`);
    zone.on('pointerdown', () => this.selectBranch(branch.id));
  }

  private drawSelectedLedger(): void {
    const selected = this.selectedBranch();
    if (!selected) return;
    const view = getWisdomBranchView(this.gameState, selected);
    const tone = !view.validTier
      ? DUNGEON_UI.EMBER
      : view.isMaxed
        ? DUNGEON_UI.JADE
        : DUNGEON_UI.BRASS;

    addFramedPanel(this, {
      x: PANEL_X,
      y: DETAIL_Y,
      w: PANEL_W,
      h: DETAIL_H,
      fillColor: DUNGEON_UI.STONE_RAISED,
      borderColor: tone,
      accentColor: tone,
      glowColor: tone,
      glowOpacity: view.canUpgrade ? 0.05 : 0.02,
    });

    addSigil(this, sigilFor(WISDOM_SIGILS, selected.id), PANEL_X + 30, DETAIL_Y + 22, 22, tone, { disc: false });
    this.add.text(PANEL_X + 46, DETAIL_Y + 22, selected.name, {
      fontFamily: 'sans-serif', fontSize: '15px', fontStyle: 'bold', color: DUNGEON_UI_CSS.PARCHMENT,
    }).setOrigin(0, 0.5);
    this.add.text(PANEL_X + PANEL_W - 16, DETAIL_Y + 22, this.branchStateLabel(view), {
      fontFamily: 'sans-serif', fontSize: '10px', fontStyle: 'bold',
      color: !view.validTier ? DUNGEON_UI_CSS.EMBER : view.isMaxed ? DUNGEON_UI_CSS.JADE : DUNGEON_UI_CSS.BRASS,
    }).setOrigin(1, 0.5);

    addProgressBar(this, {
      x: PANEL_X + 18,
      y: DETAIL_Y + 46,
      w: PANEL_W - 36,
      h: 9,
      ratio: view.tier / MAX_WISDOM_TIER,
      fillColor: view.isMaxed ? DUNGEON_UI.JADE : DUNGEON_UI.BRASS,
      trackColor: DUNGEON_UI.SOOT,
      borderColor: DUNGEON_UI.EDGE,
      animate: false,
    });
    this.add.text(PANEL_X + 18, DETAIL_Y + 70, `현재 · ${view.currentEffect}`, {
      fontFamily: 'sans-serif', fontSize: '11px', fontStyle: 'bold', color: DUNGEON_UI_CSS.TEXT,
    }).setOrigin(0, 0.5);
    this.add.text(PANEL_X + 18, DETAIL_Y + 91, this.nextEffectLabel(view), {
      fontFamily: 'sans-serif', fontSize: '10px', fontStyle: 'bold',
      color: view.nextEffect ? DUNGEON_UI_CSS.JADE : DUNGEON_UI_CSS.MUTED,
    }).setOrigin(0, 0.5);
    this.add.text(PANEL_X + PANEL_W - 18, DETAIL_Y + 106, this.costConsequenceLabel(view), {
      fontFamily: 'sans-serif', fontSize: '10px', fontStyle: 'bold',
      color: view.canUpgrade ? DUNGEON_UI_CSS.BRASS : view.isMaxed ? DUNGEON_UI_CSS.JADE : DUNGEON_UI_CSS.EMBER,
    }).setOrigin(1, 0.5);

    const receiptTone = this.receipt?.tone === 'warning'
      ? DUNGEON_UI.EMBER
      : this.receipt
        ? DUNGEON_UI.JADE
        : DUNGEON_UI.IRON;
    const receiptG = this.add.graphics();
    receiptG.fillStyle(DUNGEON_UI.SOOT, 0.84);
    receiptG.fillRoundedRect(PANEL_X + 14, DETAIL_Y + 116, PANEL_W - 28, 108, 7);
    receiptG.lineStyle(1, receiptTone, this.receipt ? 0.92 : 0.62);
    receiptG.strokeRoundedRect(PANEL_X + 14, DETAIL_Y + 116, PANEL_W - 28, 108, 7);
    this.add.text(PANEL_X + 26, DETAIL_Y + 139, this.receipt?.title ?? '의식 기록 대기', {
      fontFamily: 'sans-serif', fontSize: '10px', fontStyle: 'bold',
      color: this.receipt?.tone === 'warning'
        ? DUNGEON_UI_CSS.EMBER
        : this.receipt
          ? DUNGEON_UI_CSS.JADE
          : DUNGEON_UI_CSS.MUTED,
    }).setOrigin(0, 0.5);
    this.add.text(PANEL_X + 26, DETAIL_Y + 178, this.receipt?.detail ?? (selected.id === 'ancestorsWisdom'
      ? '9칸을 넘는 추가 슬롯은 1칸당 던전 최대 HP +20으로 적용됩니다. DM 성장 후에도 유지됩니다.'
      : '승인 결과와 수정·등급 변동이 이곳에 유지됩니다'), {
      fontFamily: 'sans-serif', fontSize: '10px',
      color: this.receipt ? DUNGEON_UI_CSS.TEXT : DUNGEON_UI_CSS.MUTED,
      wordWrap: { width: PANEL_W - 52 }, lineSpacing: 3,
    }).setOrigin(0, 0.5);
  }

  private drawCommand(): void {
    const selected = this.selectedBranch();
    if (!selected) return;
    const view = getWisdomBranchView(this.gameState, selected);

    addFramedPanel(this, {
      x: PANEL_X,
      y: COMMAND_Y,
      w: PANEL_W,
      h: 155,
      fillColor: DUNGEON_UI.STONE,
      borderColor: view.canUpgrade ? DUNGEON_UI.BRASS : DUNGEON_UI.IRON,
      shadowOpacity: 0.24,
    });
    this.add.text(PANEL_X + 16, COMMAND_Y + 22, this.commandStatus(view), {
      fontFamily: 'sans-serif', fontSize: '10px', fontStyle: 'bold',
      color: view.canUpgrade ? DUNGEON_UI_CSS.BRASS : view.isMaxed ? DUNGEON_UI_CSS.JADE : DUNGEON_UI_CSS.MUTED,
    }).setOrigin(0, 0.5);
    this.add.text(PANEL_X + PANEL_W - 16, COMMAND_Y + 22, `보유 수정 ${formatHudResourceValue(this.gameState.soulCrystals)}`, {
      fontFamily: 'sans-serif', fontSize: '10px', color: DUNGEON_UI_CSS.MUTED,
    }).setOrigin(1, 0.5);

    const command = addPrimaryActionButton(this, {
      x: PANEL_X + 14,
      y: COMMAND_Y + 42,
      w: PANEL_W - 28,
      h: 48,
      label: this.commandLabel(view),
      fontSize: '13px',
      enabled: view.canUpgrade,
      once: true,
      showArrow: false,
      fillColor: DUNGEON_UI.BRASS,
      hoverFillColor: DUNGEON_UI.BRASS_BRIGHT,
      borderColor: 0x705126,
      disabledFillColor: DUNGEON_UI.SOOT,
      disabledBorderColor: DUNGEON_UI.IRON,
      textColor: '#171006',
      onPress: () => this.showUpgradeConfirm(selected),
    });
    command.zone.setName('wisdom-upgrade');
    this.bindOrderAction(command.zone);

    this.add.text(CANVAS_WIDTH / 2, COMMAND_Y + 116, '선택과 계보 전환은 저장되지 않습니다', {
      fontFamily: 'sans-serif', fontSize: '10px', color: DUNGEON_UI_CSS.MUTED,
    }).setOrigin(0.5);
    this.add.text(CANVAS_WIDTH / 2, COMMAND_Y + 137, '확인 후에만 영혼 수정과 영구 가호가 변경됩니다', {
      fontFamily: 'sans-serif', fontSize: '10px', color: DUNGEON_UI_CSS.MUTED,
    }).setOrigin(0.5);
  }

  private showUpgradeConfirm(branch: BranchDef): void {
    const view = getWisdomBranchView(this.gameState, branch);
    if (!view.canUpgrade || view.cost === null || !view.nextEffect) {
      this.actionLocked = false;
      return;
    }
    const snapshot: WisdomUpgradeSnapshot = {
      branchId: branch.id,
      tier: view.tier,
      cost: view.cost,
      soulCrystals: this.gameState.soulCrystals,
      nextEffect: view.nextEffect,
    };

    const overlay = this.add.container(0, 0).setDepth(1000);
    this.confirmOverlay = overlay;

    const shieldG = this.add.graphics();
    shieldG.fillStyle(0x000000, 0.76);
    shieldG.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    const shield = this.add.zone(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT).setOrigin(0)
      .setInteractive();
    shield.setName('wisdom-confirm-shield');
    overlay.add([shieldG, shield]);

    const boxX = 22;
    const boxY = 236;
    const boxW = CANVAS_WIDTH - boxX * 2;
    const boxH = 368;
    const frame = addFramedPanel(this, {
      x: boxX,
      y: boxY,
      w: boxW,
      h: boxH,
      fillColor: DUNGEON_UI.STONE_RAISED,
      borderColor: DUNGEON_UI.BRASS,
      accentColor: DUNGEON_UI.BRASS,
      glowColor: DUNGEON_UI.BRASS,
      glowOpacity: 0.06,
      shadowOpacity: 0.42,
    });
    overlay.add([frame.shadow, frame.panel, frame.glow]);

    const texts = [
      this.add.text(CANVAS_WIDTH / 2, boxY + 32, `${branch.name} 의식 승인`, {
        fontFamily: 'sans-serif', fontSize: '16px', fontStyle: 'bold', color: DUNGEON_UI_CSS.PARCHMENT,
      }).setOrigin(0.5),
      this.add.text(CANVAS_WIDTH / 2, boxY + 65, `등급 ${view.tier} → ${view.tier + 1}`, {
        fontFamily: 'sans-serif', fontSize: '11px', fontStyle: 'bold', color: DUNGEON_UI_CSS.BRASS,
      }).setOrigin(0.5),
      this.add.text(boxX + 22, boxY + 104, `현재 · ${view.currentEffect}`, {
        fontFamily: 'sans-serif', fontSize: '11px', color: DUNGEON_UI_CSS.TEXT,
      }).setOrigin(0, 0.5),
      this.add.text(boxX + 22, boxY + 137, `해방 · ${view.nextEffect}`, {
        fontFamily: 'sans-serif', fontSize: '11px', fontStyle: 'bold', color: DUNGEON_UI_CSS.JADE,
      }).setOrigin(0, 0.5),
      this.add.text(boxX + 22, boxY + 183, `소모 · 영혼 수정 ${view.cost}`, {
        fontFamily: 'sans-serif', fontSize: '11px', fontStyle: 'bold', color: DUNGEON_UI_CSS.BRASS,
      }).setOrigin(0, 0.5),
      this.add.text(boxX + boxW - 22, boxY + 183, `보유 ${formatHudResourceValue(this.gameState.soulCrystals)} → ${formatHudResourceValue(this.gameState.soulCrystals - view.cost)}`, {
        fontFamily: 'sans-serif', fontSize: '11px', color: DUNGEON_UI_CSS.TEXT,
      }).setOrigin(1, 0.5),
      this.add.text(CANVAS_WIDTH / 2, boxY + 220, '영구 성장 선택이며 현재 진행에 즉시 적용됩니다', {
        fontFamily: 'sans-serif', fontSize: '10px', color: DUNGEON_UI_CSS.MUTED,
      }).setOrigin(0.5),
    ];
    overlay.add(texts);

    const confirm = addPrimaryActionButton(this, {
      x: boxX + 18,
      y: boxY + 276,
      w: 146,
      h: 48,
      label: '의식 승인',
      fontSize: '12px',
      once: true,
      showArrow: false,
      fillColor: DUNGEON_UI.BRASS,
      hoverFillColor: DUNGEON_UI.BRASS_BRIGHT,
      borderColor: 0x705126,
      textColor: '#171006',
      onPress: () => this.performUpgrade(branch, snapshot),
    });
    confirm.zone.setName('wisdom-confirm');
    overlay.add([confirm.bg, confirm.text, confirm.zone]);

    const cancel = addPrimaryActionButton(this, {
      x: boxX + boxW - 164,
      y: boxY + 276,
      w: 146,
      h: 48,
      label: '취소',
      fontSize: '12px',
      once: true,
      showArrow: false,
      fillColor: DUNGEON_UI.STONE,
      hoverFillColor: DUNGEON_UI.IRON,
      borderColor: DUNGEON_UI.EDGE,
      textColor: DUNGEON_UI_CSS.TEXT,
      onPress: () => this.closeConfirm(),
    });
    cancel.zone.setName('wisdom-cancel');
    overlay.add([cancel.bg, cancel.text, cancel.zone]);

    let decisionAdmitted = false;
    for (const zone of [confirm.zone, cancel.zone]) {
      const press = zone.listeners('pointerdown')[0] as ((...args: unknown[]) => void) | undefined;
      if (!press) continue;
      zone.removeAllListeners('pointerdown');
      zone.on('pointerdown', (...args: unknown[]) => {
        if (decisionAdmitted || this.confirmOverlay !== overlay) return;
        decisionAdmitted = true;
        confirm.zone.disableInteractive();
        cancel.zone.disableInteractive();
        press(...args);
      });
    }
  }

  private performUpgrade(branch: BranchDef, snapshot: WisdomUpgradeSnapshot): void {
    this.lastTransactionAt = now();
    const before = loadGameState();
    this.confirmOverlay?.destroy(true);
    this.confirmOverlay = undefined;

    if (!isWisdomUpgradeSnapshotCurrent(before, snapshot)) {
      this.gameState = before;
      this.receipt = {
        title: `${branch.name} · 저장 상태 변경 감지`,
        detail: '승인한 효과·등급·비용·잔액과 달라 의식을 실행하지 않았습니다',
        tone: 'warning',
      };
      this.queueRender();
      return;
    }

    const result = upgradeWisdomBranch(before, branch.id);

    if (!result.ok) {
      this.gameState = result.state;
      this.receipt = {
        title: `${branch.name} · ${this.failureTitle(result.reason)}`,
        detail: '영혼 수정과 지혜 등급은 변경되지 않았습니다',
        tone: 'warning',
      };
      this.queueRender();
      return;
    }

    // 황금의 손 raises the idle rate: pay the unclaimed window at the old rate first.
    const next = settleIdleAcrossChange(before, result.state, Date.now());
    saveGameState(next);
    this.gameState = next;
    this.receipt = {
      title: `${branch.name} · 등급 ${result.previousTier}→${result.nextTier} 해방`,
      detail: `영혼 수정 ${formatHudResourceValue(before.soulCrystals)}→${formatHudResourceValue(result.state.soulCrystals)} · 정확히 ${result.cost} 소모`,
      tone: 'success',
    };
    this.queueRender();
  }

  private closeConfirm(): void {
    this.confirmOverlay?.destroy(true);
    this.confirmOverlay = undefined;
    this.actionLocked = false;
  }

  private selectLineage(lineageId: WisdomLineageId): void {
    if (this.actionLocked || lineageId === this.activeLineage) return;
    this.activeLineage = lineageId;
    this.selectedBranchId = getWisdomLineageBranches(lineageId)[0]?.id ?? '';
    this.queueRender(false);
  }

  private selectBranch(branchId: string): void {
    if (this.actionLocked || branchId === this.selectedBranchId) return;
    this.selectedBranchId = branchId;
    this.queueRender(false);
  }

  private reconcileSelection(): void {
    const branches = getWisdomLineageBranches(this.activeLineage);
    if (!branches.some(branch => branch.id === this.selectedBranchId)) {
      this.selectedBranchId = branches[0]?.id ?? '';
    }
  }

  private selectedBranch(): BranchDef | undefined {
    return getWisdomLineageBranches(this.activeLineage)
      .find(branch => branch.id === this.selectedBranchId);
  }

  private bindOrderAction(zone: Phaser.GameObjects.Zone): void {
    const press = zone.listeners('pointerdown')[0] as ((...args: unknown[]) => void) | undefined;
    if (!press) return;
    zone.removeAllListeners('pointerdown');
    zone.on('pointerdown', (...args: unknown[]) => {
      if (this.actionLocked || this.renderQueued
        || now() - this.lastTransactionAt < TRANSACTION_COOLDOWN_MS) return;
      this.actionLocked = true;
      press(...args);
    });
  }

  private bindViewAction(zone: Phaser.GameObjects.Zone): void {
    const press = zone.listeners('pointerdown')[0] as ((...args: unknown[]) => void) | undefined;
    if (!press) return;
    zone.removeAllListeners('pointerdown');
    zone.on('pointerdown', (...args: unknown[]) => {
      if (this.actionLocked || this.confirmOverlay) return;
      press(...args);
    });
  }

  private queueRender(releaseLock = true): void {
    if (this.renderQueued) return;
    this.renderQueued = true;
    this.events.once(Phaser.Scenes.Events.POST_UPDATE, () => {
      this.renderQueued = false;
      if (this.sys.isActive()) this.render();
      if (releaseLock) this.actionLocked = false;
    });
  }

  private returnToPreviousScene(): void {
    if (this.actionLocked || this.confirmOverlay) return;
    this.actionLocked = true;
    this.scene.start((this.registry.get('previousScene') as string) ?? 'StageSelectScene');
  }

  private branchCostLabel(view: WisdomBranchView): string {
    if (!view.validTier) return '진행 불가';
    if (view.isMaxed) return '완성';
    return `수정 ${view.cost ?? 0}`;
  }

  private branchStateLabel(view: WisdomBranchView): string {
    if (!view.validTier) return '저장 등급 확인 필요';
    if (view.isMaxed) return '최고 등급 해방';
    if (view.canUpgrade) return `등급 ${view.tier} / ${MAX_WISDOM_TIER} · 해방 가능`;
    return `등급 ${view.tier} / ${MAX_WISDOM_TIER} · 수정 부족`;
  }

  private nextEffectLabel(view: WisdomBranchView): string {
    if (!view.validTier) return '다음 효과를 계산할 수 없습니다';
    if (view.isMaxed) return '모든 잠재력이 해방되었습니다';
    return `다음 · ${view.nextEffect}`;
  }

  private costConsequenceLabel(view: WisdomBranchView): string {
    if (!view.validTier) return '거래 차단';
    if (view.isMaxed) return '추가 비용 없음';
    if (view.canUpgrade) return `비용 ${view.cost} · 이후 ${this.gameState.soulCrystals - (view.cost ?? 0)}`;
    return `비용 ${view.cost} · ${view.deficit} 부족`;
  }

  private commandStatus(view: WisdomBranchView): string {
    if (!view.validTier) return '저장된 등급 값이 올바르지 않아 거래를 차단했습니다';
    if (view.isMaxed) return '이 가호는 최고 등급까지 완성되었습니다';
    if (!view.canUpgrade) return `영혼 수정 ${view.deficit}개를 더 모아야 합니다`;
    return `${view.cost}개를 바치면 다음 영구 효과가 즉시 적용됩니다`;
  }

  private commandLabel(view: WisdomBranchView): string {
    if (!view.validTier) return '저장 데이터 확인 필요';
    if (view.isMaxed) return '최고 등급 해방 완료';
    if (!view.canUpgrade) return `영혼 수정 ${view.deficit} 부족`;
    return `등급 ${view.tier + 1} 의식 승인`;
  }

  private failureTitle(reason: WisdomUpgradeFailureReason): string {
    if (reason === 'max_tier') return '이미 최고 등급';
    if (reason === 'insufficient_soul_crystals') return '영혼 수정 부족';
    return '알 수 없는 가호';
  }
}
