/**
 * Unit tests for PreBattleShared.ts pure helpers.
 * No Phaser dependency — pure data logic only.
 */

import { describe, it, expect } from 'vitest';
import { INVADER_DEFS } from '../data/invaders';
import { buildStoryInvasionTarget } from '../data/battleForecast';
import { MAIN_QUESTS } from '../data/quests';
import { loadGameState } from '../data/wisdom';
import type { GameState, DungeonSlot } from '../data/wisdom';
import type { InvasionConfig } from '../data/quests';
import type { RoomActionRecommendation } from '../data/roomActionRecommendations';
import {
  getDefenseTotals,
  getDefenseRooms,
  getDefenseDirective,
  estimateInvasionPressure,
  formatDefenseReadinessPercent,
  formatPrestigeBattleBonus,
  shortenLabel,
  getDefenseDirectiveDisplayChip,
  buildDefenseDirective,
  buildDefenseDirectiveFromRoomAction,
  getMonsterDef,
  getMonsterDisplayEmoji,
  getMonsterDisplayName,
} from './PreBattleShared';
import { getReadinessDirectiveCopy } from '../data/readinessDirectives';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeCombatSlot(overrides: Partial<DungeonSlot> = {}): DungeonSlot {
  return {
    roomType:  'combat',
    roomLevel: 1,
    hp:        100,
    maxHp:     100,
    monsterIds: [],
    trapIds:    [],
    ...overrides,
  };
}

function makeGs(overrides: Partial<GameState> = {}): GameState {
  return {
    ...loadGameState(),
    ...overrides,
  };
}

function makeInvasionConfig(waveCount = 1, enemyCount = 3): InvasionConfig {
  return {
    id: 'test_invasion',
    name: '테스트 침략',
    isStoryInvasion: true,
    waves: Array.from({ length: waveCount }, (_, i) => ({
      waveNumber: i + 1,
      invaders: [{ type: 'peasant_soldier', count: enemyCount }],
    })),
  };
}

// ─── shortenLabel ──────────────────────────────────────────────────────────────

describe('shortenLabel', () => {
  it('returns the label unchanged when under or at the max', () => {
    expect(shortenLabel('전투실', 8)).toBe('전투실');
    expect(shortenLabel('12345678', 8)).toBe('12345678');
  });

  it('truncates and appends ellipsis when over the max', () => {
    const result = shortenLabel('123456789', 8);
    expect(result.length).toBe(8);
    expect(result.endsWith('…')).toBe(true);
  });

  it('uses default max of 8', () => {
    expect(shortenLabel('short')).toBe('short');
    expect(shortenLabel('123456789')).toHaveLength(8);
  });
});

describe('owned monster display resolution', () => {
  it('shows evolved and fusion-only identities in defense summaries', () => {
    expect(getMonsterDef('dokkaebi_warrior_leg')).toMatchObject({
      name: '전설 도깨비 전사',
      baseDamage: 57,
    });
    expect(getMonsterDisplayName('storm_spirit')).toBe('폭풍 정령');
    expect(getMonsterDisplayEmoji('storm_spirit')).toBe('⚡');
  });
});

// ─── formatDefenseReadinessPercent ────────────────────────────────────────────

describe('formatDefenseReadinessPercent', () => {
  it('returns "0%" for zero readiness', () => {
    expect(formatDefenseReadinessPercent(0)).toBe('0%');
  });

  it('returns normal percent for values 1–100', () => {
    expect(formatDefenseReadinessPercent(75)).toBe('75%');
    expect(formatDefenseReadinessPercent(100)).toBe('100%');
  });

  it('returns "100%+" for values above 100', () => {
    expect(formatDefenseReadinessPercent(150)).toBe('100%+');
    expect(formatDefenseReadinessPercent(999)).toBe('100%+');
  });

  it('rounds fractional values', () => {
    expect(formatDefenseReadinessPercent(42.7)).toBe('43%');
  });
});

// ─── formatPrestigeBattleBonus ────────────────────────────────────────────────

describe('formatPrestigeBattleBonus', () => {
  it('hides the combat bonus before the first prestige', () => {
    expect(formatPrestigeBattleBonus(makeGs({ prestigeLevel: 0 }))).toBeNull();
  });

  it('uses the production prestige multiplier for the player-facing bonus', () => {
    expect(formatPrestigeBattleBonus(makeGs({ prestigeLevel: 1 })))
      .toBe('👑 명성 Lv.1 · 공격 피해 +10% · 전투 배율 ×1.1');
    expect(formatPrestigeBattleBonus(makeGs({ prestigeLevel: 3 })))
      .toBe('👑 명성 Lv.3 · 공격 피해 +30% · 전투 배율 ×1.3');
  });
});

