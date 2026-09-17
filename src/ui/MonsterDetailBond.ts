/**
 * MonsterDetailBond.ts — the '교감' tab of MonsterDetailPanel: affinity bar,
 * the three daily care actions, the story line, and the threshold ladder.
 * All rules live in bond.ts / bondTransactions.ts; this only renders and
 * commits one action per tap.
 */
import Phaser from 'phaser';
import { DUNGEON_UI, DUNGEON_UI_CSS } from '../constants/colors';
import { BOND_ACTIONS, BOND_ACTION_ORDER, BOND_MAX, BOND_STORY_BY_TRIBE, BOND_STORY_DEFAULT, BOND_THRESHOLDS, bondTier, nextBondThreshold, type BondActionId } from '../data/bond';
import { canPerformBondAction, getBondAffinity, performBondAction, type BondFailureReason } from '../data/bondTransactions';
import { getTodayString } from '../data/daily';
import { MATERIAL_DEFS } from '../data/fusion';
import { resolveOwnedMonsterProfile } from '../data/monsters';
import { loadGameState, saveGameState, type OwnedMonster } from '../data/wisdom';
import type { MonsterDetailContext } from './MonsterDetailShared';

const ROW_H = 52;
const BUTTON_W = 96;
const BUTTON_H = 44;

const FAILURE_LABEL: Record<BondFailureReason, string> = {
  not_owned: '보유하지 않은 수호자',
  bond_maxed: '교감 최대',
  daily_limit: '오늘 횟수 소진',
  insufficient_gold: '골드 부족',
  insufficient_materials: '재료 부족',
};

function costLabel(action: BondActionId, materials: Readonly<Record<string, number>> | null): string {
  const def = BOND_ACTIONS[action];
  const parts: string[] = [];
  if (def.gold > 0) parts.push(`${def.gold}💰`);
  if (def.materialsAny.length > 0) {
    const chosen = materials && Object.keys(materials).length > 0 ? materials : def.materialsAny[0];
    parts.push(Object.entries(chosen).map(([id, qty]) => `${MATERIAL_DEFS[id]?.emoji ?? ''}${MATERIAL_DEFS[id]?.name ?? id} ${qty}`).join(' '));
  }
  if (def.xp > 0) parts.push(`XP +${def.xp}`);
  return parts.length ? parts.join(' · ') : '무료';
}

export interface BondTabOptions {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  /** Re-render the tab after a committed action. */
  readonly rerender: () => void;
  readonly toast: (text: string, color: string) => void;
}

