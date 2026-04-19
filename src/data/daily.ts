/**
 * Daily content system: Daily Dungeon, Weekly Boss, Daily Challenges.
 *
 * Uses date-seeded RNG (same pattern as ShopScene) for deterministic
 * daily content rotation.
 */

import type { ElementId } from './monsters';
import type { InvaderType } from './invaders';
import type { WaveSpec } from './stages';

// ─── Seeded RNG ────────────────────────────────────────────────────────────────

function getDayIndex(): number {
  return Math.floor(Date.now() / 86_400_000);
}

function getWeekIndex(): number {
  // Monday-based week number
  const d = new Date();
  const day = d.getUTCDay();
  const mondayOffset = (day + 6) % 7;
  const monday = new Date(d.getTime() - mondayOffset * 86_400_000);
  return Math.floor(monday.getTime() / (7 * 86_400_000));
}

function seededRand(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
}

function seededShuffle<T>(arr: T[], seed: number): T[] {
  const copy = [...arr];
  const rand = seededRand(seed);
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// ─── Daily Dungeon ─────────────────────────────────────────────────────────────

export type DailyRule = 'element_restrict' | 'gold_rush' | 'speed_run' | 'boss_rush';

export interface DailyDungeon {
  name:     string;
  rule:     DailyRule;
  elementRestrict?: ElementId;
  modifiers: {
    invaderSpeedMult: number;
    goldMult: number;
  };
  waves:    WaveSpec[];
  rewards:  { crystals: number; materials: string[] };
  dayIndex: number;
}

const DAILY_RULES: Array<{ rule: DailyRule; name: string; elementRestrict?: ElementId }> = [
  { rule: 'element_restrict', name: '화염 시련', elementRestrict: 'fire' },
  { rule: 'element_restrict', name: '빙결 감옥', elementRestrict: 'frost' },
  { rule: 'element_restrict', name: '뇌전 폭풍', elementRestrict: 'lightning' },
  { rule: 'element_restrict', name: '암흑 심연', elementRestrict: 'dark' },
  { rule: 'element_restrict', name: '신성 심판', elementRestrict: 'holy' },
  { rule: 'gold_rush',        name: '골드 러시' },
  { rule: 'speed_run',        name: '스피드 런' },
  { rule: 'boss_rush',        name: '보스 연전' },
];

function generateDailyWaves(seed: number, rule: DailyRule): WaveSpec[] {
  const rand = seededRand(seed);
  const waves: WaveSpec[] = [];

  const invaderPool: InvaderType[] = ['peasant', 'soldier', 'knight', 'shaman', 'berserker', 'shadow_ninja'];

  for (let w = 1; w <= 8; w++) {
    const count = Math.floor(4 + w * 1.5 + rand() * 3);
    const typeIdx = Math.floor(rand() * invaderPool.length);
    const type2Idx = Math.floor(rand() * invaderPool.length);

    const invaders: WaveSpec['invaders'] = [
      { type: invaderPool[typeIdx], count: Math.ceil(count * 0.6), spawnDelay: Math.floor(1800 - w * 100) },
    ];
    if (w >= 3) {
      invaders.push({
        type: invaderPool[type2Idx],
        count: Math.floor(count * 0.4),
        spawnDelay: Math.floor(1800 - w * 100),
      });
    }

    const reward = rule === 'gold_rush' ? Math.floor(100 + w * 30) : Math.floor(50 + w * 15);
    waves.push({ wave: w, clearReward: reward, invaders });
  }

  // Boss wave
  if (rule === 'boss_rush') {
    waves.push({
      wave: 9, clearReward: 300,
      invaders: [{ type: 'knight', count: 1, spawnDelay: 0, isBoss: true }],
    });
    waves.push({
      wave: 10, clearReward: 500,
      invaders: [{ type: 'knight', count: 1, spawnDelay: 0, isBoss: true }],
    });
  } else {
    waves.push({
      wave: 9, clearReward: 200,
      invaders: [
        { type: 'knight', count: 4, spawnDelay: 1000 },
        { type: 'shaman', count: 3, spawnDelay: 1000 },
      ],
    });
    waves.push({
      wave: 10, clearReward: 400,
      invaders: [{ type: 'knight', count: 1, spawnDelay: 0, isBoss: true }],
    });
  }

  return waves;
}

export function getDailyDungeon(): DailyDungeon {
  const day = getDayIndex();
  const shuffled = seededShuffle(DAILY_RULES, day);
  const picked = shuffled[0];

  const modifiers = {
    invaderSpeedMult: picked.rule === 'speed_run' ? 1.5 : 1.0,
    goldMult: picked.rule === 'gold_rush' ? 3.0 : 1.0,
  };

  return {
    name: picked.name,
    rule: picked.rule,
    elementRestrict: picked.elementRestrict,
    modifiers,
    waves: generateDailyWaves(day * 7 + 3, picked.rule),
    rewards: {
      crystals: picked.rule === 'boss_rush' ? 100 : 50,
      materials: ['common_ore', 'magic_dust'],
    },
    dayIndex: day,
  };
}

// ─── Weekly Boss ───────────────────────────────────────────────────────────────

export interface WeeklyBoss {
  name:         string;
  bossType:     InvaderType;
  totalHp:      number;
  phases:       number;
  rewards:      { legendaryMaterial: string; skinShards: number };
  weekIndex:    number;
}

const WEEKLY_BOSS_POOL: Array<{ name: string; bossType: InvaderType; hp: number }> = [
  { name: '용왕의 분노',     bossType: 'dragon_king',          hp: 50000 },
  { name: '여우 여왕의 귀환', bossType: 'fox_queen',           hp: 40000 },
  { name: '삼신 파괴자',     bossType: 'three_god_destroyer',  hp: 80000 },
  { name: '죽음의 사절',     bossType: 'death_emissary',       hp: 45000 },
];

export function getWeeklyBoss(): WeeklyBoss {
  const week = getWeekIndex();
  const idx = week % WEEKLY_BOSS_POOL.length;
  const boss = WEEKLY_BOSS_POOL[idx];

  return {
    name: boss.name,
    bossType: boss.bossType,
    totalHp: boss.hp,
    phases: 5,
    rewards: {
      legendaryMaterial: 'boss_essence',
      skinShards: 5,
    },
    weekIndex: week,
  };
}

// ─── Daily Challenges ──────────────────────────────────────────────────────────

export interface DailyChallenge {
  id:          string;
  description: string;
  objective:   {
    type:    'kill_count' | 'no_damage' | 'skill_use' | 'tribe_only' | 'wave_clear';
    target:  number;
    filter?: string;  // tribe name or skill id
  };
  reward: { gems?: number; xpBooks?: number };
}

const CHALLENGE_TEMPLATES: Omit<DailyChallenge, 'id'>[] = [
  {
    description: '침략자 50마리 처치',
    objective: { type: 'kill_count', target: 50 },
    reward: { gems: 20 },
  },
  {
    description: 'HP 손실 없이 웨이브 3개 클리어',
    objective: { type: 'no_damage', target: 3 },
    reward: { gems: 30 },
  },
  {
    description: '액티브 스킬 3회 사용',
    objective: { type: 'skill_use', target: 3 },
    reward: { gems: 15 },
  },
  {
    description: '액티브 스킬 5회 사용',
    objective: { type: 'skill_use', target: 5 },
    reward: { gems: 25 },
  },
  {
    description: '웨이브 5개 클리어',
    objective: { type: 'wave_clear', target: 5 },
    reward: { gems: 20 },
  },
  {
    description: '웨이브 10개 클리어',
    objective: { type: 'wave_clear', target: 10 },
    reward: { gems: 25 },
  },
  {
    description: '침략자 100마리 처치',
    objective: { type: 'kill_count', target: 100 },
    reward: { gems: 35 },
  },
  {
    description: '침략자 15마리 처치',
    objective: { type: 'kill_count', target: 15 },
    reward: { gems: 10 },
  },
];

export function getDailyChallenges(): DailyChallenge[] {
  const day = getDayIndex();
  const shuffled = seededShuffle(CHALLENGE_TEMPLATES, day + 100);
  return shuffled.slice(0, 3).map((tmpl, i) => ({
    id: `dc-${day}-${i}`,
    ...tmpl,
  }));
}

// ─── Daily challenge progress tracking ────────────────────────────────────────

import type { GameState } from './wisdom';

/**
 * Increment progress for all today's daily challenges of a given objective type.
 * Mutates gs (caller must saveGameState).
 * Returns array of challenge IDs that just completed.
 */
export function tickDailyChallenge(
  gs: GameState,
  type: DailyChallenge['objective']['type'],
  amount = 1,
  filter?: string,
): GameState {
  const today = getTodayString();
  // Reset if it's a new day
  const prevChallenges = gs.dailyChallengeDate !== today ? {} : { ...(gs.dailyChallenges ?? {}) };

  const challenges = getDailyChallenges();
  const updatedChallenges = { ...prevChallenges };
  let newGems = gs.gems ?? 0;

  for (const ch of challenges) {
    if (ch.objective.type !== type) continue;
    if (filter !== undefined && ch.objective.filter !== filter) continue;

    const prev = prevChallenges[ch.id] ?? { completed: false, progress: 0 };
    if (prev.completed) continue;

    const newProgress  = Math.min(prev.progress + amount, ch.objective.target);
    const newCompleted = newProgress >= ch.objective.target;
    if (newCompleted && ch.reward.gems) newGems += ch.reward.gems;
    updatedChallenges[ch.id] = { completed: newCompleted, progress: newProgress };
  }

  return {
    ...gs,
    gems:               newGems,
    dailyChallenges:    updatedChallenges,
    dailyChallengeDate: today,
  };
}

// ─── Date helpers ──────────────────────────────────────────────────────────────

export function getTodayString(): string {
  return new Date().toISOString().slice(0, 10);
}

export function getThisWeekMonday(): string {
  const d = new Date();
  const day = d.getUTCDay();
  const diff = (day + 6) % 7;
  d.setUTCDate(d.getUTCDate() - diff);
  return d.toISOString().slice(0, 10);
}
