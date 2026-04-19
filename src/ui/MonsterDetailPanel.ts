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

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MonsterDetailContext {
  scene: Phaser.Scene;
  onClose: () => void;
  onRefresh: (m: OwnedMonster) => void;
}

// ─── Monster Detail Overlay ───────────────────────────────────────────────────

export function showMonsterDetailPanel(
  ctx: MonsterDetailContext,
  m: OwnedMonster,
): Phaser.GameObjects.Container {
  const { scene, onClose, onRefresh } = ctx;

  const ov = scene.add.container(0, 0).setDepth(100);

  // Dim
  const dim = scene.add.graphics();
  dim.fillStyle(0x000000, 0.88);
  dim.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  ov.add(dim);

  const def = MONSTER_DEFS[m.id as keyof typeof MONSTER_DEFS]!;
  const tree = SKILL_TREES[m.id as keyof typeof SKILL_TREES];

  // Panel
  const pw = 360, ph = 680;
  const px = (CANVAS_WIDTH - pw) / 2;
  const py = (CANVAS_HEIGHT - ph) / 2;
  const panel = scene.add.graphics();
  panel.fillStyle(COLORS.STONE_DARK, 1);
  panel.fillRoundedRect(px, py, pw, ph, 14);
  panel.lineStyle(2, def.accentColor ?? COLORS.TORCH_GOLD, 0.9);
  panel.strokeRoundedRect(px, py, pw, ph, 14);
  ov.add(panel);

  // Header — portrait with emoji fallback
  const detailSkin = getSkinForMonster(m.id, loadGameState().equippedSkins ?? {});
  const portraitKey = generatePortrait(scene, m.id as MonsterId, detailSkin?.id);
  if (scene.textures.exists(portraitKey)) {
    const portrait = scene.add.image(px + pw / 2, py + 38, portraitKey)
      .setOrigin(0.5).setDisplaySize(48, 48);
    ov.add(portrait);
  } else {
    const headerEmoji = scene.add.text(px + pw / 2, py + 38, detailSkin ? detailSkin.emoji : def.emoji, {
      fontFamily: 'sans-serif', fontSize: '40px',
    }).setOrigin(0.5);
    ov.add(headerEmoji);
  }

  const nameT = scene.add.text(px + pw / 2, py + 82, `${def.name}  Lv.${m.level}`, {
    fontFamily: 'Georgia, serif', fontSize: '16px', fontStyle: 'bold', color: CSS.PARCHMENT,
  }).setOrigin(0.5);
  ov.add(nameT);

  // Stats row
  const atk = getMonsterAtk(def.baseDamage, m.level, m.spentSkills);
  const statsT = scene.add.text(px + pw / 2, py + 108, `⚔️ ATK: ${atk}   🕐 CD: ${def.attackCooldown}ms   📏 Range: ${def.range}`, {
    fontFamily: 'sans-serif', fontSize: '11px', color: CSS.PARCHMENT_DIM,
  }).setOrigin(0.5);
  ov.add(statsT);

  // XP bar
  const xpNeeded = xpToNextLevel(m.level);
  const xpPct    = m.level >= 50 ? 1 : Math.min(1, m.xp / xpNeeded);
  const xpBarW   = pw - 40;
  const xpBg = scene.add.graphics();
  xpBg.fillStyle(0x111111, 1);
  xpBg.fillRoundedRect(px + 20, py + 122, xpBarW, 10, 4);
  xpBg.fillStyle(0x44aa44, 1);
  xpBg.fillRoundedRect(px + 20, py + 122, Math.round(xpBarW * xpPct), 10, 4);
  ov.add(xpBg);

  const xpLabel = scene.add.text(px + pw / 2, py + 127, m.level >= 50 ? 'MAX LEVEL' : `EXP ${m.xp} / ${xpNeeded}`, {
    fontFamily: 'sans-serif', fontSize: '9px', color: '#88cc88',
  }).setOrigin(0.5);
  ov.add(xpLabel);

  // SP display
  const spT = scene.add.text(px + 20, py + 144, `💫 스킬 포인트: ${m.skillPoints}`, {
    fontFamily: 'sans-serif', fontSize: '11px', color: '#cc88ff',
  });
  ov.add(spT);

  // Divider
  const div1 = scene.add.graphics();
  div1.lineStyle(1, COLORS.STONE_MID, 0.6);
  div1.lineBetween(px + 16, py + 162, px + pw - 16, py + 162);
  ov.add(div1);

  // Skill Tree section
  if (tree) {
    buildSkillTreeSection(ctx, ov, m, tree, px + 12, py + 172, pw - 24);
  } else {
    const noTree = scene.add.text(px + pw / 2, py + 200, '스킬 트리 준비 중...', {
      fontFamily: 'sans-serif', fontSize: '12px', color: '#888888',
    }).setOrigin(0.5);
    ov.add(noTree);
  }

  // Equipment section
  const eqY = py + 450;
  const eqDiv = scene.add.graphics();
  eqDiv.lineStyle(1, COLORS.STONE_MID, 0.5);
  eqDiv.lineBetween(px + 16, eqY, px + pw - 16, eqY);
  ov.add(eqDiv);

  const eqLabel = scene.add.text(px + 16, eqY + 8, '🗡️ 장비', {
    fontFamily: 'Georgia, serif', fontSize: '13px', color: CSS.TORCH_AMBER,
  });
  ov.add(eqLabel);

  buildEquipmentSlot(ctx, ov, m, px + 16, eqY + 30);

  // Active Skills section
  const skY = eqY + 90;
  const skDiv = scene.add.graphics();
  skDiv.lineStyle(1, COLORS.STONE_MID, 0.5);
  skDiv.lineBetween(px + 16, skY, px + pw - 16, skY);
  ov.add(skDiv);

  const skLabel = scene.add.text(px + 16, skY + 8, '✨ 장착 스킬', {
    fontFamily: 'Georgia, serif', fontSize: '13px', color: CSS.TORCH_AMBER,
  });
  ov.add(skLabel);

  buildEquippedSkillSlots(ctx, ov, m, px + 16, skY + 30, pw - 32);

  // Skin section
  const skinSectionY = skY + 100;
  const skinDiv = scene.add.graphics();
  skinDiv.lineStyle(1, COLORS.STONE_MID, 0.5);
  skinDiv.lineBetween(px + 16, skinSectionY, px + pw - 16, skinSectionY);
  ov.add(skinDiv);
  ov.add(scene.add.text(px + 16, skinSectionY + 8, '🎨 코스튬', {
    fontFamily: 'Georgia, serif', fontSize: '13px', color: CSS.TORCH_AMBER,
  }));
  buildSkinSlot(ctx, ov, m, px + 16, skinSectionY + 30, pw - 32);

  // ── Feed button ──────────────────────────────────────────────────────────
  const feedY = CANVAS_HEIGHT - 80;
  const feedBg = scene.add.graphics();
  feedBg.fillStyle(0x3a2200, 1);
  feedBg.fillRoundedRect(px + 16, feedY, pw - 32, 34, 8);
  feedBg.lineStyle(1, 0xcc8800, 0.7);
  feedBg.strokeRoundedRect(px + 16, feedY, pw - 32, 34, 8);
  ov.add(feedBg);
  const feedT = scene.add.text(CANVAS_WIDTH / 2, feedY + 17, '🍖 먹이 주기  (50💰 → +20 EXP)', {
    fontFamily: 'sans-serif', fontSize: '12px', color: '#ffcc44',
  }).setOrigin(0.5);
  ov.add(feedT);
  const feedZone = scene.add.zone(CANVAS_WIDTH / 2, feedY + 17, pw - 32, 34).setInteractive();
  feedZone.on('pointerdown', () => {
    const gs3 = loadGameState();
    if ((gs3.homeGold ?? 0) < 50) {
      feedT.setText('💰 골드 부족!').setColor('#ff4444');
      scene.time.delayedCall(1200, () => feedT.setText('🍖 먹이 주기  (50💰 → +20 EXP)').setColor('#ffcc44'));
      return;
    }
    gs3.homeGold -= 50;
    // Apply XP to the monster
    const idx3 = gs3.ownedMonsters.findIndex(om => om.id === m.id);
    const oldLevel = m.level;
    if (idx3 >= 0) {
      addXp(gs3.ownedMonsters[idx3], 20);
      m.xp    = gs3.ownedMonsters[idx3].xp;
      m.level = gs3.ownedMonsters[idx3].level;
    }
    updateQuestObjective(gs3, 'feed_monster');
    saveGameState(tickSubQuestProgress(gs3, 'feed_monster'));

    const didLevelUp = m.level > oldLevel;
    if (didLevelUp) {
      // Scale pop the overlay
      scene.tweens.add({
        targets: ov, scaleX: 1.06, scaleY: 1.06, duration: 120, ease: 'Back.easeOut',
        onComplete: () => scene.tweens.add({ targets: ov, scaleX: 1, scaleY: 1, duration: 160, ease: 'Back.easeIn' }),
      });
      // Golden "레벨 업!" banner
      const lvUpT = scene.add.text(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 60, `⬆ LEVEL UP!  Lv.${m.level}`, {
        fontFamily: 'Georgia, serif', fontSize: '20px', fontStyle: 'bold', color: '#ffee44',
        stroke: '#000000', strokeThickness: 4,
      }).setOrigin(0.5).setDepth(310).setScale(0.4).setAlpha(0);
      ov.add(lvUpT);
      scene.tweens.add({
        targets: lvUpT, scaleX: 1, scaleY: 1, alpha: 1,
        duration: 220, ease: 'Back.easeOut',
      });
      feedT.setText('⬆ 레벨 업!').setColor('#ffee44');
    } else {
      feedT.setText('✅ 먹이 줬다!').setColor('#88ff88');
    }

    scene.time.delayedCall(1200, () => {
      ov.destroy();
      onRefresh(m);
    });
  });
  ov.add(feedZone);

  // Close button
  const closeZone = scene.add.zone(CANVAS_WIDTH / 2, CANVAS_HEIGHT - 30, pw, 44).setInteractive();
  closeZone.on('pointerdown', () => { ov.destroy(); onClose(); });
  ov.add(closeZone);

  const closeT = scene.add.text(CANVAS_WIDTH / 2, CANVAS_HEIGHT - 30, '닫기  ✕', {
    fontFamily: 'sans-serif', fontSize: '13px', color: CSS.PARCHMENT_MUTED,
  }).setOrigin(0.5);
  ov.add(closeT);

  // Entry animation
  ov.setAlpha(0).setScale(0.92);
  scene.tweens.add({
    targets: ov, alpha: 1, scaleX: 1, scaleY: 1,
    duration: 250, ease: 'Back.easeOut',
  });

  return ov;
}

