import Phaser from 'phaser';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../constants/layout';
import { loadGameState, saveGameState } from '../data/wisdom';
import {
  BLUEPRINT_DEFS, MATERIAL_DEFS, RARITY_COLORS, RARITY_NAMES,
  type BlueprintDef,
} from '../data/fusion';
import { logger } from '../utils/logger';

// ─── Layout ───────────────────────────────────────────────────────────────────

const HEADER_H  = 64;
const TAB_H     = 40;
const CONTENT_Y = HEADER_H + TAB_H;

// ─── Scene ────────────────────────────────────────────────────────────────────

export class ForgeScene extends Phaser.Scene {
  private activeTab: 'craft' | 'dismantle' = 'craft';
  private contentContainer?: Phaser.GameObjects.Container;
  private tabContainer?: Phaser.GameObjects.Container;
  private headerContainer?: Phaser.GameObjects.Container;
  private selectedBpId: string | null = null;
  private selectedEqIdx: number | null = null;

  constructor() { super({ key: 'ForgeScene' }); }

  // ─── Lifecycle ────────────────────────────────────────────────────────────

  create(): void {
    this.activeTab    = 'craft';
    this.selectedBpId = null;
    this.selectedEqIdx = null;

    this.drawBackground();
    this.drawHeader();
    this.drawTabBar();
    this.renderContent();

    this.cameras.main.fadeIn(220, 0, 0, 0);
  }

  // ─── Background ──────────────────────────────────────────────────────────

  private drawBackground(): void {
    const g = this.add.graphics().setDepth(-10);
    g.fillStyle(0x100a00, 1);
    g.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    g.lineStyle(1, 0x2a1800, 0.5);
    for (let y = 0; y < CANVAS_HEIGHT; y += 40) g.lineBetween(0, y, CANVAS_WIDTH, y);
    for (let x = 0; x < CANVAS_WIDTH; x += 40) g.lineBetween(x, 0, x, CANVAS_HEIGHT);

    const glow = this.add.graphics().setDepth(-9);
    glow.fillStyle(0xff6600, 0.04);
    glow.fillCircle(CANVAS_WIDTH / 2, CONTENT_Y + 200, 200);
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

    c.add(this.add.text(CANVAS_WIDTH / 2, HEADER_H / 2, '⚒️ 대장간', {
      fontFamily: 'Georgia, serif', fontSize: '20px', color: '#ffaa44',
    }).setOrigin(0.5));

    const back = this.add.text(18, HEADER_H / 2, '← 뒤로', {
      fontFamily: 'sans-serif', fontSize: '13px', color: '#cc9944',
      backgroundColor: '#1a0800', padding: { x: 8, y: 4 },
    }).setOrigin(0, 0.5).setInteractive();
    back.on('pointerdown', () => {
      this.cameras.main.fadeOut(200, 0, 0, 0);
      this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('DungeonHomeScene'));
    });
    c.add(back);

    // Material inventory strip (right side of header)
    const gs = loadGameState();
    const matLine = Object.entries(gs.materials ?? {})
      .filter(([, qty]) => qty > 0)
      .map(([id, qty]) => `${MATERIAL_DEFS[id]?.emoji ?? '?'}×${qty}`)
      .join('  ');
    if (matLine) {
      c.add(this.add.text(CANVAS_WIDTH - 12, HEADER_H / 2, matLine, {
        fontFamily: 'sans-serif', fontSize: '10px', color: '#aa8844',
      }).setOrigin(1, 0.5));
    }

