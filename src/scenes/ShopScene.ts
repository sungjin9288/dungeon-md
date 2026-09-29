import Phaser from 'phaser';
import { SKIN_DATA } from '../data/monsters';
import { getCharacterArtStreamer } from '../art/CharacterArtStreamer';
import { CANVAS_HEIGHT, CANVAS_WIDTH } from '../constants/layout';
import { DUNGEON_UI, DUNGEON_UI_CSS } from '../constants/colors';
import { loadGameState, saveGameState } from '../data/wisdom';
import { getQuest } from '../data/quests';
import { MONSTER_DEFS, type MonsterSkin } from '../data/monsters';
import {
  equipSkin,
  purchaseAndEquipSkin,
  type ShopTransactionResult,
} from '../data/shopTransactions';
import { addSceneHeader, addTabBar } from '../ui/GameUiPrimitives';
import { addMonsterPortrait } from '../ui/MonsterPortraitView';
import { buildSkinTab, type SkinFilter, type ShopSkinTabContext } from '../ui/ShopSkinTab';
import { buildThemeTab, type ShopThemeTabContext } from '../ui/ShopThemeTab';
import {
  buildEquipmentTab,
  buildSkillTab,
  getDayIndex,
  type ShopDailyTabContext,
} from '../ui/ShopDailyTab';
import {
  addShopButton,
  acceptUtcDayIndex,
  formatUtcReset,
  secondsUntilUtcReset,
  type ShopImmediateRequest,
  type ShopPurchaseOutcome,
  type ShopPurchaseRequest,
  type ShopViewContext,
} from '../ui/ShopShared';

type ShopTab = 'skin' | 'equipment' | 'skill' | 'theme';

interface OverlayFrame {
  readonly container: Phaser.GameObjects.Container;
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

export class ShopScene extends Phaser.Scene {
  private activeTab: ShopTab = 'skin';
  private skinFilter: SkinFilter = 'all';
  private skinPage = 0;
  private themePage = 0;
  private contentCtr?: Phaser.GameObjects.Container;
  private tabCtr?: Phaser.GameObjects.Container;
  private overlayCtr?: Phaser.GameObjects.Container;
  private toastCtr?: Phaser.GameObjects.Container;
  private gemsText?: Phaser.GameObjects.Text;
  private soulText?: Phaser.GameObjects.Text;
  private resetText?: Phaser.GameObjects.Text;
  private resetTick?: Phaser.Time.TimerEvent;
  private transactionInFlight = false;
  private currentDayIndex = 0;

  constructor() {
    super({ key: 'ShopScene' });
  }

  create(): void {
    this.activeTab = 'skin';
    this.skinFilter = 'all';
    this.skinPage = 0;
    this.themePage = 0;
    this.transactionInFlight = false;
    this.currentDayIndex = getDayIndex();

    this.drawBackground();
    this.drawHeader();
    this.drawLedger();
    this.drawTabBar();
    this.buildContent();
    this.startResetClock();

    // Skin cutouts (few, small) stream in; redraw the skin tab once they land.
    const streamer = getCharacterArtStreamer(this.game);
    let redraw = false;
    const offArt = streamer.onLoaded(() => {
      if (redraw || this.activeTab !== 'skin') return;
      redraw = true;
      this.time.delayedCall(250, () => { redraw = false; if (this.sys.isActive() && this.activeTab === 'skin') this.buildContent(); });
    });
    this.events.once('shutdown', offArt);
    streamer.request(SKIN_DATA.map(skin => skin.id));

    this.events.once('shutdown', () => {
      this.resetTick?.remove();
      this.resetTick = undefined;
      this.transactionInFlight = false;
      this.overlayCtr = undefined;
      this.toastCtr = undefined;
    });
  }

  private drawBackground(): void {
    this.cameras.main.setBackgroundColor(DUNGEON_UI.VOID);
    const g = this.add.graphics().setDepth(-20);
    g.fillGradientStyle(DUNGEON_UI.STONE, DUNGEON_UI.STONE, DUNGEON_UI.VOID, DUNGEON_UI.VOID, 1);
    g.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    g.fillStyle(DUNGEON_UI.SOOT, 0.92);
    g.fillRect(0, 0, CANVAS_WIDTH, 58);
    g.lineStyle(1, DUNGEON_UI.IRON, 0.62);
    for (let y = 154; y < CANVAS_HEIGHT; y += 54) {
      g.lineBetween(0, y, CANVAS_WIDTH, y);
      const offset = Math.floor((y - 154) / 54) % 2 === 0 ? 32 : 0;
      for (let x = offset; x < CANVAS_WIDTH; x += 64) g.lineBetween(x, y, x, y + 54);
    }
    g.fillStyle(DUNGEON_UI.BRASS, 0.08);
    g.fillCircle(24, 85, 60);
    g.fillCircle(CANVAS_WIDTH - 24, 85, 60);
    g.lineStyle(2, DUNGEON_UI.BRASS, 0.42);
    g.lineBetween(8, 146, CANVAS_WIDTH - 8, 146);
  }

