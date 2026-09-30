import Phaser from 'phaser';
import { ABYSS_RETURN_SCENE_KEY } from '../data/abyssBattle';
import { CANVAS_WIDTH, CANVAS_HEIGHT, ROOT_NAV_HEIGHT } from '../constants/layout';
import { DUNGEON_UI, DUNGEON_UI_CSS, ZONE_ACCENTS } from '../constants/colors';
import {
  getBlueprintRecommendation, getMonsterDefForOwned,
} from '../data/forgeRecommendations';
import {
  loadGameState,
  saveGameState,
  type GameState,
} from '../data/wisdom';
import {
  BLUEPRINT_DEFS, forgeRarityCss,
  type BlueprintDef,
} from '../data/fusion';
import {
  applyCraftBlueprint,
  applyDismantleCraftedEquipment,
  canCraftBlueprint,
  getDismantleReturns,
  type CraftedEquipment,
} from '../data/forgeTransactions';
import { equipMonsterEquipment } from '../data/barracksTransactions';
import { calculateRoomMetrics } from '../data/dungeonMetrics';
import { logger } from '../utils/logger';
import {
  HEADER_H, TAB_H, CONTENT_Y,
  type ForgeTab,
  rarityHex,
  getMaterialDisplay,
  getFocusMonsterName,
  getFocusMonsterDisplay,
  getEquipmentHolderDisplay,
  summarizeBlueprintEffects,
  type ForgeContext,
  type RoomEquipmentFeedback,
  blueprintEffectText,
} from '../ui/ForgeShared';
import { drawEffectChips, drawForgeRecommendationPreview } from '../ui/ForgeWorkbench';
import { buildCraftTab, buildDismantleTab } from '../ui/ForgeTabs';
import { buildTrapTab } from '../ui/ForgeTrapTab';
import { craftTrap, enhanceTrap } from '../data/trapTransactions';
import { getTrapDef } from '../data/traps';
import { showCraftAnimation, addModalButton } from '../ui/ForgeCraftFx';
import { createForgeFocusContext, getContextualBackTarget, getZoneDestination } from '../data/navigationContract';
import { getReducedMotion } from '../utils/reducedMotion';
import { findAssignedRoom } from '../data/reinforcementRecommendations';
import { buildHomeZoneNavigation, buildZoneBackButton } from '../ui/GameZoneNavigation';
import {
  drawDismantleSigil,
  drawEquipmentSigil,
  drawForgeCrest,
  drawSupplySigil,
} from '../ui/ForgeSkin';

// ─── Scene ────────────────────────────────────────────────────────────────────
// 제작소 씬. 렌더(워크벤치/탭/카드)·연출(FX)·순수 헬퍼는 ForgeShared/ForgeWorkbench/
// ForgeTabs/ForgeCraftFx로 분리. 씬은 라이프사이클·헤더·탭바·트랜잭션 오케스트레이션
// (제작/분해 확인·실행)·방 복귀 피드백만 보유한다.

export class ForgeScene extends Phaser.Scene {
  private activeTab: ForgeTab = 'craft';
  private contentContainer?: Phaser.GameObjects.Container;
  private tabContainer?: Phaser.GameObjects.Container;
  private headerContainer?: Phaser.GameObjects.Container;
  private selectedBpId: string | null = null;
  private selectedEqIdx: number | null = null;
  private craftPage = 0;
  private dismantlePage = 0;
  private trapPage = 0;
  private returnScene = 'DungeonHomeScene';
  private focusMonsterId: string | null = null;
  private focusSourceLabel: string | null = null;
  private focusRoomSlotIdx: number | null = null;

  constructor() { super({ key: 'ForgeScene' }); }

  // ─── Lifecycle ────────────────────────────────────────────────────────────

  create(): void {
    this.activeTab    = this.consumeRequestedTab();
    this.selectedBpId = null;
    this.selectedEqIdx = null;
    this.craftPage = 0;
    this.dismantlePage = 0;
    this.trapPage = 0;
    this.returnScene = this.consumeReturnScene();
    this.focusMonsterId = this.peekFocusMonsterId();
    this.focusSourceLabel = this.peekFocusSourceLabel();
    this.focusRoomSlotIdx = this.peekFocusRoomSlotIdx();
    this.refreshFocusContext(loadGameState(), this.focusMonsterId);

    this.drawBackground();
    this.drawHeader();
    this.drawTabBar();
    this.renderContent();
    this.buildRootNavigation();

    if (!getReducedMotion()) this.cameras.main.fadeIn(220, 0, 0, 0);
  }

