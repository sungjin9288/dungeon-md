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