  private drawHeader(): void {
    addSceneHeader(this, {
      title: '군수 상점',
      subtitle: 'DUNGEON QUARTERMASTER',
      y: 24,
      backLabel: '← 군단',
      depth: 12,
      onBack: () => {
        if (!this.transactionInFlight) this.scene.start('BarracksScene');
      },
    });
  }

  private drawLedger(): void {
    const ctr = this.add.container(0, 0).setDepth(11);
    const g = this.add.graphics();
    g.fillStyle(DUNGEON_UI.SOOT, 0.98);
    g.fillRoundedRect(8, 58, CANVAS_WIDTH - 16, 36, 7);
    g.lineStyle(1, DUNGEON_UI.EDGE, 0.76);
    g.strokeRoundedRect(8, 58, CANVAS_WIDTH - 16, 36, 7);
    g.lineStyle(1, DUNGEON_UI.IRON, 0.8);
    g.lineBetween(132, 63, 132, 89);
    g.lineBetween(258, 63, 258, 89);
    ctr.add(g);

    const addLabel = (x: number, label: string): void => {
      ctr.add(this.add.text(x, 65, label, {
        fontFamily: 'sans-serif', fontSize: '10px', fontStyle: 'bold', color: DUNGEON_UI_CSS.MUTED,
      }).setOrigin(0.5, 0));
    };
    addLabel(70, '보석');
    addLabel(195, '영혼 결정');
    addLabel(320, '재입고');

    this.gemsText = this.add.text(70, 81, '', {
      fontFamily: 'monospace', fontSize: '12px', fontStyle: 'bold', color: DUNGEON_UI_CSS.BRASS,
    }).setOrigin(0.5);
    this.soulText = this.add.text(195, 81, '', {
      fontFamily: 'monospace', fontSize: '12px', fontStyle: 'bold', color: '#aab9ff',
    }).setOrigin(0.5);
    this.resetText = this.add.text(320, 81, '', {
      fontFamily: 'monospace', fontSize: '11px', fontStyle: 'bold', color: DUNGEON_UI_CSS.TEXT,
    }).setOrigin(0.5);
    ctr.add([this.gemsText, this.soulText, this.resetText]);
    this.refreshLedger();
  }

  private refreshLedger(): void {
    const state = loadGameState();
    this.gemsText?.setText(String(state.gems ?? 0));
    this.soulText?.setText(String(state.soulCrystals ?? 0));
    this.resetText?.setText(formatUtcReset(secondsUntilUtcReset()));
  }

  private startResetClock(): void {
    this.resetTick?.remove();
    this.resetTick = this.time.addEvent({
      delay: 1000,
      loop: true,
      callback: () => {
        this.resetText?.setText(formatUtcReset(secondsUntilUtcReset()));
        const nextDay = getDayIndex();
        const acceptedDay = acceptUtcDayIndex(this.currentDayIndex, nextDay, this.transactionInFlight);
        if (acceptedDay !== this.currentDayIndex) {
          this.currentDayIndex = acceptedDay;
          if (this.activeTab === 'equipment' || this.activeTab === 'skill') {
            this.buildContent();
          }
        }
      },
    });
  }

  private drawTabBar(): void {
    this.tabCtr?.destroy();
    this.tabCtr = addTabBar<ShopTab>(this, {
      tabs: [
        { id: 'skin', label: '외형' },
        { id: 'theme', label: '테마' },
        { id: 'equipment', label: '장비' },
        { id: 'skill', label: '스킬' },
      ],
      active: this.activeTab,
      y: 100,
      height: 44,
      fontSize: '12px',
      accent: DUNGEON_UI.BRASS_BRIGHT,
      accentCSS: DUNGEON_UI_CSS.BRASS,
      depth: 10,
      onSelect: id => {
        if (this.transactionInFlight) return;
        this.activeTab = id;
        this.drawTabBar();
        this.buildContent();
      },
    }).container;
  }

