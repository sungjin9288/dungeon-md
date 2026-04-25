/**
 * Epilogue achievement definitions — post-game goals added alongside the
 * EQ-001~005 quest chain.  Kept in a separate file because achievementData.ts
 * is near the 800-line limit.
 *
 * Exported via the achievements.ts barrel (public API unchanged).
 */

import type { AchievementDef } from './achievementData';

export const EPILOGUE_ACHIEVEMENT_DEFS: AchievementDef[] = [
  // ── Gold ─────────────────────────────────────────────────────────────────────
  {
    id: 'gold_1000000',
    name: '황금의 전설',
    description: '누적 골드 1,000,000을 획득하세요.',
    icon: '💛',
    category: 'economy',
    target: 1_000_000,
    reward: { gems: 300, soulCrystals: 100 },
    getProgress: ctx => ctx.totalGoldEarned,
  },

  // ── Fusion ───────────────────────────────────────────────────────────────────
  {
    id: 'fusion_30',
    name: '합성의 달인',
    description: '몬스터 합성을 30회 이상 수행하세요.',
    icon: '🧬',
    category: 'collection',
    target: 30,
    reward: { gems: 60, soulCrystals: 30 },
    getProgress: ctx => ctx.totalFusions,
  },
  {
    id: 'fusion_50',
    name: '합성의 극의',
    description: '몬스터 합성을 50회 이상 수행하세요.',
    icon: '⚗️',
    category: 'collection',
    target: 50,
    reward: { gems: 120, soulCrystals: 60 },
    getProgress: ctx => ctx.totalFusions,
  },

  // ── DM Level ─────────────────────────────────────────────────────────────────
  {
    id: 'dm_lv25',
    name: '정예 던전 마스터',
    description: '던전 마스터 레벨 25를 달성하세요.',
    icon: '🔰',
    category: 'growth',
    target: 25,
    reward: { gems: 100, soulCrystals: 50 },
    getProgress: ctx => ctx.dmLevel,
  },
  {
    id: 'dm_lv30',
    name: '전설의 던전 마스터',
    description: '던전 마스터 레벨 30을 달성하세요.',
    icon: '👑',
    category: 'growth',
    target: 30,
    reward: { gems: 200, soulCrystals: 100 },
    getProgress: ctx => ctx.dmLevel,
  },
];
