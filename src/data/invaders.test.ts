import { describe, it, expect } from 'vitest';
import { INVADER_DEFS, type InvaderType } from './invaders';
import {
  CHAPTER_1, CHAPTER_2, CHAPTER_3, CHAPTER_4,
  CHAPTER_5, CHAPTER_6, CHAPTER_7, CHAPTER_8,
} from './stages';

const ALL_DEFS = Object.values(INVADER_DEFS);
const ALL_STAGES = [
  ...CHAPTER_1, ...CHAPTER_2, ...CHAPTER_3, ...CHAPTER_4,
  ...CHAPTER_5, ...CHAPTER_6, ...CHAPTER_7, ...CHAPTER_8,
];

// ─── INVADER_DEFS data integrity ──────────────────────────────────────────────

describe('INVADER_DEFS', () => {
  it('contains at least 40 invader entries', () => {
    expect(ALL_DEFS.length).toBeGreaterThanOrEqual(40);
  });

  it('every key matches the type field', () => {
    for (const [key, def] of Object.entries(INVADER_DEFS)) {
      expect(def.type, `key "${key}"`).toBe(key as InvaderType);
    }
  });

  it('every invader has a non-empty koreanName', () => {
    for (const def of ALL_DEFS) {
      expect(def.koreanName.length, `${def.type} koreanName`).toBeGreaterThan(0);
    }
  });

  it('every hp is positive', () => {
    for (const def of ALL_DEFS) {
      expect(def.hp, `${def.type} hp`).toBeGreaterThan(0);
    }
  });

  it('every speed is positive', () => {
    for (const def of ALL_DEFS) {
      expect(def.speed, `${def.type} speed`).toBeGreaterThan(0);
    }
  });

  it('every reward is non-negative', () => {
    for (const def of ALL_DEFS) {
      expect(def.reward, `${def.type} reward`).toBeGreaterThanOrEqual(0);
    }
  });

  it('every damage is positive', () => {
    for (const def of ALL_DEFS) {
      expect(def.damage, `${def.type} damage`).toBeGreaterThan(0);
    }
  });

  it('every radius is positive', () => {
    for (const def of ALL_DEFS) {
      expect(def.radius, `${def.type} radius`).toBeGreaterThan(0);
    }
  });
});

// ─── Chapter 1 invaders ───────────────────────────────────────────────────────

describe('Chapter 1 invaders', () => {
  const ch1Types: InvaderType[] = ['peasant', 'soldier', 'knight', 'shaman'];

  it('Ch1 core invaders have no chapter field', () => {
    for (const t of ch1Types) {
      expect(INVADER_DEFS[t].chapter, `${t} chapter`).toBeUndefined();
    }
  });

  it('peasant is the weakest (lowest hp among Ch1)', () => {
    const peasantHp = INVADER_DEFS['peasant'].hp;
    for (const t of ch1Types.filter(t => t !== 'peasant')) {
      expect(peasantHp, `peasant vs ${t}`).toBeLessThan(INVADER_DEFS[t].hp);
    }
  });

  it('void and undying are endlessOnly', () => {
    expect(INVADER_DEFS['void'].endlessOnly).toBe(true);
    expect(INVADER_DEFS['undying'].endlessOnly).toBe(true);
  });
});

// ─── Chapter assignment ───────────────────────────────────────────────────────

describe('chapter assignment', () => {
  it('Ch2 invaders carry chapter: 2', () => {
    const ch2Types: InvaderType[] = ['berserker', 'shadow_ninja', 'iron_golem', 'fox_queen'];
    for (const t of ch2Types) {
      expect(INVADER_DEFS[t].chapter, t).toBe(2);
    }
  });

  it('Ch4+ invaders carry chapter >= 4', () => {
    const laterTypes: InvaderType[] = ['void_assassin_elite', 'death_emissary'];
    for (const t of laterTypes) {
      expect(INVADER_DEFS[t].chapter, t).toBeGreaterThanOrEqual(4);
    }
  });

  it('Ch8 invaders carry chapter: 8', () => {
    const ch8: InvaderType[] = ['void_soldier', 'abyss_berserker', 'primordial_guard', 'primordial_titan'];
    for (const t of ch8) {
      expect(INVADER_DEFS[t].chapter, t).toBe(8);
    }
  });
});

