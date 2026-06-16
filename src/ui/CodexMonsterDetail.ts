// ─── Codex Monster Detail Overlay ─────────────────────────────────────────────
// Extracted from CodexScene.showMonsterDetail().
// Renders a full-screen dimmed overlay with monster stats, passive, and
// skill-tree preview. Returns the created container so the caller can hold
// a reference and destroy it on demand.

import Phaser from 'phaser';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../constants/layout';
import { CASUAL, CASUAL_CSS } from '../constants/colors';
import { MONSTER_DEFS, getSkinForMonster, type MonsterId } from '../data/monsters';
import { generatePortrait } from '../art/PortraitGenerator';
import { SKILL_TREES } from '../data/barracks';
import type { loadGameState } from '../data/wisdom';

const CODEX_DETAIL_RARITY_META: Record<string, {
  label: string;
  name: string;
  stars: string;
  color: number;
  css: string;
}> = {
  C: { label: 'C', name: '일반', stars: '★',     color: 0x9a8a72, css: '#6b5a44' },
  U: { label: 'U', name: '비범', stars: '★★',    color: CASUAL.GREEN,  css: CASUAL_CSS.GREEN },
  R: { label: 'R', name: '희귀', stars: '★★★',   color: CASUAL.BLUE,   css: CASUAL_CSS.BLUE },
  E: { label: 'E', name: '영웅', stars: '★★★★',  color: CASUAL.PURPLE, css: CASUAL_CSS.PURPLE },
  L: { label: 'L', name: '전설', stars: '★★★★★', color: CASUAL.GOLD,   css: CASUAL_CSS.GOLD },
};

const CODEX_DETAIL_TRIBE_LABELS: Record<string, string> = {
  dokkaebi: '도깨비',
  gumiho: '구미호',
  dragon: '용족',
  underworld: '저승',
  sansin: '산신',
  sea: '해신',
  mask: '탈족',
  moonlight: '달빛',
  celestial: '천상',
};

const CODEX_DETAIL_ELEMENT_LABELS: Record<string, string> = {
  fire: '화염',
  frost: '서리',
  lightning: '번개',
  dark: '암흑',
  holy: '신성',
};

const CODEX_DETAIL_ROOM_LABELS: Record<string, string> = {
  guardian: '수호',
  tower: '망루',
  scroll_library: '서고',
  gold: '황금',
  trap: '함정',
  trap_corridor: '복도',
  armory: '무기',
  medicine_hall: '의전',
  spirit_altar: '제단',
  dragons_lair: '용소',
  celestial_shrine: '성소',
  void_forge: '공허',
};

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Create and display the codex monster-detail overlay.
 *
 * @param scene   - Active Phaser scene (used for add.* / textures)
 * @param m       - Monster definition to display
 * @param gs      - Current game state (for equipped skin lookup)
 * @param onClose - Called after the overlay container is destroyed
 * @returns The created container (caller should nullify their reference in onClose)
 */
