import { describe, it, expect } from 'vitest';
import { MATERIAL_DEFS } from './fusion';
import { INVADER_DEFS } from './invaders';
import {
  ABYSS_MAX_FLOOR,
  ABYSS_KEY_MAX,
  ABYSS_TIER_SPAN,
  abyssTier,
  abyssFloorCoreDamage,
  abyssFloorDungeonHp,
  abyssFloorWaveHp,
  buildAbyssFloorWaves,
  DEFAULT_ABYSS_STATE,
  isAbyssBossFloor,
  abyssBand,
  getAbyssFloorConfig,
  getAbyssFloorLoot,
  rollAbyssLoot,
  refilledKeys,
  canSweepAbyss,
  nextAbyssFloor,
  getAbyssMaterialSource,
  dropsInAbyss,
  abyssMaterialSourceLabel,
  type AbyssState,
} from './abyss';

const ALWAYS = () => 0;        // every chance roll passes; rollInt → min
const NEVER = () => 0.999;     // no chance roll passes (except chance:1)

describe('abyss floor classification', () => {
  it('boss floors are every 10th', () => {
    expect(isAbyssBossFloor(10)).toBe(true);
    expect(isAbyssBossFloor(20)).toBe(true);
    expect(isAbyssBossFloor(9)).toBe(false);
    expect(isAbyssBossFloor(0)).toBe(false);
  });

  it('bands partition the tower', () => {
    expect(abyssBand(1)).toBe(0);
    expect(abyssBand(10)).toBe(0);
    expect(abyssBand(11)).toBe(1);
    expect(abyssBand(25)).toBe(1);
    expect(abyssBand(45)).toBe(2);
    expect(abyssBand(46)).toBe(3);
    expect(abyssBand(60)).toBe(3);
  });
});

describe('getAbyssFloorConfig', () => {
  it('clamps + scales power monotonically across non-boss floors', () => {
    const f1 = getAbyssFloorConfig(1);
    const f5 = getAbyssFloorConfig(5);
    expect(f1.floor).toBe(1);
    expect(f5.recommendedPower).toBeGreaterThan(f1.recommendedPower);
  });

  it('boss floors spike recommended power', () => {
    const f9 = getAbyssFloorConfig(9);
    const f10 = getAbyssFloorConfig(10);
    expect(f10.isBoss).toBe(true);
    expect(f10.recommendedPower).toBeGreaterThan(f9.recommendedPower * 1.3);
  });

  it('clamps out-of-range floors', () => {
    expect(getAbyssFloorConfig(0).floor).toBe(1);
    expect(getAbyssFloorConfig(999).floor).toBe(ABYSS_MAX_FLOOR);
  });
});

