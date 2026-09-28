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
import { DUNGEON_UI, DUNGEON_UI_CSS } from '../constants/colors';
import { loadGameState, saveGameState, type OwnedMonster } from '../data/wisdom';
import { resolveOwnedMonsterProfile } from '../data/monsters';
import { feedOwnedMonster, purchaseActiveSkillWithGold } from '../data/barracksTransactions';
import {
  getSkillTree, ACTIVE_SKILLS,
  xpToNextLevel, getMonsterAtk,
} from '../data/barracks';
import {
  addFramedPanel,
  addPrimaryActionButton,
} from './GameUiPrimitives';
import { addMonsterPortrait } from './MonsterPortraitView';
import { getMonsterRoomPlan } from './BarracksShared';
import { drawGrowthSigil } from './BarracksSkin';

// ─── Shared layer ─────────────────────────────────────────────────────────────
import {
  type MonsterDetailContext,
  type MonsterDetailTab,
  FEED_GOLD_COST,
  FEED_XP_GAIN,
  DETAIL_TYPE_LABEL,
  getDetailCollectionMeta,
} from './MonsterDetailShared';

// ─── Feature modules ──────────────────────────────────────────────────────────
import {
  buildEquipmentSlot,
  buildEquippedSkillSlots,
} from './MonsterDetailEquipment';
import { buildSkinSlot } from './MonsterDetailSkin';
import { buildBondTab } from './MonsterDetailBond';
import {
  buildGrowthCommandPanel,
  buildFeedTrainingAction,
  buildSkillTreeSection,
} from './MonsterDetailGrowth';

// Re-export the context type so any future caller can import it from here
export type { MonsterDetailContext, MonsterDetailTab } from './MonsterDetailShared';

// ─── Monster Detail Overlay ───────────────────────────────────────────────────

