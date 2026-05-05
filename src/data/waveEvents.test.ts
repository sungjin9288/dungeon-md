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

// ─── WAVE_EVENTS — per-event name and icon spot-checks ───────────────────────

describe('WAVE_EVENTS — per-event name and icon spot-checks', () => {
  const get = (t: string) => WAVE_EVENTS.find(e => e.type === t)!;

  it('merchant name is "방랑 상인" and icon is 🏪', () => {
    expect(get('merchant').name).toBe('방랑 상인');
    expect(get('merchant').icon).toBe('🏪');
  });

  it('supply name is "보급품 도착" and icon is 📦', () => {
    expect(get('supply').name).toBe('보급품 도착');
    expect(get('supply').icon).toBe('📦');
  });

  it('curse name is "저주받은 침략" and icon is 💀', () => {
    expect(get('curse').name).toBe('저주받은 침략');
    expect(get('curse').icon).toBe('💀');
  });

  it('rally name is "몬스터 격려" and icon is 📯', () => {
    expect(get('rally').name).toBe('몬스터 격려');
    expect(get('rally').icon).toBe('📯');
  });

  it('fog name is "짙은 안개" and icon is 🌫️', () => {
    expect(get('fog').name).toBe('짙은 안개');
    expect(get('fog').icon).toBe('🌫️');
  });

  it('void_storm name is "허공의 폭풍" and icon is 🌀', () => {
    expect(get('void_storm').name).toBe('허공의 폭풍');
    expect(get('void_storm').icon).toBe('🌀');
  });

  it('ancient_blessing name is "고대의 축복" and icon is ✨', () => {
    expect(get('ancient_blessing').name).toBe('고대의 축복');
    expect(get('ancient_blessing').icon).toBe('✨');
  });

  it('crimson_curse name is "붉은 저주" and icon is 🩸', () => {
    expect(get('crimson_curse').name).toBe('붉은 저주');
    expect(get('crimson_curse').icon).toBe('🩸');
  });
});

// ─── WAVE_EVENTS — colors and effect characterization ────────────────────────

