/** Fixed Codex guardian-detail folio. */

import Phaser from 'phaser';
import { CANVAS_HEIGHT, CANVAS_WIDTH } from '../constants/layout';
import { DUNGEON_UI, DUNGEON_UI_CSS } from '../constants/colors';
import { MONSTER_DEFS, getSkinForMonster, resolveMonsterTypeId, type MonsterId } from '../data/monsters';
import { generatePortrait } from '../art/PortraitGenerator';
import { SKILL_TREES } from '../data/barracks';
import type { loadGameState } from '../data/wisdom';
import { getDexNo, getRarityMeta } from './CodexShared';

const TRIBE_LABELS: Record<string, string> = {
  dokkaebi: '도깨비', gumiho: '구미호', dragon: '용족', underworld: '저승',
  sansin: '산신', sea: '해신', mask: '탈족', moonlight: '달빛', celestial: '천상',
  primordial: '원초', void: '공허',
};
const ELEMENT_LABELS: Record<string, string> = {
  fire: '화염', frost: '서리', lightning: '번개', dark: '암흑', holy: '신성',
};
const ROOM_LABELS: Record<string, string> = {
  guardian: '수호실', tower: '망루', scroll_library: '서고', gold: '황금실',
  trap: '함정실', trap_corridor: '함정 복도', armory: '무기고', medicine_hall: '의전실',
  spirit_altar: '영혼 제단', dragons_lair: '용소', celestial_shrine: '천상 성소', void_forge: '공허 대장간',
};

export function showCodexMonsterDetail(
  scene: Phaser.Scene,
  monster: (typeof MONSTER_DEFS)[MonsterId],
  gameState: ReturnType<typeof loadGameState>,
  onClose: () => void,
): Phaser.GameObjects.Container {
  const x = 16;
  const y = 86;
  const w = CANVAS_WIDTH - 32;
  const h = 660;
  const rarity = getRarityMeta(monster.rarityTier);
  const owned = gameState.ownedMonsters.some(entry => resolveMonsterTypeId(entry.id) === monster.id);
  const ctr = scene.add.container(0, 0).setDepth(220);

  const dim = scene.add.graphics();
  dim.fillStyle(0x000000, 0.82);
  dim.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  ctr.add(dim);
  // Consume all input so the archive beneath cannot act while the folio is open.
  ctr.add(scene.add.zone(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT).setOrigin(0)
    .setInteractive().setName('codex-detail-blocker'));

  const panel = scene.add.graphics();
  panel.fillStyle(DUNGEON_UI.VOID, 0.7);
  panel.fillRoundedRect(x + 4, y + 6, w, h, 12);
  panel.fillStyle(DUNGEON_UI.STONE, 1);
  panel.fillRoundedRect(x, y, w, h, 12);
  panel.lineStyle(2, DUNGEON_UI.BRASS, 0.94);
  panel.strokeRoundedRect(x, y, w, h, 12);
  panel.fillStyle(rarity.color, 0.18);
  panel.fillRoundedRect(x + 8, y + 8, w - 16, 68, 8);
  panel.fillStyle(rarity.color, 0.9);
  panel.fillRect(x + 8, y + 8, 4, 68);
  ctr.add(panel);

  addText(scene, ctr, x + 24, y + 24, `도감 #${getDexNo(monster.id)} · ${rarity.stars} ${rarity.label}`, 10, rarity.css, true);
  addText(scene, ctr, x + 24, y + 52, monster.name, 20, DUNGEON_UI_CSS.PARCHMENT, true);
  addText(scene, ctr, x + w - 72, y + 28, owned ? '보유 기록' : '미보유', 10,
    owned ? DUNGEON_UI_CSS.JADE : DUNGEON_UI_CSS.MUTED, true, 'right');

  const closeG = scene.add.graphics();
  closeG.fillStyle(DUNGEON_UI.SOOT, 1);
  closeG.fillRoundedRect(x + w - 56, y + 14, 44, 44, 8);
  closeG.lineStyle(1.5, DUNGEON_UI.BRASS, 0.9);
  closeG.strokeRoundedRect(x + w - 56, y + 14, 44, 44, 8);
  ctr.add(closeG);
  addText(scene, ctr, x + w - 34, y + 36, '닫기', 10, DUNGEON_UI_CSS.TEXT, true, 'center');
  const closeZone = scene.add.zone(x + w - 56, y + 14, 44, 44).setOrigin(0)
    .setInteractive({ useHandCursor: true }).setName('codex-detail-close');
  closeZone.on('pointerdown', () => {
    ctr.destroy();
    onClose();
  });
  ctr.add(closeZone);

  drawIdentity(scene, ctr, monster, gameState, x + 14, y + 88, w - 28, rarity.color);
  drawStats(scene, ctr, monster, x + 14, y + 208, w - 28);
  drawPassive(scene, ctr, monster, x + 14, y + 278, w - 28, rarity.color);
  drawDeployment(scene, ctr, monster, x + 14, y + 388, w - 28);
  drawGrowth(scene, ctr, monster, x + 14, y + 472, w - 28);
  return ctr;
}