export function showCodexMonsterDetail(
  scene: Phaser.Scene,
  m: (typeof MONSTER_DEFS)[MonsterId],
  gs: ReturnType<typeof loadGameState>,
  onClose: () => void,
): Phaser.GameObjects.Container {
  const ow = CANVAS_WIDTH - 32;
  const oh = 386;
  const ox = 16;
  const oy = (CANVAS_HEIGHT - oh) / 2;
  const accent = m.accentColor ?? CASUAL.GOLD;
  const rarity = getCodexDetailRarityMeta(m.rarityTier);
  const dexNo = getCodexDetailDexNo(m.id);
  const isOwned = gs.ownedMonsters?.some(monster => monster.id === m.id) ?? false;

  const ctr = scene.add.container(0, 0).setDepth(50);

  // Dim backdrop
  const dim = scene.add.graphics();
  dim.fillStyle(0x000000, 0.5);
  dim.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  ctr.add(dim);

  // Panel — cream card with chunky brown border + rarity accent header
  const panel = scene.add.graphics();
  panel.fillStyle(CASUAL.SHADOW, 0.28);
  panel.fillRoundedRect(ox + 3, oy + 6, ow, oh, 14);
  panel.fillStyle(CASUAL.PANEL, 1);
  panel.fillRoundedRect(ox, oy, ow, oh, 14);
  // glossy white top highlight
  panel.fillStyle(0xffffff, 0.12);
  panel.fillRoundedRect(ox + 6, oy + 5, ow - 12, 16, 9);
  // rarity-accent header band
  panel.fillStyle(rarity.color, 0.9);
  panel.fillRoundedRect(ox + 8, oy + 8, ow - 16, 54, 10);
  panel.fillStyle(0xffffff, 0.28);
  panel.fillRoundedRect(ox + 12, oy + 11, ow - 24, 6, 3);
  // cream content well
  panel.fillStyle(CASUAL.PANEL_SOFT, 1);
  panel.fillRoundedRect(ox + 12, oy + 56, ow - 24, oh - 68, 10);
  // thick brown outer border + soft accent inner stroke
  panel.lineStyle(3, CASUAL.EDGE, 1);
  panel.strokeRoundedRect(ox, oy, ow, oh, 14);
  panel.lineStyle(1, CASUAL.EDGE_SOFT, 0.6);
  panel.strokeRoundedRect(ox + 12, oy + 56, ow - 24, oh - 68, 10);
  ctr.add(panel);

  drawCodexDetailPill(scene, ctr, ox + 20, oy + 16, 68, 20, `도감 ${dexNo}`, CASUAL.PANEL, CASUAL.GOLD_DK, CASUAL_CSS.GOLD);
  drawCodexDetailPill(scene, ctr, ox + 94, oy + 16, 76, 20, `${rarity.name} ${rarity.label}`, CASUAL.PANEL, rarity.color, rarity.css);
  drawCodexDetailPill(scene, ctr, ox + 176, oy + 16, 62, 20, isOwned ? '보유' : '미보유', CASUAL.PANEL, isOwned ? CASUAL.GREEN_DK : CASUAL.EDGE_SOFT, isOwned ? CASUAL_CSS.GREEN : CASUAL_CSS.INK_SOFT);

  const typeT = scene.add.text(ox + ow - 24, oy + 15, m.emoji, {
    fontFamily: 'sans-serif', fontSize: '24px',
  }).setOrigin(1, 0);
  ctr.add(typeT);

  let cy = oy + 66;

  // ── Portrait + name row ────────────────────────────────────────────────────
  const skin = getSkinForMonster(m.id as MonsterId, gs.equippedSkins ?? {});
  const portraitKey = generatePortrait(scene, m.id as MonsterId, skin?.id);
  const portrait = scene.add.graphics();
  portrait.fillStyle(CASUAL.SHADOW, 0.18);
  portrait.fillRoundedRect(ox + 16, cy + 3, 94, 92, 12);
  portrait.fillStyle(CASUAL.PANEL, 1);
  portrait.fillRoundedRect(ox + 16, cy, 94, 92, 12);
  portrait.fillStyle(rarity.color, 0.18);
  portrait.fillCircle(ox + 63, cy + 53, 38);
  portrait.fillStyle(CASUAL.SHADOW, 0.14);
  portrait.fillEllipse(ox + 63, cy + 74, 76, 16);
  portrait.lineStyle(3, rarity.color, 0.9);
  portrait.strokeRoundedRect(ox + 16, cy, 94, 92, 12);
  portrait.fillStyle(0xffffff, 0.12);
  portrait.fillRoundedRect(ox + 21, cy + 5, 84, 6, 3);
  ctr.add(portrait);

  if (isOwned && scene.textures.exists(portraitKey)) {
    const img = scene.add.image(ox + 63, cy + 49, portraitKey)
      .setOrigin(0.5).setDisplaySize(76, 76);
    ctr.add(img);
  } else if (isOwned) {
    const emoji = scene.add.text(ox + 63, cy + 46, skin?.emoji ?? m.emoji, {
      fontFamily: 'sans-serif', fontSize: '50px',
    }).setOrigin(0.5, 0);
    ctr.add(emoji);
  } else {
    // undiscovered → muted silhouette
    const silhouette = scene.add.graphics();
    silhouette.fillStyle(CASUAL.EDGE_SOFT, 0.55);
    silhouette.fillCircle(ox + 63, cy + 53, 30);
    ctr.add(silhouette);
    const q = scene.add.text(ox + 63, cy + 49, '?', {
      fontFamily: 'sans-serif', fontSize: '40px', fontStyle: 'bold', color: CASUAL_CSS.CREAM,
    }).setOrigin(0.5);
    ctr.add(q);
  }

  const nameT = scene.add.text(ox + 126, cy + 5, m.name, {
    fontFamily: 'sans-serif', fontSize: '16px', fontStyle: 'bold',
    color: CASUAL_CSS.INK,
  }).setOrigin(0, 0);
  ctr.add(nameT);

  const tagT = scene.add.text(ox + 126, cy + 26, getCodexDetailTagLine(m), {
    fontFamily: 'sans-serif', fontSize: '10px', fontStyle: 'bold',
    color: CASUAL_CSS.BLUE,
  }).setOrigin(0, 0);
  ctr.add(tagT);

  const starsT = scene.add.text(ox + 126, cy + 43, `${rarity.name} · ${rarity.stars}`, {
    fontFamily: 'sans-serif', fontSize: '12px', fontStyle: 'bold',
    color: CASUAL_CSS.GOLD,
  }).setOrigin(0, 0);
  ctr.add(starsT);

  const deployRooms = m.roomTypes.slice(0, 3).map(rt => CODEX_DETAIL_ROOM_LABELS[rt] ?? rt).join(' / ');
  const deployT = scene.add.text(ox + 126, cy + 63, `배치: ${deployRooms}`, {
    fontFamily: 'sans-serif', fontSize: '10px',
    color: CASUAL_CSS.INK_SOFT,
  }).setOrigin(0, 0);
  ctr.add(deployT);

  cy += 106;

  // ── Stats row ──────────────────────────────────────────────────────────────
  const statItems = [
    { label: 'ATK', val: `${m.baseDamage}`, icon: '⚔' },
    { label: 'COOL', val: `${(m.attackCooldown / 1000).toFixed(1)}s`, icon: '⏱' },
    { label: 'RANGE', val: `${m.range}칸`, icon: '◆' },
    { label: 'CH', val: `${m.chapter ?? 1}`, icon: '✦' },
  ];

  const statW = (ow - 16) / statItems.length;
  statItems.forEach(({ label, val, icon }, i) => {
    const sx = ox + 8 + i * statW;

    const sbg = scene.add.graphics();
    sbg.fillStyle(CASUAL.PANEL, 1);
    sbg.fillRoundedRect(sx, cy, statW - 4, 42, 7);
    sbg.fillStyle(0xffffff, 0.12);
    sbg.fillRoundedRect(sx + 3, cy + 3, statW - 10, 4, 2);
    sbg.lineStyle(2, CASUAL.EDGE_SOFT, 0.9);
    sbg.strokeRoundedRect(sx, cy, statW - 4, 42, 7);
    ctr.add(sbg);

    const slabel = scene.add.text(sx + (statW - 4) / 2, cy + 6, `${icon} ${label}`, {
      fontFamily: 'sans-serif', fontSize: '9px', fontStyle: 'bold', color: CASUAL_CSS.INK_SOFT,
    }).setOrigin(0.5, 0);
    ctr.add(slabel);

    const sval = scene.add.text(sx + (statW - 4) / 2, cy + 21, val, {
      fontFamily: 'sans-serif', fontSize: '13px', fontStyle: 'bold', color: CASUAL_CSS.GOLD,
    }).setOrigin(0.5, 0);
    ctr.add(sval);
  });

  cy += 52;

  // ── Passive description ────────────────────────────────────────────────────
  const passiveBg = scene.add.graphics();
  passiveBg.fillStyle(CASUAL.PANEL, 1);
  passiveBg.fillRoundedRect(ox + 8, cy, ow - 16, 52, 8);
  passiveBg.fillStyle(accent, 0.18);
  passiveBg.fillRoundedRect(ox + 14, cy + 6, 42, 40, 7);
  passiveBg.lineStyle(2, accent, 0.9);
  passiveBg.strokeRoundedRect(ox + 8, cy, ow - 16, 52, 8);
  ctr.add(passiveBg);

  const passiveIcon = scene.add.text(ox + 35, cy + 18, '⚡', {
    fontFamily: 'sans-serif', fontSize: '18px', color: CASUAL_CSS.GOLD,
  }).setOrigin(0.5, 0);
  ctr.add(passiveIcon);

  const passiveLabel = scene.add.text(ox + 66, cy + 8, '패시브 스킬', {
    fontFamily: 'sans-serif', fontSize: '9px', fontStyle: 'bold',
    color: CASUAL_CSS.GOLD,
  }).setOrigin(0, 0);
  ctr.add(passiveLabel);

  const passiveT = scene.add.text(ox + 66, cy + 23, m.passiveDesc, {
    fontFamily: 'sans-serif', fontSize: '11px', color: CASUAL_CSS.INK,
    wordWrap: { width: ow - 86, useAdvancedWrap: true },
  }).setOrigin(0, 0);
  ctr.add(passiveT);

  cy += 62;

  // ── Skill tree preview ────────────────────────────────────────────────────
  const tree = SKILL_TREES[m.id as MonsterId];
  if (tree) {
    const treeLabelT = scene.add.text(ox + 16, cy, '성장 루트 미리보기', {
      fontFamily: 'sans-serif', fontSize: '11px', fontStyle: 'bold',
      color: CASUAL_CSS.INK,
    }).setOrigin(0, 0);
    ctr.add(treeLabelT);
    const treeHintT = scene.add.text(ox + ow - 16, cy + 1, 'Lv.업으로 해금', {
      fontFamily: 'sans-serif', fontSize: '9px', fontStyle: 'bold', color: CASUAL_CSS.INK_SOFT,
    }).setOrigin(1, 0);
    ctr.add(treeHintT);
    cy += 18;

    const branches: Array<'A' | 'B' | 'C'> = ['A', 'B', 'C'];
    const branchW = (ow - 16) / 3;
    const branchColors: Record<string, number> = { A: CASUAL.RED, B: CASUAL.BLUE, C: CASUAL.GREEN };
    const branchCSS: Record<string, string> = { A: CASUAL_CSS.RED, B: CASUAL_CSS.BLUE, C: CASUAL_CSS.GREEN };

    branches.forEach((br, i) => {
      const tier1 = tree.nodes.find(n => n.branch === br && n.tier === 1);
      const bx    = ox + 8 + i * branchW;
      const brCol = branchColors[br] ?? CASUAL.EDGE_SOFT;

      const bbg = scene.add.graphics();
      bbg.fillStyle(CASUAL.PANEL, 1);
      bbg.fillRoundedRect(bx, cy, branchW - 4, 58, 7);
      bbg.fillStyle(brCol, 0.16);
      bbg.fillRoundedRect(bx + 4, cy + 4, branchW - 12, 50, 5);
      bbg.lineStyle(2, brCol, 0.9);
      bbg.strokeRoundedRect(bx, cy, branchW - 4, 58, 7);
      ctr.add(bbg);

      const brNameT = scene.add.text(bx + (branchW - 4) / 2, cy + 4, tree.branchNames[br], {
        fontFamily: 'sans-serif', fontSize: '10px', fontStyle: 'bold',
        color: branchCSS[br] ?? CASUAL_CSS.INK,
      }).setOrigin(0.5, 0);
      ctr.add(brNameT);

      if (tier1) {
        const t1icon = scene.add.text(bx + (branchW - 4) / 2, cy + 18, tier1.icon, {
          fontFamily: 'sans-serif', fontSize: '14px',
        }).setOrigin(0.5, 0);
        ctr.add(t1icon);

        const t1name = scene.add.text(bx + (branchW - 4) / 2, cy + 34, tier1.name, {
          fontFamily: 'sans-serif', fontSize: '10px', color: CASUAL_CSS.INK_SOFT,
          align: 'center', wordWrap: { width: branchW - 12 },
        }).setOrigin(0.5, 0);
        ctr.add(t1name);
      }
    });
  }

  // ── Close button ──────────────────────────────────────────────────────────
  const closeBg = scene.add.graphics();
  closeBg.fillStyle(CASUAL.SHADOW, 0.2);
  closeBg.fillRoundedRect(ox + ow - 38, oy + 50 + 2, 28, 28, 8);
  closeBg.fillStyle(CASUAL.PANEL, 1);
  closeBg.fillRoundedRect(ox + ow - 38, oy + 50, 28, 28, 8);
  closeBg.lineStyle(2.5, CASUAL.EDGE, 1);
  closeBg.strokeRoundedRect(ox + ow - 38, oy + 50, 28, 28, 8);
  ctr.add(closeBg);

  const closeT = scene.add.text(ox + ow - 24, oy + 64, '✕', {
    fontFamily: 'sans-serif', fontSize: '14px', fontStyle: 'bold', color: CASUAL_CSS.INK,
  }).setOrigin(0.5);
  ctr.add(closeT);

  const closeZone = scene.add.zone(ox + ow - 24, oy + 64, 36, 36)
    .setInteractive().setDepth(51);
  ctr.add(closeZone);
  closeZone.on('pointerdown', () => { ctr.destroy(); onClose(); });

  // Tap anywhere outside to close
  const tapAway = scene.add.zone(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, CANVAS_WIDTH, CANVAS_HEIGHT)
    .setInteractive().setDepth(49);
  ctr.add(tapAway);
  tapAway.on('pointerdown', () => { ctr.destroy(); onClose(); });

  return ctr;
}

