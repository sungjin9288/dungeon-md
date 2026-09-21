// ─── waveEventMults ───────────────────────────────────────────────────────────
// Pure multiplier table for the wave events (도전 이벤트), kept free of
// Phaser-coupled imports so it stays unit-testable — the same split
// spawnDefResolve.ts uses for its own reason.
//
// `WaveEvents.applyWaveEvent` reads this and then does the two things that are
// NOT pure: the dungeon-HP heals (supply / ancient_blessing) and the fog
// overlay. Everything an event does to a wave's numbers lives here.
//
// These multipliers reach combat through `pendingWaveMults`: the event card is
// shown ~1.8s before `startWave`, which used to reset all four to 1, so every
// event that works through a multiplier was wiped before it could touch a
// spawn or a reward.

export interface WaveEventMults {
  readonly gold: number;
  readonly hp: number;
  readonly atk: number;
  readonly spd: number;
}

export const NEUTRAL_WAVE_MULTS: WaveEventMults = { gold: 1, hp: 1, atk: 1, spd: 1 };

/** Fraction of maxHp an event restores on apply (0 when it does not heal). */
export const WAVE_EVENT_HEAL: Readonly<Record<string, number>> = {
  supply: 0.15,
  ancient_blessing: 0.10,
};

const TABLE: Readonly<Record<string, Partial<WaveEventMults>>> = {
  merchant:         { gold: 1.5 },
  supply:           {},                                  // heal only
  curse:            { hp: 1.3, gold: 2.0 },
  rally:            { atk: 1.25 },
  fog:              { spd: 0.85 },
  void_storm:       { spd: 1.25, gold: 1.8 },
  ancient_blessing: { atk: 1.20 },                       // plus the heal above
  crimson_curse:    { hp: 1.5, gold: 3.0 },
  gold_vein:        { gold: 2.5 },
  raiders:          { spd: 1.3, hp: 1.2, gold: 2.2 },
  guardian_rite:    { atk: 1.4 },
  unsealing:        { hp: 1.6, atk: 1.3, gold: 2.5 },
  time_warp:        { spd: 0.7, atk: 1.15 },
};

/** The multipliers an event imposes on the wave it precedes. */
export function waveEventMults(type: string): WaveEventMults {
  return { ...NEUTRAL_WAVE_MULTS, ...(TABLE[type] ?? {}) };
}

/** Whether an event changes any of the wave's numbers (as opposed to healing only). */
export function shiftsWaveNumbers(type: string): boolean {
  const mults = waveEventMults(type);
  return mults.gold !== 1 || mults.hp !== 1 || mults.atk !== 1 || mults.spd !== 1;
}

/** Event types this table knows about. */
export function knownWaveEventTypes(): string[] {
  return Object.keys(TABLE);
}
