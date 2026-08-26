import { describe, it, expect } from 'vitest';
import { resolveSpawnDef } from './spawnDefResolve';
import { registerDynamicSpawn } from './waveSpawnAccounting';
import { INVADER_DEFS } from '../data/invaders';
import type { WeeklyBoss } from '../data/daily';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const NEUTRAL_MULTS = { waveHpMult: 1, waveSpdMult: 1, dailySpeedMult: 1 };

describe('dynamic spawn accounting', () => {
  it('increments the runtime total and refreshes the kill counter denominator', () => {
    const labels: string[] = [];
    const ctx = {
      waveInvaderTotal: 9,
      killsThisWave: 9,
      killCounterText: { setText: (text: string) => labels.push(text) },
    };

    registerDynamicSpawn(ctx);

    expect(ctx.waveInvaderTotal).toBe(10);
    expect(labels).toEqual(['💀 9 / 10']);
  });
});

function makeWeeklyBoss(overrides: Partial<WeeklyBoss> = {}): WeeklyBoss {
  return {
    name:      '용왕의 분노',
    bossType:  'dragon_king',
    totalHp:   50_000,
    phases:    5,
    rewards:   { legendaryMaterial: 'boss_essence', skinShards: 5 },
    weekIndex: 0,
    ...overrides,
  };
}

// ─── Wave multipliers (existing behavior preserved) ───────────────────────────

describe('resolveSpawnDef — wave multipliers', () => {
  it('returns the original def reference when all multipliers are 1 and no weekly boss', () => {
    const def = INVADER_DEFS.soldier;
    expect(resolveSpawnDef(def, NEUTRAL_MULTS)).toBe(def);
  });

  it('applies waveHpMult to hp with rounding', () => {
    const def = INVADER_DEFS.soldier; // hp 150
    const out = resolveSpawnDef(def, { ...NEUTRAL_MULTS, waveHpMult: 1.5 });
    expect(out.hp).toBe(225);
    expect(out).not.toBe(def);
  });

  it('applies waveSpdMult × dailySpeedMult to speed with rounding', () => {
    const def = INVADER_DEFS.soldier; // speed 55
    const out = resolveSpawnDef(def, { waveHpMult: 1, waveSpdMult: 1.2, dailySpeedMult: 1.5 });
    expect(out.speed).toBe(Math.round(55 * 1.2 * 1.5));
  });

  it('does not mutate the INVADER_DEFS entry when multipliers apply', () => {
    const def = INVADER_DEFS.knight;
    const originalHp = def.hp;
    resolveSpawnDef(def, { ...NEUTRAL_MULTS, waveHpMult: 2 });
    expect(INVADER_DEFS.knight.hp).toBe(originalHp);
  });
});

// ─── Weekly boss totalHp override ─────────────────────────────────────────────

describe('resolveSpawnDef — weekly boss override', () => {
  it('boss hp becomes exactly weeklyBoss.totalHp (not the base def hp)', () => {
    const weekly = makeWeeklyBoss({ bossType: 'dragon_king', totalHp: 50_000 });
    const out = resolveSpawnDef(INVADER_DEFS.dragon_king, NEUTRAL_MULTS, weekly);
    expect(out.hp).toBe(50_000);
  });

  it('wave HP multipliers never stack on the weekly totalHp', () => {
    const weekly = makeWeeklyBoss({ totalHp: 50_000 });
    const out = resolveSpawnDef(
      INVADER_DEFS.dragon_king,
      { ...NEUTRAL_MULTS, waveHpMult: 2 },
      weekly,
    );
    expect(out.hp).toBe(50_000);
  });

  it('forces isBoss=true so mini-boss defs get boss aura/label/HUD tracking', () => {
    // dragon_king is isMiniBoss in INVADER_DEFS, not isBoss
    expect(INVADER_DEFS.dragon_king.isBoss).not.toBe(true);
    const out = resolveSpawnDef(INVADER_DEFS.dragon_king, NEUTRAL_MULTS, makeWeeklyBoss());
    expect(out.isBoss).toBe(true);
  });

  it('preserves all other def fields (speed, damage, reward, behavior, type)', () => {
    const def = INVADER_DEFS.dragon_king;
    const out = resolveSpawnDef(def, NEUTRAL_MULTS, makeWeeklyBoss());
    expect(out.type).toBe(def.type);
    expect(out.speed).toBe(def.speed);
    expect(out.damage).toBe(def.damage);
    expect(out.reward).toBe(def.reward);
    expect(out.behavior).toBe(def.behavior);
  });

  it('does not mutate the INVADER_DEFS entry', () => {
    const before = { ...INVADER_DEFS.dragon_king };
    resolveSpawnDef(INVADER_DEFS.dragon_king, NEUTRAL_MULTS, makeWeeklyBoss());
    expect(INVADER_DEFS.dragon_king).toEqual(before);
  });

  it('non-boss invaders (escort summons) are untouched in weekly mode', () => {
    const weekly = makeWeeklyBoss({ bossType: 'dragon_king' });
    const soldier = resolveSpawnDef(INVADER_DEFS.soldier, NEUTRAL_MULTS, weekly);
    expect(soldier).toBe(INVADER_DEFS.soldier);
    expect(soldier.hp).toBe(INVADER_DEFS.soldier.hp);
    expect(soldier.isBoss).not.toBe(true);
  });

  it('applies to every boss in the weekly pool roster', () => {
    const POOL_TYPES = [
      'dragon_king', 'fox_queen', 'three_god_destroyer', 'death_emissary',
      'eternal_emperor', 'god_emperor', 'celestial_dragon', 'primordial_titan',
    ] as const;
    for (const type of POOL_TYPES) {
      const weekly = makeWeeklyBoss({ bossType: type, totalHp: 77_777 });
      const out = resolveSpawnDef(INVADER_DEFS[type], NEUTRAL_MULTS, weekly);
      expect(out.hp, type).toBe(77_777);
      expect(out.isBoss, type).toBe(true);
    }
  });

  it('weekly mode with wave speed multipliers still scales boss speed', () => {
    const def = INVADER_DEFS.dragon_king; // speed 40
    const out = resolveSpawnDef(
      def, { waveHpMult: 1, waveSpdMult: 1.5, dailySpeedMult: 1 }, makeWeeklyBoss(),
    );
    expect(out.speed).toBe(60);
    expect(out.hp).toBe(50_000);
  });
});