// ─── Skill Tree UI ────────────────────────────────────────────────────────────

function buildSkillTreeSection(
  ctx: MonsterDetailContext,
  ov: Phaser.GameObjects.Container,
  m: OwnedMonster,
  tree: SkillTree,
  x: number, y: number, w: number,
): void {
  const { scene, onRefresh } = ctx;

  const hdr = scene.add.text(x + w / 2, y, '스킬 트리', {
    fontFamily: 'Georgia, serif', fontSize: '13px', color: CSS.TORCH_AMBER,
  }).setOrigin(0.5);
  ov.add(hdr);

  const branches = (['A', 'B', 'C'] as const);
  const colW = w / 3;

  branches.forEach((branch, bi) => {
    const bx = x + bi * colW;
    const branchNodes = tree.nodes.filter(n => n.branch === branch).sort((a, b) => a.tier - b.tier);

    // Branch name label
    const bnT = scene.add.text(bx + colW / 2, y + 20, tree.branchNames[branch], {
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
      const nodeBg = scene.add.graphics();
      nodeBg.fillStyle(spent ? 0x224400 : prereqMet ? 0x1a1a2a : 0x0d0d0d, 1);
      nodeBg.fillRoundedRect(nx - 40, ny, 80, 60, 8);
      nodeBg.lineStyle(2, spent ? 0x44ff44 : prereqMet && canAfford ? 0xaaaaff : 0x444444, 0.8);
      nodeBg.strokeRoundedRect(nx - 40, ny, 80, 60, 8);
      ov.add(nodeBg);

      const iconT = scene.add.text(nx, ny + 14, node.icon, {
        fontFamily: 'sans-serif', fontSize: '16px',
      }).setOrigin(0.5);
      ov.add(iconT);

      const nodeNameT = scene.add.text(nx, ny + 32, node.name, {
        fontFamily: 'sans-serif', fontSize: '9px', color: spent ? '#88ff88' : CSS.PARCHMENT_DIM,
        wordWrap: { width: 76 }, align: 'center',
      }).setOrigin(0.5);
      ov.add(nodeNameT);

      const costT = scene.add.text(nx, ny + 50, spent ? '✓' : `${node.cost}SP`, {
        fontFamily: 'sans-serif', fontSize: '9px', color: spent ? '#44ff44' : '#cc88ff',
      }).setOrigin(0.5);
      ov.add(costT);

      // Tap to spend SP
      if (!spent && prereqMet && canAfford) {
        const zone = scene.add.zone(nx, ny + 30, 80, 60).setInteractive();
        zone.on('pointerdown', () => {
          const updatedM: OwnedMonster = {
            ...m,
            spentSkills: { ...m.spentSkills, [node.id]: 1 },
            skillPoints: m.skillPoints - node.cost,
          };
          const gs  = loadGameState();
          const idx = gs.ownedMonsters.findIndex(om => om.id === m.id);
          saveGameState({
            ...gs,
            ownedMonsters: idx >= 0
              ? gs.ownedMonsters.map((om, i) => i === idx ? updatedM : om)
              : gs.ownedMonsters,
          });
          ov.destroy();
          onRefresh(updatedM);
        });
        ov.add(zone);
      }
    });
  });
}

