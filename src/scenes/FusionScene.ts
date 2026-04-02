import Phaser from 'phaser';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../constants/layout';
import { loadGameState, saveGameState } from '../data/wisdom';
import { type OwnedMonster, addXp } from '../data/barracks';
import { updateQuestObjective, tickSubQuestProgress } from '../data/quests';
import {
  RARITY_STARS, RARITY_COLORS, RARITY_XP_VALUES,
  HYBRID_DEFS, COMBINATION_TABLE, AWAKENED_PASSIVES,
  getBaseId, getMonsterRarity, getMonsterEmoji, getMonsterDisplayName,
  getMonsterBaseDamage, getNextEvolution, combinationKey,
} from '../data/fusion';
import { logger } from '../utils/logger';

// ─── Layout ───────────────────────────────────────────────────────────────────

const HEADER_H  = 56;
const TAB_H     = 44;
const CONTENT_Y = HEADER_H + TAB_H;

const TABS = ['진화', '흡수', '조합', '각성'] as const;
type TabId = typeof TABS[number];

const TAB_ACCENT: Record<TabId, number> = {
  '진화': 0x44cc66, '흡수': 0xcc8844, '조합': 0x4488cc, '각성': 0xcc44cc,
};
const TAB_ACCENT_CSS: Record<TabId, string> = {
  '진화': '#44cc66', '흡수': '#cc8844', '조합': '#4488cc', '각성': '#cc44cc',
};

// ─── Scene ────────────────────────────────────────────────────────────────────

export class FusionScene extends Phaser.Scene {
  private activeTab: TabId = '진화';
  private contentContainer?: Phaser.GameObjects.Container;
  private tabButtons: Phaser.GameObjects.Text[]      = [];
  private tabUnderlines: Phaser.GameObjects.Graphics[] = [];
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
    const g = this.add.graphics().setDepth(-10);
    g.fillStyle(0x001a10, 1);
    g.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    g.lineStyle(1, 0x003322, 0.4);
    for (let y = 0; y < CANVAS_HEIGHT; y += 40) g.lineBetween(0, y, CANVAS_WIDTH, y);
    for (let x = 0; x < CANVAS_WIDTH; x += 40) g.lineBetween(x, 0, x, CANVAS_HEIGHT);