    // Awakening stones indicator
    const stones = gs.awakeningStones ?? 0;
    c.add(this.add.text(CANVAS_WIDTH - 12, HEADER_H - 14, `각성석: ${stones}`, {
      fontFamily: 'sans-serif', fontSize: '10px', color: '#cc44cc',
    }).setOrigin(1, 1));
  }

  // ─── Tab bar ─────────────────────────────────────────────────────────────

  private drawTabBar(): void {
    this.tabContainer?.destroy();
    const c = this.add.container(0, HEADER_H).setDepth(9);
    this.tabContainer = c;

    const bg = this.add.graphics();
    bg.fillStyle(0x0d0600, 1);
    bg.fillRect(0, 0, CANVAS_WIDTH, TAB_H);
    bg.lineStyle(1, 0x3a2000, 0.6);
    bg.lineBetween(0, TAB_H, CANVAS_WIDTH, TAB_H);
    c.add(bg);

    const tabs: Array<{ id: 'craft' | 'dismantle'; label: string }> = [
      { id: 'craft',    label: '⚒️  제작' },
      { id: 'dismantle', label: '🔨  분해' },
    ];
    const tw = CANVAS_WIDTH / tabs.length;

    tabs.forEach(({ id, label }, i) => {
      const isActive = id === this.activeTab;
      const x = i * tw;

      const tabBg = this.add.graphics();
      tabBg.fillStyle(isActive ? 0x2a1400 : 0x0d0600, 1);
      tabBg.fillRect(x, 0, tw, TAB_H);
      c.add(tabBg);

      const t = this.add.text(x + tw / 2, TAB_H / 2, label, {
        fontFamily: 'sans-serif', fontSize: '13px',
        color: isActive ? '#ffaa44' : '#886633',
      }).setOrigin(0.5).setInteractive();
      t.on('pointerdown', () => {
        if (this.activeTab !== id) {
          this.activeTab    = id;
          this.selectedBpId = null;
          this.selectedEqIdx = null;
          this.drawTabBar();
          this.renderContent();
        }
      });
      c.add(t);

      if (isActive) {
        const ul = this.add.graphics();
        ul.lineStyle(2, 0xffaa44, 1);
        ul.lineBetween(x + 8, TAB_H - 1, x + tw - 8, TAB_H - 1);
        c.add(ul);
      }
    });
  }

  // ─── Content dispatch ────────────────────────────────────────────────────

  private renderContent(): void {
    this.contentContainer?.destroy();
    const c = this.add.container(0, CONTENT_Y).setDepth(5);
    this.contentContainer = c;

    if (this.activeTab === 'craft')    this.buildCraftTab(c);
    else                               this.buildDismantleTab(c);
  }

  // ─── Craft tab ───────────────────────────────────────────────────────────

  private buildCraftTab(c: Phaser.GameObjects.Container): void {
    const gs = loadGameState();
    const owned = gs.blueprints ?? [];

    if (owned.length === 0) {
      c.add(this.add.text(CANVAS_WIDTH / 2, 120, '보유한 설계도가 없습니다.\n전투에서 설계도를 획득하세요.', {
        fontFamily: 'sans-serif', fontSize: '13px', color: '#886633',
        align: 'center', lineSpacing: 6,
      }).setOrigin(0.5, 0));
      return;
    }

    let oy = 10;
    const pad = 12;
    const rowH = 88;

    owned.forEach(bpId => {
      const bp = BLUEPRINT_DEFS[bpId];
      if (!bp) return;

      const isSelected = this.selectedBpId === bpId;
      const canCraft = this.canCraft(bp, gs.materials ?? {});

      const bg = this.add.graphics();
      bg.fillStyle(isSelected ? 0x2a1800 : 0x180d00, 1);
      bg.fillRoundedRect(pad, oy, CANVAS_WIDTH - pad * 2, rowH - 4, 6);
      bg.lineStyle(1.5, isSelected ? 0xffaa44 : (canCraft ? 0x664422 : 0x2a1a00), 1);
      bg.strokeRoundedRect(pad, oy, CANVAS_WIDTH - pad * 2, rowH - 4, 6);
      c.add(bg);

      // Rarity dot + item name
      const rarityColor = RARITY_COLORS[bp.rarity] ?? '#aaaaaa';
      c.add(this.add.text(pad + 10, oy + 10, `${bp.resultEmoji} ${bp.name}`, {
        fontFamily: 'Georgia, serif', fontSize: '14px', color: rarityColor,
      }));
      c.add(this.add.text(pad + 10, oy + 28, bp.statDesc, {
        fontFamily: 'sans-serif', fontSize: '11px', color: '#aa8844',
      }));

      // Material requirements
      const matStr = Object.entries(bp.materials)
        .map(([id, qty]) => {
          const have = gs.materials?.[id] ?? 0;
          const def = MATERIAL_DEFS[id];
          return `${def?.emoji ?? '?'}${def?.name ?? id} ${have}/${qty}`;
        }).join('  ');
      c.add(this.add.text(pad + 10, oy + 46, matStr, {
        fontFamily: 'sans-serif', fontSize: '10px', color: canCraft ? '#88cc66' : '#cc6644',
      }));

      // Craft button
      const btnW = 70, btnH = 28;
      const btnX = CANVAS_WIDTH - pad * 2 - btnW + 2;
      const btnY = oy + (rowH - 4 - btnH) / 2;

      const btnBg = this.add.graphics();
      btnBg.fillStyle(canCraft ? 0xcc5500 : 0x2a1a00, 1);
      btnBg.fillRoundedRect(btnX, btnY, btnW, btnH, 5);
      c.add(btnBg);

      const btnT = this.add.text(btnX + btnW / 2, btnY + btnH / 2, '제작', {
        fontFamily: 'sans-serif', fontSize: '12px',
        color: canCraft ? '#ffffff' : '#664433',
      }).setOrigin(0.5);
      c.add(btnT);

      if (canCraft) {
        const zone = this.add.zone(btnX + btnW / 2, btnY + btnH / 2, btnW, btnH).setInteractive();
        zone.on('pointerdown', () => this.executeCraft(bpId));
        c.add(zone);
      }

      // Tap row to select
      const rowZone = this.add.zone(CANVAS_WIDTH / 2, oy + (rowH - 4) / 2, CANVAS_WIDTH - pad * 2 - btnW - 4, rowH - 4).setInteractive();
      rowZone.on('pointerdown', () => {
        this.selectedBpId = this.selectedBpId === bpId ? null : bpId;
        this.renderContent();
      });
      c.add(rowZone);

      oy += rowH;
    });
  }

  private canCraft(bp: BlueprintDef, materials: Record<string, number>): boolean {
    return Object.entries(bp.materials).every(([id, qty]) => (materials[id] ?? 0) >= qty);
  }

  private executeCraft(bpId: string): void {
    const gs = loadGameState();
    const bp = BLUEPRINT_DEFS[bpId];
    if (!bp) return;
    if (!this.canCraft(bp, gs.materials ?? {})) return;

    // Deduct materials + per-material float feedback
    const matsBefore = { ...gs.materials };
    const matEntries = Object.entries(bp.materials);
    matEntries.forEach(([id, qty], i) => {
      gs.materials[id] = Math.max(0, (gs.materials[id] ?? 0) - qty);
      const emoji  = MATERIAL_DEFS[id]?.emoji ?? '?';
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

    // Create equipment entry
    gs.craftedEquipment = gs.craftedEquipment ?? [];
    gs.craftedEquipment.push({
      id:    bp.resultId,
      name:  bp.name,
      type:  bp.type,
      rarity: bp.rarity,
      emoji: bp.resultEmoji,
      stats: bp.stats,
    });

    saveGameState(gs);

    // Log
    const matLog = Object.entries(bp.materials)
      .map(([id]) => `${id}: ${matsBefore[id] ?? 0}→${gs.materials[id]}`)
      .join(', ');
    logger.debug(`[FORGE] ${bp.resultId} crafted ${matLog}`);

    this.showCraftAnimation(bp, () => {
      this.drawHeader();
      this.renderContent();
    });
  }

  private showCraftAnimation(bp: BlueprintDef, onComplete: () => void): void {
    const c = this.add.container(0, 0).setDepth(50);

    const dim = this.add.graphics();
    dim.fillStyle(0x000000, 0.7);
    dim.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    c.add(dim);

    const cx = CANVAS_WIDTH / 2;
    const cy = CANVAS_HEIGHT / 2;

    const box = this.add.graphics();
    box.fillStyle(0x1a0800, 1);
    box.fillRoundedRect(cx - 110, cy - 90, 220, 180, 10);
    box.lineStyle(2, 0xffaa44, 0.9);
    box.strokeRoundedRect(cx - 110, cy - 90, 220, 180, 10);
    c.add(box);

    const hammerT = this.add.text(cx, cy - 50, '⚒️', {
      fontFamily: 'sans-serif', fontSize: '42px',
    }).setOrigin(0.5);
    c.add(hammerT);

    c.add(this.add.text(cx, cy + 10, bp.name, {
      fontFamily: 'Georgia, serif', fontSize: '16px', color: RARITY_COLORS[bp.rarity] ?? '#ffaa44',
    }).setOrigin(0.5));

    const statusT = this.add.text(cx, cy + 40, '제작 중...', {
      fontFamily: 'sans-serif', fontSize: '12px', color: '#aa8844',
    }).setOrigin(0.5);
    c.add(statusT);

    // Use setInterval for reliability at low fps
    let strikes = 0;
    const baseY = cy - 50;
    const interval = setInterval(() => {
      strikes++;
      // Hammer bounce: alternate up/down
      hammerT.setY(strikes % 2 === 1 ? baseY - 18 : baseY);
      if (strikes >= 6) {
        clearInterval(interval);
        statusT.setText('제작 완료!');
        statusT.setStyle({ color: '#44ff88' });
        // Sparks
        for (let i = 0; i < 4; i++) {
          const s = this.add.text(
            cx + (Math.random() - 0.5) * 70,
            cy - 60,
            '✨', { fontFamily: 'sans-serif', fontSize: '13px' }
          ).setAlpha(1);
          c.add(s);
        }
        setTimeout(() => {
          c.destroy();
          onComplete();
          this.showCraftCompleteCard(bp);
        }, 600);
      }
    }, 280);
  }

  private showCraftCompleteCard(bp: BlueprintDef): void {
    const c = this.add.container(0, 0).setDepth(60);

    const dim = this.add.graphics();
    dim.fillStyle(0x000000, 0.75);
    dim.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    c.add(dim);

    const cx = CANVAS_WIDTH / 2;
    const cy = CANVAS_HEIGHT / 2;
    const pw = 260, ph = 200;

    const box = this.add.graphics();
    box.fillStyle(0x1a0800, 1);
    box.fillRoundedRect(cx - pw / 2, cy - ph / 2, pw, ph, 10);
    const rarityHex = [0xaaaaaa, 0x44cc44, 0x4488cc, 0xaa44ff, 0xffaa22];
    box.lineStyle(2, rarityHex[bp.rarity] ?? 0xffaa44, 1);
    box.strokeRoundedRect(cx - pw / 2, cy - ph / 2, pw, ph, 10);
    c.add(box);

    c.add(this.add.text(cx, cy - ph / 2 + 24, '✨ 제작 완료!', {
      fontFamily: 'Georgia, serif', fontSize: '18px', color: '#ffaa44', fontStyle: 'bold',
    }).setOrigin(0.5));

    c.add(this.add.text(cx, cy - 20, `${bp.resultEmoji}  ${bp.name}`, {
      fontFamily: 'Georgia, serif', fontSize: '20px', color: RARITY_COLORS[bp.rarity] ?? '#ffaa44',
    }).setOrigin(0.5));

    c.add(this.add.text(cx, cy + 16, bp.statDesc, {
      fontFamily: 'sans-serif', fontSize: '12px', color: '#aa8844',
    }).setOrigin(0.5));

    c.add(this.add.text(cx, cy + 36, RARITY_NAMES[bp.rarity] ?? '', {
      fontFamily: 'sans-serif', fontSize: '11px', color: RARITY_COLORS[bp.rarity] ?? '#aaaaaa',
    }).setOrigin(0.5));

    const btn = this.add.text(cx, cy + ph / 2 - 26, '확인', {
      fontFamily: 'sans-serif', fontSize: '14px', color: '#ffaa44',
      backgroundColor: '#2a1400', padding: { x: 28, y: 8 },
    }).setOrigin(0.5).setInteractive();
    btn.on('pointerdown', () => c.destroy());
    c.add(btn);

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

    if (crafted.length === 0) {
      c.add(this.add.text(CANVAS_WIDTH / 2, 120, '분해할 장비가 없습니다.\n먼저 장비를 제작하세요.', {
        fontFamily: 'sans-serif', fontSize: '13px', color: '#886633',
        align: 'center', lineSpacing: 6,
      }).setOrigin(0.5, 0));
      return;
    }

    let oy = 10;
    const pad = 12;
    const rowH = 80;

    crafted.forEach((eq, idx) => {
      const isSelected = this.selectedEqIdx === idx;
      const rarityColor = RARITY_COLORS[eq.rarity] ?? '#aaaaaa';

      const bg = this.add.graphics();
      bg.fillStyle(isSelected ? 0x1a0a00 : 0x100600, 1);
      bg.fillRoundedRect(pad, oy, CANVAS_WIDTH - pad * 2, rowH - 4, 6);
      bg.lineStyle(1.5, isSelected ? 0xffaa44 : 0x3a1800, 1);
      bg.strokeRoundedRect(pad, oy, CANVAS_WIDTH - pad * 2, rowH - 4, 6);
      c.add(bg);

      c.add(this.add.text(pad + 10, oy + 10, `${eq.emoji} ${eq.name}`, {
        fontFamily: 'Georgia, serif', fontSize: '14px', color: rarityColor,
      }));
      c.add(this.add.text(pad + 10, oy + 28, RARITY_NAMES[eq.rarity] ?? '일반', {
        fontFamily: 'sans-serif', fontSize: '10px', color: '#666633',
      }));

      // 50% material return preview
      const bp = Object.values(BLUEPRINT_DEFS).find(b => b.resultId === eq.id);
      if (bp) {
        const retStr = Object.entries(bp.materials)
          .map(([id, qty]) => {
            const def = MATERIAL_DEFS[id];
            const ret = Math.floor(qty * 0.5);
            return ret > 0 ? `${def?.emoji ?? '?'}×${ret}` : null;
          }).filter(Boolean).join('  ');
        c.add(this.add.text(pad + 10, oy + 44, retStr ? `반환: ${retStr}` : '반환 없음', {
          fontFamily: 'sans-serif', fontSize: '10px', color: '#886633',
        }));
      }

      // Dismantle button
      const btnW = 70, btnH = 28;
      const btnX = CANVAS_WIDTH - pad * 2 - btnW + 2;
      const btnY = oy + (rowH - 4 - btnH) / 2;

      const btnBg = this.add.graphics();
      btnBg.fillStyle(0x4a1800, 1);
      btnBg.fillRoundedRect(btnX, btnY, btnW, btnH, 5);
      c.add(btnBg);

      c.add(this.add.text(btnX + btnW / 2, btnY + btnH / 2, '분해', {
        fontFamily: 'sans-serif', fontSize: '12px', color: '#ffaa44',
      }).setOrigin(0.5));

      const zone = this.add.zone(btnX + btnW / 2, btnY + btnH / 2, btnW, btnH).setInteractive();
      zone.on('pointerdown', () => this.confirmDismantle(idx, eq));
      c.add(zone);

      // Row tap for selection
      const rowZone = this.add.zone(CANVAS_WIDTH / 2 - 40, oy + (rowH - 4) / 2, CANVAS_WIDTH - pad * 2 - btnW - 4, rowH - 4).setInteractive();
      rowZone.on('pointerdown', () => {
        this.selectedEqIdx = this.selectedEqIdx === idx ? null : idx;
        this.renderContent();
      });
      c.add(rowZone);

      oy += rowH;
    });
  }

  private confirmDismantle(idx: number, eq: { id: string; name: string; emoji: string; rarity: number; type: string; stats: Record<string, number> }): void {
    const bp = Object.values(BLUEPRINT_DEFS).find(b => b.resultId === eq.id);
    const retStr = bp
      ? Object.entries(bp.materials)
          .map(([id, qty]) => {
            const ret = Math.floor(qty * 0.5);
            const def = MATERIAL_DEFS[id];
            return ret > 0 ? `${def?.emoji ?? '?'} ${def?.name ?? id} ×${ret}` : null;
          }).filter(Boolean).join('\n')
      : '없음';

    const ov = this.add.container(0, 0).setDepth(50);

    const dim = this.add.graphics();
    dim.fillStyle(0x000000, 0.72);
    dim.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    ov.add(dim);

    const pw = 280, ph = 180;
    const cx = CANVAS_WIDTH / 2, cy = CANVAS_HEIGHT / 2;

    const box = this.add.graphics();
    box.fillStyle(0x1a0800, 1);
    box.fillRoundedRect(cx - pw / 2, cy - ph / 2, pw, ph, 8);
    box.lineStyle(2, 0xcc4400, 0.9);
    box.strokeRoundedRect(cx - pw / 2, cy - ph / 2, pw, ph, 8);
    ov.add(box);

    ov.add(this.add.text(cx, cy - ph / 2 + 22, '장비 분해', {
      fontFamily: 'Georgia, serif', fontSize: '16px', color: '#cc8844', fontStyle: 'bold',
    }).setOrigin(0.5));

    ov.add(this.add.text(cx, cy - 20, `${eq.emoji} ${eq.name} 분해?\n재료 반환:\n${retStr}`, {
      fontFamily: 'sans-serif', fontSize: '11px', color: '#c8b090',
      align: 'center', lineSpacing: 4,
    }).setOrigin(0.5));

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
  }

  private executeDismantle(idx: number, bp: BlueprintDef | undefined): void {
    const gs = loadGameState();
    gs.craftedEquipment = gs.craftedEquipment ?? [];

    if (idx < 0 || idx >= gs.craftedEquipment.length) return;
    const eq = gs.craftedEquipment[idx];

    // Return 50% materials
    if (bp) {
      gs.materials = gs.materials ?? {};
      Object.entries(bp.materials).forEach(([id, qty]) => {
        const ret = Math.floor(qty * 0.5);
        if (ret > 0) {
          gs.materials[id] = (gs.materials[id] ?? 0) + ret;
          logger.debug(`[FORGE] dismantle return ${id}: +${ret}`);
        }
      });
    }

    // Capture material return summary before mutating state
    const materialsReturned: Record<string, number> = {};
    if (bp) {
      Object.entries(bp.materials).forEach(([id, qty]) => {
        const ret = Math.floor(qty * 0.5);
        if (ret > 0) materialsReturned[id] = ret;
      });
    }

    gs.craftedEquipment.splice(idx, 1);
    saveGameState(gs);

    logger.debug(`[FORGE] ${eq.id} dismantled`);

    this.selectedEqIdx = null;
    this.drawHeader();
    this.renderContent();

    // Show success toast with returned materials
    const parts = Object.entries(materialsReturned)
      .map(([id, qty]) => {
        const def = MATERIAL_DEFS[id];
        return `${def?.emoji ?? '?'}×${qty}`;
      });
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