function drawIdentity(
  scene: Phaser.Scene,
  ctr: Phaser.GameObjects.Container,
  monster: (typeof MONSTER_DEFS)[MonsterId],
  gameState: ReturnType<typeof loadGameState>,
  x: number,
  y: number,
  w: number,
  accent: number,
): void {
  const bg = scene.add.graphics();
  bg.fillStyle(DUNGEON_UI.STONE_RAISED, 1);
  bg.fillRoundedRect(x, y, w, 108, 9);
  bg.lineStyle(1, DUNGEON_UI.IRON, 0.9);
  bg.strokeRoundedRect(x, y, w, 108, 9);
  bg.fillStyle(accent, 0.12);
  bg.fillCircle(x + 54, y + 54, 45);
  ctr.add(bg);
  const skin = getSkinForMonster(monster.id, gameState.equippedSkins ?? {});
  const key = generatePortrait(scene, monster.id, skin?.id);
  if (scene.textures.exists(key)) ctr.add(scene.add.image(x + 54, y + 54, key).setDisplaySize(88, 88));
  else addText(scene, ctr, x + 54, y + 54, skin?.emoji ?? monster.emoji, 48, '#ffffff', false, 'center');
  addText(scene, ctr, x + 116, y + 24,
    `${TRIBE_LABELS[monster.tribe ?? ''] ?? '독립'} · ${ELEMENT_LABELS[monster.element ?? ''] ?? '중립'}`,
    12, DUNGEON_UI_CSS.BRASS, true);
  addText(scene, ctr, x + 116, y + 52, `Chapter ${monster.chapter ?? 1} · ${unlockLabel(monster.unlockMethod)}`, 10,
    DUNGEON_UI_CSS.MUTED, true);
  addText(scene, ctr, x + 116, y + 80, `전투 유형 · ${monster.type}`, 10, DUNGEON_UI_CSS.TEXT);
}

function drawStats(
  scene: Phaser.Scene,
  ctr: Phaser.GameObjects.Container,
  monster: (typeof MONSTER_DEFS)[MonsterId],
  x: number,
  y: number,
  w: number,
): void {
  const values = [
    ['ATK', `${monster.baseDamage}`], ['COOL', `${(monster.attackCooldown / 1000).toFixed(1)}s`],
    ['RANGE', `${monster.range}`], ['ROOM', `${monster.roomTypes.length}`],
  ];
  const gap = 6;
  const cellW = (w - gap * 3) / 4;
  values.forEach(([label, value], index) => {
    const cx = x + index * (cellW + gap);
    const bg = scene.add.graphics();
    bg.fillStyle(DUNGEON_UI.SOOT, 0.88);
    bg.fillRoundedRect(cx, y, cellW, 58, 7);
    bg.lineStyle(1, DUNGEON_UI.IRON, 0.9);
    bg.strokeRoundedRect(cx, y, cellW, 58, 7);
    ctr.add(bg);
    addText(scene, ctr, cx + cellW / 2, y + 18, label, 10, DUNGEON_UI_CSS.MUTED, true, 'center');
    addText(scene, ctr, cx + cellW / 2, y + 41, value, 14, DUNGEON_UI_CSS.BRASS, true, 'center');
  });
}

function drawPassive(
  scene: Phaser.Scene,
  ctr: Phaser.GameObjects.Container,
  monster: (typeof MONSTER_DEFS)[MonsterId],
  x: number,
  y: number,
  w: number,
  accent: number,
): void {
  const bg = scene.add.graphics();
  bg.fillStyle(DUNGEON_UI.SOOT, 0.82);
  bg.fillRoundedRect(x, y, w, 98, 8);
  bg.lineStyle(1, accent, 0.72);
  bg.strokeRoundedRect(x, y, w, 98, 8);
  ctr.add(bg);
  addText(scene, ctr, x + 14, y + 20, '패시브 기록', 11, DUNGEON_UI_CSS.BRASS, true);
  addText(scene, ctr, x + 14, y + 52, monster.passiveDesc, 10, DUNGEON_UI_CSS.TEXT, false, 'left', w - 28);
}