// ─── Boss and mini-boss flags ─────────────────────────────────────────────────

describe('boss flags', () => {
  it('true isBoss entries exist (chapter bosses)', () => {
    const bosses = ALL_DEFS.filter(d => d.isBoss === true);
    expect(bosses.length).toBeGreaterThanOrEqual(4);
  });

  it('death_emissary is a full boss', () => {
    expect(INVADER_DEFS['death_emissary'].isBoss).toBe(true);
  });

  it('primordial_titan is the final boss', () => {
    expect(INVADER_DEFS['primordial_titan'].isBoss).toBe(true);
  });

  it('primordial_titan has the highest hp of all invaders', () => {
    const maxHp = Math.max(...ALL_DEFS.map(d => d.hp));
    expect(INVADER_DEFS['primordial_titan'].hp).toBe(maxHp);
  });

  it('regular invaders (peasant, soldier) are not flagged as boss', () => {
    expect(INVADER_DEFS['peasant'].isBoss ?? false).toBe(false);
    expect(INVADER_DEFS['soldier'].isBoss ?? false).toBe(false);
  });
});

// ─── Scaling trends ───────────────────────────────────────────────────────────

describe('hp scaling trends across chapters', () => {
  it('chapter 1 avg hp < chapter 2 avg hp', () => {
    const ch1Avg = (['peasant', 'soldier', 'knight', 'shaman'] as InvaderType[])
      .reduce((s, t) => s + INVADER_DEFS[t].hp, 0) / 4;
    const ch2Avg = (['berserker', 'shadow_ninja', 'siege_soldier', 'iron_golem'] as InvaderType[])
      .reduce((s, t) => s + INVADER_DEFS[t].hp, 0) / 4;
    expect(ch2Avg).toBeGreaterThan(ch1Avg);
  });

  it('reward scales with toughness — iron_golem reward > peasant reward', () => {
    expect(INVADER_DEFS['iron_golem'].reward).toBeGreaterThan(
      INVADER_DEFS['peasant'].reward,
    );
  });
});

// ─── Ch3 invaders ─────────────────────────────────────────────────────────────

describe('Ch3 invaders — chapter assignment and spot-checks', () => {
  const CH3_TYPES: InvaderType[] = [
    'undying_knight', 'scarecrow_mage', 'venom_dancer', 'void_assassin', 'dragon_king',
  ];

  it('all 5 Ch3 types carry chapter: 3', () => {
    for (const t of CH3_TYPES) {
      expect(INVADER_DEFS[t].chapter, t).toBe(3);
    }
  });

  it('dragon_king is a mini-boss (isMiniBoss: true)', () => {
    expect((INVADER_DEFS['dragon_king'] as { isMiniBoss?: boolean }).isMiniBoss).toBe(true);
  });

  it('void_assassin is the fastest Ch3 invader', () => {
    const maxSpeed = Math.max(...CH3_TYPES.map(t => INVADER_DEFS[t].speed));
    expect(INVADER_DEFS['void_assassin'].speed).toBe(maxSpeed);
  });

  it('undying_knight HP > scarecrow_mage HP (tank vs. mage)', () => {
    expect(INVADER_DEFS['undying_knight'].hp).toBeGreaterThan(INVADER_DEFS['scarecrow_mage'].hp);
  });
});

// ─── Ch4 invaders ─────────────────────────────────────────────────────────────

describe('Ch4 invaders — chapter assignment and spot-checks', () => {
  it('all 3 Ch4 types carry chapter: 4', () => {
    const ch4: InvaderType[] = ['void_assassin_elite', 'death_emissary', 'ghost_add'];
    for (const t of ch4) {
      expect(INVADER_DEFS[t].chapter, t).toBe(4);
    }
  });

  it('death_emissary is a full boss (isBoss: true)', () => {
    expect(INVADER_DEFS['death_emissary'].isBoss).toBe(true);
  });

  it('death_emissary HP (3000) > void_assassin_elite HP', () => {
    expect(INVADER_DEFS['death_emissary'].hp).toBeGreaterThan(
      INVADER_DEFS['void_assassin_elite'].hp,
    );
  });

  it('ghost_add is the fastest Ch4 invader (speed 100)', () => {
    expect(INVADER_DEFS['ghost_add'].speed).toBe(100);
  });
});

