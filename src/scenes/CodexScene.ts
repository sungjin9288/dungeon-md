import Phaser from 'phaser';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../constants/layout';
import { CSS, CASUAL, CASUAL_CSS } from '../constants/colors';
import { applyCasualBackground } from '../ui/AmbientBackground';
import { addSceneHeader, addTabBar } from '../ui/GameUiPrimitives';
import { loadGameState, saveGameState } from '../data/wisdom';
import { MONSTER_DEFS, resolveMonsterTypeId, type MonsterId, type TribeId } from '../data/monsters';
import { claimCodexTribeReward, claimAllCodexTribeRewards } from '../data/rewardTransactions';
import { INVADER_DEFS } from '../data/invaders';
import { ENDLESS_MODIFIERS } from '../data/endlessModifiers';
import { WAVE_EVENTS } from '../data/waveEvents';
import { getTraitBlurb } from '../data/invaderTraits';
import {
  CX, HDR_H, BOT_H, PAD,
  TRIBE_META, TRIBE_REWARD_MONSTER, isTribeClaimable,
} from '../ui/CodexShared';
import { drawMonsterCell, drawSetBonus, type CodexCellContext } from '../ui/CodexCell';

// ─── Scene ────────────────────────────────────────────────────────────────────

export class CodexScene extends Phaser.Scene {
  private scrollY        = 0;
  private maxScrollY     = 0;
  private contentCtr!:   Phaser.GameObjects.Container;
  private expandedTribes: Set<TribeId> = new Set(['dokkaebi']); // first open by default
  private gs = loadGameState();
  private showOwnedOnly  = false;
  private codexTab: 'monsters' | 'invaders' | 'modifiers' | 'events' = 'monsters';
  private detailOverlayRef: { current: Phaser.GameObjects.Container | null } = { current: null };

  constructor() { super({ key: 'CodexScene' }); }

  create(): void {
    this.gs = loadGameState();
    this.scrollY = 0;
    this.showOwnedOnly = this.registry.get('codexOwnedFilter') ?? false;
    this.codexTab = this.registry.get('codexActiveTab') ?? 'monsters';

    this.drawBackground();
    this.drawHeader();
    this.buildContent();
    this.buildBottomNav();
    this.setupScroll();
  }

  // ─── Background ────────────────────────────────────────────────────────────

  private drawBackground(): void {
    // Bright casual storybook backdrop (gradient + sun glow + polka dots).
    applyCasualBackground(this);

    const g = this.add.graphics().setDepth(-10);
    // Top header band (cream with white top highlight + brown bottom edge).
    g.fillStyle(CASUAL.PANEL, 1);
    g.fillRect(0, 0, CANVAS_WIDTH, HDR_H);
    g.fillStyle(0xffffff, 0.12);
    g.fillRect(0, 0, CANVAS_WIDTH, 4);
    g.fillStyle(CASUAL.EDGE, 1);
    g.fillRect(0, HDR_H - 3, CANVAS_WIDTH, 3);
  }

  // ─── Header ────────────────────────────────────────────────────────────────

