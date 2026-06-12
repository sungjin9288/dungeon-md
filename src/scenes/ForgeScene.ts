import Phaser from 'phaser';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../constants/layout';
import { CSS, ZONE_ACCENTS } from '../constants/colors';
import {
  getBlueprintRecommendation, getMonsterDefForOwned, findMonsterRoom, findOpenMonsterRoom,
  type ForgeRecommendation, type ForgeMonsterDef,
} from '../data/forgeRecommendations';
import { addTabBar } from '../ui/GameUiPrimitives';
import {
  loadGameState,
  saveGameState,
  type GameState,
} from '../data/wisdom';
import {
  BLUEPRINT_DEFS, MATERIAL_DEFS, RARITY_COLORS, RARITY_NAMES,
  type BlueprintDef,
} from '../data/fusion';
import { MONSTER_DEFS } from '../data/monsters';
import {
  applyCraftBlueprint,
  applyDismantleCraftedEquipment,
  canCraftBlueprint,
  getDismantleReturns,
  type CraftedEquipment,
} from '../data/forgeTransactions';
import { equipMonsterEquipment } from '../data/barracksTransactions';
import { calculateRoomMetrics } from '../data/dungeonMetrics';
import {
  EQUIPMENT_DEFS,
  type OwnedMonster,
} from '../data/barracks';
import { logger } from '../utils/logger';
import { addFramedPanel } from '../ui/GameUiPrimitives';

// ─── Layout ───────────────────────────────────────────────────────────────────

const HEADER_H  = 64;
const TAB_H     = 40;
const CONTENT_Y = HEADER_H + TAB_H;
const WORKBENCH_H = 136;
const LIST_PAD = 12;
const FORGE_RARITY_STARS = ['★', '★★', '★★★', '★★★★', '★★★★★', '★★★★★★'];
const FORGE_TYPE_META: Record<BlueprintDef['type'], { label: string; icon: string; color: string; hex: number }> = {
  weapon: { label: '무기', icon: '⚔', color: '#ffb45f', hex: 0xffb45f },
  armor: { label: '방어구', icon: '◆', color: '#8ac7ff', hex: 0x8ac7ff },
  accessory: { label: '장신구', icon: '✦', color: '#d7a4ff', hex: 0xd7a4ff },
};

interface RoomEquipmentFeedback {
  readonly kind: 'equipment';
  readonly slotIdx: number;
  readonly monsterId: string;
  readonly sourceLabel: string;
  readonly title: string;
  readonly body: string;
  readonly equipmentName: string;
  readonly equipmentEmoji: string;
  readonly statLabel?: string;
  readonly statBefore?: string;
  readonly statAfter?: string;
  readonly accent: number;
}

interface ForgeTargetCue {
  readonly monsterId: string;
  readonly monsterName: string;
  readonly monsterEmoji: string;
  readonly monsterLevel: number;
  readonly roomLabel: string;
  readonly needLabel: string;
  readonly statusLabel: string;
  readonly accent: number;
  readonly priority: number;
}


// ─── Scene ────────────────────────────────────────────────────────────────────

export class ForgeScene extends Phaser.Scene {
  private activeTab: 'craft' | 'dismantle' = 'craft';
  private contentContainer?: Phaser.GameObjects.Container;
  private tabContainer?: Phaser.GameObjects.Container;
  private headerContainer?: Phaser.GameObjects.Container;
  private selectedBpId: string | null = null;
  private selectedEqIdx: number | null = null;
  private returnScene = 'DungeonHomeScene';
  private focusMonsterId: string | null = null;
  private focusSourceLabel: string | null = null;
  private focusRoomSlotIdx: number | null = null;

  constructor() { super({ key: 'ForgeScene' }); }

  // ─── Lifecycle ────────────────────────────────────────────────────────────

  create(): void {
    this.activeTab    = 'craft';
    this.selectedBpId = null;
    this.selectedEqIdx = null;
    this.returnScene = this.consumeReturnScene();
    this.focusMonsterId = this.peekFocusMonsterId();
    this.focusSourceLabel = this.peekFocusSourceLabel();
    this.focusRoomSlotIdx = this.peekFocusRoomSlotIdx();

    this.drawBackground();
    this.drawHeader();
    this.drawTabBar();
    this.renderContent();

    this.cameras.main.fadeIn(220, 0, 0, 0);
  }

  // ─── Background ──────────────────────────────────────────────────────────

  private drawBackground(): void {
    const g = this.add.graphics().setDepth(-10);
    g.fillStyle(0x0f0803, 1);
    g.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    g.fillStyle(0x1c1007, 1);
    g.fillRoundedRect(10, CONTENT_Y + 8, CANVAS_WIDTH - 20, CANVAS_HEIGHT - CONTENT_Y - 18, 18);
    g.lineStyle(1, 0x3b2411, 0.42);
    for (let y = CONTENT_Y + 26; y < CANVAS_HEIGHT - 12; y += 32) {
      g.lineBetween(18, y, CANVAS_WIDTH - 18, y);
    }
    for (let x = 30; x < CANVAS_WIDTH; x += 52) {
      const offset = Math.floor((x / 52) % 2) * 16;
      g.lineBetween(x, CONTENT_Y + 8 + offset, x, CANVAS_HEIGHT - 22);
    }
    g.lineStyle(3, 0x060301, 0.62);
    g.strokeRoundedRect(10, CONTENT_Y + 8, CANVAS_WIDTH - 20, CANVAS_HEIGHT - CONTENT_Y - 18, 18);

    const glow = this.add.graphics().setDepth(-9);
    glow.fillStyle(0xff6b1a, 0.11);
    glow.fillCircle(CANVAS_WIDTH / 2, CONTENT_Y + 112, 176);
    glow.fillStyle(0xffc56a, 0.08);
    glow.fillEllipse(CANVAS_WIDTH / 2, CONTENT_Y + 106, 298, 86);
    glow.fillStyle(0x51ffd2, 0.035);
    glow.fillCircle(CANVAS_WIDTH - 76, CONTENT_Y + 236, 118);

    const shop = this.add.graphics().setDepth(-8);
    const furnaceX = CANVAS_WIDTH / 2;
    const furnaceY = CONTENT_Y + 20;
    shop.fillStyle(0x271406, 0.94);
    shop.fillRoundedRect(furnaceX - 108, furnaceY + 4, 216, 88, 18);
    shop.lineStyle(2, 0x8a4a12, 0.34);
    shop.strokeRoundedRect(furnaceX - 108, furnaceY + 4, 216, 88, 18);
    shop.fillStyle(0x0b0502, 0.96);
    shop.fillRoundedRect(furnaceX - 48, furnaceY + 30, 96, 34, 10);
    shop.fillStyle(0xff4a12, 0.58);
    shop.fillEllipse(furnaceX, furnaceY + 48, 72, 24);
    shop.fillStyle(0xffc35a, 0.9);
    shop.fillEllipse(furnaceX, furnaceY + 46, 42, 13);
    shop.fillStyle(0x16100a, 0.96);
    shop.fillRoundedRect(furnaceX - 134, furnaceY + 78, 268, 14, 5);
    shop.lineStyle(2, 0xb96b22, 0.5);
    shop.lineBetween(36, furnaceY + 96, CANVAS_WIDTH - 36, furnaceY + 96);
    shop.fillStyle(0x080604, 0.86);
    shop.fillRoundedRect(38, furnaceY + 44, 48, 54, 8);
    shop.fillRoundedRect(CANVAS_WIDTH - 86, furnaceY + 44, 48, 54, 8);
    shop.fillStyle(0xff6b1a, 0.2);
    shop.fillCircle(62, furnaceY + 60, 23);
    shop.fillCircle(CANVAS_WIDTH - 62, furnaceY + 60, 23);
    shop.fillStyle(0xffd37a, 0.78);
    for (const [sx, sy, r] of [
      [112, CONTENT_Y + 58, 2],
      [132, CONTENT_Y + 36, 1.5],
      [252, CONTENT_Y + 42, 1.8],
      [274, CONTENT_Y + 68, 1.4],
      [314, CONTENT_Y + 88, 1.6],
    ] as const) {
      shop.fillCircle(sx, sy, r);
    }
  }

  // ─── Header ──────────────────────────────────────────────────────────────

  private drawHeader(): void {
    this.headerContainer?.destroy();
    const c = this.add.container(0, 0).setDepth(10);
    this.headerContainer = c;

    const g = this.add.graphics();
    g.fillStyle(0x1a0800, 1);
    g.fillRect(0, 0, CANVAS_WIDTH, HEADER_H);
    g.lineStyle(1, 0xcc6600, 0.35);
    g.lineBetween(0, HEADER_H, CANVAS_WIDTH, HEADER_H);
    c.add(g);

    c.add(this.add.text(CANVAS_WIDTH / 2, HEADER_H / 2 - 7, '장비 제작소', {
      fontFamily: 'Georgia, serif', fontSize: '20px', color: '#ffaa44',
    }).setOrigin(0.5));
    const gs = loadGameState();
    const focusName = this.getFocusMonsterName(gs);
    const headerSub = focusName
      ? `${this.focusSourceLabel ?? '선택 수호자'} · ${focusName} 장비 보강`
      : '몬스터 장비를 제작하고 바로 장착';
    c.add(this.add.text(CANVAS_WIDTH / 2, HEADER_H / 2 + 14, headerSub, {
      fontFamily: 'sans-serif', fontSize: '10px', color: focusName ? '#ffd9a0' : '#b78a55',
    }).setOrigin(0.5));

    const back = this.add.text(18, HEADER_H / 2, '← 뒤로', {
      fontFamily: 'sans-serif', fontSize: '13px', color: CSS.PARCHMENT_DIM,
      backgroundColor: '#2d2416', padding: { x: 8, y: 4 },
    }).setOrigin(0, 0.5).setInteractive({ useHandCursor: true });
    back.on('pointerdown', () => {
      this.cameras.main.fadeOut(200, 0, 0, 0);
      this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start(this.returnScene));
    });
    c.add(back);

    if (this.focusRoomSlotIdx !== null) {
      const returnX = CANVAS_WIDTH - 78;
      const returnY = HEADER_H / 2 - 13;
      const returnBg = this.add.graphics();
      returnBg.fillStyle(0x0c211b, 0.96);
      returnBg.fillRoundedRect(returnX, returnY, 66, 26, 7);
      returnBg.lineStyle(1.2, 0xc8e8b0, 0.74);
      returnBg.strokeRoundedRect(returnX, returnY, 66, 26, 7);
      returnBg.fillStyle(0xc8e8b0, 0.14);
      returnBg.fillRoundedRect(returnX + 4, returnY + 4, 58, 18, 5);
      c.add(returnBg);

      const returnText = this.add.text(returnX + 33, returnY + 13, '방 복귀', {
        fontFamily: 'sans-serif',
        fontSize: '11px',
        color: '#b8fff0',
        fontStyle: 'bold',
      }).setOrigin(0.5);
      const returnZone = this.add.zone(returnX, returnY, 66, 26)
        .setOrigin(0, 0)
        .setInteractive({ useHandCursor: true });
      returnZone.on('pointerover', () => returnText.setColor('#ffffff'));
      returnZone.on('pointerout', () => returnText.setColor('#b8fff0'));
      returnZone.on('pointerdown', () => this.returnToFocusedRoom());
      c.add([returnText, returnZone]);
    }

    // Material inventory strip (right side of header)
    const materialEntries = Object.entries(gs.materials ?? {})
      .filter(([, qty]) => qty > 0)
      .map(([id, qty]) => `${this.getMaterialDisplay(id).emoji}×${qty}`);
    const matLine = materialEntries.length > 0
      ? `${materialEntries.slice(0, 3).join(' ')}${materialEntries.length > 3 ? ` +${materialEntries.length - 3}` : ''}`
      : '';
    if (matLine && this.focusRoomSlotIdx === null) {
      c.add(this.add.text(CANVAS_WIDTH - 10, 13, matLine, {
        fontFamily: 'sans-serif', fontSize: '8px', color: '#d4a36c',
      }).setOrigin(1, 0.5));
    }

