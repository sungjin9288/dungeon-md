/**
 * MonsterDetailGrowth.ts — growth command panel, feed/training CTA,
 * skill tree section, and hero-collection-badge overlay for
 * MonsterDetailPanel.
 */
import { CASUAL, CASUAL_CSS, DUNGEON_UI, DUNGEON_UI_CSS } from '../constants/colors';
import { loadGameState, saveGameState, type OwnedMonster } from '../data/wisdom';
import { ACTIVE_SKILLS, xpToNextLevel, type SkillTree } from '../data/barracks';
import { spendMonsterSkillNode } from '../data/barracksTransactions';
import {
  type MonsterDetailContext,
  type GrowthDirective,
  getGrowthDirective,
  getFeedTrainingPreview,
  getEquipmentDisplay,
  shortenLabel,
} from './MonsterDetailShared';
import { drawGrowthSigil } from './BarracksSkin';
import { onReleaseTap } from './releaseTap';

// ─── Hero Collection Badges ───────────────────────────────────────────────────

export function drawHeroCollectionBadges(
  scene: Phaser.Scene,
  ov: Phaser.GameObjects.Container,
  x: number,
  y: number,
  meta: {
    rank: number;
    color: number;
    css: string;
    tier: string;
    indexLabel: string;
    stars: string;
    elementIcon: string;
    elementColor: number;
  },
  xpPct: number,
  skillPoints: number,
  hasEquipment: boolean,
): void {
  const badge     = scene.add.graphics();
  const portraitX = x + 35;
  const portraitY = y + 32;
  const isLevelReady  = xpPct >= 0.82;
  const statusColor = skillPoints > 0 ? CASUAL.PURPLE : isLevelReady ? CASUAL.BLUE : hasEquipment ? meta.color : CASUAL.GOLD;
  const statusCss   = skillPoints > 0 ? CASUAL_CSS.PURPLE : isLevelReady ? CASUAL_CSS.BLUE : hasEquipment ? meta.css : CASUAL_CSS.GOLD;

  badge.lineStyle(meta.rank >= 3 ? 2 : 1.5, meta.color, 0.9);
  badge.strokeCircle(portraitX, portraitY, 36);
  badge.lineStyle(1, meta.elementColor, 0.5);
  badge.strokeCircle(portraitX, portraitY, 28);
  badge.fillStyle(CASUAL.SHADOW, 0.2);
  badge.fillEllipse(portraitX, portraitY + 30, 70, 12);

  badge.lineStyle(2.4, statusColor, skillPoints > 0 || isLevelReady ? 1 : 0.5);
  badge.beginPath();
  badge.arc(
    portraitX,
    portraitY,
    41,
    Phaser.Math.DegToRad(-90),
    Phaser.Math.DegToRad(-90 + 360 * Phaser.Math.Clamp(xpPct, 0, 1)),
  );
  badge.strokePath();

  badge.fillStyle(CASUAL.PANEL, 1);
  badge.fillRoundedRect(x + 5, y + 5, 42, 14, 5);
  badge.lineStyle(1.5, CASUAL.EDGE_SOFT, 0.9);
  badge.strokeRoundedRect(x + 5, y + 5, 42, 14, 5);
  badge.fillStyle(meta.color, 1);
  badge.fillRoundedRect(x + 49, y + 5, 17, 14, 5);
  badge.lineStyle(1.5, CASUAL.EDGE, 0.9);
  badge.strokeRoundedRect(x + 49, y + 5, 17, 14, 5);
  badge.fillStyle(CASUAL.PANEL, 1);
  badge.fillRoundedRect(x + 9, y + 48, 52, 15, 6);
  badge.lineStyle(1.5, meta.elementColor, 0.9);
  badge.strokeRoundedRect(x + 9, y + 48, 52, 15, 6);
  badge.fillStyle(CASUAL.PANEL, 1);
  badge.fillRoundedRect(x + 60, y + 24, 24, 17, 6);
  badge.lineStyle(1.5, statusColor, 0.9);
  badge.strokeRoundedRect(x + 60, y + 24, 24, 17, 6);
  badge.fillStyle(statusColor, 0.22);
  badge.fillCircle(x + 72, y + 32.5, 6);
  if (!hasEquipment) {
    badge.fillStyle(CASUAL.GOLD, 0.3);
    badge.fillRoundedRect(x + 63, y + 45, 18, 12, 4);
    badge.lineStyle(1.5, CASUAL.GOLD_DK, 0.9);
    badge.strokeRoundedRect(x + 63, y + 45, 18, 12, 4);
  }
  ov.add(badge);

  ov.add(scene.add.text(x + 26, y + 12, meta.indexLabel, {
    fontFamily: 'monospace',
    fontSize: '7px',
    color: CASUAL_CSS.INK_SOFT,
    fontStyle: 'bold',
  }).setOrigin(0.5));
  ov.add(scene.add.text(x + 57.5, y + 12, meta.tier, {
    fontFamily: 'sans-serif',
    fontSize: '9px',
    fontStyle: 'bold',
    color: '#ffffff',
  }).setOrigin(0.5));
  ov.add(scene.add.text(x + 35, y + 55.5, `${meta.elementIcon} ${meta.stars}`, {
    fontFamily: 'sans-serif',
    fontSize: '8px',
    fontStyle: 'bold',
    color: meta.css,
  }).setOrigin(0.5));
  ov.add(scene.add.text(x + 72, y + 32.5, skillPoints > 0 ? 'SP' : isLevelReady ? 'UP' : 'EXP', {
    fontFamily: 'sans-serif',
    fontSize: '7px',
    fontStyle: 'bold',
    color: statusCss,
  }).setOrigin(0.5));
  if (!hasEquipment) {
    ov.add(scene.add.text(x + 72, y + 51, 'EQ', {
      fontFamily: 'sans-serif',
      fontSize: '7px',
      fontStyle: 'bold',
      color: CASUAL_CSS.GOLD,
    }).setOrigin(0.5));
  }
}

