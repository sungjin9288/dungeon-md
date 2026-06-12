import Phaser from 'phaser';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../constants/layout';
import { COLORS, CSS } from '../constants/colors';
import { loadGameState, saveGameState, type GameState, type OwnedMonster } from '../data/wisdom';
import { getQuest } from '../data/quests';
import { MONSTER_DEFS, getSkinForMonster, getSkinsForMonster, type MonsterDef, type MonsterId, type MonsterSkin, type RarityId } from '../data/monsters';
import { equipSkin, purchaseSkin, unequipSkin } from '../data/shopTransactions';
import {
  cycleMonsterActiveSkillSlot,
  equipMonsterEquipment,
  feedOwnedMonster,
  purchaseActiveSkillWithGold,
  spendMonsterSkillNode,
} from '../data/barracksTransactions';
import {
  getSkillTree, ACTIVE_SKILLS, EQUIPMENT_DEFS,
  xpToNextLevel, getMonsterAtk, type SkillTree,
} from '../data/barracks';
import { generatePortrait } from '../art/PortraitGenerator';
import {
  addFramedPanel,
  addInfoRow,
  addPrimaryActionButton,
  addProgressBar,
} from './GameUiPrimitives';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MonsterDetailContext {
  scene: Phaser.Scene;
  focusSourceLabel?: string;
  onClose: () => void;
  onRefresh: (m: OwnedMonster) => void;
  onOpenForge?: (m: OwnedMonster) => void;
  onReturnToRoom?: () => void;
}

