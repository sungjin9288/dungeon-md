import { describe, it, expect } from 'vitest';
import { CINEMATICS, getCinematic, STAGE_CINEMATICS } from './cinematics';

const ALL_IDS = new Set(CINEMATICS.map(c => c.id));

// ─── CINEMATICS — data integrity ──────────────────────────────────────────────

describe('CINEMATICS — data integrity', () => {
  it('contains at least 15 entries', () => {
    expect(CINEMATICS.length).toBeGreaterThanOrEqual(15);
  });

  it('every CinematicDef has a non-empty id', () => {
    for (const c of CINEMATICS) {
      expect(c.id.length, `id empty`).toBeGreaterThan(0);
    }
  });

  it('no duplicate ids', () => {
    const ids = CINEMATICS.map(c => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every CinematicDef has at least one dialogue line', () => {
    for (const c of CINEMATICS) {
      expect(c.lines.length, `${c.id} has no lines`).toBeGreaterThan(0);
    }
  });

  it('every DialogueLine has a non-empty speaker', () => {
    for (const c of CINEMATICS) {
      for (const line of c.lines) {
        expect(line.speaker.length, `${c.id} empty speaker`).toBeGreaterThan(0);
      }
    }
  });

  it('every DialogueLine has a non-empty emoji', () => {
    for (const c of CINEMATICS) {
      for (const line of c.lines) {
        expect(line.emoji.length, `${c.id} empty emoji`).toBeGreaterThan(0);
      }
    }
  });

  it('every DialogueLine has a non-empty text', () => {
    for (const c of CINEMATICS) {
      for (const line of c.lines) {
        expect(line.text.length, `${c.id} empty text`).toBeGreaterThan(0);
      }
    }
  });

  it('every DialogueLine side is "left" or "right"', () => {
    for (const c of CINEMATICS) {
      for (const line of c.lines) {
        expect(['left', 'right'], `${c.id} invalid side`).toContain(line.side);
      }
    }
  });

  it('pause, when present, is a positive number', () => {
    for (const c of CINEMATICS) {
      for (const line of c.lines) {
        if (line.pause !== undefined) {
          expect(line.pause, `${c.id} pause`).toBeGreaterThan(0);
        }
      }
    }
  });
});

// ─── CINEMATICS — chapter coverage ───────────────────────────────────────────

describe('CINEMATICS — chapter coverage', () => {
  it('ch1_opening exists', () => {
    expect(ALL_IDS.has('ch1_opening')).toBe(true);
  });

  it('ch1_clear exists', () => {
    expect(ALL_IDS.has('ch1_clear')).toBe(true);
  });

  it('game_complete exists', () => {
    expect(ALL_IDS.has('game_complete')).toBe(true);
  });

  it('primordial_titan_boss_intro (Ch8 final boss) exists', () => {
    expect(ALL_IDS.has('primordial_titan_boss_intro')).toBe(true);
  });

  it('ch1_opening features 도깨비 전사 and 산신령', () => {
    const c = CINEMATICS.find(c => c.id === 'ch1_opening')!;
    const speakers = c.lines.map(l => l.speaker);
    expect(speakers).toContain('도깨비 전사');
    expect(speakers).toContain('산신령');
  });

  it('stage10_boss_intro features 도깨비 대왕', () => {
    const c = CINEMATICS.find(c => c.id === 'stage10_boss_intro')!;
    expect(c).toBeDefined();
    expect(c.lines.some(l => l.speaker === '도깨비 대왕')).toBe(true);
  });

  it('game_complete has exactly 5 lines', () => {
    const c = CINEMATICS.find(c => c.id === 'game_complete')!;
    expect(c.lines).toHaveLength(5);
  });

  it('ch2_opening is present', () => {
    expect(ALL_IDS.has('ch2_opening')).toBe(true);
  });

  it('ch8_opening is present', () => {
    expect(ALL_IDS.has('ch8_opening')).toBe(true);
  });

  it('stage5_mid features 도깨비 전사 and 산신령 (3 lines)', () => {
    const c = getCinematic('stage5_mid')!;
    expect(c).toBeDefined();
    expect(c.lines).toHaveLength(3);
    const speakers = c.lines.map(l => l.speaker);
    expect(speakers).toContain('도깨비 전사');
    expect(speakers).toContain('산신령');
  });

  it('ch1_clear features 산신령 and 구미호 (4 lines)', () => {
    const c = getCinematic('ch1_clear')!;
    expect(c).toBeDefined();
    expect(c.lines).toHaveLength(4);
    const speakers = c.lines.map(l => l.speaker);
    expect(speakers).toContain('산신령');
    expect(speakers).toContain('구미호');
  });
});

// ─── getCinematic ─────────────────────────────────────────────────────────────

describe('getCinematic', () => {
  it('returns the correct def for a known id', () => {
    const c = getCinematic('ch1_opening');
    expect(c).toBeDefined();
    expect(c!.id).toBe('ch1_opening');
  });

  it('returned def has the expected lines', () => {
    const c = getCinematic('ch1_opening')!;
    expect(c.lines.length).toBeGreaterThan(0);
  });

  it('returns undefined for an unknown id', () => {
    expect(getCinematic('nonexistent_xyz')).toBeUndefined();
  });

  it('returns undefined for empty string', () => {
    expect(getCinematic('')).toBeUndefined();
  });

  it('is consistent — calling twice returns equivalent objects', () => {
    const a = getCinematic('ch1_clear');
    const b = getCinematic('ch1_clear');
    expect(a).toStrictEqual(b);
  });

  it('game_complete def has 5 lines', () => {
    expect(getCinematic('game_complete')!.lines).toHaveLength(5);
  });
});

// ─── STAGE_CINEMATICS ─────────────────────────────────────────────────────────

describe('STAGE_CINEMATICS', () => {
  it('has at least 10 stage mappings', () => {
    expect(Object.keys(STAGE_CINEMATICS).length).toBeGreaterThanOrEqual(10);
  });

  it('stage 1 maps to ch1_opening', () => {
    expect(STAGE_CINEMATICS[1]).toBe('ch1_opening');
  });

  it('stage 80 maps to primordial_titan_boss_intro', () => {
    expect(STAGE_CINEMATICS[80]).toBe('primordial_titan_boss_intro');
  });

  it('Ch9: stage 81 opens the chapter, stage 90 introduces the void sovereign', () => {
    expect(STAGE_CINEMATICS[81]).toBe('ch9_opening');
    expect(STAGE_CINEMATICS[90]).toBe('void_sovereign_boss_intro');
    expect(getCinematic('ch9_opening')).toBeDefined();
    expect(getCinematic('void_sovereign_boss_intro')).toBeDefined();
  });

  it('every mapped cinematic id exists in CINEMATICS', () => {
    for (const [stage, cinematicId] of Object.entries(STAGE_CINEMATICS)) {
      expect(
        ALL_IDS.has(cinematicId),
        `stage ${stage} → "${cinematicId}" not in CINEMATICS`,
      ).toBe(true);
    }
  });

  it('all stage keys are positive integers', () => {
    for (const key of Object.keys(STAGE_CINEMATICS)) {
      const n = Number(key);
      expect(Number.isInteger(n), `key "${key}" not integer`).toBe(true);
      expect(n, `key "${key}" not positive`).toBeGreaterThan(0);
    }
  });

  it('all stage keys are within [1, 90] bounds', () => {
    for (const key of Object.keys(STAGE_CINEMATICS)) {
      const n = Number(key);
      expect(n).toBeGreaterThanOrEqual(1);
      expect(n).toBeLessThanOrEqual(90);
    }
  });

  it('stage 5 maps to stage5_mid', () => {
    expect(STAGE_CINEMATICS[5]).toBe('stage5_mid');
  });

  it('stage 32 maps to dragon_king_boss_intro', () => {
    expect(STAGE_CINEMATICS[32]).toBe('dragon_king_boss_intro');
  });

  it('stage 52 maps to final_boss_intro', () => {
    expect(STAGE_CINEMATICS[52]).toBe('final_boss_intro');
  });

  it('stage 62 maps to eternal_emperor_boss_intro', () => {
    expect(STAGE_CINEMATICS[62]).toBe('eternal_emperor_boss_intro');
  });
});

// ─── CINEMATICS — ch3–ch7 chapter openings ───────────────────────────────────

describe('CINEMATICS — ch3–ch7 chapter openings', () => {
  for (const id of ['ch3_opening', 'ch4_opening', 'ch5_opening', 'ch6_opening', 'ch7_opening']) {
    it(`${id} exists in CINEMATICS`, () => {
      expect(ALL_IDS.has(id)).toBe(true);
    });
  }

  it('ch3_opening features 용왕 and 산신령', () => {
    const c = getCinematic('ch3_opening')!;
    const speakers = c.lines.map(l => l.speaker);
    expect(speakers).toContain('용왕');
    expect(speakers).toContain('산신령');
  });

  it('ch4_opening features 저승사자', () => {
    const c = getCinematic('ch4_opening')!;
    expect(c.lines.some(l => l.speaker === '저승사자')).toBe(true);
  });

  it('ch7_opening features 천상 수호자', () => {
    const c = getCinematic('ch7_opening')!;
    expect(c.lines.some(l => l.speaker === '천상 수호자')).toBe(true);
  });

  it('ch6_opening features 구미호', () => {
    const c = getCinematic('ch6_opening')!;
    expect(c.lines.some(l => l.speaker === '구미호')).toBe(true);
  });
});

// ─── CINEMATICS — boss intro spot-checks ─────────────────────────────────────

describe('CINEMATICS — boss intro spot-checks', () => {
  const BOSS_IDS = [
    'dragon_king_boss_intro',
    'death_emissary_boss_intro',
    'god_emperor_boss_intro',
    'final_boss_intro',
    'eternal_emperor_boss_intro',
  ];

  it('all 5 boss intros exist in CINEMATICS', () => {
    for (const id of BOSS_IDS) {
      expect(ALL_IDS.has(id), `missing: ${id}`).toBe(true);
    }
  });

  it('dragon_king_boss_intro features 용왕 and 도깨비 전사', () => {
    const c = getCinematic('dragon_king_boss_intro')!;
    const speakers = c.lines.map(l => l.speaker);
    expect(speakers).toContain('용왕');
    expect(speakers).toContain('도깨비 전사');
  });

  it('death_emissary_boss_intro features 저승왕 사자', () => {
    const c = getCinematic('death_emissary_boss_intro')!;
    expect(c.lines.some(l => l.speaker === '저승왕 사자')).toBe(true);
  });

  it('god_emperor_boss_intro features 천제', () => {
    const c = getCinematic('god_emperor_boss_intro')!;
    expect(c.lines.some(l => l.speaker === '천제')).toBe(true);
  });

  it('eternal_emperor_boss_intro features 영원의 황제', () => {
    const c = getCinematic('eternal_emperor_boss_intro')!;
    expect(c.lines.some(l => l.speaker === '영원의 황제')).toBe(true);
  });

  it('final_boss_intro features 삼신 파괴자', () => {
    const c = getCinematic('final_boss_intro')!;
    expect(c.lines.some(l => l.speaker === '삼신 파괴자')).toBe(true);
  });

  it('every boss intro has 도깨비 전사 as one of the speakers', () => {
    for (const id of BOSS_IDS) {
      const c = getCinematic(id)!;
      const speakers = c.lines.map(l => l.speaker);
      expect(speakers, `${id} missing 도깨비 전사`).toContain('도깨비 전사');
    }
  });
});

// ─── STAGE_CINEMATICS — remaining chapter and boss mappings ──────────────────

describe('STAGE_CINEMATICS — remaining chapter and boss mappings', () => {
  it('stage 11 maps to ch2_opening', () => {
    expect(STAGE_CINEMATICS[11]).toBe('ch2_opening');
  });

  it('stage 21 maps to ch3_opening', () => {
    expect(STAGE_CINEMATICS[21]).toBe('ch3_opening');
  });

  it('stage 33 maps to ch4_opening', () => {
    expect(STAGE_CINEMATICS[33]).toBe('ch4_opening');
  });

  it('stage 42 maps to death_emissary_boss_intro', () => {
    expect(STAGE_CINEMATICS[42]).toBe('death_emissary_boss_intro');
  });

  it('stage 43 maps to ch5_opening', () => {
    expect(STAGE_CINEMATICS[43]).toBe('ch5_opening');
  });

  it('stage 53 maps to ch6_opening', () => {
    expect(STAGE_CINEMATICS[53]).toBe('ch6_opening');
  });

  it('stage 63 maps to ch7_opening', () => {
    expect(STAGE_CINEMATICS[63]).toBe('ch7_opening');
  });

  it('stage 72 maps to god_emperor_boss_intro', () => {
    expect(STAGE_CINEMATICS[72]).toBe('god_emperor_boss_intro');
  });

  it('stage 73 maps to ch8_opening', () => {
    expect(STAGE_CINEMATICS[73]).toBe('ch8_opening');
  });
});

// ─── CINEMATICS — stage20 boss intro and Ch8 cinematic spot-checks ───────────

describe('CINEMATICS — stage20 and Ch8 cinematic spot-checks', () => {
  it('stage20_boss_intro features 여우 여왕 (3 lines)', () => {
    const c = getCinematic('stage20_boss_intro')!;
    expect(c).toBeDefined();
    expect(c.lines).toHaveLength(3);
    expect(c.lines.some(l => l.speaker === '여우 여왕')).toBe(true);
  });

  it('primordial_titan_boss_intro features 원초신 as the main speaker', () => {
    const c = getCinematic('primordial_titan_boss_intro')!;
    expect(c.lines.some(l => l.speaker === '원초신')).toBe(true);
    expect(c.lines.some(l => l.speaker === '도깨비 전사')).toBe(true);
  });

  it('ch8_opening features 산신령 and 구미호 (5 lines)', () => {
    const c = getCinematic('ch8_opening')!;
    expect(c).toBeDefined();
    expect(c.lines).toHaveLength(5);
    expect(c.lines.some(l => l.speaker === '산신령')).toBe(true);
    expect(c.lines.some(l => l.speaker === '구미호')).toBe(true);
  });
});

// ─── CINEMATICS — exact counts, line counts & pause pins ─────────────────────

describe('CINEMATICS — exact counts, line counts & pause pins', () => {
  it('CINEMATICS contains exactly 21 entries', () => {
    expect(CINEMATICS).toHaveLength(21);
  });

  it('STAGE_CINEMATICS contains exactly 17 stage mappings', () => {
    expect(Object.keys(STAGE_CINEMATICS)).toHaveLength(17);
  });

  it('ch1_opening has exactly 5 lines', () => {
    expect(getCinematic('ch1_opening')!.lines).toHaveLength(5);
  });

  it('ch2_opening has 3 lines and features both 구미호 and 도깨비 전사', () => {
    const c = getCinematic('ch2_opening')!;
    expect(c.lines).toHaveLength(3);
    const speakers = c.lines.map(l => l.speaker);
    expect(speakers).toContain('구미호');
    expect(speakers).toContain('도깨비 전사');
  });

  it('ch5_opening has 3 lines and every line speaker is 산신령', () => {
    const c = getCinematic('ch5_opening')!;
    expect(c.lines).toHaveLength(3);
    for (const line of c.lines) {
      expect(line.speaker).toBe('산신령');
    }
  });

  it('stage10_boss_intro has 2 lines and second line has pause=500', () => {
    const c = getCinematic('stage10_boss_intro')!;
    expect(c.lines).toHaveLength(2);
    expect(c.lines[1].pause).toBe(500);
  });

  it('ch7_opening has exactly 4 lines', () => {
    expect(getCinematic('ch7_opening')!.lines).toHaveLength(4);
  });
});