  private createViewContext(): ShopViewContext {
    return {
      scene: this,
      contentCtr: this.contentCtr!,
      isBusy: () => this.transactionInFlight,
      requestPurchase: (request, reuseLatch) => this.requestPurchase(request, reuseLatch),
      runImmediate: (request, reuseLatch) => this.runImmediate(request, reuseLatch),
    };
  }

  private buildContent(): void {
    this.contentCtr?.destroy();
    this.contentCtr = this.add.container(0, 0).setDepth(5);
    const base = this.createViewContext();

    if (this.activeTab === 'skin') {
      const ctx: ShopSkinTabContext = {
        ...base,
        skinFilter: this.skinFilter,
        skinPage: this.skinPage,
        setSkinView: (filter, page) => {
          if (this.transactionInFlight) return;
          this.skinFilter = filter;
          this.skinPage = page;
          this.buildContent();
        },
        openSkinPreview: skin => this.openSkinPreview(skin),
      };
      buildSkinTab(ctx);
    } else if (this.activeTab === 'theme') {
      const ctx: ShopThemeTabContext = {
        ...base,
        themePage: this.themePage,
        setThemePage: page => {
          if (this.transactionInFlight) return;
          this.themePage = page;
          this.buildContent();
        },
      };
      buildThemeTab(ctx);
    } else {
      const ctx: ShopDailyTabContext = base;
      if (this.activeTab === 'equipment') buildEquipmentTab(ctx);
      else buildSkillTab(ctx);
    }
  }

  private refreshAll(): void {
    this.refreshLedger();
    this.buildContent();
  }

  private requestPurchase(request: ShopPurchaseRequest, reuseLatch = false): void {
    if (reuseLatch) {
      if (!this.transactionInFlight) return;
    } else {
      if (this.transactionInFlight) return;
      this.transactionInFlight = true;
    }
    this.showPurchaseConfirmation(request);
  }

  private runImmediate(request: ShopImmediateRequest, reuseLatch = false): void {
    if (reuseLatch) {
      if (!this.transactionInFlight) return;
    } else {
      if (this.transactionInFlight) return;
      this.transactionInFlight = true;
    }

    let outcome: ShopPurchaseOutcome;
    try {
      outcome = request.execute();
    } catch {
      outcome = { ok: false, title: '처리 실패', detail: '상태를 변경하지 못했습니다.' };
    }
    this.refreshAll();
    this.transactionInFlight = false;
    this.showToast(`${outcome.title} · ${outcome.detail}`, outcome.ok);
  }

  private createOverlayFrame(y: number, h: number): OverlayFrame {
    this.destroyOverlay();
    const container = this.add.container(0, 0).setDepth(200);
    const shield = this.add.zone(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)
      .setOrigin(0, 0)
      .setInteractive();
    container.add(shield);
    const dim = this.add.graphics();
    dim.fillStyle(DUNGEON_UI.VOID, 0.86);
    dim.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    container.add(dim);

    const x = 24;
    const w = CANVAS_WIDTH - 48;
    const panel = this.add.graphics();
    panel.fillStyle(DUNGEON_UI.VOID, 0.9);
    panel.fillRoundedRect(x + 3, y + 6, w, h, 12);
    panel.fillStyle(DUNGEON_UI.STONE, 1);
    panel.fillRoundedRect(x, y, w, h, 12);
    panel.lineStyle(2, DUNGEON_UI.BRASS, 0.9);
    panel.strokeRoundedRect(x, y, w, h, 12);
    panel.fillStyle(DUNGEON_UI.BRASS, 0.16);
    panel.fillRect(x + 8, y + 8, w - 16, 4);
    container.add(panel);
    this.overlayCtr = container;
    return { container, x, y, w, h };
  }