// ─── Ch5 invaders ─────────────────────────────────────────────────────────────

describe('Ch5 invaders — chapter assignment and spot-checks', () => {
  it('all 3 Ch5 types carry chapter: 5', () => {
    const ch5: InvaderType[] = ['void_invader', 'undying_warrior', 'three_god_destroyer'];
    for (const t of ch5) {
      expect(INVADER_DEFS[t].chapter, t).toBe(5);
    }
  });

  it('three_god_destroyer is a full boss (isBoss: true)', () => {
    expect(INVADER_DEFS['three_god_destroyer'].isBoss).toBe(true);
  });

  it('three_god_destroyer HP (5000) > undying_warrior HP', () => {
    expect(INVADER_DEFS['three_god_destroyer'].hp).toBeGreaterThan(
      INVADER_DEFS['undying_warrior'].hp,
    );
  });

  it('void_invader speed (100) ≥ undying_warrior speed', () => {
    expect(INVADER_DEFS['void_invader'].speed).toBeGreaterThanOrEqual(
      INVADER_DEFS['undying_warrior'].speed,
    );
  });
});

// ─── Ch6 invaders ─────────────────────────────────────────────────────────────

describe('Ch6 invaders — chapter assignment and spot-checks', () => {
  const CH6_TYPES: InvaderType[] = [
    'mirror_knight', 'swarm_larva', 'swarm_spawn', 'shadow_wraith',
    'celestial_crusader', 'void_colossus', 'plague_herald',
    'titan_sentinel', 'eternal_emperor',
  ];

  it('all 9 Ch6 types carry chapter: 6', () => {
    for (const t of CH6_TYPES) {
      expect(INVADER_DEFS[t].chapter, t).toBe(6);
    }
  });

  it('eternal_emperor is a full boss (isBoss: true)', () => {
    expect(INVADER_DEFS['eternal_emperor'].isBoss).toBe(true);
  });

  it('eternal_emperor has the highest HP among Ch6 invaders', () => {
    const maxHp = Math.max(...CH6_TYPES.map(t => INVADER_DEFS[t].hp));
    expect(INVADER_DEFS['eternal_emperor'].hp).toBe(maxHp);
  });

  it('eternal_emperor reward (2000) is highest among Ch6 invaders', () => {
    const maxReward = Math.max(...CH6_TYPES.map(t => INVADER_DEFS[t].reward));
    expect(INVADER_DEFS['eternal_emperor'].reward).toBe(maxReward);
  });

  it('titan_sentinel HP > mirror_knight HP (heavy tank vs. knight)', () => {
    expect(INVADER_DEFS['titan_sentinel'].hp).toBeGreaterThan(
      INVADER_DEFS['mirror_knight'].hp,
    );
  });

  it('swarm_spawn is the fastest Ch6 invader', () => {
    const maxSpeed = Math.max(...CH6_TYPES.map(t => INVADER_DEFS[t].speed));
    expect(INVADER_DEFS['swarm_spawn'].speed).toBe(maxSpeed);
  });
});

// ─── Ch7 invaders ─────────────────────────────────────────────────────────────

describe('Ch7 invaders — chapter assignment', () => {
  const CH7_TYPES: InvaderType[] = [
    'celestial_knight', 'divine_archer', 'heaven_general',
    'sky_titan', 'radiant_seraph', 'celestial_dragon', 'god_emperor',
  ];

  it('all 7 Ch7 types carry chapter: 7', () => {
    for (const t of CH7_TYPES) {
      expect(INVADER_DEFS[t].chapter, t).toBe(7);
    }
  });

  it('god_emperor is a full boss (isBoss: true)', () => {
    expect(INVADER_DEFS['god_emperor'].isBoss).toBe(true);
  });

  it('celestial_dragon is a mini-boss (isMiniBoss: true)', () => {
    expect((INVADER_DEFS['celestial_dragon'] as { isMiniBoss?: boolean }).isMiniBoss).toBe(true);
  });

  it('god_emperor has HP 10000', () => {
    expect(INVADER_DEFS['god_emperor'].hp).toBe(10000);
  });

  it('sky_titan HP is higher than heaven_general (tank vs. officer)', () => {
    expect(INVADER_DEFS['sky_titan'].hp).toBeGreaterThan(INVADER_DEFS['heaven_general'].hp);
  });

  it('god_emperor reward is the highest among Ch7 invaders', () => {
    const maxReward = Math.max(...CH7_TYPES.map(t => INVADER_DEFS[t].reward));
    expect(INVADER_DEFS['god_emperor'].reward).toBe(maxReward);
  });

  it('divine_archer is faster than sky_titan (ranged vs. tank)', () => {
    expect(INVADER_DEFS['divine_archer'].speed).toBeGreaterThan(INVADER_DEFS['sky_titan'].speed);
  });
});