// ─── Growth Command Panel ─────────────────────────────────────────────────────

export function buildGrowthCommandPanel(
  ctx: MonsterDetailContext,
  ov: Phaser.GameObjects.Container,
  m: OwnedMonster,
  tree: SkillTree | undefined,
  x: number, y: number, w: number,
  accentColor: number,
): void {
  const scene    = ctx.scene;
  const gs       = loadGameState();
  const xpNeeded = xpToNextLevel(m.level);
  const xpPct    = m.level >= 50 ? 1 : Math.min(1, m.xp / xpNeeded);
  const directive: GrowthDirective = getGrowthDirective(m, tree, gs, xpPct);
  const equippedSkills = m.equippedSkills ?? [];
  const eq = m.equipment ? getEquipmentDisplay(gs, m.equipment) : null;

  const bg = scene.add.graphics();
  bg.fillStyle(DUNGEON_UI.SOOT, 1);
  bg.fillRoundedRect(x, y, w, 48, 7);
  bg.fillStyle(directive.accent, 0.16);
  bg.fillRoundedRect(x + 4, y + 4, 78, 40, 5);
  bg.lineStyle(1.5, directive.accent, 0.82);
  bg.strokeRoundedRect(x + 4, y + 4, 78, 40, 5);
  bg.lineStyle(1, accentColor, 0.42);
  bg.lineBetween(x + 92, y + 9, x + 92, y + 39);
  bg.lineStyle(1.5, DUNGEON_UI.IRON, 0.92);
  bg.strokeRoundedRect(x, y, w, 48, 7);
  ov.add(bg);

  ov.add(scene.add.text(x + 14, y + 13, '성장 루트', {
    fontFamily: 'sans-serif',
    fontSize: '10px',
    fontStyle: 'bold',
    color: DUNGEON_UI_CSS.MUTED,
  }).setOrigin(0, 0.5));
  ov.add(scene.add.text(x + 14, y + 31, `${Math.round(xpPct * 100)}% EXP`, {
    fontFamily: 'sans-serif',
    fontSize: '12px',
    fontStyle: 'bold',
    color: DUNGEON_UI_CSS.BRASS,
  }).setOrigin(0, 0.5));

  ov.add(scene.add.text(x + 102, y + 14, directive.title, {
    fontFamily: 'sans-serif',
    fontSize: '13px',
    fontStyle: 'bold',
    color: DUNGEON_UI_CSS.PARCHMENT,
  }).setOrigin(0, 0.5));
  addGrowthPill(scene, ov, x + w - 86, y + 6,  74, 'SP',   String(m.skillPoints ?? 0), (m.skillPoints ?? 0) > 0 ? 0x9b71d1 : DUNGEON_UI.EDGE);
  addGrowthPill(scene, ov, x + w - 86, y + 27, 74, '장비', eq ? '장착' : '미장착', eq ? DUNGEON_UI.BRASS : DUNGEON_UI.EDGE);

  const skillSlotLabel = scene.add.text(x + w - 96, y + 39, `${equippedSkills.length}/2 스킬`, {
    fontFamily: 'sans-serif',
    fontSize: '10px',
    fontStyle: 'bold',
    color: equippedSkills.length >= 2 ? DUNGEON_UI_CSS.JADE : DUNGEON_UI_CSS.MUTED,
  }).setOrigin(1, 0.5);
  ov.add(skillSlotLabel);

  // The body ran under the right-aligned skill count and was cut mid-word
  // (§28 P1): end it with an ellipsis before the count instead.
  const body = scene.add.text(x + 102, y + 32, directive.body, {
    fontFamily: 'sans-serif',
    fontSize: '10px',
    color: DUNGEON_UI_CSS.MUTED,
  }).setOrigin(0, 0.5);
  fitTextToWidth(body, skillSlotLabel.x - skillSlotLabel.width - 8 - body.x);
  ov.add(body);

  const openFusion = ctx.onOpenFusion;
  if (directive.action === 'evolve' && openFusion) {
    // The whole route card is the button (48px tall); release-tap so a press that
    // started on the tab strip above cannot fire it.
    const zone = scene.add.zone(x + w / 2, y + 24, w, 48).setInteractive({ useHandCursor: true })
      .setName('monster-detail-evolve');
    onReleaseTap(zone, () => openFusion(m));
    ov.add(zone);
  }
}

