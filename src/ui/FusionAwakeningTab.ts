// ─── Awakening Tab ─────────────────────────────────────────────────────────────
// Implements the 각성 (Awakening) tab for FusionScene.
// Requires 100 affinity + 1 awakening stone → unlocks passive ability.

import { loadGameState, saveGameState } from '../data/wisdom';
import { type OwnedMonster } from '../data/barracks';
import { applyFusionAwakening } from '../data/fusionTransactions';
import {
  AWAKENED_PASSIVES,
  getBaseId, getMonsterEmoji, getMonsterDisplayName,
} from '../data/fusion';
import { logger } from '../utils/logger';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../constants/layout';
import {
  type FusionTabContext,
  showFusionAnimation, showResultToast,
} from './FusionTabs';

export function buildAwakeningTab(
  ctx: FusionTabContext,
  c: Phaser.GameObjects.Container,
): void {
  const gs  = loadGameState();
  const PAD = 16;
  const rowH = 70;
  const rowW = CANVAS_WIDTH - PAD * 2;
  let   y    = ctx.contentY + 238;

  c.add(ctx.scene.add.text(CANVAS_WIDTH / 2, y - 22,
    `친밀도 100 + 각성석 1개 → 몬스터 각성   🪨 보유: ${gs.awakeningStones ?? 0}개`, {
      fontFamily: 'Georgia, serif', fontSize: '11px', color: '#cc44cc',
    }).setOrigin(0.5));

  const monsters = gs.ownedMonsters;
  if (!monsters.length) {
    c.add(ctx.scene.add.text(CANVAS_WIDTH / 2, y + 50, '보유 몬스터 없음', {
      fontFamily: 'Georgia, serif', fontSize: '13px', color: '#442244',
    }).setOrigin(0.5));
    return;
  }

  monsters.forEach((m, i) => {
    const ry       = y + i * (rowH + 6);
    const affinity = gs.monsterAffinity?.[m.id] ?? 0;
    const awakened = gs.monsterAwakened?.[m.id] ?? false;
    const stones   = gs.awakeningStones ?? 0;
    const eligible = affinity >= 100 && !awakened && stones >= 1;

    const rg = ctx.scene.add.graphics().setDepth(3);
    const borderCol = awakened ? 0xcc44cc : eligible ? 0x663366 : 0x1a0a1a;
    rg.fillStyle(0x0d040d, 1);
    rg.fillRoundedRect(PAD, ry, rowW, rowH - 4, 6);
    rg.lineStyle(1.5, borderCol, awakened ? 1 : 0.7);
    rg.strokeRoundedRect(PAD, ry, rowW, rowH - 4, 6);
    c.add(rg);

    c.add(ctx.scene.add.text(PAD + 24, ry + (rowH - 4) / 2, getMonsterEmoji(m.id), {
      fontFamily: 'sans-serif', fontSize: '26px',
    }).setOrigin(0.5));

    c.add(ctx.scene.add.text(PAD + 48, ry + 10, getMonsterDisplayName(m.id), {
      fontFamily: 'Georgia, serif', fontSize: '12px',
      color: awakened ? '#cc44cc' : '#c8b090',
    }));
    c.add(ctx.scene.add.text(PAD + 48, ry + 26, `Lv.${m.level}`, {
      fontFamily: 'sans-serif', fontSize: '11px', color: '#664466',
    }));

    // Affinity bar
    const barX = PAD + 48, barY = ry + 40, barW = 120, barH = 6;
    const barBg = ctx.scene.add.graphics();
    barBg.fillStyle(0x220022, 1);
    barBg.fillRoundedRect(barX, barY, barW, barH, 2);
    if (affinity > 0) {
      barBg.fillStyle(0xcc44cc, 1);
      barBg.fillRoundedRect(barX, barY, Math.round(barW * affinity / 100), barH, 2);
    }
    c.add(barBg);
    c.add(ctx.scene.add.text(barX + barW + 4, barY + 3, `${affinity}/100`, {
      fontFamily: 'sans-serif', fontSize: '11px', color: '#884488',
    }).setOrigin(0, 0.5));

    if (awakened) {
      c.add(ctx.scene.add.text(CANVAS_WIDTH - PAD - 6, ry + (rowH - 4) / 2, '✨ 각성 완료', {
        fontFamily: 'Georgia, serif', fontSize: '10px', color: '#cc44cc',
      }).setOrigin(1, 0.5));
      const ap = AWAKENED_PASSIVES[getBaseId(m.id)];
      if (ap) {
        c.add(ctx.scene.add.text(CANVAS_WIDTH - PAD - 6, ry + (rowH - 4) / 2 + 14, ap.desc, {
          fontFamily: 'sans-serif', fontSize: '11px', color: '#884488',
        }).setOrigin(1, 0.5));
      }
    } else if (eligible) {
      const awakBtn = ctx.scene.add.text(CANVAS_WIDTH - PAD - 6, ry + (rowH - 4) / 2, '⚡ 각성 실행', {
        fontFamily: 'Georgia, serif', fontSize: '11px', color: '#cc44cc', fontStyle: 'bold',
        backgroundColor: '#2a003a', padding: { x: 8, y: 4 },
      }).setOrigin(1, 0.5).setInteractive();
      awakBtn.on('pointerdown', () => confirmAwakening(ctx, m));
      c.add(awakBtn);
    } else {
      const reasons: string[] = [];
      if (affinity < 100) reasons.push(`친밀도 ${affinity}/100`);
      if (stones < 1)     reasons.push('각성석 필요');
      c.add(ctx.scene.add.text(CANVAS_WIDTH - PAD - 6, ry + (rowH - 4) / 2, reasons.join(' · '), {
        fontFamily: 'sans-serif', fontSize: '11px', color: '#442244',
      }).setOrigin(1, 0.5));
    }
  });
}

