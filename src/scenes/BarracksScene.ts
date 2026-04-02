import Phaser from 'phaser';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../constants/layout';
import { COLORS, CSS } from '../constants/colors';
import { loadGameState, saveGameState, type OwnedMonster } from '../data/wisdom';
import { updateQuestObjective, tickSubQuestProgress } from '../data/quests';
import { MONSTER_DEFS, getSkinForMonster, getSkinsForMonster, type MonsterId } from '../data/monsters';
import {
  SKILL_TREES, ACTIVE_SKILLS, EQUIPMENT_DEFS,
  xpToNextLevel, getMonsterAtk, addXp, type SkillTree,
} from '../data/barracks';
import { generatePortrait } from '../art/PortraitGenerator';

const CARD_W  = 162;
const CARD_H  = 210;
const CARD_PAD = 10;
const CARD_START_X = 14;
const CARD_START_Y = 100;

export class BarracksScene extends Phaser.Scene {
  private gs = loadGameState();
  private scrollY    = 0;
  private maxScrollY = 0;
  private contentContainer!: Phaser.GameObjects.Container;
  private detailOverlay?: Phaser.GameObjects.Container;
  private shopOverlay?:   Phaser.GameObjects.Container;

  constructor() { super({ key: 'BarracksScene' }); }

  create(): void {
    this.gs = loadGameState();
    this.scrollY = 0;

    this.drawBackground();
    this.drawHeader();
    this.buildContent();
    this.buildBottomNav();
    this.setupScroll();
  }

  // ─── Background ──────────────────────────────────────────────────────────────

  private drawBackground(): void {
    const g = this.add.graphics().setDepth(-10);
    g.fillStyle(COLORS.BLACK, 1);
    g.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    // Stone tile grid
    for (let x = 0; x < CANVAS_WIDTH; x += 36)
      for (let y = 0; y < CANVAS_HEIGHT; y += 36) {
        g.lineStyle(0.3, COLORS.STONE_MID, 0.2);
        g.strokeRect(x, y, 36, 36);
      }
    // Top accent bar
    g.fillStyle(COLORS.STONE_DARK, 1);
    g.fillRect(0, 0, CANVAS_WIDTH, 88);
    g.lineStyle(2, COLORS.TORCH_GOLD, 0.6);
    g.lineBetween(0, 88, CANVAS_WIDTH, 88);
  }

  private drawHeader(): void {
    this.add.text(CANVAS_WIDTH / 2, 24, '⚔️ 몬스터 막사', {
      fontFamily: 'Georgia, serif', fontSize: '22px', fontStyle: 'bold',
      color: CSS.TORCH_AMBER,
    }).setOrigin(0.5).setDepth(10);

    const power = this.gs.ownedMonsters.reduce((s, m) => {
      const def = MONSTER_DEFS[m.id as keyof typeof MONSTER_DEFS];
      return s + getMonsterAtk(def?.baseDamage ?? 10, m.level, m.spentSkills);
    }, 0);

    this.add.text(CANVAS_WIDTH / 2, 52, `전투력: ${power}`, {
      fontFamily: 'sans-serif', fontSize: '13px', color: CSS.PARCHMENT_MUTED,
    }).setOrigin(0.5).setDepth(10);

    this.add.text(CANVAS_WIDTH / 2, 70, `몬스터 ${this.gs.ownedMonsters.length}체 보유`, {
      fontFamily: 'sans-serif', fontSize: '11px', color: CSS.PARCHMENT_MUTED,
    }).setOrigin(0.5).setDepth(10);

    // Back button
    this.buildBtn(24, 24, '← 뒤로', 0x2d2416, () => this.scene.start('StageSelectScene'));
  }

  // ─── Scrollable card grid ─────────────────────────────────────────────────────

  private buildContent(): void {
    this.contentContainer = this.add.container(0, 0).setDepth(5);

    const monsters = this.gs.ownedMonsters;
    const cols = 2;

    monsters.forEach((m, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x   = CARD_START_X + col * (CARD_W + CARD_PAD);
      const y   = CARD_START_Y + row * (CARD_H + CARD_PAD);
      this.buildMonsterCard(m, x, y);
    });

    // "소환" empty slot at the end
    const nextIdx = monsters.length;
    const col = nextIdx % cols;
    const row = Math.floor(nextIdx / cols);
    const x   = CARD_START_X + col * (CARD_W + CARD_PAD);
    const y   = CARD_START_Y + row * (CARD_H + CARD_PAD);
    this.buildSummonSlot(x, y);

    const rows = Math.ceil((monsters.length + 1) / cols);
    this.maxScrollY = Math.max(0, CARD_START_Y + rows * (CARD_H + CARD_PAD) + 20 - (CANVAS_HEIGHT - 80));
  }