  private showPurchaseConfirmation(request: ShopPurchaseRequest): void {
    const frame = this.createOverlayFrame(224, 396);
    const { container, x, y, w, h } = frame;
    let settled = false;

    container.add(this.add.text(x + w / 2, y + 34, '거래 확인', {
      fontFamily: 'monospace', fontSize: '11px', fontStyle: 'bold', color: DUNGEON_UI_CSS.BRASS,
    }).setOrigin(0.5));
    container.add(this.add.text(x + w / 2, y + 72, request.itemName, {
      fontFamily: 'sans-serif', fontSize: '20px', fontStyle: 'bold', color: DUNGEON_UI_CSS.PARCHMENT,
      align: 'center', wordWrap: { width: w - 44 },
    }).setOrigin(0.5));
    container.add(this.add.text(x + w / 2, y + 120, request.description, {
      fontFamily: 'sans-serif', fontSize: '12px', color: DUNGEON_UI_CSS.TEXT,
      align: 'center', wordWrap: { width: w - 54 }, lineSpacing: 4,
    }).setOrigin(0.5));

    const cost = this.add.graphics();
    cost.fillStyle(DUNGEON_UI.SOOT, 1);
    cost.fillRoundedRect(x + 30, y + 170, w - 60, 62, 8);
    cost.lineStyle(1, DUNGEON_UI.EDGE, 0.78);
    cost.strokeRoundedRect(x + 30, y + 170, w - 60, 62, 8);
    container.add(cost);
    container.add(this.add.text(x + w / 2, y + 188, '지불 예정', {
      fontFamily: 'sans-serif', fontSize: '10px', fontStyle: 'bold', color: DUNGEON_UI_CSS.MUTED,
    }).setOrigin(0.5));
    container.add(this.add.text(x + w / 2, y + 213, request.costLabel, {
      fontFamily: 'monospace', fontSize: '16px', fontStyle: 'bold', color: DUNGEON_UI_CSS.BRASS,
    }).setOrigin(0.5));
    container.add(this.add.text(x + w / 2, y + 260, '확인 전에는 자원과 보유 목록이 변경되지 않습니다.', {
      fontFamily: 'sans-serif', fontSize: '10px', color: DUNGEON_UI_CSS.MUTED,
      align: 'center', wordWrap: { width: w - 42 },
    }).setOrigin(0.5));

    addShopButton(this, container, {
      x: x + 16, y: y + h - 64, w: 126, h: 48, label: '취소', accent: DUNGEON_UI.EDGE,
      onPress: () => {
        if (settled) return;
        settled = true;
        this.destroyOverlay();
        this.transactionInFlight = false;
      },
    });
    addShopButton(this, container, {
      x: x + 150, y: y + h - 64, w: w - 166, h: 48,
      label: request.confirmLabel ?? '구매 확정', accent: DUNGEON_UI.BRASS_BRIGHT,
      onPress: () => {
        if (settled) return;
        settled = true;
        this.destroyOverlay();
        let outcome: ShopPurchaseOutcome;
        try {
          outcome = request.execute();
        } catch {
          outcome = { ok: false, title: '거래 실패', detail: '자원은 변경되지 않았습니다.' };
        }
        this.refreshAll();
        this.showReceipt(outcome);
      },
    });
  }

  private showReceipt(outcome: ShopPurchaseOutcome): void {
    const frame = this.createOverlayFrame(258, 328);
    const { container, x, y, w, h } = frame;
    let acknowledged = false;
    const accent = outcome.ok ? DUNGEON_UI.JADE : DUNGEON_UI.EMBER;
    const accentCss = outcome.ok ? DUNGEON_UI_CSS.JADE : DUNGEON_UI_CSS.EMBER;

    const seal = this.add.graphics();
    seal.fillStyle(accent, 0.14);
    seal.fillCircle(x + w / 2, y + 74, 34);
    seal.lineStyle(2, accent, 0.9);
    seal.strokeCircle(x + w / 2, y + 74, 28);
    if (outcome.ok) {
      seal.lineBetween(x + w / 2 - 11, y + 74, x + w / 2 - 2, y + 84);
      seal.lineBetween(x + w / 2 - 2, y + 84, x + w / 2 + 14, y + 62);
    } else {
      seal.lineBetween(x + w / 2 - 10, y + 64, x + w / 2 + 10, y + 84);
      seal.lineBetween(x + w / 2 + 10, y + 64, x + w / 2 - 10, y + 84);
    }
    container.add(seal);
    container.add(this.add.text(x + w / 2, y + 124, outcome.ok ? '거래 완료' : '거래 불가', {
      fontFamily: 'monospace', fontSize: '11px', fontStyle: 'bold', color: accentCss,
    }).setOrigin(0.5));
    container.add(this.add.text(x + w / 2, y + 156, outcome.title, {
      fontFamily: 'sans-serif', fontSize: '19px', fontStyle: 'bold', color: DUNGEON_UI_CSS.PARCHMENT,
      align: 'center', wordWrap: { width: w - 46 },
    }).setOrigin(0.5));
    container.add(this.add.text(x + w / 2, y + 203, outcome.detail, {
      fontFamily: 'sans-serif', fontSize: '11px', color: DUNGEON_UI_CSS.TEXT,
      align: 'center', wordWrap: { width: w - 48 }, lineSpacing: 3,
    }).setOrigin(0.5));
    addShopButton(this, container, {
      x: x + 20, y: y + h - 66, w: w - 40, h: 48,
      label: '확인하고 선반으로', accent,
      onPress: () => {
        if (acknowledged) return;
        acknowledged = true;
        this.destroyOverlay();
        this.transactionInFlight = false;
      },
    });
  }

