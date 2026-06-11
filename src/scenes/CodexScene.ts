import Phaser from 'phaser';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../constants/layout';
import { COLORS, CSS } from '../constants/colors';
import { loadGameState, saveGameState } from '../data/wisdom';
import { MONSTER_DEFS, getSkinForMonster, type MonsterId, type TribeId } from '../data/monsters';
import { claimCodexTribeReward } from '../data/rewardTransactions';
import { INVADER_DEFS } from '../data/invaders';
import { generatePortrait } from '../art/PortraitGenerator';
import { showCodexMonsterDetail } from '../ui/CodexMonsterDetail';

// ─── Tribe metadata ───────────────────────────────────────────────────────────

interface TribeMeta {
  id:       TribeId;
  name:     string;
  emoji:    string;
  bonus:    string;
  reward:   string;   // Korean name of codex completion reward
  color:    number;   // accent color
}

const TRIBE_META: TribeMeta[] = [
  { id: 'dokkaebi',   name: '도깨비족',  emoji: '👹', color: 0xcc3300,
    bonus: '도깨비족 전체 ATK +15%',
    reward: '도깨비 신왕 (전설) 해금' },
  { id: 'gumiho',     name: '구미호족',  emoji: '🦊', color: 0xd06010,
    bonus: '구미호족 매혹 확률 +10%',
    reward: '구미호 악신 (전설) 해금' },
  { id: 'sansin',     name: '산신족',    emoji: '⛩️', color: 0x3a8a3a,
    bonus: '전체 던전 회복력 +20%',
    reward: '산신 완성체 (전설) 해금' },
  { id: 'sea',        name: '해신족',    emoji: '🌊', color: 0x1060a0,
    bonus: '밀어내기 효과 +50%',
    reward: '해신 완성체 (전설) 해금' },
  { id: 'underworld', name: '저승족',    emoji: '💀', color: 0x6020a0,
    bonus: '처형 임계치 15% → 25%',
    reward: '저승 완성체 (전설) 해금' },
  { id: 'mask',       name: '탈족',      emoji: '🎭', color: 0x804040,
    bonus: '도발 지속시간 +1초',
    reward: '탈족 완성체 (전설) 해금' },
  { id: 'moonlight',  name: '달빛족',    emoji: '🌙', color: 0x4040a0,
    bonus: '신성 속성 피해 +20%',
    reward: '달빛 완성체 (전설) 해금' },
  { id: 'dragon',     name: '용족',      emoji: '🐉', color: 0xc04000,
    bonus: '전설 몬스터 ATK +25%',
    reward: '오룡 완성체 (전설) 해금' },
  { id: 'celestial',  name: '천상족',    emoji: '✨', color: 0xffd700,
    bonus: '천상족 성스러운 피해 +30%',
    reward: '천제 분신 (전설) 해금' },
];

// Tribe ID → reward monster to unlock on 100% completion
const TRIBE_REWARD_MONSTER: Record<string, MonsterId> = {
  dokkaebi:   'dokkaebi_god_king',
  gumiho:     'gumiho_demon',
  sansin:     'mountain_god_complete',
  sea:        'sea_god_complete',
  underworld: 'underworld_complete',
  mask:       'mask_complete',
  moonlight:  'moonlight_complete',
  dragon:     'five_dragon_complete',
  celestial:  'god_realm_general',
};

// ─── Layout ───────────────────────────────────────────────────────────────────

const CX   = CANVAS_WIDTH / 2;
const HDR_H = 88;
const BOT_H = 64;
const PAD   = 12;
const CODEX_RARITY_META: Record<string, { label: string; stars: string; color: number; css: string }> = {
  C: { label: 'C', stars: '★',     color: 0x8f98a5, css: '#b9c0ca' },
  U: { label: 'U', stars: '★★',    color: 0x58c681, css: '#8ff0ad' },
  R: { label: 'R', stars: '★★★',   color: 0x62a8ff, css: '#9bc9ff' },
  E: { label: 'E', stars: '★★★★',  color: 0xc978ff, css: '#e3b4ff' },
  L: { label: 'L', stars: '★★★★★', color: 0xffc857, css: '#ffd878' },
};
const CODEX_ELEMENT_LABELS: Record<string, string> = {
  fire: '화염',
  frost: '서리',
  lightning: '번개',
  dark: '암흑',
  holy: '신성',
};

