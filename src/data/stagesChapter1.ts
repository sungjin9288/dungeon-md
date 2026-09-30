import type { InvaderType } from './invaders';
import type { VisitorKind } from './visitors';

export interface WaveSpec {
  wave?: number;
  /** `visitor` 없으면 토벌대(심장부로). 모험가·떠돌이 몬스터는 목적 방을 찾는다(visitors.ts). */
  invaders: Array<{ type: InvaderType; count: number; spawnDelay: number; isBoss?: boolean; visitor?: VisitorKind }>;
  clearReward?: number;
}

export interface StageConfig {
  id: number;
  chapter: number;
  koreanName?: string;
  waves: WaveSpec[];
  dungeonHp: number;
  gridCols?: number;   // Ch2 uses 4 columns (default 3 for Ch1)
  waterCells?: number[];   // flat indices of water-blocked cells (row*cols + col)
}

export const CHAPTER_1: StageConfig[] = [
  // Chapter 1 is fought by the home dungeon a brand-new player can have: the
  // three-room starting board with the starter roster at stage 1, four to six
  // level-1/2 rooms by stage 10. Soldiers are the first real test, shamans the
  // second, and knights stay boss-tier — they leak against these homes, so the
  // dungeon's HP is the lesson — until stage 8.
  //
  // The starting board is one row of three single-target rooms, so even
  // peasants slip past it one or two per wave (organic play-throughs, not the
  // simulation — which cannot see per-room throughput — set stages 1-3): short
  // waves, generous spacing, and 1500 HP to absorb the leaks. Guarded by
  // campaignPacing.test.ts and calibrated by scripts/verify-campaign-pacing.mjs.
  {
    id: 1, chapter: 1, koreanName: '버려진 던전', dungeonHp: 1500,
    waves: [
      { wave: 1, clearReward: 80,
        invaders: [{ type: 'peasant', count: 3, spawnDelay: 2400 }] },
      { wave: 2, clearReward: 100,
        invaders: [{ type: 'peasant', count: 3, spawnDelay: 2400 }] },
      { wave: 3, clearReward: 130,
        invaders: [{ type: 'peasant', count: 4, spawnDelay: 2400 }] },
      { wave: 4, clearReward: 160,
        invaders: [{ type: 'peasant', count: 4, spawnDelay: 2400 }] },
      { wave: 5, clearReward: 200,
        invaders: [{ type: 'peasant', count: 5, spawnDelay: 2400 }] },
      { wave: 6, clearReward: 500,
        invaders: [{ type: 'knight', count: 1, spawnDelay: 0, isBoss: true }, { type: 'peasant', count: 2, spawnDelay: 2400 }] },
    ],
  },
  {
    id: 2, chapter: 1, koreanName: '동굴 입구', dungeonHp: 1500,
    waves: [
      { wave: 1, clearReward: 70,
        invaders: [{ type: 'peasant', count: 4, spawnDelay: 2200 }] },
      { wave: 2, clearReward: 90,
        invaders: [{ type: 'peasant', count: 4, spawnDelay: 2200 }] },
      { wave: 3, clearReward: 110,
        invaders: [{ type: 'peasant', count: 5, spawnDelay: 2200 }] },
      { wave: 4, clearReward: 130,
        invaders: [{ type: 'peasant', count: 5, spawnDelay: 2200 }, { type: 'soldier', count: 1, spawnDelay: 2200 }] },
      { wave: 5, clearReward: 160,
        invaders: [{ type: 'peasant', count: 5, spawnDelay: 2200 }] },
      { wave: 6, clearReward: 190,
        invaders: [{ type: 'peasant', count: 6, spawnDelay: 2200 }, { type: 'soldier', count: 1, spawnDelay: 2200 }] },
      { wave: 7, clearReward: 230,
        invaders: [{ type: 'peasant', count: 6, spawnDelay: 2200 }, { type: 'shaman', count: 1, spawnDelay: 2200 }] },
      { wave: 8, clearReward: 550,
        invaders: [{ type: 'knight', count: 1, spawnDelay: 0, isBoss: true }, { type: 'peasant', count: 3, spawnDelay: 2200 }] },
    ],
  },
  {
    id: 3, chapter: 1, koreanName: '지하 통로', dungeonHp: 1600,
    waves: [
      { wave: 1, clearReward: 60,
        invaders: [{ type: 'peasant', count: 4, spawnDelay: 2100 }] },
      { wave: 2, clearReward: 85,
        invaders: [{ type: 'peasant', count: 5, spawnDelay: 2100 }] },
      { wave: 3, clearReward: 110,
        invaders: [{ type: 'peasant', count: 5, spawnDelay: 2100 }, { type: 'soldier', count: 1, spawnDelay: 2100 }] },
      { wave: 4, clearReward: 125,
        invaders: [{ type: 'peasant', count: 5, spawnDelay: 2100 }, { type: 'soldier', count: 1, spawnDelay: 2100 }] },
      { wave: 5, clearReward: 155,
        invaders: [{ type: 'peasant', count: 6, spawnDelay: 2100 }, { type: 'soldier', count: 1, spawnDelay: 2100 }] },
      { wave: 6, clearReward: 180,
        invaders: [{ type: 'peasant', count: 5, spawnDelay: 2100 }, { type: 'shaman', count: 1, spawnDelay: 2100 }] },
      { wave: 7, clearReward: 195,
        invaders: [{ type: 'peasant', count: 6, spawnDelay: 2100 }, { type: 'soldier', count: 2, spawnDelay: 2100 }] },
      { wave: 8, clearReward: 240,
        invaders: [{ type: 'peasant', count: 6, spawnDelay: 2100 }, { type: 'soldier', count: 1, spawnDelay: 2100 }, { type: 'shaman', count: 1, spawnDelay: 2100 }] },
      { wave: 9, clearReward: 580,
        invaders: [{ type: 'knight', count: 1, spawnDelay: 0, isBoss: true }, { type: 'soldier', count: 2, spawnDelay: 2100 }, { type: 'peasant', count: 3, spawnDelay: 2100 }] },
    ],
  },
  {
    id: 4, chapter: 1, koreanName: '도깨비 시장', dungeonHp: 1700,
    waves: [
      { wave: 1, clearReward: 65,
        invaders: [{ type: 'peasant', count: 5, spawnDelay: 2000 }] },
      { wave: 2, clearReward: 90,
        invaders: [{ type: 'peasant', count: 5, spawnDelay: 2000 }, { type: 'soldier', count: 1, spawnDelay: 2000 }] },
      { wave: 3, clearReward: 115,
        invaders: [{ type: 'peasant', count: 6, spawnDelay: 2000 }, { type: 'soldier', count: 1, spawnDelay: 2000 }] },
      { wave: 4, clearReward: 130,
        invaders: [{ type: 'peasant', count: 6, spawnDelay: 2000 }, { type: 'soldier', count: 1, spawnDelay: 2000 }] },
      { wave: 5, clearReward: 165,
        invaders: [{ type: 'peasant', count: 5, spawnDelay: 2000 }, { type: 'shaman', count: 1, spawnDelay: 2000 }] },
      { wave: 6, clearReward: 190,
        invaders: [{ type: 'peasant', count: 6, spawnDelay: 2000 }, { type: 'soldier', count: 2, spawnDelay: 2000 }] },
      { wave: 7, clearReward: 210,
        invaders: [{ type: 'peasant', count: 6, spawnDelay: 2000 }, { type: 'soldier', count: 1, spawnDelay: 2000 }, { type: 'shaman', count: 1, spawnDelay: 2000 }] },
      { wave: 8, clearReward: 260,
        invaders: [{ type: 'peasant', count: 6, spawnDelay: 2000 }, { type: 'soldier', count: 2, spawnDelay: 2000 }, { type: 'shaman', count: 1, spawnDelay: 2000 }] },
      { wave: 9, clearReward: 620,
        invaders: [{ type: 'knight', count: 1, spawnDelay: 0, isBoss: true }, { type: 'soldier', count: 2, spawnDelay: 2000 }, { type: 'peasant', count: 3, spawnDelay: 2000 }] },
    ],
  },
  {
    id: 5, chapter: 1, koreanName: '불의 시련', dungeonHp: 1800,
    waves: [
      { wave: 1, clearReward: 70,
        invaders: [{ type: 'peasant', count: 5, spawnDelay: 2000 }] },
      { wave: 2, clearReward: 95,
        invaders: [{ type: 'peasant', count: 6, spawnDelay: 2000 }, { type: 'soldier', count: 1, spawnDelay: 2000 }] },
      { wave: 3, clearReward: 120,
        invaders: [{ type: 'peasant', count: 6, spawnDelay: 2000 }, { type: 'soldier', count: 1, spawnDelay: 2000 }] },
      { wave: 4, clearReward: 140,
        invaders: [{ type: 'peasant', count: 6, spawnDelay: 2000 }, { type: 'soldier', count: 2, spawnDelay: 2000 }] },
      { wave: 5, clearReward: 175,
        invaders: [{ type: 'peasant', count: 6, spawnDelay: 2000 }, { type: 'soldier', count: 1, spawnDelay: 2000 }, { type: 'shaman', count: 1, spawnDelay: 2000 }] },
      { wave: 6, clearReward: 200,
        invaders: [{ type: 'peasant', count: 7, spawnDelay: 2000 }, { type: 'soldier', count: 2, spawnDelay: 2000 }] },
      { wave: 7, clearReward: 220,
        invaders: [{ type: 'peasant', count: 6, spawnDelay: 2000 }, { type: 'soldier', count: 2, spawnDelay: 2000 }, { type: 'shaman', count: 1, spawnDelay: 2000 }] },
      { wave: 8, clearReward: 270,
        invaders: [{ type: 'peasant', count: 7, spawnDelay: 2000 }, { type: 'soldier', count: 2, spawnDelay: 2000 }, { type: 'shaman', count: 1, spawnDelay: 2000 }] },
      { wave: 9, clearReward: 340,
        invaders: [{ type: 'peasant', count: 7, spawnDelay: 2000 }, { type: 'soldier', count: 3, spawnDelay: 2000 }] },
      { wave: 10, clearReward: 650,
        invaders: [{ type: 'knight', count: 1, spawnDelay: 0, isBoss: true }, { type: 'knight', count: 1, spawnDelay: 2000 }, { type: 'soldier', count: 2, spawnDelay: 2000 }] },
    ],
  },
  {
    id: 6, chapter: 1, koreanName: '얼음 감옥', dungeonHp: 1900,
    waves: [
      { wave: 1, clearReward: 75,
        invaders: [{ type: 'peasant', count: 6, spawnDelay: 1900 }, { type: 'soldier', count: 1, spawnDelay: 1900 }] },
      { wave: 2, clearReward: 100,
        invaders: [{ type: 'peasant', count: 6, spawnDelay: 1900 }, { type: 'soldier', count: 1, spawnDelay: 1900 }] },
      { wave: 3, clearReward: 125,
        invaders: [{ type: 'peasant', count: 6, spawnDelay: 1900 }, { type: 'soldier', count: 2, spawnDelay: 1900 }] },
      { wave: 4, clearReward: 145,
        invaders: [{ type: 'peasant', count: 6, spawnDelay: 1900 }, { type: 'soldier', count: 1, spawnDelay: 1900 }, { type: 'shaman', count: 1, spawnDelay: 1900 }] },
      { wave: 5, clearReward: 180,
        invaders: [{ type: 'peasant', count: 7, spawnDelay: 1900 }, { type: 'soldier', count: 2, spawnDelay: 1900 }] },
      { wave: 6, clearReward: 210,
        invaders: [{ type: 'peasant', count: 7, spawnDelay: 1900 }, { type: 'soldier', count: 2, spawnDelay: 1900 }, { type: 'shaman', count: 1, spawnDelay: 1900 }] },
      { wave: 7, clearReward: 230,
        invaders: [{ type: 'peasant', count: 7, spawnDelay: 1900 }, { type: 'soldier', count: 3, spawnDelay: 1900 }] },
      { wave: 8, clearReward: 280,
        invaders: [{ type: 'peasant', count: 7, spawnDelay: 1900 }, { type: 'soldier', count: 2, spawnDelay: 1900 }, { type: 'shaman', count: 2, spawnDelay: 1900 }] },
      { wave: 9, clearReward: 350,
        invaders: [{ type: 'peasant', count: 8, spawnDelay: 1900 }, { type: 'soldier', count: 3, spawnDelay: 1900 }, { type: 'shaman', count: 1, spawnDelay: 1900 }] },
      { wave: 10, clearReward: 680,
        invaders: [{ type: 'knight', count: 1, spawnDelay: 0, isBoss: true }, { type: 'knight', count: 1, spawnDelay: 1900 }, { type: 'soldier', count: 3, spawnDelay: 1900 }] },
    ],
  },
  {
    id: 7, chapter: 1, koreanName: '독의 늪', dungeonHp: 2000,
    waves: [
      { wave: 1, clearReward: 80,
        invaders: [{ type: 'peasant', count: 6, spawnDelay: 1900 }, { type: 'soldier', count: 1, spawnDelay: 1900 }] },
      { wave: 2, clearReward: 105,
        invaders: [{ type: 'peasant', count: 7, spawnDelay: 1900 }, { type: 'soldier', count: 1, spawnDelay: 1900 }] },
      { wave: 3, clearReward: 130,
        invaders: [{ type: 'peasant', count: 7, spawnDelay: 1900 }, { type: 'soldier', count: 2, spawnDelay: 1900 }] },
      { wave: 4, clearReward: 150,
        invaders: [{ type: 'peasant', count: 7, spawnDelay: 1900 }, { type: 'soldier', count: 2, spawnDelay: 1900 }, { type: 'shaman', count: 1, spawnDelay: 1900 }] },
      { wave: 5, clearReward: 190,
        invaders: [{ type: 'peasant', count: 7, spawnDelay: 1900 }, { type: 'soldier', count: 3, spawnDelay: 1900 }] },
      { wave: 6, clearReward: 220,
        invaders: [{ type: 'peasant', count: 8, spawnDelay: 1900 }, { type: 'soldier', count: 2, spawnDelay: 1900 }, { type: 'shaman', count: 1, spawnDelay: 1900 }] },
      { wave: 7, clearReward: 240,
        invaders: [{ type: 'peasant', count: 8, spawnDelay: 1900 }, { type: 'soldier', count: 3, spawnDelay: 1900 }, { type: 'shaman', count: 1, spawnDelay: 1900 }] },
      { wave: 8, clearReward: 290,
        invaders: [{ type: 'peasant', count: 8, spawnDelay: 1900 }, { type: 'soldier', count: 3, spawnDelay: 1900 }, { type: 'shaman', count: 2, spawnDelay: 1900 }] },
      { wave: 9, clearReward: 360,
        invaders: [{ type: 'peasant', count: 8, spawnDelay: 1900 }, { type: 'soldier', count: 4, spawnDelay: 1900 }, { type: 'shaman', count: 1, spawnDelay: 1900 }] },
      { wave: 10, clearReward: 700,
        invaders: [{ type: 'knight', count: 1, spawnDelay: 0, isBoss: true }, { type: 'knight', count: 1, spawnDelay: 1900 }, { type: 'soldier', count: 3, spawnDelay: 1900 }, { type: 'shaman', count: 1, spawnDelay: 1900 }] },
    ],
  },
  {
    id: 8, chapter: 1, koreanName: '무기고', dungeonHp: 2100,
    waves: [
      { wave: 1, clearReward: 85,
        invaders: [{ type: 'peasant', count: 7, spawnDelay: 1800 }, { type: 'soldier', count: 2, spawnDelay: 1800 }] },
      { wave: 2, clearReward: 110,
        invaders: [{ type: 'peasant', count: 7, spawnDelay: 1800 }, { type: 'soldier', count: 2, spawnDelay: 1800 }] },
      { wave: 3, clearReward: 140,
        invaders: [{ type: 'peasant', count: 8, spawnDelay: 1800 }, { type: 'soldier', count: 2, spawnDelay: 1800 }, { type: 'shaman', count: 1, spawnDelay: 1800 }] },
      { wave: 4, clearReward: 155,
        invaders: [{ type: 'knight', count: 1, spawnDelay: 1800 }, { type: 'peasant', count: 7, spawnDelay: 1800 }, { type: 'soldier', count: 2, spawnDelay: 1800 }] },
      { wave: 5, clearReward: 195,
        invaders: [{ type: 'peasant', count: 8, spawnDelay: 1800 }, { type: 'soldier', count: 3, spawnDelay: 1800 }, { type: 'shaman', count: 1, spawnDelay: 1800 }] },
      { wave: 6, clearReward: 225,
        invaders: [{ type: 'knight', count: 1, spawnDelay: 1800 }, { type: 'peasant', count: 7, spawnDelay: 1800 }, { type: 'soldier', count: 3, spawnDelay: 1800 }] },
      { wave: 7, clearReward: 250,
        invaders: [{ type: 'peasant', count: 8, spawnDelay: 1800 }, { type: 'soldier', count: 3, spawnDelay: 1800 }, { type: 'shaman', count: 2, spawnDelay: 1800 }] },
      { wave: 8, clearReward: 300,
        invaders: [{ type: 'knight', count: 1, spawnDelay: 1800 }, { type: 'soldier', count: 3, spawnDelay: 1800 }, { type: 'shaman', count: 1, spawnDelay: 1800 }] },
      { wave: 9, clearReward: 380,
        invaders: [{ type: 'peasant', count: 9, spawnDelay: 1800 }, { type: 'soldier', count: 4, spawnDelay: 1800 }, { type: 'shaman', count: 1, spawnDelay: 1800 }] },
      { wave: 10, clearReward: 730,
        invaders: [{ type: 'knight', count: 1, spawnDelay: 0, isBoss: true }, { type: 'knight', count: 1, spawnDelay: 1800 }, { type: 'soldier', count: 3, spawnDelay: 1800 }, { type: 'peasant', count: 3, spawnDelay: 1800 }] },
    ],
  },
  {
    id: 9, chapter: 1, koreanName: '왕의 방', dungeonHp: 2200,
    waves: [
      { wave: 1, clearReward: 90,
        invaders: [{ type: 'peasant', count: 7, spawnDelay: 1800 }, { type: 'soldier', count: 2, spawnDelay: 1800 }] },
      { wave: 2, clearReward: 120,
        invaders: [{ type: 'peasant', count: 8, spawnDelay: 1800 }, { type: 'soldier', count: 2, spawnDelay: 1800 }] },
      { wave: 3, clearReward: 145,
        invaders: [{ type: 'knight', count: 1, spawnDelay: 1800 }, { type: 'peasant', count: 7, spawnDelay: 1800 }, { type: 'soldier', count: 2, spawnDelay: 1800 }] },
      { wave: 4, clearReward: 165,
        invaders: [{ type: 'peasant', count: 8, spawnDelay: 1800 }, { type: 'soldier', count: 3, spawnDelay: 1800 }, { type: 'shaman', count: 1, spawnDelay: 1800 }] },
      { wave: 5, clearReward: 200,
        invaders: [{ type: 'knight', count: 1, spawnDelay: 1800 }, { type: 'peasant', count: 8, spawnDelay: 1800 }, { type: 'soldier', count: 2, spawnDelay: 1800 }] },
      { wave: 6, clearReward: 235,
        invaders: [{ type: 'peasant', count: 9, spawnDelay: 1800 }, { type: 'soldier', count: 3, spawnDelay: 1800 }, { type: 'shaman', count: 1, spawnDelay: 1800 }] },
      { wave: 7, clearReward: 260,
        invaders: [{ type: 'knight', count: 1, spawnDelay: 1800 }, { type: 'soldier', count: 3, spawnDelay: 1800 }, { type: 'shaman', count: 1, spawnDelay: 1800 }] },
      { wave: 8, clearReward: 310,
        invaders: [{ type: 'peasant', count: 9, spawnDelay: 1800 }, { type: 'soldier', count: 3, spawnDelay: 1800 }, { type: 'shaman', count: 2, spawnDelay: 1800 }] },
      { wave: 9, clearReward: 400,
        invaders: [{ type: 'knight', count: 2, spawnDelay: 1800 }, { type: 'soldier', count: 3, spawnDelay: 1800 }] },
      { wave: 10, clearReward: 750,
        invaders: [{ type: 'knight', count: 1, spawnDelay: 0, isBoss: true }, { type: 'knight', count: 2, spawnDelay: 1800 }, { type: 'soldier', count: 3, spawnDelay: 1800 }] },
    ],
  },
  {
    id: 10, chapter: 1, koreanName: '최종 결전', dungeonHp: 2400,
    waves: [
      { wave: 1, clearReward: 95,
        invaders: [{ type: 'peasant', count: 8, spawnDelay: 1800 }, { type: 'soldier', count: 2, spawnDelay: 1800 }] },
      { wave: 2, clearReward: 125,
        invaders: [{ type: 'knight', count: 1, spawnDelay: 1800 }, { type: 'peasant', count: 7, spawnDelay: 1800 }, { type: 'soldier', count: 2, spawnDelay: 1800 }] },
      { wave: 3, clearReward: 155,
        invaders: [{ type: 'peasant', count: 8, spawnDelay: 1800 }, { type: 'soldier', count: 3, spawnDelay: 1800 }, { type: 'shaman', count: 1, spawnDelay: 1800 }] },
      { wave: 4, clearReward: 175,
        invaders: [{ type: 'knight', count: 1, spawnDelay: 1800 }, { type: 'peasant', count: 8, spawnDelay: 1800 }, { type: 'soldier', count: 2, spawnDelay: 1800 }] },
      { wave: 5, clearReward: 210,
        invaders: [{ type: 'knight', count: 1, spawnDelay: 1800 }, { type: 'soldier', count: 3, spawnDelay: 1800 }, { type: 'shaman', count: 1, spawnDelay: 1800 }] },
      { wave: 6, clearReward: 245,
        invaders: [{ type: 'peasant', count: 9, spawnDelay: 1800 }, { type: 'soldier', count: 3, spawnDelay: 1800 }, { type: 'shaman', count: 2, spawnDelay: 1800 }] },
      { wave: 7, clearReward: 270,
        invaders: [{ type: 'knight', count: 2, spawnDelay: 1800 }, { type: 'soldier', count: 3, spawnDelay: 1800 }] },
      { wave: 8, clearReward: 320,
        invaders: [{ type: 'knight', count: 1, spawnDelay: 1800 }, { type: 'soldier', count: 4, spawnDelay: 1800 }, { type: 'shaman', count: 2, spawnDelay: 1800 }] },
      { wave: 9, clearReward: 420,
        invaders: [{ type: 'knight', count: 2, spawnDelay: 1800 }, { type: 'soldier', count: 3, spawnDelay: 1800 }, { type: 'shaman', count: 1, spawnDelay: 1800 }] },
      { wave: 10, clearReward: 800,
        invaders: [{ type: 'knight', count: 1, spawnDelay: 0, isBoss: true }, { type: 'knight', count: 2, spawnDelay: 1800 }, { type: 'soldier', count: 4, spawnDelay: 1800 }, { type: 'shaman', count: 1, spawnDelay: 1800 }] },
    ],
  },
];

