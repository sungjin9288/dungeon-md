/**
 * Story-invasion battle forecast modal showing deterministic heuristic results.
 */

import Phaser from 'phaser';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../constants/layout';
import { buildBattleForecast, type BattleForecastRisk, type StoryInvasionTarget } from '../data/battleForecast';
import type { GameState } from '../data/wisdom';
import { CASUAL, CASUAL_CSS } from '../constants/colors';

const RISK_COLOR: Record<BattleForecastRisk, number> = {
  secure: CASUAL.GREEN,
  guarded: CASUAL.GOLD,
  strained: CASUAL.RED,
  critical: CASUAL.RED_DK,
};

const RISK_LABEL: Record<BattleForecastRisk, string> = {
  secure: '안정',
  guarded: '경계',
  strained: '불안',
  critical: '위급',
};

export function openSimulationModal(
  scene: Phaser.Scene,
  gs: Readonly<GameState>,
  target: StoryInvasionTarget | null,
): void {
  const CW = CANVAS_WIDTH, CH = CANVAS_HEIGHT;

  // Overlay dim
  const dim = scene.add.graphics().setDepth(200);
  dim.fillStyle(0x000000, 0.75);
  dim.fillRect(0, 0, CW, CH);
  dim.setAlpha(0);
  scene.tweens.add({ targets: dim, alpha: 1, duration: 250 });
  const blocker = scene.add.zone(0, 0, CW, CH)
    .setOrigin(0)
    .setDepth(199)
    .setInteractive({ useHandCursor: true });

  // Card
  const cw = 340, ch = 410;
  const cx = (CW - cw) / 2, cy = (CH - ch) / 2;
  const card = scene.add.graphics().setDepth(201);
  card.fillStyle(CASUAL.PANEL, 1);
  card.fillRoundedRect(cx, cy, cw, ch, 8);
  card.lineStyle(2, CASUAL.EDGE, 0.9);
  card.strokeRoundedRect(cx, cy, cw, ch, 8);
  // Cave strata texture
  for (let ry = cy + 8; ry < cy + ch; ry += 18) {
    card.lineStyle(1, CASUAL.EDGE_SOFT, 0.03 + Math.random() * 0.03);
    card.lineBetween(cx + 4, ry, cx + cw - 4, ry);
  }
  card.setY(-60).setAlpha(0);
  scene.tweens.add({ targets: card, y: 0, alpha: 1, duration: 300, ease: 'Power2.easeOut' });

  const container = scene.add.container(0, 0).setDepth(202);
  container.add([dim, card]);

  // Title
  const title = scene.add.text(cx + cw / 2, cy + 22, '⚗  던전 전투 예측', {
    fontFamily: 'Georgia, serif', fontSize: '15px', fontStyle: 'bold', color: CASUAL_CSS.INK,
  }).setOrigin(0.5).setAlpha(0);
  container.add(title);
  scene.tweens.add({ targets: title, alpha: 1, duration: 250, delay: 150 });

  const forecast = target
    ? buildBattleForecast(target, gs.dungeonSlots ?? [], gs.ownedMonsters ?? [])
    : null;

  let closed = false;
  const close = (): void => {
    if (closed) return;
    closed = true;
    scene.tweens.add({ targets: [dim, card, container], alpha: 0, duration: 200,
      onComplete: () => {
        blocker.destroy();
        dim.destroy();
        card.destroy();
        container.destroy();
      },
    });
  };
  blocker.once('pointerdown', close);

  if (!forecast || forecast.status === 'incomplete' || !forecast.simulation || !forecast.risk) {
    const diagnosticLines = forecast?.diagnostics.map(diagnostic =>
      `웨이브 ${'waveNumber' in diagnostic ? diagnostic.waveNumber : diagnostic.waveNum}: ${diagnostic.invaderType}`,
    ) ?? ['침략 대상이 없습니다.'];
    const unavailable = scene.add.text(cx + cw / 2, cy + 104, '예측을 완료할 수 없습니다', {
      fontFamily: 'sans-serif', fontSize: '15px', color: CASUAL_CSS.RED, fontStyle: 'bold',
    }).setOrigin(0.5).setAlpha(0);
    const heuristic = scene.add.text(cx + cw / 2, cy + 132,
      forecast?.heuristicCopy ?? '결정론적 DPS·이동시간 휴리스틱을 계산할 수 없습니다.', {
        fontFamily: 'sans-serif', fontSize: '10px', color: CASUAL_CSS.INK_SOFT, wordWrap: { width: cw - 42 }, align: 'center',
      }).setOrigin(0.5, 0).setAlpha(0);
    const diagnostics = scene.add.text(cx + 20, cy + 194,
      `확인 필요: ${diagnosticLines.join(', ')}`, {
        fontFamily: 'monospace', fontSize: '10px', color: CASUAL_CSS.RED, wordWrap: { width: cw - 40 },
      }).setAlpha(0);
    container.add([unavailable, heuristic, diagnostics]);
    scene.tweens.add({ targets: [unavailable, heuristic, diagnostics], alpha: 1, duration: 180, delay: 160 });
    addCloseButton(scene, container, cx, cy, cw, ch, close);
    return;
  }

  const result = forecast.simulation;

  // DPS row
  const dpsColor = result.totalDps < 8 ? '#ff6666' : result.totalDps < 18 ? '#ffcc44' : '#44cc88';
  const dpsT = scene.add.text(cx + 16, cy + 50,
    `방어 DPS: ${result.totalDps.toFixed(1)} / 초 · 위험 ${RISK_LABEL[forecast.risk]}`, {
    fontFamily: 'sans-serif', fontSize: '11px', color: dpsColor,
  }).setAlpha(0);
  container.add(dpsT);
  scene.tweens.add({ targets: dpsT, alpha: 1, duration: 200, delay: 200 });

  // Remaining dungeon HP bar
  const barY = cy + 74;
  const barW = cw - 32;
  const hpRatio = result.startHp > 0 ? result.finalHp / result.startHp : 0;
  const barBg = scene.add.graphics().setAlpha(0).setDepth(202);
  barBg.fillStyle(CASUAL.PANEL_SOFT, 1);
  barBg.fillRoundedRect(cx + 16, barY, barW, 10, 3);
  const barFill = scene.add.graphics().setAlpha(0).setDepth(202);
  const fillColor = RISK_COLOR[forecast.risk];
  barFill.fillStyle(fillColor, 1);
  barFill.fillRoundedRect(cx + 16, barY, barW * hpRatio, 10, 3);
  const hpT = scene.add.text(cx + cw / 2, barY + 5, `남은 HP ${result.finalHp}/${result.startHp}`, {
    fontFamily: 'sans-serif', fontSize: '10px', color: '#ffffff',
  }).setOrigin(0.5).setAlpha(0).setDepth(203);
  container.add([barBg, barFill, hpT]);
  scene.tweens.add({ targets: [barBg, barFill, hpT], alpha: 1, duration: 200, delay: 280 });

  // Divider
  const divG = scene.add.graphics().setAlpha(0).setDepth(202);
  divG.lineStyle(1, CASUAL.EDGE, 0.3);
  divG.lineBetween(cx + 16, barY + 18, cx + cw - 16, barY + 18);
  container.add(divG);
  scene.tweens.add({ targets: divG, alpha: 1, duration: 150, delay: 320 });

  // Per-wave results (compact rows)
  const methodT = scene.add.text(cx + cw / 2, barY + 21, forecast.heuristicCopy, {
    fontFamily: 'sans-serif', fontSize: '10px', color: CASUAL_CSS.INK_SOFT,
    wordWrap: { width: cw - 40 }, align: 'center',
  }).setOrigin(0.5, 0).setAlpha(0).setDepth(202);
  container.add(methodT);
  scene.tweens.add({ targets: methodT, alpha: 1, duration: 180, delay: 320 });

  const waveStartY = barY + 63;
  const rowH = 22;
  const DIFF_COLOR: Record<string, string> = {
    easy: '#44cc88', medium: '#88ccff', hard: '#ffcc44', extreme: '#ff6666',
  };
  const DIFF_LABEL: Record<string, string> = {
    easy: '쉬움', medium: '보통', hard: '어려움', extreme: '위험',
  };

  const visibleWaves = result.waveResults.slice(0, 6);
  visibleWaves.forEach((wr, i) => {
    const wy = waveStartY + i * rowH;
    const rowT = scene.add.text(cx + 16, wy + 11, `${wr.waveNum}웨이브`, {
      fontFamily: 'sans-serif', fontSize: '9px', color: CASUAL_CSS.INK_SOFT,
    }).setOrigin(0, 0.5).setAlpha(0).setDepth(202);
    container.add(rowT);

    const diffT = scene.add.text(cx + 80, wy + 11,
      `${DIFF_LABEL[wr.difficulty]} (잔존 ${wr.survived}/${wr.invaderCount})`, {
      fontFamily: 'sans-serif', fontSize: '9px', color: DIFF_COLOR[wr.difficulty],
    }).setOrigin(0, 0.5).setAlpha(0).setDepth(202);
    container.add(diffT);

    const hpLostT = scene.add.text(cx + cw - 16, wy + 11,
      wr.hpLost > 0 ? `-${wr.hpLost}HP` : '무피해', {
      fontFamily: 'sans-serif', fontSize: '9px',
      color: wr.hpLost > 0 ? '#ff8888' : '#44cc88',
    }).setOrigin(1, 0.5).setAlpha(0).setDepth(202);
    container.add(hpLostT);

    scene.tweens.add({ targets: [rowT, diffT, hpLostT], alpha: 1, duration: 150, delay: 370 + i * 40 });
  });

  // Recommendation
  const recY = waveStartY + visibleWaves.length * rowH + 4;
  const recG = scene.add.graphics().setAlpha(0).setDepth(202);
  recG.lineStyle(1, CASUAL.EDGE, 0.3);
  recG.lineBetween(cx + 16, recY, cx + cw - 16, recY);
  container.add(recG);
  const recT = scene.add.text(cx + cw / 2, recY + 14, `💡 ${forecast.marginCopy}`, {
    fontFamily: 'sans-serif', fontSize: '10px', color: CASUAL_CSS.INK,
    wordWrap: { width: cw - 40 }, align: 'center',
  }).setOrigin(0.5, 0).setAlpha(0).setDepth(202);
  container.add(recT);
  scene.tweens.add({ targets: [recG, recT], alpha: 1, duration: 200, delay: 780 });

  addCloseButton(scene, container, cx, cy, cw, ch, close);
}

function addCloseButton(
  scene: Phaser.Scene,
  container: Phaser.GameObjects.Container,
  cx: number,
  cy: number,
  cw: number,
  ch: number,
  close: () => void,
): void {
  const closeY = cy + ch - 28;
  const closeT = scene.add.text(cx + cw / 2, closeY, '✕  닫기', {
    fontFamily: 'sans-serif', fontSize: '11px', color: CASUAL_CSS.INK_SOFT,
  }).setOrigin(0.5).setDepth(203).setInteractive();
  container.add(closeT);
  closeT.on('pointerdown', () => {
    scene.tweens.add({ targets: closeT, scaleX: 0.9, scaleY: 0.9, duration: 80, yoyo: true });
    close();
  });
}