  // ─── Background ──────────────────────────────────────────────────────────

  private drawBackground(): void {
    const g = this.add.graphics().setDepth(-10);
    g.fillStyle(DUNGEON_UI.VOID, 1);
    g.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    g.fillStyle(DUNGEON_UI.SOOT, 1);
    g.fillRect(0, 0, CANVAS_WIDTH, CONTENT_Y);
    g.fillStyle(DUNGEON_UI.STONE, 0.98);
    g.fillRect(0, CONTENT_Y, CANVAS_WIDTH, CANVAS_HEIGHT - CONTENT_Y - ROOT_NAV_HEIGHT);

    g.lineStyle(1, DUNGEON_UI.IRON, 0.34);
    for (let y = CONTENT_Y + 22; y < CANVAS_HEIGHT - ROOT_NAV_HEIGHT; y += 58) {
      g.lineBetween(0, y, CANVAS_WIDTH, y);
      const offset = Math.floor((y - CONTENT_Y) / 58) % 2 === 0 ? 32 : 78;
      for (let x = offset; x < CANVAS_WIDTH; x += 94) g.lineBetween(x, y - 58, x, y);
    }

    g.fillStyle(ZONE_ACCENTS.forge, 0.08);
    g.fillCircle(18, CONTENT_Y + 108, 92);
    g.fillCircle(CANVAS_WIDTH - 16, CONTENT_Y + 108, 92);

    const trayX = 10;
    const trayY = CONTENT_Y + 6;
    const trayW = CANVAS_WIDTH - 20;
    const trayH = CANVAS_HEIGHT - CONTENT_Y - ROOT_NAV_HEIGHT - 14;
    g.fillStyle(DUNGEON_UI.VOID, 0.5);
    g.fillRoundedRect(trayX, trayY + 4, trayW, trayH, 10);
    g.fillStyle(DUNGEON_UI.SOOT, 0.9);
    g.fillRoundedRect(trayX, trayY, trayW, trayH, 10);
    g.lineStyle(1.5, DUNGEON_UI.IRON, 0.9);
    g.strokeRoundedRect(trayX, trayY, trayW, trayH, 10);
  }

  // ─── Header ──────────────────────────────────────────────────────────────