const DETAIL_PANEL_FILL = 0x130c06;
const DETAIL_ROW_FILL = 0x120c05;
const FEED_GOLD_COST = 50;
const FEED_XP_GAIN = 20;
const SHOP_PANEL_FILL = 0x120818;
const SHOP_CARD_FILL = 0x170b22;
const SHOP_CARD_OWNED_FILL = 0x0e2116;
const SHOP_PURPLE = 0xaa44ff;
const SHOP_PURPLE_DARK = 0x552475;
const SHOP_OWNED_GREEN = 0x44cc88;
const DETAIL_TYPE_LABEL: Record<string, string> = {
  melee: '근접 수호자',
  ranged: '원거리 수호자',
  magic: '마법 수호자',
  support: '지원 수호자',
};
const DETAIL_OWNED_RARITY_TO_TIER: readonly RarityId[] = ['C', 'U', 'R', 'E', 'L'];
const DETAIL_RARITY_META: Record<RarityId, { rank: number; label: string; stars: string; color: number; css: string }> = {
  C: { rank: 0, label: 'COMMON', stars: '★',     color: 0x8f98a5, css: '#b9c0ca' },
  U: { rank: 1, label: 'UNIQUE', stars: '★★',    color: 0x58c681, css: '#8ff0ad' },
  R: { rank: 2, label: 'RARE',   stars: '★★★',   color: 0x62a8ff, css: '#9bc9ff' },
  E: { rank: 3, label: 'EPIC',   stars: '★★★★',  color: 0xc978ff, css: '#e3b4ff' },
  L: { rank: 4, label: 'LEGEND', stars: '★★★★★', color: 0xffc857, css: '#ffd878' },
};
const DETAIL_TRIBE_LABELS: Record<string, string> = {
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
const DETAIL_ELEMENT_META: Record<string, { label: string; icon: string; color: number }> = {
  fire:      { label: '화염', icon: '🔥', color: 0xff7a3d },
  frost:     { label: '서리', icon: '❄',  color: 0x7bdcff },
  lightning: { label: '번개', icon: '⚡', color: 0xffdf64 },
  dark:      { label: '암흑', icon: '☾',  color: 0xc181ff },
  holy:      { label: '신성', icon: '✦',  color: 0xffe8a3 },
};
const DETAIL_EQUIPMENT_STARS = ['★', '★★', '★★★', '★★★★', '★★★★★', '★★★★★★'];
const DETAIL_EQUIPMENT_TYPE_META: Record<string, { label: string; icon: string; color: number; css: string }> = {
  weapon:    { label: '무기',   icon: '⚔', color: 0xffb45f, css: '#ffcc86' },
  armor:     { label: '방어구', icon: '◆', color: 0x8ac7ff, css: '#aad7ff' },
  accessory: { label: '장신구', icon: '✦', color: 0xd7a4ff, css: '#e3c0ff' },
};

type EquipmentDisplay = {
  id: string;
  name: string;
  icon: string;
  type: string;
  desc: string;
  rarity: number;
  crafted: boolean;
};

type GrowthDirective = {
  title: string;
  body: string;
  accent: number;
};

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
  dim.setInteractive(new Phaser.Geom.Rectangle(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT), Phaser.Geom.Rectangle.Contains);
  ov.add(dim);

  const def = MONSTER_DEFS[m.id as keyof typeof MONSTER_DEFS]!;
  const tree = getSkillTree(m.id as MonsterId);
  const collectionMeta = getDetailCollectionMeta(m, def);
  const xpNeeded = xpToNextLevel(m.level);
  const xpPct = m.level >= 50 ? 1 : Math.min(1, m.xp / xpNeeded);
  const skillPoints = m.skillPoints ?? 0;
  const hasEquipment = Boolean(m.equipment);

  // Panel
  const pw = 360, ph = CANVAS_HEIGHT - 48;
  const px = (CANVAS_WIDTH - pw) / 2;
  const py = (CANVAS_HEIGHT - ph) / 2;
  const accentColor = def.accentColor ?? collectionMeta.color;
  const panel = addFramedPanel(scene, {
    x: px,
    y: py,
    w: pw,
    h: ph,
    radius: 14,
    fillColor: DETAIL_PANEL_FILL,
    borderColor: accentColor,
    borderAlpha: 0.9,
    borderWidth: 2,
    accentColor,
    accentAlpha: 0.72,
    glowColor: accentColor,
    glowOpacity: 0.10,
    shadowOpacity: 0.64,
    shadowOffsetY: 5,
  });
  addToContainer(ov, panel.shadow, panel.panel, panel.glow);

  // Header — training chamber hero with portrait fallback.
  const detailSkin = getSkinForMonster(m.id, loadGameState().equippedSkins ?? {});
  const hero = scene.add.graphics();
  hero.fillStyle(0x060b0d, 0.96);
  hero.fillRoundedRect(px + 16, py + 14, pw - 32, 80, 12);
  hero.fillStyle(accentColor, 0.10);
  hero.fillRoundedRect(px + 22, py + 20, 70, 68, 10);
  hero.fillStyle(0x101716, 0.92);
  hero.fillRoundedRect(px + 30, py + 27, 54, 50, 9);
  hero.lineStyle(1.4, accentColor, 0.62);
  hero.strokeRoundedRect(px + 16, py + 14, pw - 32, 80, 12);
  hero.lineStyle(1, 0xffffff, 0.12);
  hero.strokeRoundedRect(px + 22, py + 20, pw - 44, 68, 9);
  hero.lineStyle(1, accentColor, 0.16);
  hero.lineBetween(px + 104, py + 76, px + pw - 32, py + 76);
  hero.lineBetween(px + 114, py + 58, px + pw - 44, py + 52);
  hero.fillStyle(accentColor, 0.16);
  hero.fillCircle(px + 57, py + 78, 26);
  hero.fillStyle(0x050302, 0.38);
  hero.fillEllipse(px + 57, py + 82, 64, 13);
  ov.add(hero);

  const portraitKey = generatePortrait(scene, m.id as MonsterId, detailSkin?.id);
  if (scene.textures.exists(portraitKey)) {
    const portrait = scene.add.image(px + 57, py + 52, portraitKey)
      .setOrigin(0.5).setDisplaySize(62, 62);
    ov.add(portrait);
  } else {
    const headerEmoji = scene.add.text(px + 57, py + 52, detailSkin ? detailSkin.emoji : def.emoji, {
      fontFamily: 'sans-serif', fontSize: '48px',
    }).setOrigin(0.5);
    ov.add(headerEmoji);
  }
  drawHeroCollectionBadges(scene, ov, px + 22, py + 20, collectionMeta, xpPct, skillPoints, hasEquipment);

  const nameT = scene.add.text(px + 106, py + 32, def.name, {
    fontFamily: 'Georgia, serif',
    fontSize: '18px',
    fontStyle: 'bold',
    color: CSS.PARCHMENT,
  }).setOrigin(0, 0.5);
  ov.add(nameT);
  ov.add(scene.add.text(px + pw - 28, py + 31, `Lv.${m.level}`, {
    fontFamily: 'sans-serif',
    fontSize: '13px',
    color: '#10110b',
    fontStyle: 'bold',
    backgroundColor: `#${accentColor.toString(16).padStart(6, '0')}`,
    padding: { x: 8, y: 3 },
  }).setOrigin(1, 0.5));

  const typeLabel = DETAIL_TYPE_LABEL[def.type] ?? '던전 수호자';
  ov.add(scene.add.text(px + 108, py + 53, `${typeLabel} · ${collectionMeta.tribeLabel} · ${collectionMeta.elementIcon} ${collectionMeta.elementLabel}`, {
    fontFamily: 'sans-serif',
    fontSize: '10px',
    color: '#b8fff0',
    fontStyle: 'bold',
  }).setOrigin(0, 0.5));
  ov.add(scene.add.text(px + 108, py + 72, def.passiveDesc, {
    fontFamily: 'sans-serif',
    fontSize: '9px',
    color: CSS.PARCHMENT_DIM,
    wordWrap: { width: pw - 146, useAdvancedWrap: true },
  }).setOrigin(0, 0.5));

  if (ctx.focusSourceLabel) {
    const focusChip = scene.add.graphics();
    focusChip.fillStyle(0x061716, 0.98);
    focusChip.fillRoundedRect(px + pw - 142, py + 65, 112, 18, 7);
    focusChip.lineStyle(1.1, 0xc8e8b0, 0.62);
    focusChip.strokeRoundedRect(px + pw - 142, py + 65, 112, 18, 7);
    focusChip.fillStyle(0xc8e8b0, 0.18);
    focusChip.fillRoundedRect(px + pw - 138, py + 69, 4, 10, 3);
    ov.add(focusChip);
    ov.add(scene.add.text(px + pw - 84, py + 74, ctx.focusSourceLabel, {
      fontFamily: 'sans-serif',
      fontSize: '9px',
      color: '#b8fff0',
      fontStyle: 'bold',
    }).setOrigin(0.5));
  }

  // Stats row
  const atk = getMonsterAtk(def.baseDamage, m.level, m.spentSkills);
  const statY = py + 102;
  const statGap = 6;
  const statW = (pw - 40 - statGap * 2) / 3;
  [
    addInfoRow(scene, {
      x: px + 20,
      y: statY,
      w: statW,
      h: 24,
      icon: '⚔️',
      label: 'ATK',
      value: `${atk}`,
      fillColor: DETAIL_ROW_FILL,
      borderColor: COLORS.STONE_MID,
      valueColor: CSS.TORCH_AMBER,
    }),
    addInfoRow(scene, {
      x: px + 20 + statW + statGap,
      y: statY,
      w: statW,
      h: 24,
      icon: '🕐',
      label: 'CD',
      value: `${def.attackCooldown}`,
      fillColor: DETAIL_ROW_FILL,
      borderColor: COLORS.STONE_MID,
      valueColor: CSS.PARCHMENT_DIM,
    }),
    addInfoRow(scene, {
      x: px + 20 + (statW + statGap) * 2,
      y: statY,
      w: statW,
      h: 24,
      icon: '📏',
      label: 'RNG',
      value: `${def.range}`,
      fillColor: DETAIL_ROW_FILL,
      borderColor: COLORS.STONE_MID,
      valueColor: CSS.PARCHMENT_DIM,
    }),
  ].forEach(row => addToContainer(ov, row.bg, row.iconText, row.labelText, row.valueText));

  // XP bar
  const xpBarW   = pw - 40;
  const xpBar = addProgressBar(scene, {
    x: px + 20,
    y: py + 134,
    w: xpBarW,
    h: 10,
    ratio: xpPct,
    fillColor: xpPct >= 0.82 ? 0x55d4ff : 0x44aa44,
    trackColor: 0x0a0600,
    borderColor: xpPct >= 0.82 ? 0x3b8aad : 0x335522,
    borderAlpha: 0.72,
    animate: false,
  });
  addToContainer(ov, xpBar.track, xpBar.fill);

  const xpLabel = scene.add.text(px + pw / 2, py + 139, m.level >= 50 ? 'MAX LEVEL' : `EXP ${m.xp} / ${xpNeeded}`, {
    fontFamily: 'sans-serif', fontSize: '9px', color: xpPct >= 0.82 ? '#c8f7ff' : '#88cc88',
  }).setOrigin(0.5);
  ov.add(xpLabel);

  buildGrowthCommandPanel(ctx, ov, m, tree, px + 16, py + 154, pw - 32, accentColor);

  // Skill Tree section — every monster has a tree (custom or standard fallback)
  buildSkillTreeSection(ctx, ov, m, tree, px + 12, py + 210, pw - 24);

  // Equipment section
  const eqY = py + 438;
  const eqDiv = scene.add.graphics();
  eqDiv.lineStyle(1, COLORS.STONE_MID, 0.5);
  eqDiv.lineBetween(px + 16, eqY, px + pw - 16, eqY);
  ov.add(eqDiv);

  const eqLabel = scene.add.text(px + 16, eqY + 8, '🗡️ 장비', {
    fontFamily: 'Georgia, serif', fontSize: '13px', color: CSS.TORCH_AMBER,
  });
  ov.add(eqLabel);

  buildEquipmentSlot(ctx, ov, m, px + 16, eqY + 30, pw - 32);

  // Active Skills section
  const skY = eqY + 100;
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
  const skinSectionY = skY + 88;
  const skinDiv = scene.add.graphics();
  skinDiv.lineStyle(1, COLORS.STONE_MID, 0.5);
  skinDiv.lineBetween(px + 16, skinSectionY, px + pw - 16, skinSectionY);
  ov.add(skinDiv);
  ov.add(scene.add.text(px + 16, skinSectionY + 8, '🎨 코스튬', {
    fontFamily: 'Georgia, serif', fontSize: '13px', color: CSS.TORCH_AMBER,
  }));
  buildSkinSlot(ctx, ov, m, px + 16, skinSectionY + 30, pw - 32);

  // ── Feed button ──────────────────────────────────────────────────────────
  const feedY = py + ph - 86;
  const feedAction = buildFeedTrainingAction(scene, {
    x: px + 16,
    y: feedY,
    w: pw - 32,
    h: 38,
    monster: m,
    state: loadGameState(),
    accentColor,
    onPress: () => {
      const gs3 = loadGameState();
      if (m.level >= 50) {
        feedAction.setMessage('성장 완료', '최대 레벨 수호자입니다', 'MAX', '#a8e889');
        scene.time.delayedCall(1200, feedAction.resetMessage);
        return;
      }
      const oldLevel = m.level;
      const result = feedOwnedMonster(gs3, m.id, FEED_GOLD_COST, FEED_XP_GAIN);
      if (!result.ok) {
        if (result.reason === 'insufficient_gold') {
          feedAction.setMessage('골드 부족', `${FEED_GOLD_COST}골드 필요 · 보유 ${gs3.homeGold ?? 0}`, '부족', '#ff7777');
        } else {
          feedAction.setMessage('몬스터 없음', '저장된 수호자를 찾을 수 없습니다', '오류', '#ff7777');
        }
        scene.time.delayedCall(1200, feedAction.resetMessage);
        return;
      }

      m.xp = result.monster.xp;
      m.level = result.monster.level;
      m.skillPoints = result.monster.skillPoints;
      m.spentSkills = result.monster.spentSkills;
      saveGameState(result.state);

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
        feedAction.setMessage('레벨 업!', `Lv.${m.level} 달성 · SP ${m.skillPoints ?? 0}`, 'UP', '#ffee44');
      } else {
        feedAction.setMessage('훈련 완료', `EXP +${FEED_XP_GAIN} 적용`, '완료', '#88ff88');
      }

      scene.time.delayedCall(1200, () => {
        ov.destroy();
        onRefresh(result.monster);
      });
    },
  });
  addToContainer(ov, ...feedAction.objects);

  // Bottom action buttons
  if (ctx.onReturnToRoom) {
    const returnButton = addPrimaryActionButton(scene, {
      x: px + 20,
      y: py + ph - 42,
      w: 150,
      h: 32,
      label: '방으로 복귀',
      fontSize: '12px',
      fillColor: 0x0c211b,
      hoverFillColor: 0x123229,
      borderColor: 0xc8e8b0,
      hoverBorderColor: accentColor,
      textColor: '#b8fff0',
      onPress: () => { ov.destroy(); onClose(); ctx.onReturnToRoom?.(); },
    });
    addToContainer(ov, returnButton.bg, returnButton.text, returnButton.zone);
  }

  const closeX = ctx.onReturnToRoom ? px + 190 : px + 96;
  const closeW = ctx.onReturnToRoom ? 150 : pw - 192;
  const closeButton = addPrimaryActionButton(scene, {
    x: closeX,
    y: py + ph - 42,
    w: closeW,
    h: 32,
    label: '닫기  ✕',
    fontSize: '12px',
    fillColor: 0x17100a,
    hoverFillColor: 0x24170b,
    borderColor: COLORS.STONE_MID,
    hoverBorderColor: accentColor,
    textColor: CSS.PARCHMENT_MUTED,
    onPress: () => { ov.destroy(); onClose(); },
  });
  addToContainer(ov, closeButton.bg, closeButton.text, closeButton.zone);

  // Entry animation
  ov.setAlpha(0).setScale(0.92);
  scene.tweens.add({
    targets: ov, alpha: 1, scaleX: 1, scaleY: 1,
    duration: 250, ease: 'Back.easeOut',
  });

  return ov;
}

function getDetailCollectionMeta(monster: OwnedMonster, def: MonsterDef): {
  indexLabel: string;
  tier: RarityId;
  rank: number;
  label: string;
  stars: string;
  color: number;
  css: string;
  tribeLabel: string;
  elementLabel: string;
  elementIcon: string;
  elementColor: number;
} {
  const allIds = Object.keys(MONSTER_DEFS);
  const index = Math.max(0, allIds.indexOf(def.id));
  const tier = def.rarityTier ?? DETAIL_OWNED_RARITY_TO_TIER[monster.rarity ?? 0] ?? 'C';
  const rarity = DETAIL_RARITY_META[tier];
  const element = def.element ? DETAIL_ELEMENT_META[def.element] : null;
  return {
    indexLabel:   `No.${String(index + 1).padStart(3, '0')}`,
    tier,
    rank:         rarity.rank,
    label:        rarity.label,
    stars:        rarity.stars,
    color:        rarity.color,
    css:          rarity.css,
    tribeLabel:   def.tribe ? DETAIL_TRIBE_LABELS[def.tribe] ?? '수호' : '수호',
    elementLabel: element?.label ?? '무속',
    elementIcon:  element?.icon ?? '◆',
    elementColor: element?.color ?? COLORS.TORCH_AMBER,
  };
}

