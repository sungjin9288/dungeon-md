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

  it('all stage keys are within [1, 80] bounds', () => {
    for (const key of Object.keys(STAGE_CINEMATICS)) {
      const n = Number(key);
      expect(n).toBeGreaterThanOrEqual(1);
      expect(n).toBeLessThanOrEqual(80);
    }
  });
});