  private buildMonsterCard(m: OwnedMonster, x: number, y: number): void {
    const def = MONSTER_DEFS[m.id as keyof typeof MONSTER_DEFS];
    if (!def) return;

    // Card background
    const bg = this.add.graphics();
    bg.fillStyle(COLORS.STONE_DARK, 1);
    bg.fillRoundedRect(x, y, CARD_W, CARD_H, 10);
    bg.lineStyle(2, def.accentColor ?? COLORS.TORCH_GOLD, 0.8);
    bg.strokeRoundedRect(x, y, CARD_W, CARD_H, 10);
    this.contentContainer.add(bg);

    // Monster portrait / emoji — apply skin if equipped
    const cardSkin = getSkinForMonster(m.id, this.gs.equippedSkins ?? {});
    const cardPortraitKey = generatePortrait(this, m.id as MonsterId, cardSkin?.id);
    if (this.textures.exists(cardPortraitKey)) {
      const cardPortrait = this.add.image(x + CARD_W / 2, y + 34, cardPortraitKey)
        .setOrigin(0.5).setDisplaySize(36, 36);
      this.contentContainer.add(cardPortrait);
    } else {
      const emoji = this.add.text(x + CARD_W / 2, y + 34, cardSkin ? cardSkin.emoji : def.emoji, {
        fontFamily: 'sans-serif', fontSize: '36px',
      }).setOrigin(0.5);
      this.contentContainer.add(emoji);
    }

    // Level badge
    const lvBg = this.add.graphics();
    lvBg.fillStyle(COLORS.STONE_MID, 1);
    lvBg.fillRoundedRect(x + CARD_W - 38, y + 6, 32, 18, 4);
    this.contentContainer.add(lvBg);
    const lvT = this.add.text(x + CARD_W - 22, y + 15, `Lv.${m.level}`, {
      fontFamily: 'sans-serif', fontSize: '10px', fontStyle: 'bold', color: CSS.TORCH_AMBER,
    }).setOrigin(0.5);
    this.contentContainer.add(lvT);

    // Name
    const nameT = this.add.text(x + CARD_W / 2, y + 70, def.name, {
      fontFamily: 'Georgia, serif', fontSize: '12px', color: CSS.PARCHMENT,
    }).setOrigin(0.5);
    this.contentContainer.add(nameT);

    // ATK stat
    const atk = getMonsterAtk(def.baseDamage, m.level, m.spentSkills);
    const atkT = this.add.text(x + CARD_W / 2, y + 88, `⚔️ ATK: ${atk}`, {
      fontFamily: 'sans-serif', fontSize: '11px', color: '#ff9944',
    }).setOrigin(0.5);
    this.contentContainer.add(atkT);

    // XP bar
    const xpNeeded = xpToNextLevel(m.level);
    const xpPct    = m.level >= 50 ? 1 : Math.min(1, m.xp / xpNeeded);
    const barW = CARD_W - 20;
    const barBg = this.add.graphics();
    barBg.fillStyle(0x1a1a1a, 1);
    barBg.fillRoundedRect(x + 10, y + 104, barW, 8, 3);
    barBg.fillStyle(0x44aa44, 1);
    barBg.fillRoundedRect(x + 10, y + 104, Math.round(barW * xpPct), 8, 3);
    this.contentContainer.add(barBg);

    const xpT = this.add.text(x + CARD_W / 2, y + 108, m.level >= 50 ? 'MAX' : `${m.xp}/${xpNeeded}`, {
      fontFamily: 'sans-serif', fontSize: '8px', color: '#88cc88',
    }).setOrigin(0.5);
    this.contentContainer.add(xpT);

    // Skill chips
    const skillsText = m.equippedSkills.length > 0
      ? m.equippedSkills.map(sk => ACTIVE_SKILLS.find(s => s.id === sk)?.icon ?? '?').join(' ')
      : '스킬 없음';
    const skillT = this.add.text(x + CARD_W / 2, y + 128, skillsText, {
      fontFamily: 'sans-serif', fontSize: '11px', color: '#aaaaff',
    }).setOrigin(0.5);
    this.contentContainer.add(skillT);

    // Equipment slot
    const eqId  = m.equipment;
    const eqDef = eqId ? EQUIPMENT_DEFS.find(e => e.id === eqId) : null;
    const eqBg  = this.add.graphics();
    eqBg.fillStyle(eqDef ? 0x3a2800 : 0x1a1a1a, 1);
    eqBg.fillRoundedRect(x + CARD_W / 2 - 30, y + 144, 60, 24, 6);
    eqBg.lineStyle(1.5, eqDef ? COLORS.TORCH_GOLD : 0x444444, 0.7);
    eqBg.strokeRoundedRect(x + CARD_W / 2 - 30, y + 144, 60, 24, 6);
    this.contentContainer.add(eqBg);
    const eqT = this.add.text(x + CARD_W / 2, y + 156, eqDef ? `${eqDef.icon} ${eqDef.name}` : '장비 없음', {
      fontFamily: 'sans-serif', fontSize: '9px', color: eqDef ? CSS.TORCH_AMBER : '#666666',
    }).setOrigin(0.5);
    this.contentContainer.add(eqT);

    // SP badge
    if (m.skillPoints > 0) {
      const spBg = this.add.graphics();
      spBg.fillStyle(0x8800cc, 1);
      spBg.fillCircle(x + 18, y + 18, 10);
      this.contentContainer.add(spBg);
      const spT = this.add.text(x + 18, y + 18, `${m.skillPoints}`, {
        fontFamily: 'sans-serif', fontSize: '10px', fontStyle: 'bold', color: '#ffffff',
      }).setOrigin(0.5);
      this.contentContainer.add(spT);
    }

    // Tap zone
    const zone = this.add.zone(x + CARD_W / 2, y + CARD_H / 2, CARD_W, CARD_H).setInteractive();
    zone.on('pointerdown', () => this.showMonsterDetail(m));
    this.contentContainer.add(zone);
  }