  private drawHeader(): void {
    this.headerContainer?.destroy();
    const c = this.add.container(0, 0).setDepth(10);
    this.headerContainer = c;

    const g = this.add.graphics();
    g.fillStyle(DUNGEON_UI.SOOT, 1);
    g.fillRect(0, 0, CANVAS_WIDTH, HEADER_H);
    g.fillStyle(DUNGEON_UI.STONE_RAISED, 0.72);
    g.fillRect(0, 54, CANVAS_WIDTH, HEADER_H - 54);
    g.fillStyle(DUNGEON_UI.BRASS, 0.72);
    g.fillRect(0, HEADER_H - 3, CANVAS_WIDTH, 3);
    g.lineStyle(1, DUNGEON_UI.IRON, 0.62);
    g.lineBetween(0, 54, CANVAS_WIDTH, 54);
    c.add(g);

    c.add(this.add.text(CANVAS_WIDTH / 2, 21, '심층 단조 공방', {
      fontFamily: 'sans-serif', fontSize: '18px', fontStyle: 'bold',
      color: DUNGEON_UI_CSS.PARCHMENT,
    }).setOrigin(0.5));
    const gs = loadGameState();
    const focusName = getFocusMonsterName(gs, this.focusMonsterId);
    const headerSub = focusName
      ? `${this.focusSourceLabel ?? '선택 수호자'} · ${focusName} 장비 보강`
      : '방어선 장비 제작 · 즉시 장착';
    c.add(this.add.text(CANVAS_WIDTH / 2, 43, headerSub, {
      fontFamily: 'sans-serif', fontSize: '10px', fontStyle: 'bold',
      color: focusName ? DUNGEON_UI_CSS.JADE : DUNGEON_UI_CSS.MUTED,
    }).setOrigin(0.5));

    buildZoneBackButton(this, {
      label: this.returnScene === 'BarracksScene' ? '← 군단' : this.returnScene === 'AbyssScene' ? '← 심연' : '← 던전',
      width: 86,
      fillColor: DUNGEON_UI.STONE,
      borderColor: DUNGEON_UI.IRON,
      textColor: DUNGEON_UI_CSS.TEXT,
      onBack: () => {
        const target = this.returnScene || getContextualBackTarget('ForgeScene');
        if (getReducedMotion()) {
          this.scene.start(target);
          return;
        }
        this.cameras.main.fadeOut(200, 0, 0, 0);
        this.cameras.main.once('camerafadeoutcomplete', () => {
          this.scene.start(target);
        });
      },
    });

    if (this.focusRoomSlotIdx === null) {
      this.buildHeaderAction(c, CANVAS_WIDTH - 96, '심연 수급', 'supply', DUNGEON_UI.BRASS, () => this.openAbyss());
    }

    if (this.focusRoomSlotIdx !== null) {
      this.buildHeaderAction(c, CANVAS_WIDTH - 96, '방 복귀', 'return', DUNGEON_UI.JADE, () => {
        this.returnToFocusedRoom();
      });
    }

    const materialEntries = Object.values(gs.materials ?? {}).filter(qty => qty > 0);
    const materialTotal = materialEntries.reduce((sum, qty) => sum + qty, 0);
    const stones = gs.awakeningStones ?? 0;
    const resourceLabel = this.focusRoomSlotIdx !== null
      ? `방 #${this.focusRoomSlotIdx + 1} 보강 명령`
      : `재료 ${materialTotal} · 종류 ${materialEntries.length} · 각성석 ${stones}`;
    const resourceX = CANVAS_WIDTH / 2 - 78;
    const resourceY = 59;
    const resourceW = 156;
    const resourceBg = this.add.graphics();
    resourceBg.fillStyle(DUNGEON_UI.VOID, 0.96);
    resourceBg.fillRoundedRect(resourceX, resourceY, resourceW, 21, 5);
    resourceBg.lineStyle(1, this.focusRoomSlotIdx !== null ? DUNGEON_UI.JADE : DUNGEON_UI.BRASS, 0.58);
    resourceBg.strokeRoundedRect(resourceX, resourceY, resourceW, 21, 5);
    drawForgeCrest(
      resourceBg,
      resourceX + 15,
      resourceY + 9,
      this.focusRoomSlotIdx !== null ? DUNGEON_UI.JADE : DUNGEON_UI.BRASS_BRIGHT,
      0.9,
      0.46,
    );
    c.add(resourceBg);
    c.add(this.add.text(resourceX + 29, resourceY + 10.5, resourceLabel, {
      fontFamily: 'sans-serif', fontSize: '10px', fontStyle: 'bold', color: DUNGEON_UI_CSS.TEXT,
    }).setOrigin(0, 0.5));
  }

  private buildHeaderAction(
    c: Phaser.GameObjects.Container,
    x: number,
    label: string,
    kind: 'supply' | 'return',
    accent: number,
    cb: () => void,
  ): void {
    const y = 8;
    const w = 86;
    const h = 44;
    const g = this.add.graphics();
    g.fillStyle(DUNGEON_UI.VOID, 0.52);
    g.fillRoundedRect(x, y + 3, w, h, 10);
    g.fillStyle(DUNGEON_UI.STONE, 1);
    g.fillRoundedRect(x, y, w, h, 10);
    g.fillStyle(accent, 0.12);
    g.fillRoundedRect(x + 5, y + 5, 28, h - 10, 7);
    g.lineStyle(1.5, accent, 0.72);
    g.strokeRoundedRect(x, y, w, h, 10);
    if (kind === 'supply') drawSupplySigil(g, x + 19, y + 22, accent, 0.92, 0.62);
    else {
      g.lineStyle(2.2, accent, 0.92);
      g.lineBetween(x + 25, y + 15, x + 14, y + 22);
      g.lineBetween(x + 14, y + 22, x + 25, y + 29);
    }
    c.add(g);
    c.add(this.add.text(x + 58, y + h / 2, label, {
      fontFamily: 'sans-serif', fontSize: '10px', color: DUNGEON_UI_CSS.TEXT, fontStyle: 'bold',
    }).setOrigin(0.5));
    const zone = this.add.zone(x, y, w, h).setOrigin(0)
      .setInteractive({ useHandCursor: true });
    zone.on('pointerdown', cb);
    c.add(zone);
  }

  /** A caller (the placement tray's empty-stock trap chip) may ask for a tab up front. */
  private consumeRequestedTab(): ForgeTab {
    const tab = this.registry.get('forgeTab');
    this.registry.remove('forgeTab');
    return tab === 'trap' || tab === 'dismantle' ? tab : 'craft';
  }