// ─── Equipment Slot ───────────────────────────────────────────────────────────

function buildEquipmentSlot(
  ctx: MonsterDetailContext,
  ov: Phaser.GameObjects.Container,
  m: OwnedMonster,
  x: number, y: number,
): void {
  const { scene, onRefresh } = ctx;
  const eqId  = m.equipment;
  const eqDef = eqId ? EQUIPMENT_DEFS.find(e => e.id === eqId) : null;
  const gs    = loadGameState();

  // Current slot
  const slotBg = scene.add.graphics();
  slotBg.fillStyle(eqDef ? 0x2a1800 : 0x111111, 1);
  slotBg.fillRoundedRect(x, y, 140, 40, 8);
  slotBg.lineStyle(1.5, eqDef ? COLORS.TORCH_GOLD : 0x444444, 0.8);
  slotBg.strokeRoundedRect(x, y, 140, 40, 8);
  ov.add(slotBg);

  const slotT = scene.add.text(x + 70, y + 20, eqDef ? `${eqDef.icon} ${eqDef.name}` : '장비 없음', {
    fontFamily: 'sans-serif', fontSize: '11px', color: eqDef ? CSS.TORCH_AMBER : '#666666',
  }).setOrigin(0.5);
  ov.add(slotT);

  // Inventory equipment buttons
  const owned = gs.ownedEquipment;
  let btnX = x + 150;
  owned.slice(0, 4).forEach(eId => {
    const ed = EQUIPMENT_DEFS.find(e => e.id === eId);
    if (!ed) return;
    const btn = scene.add.text(btnX, y + 20, ed.icon, {
      fontFamily: 'sans-serif', fontSize: '18px', backgroundColor: '#1a1a00',
      padding: { x: 4, y: 2 },
    }).setOrigin(0, 0.5).setInteractive();
    btn.on('pointerdown', () => {
      const updatedM: OwnedMonster = { ...m, equipment: eId };
      const gs2 = loadGameState();
      const idx = gs2.ownedMonsters.findIndex(om => om.id === m.id);
      saveGameState({
        ...gs2,
        ownedMonsters: idx >= 0
          ? gs2.ownedMonsters.map((om, i) => i === idx ? updatedM : om)
          : gs2.ownedMonsters,
      });
      ov.destroy();
      onRefresh(updatedM);
    });
    ov.add(btn);
    btnX += 32;
  });
}

