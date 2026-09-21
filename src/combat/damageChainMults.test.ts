/**
 * Every multiplier the damage chain advertises actually reaches the hit.
 *
 * Two of them did not. `waveAtkMult` was reset to 1 by startWave before any
 * spawn, and `synergyAtkMult` did not exist at all: SynergyManager called
 * `getSynergyAtkMult(...)` and threw the result away under a comment claiming
 * it "populates a cache" that was never built, while its public getAtkMult()
 * had no caller anywhere in src. All 31 tribe ATK tiers — celestial ×8 +75%,
 * dragon ×8 +65%, dokkaebi ×8 +60% and the rest — were inert.
 *
 * Asserting on the table (synergy.test.ts does) cannot see this; only the chain
 * can. This drives resolveAttack twice and compares the damage it deals.
 */
import { describe, expect, it } from 'vitest';
import { resolveAttack, type CombatResolverContext } from './CombatResolver';
import type { RoomData } from '../data/rooms';
import type { CombatMonsterDef } from '../data/monsters';
import type { Invader } from '../objects/Invader';

function room(): RoomData {
  return {
    type: 'guardian', level: 1, roomTypeDmgMult: 1, armoryDmgBonus: 0,
    monsterSlot: null, monsterSlots: [], hasFirstStrikeUsed: true,
    nextAttack3x: false, rageUntil: 0, speedBoostUntil: 0,
  } as unknown as RoomData;
}

/** Room game-object stub: resolveAttack reads .x and fires attack visuals on it. */
function stubRoom() {
  return { x: 100, y: 100, flashAttack: () => {}, fireProjectile: () => {}, setTint: () => {}, clearTint: () => {} };
}

function ctx(overrides: Partial<CombatResolverContext> = {}): CombatResolverContext {
  const grid: (RoomData | null)[][] = [[room(), null, null], [null, null, null], [null, null, null]];
  return {
    scene: { add: {}, time: { now: 0 }, tweens: {} },
    rooms: [[stubRoom(), stubRoom(), stubRoom()]],
    roomGrid: grid,
    activeInvaders: [],
    effectiveCols: 3,
    effectiveCellSize: 64,
    equipmentMap: new Map(),
    guardianAtkMult: new Map(),
    waveAtkMult: 1,
    synergyAtkMult: 1,
    wisdomBonuses: { monsterAtkMult: 1 },
    prestigeDmgMult: 1,
    speedMult: 1,
    gold: 0,
    tauntBoostActiveUntil: 0,
    setGoldRegistry: () => {},
    hasSynergy: () => false,
    applyWarHexToHighestHP: () => {},
    triggerTauntingRoar: () => {},
    triggerSpectralBolt: () => {},
    triggerWhirlwind: () => {},
    triggerChainLightning: () => {},
    ...overrides,
  } as unknown as CombatResolverContext;
}

const MONSTER = { baseDamage: 100, attackCooldown: 1000, type: 'melee' } as unknown as CombatMonsterDef;

/** Damage resolveAttack actually hands to the target under this context. */
function damageDealt(overrides: Partial<CombatResolverContext>): number {
  let dealt = 0;
  const target = {
    active: true, isDead: false, hp: 1_000_000, maxHp: 1_000_000, x: 100, y: 100,
    takeDamage: (value: number) => { dealt += value; },
    comboCount: () => 0,
    noteComboAnnounce: () => false,
    isInvisible: false, isVoidPhasing: false, isImmune: false,
  } as unknown as Invader;
  resolveAttack(ctx(overrides), 0, 0, room(), MONSTER, target, 100, 0);
  return dealt;
}

describe('damage chain multipliers reach the hit', () => {
  const baseline = damageDealt({});

  it('the stub lands a hit at all', () => {
    expect(baseline).toBeGreaterThan(0);
  });

  it('tribe synergy ATK scales the damage', () => {
    expect(damageDealt({ synergyAtkMult: 1.75 })).toBeCloseTo(baseline * 1.75, 5);
    expect(damageDealt({ synergyAtkMult: 1.60 })).toBeCloseTo(baseline * 1.60, 5);
  });

  it('wave-event ATK scales the damage', () => {
    expect(damageDealt({ waveAtkMult: 1.25 })).toBeCloseTo(baseline * 1.25, 5);
  });

  it('the two compose rather than overriding each other', () => {
    expect(damageDealt({ synergyAtkMult: 1.5, waveAtkMult: 1.2 }))
      .toBeCloseTo(baseline * 1.5 * 1.2, 5);
  });

  it('an absent synergy multiplier is neutral, not zero', () => {
    expect(damageDealt({ synergyAtkMult: undefined })).toBeCloseTo(baseline, 5);
  });
});
