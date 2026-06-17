import Phaser from 'phaser';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../constants/layout';
import { ZONE_ACCENTS, CASUAL, CASUAL_CSS } from '../constants/colors';
import { applyCasualBackground } from '../ui/AmbientBackground';
import {
  getBlueprintRecommendation, getMonsterDefForOwned,
} from '../data/forgeRecommendations';
import { addTabBar } from '../ui/GameUiPrimitives';
import {
  loadGameState,
  saveGameState,
  type GameState,
} from '../data/wisdom';
import {
  BLUEPRINT_DEFS, RARITY_COLORS,
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
  rarityHex,
  getMaterialDisplay,
  getFocusMonsterName,
  getFocusMonsterDisplay,
  getEquipmentHolderDisplay,
  summarizeBlueprintEffects,
  type ForgeContext,
  type RoomEquipmentFeedback,
} from '../ui/ForgeShared';
import { drawEffectChips, drawForgeRecommendationPreview } from '../ui/ForgeWorkbench';
import { buildCraftTab, buildDismantleTab } from '../ui/ForgeTabs';
import { showCraftAnimation, addModalButton } from '../ui/ForgeCraftFx';

// ─── Scene ────────────────────────────────────────────────────────────────────
// 제작소 씬. 렌더(워크벤치/탭/카드)·연출(FX)·순수 헬퍼는 ForgeShared/ForgeWorkbench/
// ForgeTabs/ForgeCraftFx로 분리. 씬은 라이프사이클·헤더·탭바·트랜잭션 오케스트레이션
// (제작/분해 확인·실행)·방 복귀 피드백만 보유한다.

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
    // Bright casual storybook backdrop (gradient + sun glow + polka dots).
    applyCasualBackground(this);

    const g = this.add.graphics().setDepth(-10);
    // Cream content tray behind craft/dismantle cards.
    const trayX = 10;
    const trayY = CONTENT_Y + 8;
    const trayW = CANVAS_WIDTH - 20;
    const trayH = CANVAS_HEIGHT - CONTENT_Y - 18;
    g.fillStyle(CASUAL.SHADOW, 0.16);
    g.fillRoundedRect(trayX, trayY + 4, trayW, trayH, 18);
    g.fillStyle(CASUAL.PANEL_SOFT, 0.92);
    g.fillRoundedRect(trayX, trayY, trayW, trayH, 18);
    g.lineStyle(3, CASUAL.EDGE, 0.9);
    g.strokeRoundedRect(trayX, trayY, trayW, trayH, 18);
    g.fillStyle(0xffffff, 0.12);
    g.fillRoundedRect(trayX + 5, trayY + 5, trayW - 10, 6, 3);
  }

  // ─── Header ──────────────────────────────────────────────────────────────

  private drawHeader(): void {
    this.headerContainer?.destroy();
    const c = this.add.container(0, 0).setDepth(10);
    this.headerContainer = c;

    // Cream header band with brown bottom edge + white top highlight.
    const g = this.add.graphics();
    g.fillStyle(CASUAL.PANEL, 1);
    g.fillRect(0, 0, CANVAS_WIDTH, HEADER_H);
    g.fillStyle(0xffffff, 0.12);
    g.fillRect(0, 0, CANVAS_WIDTH, 4);
    g.fillStyle(CASUAL.EDGE, 1);
    g.fillRect(0, HEADER_H - 3, CANVAS_WIDTH, 3);
    c.add(g);

    c.add(this.add.text(CANVAS_WIDTH / 2, HEADER_H / 2 - 7, '장비 제작소', {
      fontFamily: 'sans-serif', fontSize: '20px', fontStyle: 'bold',
      color: CASUAL_CSS.INK, stroke: '#ffffff', strokeThickness: 4,
    }).setOrigin(0.5));
    const gs = loadGameState();
    const focusName = getFocusMonsterName(gs, this.focusMonsterId);
    const headerSub = focusName
      ? `${this.focusSourceLabel ?? '선택 수호자'} · ${focusName} 장비 보강`
      : '몬스터 장비를 제작하고 바로 장착';
    c.add(this.add.text(CANVAS_WIDTH / 2, HEADER_H / 2 + 14, headerSub, {
      fontFamily: 'sans-serif', fontSize: '10px', fontStyle: 'bold',
      color: CASUAL_CSS.INK_SOFT,
    }).setOrigin(0.5));

    this.buildBtn(c, 14, HEADER_H / 2 - 13, '← 뒤로', () => {
      this.cameras.main.fadeOut(200, 0, 0, 0);
      this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start(this.returnScene));
    });

    // Farm-loop shortcut: jump to the Abyss to gather crafting materials.
    if (this.focusRoomSlotIdx === null) {
      this.buildBtn(c, 80, HEADER_H / 2 - 13, '🕳 심연', () => this.scene.start('AbyssScene'));
    }

    if (this.focusRoomSlotIdx !== null) {
      const returnX = CANVAS_WIDTH - 78;
      const returnY = HEADER_H / 2 - 13;
      const returnW = 66;
      const returnBg = this.add.graphics();
      returnBg.fillStyle(CASUAL.GREEN_DK, 1);
      returnBg.fillRoundedRect(returnX, returnY + 3, returnW, 26, 13);
      returnBg.fillStyle(CASUAL.GREEN, 1);
      returnBg.fillRoundedRect(returnX, returnY, returnW, 26, 13);
      returnBg.fillStyle(0xffffff, 0.32);
      returnBg.fillRoundedRect(returnX + 6, returnY + 4, returnW - 12, 5, 3);
      c.add(returnBg);

      const returnText = this.add.text(returnX + returnW / 2, returnY + 13, '방 복귀', {
        fontFamily: 'sans-serif',
        fontSize: '11px',
        color: '#ffffff',
        fontStyle: 'bold',
      }).setOrigin(0.5);
      const returnZone = this.add.zone(returnX, returnY, returnW, 26)
        .setOrigin(0, 0)
        .setInteractive({ useHandCursor: true });
      returnZone.on('pointerdown', () => this.returnToFocusedRoom());
      c.add([returnText, returnZone]);
    }

    // Material inventory strip (right side of header)
    const materialEntries = Object.entries(gs.materials ?? {})
      .filter(([, qty]) => qty > 0)
      .map(([id, qty]) => `${getMaterialDisplay(id).emoji}×${qty}`);
    const matLine = materialEntries.length > 0
      ? `${materialEntries.slice(0, 3).join(' ')}${materialEntries.length > 3 ? ` +${materialEntries.length - 3}` : ''}`
      : '';
    if (matLine && this.focusRoomSlotIdx === null) {
      c.add(this.add.text(CANVAS_WIDTH - 10, 13, matLine, {
        fontFamily: 'sans-serif', fontSize: '8px', fontStyle: 'bold', color: CASUAL_CSS.GOLD,
      }).setOrigin(1, 0.5));
    }

    // Awakening stones indicator
    const stones = gs.awakeningStones ?? 0;
    if (this.focusRoomSlotIdx === null) {
      c.add(this.add.text(CANVAS_WIDTH - 12, HEADER_H - 14, `각성석: ${stones}`, {
        fontFamily: 'sans-serif', fontSize: '10px', fontStyle: 'bold', color: CASUAL_CSS.PURPLE,
      }).setOrigin(1, 1));
    }
  }

  // Cream pill button (back button), added to the header container.
  private buildBtn(
    c: Phaser.GameObjects.Container,
    x: number,
    y: number,
    label: string,
    cb: () => void,
  ): void {
    const w = label.length * 8 + 18;
    const g = this.add.graphics();
    g.fillStyle(CASUAL.EDGE, 1);
    g.fillRoundedRect(x, y + 3, w, 26, 13);
    g.fillStyle(CASUAL.PANEL, 1);
    g.fillRoundedRect(x, y, w, 26, 13);
    g.fillStyle(0xffffff, 0.12);
    g.fillRoundedRect(x + 4, y + 2, w - 8, 5, 3);
    c.add(g);
    c.add(this.add.text(x + w / 2, y + 13, label, {
      fontFamily: 'sans-serif', fontSize: '11px', color: CASUAL_CSS.INK, fontStyle: 'bold',
    }).setOrigin(0.5));
    const zone = this.add.zone(x, y, w, 26).setOrigin(0)
      .setInteractive({ useHandCursor: true });
    zone.on('pointerdown', cb);
    c.add(zone);
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
    const target = getFocusMonsterDisplay(afterGs, this.focusMonsterId);
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
      accent: rarityHex(bp.rarity),
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

  /** Build the read-only context + action callbacks passed to render modules. */
  private buildCtx(gs: GameState): ForgeContext {
    return {
      gs,
      activeTab:        this.activeTab,
      focusMonsterId:   this.focusMonsterId,
      focusSourceLabel: this.focusSourceLabel,
      selectedBpId:     this.selectedBpId,
      selectedEqIdx:    this.selectedEqIdx,
      onFocusChange: (monsterId, roomLabel) => {
        this.focusMonsterId = monsterId;
        this.focusSourceLabel = roomLabel;
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
      onConfirmCraft:     (bpId)     => this.confirmCraft(bpId),
      onConfirmDismantle: (idx, eq)  => this.confirmDismantle(idx, eq),
    };
  }

  private renderContent(): void {
    this.contentContainer?.destroy();
    const c = this.add.container(0, CONTENT_Y).setDepth(5);
    this.contentContainer = c;

    const ctx = this.buildCtx(loadGameState());
    if (this.activeTab === 'craft') buildCraftTab(this, ctx, c);
    else                            buildDismantleTab(this, ctx, c);
  }

  // ─── Craft execution ───────────────────────────────────────────────────────

  private executeCraft(bpId: string): void {
    const gs = loadGameState();
    const bp = BLUEPRINT_DEFS[bpId];
    if (!bp) return;
    const result = applyCraftBlueprint(gs, bp);
    if (!result.ok) return;

    const matEntries = Object.entries(result.consumedMaterials);

    // Float feedback per material
    matEntries.forEach(([id, qty], i) => {
      const emoji  = getMaterialDisplay(id).emoji;
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
    const result = equipMonsterEquipment(beforeState, targetMonsterId, bp.resultId);
    if (!result.ok) {
      this.showToast('장착 실패', '#ff6666');
      return false;
    }
    saveGameState(result.state);
    if (this.focusMonsterId) {
      this.registerRoomEquipmentFeedback(beforeState, result.state, this.focusMonsterId, bp);
      this.preserveFocusContext();
      this.scene.start(this.returnScene);
      return true;
    }
    this.drawHeader();
    this.renderContent();
    const name = getMonsterDefForOwned(targetMonsterId)?.name ?? '수호자';
    this.showToast(`✅ ${name} 장착 완료`, '#b8fff0');
    return true;
  }

  // ─── Craft confirm modal ───────────────────────────────────────────────────

  private confirmCraft(bpId: string): void {
    const gs = loadGameState();
    const bp = BLUEPRINT_DEFS[bpId];
    if (!bp || !canCraftBlueprint(bp, gs.materials ?? {})) return;
    const recommendation = getBlueprintRecommendation(gs, bp, { monsterId: this.focusMonsterId, sourceLabel: this.focusSourceLabel });

    const matStr = Object.entries(bp.materials)
      .map(([id, qty]) => {
        const material = getMaterialDisplay(id);
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
    const accent = rarityHex(bp.rarity);
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
    drawEffectChips(this, ov, summarizeBlueprintEffects(bp), cx - 92, cy - ph / 2 + 84, accent, 184);

    if (recommendation) {
      drawForgeRecommendationPreview(
        this,
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
    addModalButton(this, ov, cx - 112, buttonY, 96, 30, '취소', 0x7c5633, 'secondary', () => ov.destroy());
    addModalButton(this, ov, cx + 16, buttonY, 96, 30, '제작', accent, 'primary', () => {
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
      ? Object.entries(returned)
          .map(([id, qty]) => {
            const material = getMaterialDisplay(id);
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

    const buttonY = cy + ph / 2 - 40;
    addModalButton(this, ov, cx - 112, buttonY, 96, 30, '취소', CASUAL.EDGE, 'secondary', () => ov.destroy());
    addModalButton(this, ov, cx + 16, buttonY, 96, 30, '분해', CASUAL.RED, 'primary', () => {
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
      .map(([id, qty]) => `${getMaterialDisplay(id).emoji}×${qty}`);
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
