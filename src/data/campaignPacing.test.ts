/**
 * Campaign pacing guard — the dungeon that fights a stage is the home dungeon,
 * so every stage is held against what the pacing model says a player's home
 * can be by then (see campaignPacing.ts for the model and its assumptions).
 *
 *   starter  — one level-1 guardian room with the starter monster: stage 1 must
 *              be winnable by a player who has done nothing else.
 *   lean     — DM XP and gold from stage clears alone, no quest finished: every
 *              stage must be winnable from this floor.
 *   expected — main-quest chain kept up: every stage must leave real margin.
 *
 * The headless simulation is optimistic (all DPS reaches every invader), so the
 * thresholds are calibrated by scripts/verify-campaign-pacing.mjs, which plays
 * the same homes through real combat. Raise a threshold only with that evidence.
 */

import { describe, expect, it } from 'vitest';
import { ALL_STAGES } from './allStages';
import {
  campaignPacingTable,
  expectedDmLevel,
  expectedHome,
  expectedGuardianLevel,
  expectedRoster,
  expectedRosterSize,
  expectedSpentSkills,
  GUARDIAN_SP_PER_LEVELS,
  leanHome,
  requiredDps,
  simulateHome,
  starterHome,
  veteranHome,
} from './campaignPacing';
import { STARTER_ROSTER } from './barracks';
import { MAX_DUNGEON_SLOTS } from './wisdom';

const LEAN_MIN_MARGIN = 1.15;
const EXPECTED_MIN_MARGIN = 1.3;
const EXPECTED_MIN_WIN_PCT = 60;

describe('pacing model — shape', () => {
  it('roster grows one attacker per three stages, from the starters alone', () => {
    expect(expectedRosterSize(1)).toBe(STARTER_ROSTER.length);
    expect(expectedRosterSize(3)).toBe(STARTER_ROSTER.length + 1);
    expect(expectedRosterSize(90)).toBe(STARTER_ROSTER.length + 30);
    expect(expectedRoster(1)).toEqual(STARTER_ROSTER);
    expect(expectedRoster(90)).toHaveLength(STARTER_ROSTER.length + 30);
  });

  it('DM level, slots and room level never fall as the campaign advances', () => {
    let prev = { dmLevel: 0, slotCount: 0, roomLevel: 0 };
    for (const stage of ALL_STAGES) {
      const home = expectedHome(stage.id);
      expect(home.dmLevel, `stage ${stage.id} dm`).toBeGreaterThanOrEqual(prev.dmLevel);
      expect(home.slotCount, `stage ${stage.id} slots`).toBeGreaterThanOrEqual(prev.slotCount);
      expect(home.roomLevel, `stage ${stage.id} room level`).toBeGreaterThanOrEqual(prev.roomLevel);
      expect(home.slotCount).toBeLessThanOrEqual(MAX_DUNGEON_SLOTS);
      prev = home;
    }
  });

  it('the lean home never exceeds the expected home', () => {
    for (const stage of ALL_STAGES) {
      const lean = leanHome(stage.id);
      const full = expectedHome(stage.id);
      expect(lean.dmLevel, `stage ${stage.id}`).toBeLessThanOrEqual(full.dmLevel);
      expect(lean.roomLevel, `stage ${stage.id}`).toBeLessThanOrEqual(full.roomLevel);
    }
    expect(expectedDmLevel(1)).toBeGreaterThan(leanHome(1).dmLevel);
  });

  it('a levelled guardian has spent the skill point its level earned', () => {
    expect(expectedSpentSkills(GUARDIAN_SP_PER_LEVELS - 1)).toEqual({});
    expect(expectedSpentSkills(GUARDIAN_SP_PER_LEVELS)).toEqual({ A1: 1 });

    // The first stage whose model roster has reached the first skill point must
    // carry it into the home the guard fights with — levelling the roster and
    // then throwing its reward away is the Lv.1 mistake one layer down.
    const stage = ALL_STAGES.find(s => expectedGuardianLevel(s.id) >= GUARDIAN_SP_PER_LEVELS);
    expect(stage, 'no stage reaches the first skill point').toBeDefined();
    for (const monster of leanHome(stage!.id).ownedMonsters) {
      expect(monster.spentSkills, `stage ${stage!.id} ${monster.id}`).toEqual({ A1: 1 });
    }
    // Stage 1 has killed nothing yet, so it keeps the bare starter board.
    for (const monster of starterHome().ownedMonsters) expect(monster.spentSkills).toEqual({});
  });

  it('every stage demands a finite, positive DPS', () => {
    for (const stage of ALL_STAGES) {
      const required = requiredDps(stage);
      expect(required, `stage ${stage.id}`).toBeGreaterThan(0);
      expect(Number.isFinite(required), `stage ${stage.id}`).toBe(true);
    }
  });
});