// ─── Ch8 invaders — chapter assignment and spot-checks ───────────────────────

describe('Ch8 invaders — chapter assignment and spot-checks', () => {
  const CH8_TYPES: InvaderType[] = [
    'void_soldier', 'abyss_berserker', 'primordial_guard', 'primordial_titan',
  ];

  it('all 4 Ch8 types carry chapter: 8', () => {
    for (const t of CH8_TYPES) {
      expect(INVADER_DEFS[t].chapter, t).toBe(8);
    }
  });

  it('primordial_titan is the final boss (isBoss: true)', () => {
    expect(INVADER_DEFS['primordial_titan'].isBoss).toBe(true);
  });

  it('primordial_titan has HP 14000', () => {
    expect(INVADER_DEFS['primordial_titan'].hp).toBe(14000);
  });

  it('primordial_titan reward (6000) is the highest among Ch8 invaders', () => {
    const maxReward = Math.max(...CH8_TYPES.map(t => INVADER_DEFS[t].reward));
    expect(INVADER_DEFS['primordial_titan'].reward).toBe(maxReward);
    expect(maxReward).toBe(6000);
  });

  it('primordial_titan is the slowest Ch8 invader (speed 18)', () => {
    const minSpeed = Math.min(...CH8_TYPES.map(t => INVADER_DEFS[t].speed));
    expect(INVADER_DEFS['primordial_titan'].speed).toBe(minSpeed);
    expect(minSpeed).toBe(18);
  });

  it('abyss_berserker is faster than void_soldier (78 > 65)', () => {
    expect(INVADER_DEFS['abyss_berserker'].speed).toBeGreaterThan(
      INVADER_DEFS['void_soldier'].speed,
    );
  });

  it('primordial_guard HP (2200) > abyss_berserker HP (950) — tank vs berserker', () => {
    expect(INVADER_DEFS['primordial_guard'].hp).toBeGreaterThan(
      INVADER_DEFS['abyss_berserker'].hp,
    );
  });

  it('primordial_guard damage > void_soldier damage (heavy tank hits harder)', () => {
    expect(INVADER_DEFS['primordial_guard'].damage).toBeGreaterThan(
      INVADER_DEFS['void_soldier'].damage,
    );
  });

  it('regular Ch8 invaders (void_soldier, abyss_berserker) are not flagged as boss', () => {
    expect(INVADER_DEFS['void_soldier'].isBoss  ?? false).toBe(false);
    expect(INVADER_DEFS['abyss_berserker'].isBoss ?? false).toBe(false);
  });
});

// ─── Stages × INVADER_DEFS — cross-reference ──────────────────────────────────

describe('stages × INVADER_DEFS — no orphan invader types', () => {
  it('every invader type in stage wave data exists in INVADER_DEFS', () => {
    for (const stage of ALL_STAGES) {
      for (const wave of stage.waves) {
        for (const inv of wave.invaders) {
          expect(
            INVADER_DEFS[inv.type as InvaderType],
            `stage ${stage.id} wave ${wave.wave} references unknown invader type "${inv.type}"`,
          ).toBeDefined();
        }
      }
    }
  });

  it('Ch8 stages only use Ch7–Ch8 invaders (chapter >= 7)', () => {
    for (const stage of CHAPTER_8) {
      for (const wave of stage.waves) {
        for (const inv of wave.invaders) {
          const def = INVADER_DEFS[inv.type as InvaderType];
          if (def) {
            expect(def.chapter, `stage ${stage.id} wave ${wave.wave} "${inv.type}" chapter`).toBeGreaterThanOrEqual(7);
          }
        }
      }
    }
  });
});