    // Awakening stones indicator
    const stones = gs.awakeningStones ?? 0;
    if (this.focusRoomSlotIdx === null) {
      c.add(this.add.text(CANVAS_WIDTH - 12, HEADER_H - 14, `각성석: ${stones}`, {
        fontFamily: 'sans-serif', fontSize: '10px', color: '#cc44cc',
      }).setOrigin(1, 1));
    }
  }

  private consumeReturnScene(): string {
    const sceneKey = this.registry.get('forgeReturnScene');
    this.registry.remove('forgeReturnScene');
    return typeof sceneKey === 'string' && sceneKey.length > 0 ? sceneKey : 'DungeonHomeScene';
  }

  private peekFocusMonsterId(): string | null {
    const monsterId = this.registry.get('focusMonsterId');
    return typeof monsterId === 'string' && monsterId.length > 0 ? monsterId : null;
  }

  private peekFocusSourceLabel(): string | null {
    const label = this.registry.get('focusSourceLabel');
    return typeof label === 'string' && label.length > 0 ? label : null;
  }

  private peekFocusRoomSlotIdx(): number | null {
    const raw = this.registry.get('focusRoomSlotIdx');
    const slotIdx = typeof raw === 'number' ? raw : Number(raw);
    return Number.isInteger(slotIdx) && slotIdx >= 0 ? slotIdx : null;
  }

  private preserveFocusContext(): void {
    if (this.focusMonsterId) this.registry.set('focusMonsterId', this.focusMonsterId);
    if (this.focusSourceLabel) this.registry.set('focusSourceLabel', this.focusSourceLabel);
    if (this.focusRoomSlotIdx !== null) this.registry.set('focusRoomSlotIdx', this.focusRoomSlotIdx);
  }

  private returnToFocusedRoom(): void {
    if (this.focusRoomSlotIdx === null) {
      this.scene.start('DungeonHomeScene');
      return;
    }
    this.registry.set('focusRoomSlotIdx', this.focusRoomSlotIdx);
    this.scene.start('DungeonHomeScene');
  }

  private registerRoomEquipmentFeedback(
    beforeGs: GameState,
    afterGs: GameState,
    monsterId: string,
    bp: BlueprintDef,
  ): void {
    if (this.focusRoomSlotIdx === null) return;
    const target = this.getFocusMonsterDisplay(afterGs);
    const sourceLabel = this.focusSourceLabel ?? `방 #${this.focusRoomSlotIdx + 1} 수호자`;
    const beforeSlot = beforeGs.dungeonSlots?.[this.focusRoomSlotIdx];
    const afterSlot = afterGs.dungeonSlots?.[this.focusRoomSlotIdx];
    const beforePower = beforeSlot ? calculateRoomMetrics(beforeGs, beforeSlot).threatScore : null;
    const afterPower = afterSlot ? calculateRoomMetrics(afterGs, afterSlot).threatScore : null;
    const feedback: RoomEquipmentFeedback = {
      kind: 'equipment',
      slotIdx: this.focusRoomSlotIdx,
      monsterId,
      sourceLabel,
      title: '장비 장착 완료',
      body: `${target?.name ?? '수호자'}에게 ${bp.name} 장착`,
      equipmentName: bp.name,
      equipmentEmoji: bp.resultEmoji,
      statLabel: beforePower !== null && afterPower !== null ? '전력' : undefined,
      statBefore: beforePower !== null && afterPower !== null ? String(beforePower) : undefined,
      statAfter: beforePower !== null && afterPower !== null ? String(afterPower) : undefined,
      accent: this.rarityHex(bp.rarity),
    };
    this.registry.set('homeRoomFeedback', feedback);
    this.registry.set('roomDetailFeedback', feedback);
  }

  // ─── Tab bar ─────────────────────────────────────────────────────────────

  private drawTabBar(): void {
    this.tabContainer?.destroy();
    this.tabContainer = addTabBar<'craft' | 'dismantle'>(this, {
      tabs: [
        { id: 'craft',     label: '⚒️  제작' },
        { id: 'dismantle', label: '🔨  분해' },
      ],
      active:    this.activeTab,
      y:         HEADER_H,
      height:    TAB_H,
      accent:    ZONE_ACCENTS.forge,
      accentCSS: '#ffaa44',
      onSelect:  id => {
        this.activeTab     = id;
        this.selectedBpId  = null;
        this.selectedEqIdx = null;
        this.drawTabBar();
        this.renderContent();
      },
    }).container;
  }

  // ─── Content dispatch ────────────────────────────────────────────────────

  private renderContent(): void {
    this.contentContainer?.destroy();
    const c = this.add.container(0, CONTENT_Y).setDepth(5);
    this.contentContainer = c;

    if (this.activeTab === 'craft')    this.buildCraftTab(c);
    else                               this.buildDismantleTab(c);
  }

  private buildWorkbenchPanel(
    c: Phaser.GameObjects.Container,
    mode: 'craft' | 'dismantle',
  ): number {
    const gs = loadGameState();
    const ownedBlueprints = gs.blueprints ?? [];
    const craftable = ownedBlueprints
      .map(id => BLUEPRINT_DEFS[id])
      .filter((bp): bp is BlueprintDef => Boolean(bp))
      .filter(bp => canCraftBlueprint(bp, gs.materials ?? {}));
    const bestCraftable = [...craftable].sort((a, b) => b.rarity - a.rarity)[0];
    const previewBlueprint = bestCraftable
      ?? ownedBlueprints.map(id => BLUEPRINT_DEFS[id]).find((bp): bp is BlueprintDef => Boolean(bp));
    const recommendation = mode === 'craft' && previewBlueprint
      ? getBlueprintRecommendation(gs, previewBlueprint)
      : null;
    const materialTypes = Object.values(gs.materials ?? {}).filter(qty => qty > 0).length;
    const craftedCount = (gs.craftedEquipment ?? []).length;
    const equippedCount = gs.ownedMonsters.filter(monster => Boolean(monster.equipment)).length;
    const heatRatio = ownedBlueprints.length > 0 ? craftable.length / ownedBlueprints.length : 0;
    const target = this.getFocusMonsterDisplay(gs);
    const workbenchTarget = target ?? (recommendation
      ? {
          name: recommendation.monsterName,
          emoji: recommendation.monsterEmoji,
          level: recommendation.monsterLevel,
        }
      : null);
    const targetName = workbenchTarget?.name ?? null;
    const sourceLabel = this.focusSourceLabel ?? recommendation?.roomLabel ?? null;
    const currentEquipment = target
      ? this.getFocusEquipmentDisplay(gs)
      : recommendation
        ? this.getMonsterEquipmentDisplay(gs, recommendation.monsterId)
        : null;

    const x = 12, y = 10, w = CANVAS_WIDTH - 24, h = 116;
    const accent = mode === 'craft' ? 0xffa43d : 0xcc5533;
    const frame = addFramedPanel(this, {
      x,
      y,
      w,
      h,
      radius: 12,
      fillColor: 0x211207,
      borderColor: accent,
      borderAlpha: 0.74,
      borderWidth: 1.5,
      accentColor: accent,
      accentAlpha: 0.46,
      glowColor: accent,
      glowOpacity: 0.08,
      shadowOpacity: 0.46,
      shadowOffsetY: 4,
    });
    c.add([frame.shadow, frame.panel, frame.glow]);

    const panel = this.add.graphics();
    panel.fillStyle(0x0c1714, 0.94);
    panel.fillRoundedRect(x + 8, y + 10, 86, h - 20, 10);
    panel.fillStyle(0xff7d1f, 0.07);
    panel.fillRoundedRect(x + 100, y + 8, w - 194, h - 16, 10);
    panel.fillStyle(mode === 'craft' ? 0x361404 : 0x24100b, 0.92);
    panel.fillRoundedRect(x + w - 86, y + 11, 74, h - 22, 10);
    panel.lineStyle(1, 0xc8e8b0, target ? 0.34 : 0.12);
    panel.strokeRoundedRect(x + 12, y + 14, 78, h - 28, 9);
    c.add(panel);

    c.add(this.add.text(x + 51, y + 32, workbenchTarget ? workbenchTarget.emoji : mode === 'craft' ? '⚒' : '🔨', {
      fontFamily: 'sans-serif', fontSize: workbenchTarget ? '30px' : '31px',
    }).setOrigin(0.5));
    c.add(this.add.text(x + 51, y + 64, workbenchTarget ? `Lv.${workbenchTarget.level}` : mode === 'craft' ? '제작대' : '분해대', {
      fontFamily: 'sans-serif', fontSize: '10px', color: workbenchTarget ? '#ffd9a0' : '#e0b276',
      fontStyle: workbenchTarget ? 'bold' : 'normal',
    }).setOrigin(0.5));
    if (workbenchTarget) {
      c.add(this.add.text(x + 51, y + 82, this.truncateLabel(workbenchTarget.name, 6), {
        fontFamily: 'Georgia, serif', fontSize: '10px', color: '#fff0c2',
        fontStyle: 'bold',
      }).setOrigin(0.5));
    }

    const title = mode === 'craft'
      ? (bestCraftable
          ? (recommendation ? `${bestCraftable.name} 추천 제작` : `${bestCraftable.name} 제작 가능`)
          : '재료 수급 필요')
      : (craftedCount > 0 ? '장비 회수 가능' : '제작 장비 없음');
    const body = mode === 'craft'
      ? (recommendation
          ? recommendation.targetLine
          : targetName
            ? `${targetName}에게 장착할 장비를 제작해 전투실 효율을 올리세요.`
          : '방어선에 부족한 무기, 방어구, 장신구를 제작하세요.')
      : '사용하지 않는 제작 장비를 분해해 다음 장비 재료로 회수하세요.';

    c.add(this.add.text(x + 110, y + 19, title, {
      fontFamily: 'Georgia, serif', fontSize: '15px', fontStyle: 'bold', color: CSS.PARCHMENT,
    }).setOrigin(0, 0.5));
    c.add(this.add.text(x + 110, y + 41, body, {
      fontFamily: 'sans-serif', fontSize: '10px', color: CSS.PARCHMENT_DIM,
      wordWrap: { width: sourceLabel ? 142 : 162, useAdvancedWrap: true },
    }).setOrigin(0, 0.5));

    const equipLine = currentEquipment
      ? `${currentEquipment.emoji} ${this.truncateLabel(currentEquipment.name, 9)} 장착 중`
      : workbenchTarget
        ? '장비 슬롯 비어 있음'
        : mode === 'craft'
          ? '설계도 선택 후 단조'
          : '불필요 장비 회수';
    const hasPowerRecommendation = mode === 'craft' && recommendation !== null;
    const equipChipW = hasPowerRecommendation ? 112 : 160;
    const equipChip = this.add.graphics();
    equipChip.fillStyle(currentEquipment ? 0x161308 : 0x0d0a07, 0.92);
    equipChip.fillRoundedRect(x + 110, y + 60, equipChipW, 20, 7);
    equipChip.lineStyle(1, currentEquipment ? 0xffdf78 : 0x4d3920, 0.55);
    equipChip.strokeRoundedRect(x + 110, y + 60, equipChipW, 20, 7);
    c.add(equipChip);
    c.add(this.add.text(x + 110 + equipChipW / 2, y + 70, equipLine, {
      fontFamily: 'sans-serif', fontSize: '9px',
      color: currentEquipment ? '#fff0b8' : '#9e8460',
      fontStyle: currentEquipment ? 'bold' : 'normal',
    }).setOrigin(0.5));

    if (hasPowerRecommendation) {
      const boostX = x + 226;
      const boost = this.add.graphics();
      boost.fillStyle(recommendation.accent, 0.18);
      boost.fillRoundedRect(boostX, y + 60, 54, 20, 7);
      boost.lineStyle(1, recommendation.accent, 0.72);
      boost.strokeRoundedRect(boostX, y + 60, 54, 20, 7);
      boost.fillStyle(0xffffff, 0.08);
      boost.fillRoundedRect(boostX + 5, y + 64, 44, 4, 3);
      c.add(boost);
      c.add(this.add.text(boostX + 27, y + 70, `전력 +${recommendation.powerDelta}`, {
        fontFamily: 'sans-serif',
        fontSize: '9px',
        color: '#b8fff0',
        fontStyle: 'bold',
      }).setOrigin(0.5));
    }

    if (sourceLabel) {
      const chipX = x + w - 76;
      const chipY = y + 14;
      const chip = this.add.graphics();
      chip.fillStyle(0x071715, 0.96);
      chip.fillRoundedRect(chipX, chipY, 58, 20, 7);
      chip.lineStyle(1.1, 0xc8e8b0, 0.58);
      chip.strokeRoundedRect(chipX, chipY, 58, 20, 7);
      chip.fillStyle(0xc8e8b0, 0.16);
      chip.fillRoundedRect(chipX + 5, chipY + 5, 4, 10, 3);
      c.add(chip);
      c.add(this.add.text(chipX + 32, chipY + 10, this.truncateLabel(sourceLabel, 5), {
        fontFamily: 'sans-serif',
        fontSize: '9px',
        color: '#b8fff0',
        fontStyle: 'bold',
      }).setOrigin(0.5));
    }

    this.drawWorkbenchStat(c, x + 110, y + 88, 50, '가능', String(craftable.length), 0x8de36d);
    this.drawWorkbenchStat(c, x + 166, y + 88, 52, '설계도', String(ownedBlueprints.length), 0xffb35c);
    this.drawWorkbenchStat(c, x + 224, y + 88, 48, '재료', String(materialTypes), 0x8ac7ff);

    if (!sourceLabel) {
      const craftedText = mode === 'craft'
        ? `도감 ${craftedCount} · 장착 ${equippedCount}`
        : `보유 ${craftedCount} · 장착 ${equippedCount}`;
      c.add(this.add.text(x + w - 20, y + 22, craftedText, {
        fontFamily: 'sans-serif', fontSize: '9px', color: '#b78a55',
      }).setOrigin(1, 0.5));
    }

    const forgeX = x + w - 49;
    const forgeY = y + 64;
    const forge = this.add.graphics();
    forge.fillStyle(0x080402, 0.86);
    forge.fillRoundedRect(forgeX - 26, forgeY - 25, 52, 42, 8);
    forge.fillStyle(mode === 'craft' ? 0xff4b16 : 0x693021, 0.44);
    forge.fillEllipse(forgeX, forgeY - 3, 44, 23);
    forge.fillStyle(mode === 'craft' ? 0xffcf75 : 0xb86b42, mode === 'craft' ? 0.86 : 0.45);
    forge.fillEllipse(forgeX, forgeY - 5, 26, 11);
    forge.fillStyle(0x2e2a24, 1);
    forge.fillRoundedRect(forgeX - 22, forgeY + 22, 44, 9, 3);
    forge.fillStyle(0x050201, 0.92);
    forge.fillRoundedRect(forgeX - 20, forgeY + 14, 40, 5, 3);
    forge.fillStyle(mode === 'craft' ? 0xffcf75 : 0xb86b42, 0.86);
    forge.fillRoundedRect(forgeX - 20, forgeY + 14, Math.max(4, 40 * (mode === 'craft' ? heatRatio : Math.min(1, craftedCount / 6))), 5, 3);
    forge.lineStyle(1, bestCraftable ? this.rarityHex(bestCraftable.rarity) : 0x8a4a12, 0.72);
    forge.strokeRoundedRect(forgeX - 27, forgeY - 26, 54, 58, 8);
    c.add(forge);
    c.add(this.add.text(forgeX, forgeY + 17, mode === 'craft' && previewBlueprint ? this.getForgeRarityStars(previewBlueprint.rarity) : 'STOCK', {
      fontFamily: 'sans-serif',
      fontSize: '8px',
      color: mode === 'craft' && previewBlueprint ? (RARITY_COLORS[previewBlueprint.rarity] ?? '#ffd096') : '#c38a63',
      fontStyle: 'bold',
    }).setOrigin(0.5));
    c.add(this.add.text(forgeX, forgeY + 37, mode === 'craft' ? '단조' : '회수', {
      fontFamily: 'sans-serif', fontSize: '9px', color: '#ffd096', fontStyle: 'bold',
    }).setOrigin(0.5));

    return WORKBENCH_H;
  }

  private drawWorkbenchStat(
    c: Phaser.GameObjects.Container,
    x: number,
    y: number,
    w: number,
    label: string,
    value: string,
    accent: number,
  ): void {
    const g = this.add.graphics();
    g.fillStyle(0x0d0a07, 0.86);
    g.fillRoundedRect(x, y, w, 22, 5);
    g.lineStyle(1, accent, 0.36);
    g.strokeRoundedRect(x, y, w, 22, 5);
    c.add(g);
    c.add(this.add.text(x + 6, y + 7, label, {
      fontFamily: 'sans-serif', fontSize: '8px', color: CSS.PARCHMENT_MUTED,
    }).setOrigin(0, 0.5));
    c.add(this.add.text(x + w - 6, y + 14, value, {
      fontFamily: 'sans-serif', fontSize: '10px', fontStyle: 'bold',
      color: `#${accent.toString(16).padStart(6, '0')}`,
    }).setOrigin(1, 0.5));
  }

  private drawProgressTrack(
    c: Phaser.GameObjects.Container,
    x: number,
    y: number,
    w: number,
    h: number,
    ratio: number,
    color: number,
  ): void {
    const g = this.add.graphics();
    const fillW = Math.round(w * Phaser.Math.Clamp(ratio, 0, 1));
    g.fillStyle(0x0b0704, 1);
    g.fillRoundedRect(x, y, w, h, Math.max(2, h / 2));
    g.fillStyle(color, 0.92);
    g.fillRoundedRect(x, y, Math.max(2, fillW), h, Math.max(2, h / 2));
    g.lineStyle(0.5, color, 0.45);
    g.strokeRoundedRect(x, y, w, h, Math.max(2, h / 2));
    c.add(g);
  }

  private getBlueprintMaterialProgress(
    bp: BlueprintDef,
    materials: Record<string, number>,
  ): { have: number; need: number; ratio: number } {
    const need = Object.values(bp.materials).reduce((sum, qty) => sum + qty, 0);
    const have = Object.entries(bp.materials)
      .reduce((sum, [id, qty]) => sum + Math.min(qty, materials[id] ?? 0), 0);
    return { have, need, ratio: need > 0 ? have / need : 1 };
  }

  private rarityHex(rarity: number): number {
    const color = RARITY_COLORS[rarity] ?? '#aaaaaa';
    return Number.parseInt(color.replace('#', ''), 16);
  }

  private getForgeRarityStars(rarity: number): string {
    const index = Phaser.Math.Clamp(Math.floor(rarity), 0, FORGE_RARITY_STARS.length - 1);
    return FORGE_RARITY_STARS[index];
  }

  private getForgeTypeMeta(type: BlueprintDef['type'] | string): { label: string; icon: string; color: string; hex: number } {
    if (type === 'weapon' || type === 'armor' || type === 'accessory') return FORGE_TYPE_META[type];
    return { label: '장비', icon: '◇', color: '#d2b07b', hex: 0xd2b07b };
  }

  private drawBlueprintCardShell(
    c: Phaser.GameObjects.Container,
    x: number,
    y: number,
    rowH: number,
    bp: BlueprintDef,
    cardNo: string,
    typeMeta: ReturnType<ForgeScene['getForgeTypeMeta']>,
    rarityHex: number,
    canCraft: boolean,
    isSelected: boolean,
    progressRatio: number,
    hasRecommendation: boolean,
  ): void {
    const g = this.add.graphics();
    const cardW = CANVAS_WIDTH - x * 2;
    const itemCx = x + 35;
    const itemCy = y + 31;
    const statusColor = canCraft ? 0x8de36d : 0xcc6644;
    const progress = Phaser.Math.Clamp(progressRatio, 0, 1);

    g.fillStyle(rarityHex, isSelected ? 0.16 : canCraft ? 0.10 : 0.045);
    g.fillRoundedRect(x + 9, y + 10, 52, rowH - 26, 9);
    g.lineStyle(1, rarityHex, canCraft ? 0.42 : 0.20);
    g.strokeRoundedRect(x + 10, y + 11, 50, rowH - 28, 8);
    for (let i = 0; i < 5; i++) {
      const lineY = y + 19 + i * 13;
      g.lineStyle(0.8, rarityHex, canCraft ? 0.12 : 0.055);
      g.lineBetween(x + 17, lineY + 10, x + 50, lineY);
    }

    g.fillStyle(typeMeta.hex, canCraft ? 0.12 : 0.055);
    g.fillCircle(itemCx, itemCy, 27);
    g.lineStyle(bp.rarity >= 3 ? 1.4 : 1, rarityHex, canCraft ? 0.58 : 0.28);
    g.strokeCircle(itemCx, itemCy, 25);
    g.lineStyle(1, typeMeta.hex, canCraft ? 0.34 : 0.16);
    g.strokeCircle(itemCx, itemCy, 18);
    g.fillStyle(0x070503, 0.34);
    g.fillEllipse(itemCx, itemCy + 26, 56, 9);

    g.lineStyle(1.5, statusColor, canCraft ? 0.72 : 0.44);
    g.beginPath();
    g.arc(
      itemCx,
      itemCy,
      30,
      Phaser.Math.DegToRad(-90),
      Phaser.Math.DegToRad(-90 + 360 * progress),
    );
    g.strokePath();

    g.fillStyle(0x050806, 0.94);
    g.fillRoundedRect(x + 11, y + 7, 48, 13, 5);
    g.lineStyle(1, rarityHex, 0.46);
    g.strokeRoundedRect(x + 11, y + 7, 48, 13, 5);
    g.fillStyle(0x050806, 0.94);
    g.fillRoundedRect(x + 14, y + rowH - 31, 43, 13, 5);
    g.lineStyle(1, statusColor, canCraft ? 0.58 : 0.34);
    g.strokeRoundedRect(x + 14, y + rowH - 31, 43, 13, 5);

    g.fillStyle(rarityHex, canCraft ? 0.16 : 0.07);
    g.fillRoundedRect(x + 17, y + 71, 36, 14, 5);
    g.lineStyle(1, rarityHex, canCraft ? 0.5 : 0.22);
    g.strokeRoundedRect(x + 17, y + 71, 36, 14, 5);
    for (let i = 0; i < Math.min(3, bp.rarity + 1); i++) {
      g.fillStyle(rarityHex, canCraft ? 0.74 : 0.34);
      g.fillCircle(x + 22 + i * 7, y + 97, i === 0 ? 1.8 : 1.3);
    }

    if (hasRecommendation) {
      g.fillStyle(0x061816, 0.92);
      g.fillRoundedRect(x + cardW - 156, y + 34, 62, 15, 6);
      g.lineStyle(1, 0xc8e8b0, 0.52);
      g.strokeRoundedRect(x + cardW - 156, y + 34, 62, 15, 6);
      g.fillStyle(0xc8e8b0, 0.16);
      g.fillCircle(x + cardW - 146, y + 41.5, 4.2);
    }

    c.add(g);
    c.add(this.add.text(x + 35, y + 13.5, `도면 ${cardNo}`, {
      fontFamily: 'sans-serif',
      fontSize: '7px',
      color: RARITY_COLORS[bp.rarity] ?? '#d6b783',
      fontStyle: 'bold',
    }).setOrigin(0.5));
    c.add(this.add.text(x + 35, y + rowH - 24.5, canCraft ? 'READY' : 'WAIT', {
      fontFamily: 'monospace',
      fontSize: '7px',
      color: canCraft ? '#c8f7b0' : '#ffb088',
      fontStyle: 'bold',
    }).setOrigin(0.5));
    if (hasRecommendation) {
      c.add(this.add.text(x + cardW - 124, y + 41.5, '추천 장착', {
        fontFamily: 'sans-serif',
        fontSize: '8px',
        color: '#b8fff0',
        fontStyle: 'bold',
      }).setOrigin(0.5));
    }
  }

  private getMaterialDisplay(id: string): { emoji: string; name: string } {
    const def = MATERIAL_DEFS[id];
    if (def) return { emoji: def.emoji, name: def.name };

    const legacy: Record<string, { emoji: string; name: string }> = {
      iron_ore: { emoji: '🪨', name: '철 광석' },
      spirit_wood: { emoji: '🪵', name: '정령목' },
    };
    const fallback = legacy[id];
    if (fallback) return fallback;

    return {
      emoji: '◇',
      name: id
        .split('_')
        .filter(Boolean)
        .map(part => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' '),
    };
  }

  private getFocusMonsterName(gs: ReturnType<typeof loadGameState>): string | null {
    return this.getFocusMonsterDisplay(gs)?.name ?? null;
  }

  private getFocusMonsterDisplay(gs: ReturnType<typeof loadGameState>): { name: string; emoji: string; level: number } | null {
    if (!this.focusMonsterId) return null;
    const owned = gs.ownedMonsters.find(monster => monster.id === this.focusMonsterId);
    const def = owned ? MONSTER_DEFS[owned.id as keyof typeof MONSTER_DEFS] : null;
    if (!owned) return null;
    return {
      name: def?.name ?? owned.id,
      emoji: def?.emoji ?? '👹',
      level: owned.level,
    };
  }

  private getFocusEquipmentDisplay(
    gs: ReturnType<typeof loadGameState>,
  ): { name: string; emoji: string; rarity: number } | null {
    if (!this.focusMonsterId) return null;
    return this.getMonsterEquipmentDisplay(gs, this.focusMonsterId);
  }

  private getMonsterEquipmentDisplay(
    gs: ReturnType<typeof loadGameState>,
    monsterId: string,
  ): { name: string; emoji: string; rarity: number } | null {
    const owned = gs.ownedMonsters.find(monster => monster.id === monsterId);
    const equipmentId = owned?.equipment;
    if (!equipmentId) return null;

    const crafted = [...(gs.craftedEquipment ?? [])].reverse()
      .find(equipment => equipment.id === equipmentId);
    if (crafted) {
      return { name: crafted.name, emoji: crafted.emoji, rarity: crafted.rarity };
    }

    const bp = Object.values(BLUEPRINT_DEFS).find(blueprint => blueprint.resultId === equipmentId);
    if (bp) {
      return { name: bp.name, emoji: bp.resultEmoji, rarity: bp.rarity };
    }

    const staticDef = EQUIPMENT_DEFS.find(equipment => equipment.id === equipmentId);
    if (staticDef) {
      return { name: staticDef.name, emoji: staticDef.icon, rarity: 0 };
    }

    return { name: equipmentId, emoji: '⚙', rarity: 0 };
  }

  private getEquipmentHolderDisplay(
    gs: ReturnType<typeof loadGameState>,
    equipmentId: string,
  ): { name: string; emoji: string; level: number } | null {
    const holder = gs.ownedMonsters?.find(monster => monster.equipment === equipmentId);
    if (!holder) return null;
    const def = getMonsterDefForOwned(holder.id);
    return {
      name: def?.name ?? holder.id,
      emoji: def?.emoji ?? '👹',
      level: holder.level,
    };
  }

  private summarizeBlueprintEffects(bp: BlueprintDef): string[] {
    return this.summarizeStatEffects(bp.stats, bp.statDesc);
  }

  private summarizeEquipmentEffects(eq: CraftedEquipment): string[] {
    return this.summarizeStatEffects(eq.stats, '기본 장비');
  }

  private summarizeStatEffects(stats: Record<string, number>, fallback: string): string[] {
    const labels = Object.entries(stats).map(([key, rawValue]) => {
      const value = Number(rawValue);
      if (key === 'atkMult') {
        const percent = value >= 1 ? Math.round((value - 1) * 100) : Math.round(value * 100);
        return `ATK ${percent >= 0 ? '+' : ''}${percent}%`;
      }
      if (key === 'atkBonus' || key === 'atkMultiplier') return `ATK +${Math.round(value * 100)}%`;
      if (key === 'roomHpBonus') return `방 HP +${value}`;
      if (key === 'roomHPBonus') return `방 HP +${value}`;
      if (key === 'stunBonus') return `기절 +${(value / 1000).toFixed(1)}s`;
      if (key === 'stunDuration') return `기절 +${value}s`;
      if (key === 'freezeChance') return `동결 +${Math.round(value * 100)}%`;
      if (key === 'skillCdMult') return `쿨타임 -${Math.round((1 - value) * 100)}%`;
      if (key === 'skillCDReduction' || key === 'cdReduction') return `쿨타임 -${Math.round(value * 100)}%`;
      if (key === 'scEarnBonus') return `수정 +${Math.round(value * 100)}%`;
      if (key === 'goldBonus') return `골드 +${Math.round(value * 100)}%`;
      if (key === 'crystalMult') return `수정 +${Math.round(value * 100)}%`;
      if (key === 'dmgReduction') return `피해 -${Math.round(value * 100)}%`;
      if (key === 'atkSpeedBonus') return `공속 +${Math.round(value * 100)}%`;
      if (key === 'bossDmgBonus') return `보스 +${Math.round(value * 100)}%`;
      if (key === 'executeChance') return `처형 +${Math.round(value * 100)}%`;
      if (key === 'charmEvery') return `${value}타 매혹`;
      if (key === 'procBonus') return `발동 +${Math.round(value * 100)}%`;
      if (key === 'adjacentAtkBonus') return `인접 ATK +${Math.round(value * 100)}%`;
      if (key === 'holyDmgBonus') return `성스러운 +${Math.round(value * 100)}%`;
      if (key === 'celestialAtkBonus') return `천상 ATK +${Math.round(value * 100)}%`;
      if (key === 'aoeEvery') return `${value}타 광역`;
      return `${key} +${value}`;
    });
    return labels.length > 0 ? labels.slice(0, 3) : [fallback];
  }

  private drawEffectChips(
    c: Phaser.GameObjects.Container,
    labels: string[],
    x: number,
    y: number,
    accent: number,
    maxWidth: number,
  ): void {
    let cursorX = x;
    labels.forEach((label, index) => {
      const chipW = Math.min(78, Math.max(50, label.length * 7 + 14));
      if (cursorX + chipW > x + maxWidth) return;
      const g = this.add.graphics();
      g.fillStyle(0x0b0a07, 0.9);
      g.fillRoundedRect(cursorX, y, chipW, 18, 6);
      g.lineStyle(1, accent, index === 0 ? 0.5 : 0.28);
      g.strokeRoundedRect(cursorX, y, chipW, 18, 6);
      c.add(g);
      c.add(this.add.text(cursorX + chipW / 2, y + 9, label, {
        fontFamily: 'sans-serif', fontSize: '8px',
        color: index === 0 ? '#fff3be' : '#d2bd8a',
      }).setOrigin(0.5));
      cursorX += chipW + 5;
    });
  }

  private drawForgeRecommendationPreview(
    c: Phaser.GameObjects.Container,
    recommendation: ForgeRecommendation,
    x: number,
    y: number,
    w: number,
    h: number,
    title: string,
  ): void {
    const g = this.add.graphics();
    g.fillStyle(0x061815, 0.96);
    g.fillRoundedRect(x, y, w, h, 9);
    g.fillStyle(recommendation.accent, 0.15);
    g.fillRoundedRect(x + 6, y + 7, 42, h - 14, 8);
    g.fillStyle(0x070503, 0.36);
    g.fillRoundedRect(x + w - 72, y + 8, 62, h - 16, 8);
    g.lineStyle(1.2, recommendation.accent, 0.66);
    g.strokeRoundedRect(x, y, w, h, 9);
    g.lineStyle(1, 0xffffff, 0.11);
    g.lineBetween(x + 55, y + 9, x + 55, y + h - 9);
    c.add(g);

    c.add(this.add.text(x + 27, y + h / 2, recommendation.monsterEmoji, {
      fontFamily: 'sans-serif',
      fontSize: '20px',
    }).setOrigin(0.5));
    c.add(this.add.text(x + 62, y + 12, title, {
      fontFamily: 'sans-serif',
      fontSize: '8px',
      color: '#8fffe0',
      fontStyle: 'bold',
    }).setOrigin(0, 0.5));
    c.add(this.add.text(x + 62, y + 27, this.truncateLabel(recommendation.monsterName, 8), {
      fontFamily: 'Georgia, serif',
      fontSize: '12px',
      color: '#f4ffe9',
      fontStyle: 'bold',
    }).setOrigin(0, 0.5));
    c.add(this.add.text(x + 62, y + 42, `${recommendation.roomLabel} · Lv.${recommendation.monsterLevel}`, {
      fontFamily: 'sans-serif',
      fontSize: '8px',
      color: '#9ed0c5',
    }).setOrigin(0, 0.5));
    c.add(this.add.text(x + w - 41, y + h / 2 - 5, `+${recommendation.powerDelta}`, {
      fontFamily: 'sans-serif',
      fontSize: '15px',
      color: '#b8fff0',
      fontStyle: 'bold',
    }).setOrigin(0.5));
    c.add(this.add.text(x + w - 41, y + h / 2 + 11, '전력', {
      fontFamily: 'sans-serif',
      fontSize: '8px',
      color: '#7fb8a8',
      fontStyle: 'bold',
    }).setOrigin(0.5));
  }

  private addModalButton(
    c: Phaser.GameObjects.Container,
    x: number,
    y: number,
    w: number,
    h: number,
    label: string,
    accent: number,
    variant: 'primary' | 'secondary',
    onClick: () => void,
  ): void {
    const g = this.add.graphics();
    g.fillStyle(0x070503, 0.34);
    g.fillRoundedRect(x, y + 3, w, h, 7);
    g.fillStyle(variant === 'primary' ? 0x5a2a00 : 0x160b05, variant === 'primary' ? 1 : 0.96);
    g.fillRoundedRect(x, y, w, h, 7);
    g.fillStyle(0xffffff, variant === 'primary' ? 0.12 : 0.04);
    g.fillRoundedRect(x + 6, y + 5, w - 12, 5, 3);
    g.lineStyle(1, accent, variant === 'primary' ? 0.82 : 0.42);
    g.strokeRoundedRect(x, y, w, h, 7);
    c.add(g);

    c.add(this.add.text(x + w / 2, y + h / 2, label, {
      fontFamily: 'sans-serif',
      fontSize: '13px',
      color: variant === 'primary' ? '#f0e6c8' : '#b78a55',
      fontStyle: variant === 'primary' ? 'bold' : 'normal',
    }).setOrigin(0.5));

    const zone = this.add.zone(x + w / 2, y + h / 2, w, h)
      .setInteractive({ useHandCursor: true });
    zone.on('pointerdown', onClick);
    c.add(zone);
  }

  private truncateLabel(value: string, maxChars: number): string {
    return value.length > maxChars ? `${value.slice(0, maxChars)}…` : value;
  }

  private buildForgeTargetRail(
    c: Phaser.GameObjects.Container,
    gs: GameState,
    y: number,
  ): number {
    const targets = this.getForgeTargetCues(gs).slice(0, 3);
    if (targets.length === 0) return y;

    const x = LIST_PAD;
    const w = CANVAS_WIDTH - LIST_PAD * 2;
    const h = 58;
    const bg = this.add.graphics();
    bg.fillStyle(0x0f0a06, 0.96);
    bg.fillRoundedRect(x, y, w, h, 10);
    bg.fillStyle(0xffa43d, 0.08);
    bg.fillRoundedRect(x + 7, y + 8, w - 14, 17, 7);
    bg.lineStyle(1.2, 0xffa43d, 0.42);
    bg.strokeRoundedRect(x, y, w, h, 10);
    bg.lineStyle(1, 0xffffff, 0.08);
    bg.lineBetween(x + 8, y + 27, x + w - 8, y + 27);
    c.add(bg);

    c.add(this.add.text(x + 12, y + 16, '추천 장착 대상', {
      fontFamily: 'sans-serif',
      fontSize: '10px',
      color: '#ffd096',
      fontStyle: 'bold',
    }).setOrigin(0, 0.5));
    c.add(this.add.text(x + w - 12, y + 16, '칩 선택 시 추천 갱신', {
      fontFamily: 'sans-serif',
      fontSize: '8px',
      color: '#a8794d',
    }).setOrigin(1, 0.5));

    const chipW = Math.floor((w - 28) / 3);
    targets.forEach((target, index) => {
      const chipX = x + 8 + index * (chipW + 6);
      const chipY = y + 31;
      const active = this.focusMonsterId === target.monsterId;
      const chip = this.add.graphics();
      chip.fillStyle(active ? 0x0c211b : 0x150d07, 0.98);
      chip.fillRoundedRect(chipX, chipY, chipW, 22, 7);
      chip.fillStyle(target.accent, active ? 0.20 : 0.10);
      chip.fillRoundedRect(chipX + 4, chipY + 4, 22, 14, 5);
      chip.lineStyle(1.1, active ? 0xc8e8b0 : target.accent, active ? 0.82 : 0.42);
      chip.strokeRoundedRect(chipX, chipY, chipW, 22, 7);
      c.add(chip);

      c.add(this.add.text(chipX + 15, chipY + 11, target.monsterEmoji, {
        fontFamily: 'sans-serif',
        fontSize: '12px',
      }).setOrigin(0.5));
      c.add(this.add.text(chipX + 30, chipY + 7, this.truncateLabel(target.monsterName, 5), {
        fontFamily: 'sans-serif',
        fontSize: '8px',
        color: active ? '#b8fff0' : '#f0d4a8',
        fontStyle: 'bold',
      }).setOrigin(0, 0.5));
      c.add(this.add.text(chipX + 30, chipY + 16, this.truncateLabel(target.needLabel, 6), {
        fontFamily: 'sans-serif',
        fontSize: '7px',
        color: '#a8794d',
      }).setOrigin(0, 0.5));
      c.add(this.add.text(chipX + chipW - 5, chipY + 11, target.roomLabel, {
        fontFamily: 'sans-serif',
        fontSize: '7px',
        color: `#${target.accent.toString(16).padStart(6, '0')}`,
        fontStyle: 'bold',
      }).setOrigin(1, 0.5));

      const zone = this.add.zone(chipX, chipY, chipW, 22)
        .setOrigin(0, 0)
        .setInteractive({ useHandCursor: true });
      zone.on('pointerdown', () => {
        this.focusMonsterId = target.monsterId;
        this.focusSourceLabel = target.roomLabel;
        this.drawHeader();
        this.renderContent();
      });
      c.add(zone);
    });

    return y + h + 8;
  }

  private getForgeTargetCues(gs: GameState): ForgeTargetCue[] {
    return [...(gs.ownedMonsters ?? [])]
      .map(monster => this.buildForgeTargetCue(gs, monster))
      .sort((a, b) => b.priority - a.priority);
  }

  private buildForgeTargetCue(gs: GameState, monster: OwnedMonster): ForgeTargetCue {
    const def = getMonsterDefForOwned(monster.id);
    const assignedRoom = findMonsterRoom(gs, monster.id);
    const openRoom = assignedRoom ? null : findOpenMonsterRoom(gs, monster);
    const currentEquipment = this.getMonsterEquipmentDisplay(gs, monster.id);
    const roomLabel = assignedRoom
      ? `방 #${assignedRoom.index + 1}`
      : openRoom
        ? `방 #${openRoom.index + 1}`
        : '막사';
    const needLabel = currentEquipment
      ? '교체 후보'
      : this.getForgeNeedLabel(def);
    const statusLabel = currentEquipment
      ? `${currentEquipment.emoji} ${this.truncateLabel(currentEquipment.name, 6)}`
      : '장비 없음';
    const priority = (this.focusMonsterId === monster.id ? 100 : 0)
      + (!currentEquipment ? 48 : 8)
      + (assignedRoom ? 34 : openRoom ? 18 : 0)
      + Math.min(monster.level, 30);

    return {
      monsterId: monster.id,
      monsterName: def?.name ?? monster.id,
      monsterEmoji: def?.emoji ?? '👹',
      monsterLevel: monster.level,
      roomLabel,
      needLabel,
      statusLabel,
      accent: def?.accentColor ?? 0xffa43d,
      priority,
    };
  }

  private getForgeNeedLabel(def: ForgeMonsterDef | null): string {
    if (def?.type === 'magic') return '장신구 추천';
    if (def?.type === 'support') return '방어구 추천';
    return '무기 추천';
  }

  // ─── Craft tab ───────────────────────────────────────────────────────────

  private buildCraftTab(c: Phaser.GameObjects.Container): void {
    const gs = loadGameState();
    const owned = gs.blueprints ?? [];
    const workbenchEndY = this.buildWorkbenchPanel(c, 'craft');
    const listStartY = this.buildForgeTargetRail(c, gs, workbenchEndY);

    if (owned.length === 0) {
      c.add(this.add.text(CANVAS_WIDTH / 2, listStartY + 18, '보유한 설계도가 없습니다.\n전투에서 설계도를 획득하세요.', {
        fontFamily: 'sans-serif', fontSize: '13px', color: '#886633',
        align: 'center', lineSpacing: 6,
      }).setOrigin(0.5, 0));
      return;
    }

    let oy = listStartY;
    const pad = LIST_PAD;
    const rowH = 108;

    owned.forEach((bpId, index) => {
      const bp = BLUEPRINT_DEFS[bpId];
      if (!bp) return;

      const isSelected = this.selectedBpId === bpId;
      const canCraft = canCraftBlueprint(bp, gs.materials ?? {});
      const progress = this.getBlueprintMaterialProgress(bp, gs.materials ?? {});
      const rarityColor = RARITY_COLORS[bp.rarity] ?? '#aaaaaa';
      const rarityHex = this.rarityHex(bp.rarity);
      const typeMeta = this.getForgeTypeMeta(bp.type);
      const cardNo = String(index + 1).padStart(3, '0');
      const effectLabels = this.summarizeBlueprintEffects(bp);
      const recommendation = getBlueprintRecommendation(gs, bp, { monsterId: this.focusMonsterId, sourceLabel: this.focusSourceLabel });
      const missingTotal = Math.max(0, progress.need - progress.have);
      const craftStateLabel = canCraft ? '단조 가능' : `부족 ${missingTotal}`;
      const recommendationLine = recommendation
        ? `추천 ${recommendation.monsterEmoji}${this.truncateLabel(recommendation.monsterName, 4)} · ${recommendation.roomLabel} · +${recommendation.powerDelta}`
        : bp.statDesc;

      const bg = this.add.graphics();
      bg.fillStyle(isSelected ? 0x2d1808 : 0x170d06, 1);
      bg.fillRoundedRect(pad, oy, CANVAS_WIDTH - pad * 2, rowH - 4, 10);
      bg.fillStyle(0x060402, 0.42);
      bg.fillRoundedRect(pad + 5, oy + 5, CANVAS_WIDTH - pad * 2 - 10, rowH - 14, 8);
      bg.fillStyle(rarityHex, canCraft ? 0.12 : 0.05);
      bg.fillRoundedRect(pad + 6, oy + 7, 58, rowH - 18, 8);
      bg.lineStyle(1.5, isSelected ? 0xffaa44 : (canCraft ? rarityHex : 0x2a1a00), canCraft ? 0.92 : 0.78);
      bg.strokeRoundedRect(pad, oy, CANVAS_WIDTH - pad * 2, rowH - 4, 10);
      bg.lineStyle(1, 0xffffff, isSelected ? 0.16 : 0.08);
      bg.lineBetween(pad + 74, oy + 12, pad + 74, oy + rowH - 18);
      c.add(bg);
      this.drawBlueprintCardShell(
        c,
        pad,
        oy,
        rowH,
        bp,
        cardNo,
        typeMeta,
        rarityHex,
        canCraft,
        isSelected,
        progress.ratio,
        Boolean(recommendation),
      );

      const typeBadge = this.add.graphics();
      typeBadge.fillStyle(typeMeta.hex, canCraft ? 0.16 : 0.08);
      typeBadge.fillRoundedRect(pad + 15, oy + 53, 40, 15, 6);
      typeBadge.lineStyle(0.8, typeMeta.hex, canCraft ? 0.52 : 0.24);
      typeBadge.strokeRoundedRect(pad + 15, oy + 53, 40, 15, 6);
      c.add(typeBadge);

      c.add(this.add.text(pad + 35, oy + 31, bp.resultEmoji, {
        fontFamily: 'sans-serif', fontSize: '29px',
      }).setOrigin(0.5));
      c.add(this.add.text(pad + 35, oy + 60, `${typeMeta.icon} ${typeMeta.label}`, {
        fontFamily: 'sans-serif', fontSize: '8px', color: typeMeta.color,
        fontStyle: 'bold',
      }).setOrigin(0.5));
      c.add(this.add.text(pad + 35, oy + 76, this.getForgeRarityStars(bp.rarity), {
        fontFamily: 'sans-serif', fontSize: '8px', color: rarityColor,
      }).setOrigin(0.5));
      c.add(this.add.text(pad + 35, oy + 90, RARITY_NAMES[bp.rarity] ?? '특수', {
        fontFamily: 'sans-serif', fontSize: '8px', color: rarityColor,
      }).setOrigin(0.5));

      c.add(this.add.text(pad + 84, oy + 10, this.truncateLabel(bp.name, recommendation ? 9 : 13), {
        fontFamily: 'Georgia, serif', fontSize: '14px', color: rarityColor,
      }));
      if (recommendation) {
        const powerX = CANVAS_WIDTH - pad - 132;
        const power = this.add.graphics();
        power.fillStyle(0x062018, 0.96);
        power.fillRoundedRect(powerX, oy + 9, 56, 18, 6);
        power.lineStyle(1, recommendation.accent, 0.68);
        power.strokeRoundedRect(powerX, oy + 9, 56, 18, 6);
        power.fillStyle(recommendation.accent, 0.16);
        power.fillRoundedRect(powerX + 4, oy + 13, 48, 4, 3);
        c.add(power);
        c.add(this.add.text(powerX + 28, oy + 18, `전력 +${recommendation.powerDelta}`, {
          fontFamily: 'sans-serif',
          fontSize: '9px',
          color: '#b8fff0',
          fontStyle: 'bold',
        }).setOrigin(0.5));
      }
      c.add(this.add.text(pad + 84, oy + 29, recommendationLine, {
        fontFamily: 'sans-serif', fontSize: '10px', color: recommendation ? '#b8fff0' : '#b68f5e',
      }));
      this.drawEffectChips(c, effectLabels, pad + 84, oy + 46, rarityHex, 166);

      c.add(this.add.text(pad + 84, oy + 69, `재료 준비 ${progress.have}/${progress.need}`, {
        fontFamily: 'sans-serif', fontSize: '10px', color: canCraft ? '#8fdc72' : '#c98258',
      }));
      const stateChipX = CANVAS_WIDTH - pad - 146;
      const stateChip = this.add.graphics();
      stateChip.fillStyle(canCraft ? 0x0f2410 : 0x2a1208, 0.94);
      stateChip.fillRoundedRect(stateChipX, oy + 66, 60, 18, 6);
      stateChip.lineStyle(1, canCraft ? 0x8de36d : 0xcc6644, 0.54);
      stateChip.strokeRoundedRect(stateChipX, oy + 66, 60, 18, 6);
      c.add(stateChip);
      c.add(this.add.text(stateChipX + 30, oy + 75, craftStateLabel, {
        fontFamily: 'sans-serif',
        fontSize: '9px',
        color: canCraft ? '#b7f0a3' : '#ffb088',
        fontStyle: 'bold',
      }).setOrigin(0.5));

      this.drawProgressTrack(c, pad + 84, oy + 84, 152, 7, progress.ratio, canCraft ? 0x88cc66 : 0xcc6644);

      // Material requirements
      const matStr = Object.entries(bp.materials)
        .map(([id, qty]) => {
          const have = gs.materials?.[id] ?? 0;
          const material = this.getMaterialDisplay(id);
          return `${material.emoji}${have}/${qty}`;
        }).join('  ');
      c.add(this.add.text(pad + 84, oy + 94, matStr, {
        fontFamily: 'sans-serif', fontSize: '10px', color: canCraft ? '#b6e58f' : '#d88a66',
      }));

      // Craft button
      const btnW = 70, btnH = 28;
      const btnX = CANVAS_WIDTH - pad * 2 - btnW + 2;
      const btnY = oy + (rowH - 4 - btnH) / 2;

      const btnBg = this.add.graphics();
      btnBg.fillStyle(0x070503, 0.34);
      btnBg.fillRoundedRect(btnX, btnY + 3, btnW, btnH, 6);
      btnBg.fillStyle(canCraft ? 0xd35f16 : 0x2a1a00, 1);
      btnBg.fillRoundedRect(btnX, btnY, btnW, btnH, 6);
      btnBg.fillStyle(0xffffff, canCraft ? 0.12 : 0.04);
      btnBg.fillRoundedRect(btnX + 5, btnY + 5, btnW - 10, 5, 3);
      btnBg.lineStyle(1, canCraft ? 0xffc16a : 0x53321c, 0.82);
      btnBg.strokeRoundedRect(btnX, btnY, btnW, btnH, 6);
      c.add(btnBg);

      const btnT = this.add.text(btnX + btnW / 2, btnY + btnH / 2, canCraft ? '제작' : '재료 부족', {
        fontFamily: 'sans-serif', fontSize: canCraft ? '12px' : '10px', fontStyle: 'bold',
        color: canCraft ? '#ffffff' : '#664433',
      }).setOrigin(0.5);
      c.add(btnT);

      if (canCraft) {
        const zone = this.add.zone(btnX + btnW / 2, btnY + btnH / 2, btnW, btnH)
          .setInteractive({ useHandCursor: true });
        zone.on('pointerdown', () => this.confirmCraft(bpId));
        c.add(zone);
      }

      // Tap row to select
      const rowZoneW = CANVAS_WIDTH - pad * 3 - btnW - 10;
      const rowZone = this.add.zone(pad + rowZoneW / 2, oy + (rowH - 4) / 2, rowZoneW, rowH - 4)
        .setInteractive({ useHandCursor: true });
      rowZone.on('pointerdown', () => {
        this.selectedBpId = this.selectedBpId === bpId ? null : bpId;
        this.renderContent();
      });
      c.add(rowZone);

      oy += rowH;
    });
  }

  private executeCraft(bpId: string): void {
    const gs = loadGameState();
    const bp = BLUEPRINT_DEFS[bpId];
    if (!bp) return;
    const result = applyCraftBlueprint(gs, bp);
    if (!result.ok) return;

    const matEntries = Object.entries(result.consumedMaterials);

    // Float feedback per material
    matEntries.forEach(([id, qty], i) => {
      const emoji  = this.getMaterialDisplay(id).emoji;
      const baseX  = CANVAS_WIDTH / 2 - ((matEntries.length - 1) * 32) / 2 + i * 32;
      const floatT = this.add.text(baseX, 120, `-${qty}${emoji}`, {
        fontFamily: 'sans-serif', fontSize: '13px', fontStyle: 'bold',
        color: '#ffaa66', stroke: '#000000', strokeThickness: 3,
      }).setOrigin(0.5).setDepth(260).setAlpha(0);
      this.tweens.add({
        targets: floatT, y: 96, alpha: { from: 1, to: 0 },
        duration: 900, ease: 'Cubic.easeOut',
        onComplete: () => floatT.destroy(),
      });
    });

    saveGameState(result.state);

    const matLog = matEntries
      .map(([id]) => `${id}: ${result.materialsBefore[id] ?? 0}→${result.state.materials[id] ?? 0}`)
      .join(', ');
    logger.debug(`[FORGE] ${bp.resultId} crafted ${matLog}`);

    this.showCraftAnimation(bp, () => {
      this.drawHeader();
      this.renderContent();
    });
  }

  private showCraftAnimation(bp: BlueprintDef, onComplete: () => void): void {
    const c = this.add.container(0, 0).setDepth(50);
    const typeMeta = this.getForgeTypeMeta(bp.type);
    const accent = this.rarityHex(bp.rarity);
    const rarityColor = RARITY_COLORS[bp.rarity] ?? '#ffaa44';

    const dim = this.add.graphics();
    dim.fillStyle(0x000000, 0.78);
    dim.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    c.add(dim);

    const cx = CANVAS_WIDTH / 2;
    const cy = CANVAS_HEIGHT / 2;
    const panelW = 284;
    const panelH = 254;

    const box = this.add.graphics();
    box.fillStyle(0x1c0802, 1);
    box.fillRoundedRect(cx - panelW / 2, cy - panelH / 2, panelW, panelH, 14);
    box.fillStyle(accent, 0.12);
    box.fillRoundedRect(cx - panelW / 2 + 12, cy - panelH / 2 + 12, panelW - 24, 88, 12);
    box.fillStyle(0x090402, 0.6);
    box.fillRoundedRect(cx - 104, cy + 52, 208, 44, 12);
    box.lineStyle(2, accent, 0.96);
    box.strokeRoundedRect(cx - panelW / 2, cy - panelH / 2, panelW, panelH, 14);
    box.lineStyle(1, 0xffffff, 0.12);
    box.strokeRoundedRect(cx - panelW / 2 + 6, cy - panelH / 2 + 6, panelW - 12, panelH - 12, 10);
    c.add(box);

    const furnace = this.add.graphics();
    furnace.fillStyle(0x080402, 0.92);
    furnace.fillRoundedRect(cx - 72, cy - 24, 144, 70, 16);
    furnace.fillStyle(0xff4b16, 0.52);
    furnace.fillEllipse(cx, cy + 9, 126, 38);
    furnace.fillStyle(0xffcf75, 0.9);
    furnace.fillEllipse(cx, cy + 5, 76, 19);
    furnace.fillStyle(0x2e2a24, 1);
    furnace.fillRoundedRect(cx - 62, cy + 40, 124, 12, 4);
    furnace.lineStyle(1.5, accent, 0.7);
    furnace.strokeRoundedRect(cx - 72, cy - 24, 144, 70, 16);
    c.add(furnace);

    const card = this.add.graphics();
    card.setPosition(cx, cy - 23);
    card.fillStyle(0x0b0704, 0.98);
    card.fillRoundedRect(-46, -59, 92, 118, 12);
    card.fillStyle(accent, 0.11);
    card.fillRoundedRect(-38, -51, 76, 102, 9);
    card.lineStyle(2, accent, 0.92);
    card.strokeRoundedRect(-46, -59, 92, 118, 12);
    card.lineStyle(1, 0xffffff, 0.12);
    card.strokeRoundedRect(-40, -53, 80, 106, 9);
    card.setScale(0.68).setAlpha(0.32);
    c.add(card);

    const hammerT = this.add.text(cx - 66, cy - 78, '⚒', {
      fontFamily: 'sans-serif', fontSize: '34px',
    }).setOrigin(0.5);
    c.add(hammerT);

    const itemT = this.add.text(cx, cy - 36, bp.resultEmoji, {
      fontFamily: 'sans-serif',
      fontSize: '34px',
    }).setOrigin(0.5).setScale(0.72).setAlpha(0);
    c.add(itemT);

    const titleT = this.add.text(cx, cy - panelH / 2 + 24, '장비 단조', {
      fontFamily: 'Georgia, serif',
      fontSize: '18px',
      color: '#ffaa44',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    const metaT = this.add.text(cx, cy - panelH / 2 + 48, `${typeMeta.icon} ${typeMeta.label} · ${this.getForgeRarityStars(bp.rarity)}`, {
      fontFamily: 'sans-serif',
      fontSize: '10px',
      color: typeMeta.color,
      fontStyle: 'bold',
    }).setOrigin(0.5);
    c.add([titleT, metaT]);

    const nameT = this.add.text(cx, cy + 74, bp.name, {
      fontFamily: 'Georgia, serif',
      fontSize: '18px',
      color: rarityColor,
      fontStyle: 'bold',
    }).setOrigin(0.5).setAlpha(0);
    c.add(nameT);

    const statusT = this.add.text(cx, cy + 96, '용광로 가열 중...', {
      fontFamily: 'sans-serif', fontSize: '11px', color: '#d9a66d',
    }).setOrigin(0.5);
    c.add(statusT);

    let strikes = 0;
    const baseHammerY = cy - 78;
    this.time.addEvent({
      delay: 190,
      repeat: 5,
      callback: () => {
        strikes++;
        const hit = strikes % 2 === 0;
        hammerT
          .setY(hit ? baseHammerY - 8 : baseHammerY - 24)
          .setRotation(hit ? -0.22 : -0.74);
        card.setScale(0.68 + strikes * 0.045).setAlpha(0.32 + strikes * 0.08);
        this.emitForgeSparks(c, cx, cy + 4, accent, strikes);
        if (strikes === 3) statusT.setText('마력 각인 중...');
        if (strikes >= 6) {
          statusT.setText('단조 완료');
          statusT.setStyle({ color: '#b8fff0', fontStyle: 'bold' });
          card.setScale(1).setAlpha(1);
          itemT.setAlpha(1).setScale(1);
          nameT.setAlpha(1);
          hammerT.setAlpha(0.56);
          this.emitForgeRarityBurst(c, cx, cy - 30, accent);
          this.tweens.add({
            targets: [card, itemT],
            y: '-=10',
            duration: 280,
            yoyo: true,
            ease: 'Sine.easeOut',
          });
          this.time.delayedCall(780, () => {
            c.destroy();
            onComplete();
            this.showCraftCompleteCard(bp);
          });
        }
      },
    });
  }

  private emitForgeSparks(
    c: Phaser.GameObjects.Container,
    x: number,
    y: number,
    accent: number,
    seed: number,
  ): void {
    for (let i = 0; i < 5; i++) {
      const angle = -Math.PI / 2 + (i - 2) * 0.38 + seed * 0.11;
      const distance = 32 + i * 6;
      const spark = this.add.text(x, y, i % 2 === 0 ? '✦' : '•', {
        fontFamily: 'sans-serif',
        fontSize: i % 2 === 0 ? '13px' : '16px',
        color: `#${accent.toString(16).padStart(6, '0')}`,
      }).setOrigin(0.5).setAlpha(0.9);
      c.add(spark);
      this.tweens.add({
        targets: spark,
        x: x + Math.cos(angle) * distance,
        y: y + Math.sin(angle) * distance,
        alpha: 0,
        scaleX: 0.3,
        scaleY: 0.3,
        duration: 420,
        ease: 'Cubic.easeOut',
        onComplete: () => spark.destroy(),
      });
    }
  }

  private emitForgeRarityBurst(
    c: Phaser.GameObjects.Container,
    x: number,
    y: number,
    accent: number,
  ): void {
    const ring = this.add.graphics();
    ring.setPosition(x, y);
    ring.lineStyle(2, accent, 0.92);
    ring.strokeCircle(0, 0, 12);
    c.add(ring);
    this.tweens.add({
      targets: ring,
      scaleX: 5.2,
      scaleY: 5.2,
      alpha: 0,
      duration: 560,
      ease: 'Cubic.easeOut',
      onComplete: () => ring.destroy(),
    });
    for (let i = 0; i < 10; i++) {
      const angle = (Math.PI * 2 * i) / 10;
      const star = this.add.text(x, y, '✦', {
        fontFamily: 'sans-serif',
        fontSize: '14px',
        color: `#${accent.toString(16).padStart(6, '0')}`,
      }).setOrigin(0.5);
      c.add(star);
      this.tweens.add({
        targets: star,
        x: x + Math.cos(angle) * 92,
        y: y + Math.sin(angle) * 58,
        alpha: 0,
        scaleX: 0.45,
        scaleY: 0.45,
        duration: 620,
        ease: 'Cubic.easeOut',
        onComplete: () => star.destroy(),
      });
    }
  }

  private showCraftCompleteCard(bp: BlueprintDef): void {
    const c = this.add.container(0, 0).setDepth(60);
    const focusMonsterId = this.focusMonsterId;
    const recommendation = getBlueprintRecommendation(loadGameState(), bp);
    const typeMeta = this.getForgeTypeMeta(bp.type);
    const targetMonsterId = focusMonsterId ?? recommendation?.monsterId ?? null;
    const targetLabel = focusMonsterId
      ? '장착하고 돌아가기'
      : recommendation
        ? `${this.truncateLabel(recommendation.monsterName, 5)} 장착`
        : null;

    const dim = this.add.graphics();
    dim.fillStyle(0x000000, 0.75);
    dim.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    c.add(dim);

    const cx = CANVAS_WIDTH / 2;
    const cy = CANVAS_HEIGHT / 2;
    const pw = 278, ph = targetMonsterId ? 398 : 226;
    const accent = this.rarityHex(bp.rarity);

    const box = this.add.graphics();
    box.fillStyle(0x1a0800, 1);
    box.fillRoundedRect(cx - pw / 2, cy - ph / 2, pw, ph, 12);
    box.fillStyle(accent, 0.12);
    box.fillRoundedRect(cx - pw / 2 + 10, cy - ph / 2 + 10, pw - 20, 90, 10);
    box.fillStyle(0x060402, 0.34);
    box.fillRoundedRect(cx - pw / 2 + 14, cy + 24, pw - 28, 58, 9);
    box.lineStyle(2, accent, 1);
    box.strokeRoundedRect(cx - pw / 2, cy - ph / 2, pw, ph, 12);
    box.lineStyle(1, 0xffffff, 0.12);
    box.strokeRoundedRect(cx - pw / 2 + 5, cy - ph / 2 + 5, pw - 10, ph - 10, 9);
    c.add(box);

    const medal = this.add.graphics();
    medal.fillStyle(accent, 0.18);
    medal.fillCircle(cx, cy - ph / 2 + 72, 38);
    medal.lineStyle(2, accent, 0.72);
    medal.strokeCircle(cx, cy - ph / 2 + 72, 38);
    medal.fillStyle(0x0a0503, 0.82);
    medal.fillCircle(cx, cy - ph / 2 + 72, 27);
    c.add(medal);

    c.add(this.add.text(cx, cy - ph / 2 + 24, '제작 완료', {
      fontFamily: 'Georgia, serif', fontSize: '18px', color: '#ffaa44', fontStyle: 'bold',
    }).setOrigin(0.5));

    c.add(this.add.text(cx, cy - ph / 2 + 70, bp.resultEmoji, {
      fontFamily: 'sans-serif', fontSize: '34px',
    }).setOrigin(0.5));

    c.add(this.add.text(cx, cy - 18, bp.name, {
      fontFamily: 'Georgia, serif', fontSize: '19px', color: RARITY_COLORS[bp.rarity] ?? '#ffaa44',
      fontStyle: 'bold',
    }).setOrigin(0.5));

    c.add(this.add.text(cx, cy - 40, `${typeMeta.icon} ${typeMeta.label} · ${this.getForgeRarityStars(bp.rarity)} · 장비 도감 등록`, {
      fontFamily: 'sans-serif',
      fontSize: '10px',
      color: typeMeta.color,
      fontStyle: 'bold',
    }).setOrigin(0.5));

    c.add(this.add.text(cx, cy + 8, bp.statDesc, {
      fontFamily: 'sans-serif', fontSize: '12px', color: '#aa8844',
    }).setOrigin(0.5));

    this.drawEffectChips(c, this.summarizeBlueprintEffects(bp), cx - 92, cy + 34, accent, 184);

    c.add(this.add.text(cx, recommendation ? cy + 54 : cy + 58, `${RARITY_NAMES[bp.rarity] ?? '특수'} 장비가 보관함에 추가되었습니다.`, {
      fontFamily: 'sans-serif', fontSize: '10px', color: '#ccb083',
    }).setOrigin(0.5));

    if (recommendation) {
      this.drawForgeRecommendationPreview(
        c,
        recommendation,
        cx - 112,
        cy + 62,
        224,
        48,
        '추천 장착 대상',
      );
    }

    const confirmY = cy + ph / 2 - 26;
    if (targetMonsterId && targetLabel) {
      this.addModalButton(c, cx - 104, confirmY - 52, 208, 34, targetLabel, accent, 'primary', () => {
        const beforeState = loadGameState();
        const result = equipMonsterEquipment(beforeState, targetMonsterId, bp.resultId);
        if (!result.ok) {
          this.showToast('장착 실패', '#ff6666');
          return;
        }
        saveGameState(result.state);
        c.destroy();
        if (focusMonsterId) {
          this.registerRoomEquipmentFeedback(beforeState, result.state, focusMonsterId, bp);
          this.preserveFocusContext();
          this.scene.start(this.returnScene);
          return;
        }
        this.drawHeader();
        this.renderContent();
        this.showToast(`✅ ${recommendation?.monsterName ?? '수호자'} 장착 완료`, '#b8fff0');
      });
    }

    this.addModalButton(c, cx - 54, confirmY - 10, 108, 30, '확인', 0x7c5633, 'secondary', () => c.destroy());

    c.setScale(0.85).setAlpha(0);
    this.tweens.add({
      targets: c, scaleX: 1, scaleY: 1, alpha: 1,
      duration: 220, ease: 'Back.easeOut',
    });
  }

  // ─── Dismantle tab ────────────────────────────────────────────────────────

  private buildDismantleTab(c: Phaser.GameObjects.Container): void {
    const gs = loadGameState();
    const crafted = gs.craftedEquipment ?? [];
    const listStartY = this.buildWorkbenchPanel(c, 'dismantle');

    if (crafted.length === 0) {
      c.add(this.add.text(CANVAS_WIDTH / 2, listStartY + 18, '분해할 장비가 없습니다.\n먼저 장비를 제작하세요.', {
        fontFamily: 'sans-serif', fontSize: '13px', color: '#886633',
        align: 'center', lineSpacing: 6,
      }).setOrigin(0.5, 0));
      return;
    }

    let oy = listStartY;
    const pad = LIST_PAD;
    const rowH = 98;

    crafted.forEach((eq, idx) => {
      const isSelected = this.selectedEqIdx === idx;
      const rarityColor = RARITY_COLORS[eq.rarity] ?? '#aaaaaa';
      const rarityHex = this.rarityHex(eq.rarity);
      const typeMeta = this.getForgeTypeMeta(eq.type);
      const cardNo = String(idx + 1).padStart(3, '0');
      const effectLabels = this.summarizeEquipmentEffects(eq);
      const bp = Object.values(BLUEPRINT_DEFS).find(b => b.resultId === eq.id);
      const returned = getDismantleReturns(bp);
      const returnEntries = Object.entries(returned);
      const returnTotal = returnEntries.reduce((sum, [, qty]) => sum + qty, 0);
      const retStr = returnEntries
        .map(([id, qty]) => {
          const material = this.getMaterialDisplay(id);
          return qty > 0 ? `${material.emoji}×${qty}` : null;
        }).filter(Boolean).join('  ');
      const holder = this.getEquipmentHolderDisplay(gs, eq.id);
      const holderLine = holder
        ? `장착 중 · ${holder.emoji}${this.truncateLabel(holder.name, 5)} Lv.${holder.level}`
        : '보관함 · 안전 회수';

      const bg = this.add.graphics();
      bg.fillStyle(isSelected ? 0x2a1208 : 0x170806, 1);
      bg.fillRoundedRect(pad, oy, CANVAS_WIDTH - pad * 2, rowH - 4, 10);
      bg.fillStyle(0x060302, 0.42);
      bg.fillRoundedRect(pad + 5, oy + 5, CANVAS_WIDTH - pad * 2 - 10, rowH - 14, 8);
      bg.fillStyle(rarityHex, 0.09);
      bg.fillRoundedRect(pad + 6, oy + 7, 58, rowH - 18, 8);
      bg.lineStyle(1.5, isSelected ? 0xffaa44 : 0x7a2f12, isSelected ? 0.96 : 0.78);
      bg.strokeRoundedRect(pad, oy, CANVAS_WIDTH - pad * 2, rowH - 4, 10);
      bg.lineStyle(1, 0xffffff, isSelected ? 0.16 : 0.07);
      bg.lineBetween(pad + 74, oy + 12, pad + 74, oy + rowH - 18);
      c.add(bg);

      const typeBadge = this.add.graphics();
      typeBadge.fillStyle(typeMeta.hex, 0.13);
      typeBadge.fillRoundedRect(pad + 15, oy + 52, 40, 15, 6);
      typeBadge.lineStyle(0.8, typeMeta.hex, 0.42);
      typeBadge.strokeRoundedRect(pad + 15, oy + 52, 40, 15, 6);
      c.add(typeBadge);

      c.add(this.add.text(pad + 35, oy + 12, `EQ.${cardNo}`, {
        fontFamily: 'sans-serif', fontSize: '8px', color: '#927757',
      }).setOrigin(0.5));
      c.add(this.add.text(pad + 35, oy + 30, eq.emoji, {
        fontFamily: 'sans-serif', fontSize: '28px',
      }).setOrigin(0.5));
      c.add(this.add.text(pad + 35, oy + 59, `${typeMeta.icon} ${typeMeta.label}`, {
        fontFamily: 'sans-serif', fontSize: '8px', color: typeMeta.color,
        fontStyle: 'bold',
      }).setOrigin(0.5));
      c.add(this.add.text(pad + 35, oy + 73, this.getForgeRarityStars(eq.rarity), {
        fontFamily: 'sans-serif', fontSize: '8px', color: rarityColor,
      }).setOrigin(0.5));
      c.add(this.add.text(pad + 35, oy + 86, RARITY_NAMES[eq.rarity] ?? '일반', {
        fontFamily: 'sans-serif', fontSize: '8px', color: rarityColor,
      }).setOrigin(0.5));

      c.add(this.add.text(pad + 84, oy + 10, this.truncateLabel(eq.name, 9), {
        fontFamily: 'Georgia, serif', fontSize: '14px', color: rarityColor,
      }));

      const returnChipX = CANVAS_WIDTH - pad - 132;
      const returnChip = this.add.graphics();
      returnChip.fillStyle(returnTotal > 0 ? 0x201006 : 0x100906, 0.96);
      returnChip.fillRoundedRect(returnChipX, oy + 9, 56, 18, 6);
      returnChip.lineStyle(1, returnTotal > 0 ? 0xffaa44 : 0x63402a, 0.6);
      returnChip.strokeRoundedRect(returnChipX, oy + 9, 56, 18, 6);
      c.add(returnChip);
      c.add(this.add.text(returnChipX + 28, oy + 18, returnTotal > 0 ? `회수 +${returnTotal}` : '회수 없음', {
        fontFamily: 'sans-serif',
        fontSize: returnTotal > 0 ? '9px' : '8px',
        color: returnTotal > 0 ? '#ffd08a' : '#8d6c50',
        fontStyle: 'bold',
      }).setOrigin(0.5));

      c.add(this.add.text(pad + 84, oy + 29, holderLine, {
        fontFamily: 'sans-serif',
        fontSize: '10px',
        color: holder ? '#ffb088' : '#9f8a68',
        fontStyle: holder ? 'bold' : 'normal',
      }));
      this.drawEffectChips(c, effectLabels, pad + 84, oy + 45, rarityHex, 166);
      c.add(this.add.text(pad + 84, oy + 70, retStr ? `반환 ${retStr}` : '반환 재료 없음', {
        fontFamily: 'sans-serif',
        fontSize: '10px',
        color: returnTotal > 0 ? '#d6b582' : '#7d5f48',
      }));

      // Dismantle button
      const btnW = 70, btnH = 28;
      const btnX = CANVAS_WIDTH - pad * 2 - btnW + 2;
      const btnY = oy + (rowH - 4 - btnH) / 2;

      const btnBg = this.add.graphics();
      btnBg.fillStyle(0x070503, 0.34);
      btnBg.fillRoundedRect(btnX, btnY + 3, btnW, btnH, 5);
      btnBg.fillStyle(holder ? 0x5a1e0c : 0x4a1800, 1);
      btnBg.fillRoundedRect(btnX, btnY, btnW, btnH, 5);
      btnBg.lineStyle(1, holder ? 0xff7744 : 0xffaa44, 0.58);
      btnBg.strokeRoundedRect(btnX, btnY, btnW, btnH, 5);
      c.add(btnBg);

      c.add(this.add.text(btnX + btnW / 2, btnY + btnH / 2, '분해', {
        fontFamily: 'sans-serif', fontSize: '12px',
        color: holder ? '#ffcfba' : '#ffaa44',
      }).setOrigin(0.5));

      const zone = this.add.zone(btnX + btnW / 2, btnY + btnH / 2, btnW, btnH)
        .setInteractive({ useHandCursor: true });
      zone.on('pointerdown', () => this.confirmDismantle(idx, eq));
      c.add(zone);

      // Row tap for selection
      const rowZoneW = CANVAS_WIDTH - pad * 3 - btnW - 10;
      const rowZone = this.add.zone(pad + rowZoneW / 2, oy + (rowH - 4) / 2, rowZoneW, rowH - 4)
        .setInteractive({ useHandCursor: true });
      rowZone.on('pointerdown', () => {
        this.selectedEqIdx = this.selectedEqIdx === idx ? null : idx;
        this.renderContent();
      });
      c.add(rowZone);

      oy += rowH;
    });
  }

  private confirmCraft(bpId: string): void {
    const gs = loadGameState();
    const bp = BLUEPRINT_DEFS[bpId];
    if (!bp || !canCraftBlueprint(bp, gs.materials ?? {})) return;
    const recommendation = getBlueprintRecommendation(gs, bp, { monsterId: this.focusMonsterId, sourceLabel: this.focusSourceLabel });

    const matStr = Object.entries(bp.materials)
      .map(([id, qty]) => {
        const material = this.getMaterialDisplay(id);
        return `${material.emoji} ${material.name} ×${qty}`;
      }).join('\n');

    const ov = this.add.container(0, 0).setDepth(50);
    const dim = this.add.graphics();
    dim.fillStyle(0x000000, 0.72);
    dim.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    ov.add(dim);

    const pw = 280;
    const materialCount = Object.keys(bp.materials).length;
    const ph = (recommendation ? 280 : 226) + materialCount * 16;
    const cx = CANVAS_WIDTH / 2, cy = CANVAS_HEIGHT / 2;
    const accent = this.rarityHex(bp.rarity);
    const materialY = recommendation ? cy - ph / 2 + 164 : cy - ph / 2 + 112;
    const box = this.add.graphics();
    box.fillStyle(0x1a0800, 1);
    box.fillRoundedRect(cx - pw / 2, cy - ph / 2, pw, ph, 8);
    box.fillStyle(accent, 0.12);
    box.fillRoundedRect(cx - pw / 2 + 12, cy - ph / 2 + 38, pw - 24, 44, 9);
    box.fillStyle(0x060402, 0.34);
    box.fillRoundedRect(cx - pw / 2 + 18, materialY - 8, pw - 36, materialCount * 16 + 36, 8);
    box.lineStyle(2, accent, 0.96);
    box.strokeRoundedRect(cx - pw / 2, cy - ph / 2, pw, ph, 8);
    box.lineStyle(1, 0xffffff, 0.12);
    box.strokeRoundedRect(cx - pw / 2 + 5, cy - ph / 2 + 5, pw - 10, ph - 10, 6);
    ov.add(box);

    ov.add(this.add.text(cx, cy - ph / 2 + 22, '⚒️ 제작 확인', {
      fontFamily: 'Georgia, serif', fontSize: '16px', color: '#ffaa44', fontStyle: 'bold',
    }).setOrigin(0.5));
    ov.add(this.add.text(cx, cy - ph / 2 + 48, `${bp.resultEmoji} ${bp.name}`, {
      fontFamily: 'Georgia, serif', fontSize: '14px', color: RARITY_COLORS[bp.rarity] ?? '#ffaa44',
    }).setOrigin(0.5));
    ov.add(this.add.text(cx, cy - ph / 2 + 68, bp.statDesc, {
      fontFamily: 'sans-serif', fontSize: '10px', color: '#aa8844',
    }).setOrigin(0.5));
    this.drawEffectChips(ov, this.summarizeBlueprintEffects(bp), cx - 92, cy - ph / 2 + 84, accent, 184);

    if (recommendation) {
      this.drawForgeRecommendationPreview(
        ov,
        recommendation,
        cx - 112,
        cy - ph / 2 + 106,
        224,
        48,
        '제작 후 추천 장착',
      );
    }

    ov.add(this.add.text(cx, materialY, `소모 재료:\n${matStr}`, {
      fontFamily: 'sans-serif', fontSize: '11px', color: '#c8b080',
      align: 'center', lineSpacing: 3,
    }).setOrigin(0.5, 0));

    const buttonY = cy + ph / 2 - 42;
    this.addModalButton(ov, cx - 112, buttonY, 96, 30, '취소', 0x7c5633, 'secondary', () => ov.destroy());
    this.addModalButton(ov, cx + 16, buttonY, 96, 30, '제작', accent, 'primary', () => {
      ov.destroy();
      this.executeCraft(bpId);
    });

    ov.setAlpha(0);
    this.tweens.add({ targets: ov, alpha: 1, duration: 180, ease: 'Quad.easeOut' });
  }

  private confirmDismantle(idx: number, eq: CraftedEquipment): void {
    const holder = this.getEquipmentHolderDisplay(loadGameState(), eq.id);
    const bp = Object.values(BLUEPRINT_DEFS).find(b => b.resultId === eq.id);
    const returned = getDismantleReturns(bp);
    const retStr = Object.keys(returned).length > 0
      ? Object.entries(returned)
          .map(([id, qty]) => {
            const material = this.getMaterialDisplay(id);
            return `${material.emoji} ${material.name} ×${qty}`;
          }).join('\n')
      : '없음';

    const ov = this.add.container(0, 0).setDepth(50);

    const dim = this.add.graphics();
    dim.fillStyle(0x000000, 0.72);
    dim.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    ov.add(dim);

    const pw = 280, ph = holder ? 204 : 180;
    const cx = CANVAS_WIDTH / 2, cy = CANVAS_HEIGHT / 2;

    const box = this.add.graphics();
    box.fillStyle(0x1a0800, 1);
    box.fillRoundedRect(cx - pw / 2, cy - ph / 2, pw, ph, 8);
    if (holder) {
      box.fillStyle(0x3a1308, 0.72);
      box.fillRoundedRect(cx - pw / 2 + 18, cy - ph / 2 + 74, pw - 36, 28, 8);
    }
    box.lineStyle(2, 0xcc4400, 0.9);
    box.strokeRoundedRect(cx - pw / 2, cy - ph / 2, pw, ph, 8);
    ov.add(box);

    ov.add(this.add.text(cx, cy - ph / 2 + 22, '장비 분해', {
      fontFamily: 'Georgia, serif', fontSize: '16px', color: '#cc8844', fontStyle: 'bold',
    }).setOrigin(0.5));

    ov.add(this.add.text(cx, holder ? cy - 34 : cy - 20, `${eq.emoji} ${eq.name} 분해?\n재료 반환:\n${retStr}`, {
      fontFamily: 'sans-serif', fontSize: '11px', color: '#c8b090',
      align: 'center', lineSpacing: 4,
    }).setOrigin(0.5));

    if (holder) {
      ov.add(this.add.text(cx, cy + 28, `${holder.emoji} ${holder.name} 장착 중 · 분해 시 장착 해제`, {
        fontFamily: 'sans-serif',
        fontSize: '10px',
        color: '#ffb088',
        align: 'center',
      }).setOrigin(0.5));
    }

    const cancelBtn = this.add.text(cx - 60, cy + ph / 2 - 26, '취소', {
      fontFamily: 'sans-serif', fontSize: '13px', color: '#886633',
      backgroundColor: '#1a0a00', padding: { x: 18, y: 8 },
    }).setOrigin(0.5).setInteractive();
    cancelBtn.on('pointerdown', () => ov.destroy());
    ov.add(cancelBtn);

    const confirmBtn = this.add.text(cx + 60, cy + ph / 2 - 26, '분해', {
      fontFamily: 'sans-serif', fontSize: '13px', color: '#ff4400',
      backgroundColor: '#2a0a00', padding: { x: 18, y: 8 },
    }).setOrigin(0.5).setInteractive();
    confirmBtn.on('pointerdown', () => {
      ov.destroy();
      this.executeDismantle(idx, bp);
    });
    ov.add(confirmBtn);

    ov.setAlpha(0);
    this.tweens.add({ targets: ov, alpha: 1, duration: 180, ease: 'Quad.easeOut' });
  }

  private executeDismantle(idx: number, bp: BlueprintDef | undefined): void {
    const gs = loadGameState();
    const result = applyDismantleCraftedEquipment(gs, idx, bp);
    if (!result.ok) return;
    saveGameState(result.state);

    Object.entries(result.returnedMaterials).forEach(([id, qty]) => {
      logger.debug(`[FORGE] dismantle return ${id}: +${qty}`);
    });
    logger.debug(`[FORGE] ${result.equipment.id} dismantled`);

    this.selectedEqIdx = null;
    this.drawHeader();
    this.renderContent();

    const parts = Object.entries(result.returnedMaterials)
      .map(([id, qty]) => `${this.getMaterialDisplay(id).emoji}×${qty}`);
    const matStr = parts.length > 0 ? parts.join('  ') : '';
    this.showToast(`✅ 분해 완료!  ${matStr}`, '#88ff88');
  }

  private showToast(msg: string, color = '#ffcc44'): void {
    const t = this.add.text(CANVAS_WIDTH / 2, CANVAS_HEIGHT - 100, msg, {
      fontFamily: 'sans-serif', fontSize: '13px', color,
      backgroundColor: '#1a1200', padding: { x: 12, y: 6 },
    }).setOrigin(0.5).setDepth(200).setAlpha(0);

    this.tweens.add({
      targets: t, alpha: 1, y: CANVAS_HEIGHT - 120,
      duration: 200, ease: 'Power2.easeOut',
      onComplete: () => {
        this.tweens.add({
          targets: t, alpha: 0, y: CANVAS_HEIGHT - 140,
          duration: 300, delay: 1500,
          onComplete: () => t.destroy(),
        });
      },
    });
  }
}
