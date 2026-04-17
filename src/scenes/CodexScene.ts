import Phaser from 'phaser';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../constants/layout';
import { COLORS, CSS } from '../constants/colors';
import { loadGameState, saveGameState } from '../data/wisdom';
import type { OwnedMonster } from '../data/barracks';
import { MONSTER_DEFS, getSkinForMonster, type MonsterId, type TribeId } from '../data/monsters';
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

// ─── Scene ────────────────────────────────────────────────────────────────────

export class CodexScene extends Phaser.Scene {
  private scrollY        = 0;
  private maxScrollY     = 0;
  private contentCtr!:   Phaser.GameObjects.Container;
  private expandedTribes: Set<TribeId> = new Set(['dokkaebi']); // first open by default
  private gs = loadGameState();
  private showOwnedOnly  = false;

  constructor() { super({ key: 'CodexScene' }); }

  create(): void {
    this.gs = loadGameState();
    this.scrollY = 0;
    this.showOwnedOnly = this.registry.get('codexOwnedFilter') ?? false;

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
    // back button
    const backBg = this.add.graphics().setDepth(10);
    backBg.fillStyle(COLORS.STONE_MID, 1);
    backBg.fillRoundedRect(8, 10, 72, 32, 6);
    this.add.text(44, 26, '← 뒤로', {
      fontFamily: 'Georgia, serif', fontSize: '11px', color: CSS.TORCH_AMBER,
    }).setOrigin(0.5).setDepth(11);
    this.add.zone(44, 26, 72, 32).setInteractive().setDepth(12)
      .on('pointerdown', () => this.scene.start((this.registry.get('previousScene') as string) ?? 'BarracksScene'));

    // title
    this.add.text(CX, 26, '📖 도감', {
      fontFamily: 'Georgia, serif', fontSize: '22px', fontStyle: 'bold',
      color: CSS.TORCH_AMBER,
    }).setOrigin(0.5).setDepth(10);

    // global completion
    const allIds  = Object.keys(MONSTER_DEFS) as MonsterId[];
    const total   = allIds.length;
    const owned   = allIds.filter(id => this.isOwned(id)).length;
    const pct     = Math.round((owned / total) * 100);

    this.add.text(CX, 55, `전체 도감: ${owned} / ${total}  (${pct}%)`, {
      fontFamily: 'Georgia, serif', fontSize: '12px', color: CSS.PARCHMENT_DIM,
    }).setOrigin(0.5).setDepth(10);

    // global progress bar
    const bx = PAD, by = 72, bw = CANVAS_WIDTH - PAD * 2 - 72, bh = 8;
    const barBg = this.add.graphics().setDepth(10);
    barBg.fillStyle(COLORS.STONE_MID, 1);
    barBg.fillRoundedRect(bx, by, bw, bh, 4);
    barBg.fillStyle(COLORS.TORCH_GOLD, 1);
    barBg.fillRoundedRect(bx, by, Math.max(4, bw * (owned / total)), bh, 4);

    // Filter toggle chip (top-right, aligned with progress bar)
    const chipX = CANVAS_WIDTH - PAD - 64;
    const chipY = 66;
    const chipW = 60;
    const chipH = 22;
    const toggleBg = this.add.graphics().setDepth(10);
    const drawToggle = () => {
      toggleBg.clear();
      toggleBg.fillStyle(this.showOwnedOnly ? 0x226622 : 0x222222, 1);
      toggleBg.fillRoundedRect(chipX, chipY, chipW, chipH, 4);
      toggleBg.lineStyle(1, this.showOwnedOnly ? 0x44aa44 : 0x444444, 0.8);
      toggleBg.strokeRoundedRect(chipX, chipY, chipW, chipH, 4);
    };
    drawToggle();

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
    const cellH = 72;
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

    if (owned) {
      g.fillStyle(0x1a0f00, 1);
      g.fillRoundedRect(x + 2, y + 2, w - 4, h - 4, 6);
      g.lineStyle(1, tribeColor, 0.7);
      g.strokeRoundedRect(x + 2, y + 2, w - 4, h - 4, 6);

      const codexSkin = getSkinForMonster(m.id, this.gs.equippedSkins ?? {});
      const codexPortraitKey = generatePortrait(this, m.id as MonsterId, codexSkin?.id);
      if (this.textures.exists(codexPortraitKey)) {
        const portrait = this.add.image(x + w / 2, y + 24, codexPortraitKey)
          .setOrigin(0.5).setDisplaySize(32, 32);
        this.contentCtr.add(portrait);
      } else {
        const emojiT = this.add.text(x + w / 2, y + 12, codexSkin ? codexSkin.emoji : m.emoji, {
          fontFamily: 'sans-serif', fontSize: '26px',
        }).setOrigin(0.5, 0);
        this.contentCtr.add(emojiT);
      }

      // rarity stars
      const rarityMap: Record<string, string> = {
        C: '⭐', U: '⭐⭐', R: '⭐⭐⭐', E: '⭐⭐⭐⭐', L: '⭐⭐⭐⭐⭐',
      };
      const stars = rarityMap[m.rarityTier ?? 'C'] ?? '⭐';
      const starsT = this.add.text(x + w / 2, y + 43, stars, {
        fontFamily: 'sans-serif', fontSize: '11px',
      }).setOrigin(0.5, 0);
      this.contentCtr.add(starsT);

      const nameT = this.add.text(x + w / 2, y + h - 13, m.name, {
        fontFamily: 'Georgia, serif', fontSize: '11px', color: CSS.PARCHMENT_DIM,
        align: 'center', wordWrap: { width: w - 8 },
      }).setOrigin(0.5, 0);
      this.contentCtr.add(nameT);

      // Tap to show detail overlay
      const tapZone = this.add.zone(x + w / 2, y + h / 2, w - 4, h - 4)
        .setInteractive().setOrigin(0.5);
      this.contentCtr.add(tapZone);
      tapZone.on('pointerdown', () => {
        this.detailOverlay?.destroy();
        this.detailOverlay = showCodexMonsterDetail(this, m, this.gs, () => {
          this.detailOverlay = null;
        });
      });

    } else {
      // Silhouette (unowned)
      g.fillStyle(0x0e0a04, 1);
      g.fillRoundedRect(x + 2, y + 2, w - 4, h - 4, 6);
      g.lineStyle(1, 0x2a1a00, 0.8);
      g.strokeRoundedRect(x + 2, y + 2, w - 4, h - 4, 6);

      const shadowT = this.add.text(x + w / 2, y + 12, '❓', {
        fontFamily: 'sans-serif', fontSize: '26px',
      }).setOrigin(0.5, 0).setAlpha(0.4);
      this.contentCtr.add(shadowT);

      const unknownT = this.add.text(x + w / 2, y + h - 18, '???', {
        fontFamily: 'Georgia, serif', fontSize: '11px', color: '#3a2800',
      }).setOrigin(0.5, 0);
      this.contentCtr.add(unknownT);
    }
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
    if (!gs.codexRewardsClaimed) gs.codexRewardsClaimed = [];
    if (gs.codexRewardsClaimed.includes(tribeId)) return;

    // Add reward monster
    const mDef = MONSTER_DEFS[rewardMonsterId];
    if (!mDef) return;

    const newMonster: OwnedMonster = {
      id: rewardMonsterId,
      level: 1,
      xp: 0,
      skillPoints: 0,
      spentSkills: {},
      equippedSkills: [],
      equipment: null,
      absorptionStacks: 0,
    };

    // Check not already owned
    if (!gs.ownedMonsters.some(m => m.id === rewardMonsterId)) {
      gs.ownedMonsters.push(newMonster);
    }

    gs.codexRewardsClaimed.push(tribeId);
    gs.completedTribes = gs.codexRewardsClaimed.length;
    saveGameState(gs);
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