describe('floor difficulty actually scales with depth', () => {
  const floors = Array.from({ length: ABYSS_MAX_FLOOR }, (_, i) => i + 1);

  it('every invader the tier ladders name exists', () => {
    for (const floor of floors) {
      for (const wave of buildAbyssFloorWaves(floor)) {
        for (const group of wave.invaders) {
          expect(INVADER_DEFS[group.type], `floor ${floor} "${group.type}"`).toBeDefined();
        }
      }
    }
  });

  it('no two floors in a row are the same fight', () => {
    // The old builder saturated its spawn-count cap at floor 20, so floors
    // 26-45 were one encounter repeated twenty times and 46-60 another fifteen.
    const signature = (floor: number) => JSON.stringify(buildAbyssFloorWaves(floor));
    let repeats = 0;
    for (let floor = 2; floor <= ABYSS_MAX_FLOOR; floor++) {
      if (signature(floor) === signature(floor - 1)) repeats++;
    }
    expect(repeats, 'floors identical to the floor above them').toBe(0);
  });

  it('each tier fields a heavier fight than the tier above it', () => {
    const starts = floors
      .filter(floor => (floor - 1) % ABYSS_TIER_SPAN === 0)
      .map(floor => ({ floor, hp: abyssFloorWaveHp(floor) }));
    expect(starts.length).toBeGreaterThan(1);
    for (let i = 1; i < starts.length; i++) {
      expect(starts[i].hp, `tier start ${starts[i].floor} vs ${starts[i - 1].floor}`)
        .toBeGreaterThan(starts[i - 1].hp);
    }
    // The deepest floor must be the hardest: band 3 used to field berserkers
    // (180hp) where band 2 fielded knights (350hp), so 46-60 was *easier* than 26-45.
    expect(abyssFloorWaveHp(ABYSS_MAX_FLOOR)).toBe(Math.max(...floors.map(abyssFloorWaveHp)));
  });

  it('never gets lighter as you descend within a tier', () => {
    for (const floor of floors) {
      if ((floor - 1) % ABYSS_TIER_SPAN === 0) continue;  // a new tier may open softer
      expect(abyssFloorWaveHp(floor), `floor ${floor}`).toBeGreaterThanOrEqual(abyssFloorWaveHp(floor - 1));
    }
  });

  it('every boss floor is a wall, not a discount', () => {
    // Boss floors used to swap the big third wave for one 600hp golem, which
    // made them *easier* than the floor above.
    for (const floor of floors.filter(isAbyssBossFloor)) {
      expect(abyssFloorWaveHp(floor), `boss floor ${floor}`)
        .toBeGreaterThan(abyssFloorWaveHp(floor - 1) * 1.3);
    }
  });

  it('core health tracks the floor it is fought on', () => {
    // All sixty floors used to inherit DungeonScene's 1,000 because the abyss
    // stageConfig carried no dungeonHp.
    const ratio = (floor: number) => abyssFloorDungeonHp(floor) / abyssFloorCoreDamage(floor);
    for (const floor of floors) {
      expect(ratio(floor), `floor ${floor} forgiveness`).toBeCloseTo(ratio(1), 2);
    }
    expect(abyssFloorDungeonHp(ABYSS_MAX_FLOOR)).toBeGreaterThan(abyssFloorDungeonHp(1) * 3);
  });

  it('recommended power is read off the floor, not invented', () => {
    // The old curve claimed 406,632 at floor 60 for waves lighter than floor 26's.
    const perHp = (floor: number) => getAbyssFloorConfig(floor).recommendedPower / abyssFloorWaveHp(floor);
    for (const floor of floors) {
      expect(perHp(floor), `floor ${floor}`).toBeCloseTo(perHp(1), 3);
    }
  });

  it('tier spans ten floors and ends on a boss', () => {
    expect(abyssTier(1)).toBe(0);
    expect(abyssTier(ABYSS_TIER_SPAN)).toBe(0);
    expect(abyssTier(ABYSS_TIER_SPAN + 1)).toBe(1);
    expect(abyssTier(ABYSS_MAX_FLOOR)).toBe(ABYSS_MAX_FLOOR / ABYSS_TIER_SPAN - 1);
    for (let tier = 0; tier * ABYSS_TIER_SPAN < ABYSS_MAX_FLOOR; tier++) {
      expect(isAbyssBossFloor((tier + 1) * ABYSS_TIER_SPAN)).toBe(true);
    }
  });
});

describe('loot tables', () => {
  it('every loot material id exists in MATERIAL_DEFS', () => {
    for (let f = 1; f <= ABYSS_MAX_FLOOR; f++) {
      for (const entry of getAbyssFloorLoot(f)) {
        expect(MATERIAL_DEFS[entry.id], `floor ${f} mat "${entry.id}"`).toBeDefined();
        expect(entry.min).toBeGreaterThanOrEqual(1);
        expect(entry.max).toBeGreaterThanOrEqual(entry.min);
        expect(entry.chance).toBeGreaterThan(0);
      }
    }
  });

  it('boss floors guarantee boss_essence', () => {
    const loot = getAbyssFloorLoot(10);
    expect(loot.some(e => e.id === 'boss_essence')).toBe(true);
  });

  it('deeper bands unlock rarer mats (soul_fragment not in band 0)', () => {
    expect(getAbyssFloorLoot(3).some(e => e.id === 'soul_fragment')).toBe(false);
    expect(getAbyssFloorLoot(30).some(e => e.id === 'soul_fragment')).toBe(true);
  });
});