describe('WAVE_EVENTS — colors and effect characterization', () => {
  it('every color is a CSS hex string starting with "#"', () => {
    for (const e of WAVE_EVENTS) {
      expect(e.color, `${e.type} color`).toMatch(/^#[0-9a-fA-F]{6}$/);
    }
  });

  it('merchant color is #ffcc44 (gold)', () => {
    expect(WAVE_EVENTS.find(e => e.type === 'merchant')!.color).toBe('#ffcc44');
  });

  it('crimson_curse color is #dd2244 (red)', () => {
    expect(WAVE_EVENTS.find(e => e.type === 'crimson_curse')!.color).toBe('#dd2244');
  });

  it('ancient_blessing color is #44bbff (light blue)', () => {
    expect(WAVE_EVENTS.find(e => e.type === 'ancient_blessing')!.color).toBe('#44bbff');
  });

  it('crimson_curse has the highest reward multiplier (×3)', () => {
    const e = WAVE_EVENTS.find(e => e.type === 'crimson_curse')!;
    expect(e.description).toContain('×3');
  });

  it('curse reward multiplier is ×2 (lower than crimson_curse ×3)', () => {
    const e = WAVE_EVENTS.find(e => e.type === 'curse')!;
    expect(e.description).toContain('×2');
  });

  it('fog description mentions speed reduction (침략자 속도 -)', () => {
    const e = WAVE_EVENTS.find(e => e.type === 'fog')!;
    expect(e.description).toMatch(/속도\s*-/);
  });

  it('supply description mentions HP recovery (던전 HP)', () => {
    const e = WAVE_EVENTS.find(e => e.type === 'supply')!;
    expect(e.description).toMatch(/HP/);
  });

  it('rally description mentions ATK boost percentage', () => {
    const e = WAVE_EVENTS.find(e => e.type === 'rally')!;
    expect(e.description).toMatch(/ATK\s*\+\d+%/);
  });

  it('all 8 colors are distinct', () => {
    const colors = WAVE_EVENTS.map(e => e.color);
    expect(new Set(colors).size).toBe(colors.length);
  });

  it('supply color is #44cc88 (green)', () => {
    expect(WAVE_EVENTS.find(e => e.type === 'supply')!.color).toBe('#44cc88');
  });

  it('curse color is #cc44cc (purple)', () => {
    expect(WAVE_EVENTS.find(e => e.type === 'curse')!.color).toBe('#cc44cc');
  });

  it('rally color is #ff8844 (orange)', () => {
    expect(WAVE_EVENTS.find(e => e.type === 'rally')!.color).toBe('#ff8844');
  });

  it('fog color is #8899bb (blue-grey)', () => {
    expect(WAVE_EVENTS.find(e => e.type === 'fog')!.color).toBe('#8899bb');
  });

  it('void_storm color is #7744dd (deep purple)', () => {
    expect(WAVE_EVENTS.find(e => e.type === 'void_storm')!.color).toBe('#7744dd');
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

  it('wave=2 (minimum eligible) returns an event for stageId=4', () => {
    // seededHash(2, 4) % 100 < 30 → triggers; verified via npx tsx probe
    const evt = rollWaveEvent(2, 10, 4);
    expect(evt).not.toBeNull();
    expect(evt!.type).toBe('fog');
  });

  it('wave=maxWave-1 (one before boss) is eligible for events', () => {
    // stageId=1: seededHash(9,1) % 100 < 30 → triggers
    const evt = rollWaveEvent(9, 10, 1);
    expect(evt).not.toBeNull();
    expect(evt!.type).toBe('fog');
  });

  it('all 8 event types are reachable across wave/stageId combinations', () => {
    const seen = new Set<string>();
    for (let wave = 2; wave < 20; wave++) {
      for (let s = 0; s < 200; s++) {
        const evt = rollWaveEvent(wave, 25, s);
        if (evt) seen.add(evt.type);
      }
    }
    for (const e of WAVE_EVENTS) {
      expect(seen.has(e.type), `${e.type} never returned`).toBe(true);
    }
  });

  it('returns null in the 70% non-trigger case (wave=2, stageId=1, hash%100=51)', () => {
    // seededHash(2,1) % 100 = 51 ≥ 30 → no event
    expect(rollWaveEvent(2, 10, 1)).toBeNull();
  });

  it('returns supply for wave=3, stageId=5 (hash%100=1 → triggers, idx→supply)', () => {
    const evt = rollWaveEvent(3, 10, 5);
    expect(evt).not.toBeNull();
    expect(evt!.type).toBe('supply');
  });

  it('returns merchant for wave=5, stageId=1 (deterministic)', () => {
    const evt = rollWaveEvent(5, 20, 1);
    expect(evt).not.toBeNull();
    expect(evt!.type).toBe('merchant');
  });

  it('returns void_storm for wave=12, stageId=1 (deterministic)', () => {
    const evt = rollWaveEvent(12, 20, 1);
    expect(evt).not.toBeNull();
    expect(evt!.type).toBe('void_storm');
  });

  it('returns ancient_blessing for wave=4, stageId=2 (deterministic)', () => {
    const evt = rollWaveEvent(4, 20, 2);
    expect(evt).not.toBeNull();
    expect(evt!.type).toBe('ancient_blessing');
  });

  it('returned event is the same object reference as in WAVE_EVENTS (not a copy)', () => {
    const evt = rollWaveEvent(3, 10, 5); // known to return supply
    const supplyDef = WAVE_EVENTS.find(e => e.type === 'supply');
    expect(evt).toBe(supplyDef);
  });
});

// ─── WAVE_EVENTS — array order, key set, and description numeric pins ─────────

describe('WAVE_EVENTS — array order, key set & description numeric pins', () => {
  it('WAVE_EVENTS[0] is merchant (cheapest / first defined)', () => {
    expect(WAVE_EVENTS[0].type).toBe('merchant');
  });

  it('WAVE_EVENTS[7] is crimson_curse (last defined)', () => {
    expect(WAVE_EVENTS[7].type).toBe('crimson_curse');
  });

  it('every WaveEventDef has exactly the 5 expected keys', () => {
    const expectedKeys = ['type', 'name', 'icon', 'description', 'color'].sort();
    for (const e of WAVE_EVENTS) {
      expect(Object.keys(e).sort(), `${e.type} keys`).toStrictEqual(expectedKeys);
    }
  });

  it('merchant description contains the ×1.5 multiplier', () => {
    const e = WAVE_EVENTS.find(e => e.type === 'merchant')!;
    expect(e.description).toContain('×1.5');
  });

  it('void_storm description contains the ×1.8 gold multiplier', () => {
    const e = WAVE_EVENTS.find(e => e.type === 'void_storm')!;
    expect(e.description).toContain('×1.8');
  });

  it('supply description specifies exactly 15% HP recovery', () => {
    const e = WAVE_EVENTS.find(e => e.type === 'supply')!;
    expect(e.description).toContain('15%');
  });

  it('rollWaveEvent(2, 2, n) always returns null (wave=maxWave is boss wave)', () => {
    for (let n = 0; n < 20; n++) {
      expect(rollWaveEvent(2, 2, n), `stageId=${n}`).toBeNull();
    }
  });
});
