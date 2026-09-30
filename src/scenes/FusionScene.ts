import Phaser from 'phaser';
import { CANVAS_HEIGHT, CANVAS_WIDTH } from '../constants/layout';
import { DUNGEON_UI, DUNGEON_UI_CSS } from '../constants/colors';
import { loadGameState } from '../data/wisdom';
import { type OwnedMonster } from '../data/barracks';
import {
  COMBINATION_TABLE,
  RARITY_STARS,
  getBaseId,
  getMonsterDisplayName,
  resolveFusionMonsterDef,
} from '../data/fusion';
import { logger } from '../utils/logger';
import { getReducedMotion } from '../utils/reducedMotion';
import { addMonsterPortrait } from '../ui/MonsterPortraitView';
import { addPrimaryActionButton } from '../ui/GameUiPrimitives';
import {
  type TabId,
  type FusionTabContext,
  TAB_ACCENT,
  TAB_ACCENT_CSS,
  buildEvolutionTab,
  buildAbsorptionTab,
  buildCombinationTab,
  buildAwakeningTab,
  rememberFusionSources,
} from '../ui/FusionTabs';
import { FUSION_EVOLVE_ID_KEY, FUSION_RETURN_SCENE_KEY, pickEvolutionMaterials } from '../data/fusionCandidates';

const HEADER_H = 58;
const RESOURCE_H = 38;
const TAB_H = 46;
const TAB_Y = HEADER_H + RESOURCE_H;
const CONTENT_Y = TAB_Y + TAB_H;
const TABS: readonly TabId[] = ['진화', '흡수', '조합', '각성'];

const CORE_COPY: Record<TabId, { eyebrow: string; title: string }> = {
  '진화': { eyebrow: 'THREEFOLD SEAL', title: '동종의 혼을 상위 개체로 결속' },
  '흡수': { eyebrow: 'ESSENCE TRANSFER', title: '희생의 정수를 대상에게 이전' },
  '조합': { eyebrow: 'HYBRID RITE', title: '두 수호자의 공명으로 혼종 탐색' },
  '각성': { eyebrow: 'AWAKENING OATH', title: '친밀의 맹세로 잠든 힘을 해방' },
};

export class FusionScene extends Phaser.Scene {
  private activeTab: TabId = '진화';
  private contentContainer?: Phaser.GameObjects.Container;
  private tabBarContainer?: Phaser.GameObjects.Container;
  private ritualCore?: Phaser.GameObjects.Container;
  private headerContainer?: Phaser.GameObjects.Container;
  private transactionInFlight = false;
  private codexOpen = false;
  private returnScene = 'DungeonHomeScene';

  private evoSlots: (OwnedMonster | null)[] = [null, null, null];
  private absorbTarget: OwnedMonster | null = null;
  private absorbSacrifices: OwnedMonster[] = [];
  private combineSlots: (OwnedMonster | null)[] = [null, null];
  private awakenTarget: OwnedMonster | null = null;

  constructor() {
    super({ key: 'FusionScene' });
  }

