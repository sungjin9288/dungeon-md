/**
 * SummonShowcase.ts — collection showcase panel renderers.
 * All functions take (scene, ...) — no `this` usage.
 */

import Phaser from 'phaser';
import { CANVAS_WIDTH } from '../constants/layout';
import { DUNGEON_UI, DUNGEON_UI_CSS, ZONE_ACCENTS } from '../constants/colors';
import { loadGameState } from '../data/wisdom';
import { getCollectionSummary } from './SummonShared';
import { addFramedPanel } from './GameUiPrimitives';

// ─── drawCollectionShowcase ───────────────────────────────────────────────────

export function drawCollectionShowcase(scene: Phaser.Scene): void {
  const gs      = loadGameState();
  const summary = getCollectionSummary(gs);
  const frame = addFramedPanel(scene, {
    x: 10,
    y: 90,
    w: CANVAS_WIDTH - 20,
    h: 114,
    radius: 9,
    fillColor: DUNGEON_UI.STONE,
    borderColor: DUNGEON_UI.EDGE,
    borderAlpha: 0.8,
    accentColor: ZONE_ACCENTS.summon,
    accentAlpha: 0.84,
    glowColor: ZONE_ACCENTS.summon,
    glowOpacity: 0.025,
    shadowOpacity: 0.62,
  });
  [frame.shadow, frame.panel, frame.glow].forEach(object => object.setDepth(2));

  const g = scene.add.graphics().setDepth(2);
  g.fillStyle(DUNGEON_UI.SOOT, 0.72);
  g.fillRoundedRect(20, 99, 108, 94, 6);
  g.fillRoundedRect(CANVAS_WIDTH - 128, 99, 108, 94, 6);
  g.lineStyle(1, DUNGEON_UI.IRON, 0.9);
  g.strokeRoundedRect(20, 99, 108, 94, 6);
  g.strokeRoundedRect(CANVAS_WIDTH - 128, 99, 108, 94, 6);
  const progress = summary.total > 0 ? summary.owned / summary.total : 0;
  const barW = 84;
  scene.add.text(30, 111, '도감 계약', {
    fontFamily: 'sans-serif', fontSize: '10px', fontStyle: 'bold', color: DUNGEON_UI_CSS.MUTED,
  }).setDepth(6);
  scene.add.text(30, 128, `${summary.owned} / ${summary.total}`, {
    fontFamily: 'sans-serif', fontSize: '17px', fontStyle: 'bold', color: DUNGEON_UI_CSS.TEXT,
  }).setDepth(6);

  const pg = scene.add.graphics().setDepth(6);
  pg.fillStyle(DUNGEON_UI.VOID, 1);
  pg.fillRoundedRect(30, 153, barW, 7, 3);
  pg.fillStyle(DUNGEON_UI.BRASS, 1);
  pg.fillRoundedRect(30, 153, Phaser.Math.Clamp(barW * progress, 2, barW), 7, 3);
  pg.lineStyle(1, DUNGEON_UI.IRON, 1);
  pg.strokeRoundedRect(30, 153, barW, 7, 3);
  scene.add.text(30, 174, `계약률 ${Math.round(progress * 100)}%`, {
    fontFamily: 'sans-serif', fontSize: '10px', fontStyle: 'bold', color: DUNGEON_UI_CSS.BRASS,
  }).setDepth(6);

  const rightX = CANVAS_WIDTH - 118;
  scene.add.text(rightX, 111, '군단 기록', {
    fontFamily: 'sans-serif', fontSize: '10px', fontStyle: 'bold', color: DUNGEON_UI_CSS.MUTED,
  }).setDepth(6);
  scene.add.text(rightX, 130, `총 ${summary.totalPulls}회`, {
    fontFamily: 'sans-serif', fontSize: '15px', fontStyle: 'bold', color: DUNGEON_UI_CSS.TEXT,
  }).setDepth(6);
  scene.add.text(rightX, 151, `에픽 ${summary.epics} · 전설 ${summary.legends}`, {
    fontFamily: 'sans-serif', fontSize: '10px', fontStyle: 'bold', color: '#b7a9de',
  }).setDepth(6);
  const today = new Date().toISOString().slice(0, 10);
  scene.add.text(rightX, 174,
    gs.lastFriendSummon === today ? '무료 계약 완료' : '무료 계약 준비', {
      fontFamily: 'sans-serif', fontSize: '10px', fontStyle: 'bold',
      color: gs.lastFriendSummon === today ? DUNGEON_UI_CSS.MUTED : DUNGEON_UI_CSS.JADE,
    }).setDepth(6);
}