  /** 원정실 '← 뒤로'가 공방으로 돌아오게 한다. */
  private openAbyss(): void {
    this.registry.set(ABYSS_RETURN_SCENE_KEY, 'ForgeScene');
    this.scene.start('AbyssScene');
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
    else this.registry.remove('focusMonsterId');
    if (this.focusSourceLabel) this.registry.set('focusSourceLabel', this.focusSourceLabel);
    else this.registry.remove('focusSourceLabel');
    if (this.focusRoomSlotIdx !== null) this.registry.set('focusRoomSlotIdx', this.focusRoomSlotIdx);
    else this.registry.remove('focusRoomSlotIdx');
  }

  /** Recompute return context from the target's current, actual room assignment. */
  private refreshFocusContext(gs: GameState, monsterId: string | null): number | null {
    const assignedRoom = monsterId ? findAssignedRoom(gs, monsterId) : null;
    const next = createForgeFocusContext(monsterId, assignedRoom?.index ?? null);
    this.focusMonsterId = next.monsterId;
    this.focusSourceLabel = next.sourceLabel;
    this.focusRoomSlotIdx = next.roomSlotIdx;
    this.preserveFocusContext();
    return next.roomSlotIdx;
  }

  private returnToFocusedRoom(): void {
    this.refreshFocusContext(loadGameState(), this.focusMonsterId);
    if (this.focusRoomSlotIdx === null) {
      this.scene.start('DungeonHomeScene');
      return;
    }
    this.preserveFocusContext();
    this.scene.start('DungeonHomeScene');
  }

  private registerRoomEquipmentFeedback(
    beforeGs: GameState,
    afterGs: GameState,
    monsterId: string,
    bp: BlueprintDef,
    roomSlotIdx: number,
  ): void {
    const target = getFocusMonsterDisplay(afterGs, monsterId);
    const sourceLabel = `방 #${roomSlotIdx + 1} 수호자`;
    const beforeSlot = beforeGs.dungeonSlots?.[roomSlotIdx];
    const afterSlot = afterGs.dungeonSlots?.[roomSlotIdx];
    const beforePower = beforeSlot ? calculateRoomMetrics(beforeGs, beforeSlot).threatScore : null;
    const afterPower = afterSlot ? calculateRoomMetrics(afterGs, afterSlot).threatScore : null;
    const feedback: RoomEquipmentFeedback = {
      kind: 'equipment',
      slotIdx: roomSlotIdx,
      monsterId,
      sourceLabel,
      title: '장비 장착 완료',
      body: `${target?.name ?? '수호자'}에게 ${bp.name} 장착`,
      equipmentName: bp.name,
      equipmentEmoji: bp.resultEmoji,
      statLabel: beforePower !== null && afterPower !== null ? '전력' : undefined,
      statBefore: beforePower !== null && afterPower !== null ? String(beforePower) : undefined,
      statAfter: beforePower !== null && afterPower !== null ? String(afterPower) : undefined,
      accent: rarityHex(bp.rarity),
    };
    this.registry.set('homeRoomFeedback', feedback);
    this.registry.set('roomDetailFeedback', feedback);
  }

  // ─── Tab bar ─────────────────────────────────────────────────────────────