// ─── Equipped Skill Slots ─────────────────────────────────────────────────────

function buildEquippedSkillSlots(
  ctx: MonsterDetailContext,
  ov: Phaser.GameObjects.Container,
  m: OwnedMonster,
  x: number, y: number, w: number,
): void {
  const { scene, onRefresh } = ctx;
  const gs = loadGameState();
  const slots = [0, 1];
  slots.forEach(si => {
    const sx   = x + si * (w / 2 + 4);
    const skId = m.equippedSkills[si];
    const sk   = skId ? ACTIVE_SKILLS.find(s => s.id === skId) : null;

    const bg = scene.add.graphics();
    bg.fillStyle(sk ? 0x1a0020 : 0x111111, 1);
    bg.fillRoundedRect(sx, y, w / 2 - 4, 50, 8);
    bg.lineStyle(1.5, sk ? 0xaa44ff : 0x444444, 0.8);
    bg.strokeRoundedRect(sx, y, w / 2 - 4, 50, 8);
    ov.add(bg);

    const slotT = scene.add.text(sx + (w / 2 - 4) / 2, y + 25, sk ? `${sk.icon} ${sk.name}` : `스킬 ${si + 1}`, {
      fontFamily: 'sans-serif', fontSize: '10px',
      color: sk ? '#cc88ff' : '#666666', align: 'center',
      wordWrap: { width: w / 2 - 12 },
    }).setOrigin(0.5);
    ov.add(slotT);

    // Tap to cycle through owned skills
    const owned = gs.ownedActiveSkills;
    const zone  = scene.add.zone(sx + (w / 2 - 4) / 2, y + 25, w / 2 - 4, 50).setInteractive();
    zone.on('pointerdown', () => {
      if (!owned.length) return;
      const nextIdx  = skId ? (owned.indexOf(skId) + 1) % owned.length : 0;
      const newSkills = [...(m.equippedSkills ?? [])];
      newSkills[si]   = owned[nextIdx];
      const updatedM: OwnedMonster = { ...m, equippedSkills: newSkills };
      const gs2 = loadGameState();
      const idx = gs2.ownedMonsters.findIndex(om => om.id === m.id);
      saveGameState({
        ...gs2,
        ownedMonsters: idx >= 0
          ? gs2.ownedMonsters.map((om, i) => i === idx ? updatedM : om)
          : gs2.ownedMonsters,
      });
      ov.destroy();
      onRefresh(updatedM);
    });
    ov.add(zone);
  });
}