  create(): void {
    this.activeTab = '진화';
    this.evoSlots = this.consumeEvolveHandoff();
    this.returnScene = this.consumeReturnScene();
    this.absorbTarget = null;
    this.absorbSacrifices = [];
    this.combineSlots = [null, null];
    this.awakenTarget = this.pickInitialAwakeningTarget();
    this.transactionInFlight = false;
    this.codexOpen = false;

    this.drawBackground();
    this.drawHeader();
    this.drawTabBar();
    this.drawRitualCore();
    this.renderTabContent();

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.transactionInFlight = false;
      this.codexOpen = false;
      this.contentContainer = undefined;
      this.tabBarContainer = undefined;
      this.ritualCore = undefined;
      this.headerContainer = undefined;
    });
    if (!getReducedMotion()) this.cameras.main.fadeIn(160, 0, 0, 0);
  }

  /** 병영 상세 '진화 가능'에서 왔으면 그 종류의 재료 3체로 진화 슬롯을 채운다(한 번 쓰고 지움). */
  private consumeEvolveHandoff(): (OwnedMonster | null)[] {
    const id = this.registry.get(FUSION_EVOLVE_ID_KEY);
    this.registry.remove(FUSION_EVOLVE_ID_KEY);
    if (typeof id !== 'string') return [null, null, null];
    const owned = loadGameState().ownedMonsters ?? [];
    const picked = pickEvolutionMaterials(owned, id);
    if (picked.length === 0) return [null, null, null];
    rememberFusionSources(owned);
    return picked;
  }

  private consumeReturnScene(): string {
    const scene = this.registry.get(FUSION_RETURN_SCENE_KEY);
    this.registry.remove(FUSION_RETURN_SCENE_KEY);
    return scene === 'BarracksScene' || scene === 'AbyssScene' ? scene : 'DungeonHomeScene';
  }

  private pickInitialAwakeningTarget(): OwnedMonster | null {
    const state = loadGameState();
    return state.ownedMonsters.find(monster =>
      (state.monsterAffinity?.[monster.id] ?? 0) >= 100
      && !(state.monsterAwakened?.[monster.id] ?? false),
    ) ?? state.ownedMonsters[0] ?? null;
  }

  private drawBackground(): void {
    const g = this.add.graphics().setDepth(-20);
    g.fillStyle(DUNGEON_UI.VOID, 1);
    g.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    for (let row = 0; row < 11; row++) {
      const y = row * 78;
      const offset = row % 2 === 0 ? -32 : 0;
      for (let x = offset; x < CANVAS_WIDTH; x += 96) {
        g.fillStyle(row % 3 === 0 ? DUNGEON_UI.STONE_RAISED : DUNGEON_UI.STONE, 0.58);
        g.fillRect(x + 1, y + 1, 94, 76);
        g.lineStyle(1, DUNGEON_UI.IRON, 0.32);
        g.strokeRect(x + 1, y + 1, 94, 76);
      }
    }

    g.fillStyle(DUNGEON_UI.SOOT, 0.96);
    g.fillRoundedRect(8, CONTENT_Y + 6, CANVAS_WIDTH - 16, CANVAS_HEIGHT - CONTENT_Y - 14, 12);
    g.lineStyle(1.5, DUNGEON_UI.IRON, 0.92);
    g.strokeRoundedRect(8, CONTENT_Y + 6, CANVAS_WIDTH - 16, CANVAS_HEIGHT - CONTENT_Y - 14, 12);
    g.fillStyle(DUNGEON_UI.BRASS, 0.34);
    g.fillRect(18, CONTENT_Y + 8, CANVAS_WIDTH - 36, 2);

    const arch = this.add.graphics().setDepth(-10);
    arch.lineStyle(8, DUNGEON_UI.STONE_RAISED, 0.96);
    arch.strokeCircle(CANVAS_WIDTH / 2, CONTENT_Y + 76, 69);
    arch.lineStyle(2, DUNGEON_UI.EDGE, 0.45);
    arch.strokeCircle(CANVAS_WIDTH / 2, CONTENT_Y + 76, 65);
    arch.fillStyle(DUNGEON_UI.VOID, 0.78);
    arch.fillRect(CANVAS_WIDTH / 2 - 82, CONTENT_Y + 75, 164, 75);
  }

  private drawHeader(): void {
    this.headerContainer?.destroy(true);
    const state = loadGameState();
    const c = this.add.container(0, 0).setDepth(20);
    this.headerContainer = c;

    const g = this.add.graphics();
    g.fillStyle(DUNGEON_UI.SOOT, 1);
    g.fillRect(0, 0, CANVAS_WIDTH, HEADER_H);
    g.fillStyle(DUNGEON_UI.STONE, 1);
    g.fillRect(0, HEADER_H, CANVAS_WIDTH, RESOURCE_H);
    g.lineStyle(1, DUNGEON_UI.IRON, 0.9);
    g.lineBetween(0, HEADER_H - 1, CANVAS_WIDTH, HEADER_H - 1);
    g.lineBetween(0, HEADER_H + RESOURCE_H - 1, CANVAS_WIDTH, HEADER_H + RESOURCE_H - 1);
    c.add(g);

    const back = addPrimaryActionButton(this, {
      x: 10, y: 7, w: 66, h: 44, label: '← 귀환', fontSize: '12px', once: true,
      showArrow: false, fillColor: DUNGEON_UI.STONE_RAISED, borderColor: DUNGEON_UI.EDGE,
      hoverFillColor: DUNGEON_UI.IRON, hoverBorderColor: DUNGEON_UI.BRASS,
      onPress: () => {
        if (this.transactionInFlight || this.codexOpen) return;
        if (getReducedMotion()) {
          this.scene.start(this.returnScene);
          return;
        }
        this.cameras.main.fadeOut(160, 0, 0, 0);
        this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start(this.returnScene));
      },
    });
    c.add([back.bg, back.text, back.zone]);

    c.add(this.add.text(CANVAS_WIDTH / 2, 22, '융합 의식실', {
      fontFamily: 'sans-serif', fontSize: '20px', color: DUNGEON_UI_CSS.PARCHMENT,
      fontStyle: 'bold', stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5));
    c.add(this.add.text(CANVAS_WIDTH / 2, 43, 'SOUL RITUAL CHAMBER', {
      fontFamily: 'sans-serif', fontSize: '10px', color: DUNGEON_UI_CSS.MUTED,
      fontStyle: 'bold', letterSpacing: 1,
    }).setOrigin(0.5));

    const discovered = state.discoveredCombinations?.length ?? 0;
    const total = Object.keys(COMBINATION_TABLE).length;
    const codex = addPrimaryActionButton(this, {
      x: 294, y: 7, w: 86, h: 44, label: `도감 ${discovered}/${total}`, fontSize: '11px',
      once: true, showArrow: false, fillColor: DUNGEON_UI.STONE_RAISED,
      borderColor: DUNGEON_UI.BRASS, hoverFillColor: DUNGEON_UI.IRON,
      hoverBorderColor: DUNGEON_UI.BRASS_BRIGHT, onPress: () => this.openCodex(),
    });
    c.add([codex.bg, codex.text, codex.zone]);

    const resourceY = HEADER_H + RESOURCE_H / 2;
    const resources = [
      { label: '영혼 결정', value: String(state.soulCrystals ?? 0), color: DUNGEON_UI_CSS.BRASS },
      { label: '각성석', value: String(state.awakeningStones ?? 0), color: '#aeb8ed' },
      { label: '완료 의식', value: String(state.totalFusions ?? 0), color: DUNGEON_UI_CSS.JADE },
    ];
    resources.forEach((resource, index) => {
      const x = 14 + index * 126;
      if (index > 0) {
        const divider = this.add.graphics();
        divider.lineStyle(1, DUNGEON_UI.IRON, 0.7);
        divider.lineBetween(x - 9, HEADER_H + 8, x - 9, HEADER_H + RESOURCE_H - 8);
        c.add(divider);
      }
      c.add(this.add.text(x, resourceY - 7, resource.label, {
        fontFamily: 'sans-serif', fontSize: '10px', color: DUNGEON_UI_CSS.MUTED,
      }).setOrigin(0, 0.5));
      c.add(this.add.text(x, resourceY + 8, resource.value, {
        fontFamily: 'sans-serif', fontSize: '12px', color: resource.color, fontStyle: 'bold',
      }).setOrigin(0, 0.5));
    });
  }

  private computeTabCounts(): Record<TabId, number> {
    const state = loadGameState();
    const baseCounts: Record<string, number> = {};
    for (const monster of state.ownedMonsters) {
      const base = getBaseId(monster.id);
      baseCounts[base] = (baseCounts[base] ?? 0) + 1;
    }
    const evolution = Object.values(baseCounts).filter(count => count >= 3).length;
    const absorption = state.ownedMonsters.length >= 2 ? state.ownedMonsters.length - 1 : 0;
    const combination = state.ownedMonsters.length >= 2 ? 1 : 0;
    const awakening = (state.awakeningStones ?? 0) > 0
      ? state.ownedMonsters.filter(monster =>
          (state.monsterAffinity?.[monster.id] ?? 0) >= 100
          && !(state.monsterAwakened?.[monster.id] ?? false),
        ).length
      : 0;
    return { '진화': evolution, '흡수': absorption, '조합': combination, '각성': awakening };
  }

  private drawTabBar(): void {
    this.tabBarContainer?.destroy(true);
    const c = this.add.container(0, TAB_Y).setDepth(18);
    this.tabBarContainer = c;
    const counts = this.computeTabCounts();
    const tabW = CANVAS_WIDTH / TABS.length;
    const bg = this.add.graphics();
    bg.fillStyle(DUNGEON_UI.SOOT, 1);
    bg.fillRect(0, 0, CANVAS_WIDTH, TAB_H);
    bg.fillStyle(DUNGEON_UI.IRON, 0.8);
    bg.fillRect(0, TAB_H - 1, CANVAS_WIDTH, 1);
    c.add(bg);

    TABS.forEach((tab, index) => {
      const active = tab === this.activeTab;
      const x = index * tabW;
      if (active) {
        const activeBg = this.add.graphics();
        activeBg.fillStyle(TAB_ACCENT[tab], 0.13);
        activeBg.fillRect(x + 3, 2, tabW - 6, TAB_H - 4);
        activeBg.fillStyle(TAB_ACCENT[tab], 1);
        activeBg.fillRect(x + 12, TAB_H - 3, tabW - 24, 3);
        c.add(activeBg);
      }
      const label = counts[tab] > 0 ? `${tab} ${counts[tab]}` : tab;
      c.add(this.add.text(x + tabW / 2, TAB_H / 2, label, {
        fontFamily: 'sans-serif', fontSize: '12px', fontStyle: 'bold',
        color: active ? TAB_ACCENT_CSS[tab] : DUNGEON_UI_CSS.MUTED,
      }).setOrigin(0.5));
      const zone = this.add.zone(x, 0, tabW, TAB_H).setOrigin(0)
        .setInteractive({ useHandCursor: true });
      zone.on('pointerdown', () => this.switchTab(tab));
      c.add(zone);
    });
  }

  switchTab(tab: TabId): void {
    if (this.transactionInFlight || this.codexOpen || this.activeTab === tab) return;
    this.activeTab = tab;
    this.drawTabBar();
    this.drawRitualCore();
    this.renderTabContent();
    logger.debug(`[FUSION] Switched to tab: ${tab}`);
  }

  private drawRitualCore(): void {
    this.ritualCore?.destroy(true);
    const c = this.add.container(0, 0).setDepth(4);
    this.ritualCore = c;
    const cx = CANVAS_WIDTH / 2;
    const cy = CONTENT_Y + 66;
    const accent = TAB_ACCENT[this.activeTab];
    const g = this.add.graphics();
    g.fillStyle(DUNGEON_UI.VOID, 0.94);
    g.fillCircle(cx, cy, 48);
    g.lineStyle(2, accent, 0.88);
    g.strokeCircle(cx, cy, 46);
    g.lineStyle(1, DUNGEON_UI.BRASS, 0.52);
    g.strokeCircle(cx, cy, 34);
    for (let i = 0; i < 3; i++) {
      const angle = Phaser.Math.DegToRad(i * 120 - 90);
      g.fillStyle(accent, 0.86);
      g.fillCircle(cx + Math.cos(angle) * 33, cy + Math.sin(angle) * 33, 3);
    }
    g.lineStyle(1, accent, 0.62);
    g.lineBetween(cx, cy - 24, cx - 21, cy + 14);
    g.lineBetween(cx - 21, cy + 14, cx + 21, cy + 14);
    g.lineBetween(cx + 21, cy + 14, cx, cy - 24);
    c.add(g);
    const copy = CORE_COPY[this.activeTab];
    c.add(this.add.text(cx, CONTENT_Y + 122, copy.eyebrow, {
      fontFamily: 'sans-serif', fontSize: '10px', color: TAB_ACCENT_CSS[this.activeTab],
      fontStyle: 'bold', letterSpacing: 1,
    }).setOrigin(0.5));
    c.add(this.add.text(cx, CONTENT_Y + 141, copy.title, {
      fontFamily: 'sans-serif', fontSize: '11px', color: DUNGEON_UI_CSS.MUTED,
    }).setOrigin(0.5));

    if (!getReducedMotion()) {
      c.setAlpha(0.6);
      this.tweens.add({ targets: c, alpha: 1, duration: 180, ease: 'Quad.easeOut' });
    }
  }

  private buildTabContext(): FusionTabContext {
    return {
      scene: this,
      contentY: CONTENT_Y,
      refreshTab: () => this.renderTabContent(),
      refreshHeader: () => this.drawHeader(),
      beginTransaction: () => {
        if (this.transactionInFlight) return false;
        this.transactionInFlight = true;
        return true;
      },
      finishTransaction: () => {
        this.transactionInFlight = false;
        this.drawTabBar();
      },
    };
  }

  private renderTabContent(): void {
    this.contentContainer?.destroy(true);
    const c = this.add.container(0, 0).setDepth(6);
    this.contentContainer = c;
    const ctx = this.buildTabContext();

    switch (this.activeTab) {
      case '진화':
        buildEvolutionTab(ctx, c, {
          evoSlots: this.evoSlots,
          setEvoSlots: slots => { this.evoSlots = slots; },
        });
        break;
      case '흡수':
        buildAbsorptionTab(ctx, c, {
          absorbTarget: this.absorbTarget,
          absorbSacrifices: this.absorbSacrifices,
          setAbsorbTarget: monster => { this.absorbTarget = monster; },
          setAbsorbSacrifices: sacrifices => { this.absorbSacrifices = sacrifices; },
        });
        break;
      case '조합':
        buildCombinationTab(ctx, c, {
          combineSlots: this.combineSlots,
          setCombineSlots: slots => { this.combineSlots = slots; },
        });
        break;
      case '각성':
        buildAwakeningTab(ctx, c, {
          awakenTarget: this.awakenTarget,
          setAwakenTarget: monster => { this.awakenTarget = monster; },
        });
        break;
    }
  }

  private openCodex(): void {
    if (this.transactionInFlight || this.codexOpen) return;
    this.codexOpen = true;
    const state = loadGameState();
    const discovered = state.discoveredCombinations ?? [];
    const entries = Object.entries(COMBINATION_TABLE);
    const pageSize = 7;
    const pageCount = Math.max(1, Math.ceil(entries.length / pageSize));
    let page = 0;
    const ov = this.add.container(0, 0).setDepth(90);

    const dim = this.add.graphics();
    dim.fillStyle(DUNGEON_UI.VOID, 0.92);
    dim.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    ov.add(dim);
    ov.add(this.add.zone(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT).setOrigin(0).setInteractive());

    const px = 16;
    const py = 54;
    const pw = CANVAS_WIDTH - 32;
    const ph = CANVAS_HEIGHT - 108;
    const panel = this.add.graphics();
    panel.fillStyle(DUNGEON_UI.SOOT, 1);
    panel.fillRoundedRect(px, py, pw, ph, 12);
    panel.lineStyle(2, DUNGEON_UI.BRASS, 0.78);
    panel.strokeRoundedRect(px, py, pw, ph, 12);
    panel.fillStyle(DUNGEON_UI.BRASS, 0.38);
    panel.fillRect(px + 12, py + 48, pw - 24, 1);
    ov.add(panel);
    ov.add(this.add.zone(px, py, pw, ph).setOrigin(0).setInteractive());

    ov.add(this.add.text(px + 18, py + 27, `조합 도감 ${discovered.length}/${entries.length}`, {
      fontFamily: 'sans-serif', fontSize: '18px', color: DUNGEON_UI_CSS.PARCHMENT,
      fontStyle: 'bold',
    }).setOrigin(0, 0.5));

    const rows = this.add.container(0, 0);
    ov.add(rows);
    const drawPage = (): void => {
      rows.removeAll(true);
      const visible = entries.slice(page * pageSize, (page + 1) * pageSize);
      visible.forEach(([key, hybridId], index) => {
        const y = py + 62 + index * 72;
        const hybrid = resolveFusionMonsterDef(hybridId);
        if (!hybrid) return;
        const known = discovered.includes(hybridId);
        const row = this.add.graphics();
        row.fillStyle(known ? DUNGEON_UI.STONE_RAISED : DUNGEON_UI.STONE, 1);
        row.fillRoundedRect(px + 12, y, pw - 24, 64, 7);
        row.lineStyle(1, known ? DUNGEON_UI.BRASS : DUNGEON_UI.IRON, known ? 0.72 : 0.55);
        row.strokeRoundedRect(px + 12, y, pw - 24, 64, 7);
        rows.add(row);

        if (known) {
          addMonsterPortrait(this, rows, px + 46, y + 32, hybridId, {
            size: 48, frameColor: DUNGEON_UI.BRASS, glowColor: DUNGEON_UI.BRASS,
            bgColor: DUNGEON_UI.VOID, equippedSkins: state.equippedSkins,
          });
          const [a, b] = key.split('+');
          rows.add(this.add.text(px + 80, y + 19,
            `${getMonsterDisplayName(a)} + ${getMonsterDisplayName(b)}`, {
              fontFamily: 'sans-serif', fontSize: '10px', color: DUNGEON_UI_CSS.MUTED,
            }).setOrigin(0, 0.5));
          rows.add(this.add.text(px + 80, y + 40, hybrid.name, {
            fontFamily: 'sans-serif', fontSize: '13px', color: DUNGEON_UI_CSS.TEXT, fontStyle: 'bold',
          }).setOrigin(0, 0.5));
          rows.add(this.add.text(px + pw - 22, y + 32, RARITY_STARS[hybrid.rarity], {
            fontFamily: 'sans-serif', fontSize: '10px', color: DUNGEON_UI_CSS.BRASS,
          }).setOrigin(1, 0.5));
        } else {
          rows.add(this.add.text(px + 30, y + 23, '봉인된 조합', {
            fontFamily: 'sans-serif', fontSize: '12px', color: DUNGEON_UI_CSS.MUTED,
            fontStyle: 'bold',
          }).setOrigin(0, 0.5));
          rows.add(this.add.text(px + 30, y + 43, '두 수호자의 공명 기록이 없습니다', {
            fontFamily: 'sans-serif', fontSize: '10px', color: '#6f796f',
          }).setOrigin(0, 0.5));
        }
      });

      rows.add(this.add.text(CANVAS_WIDTH / 2, py + ph - 91, `${page + 1} / ${pageCount}`, {
        fontFamily: 'sans-serif', fontSize: '11px', color: DUNGEON_UI_CSS.MUTED,
        fontStyle: 'bold',
      }).setOrigin(0.5));
      const prev = addPrimaryActionButton(this, {
        x: px + 18, y: py + ph - 113, w: 82, h: 44, label: '이전', fontSize: '12px', once: true,
        showArrow: false, enabled: page > 0, fillColor: DUNGEON_UI.STONE_RAISED,
        borderColor: DUNGEON_UI.EDGE, hoverFillColor: DUNGEON_UI.IRON,
        hoverBorderColor: DUNGEON_UI.BRASS, disabledFillColor: DUNGEON_UI.SOOT,
        disabledBorderColor: DUNGEON_UI.IRON, disabledTextColor: '#596359',
        onPress: () => { page--; drawPage(); },
      });
      const next = addPrimaryActionButton(this, {
        x: px + pw - 100, y: py + ph - 113, w: 82, h: 44, label: '다음', fontSize: '12px', once: true,
        showArrow: false, enabled: page < pageCount - 1, fillColor: DUNGEON_UI.STONE_RAISED,
        borderColor: DUNGEON_UI.EDGE, hoverFillColor: DUNGEON_UI.IRON,
        hoverBorderColor: DUNGEON_UI.BRASS, disabledFillColor: DUNGEON_UI.SOOT,
        disabledBorderColor: DUNGEON_UI.IRON, disabledTextColor: '#596359',
        onPress: () => { page++; drawPage(); },
      });
      rows.add([prev.bg, prev.text, prev.zone, next.bg, next.text, next.zone]);
    };
    drawPage();

    const close = addPrimaryActionButton(this, {
      x: px + 18, y: py + ph - 57, w: pw - 36, h: 44, label: '도감 닫기', fontSize: '13px',
      once: true, showArrow: false, fillColor: DUNGEON_UI.STONE_RAISED,
      borderColor: DUNGEON_UI.BRASS, hoverFillColor: DUNGEON_UI.IRON,
      hoverBorderColor: DUNGEON_UI.BRASS_BRIGHT,
      onPress: () => {
        ov.destroy(true);
        this.codexOpen = false;
        this.drawHeader();
      },
    });
    ov.add([close.bg, close.text, close.zone]);

    if (!getReducedMotion()) {
      ov.setAlpha(0);
      this.tweens.add({ targets: ov, alpha: 1, duration: 160, ease: 'Quad.easeOut' });
    }
  }
}
