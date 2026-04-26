import { describe, it, expect } from 'vitest';
import { MONSTER_EMOJI, MONSTER_NAME } from './monsterDisplay';

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
});
