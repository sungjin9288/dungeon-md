import { describe, it, expect } from 'vitest';
import {
  MONSTER_DEFS,
  SKIN_DATA,
  TRIBE_TOTALS,
  getMonstersForRoom,
  getMonstersForTribe,
  getSkinForMonster,
  getSkinsForMonster,
  resolveOwnedMonsterProfile,
  resolveMonsterAttackCooldown,
  resolveMonsterDef,
  resolveMonsterTypeId,
} from './monsters';
import type { MonsterDef } from './monsters';
import {
  getMonsterBaseDamage,
  getMonsterDisplayName,
  getNextEvolution,
} from './fusion';

const ALL_DEFS = Object.values(MONSTER_DEFS) as MonsterDef[];

// ─── MONSTER_DEFS — data integrity ───────────────────────────────────────────

describe('MONSTER_DEFS — data integrity', () => {
  it('contains at least 80 entries', () => {
    expect(ALL_DEFS.length).toBeGreaterThanOrEqual(80);
  });

  it('every key matches the id field', () => {
    for (const [key, def] of Object.entries(MONSTER_DEFS)) {
      expect((def as MonsterDef).id, `key "${key}"`).toBe(key);
    }
  });

  it('every entry has a non-empty name', () => {
    for (const def of ALL_DEFS) {
      expect(def.name.length, `${def.id} name`).toBeGreaterThan(0);
    }
  });

  it('every entry has a non-empty emoji', () => {
    for (const def of ALL_DEFS) {
      expect(def.emoji.length, `${def.id} emoji`).toBeGreaterThan(0);
    }
  });

  it('every type is melee/ranged/magic/support', () => {
    const valid = new Set(['melee', 'ranged', 'magic', 'support']);
    for (const def of ALL_DEFS) {
      expect(valid.has(def.type), `${def.id} type "${def.type}"`).toBe(true);
    }
  });

  it('every baseDamage is non-negative', () => {
    for (const def of ALL_DEFS) {
      expect(def.baseDamage, `${def.id} baseDamage`).toBeGreaterThanOrEqual(0);
    }
  });

  it('every attackCooldown is non-negative', () => {
    for (const def of ALL_DEFS) {
      expect(def.attackCooldown, `${def.id} attackCooldown`).toBeGreaterThanOrEqual(0);
    }
  });

  it('every range is non-negative', () => {
    for (const def of ALL_DEFS) {
      expect(def.range, `${def.id} range`).toBeGreaterThanOrEqual(0);
    }
  });

  it('every entry has a non-empty passiveDesc', () => {
    for (const def of ALL_DEFS) {
      expect(def.passiveDesc.length, `${def.id} passiveDesc`).toBeGreaterThan(0);
    }
  });

  it('every unlockStage is a non-negative integer', () => {
    for (const def of ALL_DEFS) {
      expect(def.unlockStage, `${def.id} unlockStage`).toBeGreaterThanOrEqual(0);
      expect(Number.isInteger(def.unlockStage), `${def.id} unlockStage integer`).toBe(true);
    }
  });

  it('every roomTypes array is non-empty', () => {
    for (const def of ALL_DEFS) {
      expect(def.roomTypes.length, `${def.id} roomTypes`).toBeGreaterThan(0);
    }
  });

  it('support monsters have baseDamage 0 and attackCooldown 0', () => {
    for (const def of ALL_DEFS.filter(d => d.type === 'support')) {
      expect(def.baseDamage, `${def.id} support baseDamage`).toBe(0);
      expect(def.attackCooldown, `${def.id} support attackCooldown`).toBe(0);
    }
  });
});

// ─── MONSTER_DEFS — Ch1 spot checks ──────────────────────────────────────────

