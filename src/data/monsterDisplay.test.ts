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

describe('Ch6 tribe champion — display map spot-checks', () => {
  // Each Ch6 tribe has a named 'king/queen/god/general' champion

  it('dokkaebi_king has emoji 👑 and Korean name "도깨비 왕"', () => {
    expect(MONSTER_EMOJI['dokkaebi_king']).toBe('👑');
    expect(MONSTER_NAME['dokkaebi_king']).toBe('도깨비 왕');
  });

  it('gumiho_queen has emoji 👑 and Korean name "구미호 여왕"', () => {
    expect(MONSTER_EMOJI['gumiho_queen']).toBe('👑');
    expect(MONSTER_NAME['gumiho_queen']).toBe('구미호 여왕');
  });

  it('bear_god has emoji 🐻 and Korean name "곰 산신"', () => {
    expect(MONSTER_EMOJI['bear_god']).toBe('🐻');
    expect(MONSTER_NAME['bear_god']).toBe('곰 산신');
  });

  it('sea_general has emoji 🐡 and Korean name "용궁 장수"', () => {
    expect(MONSTER_EMOJI['sea_general']).toBe('🐡');
    expect(MONSTER_NAME['sea_general']).toBe('용궁 장수');
  });

  it('ghost_king has emoji 👑 and Korean name "귀왕"', () => {
    expect(MONSTER_EMOJI['ghost_king']).toBe('👑');
    expect(MONSTER_NAME['ghost_king']).toBe('귀왕');
  });

  it('great_mask_god has emoji 🎭 and Korean name "대탈 신"', () => {
    expect(MONSTER_EMOJI['great_mask_god']).toBe('🎭');
    expect(MONSTER_NAME['great_mask_god']).toBe('대탈 신');
  });

  it('galaxy_warrior (moonlight tribe) has emoji 🌌 and Korean name "은하 무사"', () => {
    expect(MONSTER_EMOJI['galaxy_warrior']).toBe('🌌');
    expect(MONSTER_NAME['galaxy_warrior']).toBe('은하 무사');
  });

  it('blue_dragon_archmage (dragon tribe) has emoji 🐲 and Korean name defined', () => {
    expect(MONSTER_EMOJI['blue_dragon_archmage']).toBeDefined();
    expect(MONSTER_NAME['blue_dragon_archmage']).toBeDefined();
    expect(MONSTER_NAME['blue_dragon_archmage']!.length).toBeGreaterThan(0);
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

// ─── Ch1 display map exact values ────────────────────────────────────────────

describe('Ch1 monsters — display map exact values', () => {
  it('dokkaebi_warrior: emoji=👹, name="도깨비 전사"', () => {
    expect(MONSTER_EMOJI['dokkaebi_warrior']).toBe('👹');
    expect(MONSTER_NAME['dokkaebi_warrior']).toBe('도깨비 전사');
  });

  it('dokkaebi_junior: emoji=👺, name="막내 도깨비"', () => {
    expect(MONSTER_EMOJI['dokkaebi_junior']).toBe('👺');
    expect(MONSTER_NAME['dokkaebi_junior']).toBe('막내 도깨비');
  });

  it('village_archer: emoji=🏹, name="마을 궁수"', () => {
    expect(MONSTER_EMOJI['village_archer']).toBe('🏹');
    expect(MONSTER_NAME['village_archer']).toBe('마을 궁수');
  });

  it('gold_turtle: emoji=🐢, name="황금 거북"', () => {
    expect(MONSTER_EMOJI['gold_turtle']).toBe('🐢');
    expect(MONSTER_NAME['gold_turtle']).toBe('황금 거북');
  });

  it('fire_dokkaebi: emoji=🔥, name="화염 도깨비"', () => {
    expect(MONSTER_EMOJI['fire_dokkaebi']).toBe('🔥');
    expect(MONSTER_NAME['fire_dokkaebi']).toBe('화염 도깨비');
  });

  it('sage: emoji=🧙, name="신선 도인"', () => {
    expect(MONSTER_EMOJI['sage']).toBe('🧙');
    expect(MONSTER_NAME['sage']).toBe('신선 도인');
  });
});

// ─── Ch2 display map exact values ────────────────────────────────────────────

describe('Ch2 monsters — display map exact values', () => {
  it('gumiho_guardian: emoji=🦊, name="구미호 수호자"', () => {
    expect(MONSTER_EMOJI['gumiho_guardian']).toBe('🦊');
    expect(MONSTER_NAME['gumiho_guardian']).toBe('구미호 수호자');
  });

  it('white_tiger: emoji=🐯, name="백호 검사"', () => {
    expect(MONSTER_EMOJI['white_tiger']).toBe('🐯');
    expect(MONSTER_NAME['white_tiger']).toBe('백호 검사');
  });

  it('frost_spirit: emoji=❄️, name="빙결 산령"', () => {
    expect(MONSTER_EMOJI['frost_spirit']).toBe('❄️');
    expect(MONSTER_NAME['frost_spirit']).toBe('빙결 산령');
  });

  it('fox_shaman: emoji=🪬, name="여우 무당"', () => {
    expect(MONSTER_EMOJI['fox_shaman']).toBe('🪬');
    expect(MONSTER_NAME['fox_shaman']).toBe('여우 무당');
  });

  it('sea_god_spear: emoji=🔱, name="해신 창병"', () => {
    expect(MONSTER_EMOJI['sea_god_spear']).toBe('🔱');
    expect(MONSTER_NAME['sea_god_spear']).toBe('해신 창병');
  });

  it('iron_mask: emoji=🎭, name="철갑 탈"', () => {
    expect(MONSTER_EMOJI['iron_mask']).toBe('🎭');
    expect(MONSTER_NAME['iron_mask']).toBe('철갑 탈');
  });
});

// ─── Ch3 display map exact values ────────────────────────────────────────────

describe('Ch3 monsters — display map exact values', () => {
  it('death_messenger: emoji=💀, name="저승사자"', () => {
    expect(MONSTER_EMOJI['death_messenger']).toBe('💀');
    expect(MONSTER_NAME['death_messenger']).toBe('저승사자');
  });

  it('thunder_hero: emoji=⚡, name="벼락 용사"', () => {
    expect(MONSTER_EMOJI['thunder_hero']).toBe('⚡');
    expect(MONSTER_NAME['thunder_hero']).toBe('벼락 용사');
  });

  it('ghost_hunter: emoji=👻, name="귀신 포수"', () => {
    expect(MONSTER_EMOJI['ghost_hunter']).toBe('👻');
    expect(MONSTER_NAME['ghost_hunter']).toBe('귀신 포수');
  });

  it('mask_dancer: emoji=🎪, name="탈 춤꾼"', () => {
    expect(MONSTER_EMOJI['mask_dancer']).toBe('🎪');
    expect(MONSTER_NAME['mask_dancer']).toBe('탈 춤꾼');
  });

  it('venom_warrior: emoji=🐍, name="독사 무사"', () => {
    expect(MONSTER_EMOJI['venom_warrior']).toBe('🐍');
    expect(MONSTER_NAME['venom_warrior']).toBe('독사 무사');
  });
});

// ─── Ch4 display map exact values ────────────────────────────────────────────

describe('Ch4 monsters — display map exact values', () => {
  it('celestial_dancer: emoji=🪭, name="천녀 무희"', () => {
    expect(MONSTER_EMOJI['celestial_dancer']).toBe('🪭');
    expect(MONSTER_NAME['celestial_dancer']).toBe('천녀 무희');
  });

  it('three_legged_crow: emoji=🐦, name="삼족오"', () => {
    expect(MONSTER_EMOJI['three_legged_crow']).toBe('🐦');
    expect(MONSTER_NAME['three_legged_crow']).toBe('삼족오');
  });

  it('great_serpent: emoji=🐍, name="구렁이"', () => {
    expect(MONSTER_EMOJI['great_serpent']).toBe('🐍');
    expect(MONSTER_NAME['great_serpent']).toBe('구렁이');
  });

  it('moon_rabbit_sage: emoji=🐇, name="월토 달인"', () => {
    expect(MONSTER_EMOJI['moon_rabbit_sage']).toBe('🐇');
    expect(MONSTER_NAME['moon_rabbit_sage']).toBe('월토 달인');
  });
});
