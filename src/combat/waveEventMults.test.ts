/**
 * Wave events must reach the wave they were rolled for.
 *
 * `applyWaveEvent` fires when the event card is shown; `startWave` runs ~1.8s
 * later, once the card auto-dismisses. startWave used to hardcode all four
 * multipliers back to 1, so every event that works through a multiplier was
 * wiped before a single invader spawned or a single reward was paid — only the
 * two that also mutate dungeonHp (supply, ancient_blessing) did anything at all.
 * The roll is now carried across that gap in `pendingWaveMults`.
 */
import { describe, expect, it } from 'vitest';
import {
  NEUTRAL_WAVE_MULTS,
  WAVE_EVENT_HEAL,
  knownWaveEventTypes,
  shiftsWaveNumbers,
  waveEventMults,
} from './waveEventMults';

/** What startWave now does with whatever applyWaveEvent left behind. */
function startWaveMults(pending: { gold: number; hp: number; atk: number; spd: number } | undefined) {
  return { gold: pending?.gold ?? 1, hp: pending?.hp ?? 1, atk: pending?.atk ?? 1, spd: pending?.spd ?? 1 };
}

describe('wave event multiplier table', () => {
  const TYPES = knownWaveEventTypes();

  it('covers every event and leaves only the heal-only one neutral', () => {
    expect(TYPES.length).toBeGreaterThanOrEqual(13);
    const neutral = TYPES.filter(type => !shiftsWaveNumbers(type));
    // supply is the only event that does nothing but heal.
    expect(neutral).toEqual(['supply']);
  });

  it('every multiplier is positive and finite', () => {
    for (const type of TYPES) {
      const mults = waveEventMults(type);
      for (const [key, value] of Object.entries(mults)) {
        expect(Number.isFinite(value), `${type}.${key}`).toBe(true);
        expect(value, `${type}.${key}`).toBeGreaterThan(0);
      }
    }
  });

  it('an unknown event is neutral rather than undefined', () => {
    expect(waveEventMults('no_such_event')).toEqual(NEUTRAL_WAVE_MULTS);
  });

  it('only the two documented events heal', () => {
    expect(Object.keys(WAVE_EVENT_HEAL).sort()).toEqual(['ancient_blessing', 'supply']);
  });
});

describe('the roll survives the gap to startWave', () => {
  it('every number-shifting event still shifts once startWave consumes it', () => {
    for (const type of knownWaveEventTypes().filter(shiftsWaveNumbers)) {
      const pending = waveEventMults(type);
      expect(startWaveMults(pending), `${type} reaching startWave`).not.toEqual(NEUTRAL_WAVE_MULTS);
    }
  });

  it('curse arrives with both its invader HP and its gold multiplier', () => {
    const mults = startWaveMults(waveEventMults('curse'));
    expect(mults.hp).toBeGreaterThan(1);
    expect(mults.gold).toBeGreaterThan(1);
  });

  it('a wave with no event starts neutral', () => {
    expect(startWaveMults(undefined)).toEqual(NEUTRAL_WAVE_MULTS);
  });
});
