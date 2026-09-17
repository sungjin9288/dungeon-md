import { describe, expect, it } from 'vitest';
import { MATERIAL_DEFS } from './fusion';
import {
  AFFLICTION_DEFS,
  AFFLICTION_ORDER,
  COMBO_MAX_AFFLICTIONS,
  comboMultiplier,
  getTrapDef,
  isTrapRecipeFusion,
  TRAP_DEFS,
  TRAP_MASTERY_MAX,
  trapEffectiveDps,
  trapMasteryCost,
  trapMasteryMult,
  shouldAnnounceCombo,
} from './traps';

describe('trap definitions', () => {
  it('has 16 traps: six tier-1 singles, six tier-2 pairs, four tier-3 triples', () => {
    const byTier = (tier: number) => TRAP_DEFS.filter(t => t.tier === tier);
    expect(byTier(1)).toHaveLength(6);
    expect(byTier(2)).toHaveLength(6);
    expect(byTier(3)).toHaveLength(4);
    for (const trap of byTier(1)) expect(trap.afflictions).toHaveLength(1);
    for (const trap of byTier(2)) expect(trap.afflictions).toHaveLength(2);
    for (const trap of byTier(3)) expect(trap.afflictions).toHaveLength(3);
    expect(new Set(TRAP_DEFS.map(t => t.id)).size).toBe(TRAP_DEFS.length);
  });

  it('keeps the four legacy trap ids so saved slots still resolve', () => {
    for (const id of ['spike_trap', 'slow_trap', 'poison_trap', 'stun_trap']) expect(getTrapDef(id)?.tier).toBe(1);
  });

  it('every tier-1 affliction is unique and covers all six afflictions', () => {
    const singles = TRAP_DEFS.filter(t => t.tier === 1).map(t => t.afflictions[0]);
    expect([...singles].sort()).toEqual([...AFFLICTION_ORDER].sort());
  });

  it('fusion recipes reference lower-tier traps whose afflictions they inherit, and known materials', () => {
    for (const trap of TRAP_DEFS) {
      for (const material of Object.keys(trap.recipe.materials)) expect(MATERIAL_DEFS[material], `${trap.id} ${material}`).toBeDefined();
      if (trap.tier === 1) { expect(isTrapRecipeFusion(trap.recipe)).toBe(false); continue; }
      expect(isTrapRecipeFusion(trap.recipe)).toBe(true);
      if (!isTrapRecipeFusion(trap.recipe)) continue;
      const inputs = trap.recipe.traps.map(id => getTrapDef(id));
      for (const input of inputs) {
        expect(input, `${trap.id} input`).toBeDefined();
        expect(input!.tier).toBe(trap.tier - 1);
      }
      const inherited = new Set(inputs.flatMap(input => input!.afflictions));
      for (const affliction of trap.afflictions) expect(inherited.has(affliction), `${trap.id} ${affliction}`).toBe(true);
    }
  });

  it('only tier-1 traps carry a gold price; higher tiers install from stock', () => {
    for (const trap of TRAP_DEFS) expect(trap.cost > 0).toBe(trap.tier === 1);
  });
});

describe('combo and mastery', () => {
  it('multiplies damage by +25% per distinct affliction past the first, capped at four', () => {
    expect(comboMultiplier(0)).toBe(1);
    expect(comboMultiplier(1)).toBe(1);
    expect(comboMultiplier(2)).toBeCloseTo(1.25);
    expect(comboMultiplier(3)).toBeCloseTo(1.5);
    expect(comboMultiplier(COMBO_MAX_AFFLICTIONS)).toBeCloseTo(1.75);
    expect(comboMultiplier(9)).toBeCloseTo(1.75);
  });

  it('mastery adds 15% per level up to +5 and prices the next level off the recipe', () => {
    expect(trapMasteryMult(0)).toBe(1);
    expect(trapMasteryMult(2)).toBeCloseTo(1.3);
    expect(trapMasteryMult(TRAP_MASTERY_MAX + 3)).toBeCloseTo(1.75);
    const spike = getTrapDef('spike_trap')!;
    expect(trapMasteryCost(spike, 0)).toEqual({ iron_shard: 2 });
    expect(trapMasteryCost(spike, 2)).toEqual({ iron_shard: 6 });
  });

  it('simulation worth sums the afflictions and scales with mastery', () => {
    expect(trapEffectiveDps('spike_trap')).toBe(AFFLICTION_DEFS.bleed.simDps);
    expect(trapEffectiveDps('thorn_wall')).toBe(AFFLICTION_DEFS.bleed.simDps + AFFLICTION_DEFS.poison.simDps);
    expect(trapEffectiveDps('thorn_wall', 2)).toBeCloseTo((5 + 8) * 1.3);
    expect(trapEffectiveDps('nope')).toBe(0);
  });
});

describe('combo announcement', () => {
  it('announces only escalation past the last shown level, and only from two afflictions', () => {
    expect(shouldAnnounceCombo(0, 1)).toBe(false);
    expect(shouldAnnounceCombo(0, 2)).toBe(true);
    expect(shouldAnnounceCombo(2, 2)).toBe(false);
    expect(shouldAnnounceCombo(2, 3)).toBe(true);
    expect(shouldAnnounceCombo(4, 3)).toBe(false);
  });
});
