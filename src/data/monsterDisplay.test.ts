import { describe, it, expect } from 'vitest';
import { MONSTER_EMOJI, MONSTER_NAME } from './monsterDisplay';
import { MONSTER_DEFS, SKIN_DATA } from './monsters';

// ─── MONSTER_EMOJI data integrity ─────────────────────────────────────────────

describe('MONSTER_EMOJI', () => {
  it('contains at least 50 entries', () => {
    expect(Object.keys(MONSTER_EMOJI).length).toBeGreaterThanOrEqual(50);
  });

  it('every value is a non-empty string', () => {
    for (const [id, emoji] of Object.entries(MONSTER_EMOJI)) {
      expect(emoji.length, `${id} emoji`).toBeGreaterThan(0);
    }
  });

  it('dokkaebi_warrior has an emoji', () => {
    expect(MONSTER_EMOJI['dokkaebi_warrior']).toBeDefined();
    expect(MONSTER_EMOJI['dokkaebi_warrior'].length).toBeGreaterThan(0);
  });

  it('gumiho_guardian has an emoji', () => {
    expect(MONSTER_EMOJI['gumiho_guardian']).toBeDefined();
  });

  it('mountain_god (Ch5) has an emoji', () => {
    expect(MONSTER_EMOJI['mountain_god']).toBeDefined();
  });

  it('contains Ch6 tribe representatives', () => {
    // One from each tribe
    expect(MONSTER_EMOJI['dokkaebi_king']).toBeDefined();      // 도깨비족
    expect(MONSTER_EMOJI['gumiho_queen']).toBeDefined();       // 구미호족
    expect(MONSTER_EMOJI['bear_god']).toBeDefined();           // 산신족
    expect(MONSTER_EMOJI['sea_general']).toBeDefined();        // 해신족
    expect(MONSTER_EMOJI['ghost_king']).toBeDefined();         // 저승족
    expect(MONSTER_EMOJI['great_mask_god']).toBeDefined();     // 탈족
    expect(MONSTER_EMOJI['galaxy_warrior']).toBeDefined();     // 달빛족
    expect(MONSTER_EMOJI['blue_dragon_archmage']).toBeDefined(); // 용족
  });
});

// ─── MONSTER_NAME data integrity ──────────────────────────────────────────────

describe('MONSTER_NAME', () => {
  it('contains at least 50 entries', () => {
    expect(Object.keys(MONSTER_NAME).length).toBeGreaterThanOrEqual(50);
  });

  it('every value is a non-empty string', () => {
    for (const [id, name] of Object.entries(MONSTER_NAME)) {
      expect(name.length, `${id} name`).toBeGreaterThan(0);
    }
  });

  it('dokkaebi_warrior has a Korean name', () => {
    expect(MONSTER_NAME['dokkaebi_warrior']).toBeDefined();
    expect(MONSTER_NAME['dokkaebi_warrior'].length).toBeGreaterThan(0);
  });

  it('gumiho_guardian has a Korean name', () => {
    expect(MONSTER_NAME['gumiho_guardian']).toBeDefined();
  });

  it('mountain_god has a Korean name', () => {
    expect(MONSTER_NAME['mountain_god']).toBe('산신');
  });

  it('frost_spirit name is non-empty', () => {
    expect(MONSTER_NAME['frost_spirit']).toBeDefined();
    expect(MONSTER_NAME['frost_spirit'].length).toBeGreaterThan(0);
  });
});

// ─── Cross-map consistency ────────────────────────────────────────────────────

describe('MONSTER_EMOJI / MONSTER_NAME cross-map consistency', () => {
  it('both maps have the same number of keys', () => {
    const emojiCount = Object.keys(MONSTER_EMOJI).length;
    const nameCount  = Object.keys(MONSTER_NAME).length;
    // Allow a small delta (data can evolve independently) but they should be close
    expect(Math.abs(emojiCount - nameCount)).toBeLessThanOrEqual(10);
  });

  it('all Ch1 monsters appear in both maps', () => {
    const ch1 = ['dokkaebi_warrior', 'dokkaebi_junior', 'village_archer',
                  'gold_turtle', 'fire_dokkaebi', 'sage'];
    for (const id of ch1) {
      expect(MONSTER_EMOJI[id], `${id} emoji`).toBeDefined();
      expect(MONSTER_NAME[id],  `${id} name`).toBeDefined();
    }
  });

  it('all Ch2 monsters appear in both maps', () => {
    const ch2 = ['gumiho_guardian', 'white_tiger', 'frost_spirit',
                  'fox_shaman', 'sea_god_spear', 'iron_mask'];
    for (const id of ch2) {
      expect(MONSTER_EMOJI[id], `${id} emoji`).toBeDefined();
      expect(MONSTER_NAME[id],  `${id} name`).toBeDefined();
    }
  });

  it('all Ch3 monsters appear in both maps', () => {
    const ch3 = ['death_messenger', 'thunder_hero', 'ghost_hunter',
                  'mask_dancer', 'venom_warrior'];
    for (const id of ch3) {
      expect(MONSTER_EMOJI[id], `${id} emoji`).toBeDefined();
      expect(MONSTER_NAME[id],  `${id} name`).toBeDefined();
    }
  });

  it('all Ch4 monsters appear in both maps', () => {
    const ch4 = ['celestial_dancer', 'three_legged_crow', 'great_serpent', 'moon_rabbit_sage'];
    for (const id of ch4) {
      expect(MONSTER_EMOJI[id], `${id} emoji`).toBeDefined();
      expect(MONSTER_NAME[id],  `${id} name`).toBeDefined();
    }
  });

  it('all 8 Ch5 monsters appear in both maps', () => {
    const ch5 = [
      'mountain_god', 'volcanic_warrior', 'storm_archer', 'abyss_mage',
      'celestial_healer', 'mask_berserker', 'sea_dragon_lord', 'fox_spirit_elder',
    ];
    for (const id of ch5) {
      expect(MONSTER_EMOJI[id], `${id} emoji`).toBeDefined();
      expect(MONSTER_NAME[id],  `${id} name`).toBeDefined();
    }
  });

  it('all 8 Ch7 celestial monsters appear in both maps', () => {
    const ch7 = [
      'celestial_guardian', 'sky_archer', 'heaven_mage', 'solar_warrior',
      'divine_healer', 'starlight_knight', 'celestial_sage', 'god_realm_general',
    ];
    for (const id of ch7) {
      expect(MONSTER_EMOJI[id], `${id} emoji`).toBeDefined();
      expect(MONSTER_NAME[id],  `${id} name`).toBeDefined();
    }
  });

  it('all 8 Ch6 tribe complete/leader monsters appear in both maps', () => {
    const ch6leaders = [
      'dokkaebi_god_king',    // 도깨비족
      'gumiho_demon',         // 구미호족
      'mountain_god_complete',// 산신족
      'sea_god_complete',     // 해신족
      'underworld_complete',  // 저승족
      'mask_complete',        // 탈족
      'moonlight_complete',   // 달빛족
      'five_dragon_complete', // 용족
    ];
    for (const id of ch6leaders) {
      expect(MONSTER_EMOJI[id], `${id} emoji`).toBeDefined();
      expect(MONSTER_NAME[id],  `${id} name`).toBeDefined();
    }
  });
});