  private buildSummonSlot(x: number, y: number): void {
    const bg = this.add.graphics();
    bg.lineStyle(2, COLORS.TORCH_GOLD, 0.4);
    bg.strokeRoundedRect(x, y, CARD_W, CARD_H, 10);
    bg.fillStyle(0x1a1000, 0.5);
    bg.fillRoundedRect(x, y, CARD_W, CARD_H, 10);
    this.contentContainer.add(bg);

    const t = this.add.text(x + CARD_W / 2, y + CARD_H / 2 - 16, '✨', {
      fontFamily: 'sans-serif', fontSize: '32px',
    }).setOrigin(0.5);
    this.contentContainer.add(t);

    const label = this.add.text(x + CARD_W / 2, y + CARD_H / 2 + 18, '새 몬스터 소환', {
      fontFamily: 'sans-serif', fontSize: '11px', color: CSS.TORCH_AMBER,
    }).setOrigin(0.5);
    this.contentContainer.add(label);

    const zone = this.add.zone(x + CARD_W / 2, y + CARD_H / 2, CARD_W, CARD_H).setInteractive();
    zone.on('pointerdown', () => this.scene.start('SummonScene'));
    this.contentContainer.add(zone);
  }

  // ─── Monster Detail Overlay ───────────────────────────────────────────────────

