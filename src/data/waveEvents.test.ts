import { describe, it, expect } from 'vitest';
import { WAVE_EVENTS, rollWaveEvent } from './waveEvents';

// ─── WAVE_EVENTS data integrity ───────────────────────────────────────────────

describe('WAVE_EVENTS', () => {
  it('contains exactly 8 event types', () => {
    expect(WAVE_EVENTS.length).toBe(8);
  });

  it('has unique event types', () => {
    const types = WAVE_EVENTS.map(e => e.type);
    expect(new Set(types).size).toBe(types.length);
  });

  it('every event has a non-empty name, icon, description, and color', () => {
    for (const e of WAVE_EVENTS) {
      expect(e.name.length, `event ${e.type} name`).toBeGreaterThan(0);
      expect(e.icon.length, `event ${e.type} icon`).toBeGreaterThan(0);
      expect(e.description.length, `event ${e.type} description`).toBeGreaterThan(0);
      expect(e.color.length, `event ${e.type} color`).toBeGreaterThan(0);
    }
  });

  it('includes the original 5 event types', () => {
    const types = WAVE_EVENTS.map(e => e.type);
    expect(types).toContain('merchant');
    expect(types).toContain('supply');
    expect(types).toContain('curse');
    expect(types).toContain('rally');
    expect(types).toContain('fog');
  });

  it('includes the 3 new event types added in Batch 93', () => {
    const types = WAVE_EVENTS.map(e => e.type);
    expect(types).toContain('void_storm');
    expect(types).toContain('ancient_blessing');
    expect(types).toContain('crimson_curse');
  });

  it('void_storm description mentions speed and gold', () => {
    const e = WAVE_EVENTS.find(e => e.type === 'void_storm')!;
    expect(e.description).toMatch(/속도|speed/i);
    expect(e.description).toMatch(/골드|gold/i);
  });

  it('ancient_blessing description mentions ATK and HP', () => {
    const e = WAVE_EVENTS.find(e => e.type === 'ancient_blessing')!;
    expect(e.description).toMatch(/ATK|공격/i);
    expect(e.description).toMatch(/HP|회복/i);
  });

  it('crimson_curse description mentions HP and reward', () => {
    const e = WAVE_EVENTS.find(e => e.type === 'crimson_curse')!;
    expect(e.description).toMatch(/HP/i);
    expect(e.description).toMatch(/보상|×/i);
  });
});

// ─── rollWaveEvent ────────────────────────────────────────────────────────────

describe('rollWaveEvent', () => {
  it('returns null for wave 1 (too early)', () => {
    expect(rollWaveEvent(1, 10, 1)).toBeNull();
  });

  it('returns null for the boss wave (last wave)', () => {
    expect(rollWaveEvent(10, 10, 1)).toBeNull();
    expect(rollWaveEvent(8, 8, 5)).toBeNull();
  });

  it('is deterministic — same inputs always produce the same result', () => {
    const a = rollWaveEvent(3, 10, 42);
    const b = rollWaveEvent(3, 10, 42);
    expect(a?.type ?? null).toBe(b?.type ?? null);
  });

  it('produces different results for different stageIds', () => {
    // Different stages should usually produce different events
    const results = new Set<string | null>();
    for (let stageId = 1; stageId <= 20; stageId++) {
      const evt = rollWaveEvent(3, 10, stageId);
      results.add(evt?.type ?? null);
    }
    // Across 20 stages we should see at least 2 distinct outcomes (event or null)
    expect(results.size).toBeGreaterThanOrEqual(2);
  });

  it('triggers roughly 30% of the time (statistical check)', () => {
    let triggered = 0;
    const RUNS = 300;
    // Use consecutive stage IDs as the varying seed
    for (let i = 0; i < RUNS; i++) {
      if (rollWaveEvent(3, 10, i) !== null) triggered++;
    }
    const rate = triggered / RUNS;
    // Expect rate between 20% and 40% (30% nominal ± tolerance)
    expect(rate).toBeGreaterThan(0.20);
    expect(rate).toBeLessThan(0.40);
  });

  it('when an event fires, it is always one of the 8 defined types', () => {
    const validTypes = new Set(WAVE_EVENTS.map(e => e.type));
    for (let stageId = 0; stageId < 100; stageId++) {
      const evt = rollWaveEvent(4, 10, stageId);
      if (evt !== null) {
        expect(validTypes.has(evt.type)).toBe(true);
      }
    }
  });

  it('returns null for wave < 2 regardless of maxWave', () => {
    expect(rollWaveEvent(0, 20, 5)).toBeNull();
    expect(rollWaveEvent(1, 20, 5)).toBeNull();
  });
});