describe('rollAbyssLoot', () => {
  it('ALWAYS rng drops every table entry at min qty', () => {
    const loot = rollAbyssLoot(5, ALWAYS);
    expect(Object.keys(loot.materials).length).toBe(getAbyssFloorLoot(5).length);
    expect(loot.gold).toBeGreaterThan(0);
  });

  it('NEVER rng drops nothing on a non-boss floor', () => {
    const loot = rollAbyssLoot(5, NEVER);
    expect(Object.keys(loot.materials).length).toBe(0);
  });

  it('boss floor still drops guaranteed boss_essence under NEVER rng', () => {
    const loot = rollAbyssLoot(10, NEVER);
    expect(loot.materials.boss_essence).toBeGreaterThanOrEqual(1);
  });

  it('boss floor can grant awakening stones (ALWAYS rng)', () => {
    const loot = rollAbyssLoot(20, ALWAYS);
    expect(loot.awakeningStones).toBeGreaterThanOrEqual(1);
  });

  it('non-boss floor never grants awakening stones', () => {
    expect(rollAbyssLoot(7, ALWAYS).awakeningStones).toBe(0);
  });

  it('bonusMult increases gold', () => {
    expect(rollAbyssLoot(5, ALWAYS, 1.5).gold).toBeGreaterThan(rollAbyssLoot(5, ALWAYS, 1).gold);
  });
});

describe('key economy', () => {
  it('refills keys on a new day, preserves on same day', () => {
    const spent: AbyssState = { highestFloor: 3, keys: 2, lastRefill: '2026-06-15' };
    const refilled = refilledKeys(spent, '2026-06-16');
    expect(refilled.keys).toBe(ABYSS_KEY_MAX);
    expect(refilled.lastRefill).toBe('2026-06-16');
    expect(refilledKeys(refilled, '2026-06-16')).toBe(refilled); // same ref, no change
  });

  it('canSweepAbyss enforces cleared depth + keys', () => {
    const s: AbyssState = { highestFloor: 5, keys: 1, lastRefill: '' };
    expect(canSweepAbyss(s, 5).ok).toBe(true);
    expect(canSweepAbyss(s, 6)).toEqual({ ok: false, reason: 'locked' });
    expect(canSweepAbyss({ ...s, keys: 0 }, 5)).toEqual({ ok: false, reason: 'no_keys' });
  });

  it('nextAbyssFloor advances and caps', () => {
    expect(nextAbyssFloor({ ...DEFAULT_ABYSS_STATE })).toBe(1);
    expect(nextAbyssFloor({ highestFloor: 4, keys: 0, lastRefill: '' })).toBe(5);
    expect(nextAbyssFloor({ highestFloor: ABYSS_MAX_FLOOR, keys: 0, lastRefill: '' })).toBe(ABYSS_MAX_FLOOR);
  });
});

describe('abyss material → source lookup (farming-loop visibility)', () => {
  it('common_ore sources to the shallowest band (floor 1)', () => {
    const src = getAbyssMaterialSource('common_ore');
    expect(src).not.toBeNull();
    expect(src!.bands[0]).toBe(0);
    expect(src!.minFloor).toBe(1);
    expect(src!.bossOnly).toBe(false);
  });

  it('soul_fragment first appears in band 2 (floor 26)', () => {
    const src = getAbyssMaterialSource('soul_fragment');
    expect(src!.minFloor).toBe(26);
    expect(src!.bands).toContain(2);
    expect(src!.bands).toContain(3);
  });

  it('boss_essence is boss-only and tagged across all bands', () => {
    const src = getAbyssMaterialSource('boss_essence');
    expect(src!.bossOnly).toBe(true);
    expect(src!.minFloor).toBe(10);
    expect(src!.bands).toEqual([0, 1, 2, 3]);
  });

  it('non-abyss materials return null', () => {
    expect(getAbyssMaterialSource('nonexistent_material')).toBeNull();
    expect(dropsInAbyss('nonexistent_material')).toBe(false);
  });

  it('dropsInAbyss is true for every material in the loot tables', () => {
    for (const id of ['common_ore', 'iron_shard', 'magic_dust', 'soul_fragment', 'dok_fragment', 'boss_essence']) {
      expect(dropsInAbyss(id)).toBe(true);
      // every farmable material id must exist in MATERIAL_DEFS
      expect(MATERIAL_DEFS[id]).toBeDefined();
    }
  });

  it('abyssMaterialSourceLabel renders a short Korean tag', () => {
    expect(abyssMaterialSourceLabel('common_ore')).toBe('심연 1층~');
    expect(abyssMaterialSourceLabel('soul_fragment')).toBe('심연 26층~');
    expect(abyssMaterialSourceLabel('boss_essence')).toBe('심연 보스층');
    expect(abyssMaterialSourceLabel('nonexistent_material')).toBeNull();
  });
});
