import { CANVAS_HEIGHT, CANVAS_WIDTH } from '../constants/layout';
import { DUNGEON_UI, DUNGEON_UI_CSS } from '../constants/colors';
import { loadGameState, saveGameState } from '../data/wisdom';
import { type OwnedMonster, AWAKENED_ATK_MULT } from '../data/barracks';
import { applyFusionAwakening } from '../data/fusionTransactions';
import {
  AWAKENED_PASSIVES,
  getBaseId,
  getMonsterDisplayName,
} from '../data/fusion';
import { logger } from '../utils/logger';
import { addMonsterPortrait } from './MonsterPortraitView';
import { addPrimaryActionButton, addProgressBar } from './GameUiPrimitives';
import {
  type FusionTabContext,
  TAB_ACCENT,
  bindFusionTransactionAction,
  openMonsterPicker,
  showConfirmDialog,
  showFusionAnimation,
  showFusionResultPanel,
} from './FusionTabs';

export interface AwakeningState {
  readonly awakenTarget: OwnedMonster | null;
  readonly setAwakenTarget: (monster: OwnedMonster | null) => void;
}

export function buildAwakeningTab(
  ctx: FusionTabContext,
  c: Phaser.GameObjects.Container,
  state: AwakeningState,
): void {
  const gameState = loadGameState();
  const target = state.awakenTarget;
  const affinity = target ? gameState.monsterAffinity?.[target.id] ?? 0 : 0;
  const awakened = target ? gameState.monsterAwakened?.[target.id] ?? false : false;
  const stones = gameState.awakeningStones ?? 0;
  const eligible = Boolean(target) && affinity >= 100 && !awakened && stones >= 1;
  const affectedCount = target
    ? gameState.ownedMonsters.filter(monster => monster.id === target.id).length
    : 0;
  const passive = target ? AWAKENED_PASSIVES[getBaseId(target.id)] : undefined;

  const panelX = 18;
  const panelY = ctx.contentY + 154;
  const panelW = CANVAS_WIDTH - 36;
  const panelH = CANVAS_HEIGHT - panelY - 18;
  const panel = ctx.scene.add.graphics();
  panel.fillStyle(DUNGEON_UI.STONE, 0.96);
  panel.fillRoundedRect(panelX, panelY, panelW, panelH, 10);
  panel.lineStyle(1, DUNGEON_UI.IRON, 0.9);
  panel.strokeRoundedRect(panelX, panelY, panelW, panelH, 10);
  c.add(panel);

  c.add(ctx.scene.add.text(panelX + 16, panelY + 20, '각성 서약진', {
    fontFamily: 'sans-serif', fontSize: '15px', color: DUNGEON_UI_CSS.PARCHMENT, fontStyle: 'bold',
  }).setOrigin(0, 0.5));
  c.add(ctx.scene.add.text(panelX + panelW - 16, panelY + 20, '친밀도 100 · 각성석 1', {
    fontFamily: 'sans-serif', fontSize: '10px', color: '#aeb8ed', fontStyle: 'bold',
  }).setOrigin(1, 0.5));

  const targetX = panelX + 16;
  const targetY = panelY + 44;
  const targetW = 132;
  const targetH = 148;
  const targetBg = ctx.scene.add.graphics();
  targetBg.fillStyle(DUNGEON_UI.SOOT, 0.98);
  targetBg.fillRoundedRect(targetX, targetY, targetW, targetH, 8);
  targetBg.lineStyle(1.5, target ? TAB_ACCENT['각성'] : DUNGEON_UI.IRON, target ? 0.85 : 0.7);
  targetBg.strokeRoundedRect(targetX, targetY, targetW, targetH, 8);
  c.add(targetBg);

  if (target) {
    addMonsterPortrait(ctx.scene, c, targetX + targetW / 2, targetY + 58, target.id, {
      size: 86, frameColor: TAB_ACCENT['각성'], glowColor: TAB_ACCENT['각성'],
      bgColor: DUNGEON_UI.VOID, equippedSkins: gameState.equippedSkins,
    });
    c.add(ctx.scene.add.text(targetX + targetW / 2, targetY + 111, getMonsterDisplayName(target.id), {
      fontFamily: 'sans-serif', fontSize: '13px', color: DUNGEON_UI_CSS.TEXT, fontStyle: 'bold',
      align: 'center', wordWrap: { width: targetW - 10 },
    }).setOrigin(0.5));
    c.add(ctx.scene.add.text(targetX + targetW / 2, targetY + 134, `Lv.${target.level} · 대상 변경`, {
      fontFamily: 'sans-serif', fontSize: '10px', color: '#aeb8ed', fontStyle: 'bold',
    }).setOrigin(0.5));
  } else {
    c.add(ctx.scene.add.text(targetX + targetW / 2, targetY + 62, '각성 대상 없음', {
      fontFamily: 'sans-serif', fontSize: '12px', color: DUNGEON_UI_CSS.MUTED, fontStyle: 'bold',
    }).setOrigin(0.5));
    c.add(ctx.scene.add.text(targetX + targetW / 2, targetY + 91, '눌러서 선택', {
      fontFamily: 'sans-serif', fontSize: '10px', color: '#aeb8ed',
    }).setOrigin(0.5));
  }
  const targetZone = ctx.scene.add.zone(targetX, targetY, targetW, targetH).setOrigin(0)
    .setInteractive({ useHandCursor: true });
  targetZone.once('pointerdown', () => {
    openMonsterPicker(ctx, undefined, monster => {
      state.setAwakenTarget(monster);
      ctx.refreshTab();
    });
  });
  c.add(targetZone);

  const infoX = targetX + targetW + 14;
  const infoW = panelX + panelW - 16 - infoX;
  c.add(ctx.scene.add.text(infoX, targetY + 10, '서약 조건', {
    fontFamily: 'sans-serif', fontSize: '10px', color: DUNGEON_UI_CSS.MUTED, fontStyle: 'bold',
  }).setOrigin(0, 0.5));
  c.add(ctx.scene.add.text(infoX, targetY + 34, `친밀도 ${affinity}/100`, {
    fontFamily: 'sans-serif', fontSize: '12px',
    color: affinity >= 100 ? DUNGEON_UI_CSS.JADE : DUNGEON_UI_CSS.TEXT,
    fontStyle: 'bold',
  }).setOrigin(0, 0.5));
  const progress = addProgressBar(ctx.scene, {
    x: infoX, y: targetY + 48, w: infoW, h: 9, ratio: affinity / 100,
    fillColor: TAB_ACCENT['각성'], trackColor: DUNGEON_UI.SOOT,
    borderColor: DUNGEON_UI.IRON, animate: false,
  });
  c.add([progress.track, progress.fill]);
  c.add(ctx.scene.add.text(infoX, targetY + 78, `각성석 ${stones}개`, {
    fontFamily: 'sans-serif', fontSize: '12px',
    color: stones >= 1 ? '#aeb8ed' : DUNGEON_UI_CSS.EMBER,
    fontStyle: 'bold',
  }).setOrigin(0, 0.5));
  c.add(ctx.scene.add.text(infoX, targetY + 106,
    awakened ? '이미 각성한 개체' : eligible ? '모든 조건 충족' : '조건 미충족', {
      fontFamily: 'sans-serif', fontSize: '12px',
      color: awakened ? '#aeb8ed' : eligible ? DUNGEON_UI_CSS.JADE : DUNGEON_UI_CSS.EMBER,
      fontStyle: 'bold',
    }).setOrigin(0, 0.5));
  c.add(ctx.scene.add.text(infoX, targetY + 132, `동일 ID ${affectedCount}체 적용`, {
    fontFamily: 'sans-serif', fontSize: '10px', color: DUNGEON_UI_CSS.MUTED,
  }).setOrigin(0, 0.5));

  const previewY = targetY + targetH + 18;
  const preview = ctx.scene.add.graphics();
  preview.fillStyle(DUNGEON_UI.SOOT, 0.96);
  preview.fillRoundedRect(panelX + 16, previewY, panelW - 32, 112, 8);
  preview.lineStyle(1, DUNGEON_UI.IRON, 0.78);
  preview.strokeRoundedRect(panelX + 16, previewY, panelW - 32, 112, 8);
  c.add(preview);
  c.add(ctx.scene.add.text(panelX + 30, previewY + 21, '각성 효과', {
    fontFamily: 'sans-serif', fontSize: '10px', color: DUNGEON_UI_CSS.MUTED, fontStyle: 'bold',
  }).setOrigin(0, 0.5));
  c.add(ctx.scene.add.text(panelX + 30, previewY + 48,
    target ? awakeningDeliveredEffect(affectedCount) : '대상을 선택하면 적용 범위를 계산합니다', {
      fontFamily: 'sans-serif', fontSize: '14px', color: '#aeb8ed', fontStyle: 'bold',
    }).setOrigin(0, 0.5));
  c.add(ctx.scene.add.text(panelX + 30, previewY + 78,
    passive ? `계보 전승(구현 예정) · ${passive.desc}` : '해당 계보의 전승 정보 없음', {
      fontFamily: 'sans-serif', fontSize: '11px', color: DUNGEON_UI_CSS.TEXT,
      wordWrap: { width: panelW - 60 },
    }).setOrigin(0, 0.5));

  const farm = addPrimaryActionButton(ctx.scene, {
    x: panelX + 16, y: previewY + 126, w: panelW - 32, h: 44,
    label: '각성석 획득처 · 심연 보스층으로 이동', fontSize: '12px', once: true,
    showArrow: false, fillColor: DUNGEON_UI.STONE_RAISED, borderColor: DUNGEON_UI.EDGE,
    hoverFillColor: DUNGEON_UI.IRON, hoverBorderColor: TAB_ACCENT['각성'],
    onPress: () => ctx.scene.scene.start('AbyssScene'),
  });
  c.add([farm.bg, farm.text, farm.zone]);

  const action = addPrimaryActionButton(ctx.scene, {
    x: panelX + 16, y: previewY + 182, w: panelW - 32, h: 48,
    label: eligible
      ? '각성 서약 준비'
      : awakened ? '이미 각성한 개체입니다' : '친밀도와 각성석을 확인하세요',
    fontSize: '15px', enabled: eligible, once: true, showArrow: false,
    fillColor: TAB_ACCENT['각성'], borderColor: DUNGEON_UI.BRASS_BRIGHT,
    hoverFillColor: TAB_ACCENT['각성'], hoverBorderColor: DUNGEON_UI.BRASS_BRIGHT,
    disabledFillColor: DUNGEON_UI.SOOT, disabledBorderColor: DUNGEON_UI.IRON,
    disabledTextColor: DUNGEON_UI_CSS.MUTED,
    onPress: () => {},
  });
  bindFusionTransactionAction(ctx, action, () => {
      if (!target) return;
      showConfirmDialog(
        ctx,
        `${getMonsterDisplayName(target.id)}의 서약을 완성합니다`,
        `각성석 1개 소모 · ${awakeningDeliveredEffect(affectedCount)}`,
        '각성',
        () => executeAwakening(ctx, state, target),
      );
    });
  c.add([action.bg, action.text, action.zone]);
}