  private showMonsterDetail(m: OwnedMonster): void {
    this.detailOverlay?.destroy();

    const ov = this.add.container(0, 0).setDepth(100);
    this.detailOverlay = ov;

    // Dim
    const dim = this.add.graphics();
    dim.fillStyle(0x000000, 0.88);
    dim.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    ov.add(dim);

    const def = MONSTER_DEFS[m.id as keyof typeof MONSTER_DEFS]!;
    const tree = SKILL_TREES[m.id as keyof typeof SKILL_TREES];

    // Panel
    const pw = 360, ph = 680;
    const px = (CANVAS_WIDTH - pw) / 2;
    const py = (CANVAS_HEIGHT - ph) / 2;
    const panel = this.add.graphics();
    panel.fillStyle(COLORS.STONE_DARK, 1);
    panel.fillRoundedRect(px, py, pw, ph, 14);
    panel.lineStyle(2, def.accentColor ?? COLORS.TORCH_GOLD, 0.9);
    panel.strokeRoundedRect(px, py, pw, ph, 14);
    ov.add(panel);

    // Header — portrait with emoji fallback
    const detailSkin = getSkinForMonster(m.id, this.gs.equippedSkins ?? {});
    const portraitKey = generatePortrait(this, m.id as MonsterId, detailSkin?.id);
    if (this.textures.exists(portraitKey)) {
      const portrait = this.add.image(px + pw / 2, py + 38, portraitKey)
        .setOrigin(0.5).setDisplaySize(48, 48);
      ov.add(portrait);
    } else {
      const headerEmoji = this.add.text(px + pw / 2, py + 38, detailSkin ? detailSkin.emoji : def.emoji, {
        fontFamily: 'sans-serif', fontSize: '40px',
      }).setOrigin(0.5);
      ov.add(headerEmoji);
    }

    const nameT = this.add.text(px + pw / 2, py + 82, `${def.name}  Lv.${m.level}`, {
      fontFamily: 'Georgia, serif', fontSize: '16px', fontStyle: 'bold', color: CSS.PARCHMENT,
    }).setOrigin(0.5);
    ov.add(nameT);

    // Stats row
    const atk = getMonsterAtk(def.baseDamage, m.level, m.spentSkills);
    const statsT = this.add.text(px + pw / 2, py + 108, `⚔️ ATK: ${atk}   🕐 CD: ${def.attackCooldown}ms   📏 Range: ${def.range}`, {
      fontFamily: 'sans-serif', fontSize: '11px', color: CSS.PARCHMENT_DIM,
    }).setOrigin(0.5);
    ov.add(statsT);

    // XP bar
    const xpNeeded = xpToNextLevel(m.level);
    const xpPct    = m.level >= 50 ? 1 : Math.min(1, m.xp / xpNeeded);
    const xpBarW   = pw - 40;
    const xpBg = this.add.graphics();
    xpBg.fillStyle(0x111111, 1);
    xpBg.fillRoundedRect(px + 20, py + 122, xpBarW, 10, 4);
    xpBg.fillStyle(0x44aa44, 1);
    xpBg.fillRoundedRect(px + 20, py + 122, Math.round(xpBarW * xpPct), 10, 4);
    ov.add(xpBg);

    const xpLabel = this.add.text(px + pw / 2, py + 127, m.level >= 50 ? 'MAX LEVEL' : `EXP ${m.xp} / ${xpNeeded}`, {
      fontFamily: 'sans-serif', fontSize: '9px', color: '#88cc88',
    }).setOrigin(0.5);
    ov.add(xpLabel);

    // SP display
    const spT = this.add.text(px + 20, py + 144, `💫 스킬 포인트: ${m.skillPoints}`, {
      fontFamily: 'sans-serif', fontSize: '11px', color: '#cc88ff',
    });
    ov.add(spT);

    // Divider
    const div1 = this.add.graphics();
    div1.lineStyle(1, COLORS.STONE_MID, 0.6);
    div1.lineBetween(px + 16, py + 162, px + pw - 16, py + 162);
    ov.add(div1);

    // Skill Tree section
    if (tree) {
      this.buildSkillTreeSection(ov, m, tree, px + 12, py + 172, pw - 24);
    } else {
      const noTree = this.add.text(px + pw / 2, py + 200, '스킬 트리 준비 중...', {
        fontFamily: 'sans-serif', fontSize: '12px', color: '#888888',
      }).setOrigin(0.5);
      ov.add(noTree);
    }

    // Equipment section
    const eqY = py + 450;
    const eqDiv = this.add.graphics();
    eqDiv.lineStyle(1, COLORS.STONE_MID, 0.5);
    eqDiv.lineBetween(px + 16, eqY, px + pw - 16, eqY);
    ov.add(eqDiv);

    const eqLabel = this.add.text(px + 16, eqY + 8, '🗡️ 장비', {
      fontFamily: 'Georgia, serif', fontSize: '13px', color: CSS.TORCH_AMBER,
    });
    ov.add(eqLabel);

    this.buildEquipmentSlot(ov, m, px + 16, eqY + 30);

    // Active Skills section
    const skY = eqY + 90;
    const skDiv = this.add.graphics();
    skDiv.lineStyle(1, COLORS.STONE_MID, 0.5);
    skDiv.lineBetween(px + 16, skY, px + pw - 16, skY);
    ov.add(skDiv);

    const skLabel = this.add.text(px + 16, skY + 8, '✨ 장착 스킬', {
      fontFamily: 'Georgia, serif', fontSize: '13px', color: CSS.TORCH_AMBER,
    });
    ov.add(skLabel);

    this.buildEquippedSkillSlots(ov, m, px + 16, skY + 30, pw - 32);

    // Skin section
    const skinSectionY = skY + 100;
    const skinDiv = this.add.graphics();
    skinDiv.lineStyle(1, COLORS.STONE_MID, 0.5);
    skinDiv.lineBetween(px + 16, skinSectionY, px + pw - 16, skinSectionY);
    ov.add(skinDiv);
    ov.add(this.add.text(px + 16, skinSectionY + 8, '🎨 코스튬', {
      fontFamily: 'Georgia, serif', fontSize: '13px', color: CSS.TORCH_AMBER,
    }));
    this.buildSkinSlot(ov, m, px + 16, skinSectionY + 30, pw - 32);

    // ── Feed button ──────────────────────────────────────────────────────────
    const feedY = CANVAS_HEIGHT - 80;
    const feedBg = this.add.graphics();
    feedBg.fillStyle(0x3a2200, 1);
    feedBg.fillRoundedRect(px + 16, feedY, pw - 32, 34, 8);
    feedBg.lineStyle(1, 0xcc8800, 0.7);
    feedBg.strokeRoundedRect(px + 16, feedY, pw - 32, 34, 8);
    ov.add(feedBg);
    const feedT = this.add.text(CANVAS_WIDTH / 2, feedY + 17, '🍖 먹이 주기  (50💰 → +20 EXP)', {
      fontFamily: 'sans-serif', fontSize: '12px', color: '#ffcc44',
    }).setOrigin(0.5);
    ov.add(feedT);
    const feedZone = this.add.zone(CANVAS_WIDTH / 2, feedY + 17, pw - 32, 34).setInteractive();
    feedZone.on('pointerdown', () => {
      const gs3 = loadGameState();
      if ((gs3.homeGold ?? 0) < 50) {
        feedT.setText('💰 골드 부족!').setColor('#ff4444');
        this.time.delayedCall(1200, () => feedT.setText('🍖 먹이 주기  (50💰 → +20 EXP)').setColor('#ffcc44'));
        return;
      }
      gs3.homeGold -= 50;
      // Apply XP to the monster
      const idx3 = gs3.ownedMonsters.findIndex(om => om.id === m.id);
      if (idx3 >= 0) {
        addXp(gs3.ownedMonsters[idx3], 20);
        m.xp    = gs3.ownedMonsters[idx3].xp;
        m.level = gs3.ownedMonsters[idx3].level;
      }
      updateQuestObjective(gs3, 'feed_monster');
      tickSubQuestProgress(gs3, 'feed_monster');
      saveGameState(gs3);
      feedT.setText('✅ 먹이 줬다!').setColor('#88ff88');
      this.time.delayedCall(1200, () => {
        ov.destroy(); this.detailOverlay = undefined;
        this.showMonsterDetail(m);
      });
    });
    ov.add(feedZone);

    // Close button
    const closeZone = this.add.zone(CANVAS_WIDTH / 2, CANVAS_HEIGHT - 30, pw, 44).setInteractive();
    closeZone.on('pointerdown', () => { ov.destroy(); this.detailOverlay = undefined; });
    ov.add(closeZone);

    const closeT = this.add.text(CANVAS_WIDTH / 2, CANVAS_HEIGHT - 30, '닫기  ✕', {
      fontFamily: 'sans-serif', fontSize: '13px', color: CSS.PARCHMENT_MUTED,
    }).setOrigin(0.5);
    ov.add(closeT);
  }

