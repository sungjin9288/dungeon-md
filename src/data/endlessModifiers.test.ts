/**
 * Unit tests for endless challenge modifiers + their application to the spawn queue.
 */

import { describe, it, expect } from 'vitest';
import {
  ENDLESS_MODIFIERS,
  getEndlessModifierById,
  rollEndlessModifier,
} from './endlessModifiers';
import { buildEndlessSpawnQueue } from './endlessWave';

describe('ENDLESS_MODIFIERS', () => {
  it('every modifier pays off (rewardMult >= 1) and has positive multipliers', () => {
    expect(ENDLESS_MODIFIERS.length).toBeGreaterThanOrEqual(5);
    for (const m of ENDLESS_MODIFIERS) {
      expect(m.rewardMult).toBeGreaterThanOrEqual(1);
      expect(m.hpMult).toBeGreaterThan(0);
      expect(m.speedMult).toBeGreaterThan(0);
      expect(m.countMult).toBeGreaterThan(0);
      expect(m.id && m.name && m.icon && m.desc).toBeTruthy();
    }
  });

  it('has unique ids', () => {
    const ids = ENDLESS_MODIFIERS.map(m => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('offers a full roster (>=12) with eliteBias kept within [0,1]', () => {
    expect(ENDLESS_MODIFIERS.length).toBeGreaterThanOrEqual(12);
    for (const m of ENDLESS_MODIFIERS) {
      expect(m.eliteBias, `${m.id} eliteBias`).toBeGreaterThanOrEqual(0);
      expect(m.eliteBias, `${m.id} eliteBias`).toBeLessThanOrEqual(1);
    }
  });

  it('resolves the second-wave roster ids (glacial/blitz/golden/juggernaut/tempest/cursed)', () => {
    for (const id of ['glacial', 'blitz', 'golden', 'juggernaut', 'tempest', 'cursed']) {
      expect(getEndlessModifierById(id)?.id, `modifier ${id}`).toBe(id);
    }
  });

  it('resolves the newest roster ids (glass_cannon/vanguard/treasure/doomtide/phantom)', () => {
    for (const id of ['glass_cannon', 'vanguard', 'treasure', 'doomtide', 'phantom']) {
      expect(getEndlessModifierById(id)?.id, `modifier ${id}`).toBe(id);
    }
  });

  it('offers an expanded roster of at least 17 modifiers', () => {
    expect(ENDLESS_MODIFIERS.length).toBeGreaterThanOrEqual(17);
  });
});

describe('rollEndlessModifier', () => {
  it('is deterministic given an injected rng (first / last)', () => {
    expect(rollEndlessModifier(() => 0)).toBe(ENDLESS_MODIFIERS[0]);
    expect(rollEndlessModifier(() => 0.999)).toBe(ENDLESS_MODIFIERS[ENDLESS_MODIFIERS.length - 1]);
  });
});

describe('getEndlessModifierById', () => {
  it('resolves known ids and rejects unknown/null', () => {
    expect(getEndlessModifierById('swarm')?.id).toBe('swarm');
    expect(getEndlessModifierById('nope')).toBeNull();
    expect(getEndlessModifierById(null)).toBeNull();
    expect(getEndlessModifierById(undefined)).toBeNull();
  });
});

describe('buildEndlessSpawnQueue with modifier', () => {
  const swarm = getEndlessModifierById('swarm')!;     // countMult 1.6
  const elite = getEndlessModifierById('elite')!;     // countMult 0.7
  const armored = getEndlessModifierById('armored')!; // hpMult 1.4, rewardMult 1.3
  const swift = getEndlessModifierById('swift')!;     // speedMult 1.3

  it('countMult scales the per-wave spawn count (non-milestone wave 7)', () => {
    // wave 7: base count = round((5 + floor(7/5)) * mCount) = round(6 * mCount)
    const base  = buildEndlessSpawnQueue(7).length;
    const swarmN = buildEndlessSpawnQueue(7, swarm).length;
    const eliteN = buildEndlessSpawnQueue(7, elite).length;
    expect(base).toBe(6);
    expect(swarmN).toBe(10); // round(6 * 1.6)
    expect(eliteN).toBe(4);  // round(6 * 0.7)
  });

  it('armored raises the wave-20 mini-boss HP and reward vs. baseline', () => {
    const base = buildEndlessSpawnQueue(20)[0].def;       // knight mini-boss
    const mod  = buildEndlessSpawnQueue(20, armored)[0].def;
    expect(mod.isMiniBoss).toBe(true);
    expect(mod.hp).toBeGreaterThan(base.hp);
    expect(mod.reward).toBeGreaterThan(base.reward);
    // ~1.4× HP, ~1.3× reward (rounding tolerance)
    expect(mod.hp / base.hp).toBeCloseTo(1.4, 1);
    expect(mod.reward / base.reward).toBeCloseTo(1.3, 1);
  });

  it('swift raises invader speed vs. baseline', () => {
    const base = buildEndlessSpawnQueue(20)[0].def;
    const mod  = buildEndlessSpawnQueue(20, swift)[0].def;
    expect(mod.speed).toBeGreaterThanOrEqual(base.speed);
  });

  it('is unchanged when no modifier is passed', () => {
    expect(buildEndlessSpawnQueue(7).length).toBe(buildEndlessSpawnQueue(7, null).length);
  });
});