  private openSkinPreview(skin: MonsterSkin): void {
    if (this.transactionInFlight) return;
    this.transactionInFlight = true;
    const frame = this.createOverlayFrame(92, 660);
    const { container, x, y, w, h } = frame;
    const state = loadGameState();
    const owned = (state.ownedSkins?.[skin.monsterId] ?? []).includes(skin.id);
    const equipped = state.equippedSkins?.[skin.monsterId] === skin.id;
    const questOnly = skin.unlockVia === 'quest';
    const monsterName = MONSTER_DEFS[skin.monsterId]?.name ?? skin.monsterId;

    container.add(this.add.text(x + w / 2, y + 25, '외형 검수대', {
      fontFamily: 'monospace', fontSize: '11px', fontStyle: 'bold', color: DUNGEON_UI_CSS.BRASS,
    }).setOrigin(0.5));
    container.add(this.add.text(x + w / 2, y + 53, skin.name, {
      fontFamily: 'sans-serif', fontSize: '19px', fontStyle: 'bold', color: DUNGEON_UI_CSS.PARCHMENT,
    }).setOrigin(0.5));

    const compare = this.add.graphics();
    compare.fillStyle(DUNGEON_UI.SOOT, 0.95);
    compare.fillRoundedRect(x + 14, y + 78, 148, 226, 9);
    compare.fillRoundedRect(x + w - 162, y + 78, 148, 226, 9);
    compare.lineStyle(1, DUNGEON_UI.EDGE, 0.7);
    compare.strokeRoundedRect(x + 14, y + 78, 148, 226, 9);
    compare.lineStyle(1.5, skin.particleColor, 0.95);
    compare.strokeRoundedRect(x + w - 162, y + 78, 148, 226, 9);
    container.add(compare);
    addMonsterPortrait(this, container, x + 88, y + 166, skin.monsterId, {
      size: 112, frameColor: DUNGEON_UI.EDGE, bgColor: DUNGEON_UI.VOID, equippedSkins: {},
    });
    addMonsterPortrait(this, container, x + w - 88, y + 166, skin.monsterId, {
      size: 112, frameColor: skin.particleColor, glowColor: skin.particleColor,
      bgColor: DUNGEON_UI.VOID, equippedSkins: { [skin.monsterId]: skin.id },
    });
    container.add(this.add.text(x + 88, y + 278, '기본 외형', {
      fontFamily: 'sans-serif', fontSize: '11px', fontStyle: 'bold', color: DUNGEON_UI_CSS.MUTED,
    }).setOrigin(0.5));
    container.add(this.add.text(x + w - 88, y + 278, '보급 외형', {
      fontFamily: 'sans-serif', fontSize: '11px', fontStyle: 'bold', color: DUNGEON_UI_CSS.TEXT,
    }).setOrigin(0.5));

    const rarity = { normal: '일반', rare: '희귀', limited: '한정' }[skin.rarity];
    const questTitle = skin.unlockRef ? (getQuest(skin.unlockRef)?.title ?? skin.unlockRef) : '';
    const status = equipped
      ? '현재 장착 중'
      : owned
        ? '보유 중 · 즉시 장착 가능'
        : questOnly
          ? `퀘스트 해금 · ${questTitle}`
          : `보석 ${skin.gemCost} · 구매 즉시 장착`;
    container.add(this.add.text(x + w / 2, y + 338, `${monsterName} · ${rarity}`, {
      fontFamily: 'sans-serif', fontSize: '12px', fontStyle: 'bold', color: DUNGEON_UI_CSS.PARCHMENT,
    }).setOrigin(0.5));
    container.add(this.add.text(x + w / 2, y + 365, status, {
      fontFamily: 'sans-serif', fontSize: '11px', color: DUNGEON_UI_CSS.TEXT,
      align: 'center', wordWrap: { width: w - 42 },
    }).setOrigin(0.5));
    container.add(this.add.text(x + w / 2, y + 415, '우측 외형은 저장된 장착 상태와 분리된 미리보기입니다.', {
      fontFamily: 'sans-serif', fontSize: '10px', color: DUNGEON_UI_CSS.MUTED,
      align: 'center', wordWrap: { width: w - 54 },
    }).setOrigin(0.5));

    addShopButton(this, container, {
      x: x + 16, y: y + h - 64, w: 112, h: 48, label: '닫기', accent: DUNGEON_UI.EDGE,
      onPress: () => {
        this.destroyOverlay();
        this.transactionInFlight = false;
      },
    });

    const actionEnabled = !equipped && (owned || !questOnly);
    const actionLabel = equipped
      ? '현재 장착 중'
      : owned
        ? '이 외형 장착'
        : questOnly
          ? '퀘스트에서 해금'
          : `보석 ${skin.gemCost} 구매·장착`;
    addShopButton(this, container, {
      x: x + 136, y: y + h - 64, w: w - 152, h: 48,
      label: actionLabel, enabled: actionEnabled,
      accent: owned ? DUNGEON_UI.JADE : DUNGEON_UI.BRASS_BRIGHT,
      onPress: () => {
        this.destroyOverlay();
        if (owned) {
          this.runImmediate({
            execute: () => this.executeAndSave(
              equipSkin(loadGameState(), skin.monsterId, skin.id),
              `${skin.name} 장착`,
              `${monsterName}의 외형을 변경했습니다.`,
            ),
          }, true);
          return;
        }
        this.requestPurchase({
          itemName: skin.name,
          description: `${monsterName} 외형을 구매하고 즉시 장착합니다.`,
          costLabel: `보석 ${skin.gemCost}`,
          confirmLabel: '구매·장착 확정',
          execute: () => this.executeAndSave(
            purchaseAndEquipSkin(loadGameState(), skin.monsterId, skin.id, skin.gemCost),
            `${skin.name} 지급 완료`,
            `${monsterName}에게 구매한 외형을 장착했습니다.`,
          ),
        }, true);
      },
    });
  }