  // ─── Skill Tree UI ────────────────────────────────────────────────────────────

  private buildSkillTreeSection(
    ov: Phaser.GameObjects.Container,
    m: OwnedMonster,
    tree: SkillTree,
    x: number, y: number, w: number,
  ): void {
    const hdr = this.add.text(x + w / 2, y, '스킬 트리', {
      fontFamily: 'Georgia, serif', fontSize: '13px', color: CSS.TORCH_AMBER,
    }).setOrigin(0.5);
    ov.add(hdr);

    const branches = (['A', 'B', 'C'] as const);
    const colW = w / 3;

    branches.forEach((branch, bi) => {
      const bx = x + bi * colW;
      const branchNodes = tree.nodes.filter(n => n.branch === branch).sort((a, b) => a.tier - b.tier);

      // Branch name label
      const bnT = this.add.text(bx + colW / 2, y + 20, tree.branchNames[branch], {
        fontFamily: 'sans-serif', fontSize: '11px', fontStyle: 'bold', color: '#aaaaff',
      }).setOrigin(0.5);
      ov.add(bnT);

      branchNodes.forEach((node, ni) => {
        const ny = y + 44 + ni * 72;
        const nx = bx + colW / 2;
        const spent = (m.spentSkills[node.id] ?? 0) >= 1;
        const prereqMet = !node.requires || (m.spentSkills[node.requires] ?? 0) >= 1;
        const canAfford = m.skillPoints >= node.cost;

        // Node bg
        const nodeBg = this.add.graphics();
        nodeBg.fillStyle(spent ? 0x224400 : prereqMet ? 0x1a1a2a : 0x0d0d0d, 1);
        nodeBg.fillRoundedRect(nx - 40, ny, 80, 60, 8);
        nodeBg.lineStyle(2, spent ? 0x44ff44 : prereqMet && canAfford ? 0xaaaaff : 0x444444, 0.8);
        nodeBg.strokeRoundedRect(nx - 40, ny, 80, 60, 8);
        ov.add(nodeBg);

        const iconT = this.add.text(nx, ny + 14, node.icon, {
          fontFamily: 'sans-serif', fontSize: '16px',
        }).setOrigin(0.5);
        ov.add(iconT);

        const nodeNameT = this.add.text(nx, ny + 32, node.name, {
          fontFamily: 'sans-serif', fontSize: '9px', color: spent ? '#88ff88' : CSS.PARCHMENT_DIM,
          wordWrap: { width: 76 }, align: 'center',
        }).setOrigin(0.5);
        ov.add(nodeNameT);

        const costT = this.add.text(nx, ny + 50, spent ? '✓' : `${node.cost}SP`, {
          fontFamily: 'sans-serif', fontSize: '9px', color: spent ? '#44ff44' : '#cc88ff',
        }).setOrigin(0.5);
        ov.add(costT);

        // Tap to spend SP
        if (!spent && prereqMet && canAfford) {
          const zone = this.add.zone(nx, ny + 30, 80, 60).setInteractive();
          zone.on('pointerdown', () => {
            m.spentSkills[node.id] = 1;
            m.skillPoints -= node.cost;
            // Persist
            const gs = loadGameState();
            const idx = gs.ownedMonsters.findIndex(om => om.id === m.id);
            if (idx >= 0) gs.ownedMonsters[idx] = m;
            saveGameState(gs);
            // Refresh detail
            ov.destroy();
            this.detailOverlay = undefined;
            this.showMonsterDetail(m);
          });
          ov.add(zone);
        }
      });
    });
  }