  private drawHeader(): void {
    addSceneHeader(this, {
      title:  '📖 도감',
      y:      26,
      onBack: () => this.scene.start((this.registry.get('previousScene') as string) ?? 'BarracksScene'),
    });

    // ── Tab bar (shared primitive) ──
    addTabBar(this, {
      tabs: [
        { id: 'monsters',  label: '🏰 수호자' },
        { id: 'invaders',  label: '👺 적군'   },
        { id: 'modifiers', label: '⚔ 도전 변수' },
        { id: 'events',    label: '🎲 이벤트' },
      ],
      active:  this.codexTab,
      y:       56,
      accent:  CASUAL.BLUE,
      height:  38,
      depth:   10,
      fontSize: '12px',
      onSelect: (id) => {
        if (this.codexTab !== id) {
          this.registry.set('codexActiveTab', id);
          this.scene.restart();
        }
      },
    });

    // ── Tab-specific stats row ──
    if (this.codexTab === 'monsters') {
      const allIds = Object.keys(MONSTER_DEFS) as MonsterId[];
      const total  = allIds.length;
      const owned  = allIds.filter(id => this.isOwned(id)).length;
      const pct    = Math.round((owned / total) * 100);
      this.add.text(CX - 36, 99, `전체 도감: ${owned} / ${total}  (${pct}%)`, {
        fontFamily: 'sans-serif', fontSize: '11px', fontStyle: 'bold', color: CASUAL_CSS.INK,
      }).setOrigin(0.5).setDepth(10);

      const bx = PAD, by = 108, bw = CANVAS_WIDTH - PAD * 2 - 72, bh = 7;
      const barBg = this.add.graphics().setDepth(10);
      barBg.fillStyle(CASUAL.PANEL_SOFT, 1);
      barBg.fillRoundedRect(bx, by, bw, bh, 3);
      barBg.lineStyle(1, CASUAL.EDGE_SOFT, 0.9);
      barBg.strokeRoundedRect(bx, by, bw, bh, 3);
      barBg.fillStyle(CASUAL.GOLD, 1);
      barBg.fillRoundedRect(bx, by, Math.max(4, bw * (owned / total)), bh, 3);

      // Filter toggle chip
      const chipX = CANVAS_WIDTH - PAD - 64, chipY = 96, chipW = 60, chipH = 20;
      const toggleBg = this.add.graphics().setDepth(10);
      if (this.showOwnedOnly) {
        toggleBg.fillStyle(CASUAL.EDGE, 0.25);
        toggleBg.fillRoundedRect(chipX, chipY + 2, chipW, chipH, 7);
        toggleBg.fillStyle(CASUAL.GREEN, 1);
        toggleBg.fillRoundedRect(chipX, chipY, chipW, chipH, 7);
        toggleBg.fillStyle(0xffffff, 0.32);
        toggleBg.fillRoundedRect(chipX + 5, chipY + 3, chipW - 10, 5, 3);
      } else {
        toggleBg.fillStyle(CASUAL.PANEL_SOFT, 1);
        toggleBg.fillRoundedRect(chipX, chipY, chipW, chipH, 7);
      }
      toggleBg.lineStyle(2, CASUAL.EDGE, this.showOwnedOnly ? 1 : 0.7);
      toggleBg.strokeRoundedRect(chipX, chipY, chipW, chipH, 7);
      this.add.text(chipX + chipW / 2, chipY + chipH / 2,
        this.showOwnedOnly ? '✓ 소유' : '전체',
        { fontFamily: 'sans-serif', fontSize: '11px', fontStyle: 'bold',
          color: this.showOwnedOnly ? CASUAL_CSS.WHITE : CASUAL_CSS.INK_SOFT,
          stroke: this.showOwnedOnly ? '#00000033' : undefined,
          strokeThickness: this.showOwnedOnly ? 3 : 0 },
      ).setOrigin(0.5).setDepth(10);
      this.add.zone(chipX + chipW / 2, chipY + chipH / 2, chipW, 44)
        .setInteractive({ useHandCursor: true }).setDepth(11)
        .on('pointerdown', () => {
          this.registry.set('codexOwnedFilter', !this.showOwnedOnly);
          this.scene.restart();
        });
    } else if (this.codexTab === 'invaders') {
      const invTotal = Object.keys(INVADER_DEFS).length;
      this.add.text(CX, 101, `침략자 총 ${invTotal}종 · 챕터 1–9`, {
        fontFamily: 'sans-serif', fontSize: '11px', fontStyle: 'bold', color: CASUAL_CSS.INK,
      }).setOrigin(0.5).setDepth(10);
    } else if (this.codexTab === 'modifiers') {
      this.add.text(CX, 101, `무한 던전 도전 변수 ${ENDLESS_MODIFIERS.length}종 · 런마다 1개 무작위`, {
        fontFamily: 'sans-serif', fontSize: '11px', fontStyle: 'bold', color: CASUAL_CSS.INK,
      }).setOrigin(0.5).setDepth(10);
    } else {
      this.add.text(CX, 101, `웨이브 이벤트 ${WAVE_EVENTS.length}종 · 웨이브 사이 무작위 등장`, {
        fontFamily: 'sans-serif', fontSize: '11px', fontStyle: 'bold', color: CASUAL_CSS.INK,
      }).setOrigin(0.5).setDepth(10);
    }
  }

  // ─── Content ───────────────────────────────────────────────────────────────