  private drawTabBar(): void {
    this.tabContainer?.destroy();
    const c = this.add.container(0, HEADER_H).setDepth(10);
    this.tabContainer = c;
    const tabs: Array<{ id: ForgeTab; label: string; accent: number }> = [
      { id: 'craft', label: '제작', accent: ZONE_ACCENTS.forge },
      { id: 'trap', label: '함정', accent: DUNGEON_UI.JADE },
      { id: 'dismantle', label: '분해', accent: DUNGEON_UI.EMBER },
    ];
    const tabW = CANVAS_WIDTH / tabs.length;
    tabs.forEach((tab, index) => {
      const active = this.activeTab === tab.id;
      const x = tabW * index;
      const bg = this.add.graphics();
      bg.fillStyle(active ? DUNGEON_UI.STONE_RAISED : DUNGEON_UI.SOOT, 1);
      bg.fillRect(x, 0, tabW, TAB_H);
      bg.fillStyle(tab.accent, active ? 0.12 : 0.03);
      bg.fillRect(x, 0, tabW, TAB_H);
      bg.lineStyle(1, DUNGEON_UI.IRON, 0.7);
      bg.strokeRect(x, 0, tabW, TAB_H);
      if (active) {
        bg.fillStyle(tab.accent, 1);
        bg.fillRect(x + 10, TAB_H - 4, tabW - 20, 4);
      }
      if (tab.id === 'craft') drawForgeCrest(bg, x + tabW / 2 - 28, 21, tab.accent, active ? 1 : 0.48, 0.55);
      else if (tab.id === 'trap') drawSupplySigil(bg, x + tabW / 2 - 28, 21, tab.accent, active ? 1 : 0.48, 0.55);
      else drawDismantleSigil(bg, x + tabW / 2 - 28, 21, tab.accent, active ? 1 : 0.48, 0.55);
      c.add(bg);
      c.add(this.add.text(x + tabW / 2 + 9, TAB_H / 2, tab.label, {
        fontFamily: 'sans-serif', fontSize: '12px', fontStyle: 'bold',
        color: active ? DUNGEON_UI_CSS.PARCHMENT : DUNGEON_UI_CSS.MUTED,
      }).setOrigin(0.5));
      const zone = this.add.zone(x, 0, tabW, TAB_H).setOrigin(0)
        .setInteractive({ useHandCursor: true });
      zone.on('pointerdown', () => {
        this.activeTab = tab.id;
        this.selectedBpId = null;
        this.selectedEqIdx = null;
        this.drawTabBar();
        this.renderContent();
      });
      c.add(zone);
    });
  }

  private buildRootNavigation(): void {
    buildHomeZoneNavigation(this, 'forge', (zone) => {
      this.scene.start(getZoneDestination(zone));
    });
  }

  // ─── Content dispatch ────────────────────────────────────────────────────

  /** Build the read-only context + action callbacks passed to render modules. */
  private buildCtx(gs: GameState): ForgeContext {
    return {
      gs,
      activeTab:        this.activeTab,
      page:             this.activeTab === 'craft' ? this.craftPage : this.activeTab === 'trap' ? this.trapPage : this.dismantlePage,
      focusMonsterId:   this.focusMonsterId,
      focusSourceLabel: this.focusSourceLabel,
      selectedBpId:     this.selectedBpId,
      selectedEqIdx:    this.selectedEqIdx,
      onFocusChange: (monsterId) => {
        this.refreshFocusContext(loadGameState(), monsterId);
        this.drawHeader();
        this.renderContent();
      },
      onSelectBlueprint: (bpId) => {
        this.selectedBpId = this.selectedBpId === bpId ? null : bpId;
        this.renderContent();
      },
      onSelectEquipment: (idx) => {
        this.selectedEqIdx = this.selectedEqIdx === idx ? null : idx;
        this.renderContent();
      },
      onOpenAbyss:        ()             => this.openAbyss(),
      onPageChange: (page) => {
        if (this.activeTab === 'craft') this.craftPage = Math.max(0, page);
        else if (this.activeTab === 'trap') this.trapPage = Math.max(0, page);
        else this.dismantlePage = Math.max(0, page);
        this.selectedBpId = null;
        this.selectedEqIdx = null;
        this.renderContent();
      },
      onConfirmCraft:     (bpId)     => this.confirmCraft(bpId),
      onConfirmDismantle: (idx, eq)  => this.confirmDismantle(idx, eq),
      onCraftTrap:        (trapId)   => this.executeCraftTrap(trapId),
      onEnhanceTrap:      (trapId)   => this.executeEnhanceTrap(trapId),
    };
  }

  private renderContent(): void {
    this.contentContainer?.destroy();
    const c = this.add.container(0, CONTENT_Y).setDepth(5);
    this.contentContainer = c;

    const ctx = this.buildCtx(loadGameState());
    if (this.activeTab === 'craft')     buildCraftTab(this, ctx, c);
    else if (this.activeTab === 'trap') buildTrapTab(this, ctx, c);
    else                                buildDismantleTab(this, ctx, c);
  }

  // ─── Trap craft / enhance ──────────────────────────────────────────────────
  // Traps are cheap and repeatable, so both actions commit on tap with a toast;
  // the row already shows the exact cost before the tap.