function confirmAwakening(ctx: FusionTabContext, monster: OwnedMonster): void {
  const name    = getMonsterDisplayName(monster.id);
  const stoneGs = loadGameState();
  const passive = AWAKENED_PASSIVES[getBaseId(monster.id)];

  const ov = ctx.scene.add.container(0, 0).setDepth(80);
  const dim = ctx.scene.add.graphics();
  dim.fillStyle(0x000000, 0.75);
  dim.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  ov.add(dim);

  const PW = 300, PH = passive ? 220 : 198;
  const PX = (CANVAS_WIDTH - PW) / 2, PY = (CANVAS_HEIGHT - PH) / 2;
  const pg = ctx.scene.add.graphics();
  pg.fillStyle(0x0d000d, 1);
  pg.fillRoundedRect(PX, PY, PW, PH, 8);
  pg.lineStyle(2, 0xcc44cc, 0.9);
  pg.strokeRoundedRect(PX, PY, PW, PH, 8);
  ov.add(pg);

  ov.add(ctx.scene.add.text(CANVAS_WIDTH / 2, PY + 28, '각성 확인', {
    fontFamily: 'Georgia, serif', fontSize: '17px', color: '#cc44cc', fontStyle: 'bold',
  }).setOrigin(0.5));
  ov.add(ctx.scene.add.text(CANVAS_WIDTH / 2, PY + 60,
    `각성석 1개가 소모됩니다. 계속하시겠습니까?`, {
      fontFamily: 'sans-serif', fontSize: '12px', color: '#c8b0c8',
      align: 'center',
    }).setOrigin(0.5));
  ov.add(ctx.scene.add.text(CANVAS_WIDTH / 2, PY + 84, `▶ ${name}`, {
    fontFamily: 'Georgia, serif', fontSize: '12px', color: '#884488',
  }).setOrigin(0.5));
  ov.add(ctx.scene.add.text(CANVAS_WIDTH / 2, PY + 104, `🪨 보유 각성석: ${stoneGs.awakeningStones ?? 0}개`, {
    fontFamily: 'sans-serif', fontSize: '11px', color: '#664466',
  }).setOrigin(0.5));

  if (passive) {
    ov.add(ctx.scene.add.text(CANVAS_WIDTH / 2, PY + 126, `✨ ${passive.desc}`, {
      fontFamily: 'sans-serif', fontSize: '10px', color: '#cc44cc',
      align: 'center', wordWrap: { width: PW - 32 },
    }).setOrigin(0.5));
  }

  const confirmBtn = ctx.scene.add.text(CANVAS_WIDTH / 2 - 52, PY + PH - 36, '확인', {
    fontFamily: 'Georgia, serif', fontSize: '14px', color: '#cc44cc',
    backgroundColor: '#2a003a', padding: { x: 22, y: 8 },
  }).setOrigin(0.5).setInteractive();
  confirmBtn.on('pointerdown', () => { ov.destroy(true); executeAwakening(ctx, monster); });
  ov.add(confirmBtn);

  const cancelBtn = ctx.scene.add.text(CANVAS_WIDTH / 2 + 52, PY + PH - 36, '취소', {
    fontFamily: 'Georgia, serif', fontSize: '14px', color: '#664466',
    backgroundColor: '#150015', padding: { x: 22, y: 8 },
  }).setOrigin(0.5).setInteractive();
  cancelBtn.on('pointerdown', () => ov.destroy(true));
  ov.add(cancelBtn);

  ov.setAlpha(0);
  ctx.scene.tweens.add({ targets: ov, alpha: 1, duration: 200, ease: 'Quad.easeOut' });
}

function executeAwakening(ctx: FusionTabContext, monster: OwnedMonster): void {
  const result = applyFusionAwakening(loadGameState(), monster);
  if (!result.ok) return;

  saveGameState(result.state);
  logger.debug(`[AWAKEN] ${monster.id} awakened! Stones remaining: ${result.state.awakeningStones}`);

  showFusionAnimation(ctx, '각성', () => {
    ctx.refreshTab();
    showResultToast(ctx, `${getMonsterDisplayName(monster.id)} 각성 완료!`, '#cc44cc');
  });
}