  private buildContent(): void {
    this.contentCtr?.destroy();
    this.contentCtr = this.add.container(0, HDR_H).setDepth(5);

    // mask so content clips at header
    const mask = this.add.graphics();
    mask.fillStyle(0xffffff, 1);
    mask.fillRect(0, HDR_H, CANVAS_WIDTH, CANVAS_HEIGHT - HDR_H - BOT_H);
    this.contentCtr.setMask(mask.createGeometryMask());
    mask.setVisible(false);

    if (this.codexTab === 'invaders') {
      this.buildInvaderContent();
      return;
    }
    if (this.codexTab === 'modifiers') {
      this.buildModifierContent();
      return;
    }
    if (this.codexTab === 'events') {
      this.buildEventContent();
      return;
    }

    let cursorY = 8;

    // QoL: claim every completed tribe's reward in one tap.
    const claimableTribes = this.getClaimableTribes();
    if (claimableTribes.length > 0) {
      const barH = 34, bx = PAD + 4, bw = CANVAS_WIDTH - PAD * 2 - 8;
      const bar = this.add.graphics();
      bar.fillStyle(CASUAL.SHADOW, 0.4);    bar.fillRoundedRect(bx, cursorY + 2, bw, barH, 9);
      bar.fillStyle(CASUAL.GREEN, 1);        bar.fillRoundedRect(bx, cursorY, bw, barH, 9);
      bar.fillStyle(0xffffff, 0.14);         bar.fillRoundedRect(bx + 5, cursorY + 3, bw - 10, 4, 3);
      bar.lineStyle(2, CASUAL.GREEN_DK, 1);  bar.strokeRoundedRect(bx, cursorY, bw, barH, 9);
      this.contentCtr.add(bar);
      this.contentCtr.add(this.add.text(bx + bw / 2, cursorY + barH / 2,
        `🎁 부족 보상 전체 수령 ${claimableTribes.length}`, {
          fontFamily: 'sans-serif', fontSize: '12px', fontStyle: 'bold',
          color: CASUAL_CSS.WHITE, stroke: '#06351f', strokeThickness: 2,
        }).setOrigin(0.5));
      const zone = this.add.zone(bx + bw / 2, cursorY + barH / 2, bw, barH)
        .setInteractive({ useHandCursor: true });
      zone.on('pointerdown', () => this.claimAllTribes());
      this.contentCtr.add(zone);
      cursorY += barH + 10;
    }

    TRIBE_META.forEach(tribe => {
      const allTribeMonsters = (Object.values(MONSTER_DEFS)).filter(
        m => m.tribe === tribe.id,
      );
      // In owned-only mode, hide tribes with no owned monsters
      if (this.showOwnedOnly && !allTribeMonsters.some(m => this.isOwned(m.id))) return;

      const tribeMonsters = this.showOwnedOnly
        ? allTribeMonsters.filter(m => this.isOwned(m.id))
        : allTribeMonsters;
      const tribeOwned = allTribeMonsters.filter(m => this.isOwned(m.id)).length;
      const tribeTotal = allTribeMonsters.length;
      const isExpanded = this.expandedTribes.has(tribe.id);

      // Section header row
      cursorY = this.drawTribeHeader(tribe.id, tribe.name, tribe.emoji, tribe.color, tribeOwned, tribeTotal, cursorY, isExpanded);

      // Expanded: grid of monsters
      if (isExpanded) {
        cursorY = this.drawMonsterGrid(tribeMonsters, tribe.color, cursorY);
        const cellCtx = this.makeCellCtx();
        cursorY = drawSetBonus(this, cellCtx, this.contentCtr, tribe, tribeOwned, tribeTotal, cursorY);
        cursorY += 10;
      }

      cursorY += 4;
    });

    this.maxScrollY = Math.max(0, cursorY - (CANVAS_HEIGHT - HDR_H - BOT_H));
  }

  // ─── Tribe header ──────────────────────────────────────────────────────────

