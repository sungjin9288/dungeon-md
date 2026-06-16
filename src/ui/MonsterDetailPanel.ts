import Phaser from 'phaser';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../constants/layout';
import { CASUAL, CASUAL_CSS } from '../constants/colors';
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

const DETAIL_PANEL_FILL = CASUAL.PANEL;
const DETAIL_ROW_FILL = CASUAL.PANEL_SOFT;
// 초상화 디스크 — 크림 면 위 대비를 위한 살짝 깊은 따뜻한 톤
const PORTRAIT_DISC_FILL = 0xe8c89a;
const FEED_GOLD_COST = 50;
const FEED_XP_GAIN = 20;
const SHOP_PANEL_FILL = CASUAL.PANEL;
const SHOP_CARD_FILL = CASUAL.PANEL;
const SHOP_CARD_OWNED_FILL = CASUAL.PANEL_SOFT;
const SHOP_PURPLE = CASUAL.PURPLE;
const SHOP_PURPLE_DARK = CASUAL.PURPLE_DK;
const SHOP_OWNED_GREEN = CASUAL.GREEN;
const DETAIL_TYPE_LABEL: Record<string, string> = {
  melee: '근접 수호자',
  ranged: '원거리 수호자',
  magic: '마법 수호자',
  support: '지원 수호자',
};
const DETAIL_OWNED_RARITY_TO_TIER: readonly RarityId[] = ['C', 'U', 'R', 'E', 'L'];
const DETAIL_RARITY_META: Record<RarityId, { rank: number; label: string; stars: string; color: number; css: string }> = {
  C: { rank: 0, label: 'COMMON', stars: '★',     color: CASUAL.EDGE_SOFT, css: CASUAL_CSS.INK_SOFT },
  U: { rank: 1, label: 'UNIQUE', stars: '★★',    color: CASUAL.GREEN,     css: CASUAL_CSS.GREEN },
  R: { rank: 2, label: 'RARE',   stars: '★★★',   color: CASUAL.BLUE,      css: CASUAL_CSS.BLUE },
  E: { rank: 3, label: 'EPIC',   stars: '★★★★',  color: CASUAL.PURPLE,    css: CASUAL_CSS.PURPLE },
  L: { rank: 4, label: 'LEGEND', stars: '★★★★★', color: CASUAL.GOLD,      css: CASUAL_CSS.GOLD },
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
  fire:      { label: '화염', icon: '🔥', color: CASUAL.RED },
  frost:     { label: '서리', icon: '❄',  color: CASUAL.BLUE },
  lightning: { label: '번개', icon: '⚡', color: CASUAL.GOLD },
  dark:      { label: '암흑', icon: '☾',  color: CASUAL.PURPLE },
  holy:      { label: '신성', icon: '✦',  color: CASUAL.GOLD },
};
const DETAIL_EQUIPMENT_STARS = ['★', '★★', '★★★', '★★★★', '★★★★★', '★★★★★★'];
const DETAIL_EQUIPMENT_TYPE_META: Record<string, { label: string; icon: string; color: number; css: string }> = {
  weapon:    { label: '무기',   icon: '⚔', color: CASUAL.GOLD,   css: CASUAL_CSS.GOLD },
  armor:     { label: '방어구', icon: '◆', color: CASUAL.BLUE,   css: CASUAL_CSS.BLUE },
  accessory: { label: '장신구', icon: '✦', color: CASUAL.PURPLE, css: CASUAL_CSS.PURPLE },
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
  dim.fillStyle(0x000000, 0.5);
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
    radius: 16,
    fillColor: DETAIL_PANEL_FILL,
    borderColor: CASUAL.EDGE,
    borderAlpha: 1,
    borderWidth: 3,
    accentColor,
    accentAlpha: 1,
    glowColor: accentColor,
    glowOpacity: 0,
    shadowOpacity: 0.3,
    shadowOffsetY: 6,
  });
  addToContainer(ov, panel.shadow, panel.panel, panel.glow);

  // Header — training chamber hero with portrait fallback.
  const detailSkin = getSkinForMonster(m.id, loadGameState().equippedSkins ?? {});
  const hero = scene.add.graphics();
  hero.fillStyle(CASUAL.PANEL_SOFT, 1);
  hero.fillRoundedRect(px + 16, py + 14, pw - 32, 80, 12);
  hero.fillStyle(0xffffff, 0.12);
  hero.fillRoundedRect(px + 21, py + 18, pw - 42, 5, 4);
  hero.fillStyle(accentColor, 0.16);
  hero.fillRoundedRect(px + 22, py + 20, 70, 68, 10);
  hero.fillStyle(PORTRAIT_DISC_FILL, 1);
  hero.fillRoundedRect(px + 30, py + 27, 54, 50, 9);
  hero.lineStyle(3, CASUAL.EDGE, 1);
  hero.strokeRoundedRect(px + 16, py + 14, pw - 32, 80, 12);
  hero.lineStyle(2, accentColor, 0.7);
  hero.strokeRoundedRect(px + 22, py + 20, 70, 68, 10);
  hero.lineStyle(1, CASUAL.EDGE_SOFT, 0.4);
  hero.lineBetween(px + 104, py + 76, px + pw - 32, py + 76);
  hero.fillStyle(accentColor, 0.18);
  hero.fillCircle(px + 57, py + 78, 26);
  hero.fillStyle(CASUAL.SHADOW, 0.2);
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
    fontFamily: 'sans-serif',
    fontSize: '18px',
    fontStyle: 'bold',
    color: CASUAL_CSS.INK,
    stroke: '#ffffff',
    strokeThickness: 4,
  }).setOrigin(0, 0.5);
  ov.add(nameT);
  ov.add(scene.add.text(px + pw - 28, py + 31, `Lv.${m.level}`, {
    fontFamily: 'sans-serif',
    fontSize: '13px',
    color: '#ffffff',
    fontStyle: 'bold',
    backgroundColor: `#${accentColor.toString(16).padStart(6, '0')}`,
    padding: { x: 8, y: 3 },
  }).setOrigin(1, 0.5));

  const typeLabel = DETAIL_TYPE_LABEL[def.type] ?? '던전 수호자';
  ov.add(scene.add.text(px + 108, py + 53, `${typeLabel} · ${collectionMeta.tribeLabel} · ${collectionMeta.elementIcon} ${collectionMeta.elementLabel}`, {
    fontFamily: 'sans-serif',
    fontSize: '10px',
    color: CASUAL_CSS.INK_SOFT,
    fontStyle: 'bold',
  }).setOrigin(0, 0.5));
  ov.add(scene.add.text(px + 108, py + 72, def.passiveDesc, {
    fontFamily: 'sans-serif',
    fontSize: '9px',
    color: CASUAL_CSS.INK_SOFT,
    wordWrap: { width: pw - 146, useAdvancedWrap: true },
  }).setOrigin(0, 0.5));

  if (ctx.focusSourceLabel) {
    const focusChip = scene.add.graphics();
    focusChip.fillStyle(CASUAL.GREEN, 1);
    focusChip.fillRoundedRect(px + pw - 142, py + 65, 112, 18, 7);
    focusChip.fillStyle(0xffffff, 0.3);
    focusChip.fillRoundedRect(px + pw - 139, py + 67, 106, 3, 2);
    focusChip.lineStyle(2, CASUAL.GREEN_DK, 1);
    focusChip.strokeRoundedRect(px + pw - 142, py + 65, 112, 18, 7);
    ov.add(focusChip);
    ov.add(scene.add.text(px + pw - 84, py + 74, ctx.focusSourceLabel, {
      fontFamily: 'sans-serif',
      fontSize: '9px',
      color: '#ffffff',
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
      borderColor: CASUAL.EDGE,
      valueColor: CASUAL_CSS.RED,
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
      borderColor: CASUAL.EDGE_SOFT,
      valueColor: CASUAL_CSS.INK,
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
      borderColor: CASUAL.EDGE_SOFT,
      valueColor: CASUAL_CSS.INK,
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
    fillColor: xpPct >= 0.82 ? CASUAL.GOLD : CASUAL.GREEN,
    trackColor: CASUAL.PANEL_SOFT,
    borderColor: CASUAL.EDGE_SOFT,
    borderAlpha: 0.9,
    animate: false,
  });
  addToContainer(ov, xpBar.track, xpBar.fill);

  const xpLabel = scene.add.text(px + pw / 2, py + 139, m.level >= 50 ? 'MAX LEVEL' : `EXP ${m.xp} / ${xpNeeded}`, {
    fontFamily: 'sans-serif', fontSize: '9px', fontStyle: 'bold', color: xpPct >= 0.82 ? CASUAL_CSS.GOLD : CASUAL_CSS.GREEN,
  }).setOrigin(0.5);
  ov.add(xpLabel);

  buildGrowthCommandPanel(ctx, ov, m, tree, px + 16, py + 154, pw - 32, accentColor);

  // Skill Tree section — every monster has a tree (custom or standard fallback)
  buildSkillTreeSection(ctx, ov, m, tree, px + 12, py + 210, pw - 24);

  // Equipment section
  const eqY = py + 438;
  const eqDiv = scene.add.graphics();
  eqDiv.lineStyle(2, CASUAL.EDGE_SOFT, 0.5);
  eqDiv.lineBetween(px + 16, eqY, px + pw - 16, eqY);
  ov.add(eqDiv);

  const eqLabel = scene.add.text(px + 16, eqY + 8, '🗡️ 장비', {
    fontFamily: 'sans-serif', fontSize: '13px', fontStyle: 'bold', color: CASUAL_CSS.INK,
  });
  ov.add(eqLabel);

  buildEquipmentSlot(ctx, ov, m, px + 16, eqY + 30, pw - 32);

  // Active Skills section
  const skY = eqY + 100;
  const skDiv = scene.add.graphics();
  skDiv.lineStyle(2, CASUAL.EDGE_SOFT, 0.5);
  skDiv.lineBetween(px + 16, skY, px + pw - 16, skY);
  ov.add(skDiv);

  const skLabel = scene.add.text(px + 16, skY + 8, '✨ 장착 스킬', {
    fontFamily: 'sans-serif', fontSize: '13px', fontStyle: 'bold', color: CASUAL_CSS.INK,
  });
  ov.add(skLabel);

  buildEquippedSkillSlots(ctx, ov, m, px + 16, skY + 30, pw - 32);

  // Skin section
  const skinSectionY = skY + 88;
  const skinDiv = scene.add.graphics();
  skinDiv.lineStyle(2, CASUAL.EDGE_SOFT, 0.5);
  skinDiv.lineBetween(px + 16, skinSectionY, px + pw - 16, skinSectionY);
  ov.add(skinDiv);
  ov.add(scene.add.text(px + 16, skinSectionY + 8, '🎨 코스튬', {
    fontFamily: 'sans-serif', fontSize: '13px', fontStyle: 'bold', color: CASUAL_CSS.INK,
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
        // Candy "레벨 업!" banner
        const lvUpT = scene.add.text(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 60, `⬆ LEVEL UP!  Lv.${m.level}`, {
          fontFamily: 'sans-serif', fontSize: '20px', fontStyle: 'bold', color: '#ffffff',
          stroke: `#${CASUAL.GOLD_DK.toString(16).padStart(6, '0')}`, strokeThickness: 5,
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
      fillColor: CASUAL.GREEN,
      hoverFillColor: 0x6fdc70,
      borderColor: CASUAL.GREEN_DK,
      hoverBorderColor: CASUAL.GREEN_DK,
      textColor: '#ffffff',
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
    fillColor: CASUAL.PANEL,
    hoverFillColor: CASUAL.PANEL_SOFT,
    borderColor: CASUAL.EDGE,
    hoverBorderColor: CASUAL.EDGE,
    textColor: CASUAL_CSS.INK,
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
    elementColor: element?.color ?? CASUAL.GOLD,
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
  const statusColor = skillPoints > 0 ? CASUAL.PURPLE : isLevelReady ? CASUAL.BLUE : hasEquipment ? meta.color : CASUAL.GOLD;
  const statusCss = skillPoints > 0 ? CASUAL_CSS.PURPLE : isLevelReady ? CASUAL_CSS.BLUE : hasEquipment ? meta.css : CASUAL_CSS.GOLD;

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

  addGrowthPill(scene, ov, x + w - 84, y + 7, 72, 'SP', String(m.skillPoints ?? 0), (m.skillPoints ?? 0) > 0 ? CASUAL.PURPLE : CASUAL.EDGE_SOFT);
  addGrowthPill(scene, ov, x + w - 84, y + 27, 72, '장비', eq ? eq.icon : '미장착', eq ? CASUAL.GOLD : CASUAL.EDGE_SOFT);

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
      accent: CASUAL.PURPLE,
    };
  }
  if (xpPct >= 0.78 && m.level < 50) {
    return {
      title: '레벨업 임박',
      body: '먹이로 경험치를 채우면 다음 던전 방 주력으로 쓰기 좋습니다.',
      accent: CASUAL.BLUE,
    };
  }
  if (!m.equipment && getEquipmentInventoryIds(gs).length > 0) {
    return {
      title: '장비 장착 추천',
      body: '보유 장비를 장착하면 방어선 전투력이 바로 올라갑니다.',
      accent: CASUAL.GOLD,
    };
  }
  if ((m.equippedSkills ?? []).length < 2 && (gs.ownedActiveSkills ?? []).length > 0) {
    return {
      title: '액티브 스킬 장착',
      body: '빈 스킬 슬롯을 눌러 웨이브 대응 옵션을 채우세요.',
      accent: CASUAL.BLUE,
    };
  }
  return {
    title: '던전 배치 준비',
    body: '성장 상태가 안정적입니다. 전투실에 배치해 방어선을 강화하세요.',
    accent: CASUAL.GREEN,
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
  const { x, y, w, h, monster, state, onPress } = options;
  const preview = getFeedTrainingPreview(monster, state);
  // 캔디 CTA: 만렙=초록 비활성톤, 가능=골드, 부족=뮤트 크림
  const fillColor = preview.maxLevel ? CASUAL.GREEN : preview.canAfford ? CASUAL.GOLD : CASUAL.PANEL_SOFT;
  const borderColor = preview.maxLevel ? CASUAL.GREEN_DK : preview.canAfford ? CASUAL.GOLD_DK : CASUAL.EDGE_SOFT;
  const chipColor = preview.maxLevel ? CASUAL.GREEN_DK : preview.willLevelUp ? CASUAL.GOLD_DK : preview.canAfford ? CASUAL.GOLD_DK : CASUAL.RED;
  const onCandy = preview.canAfford || preview.maxLevel; // 채도 캡 위 글자는 흰색
  const chipCss = `#${chipColor.toString(16).padStart(6, '0')}`; // 흰 칩 위 채도 글자
  const defaultTitle = preview.title;
  const defaultSub = preview.sub;
  const defaultChip = preview.chip;
  const defaultTitleColor = onCandy ? '#ffffff' : CASUAL_CSS.RED;
  const defaultChipColor = chipCss;

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
    const bx = x + bi * colW;
    const branchNodes = tree.nodes.filter(n => n.branch === branch).sort((a, b) => a.tier - b.tier);
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
      const ny = y + 38 + ni * 58;
      const nx = bx + colW / 2;
      const spent = (m.spentSkills[node.id] ?? 0) >= 1;
      const prereqMet = !node.requires || (m.spentSkills[node.requires] ?? 0) >= 1;
      const canAfford = m.skillPoints >= node.cost;
      const canUnlock = !spent && prereqMet && canAfford;
      const stateAccent = spent ? CASUAL.GREEN : canUnlock ? CASUAL.GOLD : prereqMet ? branchAccent : CASUAL.EDGE_SOFT;
      const stateAccentCss = spent ? CASUAL_CSS.GREEN : canUnlock ? CASUAL_CSS.GOLD : prereqMet ? CASUAL_CSS.INK : CASUAL_CSS.INK_SOFT;
      // 습득=초록 채도면(흰글자), 그 외=크림 타일(잉크글자)
      const filledTile = spent;
      const stateFill = filledTile ? CASUAL.GREEN : prereqMet ? CASUAL.PANEL : CASUAL.PANEL_SOFT;
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
  const slotAccent = eqDef ? getEquipmentRarityColor(eqDef.rarity) : CASUAL.EDGE_SOFT;
  const recommendedEquipmentId = getRecommendedEquipmentId(inventory, eqId);
  const impactLabel = eqDef ? getEquipmentImpactLabel(eqDef) : '전력 보강 대기';

  const leftW = 154;
  const rightX = x + leftW + 8;
  const rightW = w - leftW - 8;

  const slotBg = scene.add.graphics();
  slotBg.fillStyle(eqDef ? CASUAL.PANEL : CASUAL.PANEL_SOFT, 1);
  slotBg.fillRoundedRect(x, y, leftW, 68, 9);
  slotBg.fillStyle(0xffffff, 0.12);
  slotBg.fillRoundedRect(x + 5, y + 4, leftW - 10, 4, 3);
  slotBg.fillStyle(slotAccent, eqDef ? 0.22 : 0.12);
  slotBg.fillRoundedRect(x + 6, y + 6, 46, 56, 8);
  slotBg.lineStyle(2, slotAccent, eqDef ? 1 : 0.7);
  slotBg.strokeRoundedRect(x + 6, y + 6, 46, 56, 8);
  slotBg.lineStyle(3, CASUAL.EDGE, 1);
  slotBg.strokeRoundedRect(x, y, leftW, 68, 9);
  slotBg.fillStyle(slotAccent, eqDef ? 0.28 : 0.16);
  slotBg.fillRoundedRect(x + 64, y + 48, 74, 13, 5);
  ov.add(slotBg);

  ov.add(scene.add.text(x + 29, y + 24, eqDef ? eqDef.icon : '◇', {
    fontFamily: 'sans-serif',
    fontSize: eqDef ? '24px' : '22px',
    color: eqDef ? `#${slotAccent.toString(16).padStart(6, '0')}` : CASUAL_CSS.INK_SOFT,
  }).setOrigin(0.5));
  ov.add(scene.add.text(x + 29, y + 48, eqDef ? getEquipmentStars(eqDef.rarity) : 'EMPTY', {
    fontFamily: 'sans-serif',
    fontSize: '8px',
    color: eqDef ? `#${slotAccent.toString(16).padStart(6, '0')}` : CASUAL_CSS.INK_SOFT,
    fontStyle: 'bold',
  }).setOrigin(0.5));

  ov.add(scene.add.text(x + 66, y + 11, equippedLabel, {
    fontFamily: 'sans-serif',
    fontSize: '8px',
    color: eqDef ? typeMeta.css : CASUAL_CSS.INK_SOFT,
    fontStyle: 'bold',
  }).setOrigin(0, 0.5));
  ov.add(scene.add.text(x + 66, y + 29, eqDef ? shortenLabel(eqDef.name, 8) : '장비 미장착', {
    fontFamily: 'sans-serif',
    fontSize: '13px',
    color: eqDef ? CASUAL_CSS.INK : CASUAL_CSS.INK_SOFT,
    fontStyle: 'bold',
  }).setOrigin(0, 0.5));
  ov.add(scene.add.text(x + 66, y + 44, eqDef ? shortenLabel(eqDef.desc, 13) : '보관함에서 장착', {
    fontFamily: 'sans-serif',
    fontSize: '8px',
    color: CASUAL_CSS.INK_SOFT,
  }).setOrigin(0, 0.5));
  ov.add(scene.add.text(x + 101, y + 54.5, impactLabel, {
    fontFamily: 'sans-serif',
    fontSize: '7px',
    color: eqDef ? `#${slotAccent.toString(16).padStart(6, '0')}` : CASUAL_CSS.INK_SOFT,
    fontStyle: 'bold',
  }).setOrigin(0.5));

  const invBg = scene.add.graphics();
  invBg.fillStyle(CASUAL.PANEL_SOFT, 1);
  invBg.fillRoundedRect(rightX, y, rightW, 68, 9);
  invBg.fillStyle(0xffffff, 0.12);
  invBg.fillRoundedRect(rightX + 5, y + 4, rightW - 10, 4, 3);
  invBg.fillStyle(CASUAL.GOLD, 0.16);
  invBg.fillRoundedRect(rightX + 5, y + 5, rightW - 10, 15, 6);
  invBg.lineStyle(3, CASUAL.EDGE, 1);
  invBg.strokeRoundedRect(rightX, y, rightW, 68, 9);
  ov.add(invBg);

  ov.add(scene.add.text(rightX + 8, y + 9, `보관함 ${inventory.length}`, {
    fontFamily: 'sans-serif',
    fontSize: '9px',
    color: CASUAL_CSS.INK,
    fontStyle: 'bold',
  }).setOrigin(0, 0.5));
  ov.add(scene.add.text(rightX + rightW - 8, y + 9, inventory.length > 0 ? '탭 장착' : '제작 필요', {
    fontFamily: 'sans-serif',
    fontSize: '8px',
    color: inventory.length > 0 ? CASUAL_CSS.GOLD : CASUAL_CSS.INK_SOFT,
    fontStyle: 'bold',
  }).setOrigin(1, 0.5));

  inventory.slice(0, 4).forEach((ed, idx) => {
    drawEquipmentMiniCard(ctx, ov, m, ed, rightX + 8 + idx * 31, y + 20, 27, eqId === ed.id, ed.id === recommendedEquipmentId);
  });
  if (inventory.length > 4) {
    ov.add(scene.add.text(rightX + rightW - 12, y + 34, `+${inventory.length - 4}`, {
      fontFamily: 'sans-serif',
      fontSize: '8px',
      color: '#ffffff',
      fontStyle: 'bold',
      backgroundColor: CASUAL_CSS.INK_SOFT,
      padding: { x: 3, y: 1 },
    }).setOrigin(1, 0.5));
  }
  if (inventory.length === 0) {
    ov.add(scene.add.text(rightX + rightW / 2, y + 32, '장비 없음', {
      fontFamily: 'sans-serif',
      fontSize: '10px',
      color: CASUAL_CSS.INK_SOFT,
    }).setOrigin(0.5));
  }

  const forgeButton = addPrimaryActionButton(scene, {
    x: rightX + 8,
    y: y + 48,
    w: rightW - 16,
    h: 18,
    label: inventory.length > 0 ? '⚒ 장비 더 제작' : '⚒ 장비 제작소',
    fontSize: '9px',
    fillColor: CASUAL.GOLD,
    hoverFillColor: 0xffd45f,
    borderColor: CASUAL.GOLD_DK,
    hoverBorderColor: CASUAL.GOLD_DK,
    textColor: '#ffffff',
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
  const tileBorder = equipped ? CASUAL.GREEN : recommended ? CASUAL.GOLD : accent;
  const bg = scene.add.graphics();
  bg.fillStyle(equipped ? CASUAL.GREEN : recommended ? CASUAL.PANEL : CASUAL.PANEL_SOFT, 1);
  bg.fillRoundedRect(x, y, size, size, 6);
  bg.fillStyle(0xffffff, equipped ? 0.28 : 0.4);
  bg.fillRoundedRect(x + 3, y + 3, size - 6, 3, 2);
  bg.lineStyle(equipped || recommended ? 2 : 1.5, tileBorder, equipped || recommended ? 1 : 0.7);
  bg.strokeRoundedRect(x, y, size, size, 6);
  ov.add(bg);

  ov.add(scene.add.text(x + size / 2, y + 10, ed.icon, {
    fontFamily: 'sans-serif',
    fontSize: '14px',
  }).setOrigin(0.5));
  ov.add(scene.add.text(x + size / 2, y + 21, equipped ? '✓' : recommended ? 'BEST' : typeMeta.icon, {
    fontFamily: 'sans-serif',
    fontSize: equipped || recommended ? '7px' : '8px',
    color: equipped ? '#ffffff' : recommended ? CASUAL_CSS.GOLD : typeMeta.css,
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
  return DETAIL_EQUIPMENT_TYPE_META[type ?? ''] ?? { label: '장비', icon: '◇', color: CASUAL.EDGE_SOFT, css: CASUAL_CSS.INK_SOFT };
}

function getEquipmentStars(rarity: number): string {
  const index = Phaser.Math.Clamp(Math.floor(rarity), 0, DETAIL_EQUIPMENT_STARS.length - 1);
  return DETAIL_EQUIPMENT_STARS[index];
}

function getEquipmentRarityColor(rarity: number): number {
  const palette = [CASUAL.EDGE_SOFT, CASUAL.GREEN, CASUAL.BLUE, CASUAL.PURPLE, CASUAL.GOLD, CASUAL.RED];
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
    const accent = sk ? SHOP_PURPLE : hasOwnedSkills ? CASUAL.BLUE : CASUAL.EDGE_SOFT;
    const label = sk ? sk.name : '장착 대기';
    const subLabel = sk
      ? `쿨다운 ${sk.cooldown}s`
      : hasOwnedSkills
        ? `보유 ${ownedSkillCount} 스킬`
        : '상점 필요';

    const bg = scene.add.graphics();
    // 장착됨=보라 채도 타일(흰글자), 비어있음=크림 타일(잉크글자)
    bg.fillStyle(sk ? SHOP_PURPLE : hasOwnedSkills ? CASUAL.PANEL : CASUAL.PANEL_SOFT, 1);
    bg.fillRoundedRect(sx, y, slotW, 50, 8);
    bg.fillStyle(0xffffff, sk ? 0.26 : 0.4);
    bg.fillRoundedRect(sx + 5, y + 4, slotW - 10, 4, 3);
    bg.fillStyle(sk ? 0xffffff : accent, sk ? 0.22 : 0.16);
    bg.fillRoundedRect(sx + 7, y + 7, 36, 36, 8);
    bg.lineStyle(2, sk ? CASUAL.PURPLE_DK : accent, sk ? 1 : 0.7);
    bg.strokeRoundedRect(sx + 7, y + 7, 36, 36, 8);
    bg.lineStyle(3, CASUAL.EDGE, 1);
    bg.strokeRoundedRect(sx, y, slotW, 50, 8);
    ov.add(bg);

    ov.add(scene.add.text(sx + 25, y + 25, sk ? sk.icon : '+', {
      fontFamily: 'sans-serif',
      fontSize: sk ? '21px' : '24px',
      color: sk ? '#ffffff' : CASUAL_CSS.INK_SOFT,
      fontStyle: 'bold',
    }).setOrigin(0.5));

    ov.add(scene.add.text(sx + 57, y + 16, label, {
      fontFamily: 'sans-serif',
      fontSize: '12px',
      fontStyle: 'bold',
      color: sk ? '#ffffff' : hasOwnedSkills ? CASUAL_CSS.INK : CASUAL_CSS.INK_SOFT,
    }).setOrigin(0, 0.5));
    ov.add(scene.add.text(sx + 57, y + 33, subLabel, {
      fontFamily: 'sans-serif',
      fontSize: '10px',
      fontStyle: 'bold',
      color: sk ? '#ffffff' : hasOwnedSkills ? CASUAL_CSS.BLUE : CASUAL_CSS.INK_SOFT,
    }).setOrigin(0, 0.5));
    ov.add(scene.add.text(sx + slotW - 9, y + 10, `S${si + 1}`, {
      fontFamily: 'monospace',
      fontSize: '8px',
      color: sk ? '#ffffff' : CASUAL_CSS.INK_SOFT,
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
  gallery.fillStyle(CASUAL.PANEL_SOFT, 1);
  gallery.fillRoundedRect(galleryX, y, galleryW, 56, 8);
  gallery.fillStyle(0xffffff, 0.12);
  gallery.fillRoundedRect(galleryX + 5, y + 4, galleryW - 10, 4, 3);
  gallery.fillStyle(CASUAL.BLUE, 0.16);
  gallery.fillRoundedRect(galleryX + 6, y + 7, galleryW - 12, 16, 6);
  gallery.lineStyle(3, CASUAL.EDGE, 1);
  gallery.strokeRoundedRect(galleryX, y, galleryW, 56, 8);
  ov.add(gallery);

  ov.add(scene.add.text(galleryX + 10, y + 15, `스킨 도감 ${owned.length}/${allSkins.length}`, {
    fontFamily: 'sans-serif',
    fontSize: '10px',
    fontStyle: 'bold',
    color: CASUAL_CSS.INK,
  }).setOrigin(0, 0.5));
  ov.add(scene.add.text(galleryX + galleryW - 10, y + 15, locked.length > 0 ? `잠금 ${locked.length}` : '완성', {
    fontFamily: 'monospace',
    fontSize: '9px',
    fontStyle: 'bold',
    color: locked.length > 0 ? CASUAL_CSS.INK_SOFT : CASUAL_CSS.GREEN,
  }).setOrigin(1, 0.5));

  if (allSkins.length === 0) {
    ov.add(scene.add.text(galleryX + galleryW / 2, y + 37, '이 몬스터의 스킨은 아직 없습니다', {
      fontFamily: 'sans-serif',
      fontSize: '10px',
      color: CASUAL_CSS.INK_SOFT,
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
      fontStyle: 'bold',
      color: CASUAL_CSS.INK_SOFT,
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
  const accent = skin ? getSkinRarityColor(skin) : CASUAL.GOLD;
  const bg = scene.add.graphics();
  bg.fillStyle(active ? accent : CASUAL.PANEL_SOFT, 1);
  bg.fillRoundedRect(x, y, w, 56, 7);
  bg.fillStyle(0xffffff, active ? 0.26 : 0.4);
  bg.fillRoundedRect(x + 5, y + 4, w - 10, 4, 3);
  bg.fillStyle(active ? 0xffffff : accent, active ? 0.22 : 0.16);
  bg.fillRoundedRect(x + 7, y + 9, w - 14, 28, 7);
  bg.lineStyle(3, CASUAL.EDGE, 1);
  bg.strokeRoundedRect(x, y, w, 56, 7);
  ov.add(bg);

  ov.add(scene.add.text(x + w / 2, y + 22, skin ? skin.emoji : fallbackEmoji, {
    fontFamily: 'sans-serif',
    fontSize: skin ? '18px' : '20px',
  }).setOrigin(0.5));
  ov.add(scene.add.text(x + w / 2, y + 44, skin ? shortenLabel(skin.name, 4) : fallbackLabel, {
    fontFamily: 'sans-serif',
    fontSize: '10px',
    fontStyle: 'bold',
    color: active ? '#ffffff' : CASUAL_CSS.INK_SOFT,
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
  // 활성=초록 채도 타일, 보유=크림 타일+레어 액센트, 잠금=뮤트 크림
  bg.fillStyle(active ? CASUAL.GREEN : owned ? CASUAL.PANEL : CASUAL.PANEL_SOFT, 1);
  bg.fillRoundedRect(x, y, size, size, 6);
  bg.fillStyle(0xffffff, active ? 0.28 : 0.4);
  bg.fillRoundedRect(x + 3, y + 3, size - 6, 3, 2);
  bg.lineStyle(owned ? 2 : 1.5, active ? CASUAL.GREEN_DK : owned ? accent : CASUAL.EDGE_SOFT, owned ? 1 : 0.7);
  bg.strokeRoundedRect(x, y, size, size, 6);
  ov.add(bg);
  ov.add(scene.add.text(x + size / 2, y + size / 2 - 1, owned ? skin.emoji : '🔒', {
    fontFamily: 'sans-serif',
    fontSize: owned ? '14px' : '12px',
    color: owned ? '#ffffff' : CASUAL_CSS.INK_SOFT,
  }).setOrigin(0.5));
  if (skin.rarity !== 'normal') {
    ov.add(scene.add.text(x + size - 4, y + 5, skin.rarity === 'limited' ? 'L' : 'R', {
      fontFamily: 'monospace',
      fontSize: '7px',
      fontStyle: 'bold',
      color: active ? '#ffffff' : `#${accent.toString(16).padStart(6, '0')}`,
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
  bg.fillStyle(CASUAL.SHADOW, 0.3);
  bg.fillRoundedRect(-popW / 2, -popH / 2 + 6, popW, popH, 12);
  bg.fillStyle(CASUAL.PANEL, 1);
  bg.fillRoundedRect(-popW / 2, -popH / 2, popW, popH, 12);
  bg.fillStyle(0xffffff, 0.12);
  bg.fillRoundedRect(-popW / 2 + 5, -popH / 2 + 4, popW - 10, 6, 4);
  bg.fillStyle(accent, 1);
  bg.fillRoundedRect(-popW / 2 + 6, -popH / 2 + 6, popW - 12, 8, 4);
  bg.lineStyle(3, CASUAL.EDGE, 1);
  bg.strokeRoundedRect(-popW / 2, -popH / 2, popW, popH, 12);
  pop.add(bg);

  pop.add(scene.add.text(0, -popH / 2 + 22, `${skin.emoji} ${skin.name}`, {
    fontFamily: 'sans-serif', fontSize: '14px', fontStyle: 'bold',
    color: CASUAL_CSS.INK,
  }).setOrigin(0.5));

  if (isQuestSkin) {
    const questTitle = skin.unlockRef
      ? getQuest(skin.unlockRef)?.title ?? skin.unlockRef
      : '?';
    pop.add(scene.add.text(0, -popH / 2 + 48, `퀘스트 「${questTitle}」\n완료 시 해금됩니다`, {
      fontFamily: 'sans-serif', fontSize: '11px', fontStyle: 'bold', color: CASUAL_CSS.INK_SOFT,
      align: 'center', lineSpacing: 5,
    }).setOrigin(0.5, 0));
    return;
  }

  if (!skin.available) {
    pop.add(scene.add.text(0, -popH / 2 + 52, '기간 한정 스킨 — 현재 판매 종료', {
      fontFamily: 'sans-serif', fontSize: '11px', fontStyle: 'bold', color: CASUAL_CSS.INK_SOFT,
    }).setOrigin(0.5));
    return;
  }

  const gems = loadGameState().gems ?? 0;
  const canAfford = gems >= skin.gemCost;
  pop.add(scene.add.text(0, -popH / 2 + 44, `보유 💎 ${gems.toLocaleString()}`, {
    fontFamily: 'sans-serif', fontSize: '10px', fontStyle: 'bold', color: CASUAL_CSS.INK_SOFT,
  }).setOrigin(0.5));

  const btnW = 150;
  const btnH = 34;
  const btnY = popH / 2 - 28;
  const btn = scene.add.graphics();
  btn.fillStyle(canAfford ? CASUAL.BLUE_DK : CASUAL.EDGE_SOFT, 1);
  btn.fillRoundedRect(-btnW / 2, btnY - btnH / 2 + 4, btnW, btnH, 10);
  btn.fillStyle(canAfford ? CASUAL.BLUE : CASUAL.PANEL_SOFT, 1);
  btn.fillRoundedRect(-btnW / 2, btnY - btnH / 2, btnW, btnH - 2, 10);
  btn.fillStyle(0xffffff, canAfford ? 0.32 : 0.4);
  btn.fillRoundedRect(-btnW / 2 + 5, btnY - btnH / 2 + 4, btnW - 10, 10, 6);
  pop.add(btn);
  pop.add(scene.add.text(0, btnY, canAfford ? `💎 ${skin.gemCost} 구매` : '젬 부족', {
    fontFamily: 'sans-serif', fontSize: '13px', fontStyle: 'bold',
    color: canAfford ? '#ffffff' : CASUAL_CSS.INK_SOFT,
    stroke: canAfford ? '#00000033' : undefined,
    strokeThickness: canAfford ? 3 : 0,
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
  if (skin.rarity === 'limited') return CASUAL.GOLD_DK;
  if (skin.rarity === 'rare') return CASUAL.PURPLE_DK;
  return CASUAL.BLUE_DK;
}

// ─── Skill Shop Overlay ───────────────────────────────────────────────────────

export function showSkillShopPanel(
  scene: Phaser.Scene,
  onClose: () => void,
  onReshop: () => void,
): Phaser.GameObjects.Container {
  const ov = scene.add.container(0, 0).setDepth(110);

  const dim = scene.add.graphics();
  dim.fillStyle(0x000000, 0.5);
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
    radius: 16,
    fillColor: SHOP_PANEL_FILL,
    borderColor: CASUAL.EDGE,
    borderAlpha: 1,
    borderWidth: 3,
    accentColor: SHOP_PURPLE,
    accentAlpha: 1,
    glowColor: SHOP_PURPLE,
    glowOpacity: 0,
    shadowOpacity: 0.3,
    shadowOffsetY: 6,
  });
  addToContainer(ov, panel.shadow, panel.panel, panel.glow);

  const titleT = scene.add.text(CANVAS_WIDTH / 2, PY + 24, '🛒 스킬 상점', {
    fontFamily: 'sans-serif', fontSize: '20px', color: CASUAL_CSS.INK,
    fontStyle: 'bold', stroke: '#ffffff', strokeThickness: 4,
  }).setOrigin(0.5);
  ov.add(titleT);

  const gs = loadGameState();
  const currencyT = scene.add.text(CANVAS_WIDTH / 2, PY + 50, `보유 재화   💰 ${gs.homeGold}    💎 ${gs.gems}`, {
    fontFamily: 'sans-serif',
    fontSize: '11px',
    fontStyle: 'bold',
    color: CASUAL_CSS.INK_SOFT,
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
      radius: 12,
      fillColor: owned ? SHOP_CARD_OWNED_FILL : SHOP_CARD_FILL,
      borderColor: CASUAL.EDGE,
      borderAlpha: 1,
      borderWidth: 3,
      accentColor: owned ? SHOP_OWNED_GREEN : SHOP_PURPLE,
      accentAlpha: 1,
      glowColor: owned ? SHOP_OWNED_GREEN : SHOP_PURPLE,
      glowOpacity: 0,
      shadowOpacity: 0.28,
      shadowOffsetY: 4,
    });
    addToContainer(ov, card.shadow, card.panel, card.glow);

    const iconT = scene.add.text(sx + cardW / 2, sy + 27, sk.icon, {
      fontFamily: 'sans-serif', fontSize: '26px',
    }).setOrigin(0.5);
    ov.add(iconT);

    const nameT = scene.add.text(sx + cardW / 2, sy + 52, sk.name, {
      fontFamily: 'sans-serif', fontSize: '13px', color: CASUAL_CSS.INK,
      fontStyle: 'bold',
    }).setOrigin(0.5);
    ov.add(nameT);

    const descT = scene.add.text(sx + cardW / 2, sy + 69, sk.desc, {
      fontFamily: 'sans-serif', fontSize: '9px', color: CASUAL_CSS.INK_SOFT,
      wordWrap: { width: cardW - 22, useAdvancedWrap: true }, align: 'center',
    }).setOrigin(0.5, 0);
    ov.add(descT);

    const cdT = scene.add.text(sx + cardW / 2, sy + 103, `쿨다운 ${sk.cooldown}s`, {
      fontFamily: 'sans-serif', fontSize: '9px', fontStyle: 'bold', color: owned ? CASUAL_CSS.GREEN : CASUAL_CSS.PURPLE,
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
      fillColor: SHOP_PURPLE,
      hoverFillColor: 0xc488f0,
      borderColor: SHOP_PURPLE_DARK,
      hoverBorderColor: SHOP_PURPLE_DARK,
      disabledFillColor: CASUAL.PANEL_SOFT,
      disabledBorderColor: SHOP_OWNED_GREEN,
      textColor: '#ffffff',
      disabledTextColor: CASUAL_CSS.GREEN,
      onPress: () => {
        const gs2 = loadGameState();
        const result = purchaseActiveSkillWithGold(gs2, sk.id, sk.goldCost);
        if (!result.ok) {
          buyButton.text.setText('💰 골드 부족!').setColor(CASUAL_CSS.RED);
          scene.time.delayedCall(1200, () => {
            if (buyButton.text.active) {
              buyButton.text.setText(buttonLabel).setColor('#ffffff');
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
    fillColor: CASUAL.PANEL,
    hoverFillColor: CASUAL.PANEL_SOFT,
    borderColor: CASUAL.EDGE,
    hoverBorderColor: CASUAL.EDGE,
    textColor: CASUAL_CSS.INK,
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