  private executeAndSave(
    result: ShopTransactionResult,
    successTitle: string,
    successDetail: string,
  ): ShopPurchaseOutcome {
    if (!result.ok) {
      const detail = result.reason === 'insufficient_gems'
        ? '보석 잔액이 부족합니다. 자원은 변경되지 않았습니다.'
        : result.reason === 'insufficient_soul_crystals'
          ? '영혼 결정 잔액이 부족합니다. 자원은 변경되지 않았습니다.'
          : '보유하지 않은 외형입니다. 상태는 변경되지 않았습니다.';
      return { ok: false, title: '구매 조건 미충족', detail };
    }
    if (result.changed) saveGameState(result.state);
    return {
      ok: true,
      title: result.changed ? successTitle : '이미 반영된 항목',
      detail: result.changed ? successDetail : '추가 자원은 사용되지 않았습니다.',
    };
  }

  private destroyOverlay(): void {
    if (this.overlayCtr?.active) this.overlayCtr.destroy();
    this.overlayCtr = undefined;
  }

  private showToast(message: string, positive: boolean): void {
    if (this.toastCtr?.active) this.toastCtr.destroy();
    const ctr = this.add.container(0, 0).setDepth(220);
    const bg = this.add.graphics();
    const accent = positive ? DUNGEON_UI.JADE : DUNGEON_UI.EMBER;
    bg.fillStyle(DUNGEON_UI.SOOT, 0.98);
    bg.fillRoundedRect(18, 154, CANVAS_WIDTH - 36, 48, 8);
    bg.lineStyle(1.5, accent, 0.9);
    bg.strokeRoundedRect(18, 154, CANVAS_WIDTH - 36, 48, 8);
    ctr.add(bg);
    ctr.add(this.add.text(CANVAS_WIDTH / 2, 178, message, {
      fontFamily: 'sans-serif', fontSize: '11px', fontStyle: 'bold', color: DUNGEON_UI_CSS.PARCHMENT,
      align: 'center', wordWrap: { width: CANVAS_WIDTH - 64 },
    }).setOrigin(0.5));
    this.toastCtr = ctr;
    this.time.delayedCall(1600, () => {
      if (ctr.active) ctr.destroy();
      if (this.toastCtr === ctr) this.toastCtr = undefined;
    });
  }
}