// ─── Skin Slot ────────────────────────────────────────────────────────────────

function buildSkinSlot(
  ctx: MonsterDetailContext,
  ov: Phaser.GameObjects.Container,
  m: OwnedMonster,
  x: number, y: number, w: number,
): void {
  const { scene, onRefresh } = ctx;
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

    const bg = scene.add.graphics();
    bg.fillStyle(isActive ? 0x2a1800 : 0x111111, 1);
    bg.fillRoundedRect(bx, y, optW, 52, 6);
    bg.lineStyle(1.5, isActive ? COLORS.TORCH_GOLD : 0x333333, isActive ? 1 : 0.5);
    bg.strokeRoundedRect(bx, y, optW, 52, 6);
    ov.add(bg);

    const def = MONSTER_DEFS[typeId as keyof typeof MONSTER_DEFS];
    const emojiT = scene.add.text(bx + optW / 2, y + 10, skin ? skin.emoji : (def?.emoji ?? '?'), {
      fontFamily: 'sans-serif', fontSize: '20px',
    }).setOrigin(0.5, 0);
    ov.add(emojiT);

    const nameT = scene.add.text(bx + optW / 2, y + 36, skin ? '스킨' : '기본', {
      fontFamily: 'sans-serif', fontSize: '11px',
      color: isActive ? CSS.TORCH_AMBER : CSS.PARCHMENT_MUTED,
    }).setOrigin(0.5, 0);
    ov.add(nameT);

    const zone = scene.add.zone(bx + optW / 2, y + 26, optW, 52).setInteractive();
    zone.on('pointerdown', () => {
      const state = loadGameState();
      const newEquippedSkins = skin
        ? { ...(state.equippedSkins ?? {}), [typeId]: skin.id }
        : Object.fromEntries(Object.entries(state.equippedSkins ?? {}).filter(([k]) => k !== typeId));
      saveGameState({ ...state, equippedSkins: newEquippedSkins });
      ov.destroy();
      onRefresh(m);
    });
    ov.add(zone);
  });

  if (owned.length === 0) {
    ov.add(scene.add.text(x + w / 2, y + 26, '보유 스킨 없음 — 상점에서 구매', {
      fontFamily: 'sans-serif', fontSize: '10px', color: '#555588',
    }).setOrigin(0.5));
  }
}