function getCodexDetailRarityMeta(
  rarityTier: string | undefined,
): typeof CODEX_DETAIL_RARITY_META[keyof typeof CODEX_DETAIL_RARITY_META] {
  return CODEX_DETAIL_RARITY_META[rarityTier ?? 'C'] ?? CODEX_DETAIL_RARITY_META.C;
}

function getCodexDetailDexNo(monsterId: string): string {
  const index = Object.keys(MONSTER_DEFS).indexOf(monsterId);
  return String(Math.max(1, index + 1)).padStart(3, '0');
}

function getCodexDetailTagLine(m: (typeof MONSTER_DEFS)[MonsterId]): string {
  const tribe = m.tribe ? CODEX_DETAIL_TRIBE_LABELS[m.tribe] ?? m.tribe : '던전';
  const element = m.element ? CODEX_DETAIL_ELEMENT_LABELS[m.element] ?? m.element : '중립';
  return `${tribe} · ${element} · Ch.${m.chapter ?? 1}`;
}

function drawCodexDetailPill(
  scene: Phaser.Scene,
  ctr: Phaser.GameObjects.Container,
  x: number,
  y: number,
  w: number,
  h: number,
  label: string,
  fill: number,
  stroke: number,
  color: string,
): void {
  const bg = scene.add.graphics();
  bg.fillStyle(fill, 1);
  bg.fillRoundedRect(x, y, w, h, 6);
  bg.fillStyle(0xffffff, 0.12);
  bg.fillRoundedRect(x + 3, y + 2, w - 6, 3, 2);
  bg.lineStyle(2, stroke, 0.95);
  bg.strokeRoundedRect(x, y, w, h, 6);
  ctr.add(bg);
  const text = scene.add.text(x + w / 2, y + h / 2 + 0.5, label, {
    fontFamily: 'sans-serif',
    fontSize: '9px',
    fontStyle: 'bold',
    color,
  }).setOrigin(0.5);
  ctr.add(text);
}