describe('MONSTER_DEFS — Ch1 spot checks', () => {
  it('dokkaebi_warrior is defined', () => {
    expect(MONSTER_DEFS['dokkaebi_warrior']).toBeDefined();
  });

  it('dokkaebi_warrior has correct base stats', () => {
    const def = MONSTER_DEFS['dokkaebi_warrior'];
    expect(def.baseDamage).toBe(20);
    expect(def.attackCooldown).toBe(1500);
    expect(def.range).toBe(1);
    expect(def.type).toBe('melee');
  });

  it('dokkaebi_warrior belongs to dokkaebi tribe', () => {
    expect(MONSTER_DEFS['dokkaebi_warrior'].tribe).toBe('dokkaebi');
  });

  it('gold_turtle is support with attackCooldown 0', () => {
    const def = MONSTER_DEFS['gold_turtle'];
    expect(def.type).toBe('support');
    expect(def.baseDamage).toBe(0);
    expect(def.attackCooldown).toBe(0);
  });

  it('village_archer is ranged with range 2', () => {
    const def = MONSTER_DEFS['village_archer'];
    expect(def.type).toBe('ranged');
    expect(def.range).toBe(2);
  });

  it('all six Ch1 monsters are present', () => {
    const ch1 = ['dokkaebi_warrior', 'dokkaebi_junior', 'village_archer',
                  'gold_turtle', 'fire_dokkaebi', 'sage'] as const;
    for (const id of ch1) {
      expect(MONSTER_DEFS[id], `Ch1 missing: ${id}`).toBeDefined();
    }
  });

  it('all Ch1 monsters have unlockStage <= 10', () => {
    const ch1 = ['dokkaebi_warrior', 'dokkaebi_junior', 'village_archer',
                  'gold_turtle', 'fire_dokkaebi', 'sage'] as const;
    for (const id of ch1) {
      expect(MONSTER_DEFS[id].unlockStage, `${id} unlockStage`).toBeLessThanOrEqual(10);
    }
  });
});

// ─── MONSTER_DEFS — Ch6 tribe spot checks ────────────────────────────────────

describe('MONSTER_DEFS — Ch6 tribe spot checks', () => {
  it('dokkaebi_king is defined and belongs to dokkaebi tribe', () => {
    const def = MONSTER_DEFS['dokkaebi_king'];
    expect(def).toBeDefined();
    expect(def.tribe).toBe('dokkaebi');
  });

  it('gumiho_queen belongs to gumiho tribe', () => {
    expect(MONSTER_DEFS['gumiho_queen']?.tribe).toBe('gumiho');
  });

  it('bear_god belongs to sansin tribe', () => {
    expect(MONSTER_DEFS['bear_god']?.tribe).toBe('sansin');
  });

  it('sea_general belongs to sea tribe', () => {
    expect(MONSTER_DEFS['sea_general']?.tribe).toBe('sea');
  });

  it('ghost_king belongs to underworld tribe', () => {
    expect(MONSTER_DEFS['ghost_king']?.tribe).toBe('underworld');
  });

  it('great_mask_god belongs to mask tribe', () => {
    expect(MONSTER_DEFS['great_mask_god']?.tribe).toBe('mask');
  });

  it('galaxy_warrior belongs to moonlight tribe', () => {
    expect(MONSTER_DEFS['galaxy_warrior']?.tribe).toBe('moonlight');
  });

  it('blue_dragon_archmage belongs to dragon tribe', () => {
    expect(MONSTER_DEFS['blue_dragon_archmage']?.tribe).toBe('dragon');
  });
});

// ─── getMonstersForRoom ───────────────────────────────────────────────────────

describe('getMonstersForRoom', () => {
  it('returns only monsters that include the given roomType', () => {
    const result = getMonstersForRoom('guardian', 80);
    for (const m of result) {
      expect(m.roomTypes, `${m.id} roomTypes`).toContain('guardian');
    }
  });

  it('dokkaebi_warrior appears in guardian results at stage 80', () => {
    const result = getMonstersForRoom('guardian', 80);
    expect(result.some(m => m.id === 'dokkaebi_warrior')).toBe(true);
  });

  it('filters out monsters with unlockStage > given stage', () => {
    const lowStage  = getMonstersForRoom('guardian', 1);
    const highStage = getMonstersForRoom('guardian', 80);
    expect(highStage.length).toBeGreaterThanOrEqual(lowStage.length);
    for (const m of lowStage) {
      expect(m.unlockStage, `${m.id} unlockStage`).toBeLessThanOrEqual(1);
    }
  });

  it('elementFilter narrows results to matching element', () => {
    const fireOnly = getMonstersForRoom('guardian', 80, 'fire');
    expect(fireOnly.length).toBeGreaterThan(0);
    for (const m of fireOnly) {
      expect(m.element, `${m.id} element`).toBe('fire');
    }
  });

  it('no elementFilter returns at least as many results as with a filter', () => {
    const all  = getMonstersForRoom('guardian', 80);
    const fire = getMonstersForRoom('guardian', 80, 'fire');
    expect(all.length).toBeGreaterThanOrEqual(fire.length);
  });

  it('gold_turtle appears in gold room results', () => {
    const result = getMonstersForRoom('gold', 80);
    expect(result.some(m => m.id === 'gold_turtle')).toBe(true);
  });
});

// ─── getMonstersForTribe ──────────────────────────────────────────────────────

