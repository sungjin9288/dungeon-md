/**
 * MonsterDetailPanel.ts — entry-point exports for the monster detail overlay.
 * Business logic, pure helpers, and section builders live in:
 *   MonsterDetailShared.ts   (constants, types, pure helpers)
 *   MonsterDetailEquipment.ts (equipment slot, mini-cards, skill slots)
 *   MonsterDetailSkin.ts      (skin slot, skin cards, purchase popup)
 *   MonsterDetailGrowth.ts    (growth panel, feed CTA, skill tree, badges)
 */
import Phaser from 'phaser';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../constants/layout';
import { CASUAL, CASUAL_CSS } from '../constants/colors';
import { loadGameState, saveGameState, type OwnedMonster } from '../data/wisdom';
import { MONSTER_DEFS, getSkinForMonster, type MonsterId } from '../data/monsters';
import { feedOwnedMonster, purchaseActiveSkillWithGold } from '../data/barracksTransactions';
import {
  getSkillTree, ACTIVE_SKILLS,
  xpToNextLevel, getMonsterAtk,
} from '../data/barracks';
import { generatePortrait } from '../art/PortraitGenerator';
import {
  addFramedPanel,
  addInfoRow,
  addPrimaryActionButton,
  addProgressBar,
} from './GameUiPrimitives';

// ─── Shared layer ─────────────────────────────────────────────────────────────
import {
  type MonsterDetailContext,
  DETAIL_PANEL_FILL,
  DETAIL_ROW_FILL,
  PORTRAIT_DISC_FILL,
  FEED_GOLD_COST,
  FEED_XP_GAIN,
  SHOP_PANEL_FILL,
  SHOP_CARD_FILL,
  SHOP_CARD_OWNED_FILL,
  SHOP_PURPLE,
  SHOP_PURPLE_DARK,
  SHOP_OWNED_GREEN,
  DETAIL_TYPE_LABEL,
  getDetailCollectionMeta,
} from './MonsterDetailShared';

// ─── Feature modules ──────────────────────────────────────────────────────────
import {
  buildEquipmentSlot,
  buildEquippedSkillSlots,
} from './MonsterDetailEquipment';
import { buildSkinSlot } from './MonsterDetailSkin';
import {
  drawHeroCollectionBadges,
  buildGrowthCommandPanel,
  buildFeedTrainingAction,
  buildSkillTreeSection,
} from './MonsterDetailGrowth';

// Re-export the context type so any future caller can import it from here
export type { MonsterDetailContext } from './MonsterDetailShared';

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

  const def           = MONSTER_DEFS[m.id as keyof typeof MONSTER_DEFS]!;
  const tree          = getSkillTree(m.id as MonsterId);
  const collectionMeta = getDetailCollectionMeta(m, def);
  const xpNeeded      = xpToNextLevel(m.level);
  const xpPct         = m.level >= 50 ? 1 : Math.min(1, m.xp / xpNeeded);
  const skillPoints   = m.skillPoints ?? 0;
  const hasEquipment  = Boolean(m.equipment);

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
  const atk    = getMonsterAtk(def.baseDamage, m.level, m.spentSkills);
  const statY  = py + 102;
  const statGap = 6;
  const statW  = (pw - 40 - statGap * 2) / 3;
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
  const xpBarW = pw - 40;
  const xpBar  = addProgressBar(scene, {
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
  const eqY   = py + 438;
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
  const skY   = eqY + 100;
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
  const skinDiv      = scene.add.graphics();
  skinDiv.lineStyle(2, CASUAL.EDGE_SOFT, 0.5);
  skinDiv.lineBetween(px + 16, skinSectionY, px + pw - 16, skinSectionY);
  ov.add(skinDiv);
  ov.add(scene.add.text(px + 16, skinSectionY + 8, '🎨 코스튬', {
    fontFamily: 'sans-serif', fontSize: '13px', fontStyle: 'bold', color: CASUAL_CSS.INK,
  }));
  buildSkinSlot(ctx, ov, m, px + 16, skinSectionY + 30, pw - 32);

  // ── Feed button ──────────────────────────────────────────────────────────
  const feedY      = py + ph - 86;
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
      const result   = feedOwnedMonster(gs3, m.id, FEED_GOLD_COST, FEED_XP_GAIN);
      if (!result.ok) {
        if (result.reason === 'insufficient_gold') {
          feedAction.setMessage('골드 부족', `${FEED_GOLD_COST}골드 필요 · 보유 ${gs3.homeGold ?? 0}`, '부족', '#ff7777');
        } else {
          feedAction.setMessage('몬스터 없음', '저장된 수호자를 찾을 수 없습니다', '오류', '#ff7777');
        }
        scene.time.delayedCall(1200, feedAction.resetMessage);
        return;
      }

      m.xp          = result.monster.xp;
      m.level       = result.monster.level;
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
  const day       = Math.floor(Date.now() / 86400000);
  const available = [...ACTIVE_SKILLS].sort((a, b) =>
    (Math.sin(day * 999 + ACTIVE_SKILLS.indexOf(a)) - Math.sin(day * 999 + ACTIVE_SKILLS.indexOf(b))));
  const daily = available.slice(0, 4);

  const cardW   = 158;
  const cardH   = 154;
  const cardGap = 12;
  const startX  = PX + 16;
  const startY  = PY + 74;
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
    const buyButton   = addPrimaryActionButton(scene, {
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
        const gs2    = loadGameState();
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

// ─── Internal helper ──────────────────────────────────────────────────────────

function addToContainer(
  container: Phaser.GameObjects.Container,
  ...objects: Phaser.GameObjects.GameObject[]
): void {
  objects.forEach(obj => container.add(obj));
}