  private executeCraftTrap(trapId: string): void {
    const result = craftTrap(loadGameState(), trapId);
    if (!result.ok) { this.showToast('제작할 수 없습니다', DUNGEON_UI_CSS.EMBER); return; }
    saveGameState(result.state);
    const fused = Object.keys(result.consumedTraps).length > 0;
    logger.debug(`[FORGE] trap ${trapId} ${fused ? 'fused' : 'crafted'} → stock ${result.state.trapStock[trapId]}`);
    this.showToast(`${result.trap.emoji} ${result.trap.name} ${fused ? '융합' : '제작'} 완료 · 재고 ${result.state.trapStock[trapId]}`, DUNGEON_UI_CSS.JADE);
    this.drawHeader();
    this.renderContent();
  }

  private executeEnhanceTrap(trapId: string): void {
    const result = enhanceTrap(loadGameState(), trapId);
    if (!result.ok) { this.showToast('강화할 수 없습니다', DUNGEON_UI_CSS.EMBER); return; }
    saveGameState(result.state);
    const level = result.state.trapMastery[trapId];
    logger.debug(`[FORGE] trap ${trapId} mastery → ${level}`);
    this.showToast(`${getTrapDef(trapId)?.name ?? trapId} 숙련 +${level}`, DUNGEON_UI_CSS.BRASS);
    this.drawHeader();
    this.renderContent();
  }

  // ─── Craft execution ───────────────────────────────────────────────────────