/** Trim a one-line text with an ellipsis until it fits `maxW` logical px. */
function fitTextToWidth(text: Phaser.GameObjects.Text, maxW: number): void {
  const full = text.text;
  if (text.width <= maxW) return;
  let chars = full.length;
  while (chars > 1 && text.width > maxW) {
    chars -= 1;
    text.setText(`${full.slice(0, chars).trimEnd()}…`);
  }
}

function addGrowthPill(
  scene: Phaser.Scene,
  ov: Phaser.GameObjects.Container,
  x: number, y: number, w: number,
  label: string,
  value: string,
  accent: number,
): void {
  const bg = scene.add.graphics();
  bg.fillStyle(DUNGEON_UI.STONE, 1);
  bg.fillRoundedRect(x, y, w, 16, 5);
  bg.lineStyle(1.5, accent, 0.9);
  bg.strokeRoundedRect(x, y, w, 16, 5);
  ov.add(bg);

  ov.add(scene.add.text(x + 6, y + 8, label, {
    fontFamily: 'sans-serif',
    fontSize: '10px',
    fontStyle: 'bold',
    color: DUNGEON_UI_CSS.MUTED,
  }).setOrigin(0, 0.5));
  ov.add(scene.add.text(x + w - 6, y + 8, value, {
    fontFamily: 'sans-serif',
    fontSize: '10px',
    fontStyle: 'bold',
    color: DUNGEON_UI_CSS.TEXT,
  }).setOrigin(1, 0.5));
}

// ─── Feed Training CTA ────────────────────────────────────────────────────────

interface FeedTrainingActionOptions {
  x: number;
  y: number;
  w: number;
  h: number;
  monster: OwnedMonster;
  state: import('../data/wisdom').GameState;
  accentColor: number;
  onPress: () => void;
}

