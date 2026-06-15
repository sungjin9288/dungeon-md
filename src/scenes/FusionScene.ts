import Phaser from 'phaser';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../constants/layout';
import { CASUAL, CASUAL_CSS } from '../constants/colors';
import { applyCasualBackground } from '../ui/AmbientBackground';
import { loadGameState } from '../data/wisdom';
import { type OwnedMonster } from '../data/barracks';
import {
  HYBRID_DEFS, COMBINATION_TABLE,
  RARITY_STARS,
  getBaseId,
} from '../data/fusion';
import { logger } from '../utils/logger';
import { addSceneHeader, addTabBar } from '../ui/GameUiPrimitives';
import {
  type TabId, type FusionTabContext,
  TAB_ACCENT, TAB_ACCENT_CSS,
  buildEvolutionTab,
  buildAbsorptionTab,
  buildCombinationTab,
  buildAwakeningTab,
} from '../ui/FusionTabs';

// ─── Layout ───────────────────────────────────────────────────────────────────

const HEADER_H  = 56;
const TAB_H     = 44;
const CONTENT_Y = HEADER_H + TAB_H;

const TABS: readonly TabId[] = ['진화', '흡수', '조합', '각성'];

// ─── Scene ────────────────────────────────────────────────────────────────────

export class FusionScene extends Phaser.Scene {
  private activeTab: TabId = '진화';
  private contentContainer?: Phaser.GameObjects.Container;
  private tabBarContainer?: Phaser.GameObjects.Container;
  private cauldronEmoji?: Phaser.GameObjects.Text;
  private headerContainer?: Phaser.GameObjects.Container;

  // Evolution
  private evoSlots: (OwnedMonster | null)[] = [null, null, null];

  // Absorption
  private absorbTarget: OwnedMonster | null = null;
  private absorbSacrifices: OwnedMonster[]  = [];

  // Combination
  private combineSlots: (OwnedMonster | null)[] = [null, null];

  constructor() { super({ key: 'FusionScene' }); }

  // ─── Lifecycle ────────────────────────────────────────────────────────────

  create(): void {
    this.activeTab        = '진화';
    this.evoSlots         = [null, null, null];
    this.absorbTarget     = null;
    this.absorbSacrifices = [];
    this.combineSlots     = [null, null];

    this.drawBackground();
    this.drawHeader();
    this.drawTabBar();
    this.drawCauldron();
    this.renderTabContent();
    this.cameras.main.fadeIn(200, 0, 0, 0);
  }

  // ─── Background ──────────────────────────────────────────────────────────

  private drawBackground(): void {
    // Bright casual storybook backdrop (gradient + sun glow + polka dots).
    applyCasualBackground(this);

    const g = this.add.graphics().setDepth(-10);
    // Cream content tray behind the fusion slots / tab content.
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
    g.fillStyle(0xffffff, 0.4);
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
    g.fillStyle(0xffffff, 0.4);
    g.fillRect(0, 0, CANVAS_WIDTH, 4);
    g.fillStyle(CASUAL.EDGE, 1);
    g.fillRect(0, HEADER_H - 3, CANVAS_WIDTH, 3);
    c.add(g);

    const header = addSceneHeader(this, {
      title: '🔬 연구소',
      y:     HEADER_H / 2,
      onBack: () => {
        this.cameras.main.fadeOut(200, 0, 0, 0);
        this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('DungeonHomeScene'));
      },
    });
    c.add(header.container);