describe('getMonstersForTribe', () => {
  it('returns only monsters with matching tribe', () => {
    const result = getMonstersForTribe('dokkaebi');
    for (const m of result) {
      expect(m.tribe, `${m.id} tribe`).toBe('dokkaebi');
    }
  });

  it('dokkaebi tribe has at least 6 members (3 Ch1 + Ch6)', () => {
    expect(getMonstersForTribe('dokkaebi').length).toBeGreaterThanOrEqual(6);
  });

  it('gumiho tribe has at least 3 members', () => {
    expect(getMonstersForTribe('gumiho').length).toBeGreaterThanOrEqual(3);
  });

  it('sansin tribe includes gold_turtle and sage', () => {
    const result = getMonstersForTribe('sansin');
    const ids = result.map(m => m.id);
    expect(ids).toContain('gold_turtle');
    expect(ids).toContain('sage');
  });
});

// ─── getSkinForMonster ────────────────────────────────────────────────────────

describe('getSkinForMonster', () => {
  it('returns null when no skin is equipped', () => {
    expect(getSkinForMonster('dokkaebi_warrior', {})).toBeNull();
  });

  it('returns null when equipped skinId does not exist in SKIN_DATA', () => {
    const result = getSkinForMonster('dokkaebi_warrior', {
      dokkaebi_warrior: 'nonexistent_skin_xyz',
    });
    expect(result).toBeNull();
  });

  it('returns null for a monster with no entry in equippedSkins', () => {
    expect(getSkinForMonster('dokkaebi_warrior', { gold_turtle: 'some_skin' })).toBeNull();
  });
});

// ─── getSkinsForMonster ───────────────────────────────────────────────────────

describe('getSkinsForMonster', () => {
  it('returns an array for any monster id', () => {
    expect(Array.isArray(getSkinsForMonster('dokkaebi_warrior'))).toBe(true);
  });

  it('all returned skins have monsterId matching the argument', () => {
    const result = getSkinsForMonster('dokkaebi_warrior');
    for (const skin of result) {
      expect(skin.monsterId).toBe('dokkaebi_warrior');
    }
  });

  it('returns empty array for a monster with no skins', () => {
    // village_archer has no skin entries in SKIN_DATA
    expect(getSkinsForMonster('village_archer')).toEqual([]);
  });

  it('divine_warrior skin appears in dokkaebi_warrior skins', () => {
    const result = getSkinsForMonster('dokkaebi_warrior');
    expect(result.some(s => s.id === 'divine_warrior')).toBe(true);
  });
});

// ─── resolveMonsterDef ────────────────────────────────────────────────────────

describe('resolveMonsterDef', () => {
  it('returns null for undefined input', () => {
    expect(resolveMonsterDef(undefined)).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(resolveMonsterDef('')).toBeNull();
  });

  it('returns null for completely unknown id', () => {
    expect(resolveMonsterDef('nonexistent_xyz')).toBeNull();
  });

  it('returns a CombatMonsterDef for a known monster id', () => {
    const result = resolveMonsterDef('dokkaebi_warrior');
    expect(result).not.toBeNull();
    expect(typeof result!.baseDamage).toBe('number');
    expect(typeof result!.attackCooldown).toBe('number');
    expect(typeof result!.range).toBe('number');
  });

  it('dokkaebi_warrior resolves with correct stats', () => {
    const result = resolveMonsterDef('dokkaebi_warrior');
    expect(result!.baseDamage).toBe(20);
    expect(result!.attackCooldown).toBe(1500);
  });

  it('uses evolution damage while preserving the base combat cadence', () => {
    const result = resolveMonsterDef('dokkaebi_warrior_leg');
    expect(result!.baseDamage).toBe(57);
    expect(result!.attackCooldown).toBe(1500);
  });

  it('gives fusion-only hybrids an actionable combat cadence', () => {
    const result = resolveMonsterDef('storm_spirit');
    expect(result).toMatchObject({
      baseDamage: 24,
      type: 'magic',
      range: 2,
      attackCooldown: 2000,
    });
  });
});

// ─── resolveOwnedMonsterProfile ──────────────────────────────────────────────