// ─── Scene ────────────────────────────────────────────────────────────────────

export class CodexScene extends Phaser.Scene {
  private scrollY        = 0;
  private maxScrollY     = 0;
  private contentCtr!:   Phaser.GameObjects.Container;
  private expandedTribes: Set<TribeId> = new Set(['dokkaebi']); // first open by default
  private gs = loadGameState();
  private showOwnedOnly  = false;
  private codexTab: 'monsters' | 'invaders' = 'monsters';

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
    const g = this.add.graphics().setDepth(-10);
    g.fillStyle(COLORS.BLACK, 1);
    g.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    for (let x = 0; x < CANVAS_WIDTH; x += 36)
      for (let y = 0; y < CANVAS_HEIGHT; y += 36) {
        g.lineStyle(0.3, COLORS.STONE_MID, 0.18);
        g.strokeRect(x, y, 36, 36);
      }
    g.fillStyle(COLORS.STONE_DARK, 1);
    g.fillRect(0, 0, CANVAS_WIDTH, HDR_H);
    g.lineStyle(2, COLORS.TORCH_GOLD, 0.6);
    g.lineBetween(0, HDR_H, CANVAS_WIDTH, HDR_H);
  }

  // ─── Header ────────────────────────────────────────────────────────────────

  private drawHeader(): void {
    // ── Back button ──
    const backBg = this.add.graphics().setDepth(10);
    backBg.fillStyle(COLORS.STONE_MID, 1);
    backBg.fillRoundedRect(8, 10, 72, 32, 6);
    this.add.text(44, 26, '← 뒤로', {
      fontFamily: 'Georgia, serif', fontSize: '11px', color: CSS.TORCH_AMBER,
    }).setOrigin(0.5).setDepth(11);
    this.add.zone(44, 26, 72, 32).setInteractive().setDepth(12)
      .on('pointerdown', () => this.scene.start((this.registry.get('previousScene') as string) ?? 'BarracksScene'));

    // ── Title ──
    this.add.text(CX, 26, '📖 도감', {
      fontFamily: 'Georgia, serif', fontSize: '22px', fontStyle: 'bold',
      color: CSS.TORCH_AMBER,
    }).setOrigin(0.5).setDepth(10);

    // ── Tab chips ──
    const tabDefs: Array<{ key: 'monsters' | 'invaders'; label: string }> = [
      { key: 'monsters', label: '🏰 수호자' },
      { key: 'invaders', label: '👺 적군'   },
    ];
    const tabW = 88, tabH = 20, tabGap = 8;
    const tabsX = CX - (tabDefs.length * tabW + (tabDefs.length - 1) * tabGap) / 2;
    tabDefs.forEach(({ key, label }, i) => {
      const tx = tabsX + i * (tabW + tabGap);
      const ty = 44;
      const active = this.codexTab === key;
      const tabG = this.add.graphics().setDepth(10);
      tabG.fillStyle(active ? 0x3a2800 : 0x181818, 1);
      tabG.fillRoundedRect(tx, ty, tabW, tabH, 5);
      tabG.lineStyle(1, active ? COLORS.TORCH_GOLD : 0x333333, active ? 0.9 : 0.5);
      tabG.strokeRoundedRect(tx, ty, tabW, tabH, 5);
      this.add.text(tx + tabW / 2, ty + tabH / 2, label, {
        fontFamily: 'sans-serif', fontSize: '11px',
        color: active ? CSS.TORCH_AMBER : CSS.PARCHMENT_MUTED,
      }).setOrigin(0.5).setDepth(10);
      this.add.zone(tx + tabW / 2, ty + tabH / 2, tabW, tabH)
        .setInteractive({ useHandCursor: true }).setDepth(11)
        .on('pointerdown', () => {
          if (this.codexTab !== key) {
            this.registry.set('codexActiveTab', key);
            this.scene.restart();
          }
        });
    });

    // ── Tab-specific stats row ──
    if (this.codexTab === 'monsters') {
      const allIds = Object.keys(MONSTER_DEFS) as MonsterId[];
      const total  = allIds.length;
      const owned  = allIds.filter(id => this.isOwned(id)).length;
      const pct    = Math.round((owned / total) * 100);
      this.add.text(CX - 36, 70, `전체 도감: ${owned} / ${total}  (${pct}%)`, {
        fontFamily: 'Georgia, serif', fontSize: '11px', color: CSS.PARCHMENT_DIM,
      }).setOrigin(0.5).setDepth(10);

      const bx = PAD, by = 79, bw = CANVAS_WIDTH - PAD * 2 - 72, bh = 7;
      const barBg = this.add.graphics().setDepth(10);
      barBg.fillStyle(COLORS.STONE_MID, 1);
      barBg.fillRoundedRect(bx, by, bw, bh, 3);
      barBg.fillStyle(COLORS.TORCH_GOLD, 1);
      barBg.fillRoundedRect(bx, by, Math.max(4, bw * (owned / total)), bh, 3);

      // Filter toggle chip
      const chipX = CANVAS_WIDTH - PAD - 64, chipY = 68, chipW = 60, chipH = 20;
      const toggleBg = this.add.graphics().setDepth(10);
      toggleBg.fillStyle(this.showOwnedOnly ? 0x226622 : 0x222222, 1);
      toggleBg.fillRoundedRect(chipX, chipY, chipW, chipH, 4);
      toggleBg.lineStyle(1, this.showOwnedOnly ? 0x44aa44 : 0x444444, 0.8);
      toggleBg.strokeRoundedRect(chipX, chipY, chipW, chipH, 4);
      this.add.text(chipX + chipW / 2, chipY + chipH / 2,
        this.showOwnedOnly ? '✓ 소유' : '전체',
        { fontFamily: 'sans-serif', fontSize: '11px', color: '#cccccc' },
      ).setOrigin(0.5).setDepth(10);
      this.add.zone(chipX + chipW / 2, chipY + chipH / 2, chipW, chipH)
        .setInteractive({ useHandCursor: true }).setDepth(11)
        .on('pointerdown', () => {
          this.registry.set('codexOwnedFilter', !this.showOwnedOnly);
          this.scene.restart();
        });
    } else {
      const invTotal = Object.keys(INVADER_DEFS).length;
      this.add.text(CX, 72, `침략자 총 ${invTotal}종 · 챕터 1–8`, {
        fontFamily: 'Georgia, serif', fontSize: '11px', color: CSS.PARCHMENT_DIM,
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

    let cursorY = 8;

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
      cursorY = this.drawTribeHeader(tribe, tribeOwned, tribeTotal, cursorY, isExpanded);

      // Expanded: grid of monsters
      if (isExpanded) {
        cursorY = this.drawMonsterGrid(tribeMonsters, tribe.color, cursorY);
        cursorY = this.drawSetBonus(tribe, tribeOwned, tribeTotal, cursorY);
        cursorY += 10;
      }

      cursorY += 4;
    });

    this.maxScrollY = Math.max(0, cursorY - (CANVAS_HEIGHT - HDR_H - BOT_H));
  }

  // ─── Tribe header ──────────────────────────────────────────────────────────

  private drawTribeHeader(
    tribe: TribeMeta, owned: number, total: number,
    y: number, expanded: boolean,
  ): number {
    const h = 52;
    const g = this.add.graphics();
    this.contentCtr.add(g);

    // background
    g.fillStyle(expanded ? 0x2a1a08 : 0x1e1408, 1);
    g.fillRoundedRect(PAD, y, CANVAS_WIDTH - PAD * 2, h, 8);
    g.lineStyle(1.5, tribe.color, expanded ? 1 : 0.5);
    g.strokeRoundedRect(PAD, y, CANVAS_WIDTH - PAD * 2, h, 8);

    // progress bar inside header
    const bx = PAD + 8, by = y + h - 10, bw = CANVAS_WIDTH - PAD * 2 - 16, bh = 5;
    g.fillStyle(COLORS.STONE_MID, 1);
    g.fillRoundedRect(bx, by, bw, bh, 2);
    g.fillStyle(tribe.color, 1);
    g.fillRoundedRect(bx, by, Math.max(4, bw * (owned / total)), bh, 2);

    // emoji
    const emojiT = this.add.text(PAD + 22, y + h / 2 - 8, tribe.emoji, {
      fontFamily: 'sans-serif', fontSize: '22px',
    }).setOrigin(0.5, 0);
    this.contentCtr.add(emojiT);

    // name + count
    const nameT = this.add.text(PAD + 44, y + 10, `${tribe.name}`, {
      fontFamily: 'Georgia, serif', fontSize: '14px', fontStyle: 'bold',
      color: expanded ? CSS.TORCH_AMBER : CSS.PARCHMENT_DIM,
    }).setOrigin(0, 0);
    this.contentCtr.add(nameT);

    const countT = this.add.text(PAD + 44, y + 27, `${owned} / ${total}`,{
      fontFamily: 'Georgia, serif', fontSize: '10px',
      color: owned === total ? '#44ff88' : CSS.PARCHMENT_MUTED,
    }).setOrigin(0, 0);
    this.contentCtr.add(countT);

    if (owned === total) {
      const doneT = this.add.text(CANVAS_WIDTH - PAD - 12, y + h / 2 - 6, '✓ 완성', {
        fontFamily: 'Georgia, serif', fontSize: '10px', color: '#44ff88',
      }).setOrigin(1, 0);
      this.contentCtr.add(doneT);
    }

    // chevron
    const chevron = this.add.text(CANVAS_WIDTH - PAD - 8, y + 14, expanded ? '▲' : '▼', {
      fontFamily: 'sans-serif', fontSize: '12px', color: CSS.PARCHMENT_MUTED,
    }).setOrigin(1, 0);
    this.contentCtr.add(chevron);

    // tap zone
    const zone = this.add.zone(CANVAS_WIDTH / 2, y + h / 2, CANVAS_WIDTH - PAD * 2, h)
      .setInteractive().setOrigin(0.5);
    this.contentCtr.add(zone);
    zone.on('pointerdown', () => {
      if (this.expandedTribes.has(tribe.id)) this.expandedTribes.delete(tribe.id);
      else this.expandedTribes.add(tribe.id);
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

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const idx = r * cols + c;
        if (idx >= sorted.length) break;
        const m     = sorted[idx];
        const owned = this.isOwned(m.id);
        const cx    = PAD + c * cellW;
        const cy    = y + r * (cellH + 4);

        this.drawMonsterCell(m, owned, color, cx, cy, cellW, cellH);
      }
    }

    return y + rows * (cellH + 4) + 4;
  }

  private drawMonsterCell(
    m: (typeof MONSTER_DEFS)[MonsterId],
    owned: boolean,
    tribeColor: number,
    x: number, y: number, w: number, h: number,
  ): void {
    const g = this.add.graphics();
    this.contentCtr.add(g);
    const rarity = this.getRarityMeta(m.rarityTier);
    const dexNo = this.getDexNo(m.id);
    const elementLabel = m.element ? CODEX_ELEMENT_LABELS[m.element] ?? m.element : '중립';

    if (owned) {
      g.fillStyle(0x000000, 0.24);
      g.fillRoundedRect(x + 3, y + 4, w - 5, h - 4, 7);
      g.fillStyle(0x150b08, 1);
      g.fillRoundedRect(x + 2, y + 2, w - 4, h - 4, 7);
      g.fillStyle(rarity.color, 0.10);
      g.fillRoundedRect(x + 8, y + 20, w - 16, 35, 7);
      g.fillStyle(tribeColor, 0.08);
      g.fillRoundedRect(x + 7, y + 58, w - 14, 16, 6);
      this.drawFoilLines(g, x + 8, y + 20, w - 16, 35, rarity.color, 0.10);
      g.lineStyle(1.2, rarity.color, 0.72);
      g.strokeRoundedRect(x + 2, y + 2, w - 4, h - 4, 7);
      g.lineStyle(1, 0xffffff, 0.10);
      g.strokeRoundedRect(x + 6, y + 6, w - 12, h - 12, 5);
      g.fillStyle(0x060402, 0.94);
      g.fillRoundedRect(x + 8, y + 7, 42, 13, 5);
      g.lineStyle(1, rarity.color, 0.46);
      g.strokeRoundedRect(x + 8, y + 7, 42, 13, 5);
      g.fillStyle(rarity.color, 0.17);
      g.fillRoundedRect(x + w - 38, y + 7, 27, 13, 5);
      g.lineStyle(1, rarity.color, 0.54);
      g.strokeRoundedRect(x + w - 38, y + 7, 27, 13, 5);

      const codexSkin = getSkinForMonster(m.id, this.gs.equippedSkins ?? {});
      const codexPortraitKey = generatePortrait(this, m.id as MonsterId, codexSkin?.id);
      if (this.textures.exists(codexPortraitKey)) {
        const portrait = this.add.image(x + w / 2, y + 38, codexPortraitKey)
          .setOrigin(0.5).setDisplaySize(34, 34);
        this.contentCtr.add(portrait);
      } else {
        const emojiT = this.add.text(x + w / 2, y + 24, codexSkin ? codexSkin.emoji : m.emoji, {
          fontFamily: 'sans-serif', fontSize: '28px',
        }).setOrigin(0.5, 0);
        this.contentCtr.add(emojiT);
      }

      const dexT = this.add.text(x + 29, y + 13.5, `도감 ${dexNo}`, {
        fontFamily: 'sans-serif',
        fontSize: '7px',
        color: rarity.css,
        fontStyle: 'bold',
      }).setOrigin(0.5);
      this.contentCtr.add(dexT);

      const rarityT = this.add.text(x + w - 24.5, y + 13.5, rarity.label, {
        fontFamily: 'monospace',
        fontSize: '8px',
        color: rarity.css,
        fontStyle: 'bold',
      }).setOrigin(0.5);
      this.contentCtr.add(rarityT);

      const starsT = this.add.text(x + 13, y + h - 15, rarity.stars, {
        fontFamily: 'sans-serif',
        fontSize: '8px',
        color: rarity.css,
      }).setOrigin(0, 0.5);
      this.contentCtr.add(starsT);

      const nameT = this.add.text(x + w / 2, y + 62, this.truncateLabel(m.name, 7), {
        fontFamily: 'Georgia, serif', fontSize: '10px', color: CSS.PARCHMENT_DIM,
        fontStyle: 'bold',
        align: 'center', wordWrap: { width: w - 8 },
      }).setOrigin(0.5, 0);
      this.contentCtr.add(nameT);

      const metaT = this.add.text(x + w / 2, y + 76, `${elementLabel} · Ch.${m.chapter ?? '-'}`, {
        fontFamily: 'sans-serif',
        fontSize: '7px',
        color: '#b39b72',
      }).setOrigin(0.5);
      this.contentCtr.add(metaT);

      // Tap to show detail overlay
      const tapZone = this.add.zone(x + w / 2, y + h / 2, w - 4, h - 4)
        .setInteractive({ useHandCursor: true }).setOrigin(0.5);
      this.contentCtr.add(tapZone);
      tapZone.on('pointerdown', () => {
        this.detailOverlay?.destroy();
        this.detailOverlay = showCodexMonsterDetail(this, m, this.gs, () => {
          this.detailOverlay = null;
        });
      });

    } else {
      // Silhouette (unowned)
      g.fillStyle(0x000000, 0.22);
      g.fillRoundedRect(x + 3, y + 4, w - 5, h - 4, 7);
      g.fillStyle(0x0b0808, 1);
      g.fillRoundedRect(x + 2, y + 2, w - 4, h - 4, 7);
      g.fillStyle(rarity.color, 0.04);
      g.fillRoundedRect(x + 8, y + 20, w - 16, 35, 7);
      this.drawFoilLines(g, x + 8, y + 20, w - 16, 35, rarity.color, 0.035);
      g.lineStyle(1, 0x2a1a00, 0.8);
      g.strokeRoundedRect(x + 2, y + 2, w - 4, h - 4, 7);
      g.fillStyle(0x060402, 0.88);
      g.fillRoundedRect(x + 8, y + 7, 42, 13, 5);
      g.lineStyle(1, 0x3a2a18, 0.5);
      g.strokeRoundedRect(x + 8, y + 7, 42, 13, 5);
      g.fillStyle(0x060402, 0.88);
      g.fillRoundedRect(x + w - 38, y + 7, 27, 13, 5);
      g.lineStyle(1, rarity.color, 0.24);
      g.strokeRoundedRect(x + w - 38, y + 7, 27, 13, 5);

      const dexT = this.add.text(x + 29, y + 13.5, `도감 ${dexNo}`, {
        fontFamily: 'sans-serif',
        fontSize: '7px',
        color: '#5e4a36',
        fontStyle: 'bold',
      }).setOrigin(0.5);
      this.contentCtr.add(dexT);

      const rarityT = this.add.text(x + w - 24.5, y + 13.5, rarity.label, {
        fontFamily: 'monospace',
        fontSize: '8px',
        color: '#5d4d38',
        fontStyle: 'bold',
      }).setOrigin(0.5);
      this.contentCtr.add(rarityT);

      const shadowT = this.add.text(x + w / 2, y + 28, '???', {
        fontFamily: 'Georgia, serif', fontSize: '18px',
      }).setOrigin(0.5, 0).setAlpha(0.4);
      this.contentCtr.add(shadowT);

      const unknownT = this.add.text(x + w / 2, y + 64, '미발견', {
        fontFamily: 'Georgia, serif', fontSize: '10px', color: '#5a3a18',
        fontStyle: 'bold',
      }).setOrigin(0.5, 0);
      this.contentCtr.add(unknownT);

      const hintT = this.add.text(x + w / 2, y + 78, `${elementLabel} · Ch.${m.chapter ?? '-'}`, {
        fontFamily: 'sans-serif',
        fontSize: '7px',
        color: '#46301c',
      }).setOrigin(0.5);
      this.contentCtr.add(hintT);
    }
  }

  private getDexNo(monsterId: MonsterId): string {
    const index = Object.keys(MONSTER_DEFS).indexOf(monsterId);
    return String(Math.max(0, index) + 1).padStart(3, '0');
  }

  private getRarityMeta(rarityTier: string | undefined): typeof CODEX_RARITY_META[keyof typeof CODEX_RARITY_META] {
    return CODEX_RARITY_META[rarityTier ?? 'C'] ?? CODEX_RARITY_META.C;
  }

  private drawFoilLines(
    g: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    w: number,
    h: number,
    color: number,
    alpha: number,
  ): void {
    const lineCount = Math.max(3, Math.ceil(w / 28));
    for (let i = -1; i < lineCount; i++) {
      const sx = x + 8 + i * 24;
      g.lineStyle(0.8, color, alpha);
      g.lineBetween(sx, y + h - 5, sx + 42, y + 4);
    }
  }

  private truncateLabel(value: string, maxChars: number): string {
    return value.length > maxChars ? `${value.slice(0, maxChars)}…` : value;
  }

  // ─── Monster detail overlay ────────────────────────────────────────────────

  private detailOverlay: Phaser.GameObjects.Container | null = null;

  // ─── Set bonus display ─────────────────────────────────────────────────────

  private drawSetBonus(
    tribe: TribeMeta, owned: number, total: number, y: number,
  ): number {
    const gs = loadGameState();
    const claimed = gs.codexRewardsClaimed?.includes(tribe.id) ?? false;
    const done = owned === total;
    const h = done && !claimed ? 70 : 50;

    const g = this.add.graphics();
    this.contentCtr.add(g);

    g.fillStyle(done ? 0x001a00 : 0x120a00, 1);
    g.fillRoundedRect(PAD + 4, y, CANVAS_WIDTH - PAD * 2 - 8, h, 6);
    g.lineStyle(1, done ? 0x44aa44 : 0x2a1800, 1);
    g.strokeRoundedRect(PAD + 4, y, CANVAS_WIDTH - PAD * 2 - 8, h, 6);

    const labelColor = done ? '#44ff88' : CSS.PARCHMENT_MUTED;
    const prefix = done
      ? (claimed ? '✓ 세트 효과 활성화! (보상 수령 완료)' : '✓ 세트 효과 활성화!')
      : `세트 효과 (${owned}/${total} 달성 시)`;
    const labelT = this.add.text(PAD + 12, y + 8, prefix, {
      fontFamily: 'Georgia, serif', fontSize: '10px', fontStyle: 'bold',
      color: labelColor,
    }).setOrigin(0, 0);
    this.contentCtr.add(labelT);

    const bonusT = this.add.text(PAD + 12, y + 24, `✦ ${tribe.bonus}`, {
      fontFamily: 'Georgia, serif', fontSize: '10px',
      color: done ? '#88ff88' : CSS.PARCHMENT_MUTED,
    }).setOrigin(0, 0);
    this.contentCtr.add(bonusT);

    if (done && !claimed) {
      // Claim button
      const btnW = 120, btnH = 24;
      const btnX = CX - btnW / 2, btnY = y + 40;
      const btnG = this.add.graphics();
      btnG.fillStyle(0x226622, 1);
      btnG.fillRoundedRect(btnX, btnY, btnW, btnH, 5);
      btnG.lineStyle(1, 0x44ff88, 0.8);
      btnG.strokeRoundedRect(btnX, btnY, btnW, btnH, 5);
      this.contentCtr.add(btnG);

      const btnLabel = this.add.text(CX, btnY + btnH / 2, `🎁 ${tribe.reward.split(' ')[0]} 수령`, {
        fontFamily: 'Georgia, serif', fontSize: '11px',
        color: '#44ff88', fontStyle: 'bold',
      }).setOrigin(0.5).setInteractive();
      this.contentCtr.add(btnLabel);

      btnLabel.on('pointerdown', () => {
        this.claimTribeReward(tribe.id);
        // Refresh scene
        this.scene.restart();
      });
    } else if (!done) {
      const rewardT = this.add.text(CANVAS_WIDTH - PAD - 12, y + 8, tribe.reward, {
        fontFamily: 'Georgia, serif', fontSize: '11px', color: '#cc8800',
      }).setOrigin(1, 0);
      this.contentCtr.add(rewardT);
    }

    return y + h + 4;
  }

  private claimTribeReward(tribeId: string): void {
    const rewardMonsterId = TRIBE_REWARD_MONSTER[tribeId];
    if (!rewardMonsterId) return;

    const gs = loadGameState();
    const result = claimCodexTribeReward(gs, tribeId, rewardMonsterId);
    if (!result.ok) return;

    saveGameState(result.state);
    this.gs = result.state;
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
    g.fillStyle(COLORS.STONE_DARK, 1);
    g.fillRect(0, CANVAS_HEIGHT - BOT_H, CANVAS_WIDTH, BOT_H);
    g.lineStyle(1, COLORS.TORCH_GOLD, 0.4);
    g.lineBetween(0, CANVAS_HEIGHT - BOT_H, CANVAS_WIDTH, CANVAS_HEIGHT - BOT_H);

    const btnW = (CANVAS_WIDTH - 24) / 4;
    const btnDefs = [
      { label: '⚔️ 막사',    action: () => this.scene.start('BarracksScene') },
      { label: '📖 도감',    action: () => { /* already here */ } },
      { label: '✨ 소환',    action: () => this.scene.start('SummonScene') },
      { label: '🏪 상점',    action: () => this.scene.start('ShopScene') },
    ];

    btnDefs.forEach(({ label, action }, i) => {
      const bx = 12 + i * (btnW + 4);
      const by = CANVAS_HEIGHT - 56;
      const bg = this.add.graphics().setDepth(21);
      bg.fillStyle(i === 1 ? 0x3a2800 : 0x1a1a1a, 1);
      bg.fillRoundedRect(bx, by, btnW, 44, 6);
      const isActive = i === 1;
      this.add.text(bx + btnW / 2, by + 22, label, {
        fontFamily: 'sans-serif', fontSize: '11px',
        color: isActive ? CSS.TORCH_AMBER : CSS.PARCHMENT_MUTED,
      }).setOrigin(0.5).setDepth(22);
      const zone = this.add.zone(bx + btnW / 2, by + 22, btnW, 44)
        .setInteractive().setDepth(23);
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
      7: 0xc09000, 8: 0x7700cc,
    };

    // Group by chapter
    const byChapter = new Map<number, (typeof INVADER_DEFS)[keyof typeof INVADER_DEFS][]>();
    for (const def of Object.values(INVADER_DEFS)) {
      const ch = def.chapter ?? 1;
      if (!byChapter.has(ch)) byChapter.set(ch, []);
      byChapter.get(ch)!.push(def);
    }

    let cursorY = 8;

    for (const ch of [1, 2, 3, 4, 5, 6, 7, 8] as const) {
      const defs = byChapter.get(ch);
      if (!defs) continue;
      const chColor = CH_COLOR[ch] ?? 0x888888;

      // Chapter header
      const hdrG = this.add.graphics();
      this.contentCtr.add(hdrG);
      hdrG.fillStyle(0x1a1008, 1);
      hdrG.fillRoundedRect(PAD, cursorY, CANVAS_WIDTH - PAD * 2, 28, 6);
      hdrG.lineStyle(1.5, chColor, 0.9);
      hdrG.strokeRoundedRect(PAD, cursorY, CANVAS_WIDTH - PAD * 2, 28, 6);

      const chLabel = this.add.text(PAD + 12, cursorY + 8, `Chapter ${ch}`, {
        fontFamily: 'Georgia, serif', fontSize: '13px', fontStyle: 'bold',
        color: Phaser.Display.Color.IntegerToColor(chColor).rgba,
      }).setOrigin(0, 0);
      this.contentCtr.add(chLabel);
      const countLabel = this.add.text(CANVAS_WIDTH - PAD - 10, cursorY + 10, `${defs.length}종`, {
        fontFamily: 'sans-serif', fontSize: '10px', color: CSS.PARCHMENT_MUTED,
      }).setOrigin(1, 0);
      this.contentCtr.add(countLabel);
      cursorY += 32;

      // Invader rows
      for (const def of defs) {
        const rowH = 26;
        const rowG = this.add.graphics();
        this.contentCtr.add(rowG);
        rowG.fillStyle(def.isBoss ? 0x1a0020 : 0x0e0c06, 1);
        rowG.fillRoundedRect(PAD + 4, cursorY, CANVAS_WIDTH - PAD * 2 - 8, rowH, 4);
        if (def.isBoss) {
          rowG.lineStyle(1, chColor, 0.6);
          rowG.strokeRoundedRect(PAD + 4, cursorY, CANVAS_WIDTH - PAD * 2 - 8, rowH, 4);
        }

        // Colored dot
        rowG.fillStyle(def.color, 1);
        rowG.fillCircle(PAD + 18, cursorY + rowH / 2, def.isBoss ? 6 : 4);

        const nameColor = def.isBoss ? '#ffcc44' : CSS.PARCHMENT_DIM;
        const bossTag   = def.isBoss ? ' 👑' : (def.isMiniBoss ? ' ⭐' : '');
        const nameT = this.add.text(PAD + 28, cursorY + rowH / 2, `${def.koreanName}${bossTag}`, {
          fontFamily: 'Georgia, serif', fontSize: '11px', color: nameColor,
        }).setOrigin(0, 0.5);
        this.contentCtr.add(nameT);

        // Stats (right-aligned)
        const behStr = def.behavior ? (BEHAVIOR_SHORT[def.behavior] ?? def.behavior) : '';
        const statsStr = `HP ${def.hp}  ·  속${def.speed}  ·  피${def.damage}${behStr ? '  ·  ' + behStr : ''}`;
        const statsT = this.add.text(CANVAS_WIDTH - PAD - 8, cursorY + rowH / 2, statsStr, {
          fontFamily: 'sans-serif', fontSize: '9px', color: CSS.PARCHMENT_MUTED,
        }).setOrigin(1, 0.5);
        this.contentCtr.add(statsT);

        cursorY += rowH + 2;
      }
      cursorY += 8;
    }

    this.maxScrollY = Math.max(0, cursorY - (CANVAS_HEIGHT - HDR_H - BOT_H));
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────

  private isOwned(monsterId: MonsterId): boolean {
    return this.gs.ownedMonsters.some(om => {
      const typeId = Object.keys(MONSTER_DEFS).find(
        k => om.id === k || om.id.startsWith(k + '_'),
      ) ?? om.id;
      return typeId === monsterId;
    });
  }
}