// ─── InvaderDef — behavior field spot-checks ──────────────────────────────────

describe('INVADER_DEFS — behavior spot-checks', () => {
  it('Ch1 core invaders (peasant/soldier/knight/shaman) have no behavior', () => {
    for (const t of ['peasant', 'soldier', 'knight', 'shaman'] as InvaderType[]) {
      expect(INVADER_DEFS[t].behavior, t).toBeUndefined();
    }
  });

  it('void has VOID_PHASE behavior', () => {
    expect(INVADER_DEFS['void'].behavior).toBe('VOID_PHASE');
  });

  it('undying has REVIVE_ONCE behavior', () => {
    expect(INVADER_DEFS['undying'].behavior).toBe('REVIVE_ONCE');
  });

  it('Ch2: berserker → BERSERKER_RAGE, shadow_ninja → STEALTH', () => {
    expect(INVADER_DEFS['berserker'].behavior).toBe('BERSERKER_RAGE');
    expect(INVADER_DEFS['shadow_ninja'].behavior).toBe('STEALTH');
  });

  it('Ch2: iron_golem → IRON_BODY, trap_breaker → TRAP_IMMUNITY', () => {
    expect(INVADER_DEFS['iron_golem'].behavior).toBe('IRON_BODY');
    expect(INVADER_DEFS['trap_breaker'].behavior).toBe('TRAP_IMMUNITY');
  });

  it('Ch3: void_assassin → VOID_TELEPORT, undying_knight → UNDYING_KNIGHT', () => {
    expect(INVADER_DEFS['void_assassin'].behavior).toBe('VOID_TELEPORT');
    expect(INVADER_DEFS['undying_knight'].behavior).toBe('UNDYING_KNIGHT');
  });

  it('Ch4: death_emissary → STUN_IMMUNE (boss behavior)', () => {
    expect(INVADER_DEFS['death_emissary'].behavior).toBe('STUN_IMMUNE');
    expect(INVADER_DEFS['death_emissary'].isBoss).toBe(true);
  });

  it('Ch5: three_god_destroyer → FIVE_PHASE (boss)', () => {
    expect(INVADER_DEFS['three_god_destroyer'].behavior).toBe('FIVE_PHASE');
    expect(INVADER_DEFS['three_god_destroyer'].isBoss).toBe(true);
  });

  it('Ch6: eternal_emperor → EMPEROR_PHASE (boss)', () => {
    expect(INVADER_DEFS['eternal_emperor'].behavior).toBe('EMPEROR_PHASE');
    expect(INVADER_DEFS['eternal_emperor'].isBoss).toBe(true);
  });

  it('Ch7: god_emperor → GOD_EMPEROR_PHASE (boss)', () => {
    expect(INVADER_DEFS['god_emperor'].behavior).toBe('GOD_EMPEROR_PHASE');
    expect(INVADER_DEFS['god_emperor'].isBoss).toBe(true);
  });

  it('Ch8: primordial_titan → PRIMORDIAL_PHASE (final boss)', () => {
    expect(INVADER_DEFS['primordial_titan'].behavior).toBe('PRIMORDIAL_PHASE');
    expect(INVADER_DEFS['primordial_titan'].isBoss).toBe(true);
  });

  it('Ch8: void_soldier → VOID_SURGE', () => {
    expect(INVADER_DEFS['void_soldier'].behavior).toBe('VOID_SURGE');
  });

  it('multi-phase boss behaviors (excl. VOID_PHASE) belong to boss or mini-boss invaders', () => {
    // VOID_PHASE is a regular invader mechanic, not a boss pattern
    for (const def of Object.values(INVADER_DEFS)) {
      if (def.behavior?.endsWith('_PHASE') && def.behavior !== 'VOID_PHASE') {
        expect(
          def.isBoss || def.isMiniBoss,
          `${def.type} has ${def.behavior} but is not boss/mini-boss`,
        ).toBe(true);
      }
    }
  });
});