describe('resolveOwnedMonsterProfile', () => {
  it('keeps exact registry monsters canonical', () => {
    expect(resolveOwnedMonsterProfile('fox_warrior')).toMatchObject({
      id: 'fox_warrior',
      registryId: 'fox_warrior',
      source: 'registry',
      name: '여우 전사',
      baseDamage: 28,
    });
  });

  it('projects an evolved monster from its base registry entry', () => {
    expect(resolveOwnedMonsterProfile('dokkaebi_warrior_leg')).toMatchObject({
      id: 'dokkaebi_warrior_leg',
      registryId: 'dokkaebi_warrior',
      source: 'variant',
      name: '전설 도깨비 전사',
      rarityTier: 'L',
      baseDamage: 57,
      attackCooldown: 1500,
    });
  });

  it('projects a legacy suffixed instance without adding evolution stats', () => {
    expect(resolveOwnedMonsterProfile('dokkaebi_warrior_3')).toMatchObject({
      id: 'dokkaebi_warrior_3',
      registryId: 'dokkaebi_warrior',
      source: 'variant',
      name: '도깨비 전사',
      baseDamage: 20,
    });
  });

  it('projects a fusion-only hybrid without pretending it is in the registry', () => {
    expect(resolveOwnedMonsterProfile('storm_spirit')).toMatchObject({
      id: 'storm_spirit',
      registryId: null,
      source: 'hybrid',
      name: '폭풍 정령',
      emoji: '⚡',
      rarityTier: 'R',
      type: 'magic',
      baseDamage: 24,
    });
  });

  it('rejects unknown owned-monster IDs', () => {
    expect(resolveOwnedMonsterProfile('not_a_monster')).toBeNull();
    expect(resolveOwnedMonsterProfile(42)).toBeNull();
    expect(resolveOwnedMonsterProfile({ id: 'dokkaebi_warrior' })).toBeNull();
  });

  it('matches fusion preview values for every supported evolution tier', () => {
    const suffixes = ['unc', 'rare', 'epic', 'leg'] as const;
    const evolvable = ALL_DEFS.filter(def => getNextEvolution(def.id));
    expect(evolvable).toHaveLength(15);

    for (const def of evolvable) {
      for (const suffix of suffixes) {
        const id = `${def.id}_${suffix}`;
        expect(resolveOwnedMonsterProfile(id)).toMatchObject({
          name: getMonsterDisplayName(id),
          baseDamage: getMonsterBaseDamage(id),
        });
      }
    }
  });
});

describe('resolveMonsterAttackCooldown', () => {
  it('applies the magic-room cadence bonus to a fusion-only magic monster', () => {
    expect(resolveMonsterAttackCooldown('storm_spirit', 'scroll_library')).toBe(1600);
  });

  it('restores the base cadence when an evolved monster changes rooms', () => {
    expect(resolveMonsterAttackCooldown('dokkaebi_warrior_leg', 'guardian')).toBe(1500);
  });

  it('fails closed for an unknown monster in a non-attacking room', () => {
    expect(resolveMonsterAttackCooldown('not_a_monster', 'scroll_library')).toBe(0);
  });
});

// ─── resolveMonsterTypeId ────────────────────────────────────────────────────

describe('resolveMonsterTypeId', () => {
  it('keeps exact monster IDs distinct from their shared prefixes', () => {
    expect(resolveMonsterTypeId('mountain_god')).toBe('mountain_god');
    expect(resolveMonsterTypeId('mountain_god_complete')).toBe('mountain_god_complete');
    expect(resolveMonsterTypeId('mountain_spirit')).toBe('mountain_spirit');
    expect(resolveMonsterTypeId('mountain_spirit_boy')).toBe('mountain_spirit_boy');
  });

  it('uses the longest delimited base ID for evolved monsters', () => {
    expect(resolveMonsterTypeId('mountain_god_complete_leg')).toBe('mountain_god_complete');
    expect(resolveMonsterTypeId('mountain_spirit_boy_leg')).toBe('mountain_spirit_boy');
    expect(resolveMonsterTypeId('dokkaebi_warrior_leg')).toBe('dokkaebi_warrior');
  });

  it('rejects near matches, unknown IDs, empty IDs, and inherited properties', () => {
    expect(resolveMonsterTypeId('mountain_godlike')).toBeNull();
    expect(resolveMonsterTypeId('unknown')).toBeNull();
    expect(resolveMonsterTypeId('')).toBeNull();
    expect(resolveMonsterTypeId('toString')).toBeNull();
    expect(resolveMonsterTypeId(42)).toBeNull();
  });
});

// ─── SKIN_DATA ────────────────────────────────────────────────────────────────