export function buildFeedTrainingAction(
  scene: Phaser.Scene,
  options: FeedTrainingActionOptions,
): {
  objects: Phaser.GameObjects.GameObject[];
  setMessage: (title: string, sub: string, chip: string, color: string) => void;
  resetMessage: () => void;
} {
  const { x, y, w, h, monster, state, accentColor, onPress } = options;
  const preview = getFeedTrainingPreview(monster, state);
  const borderColor = preview.maxLevel
    ? DUNGEON_UI.JADE
    : preview.canAfford ? DUNGEON_UI.BRASS : DUNGEON_UI.EMBER;
  const chipColor = preview.willLevelUp ? DUNGEON_UI.BRASS_BRIGHT : borderColor;
  const chipCss = `#${chipColor.toString(16).padStart(6, '0')}`;
  const defaultTitle      = preview.title;
  const defaultSub        = preview.sub;
  const defaultChip       = preview.chip;
  const defaultTitleColor = preview.canAfford || preview.maxLevel
    ? DUNGEON_UI_CSS.PARCHMENT
    : DUNGEON_UI_CSS.EMBER;
  const defaultChipColor  = chipCss;

  const bg = scene.add.graphics();
  bg.fillStyle(DUNGEON_UI.VOID, 0.66);
  bg.fillRoundedRect(x, y + 4, w, h, 8);
  bg.fillStyle(DUNGEON_UI.STONE_RAISED, 1);
  bg.fillRoundedRect(x, y, w, h - 2, 8);
  bg.fillStyle(borderColor, 0.16);
  bg.fillRoundedRect(x + 5, y + 5, 42, h - 12, 6);
  bg.lineStyle(1.5, borderColor, 0.88);
  bg.strokeRoundedRect(x, y, w, h - 2, 8);
  drawGrowthSigil(bg, x + 26, y + h / 2 - 1, accentColor, 0.96);

  const trackX = x + w - 96;
  const trackY = y + h - 8;
  const trackW = 74;
  bg.fillStyle(DUNGEON_UI.VOID, 0.9);
  bg.fillRoundedRect(trackX, trackY, trackW, 3, 2);
  bg.fillStyle(DUNGEON_UI.JADE, 0.78);
  bg.fillRoundedRect(trackX, trackY, Math.max(3, Math.round(trackW * preview.currentPct)), 3, 2);
  if (preview.nextPct > preview.currentPct) {
    bg.fillStyle(DUNGEON_UI.BRASS_BRIGHT, 1);
    bg.fillRoundedRect(
      trackX + Math.round(trackW * preview.currentPct),
      trackY,
      Math.max(3, Math.round(trackW * (preview.nextPct - preview.currentPct))),
      3,
      2,
    );
  }

  const titleText = scene.add.text(x + 58, y + 15, defaultTitle, {
    fontFamily: 'sans-serif',
    fontSize: '12px',
    fontStyle: 'bold',
    color: defaultTitleColor,
  }).setOrigin(0, 0.5);
  const subText = scene.add.text(x + 58, y + 34, defaultSub, {
    fontFamily: 'sans-serif',
    fontSize: '10px',
    fontStyle: 'bold',
    color: preview.canAfford || preview.maxLevel ? DUNGEON_UI_CSS.MUTED : DUNGEON_UI_CSS.EMBER,
  }).setOrigin(0, 0.5);

  bg.fillStyle(DUNGEON_UI.SOOT, 0.96);
  bg.fillRoundedRect(x + w - 92, y + 8, 76, 21, 6);
  bg.lineStyle(1.5, chipColor, 0.9);
  bg.strokeRoundedRect(x + w - 92, y + 8, 76, 21, 6);
  const chipText = scene.add.text(x + w - 54, y + 18.5, defaultChip, {
    fontFamily: 'sans-serif',
    fontSize: '10px',
    fontStyle: 'bold',
    color: chipCss,
  }).setOrigin(0.5);
  const arrowText = scene.add.text(x + w - 10, y + h / 2, '›', {
    fontFamily: 'sans-serif',
    fontSize: '18px',
    fontStyle: 'bold',
    color: preview.canAfford || preview.maxLevel ? DUNGEON_UI_CSS.BRASS : DUNGEON_UI_CSS.MUTED,
  }).setOrigin(0.5);

  const zone = scene.add.zone(x + w / 2, y + h / 2, w, Math.max(44, h)).setInteractive({ useHandCursor: true });
  zone.on('pointerdown', onPress);

  const setMessage = (title: string, sub: string, chip: string, color: string): void => {
    if (!titleText.active || !subText.active || !chipText.active) return;
    titleText.setText(title).setColor(color);
    subText.setText(sub);
    chipText.setText(chip).setColor(color);
  };
  const resetMessage = (): void => {
    if (!titleText.active || !subText.active || !chipText.active) return;
    titleText.setText(defaultTitle).setColor(defaultTitleColor);
    subText.setText(defaultSub);
    chipText.setText(defaultChip).setColor(defaultChipColor);
  };

  return {
    objects: [bg, titleText, subText, chipText, arrowText, zone],
    setMessage,
    resetMessage,
  };
}