  // ─── Equipment Slot ───────────────────────────────────────────────────────────

  // ─── Skin Slot ────────────────────────────────────────────────────────────────

  private buildSkinSlot(ov: Phaser.GameObjects.Container, m: OwnedMonster, x: number, y: number, w: number): void {
    const gs      = loadGameState();
    const typeId  = Object.keys(MONSTER_DEFS).find(k => m.id === k || m.id.startsWith(k + '_')) ?? m.id;
    const owned   = getSkinsForMonster(typeId).filter(
      s => (gs.ownedSkins?.[typeId] ?? []).includes(s.id),
    );
    const equipped = gs.equippedSkins?.[typeId];

    // Options: [기본] + owned skins
    const options = [null, ...owned];  // null = default
    const optW    = Math.min(64, (w - 4) / options.length);

    options.forEach((skin, i) => {
      const bx     = x + i * (optW + 4);
      const isActive = skin ? equipped === skin.id : !equipped;

      const bg = this.add.graphics();
      bg.fillStyle(isActive ? 0x2a1800 : 0x111111, 1);
      bg.fillRoundedRect(bx, y, optW, 52, 6);
      bg.lineStyle(1.5, isActive ? COLORS.TORCH_GOLD : 0x333333, isActive ? 1 : 0.5);
      bg.strokeRoundedRect(bx, y, optW, 52, 6);
      ov.add(bg);

      const def = MONSTER_DEFS[typeId as keyof typeof MONSTER_DEFS];
      const emojiT = this.add.text(bx + optW / 2, y + 10, skin ? skin.emoji : (def?.emoji ?? '?'), {
        fontFamily: 'sans-serif', fontSize: '20px',
      }).setOrigin(0.5, 0);
      ov.add(emojiT);

      const nameT = this.add.text(bx + optW / 2, y + 36, skin ? '스킨' : '기본', {
        fontFamily: 'sans-serif', fontSize: '8px',
        color: isActive ? CSS.TORCH_AMBER : CSS.PARCHMENT_MUTED,
      }).setOrigin(0.5, 0);
      ov.add(nameT);

      const zone = this.add.zone(bx + optW / 2, y + 26, optW, 52).setInteractive();
      zone.on('pointerdown', () => {
        const state = loadGameState();
        if (!state.equippedSkins) state.equippedSkins = {};
        if (skin) {
          state.equippedSkins[typeId] = skin.id;
        } else {
          delete state.equippedSkins[typeId];
        }
        saveGameState(state);
        ov.destroy();
        this.detailOverlay = undefined;
        this.showMonsterDetail(m);
      });
      ov.add(zone);
    });

    if (owned.length === 0) {
      ov.add(this.add.text(x + w / 2, y + 26, '보유 스킨 없음 — 상점에서 구매', {
        fontFamily: 'sans-serif', fontSize: '10px', color: '#555588',
      }).setOrigin(0.5));
    }
  }

  private buildEquipmentSlot(ov: Phaser.GameObjects.Container, m: OwnedMonster, x: number, y: number): void {
    const eqId  = m.equipment;
    const eqDef = eqId ? EQUIPMENT_DEFS.find(e => e.id === eqId) : null;
    const gs    = loadGameState();

    // Current slot
    const slotBg = this.add.graphics();
    slotBg.fillStyle(eqDef ? 0x2a1800 : 0x111111, 1);
    slotBg.fillRoundedRect(x, y, 140, 40, 8);
    slotBg.lineStyle(1.5, eqDef ? COLORS.TORCH_GOLD : 0x444444, 0.8);
    slotBg.strokeRoundedRect(x, y, 140, 40, 8);
    ov.add(slotBg);

    const slotT = this.add.text(x + 70, y + 20, eqDef ? `${eqDef.icon} ${eqDef.name}` : '장비 없음', {
      fontFamily: 'sans-serif', fontSize: '11px', color: eqDef ? CSS.TORCH_AMBER : '#666666',
    }).setOrigin(0.5);
    ov.add(slotT);

    // Inventory equipment buttons
    const owned = gs.ownedEquipment;
    let btnX = x + 150;
    owned.slice(0, 4).forEach(eId => {
      const ed = EQUIPMENT_DEFS.find(e => e.id === eId);
      if (!ed) return;
      const btn = this.add.text(btnX, y + 20, ed.icon, {
        fontFamily: 'sans-serif', fontSize: '18px', backgroundColor: '#1a1a00',
        padding: { x: 4, y: 2 },
      }).setOrigin(0, 0.5).setInteractive();
      btn.on('pointerdown', () => {
        m.equipment = eId;
        const gs2 = loadGameState();
        const idx = gs2.ownedMonsters.findIndex(om => om.id === m.id);
        if (idx >= 0) gs2.ownedMonsters[idx] = m;
        saveGameState(gs2);
        ov.destroy(); this.detailOverlay = undefined;
        this.showMonsterDetail(m);
      });
      ov.add(btn);
      btnX += 32;
    });
  }