describe('SKIN_DATA', () => {
  it('is an array', () => {
    expect(Array.isArray(SKIN_DATA)).toBe(true);
  });

  it('every skin has non-empty id, monsterId, name, emoji', () => {
    for (const skin of SKIN_DATA) {
      expect(skin.id.length,        `${skin.id} id`).toBeGreaterThan(0);
      expect(skin.monsterId.length, `${skin.id} monsterId`).toBeGreaterThan(0);
      expect(skin.name.length,      `${skin.id} name`).toBeGreaterThan(0);
      expect(skin.emoji.length,     `${skin.id} emoji`).toBeGreaterThan(0);
    }
  });

  it('every rarity is normal, rare, or limited', () => {
    const valid = new Set(['normal', 'rare', 'limited']);
    for (const skin of SKIN_DATA) {
      expect(valid.has(skin.rarity), `${skin.id} rarity "${skin.rarity}"`).toBe(true);
    }
  });

  it('divine_warrior skin exists in SKIN_DATA', () => {
    expect(SKIN_DATA.some(s => s.id === 'divine_warrior')).toBe(true);
  });
});

// ─── TRIBE_TOTALS ─────────────────────────────────────────────────────────────

describe('TRIBE_TOTALS', () => {
  it('is an object with at least one tribe', () => {
    expect(typeof TRIBE_TOTALS).toBe('object');
    expect(Object.keys(TRIBE_TOTALS).length).toBeGreaterThanOrEqual(1);
  });

  it('dokkaebi total is a positive integer', () => {
    const val = TRIBE_TOTALS['dokkaebi'];
    expect(val).toBeGreaterThan(0);
    expect(Number.isInteger(val)).toBe(true);
  });

  it('every total value is a positive integer', () => {
    for (const [tribe, count] of Object.entries(TRIBE_TOTALS)) {
      expect(count, `${tribe} total`).toBeGreaterThan(0);
      expect(Number.isInteger(count), `${tribe} total integer`).toBe(true);
    }
  });
});

// ─── Ch7 monsters — celestial tribe ──────────────────────────────────────────

describe('Ch7 monsters — celestial tribe', () => {
  const CH7_IDS = [
    'celestial_guardian', 'sky_archer', 'heaven_mage', 'solar_warrior',
    'divine_healer', 'starlight_knight', 'celestial_sage', 'god_realm_general',
  ];

  it('all 8 Ch7 monsters exist in MONSTER_DEFS', () => {
    for (const id of CH7_IDS) {
      expect(MONSTER_DEFS[id as keyof typeof MONSTER_DEFS], `missing ${id}`).toBeDefined();
    }
  });

  it('every Ch7 monster belongs to the celestial tribe', () => {
    for (const id of CH7_IDS) {
      const def = MONSTER_DEFS[id as keyof typeof MONSTER_DEFS] as MonsterDef;
      expect(def.tribe, `${id} tribe`).toBe('celestial');
    }
  });

  it('every Ch7 monster has chapter = 7', () => {
    for (const id of CH7_IDS) {
      const def = MONSTER_DEFS[id as keyof typeof MONSTER_DEFS] as MonsterDef;
      expect(def.chapter, `${id} chapter`).toBe(7);
    }
  });

  it('Ch7 unlockStages are in the range 63–72 (Ch7 gate area)', () => {
    for (const id of CH7_IDS) {
      const def = MONSTER_DEFS[id as keyof typeof MONSTER_DEFS] as MonsterDef;
      expect(def.unlockStage, `${id} unlockStage`).toBeGreaterThanOrEqual(63);
      expect(def.unlockStage, `${id} unlockStage`).toBeLessThanOrEqual(72);
    }
  });

  it('god_realm_general is legendary (rarityTier L)', () => {
    const def = MONSTER_DEFS['god_realm_general'] as MonsterDef;
    expect(def.rarityTier).toBe('L');
  });

  it('divine_healer is a support monster (baseDamage = 0)', () => {
    const def = MONSTER_DEFS['divine_healer'] as MonsterDef;
    expect(def.baseDamage).toBe(0);
    expect(def.attackCooldown).toBe(0);
  });

  it('celestial_guardian has DIVINE_TERRITORY passive', () => {
    const def = MONSTER_DEFS['celestial_guardian'] as MonsterDef;
    expect(def.passive).toBe('DIVINE_TERRITORY');
  });

  it('god_realm_general has highest baseDamage among Ch7 monsters', () => {
    const maxDmg = Math.max(
      ...CH7_IDS.map(id => (MONSTER_DEFS[id as keyof typeof MONSTER_DEFS] as MonsterDef).baseDamage),
    );
    const general = MONSTER_DEFS['god_realm_general'] as MonsterDef;
    expect(general.baseDamage).toBe(maxDmg);
  });

  it('getMonstersForTribe("celestial") returns all 8 Ch7 monsters (at stage 80)', () => {
    const celestials = getMonstersForTribe('celestial');
    const celestialIds = celestials.map(m => m.id);
    for (const id of CH7_IDS) {
      expect(celestialIds, `${id} in celestial tribe`).toContain(id);
    }
  });
});

