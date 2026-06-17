/**
 * 무한 던전 도전 변수 (endless challenge modifiers).
 *
 * Each endless RUN rolls one modifier that reshapes the wave (invader HP /
 * speed / count / elite bias) for a risk-vs-reward twist, with a matching gold
 * reward multiplier. Pure data + selection — no Phaser. Applied in
 * buildEndlessSpawnQueue(); the rewardMult is baked into each invader's reward
 * so gold scales naturally with no result-flow change.
 */

export interface EndlessModifier {
  readonly id: string;
  readonly name: string;
  readonly desc: string;
  readonly icon: string;
  /** Multiplies invader HP scaling (1 = unchanged). */
  readonly hpMult: number;
  /** Multiplies invader move-speed scaling. */
  readonly speedMult: number;
  /** Multiplies the per-wave invader count. */
  readonly countMult: number;
  /** Multiplies gold reward (the risk payoff). */
  readonly rewardMult: number;
  /** Extra bias toward stronger pool entries (0–1, added to the wave bias). */
  readonly eliteBias: number;
}

export const ENDLESS_MODIFIERS: readonly EndlessModifier[] = [
  {
    id: 'swift', name: '신속 침공', icon: '⚡',
    desc: '침략자 이동 속도 +30% · 보상 +20%',
    hpMult: 1, speedMult: 1.3, countMult: 1, rewardMult: 1.2, eliteBias: 0,
  },
  {
    id: 'armored', name: '강철 군세', icon: '🛡',
    desc: '침략자 체력 +40% · 보상 +30%',
    hpMult: 1.4, speedMult: 1, countMult: 1, rewardMult: 1.3, eliteBias: 0,
  },
  {
    id: 'swarm', name: '쇄도', icon: '🐝',
    desc: '침략자 수 +60%, 체력 -20% · 보상 +25%',
    hpMult: 0.8, speedMult: 1, countMult: 1.6, rewardMult: 1.25, eliteBias: 0,
  },
  {
    id: 'elite', name: '정예 행진', icon: '👑',
    desc: '소수 정예: 수 -30%, 체력 +60% · 보상 +40%',
    hpMult: 1.6, speedMult: 1.1, countMult: 0.7, rewardMult: 1.4, eliteBias: 0.3,
  },
  {
    id: 'frenzy', name: '광란', icon: '🔥',
    desc: '체력·속도·수 전방위 강화 · 보상 +35%',
    hpMult: 1.15, speedMult: 1.2, countMult: 1.2, rewardMult: 1.35, eliteBias: 0.1,
  },
  {
    id: 'relentless', name: '끝없는 행군', icon: '🌑',
    desc: '체력 +25%, 속도 +15% · 보상 +30%',
    hpMult: 1.25, speedMult: 1.15, countMult: 1, rewardMult: 1.3, eliteBias: 0,
  },
];

/** Look up a modifier by id (e.g. when restoring from the registry). */
export function getEndlessModifierById(id: string | null | undefined): EndlessModifier | null {
  if (!id) return null;
  return ENDLESS_MODIFIERS.find(m => m.id === id) ?? null;
}

/** Roll one modifier for an endless run. `rng` defaults to Math.random (injectable for tests). */
export function rollEndlessModifier(rng: () => number = Math.random): EndlessModifier {
  const idx = Math.min(ENDLESS_MODIFIERS.length - 1, Math.floor(rng() * ENDLESS_MODIFIERS.length));
  return ENDLESS_MODIFIERS[idx];
}
