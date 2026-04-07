/**
 * Dungeon battle simulation modal showing DPS, win rate, and per-wave results.
 */

import Phaser from 'phaser';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../constants/layout';
import { simulateDungeon } from '../data/simulation';
import { CHAPTER_1 } from '../data/stages';
import type { GameState } from '../data/wisdom';
import type { DungeonTheme } from '../themes/themes';

export function openSimulationModal(
  scene: Phaser.Scene,
  gs: Readonly<GameState>,
  theme: DungeonTheme,
): void {
  const t = theme;
  const CW = CANVAS_WIDTH, CH = CANVAS_HEIGHT;

  // Overlay dim
  const dim = scene.add.graphics().setDepth(200);
  dim.fillStyle(0x000000, 0.75);
  dim.fillRect(0, 0, CW, CH);
  dim.setAlpha(0);
  scene.tweens.add({ targets: dim, alpha: 1, duration: 250 });

  // Card
  const cw = 340, ch = 430;
  const cx = (CW - cw) / 2, cy = (CH - ch) / 2;
  const card = scene.add.graphics().setDepth(201);
  card.fillStyle(t.panelDark, 1);
  card.fillRoundedRect(cx, cy, cw, ch, 8);
  card.lineStyle(2, t.panelBorder, 0.9);
  card.strokeRoundedRect(cx, cy, cw, ch, 8);
  // Cave strata texture
  for (let ry = cy + 8; ry < cy + ch; ry += 18) {
    card.lineStyle(1, t.stoneLight, 0.03 + Math.random() * 0.03);
    card.lineBetween(cx + 4, ry, cx + cw - 4, ry);
  }
  card.setY(-60).setAlpha(0);
  scene.tweens.add({ targets: card, y: 0, alpha: 1, duration: 300, ease: 'Power2.easeOut' });

  const container = scene.add.container(0, 0).setDepth(202);
  container.add([dim, card]);

  // Title
  const title = scene.add.text(cx + cw / 2, cy + 22, '⚗  던전 전투 예측', {
    fontFamily: 'Georgia, serif', fontSize: '15px', fontStyle: 'bold', color: t.panelBorderCSS,
  }).setOrigin(0.5).setAlpha(0);
  container.add(title);
  scene.tweens.add({ targets: title, alpha: 1, duration: 250, delay: 150 });

  // Run simulation vs Chapter 1 Stage 1
  const stageWaves = CHAPTER_1[0].waves;
  const startHp    = CHAPTER_1[0].dungeonHp;
  const result     = simulateDungeon(
    gs.dungeonSlots ?? [],
    gs.ownedMonsters ?? [],
    stageWaves,
    startHp,
  );

  // DPS row
  const dpsColor = result.totalDps < 8 ? '#ff6666' : result.totalDps < 18 ? '#ffcc44' : '#44cc88';
  const dpsT = scene.add.text(cx + 16, cy + 50,
    `던전 총 DPS:  ${result.totalDps.toFixed(1)} / 초`, {
    fontFamily: 'sans-serif', fontSize: '11px', color: dpsColor,
  }).setAlpha(0);
  container.add(dpsT);
  scene.tweens.add({ targets: dpsT, alpha: 1, duration: 200, delay: 200 });

  // Win % bar
  const barY = cy + 74;
  const barW = cw - 32;
  const wpct = result.winPct / 100;
  const barBg = scene.add.graphics().setAlpha(0).setDepth(202);
  barBg.fillStyle(t.stoneDark, 1);
  barBg.fillRoundedRect(cx + 16, barY, barW, 10, 3);
  const barFill = scene.add.graphics().setAlpha(0).setDepth(202);
  const fillColor = wpct >= 0.7 ? 0x44cc88 : wpct >= 0.4 ? 0xddcc00 : 0xcc2200;
  barFill.fillStyle(fillColor, 1);
  barFill.fillRoundedRect(cx + 16, barY, barW * wpct, 10, 3);
  const pctT = scene.add.text(cx + cw / 2, barY + 5, `예상 생존율  ${result.winPct}%`, {
    fontFamily: 'sans-serif', fontSize: '9px', color: '#ffffff',
  }).setOrigin(0.5).setAlpha(0).setDepth(203);
  container.add([barBg, barFill, pctT]);
  scene.tweens.add({ targets: [barBg, barFill, pctT], alpha: 1, duration: 200, delay: 280 });

  // Divider
  const divG = scene.add.graphics().setAlpha(0).setDepth(202);
  divG.lineStyle(1, t.panelBorder, 0.3);
  divG.lineBetween(cx + 16, barY + 18, cx + cw - 16, barY + 18);
  container.add(divG);
  scene.tweens.add({ targets: divG, alpha: 1, duration: 150, delay: 320 });

  // Per-wave results (compact rows)
  const waveStartY = barY + 26;
  const rowH = 22;
  const DIFF_COLOR: Record<string, string> = {
    easy: '#44cc88', medium: '#88ccff', hard: '#ffcc44', extreme: '#ff6666',
  };
  const DIFF_LABEL: Record<string, string> = {
    easy: '쉬움', medium: '보통', hard: '어려움', extreme: '위험',
  };

  result.waveResults.slice(0, 10).forEach((wr, i) => {
    const wy = waveStartY + i * rowH;
    const rowT = scene.add.text(cx + 16, wy + 11, `${wr.waveNum}웨이브`, {
      fontFamily: 'sans-serif', fontSize: '9px', color: t.textSecondary,
    }).setOrigin(0, 0.5).setAlpha(0).setDepth(202);
    container.add(rowT);

    const diffT = scene.add.text(cx + 80, wy + 11,
      `${DIFF_LABEL[wr.difficulty]} (생존 ${wr.survived}/${wr.invaderCount})`, {
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
  const recY = waveStartY + 10 * rowH + 4;
  const recG = scene.add.graphics().setAlpha(0).setDepth(202);
  recG.lineStyle(1, t.panelBorder, 0.3);
  recG.lineBetween(cx + 16, recY, cx + cw - 16, recY);
  container.add(recG);
  const recT = scene.add.text(cx + cw / 2, recY + 14, `💡 ${result.recommendation}`, {
    fontFamily: 'sans-serif', fontSize: '10px', color: t.panelBorderCSS,
  }).setOrigin(0.5).setAlpha(0).setDepth(202);
  container.add(recT);
  scene.tweens.add({ targets: [recG, recT], alpha: 1, duration: 200, delay: 780 });

  // Close button
  const closeY = cy + ch - 28;
  const closeT = scene.add.text(cx + cw / 2, closeY, '✕  닫기', {
    fontFamily: 'sans-serif', fontSize: '11px', color: t.textSecondary,
  }).setOrigin(0.5).setDepth(203).setInteractive();
  container.add(closeT);
  closeT.on('pointerdown', () => {
    scene.tweens.add({ targets: closeT, scaleX: 0.9, scaleY: 0.9, duration: 80, yoyo: true });
    scene.tweens.add({ targets: [dim, card, container], alpha: 0, duration: 200,
      onComplete: () => { dim.destroy(); card.destroy(); container.destroy(); },
    });
  });
}