// ─── MONSTER_DEFS — Ch2 spot checks ──────────────────────────────────────────

describe('MONSTER_DEFS — Ch2 spot checks', () => {
  it('gumiho_guardian is defined with chapter 2 and gumiho tribe', () => {
    const def = MONSTER_DEFS['gumiho_guardian'];
    expect(def).toBeDefined();
    expect(def.chapter).toBe(2);
    expect(def.tribe).toBe('gumiho');
  });

  it('frost_spirit has sansin tribe and frost element', () => {
    const def = MONSTER_DEFS['frost_spirit'];
    expect(def.chapter).toBe(2);
    expect(def.tribe).toBe('sansin');
    expect(def.element).toBe('frost');
  });

  it('iron_mask has mask tribe', () => {
    expect(MONSTER_DEFS['iron_mask']?.tribe).toBe('mask');
  });

  it('sea_god_spear has sea tribe', () => {
    expect(MONSTER_DEFS['sea_god_spear']?.tribe).toBe('sea');
  });

  it('all 6 Ch2 monsters have chapter = 2', () => {
    const ch2Ids = ['gumiho_guardian', 'frost_spirit', 'white_tiger',
                    'sea_god_spear', 'fox_shaman', 'iron_mask'];
    for (const id of ch2Ids) {
      expect(MONSTER_DEFS[id as keyof typeof MONSTER_DEFS]?.chapter, id).toBe(2);
    }
  });
});

// ─── MONSTER_DEFS — Ch3 spot checks ──────────────────────────────────────────

describe('MONSTER_DEFS — Ch3 spot checks', () => {
  it('death_messenger has underworld tribe, chapter 3', () => {
    const def = MONSTER_DEFS['death_messenger'];
    expect(def.chapter).toBe(3);
    expect(def.tribe).toBe('underworld');
  });

  it('mask_dancer has mask tribe', () => {
    expect(MONSTER_DEFS['mask_dancer']?.tribe).toBe('mask');
  });

  it('ghost_hunter is epic (rarityTier E)', () => {
    expect(MONSTER_DEFS['ghost_hunter']?.rarityTier).toBe('E');
  });

  it('all 5 Ch3 monsters have chapter = 3', () => {
    const ch3Ids = ['death_messenger', 'thunder_hero', 'ghost_hunter', 'mask_dancer', 'venom_warrior'];
    for (const id of ch3Ids) {
      expect(MONSTER_DEFS[id as keyof typeof MONSTER_DEFS]?.chapter, id).toBe(3);
    }
  });
});

// ─── MONSTER_DEFS — Ch4 spot checks ──────────────────────────────────────────

describe('MONSTER_DEFS — Ch4 spot checks', () => {
  it('celestial_dancer has moonlight tribe, chapter 4', () => {
    const def = MONSTER_DEFS['celestial_dancer'];
    expect(def.chapter).toBe(4);
    expect(def.tribe).toBe('moonlight');
  });

  it('great_serpent has sea tribe', () => {
    expect(MONSTER_DEFS['great_serpent']?.tribe).toBe('sea');
  });

  it('moon_rabbit_sage has sansin tribe and holy element', () => {
    const def = MONSTER_DEFS['moon_rabbit_sage'];
    expect(def.tribe).toBe('sansin');
    expect(def.element).toBe('holy');
  });

  it('all 4 Ch4 monsters have chapter = 4', () => {
    const ch4Ids = ['celestial_dancer', 'three_legged_crow', 'great_serpent', 'moon_rabbit_sage'];
    for (const id of ch4Ids) {
      expect(MONSTER_DEFS[id as keyof typeof MONSTER_DEFS]?.chapter, id).toBe(4);
    }
  });
});

// ─── MONSTER_DEFS — Ch5 spot checks ──────────────────────────────────────────

describe('MONSTER_DEFS — Ch5 spot checks', () => {
  it('mountain_god is legendary (rarityTier L), chapter 5, dragon tribe', () => {
    const def = MONSTER_DEFS['mountain_god'];
    expect(def.chapter).toBe(5);
    expect(def.tribe).toBe('dragon');
    expect(def.rarityTier).toBe('L');
  });

  it('volcanic_warrior has sansin tribe and fire element', () => {
    const def = MONSTER_DEFS['volcanic_warrior'];
    expect(def.tribe).toBe('sansin');
    expect(def.element).toBe('fire');
  });

  it('fox_spirit_elder is legendary (rarityTier L)', () => {
    expect(MONSTER_DEFS['fox_spirit_elder']?.rarityTier).toBe('L');
  });

  it('storm_archer has moonlight tribe', () => {
    expect(MONSTER_DEFS['storm_archer']?.tribe).toBe('moonlight');
  });
});

