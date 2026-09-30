/**
 * Unit tests for BarracksShared.ts pure helpers.
 * No Phaser dependency — pure data logic only.
 */

import { describe, it, expect } from 'vitest';
import { defaultOwnedMonster } from '../data/barracks';
import { loadGameState } from '../data/wisdom';
import {
  isGrowthReady,
  compareGrowth,
  getMonsterCollectionMeta,
  getMonsterRoomPlan,
  getMonsterCardActionCue,
  getForgeTargetRoomCue,
} from './BarracksShared';
import type { GameState, DungeonSlot } from '../data/wisdom';
import type { OwnedMonster } from '../data/barracks';
import { resolveOwnedMonsterProfile } from '../data/monsters';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeMonster(overrides: Partial<OwnedMonster> = {}): OwnedMonster {
  return { ...defaultOwnedMonster('dokkaebi_warrior'), ...overrides };
}

/** Returns a default GameState with overrides for the fields we care about. */
function makeGs(
  monsters: OwnedMonster[] = [],
  dungeonSlots: DungeonSlot[] = [],
): GameState {
  return {
    ...loadGameState(),
    ownedMonsters: monsters,
    dungeonSlots,
  };
}

function makeCombatSlot(monsterIds: string[] = []): DungeonSlot {
  return {
    roomType:   'combat',
    roomLevel:  1,
    hp:         100,
    maxHp:      100,
    monsterIds,
    trapIds:    [],
  };
}

// ─── isGrowthReady ────────────────────────────────────────────────────────────

describe('isGrowthReady', () => {
  it('returns true when skillPoints > 0', () => {
    expect(isGrowthReady(makeMonster({ skillPoints: 2 }))).toBe(true);
  });

  it('returns true when equipment is null', () => {
    expect(isGrowthReady(makeMonster({ skillPoints: 0, equipment: null }))).toBe(true);
  });

  it('returns true when XP progress >= 78% and level < 50', () => {
    // xpToNextLevel(1) = 100; 80 / 100 = 80% ≥ 78%
    expect(isGrowthReady(makeMonster({ level: 1, xp: 80, skillPoints: 0, equipment: 'sword' }))).toBe(true);
  });

  it('returns false when level 50 regardless of xp', () => {
    expect(isGrowthReady(makeMonster({ level: 50, xp: 9999, skillPoints: 0, equipment: 'sword' }))).toBe(false);
  });

  it('returns false when xp progress < 78% and equipment set', () => {
    // 10 / 100 = 10%
    expect(isGrowthReady(makeMonster({ level: 1, xp: 10, skillPoints: 0, equipment: 'sword' }))).toBe(false);
  });
});

// ─── compareGrowth ordering ───────────────────────────────────────────────────

describe('compareGrowth', () => {
  it('places SP-ready monster before XP-near-level-up monster', () => {
    const spMonster = makeMonster({ skillPoints: 3, equipment: 'sword', level: 5, xp: 0 });
    const xpMonster = makeMonster({ skillPoints: 0, equipment: 'sword', level: 1, xp: 85 });
    expect(compareGrowth(spMonster, xpMonster)).toBeLessThan(0);
  });

  it('places growth-ready monster before not-ready monster', () => {
    const ready    = makeMonster({ skillPoints: 1, equipment: 'sword' });
    const notReady = makeMonster({ skillPoints: 0, equipment: 'sword', level: 1, xp: 5 });
    expect(compareGrowth(ready, notReady)).toBeLessThan(0);
  });

  it('among non-ready monsters, higher level comes first', () => {
    const high = makeMonster({ level: 30, skillPoints: 0, equipment: 'sword', xp: 0 });
    const low  = makeMonster({ level: 10, skillPoints: 0, equipment: 'sword', xp: 0 });
    expect(compareGrowth(high, low)).toBeLessThan(0);
  });
});

// ─── getMonsterRoomPlan ───────────────────────────────────────────────────────