  private drawTribeHeader(
    tribeId: TribeId, tribeName: string, tribeEmoji: string, tribeColor: number,
    owned: number, total: number,
    y: number, expanded: boolean,
  ): number {
    const h = 52;
    const g = this.add.graphics();
    this.contentCtr.add(g);

    // cream section band with chunky brown border + tribe-accent header pill
    g.fillStyle(CASUAL.SHADOW, 0.18);
    g.fillRoundedRect(PAD, y + 3, CANVAS_WIDTH - PAD * 2, h, 8);
    g.fillStyle(expanded ? CASUAL.PANEL : CASUAL.PANEL_SOFT, 1);
    g.fillRoundedRect(PAD, y, CANVAS_WIDTH - PAD * 2, h, 8);
    g.fillStyle(0xffffff, 0.12);
    g.fillRoundedRect(PAD + 5, y + 4, CANVAS_WIDTH - PAD * 2 - 10, 5, 3);
    g.fillStyle(tribeColor, expanded ? 0.9 : 0.55);
    g.fillRoundedRect(PAD + 6, y + 6, CANVAS_WIDTH - PAD * 2 - 12, 6, 3);
    g.lineStyle(3, CASUAL.EDGE, expanded ? 1 : 0.8);
    g.strokeRoundedRect(PAD, y, CANVAS_WIDTH - PAD * 2, h, 8);

    // progress bar inside header
    const bx = PAD + 8, by = y + h - 10, bw = CANVAS_WIDTH - PAD * 2 - 16, bh = 5;
    g.fillStyle(CASUAL.PANEL_SOFT, 1);
    g.fillRoundedRect(bx, by, bw, bh, 2);
    g.lineStyle(1, CASUAL.EDGE_SOFT, 0.9);
    g.strokeRoundedRect(bx, by, bw, bh, 2);
    g.fillStyle(tribeColor, 1);
    g.fillRoundedRect(bx, by, Math.max(4, bw * (owned / total)), bh, 2);

    // emoji
    const emojiT = this.add.text(PAD + 22, y + h / 2 - 8, tribeEmoji, {
      fontFamily: 'sans-serif', fontSize: '22px',
    }).setOrigin(0.5, 0);
    this.contentCtr.add(emojiT);

    // name + count
    const nameT = this.add.text(PAD + 44, y + 10, `${tribeName}`, {
      fontFamily: 'sans-serif', fontSize: '14px', fontStyle: 'bold',
      color: CASUAL_CSS.INK,
    }).setOrigin(0, 0);
    this.contentCtr.add(nameT);

    const countT = this.add.text(PAD + 44, y + 27, `${owned} / ${total}`,{
      fontFamily: 'sans-serif', fontSize: '10px', fontStyle: 'bold',
      color: owned === total ? CASUAL_CSS.GREEN : CASUAL_CSS.INK_SOFT,
    }).setOrigin(0, 0);
    this.contentCtr.add(countT);

    if (owned === total) {
      const doneT = this.add.text(CANVAS_WIDTH - PAD - 12, y + h / 2 - 6, '✓ 완성', {
        fontFamily: 'sans-serif', fontSize: '10px', fontStyle: 'bold', color: CASUAL_CSS.GREEN,
      }).setOrigin(1, 0);
      this.contentCtr.add(doneT);
    }

    // chevron
    const chevron = this.add.text(CANVAS_WIDTH - PAD - 8, y + 14, expanded ? '▲' : '▼', {
      fontFamily: 'sans-serif', fontSize: '12px', fontStyle: 'bold', color: CASUAL_CSS.INK_SOFT,
    }).setOrigin(1, 0);
    this.contentCtr.add(chevron);

    // tap zone
    const zone = this.add.zone(CANVAS_WIDTH / 2, y + h / 2, CANVAS_WIDTH - PAD * 2, h)
      .setInteractive().setOrigin(0.5);
    this.contentCtr.add(zone);
    zone.on('pointerdown', () => {
      if (this.expandedTribes.has(tribeId)) this.expandedTribes.delete(tribeId);
      else this.expandedTribes.add(tribeId);
      this.buildContent();
    });

    return y + h + 4;
  }

  // ─── Monster grid ──────────────────────────────────────────────────────────