// ─── MONSTER_DEFS — Ch6 chapter assignment ────────────────────────────────────

describe('MONSTER_DEFS — Ch6 chapter assignment', () => {
  it('all 8 Ch6 tribe champions carry chapter = 6', () => {
    const ch6Champions = [
      'dokkaebi_king', 'gumiho_queen', 'bear_god', 'sea_general',
      'ghost_king', 'great_mask_god', 'galaxy_warrior', 'blue_dragon_archmage',
    ];
    for (const id of ch6Champions) {
      expect(MONSTER_DEFS[id as keyof typeof MONSTER_DEFS]?.chapter, id).toBe(6);
    }
  });

  it('Ch6 dokkaebi expansion: thunder_dokkaebi has dokkaebi tribe and lightning element', () => {
    const def = MONSTER_DEFS['thunder_dokkaebi'];
    expect(def).toBeDefined();
    expect(def.tribe).toBe('dokkaebi');
    expect(def.element).toBe('lightning');
    expect(def.chapter).toBe(6);
  });

  it('dokkaebi_god_king is legendary (rarityTier L) and chapter 6', () => {
    const def = MONSTER_DEFS['dokkaebi_god_king'];
    expect(def?.rarityTier).toBe('L');
    expect(def?.chapter).toBe(6);
  });

  it('Ch6 sansin expansion: mountain_spirit is legendary sansin with chapter 6', () => {
    const def = MONSTER_DEFS['mountain_spirit'];
    expect(def?.tribe).toBe('sansin');
    expect(def?.rarityTier).toBe('L');
    expect(def?.chapter).toBe(6);
  });

  it('Ch6 sea expansion: sea_witch has sea tribe and dark element', () => {
    const def = MONSTER_DEFS['sea_witch'];
    expect(def?.tribe).toBe('sea');
    expect(def?.element).toBe('dark');
    expect(def?.chapter).toBe(6);
  });

  it('Ch6 moonlight expansion: galaxy_warrior has moonlight tribe and frost element', () => {
    const def = MONSTER_DEFS['galaxy_warrior'];
    expect(def?.tribe).toBe('moonlight');
    expect(def?.element).toBe('frost');
  });

  it('Ch6 dragon expansion: red_dragon_warrior has dragon tribe and fire element', () => {
    const def = MONSTER_DEFS['red_dragon_warrior'];
    expect(def?.tribe).toBe('dragon');
    expect(def?.element).toBe('fire');
    expect(def?.chapter).toBe(6);
  });

  it('getMonstersForTribe("dokkaebi") includes thunder_dokkaebi', () => {
    const result = getMonstersForTribe('dokkaebi');
    expect(result.some(m => m.id === 'thunder_dokkaebi')).toBe(true);
  });

  it('getMonstersForTribe("moonlight") includes galaxy_warrior', () => {
    const result = getMonstersForTribe('moonlight');
    expect(result.some(m => m.id === 'galaxy_warrior')).toBe(true);
  });
});

// ─── Ch6 passive and stat spot-checks ────────────────────────────────────────