  private executeCraft(bpId: string): void {
    const gs = loadGameState();
    const bp = BLUEPRINT_DEFS[bpId];
    if (!bp) return;
    const result = applyCraftBlueprint(gs, bp);
    if (!result.ok) return;

    const matEntries = Object.entries(result.consumedMaterials);

    matEntries.forEach(([id, qty], i) => {
      const name = getMaterialDisplay(id).name;
      const spacing = matEntries.length > 1 ? 270 / (matEntries.length - 1) : 0;
      const baseX = matEntries.length > 1 ? 60 + i * spacing : CANVAS_WIDTH / 2;
      const floatT = this.add.text(baseX, 120, `-${qty} ${name}`, {
        fontFamily: 'sans-serif', fontSize: '10px', fontStyle: 'bold',
        color: DUNGEON_UI_CSS.EMBER, stroke: '#000000', strokeThickness: 3,
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

    showCraftAnimation(this, bp, {
      focusMonsterId: this.focusMonsterId,
      onRefresh: () => {
        this.drawHeader();
        this.renderContent();
      },
      onEquip: (targetMonsterId) => this.equipFromForge(targetMonsterId, bp),
    });
  }

  /** Equip the freshly crafted item; returns success. Handles room-return nav vs. in-place toast. */
  private equipFromForge(targetMonsterId: string, bp: BlueprintDef): boolean {
    const beforeState = loadGameState();
    const shouldReturnToFocusedRoom = this.focusMonsterId !== null;
    const result = equipMonsterEquipment(beforeState, targetMonsterId, bp.resultId);
    if (!result.ok) {
      this.showToast('장착 실패', DUNGEON_UI_CSS.EMBER);
      return false;
    }
    saveGameState(result.state);
    const afterState = loadGameState();
    if (shouldReturnToFocusedRoom) {
      const roomSlotIdx = this.refreshFocusContext(afterState, targetMonsterId);
      if (roomSlotIdx !== null) {
        this.registerRoomEquipmentFeedback(beforeState, afterState, targetMonsterId, bp, roomSlotIdx);
      }
      this.scene.start(this.returnScene);
      return true;
    }
    this.drawHeader();
    this.renderContent();
    const name = getMonsterDefForOwned(targetMonsterId)?.name ?? '수호자';
    this.showToast(`${name} 장착 완료`, DUNGEON_UI_CSS.JADE);
    return true;
  }

  // ─── Craft confirm modal ───────────────────────────────────────────────────

  private confirmCraft(bpId: string): void {
    const gs = loadGameState();
    const bp = BLUEPRINT_DEFS[bpId];
    if (!bp || !canCraftBlueprint(bp, gs.materials ?? {})) return;
    const recommendation = getBlueprintRecommendation(gs, bp, { monsterId: this.focusMonsterId, sourceLabel: this.focusSourceLabel });

    const matStr = Object.entries(bp.materials).map(([id, qty]) => {
      const material = getMaterialDisplay(id);
      const before = gs.materials?.[id] ?? 0;
      return `${material.name}  ${before}→${Math.max(0, before - qty)} · 소모 ${qty}`;
    }).join('\n');

    const ov = this.add.container(0, 0).setDepth(50);
    const dim = this.add.graphics();
    dim.fillStyle(0x000000, 0.72);
    dim.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    ov.add(dim);

    const pw = 310;
    const materialCount = Object.keys(bp.materials).length;
    const ph = recommendation ? 380 : 300;
    const cx = CANVAS_WIDTH / 2, cy = CANVAS_HEIGHT / 2;
    const accent = rarityHex(bp.rarity);
    const top = cy - ph / 2;
    const materialY = top + (recommendation ? 218 : 148);
    const materialH = 32 + materialCount * 16;
    const box = this.add.graphics();
    box.fillStyle(DUNGEON_UI.STONE, 1);
    box.fillRoundedRect(cx - pw / 2, top, pw, ph, 10);
    box.fillStyle(accent, 0.12);
    box.fillRoundedRect(cx - pw / 2 + 12, top + 42, pw - 24, 98, 8);
    box.fillStyle(DUNGEON_UI.VOID, 0.76);
    box.fillRoundedRect(cx - pw / 2 + 18, materialY, pw - 36, materialH, 7);
    box.lineStyle(2, DUNGEON_UI.IRON, 1);
    box.strokeRoundedRect(cx - pw / 2, top, pw, ph, 10);
    box.fillStyle(accent, 1);
    box.fillRect(cx - pw / 2 + 1, top + 1, 3, ph - 2);
    ov.add(box);

    const itemSigil = this.add.graphics();
    itemSigil.fillStyle(accent, 0.1);
    itemSigil.fillCircle(cx - pw / 2 + 48, top + 78, 25);
    itemSigil.lineStyle(1.4, accent, 0.72);
    itemSigil.strokeCircle(cx - pw / 2 + 48, top + 78, 25);
    drawEquipmentSigil(itemSigil, cx - pw / 2 + 48, top + 78, bp.type, accent, 0.96, 1);
    ov.add(itemSigil);

    ov.add(this.add.text(cx, top + 23, '제작 명령 확인', {
      fontFamily: 'sans-serif', fontSize: '16px', color: DUNGEON_UI_CSS.BRASS, fontStyle: 'bold',
    }).setOrigin(0.5));
    ov.add(this.add.text(cx - pw / 2 + 82, top + 58, bp.name, {
      fontFamily: 'sans-serif', fontSize: '14px', color: forgeRarityCss(bp.rarity),
      fontStyle: 'bold',
    }));
    ov.add(this.add.text(cx - pw / 2 + 82, top + 80, blueprintEffectText(bp), {
      fontFamily: 'sans-serif', fontSize: '10px', color: DUNGEON_UI_CSS.TEXT,
      wordWrap: { width: 190, useAdvancedWrap: true },
    }));
    drawEffectChips(this, ov, summarizeBlueprintEffects(bp), cx - 137, top + 114, accent, 274);

    if (recommendation) {
      drawForgeRecommendationPreview(
        this,
        ov,
        recommendation,
        cx - 137,
        top + 148,
        274,
        58,
        '제작 후 추천 장착',
      );
    }

    ov.add(this.add.text(cx - pw / 2 + 28, materialY + 11, `소모 재료\n${matStr}`, {
      fontFamily: 'sans-serif', fontSize: '10px', color: DUNGEON_UI_CSS.TEXT,
      lineSpacing: 5,
    }));

    const buttonY = top + ph - 54;
    addModalButton(this, ov, cx - 137, buttonY, 126, 44, '취소', DUNGEON_UI.IRON, 'secondary', () => ov.destroy());
    addModalButton(this, ov, cx + 11, buttonY, 126, 44, '단조 시작', accent, 'primary', () => {
      ov.destroy();
      this.executeCraft(bpId);
    });

    ov.setAlpha(0);
    this.tweens.add({ targets: ov, alpha: 1, duration: 180, ease: 'Quad.easeOut' });
  }

  // ─── Dismantle confirm + execution ──────────────────────────────────────────

  private confirmDismantle(idx: number, eq: CraftedEquipment): void {
    const holder = getEquipmentHolderDisplay(loadGameState(), eq.id);
    const bp = Object.values(BLUEPRINT_DEFS).find(b => b.resultId === eq.id);
    const returned = getDismantleReturns(bp);
    const retStr = Object.keys(returned).length > 0
      ? Object.entries(returned).map(([id, qty]) => `${getMaterialDisplay(id).name} +${qty}`).join('\n')
      : '반환 재료 없음';

    const ov = this.add.container(0, 0).setDepth(50);

    const dim = this.add.graphics();
    dim.fillStyle(0x000000, 0.72);
    dim.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    ov.add(dim);

    const pw = 310, ph = holder ? 292 : 256;
    const cx = CANVAS_WIDTH / 2, cy = CANVAS_HEIGHT / 2;
    const top = cy - ph / 2;
    const accent = rarityHex(eq.rarity);

    const box = this.add.graphics();
    box.fillStyle(DUNGEON_UI.STONE, 1);
    box.fillRoundedRect(cx - pw / 2, top, pw, ph, 10);
    box.fillStyle(accent, 0.1);
    box.fillRoundedRect(cx - pw / 2 + 12, top + 42, pw - 24, 68, 8);
    box.fillStyle(DUNGEON_UI.VOID, 0.74);
    box.fillRoundedRect(cx - pw / 2 + 22, top + 126, pw - 44, 58, 7);
    if (holder) {
      box.fillStyle(DUNGEON_UI.EMBER, 0.12);
      box.fillRoundedRect(cx - pw / 2 + 22, top + 194, pw - 44, 36, 7);
    }
    box.lineStyle(2, DUNGEON_UI.EMBER, 0.86);
    box.strokeRoundedRect(cx - pw / 2, top, pw, ph, 10);
    box.fillStyle(DUNGEON_UI.EMBER, 1);
    box.fillRect(cx - pw / 2 + 1, top + 1, 3, ph - 2);
    ov.add(box);

    const eqSigil = this.add.graphics();
    eqSigil.fillStyle(accent, 0.1);
    eqSigil.fillCircle(cx - pw / 2 + 49, top + 76, 24);
    eqSigil.lineStyle(1.3, accent, 0.68);
    eqSigil.strokeCircle(cx - pw / 2 + 49, top + 76, 24);
    drawEquipmentSigil(eqSigil, cx - pw / 2 + 49, top + 76, eq.type, accent, 0.94, 1);
    ov.add(eqSigil);

    ov.add(this.add.text(cx, top + 23, '분해 명령 확인', {
      fontFamily: 'sans-serif', fontSize: '16px', color: DUNGEON_UI_CSS.EMBER, fontStyle: 'bold',
    }).setOrigin(0.5));
    ov.add(this.add.text(cx - pw / 2 + 84, top + 58, eq.name, {
      fontFamily: 'sans-serif', fontSize: '14px', fontStyle: 'bold', color: forgeRarityCss(eq.rarity),
    }));
    ov.add(this.add.text(cx - pw / 2 + 84, top + 82, '이 장비를 재료로 되돌립니다.', {
      fontFamily: 'sans-serif', fontSize: '10px', color: DUNGEON_UI_CSS.TEXT,
    }));
    ov.add(this.add.text(cx - pw / 2 + 32, top + 138, `예상 반환\n${retStr}`, {
      fontFamily: 'sans-serif', fontSize: '10px', color: DUNGEON_UI_CSS.BRASS, lineSpacing: 5,
    }));

    if (holder) {
      ov.add(this.add.text(cx, top + 212, `${holder.name} Lv.${holder.level} 장착 중 · 분해 시 자동 해제`, {
        fontFamily: 'sans-serif',
        fontSize: '10px',
        color: DUNGEON_UI_CSS.EMBER,
        fontStyle: 'bold',
        align: 'center',
      }).setOrigin(0.5));
    }

    const buttonY = top + ph - 54;
    addModalButton(this, ov, cx - 137, buttonY, 126, 44, '취소', DUNGEON_UI.IRON, 'secondary', () => ov.destroy());
    addModalButton(this, ov, cx + 11, buttonY, 126, 44, '분해 실행', DUNGEON_UI.EMBER, 'primary', () => {
      ov.destroy();
      this.executeDismantle(idx, bp);
    });

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
      .map(([id, qty]) => `${getMaterialDisplay(id).name} +${qty}`);
    const matStr = parts.length > 0 ? ` · ${parts.join(' · ')}` : '';
    this.showToast(`분해 완료${matStr}`, DUNGEON_UI_CSS.JADE);
  }

  private showToast(msg: string, color: string = DUNGEON_UI_CSS.BRASS): void {
    const t = this.add.text(CANVAS_WIDTH / 2, CANVAS_HEIGHT - 100, msg, {
      fontFamily: 'sans-serif', fontSize: '13px', color,
      backgroundColor: '#080b09', padding: { x: 14, y: 8 },
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
