/**
 * MonsterDetailGrowth.ts — growth command panel, feed/training CTA,
 * skill tree section, and hero-collection-badge overlay for
 * MonsterDetailPanel.
 */
import { CASUAL, CASUAL_CSS } from '../constants/colors';
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
  bg.fillStyle(CASUAL.PANEL_SOFT, 1);
  bg.fillRoundedRect(x, y, w, 48, 8);
  bg.fillStyle(0xffffff, 0.12);
  bg.fillRoundedRect(x + 4, y + 3, w - 8, 4, 3);
  bg.fillStyle(directive.accent, 0.2);
  bg.fillRoundedRect(x + 4, y + 4, 82, 40, 7);
  bg.lineStyle(2, directive.accent, 0.9);
  bg.strokeRoundedRect(x + 4, y + 4, 82, 40, 7);
  bg.lineStyle(2, accentColor, 0.5);
  bg.lineBetween(x + 96, y + 10, x + 96, y + 38);
  bg.lineStyle(3, CASUAL.EDGE, 1);
  bg.strokeRoundedRect(x, y, w, 48, 8);
  ov.add(bg);

  ov.add(scene.add.text(x + 14, y + 13, '성장 루트', {
    fontFamily: 'sans-serif',
    fontSize: '10px',
    fontStyle: 'bold',
    color: CASUAL_CSS.INK_SOFT,
  }).setOrigin(0, 0.5));
  ov.add(scene.add.text(x + 14, y + 31, `${Math.round(xpPct * 100)}% EXP`, {
    fontFamily: 'sans-serif',
    fontSize: '12px',
    fontStyle: 'bold',
    color: CASUAL_CSS.INK,
  }).setOrigin(0, 0.5));

  ov.add(scene.add.text(x + 108, y + 14, directive.title, {
    fontFamily: 'sans-serif',
    fontSize: '13px',
    fontStyle: 'bold',
    color: CASUAL_CSS.INK,
  }).setOrigin(0, 0.5));
  ov.add(scene.add.text(x + 108, y + 32, directive.body, {
    fontFamily: 'sans-serif',
    fontSize: '9px',
    color: CASUAL_CSS.INK_SOFT,
    wordWrap: { width: 124, useAdvancedWrap: true },
  }).setOrigin(0, 0.5));

  addGrowthPill(scene, ov, x + w - 84, y + 7,  72, 'SP',   String(m.skillPoints ?? 0), (m.skillPoints ?? 0) > 0 ? CASUAL.PURPLE : CASUAL.EDGE_SOFT);
  addGrowthPill(scene, ov, x + w - 84, y + 27, 72, '장비', eq ? eq.icon : '미장착',    eq ? CASUAL.GOLD : CASUAL.EDGE_SOFT);

  const skillSlotLabel = `${equippedSkills.length}/2 스킬`;
  ov.add(scene.add.text(x + w - 95, y + 39, skillSlotLabel, {
    fontFamily: 'sans-serif',
    fontSize: '9px',
    fontStyle: 'bold',
    color: equippedSkills.length >= 2 ? CASUAL_CSS.GREEN : CASUAL_CSS.INK_SOFT,
  }).setOrigin(1, 0.5));
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
  bg.fillStyle(CASUAL.PANEL, 1);
  bg.fillRoundedRect(x, y, w, 16, 5);
  bg.lineStyle(1.5, accent, 0.9);
  bg.strokeRoundedRect(x, y, w, 16, 5);
  ov.add(bg);

  ov.add(scene.add.text(x + 6, y + 8, label, {
    fontFamily: 'sans-serif',
    fontSize: '8px',
    fontStyle: 'bold',
    color: CASUAL_CSS.INK_SOFT,
  }).setOrigin(0, 0.5));
  ov.add(scene.add.text(x + w - 6, y + 8, value, {
    fontFamily: 'sans-serif',
    fontSize: '9px',
    fontStyle: 'bold',
    color: CASUAL_CSS.INK,
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
  const { x, y, w, h, monster, state, onPress } = options;
  const preview = getFeedTrainingPreview(monster, state);
  // 캔디 CTA: 만렙=초록 비활성톤, 가능=골드, 부족=뮤트 크림
  const fillColor   = preview.maxLevel ? CASUAL.GREEN  : preview.canAfford ? CASUAL.GOLD : CASUAL.PANEL_SOFT;
  const borderColor = preview.maxLevel ? CASUAL.GREEN_DK : preview.canAfford ? CASUAL.GOLD_DK : CASUAL.EDGE_SOFT;
  const chipColor   = preview.maxLevel ? CASUAL.GREEN_DK : preview.willLevelUp ? CASUAL.GOLD_DK : preview.canAfford ? CASUAL.GOLD_DK : CASUAL.RED;
  const onCandy     = preview.canAfford || preview.maxLevel; // 채도 캡 위 글자는 흰색
  const chipCss     = `#${chipColor.toString(16).padStart(6, '0')}`; // 흰 칩 위 채도 글자
  const defaultTitle      = preview.title;
  const defaultSub        = preview.sub;
  const defaultChip       = preview.chip;
  const defaultTitleColor = onCandy ? '#ffffff' : CASUAL_CSS.RED;
  const defaultChipColor  = chipCss;

  const bg = scene.add.graphics();
  // 채도 베이스(어두운 테두리색) → 밝은 캡 = 캔디 버튼 입체
  bg.fillStyle(borderColor, 1);
  bg.fillRoundedRect(x, y + 4, w, h, 10);
  bg.fillStyle(fillColor, 1);
  bg.fillRoundedRect(x, y, w, h - 2, 10);
  bg.fillStyle(0xffffff, 0.32);
  bg.fillRoundedRect(x + 5, y + 4, w - 10, Math.max(8, h * 0.36), 6);
  bg.fillStyle(0xffffff, onCandy ? 0.22 : 0.5);
  bg.fillRoundedRect(x + 7, y + 6, 36, h - 12, 8);

  const trackX = x + w - 96;
  const trackY = y + h - 8;
  const trackW = 74;
  bg.fillStyle(CASUAL.PANEL_SOFT, 0.9);
  bg.fillRoundedRect(trackX, trackY, trackW, 3, 2);
  bg.fillStyle(0xffffff, 0.7);
  bg.fillRoundedRect(trackX, trackY, Math.max(3, Math.round(trackW * preview.currentPct)), 3, 2);
  if (preview.nextPct > preview.currentPct) {
    bg.fillStyle(0xffffff, 1);
    bg.fillRoundedRect(
      trackX + Math.round(trackW * preview.currentPct),
      trackY,
      Math.max(3, Math.round(trackW * (preview.nextPct - preview.currentPct))),
      3,
      2,
    );
  }

  const iconText = scene.add.text(x + 25, y + h / 2, preview.maxLevel ? '👑' : '🥩', {
    fontFamily: 'sans-serif',
    fontSize: '20px',
  }).setOrigin(0.5);

  const titleText = scene.add.text(x + 60, y + 12, defaultTitle, {
    fontFamily: 'sans-serif',
    fontSize: '12px',
    fontStyle: 'bold',
    color: defaultTitleColor,
    stroke: onCandy ? '#00000033' : undefined,
    strokeThickness: onCandy ? 3 : 0,
  }).setOrigin(0, 0.5);
  const subText = scene.add.text(x + 60, y + 27, defaultSub, {
    fontFamily: 'sans-serif',
    fontSize: '9px',
    fontStyle: 'bold',
    color: onCandy ? '#ffffff' : CASUAL_CSS.RED,
  }).setOrigin(0, 0.5);

  bg.fillStyle(0xffffff, 0.85);
  bg.fillRoundedRect(x + w - 90, y + 7, 76, 19, 7);
  bg.lineStyle(1.5, chipColor, 0.9);
  bg.strokeRoundedRect(x + w - 90, y + 7, 76, 19, 7);
  const chipText = scene.add.text(x + w - 52, y + 16.5, defaultChip, {
    fontFamily: 'sans-serif',
    fontSize: '10px',
    fontStyle: 'bold',
    color: chipCss,
  }).setOrigin(0.5);
  const arrowText = scene.add.text(x + w - 11, y + h / 2, '▶', {
    fontFamily: 'sans-serif',
    fontSize: '9px',
    fontStyle: 'bold',
    color: onCandy ? '#ffffff' : CASUAL_CSS.INK_SOFT,
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
    objects: [bg, iconText, titleText, subText, chipText, arrowText, zone],
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
    fontFamily: 'sans-serif', fontSize: '13px', fontStyle: 'bold', color: CASUAL_CSS.INK,
  }).setOrigin(0.5);
  ov.add(hdr);

  const branches = (['A', 'B', 'C'] as const);
  const colW = w / 3;
  const branchAccents: Record<'A' | 'B' | 'C', number> = {
    A: CASUAL.RED,
    B: CASUAL.BLUE,
    C: CASUAL.GREEN,
  };

  branches.forEach((branch, bi) => {
    const bx           = x + bi * colW;
    const branchNodes  = tree.nodes.filter(n => n.branch === branch).sort((a, b) => a.tier - b.tier);
    const branchAccent = branchAccents[branch];

    const lane = scene.add.graphics();
    lane.fillStyle(branchAccent, 1);
    lane.fillRoundedRect(bx + 8, y + 11, colW - 16, 20, 7);
    lane.fillStyle(0xffffff, 0.3);
    lane.fillRoundedRect(bx + 11, y + 13, colW - 22, 4, 2);
    lane.lineStyle(2, CASUAL.EDGE, 0.9);
    lane.strokeRoundedRect(bx + 8, y + 11, colW - 16, 20, 7);
    lane.lineStyle(2, branchAccent, 0.35);
    lane.lineBetween(bx + colW / 2, y + 34, bx + colW / 2, y + 198);
    ov.add(lane);

    const bnT = scene.add.text(bx + colW / 2, y + 20, tree.branchNames[branch], {
      fontFamily: 'sans-serif',
      fontSize: '11px',
      fontStyle: 'bold',
      color: '#ffffff',
      stroke: '#00000033',
      strokeThickness: 3,
    }).setOrigin(0.5);
    ov.add(bnT);

    branchNodes.forEach((node, ni) => {
      const ny         = y + 38 + ni * 58;
      const nx         = bx + colW / 2;
      const spent      = (m.spentSkills[node.id] ?? 0) >= 1;
      const prereqMet  = !node.requires || (m.spentSkills[node.requires] ?? 0) >= 1;
      const canAfford  = m.skillPoints >= node.cost;
      const canUnlock  = !spent && prereqMet && canAfford;
      const stateAccent    = spent ? CASUAL.GREEN : canUnlock ? CASUAL.GOLD : prereqMet ? branchAccent : CASUAL.EDGE_SOFT;
      const stateAccentCss = spent ? CASUAL_CSS.GREEN : canUnlock ? CASUAL_CSS.GOLD : prereqMet ? CASUAL_CSS.INK : CASUAL_CSS.INK_SOFT;
      // 습득=초록 채도면(흰글자), 그 외=크림 타일(잉크글자)
      const filledTile = spent;
      const stateFill  = filledTile ? CASUAL.GREEN : prereqMet ? CASUAL.PANEL : CASUAL.PANEL_SOFT;
      const stateLabel = spent ? '습득' : canUnlock ? '해금' : prereqMet ? `${node.cost}SP` : '잠김';
      const nodeW = 82;
      const nodeH = 52;

      const nodeBg = scene.add.graphics();
      nodeBg.fillStyle(CASUAL.SHADOW, 0.18);
      nodeBg.fillRoundedRect(nx - nodeW / 2 + 2, ny + 3, nodeW, nodeH, 8);
      nodeBg.fillStyle(stateFill, prereqMet ? 1 : 0.88);
      nodeBg.fillRoundedRect(nx - nodeW / 2, ny, nodeW, nodeH, 8);
      nodeBg.fillStyle(0xffffff, filledTile ? 0.28 : 0.4);
      nodeBg.fillRoundedRect(nx - nodeW / 2 + 5, ny + 4, nodeW - 10, 4, 3);
      nodeBg.fillStyle(stateAccent, filledTile ? 0.3 : 0.18);
      nodeBg.fillRoundedRect(nx - nodeW / 2 + 5, ny + 9, 30, 28, 7);
      nodeBg.lineStyle(spent || canUnlock ? 3 : 2, stateAccent, prereqMet ? 1 : 0.7);
      nodeBg.strokeRoundedRect(nx - nodeW / 2, ny, nodeW, nodeH, 8);
      ov.add(nodeBg);

      ov.add(scene.add.text(nx - nodeW / 2 + 20, ny + 23, node.icon, {
        fontFamily: 'sans-serif',
        fontSize: '17px',
      }).setOrigin(0.5));
      ov.add(scene.add.text(nx - nodeW / 2 + 8, ny + 9, `T${node.tier}`, {
        fontFamily: 'monospace',
        fontSize: '7px',
        color: filledTile ? '#ffffff' : CASUAL_CSS.INK_SOFT,
        fontStyle: 'bold',
      }).setOrigin(0, 0.5));

      ov.add(scene.add.text(nx + 2, ny + 17, shortenLabel(node.name, 5), {
        fontFamily: 'sans-serif',
        fontSize: '10px',
        fontStyle: 'bold',
        color: filledTile ? '#ffffff' : prereqMet ? CASUAL_CSS.INK : CASUAL_CSS.INK_SOFT,
      }).setOrigin(0, 0.5));

      ov.add(scene.add.text(nx + 2, ny + 36, stateLabel, {
        fontFamily: 'sans-serif',
        fontSize: '9px',
        fontStyle: spent || canUnlock ? 'bold' : 'normal',
        color: filledTile ? '#ffffff' : stateAccentCss,
      }).setOrigin(0, 0.5));
      if (canUnlock) {
        ov.add(scene.add.text(nx + nodeW / 2 - 7, ny + 8, '!', {
          fontFamily: 'sans-serif',
          fontSize: '10px',
          color: '#ffffff',
          fontStyle: 'bold',
          backgroundColor: CASUAL_CSS.GOLD,
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