// ─── estimateInvasionPressure ─────────────────────────────────────────────────

describe('estimateInvasionPressure', () => {
  it('returns 0 for undefined config', () => {
    expect(estimateInvasionPressure(undefined)).toBe(0);
  });

  it('returns a positive integer for a valid config', () => {
    const pressure = estimateInvasionPressure(makeInvasionConfig(1, 3));
    expect(pressure).toBeGreaterThan(0);
    expect(Number.isInteger(pressure)).toBe(true);
  });

  it('is higher for configs with more waves', () => {
    const single = estimateInvasionPressure(makeInvasionConfig(1, 5));
    const multi  = estimateInvasionPressure(makeInvasionConfig(3, 5));
    expect(multi).toBeGreaterThan(single);
  });

  it('is higher for heavier enemy types', () => {
    const light: InvasionConfig = {
      id: 'light', name: 'light', isStoryInvasion: true,
      waves: [{ waveNumber: 1, invaders: [{ type: 'peasant_soldier', count: 5 }] }],
    };
    const heavy: InvasionConfig = {
      id: 'heavy', name: 'heavy', isStoryInvasion: true,
      waves: [{ waveNumber: 1, invaders: [{ type: 'primordial_titan', count: 5 }] }],
    };
    expect(estimateInvasionPressure(heavy)).toBeGreaterThan(estimateInvasionPressure(light));
  });
});

// ─── getDefenseTotals ─────────────────────────────────────────────────────────

describe('getDefenseTotals', () => {
  it('returns all zeros for a fresh game state', () => {
    const gs = makeGs({ dmLevel: 1, dungeonSlots: [] });
    const rooms = getDefenseRooms(gs);
    const totals = getDefenseTotals(gs, rooms);
    expect(totals.builtRooms).toBe(0);
    expect(totals.monsterCount).toBe(0);
    expect(totals.trapCount).toBe(0);
    expect(totals.totalPower).toBe(0);
  });

  it('counts built rooms and monsters correctly', () => {
    const gs = makeGs({
      dmLevel: 1,
      dungeonSlots: [
        makeCombatSlot({ monsterIds: ['dokkaebi_warrior'] }),
      ],
    });
    const rooms = getDefenseRooms(gs);
    const totals = getDefenseTotals(gs, rooms);
    expect(totals.builtRooms).toBe(1);
    expect(totals.monsterCount).toBe(1);
  });

  it('sums totalPower across rooms', () => {
    const gs = makeGs({
      dmLevel: 2, // unlocks 2 slots
      dungeonSlots: [
        makeCombatSlot({ monsterIds: ['dokkaebi_warrior'] }),
        makeCombatSlot({ roomType: 'trap', trapIds: ['spike_trap'] }),
      ],
    });
    const rooms = getDefenseRooms(gs);
    const totals = getDefenseTotals(gs, rooms);
    expect(totals.totalPower).toBeGreaterThan(0);
    expect(totals.trapCount).toBe(1);
  });
});

// ─── getDefenseDirective ──────────────────────────────────────────────────────