function drawHeroCollectionBadges(
  scene: Phaser.Scene,
  ov: Phaser.GameObjects.Container,
  x: number,
  y: number,
  meta: ReturnType<typeof getDetailCollectionMeta>,
  xpPct: number,
  skillPoints: number,
  hasEquipment: boolean,
): void {
  const badge = scene.add.graphics();
  const portraitX = x + 35;
  const portraitY = y + 32;
  const isLevelReady = xpPct >= 0.82;
  const statusColor = skillPoints > 0 ? 0xc978ff : isLevelReady ? 0x55d4ff : hasEquipment ? meta.color : 0xffb45f;

  badge.fillStyle(meta.color, meta.rank >= 3 ? 0.11 : 0.075);
  badge.fillCircle(portraitX, portraitY, 39);
  badge.lineStyle(meta.rank >= 3 ? 1.6 : 1.1, meta.color, meta.rank >= 3 ? 0.58 : 0.38);
  badge.strokeCircle(portraitX, portraitY, 36);
  badge.lineStyle(1, meta.elementColor, 0.28);
  badge.strokeCircle(portraitX, portraitY, 28);
  badge.fillStyle(0x050302, 0.38);
  badge.fillEllipse(portraitX, portraitY + 30, 70, 12);

  badge.lineStyle(1.6, statusColor, skillPoints > 0 || isLevelReady ? 0.72 : 0.34);
  badge.beginPath();
  badge.arc(
    portraitX,
    portraitY,
    41,
    Phaser.Math.DegToRad(-90),
    Phaser.Math.DegToRad(-90 + 360 * Phaser.Math.Clamp(xpPct, 0, 1)),
  );
  badge.strokePath();

  badge.fillStyle(0x070503, 0.62);
  badge.fillRoundedRect(x + 5, y + 5, 42, 14, 5);
  badge.lineStyle(1, meta.color, 0.46);
  badge.strokeRoundedRect(x + 5, y + 5, 42, 14, 5);
  badge.fillStyle(meta.color, 0.22);
  badge.fillRoundedRect(x + 49, y + 5, 17, 14, 5);
  badge.lineStyle(1, meta.color, 0.72);
  badge.strokeRoundedRect(x + 49, y + 5, 17, 14, 5);
  badge.fillStyle(0x070503, 0.58);
  badge.fillRoundedRect(x + 9, y + 48, 52, 15, 6);
  badge.lineStyle(1, meta.elementColor, 0.42);
  badge.strokeRoundedRect(x + 9, y + 48, 52, 15, 6);
  badge.fillStyle(0x070503, 0.86);
  badge.fillRoundedRect(x + 60, y + 24, 24, 17, 6);
  badge.lineStyle(1, statusColor, 0.62);
  badge.strokeRoundedRect(x + 60, y + 24, 24, 17, 6);
  badge.fillStyle(statusColor, 0.16);
  badge.fillCircle(x + 72, y + 32.5, 6);
  if (!hasEquipment) {
    badge.fillStyle(0xffb45f, 0.16);
    badge.fillRoundedRect(x + 63, y + 45, 18, 12, 4);
    badge.lineStyle(1, 0xffb45f, 0.42);
    badge.strokeRoundedRect(x + 63, y + 45, 18, 12, 4);
  }
  ov.add(badge);

  ov.add(scene.add.text(x + 26, y + 12, meta.indexLabel, {
    fontFamily: 'monospace',
    fontSize: '7px',
    color: '#e6e4d6',
  }).setOrigin(0.5));
  ov.add(scene.add.text(x + 57.5, y + 12, meta.tier, {
    fontFamily: 'Georgia, serif',
    fontSize: '9px',
    fontStyle: 'bold',
    color: meta.css,
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
    color: skillPoints > 0 ? '#e9c4ff' : isLevelReady ? '#d7f7ff' : meta.css,
  }).setOrigin(0.5));
  if (!hasEquipment) {
    ov.add(scene.add.text(x + 72, y + 51, 'EQ', {
      fontFamily: 'sans-serif',
      fontSize: '7px',
      fontStyle: 'bold',
      color: '#ffd0a0',
    }).setOrigin(0.5));
  }
}

// ─── Growth Command Panel ─────────────────────────────────────────────────────