function drawDeployment(
  scene: Phaser.Scene,
  ctr: Phaser.GameObjects.Container,
  monster: (typeof MONSTER_DEFS)[MonsterId],
  x: number,
  y: number,
  w: number,
): void {
  const bg = scene.add.graphics();
  bg.fillStyle(DUNGEON_UI.STONE_RAISED, 1);
  bg.fillRoundedRect(x, y, w, 72, 8);
  bg.lineStyle(1, DUNGEON_UI.IRON, 0.9);
  bg.strokeRoundedRect(x, y, w, 72, 8);
  ctr.add(bg);
  addText(scene, ctr, x + 14, y + 19, '배치 가능 시설', 11, DUNGEON_UI_CSS.BRASS, true);
  const rooms = monster.roomTypes.slice(0, 4).map(room => ROOM_LABELS[room] ?? room).join(' · ');
  addText(scene, ctr, x + 14, y + 48, rooms || '전용 배치 시설 없음', 10, DUNGEON_UI_CSS.TEXT, false, 'left', w - 28);
}

function drawGrowth(
  scene: Phaser.Scene,
  ctr: Phaser.GameObjects.Container,
  monster: (typeof MONSTER_DEFS)[MonsterId],
  x: number,
  y: number,
  w: number,
): void {
  const bg = scene.add.graphics();
  bg.fillStyle(DUNGEON_UI.SOOT, 0.82);
  bg.fillRoundedRect(x, y, w, 142, 8);
  bg.lineStyle(1, DUNGEON_UI.IRON, 0.9);
  bg.strokeRoundedRect(x, y, w, 142, 8);
  ctr.add(bg);
  addText(scene, ctr, x + 14, y + 19, '성장 루트 미리보기', 11, DUNGEON_UI_CSS.BRASS, true);
  const tree = SKILL_TREES[monster.id];
  if (!tree) {
    addText(scene, ctr, x + 14, y + 66, '등록된 성장 루트가 없습니다', 10, DUNGEON_UI_CSS.MUTED);
    return;
  }
  const branches = ['A', 'B', 'C'] as const;
  const gap = 6;
  const cellW = (w - 28 - gap * 2) / 3;
  branches.forEach((branch, index) => {
    const node = tree.nodes.find(entry => entry.branch === branch && entry.tier === 1);
    const cx = x + 14 + index * (cellW + gap);
    const cell = scene.add.graphics();
    cell.fillStyle(DUNGEON_UI.STONE, 1);
    cell.fillRoundedRect(cx, y + 38, cellW, 88, 7);
    cell.lineStyle(1, branch === 'A' ? DUNGEON_UI.EMBER : branch === 'B' ? DUNGEON_UI.BRASS : DUNGEON_UI.JADE, 0.8);
    cell.strokeRoundedRect(cx, y + 38, cellW, 88, 7);
    ctr.add(cell);
    addText(scene, ctr, cx + cellW / 2, y + 54, tree.branchNames[branch], 10, DUNGEON_UI_CSS.PARCHMENT, true, 'center');
    addText(scene, ctr, cx + cellW / 2, y + 79, node?.icon ?? '◇', 18, '#ffffff', false, 'center');
    addText(scene, ctr, cx + cellW / 2, y + 108, node?.name ?? '미등록', 10, DUNGEON_UI_CSS.MUTED, false, 'center', cellW - 10);
  });
}

function addText(
  scene: Phaser.Scene,
  ctr: Phaser.GameObjects.Container,
  x: number,
  y: number,
  value: string,
  size: number,
  color: string,
  bold = false,
  align: 'left' | 'center' | 'right' = 'left',
  wrap?: number,
): Phaser.GameObjects.Text {
  const originX = align === 'center' ? 0.5 : align === 'right' ? 1 : 0;
  const text = scene.add.text(x, y, value, {
    fontFamily: 'sans-serif', fontSize: `${size}px`, fontStyle: bold ? 'bold' : 'normal',
    color, align, wordWrap: wrap ? { width: wrap } : undefined, lineSpacing: wrap ? 3 : 0,
  }).setOrigin(originX, 0.5);
  ctr.add(text);
  return text;
}

function unlockLabel(method: string | undefined): string {
  const labels: Record<string, string> = {
    summon: '소환', codex_reward: '도감 보상', fusion_combination: '융합', seasonal: '시즌',
  };
  return method ? labels[method] ?? method : '기본 기록';
}