  private drawMonsterGrid(
    monsters: (typeof MONSTER_DEFS)[MonsterId][],
    color: number,
    y: number,
  ): number {
    const cols  = 3;
    const cellW = (CANVAS_WIDTH - PAD * 2 - 4) / cols;
    const cellH = 88;
    const rows  = Math.ceil(monsters.length / cols);

    // sort: owned first, then alphabetical
    const sorted = [...monsters].sort((a, b) => {
      const ao = this.isOwned(a.id) ? 0 : 1;
      const bo = this.isOwned(b.id) ? 0 : 1;
      return ao - bo || a.name.localeCompare(b.name);
    });

    const cellCtx = this.makeCellCtx();

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const idx = r * cols + c;
        if (idx >= sorted.length) break;
        const m     = sorted[idx];
        const owned = this.isOwned(m.id);
        const cx    = PAD + c * cellW;
        const cy    = y + r * (cellH + 4);

        drawMonsterCell(this, cellCtx, this.contentCtr, m, owned, color, cx, cy, cellW, cellH);
      }
    }

    return y + rows * (cellH + 4) + 4;
  }

  // ─── Cell context factory ──────────────────────────────────────────────────

  private makeCellCtx(): CodexCellContext {
    return {
      gs:               this.gs,
      expandedTribes:   this.expandedTribes,
      showOwnedOnly:    this.showOwnedOnly,
      isOwned:          (id) => this.isOwned(id),
      onClaimTribeReward: (tribeId) => {
        this.claimTribeReward(tribeId);
        this.scene.restart();
      },
      detailOverlayRef: this.detailOverlayRef,
    };
  }

  // ─── Claim tribe reward ────────────────────────────────────────────────────

  private claimTribeReward(tribeId: string): void {
    const rewardMonsterId = TRIBE_REWARD_MONSTER[tribeId];
    if (!rewardMonsterId) return;

    const gs = loadGameState();
    const result = claimCodexTribeReward(gs, tribeId, rewardMonsterId);
    if (!result.ok) return;

    saveGameState(result.state);
    this.gs = result.state;
  }

  /** Tribes fully collected, not yet claimed, and with a reward monster defined. */
  private getClaimableTribes(): { tribeId: string; rewardMonsterId: MonsterId }[] {
    const claimed = this.gs.codexRewardsClaimed ?? [];
    const out: { tribeId: string; rewardMonsterId: MonsterId }[] = [];
    for (const tribe of TRIBE_META) {
      const monsterIds = (Object.values(MONSTER_DEFS))
        .filter(m => m.tribe === tribe.id)
        .map(m => m.id);
      if (monsterIds.length === 0) continue;
      const rewardId = TRIBE_REWARD_MONSTER[tribe.id];
      // Completion excludes the reward monster itself (granted by claiming) —
      // otherwise the tribe is permanently unclaimable. See isTribeClaimable.
      if (rewardId && isTribeClaimable(monsterIds, rewardId, id => this.isOwned(id), claimed.includes(tribe.id))) {
        out.push({ tribeId: tribe.id, rewardMonsterId: rewardId });
      }
    }
    return out;
  }

  private claimAllTribes(): void {
    const r = claimAllCodexTribeRewards(loadGameState(), this.getClaimableTribes());
    if (r.claimedCount === 0) return;
    saveGameState(r.state);
    this.gs = r.state;
    this.scene.restart();   // rebuild grid + drop claimed reward bars/buttons
  }

  // ─── Scroll ────────────────────────────────────────────────────────────────

  private setupScroll(): void {
    let startY = 0;
    let startScrollY = 0;

    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      startY = p.y;
      startScrollY = this.scrollY;
    });

    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (!p.isDown) return;
      const delta = startY - p.y;
      this.scrollY = Phaser.Math.Clamp(startScrollY + delta, 0, this.maxScrollY);
      this.contentCtr.setY(HDR_H - this.scrollY);
    });
  }

  // ─── Bottom nav ────────────────────────────────────────────────────────────

  private buildBottomNav(): void {
    const g = this.add.graphics().setDepth(20);
    g.fillStyle(CASUAL.PANEL, 1);
    g.fillRect(0, CANVAS_HEIGHT - BOT_H, CANVAS_WIDTH, BOT_H);
    g.fillStyle(0xffffff, 0.14);
    g.fillRect(0, CANVAS_HEIGHT - BOT_H, CANVAS_WIDTH, 4);
    g.fillStyle(CASUAL.EDGE, 1);
    g.fillRect(0, CANVAS_HEIGHT - BOT_H, CANVAS_WIDTH, 1.5);

    const btnW = (CANVAS_WIDTH - 24) / 4;
    const btnDefs = [
      { label: '⚔️ 막사', accent: CASUAL.RED,    action: () => this.scene.start('BarracksScene') },
      { label: '📖 도감', accent: CASUAL.BLUE,   action: () => { /* already here */ } },
      { label: '✨ 소환', accent: CASUAL.PURPLE, action: () => this.scene.start('SummonScene') },
      { label: '🏪 상점', accent: CASUAL.GOLD,   action: () => this.scene.start('ShopScene') },
    ];

    btnDefs.forEach(({ label, accent, action }, i) => {
      const bx = 12 + i * (btnW + 4);
      const by = CANVAS_HEIGHT - 56;
      const isActive = i === 1;
      const bg = this.add.graphics().setDepth(21);
      if (isActive) {
        bg.fillStyle(CASUAL.EDGE, 0.3);
        bg.fillRoundedRect(bx, by + 3, btnW, 44, 13);
        bg.fillStyle(accent, 1);
        bg.fillRoundedRect(bx, by, btnW, 44, 13);
        bg.fillStyle(0xffffff, 0.3);
        bg.fillRoundedRect(bx + 6, by + 5, btnW - 12, 7, 3);
      }
      this.add.text(bx + btnW / 2, by + 22, label, {
        fontFamily: 'sans-serif', fontSize: '11px', fontStyle: 'bold',
        color: isActive ? CASUAL_CSS.WHITE : CASUAL_CSS.INK_SOFT,
        stroke: isActive ? '#00000033' : undefined,
        strokeThickness: isActive ? 3 : 0,
      }).setOrigin(0.5).setDepth(22);
      const zone = this.add.zone(bx + btnW / 2, by + 22, btnW, 44)
        .setInteractive({ useHandCursor: true }).setDepth(23);
      zone.on('pointerdown', action);
    });
  }

  // ─── Invader content ───────────────────────────────────────────────────────

  private buildInvaderContent(): void {
    const BEHAVIOR_SHORT: Partial<Record<string, string>> = {
      VOID_PHASE:         '공허 면역',    REVIVE_ONCE:      '1회 부활',
      BERSERKER_RAGE:     '격노(속도↑)',  STEALTH:          '투명화',
      SIEGE_SHIELD:       '공성 방패',    DIVINE_WARD:      '마법 면역',
      IRON_BODY:          '철갑(반감)',   RALLY_CRY:        '집결 고함',
      TRAP_IMMUNITY:      '덫 무효',      FOX_QUEEN_PHASE:  '3단계 보스',
      UNDYING_KNIGHT:     '마법 사망 불가', DECOY_CLONE:    '분신 소환',
      POISON_TRAIL:       '독 흔적',      VOID_TELEPORT:    '순간 이동',
      DRAGON_KING_PHASE:  '3단계 보스',   VOID_STEALTH_ELITE: '투명+이동',
      STUN_IMMUNE:        '스턴 무효',    FIVE_PHASE:       '5단계 보스',
      MIRROR_SHIELD:      '반사 방패',    SWARM:            '분열',
      SHADOW_REALM:       '그림자 회피',  EMPEROR_PHASE:    '4단계 보스',
      GOD_EMPEROR_PHASE:  '5단계 보스',   VOID_SURGE:       '공허 재활성',
      PRIMORDIAL_PHASE:   '6단계 보스',
    };

    const CH_COLOR: Record<number, number> = {
      1: 0x8b6040, 2: 0xcc2200, 3: 0x207040,
      4: 0x5020a0, 5: 0x0060b0, 6: 0xc05000,
      7: 0xc09000, 8: 0x7700cc, 9: 0x9000d8,
    };

    // Group by chapter
    const byChapter = new Map<number, (typeof INVADER_DEFS)[keyof typeof INVADER_DEFS][]>();
    for (const def of Object.values(INVADER_DEFS)) {
      const ch = def.chapter ?? 1;
      if (!byChapter.has(ch)) byChapter.set(ch, []);
      byChapter.get(ch)!.push(def);
    }

    let cursorY = 8;

    for (const ch of [1, 2, 3, 4, 5, 6, 7, 8, 9] as const) {
      const defs = byChapter.get(ch);
      if (!defs) continue;
      const chColor = CH_COLOR[ch] ?? 0x888888;

      // Chapter header — cream band with chunky brown border + chapter accent pill
      const hdrG = this.add.graphics();
      this.contentCtr.add(hdrG);
      hdrG.fillStyle(CASUAL.SHADOW, 0.16);
      hdrG.fillRoundedRect(PAD, cursorY + 3, CANVAS_WIDTH - PAD * 2, 28, 8);
      hdrG.fillStyle(CASUAL.PANEL, 1);
      hdrG.fillRoundedRect(PAD, cursorY, CANVAS_WIDTH - PAD * 2, 28, 8);
      hdrG.fillStyle(0xffffff, 0.12);
      hdrG.fillRoundedRect(PAD + 5, cursorY + 3, CANVAS_WIDTH - PAD * 2 - 10, 4, 2);
      hdrG.fillStyle(chColor, 0.85);
      hdrG.fillRoundedRect(PAD + 6, cursorY + 5, 6, 18, 3);
      hdrG.lineStyle(3, CASUAL.EDGE, 1);
      hdrG.strokeRoundedRect(PAD, cursorY, CANVAS_WIDTH - PAD * 2, 28, 8);

      const chLabel = this.add.text(PAD + 18, cursorY + 8, `Chapter ${ch}`, {
        fontFamily: 'sans-serif', fontSize: '13px', fontStyle: 'bold',
        color: CASUAL_CSS.INK,
      }).setOrigin(0, 0);
      this.contentCtr.add(chLabel);
      const countLabel = this.add.text(CANVAS_WIDTH - PAD - 10, cursorY + 10, `${defs.length}종`, {
        fontFamily: 'sans-serif', fontSize: '10px', fontStyle: 'bold', color: CASUAL_CSS.INK_SOFT,
      }).setOrigin(1, 0);
      this.contentCtr.add(countLabel);
      cursorY += 32;

      // Invader rows. Behavior-bearing invaders get a taller two-line row: the
      // full tactical blurb (getTraitBlurb) is the permanent codex home for the
      // trait the in-battle banner teaches transiently; boss-phase behaviors
      // (no blurb) fall back to the terse BEHAVIOR_SHORT label.
      for (const def of defs) {
        const traitText = def.behavior
          ? (getTraitBlurb(def.behavior) ?? BEHAVIOR_SHORT[def.behavior] ?? def.behavior)
          : '';
        const headH = 26;
        const rowH  = traitText ? 42 : headH;
        const rowG = this.add.graphics();
        this.contentCtr.add(rowG);
        rowG.fillStyle(def.isBoss ? 0x1a0020 : 0x0e0c06, 1);
        rowG.fillRoundedRect(PAD + 4, cursorY, CANVAS_WIDTH - PAD * 2 - 8, rowH, 4);
        if (def.isBoss) {
          rowG.lineStyle(1, chColor, 0.6);
          rowG.strokeRoundedRect(PAD + 4, cursorY, CANVAS_WIDTH - PAD * 2 - 8, rowH, 4);
        }

        // Colored dot (centered on the header band)
        rowG.fillStyle(def.color, 1);
        rowG.fillCircle(PAD + 18, cursorY + headH / 2, def.isBoss ? 6 : 4);

        const nameColor = def.isBoss ? '#ffcc44' : CSS.PARCHMENT_DIM;
        const bossTag   = def.isBoss ? ' 👑' : (def.isMiniBoss ? ' ⭐' : '');
        const nameT = this.add.text(PAD + 28, cursorY + headH / 2, `${def.koreanName}${bossTag}`, {
          fontFamily: 'Georgia, serif', fontSize: '11px', color: nameColor,
        }).setOrigin(0, 0.5);
        this.contentCtr.add(nameT);

        // Stats (right-aligned, on the header band)
        const statsStr = `HP ${def.hp}  ·  속${def.speed}  ·  피${def.damage}`;
        const statsT = this.add.text(CANVAS_WIDTH - PAD - 8, cursorY + headH / 2, statsStr, {
          fontFamily: 'sans-serif', fontSize: '9px', color: CSS.PARCHMENT_MUTED,
        }).setOrigin(1, 0.5);
        this.contentCtr.add(statsT);

        // Trait blurb on a second line.
        if (traitText) {
          const traitT = this.add.text(PAD + 28, cursorY + headH, traitText, {
            fontFamily: 'sans-serif', fontSize: '9px', color: CASUAL_CSS.INK_SOFT,
            wordWrap: { width: CANVAS_WIDTH - PAD * 2 - 8 - 36 },
          }).setOrigin(0, 0);
          this.contentCtr.add(traitT);
        }

        cursorY += rowH + 2;
      }
      cursorY += 8;
    }

    this.maxScrollY = Math.max(0, cursorY - (CANVAS_HEIGHT - HDR_H - BOT_H));
  }

  // ─── Challenge-modifier content (무한 던전 도전 변수) ─────────────────────────

  private buildModifierContent(): void {
    let cursorY = 8;

    const intro = this.add.text(CX, cursorY + 4,
      '무한 던전 진입 시 매 런 하나가 무작위로 적용됩니다.\n위험이 클수록 골드 보상도 커집니다.',
      { fontFamily: 'sans-serif', fontSize: '10px', color: CASUAL_CSS.INK_SOFT,
        align: 'center', lineSpacing: 3 },
    ).setOrigin(0.5, 0);
    this.contentCtr.add(intro);
    cursorY += 40;

    for (const m of ENDLESS_MODIFIERS) {
      const rowH = 50;
      const x = PAD + 4;
      const w = CANVAS_WIDTH - PAD * 2 - 8;

      const card = this.add.graphics();
      this.contentCtr.add(card);
      card.fillStyle(CASUAL.SHADOW, 0.14);
      card.fillRoundedRect(x, cursorY + 3, w, rowH, 8);
      card.fillStyle(CASUAL.PANEL, 1);
      card.fillRoundedRect(x, cursorY, w, rowH, 8);
      card.fillStyle(0xffffff, 0.12);
      card.fillRoundedRect(x + 5, cursorY + 3, w - 10, 4, 2);
      card.lineStyle(2, CASUAL.EDGE, 1);
      card.strokeRoundedRect(x, cursorY, w, rowH, 8);
      card.fillStyle(CASUAL.RED, 0.85);
      card.fillRoundedRect(x + 6, cursorY + 6, 5, rowH - 12, 3);

      const icon = this.add.text(x + 34, cursorY + rowH / 2, m.icon, {
        fontFamily: 'sans-serif', fontSize: '24px',
      }).setOrigin(0.5);
      this.contentCtr.add(icon);

      const name = this.add.text(x + 58, cursorY + 9, m.name, {
        fontFamily: 'sans-serif', fontSize: '13px', fontStyle: 'bold', color: CASUAL_CSS.INK,
      }).setOrigin(0, 0);
      this.contentCtr.add(name);

      const rwdPct = Math.round((m.rewardMult - 1) * 100);
      const pill = this.add.text(x + w - 10, cursorY + 11, `보상 +${rwdPct}%`, {
        fontFamily: 'sans-serif', fontSize: '10px', fontStyle: 'bold', color: CASUAL_CSS.GOLD,
      }).setOrigin(1, 0);
      this.contentCtr.add(pill);

      // Strip the trailing reward clause — it is shown in the gold pill instead.
      const descBody = m.desc.split(' · 보상')[0];
      const desc = this.add.text(x + 58, cursorY + 28, descBody, {
        fontFamily: 'sans-serif', fontSize: '10px', color: CASUAL_CSS.INK_SOFT,
        wordWrap: { width: w - 58 - 12 },
      }).setOrigin(0, 0);
      this.contentCtr.add(desc);

      cursorY += rowH + 6;
    }

    this.maxScrollY = Math.max(0, cursorY - (CANVAS_HEIGHT - HDR_H - BOT_H));
  }

  // ─── Wave-event content (웨이브 이벤트) ──────────────────────────────────────

  private buildEventContent(): void {
    let cursorY = 8;

    const intro = this.add.text(CX, cursorY + 4,
      '전투 중 웨이브 사이에 무작위로 등장해 그 웨이브를 변화시킵니다.\n축복은 아군을, 저주는 적을 강화하지만 그만큼 보상도 커집니다.',
      { fontFamily: 'sans-serif', fontSize: '10px', color: CASUAL_CSS.INK_SOFT,
        align: 'center', lineSpacing: 3 },
    ).setOrigin(0.5, 0);
    this.contentCtr.add(intro);
    cursorY += 40;

    for (const evt of WAVE_EVENTS) {
      const rowH = 50;
      const x = PAD + 4;
      const w = CANVAS_WIDTH - PAD * 2 - 8;
      const accent = parseInt(evt.color.slice(1), 16);

      const card = this.add.graphics();
      this.contentCtr.add(card);
      card.fillStyle(CASUAL.SHADOW, 0.14);
      card.fillRoundedRect(x, cursorY + 3, w, rowH, 8);
      card.fillStyle(CASUAL.PANEL, 1);
      card.fillRoundedRect(x, cursorY, w, rowH, 8);
      card.fillStyle(0xffffff, 0.12);
      card.fillRoundedRect(x + 5, cursorY + 3, w - 10, 4, 2);
      card.lineStyle(2, CASUAL.EDGE, 1);
      card.strokeRoundedRect(x, cursorY, w, rowH, 8);
      card.fillStyle(accent, 0.9);
      card.fillRoundedRect(x + 6, cursorY + 6, 5, rowH - 12, 3);

      const icon = this.add.text(x + 34, cursorY + rowH / 2, evt.icon, {
        fontFamily: 'sans-serif', fontSize: '24px',
      }).setOrigin(0.5);
      this.contentCtr.add(icon);

      const name = this.add.text(x + 58, cursorY + 9, evt.name, {
        fontFamily: 'sans-serif', fontSize: '13px', fontStyle: 'bold', color: CASUAL_CSS.INK,
      }).setOrigin(0, 0);
      this.contentCtr.add(name);

      const desc = this.add.text(x + 58, cursorY + 28, evt.description, {
        fontFamily: 'sans-serif', fontSize: '10px', color: CASUAL_CSS.INK_SOFT,
        wordWrap: { width: w - 58 - 12 },
      }).setOrigin(0, 0);
      this.contentCtr.add(desc);

      cursorY += rowH + 6;
    }

    this.maxScrollY = Math.max(0, cursorY - (CANVAS_HEIGHT - HDR_H - BOT_H));
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────

  private isOwned(monsterId: MonsterId): boolean {
    return this.gs.ownedMonsters.some(om => resolveMonsterTypeId(om.id) === monsterId);
  }
}