    const glow = this.add.graphics().setDepth(-9);
    glow.fillStyle(0x00cc66, 0.05);
    glow.fillCircle(CANVAS_WIDTH / 2, CONTENT_Y + 130, 140);
  }

  // ─── Header ──────────────────────────────────────────────────────────────

  private drawHeader(): void {
    this.headerContainer?.destroy();
    const c = this.add.container(0, 0).setDepth(10);
    this.headerContainer = c;

    const g = this.add.graphics();
    g.fillStyle(0x001208, 1);
    g.fillRect(0, 0, CANVAS_WIDTH, HEADER_H);
    g.lineStyle(1, 0x00cc66, 0.25);
    g.lineBetween(0, HEADER_H, CANVAS_WIDTH, HEADER_H);
    c.add(g);

    c.add(this.add.text(CANVAS_WIDTH / 2, HEADER_H / 2, '🔬 연구소', {
      fontFamily: 'Georgia, serif', fontSize: '20px', color: '#44cc88',
    }).setOrigin(0.5));

    const back = this.add.text(18, HEADER_H / 2, '← 뒤로', {
      fontFamily: 'sans-serif', fontSize: '13px', color: '#669966',
      backgroundColor: '#001208', padding: { x: 8, y: 4 },
    }).setOrigin(0, 0.5).setInteractive();
    back.on('pointerdown', () => {
      this.cameras.main.fadeOut(200, 0, 0, 0);
      this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('DungeonHomeScene'));
    });
    c.add(back);

    const gs = loadGameState();
    const discovered = gs.discoveredCombinations?.length ?? 0;
    const codexBtn = this.add.text(CANVAS_WIDTH - 14, HEADER_H / 2, `조합 도감 [${discovered}/10]`, {
      fontFamily: 'sans-serif', fontSize: '10px', color: '#4488cc',
      backgroundColor: '#001020', padding: { x: 6, y: 3 },
    }).setOrigin(1, 0.5).setInteractive();
    codexBtn.on('pointerdown', () => this.openCodex());
    c.add(codexBtn);
  }

  // ─── Tab bar ─────────────────────────────────────────────────────────────

  private drawTabBar(): void {
    this.tabButtons.forEach(b => b.destroy());
    this.tabUnderlines.forEach(u => u.destroy());
    this.tabButtons    = [];
    this.tabUnderlines = [];

    const g = this.add.graphics().setDepth(10);
    g.fillStyle(0x000e08, 1);
    g.fillRect(0, HEADER_H, CANVAS_WIDTH, TAB_H);
    g.lineStyle(1, 0x00cc66, 0.2);
    g.lineBetween(0, HEADER_H + TAB_H, CANVAS_WIDTH, HEADER_H + TAB_H);

    const tabW = CANVAS_WIDTH / TABS.length;
    TABS.forEach((tab, i) => {
      const cx = i * tabW + tabW / 2;
      const cy = HEADER_H + TAB_H / 2;
      const isActive = tab === this.activeTab;
      const color = isActive ? TAB_ACCENT_CSS[tab] : '#336644';

      const t = this.add.text(cx, cy, tab, {
        fontFamily: 'Georgia, serif', fontSize: '15px', color,
        fontStyle: isActive ? 'bold' : 'normal',
      }).setOrigin(0.5).setDepth(11).setInteractive();
      t.on('pointerdown', () => this.switchTab(tab));
      this.tabButtons.push(t);

      if (isActive) {
        const ul = this.add.graphics().setDepth(11);
        ul.lineStyle(2, TAB_ACCENT[tab], 1);
        ul.lineBetween(i * tabW + 6, HEADER_H + TAB_H - 1, (i + 1) * tabW - 6, HEADER_H + TAB_H - 1);
        this.tabUnderlines.push(ul);
      }
    });
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
    glow.fillStyle(0x00ff88, 0.1);
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

  private renderTabContent(): void {
    this.contentContainer?.destroy();
    const c = this.add.container(0, 0).setDepth(3);
    this.contentContainer = c;
    switch (this.activeTab) {
      case '진화': this.buildEvoTab(c);     break;
      case '흡수': this.buildAbsorbTab(c);  break;
      case '조합': this.buildCombineTab(c); break;
      case '각성': this.buildAwakenTab(c);  break;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // TAB 1 — 진화 (Evolution)
  // ─────────────────────────────────────────────────────────────────────────

  private buildEvoTab(c: Phaser.GameObjects.Container): void {
    const LY    = CONTENT_Y + 250;
    const slotW = 80, slotH = 90;
    const totalW = 3 * slotW + 2 * 10;
    const sx0   = (CANVAS_WIDTH - totalW) / 2;

    c.add(this.add.text(CANVAS_WIDTH / 2, LY - 26, '같은 몬스터 3마리 → 진화', {
      fontFamily: 'Georgia, serif', fontSize: '11px', color: '#66aa77',
    }).setOrigin(0.5));

    // 3 slots
    for (let i = 0; i < 3; i++) {
      const sx = sx0 + i * (slotW + 10);
      const fi = i;
      this.drawMonsterSlot(c, sx, LY, slotW, slotH, this.evoSlots[i], '진화', () => {
        // Filter: if slot 0 filled, only allow same baseId
        const filter = this.evoSlots[0] && fi > 0
          ? (m: OwnedMonster) => getBaseId(m.id) === getBaseId(this.evoSlots[0]!.id)
          : undefined;
        this.openMonsterPicker(filter, (monster) => {
          this.evoSlots[fi] = monster;
          this.renderTabContent();
        });
      });
    }

    // + signs between slots
    [sx0 + slotW, sx0 + slotW * 2 + 10].forEach(px => {
      c.add(this.add.text(px + 5, LY + slotH / 2, '+', {
        fontFamily: 'Georgia, serif', fontSize: '18px', color: '#335544',
      }).setOrigin(0.5));
    });

    // Result preview
    const arrowY = LY + slotH + 20;
    c.add(this.add.text(CANVAS_WIDTH / 2, arrowY, '▼', {
      fontFamily: 'sans-serif', fontSize: '16px', color: '#44cc66',
    }).setOrigin(0.5));

    const resultX = (CANVAS_WIDTH - slotW) / 2;
    const resultY = arrowY + 22;
    const allFilled = this.evoSlots.every(s => s !== null);

    if (allFilled) {
      const tier  = getNextEvolution(this.evoSlots[0]!.id);
      if (tier) {
        const resultId    = tier.resultId;
        const evolvedName = getMonsterDisplayName(resultId);
        const evolvedEmoji = getMonsterEmoji(resultId);
        const baseAtk     = getMonsterBaseDamage(this.evoSlots[0]!.id);
        const newAtk      = Math.round(baseAtk * 1.30);
        const rarity      = tier.rarity;

        // Result slot with preview
        const rg = this.add.graphics();
        rg.fillStyle(0x001a10, 1);
        rg.fillRoundedRect(resultX, resultY, slotW, slotH + 18, 6);
        rg.lineStyle(2, TAB_ACCENT['진화'], 0.9);
        rg.strokeRoundedRect(resultX, resultY, slotW, slotH + 18, 6);
        c.add(rg);

        c.add(this.add.text(resultX + slotW / 2, resultY + 20, evolvedEmoji, {
          fontFamily: 'sans-serif', fontSize: '28px',
        }).setOrigin(0.5));
        c.add(this.add.text(resultX + slotW / 2, resultY + 46, RARITY_STARS[rarity], {
          fontFamily: 'sans-serif', fontSize: '10px',
        }).setOrigin(0.5));
        c.add(this.add.text(resultX + slotW / 2, resultY + 62, evolvedName, {
          fontFamily: 'sans-serif', fontSize: '7px', color: RARITY_COLORS[rarity],
          wordWrap: { width: slotW - 4 },
        }).setOrigin(0.5));
        c.add(this.add.text(resultX + slotW / 2, resultY + 76, `ATK: ${baseAtk}→${newAtk}`, {
          fontFamily: 'sans-serif', fontSize: '8px', color: '#44cc66',
        }).setOrigin(0.5));

        // Execute button (gold glow)
        const execBtn = this.add.text(CANVAS_WIDTH / 2, resultY + slotH + 30, '✨ 진화 실행', {
          fontFamily: 'Georgia, serif', fontSize: '16px', color: '#44cc66', fontStyle: 'bold',
          backgroundColor: '#002a14', padding: { x: 28, y: 10 },
        }).setOrigin(0.5).setInteractive();
        this.tweens.add({
          targets: execBtn, alpha: { from: 0.8, to: 1.0 },
          duration: 800, yoyo: true, repeat: -1,
        });
        execBtn.on('pointerdown', () => this.executeEvolution());
        c.add(execBtn);
      }
    } else {
      this.drawResultSlot(c, resultX, resultY, slotW, slotH, '진화');
      c.add(this.add.text(CANVAS_WIDTH / 2, resultY + slotH + 30, '슬롯을 채우세요', {
        fontFamily: 'Georgia, serif', fontSize: '15px', color: '#335544',
        backgroundColor: '#001208', padding: { x: 28, y: 10 },
      }).setOrigin(0.5));
    }

    c.add(this.add.text(CANVAS_WIDTH / 2, CANVAS_HEIGHT - 50, '진화 성공 시: 능력치 +30%, 희귀도 ↑', {
      fontFamily: 'sans-serif', fontSize: '10px', color: '#336644',
    }).setOrigin(0.5));
  }

  private executeEvolution(): void {
    const slot0 = this.evoSlots[0];
    if (!slot0) return;
    const tier = getNextEvolution(slot0.id);
    if (!tier) return;

    const gs = loadGameState();
    const maxLevel = Math.max(...this.evoSlots.map(s => s?.level ?? 1));

    // Remove 3 monsters from roster (match by identity or id)
    const slotIds = this.evoSlots.map(s => s?.id);
    let removed = 0;
    for (let i = gs.ownedMonsters.length - 1; i >= 0 && removed < 3; i--) {
      if (gs.ownedMonsters[i].id === slotIds[removed] || gs.ownedMonsters[i].id === slot0.id) {
        gs.ownedMonsters.splice(i, 1);
        removed++;
      }
    }

    // Create evolved monster
    const evolved: OwnedMonster = {
      id: tier.resultId, level: maxLevel, xp: 0,
      skillPoints: 0,
      spentSkills: { [tier.unlockedSkill]: 1 },
      equippedSkills: [], equipment: null,
      rarity: tier.rarity, absorptionStacks: 0,
    };
    gs.ownedMonsters.push(evolved);

    // Quest tracking
    updateQuestObjective(gs, 'fuse_monsters'); tickSubQuestProgress(gs, 'fuse_monsters');
    saveGameState(gs);

    const evolvedAtk = getMonsterBaseDamage(tier.resultId);
    const baseAtk    = getMonsterBaseDamage(slot0.id);
    logger.debug(`[EVOLUTION] ${getBaseId(slot0.id)}×3 → ${tier.resultId} Lv.${maxLevel} ATK:${evolvedAtk} (was ${baseAtk})`);

    this.evoSlots = [null, null, null];
    this.showFusionAnimation('진화', () => {
      this.renderTabContent();
      this.showResultToast(`${getMonsterDisplayName(tier.resultId)} 진화 완료!`, '#44cc66');
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // TAB 2 — 흡수 (Absorption)
  // ─────────────────────────────────────────────────────────────────────────

  private buildAbsorbTab(c: Phaser.GameObjects.Container): void {
    const slotW = 80, slotH = 90;
    const PAD   = 18;
    let   y     = CONTENT_Y + 240;

    c.add(this.add.text(CANVAS_WIDTH / 2, y - 22, '희생 몬스터 → XP 전환  |  같은 종류: +5% ATK 스택', {
      fontFamily: 'sans-serif', fontSize: '10px', color: '#aa8844',
      align: 'center', wordWrap: { width: CANVAS_WIDTH - 40 },
    }).setOrigin(0.5));

    // Target (베이스) slot
    c.add(this.add.text(PAD + slotW / 2, y - 6, '베이스', {
      fontFamily: 'sans-serif', fontSize: '9px', color: '#cc8844',
    }).setOrigin(0.5));
    this.drawMonsterSlot(c, PAD, y, slotW, slotH, this.absorbTarget, '흡수', () => {
      this.openMonsterPicker(undefined, (m) => { this.absorbTarget = m; this.renderTabContent(); });
    });

    // Sacrifice slots — show up to 5, each removable
    let sacrificeX = PAD + slotW + 18;
    const sacrificeLabel = this.add.text(sacrificeX, y - 6, '희생 (최대 5)', {
      fontFamily: 'sans-serif', fontSize: '9px', color: '#885533',
    });
    c.add(sacrificeLabel);

    const maxSacs = 5;
    const sacW = 56, sacH = 70;
    const sacGap = 8;
    for (let i = 0; i <= Math.min(this.absorbSacrifices.length, maxSacs - 1); i++) {
      const sx = sacrificeX + i * (sacW + sacGap);
      if (sx + sacW > CANVAS_WIDTH - PAD) break;
      const sac = this.absorbSacrifices[i] ?? null;

      if (sac) {
        // Filled sacrifice slot + remove button
        const sg = this.add.graphics();
        sg.fillStyle(0x200a00, 1);
        sg.fillRoundedRect(sx, y, sacW, sacH, 5);
        sg.lineStyle(1.5, 0xcc8844, 0.7);
        sg.strokeRoundedRect(sx, y, sacW, sacH, 5);
        c.add(sg);
        c.add(this.add.text(sx + sacW / 2, y + sacH / 2 - 10, getMonsterEmoji(sac.id), {
          fontFamily: 'sans-serif', fontSize: '22px',
        }).setOrigin(0.5));
        // XP value
        const rarityVal = sac.rarity ?? getMonsterRarity(sac.id);
        const xpVal = RARITY_XP_VALUES[rarityVal] ?? 30;
        c.add(this.add.text(sx + sacW / 2, y + sacH - 12, `+${xpVal} XP`, {
          fontFamily: 'sans-serif', fontSize: '7px', color: '#cc8844',
        }).setOrigin(0.5));
        // Remove (×) tap
        const xBtn = this.add.text(sx + sacW - 3, y + 3, '×', {
          fontFamily: 'sans-serif', fontSize: '12px', color: '#aa4422',
        }).setOrigin(1, 0).setInteractive();
        const fi = i;
        xBtn.on('pointerdown', () => {
          this.absorbSacrifices.splice(fi, 1);
          this.renderTabContent();
        });
        c.add(xBtn);
      } else if (this.absorbSacrifices.length < maxSacs) {
        // Empty add slot
        const sg = this.add.graphics();
        sg.fillStyle(0x0d0600, 1);
        sg.fillRoundedRect(sx, y, sacW, sacH, 5);
        sg.lineStyle(1, 0x331a00, 0.8);
        sg.strokeRoundedRect(sx, y, sacW, sacH, 5);
        c.add(sg);
        c.add(this.add.text(sx + sacW / 2, y + sacH / 2, '+', {
          fontFamily: 'sans-serif', fontSize: '20px', color: '#331a00',
        }).setOrigin(0.5));
        const addZone = this.add.zone(sx, y, sacW, sacH).setOrigin(0).setInteractive();
        addZone.on('pointerdown', () => {
          const currentTarget = this.absorbTarget;
          this.openMonsterPicker(
            currentTarget ? (m: OwnedMonster) => m.id !== currentTarget.id : undefined,
            (m) => { this.absorbSacrifices.push(m); this.renderTabContent(); },
          );
        });
        c.add(addZone);
      }
    }

    y += slotH + 14;

    // XP preview
    if (this.absorbSacrifices.length > 0 && this.absorbTarget) {
      let totalXP = 0;
      let sameTypeCount = 0;
      for (const sac of this.absorbSacrifices) {
        const r = sac.rarity ?? getMonsterRarity(sac.id);
        totalXP += RARITY_XP_VALUES[r] ?? 30;
        if (getBaseId(sac.id) === getBaseId(this.absorbTarget.id)) sameTypeCount++;
      }
      const currentStacks = this.absorbTarget.absorptionStacks ?? 0;
      const newStacks     = Math.min(currentStacks + sameTypeCount, 10);
      c.add(this.add.text(CANVAS_WIDTH / 2, y, `XP 획득: +${totalXP}  /  같은 종류 보너스: ${currentStacks}스택 → ${newStacks}스택`, {
        fontFamily: 'Georgia, serif', fontSize: '11px', color: '#cc8844', align: 'center',
        wordWrap: { width: CANVAS_WIDTH - 40 },
      }).setOrigin(0.5));
      if (sameTypeCount > 0) {
        c.add(this.add.text(CANVAS_WIDTH / 2, y + 18, `ATK +${newStacks * 5}% (스택 ×${newStacks})`, {
          fontFamily: 'sans-serif', fontSize: '10px', color: '#ffaa44',
        }).setOrigin(0.5));
      }
      y += 40;
    }

    // Execute button
    const canExec = this.absorbTarget !== null && this.absorbSacrifices.length > 0;
    const btn = this.add.text(CANVAS_WIDTH / 2, y + 10, canExec ? '🍴 흡수 실행' : '슬롯을 채우세요', {
      fontFamily: 'Georgia, serif', fontSize: '15px',
      color: canExec ? '#cc8844' : '#553322', fontStyle: 'bold',
      backgroundColor: canExec ? '#2a1400' : '#0d0800',
      padding: { x: 28, y: 10 },
    }).setOrigin(0.5);
    if (canExec) btn.setInteractive().on('pointerdown', () => this.executeAbsorption());
    c.add(btn);

    c.add(this.add.text(CANVAS_WIDTH / 2, CANVAS_HEIGHT - 50,
      '같은 속성 희생 시 ATK 스택 +5% (최대 ×10)', {
        fontFamily: 'sans-serif', fontSize: '10px', color: '#553322',
      }).setOrigin(0.5));
  }

  private executeAbsorption(): void {
    const target = this.absorbTarget;
    if (!target || this.absorbSacrifices.length === 0) return;

    const gs = loadGameState();
    let totalXP = 0;
    let sameTypeCount = 0;

    for (const sac of this.absorbSacrifices) {
      const r = sac.rarity ?? getMonsterRarity(sac.id);
      totalXP += RARITY_XP_VALUES[r] ?? 30;
      if (getBaseId(sac.id) === getBaseId(target.id)) sameTypeCount++;
      // Remove sacrifice from roster
      const idx = gs.ownedMonsters.findIndex(m => m.id === sac.id && m !== target);
      if (idx >= 0) gs.ownedMonsters.splice(idx, 1);
    }

    // Find target in roster and apply XP + stacks
    const tgt = gs.ownedMonsters.find(m => m.id === target.id);
    if (tgt) {
      addXp(tgt, totalXP);
      const newStacks = Math.min((tgt.absorptionStacks ?? 0) + sameTypeCount, 10);
      tgt.absorptionStacks = newStacks;
      logger.debug(`[ABSORB] ${target.id}: +${totalXP} XP, stacks: ${newStacks}/10 (+5% ATK per stack)`);
    }

    updateQuestObjective(gs, 'fuse_monsters'); tickSubQuestProgress(gs, 'fuse_monsters');
    saveGameState(gs);

    this.absorbSacrifices = [];
    this.absorbTarget = null;
    this.showFusionAnimation('흡수', () => {
      this.renderTabContent();
      const stackMsg = sameTypeCount > 0 ? ` · ATK 스택 +${sameTypeCount}` : '';
      this.showResultToast(`흡수 완료! +${totalXP} XP${stackMsg}`, '#cc8844');
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // TAB 3 — 조합 (Combination)
  // ─────────────────────────────────────────────────────────────────────────

  private buildCombineTab(c: Phaser.GameObjects.Container): void {
    const LY    = CONTENT_Y + 250;
    const slotW = 80, slotH = 90;
    const gap   = 60;
    const totalW = 2 * slotW + gap;
    const sx0   = (CANVAS_WIDTH - totalW) / 2;

    c.add(this.add.text(CANVAS_WIDTH / 2, LY - 26,
      '서로 다른 몬스터 2마리 + 💎 100 → 혼종 탄생', {
        fontFamily: 'Georgia, serif', fontSize: '10px', color: '#4488cc',
        wordWrap: { width: CANVAS_WIDTH - 40 }, align: 'center',
      }).setOrigin(0.5));

    // Slot A
    this.drawMonsterSlot(c, sx0, LY, slotW, slotH, this.combineSlots[0], '조합', () => {
      this.openMonsterPicker(undefined, (m) => { this.combineSlots[0] = m; this.renderTabContent(); });
    });
    // + separator
    c.add(this.add.text(sx0 + slotW + gap / 2, LY + slotH / 2, '+', {
      fontFamily: 'Georgia, serif', fontSize: '22px', color: '#4488cc',
    }).setOrigin(0.5));
    // Slot B — must be different type
    this.drawMonsterSlot(c, sx0 + slotW + gap, LY, slotW, slotH, this.combineSlots[1], '조합', () => {
      const a = this.combineSlots[0];
      this.openMonsterPicker(
        a ? (m: OwnedMonster) => getBaseId(m.id) !== getBaseId(a.id) : undefined,
        (m) => { this.combineSlots[1] = m; this.renderTabContent(); },
      );
    });

    // Crystal cost
    const gs = loadGameState();
    c.add(this.add.text(CANVAS_WIDTH / 2, LY + slotH + 14, `💎 보유 수정: ${gs.soulCrystals} / 필요: 100`, {
      fontFamily: 'sans-serif', fontSize: '11px',
      color: gs.soulCrystals >= 100 ? '#4488cc' : '#aa2222',
    }).setOrigin(0.5));

    // Result arrow + slot
    const arrowY  = LY + slotH + 42;
    c.add(this.add.text(CANVAS_WIDTH / 2, arrowY, '▼', {
      fontFamily: 'sans-serif', fontSize: '16px', color: '#4488cc',
    }).setOrigin(0.5));

    const resultX = (CANVAS_WIDTH - slotW) / 2;
    const resultY = arrowY + 22;
    const bothFilled = this.combineSlots[0] !== null && this.combineSlots[1] !== null;

    if (bothFilled) {
      const key      = combinationKey(this.combineSlots[0]!.id, this.combineSlots[1]!.id);
      const hybridId = COMBINATION_TABLE[key];
      const hybrid   = hybridId ? HYBRID_DEFS[hybridId] : undefined;

      const rg = this.add.graphics();
      rg.fillStyle(0x00080d, 1);
      rg.fillRoundedRect(resultX, resultY, slotW, slotH, 6);
      rg.lineStyle(1.5, 0x4488cc, hybrid ? 0.9 : 0.3);
      rg.strokeRoundedRect(resultX, resultY, slotW, slotH, 6);
      c.add(rg);

      if (hybrid) {
        c.add(this.add.text(resultX + slotW / 2, resultY + 22, hybrid.emoji, {
          fontFamily: 'sans-serif', fontSize: '22px',
        }).setOrigin(0.5));
        c.add(this.add.text(resultX + slotW / 2, resultY + 46, RARITY_STARS[hybrid.rarity], {
          fontFamily: 'sans-serif', fontSize: '10px',
        }).setOrigin(0.5));
        c.add(this.add.text(resultX + slotW / 2, resultY + 62, hybrid.name, {
          fontFamily: 'sans-serif', fontSize: '7px', color: RARITY_COLORS[hybrid.rarity],
          wordWrap: { width: slotW - 4 },
        }).setOrigin(0.5));
      } else {
        c.add(this.add.text(resultX + slotW / 2, resultY + slotH / 2, '?', {
          fontFamily: 'Georgia, serif', fontSize: '26px', color: '#1a3322',
        }).setOrigin(0.5));
      }
    } else {
      this.drawResultSlot(c, resultX, resultY, slotW, slotH, '조합');
    }

    const allReady = bothFilled && gs.soulCrystals >= 100;
    const btn = this.add.text(CANVAS_WIDTH / 2, resultY + slotH + 28,
      allReady ? '🧪 조합 시도 (-💎 100)' : bothFilled ? '💎 부족 (100 필요)' : '조건 미충족', {
        fontFamily: 'Georgia, serif', fontSize: '14px',
        color: allReady ? '#4488cc' : '#2a3a55', fontStyle: 'bold',
        backgroundColor: allReady ? '#001433' : '#000810',
        padding: { x: 20, y: 10 },
      }).setOrigin(0.5);
    if (allReady) btn.setInteractive().on('pointerdown', () => this.executeCombination());
    c.add(btn);
  }

  private executeCombination(): void {
    const [slotA, slotB] = this.combineSlots;
    if (!slotA || !slotB) return;

    const gs  = loadGameState();
    if (gs.soulCrystals < 100) return;
    gs.soulCrystals -= 100;

    const key      = combinationKey(slotA.id, slotB.id);
    const hybridId = COMBINATION_TABLE[key];

    if (hybridId) {
      const hybrid   = HYBRID_DEFS[hybridId];
      const isNew    = !(gs.discoveredCombinations ?? []).includes(hybridId);
      if (isNew) {
        gs.discoveredCombinations = [...(gs.discoveredCombinations ?? []), hybridId];
        logger.debug(`[COMBINATION] NEW DISCOVERY: ${hybridId} — ${hybrid.name}`);
      }

      // Create hybrid monster
      const avgLevel = Math.round((slotA.level + slotB.level) / 2);
      const newMonster: OwnedMonster = {
        id: hybridId, level: avgLevel, xp: 0,
        skillPoints: 0, spentSkills: {}, equippedSkills: [], equipment: null,
        rarity: hybrid.rarity, absorptionStacks: 0,
      };
      gs.ownedMonsters.push(newMonster);
      updateQuestObjective(gs, 'fuse_monsters'); tickSubQuestProgress(gs, 'fuse_monsters');
      saveGameState(gs);

      this.combineSlots = [null, null];
      this.showFusionAnimation('조합', () => {
        this.drawHeader();        // refresh codex count
        this.renderTabContent();
        if (isNew) {
          this.showDiscoveryFanfare(hybrid.emoji, hybrid.name, hybrid.rarity);
        } else {
          this.showResultToast(`${hybrid.name} 조합 성공!`, '#4488cc');
        }
      });
    } else {
      // Failed combination
      logger.debug(`[COMBINATION] FAILED: ${key} — no known recipe`);
      saveGameState(gs);
      this.combineSlots = [null, null];
      this.showFailAnimation(() => {
        this.renderTabContent();
        this.showResultToast('이 조합은 효과가 없습니다', '#885533');
      });
    }
  }

  private showDiscoveryFanfare(emoji: string, name: string, rarity: number): void {
    const c = this.add.container(0, 0).setDepth(80);
    const dim = this.add.graphics();
    dim.fillStyle(0x000000, 0.85);
    dim.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    c.add(dim);

    c.add(this.add.text(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 80, '✨ 새로운 조합 발견! ✨', {
      fontFamily: 'Georgia, serif', fontSize: '20px', color: RARITY_COLORS[rarity], fontStyle: 'bold',
    }).setOrigin(0.5));
    c.add(this.add.text(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 24, emoji, {
      fontFamily: 'sans-serif', fontSize: '64px',
    }).setOrigin(0.5));
    c.add(this.add.text(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 48, name, {
      fontFamily: 'Georgia, serif', fontSize: '22px', color: RARITY_COLORS[rarity], fontStyle: 'bold',
    }).setOrigin(0.5));
    c.add(this.add.text(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 80, RARITY_STARS[rarity], {
      fontFamily: 'sans-serif', fontSize: '18px',
    }).setOrigin(0.5));

    c.setAlpha(0);
    this.tweens.add({ targets: c, alpha: 1, duration: 300, ease: 'Quad.easeOut' });
    this.time.delayedCall(2800, () => {
      this.tweens.add({
        targets: c, alpha: 0, duration: 400,
        onComplete: () => c.destroy(true),
      });
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // TAB 4 — 각성 (Awakening)
  // ─────────────────────────────────────────────────────────────────────────

  private buildAwakenTab(c: Phaser.GameObjects.Container): void {
    const gs  = loadGameState();
    const PAD = 16;
    const rowH = 70;
    const rowW = CANVAS_WIDTH - PAD * 2;
    let   y    = CONTENT_Y + 238;

    c.add(this.add.text(CANVAS_WIDTH / 2, y - 22,
      `친밀도 100 + 각성석 1개 → 몬스터 각성   🪨 보유: ${gs.awakeningStones ?? 0}개`, {
        fontFamily: 'Georgia, serif', fontSize: '11px', color: '#cc44cc',
      }).setOrigin(0.5));

    const monsters = gs.ownedMonsters;
    if (!monsters.length) {
      c.add(this.add.text(CANVAS_WIDTH / 2, y + 50, '보유 몬스터 없음', {
        fontFamily: 'Georgia, serif', fontSize: '13px', color: '#442244',
      }).setOrigin(0.5));
      return;
    }

    monsters.forEach((m, i) => {
      const ry       = y + i * (rowH + 6);
      const affinity = gs.monsterAffinity?.[m.id] ?? 0;
      const awakened = gs.monsterAwakened?.[m.id] ?? false;
      const stones   = gs.awakeningStones ?? 0;
      const eligible = affinity >= 100 && !awakened && stones >= 1;

      const rg = this.add.graphics().setDepth(3);
      const borderCol = awakened ? 0xcc44cc : eligible ? 0x663366 : 0x1a0a1a;
      rg.fillStyle(0x0d040d, 1);
      rg.fillRoundedRect(PAD, ry, rowW, rowH - 4, 6);
      rg.lineStyle(1.5, borderCol, awakened ? 1 : 0.7);
      rg.strokeRoundedRect(PAD, ry, rowW, rowH - 4, 6);
      c.add(rg);

      // Emoji + name + level
      c.add(this.add.text(PAD + 24, ry + (rowH - 4) / 2, getMonsterEmoji(m.id), {
        fontFamily: 'sans-serif', fontSize: '26px',
      }).setOrigin(0.5));

      c.add(this.add.text(PAD + 48, ry + 10, getMonsterDisplayName(m.id), {
        fontFamily: 'Georgia, serif', fontSize: '12px',
        color: awakened ? '#cc44cc' : '#c8b090',
      }));
      c.add(this.add.text(PAD + 48, ry + 26, `Lv.${m.level}`, {
        fontFamily: 'sans-serif', fontSize: '9px', color: '#664466',
      }));

      // Affinity bar
      const barX = PAD + 48, barY = ry + 40, barW = 120, barH = 6;
      const barBg = this.add.graphics();
      barBg.fillStyle(0x220022, 1);
      barBg.fillRoundedRect(barX, barY, barW, barH, 2);
      if (affinity > 0) {
        barBg.fillStyle(0xcc44cc, 1);
        barBg.fillRoundedRect(barX, barY, Math.round(barW * affinity / 100), barH, 2);
      }
      c.add(barBg);
      c.add(this.add.text(barX + barW + 4, barY + 3, `${affinity}/100`, {
        fontFamily: 'sans-serif', fontSize: '8px', color: '#884488',
      }).setOrigin(0, 0.5));

      // Right side: action or status
      if (awakened) {
        c.add(this.add.text(CANVAS_WIDTH - PAD - 6, ry + (rowH - 4) / 2, '✨ 각성 완료', {
          fontFamily: 'Georgia, serif', fontSize: '10px', color: '#cc44cc',
        }).setOrigin(1, 0.5));
        const ap = AWAKENED_PASSIVES[getBaseId(m.id)];
        if (ap) {
          c.add(this.add.text(CANVAS_WIDTH - PAD - 6, ry + (rowH - 4) / 2 + 14, ap.desc, {
            fontFamily: 'sans-serif', fontSize: '8px', color: '#884488',
          }).setOrigin(1, 0.5));
        }
      } else if (eligible) {
        const awakBtn = this.add.text(CANVAS_WIDTH - PAD - 6, ry + (rowH - 4) / 2, '⚡ 각성 실행', {
          fontFamily: 'Georgia, serif', fontSize: '11px', color: '#cc44cc', fontStyle: 'bold',
          backgroundColor: '#2a003a', padding: { x: 8, y: 4 },
        }).setOrigin(1, 0.5).setInteractive();
        awakBtn.on('pointerdown', () => this.confirmAwakening(m));
        c.add(awakBtn);
      } else {
        const reasons: string[] = [];
        if (affinity < 100) reasons.push(`친밀도 ${affinity}/100`);
        if (stones < 1)     reasons.push('각성석 필요');
        c.add(this.add.text(CANVAS_WIDTH - PAD - 6, ry + (rowH - 4) / 2, reasons.join(' · '), {
          fontFamily: 'sans-serif', fontSize: '9px', color: '#442244',
        }).setOrigin(1, 0.5));
      }
    });
  }

  private confirmAwakening(monster: OwnedMonster): void {
    const name = getMonsterDisplayName(monster.id);
    const ov = this.add.container(0, 0).setDepth(80);
    const dim = this.add.graphics();
    dim.fillStyle(0x000000, 0.75);
    dim.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    ov.add(dim);

    const PW = 300, PH = 180;
    const PX = (CANVAS_WIDTH - PW) / 2, PY = (CANVAS_HEIGHT - PH) / 2;
    const pg = this.add.graphics();
    pg.fillStyle(0x0d000d, 1);
    pg.fillRoundedRect(PX, PY, PW, PH, 8);
    pg.lineStyle(2, 0xcc44cc, 0.9);
    pg.strokeRoundedRect(PX, PY, PW, PH, 8);
    ov.add(pg);

    ov.add(this.add.text(CANVAS_WIDTH / 2, PY + 28, '각성 확인', {
      fontFamily: 'Georgia, serif', fontSize: '17px', color: '#cc44cc', fontStyle: 'bold',
    }).setOrigin(0.5));
    ov.add(this.add.text(CANVAS_WIDTH / 2, PY + 60,
      `각성을 실행하면 각성석 1개가\n소모됩니다. 계속하시겠습니까?`, {
        fontFamily: 'sans-serif', fontSize: '12px', color: '#c8b0c8',
        align: 'center', lineSpacing: 6,
      }).setOrigin(0.5));
    ov.add(this.add.text(CANVAS_WIDTH / 2, PY + 95, `▶ ${name}`, {
      fontFamily: 'Georgia, serif', fontSize: '12px', color: '#884488',
    }).setOrigin(0.5));

    const confirmBtn = this.add.text(CANVAS_WIDTH / 2 - 52, PY + PH - 36, '확인', {
      fontFamily: 'Georgia, serif', fontSize: '14px', color: '#cc44cc',
      backgroundColor: '#2a003a', padding: { x: 22, y: 8 },
    }).setOrigin(0.5).setInteractive();
    confirmBtn.on('pointerdown', () => { ov.destroy(true); this.executeAwakening(monster); });
    ov.add(confirmBtn);

    const cancelBtn = this.add.text(CANVAS_WIDTH / 2 + 52, PY + PH - 36, '취소', {
      fontFamily: 'Georgia, serif', fontSize: '14px', color: '#664466',
      backgroundColor: '#150015', padding: { x: 22, y: 8 },
    }).setOrigin(0.5).setInteractive();
    cancelBtn.on('pointerdown', () => ov.destroy(true));
    ov.add(cancelBtn);

    ov.setAlpha(0);
    this.tweens.add({ targets: ov, alpha: 1, duration: 200, ease: 'Quad.easeOut' });
  }

  private executeAwakening(monster: OwnedMonster): void {
    const gs = loadGameState();
    if ((gs.awakeningStones ?? 0) < 1) return;

    gs.awakeningStones = (gs.awakeningStones ?? 0) - 1;
    gs.monsterAwakened[monster.id] = true;

    // Apply +15% stat bonus by boosting absorptionStacks as proxy
    const tgt = gs.ownedMonsters.find(m => m.id === monster.id);
    if (tgt) {
      tgt.absorptionStacks = (tgt.absorptionStacks ?? 0) + 3; // represents +15% ATK
    }

    saveGameState(gs);
    logger.debug(`[AWAKEN] ${monster.id} awakened! Stones remaining: ${gs.awakeningStones}`);

    this.showFusionAnimation('각성', () => {
      this.renderTabContent();
      this.showResultToast(`${getMonsterDisplayName(monster.id)} 각성 완료!`, '#cc44cc');
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Shared: Monster slot drawing
  // ─────────────────────────────────────────────────────────────────────────

  private drawMonsterSlot(
    c: Phaser.GameObjects.Container,
    x: number, y: number, w: number, h: number,
    monster: OwnedMonster | null,
    tabId: TabId,
    onTap: () => void,
  ): void {
    const accent    = TAB_ACCENT[tabId];
    const accentCSS = TAB_ACCENT_CSS[tabId];
    const g = this.add.graphics();
    c.add(g);

    if (monster) {
      g.fillStyle(0x001408, 1);
      g.fillRoundedRect(x, y, w, h, 6);
      g.lineStyle(1.5, accent, 0.7);
      g.strokeRoundedRect(x, y, w, h, 6);

      c.add(this.add.text(x + w / 2, y + h / 2 - 12, getMonsterEmoji(monster.id), {
        fontFamily: 'sans-serif', fontSize: '26px',
      }).setOrigin(0.5));
      c.add(this.add.text(x + w / 2, y + h / 2 + 12, `Lv.${monster.level}`, {
        fontFamily: 'sans-serif', fontSize: '9px', color: '#669977',
      }).setOrigin(0.5));
      const rarity = monster.rarity ?? getMonsterRarity(monster.id);
      if (rarity > 0) {
        c.add(this.add.text(x + w / 2, y + h - 12, RARITY_STARS[rarity], {
          fontFamily: 'sans-serif', fontSize: '8px',
        }).setOrigin(0.5));
      }
    } else {
      g.fillStyle(0x000e06, 1);
      g.fillRoundedRect(x, y, w, h, 6);
      g.lineStyle(1, 0x1a3322, 0.8);
      g.strokeRoundedRect(x, y, w, h, 6);
      g.lineStyle(1, 0x1a3322, 0.5);
      g.lineBetween(x + 8, y + h / 2, x + w - 8, y + h / 2);
      g.lineBetween(x + w / 2, y + 8, x + w / 2, y + h - 8);
      c.add(this.add.text(x + w / 2, y + h / 2, '+', {
        fontFamily: 'sans-serif', fontSize: '20px', color: accentCSS,
      }).setOrigin(0.5).setAlpha(0.4));
    }

    const zone = this.add.zone(x, y, w, h).setOrigin(0).setInteractive();
    zone.on('pointerdown', onTap);
    c.add(zone);
  }

  private drawResultSlot(
    c: Phaser.GameObjects.Container,
    x: number, y: number, w: number, h: number, tabId: TabId,
  ): void {
    const accent = TAB_ACCENT[tabId];
    const g = this.add.graphics();
    g.fillStyle(0x001408, 1);
    g.fillRoundedRect(x, y, w, h, 6);
    g.lineStyle(1.5, accent, 0.3);
    g.strokeRoundedRect(x, y, w, h, 6);
    c.add(g);
    c.add(this.add.text(x + w / 2, y + h / 2, '?', {
      fontFamily: 'Georgia, serif', fontSize: '26px', color: '#1a3322',
    }).setOrigin(0.5));
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Monster picker modal (shared)
  // ─────────────────────────────────────────────────────────────────────────

  private openMonsterPicker(
    filter: ((m: OwnedMonster) => boolean) | undefined,
    onSelect: (m: OwnedMonster) => void,
  ): void {
    const gs       = loadGameState();
    const monsters = filter ? gs.ownedMonsters.filter(filter) : gs.ownedMonsters;

    const SHEET_H  = 360;
    const targetY  = CANVAS_HEIGHT - SHEET_H;
    const c        = this.add.container(0, CANVAS_HEIGHT).setDepth(50);

    const dim = this.add.graphics();
    dim.fillStyle(0x000000, 0.6);
    dim.fillRect(0, -CANVAS_HEIGHT, CANVAS_WIDTH, CANVAS_HEIGHT);
    dim.setInteractive();
    dim.on('pointerdown', slideDown);
    c.add(dim);

    const sg = this.add.graphics();
    sg.fillStyle(0x000e08, 1);
    sg.fillRoundedRect(0, 0, CANVAS_WIDTH, SHEET_H, { tl: 12, tr: 12, bl: 0, br: 0 });
    sg.lineStyle(1.5, 0x00cc66, 0.4);
    sg.strokeRoundedRect(0, 0, CANVAS_WIDTH, SHEET_H, { tl: 12, tr: 12, bl: 0, br: 0 });
    c.add(sg);

    c.add(this.add.text(CANVAS_WIDTH / 2, 18, '몬스터 선택', {
      fontFamily: 'Georgia, serif', fontSize: '15px', color: '#44cc88',
    }).setOrigin(0.5));

    if (monsters.length === 0) {
      c.add(this.add.text(CANVAS_WIDTH / 2, SHEET_H / 2, '조건에 맞는 몬스터 없음', {
        fontFamily: 'Georgia, serif', fontSize: '13px', color: '#335544',
      }).setOrigin(0.5));
    }

    const cols = 4;
    const cellW = 72, cellH = 78;
    const padX  = (CANVAS_WIDTH - cols * cellW) / (cols + 1);
    monsters.forEach((m, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const mx  = padX + col * (cellW + padX);
      const my  = 40 + row * (cellH + 8);

      const mg = this.add.graphics();
      mg.fillStyle(0x001408, 1);
      mg.fillRoundedRect(mx, my, cellW, cellH, 6);
      mg.lineStyle(1, 0x003322, 0.8);
      mg.strokeRoundedRect(mx, my, cellW, cellH, 6);
      c.add(mg);

      c.add(this.add.text(mx + cellW / 2, my + cellH / 2 - 12, getMonsterEmoji(m.id), {
        fontFamily: 'sans-serif', fontSize: '22px',
      }).setOrigin(0.5));
      c.add(this.add.text(mx + cellW / 2, my + cellH / 2 + 8, `Lv.${m.level}`, {
        fontFamily: 'sans-serif', fontSize: '9px', color: '#44aa66',
      }).setOrigin(0.5));
      const rarity = m.rarity ?? getMonsterRarity(m.id);
      if (rarity > 0) {
        c.add(this.add.text(mx + cellW / 2, my + cellH - 10, RARITY_STARS[rarity], {
          fontFamily: 'sans-serif', fontSize: '7px',
        }).setOrigin(0.5));
      }

      const zone = this.add.zone(mx, my, cellW, cellH).setOrigin(0).setInteractive();
      zone.on('pointerdown', () => { slideDown(); onSelect(m); });
      c.add(zone);
    });

    let y = CANVAS_HEIGHT;
    const ti = setInterval(() => {
      y = Math.max(targetY, y - 40);
      c.setY(y);
      if (y <= targetY) clearInterval(ti);
    }, 28);

    function slideDown() {
      let sy = c.y;
      const td = setInterval(() => {
        sy = Math.min(CANVAS_HEIGHT, sy + 40);
        c.setY(sy);
        if (sy >= CANVAS_HEIGHT) { clearInterval(td); c.destroy(true); }
      }, 28);
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
    dim.fillStyle(0x000000, 0.85);
    dim.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    dim.setInteractive();
    dim.on('pointerdown', () => ov.destroy(true));
    ov.add(dim);

    const PW = CANVAS_WIDTH - 32, PH = CANVAS_HEIGHT - 120;
    const PX = 16, PY = 60;
    const pg = this.add.graphics();
    pg.fillStyle(0x000e08, 1);
    pg.fillRoundedRect(PX, PY, PW, PH, 10);
    pg.lineStyle(1.5, 0x4488cc, 0.7);
    pg.strokeRoundedRect(PX, PY, PW, PH, 10);
    ov.add(pg);

    ov.add(this.add.text(CANVAS_WIDTH / 2, PY + 22, `조합 도감 [${discovered.length}/${total}]`, {
      fontFamily: 'Georgia, serif', fontSize: '16px', color: '#4488cc', fontStyle: 'bold',
    }).setOrigin(0.5));

    const closeX = this.add.text(PX + PW - 10, PY + 10, '✕', {
      fontFamily: 'sans-serif', fontSize: '16px', color: '#224422',
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
      row.fillStyle(0x001208, 1);
      row.fillRoundedRect(PX + rowPad, ry, PW - rowPad * 2, rowH - 4, 5);
      ov.add(row);

      if (isKnown) {
        ov.add(this.add.text(PX + rowPad + 12, ry + (rowH - 4) / 2,
          `${a} + ${b} → ${hybrid.emoji} ${hybrid.name}`, {
            fontFamily: 'sans-serif', fontSize: '11px', color: RARITY_COLORS[hybrid.rarity],
          }).setOrigin(0, 0.5));
        ov.add(this.add.text(PX + PW - rowPad - 8, ry + (rowH - 4) / 2,
          RARITY_STARS[hybrid.rarity], {
            fontFamily: 'sans-serif', fontSize: '9px',
          }).setOrigin(1, 0.5));
      } else {
        ov.add(this.add.text(PX + rowPad + 12, ry + (rowH - 4) / 2, '??? + ??? → ???', {
          fontFamily: 'sans-serif', fontSize: '11px', color: '#1a3322',
        }).setOrigin(0, 0.5));
      }
      ry += rowH;
    });

    ov.setAlpha(0);
    this.tweens.add({ targets: ov, alpha: 1, duration: 200 });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Fusion animations
  // ─────────────────────────────────────────────────────────────────────────

  private showFusionAnimation(tabId: TabId, onComplete: () => void): void {
    const overlay = this.add.graphics().setDepth(60);
    overlay.fillStyle(0x000000, 0);
    overlay.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    const label = this.add.text(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, '⚗️', {
      fontFamily: 'sans-serif', fontSize: '64px',
    }).setOrigin(0.5).setDepth(61).setAlpha(0);

    const sub = this.add.text(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 60, '합성 중...', {
      fontFamily: 'Georgia, serif', fontSize: '16px', color: TAB_ACCENT_CSS[tabId],
    }).setOrigin(0.5).setDepth(61).setAlpha(0);

    this.tweens.add({ targets: [label, sub], alpha: 1, duration: 300, ease: 'Quad.easeOut' });
    this.tweens.add({ targets: label, rotation: Math.PI * 2, duration: 1200, ease: 'Linear' });
    if (this.cauldronEmoji) {
      this.tweens.add({
        targets: this.cauldronEmoji, scaleX: 1.5, scaleY: 1.5,
        duration: 600, yoyo: true, ease: 'Back.easeOut',
      });
    }

    this.time.delayedCall(1600, () => {
      this.tweens.add({
        targets: [label, sub, overlay], alpha: 0, duration: 300,
        onComplete: () => { label.destroy(); sub.destroy(); overlay.destroy(); onComplete(); },
      });
    });
  }

  private showFailAnimation(onComplete: () => void): void {
    const smoke = this.add.text(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, '💨', {
      fontFamily: 'sans-serif', fontSize: '64px',
    }).setOrigin(0.5).setDepth(61).setAlpha(0);
    this.tweens.add({ targets: smoke, alpha: 1, scaleX: 1.5, scaleY: 1.5, duration: 300 });
    this.time.delayedCall(900, () => {
      this.tweens.add({
        targets: smoke, alpha: 0, duration: 300,
        onComplete: () => { smoke.destroy(); onComplete(); },
      });
    });
  }

  private showResultToast(msg: string, color: string): void {
    const t = this.add.text(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, msg, {
      fontFamily: 'Georgia, serif', fontSize: '17px', color, fontStyle: 'bold',
      backgroundColor: '#001208', padding: { x: 18, y: 10 },
    }).setOrigin(0.5).setDepth(65).setAlpha(0);
    this.tweens.add({ targets: t, alpha: 1, y: t.y - 20, duration: 350, ease: 'Back.easeOut' });
    this.time.delayedCall(1800, () => {
      this.tweens.add({
        targets: t, alpha: 0, duration: 300,
        onComplete: () => t.destroy(),
      });
    });
  }
}