describe('getMonsterRoomPlan', () => {
  it('returns "deployed" when monster is in a dungeon slot', () => {
    const m    = makeMonster({ id: 'dokkaebi_warrior' });
    const gs   = makeGs([m], [makeCombatSlot(['dokkaebi_warrior'])]);
    const plan = getMonsterRoomPlan(gs, m);
    expect(plan.kind).toBe('deployed');
    expect(plan.label).toContain('방 #1');
  });

  it('returns "locked" when no dungeon slots are available', () => {
    const m    = makeMonster({ id: 'dokkaebi_warrior' });
    const gs   = makeGs([m], []);
    const plan = getMonsterRoomPlan(gs, m);
    expect(plan.kind).toBe('locked');
  });

  it('returns "recommended" when a viable open combat room exists', () => {
    const m    = makeMonster({ id: 'dokkaebi_warrior' });
    const gs   = makeGs([m], [makeCombatSlot([])]);
    const plan = getMonsterRoomPlan(gs, m);
    expect(plan.kind).toBe('recommended');
  });

  it('routes a fusion-only magic hybrid to an open magic room', () => {
    const m = makeMonster({ id: 'storm_spirit', rarity: 2 });
    const gs = makeGs([m], [
      makeCombatSlot([]),
      { ...makeCombatSlot([]), roomType: 'magic' },
    ]);
    gs.dmLevel = 2;
    gs.dungeonPlan = { corridor: [0, 1], sides: [] };

    const plan = getMonsterRoomPlan(gs, m);
    expect(plan.kind).toBe('recommended');
    expect(plan.label).toContain('방 #2');
  });
});

describe('getMonsterCollectionMeta', () => {
  it('marks fusion-only monsters without assigning a false registry number', () => {
    const monster = makeMonster({ id: 'storm_spirit', rarity: 2 });
    const profile = resolveOwnedMonsterProfile(monster.id)!;
    expect(getMonsterCollectionMeta(monster, profile)).toMatchObject({
      indexLabel: 'No.---',
      tier: 'R',
      rank: 2,
    });
  });
});

// ─── getMonsterCardActionCue ──────────────────────────────────────────────────

describe('getMonsterCardActionCue', () => {
  const lockedPlan = {
    label: '방 해금 대기', subLabel: '던전 레벨업 필요',
    accent: 0x8a6a4a, kind: 'locked' as const,
  };

  it('returns 성장 chip when skillPoints > 0', () => {
    const cue = getMonsterCardActionCue(makeMonster({ skillPoints: 2 }), 0.5, true, false, lockedPlan);
    expect(cue.chip).toBe('성장');
    expect(cue.icon).toBe('✦');
  });

  it('returns MAX chip when level >= 50', () => {
    const cue = getMonsterCardActionCue(makeMonster({ level: 50, skillPoints: 0 }), 1, true, false, lockedPlan);
    expect(cue.chip).toBe('MAX');
  });

  it('returns 훈련 chip when xpPct >= 0.82', () => {
    const cue = getMonsterCardActionCue(makeMonster({ level: 10, skillPoints: 0 }), 0.85, true, false, lockedPlan);
    expect(cue.chip).toBe('훈련');
  });

  it('returns 제작 chip when no equipment and nothing owned to equip', () => {
    const cue = getMonsterCardActionCue(makeMonster({ level: 10, skillPoints: 0 }), 0.5, false, false, lockedPlan, 0);
    expect(cue.chip).toBe('제작');
  });

  // A new player owns three starter items; the card used to say "제작" and a
  // blueprint-less forge was the only place it implied, while equipping is one tap.
  it('returns 장착 chip when owned equipment is waiting', () => {
    const cue = getMonsterCardActionCue(makeMonster({ level: 1, skillPoints: 0 }), 0.15, false, true, lockedPlan, 3);
    expect(cue.chip).toBe('장착');
    expect(cue.label).toBe('장비 장착');
    expect(cue.subLabel).toBe('보유 장비 3개');
  });

  it('returns 활동 chip when deployed', () => {
    const cue = getMonsterCardActionCue(makeMonster({ level: 10, skillPoints: 0 }), 0.5, true, true, lockedPlan);
    expect(cue.chip).toBe('활동');
  });
});

// ─── getForgeTargetRoomCue ────────────────────────────────────────────────────

// With no blueprint there is no craft recommendation, and the forge rail read
// "배치 대기" for a guardian that Barracks and Home showed placed in room #1.
describe('getForgeTargetRoomCue', () => {
  const warrior = makeMonster();
  it('falls back to the real placement without a craft recommendation', () => {
    const gs = makeGs([warrior], [makeCombatSlot(['dokkaebi_warrior'])]);
    expect(getForgeTargetRoomCue(gs, warrior, null)).toBe('실제 방 #1');
  });
  it('keeps the recommendation cue when one exists', () => {
    const gs = makeGs([warrior], [makeCombatSlot([])]);
    expect(getForgeTargetRoomCue(gs, warrior, { kind: 'recommended', roomLabel: '방 #1' })).toBe('추천 방 #1');
  });
  it('says 배치 대기 only when the guardian is not placed', () => {
    expect(getForgeTargetRoomCue(makeGs([warrior], []), warrior, null)).toBe('배치 대기');
  });
});