describe('MONSTER_DEFS — Ch6 passive and stat spot-checks', () => {
  it('blue_dragon_archmage is legendary (rarityTier = "L")', () => {
    expect(MONSTER_DEFS['blue_dragon_archmage']?.rarityTier).toBe('L');
  });

  it('blue_dragon_archmage has CHAIN_LIGHTNING passive', () => {
    expect(MONSTER_DEFS['blue_dragon_archmage']?.passive).toBe('CHAIN_LIGHTNING');
  });

  it('blue_dragon_archmage has the highest baseDamage among all 8 Ch6 tribe champions', () => {
    const champions = [
      'dokkaebi_king', 'gumiho_queen', 'bear_god', 'sea_general',
      'ghost_king', 'great_mask_god', 'galaxy_warrior', 'blue_dragon_archmage',
    ];
    const archmage = MONSTER_DEFS['blue_dragon_archmage']!;
    for (const id of champions.filter(c => c !== 'blue_dragon_archmage')) {
      const def = MONSTER_DEFS[id as keyof typeof MONSTER_DEFS];
      expect(archmage.baseDamage, `archmage vs ${id}`).toBeGreaterThanOrEqual(def?.baseDamage ?? 0);
    }
    expect(archmage.baseDamage).toBe(58);
  });

  it('great_mask_god is a support monster with baseDamage = 0', () => {
    const def = MONSTER_DEFS['great_mask_god'];
    expect(def?.type).toBe('support');
    expect(def?.baseDamage).toBe(0);
  });

  it('great_mask_god has KINGS_RALLY passive', () => {
    expect(MONSTER_DEFS['great_mask_god']?.passive).toBe('KINGS_RALLY');
  });

  it('dokkaebi_king has KINGS_RALLY passive and epic rarity', () => {
    const def = MONSTER_DEFS['dokkaebi_king'];
    expect(def?.passive).toBe('KINGS_RALLY');
    expect(def?.rarityTier).toBe('E');
  });

  it('gumiho_queen has FOX_CLONE passive', () => {
    expect(MONSTER_DEFS['gumiho_queen']?.passive).toBe('FOX_CLONE');
  });

  it('ghost_king has PACK_CAPTAIN passive', () => {
    expect(MONSTER_DEFS['ghost_king']?.passive).toBe('PACK_CAPTAIN');
  });

  it('galaxy_warrior has TEMPEST passive', () => {
    expect(MONSTER_DEFS['galaxy_warrior']?.passive).toBe('TEMPEST');
  });

  it('spring_gumiho has SEASONAL_BOON passive', () => {
    expect(MONSTER_DEFS['spring_gumiho']?.passive).toBe('SEASONAL_BOON');
  });
});

// ─── Ch7 passive and stat spot-checks ────────────────────────────────────────

describe('MONSTER_DEFS — Ch7 passive and stat spot-checks', () => {
  it('sky_archer has PINNING_SHOT passive and is rare (rarityTier R)', () => {
    const def = MONSTER_DEFS['sky_archer'];
    expect(def?.passive).toBe('PINNING_SHOT');
    expect(def?.rarityTier).toBe('R');
  });

  it('heaven_mage has CHAIN_LIGHTNING passive and lightning element', () => {
    const def = MONSTER_DEFS['heaven_mage'];
    expect(def?.passive).toBe('CHAIN_LIGHTNING');
    expect(def?.element).toBe('lightning');
  });

  it('solar_warrior is epic (rarityTier E) with EMBER_TRAIL passive and fire element', () => {
    const def = MONSTER_DEFS['solar_warrior'];
    expect(def?.rarityTier).toBe('E');
    expect(def?.passive).toBe('EMBER_TRAIL');
    expect(def?.element).toBe('fire');
  });

  it('starlight_knight is epic (rarityTier E) with DUAL_STRIKE passive', () => {
    const def = MONSTER_DEFS['starlight_knight'];
    expect(def?.rarityTier).toBe('E');
    expect(def?.passive).toBe('DUAL_STRIKE');
  });

  it('starlight_knight (baseDamage 70) has highest baseDamage among non-legendary Ch7 monsters', () => {
    const nonLeg = ['celestial_guardian', 'sky_archer', 'heaven_mage', 'solar_warrior',
      'divine_healer', 'starlight_knight', 'celestial_sage'];
    const maxDmg = Math.max(
      ...nonLeg.map(id => (MONSTER_DEFS[id as keyof typeof MONSTER_DEFS] as any)?.baseDamage ?? 0),
    );
    expect((MONSTER_DEFS['starlight_knight'] as any)?.baseDamage).toBe(maxDmg);
    expect(maxDmg).toBe(70);
  });

  it('celestial_sage has SPECTRAL_BOLT passive and holy element', () => {
    const def = MONSTER_DEFS['celestial_sage'];
    expect(def?.passive).toBe('SPECTRAL_BOLT');
    expect(def?.element).toBe('holy');
  });

  it('god_realm_general shares PACK_CAPTAIN passive with ghost_king (both faction leaders)', () => {
    expect(MONSTER_DEFS['god_realm_general']?.passive).toBe('PACK_CAPTAIN');
    expect(MONSTER_DEFS['ghost_king']?.passive).toBe('PACK_CAPTAIN');
  });

  it('majority of Ch7 monsters have holy element (≥ 4 of 8)', () => {
    const CH7_IDS = ['celestial_guardian', 'sky_archer', 'heaven_mage', 'solar_warrior',
      'divine_healer', 'starlight_knight', 'celestial_sage', 'god_realm_general'];
    const holyCount = CH7_IDS.filter(
      id => (MONSTER_DEFS[id as keyof typeof MONSTER_DEFS] as any)?.element === 'holy',
    ).length;
    expect(holyCount).toBeGreaterThanOrEqual(4);
  });
});