/**
 * What awakening actually gives you, stated once and reused by the preview, the
 * confirm dialog and the success panel.
 *
 * `AWAKENED_PASSIVES` describes 30 bespoke mechanics (piercing attacks,
 * permanent auras, room immunity, execute-on-crit) that combat does not
 * implement — `monsterAwakened` has no reference under src/combat at all. Those
 * entries are a design backlog; printing one under the price read as a promise
 * of something the player would not receive, which is why the purchase surfaces
 * no longer do it.
 */
function awakeningDeliveredEffect(affectedCount: number): string {
  const bonus = Math.round((AWAKENED_ATK_MULT - 1) * 100);
  return `동일 ID ${affectedCount}체 모두 ATK stack +3 · 각성 ATK +${bonus}%`;
}

function executeAwakening(
  ctx: FusionTabContext,
  state: AwakeningState,
  monster: OwnedMonster,
): void {
  const result = applyFusionAwakening(loadGameState(), monster);
  if (!result.ok) {
    logger.warn(`[AWAKEN] rejected: ${result.reason}`);
    showFusionResultPanel(ctx, {
      tabId: '각성', status: 'failure', title: '각성 조건이 바뀌었습니다',
      detail: '친밀도, 각성 여부, 각성석 잔액을 다시 확인하세요.',
    });
    return;
  }

  saveGameState(result.state);
  state.setAwakenTarget(result.monster);
  logger.debug(`[AWAKEN] ${monster.id}; affected ${result.affectedCount}; stones ${result.state.awakeningStones}`);
  showFusionAnimation(ctx, '각성', () => {
    showFusionResultPanel(ctx, {
      tabId: '각성', title: `${getMonsterDisplayName(monster.id)} 각성 완료`,
      detail: awakeningDeliveredEffect(result.affectedCount),
    });
  });
}