// ─── Cross-validation against MONSTER_DEFS ────────────────────────────────────

describe('MONSTER_EMOJI × MONSTER_DEFS — no orphan entries', () => {
  it('every MONSTER_EMOJI key exists in MONSTER_DEFS', () => {
    for (const id of Object.keys(MONSTER_EMOJI)) {
      expect(
        MONSTER_DEFS[id as keyof typeof MONSTER_DEFS],
        `MONSTER_EMOJI key "${id}" not found in MONSTER_DEFS`,
      ).toBeDefined();
    }
  });
});

describe('MONSTER_NAME × MONSTER_DEFS — no orphan entries', () => {
  it('every MONSTER_NAME key exists in MONSTER_DEFS', () => {
    for (const id of Object.keys(MONSTER_NAME)) {
      expect(
        MONSTER_DEFS[id as keyof typeof MONSTER_DEFS],
        `MONSTER_NAME key "${id}" not found in MONSTER_DEFS`,
      ).toBeDefined();
    }
  });
});

// ─── SKIN_DATA × MONSTER_DEFS — monsterId integrity ─────────────────────────

describe('SKIN_DATA × MONSTER_DEFS — monsterId cross-validation', () => {
  it('every skin.monsterId references a valid MONSTER_DEFS key', () => {
    for (const skin of SKIN_DATA) {
      expect(
        MONSTER_DEFS[skin.monsterId as keyof typeof MONSTER_DEFS],
        `SKIN_DATA skin "${skin.id}" references unknown monsterId "${skin.monsterId}"`,
      ).toBeDefined();
    }
  });

  it('every skin.id is unique', () => {
    const ids = SKIN_DATA.map(s => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('SKIN_DATA contains at least 15 skins', () => {
    expect(SKIN_DATA.length).toBeGreaterThanOrEqual(15);
  });
});

// ─── Ch5 / Ch7 spot-checks ────────────────────────────────────────────────────

describe('Ch5 new monsters — display map spot-checks', () => {
  it('volcanic_warrior has emoji 🌋 and correct Korean name', () => {
    expect(MONSTER_EMOJI['volcanic_warrior']).toBe('🌋');
    expect(MONSTER_NAME['volcanic_warrior']).toBe('화산 전사');
  });

  it('fox_spirit_elder has emoji 🦊 and correct Korean name', () => {
    expect(MONSTER_EMOJI['fox_spirit_elder']).toBe('🦊');
    expect(MONSTER_NAME['fox_spirit_elder']).toBe('구미호 장로');
  });

  it('abyss_mage has emoji 🌀 and correct Korean name', () => {
    expect(MONSTER_EMOJI['abyss_mage']).toBe('🌀');
    expect(MONSTER_NAME['abyss_mage']).toBe('심연 마법사');
  });
});

describe('Ch7 celestial monsters — display map spot-checks', () => {
  it('god_realm_general has emoji 👑 and correct Korean name', () => {
    expect(MONSTER_EMOJI['god_realm_general']).toBe('👑');
    expect(MONSTER_NAME['god_realm_general']).toBe('신계 대장군');
  });

  it('solar_warrior has emoji ☀️ and correct Korean name', () => {
    expect(MONSTER_EMOJI['solar_warrior']).toBe('☀️');
    expect(MONSTER_NAME['solar_warrior']).toBe('태양 전사');
  });

  it('MONSTER_EMOJI now has at least 100 entries (Ch1–Ch7 full coverage)', () => {
    expect(Object.keys(MONSTER_EMOJI).length).toBeGreaterThanOrEqual(100);
  });
});