describe('campaign is winnable by the home dungeon', () => {
  it('stage 1 falls to the starter home with dungeon HP to spare', () => {
    const sim = simulateHome(starterHome(), ALL_STAGES[0]);
    expect(sim.finalHp).toBeGreaterThan(0);
    expect(sim.winPct).toBeGreaterThanOrEqual(50);
  });

  // Chapters 1–8 are the campaign body: a player who only ever cleared stages
  // must get through. Chapter 9 is the endgame and is tuned for a grown roster
  // (veteranHome): the weakest possible roster is *meant* to hit that wall.
  const CAMPAIGN_BODY_LAST_STAGE = 80;

  it(`every stage through ${CAMPAIGN_BODY_LAST_STAGE} clears from the lean floor with margin ≥ ${LEAN_MIN_MARGIN}`, () => {
    for (const row of campaignPacingTable(leanHome)) {
      if (row.stageNumber === 1 || row.stageNumber > CAMPAIGN_BODY_LAST_STAGE) continue;
      expect(row.winPct, `stage ${row.stageNumber} lean win%`).toBeGreaterThan(0);
      expect(row.margin, `stage ${row.stageNumber} lean margin`).toBeGreaterThanOrEqual(LEAN_MIN_MARGIN);
    }
  });

  it(`every stage through ${CAMPAIGN_BODY_LAST_STAGE} clears from the expected home with margin ≥ ${EXPECTED_MIN_MARGIN}`, () => {
    for (const row of campaignPacingTable(expectedHome)) {
      if (row.stageNumber > CAMPAIGN_BODY_LAST_STAGE) continue;
      expect(row.winPct, `stage ${row.stageNumber} expected win%`).toBeGreaterThanOrEqual(EXPECTED_MIN_WIN_PCT);
      expect(row.margin, `stage ${row.stageNumber} expected margin`).toBeGreaterThanOrEqual(EXPECTED_MIN_MARGIN);
    }
  });

  it('chapter 9 clears from the veteran home (strongest unlocked roster) with real margin', () => {
    for (const row of campaignPacingTable(veteranHome)) {
      if (row.stageNumber <= CAMPAIGN_BODY_LAST_STAGE) continue;
      expect(row.winPct, `stage ${row.stageNumber} veteran win%`).toBe(100);
      expect(row.margin, `stage ${row.stageNumber} veteran margin`).toBeGreaterThanOrEqual(EXPECTED_MIN_MARGIN);
    }
  });

  it('chapter finales still ask more of the home than the chapter opener did', () => {
    const chapters = new Map<number, typeof ALL_STAGES>();
    for (const stage of ALL_STAGES) chapters.set(stage.chapter, [...(chapters.get(stage.chapter) ?? []), stage]);
    for (const [chapter, stages] of chapters) {
      const opener = requiredDps(stages[0]);
      const finale = requiredDps(stages[stages.length - 1]);
      expect(finale, `chapter ${chapter} finale ${finale} < opener ${opener}`).toBeGreaterThanOrEqual(opener);
    }
  });
});