// ─── Skill Shop Overlay ───────────────────────────────────────────────────────

export function showSkillShopPanel(
  scene: Phaser.Scene,
  onClose: () => void,
  onReshop: () => void,
): Phaser.GameObjects.Container {
  const ov = scene.add.container(0, 0).setDepth(110);

  const dim = scene.add.graphics();
  dim.fillStyle(0x000000, 0.85);
  dim.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  ov.add(dim);

  const titleT = scene.add.text(CANVAS_WIDTH / 2, 40, '🛒 스킬 상점', {
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

    const bg = scene.add.graphics();
    bg.fillStyle(0x1a0030, 1);
    bg.fillRoundedRect(sx, sy, 178, 126, 10);
    bg.lineStyle(2, owned ? 0x446644 : 0x7700cc, 0.8);
    bg.strokeRoundedRect(sx, sy, 178, 126, 10);
    ov.add(bg);

    const iconT = scene.add.text(sx + 89, sy + 28, sk.icon, {
      fontFamily: 'sans-serif', fontSize: '28px',
    }).setOrigin(0.5);
    ov.add(iconT);

    const nameT = scene.add.text(sx + 89, sy + 56, sk.name, {
      fontFamily: 'Georgia, serif', fontSize: '13px', color: CSS.PARCHMENT,
    }).setOrigin(0.5);
    ov.add(nameT);

    const descT = scene.add.text(sx + 89, sy + 72, sk.desc, {
      fontFamily: 'sans-serif', fontSize: '9px', color: CSS.PARCHMENT_DIM,
      wordWrap: { width: 160 }, align: 'center',
    }).setOrigin(0.5);
    ov.add(descT);

    const cdT = scene.add.text(sx + 89, sy + 86, `쿨다운: ${sk.cooldown}s`, {
      fontFamily: 'sans-serif', fontSize: '9px', color: '#aaaaaa',
    }).setOrigin(0.5);
    ov.add(cdT);

    if (owned) {
      const ownedT = scene.add.text(sx + 89, sy + 108, '✓ 보유 중', {
        fontFamily: 'sans-serif', fontSize: '11px', color: '#44ff44',
      }).setOrigin(0.5);
      ov.add(ownedT);
    } else {
      const buyBtn = scene.add.text(sx + 89, sy + 108, `💰${sk.goldCost} / 💎${sk.gemCost}`, {
        fontFamily: 'sans-serif', fontSize: '10px', color: CSS.TORCH_AMBER,
        backgroundColor: '#3a2800', padding: { x: 6, y: 3 },
      }).setOrigin(0.5).setInteractive();
      buyBtn.on('pointerdown', () => {
        const gs2 = loadGameState();
        if (gs2.homeGold < sk.goldCost) {
          buyBtn.setText('💰 골드 부족!').setColor('#ff4444');
          scene.time.delayedCall(1200, () => {
            if (buyBtn.active) buyBtn.setText(`💰${sk.goldCost} / 💎${sk.gemCost}`).setColor(CSS.TORCH_AMBER);
          });
          return;
        }
        const prevSkills = gs2.ownedActiveSkills ?? [];
        saveGameState({
          ...gs2,
          homeGold:          gs2.homeGold - sk.goldCost,
          ownedActiveSkills: [...prevSkills, sk.id],
        });
        ov.destroy();
        onReshop();
      });
      ov.add(buyBtn);
    }
  });

  // Close
  const closeT = scene.add.text(CANVAS_WIDTH / 2, CANVAS_HEIGHT - 30, '닫기  ✕', {
    fontFamily: 'sans-serif', fontSize: '13px', color: CSS.PARCHMENT_MUTED,
  }).setOrigin(0.5).setInteractive();
  closeT.on('pointerdown', () => { ov.destroy(); onClose(); });
  ov.add(closeT);

  // Entry animation — slide up from bottom
  ov.setY(CANVAS_HEIGHT).setAlpha(0);
  scene.tweens.add({
    targets: ov, y: 0, alpha: 1,
    duration: 280, ease: 'Quad.easeOut',
  });

  return ov;
}