// ─── Skill Tree Section ───────────────────────────────────────────────────────

export function buildSkillTreeSection(
  ctx: MonsterDetailContext,
  ov: Phaser.GameObjects.Container,
  m: OwnedMonster,
  tree: SkillTree,
  x: number, y: number, w: number,
): void {
  const { scene, onRefresh } = ctx;

  const hdr = scene.add.text(x + w / 2, y, '스킬 트리', {
    fontFamily: 'sans-serif', fontSize: '10px', fontStyle: 'bold', color: DUNGEON_UI_CSS.MUTED,
  }).setOrigin(0.5);
  ov.add(hdr);

  const branches = (['A', 'B', 'C'] as const);
  const colW = w / 3;
  const branchAccents: Record<'A' | 'B' | 'C', number> = {
    A: DUNGEON_UI.EMBER,
    B: 0x5b8bb7,
    C: DUNGEON_UI.JADE,
  };

  branches.forEach((branch, bi) => {
    const bx           = x + bi * colW;
    const branchNodes  = tree.nodes.filter(n => n.branch === branch).sort((a, b) => a.tier - b.tier);
    const branchAccent = branchAccents[branch];

    const lane = scene.add.graphics();
    lane.fillStyle(DUNGEON_UI.SOOT, 1);
    lane.fillRoundedRect(bx + 8, y + 11, colW - 16, 20, 7);
    lane.fillStyle(branchAccent, 0.22);
    lane.fillRoundedRect(bx + 11, y + 14, colW - 22, 3, 2);
    lane.lineStyle(1.5, branchAccent, 0.72);
    lane.strokeRoundedRect(bx + 8, y + 11, colW - 16, 20, 7);
    lane.lineStyle(1.5, branchAccent, 0.28);
    lane.lineBetween(bx + colW / 2, y + 34, bx + colW / 2, y + 198);
    ov.add(lane);

    const bnT = scene.add.text(bx + colW / 2, y + 20, tree.branchNames[branch], {
      fontFamily: 'sans-serif',
      fontSize: '11px',
      fontStyle: 'bold',
      color: DUNGEON_UI_CSS.TEXT,
    }).setOrigin(0.5);
    ov.add(bnT);

    branchNodes.forEach((node, ni) => {
      const ny         = y + 38 + ni * 58;
      const nx         = bx + colW / 2;
      const spent      = (m.spentSkills[node.id] ?? 0) >= 1;
      const prereqMet  = !node.requires || (m.spentSkills[node.requires] ?? 0) >= 1;
      const canAfford  = m.skillPoints >= node.cost;
      const canUnlock  = !spent && prereqMet && canAfford;
      const stateAccent    = spent ? DUNGEON_UI.JADE : canUnlock ? DUNGEON_UI.BRASS_BRIGHT : prereqMet ? branchAccent : DUNGEON_UI.EDGE;
      const stateAccentCss = spent ? DUNGEON_UI_CSS.JADE : canUnlock ? DUNGEON_UI_CSS.BRASS : prereqMet ? DUNGEON_UI_CSS.TEXT : DUNGEON_UI_CSS.MUTED;
      const filledTile = spent;
      const stateFill  = filledTile ? DUNGEON_UI.STONE_RAISED : prereqMet ? DUNGEON_UI.STONE : DUNGEON_UI.SOOT;
      const stateLabel = spent ? '습득' : canUnlock ? '해금' : prereqMet ? `${node.cost}SP` : '잠김';
      const nodeW = 82;
      const nodeH = 52;

      const nodeBg = scene.add.graphics();
      nodeBg.fillStyle(DUNGEON_UI.VOID, 0.48);
      nodeBg.fillRoundedRect(nx - nodeW / 2 + 2, ny + 3, nodeW, nodeH, 8);
      nodeBg.fillStyle(stateFill, prereqMet ? 1 : 0.9);
      nodeBg.fillRoundedRect(nx - nodeW / 2, ny, nodeW, nodeH, 8);
      nodeBg.fillStyle(stateAccent, filledTile ? 0.22 : 0.13);
      nodeBg.fillRoundedRect(nx - nodeW / 2 + 5, ny + 9, 30, 28, 7);
      nodeBg.lineStyle(spent || canUnlock ? 2 : 1.2, stateAccent, prereqMet ? 0.9 : 0.42);
      nodeBg.strokeRoundedRect(nx - nodeW / 2, ny, nodeW, nodeH, 8);
      drawGrowthSigil(nodeBg, nx - nodeW / 2 + 20, ny + 23, stateAccent, prereqMet ? 0.9 : 0.38);
      ov.add(nodeBg);

      ov.add(scene.add.text(nx - nodeW / 2 + 8, ny + 9, `T${node.tier}`, {
        fontFamily: 'monospace',
        fontSize: '10px',
        color: filledTile ? DUNGEON_UI_CSS.JADE : DUNGEON_UI_CSS.MUTED,
        fontStyle: 'bold',
      }).setOrigin(0, 0.5));

      ov.add(scene.add.text(nx + 2, ny + 17, shortenLabel(node.name, 5), {
        fontFamily: 'sans-serif',
        fontSize: '10px',
        fontStyle: 'bold',
        color: filledTile ? DUNGEON_UI_CSS.PARCHMENT : prereqMet ? DUNGEON_UI_CSS.TEXT : DUNGEON_UI_CSS.MUTED,
      }).setOrigin(0, 0.5));

      ov.add(scene.add.text(nx + 2, ny + 36, stateLabel, {
        fontFamily: 'sans-serif',
        fontSize: '10px',
        fontStyle: spent || canUnlock ? 'bold' : 'normal',
        color: filledTile ? DUNGEON_UI_CSS.JADE : stateAccentCss,
      }).setOrigin(0, 0.5));
      if (canUnlock) {
        ov.add(scene.add.text(nx + nodeW / 2 - 7, ny + 8, '!', {
          fontFamily: 'sans-serif',
          fontSize: '10px',
          color: DUNGEON_UI_CSS.PARCHMENT,
          fontStyle: 'bold',
          backgroundColor: '#4c351b',
          padding: { x: 3, y: 1 },
        }).setOrigin(1, 0.5));
      }

      if (canUnlock) {
        const zone = scene.add.zone(nx, ny + 26, nodeW, nodeH).setInteractive({ useHandCursor: true });
        zone.on('pointerdown', () => {
          const result = spendMonsterSkillNode(loadGameState(), m.id, node);
          if (!result.ok) return;
          saveGameState(result.state);
          ov.destroy();
          onRefresh(result.monster);
        });
        ov.add(zone);
      }
    });
  });
}

// Keep ACTIVE_SKILLS in scope (used in buildEquippedSkillSlots in Equipment module)
void ACTIVE_SKILLS;