  // ─── Equipped Skill Slots ─────────────────────────────────────────────────────

  private buildEquippedSkillSlots(
    ov: Phaser.GameObjects.Container,
    m: OwnedMonster,
    x: number, y: number, w: number,
  ): void {
    const gs = loadGameState();
    const slots = [0, 1];
    slots.forEach(si => {
      const sx   = x + si * (w / 2 + 4);
      const skId = m.equippedSkills[si];
      const sk   = skId ? ACTIVE_SKILLS.find(s => s.id === skId) : null;

      const bg = this.add.graphics();
      bg.fillStyle(sk ? 0x1a0020 : 0x111111, 1);
      bg.fillRoundedRect(sx, y, w / 2 - 4, 50, 8);
      bg.lineStyle(1.5, sk ? 0xaa44ff : 0x444444, 0.8);
      bg.strokeRoundedRect(sx, y, w / 2 - 4, 50, 8);
      ov.add(bg);

      const slotT = this.add.text(sx + (w / 2 - 4) / 2, y + 25, sk ? `${sk.icon} ${sk.name}` : `스킬 ${si + 1}`, {
        fontFamily: 'sans-serif', fontSize: '10px',
        color: sk ? '#cc88ff' : '#666666', align: 'center',
        wordWrap: { width: w / 2 - 12 },
      }).setOrigin(0.5);
      ov.add(slotT);

      // Tap to cycle through owned skills
      const owned = gs.ownedActiveSkills;
      const zone  = this.add.zone(sx + (w / 2 - 4) / 2, y + 25, w / 2 - 4, 50).setInteractive();
      zone.on('pointerdown', () => {
        if (!owned.length) return;
        const nextIdx = skId ? (owned.indexOf(skId) + 1) % owned.length : 0;
        m.equippedSkills[si] = owned[nextIdx];
        const gs2 = loadGameState();
        const idx = gs2.ownedMonsters.findIndex(om => om.id === m.id);
        if (idx >= 0) gs2.ownedMonsters[idx] = m;
        saveGameState(gs2);
        ov.destroy(); this.detailOverlay = undefined;
        this.showMonsterDetail(m);
      });
      ov.add(zone);
    });
  }

  // ─── Bottom Nav ───────────────────────────────────────────────────────────────

  private buildBottomNav(): void {
    const navBg = this.add.graphics().setDepth(20);
    navBg.fillStyle(COLORS.STONE_DARK, 1);
    navBg.fillRect(0, CANVAS_HEIGHT - 72, CANVAS_WIDTH, 72);
    navBg.lineStyle(1, COLORS.TORCH_GOLD, 0.4);
    navBg.lineBetween(0, CANVAS_HEIGHT - 72, CANVAS_WIDTH, CANVAS_HEIGHT - 72);

    const btnW = (CANVAS_WIDTH - 24) / 4;
    const btnDefs = [
      { label: '⚔️ 막사',  active: true,  action: () => { /* already here */ } },
      { label: '📖 도감',  active: false, action: () => { this.registry.set('previousScene', 'BarracksScene'); this.scene.start('CodexScene'); } },
      { label: '✨ 소환',  active: false, action: () => this.scene.start('SummonScene') },
      { label: '🏪 상점',  active: false, action: () => this.scene.start('ShopScene') },
    ];

    btnDefs.forEach(({ label, active, action }, i) => {
      const bx = 12 + i * (btnW + 4);
      const by = CANVAS_HEIGHT - 56;
      const bg = this.add.graphics().setDepth(21);
      bg.fillStyle(active ? 0x3a2800 : 0x1a1a1a, 1);
      bg.fillRoundedRect(bx, by, btnW, 44, 6);
      this.add.text(bx + btnW / 2, by + 22, label, {
        fontFamily: 'sans-serif', fontSize: '11px',
        color: active ? CSS.TORCH_AMBER : CSS.PARCHMENT_MUTED,
      }).setOrigin(0.5).setDepth(22);
      const zone = this.add.zone(bx + btnW / 2, by + 22, btnW, 44).setInteractive().setDepth(23);
      zone.on('pointerdown', action);
    });
  }

  // ─── Skill Shop Overlay ───────────────────────────────────────────────────────

