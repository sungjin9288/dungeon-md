// ─── Weekly Boss Phases ───────────────────────────────────────────────────────
// Pure data + helpers for the weekly raid boss phase mechanic.
//
// The weekly boss (data/daily.ts WEEKLY_BOSS_POOL) fights in `phases` equal HP
// segments — with the standard 5 phases the boundaries land on 80/60/40/20%,
// matching the three_god_destroyer FIVE_PHASE precedent. Entering a phase
// permanently speeds the boss up (the raid's fail pressure is the boss
// breaching the dungeon gate) and summons escort adds.
//
// Scene-side application lives in combat/WeeklyBossBehavior.ts; everything in
// this file is engine-free and unit-testable.

import type { InvaderType } from './invaders';

export interface WeeklyBossPhaseMod {
  /** 1-based phase index. */
  phase:       number;
  /** Path-speed multiplier applied (permanently) when the phase begins. */
  speedMult:   number;
  /** Number of escort adds summoned when the phase begins. */
  summonCount: number;
  /** Invader type of the summoned escort adds. */
  summonType:  InvaderType;
  /** Phase-transition banner text (phase 1 is the spawn state — no banner). */
  banner:      string;
  /** Banner / camera-flash color. */
  color:       number;
}

// Escalation tuning: in tower defense the boss's threat is reaching the gate,
// so phases ramp speed (1.0 → 1.5) the way an RPG boss would ramp ATK
// (×1.3 / ×1.6). Adds escalate from chaff (soldier) through fast pressure
// (shaman) to damage soaks (knight), totalling 8 summons across a full fight.
export const WEEKLY_BOSS_PHASE_MODS: readonly WeeklyBossPhaseMod[] = [
  { phase: 1, speedMult: 1.0,  summonCount: 0, summonType: 'soldier', banner: '',                          color: 0xaa44ff },
  { phase: 2, speedMult: 1.1,  summonCount: 1, summonType: 'soldier', banner: '👑 2단계 — 분노의 가속!',    color: 0x44aaff },
  { phase: 3, speedMult: 1.2,  summonCount: 2, summonType: 'shaman',  banner: '👑 3단계 — 부하 소환!',      color: 0x44ff88 },
  { phase: 4, speedMult: 1.35, summonCount: 2, summonType: 'knight',  banner: '👑 4단계 — 광폭화!',         color: 0xffaa00 },
  { phase: 5, speedMult: 1.5,  summonCount: 3, summonType: 'shaman',  banner: '👑 최종 단계 — 최후의 발악!', color: 0xff4444 },
];

// ─── getWeeklyBossPhase ───────────────────────────────────────────────────────
// Maps current HP to a 1-based phase over `phases` equal segments.
// phases = 5: (80%, 100%] → 1, (60%, 80%] → 2, ... [0%, 20%] → 5.
// Invalid inputs (non-positive totalHp/phases) fall back to phase 1.

export function getWeeklyBossPhase(hp: number, totalHp: number, phases: number): number {
  if (!Number.isFinite(totalHp) || totalHp <= 0) return 1;
  if (!Number.isFinite(phases)  || phases  <= 0) return 1;
  if (hp >= totalHp) return 1;
  if (hp <= 0) return phases;

  const segment = Math.ceil((hp / totalHp) * phases);   // 1..phases from the bottom
  return Math.min(phases, Math.max(1, phases - segment + 1));
}

// ─── getWeeklyBossPhaseMod ────────────────────────────────────────────────────
// Clamped lookup into WEEKLY_BOSS_PHASE_MODS — out-of-range phases resolve to
// the nearest defined entry so a future `phases !== 5` config stays safe.

export function getWeeklyBossPhaseMod(phase: number): WeeklyBossPhaseMod {
  const idx = Math.min(WEEKLY_BOSS_PHASE_MODS.length - 1, Math.max(0, phase - 1));
  return WEEKLY_BOSS_PHASE_MODS[idx];
}