export function buildBondTab(
  ctx: MonsterDetailContext,
  container: Phaser.GameObjects.Container,
  monster: OwnedMonster,
  opts: BondTabOptions,
): void {
  const { scene } = ctx;
  const { x, y, w } = opts;
  const gs = loadGameState();
  const today = getTodayString();
  const affinity = getBondAffinity(gs, monster.id);
  const tier = bondTier(affinity);
  const next = nextBondThreshold(affinity);
  const profile = resolveOwnedMonsterProfile(monster.id);

  container.add(scene.add.text(x + 4, y, '교감', {
    fontFamily: 'sans-serif', fontSize: '14px', fontStyle: 'bold', color: DUNGEON_UI_CSS.PARCHMENT,
  }));
  container.add(scene.add.text(x + w - 4, y + 2, tier ? `${tier.label} · 공격 ×${tier.atkMult.toFixed(2)}` : '아직 낯섦', {
    fontFamily: 'sans-serif', fontSize: '10px', color: tier ? DUNGEON_UI_CSS.JADE : DUNGEON_UI_CSS.MUTED,
  }).setOrigin(1, 0));

  // Affinity bar with threshold ticks.
  const barY = y + 26, barH = 14;
  const bar = scene.add.graphics();
  bar.fillStyle(DUNGEON_UI.VOID, 1);
  bar.fillRoundedRect(x, barY, w, barH, 6);
  bar.fillStyle(DUNGEON_UI.JADE, 0.9);
  if (affinity > 0) bar.fillRoundedRect(x, barY, Math.max(10, w * affinity / BOND_MAX), barH, 6);
  bar.lineStyle(1, DUNGEON_UI.IRON, 0.9);
  bar.strokeRoundedRect(x, barY, w, barH, 6);
  for (const threshold of BOND_THRESHOLDS) {
    const tx = x + w * threshold.at / BOND_MAX;
    bar.lineStyle(1, affinity >= threshold.at ? DUNGEON_UI.BRASS_BRIGHT : DUNGEON_UI.IRON, 1);
    bar.lineBetween(tx, barY - 2, tx, barY + barH + 2);
  }
  container.add(bar);
  container.add(scene.add.text(x + w / 2, barY + barH / 2, `${affinity} / ${BOND_MAX}`, {
    fontFamily: 'monospace', fontSize: '10px', fontStyle: 'bold', color: DUNGEON_UI_CSS.PARCHMENT,
  }).setOrigin(0.5));
  container.add(scene.add.text(x, barY + barH + 6, next ? `다음 ${next.label}(${next.at}) · ${next.blurb}` : '교감이 완성됐습니다 · 합성 → 각성으로', {
    fontFamily: 'sans-serif', fontSize: '10px', color: DUNGEON_UI_CSS.MUTED, wordWrap: { width: w },
  }));

  // Actions.
  let rowY = barY + barH + 28;
  for (const id of BOND_ACTION_ORDER) {
    const def = BOND_ACTIONS[id];
    const check = canPerformBondAction(gs, monster.id, id, today);
    const g = scene.add.graphics();
    g.fillStyle(DUNGEON_UI.SOOT, 0.9);
    g.fillRoundedRect(x, rowY, w, ROW_H, 7);
    g.lineStyle(1, check.ok ? DUNGEON_UI.JADE : DUNGEON_UI.IRON, check.ok ? 0.7 : 0.6);
    g.strokeRoundedRect(x, rowY, w, ROW_H, 7);
    container.add(g);
    container.add(scene.add.text(x + 12, rowY + 12, `${def.emoji} ${def.name}  +${def.gain}`, {
      fontFamily: 'sans-serif', fontSize: '12px', fontStyle: 'bold', color: DUNGEON_UI_CSS.PARCHMENT,
    }));
    container.add(scene.add.text(x + 12, rowY + 31, `${costLabel(id, check.materials)} · 오늘 ${check.remaining}/${def.dailyLimit}`, {
      fontFamily: 'sans-serif', fontSize: '10px', color: DUNGEON_UI_CSS.MUTED,
    }));

    const bx = x + w - BUTTON_W - 6, by = rowY + (ROW_H - BUTTON_H) / 2;
    const bg = scene.add.graphics();
    bg.fillStyle(check.ok ? DUNGEON_UI.STONE_RAISED : DUNGEON_UI.VOID, 1);
    bg.fillRoundedRect(bx, by, BUTTON_W, BUTTON_H, 6);
    bg.lineStyle(1.2, check.ok ? DUNGEON_UI.JADE : DUNGEON_UI.IRON, check.ok ? 0.9 : 0.35);
    bg.strokeRoundedRect(bx, by, BUTTON_W, BUTTON_H, 6);
    container.add(bg);
    container.add(scene.add.text(bx + BUTTON_W / 2, by + BUTTON_H / 2, check.ok ? def.name : FAILURE_LABEL[check.reason ?? 'not_owned'], {
      fontFamily: 'sans-serif', fontSize: '11px', fontStyle: 'bold', color: check.ok ? DUNGEON_UI_CSS.PARCHMENT : DUNGEON_UI_CSS.MUTED,
    }).setOrigin(0.5));
    if (check.ok) {
      const zone = scene.add.zone(bx, by, BUTTON_W, BUTTON_H).setOrigin(0).setName(`monster-bond-${id}`).setInteractive({ useHandCursor: true });
      zone.on('pointerdown', () => {
        const result = performBondAction(loadGameState(), monster.id, id, getTodayString());
        if (!result.ok) { opts.toast(FAILURE_LABEL[result.reason], DUNGEON_UI_CSS.EMBER); return; }
        saveGameState(result.state);
        const crossed = result.crossed.map(t => ` · ${t.label} 달성!`).join('');
        opts.toast(`${def.emoji} ${def.name} · 교감 ${result.affinityBefore} → ${result.affinityAfter}${crossed}${result.levelled ? ' · 레벨 업!' : ''}`, DUNGEON_UI_CSS.JADE);
        opts.rerender();
      });
      container.add(zone);
    }
    rowY += ROW_H + 6;
  }

  // Story line — the 우정 reward.
  const storyY = rowY + 4;
  const story = affinity >= 50
    ? (profile?.tribe ? BOND_STORY_BY_TRIBE[profile.tribe] ?? BOND_STORY_DEFAULT : BOND_STORY_DEFAULT)
    : '우정(50)에 닿으면 이 수호자의 이야기를 들려줍니다.';
  const sg = scene.add.graphics();
  sg.fillStyle(DUNGEON_UI.VOID, 0.8);
  sg.fillRoundedRect(x, storyY, w, 44, 7);
  sg.lineStyle(1, affinity >= 50 ? DUNGEON_UI.BRASS : DUNGEON_UI.IRON, 0.5);
  sg.strokeRoundedRect(x, storyY, w, 44, 7);
  container.add(sg);
  container.add(scene.add.text(x + 10, storyY + 22, story, {
    fontFamily: 'sans-serif', fontSize: '10px', fontStyle: affinity >= 50 ? 'italic' : 'normal',
    color: affinity >= 50 ? DUNGEON_UI_CSS.PARCHMENT : DUNGEON_UI_CSS.MUTED, wordWrap: { width: w - 20 },
  }).setOrigin(0, 0.5));
}
