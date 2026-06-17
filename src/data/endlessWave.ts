import { INVADER_DEFS } from './invaders';
import type { InvaderType, InvaderDef } from './invaders';
import type { EndlessModifier } from './endlessModifiers';

// ─── buildEndlessSpawnQueue ───────────────────────────────────────────────────
//
// Pure function — no Phaser / scene dependencies.
// Extracted from DungeonScene to allow unit testing and reuse.
//
// Returns a spawn queue for one endless-mode wave.
// Pool expands every 10 waves to include the next chapter's invaders.

// ── Tier pools (weakest → strongest within each tier) ────────────────────────
// Boss types, ghost_add excluded — their phase behaviors need scene wiring.

const T1: InvaderType[] = ['peasant', 'soldier', 'knight', 'shaman'];
const T1_LATE: InvaderType[] = ['void', 'undying'];
const T2: InvaderType[] = ['berserker', 'shadow_ninja', 'siege_soldier', 'high_priest', 'holy_paladin', 'mercenary_captain', 'trap_breaker', 'iron_golem'];
const T3: InvaderType[] = ['undying_knight', 'scarecrow_mage', 'venom_dancer', 'void_assassin'];
const T4: InvaderType[] = ['void_assassin_elite'];
const T5: InvaderType[] = ['void_invader', 'undying_warrior'];
const T6: InvaderType[] = ['mirror_knight', 'shadow_wraith', 'celestial_crusader', 'plague_herald', 'swarm_larva', 'void_colossus', 'titan_sentinel'];
const T7: InvaderType[] = ['celestial_knight', 'divine_archer', 'heaven_general', 'sky_titan', 'radiant_seraph'];
const T8: InvaderType[] = ['void_soldier', 'abyss_berserker', 'primordial_guard'];

function buildPool(w: number): InvaderType[] {
  const pool: InvaderType[] = [...T1];
  if (w >= 5)  pool.push(...T1_LATE);
  if (w >= 10) pool.push(...T2);
  if (w >= 20) pool.push(...T3);
  if (w >= 30) pool.push(...T4);
  if (w >= 40) pool.push(...T5);
  if (w >= 50) pool.push(...T6);
  if (w >= 60) pool.push(...T7);
  if (w >= 70) pool.push(...T8);
  return pool;
}