function buildGrowthCommandPanel(
  ctx: MonsterDetailContext,
  ov: Phaser.GameObjects.Container,
  m: OwnedMonster,
  tree: SkillTree | undefined,
  x: number, y: number, w: number,
  accentColor: number,
): void {
  const scene = ctx.scene;
  const gs = loadGameState();
  const xpNeeded = xpToNextLevel(m.level);
  const xpPct = m.level >= 50 ? 1 : Math.min(1, m.xp / xpNeeded);
  const directive = getGrowthDirective(m, tree, gs, xpPct);
  const equippedSkills = m.equippedSkills ?? [];
  const eq = m.equipment ? getEquipmentDisplay(gs, m.equipment) : null;

  const bg = scene.add.graphics();
  bg.fillStyle(0x0b1412, 0.94);
  bg.fillRoundedRect(x, y, w, 48, 8);
  bg.fillStyle(directive.accent, 0.14);
  bg.fillRoundedRect(x + 4, y + 4, 82, 40, 7);
  bg.lineStyle(1.5, directive.accent, 0.64);
  bg.strokeRoundedRect(x, y, w, 48, 8);
  bg.lineStyle(1, accentColor, 0.16);
  bg.lineBetween(x + 96, y + 8, x + 96, y + 40);
  ov.add(bg);

  ov.add(scene.add.text(x + 14, y + 13, '성장 루트', {
    fontFamily: 'sans-serif',
    fontSize: '10px',
    fontStyle: 'bold',
    color: '#9ee8cc',
  }).setOrigin(0, 0.5));
  ov.add(scene.add.text(x + 14, y + 31, `${Math.round(xpPct * 100)}% EXP`, {
    fontFamily: 'sans-serif',
    fontSize: '12px',
    fontStyle: 'bold',
    color: '#e9ffd8',
  }).setOrigin(0, 0.5));

  ov.add(scene.add.text(x + 108, y + 14, directive.title, {
    fontFamily: 'Georgia, serif',
    fontSize: '13px',
    fontStyle: 'bold',
    color: CSS.PARCHMENT,
  }).setOrigin(0, 0.5));
  ov.add(scene.add.text(x + 108, y + 32, directive.body, {
    fontFamily: 'sans-serif',
    fontSize: '9px',
    color: CSS.PARCHMENT_DIM,
    wordWrap: { width: 124, useAdvancedWrap: true },
  }).setOrigin(0, 0.5));

  addGrowthPill(scene, ov, x + w - 84, y + 7, 72, 'SP', String(m.skillPoints ?? 0), (m.skillPoints ?? 0) > 0 ? 0xc978ff : 0x53606a);
  addGrowthPill(scene, ov, x + w - 84, y + 27, 72, '장비', eq ? eq.icon : '미장착', eq ? COLORS.TORCH_AMBER : 0x7a5a38);

  const skillSlotLabel = `${equippedSkills.length}/2 스킬`;
  ov.add(scene.add.text(x + w - 95, y + 39, skillSlotLabel, {
    fontFamily: 'sans-serif',
    fontSize: '9px',
    color: equippedSkills.length >= 2 ? '#a8e889' : '#caa980',
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
  bg.fillStyle(0x17100a, 0.94);
  bg.fillRoundedRect(x, y, w, 16, 5);
  bg.lineStyle(1, accent, 0.42);
  bg.strokeRoundedRect(x, y, w, 16, 5);
  ov.add(bg);

  ov.add(scene.add.text(x + 6, y + 8, label, {
    fontFamily: 'sans-serif',
    fontSize: '8px',
    color: CSS.PARCHMENT_MUTED,
  }).setOrigin(0, 0.5));
  ov.add(scene.add.text(x + w - 6, y + 8, value, {
    fontFamily: 'sans-serif',
    fontSize: '9px',
    fontStyle: 'bold',
    color: `#${accent.toString(16).padStart(6, '0')}`,
  }).setOrigin(1, 0.5));
}

function getGrowthDirective(
  m: OwnedMonster,
  tree: SkillTree | undefined,
  gs: GameState,
  xpPct: number,
): GrowthDirective {
  const nextNode = tree?.nodes.find(node => {
    const spent = (m.spentSkills[node.id] ?? 0) >= 1;
    const prereqMet = !node.requires || (m.spentSkills[node.requires] ?? 0) >= 1;
    return !spent && prereqMet && m.skillPoints >= node.cost;
  });
  if (nextNode) {
    return {
      title: '스킬 성장이 가능',
      body: `${nextNode.icon} ${nextNode.name} 노드를 열어 전투 역할을 강화하세요.`,
      accent: 0xc978ff,
    };
  }
  if (xpPct >= 0.78 && m.level < 50) {
    return {
      title: '레벨업 임박',
      body: '먹이로 경험치를 채우면 다음 던전 방 주력으로 쓰기 좋습니다.',
      accent: 0x55d4ff,
    };
  }
  if (!m.equipment && getEquipmentInventoryIds(gs).length > 0) {
    return {
      title: '장비 장착 추천',
      body: '보유 장비를 장착하면 방어선 전투력이 바로 올라갑니다.',
      accent: COLORS.TORCH_AMBER,
    };
  }
  if ((m.equippedSkills ?? []).length < 2 && (gs.ownedActiveSkills ?? []).length > 0) {
    return {
      title: '액티브 스킬 장착',
      body: '빈 스킬 슬롯을 눌러 웨이브 대응 옵션을 채우세요.',
      accent: 0x8aa7ff,
    };
  }
  return {
    title: '던전 배치 준비',
    body: '성장 상태가 안정적입니다. 전투실에 배치해 방어선을 강화하세요.',
    accent: 0x8bbf6a,
  };
}

// ─── Feed Training CTA ───────────────────────────────────────────────────────

interface FeedTrainingActionOptions {
  x: number;
  y: number;
  w: number;
  h: number;
  monster: OwnedMonster;
  state: GameState;
  accentColor: number;
  onPress: () => void;
}

function buildFeedTrainingAction(
  scene: Phaser.Scene,
  options: FeedTrainingActionOptions,
): {
  objects: Phaser.GameObjects.GameObject[];
  setMessage: (title: string, sub: string, chip: string, color: string) => void;
  resetMessage: () => void;
} {
  const { x, y, w, h, monster, state, accentColor, onPress } = options;
  const preview = getFeedTrainingPreview(monster, state);
  const fillColor = preview.maxLevel ? 0x172112 : preview.canAfford ? 0x3a2200 : 0x21120f;
  const borderColor = preview.maxLevel ? 0x8bbf6a : preview.canAfford ? COLORS.TORCH_AMBER : 0xaa514d;
  const chipColor = preview.maxLevel ? 0x8bbf6a : preview.willLevelUp ? 0xffdf64 : preview.canAfford ? 0xffb45f : 0xaa514d;
  const defaultTitle = preview.title;
  const defaultSub = preview.sub;
  const defaultChip = preview.chip;
  const defaultTitleColor = preview.maxLevel ? '#c9f0a8' : preview.canAfford ? '#ffe0a3' : '#ffb0a6';
  const defaultChipColor = `#${chipColor.toString(16).padStart(6, '0')}`;

  const bg = scene.add.graphics();
  bg.fillStyle(0x070503, 0.42);
  bg.fillRoundedRect(x + 2, y + 3, w - 4, h, 9);
  bg.fillStyle(fillColor, 0.98);
  bg.fillRoundedRect(x, y, w, h, 9);
  bg.fillStyle(chipColor, preview.canAfford || preview.maxLevel ? 0.17 : 0.08);
  bg.fillRoundedRect(x + 7, y + 6, 36, h - 12, 8);
  bg.fillStyle(accentColor, 0.08);
  bg.fillRoundedRect(x + 48, y + 6, w - 148, h - 12, 7);
  bg.lineStyle(1.5, borderColor, preview.canAfford || preview.maxLevel ? 0.86 : 0.62);
  bg.strokeRoundedRect(x, y, w, h, 9);
  bg.lineStyle(1, 0xffffff, 0.12);
  bg.lineBetween(x + 53, y + 8, x + 53, y + h - 8);

  const trackX = x + w - 96;
  const trackY = y + h - 8;
  const trackW = 74;
  bg.fillStyle(0x120a05, 0.82);
  bg.fillRoundedRect(trackX, trackY, trackW, 3, 2);
  bg.fillStyle(0x5f3b14, 0.9);
  bg.fillRoundedRect(trackX, trackY, Math.max(3, Math.round(trackW * preview.currentPct)), 3, 2);
  if (preview.nextPct > preview.currentPct) {
    bg.fillStyle(chipColor, 0.95);
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
    fontFamily: 'Georgia, serif',
    fontSize: '12px',
    fontStyle: 'bold',
    color: defaultTitleColor,
  }).setOrigin(0, 0.5);
  const subText = scene.add.text(x + 60, y + 27, defaultSub, {
    fontFamily: 'sans-serif',
    fontSize: '9px',
    color: preview.canAfford || preview.maxLevel ? CSS.PARCHMENT_DIM : '#d98880',
  }).setOrigin(0, 0.5);

  bg.fillStyle(0x070b08, 0.82);
  bg.fillRoundedRect(x + w - 90, y + 7, 76, 19, 7);
  bg.lineStyle(1, chipColor, 0.58);
  bg.strokeRoundedRect(x + w - 90, y + 7, 76, 19, 7);
  const chipText = scene.add.text(x + w - 52, y + 16.5, defaultChip, {
    fontFamily: 'sans-serif',
    fontSize: '10px',
    fontStyle: 'bold',
    color: defaultChipColor,
  }).setOrigin(0.5);
  const arrowText = scene.add.text(x + w - 11, y + h / 2, '▶', {
    fontFamily: 'sans-serif',
    fontSize: '9px',
    color: preview.canAfford ? '#ffd878' : '#806b57',
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

function getFeedTrainingPreview(
  monster: OwnedMonster,
  state: GameState,
): {
  title: string;
  sub: string;
  chip: string;
  currentPct: number;
  nextPct: number;
  canAfford: boolean;
  willLevelUp: boolean;
  maxLevel: boolean;
} {
  const maxLevel = monster.level >= 50;
  const xpNeeded = xpToNextLevel(monster.level);
  const currentPct = maxLevel ? 1 : Math.min(1, monster.xp / xpNeeded);
  const nextXp = monster.xp + FEED_XP_GAIN;
  const willLevelUp = !maxLevel && nextXp >= xpNeeded;
  const nextPct = maxLevel ? 1 : willLevelUp ? 1 : Math.min(1, nextXp / xpNeeded);
  const canAfford = (state.homeGold ?? 0) >= FEED_GOLD_COST;
  if (maxLevel) {
    return {
      title: '성장 완료',
      sub: '장비와 배치로 전력 보강',
      chip: 'MAX',
      currentPct,
      nextPct,
      canAfford,
      willLevelUp: false,
      maxLevel,
    };
  }
  if (!canAfford) {
    return {
      title: '먹이 부족',
      sub: `${FEED_GOLD_COST}골드 필요 · 보유 ${state.homeGold ?? 0}`,
      chip: '부족',
      currentPct,
      nextPct: currentPct,
      canAfford,
      willLevelUp,
      maxLevel,
    };
  }
  return {
    title: willLevelUp ? '레벨업 훈련' : '먹이 주기',
    sub: `${FEED_GOLD_COST}골드 · EXP +${FEED_XP_GAIN}`,
    chip: willLevelUp ? 'Lv UP' : `${Math.round(nextPct * 100)}%`,
    currentPct,
    nextPct,
    canAfford,
    willLevelUp,
    maxLevel,
  };
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
  const branchAccents: Record<'A' | 'B' | 'C', number> = {
    A: 0xff9354,
    B: 0x8aa7ff,
    C: 0x89e06f,
  };

  branches.forEach((branch, bi) => {
    const bx = x + bi * colW;
    const branchNodes = tree.nodes.filter(n => n.branch === branch).sort((a, b) => a.tier - b.tier);
    const branchAccent = branchAccents[branch];

    const lane = scene.add.graphics();
    lane.fillStyle(branchAccent, 0.10);
    lane.fillRoundedRect(bx + 8, y + 11, colW - 16, 20, 7);
    lane.lineStyle(1, branchAccent, 0.36);
    lane.strokeRoundedRect(bx + 8, y + 11, colW - 16, 20, 7);
    lane.lineStyle(1.5, branchAccent, 0.20);
    lane.lineBetween(bx + colW / 2, y + 34, bx + colW / 2, y + 198);
    ov.add(lane);

    const bnT = scene.add.text(bx + colW / 2, y + 20, tree.branchNames[branch], {
      fontFamily: 'sans-serif',
      fontSize: '11px',
      fontStyle: 'bold',
      color: `#${branchAccent.toString(16).padStart(6, '0')}`,
    }).setOrigin(0.5);
    ov.add(bnT);

    branchNodes.forEach((node, ni) => {
      const ny = y + 38 + ni * 58;
      const nx = bx + colW / 2;
      const spent = (m.spentSkills[node.id] ?? 0) >= 1;
      const prereqMet = !node.requires || (m.spentSkills[node.requires] ?? 0) >= 1;
      const canAfford = m.skillPoints >= node.cost;
      const canUnlock = !spent && prereqMet && canAfford;
      const stateAccent = spent ? 0x5cff7a : canUnlock ? 0xffd878 : prereqMet ? branchAccent : 0x4a4a4a;
      const stateFill = spent ? 0x16321b : canUnlock ? 0x2b1c08 : prereqMet ? 0x17172a : 0x0d0d0d;
      const stateLabel = spent ? '습득' : canUnlock ? '해금' : prereqMet ? `${node.cost}SP` : '잠김';
      const nodeW = 82;
      const nodeH = 52;

      const nodeBg = scene.add.graphics();
      nodeBg.fillStyle(0x070503, 0.38);
      nodeBg.fillRoundedRect(nx - nodeW / 2 + 2, ny + 3, nodeW, nodeH, 8);
      nodeBg.fillStyle(stateFill, 0.98);
      nodeBg.fillRoundedRect(nx - nodeW / 2, ny, nodeW, nodeH, 8);
      nodeBg.fillStyle(stateAccent, spent || canUnlock ? 0.17 : prereqMet ? 0.08 : 0.03);
      nodeBg.fillRoundedRect(nx - nodeW / 2 + 5, ny + 5, 30, 28, 7);
      nodeBg.fillStyle(0xffffff, spent || canUnlock ? 0.13 : 0.05);
      nodeBg.fillRoundedRect(nx - nodeW / 2 + 9, ny + 8, 22, 4, 3);
      nodeBg.lineStyle(spent || canUnlock ? 2 : 1.5, stateAccent, spent || canUnlock ? 0.92 : 0.58);
      nodeBg.strokeRoundedRect(nx - nodeW / 2, ny, nodeW, nodeH, 8);
      nodeBg.lineStyle(1, 0xffffff, spent || canUnlock ? 0.14 : 0.05);
      nodeBg.lineBetween(nx - 4, ny + 8, nx - 4, ny + nodeH - 8);
      ov.add(nodeBg);

      ov.add(scene.add.text(nx - nodeW / 2 + 20, ny + 21, node.icon, {
        fontFamily: 'sans-serif',
        fontSize: '17px',
      }).setOrigin(0.5));
      ov.add(scene.add.text(nx - nodeW / 2 + 8, ny + 7, `T${node.tier}`, {
        fontFamily: 'monospace',
        fontSize: '7px',
        color: spent || canUnlock ? '#ffffff' : '#8f8f8f',
        fontStyle: 'bold',
      }).setOrigin(0, 0.5));

      ov.add(scene.add.text(nx + 2, ny + 17, shortenLabel(node.name, 5), {
        fontFamily: 'sans-serif',
        fontSize: '10px',
        fontStyle: 'bold',
        color: spent ? '#b9ffbf' : canUnlock ? '#ffe2a3' : prereqMet ? CSS.PARCHMENT_DIM : '#666666',
      }).setOrigin(0, 0.5));

      ov.add(scene.add.text(nx + 2, ny + 36, stateLabel, {
        fontFamily: 'sans-serif',
        fontSize: '9px',
        fontStyle: spent || canUnlock ? 'bold' : 'normal',
        color: spent ? '#5cff7a' : canUnlock ? '#ffd878' : prereqMet ? '#caa7ff' : '#707070',
      }).setOrigin(0, 0.5));
      if (canUnlock) {
        ov.add(scene.add.text(nx + nodeW / 2 - 7, ny + 8, '!', {
          fontFamily: 'sans-serif',
          fontSize: '10px',
          color: '#191006',
          fontStyle: 'bold',
          backgroundColor: '#ffd878',
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

// ─── Equipment Slot ───────────────────────────────────────────────────────────

function buildEquipmentSlot(
  ctx: MonsterDetailContext,
  ov: Phaser.GameObjects.Container,
  m: OwnedMonster,
  x: number, y: number, w: number,
): void {
  const { scene } = ctx;
  const gs    = loadGameState();
  const eqId  = m.equipment;
  const eqDef = eqId ? getEquipmentDisplay(gs, eqId) : null;
  const typeMeta = getEquipmentTypeMeta(eqDef?.type);
  const inventory = getEquipmentInventoryIds(gs)
    .map(eId => getEquipmentDisplay(gs, eId))
    .filter((ed): ed is EquipmentDisplay => Boolean(ed));
  const equippedLabel = eqDef
    ? `${typeMeta.icon} ${typeMeta.label} · ${getEquipmentStars(eqDef.rarity)}`
    : '장비 슬롯 비어 있음';
  const slotAccent = eqDef ? getEquipmentRarityColor(eqDef.rarity) : 0x6a5542;
  const recommendedEquipmentId = getRecommendedEquipmentId(inventory, eqId);
  const impactLabel = eqDef ? getEquipmentImpactLabel(eqDef) : '전력 보강 대기';

  const leftW = 154;
  const rightX = x + leftW + 8;
  const rightW = w - leftW - 8;

  const slotBg = scene.add.graphics();
  slotBg.fillStyle(eqDef ? 0x182012 : 0x10100d, 0.98);
  slotBg.fillRoundedRect(x, y, leftW, 68, 9);
  slotBg.fillStyle(slotAccent, eqDef ? 0.18 : 0.08);
  slotBg.fillRoundedRect(x + 6, y + 6, 46, 56, 8);
  slotBg.fillStyle(0xffffff, eqDef ? 0.12 : 0.05);
  slotBg.fillRoundedRect(x + 11, y + 10, 36, 5, 3);
  slotBg.lineStyle(1.5, slotAccent, eqDef ? 0.88 : 0.44);
  slotBg.strokeRoundedRect(x, y, leftW, 68, 9);
  slotBg.lineStyle(1, 0xffffff, eqDef ? 0.12 : 0.05);
  slotBg.lineBetween(x + 58, y + 10, x + 58, y + 58);
  slotBg.fillStyle(eqDef ? slotAccent : 0x5e4a35, eqDef ? 0.24 : 0.14);
  slotBg.fillRoundedRect(x + 64, y + 48, 74, 13, 5);
  ov.add(slotBg);

  ov.add(scene.add.text(x + 29, y + 24, eqDef ? eqDef.icon : '◇', {
    fontFamily: 'sans-serif',
    fontSize: eqDef ? '24px' : '22px',
    color: eqDef ? '#ffffff' : '#7f6750',
  }).setOrigin(0.5));
  ov.add(scene.add.text(x + 29, y + 48, eqDef ? getEquipmentStars(eqDef.rarity) : 'EMPTY', {
    fontFamily: 'sans-serif',
    fontSize: '8px',
    color: eqDef ? `#${slotAccent.toString(16).padStart(6, '0')}` : '#7f6750',
    fontStyle: 'bold',
  }).setOrigin(0.5));

  ov.add(scene.add.text(x + 66, y + 11, equippedLabel, {
    fontFamily: 'sans-serif',
    fontSize: '8px',
    color: eqDef ? typeMeta.css : '#9a7b5a',
    fontStyle: 'bold',
  }).setOrigin(0, 0.5));
  ov.add(scene.add.text(x + 66, y + 29, eqDef ? shortenLabel(eqDef.name, 8) : '장비 미장착', {
    fontFamily: 'Georgia, serif',
    fontSize: '13px',
    color: eqDef ? CSS.PARCHMENT : '#8a7358',
    fontStyle: 'bold',
  }).setOrigin(0, 0.5));
  ov.add(scene.add.text(x + 66, y + 44, eqDef ? shortenLabel(eqDef.desc, 13) : '보관함에서 장착', {
    fontFamily: 'sans-serif',
    fontSize: '8px',
    color: eqDef ? CSS.PARCHMENT_DIM : '#765f49',
  }).setOrigin(0, 0.5));
  ov.add(scene.add.text(x + 101, y + 54.5, impactLabel, {
    fontFamily: 'sans-serif',
    fontSize: '7px',
    color: eqDef ? `#${slotAccent.toString(16).padStart(6, '0')}` : '#9a7b5a',
    fontStyle: 'bold',
  }).setOrigin(0.5));

  const invBg = scene.add.graphics();
  invBg.fillStyle(0x0c1412, 0.92);
  invBg.fillRoundedRect(rightX, y, rightW, 68, 9);
  invBg.fillStyle(0x2a1a0c, 0.38);
  invBg.fillRoundedRect(rightX + 5, y + 5, rightW - 10, 15, 6);
  invBg.lineStyle(1.2, 0x6a5032, 0.55);
  invBg.strokeRoundedRect(rightX, y, rightW, 68, 9);
  ov.add(invBg);

  ov.add(scene.add.text(rightX + 8, y + 9, `보관함 ${inventory.length}`, {
    fontFamily: 'sans-serif',
    fontSize: '9px',
    color: '#c5a273',
    fontStyle: 'bold',
  }).setOrigin(0, 0.5));
  ov.add(scene.add.text(rightX + rightW - 8, y + 9, inventory.length > 0 ? '탭 장착' : '제작 필요', {
    fontFamily: 'sans-serif',
    fontSize: '8px',
    color: inventory.length > 0 ? '#f5d08b' : '#846a4b',
    fontStyle: 'bold',
  }).setOrigin(1, 0.5));

  inventory.slice(0, 4).forEach((ed, idx) => {
    drawEquipmentMiniCard(ctx, ov, m, ed, rightX + 8 + idx * 31, y + 20, 27, eqId === ed.id, ed.id === recommendedEquipmentId);
  });
  if (inventory.length > 4) {
    ov.add(scene.add.text(rightX + rightW - 12, y + 34, `+${inventory.length - 4}`, {
      fontFamily: 'sans-serif',
      fontSize: '8px',
      color: '#c5a273',
      fontStyle: 'bold',
      backgroundColor: '#241609',
      padding: { x: 3, y: 1 },
    }).setOrigin(1, 0.5));
  }
  if (inventory.length === 0) {
    ov.add(scene.add.text(rightX + rightW / 2, y + 32, '장비 없음', {
      fontFamily: 'sans-serif',
      fontSize: '10px',
      color: '#6c5945',
    }).setOrigin(0.5));
  }

  const forgeButton = addPrimaryActionButton(scene, {
    x: rightX + 8,
    y: y + 48,
    w: rightW - 16,
    h: 18,
    label: inventory.length > 0 ? '⚒ 장비 더 제작' : '⚒ 장비 제작소',
    fontSize: '9px',
    fillColor: 0x2a1400,
    hoverFillColor: 0x3a2100,
    borderColor: 0xcc6600,
    hoverBorderColor: COLORS.TORCH_AMBER,
    textColor: '#ffaa44',
    onPress: () => {
      ov.destroy();
      if (ctx.onOpenForge) {
        ctx.onOpenForge(m);
      } else {
        scene.scene.start('ForgeScene');
      }
    },
  });
  addToContainer(ov, forgeButton.bg, forgeButton.text, forgeButton.zone);
}

function drawEquipmentMiniCard(
  ctx: MonsterDetailContext,
  ov: Phaser.GameObjects.Container,
  m: OwnedMonster,
  ed: EquipmentDisplay,
  x: number, y: number, size: number,
  equipped: boolean,
  recommended: boolean,
): void {
  const { scene, onRefresh } = ctx;
  const typeMeta = getEquipmentTypeMeta(ed.type);
  const accent = getEquipmentRarityColor(ed.rarity);
  const bg = scene.add.graphics();
  bg.fillStyle(equipped ? 0x1d2715 : recommended ? 0x211707 : 0x130d08, 0.98);
  bg.fillRoundedRect(x, y, size, size, 6);
  bg.fillStyle(typeMeta.color, equipped || recommended ? 0.20 : 0.08);
  bg.fillRoundedRect(x + 3, y + 3, size - 6, size - 6, 5);
  bg.lineStyle(equipped || recommended ? 1.5 : 1.1, equipped ? accent : recommended ? COLORS.TORCH_AMBER : typeMeta.color, equipped || recommended ? 0.92 : 0.42);
  bg.strokeRoundedRect(x, y, size, size, 6);
  ov.add(bg);

  ov.add(scene.add.text(x + size / 2, y + 10, ed.icon, {
    fontFamily: 'sans-serif',
    fontSize: '14px',
  }).setOrigin(0.5));
  ov.add(scene.add.text(x + size / 2, y + 21, equipped ? '✓' : recommended ? 'BEST' : typeMeta.icon, {
    fontFamily: 'sans-serif',
    fontSize: equipped || recommended ? '7px' : '8px',
    color: equipped ? '#b9ffbf' : recommended ? '#ffd878' : typeMeta.css,
    fontStyle: 'bold',
  }).setOrigin(0.5));

  const zone = scene.add.zone(x + size / 2, y + size / 2, Math.max(32, size), Math.max(32, size)).setInteractive({ useHandCursor: true });
  zone.on('pointerdown', () => {
    const result = equipMonsterEquipment(loadGameState(), m.id, ed.id);
    if (!result.ok) return;
    saveGameState(result.state);
    ov.destroy();
    onRefresh(result.monster);
  });
  ov.add(zone);
}

function getEquipmentDisplay(gs: GameState, equipmentId: string): EquipmentDisplay | null {
  const staticDef = EQUIPMENT_DEFS.find(e => e.id === equipmentId);
  if (staticDef) {
    return {
      id: staticDef.id,
      name: staticDef.name,
      icon: staticDef.icon,
      type: staticDef.type,
      desc: staticDef.desc,
      rarity: 0,
      crafted: false,
    };
  }

  const craftedDef = [...(gs.craftedEquipment ?? [])]
    .reverse()
    .find(equipment => equipment.id === equipmentId);
  if (!craftedDef) return null;

  return {
    id: craftedDef.id,
    name: craftedDef.name,
    icon: craftedDef.emoji,
    type: craftedDef.type,
    desc: formatCraftedStatLine(craftedDef.stats),
    rarity: craftedDef.rarity,
    crafted: true,
  };
}

function getEquipmentInventoryIds(gs: GameState): string[] {
  return Array.from(new Set([
    ...(gs.ownedEquipment ?? []),
    ...(gs.craftedEquipment ?? []).map(equipment => equipment.id),
  ]));
}

function getEquipmentTypeMeta(type: string | undefined): { label: string; icon: string; color: number; css: string } {
  return DETAIL_EQUIPMENT_TYPE_META[type ?? ''] ?? { label: '장비', icon: '◇', color: 0xb99262, css: '#d6b783' };
}

function getEquipmentStars(rarity: number): string {
  const index = Phaser.Math.Clamp(Math.floor(rarity), 0, DETAIL_EQUIPMENT_STARS.length - 1);
  return DETAIL_EQUIPMENT_STARS[index];
}

function getEquipmentRarityColor(rarity: number): number {
  const palette = [0xb99262, 0x76d17a, 0x62a8ff, 0xc978ff, 0xffc857, 0xff8f5f];
  const index = Phaser.Math.Clamp(Math.floor(rarity), 0, palette.length - 1);
  return palette[index];
}

function getRecommendedEquipmentId(inventory: EquipmentDisplay[], equippedId: string | null): string | null {
  const candidates = inventory
    .filter(ed => ed.id !== equippedId)
    .sort((a, b) => {
      if (b.rarity !== a.rarity) return b.rarity - a.rarity;
      if (Number(b.crafted) !== Number(a.crafted)) return Number(b.crafted) - Number(a.crafted);
      return a.name.localeCompare(b.name);
    });
  return candidates[0]?.id ?? null;
}

function getEquipmentImpactLabel(ed: EquipmentDisplay): string {
  const prefix = ed.crafted ? `제작 R${Math.max(1, ed.rarity + 1)}` : '기본';
  if (ed.type === 'weapon') return `${prefix} · 공격 보정`;
  if (ed.type === 'armor') return `${prefix} · 방 보강`;
  if (ed.type === 'accessory') return `${prefix} · 운영 보조`;
  return `${prefix} · 전력 보강`;
}

function shortenLabel(label: string, max: number): string {
  return label.length > max ? `${label.slice(0, Math.max(1, max - 1))}…` : label;
}

function formatCraftedStatLine(stats: Record<string, number>): string {
  const labels: Record<string, string> = {
    atkBonus: 'ATK',
    stunDuration: '기절',
    roomHPBonus: '방 HP',
    goldBonus: '골드',
    skillCooldown: '스킬 쿨타임',
  };
  const parts = Object.entries(stats).map(([key, value]) => {
    const label = labels[key] ?? key;
    const amount = Math.abs(value) > 0 && Math.abs(value) < 1
      ? `${value > 0 ? '+' : ''}${Math.round(value * 100)}%`
      : `${value > 0 ? '+' : ''}${value}`;
    return `${label} ${amount}`;
  });
  return parts.length > 0 ? parts.join(' · ') : '제작 장비';
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
  const ownedSkillCount = (gs.ownedActiveSkills ?? []).length;
  const hasOwnedSkills = ownedSkillCount > 0;
  const slots = [0, 1];
  slots.forEach(si => {
    const slotW = w / 2 - 4;
    const sx   = x + si * (w / 2 + 4);
    const skId = (m.equippedSkills ?? [])[si];
    const sk   = skId ? ACTIVE_SKILLS.find(s => s.id === skId) : null;
    const accent = sk ? SHOP_PURPLE : hasOwnedSkills ? 0x8aa7ff : 0x5e5144;
    const label = sk ? sk.name : '장착 대기';
    const subLabel = sk
      ? `쿨다운 ${sk.cooldown}s`
      : hasOwnedSkills
        ? `보유 ${ownedSkillCount} 스킬`
        : '상점 필요';

    const bg = scene.add.graphics();
    bg.fillStyle(sk ? 0x190b24 : 0x101617, 0.98);
    bg.fillRoundedRect(sx, y, slotW, 50, 8);
    bg.fillStyle(accent, sk ? 0.18 : 0.10);
    bg.fillRoundedRect(sx + 7, y + 7, 36, 36, 8);
    bg.fillStyle(0xffffff, sk ? 0.13 : 0.06);
    bg.fillRoundedRect(sx + 12, y + 11, 26, 4, 3);
    bg.lineStyle(1.5, accent, sk ? 0.88 : 0.52);
    bg.strokeRoundedRect(sx, y, slotW, 50, 8);
    bg.lineStyle(1, 0xffffff, sk ? 0.14 : 0.06);
    bg.lineBetween(sx + 49, y + 9, sx + 49, y + 41);
    ov.add(bg);

    ov.add(scene.add.text(sx + 25, y + 25, sk ? sk.icon : '+', {
      fontFamily: 'sans-serif',
      fontSize: sk ? '21px' : '24px',
      color: sk ? '#ffffff' : '#9fb4ff',
      fontStyle: 'bold',
    }).setOrigin(0.5));

    ov.add(scene.add.text(sx + 57, y + 16, label, {
      fontFamily: sk ? 'Georgia, serif' : 'sans-serif',
      fontSize: '12px',
      fontStyle: 'bold',
      color: sk ? '#edd1ff' : hasOwnedSkills ? '#d5dcff' : '#81766d',
    }).setOrigin(0, 0.5));
    ov.add(scene.add.text(sx + 57, y + 33, subLabel, {
      fontFamily: 'sans-serif',
      fontSize: '10px',
      color: sk ? '#b8a0c8' : hasOwnedSkills ? '#9aaeff' : '#6a5b4c',
    }).setOrigin(0, 0.5));
    ov.add(scene.add.text(sx + slotW - 9, y + 10, `S${si + 1}`, {
      fontFamily: 'monospace',
      fontSize: '8px',
      color: sk ? '#efccff' : '#6f7c8c',
      fontStyle: 'bold',
    }).setOrigin(1, 0.5));

    // Tap to cycle through owned skills
    const zone  = scene.add.zone(sx + slotW / 2, y + 25, slotW, 50).setInteractive({ useHandCursor: true });
    zone.on('pointerdown', () => {
      const result = cycleMonsterActiveSkillSlot(loadGameState(), m.id, si);
      if (!result.ok) return;
      saveGameState(result.state);
      ov.destroy();
      onRefresh(result.monster);
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
  const { scene } = ctx;
  const gs      = loadGameState();
  const typeId  = Object.keys(MONSTER_DEFS).find(k => m.id === k || m.id.startsWith(k + '_')) ?? m.id;
  const allSkins = getSkinsForMonster(typeId);
  const ownedSkinIds = gs.ownedSkins?.[typeId] ?? [];
  const owned   = allSkins.filter(
    s => ownedSkinIds.includes(s.id),
  );
  const locked = allSkins.filter(s => !ownedSkinIds.includes(s.id));
  const equipped = gs.equippedSkins?.[typeId];
  const def = MONSTER_DEFS[typeId as keyof typeof MONSTER_DEFS];

  const baseW = 72;
  const galleryX = x + baseW + 8;
  const galleryW = w - baseW - 8;
  drawSkinDisplayCard(ctx, ov, m, typeId, x, y, baseW, null, !equipped, def?.emoji ?? '?', '기본');

  const gallery = scene.add.graphics();
  gallery.fillStyle(0x0b1218, 0.96);
  gallery.fillRoundedRect(galleryX, y, galleryW, 56, 8);
  gallery.fillStyle(0x8aa7ff, 0.08);
  gallery.fillRoundedRect(galleryX + 6, y + 7, galleryW - 12, 16, 6);
  gallery.lineStyle(1.2, 0x8aa7ff, 0.46);
  gallery.strokeRoundedRect(galleryX, y, galleryW, 56, 8);
  ov.add(gallery);

  ov.add(scene.add.text(galleryX + 10, y + 15, `스킨 도감 ${owned.length}/${allSkins.length}`, {
    fontFamily: 'sans-serif',
    fontSize: '10px',
    fontStyle: 'bold',
    color: '#d5dcff',
  }).setOrigin(0, 0.5));
  ov.add(scene.add.text(galleryX + galleryW - 10, y + 15, locked.length > 0 ? `잠금 ${locked.length}` : '완성', {
    fontFamily: 'monospace',
    fontSize: '9px',
    fontStyle: 'bold',
    color: locked.length > 0 ? '#a8b5d9' : '#91f0ad',
  }).setOrigin(1, 0.5));

  if (allSkins.length === 0) {
    ov.add(scene.add.text(galleryX + galleryW / 2, y + 37, '이 몬스터의 스킨은 아직 없습니다', {
      fontFamily: 'sans-serif',
      fontSize: '10px',
      color: '#7b849b',
    }).setOrigin(0.5));
    return;
  }

  const miniSize = 28;
  const miniGap = 6;
  [...owned, ...locked].slice(0, 5).forEach((skin, i) => {
    const sx = galleryX + 10 + i * (miniSize + miniGap);
    const isOwned = ownedSkinIds.includes(skin.id);
    const isActive = equipped === skin.id;
    drawSkinMiniCard(ctx, ov, m, sx, y + 25, miniSize, skin, isOwned, isActive);
  });

  const nextLocked = locked[0];
  if (nextLocked) {
    const nextVia = nextLocked.unlockVia === 'quest' && nextLocked.unlockRef
      ? `퀘스트 ${getQuest(nextLocked.unlockRef)?.title ?? nextLocked.unlockRef}`
      : `상점 ${nextLocked.gemCost}💎`;
    ov.add(scene.add.text(galleryX + galleryW - 10, y + 39, shortenLabel(nextVia, 12), {
      fontFamily: 'sans-serif',
      fontSize: '9px',
      color: '#8793b2',
    }).setOrigin(1, 0.5));
  }
}

function drawSkinDisplayCard(
  ctx: MonsterDetailContext,
  ov: Phaser.GameObjects.Container,
  m: OwnedMonster,
  typeId: string,
  x: number,
  y: number,
  w: number,
  skin: MonsterSkin | null,
  active: boolean,
  fallbackEmoji: string,
  fallbackLabel: string,
): void {
  const { scene, onRefresh } = ctx;
  const accent = skin ? getSkinRarityColor(skin) : COLORS.TORCH_GOLD;
  const bg = scene.add.graphics();
  bg.fillStyle(active ? 0x2a1800 : 0x111111, 1);
  bg.fillRoundedRect(x, y, w, 56, 7);
  bg.fillStyle(accent, active ? 0.18 : 0.08);
  bg.fillRoundedRect(x + 7, y + 7, w - 14, 30, 7);
  bg.lineStyle(1.5, active ? accent : 0x333333, active ? 1 : 0.55);
  bg.strokeRoundedRect(x, y, w, 56, 7);
  ov.add(bg);

  ov.add(scene.add.text(x + w / 2, y + 21, skin ? skin.emoji : fallbackEmoji, {
    fontFamily: 'sans-serif',
    fontSize: skin ? '18px' : '20px',
  }).setOrigin(0.5));
  ov.add(scene.add.text(x + w / 2, y + 44, skin ? shortenLabel(skin.name, 4) : fallbackLabel, {
    fontFamily: 'sans-serif',
    fontSize: '10px',
    fontStyle: 'bold',
    color: active ? `#${accent.toString(16).padStart(6, '0')}` : CSS.PARCHMENT_MUTED,
  }).setOrigin(0.5));

  const zone = scene.add.zone(x + w / 2, y + 28, w, 56).setInteractive({ useHandCursor: true });
  zone.on('pointerdown', () => {
    const state = loadGameState();
    const result = skin ? equipSkin(state, skin.monsterId, skin.id) : unequipSkin(state, typeId);
    if (result.ok && result.changed) saveGameState(result.state);
    ov.destroy();
    onRefresh(m);
  });
  ov.add(zone);
}

function drawSkinMiniCard(
  ctx: MonsterDetailContext,
  ov: Phaser.GameObjects.Container,
  m: OwnedMonster,
  x: number,
  y: number,
  size: number,
  skin: MonsterSkin,
  owned: boolean,
  active: boolean,
): void {
  const { scene, onRefresh } = ctx;
  const accent = getSkinRarityColor(skin);
  const bg = scene.add.graphics();
  bg.fillStyle(active ? 0x1d2715 : owned ? 0x151722 : 0x0f1014, 0.98);
  bg.fillRoundedRect(x, y, size, size, 6);
  bg.fillStyle(accent, owned ? 0.16 : 0.05);
  bg.fillRoundedRect(x + 3, y + 3, size - 6, size - 6, 5);
  bg.lineStyle(1.2, owned ? accent : 0x40465a, owned ? 0.88 : 0.48);
  bg.strokeRoundedRect(x, y, size, size, 6);
  ov.add(bg);
  ov.add(scene.add.text(x + size / 2, y + size / 2 - 1, owned ? skin.emoji : '🔒', {
    fontFamily: 'sans-serif',
    fontSize: owned ? '14px' : '12px',
    color: owned ? '#ffffff' : '#7f879d',
  }).setOrigin(0.5));
  if (skin.rarity !== 'normal') {
    ov.add(scene.add.text(x + size - 4, y + 5, skin.rarity === 'limited' ? 'L' : 'R', {
      fontFamily: 'monospace',
      fontSize: '7px',
      fontStyle: 'bold',
      color: `#${accent.toString(16).padStart(6, '0')}`,
    }).setOrigin(1, 0.5));
  }

  const zone = scene.add.zone(x + size / 2, y + size / 2, size, size).setInteractive({ useHandCursor: true });
  if (owned) {
    zone.on('pointerdown', () => {
      const result = equipSkin(loadGameState(), skin.monsterId, skin.id);
      if (result.ok && result.changed) saveGameState(result.state);
      ov.destroy();
      onRefresh(m);
    });
  } else {
    zone.on('pointerdown', () => showLockedSkinPopup(ctx, ov, m, skin));
  }
  ov.add(zone);
}

// ─── Locked Skin Purchase Popup ───────────────────────────────────────────────

function showLockedSkinPopup(
  ctx: MonsterDetailContext,
  ov: Phaser.GameObjects.Container,
  m: OwnedMonster,
  skin: MonsterSkin,
): void {
  const { scene, onRefresh } = ctx;
  scene.children.getByName('skinBuyPopup')?.destroy();

  const isQuestSkin = skin.unlockVia === 'quest';
  const popW = 250;
  const popH = isQuestSkin ? 96 : 128;
  const pop = scene.add.container(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2)
    .setName('skinBuyPopup').setDepth(220);

  const dim = scene.add.zone(0, 0, CANVAS_WIDTH * 2, CANVAS_HEIGHT * 2).setInteractive();
  dim.once('pointerdown', () => pop.destroy());
  pop.add(dim);

  const accent = getSkinRarityColor(skin);
  const bg = scene.add.graphics();
  bg.fillStyle(0x141022, 0.98);
  bg.fillRoundedRect(-popW / 2, -popH / 2, popW, popH, 10);
  bg.lineStyle(1.5, accent, 0.85);
  bg.strokeRoundedRect(-popW / 2, -popH / 2, popW, popH, 10);
  pop.add(bg);

  pop.add(scene.add.text(0, -popH / 2 + 20, `${skin.emoji} ${skin.name}`, {
    fontFamily: 'Georgia, serif', fontSize: '14px', fontStyle: 'bold',
    color: `#${accent.toString(16).padStart(6, '0')}`,
  }).setOrigin(0.5));

  if (isQuestSkin) {
    const questTitle = skin.unlockRef
      ? getQuest(skin.unlockRef)?.title ?? skin.unlockRef
      : '?';
    pop.add(scene.add.text(0, -popH / 2 + 48, `퀘스트 「${questTitle}」\n완료 시 해금됩니다`, {
      fontFamily: 'sans-serif', fontSize: '11px', color: '#e8d5aa',
      align: 'center', lineSpacing: 5,
    }).setOrigin(0.5, 0));
    return;
  }

  if (!skin.available) {
    pop.add(scene.add.text(0, -popH / 2 + 52, '기간 한정 스킨 — 현재 판매 종료', {
      fontFamily: 'sans-serif', fontSize: '11px', color: '#9aa6bb',
    }).setOrigin(0.5));
    return;
  }

  const gems = loadGameState().gems ?? 0;
  const canAfford = gems >= skin.gemCost;
  pop.add(scene.add.text(0, -popH / 2 + 44, `보유 💎 ${gems.toLocaleString()}`, {
    fontFamily: 'sans-serif', fontSize: '10px', color: '#9aa6bb',
  }).setOrigin(0.5));

  const btnW = 150;
  const btnH = 34;
  const btnY = popH / 2 - 28;
  const btn = scene.add.graphics();
  btn.fillStyle(canAfford ? 0x2c5f8a : 0x33394a, 0.96);
  btn.fillRoundedRect(-btnW / 2, btnY - btnH / 2, btnW, btnH, 8);
  btn.lineStyle(1, canAfford ? 0x55b88a : 0x555d72, 0.8);
  btn.strokeRoundedRect(-btnW / 2, btnY - btnH / 2, btnW, btnH, 8);
  pop.add(btn);
  pop.add(scene.add.text(0, btnY, canAfford ? `💎 ${skin.gemCost} 구매` : '젬 부족', {
    fontFamily: 'sans-serif', fontSize: '13px', fontStyle: 'bold',
    color: canAfford ? '#dff4ff' : '#8a8f9e',
  }).setOrigin(0.5));

  if (!canAfford) return;
  const btnZone = scene.add.zone(0, btnY, btnW + 28, btnH + 28).setInteractive({ useHandCursor: true });
  btnZone.on('pointerdown', () => {
    const result = purchaseSkin(loadGameState(), skin.monsterId, skin.id, skin.gemCost);
    if (!result.ok) {
      pop.destroy();
      return;
    }
    if (result.changed) {
      const equipped = equipSkin(result.state, skin.monsterId, skin.id);
      saveGameState(equipped.ok ? equipped.state : result.state);
    }
    pop.destroy();
    ov.destroy();
    onRefresh(m);
  });
  pop.add(btnZone);
}

function getSkinRarityColor(skin: MonsterSkin): number {
  if (skin.rarity === 'limited') return 0xffc857;
  if (skin.rarity === 'rare') return 0xc978ff;
  return 0x8aa7ff;
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
  dim.setInteractive(new Phaser.Geom.Rectangle(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT), Phaser.Geom.Rectangle.Contains);
  ov.add(dim);

  const PW = 360;
  const PH = 500;
  const PX = (CANVAS_WIDTH - PW) / 2;
  const PY = (CANVAS_HEIGHT - PH) / 2;
  const panel = addFramedPanel(scene, {
    x: PX,
    y: PY,
    w: PW,
    h: PH,
    radius: 14,
    fillColor: SHOP_PANEL_FILL,
    borderColor: SHOP_PURPLE,
    borderAlpha: 0.9,
    borderWidth: 2,
    accentColor: SHOP_PURPLE,
    accentAlpha: 0.72,
    glowColor: SHOP_PURPLE,
    glowOpacity: 0.10,
    shadowOpacity: 0.64,
    shadowOffsetY: 5,
  });
  addToContainer(ov, panel.shadow, panel.panel, panel.glow);

  const titleT = scene.add.text(CANVAS_WIDTH / 2, PY + 24, '🛒 스킬 상점', {
    fontFamily: 'Georgia, serif', fontSize: '20px', color: '#dba6ff',
    fontStyle: 'bold',
  }).setOrigin(0.5);
  ov.add(titleT);

  const gs = loadGameState();
  const currencyT = scene.add.text(CANVAS_WIDTH / 2, PY + 50, `보유 재화   💰 ${gs.homeGold}    💎 ${gs.gems}`, {
    fontFamily: 'sans-serif',
    fontSize: '11px',
    color: CSS.PARCHMENT_DIM,
  }).setOrigin(0.5);
  ov.add(currencyT);

  // Daily rotation: 4 skills (seed by day)
  const day = Math.floor(Date.now() / 86400000);
  const available = [...ACTIVE_SKILLS].sort((a, b) =>
    (Math.sin(day * 999 + ACTIVE_SKILLS.indexOf(a)) - Math.sin(day * 999 + ACTIVE_SKILLS.indexOf(b))));
  const daily = available.slice(0, 4);

  const cardW = 158;
  const cardH = 154;
  const cardGap = 12;
  const startX = PX + 16;
  const startY = PY + 74;
  daily.forEach((sk, i) => {
    const row = Math.floor(i / 2);
    const col = i % 2;
    const sx  = startX + col * (cardW + cardGap);
    const sy  = startY + row * (cardH + 12);

    const owned = gs.ownedActiveSkills.includes(sk.id);

    const card = addFramedPanel(scene, {
      x: sx,
      y: sy,
      w: cardW,
      h: cardH,
      radius: 10,
      fillColor: owned ? SHOP_CARD_OWNED_FILL : SHOP_CARD_FILL,
      borderColor: owned ? SHOP_OWNED_GREEN : SHOP_PURPLE,
      borderAlpha: owned ? 0.78 : 0.82,
      borderWidth: 1.5,
      accentColor: owned ? SHOP_OWNED_GREEN : SHOP_PURPLE,
      accentAlpha: owned ? 0.58 : 0.62,
      glowColor: owned ? SHOP_OWNED_GREEN : SHOP_PURPLE,
      glowOpacity: 0.07,
      shadowOpacity: 0.44,
      shadowOffsetY: 3,
    });
    addToContainer(ov, card.shadow, card.panel, card.glow);

    const iconT = scene.add.text(sx + cardW / 2, sy + 27, sk.icon, {
      fontFamily: 'sans-serif', fontSize: '26px',
    }).setOrigin(0.5);
    ov.add(iconT);

    const nameT = scene.add.text(sx + cardW / 2, sy + 52, sk.name, {
      fontFamily: 'Georgia, serif', fontSize: '13px', color: CSS.PARCHMENT,
      fontStyle: 'bold',
    }).setOrigin(0.5);
    ov.add(nameT);

    const descT = scene.add.text(sx + cardW / 2, sy + 69, sk.desc, {
      fontFamily: 'sans-serif', fontSize: '9px', color: CSS.PARCHMENT_DIM,
      wordWrap: { width: cardW - 22, useAdvancedWrap: true }, align: 'center',
    }).setOrigin(0.5, 0);
    ov.add(descT);

    const cdT = scene.add.text(sx + cardW / 2, sy + 103, `쿨다운 ${sk.cooldown}s`, {
      fontFamily: 'sans-serif', fontSize: '9px', color: '#b8a0c8',
    }).setOrigin(0.5);
    ov.add(cdT);

    const buttonLabel = owned ? '✓ 보유 중' : `💰${sk.goldCost} / 💎${sk.gemCost}`;
    const buyButton = addPrimaryActionButton(scene, {
      x: sx + 12,
      y: sy + cardH - 36,
      w: cardW - 24,
      h: 26,
      label: buttonLabel,
      fontSize: '10px',
      enabled: !owned,
      fillColor: 0x2a163a,
      hoverFillColor: 0x3a1e52,
      borderColor: SHOP_PURPLE_DARK,
      hoverBorderColor: SHOP_PURPLE,
      disabledFillColor: 0x102417,
      disabledBorderColor: SHOP_OWNED_GREEN,
      textColor: CSS.TORCH_AMBER,
      disabledTextColor: '#91f0ad',
      onPress: () => {
        const gs2 = loadGameState();
        const result = purchaseActiveSkillWithGold(gs2, sk.id, sk.goldCost);
        if (!result.ok) {
          buyButton.text.setText('💰 골드 부족!').setColor('#ff7777');
          scene.time.delayedCall(1200, () => {
            if (buyButton.text.active) {
              buyButton.text.setText(buttonLabel).setColor(CSS.TORCH_AMBER);
            }
          });
          return;
        }
        if (result.changed) saveGameState(result.state);
        ov.destroy();
        onReshop();
      },
    });
    addToContainer(ov, buyButton.bg, buyButton.text, buyButton.zone);
  });

  // Close
  const closeButton = addPrimaryActionButton(scene, {
    x: PX + 96,
    y: PY + PH - 46,
    w: PW - 192,
    h: 32,
    label: '닫기  ✕',
    fontSize: '12px',
    fillColor: 0x17100a,
    hoverFillColor: 0x24170b,
    borderColor: COLORS.STONE_MID,
    hoverBorderColor: SHOP_PURPLE,
    textColor: CSS.PARCHMENT_MUTED,
    onPress: () => { ov.destroy(); onClose(); },
  });
  addToContainer(ov, closeButton.bg, closeButton.text, closeButton.zone);

  // Entry animation — slide up from bottom
  ov.setY(CANVAS_HEIGHT).setAlpha(0);
  scene.tweens.add({
    targets: ov, y: 0, alpha: 1,
    duration: 280, ease: 'Quad.easeOut',
  });

  return ov;
}

function addToContainer(
  container: Phaser.GameObjects.Container,
  ...objects: Phaser.GameObjects.GameObject[]
): void {
  objects.forEach(obj => container.add(obj));
}
