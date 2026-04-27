import { describe, it, expect } from 'vitest';
import {
  RARITY_NAMES,
  RARITY_STARS,
  RARITY_COLORS,
  RARITY_XP_VALUES,
  getBaseId,
  getMonsterRarity,
  getMonsterEmoji,
  getMonsterDisplayName,
  getMonsterBaseDamage,
  getNextEvolution,
  HYBRID_DEFS,
  COMBINATION_TABLE,
  combinationKey,
  MATERIAL_DEFS,
  BLUEPRINT_DEFS,
  STARTER_BLUEPRINTS,
  rollMaterialDrop,
  DROP_TABLE,
  AWAKENED_PASSIVES,
} from './fusion';
import { MONSTER_DEFS } from './monsters';
import { INVADER_DEFS, type InvaderType } from './invaders';

// ─── Rarity constants ─────────────────────────────────────────────────────────

describe('RARITY constants', () => {
  it('RARITY_NAMES has exactly 5 entries', () => {
    expect(RARITY_NAMES).toHaveLength(5);
  });

  it('RARITY_STARS, RARITY_COLORS, RARITY_XP_VALUES all have 5 entries', () => {
    expect(RARITY_STARS).toHaveLength(5);
    expect(RARITY_COLORS).toHaveLength(5);
    expect(RARITY_XP_VALUES).toHaveLength(5);
  });

  it('RARITY_XP_VALUES are strictly increasing', () => {
    for (let i = 1; i < RARITY_XP_VALUES.length; i++) {
      expect(RARITY_XP_VALUES[i]).toBeGreaterThan(RARITY_XP_VALUES[i - 1]);
    }
  });

  it('RARITY_COLORS are hex strings', () => {
    for (const color of RARITY_COLORS) {
      expect(color).toMatch(/^#[0-9a-fA-F]{6}$/);
    }
  });
});

// ─── getBaseId ────────────────────────────────────────────────────────────────

describe('getBaseId', () => {
  it('strips _unc suffix', () => {
    expect(getBaseId('dokkaebi_warrior_unc')).toBe('dokkaebi_warrior');
  });

  it('strips _rare suffix', () => {
    expect(getBaseId('gumiho_guardian_rare')).toBe('gumiho_guardian');
  });

  it('strips _epic suffix', () => {
    expect(getBaseId('white_tiger_epic')).toBe('white_tiger');
  });

  it('strips _leg suffix', () => {
    expect(getBaseId('frost_spirit_leg')).toBe('frost_spirit');
  });

  it('returns the id unchanged when no rarity suffix', () => {
    expect(getBaseId('dokkaebi_warrior')).toBe('dokkaebi_warrior');
  });

  it('does not strip other suffixes (e.g., _guardian)', () => {
    expect(getBaseId('gumiho_guardian')).toBe('gumiho_guardian');
  });
});

// ─── getMonsterRarity ─────────────────────────────────────────────────────────

describe('getMonsterRarity', () => {
  it('returns 0 for base ids with no suffix', () => {
    expect(getMonsterRarity('dokkaebi_warrior')).toBe(0);
  });

  it('returns 1 for _unc', () => {
    expect(getMonsterRarity('dokkaebi_warrior_unc')).toBe(1);
  });

  it('returns 2 for _rare', () => {
    expect(getMonsterRarity('gumiho_guardian_rare')).toBe(2);
  });

  it('returns 3 for _epic', () => {
    expect(getMonsterRarity('white_tiger_epic')).toBe(3);
  });

  it('returns 4 for _leg', () => {
    expect(getMonsterRarity('frost_spirit_leg')).toBe(4);
  });

  it('hybrid ids without suffix return 0', () => {
    expect(getMonsterRarity('fox_warrior')).toBe(0);
  });
});

// ─── getMonsterEmoji ──────────────────────────────────────────────────────────

describe('getMonsterEmoji', () => {
  it('returns the emoji for a known base id', () => {
    expect(getMonsterEmoji('dokkaebi_warrior')).toBe('👹');
  });

  it('strips rarity suffix before lookup', () => {
    expect(getMonsterEmoji('dokkaebi_warrior_leg')).toBe('👹');
  });

  it('returns the emoji for a hybrid id', () => {
    expect(getMonsterEmoji('fox_warrior')).toBe('🦊⚔️');
  });

  it('returns "❓" for an unknown id', () => {
    expect(getMonsterEmoji('totally_unknown_monster')).toBe('❓');
  });
});

// ─── getMonsterDisplayName ────────────────────────────────────────────────────

describe('getMonsterDisplayName', () => {
  it('returns the base name for rarity 0', () => {
    expect(getMonsterDisplayName('dokkaebi_warrior')).toBe('도깨비 전사');
  });

  it('prepends "강화 " for rarity 1 (_unc)', () => {
    expect(getMonsterDisplayName('dokkaebi_warrior_unc')).toBe('강화 도깨비 전사');
  });

  it('prepends "정예 " for rarity 2 (_rare)', () => {
    expect(getMonsterDisplayName('fire_dokkaebi_rare')).toBe('정예 화염 도깨비');
  });

  it('prepends "영웅 " for rarity 3 (_epic)', () => {
    expect(getMonsterDisplayName('white_tiger_epic')).toBe('영웅 백호');
  });

  it('prepends "전설 " for rarity 4 (_leg)', () => {
    expect(getMonsterDisplayName('sea_god_spear_leg')).toBe('전설 해신의 창');
  });

  it('returns hybrid name for hybrid id', () => {
    expect(getMonsterDisplayName('fox_warrior')).toBe('여우 전사');
  });
});

// ─── getMonsterBaseDamage ─────────────────────────────────────────────────────

describe('getMonsterBaseDamage', () => {
  it('returns the raw base damage at rarity 0', () => {
    // dokkaebi_warrior baseDamage = 20
    expect(getMonsterBaseDamage('dokkaebi_warrior')).toBe(20);
  });

  it('applies 1.30× for rarity 1 (_unc)', () => {
    // 20 × 1.30^1 = 26
    expect(getMonsterBaseDamage('dokkaebi_warrior_unc')).toBe(26);
  });

  it('applies 1.30^2 for rarity 2 (_rare)', () => {
    // 20 × 1.69 ≈ 33.8 → rounded 34
    expect(getMonsterBaseDamage('dokkaebi_warrior_rare')).toBe(34);
  });

  it('damage strictly increases with rarity', () => {
    const dmg0 = getMonsterBaseDamage('gumiho_guardian');
    const dmg1 = getMonsterBaseDamage('gumiho_guardian_unc');
    const dmg2 = getMonsterBaseDamage('gumiho_guardian_rare');
    const dmg3 = getMonsterBaseDamage('gumiho_guardian_epic');
    const dmg4 = getMonsterBaseDamage('gumiho_guardian_leg');
    expect(dmg1).toBeGreaterThan(dmg0);
    expect(dmg2).toBeGreaterThan(dmg1);
    expect(dmg3).toBeGreaterThan(dmg2);
    expect(dmg4).toBeGreaterThan(dmg3);
  });

  it('returns a rounded integer', () => {
    const dmg = getMonsterBaseDamage('white_tiger_unc');
    expect(Number.isInteger(dmg)).toBe(true);
  });

  it('returns hybrid baseDamage for a hybrid id', () => {
    expect(getMonsterBaseDamage('fox_warrior')).toBe(26);
  });
});

// ─── getNextEvolution ─────────────────────────────────────────────────────────

describe('getNextEvolution', () => {
  it('returns tier 1 (resultId *_unc) for rarity-0 base', () => {
    const ev = getNextEvolution('dokkaebi_warrior');
    expect(ev).not.toBeNull();
    expect(ev!.resultId).toBe('dokkaebi_warrior_unc');
    expect(ev!.rarity).toBe(1);
  });

  it('returns tier 2 (_rare) for rarity 1 (_unc)', () => {
    const ev = getNextEvolution('dokkaebi_warrior_unc');
    expect(ev!.resultId).toBe('dokkaebi_warrior_rare');
  });

  it('returns tier 3 (_epic) for rarity 2 (_rare)', () => {
    const ev = getNextEvolution('gumiho_guardian_rare');
    expect(ev!.resultId).toBe('gumiho_guardian_epic');
  });

  it('returns tier 4 (_leg) for rarity 3 (_epic)', () => {
    const ev = getNextEvolution('white_tiger_epic');
    expect(ev!.resultId).toBe('white_tiger_leg');
  });

  it('returns null at rarity 4 (_leg) — already max', () => {
    expect(getNextEvolution('white_tiger_leg')).toBeNull();
  });

  it('returns null for a hybrid id (not evolvable)', () => {
    expect(getNextEvolution('fox_warrior')).toBeNull();
  });

  it('atkMult is always > 1', () => {
    const ev = getNextEvolution('dokkaebi_warrior');
    expect(ev!.atkMult).toBeGreaterThan(1);
  });
});

// ─── combinationKey ───────────────────────────────────────────────────────────

describe('combinationKey', () => {
  it('sorts alphabetically and joins with "+"', () => {
    expect(combinationKey('gumiho_guardian', 'dokkaebi_warrior')).toBe(
      'dokkaebi_warrior+gumiho_guardian',
    );
  });

  it('is commutative (a,b) === (b,a)', () => {
    const ab = combinationKey('fire_dokkaebi', 'frost_spirit');
    const ba = combinationKey('frost_spirit', 'fire_dokkaebi');
    expect(ab).toBe(ba);
  });

  it('strips rarity suffixes before sorting', () => {
    // _unc versions should resolve to the same key as base
    expect(combinationKey('dokkaebi_warrior_unc', 'gumiho_guardian_rare')).toBe(
      'dokkaebi_warrior+gumiho_guardian',
    );
  });
});

// ─── HYBRID_DEFS data integrity ───────────────────────────────────────────────

describe('HYBRID_DEFS', () => {
  const entries = Object.entries(HYBRID_DEFS);

  it('contains at least 20 hybrid monsters', () => {
    expect(entries.length).toBeGreaterThanOrEqual(20);
  });

  it('every entry key matches the id field', () => {
    for (const [key, def] of entries) {
      expect(def.id, `key "${key}" id mismatch`).toBe(key);
    }
  });

  it('every hybrid has a non-empty name, emoji, and passiveDesc', () => {
    for (const def of Object.values(HYBRID_DEFS)) {
      expect(def.name.length,        `${def.id} name`).toBeGreaterThan(0);
      expect(def.emoji.length,       `${def.id} emoji`).toBeGreaterThan(0);
      expect(def.passiveDesc.length, `${def.id} passiveDesc`).toBeGreaterThan(0);
    }
  });

  it('every rarity is 2, 3, or 4', () => {
    const validRarities = new Set([2, 3, 4]);
    for (const def of Object.values(HYBRID_DEFS)) {
      expect(validRarities.has(def.rarity), `${def.id} rarity ${def.rarity}`).toBe(true);
    }
  });

  it('every hybrid has at least one roomType', () => {
    for (const def of Object.values(HYBRID_DEFS)) {
      expect(def.roomTypes.length, `${def.id} roomTypes`).toBeGreaterThan(0);
    }
  });
});

// ─── COMBINATION_TABLE integrity ─────────────────────────────────────────────

describe('COMBINATION_TABLE', () => {
  it('every result id exists in HYBRID_DEFS', () => {
    for (const [combo, resultId] of Object.entries(COMBINATION_TABLE)) {
      expect(HYBRID_DEFS[resultId], `combo "${combo}" → "${resultId}" not in HYBRID_DEFS`).toBeDefined();
    }
  });

  it('dokkaebi_warrior + gumiho_guardian → fox_warrior', () => {
    const key = combinationKey('dokkaebi_warrior', 'gumiho_guardian');
    expect(COMBINATION_TABLE[key]).toBe('fox_warrior');
  });

  it('fire_dokkaebi + frost_spirit → storm_spirit', () => {
    const key = combinationKey('fire_dokkaebi', 'frost_spirit');
    expect(COMBINATION_TABLE[key]).toBe('storm_spirit');
  });

  it('contains at least 10 entries', () => {
    expect(Object.keys(COMBINATION_TABLE).length).toBeGreaterThanOrEqual(10);
  });
});

// ─── MATERIAL_DEFS data integrity ─────────────────────────────────────────────

describe('MATERIAL_DEFS', () => {
  it('contains at least 10 materials', () => {
    expect(Object.keys(MATERIAL_DEFS).length).toBeGreaterThanOrEqual(10);
  });

  it('every key matches the id field', () => {
    for (const [key, def] of Object.entries(MATERIAL_DEFS)) {
      expect(def.id, key).toBe(key);
    }
  });

  it('every material has a non-empty name and emoji', () => {
    for (const def of Object.values(MATERIAL_DEFS)) {
      expect(def.name.length,  `${def.id} name`).toBeGreaterThan(0);
      expect(def.emoji.length, `${def.id} emoji`).toBeGreaterThan(0);
    }
  });
});

// ─── BLUEPRINT_DEFS data integrity ────────────────────────────────────────────

describe('BLUEPRINT_DEFS', () => {
  const defs = Object.values(BLUEPRINT_DEFS);

  it('contains at least 10 blueprints', () => {
    expect(defs.length).toBeGreaterThanOrEqual(10);
  });

  it('every key matches the id field', () => {
    for (const [key, def] of Object.entries(BLUEPRINT_DEFS)) {
      expect(def.id, key).toBe(key);
    }
  });

  it('every type is weapon, armor, or accessory', () => {
    const valid = new Set(['weapon', 'armor', 'accessory']);
    for (const def of defs) {
      expect(valid.has(def.type), `${def.id} type "${def.type}"`).toBe(true);
    }
  });

  it('every rarity is between 1 and 5', () => {
    for (const def of defs) {
      expect(def.rarity, `${def.id} rarity`).toBeGreaterThanOrEqual(1);
      expect(def.rarity, `${def.id} rarity`).toBeLessThanOrEqual(5);
    }
  });

  it('every blueprint requires at least one material', () => {
    for (const def of defs) {
      expect(Object.keys(def.materials).length, `${def.id} materials`).toBeGreaterThan(0);
    }
  });

  it('every material reference exists in MATERIAL_DEFS', () => {
    for (const def of defs) {
      for (const matId of Object.keys(def.materials)) {
        expect(MATERIAL_DEFS[matId], `${def.id} mat "${matId}"`).toBeDefined();
      }
    }
  });

  it('bp_dokkaebi_club is a rarity-1 weapon', () => {
    expect(BLUEPRINT_DEFS['bp_dokkaebi_club'].type).toBe('weapon');
    expect(BLUEPRINT_DEFS['bp_dokkaebi_club'].rarity).toBe(1);
  });

  it('STARTER_BLUEPRINTS reference known blueprint ids', () => {
    for (const id of STARTER_BLUEPRINTS) {
      expect(BLUEPRINT_DEFS[id], `starter "${id}"`).toBeDefined();
    }
  });
});

// ─── rollMaterialDrop ─────────────────────────────────────────────────────────

describe('rollMaterialDrop', () => {
  it('returns null for an unknown invader type', () => {
    expect(rollMaterialDrop('nonexistent_monster')).toBeNull();
  });

  it('returns a string or null for a known invader type', () => {
    // Run 20 trials — result must always be a known material id or null
    for (let i = 0; i < 20; i++) {
      const result = rollMaterialDrop('knight');
      if (result !== null) {
        expect(MATERIAL_DEFS[result], `unknown material "${result}"`).toBeDefined();
      }
    }
  });

  it('primordial_titan has a 60% chance on boss_essence — should drop often', () => {
    // Run 200 trials — expect at least 1 boss_essence drop (extremely unlikely to fail)
    let bossEssenceDropped = false;
    for (let i = 0; i < 200; i++) {
      if (rollMaterialDrop('primordial_titan') === 'boss_essence') {
        bossEssenceDropped = true;
        break;
      }
    }
    expect(bossEssenceDropped).toBe(true);
  });
});

// ─── AWAKENED_PASSIVES — data integrity ───────────────────────────────────────

describe('AWAKENED_PASSIVES — structure', () => {
  it('contains at least 29 entries (Ch1–Ch5)', () => {
    expect(Object.keys(AWAKENED_PASSIVES).length).toBeGreaterThanOrEqual(29);
  });

  it('every entry has a non-empty desc string', () => {
    for (const [id, passive] of Object.entries(AWAKENED_PASSIVES)) {
      expect(typeof passive.desc, `${id} desc type`).toBe('string');
      expect(passive.desc.length, `${id} desc length`).toBeGreaterThan(0);
    }
  });

  it('every key references a valid MONSTER_DEFS id', () => {
    for (const id of Object.keys(AWAKENED_PASSIVES)) {
      expect(
        MONSTER_DEFS[id as keyof typeof MONSTER_DEFS],
        `AWAKENED_PASSIVES key "${id}" not found in MONSTER_DEFS`,
      ).toBeDefined();
    }
  });
});

describe('AWAKENED_PASSIVES — chapter coverage', () => {
  const CH1_IDS = [
    'dokkaebi_warrior', 'dokkaebi_junior', 'village_archer',
    'gold_turtle', 'fire_dokkaebi', 'sage',
  ];
  const CH2_IDS = [
    'gumiho_guardian', 'frost_spirit', 'white_tiger',
    'sea_god_spear', 'fox_shaman', 'iron_mask',
  ];
  const CH3_IDS = [
    'death_messenger', 'thunder_hero', 'ghost_hunter',
    'mask_dancer', 'venom_warrior',
  ];
  const CH4_IDS = [
    'celestial_dancer', 'three_legged_crow', 'great_serpent', 'moon_rabbit_sage',
  ];
  const CH5_IDS = [
    'mountain_god', 'volcanic_warrior', 'storm_archer', 'abyss_mage',
    'celestial_healer', 'mask_berserker', 'sea_dragon_lord', 'fox_spirit_elder',
  ];

  it('all Ch1 monsters have an awakened passive', () => {
    for (const id of CH1_IDS) {
      expect(AWAKENED_PASSIVES[id], `${id} missing awakened passive`).toBeDefined();
    }
  });

  it('all Ch2 monsters have an awakened passive', () => {
    for (const id of CH2_IDS) {
      expect(AWAKENED_PASSIVES[id], `${id} missing awakened passive`).toBeDefined();
    }
  });

  it('all Ch3 monsters have an awakened passive', () => {
    for (const id of CH3_IDS) {
      expect(AWAKENED_PASSIVES[id], `${id} missing awakened passive`).toBeDefined();
    }
  });

  it('all Ch4 monsters have an awakened passive', () => {
    for (const id of CH4_IDS) {
      expect(AWAKENED_PASSIVES[id], `${id} missing awakened passive`).toBeDefined();
    }
  });

  it('all Ch5 monsters have an awakened passive', () => {
    for (const id of CH5_IDS) {
      expect(AWAKENED_PASSIVES[id], `${id} missing awakened passive`).toBeDefined();
    }
  });
});

describe('AWAKENED_PASSIVES — spot-checks', () => {
  it('dokkaebi_warrior passive desc mentions first-attack multiplier', () => {
    expect(AWAKENED_PASSIVES['dokkaebi_warrior'].desc).toContain('3×');
  });

  it('gold_turtle passive desc references gold emoji', () => {
    expect(AWAKENED_PASSIVES['gold_turtle'].desc).toContain('💰');
  });

  it('iron_mask passive desc references damage reduction', () => {
    // 철벽 모드 (피해 -60%)
    expect(AWAKENED_PASSIVES['iron_mask'].desc).toContain('60%');
  });

  it('mountain_god passive desc references ATK bonus', () => {
    // 산신 영역: 인접 모든 방 ATK +30%
    expect(AWAKENED_PASSIVES['mountain_god'].desc).toContain('ATK');
  });

  it('death_messenger passive desc mentions execution threshold increase', () => {
    // 처형 임계치 20% → 30%로 상승
    expect(AWAKENED_PASSIVES['death_messenger'].desc).toContain('30%');
  });

  it('each desc is unique (no two monsters share identical passive text)', () => {
    const descs = Object.values(AWAKENED_PASSIVES).map(p => p.desc);
    expect(new Set(descs).size).toBe(descs.length);
  });
});

// ─── COMBINATION_TABLE input ids × MONSTER_DEFS ───────────────────────────────

describe('COMBINATION_TABLE × MONSTER_DEFS — input ids are valid', () => {
  it('every monster id in combination keys exists in MONSTER_DEFS', () => {
    for (const combo of Object.keys(COMBINATION_TABLE)) {
      const [idA, idB] = combo.split('+');
      expect(
        MONSTER_DEFS[idA as keyof typeof MONSTER_DEFS],
        `COMBINATION_TABLE key "${combo}" — left id "${idA}" not found in MONSTER_DEFS`,
      ).toBeDefined();
      expect(
        MONSTER_DEFS[idB as keyof typeof MONSTER_DEFS],
        `COMBINATION_TABLE key "${combo}" — right id "${idB}" not found in MONSTER_DEFS`,
      ).toBeDefined();
    }
  });

  it('combinationKey is commutative — same result regardless of argument order', () => {
    expect(combinationKey('dokkaebi_warrior', 'gumiho_guardian'))
      .toBe(combinationKey('gumiho_guardian', 'dokkaebi_warrior'));
    expect(combinationKey('fire_dokkaebi', 'frost_spirit'))
      .toBe(combinationKey('frost_spirit', 'fire_dokkaebi'));
  });
});

// ─── DROP_TABLE — structure ───────────────────────────────────────────────────

describe('DROP_TABLE — structure', () => {
  it('contains at least 35 invader-type entries', () => {
    expect(Object.keys(DROP_TABLE).length).toBeGreaterThanOrEqual(35);
  });

  it('every entry is a non-empty array', () => {
    for (const [type, drops] of Object.entries(DROP_TABLE)) {
      expect(drops.length, `${type} drops`).toBeGreaterThan(0);
    }
  });

  it('every drop has a non-empty id string and a chance > 0 and ≤ 1', () => {
    for (const [type, drops] of Object.entries(DROP_TABLE)) {
      for (const drop of drops) {
        expect(drop.id.length, `${type} drop id`).toBeGreaterThan(0);
        expect(drop.chance, `${type} drop chance`).toBeGreaterThan(0);
        expect(drop.chance, `${type} drop chance`).toBeLessThanOrEqual(1);
      }
    }
  });

  it('no single entry has more than 3 possible drops', () => {
    for (const [type, drops] of Object.entries(DROP_TABLE)) {
      expect(drops.length, `${type} has too many drops`).toBeLessThanOrEqual(3);
    }
  });
});

// ─── DROP_TABLE × MATERIAL_DEFS — no orphan drop ids ─────────────────────────

describe('DROP_TABLE × MATERIAL_DEFS — no orphan material ids', () => {
  it('every drop id referenced in DROP_TABLE exists in MATERIAL_DEFS', () => {
    for (const [type, drops] of Object.entries(DROP_TABLE)) {
      for (const drop of drops) {
        expect(
          MATERIAL_DEFS[drop.id],
          `DROP_TABLE["${type}"] references unknown material "${drop.id}"`,
        ).toBeDefined();
      }
    }
  });
});

// ─── DROP_TABLE × INVADER_DEFS — stage invader types are valid ───────────────

describe('DROP_TABLE × INVADER_DEFS — stage invader types are valid', () => {
  // Quest-invasion-only types that intentionally don't appear in INVADER_DEFS
  const QUEST_ONLY_TYPES = new Set([
    'peasant_soldier', 'shield_knight', 'shadow_thief', 'field_medic',
  ]);

  it('every non-quest DROP_TABLE key exists in INVADER_DEFS', () => {
    for (const type of Object.keys(DROP_TABLE)) {
      if (QUEST_ONLY_TYPES.has(type)) continue;
      expect(
        INVADER_DEFS[type as InvaderType],
        `DROP_TABLE key "${type}" not found in INVADER_DEFS`,
      ).toBeDefined();
    }
  });

  it('there are exactly 4 quest-only types in DROP_TABLE', () => {
    const questKeys = Object.keys(DROP_TABLE).filter(k => QUEST_ONLY_TYPES.has(k));
    expect(questKeys).toHaveLength(4);
  });
});

// ─── DROP_TABLE — chapter spot-checks ────────────────────────────────────────

describe('DROP_TABLE — chapter spot-checks', () => {
  it('Ch1 peasant drops old_cloth', () => {
    const drops = DROP_TABLE['peasant'];
    const ids = drops.map(d => d.id);
    expect(ids).toContain('old_cloth');
  });

  it('Ch5 three_god_destroyer drops dok_fragment and ice_crystal', () => {
    const drops = DROP_TABLE['three_god_destroyer'];
    const ids = drops.map(d => d.id);
    expect(ids).toContain('dok_fragment');
    expect(ids).toContain('ice_crystal');
  });

  it('Ch7 divine_archer drops magic_dust', () => {
    const drops = DROP_TABLE['divine_archer'];
    const ids = drops.map(d => d.id);
    expect(ids).toContain('magic_dust');
  });

  it('Ch7 god_emperor drops boss_essence with highest chance (0.40)', () => {
    const drops = DROP_TABLE['god_emperor'];
    const bossEssence = drops.find(d => d.id === 'boss_essence');
    expect(bossEssence).toBeDefined();
    expect(bossEssence!.chance).toBe(0.40);
  });

  it('Ch8 primordial_titan has 3 drop entries (highest variety)', () => {
    const drops = DROP_TABLE['primordial_titan'];
    expect(drops).toHaveLength(3);
  });

  it('Ch8 primordial_titan boss_essence chance (0.60) > god_emperor (0.40)', () => {
    const titanChance = DROP_TABLE['primordial_titan'].find(d => d.id === 'boss_essence')!.chance;
    const emperorChance = DROP_TABLE['god_emperor'].find(d => d.id === 'boss_essence')!.chance;
    expect(titanChance).toBeGreaterThan(emperorChance);
  });
});