    const gs = loadGameState();
    const discovered = gs.discoveredCombinations?.length ?? 0;
    const codexBtn = this.add.text(CANVAS_WIDTH - 14, HEADER_H / 2, `조합 도감 [${discovered}/10]`, {
      fontFamily: 'sans-serif', fontSize: '10px', fontStyle: 'bold', color: '#ffffff',
      backgroundColor: CASUAL_CSS.BLUE, padding: { x: 7, y: 4 },
    }).setOrigin(1, 0.5).setInteractive();
    codexBtn.on('pointerdown', () => this.openCodex());
    c.add(codexBtn);
  }

  // ─── Tab availability counts ──────────────────────────────────────────────

  private computeTabCounts(): Record<TabId, number> {
    const gs = loadGameState();
    const monsters = gs.ownedMonsters;

    // 진화: count base-type groups with >= 3 monsters
    const baseCounts: Record<string, number> = {};
    for (const m of monsters) {
      const base = getBaseId(m.id);
      baseCounts[base] = (baseCounts[base] ?? 0) + 1;
    }
    const evoCount = Object.values(baseCounts).filter(n => n >= 3).length;

    // 흡수: need at least 2 monsters (1 target + 1 sacrifice)
    const absorbCount = monsters.length >= 2 ? monsters.length - 1 : 0;

    // 조합: need at least 2 monsters
    const combineCount = monsters.length >= 2 ? 1 : 0;

    // 각성: monsters with affinity >= 100, not yet awakened, and stones available
    const stones = gs.awakeningStones ?? 0;
    const awakenCount = stones >= 1
      ? monsters.filter(m => {
          const affinity = gs.monsterAffinity?.[m.id] ?? 0;
          const awakened = gs.monsterAwakened?.[m.id] ?? false;
          return affinity >= 100 && !awakened;
        }).length
      : 0;

    return { '진화': evoCount, '흡수': absorbCount, '조합': combineCount, '각성': awakenCount };
  }

  // ─── Tab bar ─────────────────────────────────────────────────────────────

  private drawTabBar(): void {
    this.tabBarContainer?.destroy();
    const counts = this.computeTabCounts();
    this.tabBarContainer = addTabBar<TabId>(this, {
      tabs: TABS.map(tab => ({
        id: tab, label: tab, badge: counts[tab],
        accent: TAB_ACCENT[tab], accentCSS: TAB_ACCENT_CSS[tab],
      })),
      active:   this.activeTab,
      y:        HEADER_H,
      height:   TAB_H,
      fontSize: '15px',
      onSelect: tab => this.switchTab(tab),
    }).container;
  }

  switchTab(tab: TabId): void {
    if (this.activeTab === tab) return;
    this.activeTab = tab;
    this.drawTabBar();
    this.updateCauldron();
    this.renderTabContent();
    logger.debug(`[FUSION] Switched to tab: ${tab}`);
  }

  // ─── Cauldron ────────────────────────────────────────────────────────────

  private drawCauldron(): void {
    const cx = CANVAS_WIDTH / 2;
    const cy = CONTENT_Y + 118;

    const glow = this.add.graphics().setDepth(4);
    glow.fillStyle(0x7fd8a8, 0.1);
    glow.fillCircle(cx, cy + 14, 42);

    this.cauldronEmoji = this.add.text(cx, cy, '🪄', {
      fontFamily: 'sans-serif', fontSize: '52px',
    }).setOrigin(0.5).setDepth(5);

    this.tweens.add({
      targets: this.cauldronEmoji, y: cy - 7,
      duration: 1600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    });
    this.tweens.add({
      targets: glow, alpha: { from: 0.07, to: 0.22 },
      duration: 1800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    });

    // Bubble sparkles
    for (let i = 0; i < 4; i++) {
      const bx = cx + Phaser.Math.Between(-28, 28);
      const b = this.add.text(bx, cy - 20, ['✨', '💫', '🫧'][i % 3], {
        fontFamily: 'sans-serif', fontSize: '14px',
      }).setOrigin(0.5).setDepth(5).setAlpha(0);
      this.time.delayedCall(i * 700, () => {
        this.tweens.add({
          targets: b, y: b.y - Phaser.Math.Between(40, 70),
          alpha: { from: 0.8, to: 0 },
          duration: Phaser.Math.Between(1400, 2400),
          ease: 'Quad.easeOut', repeat: -1,
          delay: i * 600, repeatDelay: Phaser.Math.Between(800, 1600),
        });
      });
    }
  }

  private updateCauldron(): void {
    if (!this.cauldronEmoji) return;
    this.tweens.add({
      targets: this.cauldronEmoji,
      scaleX: 1.25, scaleY: 1.25,
      duration: 180, yoyo: true, ease: 'Quad.easeOut',
    });
  }

  // ─── Tab content dispatch ────────────────────────────────────────────────

  private buildTabContext(): FusionTabContext {
    return {
      scene: this,
      contentY: CONTENT_Y,
      cauldronEmoji: this.cauldronEmoji,
      refreshTab: () => this.renderTabContent(),
      refreshHeader: () => this.drawHeader(),
    };
  }

  private renderTabContent(): void {
    this.contentContainer?.destroy();
    const c = this.add.container(0, 0).setDepth(3);
    this.contentContainer = c;
    const ctx = this.buildTabContext();

    switch (this.activeTab) {
      case '진화':
        buildEvolutionTab(ctx, c, {
          evoSlots: this.evoSlots,
          setEvoSlots: (slots) => { this.evoSlots = slots; },
        });
        break;
      case '흡수':
        buildAbsorptionTab(ctx, c, {
          absorbTarget: this.absorbTarget,
          absorbSacrifices: this.absorbSacrifices,
          setAbsorbTarget: (m) => { this.absorbTarget = m; },
          setAbsorbSacrifices: (list) => { this.absorbSacrifices = list; },
        });
        break;
      case '조합':
        buildCombinationTab(ctx, c, {
          combineSlots: this.combineSlots,
          setCombineSlots: (slots) => { this.combineSlots = slots; },
        });
        break;
      case '각성':
        buildAwakeningTab(ctx, c);
        break;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Combination codex panel
  // ─────────────────────────────────────────────────────────────────────────

  private openCodex(): void {
    const gs          = loadGameState();
    const discovered  = gs.discoveredCombinations ?? [];
    const total       = Object.keys(COMBINATION_TABLE).length;

    const ov = this.add.container(0, 0).setDepth(70);
    const dim = this.add.graphics();
    dim.fillStyle(0x000000, 0.5);
    dim.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    dim.setInteractive();
    dim.on('pointerdown', () => ov.destroy(true));
    ov.add(dim);

    const PW = CANVAS_WIDTH - 32, PH = CANVAS_HEIGHT - 120;
    const PX = 16, PY = 60;
    // Cream modal tray: brown drop shadow + cream fill + chunky brown rim + white highlight.
    const pg = this.add.graphics();
    pg.fillStyle(CASUAL.SHADOW, 0.3);
    pg.fillRoundedRect(PX, PY + 5, PW, PH, 14);
    pg.fillStyle(CASUAL.PANEL, 1);
    pg.fillRoundedRect(PX, PY, PW, PH, 14);
    pg.fillStyle(0xffffff, 0.4);
    pg.fillRoundedRect(PX + 6, PY + 5, PW - 12, 6, 3);
    pg.lineStyle(3, CASUAL.EDGE, 1);
    pg.strokeRoundedRect(PX, PY, PW, PH, 14);
    ov.add(pg);

    ov.add(this.add.text(CANVAS_WIDTH / 2, PY + 22, `조합 도감 [${discovered.length}/${total}]`, {
      fontFamily: 'sans-serif', fontSize: '16px', fontStyle: 'bold',
      color: CASUAL_CSS.INK, stroke: '#ffffff', strokeThickness: 4,
    }).setOrigin(0.5));

    const closeX = this.add.text(PX + PW - 10, PY + 10, '✕', {
      fontFamily: 'sans-serif', fontSize: '16px', fontStyle: 'bold', color: CASUAL_CSS.INK_SOFT,
    }).setOrigin(1, 0).setInteractive();
    closeX.on('pointerdown', () => ov.destroy(true));
    ov.add(closeX);

    // List all entries
    const entries = Object.entries(COMBINATION_TABLE);
    const rowH = 46, rowPad = 10;
    let ry = PY + 46;
    entries.forEach(([key, hybridId]) => {
      const hybrid = HYBRID_DEFS[hybridId];
      const isKnown = discovered.includes(hybridId);
      const [a, b] = key.split('+');

      const row = this.add.graphics();
      row.fillStyle(CASUAL.PANEL_SOFT, isKnown ? 1 : 0.6);
      row.fillRoundedRect(PX + rowPad, ry, PW - rowPad * 2, rowH - 4, 6);
      row.lineStyle(2, CASUAL.EDGE, isKnown ? 0.9 : 0.4);
      row.strokeRoundedRect(PX + rowPad, ry, PW - rowPad * 2, rowH - 4, 6);
      ov.add(row);

      if (isKnown) {
        ov.add(this.add.text(PX + rowPad + 12, ry + (rowH - 4) / 2,
          `${a} + ${b} → ${hybrid.emoji} ${hybrid.name}`, {
            fontFamily: 'sans-serif', fontSize: '11px', fontStyle: 'bold', color: CASUAL_CSS.INK,
          }).setOrigin(0, 0.5));
        ov.add(this.add.text(PX + PW - rowPad - 8, ry + (rowH - 4) / 2,
          RARITY_STARS[hybrid.rarity], {
            fontFamily: 'sans-serif', fontSize: '9px', color: CASUAL_CSS.GOLD,
          }).setOrigin(1, 0.5));
      } else {
        ov.add(this.add.text(PX + rowPad + 12, ry + (rowH - 4) / 2, '??? + ??? → ???', {
          fontFamily: 'sans-serif', fontSize: '11px', color: CASUAL_CSS.INK_SOFT,
        }).setOrigin(0, 0.5));
      }
      ry += rowH;
    });

    ov.setAlpha(0);
    this.tweens.add({ targets: ov, alpha: 1, duration: 200 });
  }
}