describe('getDefenseDirective', () => {
  it('returns a room-design directive when no rooms are built', () => {
    const gs = makeGs({ dmLevel: 1, dungeonSlots: [] });
    const rooms = getDefenseRooms(gs);
    const totals = getDefenseTotals(gs, rooms);
    const directive = getDefenseDirective(rooms, totals, gs, undefined);
    expect(directive.severity).not.toBe('ready');
    expect(directive.actionSlotIdx).toBeDefined();
  });

  it('has readiness >= 100 when totalPower far exceeds pressure', () => {
    // Build multiple rooms with traps so totalPower far exceeds minimal pressure
    const slots: DungeonSlot[] = Array.from({ length: 3 }, () =>
      makeCombatSlot({
        monsterIds: ['dokkaebi_warrior', 'dokkaebi_warrior'],
        trapIds:    ['spike_trap'],
        roomLevel:  5,
        hp: 500,
        maxHp: 500,
      }),
    );
    const gs = makeGs({ dmLevel: 3, dungeonSlots: slots });
    const rooms = getDefenseRooms(gs);
    const totals = getDefenseTotals(gs, rooms);
    // Very low pressure (1 peasant)
    const cfg: InvasionConfig = { id: 'tiny', name: 'tiny', isStoryInvasion: true, waves: [{ waveNumber: 1, invaders: [{ type: 'peasant_soldier', count: 1 }] }] };
    const directive = getDefenseDirective(rooms, totals, gs, cfg);
    expect(directive.readiness).toBeGreaterThanOrEqual(100);
    expect(directive.pressure).toBeGreaterThan(0);
  });

  it('keeps growth guidance on the computed defense readiness', () => {
    const growthAction: RoomActionRecommendation = {
      kind: 'growth',
      slotIdx: 0,
      icon: '▲',
      label: '성장',
      title: '수호자 성장',
      body: '도깨비 전사 Lv.1 · 목표 Lv.2',
      ctaLabel: '성장 이동',
      statLabel: 'Lv',
      statValue: '1/2',
      accent: 0x66c08a,
    };

    const directive = buildDefenseDirectiveFromRoomAction(growthAction, 296, 23);

    expect(directive.readiness).toBe(296);
    expect(directive.body).toContain('준비도 100%+');
    expect(directive.body).not.toContain('준비도 1%');
  });
});

// ─── getDefenseDirectiveDisplayChip ──────────────────────────────────────────

describe('getDefenseDirectiveDisplayChip', () => {
  it('maps warning+위험 chip to 보강', () => {
    const copy = getReadinessDirectiveCopy('power-risk', { currentPower: 10, requiredPower: 100 });
    const directive = buildDefenseDirective(copy, 10, 100);
    // If chip is '위험' and severity is 'warning', should map to '보강'
    if (directive.chip === '위험' && directive.severity === 'warning') {
      expect(getDefenseDirectiveDisplayChip(directive)).toBe('보강');
    } else {
      expect(getDefenseDirectiveDisplayChip(directive)).toBe(directive.chip);
    }
  });

  it('passes through chip unchanged for non-warning severity', () => {
    const copy = getReadinessDirectiveCopy('battle-ready', { currentPower: 200, requiredPower: 100, readiness: 200 });
    const directive = buildDefenseDirective(copy, 200, 100);
    expect(getDefenseDirectiveDisplayChip(directive)).toBe(directive.chip);
  });
});

describe('invasion pressure follows actual combat HP', () => {
  const invasions = MAIN_QUESTS.flatMap(q => q.invasionOnComplete ? [q.invasionOnComplete] : []);
  for (const invasion of invasions) {
    it(`${invasion.id}: every spawned type contributes its actual HP`, () => {
      const target = buildStoryInvasionTarget(invasion).stage!;
      const weightedHp = target.waves.reduce((sum, w, i) => sum + (1 + i * 0.18)
        * w.invaders.reduce((hp, e) => hp + INVADER_DEFS[e.type].hp * e.count, 0), 0);
      // Keep the first peasant encounter's original UI scale, derive all others.
      expect(estimateInvasionPressure(invasion)).toBe(Math.max(1, Math.round(weightedHp * 14 / INVADER_DEFS.peasant.hp * 0.55)));
    });
  }
  it('a later registry type cannot collapse to an arbitrary fallback score', () => {
    const config = (type: string): InvasionConfig => ({
      id: type, name: type, isStoryInvasion: true,
      waves: [{ waveNumber: 1, invaders: [{ type, count: 5 }] }],
    });
    expect(estimateInvasionPressure(config('celestial_knight'))).toBeGreaterThan(estimateInvasionPressure(config('shield_knight')));
    expect(estimateInvasionPressure(config('shield_knight'))).toBe(estimateInvasionPressure(config('knight')));
  });
});

// Story quests still name legacy types (peasant_soldier…) that fight as their
// aliases. PreBattle said "농민병사 ×3" while the scout report and the battle
// showed "농민": the briefing must name what actually arrives.
describe('enemyDisplayName', () => {
  it('names the invader a story alias fights as', async () => {
    const { enemyDisplayName } = await import('./PreBattleShared');
    expect(['peasant_soldier', 'shield_knight', 'shadow_thief', 'field_medic'].map(enemyDisplayName))
      .toEqual(['농민', '기사', '그림자 닌자', '무당']);
    expect(enemyDisplayName('soldier')).toBe('병사');
    expect(enemyDisplayName('unknown_type')).toBe('unknown_type');
  });
});
