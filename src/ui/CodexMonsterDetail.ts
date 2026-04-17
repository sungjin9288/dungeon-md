// ─── Codex Monster Detail Overlay ─────────────────────────────────────────────
// Extracted from CodexScene.showMonsterDetail().
// Renders a full-screen dimmed overlay with monster stats, passive, and
// skill-tree preview. Returns the created container so the caller can hold
// a reference and destroy it on demand.

import Phaser from 'phaser';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../constants/layout';
import { COLORS, CSS } from '../constants/colors';
import { MONSTER_DEFS, getSkinForMonster, type MonsterId } from '../data/monsters';
import { generatePortrait } from '../art/PortraitGenerator';
import { SKILL_TREES } from '../data/barracks';
import type { loadGameState } from '../data/wisdom';

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
  const oh = 320;
  const ox = 16;
  const oy = (CANVAS_HEIGHT - oh) / 2;

  const ctr = scene.add.container(0, 0).setDepth(50);

  // Dim backdrop
  const dim = scene.add.graphics();
  dim.fillStyle(0x000000, 0.72);
  dim.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  ctr.add(dim);

  // Panel
  const panel = scene.add.graphics();
  panel.fillStyle(0x12080a, 1);
  panel.fillRoundedRect(ox, oy, ow, oh, 10);
  panel.lineStyle(1.5, m.accentColor ?? COLORS.TORCH_GOLD, 1);
  panel.strokeRoundedRect(ox, oy, ow, oh, 10);
  ctr.add(panel);

  let cy = oy + 14;

  // ── Portrait + name row ────────────────────────────────────────────────────
  const skin = getSkinForMonster(m.id as MonsterId, gs.equippedSkins ?? {});
  const portraitKey = generatePortrait(scene, m.id as MonsterId, skin?.id);
  if (scene.textures.exists(portraitKey)) {
    const img = scene.add.image(ox + 36, cy + 20, portraitKey)
      .setOrigin(0.5).setDisplaySize(44, 44);
    ctr.add(img);
  } else {
    const emoji = scene.add.text(ox + 36, cy + 8, skin?.emoji ?? m.emoji, {
      fontFamily: 'sans-serif', fontSize: '32px',
    }).setOrigin(0.5, 0);
    ctr.add(emoji);
  }

  const rarityColors: Record<string, string> = {
    C: '#aaaaaa', U: '#44dd44', R: '#4488ff', E: '#aa44ff', L: '#ffaa00',
  };
  const rarityNames: Record<string, string> = {
    C: '일반', U: '비범', R: '희귀', E: '영웅', L: '전설',
  };
  const rtier      = m.rarityTier ?? 'C';
  const rarityColor = rarityColors[rtier] ?? '#aaaaaa';
  const rarityName  = rarityNames[rtier]  ?? '일반';

  const nameT = scene.add.text(ox + 62, cy + 6, m.name, {
    fontFamily: 'Georgia, serif', fontSize: '16px', fontStyle: 'bold',
    color: CSS.TORCH_AMBER,
  }).setOrigin(0, 0);
  ctr.add(nameT);

  const rarityT = scene.add.text(ox + 62, cy + 26, `[${rarityName}] ${m.tribe ?? ''}`, {
    fontFamily: 'Georgia, serif', fontSize: '10px',
    color: rarityColor,
  }).setOrigin(0, 0);
  ctr.add(rarityT);

  const typeT = scene.add.text(ox + ow - 14, cy + 6, m.emoji, {
    fontFamily: 'sans-serif', fontSize: '22px',
  }).setOrigin(1, 0);
  ctr.add(typeT);

  cy += 54;

  // ── Divider ────────────────────────────────────────────────────────────────
  const div1 = scene.add.graphics();
  div1.lineStyle(0.5, COLORS.TORCH_GOLD, 0.25);
  div1.lineBetween(ox + 8, cy, ox + ow - 8, cy);
  ctr.add(div1);
  cy += 8;

  // ── Stats row ──────────────────────────────────────────────────────────────
  const rtMap: Record<string, string> = {
    guardian: '수호', tower: '망루', scroll_library: '서고',
    gold: '황금', trap: '함정', trap_corridor: '복도',
    armory: '무기', medicine_hall: '의전', spirit_altar: '제단',
    dragons_lair: '용소',
  };
  const statItems = [
    { label: '⚔️ATK',   val: `${m.baseDamage}` },
    { label: '⏱️쿨',    val: `${(m.attackCooldown / 1000).toFixed(1)}s` },
    { label: '📏사거리', val: `${m.range}칸` },
    { label: '🏠배치',  val: m.roomTypes.slice(0, 2).map(rt => rtMap[rt] ?? rt).join('/') },
  ];

  const statW = (ow - 16) / statItems.length;
  statItems.forEach(({ label, val }, i) => {
    const sx = ox + 8 + i * statW;

    const sbg = scene.add.graphics();
    sbg.fillStyle(0x200e04, 1);
    sbg.fillRoundedRect(sx, cy, statW - 4, 34, 4);
    ctr.add(sbg);

    const slabel = scene.add.text(sx + (statW - 4) / 2, cy + 4, label, {
      fontFamily: 'sans-serif', fontSize: '11px', color: CSS.PARCHMENT_MUTED,
    }).setOrigin(0.5, 0);
    ctr.add(slabel);

    const sval = scene.add.text(sx + (statW - 4) / 2, cy + 17, val, {
      fontFamily: 'Georgia, serif', fontSize: '10px', fontStyle: 'bold', color: CSS.TORCH_AMBER,
    }).setOrigin(0.5, 0);
    ctr.add(sval);
  });

  cy += 42;

  // ── Passive description ────────────────────────────────────────────────────
  const passiveBg = scene.add.graphics();
  passiveBg.fillStyle(0x1a0d00, 1);
  passiveBg.fillRoundedRect(ox + 8, cy, ow - 16, 28, 4);
  passiveBg.lineStyle(0.5, m.accentColor ?? COLORS.TORCH_GOLD, 0.4);
  passiveBg.strokeRoundedRect(ox + 8, cy, ow - 16, 28, 4);
  ctr.add(passiveBg);

  const passiveT = scene.add.text(ox + 16, cy + 8, `⚡ ${m.passiveDesc}`, {
    fontFamily: 'Georgia, serif', fontSize: '10px', color: '#ffcc88',
    wordWrap: { width: ow - 36 },
  }).setOrigin(0, 0);
  ctr.add(passiveT);

  cy += 36;

  // ── Skill tree preview ────────────────────────────────────────────────────
  const tree = SKILL_TREES[m.id as MonsterId];
  if (tree) {
    const div2 = scene.add.graphics();
    div2.lineStyle(0.5, COLORS.TORCH_GOLD, 0.25);
    div2.lineBetween(ox + 8, cy, ox + ow - 8, cy);
    ctr.add(div2);
    cy += 8;

    const treeLabelT = scene.add.text(ox + 16, cy, '스킬 트리', {
      fontFamily: 'Georgia, serif', fontSize: '10px', fontStyle: 'bold',
      color: CSS.PARCHMENT_DIM,
    }).setOrigin(0, 0);
    ctr.add(treeLabelT);
    cy += 16;

    const branches: Array<'A' | 'B' | 'C'> = ['A', 'B', 'C'];
    const branchW = (ow - 16) / 3;
    const branchColors: Record<string, number> = { A: 0xcc3300, B: 0x1166aa, C: 0x228833 };

    branches.forEach((br, i) => {
      const tier1 = tree.nodes.find(n => n.branch === br && n.tier === 1);
      const bx    = ox + 8 + i * branchW;

      const bbg = scene.add.graphics();
      bbg.fillStyle(0x1a1000, 1);
      bbg.fillRoundedRect(bx, cy, branchW - 4, 52, 4);
      bbg.lineStyle(0.8, branchColors[br] ?? 0x888888, 0.6);
      bbg.strokeRoundedRect(bx, cy, branchW - 4, 52, 4);
      ctr.add(bbg);

      const brNameT = scene.add.text(bx + (branchW - 4) / 2, cy + 4, tree.branchNames[br], {
        fontFamily: 'Georgia, serif', fontSize: '11px', fontStyle: 'bold',
        color: CSS.TORCH_AMBER,
      }).setOrigin(0.5, 0);
      ctr.add(brNameT);

      if (tier1) {
        const t1icon = scene.add.text(bx + (branchW - 4) / 2, cy + 18, tier1.icon, {
          fontFamily: 'sans-serif', fontSize: '14px',
        }).setOrigin(0.5, 0);
        ctr.add(t1icon);

        const t1name = scene.add.text(bx + (branchW - 4) / 2, cy + 34, tier1.name, {
          fontFamily: 'Georgia, serif', fontSize: '11px', color: '#ccaa66',
          align: 'center', wordWrap: { width: branchW - 12 },
        }).setOrigin(0.5, 0);
        ctr.add(t1name);
      }
    });
  }

  // ── Close button ──────────────────────────────────────────────────────────
  const closeBg = scene.add.graphics();
  closeBg.fillStyle(0x3a1a00, 1);
  closeBg.fillRoundedRect(ox + ow - 40, oy + 8, 28, 28, 6);
  ctr.add(closeBg);

  const closeT = scene.add.text(ox + ow - 26, oy + 22, '✕', {
    fontFamily: 'sans-serif', fontSize: '14px', color: CSS.PARCHMENT_DIM,
  }).setOrigin(0.5);
  ctr.add(closeT);

  const closeZone = scene.add.zone(ox + ow - 26, oy + 22, 36, 36)
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
