import { describe, expect, it } from 'vitest';
import {
  equipSkin,
  equipTheme,
  purchaseAndEquipTheme,
  purchaseAndEquipSkin,
  purchaseDailyEquipment,
  purchaseDailySkill,
  purchaseSkin,
  unequipSkin,
  unequipTheme,
} from './shopTransactions';
import type { GameState } from './wisdom';

function makeState(overrides: Partial<GameState> = {}): GameState {
  return {
    soulCrystals: 100,
    ownedEquipment: ['starter_blade'],
    ownedActiveSkills: ['starter_skill'],
    gems: 250,
    ownedThemes: ['cave'],
    equippedTheme: 'cave',
    ownedSkins: {},
    equippedSkins: {},
    ...overrides,
  } as GameState;
}

describe('shopTransactions — daily equipment', () => {
  it('buys new equipment without mutating the input state', () => {
    const state = makeState();
    const result = purchaseDailyEquipment(state, 'dragon_claw', 60);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.changed).toBe(true);
    expect(result.state).not.toBe(state);
    expect(result.state.soulCrystals).toBe(40);
    expect(result.state.ownedEquipment).toEqual(['starter_blade', 'dragon_claw']);
    expect(state.soulCrystals).toBe(100);
    expect(state.ownedEquipment).toEqual(['starter_blade']);
  });

  it('does not charge again for already-owned equipment', () => {
    const state = makeState({ ownedEquipment: ['dragon_claw'] });
    const result = purchaseDailyEquipment(state, 'dragon_claw', 60);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.changed).toBe(false);
    expect(result.state).toBe(state);
    expect(result.state.soulCrystals).toBe(100);
  });

  it('fails without changing state when soul crystals are insufficient', () => {
    const state = makeState({ soulCrystals: 10 });
    const result = purchaseDailyEquipment(state, 'dragon_claw', 60);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe('insufficient_soul_crystals');
    expect(result.state).toBe(state);
    expect(state.ownedEquipment).toEqual(['starter_blade']);
  });
});

describe('shopTransactions — daily skills', () => {
  it('buys new active skills immutably', () => {
    const state = makeState();
    const result = purchaseDailySkill(state, 'lightning', 35);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.changed).toBe(true);
    expect(result.state.soulCrystals).toBe(65);
    expect(result.state.ownedActiveSkills).toEqual(['starter_skill', 'lightning']);
    expect(state.ownedActiveSkills).toEqual(['starter_skill']);
  });

  it('does not duplicate or charge an already-owned skill', () => {
    const state = makeState({ ownedActiveSkills: ['lightning'] });
    const result = purchaseDailySkill(state, 'lightning', 35);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.changed).toBe(false);
    expect(result.state.soulCrystals).toBe(100);
    expect(result.state.ownedActiveSkills).toEqual(['lightning']);
  });
});

describe('shopTransactions — themes', () => {
  it('equips an owned theme without changing gems', () => {
    const state = makeState({ ownedThemes: ['cave', 'ice_cave'], gems: 150 });
    const result = equipTheme(state, 'ice_cave');

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.changed).toBe(true);
    expect(result.state.equippedTheme).toBe('ice_cave');
    expect(result.state.gems).toBe(150);
    expect(state.equippedTheme).toBe('cave');
  });

  it('unequips to the default cave theme', () => {
    const state = makeState({ ownedThemes: ['cave', 'void_throne'], equippedTheme: 'void_throne' });
    const result = unequipTheme(state);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.equippedTheme).toBe('cave');
  });

  it('purchases and equips a new theme with cave fallback ownership', () => {
    const state = makeState({ gems: 400, ownedThemes: undefined as unknown as string[] });
    const result = purchaseAndEquipTheme(state, 'celestial_realm', 400);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.changed).toBe(true);
    expect(result.state.gems).toBe(0);
    expect(result.state.ownedThemes).toEqual(['cave', 'celestial_realm']);
    expect(result.state.equippedTheme).toBe('celestial_realm');
  });

  it('fails without changing state when gems are insufficient for a new theme', () => {
    const state = makeState({ gems: 10 });
    const result = purchaseAndEquipTheme(state, 'void_throne', 300);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe('insufficient_gems');
    expect(result.state).toBe(state);
    expect(state.ownedThemes).toEqual(['cave']);
  });

  it('equips an owned but inactive theme without charging gems', () => {
    const state = makeState({ gems: 5, ownedThemes: ['cave', 'void_throne'] });
    const result = purchaseAndEquipTheme(state, 'void_throne', 300);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.changed).toBe(true);
    expect(result.state.gems).toBe(5);
    expect(result.state.ownedThemes).toEqual(['cave', 'void_throne']);
    expect(result.state.equippedTheme).toBe('void_throne');
  });
});