export function showMonsterDetailPanel(
  ctx: MonsterDetailContext,
  monster: OwnedMonster,
  initialTab: MonsterDetailTab = 'growth',
): Phaser.GameObjects.Container {
  const { scene, onClose, onRefresh } = ctx;
  const ov = scene.add.container(0, 0).setDepth(100);
  const def = resolveOwnedMonsterProfile(monster.id)!;
  const tree = getSkillTree(def.registryId ?? monster.id);
  const collection = getDetailCollectionMeta(monster, def);
  const xpNeeded = xpToNextLevel(monster.level);
  const xpPct = monster.level >= 50 ? 1 : Math.min(1, monster.xp / xpNeeded);
  const atk = getMonsterAtk(def.baseDamage, monster.level, monster.spentSkills, loadGameState().monsterAffinity?.[monster.id] ?? 0);
  const accent = def.accentColor ?? collection.color;
  const roomPlan = getMonsterRoomPlan(loadGameState(), monster);

  const dim = scene.add.graphics();
  dim.fillStyle(0x000000, 0.78);
  dim.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  dim.setInteractive(
    new Phaser.Geom.Rectangle(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT),
    Phaser.Geom.Rectangle.Contains,
  );
  ov.add(dim);

  const px = 8;
  const py = 8;
  const pw = CANVAS_WIDTH - 16;
  const ph = CANVAS_HEIGHT - 16;
  const panel = addFramedPanel(scene, {
    x: px,
    y: py,
    w: pw,
    h: ph,
    radius: 10,
    fillColor: DUNGEON_UI.STONE,
    borderColor: DUNGEON_UI.IRON,
    borderAlpha: 1,
    borderWidth: 2,
    accentColor: accent,
    accentAlpha: 0.92,
    shadowOpacity: 0.5,
    shadowOffsetY: 4,
  });
  addToContainer(ov, panel.shadow, panel.panel, panel.glow);

  const heroX = px + 10;
  const heroY = py + 10;
  const heroW = pw - 20;
  const heroH = 145;
  const hero = scene.add.graphics();
  hero.fillStyle(DUNGEON_UI.SOOT, 1);
  hero.fillRoundedRect(heroX, heroY, heroW, heroH, 8);
  hero.fillStyle(accent, 0.08);
  hero.fillRoundedRect(heroX + 8, heroY + 8, 112, heroH - 16, 7);
  hero.fillStyle(roomPlan.accent, 0.12);
  hero.fillRoundedRect(heroX + 122, heroY + 112, heroW - 132, 25, 5);
  hero.lineStyle(1, DUNGEON_UI.EDGE, 0.48);
  hero.strokeRoundedRect(heroX, heroY, heroW, heroH, 8);
  hero.lineStyle(1, accent, 0.56);
  hero.lineBetween(heroX + 124, heroY + 9, heroX + 124, heroY + heroH - 9);
  hero.fillStyle(0xffffff, 0.06);
  hero.fillRect(heroX + 8, heroY + 5, heroW - 16, 2);
  ov.add(hero);

  addMonsterPortrait(scene, ov, heroX + 64, heroY + 69, monster.id, {
    size: 104,
    frameColor: collection.color,
    glowColor: accent,
    bgColor: DUNGEON_UI.VOID,
    equippedSkins: loadGameState().equippedSkins ?? {},
  });

  ov.add(scene.add.text(heroX + 64, heroY + 127, collection.stars, {
    fontFamily: 'Georgia, serif',
    fontSize: '11px',
    color: collection.css,
  }).setOrigin(0.5));
  ov.add(scene.add.text(heroX + 136, heroY + 18,
    collection.tier + ' · ' + collection.label + ' · ' + (DETAIL_TYPE_LABEL[def.type] ?? '수호자'), {
      fontFamily: 'sans-serif',
      fontSize: '10px',
      fontStyle: 'bold',
      color: collection.css,
    }).setOrigin(0, 0.5));
  ov.add(scene.add.text(heroX + 136, heroY + 42, def.name, {
    fontFamily: 'sans-serif',
    fontSize: '19px',
    fontStyle: 'bold',
    color: DUNGEON_UI_CSS.PARCHMENT,
  }).setOrigin(0, 0.5));
  ov.add(scene.add.text(heroX + 136, heroY + 64,
    'Lv.' + monster.level + '   ATK ' + atk, {
      fontFamily: 'monospace',
      fontSize: '12px',
      fontStyle: 'bold',
      color: DUNGEON_UI_CSS.BRASS,
    }).setOrigin(0, 0.5));
  ov.add(scene.add.text(heroX + heroW - 12, heroY + 64,
    'CD ' + def.attackCooldown + ' · RNG ' + def.range, {
      fontFamily: 'monospace',
      fontSize: '10px',
      color: DUNGEON_UI_CSS.MUTED,
    }).setOrigin(1, 0.5));

  const xpX = heroX + 136;
  const xpW = heroW - 148;
  hero.fillStyle(DUNGEON_UI.VOID, 1);
  hero.fillRoundedRect(xpX, heroY + 82, xpW, 9, 3);
  hero.fillStyle(xpPct >= 0.82 ? DUNGEON_UI.BRASS_BRIGHT : DUNGEON_UI.JADE, 1);
  hero.fillRoundedRect(xpX, heroY + 82, Math.max(3, xpW * xpPct), 9, 3);
  hero.lineStyle(1, DUNGEON_UI.EDGE, 0.54);
  hero.strokeRoundedRect(xpX, heroY + 82, xpW, 9, 3);
  ov.add(scene.add.text(xpX, heroY + 102,
    monster.level >= 50 ? '최대 성장' : 'EXP ' + monster.xp + '/' + xpNeeded, {
      fontFamily: 'sans-serif',
      fontSize: '10px',
      color: DUNGEON_UI_CSS.MUTED,
    }).setOrigin(0, 0.5));
  ov.add(scene.add.text(heroX + heroW - 12, heroY + 102,
    '장비 ' + (monster.equipment ? '장착' : '미장착') + ' · SP ' + (monster.skillPoints ?? 0), {
      fontFamily: 'sans-serif',
      fontSize: '10px',
      fontStyle: 'bold',
      color: monster.equipment ? DUNGEON_UI_CSS.JADE : DUNGEON_UI_CSS.BRASS,
    }).setOrigin(1, 0.5));
  ov.add(scene.add.text(heroX + 136, heroY + 124, roomPlan.label, {
    fontFamily: 'sans-serif',
    fontSize: '10px',
    fontStyle: 'bold',
    color: roomPlan.kind === 'deployed' ? DUNGEON_UI_CSS.JADE : DUNGEON_UI_CSS.TEXT,
  }).setOrigin(0, 0.5));
  ov.add(scene.add.text(heroX + heroW - 12, heroY + 124, roomPlan.subLabel, {
    fontFamily: 'sans-serif',
    fontSize: '10px',
    color: DUNGEON_UI_CSS.MUTED,
  }).setOrigin(1, 0.5));

  const closeTopBg = scene.add.graphics();
  closeTopBg.fillStyle(DUNGEON_UI.STONE_RAISED, 1);
  closeTopBg.fillRoundedRect(px + pw - 52, py + 14, 38, 38, 7);
  closeTopBg.lineStyle(1, DUNGEON_UI.EDGE, 0.8);
  closeTopBg.strokeRoundedRect(px + pw - 52, py + 14, 38, 38, 7);
  ov.add(closeTopBg);
  ov.add(scene.add.text(px + pw - 33, py + 33, '×', {
    fontFamily: 'sans-serif',
    fontSize: '22px',
    color: DUNGEON_UI_CSS.TEXT,
  }).setOrigin(0.5));
  const closeTopZone = scene.add.zone(px + pw - 55, py + 11, 44, 44)
    .setOrigin(0)
    .setInteractive({ useHandCursor: true });
  closeTopZone.on('pointerdown', () => {
    ov.destroy();
    onClose();
  });
  ov.add(closeTopZone);

  let activeTab: MonsterDetailTab = initialTab;
  let bodyContainer: Phaser.GameObjects.Container | undefined;
  let tabContainer: Phaser.GameObjects.Container | undefined;

  const renderTabs = (): void => {
    tabContainer?.destroy();
    tabContainer = scene.add.container(0, 0);
    ov.add(tabContainer);
    const tabs: ReadonlyArray<{ key: MonsterDetailTab; label: string }> = [
      { key: 'growth', label: '성장' },
      { key: 'loadout', label: '장비 · 스킬' },
      { key: 'bond', label: '교감' },
      { key: 'appearance', label: '외형' },
    ];
    const tabY = py + 169;
    const gap = 5;
    const tabW = (pw - 20 - gap * (tabs.length - 1)) / tabs.length;
    tabs.forEach((tab, index) => {
      const x = px + 10 + index * (tabW + gap);
      const selected = tab.key === activeTab;
      const g = scene.add.graphics();
      g.fillStyle(selected ? DUNGEON_UI.STONE_RAISED : DUNGEON_UI.SOOT, 1);
      g.fillRoundedRect(x, tabY, tabW, 44, 5);
      if (selected) {
        g.fillStyle(tab.key === 'growth' ? DUNGEON_UI.BRASS : DUNGEON_UI.JADE, 0.9);
        g.fillRect(x + 10, tabY + 39, tabW - 20, 3);
      }
      g.lineStyle(1, selected ? DUNGEON_UI.BRASS : DUNGEON_UI.IRON, selected ? 0.82 : 0.64);
      g.strokeRoundedRect(x, tabY, tabW, 44, 5);
      tabContainer!.add(g);
      tabContainer!.add(scene.add.text(x + tabW / 2, tabY + 22, tab.label, {
        fontFamily: 'sans-serif',
        fontSize: '11px',
        fontStyle: selected ? 'bold' : 'normal',
        color: selected ? DUNGEON_UI_CSS.PARCHMENT : DUNGEON_UI_CSS.MUTED,
      }).setOrigin(0.5));
      if (!selected) {
        const zone = scene.add.zone(x, tabY, tabW, 44)
          .setOrigin(0)
          .setName(`monster-detail-tab-${tab.key}`)
          .setInteractive({ useHandCursor: true });
        zone.on('pointerdown', () => {
          activeTab = tab.key;
          renderTabs();
          renderBody();
        });
        tabContainer!.add(zone);
      }
    });
  };

  const sectionContext: MonsterDetailContext = {
    ...ctx,
    onRefresh: (updated) => {
      if (ov.active) ov.destroy();
      onRefresh(updated, activeTab);
    },
    onOpenForge: ctx.onOpenForge
      ? (target) => {
          if (ov.active) ov.destroy();
          ctx.onOpenForge?.(target);
        }
      : undefined,
  };

  const renderGrowthBody = (container: Phaser.GameObjects.Container): void => {
    buildGrowthCommandPanel(
      sectionContext,
      container,
      monster,
      tree,
      px + 14,
      py + 221,
      pw - 28,
      accent,
    );

    const feedAction = buildFeedTrainingAction(scene, {
      x: px + 14,
      y: py + 279,
      w: pw - 28,
      h: 52,
      monster,
      state: loadGameState(),
      accentColor: accent,
      onPress: () => {
        const liveState = loadGameState();
        if (monster.level >= 50) {
          feedAction.setMessage('성장 완료', '최대 레벨 수호자입니다', 'MAX', DUNGEON_UI_CSS.JADE);
          scene.time.delayedCall(1200, feedAction.resetMessage);
          return;
        }
        const result = feedOwnedMonster(liveState, monster.id, FEED_GOLD_COST, FEED_XP_GAIN);
        if (!result.ok) {
          const message = result.reason === 'insufficient_gold'
            ? FEED_GOLD_COST + '골드 필요 · 보유 ' + (liveState.homeGold ?? 0)
            : '저장된 수호자를 찾을 수 없습니다';
          feedAction.setMessage(
            result.reason === 'insufficient_gold' ? '골드 부족' : '몬스터 없음',
            message,
            '확인',
            DUNGEON_UI_CSS.EMBER,
          );
          scene.time.delayedCall(1200, feedAction.resetMessage);
          return;
        }

        saveGameState(result.state);
        const didLevelUp = result.monster.level > monster.level;
        if (didLevelUp) {
          const levelUp = scene.add.text(
            CANVAS_WIDTH / 2,
            CANVAS_HEIGHT / 2 - 80,
            'LEVEL UP  ·  Lv.' + result.monster.level, {
              fontFamily: 'sans-serif',
              fontSize: '20px',
              fontStyle: 'bold',
              color: DUNGEON_UI_CSS.PARCHMENT,
              stroke: '#3d2513',
              strokeThickness: 5,
            },
          ).setOrigin(0.5).setDepth(310).setScale(0.7).setAlpha(0);
          ov.add(levelUp);
          scene.tweens.add({
            targets: levelUp,
            scaleX: 1,
            scaleY: 1,
            alpha: 1,
            duration: 220,
            ease: 'Back.easeOut',
          });
          feedAction.setMessage(
            '레벨 업',
            'Lv.' + result.monster.level + ' 달성 · SP ' + (result.monster.skillPoints ?? 0),
            '완료',
            DUNGEON_UI_CSS.BRASS,
          );
        } else {
          feedAction.setMessage('훈련 완료', 'EXP +' + FEED_XP_GAIN + ' 적용', '완료', DUNGEON_UI_CSS.JADE);
        }

        scene.time.delayedCall(1200, () => {
          if (ov.active) ov.destroy();
          onRefresh(result.monster);
        });
      },
    });
    addToContainer(container, ...feedAction.objects);

    container.add(scene.add.text(px + 18, py + 349, '스킬 계보', {
      fontFamily: 'sans-serif',
      fontSize: '13px',
      fontStyle: 'bold',
      color: DUNGEON_UI_CSS.PARCHMENT,
    }));
    container.add(scene.add.text(px + pw - 18, py + 350,
      '사용 가능 SP ' + (monster.skillPoints ?? 0), {
        fontFamily: 'sans-serif',
        fontSize: '10px',
        color: (monster.skillPoints ?? 0) > 0 ? DUNGEON_UI_CSS.BRASS : DUNGEON_UI_CSS.MUTED,
      }).setOrigin(1, 0));
    buildSkillTreeSection(sectionContext, container, monster, tree, px + 14, py + 378, pw - 28);
  };

  const renderLoadoutBody = (container: Phaser.GameObjects.Container): void => {
    container.add(scene.add.text(px + 18, py + 228, '전투 장비', {
      fontFamily: 'sans-serif',
      fontSize: '14px',
      fontStyle: 'bold',
      color: DUNGEON_UI_CSS.PARCHMENT,
    }));
    container.add(scene.add.text(px + pw - 18, py + 230, '전력 보강과 추천 장착', {
      fontFamily: 'sans-serif',
      fontSize: '10px',
      color: DUNGEON_UI_CSS.MUTED,
    }).setOrigin(1, 0));
    buildEquipmentSlot(sectionContext, container, monster, px + 14, py + 253, pw - 28);

    container.add(scene.add.text(px + 18, py + 438, '장착 스킬', {
      fontFamily: 'sans-serif',
      fontSize: '14px',
      fontStyle: 'bold',
      color: DUNGEON_UI_CSS.PARCHMENT,
    }));
    container.add(scene.add.text(px + pw - 18, py + 440,
      '보유 스킬을 탭해 교체', {
        fontFamily: 'sans-serif',
        fontSize: '10px',
        color: DUNGEON_UI_CSS.MUTED,
      }).setOrigin(1, 0));
    buildEquippedSkillSlots(sectionContext, container, monster, px + 14, py + 464, pw - 28);

    const plan = scene.add.graphics();
    plan.fillStyle(DUNGEON_UI.SOOT, 0.96);
    plan.fillRoundedRect(px + 14, py + 534, pw - 28, 68, 7);
    plan.fillStyle(roomPlan.accent, 0.14);
    plan.fillRect(px + 15, py + 535, 4, 66);
    plan.lineStyle(1.5, roomPlan.accent, 0.62);
    plan.strokeRoundedRect(px + 14, py + 534, pw - 28, 68, 7);
    container.add(plan);
    container.add(scene.add.text(px + 28, py + 552, '추천 배치 방', {
      fontFamily: 'sans-serif',
      fontSize: '10px',
      fontStyle: 'bold',
      color: DUNGEON_UI_CSS.MUTED,
    }).setOrigin(0, 0.5));
    container.add(scene.add.text(px + 28, py + 573, roomPlan.label, {
      fontFamily: 'sans-serif',
      fontSize: '13px',
      fontStyle: 'bold',
      color: DUNGEON_UI_CSS.PARCHMENT,
    }).setOrigin(0, 0.5));
    container.add(scene.add.text(px + pw - 28, py + 573, roomPlan.subLabel, {
      fontFamily: 'sans-serif',
      fontSize: '10px',
      color: DUNGEON_UI_CSS.JADE,
    }).setOrigin(1, 0.5));
  };

  const renderAppearanceBody = (container: Phaser.GameObjects.Container): void => {
    container.add(scene.add.text(px + 18, py + 228, '수호자 외형', {
      fontFamily: 'sans-serif',
      fontSize: '14px',
      fontStyle: 'bold',
      color: DUNGEON_UI_CSS.PARCHMENT,
    }));
    container.add(scene.add.text(px + pw - 18, py + 230, '전투 능력은 변하지 않습니다', {
      fontFamily: 'sans-serif',
      fontSize: '10px',
      color: DUNGEON_UI_CSS.MUTED,
    }).setOrigin(1, 0));
    buildSkinSlot(sectionContext, container, monster, px + 14, py + 256, pw - 28);
  };

  const showBondToast = (text: string, color: string): void => {
    const t = scene.add.text(px + pw / 2, py + ph - 70, text, {
      fontFamily: 'sans-serif', fontSize: '11px', fontStyle: 'bold', color,
      backgroundColor: '#080b09', padding: { x: 12, y: 7 }, wordWrap: { width: pw - 40 }, align: 'center',
    }).setOrigin(0.5).setDepth(120).setAlpha(0);
    ov.add(t);
    scene.tweens.add({ targets: t, alpha: 1, duration: 160, onComplete: () => {
      scene.tweens.add({ targets: t, alpha: 0, duration: 260, delay: 1500, onComplete: () => t.destroy() });
    } });
  };

  const renderBondBody = (container: Phaser.GameObjects.Container): void => {
    buildBondTab(sectionContext, container, monster, {
      x: px + 14, y: py + 228, w: pw - 28,
      rerender: () => renderBody(),
      toast: showBondToast,
    });
  };

  const renderBody = (): void => {
    bodyContainer?.destroy();
    bodyContainer = scene.add.container(0, 0);
    ov.add(bodyContainer);
    if (activeTab === 'growth') renderGrowthBody(bodyContainer);
    if (activeTab === 'loadout') renderLoadoutBody(bodyContainer);
    if (activeTab === 'bond') renderBondBody(bodyContainer);
    if (activeTab === 'appearance') renderAppearanceBody(bodyContainer);
  };

  renderTabs();
  renderBody();

  if (ctx.focusSourceLabel) {
    ov.add(scene.add.text(heroX + 136, heroY + 18, ctx.focusSourceLabel + ' 성장 관리', {
      fontFamily: 'sans-serif',
      fontSize: '10px',
      fontStyle: 'bold',
      color: DUNGEON_UI_CSS.JADE,
      backgroundColor: '#0b1812',
      padding: { x: 4, y: 2 },
    }).setOrigin(0, 0.5));
  }

  if (ctx.onReturnToRoom) {
    const returnButton = addPrimaryActionButton(scene, {
      x: px + 14,
      y: py + ph - 50,
      w: 168,
      h: 44,
      label: '방으로 복귀',
      fontSize: '12px',
      fillColor: DUNGEON_UI.JADE,
      hoverFillColor: 0x65ad8a,
      borderColor: DUNGEON_UI.IRON,
      hoverBorderColor: DUNGEON_UI.BRASS,
      textColor: '#ffffff',
      onPress: () => {
        ov.destroy();
        onClose();
        ctx.onReturnToRoom?.();
      },
    });
    addToContainer(ov, returnButton.bg, returnButton.text, returnButton.zone);
  }

  const closeX = ctx.onReturnToRoom ? px + 192 : px + 14;
  const closeW = ctx.onReturnToRoom ? 168 : pw - 28;
  const closeButton = addPrimaryActionButton(scene, {
    x: closeX,
    y: py + ph - 50,
    w: closeW,
    h: 44,
    label: '훈련소로 돌아가기',
    fontSize: '12px',
    fillColor: DUNGEON_UI.SOOT,
    hoverFillColor: DUNGEON_UI.STONE_RAISED,
    borderColor: DUNGEON_UI.IRON,
    hoverBorderColor: DUNGEON_UI.BRASS,
    textColor: DUNGEON_UI_CSS.TEXT,
    onPress: () => {
      ov.destroy();
      onClose();
    },
  });
  addToContainer(ov, closeButton.bg, closeButton.text, closeButton.zone);

  ov.setAlpha(0).setScale(0.96);
  scene.tweens.add({
    targets: ov,
    alpha: 1,
    scaleX: 1,
    scaleY: 1,
    duration: 220,
    ease: 'Quad.easeOut',
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
  dim.fillStyle(0x000000, 0.76);
  dim.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  dim.setInteractive(
    new Phaser.Geom.Rectangle(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT),
    Phaser.Geom.Rectangle.Contains,
  );
  ov.add(dim);

  const panelW = 360;
  const panelH = 520;
  const panelX = (CANVAS_WIDTH - panelW) / 2;
  const panelY = (CANVAS_HEIGHT - panelH) / 2;
  const panel = addFramedPanel(scene, {
    x: panelX,
    y: panelY,
    w: panelW,
    h: panelH,
    radius: 10,
    fillColor: DUNGEON_UI.STONE,
    borderColor: DUNGEON_UI.IRON,
    borderAlpha: 1,
    borderWidth: 2,
    accentColor: 0x8f6eb7,
    accentAlpha: 0.9,
    shadowOpacity: 0.52,
    shadowOffsetY: 5,
  });
  addToContainer(ov, panel.shadow, panel.panel, panel.glow);

  ov.add(scene.add.text(CANVAS_WIDTH / 2, panelY + 24, '스킬 전술실', {
    fontFamily: 'sans-serif',
    fontSize: '19px',
    fontStyle: 'bold',
    color: DUNGEON_UI_CSS.PARCHMENT,
  }).setOrigin(0.5));

  const state = loadGameState();
  ov.add(scene.add.text(CANVAS_WIDTH / 2, panelY + 50,
    '보유 재화  ·  골드 ' + state.homeGold + '  ·  보석 ' + state.gems, {
      fontFamily: 'sans-serif',
      fontSize: '10px',
      fontStyle: 'bold',
      color: DUNGEON_UI_CSS.MUTED,
    }).setOrigin(0.5));

  const day = Math.floor(Date.now() / 86400000);
  const available = [...ACTIVE_SKILLS].sort((a, b) =>
    Math.sin(day * 999 + ACTIVE_SKILLS.indexOf(a))
      - Math.sin(day * 999 + ACTIVE_SKILLS.indexOf(b)));
  const daily = available.slice(0, 4);
  const cardW = 158;
  const cardH = 166;
  const cardGap = 12;
  const startX = panelX + 16;
  const startY = panelY + 70;
  const accents = [DUNGEON_UI.EMBER, 0x5b8bb7, DUNGEON_UI.JADE, 0x8f6eb7];

  daily.forEach((skill, index) => {
    const row = Math.floor(index / 2);
    const col = index % 2;
    const x = startX + col * (cardW + cardGap);
    const y = startY + row * (cardH + 10);
    const owned = state.ownedActiveSkills.includes(skill.id);
    const accent = owned ? DUNGEON_UI.JADE : accents[index];

    const card = scene.add.graphics();
    card.fillStyle(DUNGEON_UI.SOOT, 1);
    card.fillRoundedRect(x, y, cardW, cardH, 8);
    card.fillStyle(accent, 0.12);
    card.fillRoundedRect(x + 8, y + 8, 38, 38, 6);
    card.lineStyle(1.5, accent, owned ? 0.82 : 0.58);
    card.strokeRoundedRect(x, y, cardW, cardH, 8);
    drawGrowthSigil(card, x + 27, y + 27, accent, 0.94);
    ov.add(card);

    ov.add(scene.add.text(x + 54, y + 22, skill.name, {
      fontFamily: 'sans-serif',
      fontSize: '13px',
      fontStyle: 'bold',
      color: DUNGEON_UI_CSS.PARCHMENT,
    }).setOrigin(0, 0.5));
    ov.add(scene.add.text(x + 54, y + 39, '쿨다운 ' + skill.cooldown + '초', {
      fontFamily: 'sans-serif',
      fontSize: '10px',
      color: owned ? DUNGEON_UI_CSS.JADE : DUNGEON_UI_CSS.MUTED,
    }).setOrigin(0, 0.5));
    ov.add(scene.add.text(x + 12, y + 60, skill.desc, {
      fontFamily: 'sans-serif',
      fontSize: '10px',
      color: DUNGEON_UI_CSS.TEXT,
      wordWrap: { width: cardW - 24, useAdvancedWrap: true },
      maxLines: 2,
      lineSpacing: 2,
    }).setOrigin(0, 0));

    const label = owned
      ? '보유 중'
      : '골드 ' + skill.goldCost + ' · 보석 ' + skill.gemCost;
    const button = addPrimaryActionButton(scene, {
      x: x + 10,
      y: y + cardH - 54,
      w: cardW - 20,
      h: 44,
      label,
      fontSize: '10px',
      enabled: !owned,
      fillColor: DUNGEON_UI.STONE_RAISED,
      hoverFillColor: 0x2b362e,
      borderColor: accent,
      hoverBorderColor: DUNGEON_UI.BRASS_BRIGHT,
      disabledFillColor: DUNGEON_UI.SOOT,
      disabledBorderColor: DUNGEON_UI.JADE,
      textColor: '#' + accent.toString(16).padStart(6, '0'),
      disabledTextColor: DUNGEON_UI_CSS.JADE,
      onPress: () => {
        const liveState = loadGameState();
        const result = purchaseActiveSkillWithGold(liveState, skill.id, skill.goldCost);
        if (!result.ok) {
          button.text.setText('골드 부족').setColor(DUNGEON_UI_CSS.EMBER);
          scene.time.delayedCall(1200, () => {
            if (button.text.active) button.text.setText(label).setColor(
              '#' + accent.toString(16).padStart(6, '0'),
            );
          });
          return;
        }
        if (result.changed) saveGameState(result.state);
        ov.destroy();
        onReshop();
      },
    });
    addToContainer(ov, button.bg, button.text, button.zone);
  });

  const closeButton = addPrimaryActionButton(scene, {
    x: panelX + 16,
    y: panelY + panelH - 56,
    w: panelW - 32,
    h: 44,
    label: '전술실 닫기',
    fontSize: '12px',
    fillColor: DUNGEON_UI.SOOT,
    hoverFillColor: DUNGEON_UI.STONE_RAISED,
    borderColor: DUNGEON_UI.IRON,
    hoverBorderColor: DUNGEON_UI.BRASS,
    textColor: DUNGEON_UI_CSS.TEXT,
    onPress: () => {
      ov.destroy();
      onClose();
    },
  });
  addToContainer(ov, closeButton.bg, closeButton.text, closeButton.zone);

  ov.setY(18).setAlpha(0);
  scene.tweens.add({
    targets: ov,
    y: 0,
    alpha: 1,
    duration: 220,
    ease: 'Quad.easeOut',
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