  private showSkillShop(): void {
    this.shopOverlay?.destroy();

    const ov = this.add.container(0, 0).setDepth(110);
    this.shopOverlay = ov;

    const dim = this.add.graphics();
    dim.fillStyle(0x000000, 0.85);
    dim.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    ov.add(dim);

    this.add.text(CANVAS_WIDTH / 2, 40, '🛒 스킬 상점', {
      fontFamily: 'Georgia, serif', fontSize: '20px', color: CSS.TORCH_AMBER,
    }).setOrigin(0.5).setDepth(111);
    ov.add(this.children.getByName('') as Phaser.GameObjects.Text);  // handled inline

    const titleT = this.add.text(CANVAS_WIDTH / 2, 40, '🛒 스킬 상점', {
      fontFamily: 'Georgia, serif', fontSize: '20px', color: CSS.TORCH_AMBER,
    }).setOrigin(0.5);
    ov.add(titleT);

    // Daily rotation: 4 skills (seed by day)
    const day = Math.floor(Date.now() / 86400000);
    const available = [...ACTIVE_SKILLS].sort((a, b) =>
      (Math.sin(day * 999 + ACTIVE_SKILLS.indexOf(a)) - Math.sin(day * 999 + ACTIVE_SKILLS.indexOf(b))));
    const daily = available.slice(0, 4);

    const gs = loadGameState();
    daily.forEach((sk, i) => {
      const row = Math.floor(i / 2);
      const col = i % 2;
      const sx  = 16 + col * 184;
      const sy  = 80 + row * 140;

      const owned = gs.ownedActiveSkills.includes(sk.id);

      const bg = this.add.graphics();
      bg.fillStyle(0x1a0030, 1);
      bg.fillRoundedRect(sx, sy, 178, 126, 10);
      bg.lineStyle(2, owned ? 0x446644 : 0x7700cc, 0.8);
      bg.strokeRoundedRect(sx, sy, 178, 126, 10);
      ov.add(bg);

      const iconT = this.add.text(sx + 89, sy + 28, sk.icon, {
        fontFamily: 'sans-serif', fontSize: '28px',
      }).setOrigin(0.5);
      ov.add(iconT);

      const nameT = this.add.text(sx + 89, sy + 56, sk.name, {
        fontFamily: 'Georgia, serif', fontSize: '13px', color: CSS.PARCHMENT,
      }).setOrigin(0.5);
      ov.add(nameT);

      const descT = this.add.text(sx + 89, sy + 72, sk.desc, {
        fontFamily: 'sans-serif', fontSize: '9px', color: CSS.PARCHMENT_DIM,
        wordWrap: { width: 160 }, align: 'center',
      }).setOrigin(0.5);
      ov.add(descT);

      const cdT = this.add.text(sx + 89, sy + 86, `쿨다운: ${sk.cooldown}s`, {
        fontFamily: 'sans-serif', fontSize: '9px', color: '#aaaaaa',
      }).setOrigin(0.5);
      ov.add(cdT);

      if (owned) {
        const ownedT = this.add.text(sx + 89, sy + 108, '✓ 보유 중', {
          fontFamily: 'sans-serif', fontSize: '11px', color: '#44ff44',
        }).setOrigin(0.5);
        ov.add(ownedT);
      } else {
        const buyBtn = this.add.text(sx + 89, sy + 108, `💰${sk.goldCost} / 💎${sk.gemCost}`, {
          fontFamily: 'sans-serif', fontSize: '10px', color: CSS.TORCH_AMBER,
          backgroundColor: '#3a2800', padding: { x: 6, y: 3 },
        }).setOrigin(0.5).setInteractive();
        buyBtn.on('pointerdown', () => {
          const gs2 = loadGameState();
          // Purchase with gold (simplified)
          gs2.ownedActiveSkills.push(sk.id);
          saveGameState(gs2);
          ov.destroy(); this.shopOverlay = undefined;
          this.showSkillShop();
        });
        ov.add(buyBtn);
      }
    });

    // Close
    const closeT = this.add.text(CANVAS_WIDTH / 2, CANVAS_HEIGHT - 30, '닫기  ✕', {
      fontFamily: 'sans-serif', fontSize: '13px', color: CSS.PARCHMENT_MUTED,
    }).setOrigin(0.5).setInteractive();
    closeT.on('pointerdown', () => { ov.destroy(); this.shopOverlay = undefined; });
    ov.add(closeT);
  }

  // ─── Scroll ───────────────────────────────────────────────────────────────────

  private setupScroll(): void {
    let startY = 0;
    let dragging = false;

    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (this.detailOverlay || this.shopOverlay) return;
      startY   = p.y;
      dragging = true;
    });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (!dragging || !p.isDown) return;
      const dy = p.y - startY;
      startY   = p.y;
      this.scrollY = Phaser.Math.Clamp(this.scrollY - dy, 0, this.maxScrollY);
      this.contentContainer.setY(-this.scrollY);
    });
    this.input.on('pointerup', () => { dragging = false; });
  }

  // ─── Utility ─────────────────────────────────────────────────────────────────

  private buildBtn(x: number, y: number, label: string, bg: number, cb: () => void): void {
    const g = this.add.graphics().setDepth(15);
    g.fillStyle(bg, 1);
    g.fillRoundedRect(x - 4, y - 14, label.length * 8 + 16, 28, 6);
    const t = this.add.text(x + 4, y, label, {
      fontFamily: 'sans-serif', fontSize: '11px', color: CSS.PARCHMENT_MUTED,
    }).setOrigin(0, 0.5).setDepth(16).setInteractive();
    t.on('pointerdown', cb);
  }
}