describe('shopTransactions — skins', () => {
  it('purchases a new skin without equipping it', () => {
    const state = makeState({ gems: 120 });
    const result = purchaseSkin(state, 'slime', 'slime_gold', 80);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.changed).toBe(true);
    expect(result.state.gems).toBe(40);
    expect(result.state.ownedSkins?.slime).toEqual(['slime_gold']);
    expect(result.state.equippedSkins?.slime).toBeUndefined();
    expect(state.ownedSkins?.slime).toBeUndefined();
  });

  it('does not duplicate or charge an already-owned skin', () => {
    const state = makeState({ gems: 120, ownedSkins: { slime: ['slime_gold'] } });
    const result = purchaseSkin(state, 'slime', 'slime_gold', 80);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.changed).toBe(false);
    expect(result.state).toBe(state);
    expect(result.state.gems).toBe(120);
  });

  it('fails without changing state when gems are insufficient for a new skin', () => {
    const state = makeState({ gems: 10 });
    const result = purchaseSkin(state, 'slime', 'slime_gold', 80);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe('insufficient_gems');
    expect(result.state).toBe(state);
    expect(state.ownedSkins?.slime).toBeUndefined();
  });

  it('equips an owned skin without changing gems', () => {
    const state = makeState({ gems: 120, ownedSkins: { slime: ['slime_gold'] } });
    const result = equipSkin(state, 'slime', 'slime_gold');

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.changed).toBe(true);
    expect(result.state.gems).toBe(120);
    expect(result.state.equippedSkins?.slime).toBe('slime_gold');
    expect(state.equippedSkins?.slime).toBeUndefined();
  });

  it('refuses to equip a skin that is not owned', () => {
    const state = makeState({ gems: 120 });
    const result = equipSkin(state, 'slime', 'slime_gold');

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe('skin_not_owned');
    expect(result.state).toBe(state);
  });

  it('unequips a skin by removing only that monster mapping', () => {
    const state = makeState({
      equippedSkins: { slime: 'slime_gold', goblin: 'goblin_shadow' },
    });
    const result = unequipSkin(state, 'slime');

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.changed).toBe(true);
    expect(result.state.equippedSkins).toEqual({ goblin: 'goblin_shadow' });
    expect(state.equippedSkins).toEqual({ slime: 'slime_gold', goblin: 'goblin_shadow' });
  });

  it('purchases and equips a new skin in one transaction', () => {
    const state = makeState({ gems: 200 });
    const result = purchaseAndEquipSkin(state, 'slime', 'slime_gold', 80);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.changed).toBe(true);
    expect(result.state.gems).toBe(120);
    expect(result.state.ownedSkins?.slime).toEqual(['slime_gold']);
    expect(result.state.equippedSkins?.slime).toBe('slime_gold');
  });

  it('equips an owned but inactive skin without charging gems', () => {
    const state = makeState({ gems: 5, ownedSkins: { slime: ['slime_gold'] } });
    const result = purchaseAndEquipSkin(state, 'slime', 'slime_gold', 80);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.changed).toBe(true);
    expect(result.state.gems).toBe(5);
    expect(result.state.ownedSkins?.slime).toEqual(['slime_gold']);
    expect(result.state.equippedSkins?.slime).toBe('slime_gold');
  });
});