export function buildEndlessSpawnQueue(
  wave: number,
  modifier?: EndlessModifier | null,
): Array<{ def: InvaderDef; delay: number }> {
  const w     = wave;
  const queue: Array<{ def: InvaderDef; delay: number }> = [];
  const pool  = buildPool(w);

  // Run-level challenge modifier (도전 변수) — defaults to no-op multipliers.
  const mCount  = modifier?.countMult  ?? 1;
  const mHp     = modifier?.hpMult     ?? 1;
  const mSpeed  = modifier?.speedMult  ?? 1;
  const mReward = modifier?.rewardMult ?? 1;
  const mElite  = modifier?.eliteBias  ?? 0;

  // Base count grows with wave (capped at 20 — unchanged baseline). The run
  // modifier then scales it, with a higher 24 ceiling so 쇄도 can swarm.
  const waveCount = Math.min(5 + Math.floor(w / 5), 20);
  const baseCount = Math.min(Math.round(waveCount * mCount), 24);

  // Scaling factors (wave exponential × run modifier)
  const hpMult    = Math.pow(1.12, w - 1) * mHp;
  const speedMult = Math.pow(1.03, w - 1) * mSpeed;
  const rwdMult   = Math.pow(1.08, w - 1) * mReward;

  const makeScaledDef = (type: InvaderType, overrides: Partial<InvaderDef> = {}): InvaderDef => {
    const base = INVADER_DEFS[type];
    return {
      ...base,
      hp:     Math.round(base.hp    * hpMult),
      speed:  Math.round(base.speed * speedMult),
      reward: Math.round(base.reward * rwdMult),
      ...overrides,
    };
  };

  // ── Milestone events ────────────────────────────────────────────────────────

  // Wave 10: elite soldier
  if (w === 10) {
    queue.push({ def: makeScaledDef('soldier', { hp: Math.round(INVADER_DEFS['soldier'].hp * hpMult * 1.5) }), delay: 2000 });
  }

  // Wave 20: mini-boss knight
  if (w === 20) {
    queue.push({ def: makeScaledDef('knight', { hp: Math.round(INVADER_DEFS['knight'].hp * hpMult * 0.5), isMiniBoss: true }), delay: 0 });
  }

  // Wave 25: iron golem champion (2× HP, mini-boss flag)
  if (w === 25) {
    queue.push({ def: makeScaledDef('iron_golem', { hp: Math.round(INVADER_DEFS['iron_golem'].hp * hpMult * 2), isMiniBoss: true }), delay: 0 });
  }

  // Wave 30: two elite void assassins
  if (w === 30) {
    const eliteDef = makeScaledDef('void_assassin', { hp: Math.round(INVADER_DEFS['void_assassin'].hp * hpMult * 0.75), isMiniBoss: true });
    queue.push({ def: eliteDef, delay: 0 });
    queue.push({ def: eliteDef, delay: 1200 });
  }

  // Wave 40: void assassin elite champion
  if (w === 40) {
    queue.push({ def: makeScaledDef('void_assassin_elite', { hp: Math.round(INVADER_DEFS['void_assassin_elite'].hp * hpMult * 1.8), isMiniBoss: true }), delay: 0 });
  }

  // Wave 50: titan sentinel champion
  if (w === 50) {
    queue.push({ def: makeScaledDef('titan_sentinel', { hp: Math.round(INVADER_DEFS['titan_sentinel'].hp * hpMult * 2), isMiniBoss: true }), delay: 0 });
  }

  // Wave 60: void colossus + titan sentinel pair
  if (w === 60) {
    queue.push({ def: makeScaledDef('void_colossus', { hp: Math.round(INVADER_DEFS['void_colossus'].hp * hpMult * 1.5), isMiniBoss: true }), delay: 0 });
    queue.push({ def: makeScaledDef('titan_sentinel', { hp: Math.round(INVADER_DEFS['titan_sentinel'].hp * hpMult * 1.5), isMiniBoss: true }), delay: 1500 });
  }

  // Wave 70: sky titan + radiant seraph elite pair
  if (w === 70) {
    queue.push({ def: makeScaledDef('sky_titan', { hp: Math.round(INVADER_DEFS['sky_titan'].hp * hpMult * 2), isMiniBoss: true }), delay: 0 });
    queue.push({ def: makeScaledDef('radiant_seraph', { hp: Math.round(INVADER_DEFS['radiant_seraph'].hp * hpMult * 1.8), isMiniBoss: true }), delay: 1500 });
  }

  // Wave 80: primordial_guard champion flanked by abyss_berserker pair
  if (w === 80) {
    queue.push({ def: makeScaledDef('abyss_berserker', { hp: Math.round(INVADER_DEFS['abyss_berserker'].hp * hpMult * 1.5), isMiniBoss: true }), delay: 0 });
    queue.push({ def: makeScaledDef('primordial_guard', { hp: Math.round(INVADER_DEFS['primordial_guard'].hp * hpMult * 2.5), isMiniBoss: true }), delay: 2000 });
    queue.push({ def: makeScaledDef('abyss_berserker', { hp: Math.round(INVADER_DEFS['abyss_berserker'].hp * hpMult * 1.5), isMiniBoss: true }), delay: 1500 });
  }

  // Wave 90: void_soldier surge + primordial_guard champion
  if (w === 90) {
    for (let i = 0; i < 3; i++) {
      queue.push({ def: makeScaledDef('void_soldier', { hp: Math.round(INVADER_DEFS['void_soldier'].hp * hpMult * 1.2) }), delay: 800 });
    }
    queue.push({ def: makeScaledDef('primordial_guard', { hp: Math.round(INVADER_DEFS['primordial_guard'].hp * hpMult * 3), isMiniBoss: true }), delay: 2500 });
  }

  // Wave 100+: primordial_guard + void_soldier elite wave every 10 levels after 90
  if (w > 90 && (w - 90) % 10 === 0) {
    queue.push({ def: makeScaledDef('primordial_guard', { hp: Math.round(INVADER_DEFS['primordial_guard'].hp * hpMult * 2), isMiniBoss: true }), delay: 0 });
    queue.push({ def: makeScaledDef('void_soldier',    { hp: Math.round(INVADER_DEFS['void_soldier'].hp    * hpMult * 1.5) }), delay: 1200 });
    queue.push({ def: makeScaledDef('abyss_berserker', { hp: Math.round(INVADER_DEFS['abyss_berserker'].hp * hpMult * 1.5) }), delay: 1200 });
  }

  // ── Standard fillers ───────────────────────────────────────────────────────
  // Weight selection toward newer (harder) types as wave increases.
  // Bias index: newer types in pool get higher probability with higher waves.
  for (let i = 0; i < baseCount; i++) {
    // Pick an index biased toward the upper end of the pool
    const bias    = Math.min(1, (w - 1) / 90 + mElite); // 0→1 over 90 waves (+ run elite bias)
    const raw     = Math.random();
    const biased  = Math.pow(raw, 1 - bias * 0.7); // skews toward higher indices
    const typeIdx = Math.floor(biased * pool.length);
    const type    = pool[Math.min(typeIdx, pool.length - 1)];
    queue.push({ def: makeScaledDef(type), delay: 1200 });
  }

  return queue;
}
