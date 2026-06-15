import type { StageConfig } from './stagesChapter1';

export const CHAPTER_4: StageConfig[] = [
  // Stage 33 — ch4 intro
  {
    id: 33, chapter: 4, koreanName: '환상의 문', gridCols: 4, startGold: 700, dungeonHp: 2500,
    waves: [
      { wave: 1,  clearReward: 160,  invaders: [{ type: 'soldier', count: 7, spawnDelay: 1600 }] },
      { wave: 2,  clearReward: 185,  invaders: [{ type: 'venom_dancer', count: 7, spawnDelay: 1600 }] },
      { wave: 3,  clearReward: 210,  invaders: [{ type: 'undying_knight', count: 2, spawnDelay: 1400 }, { type: 'void_assassin', count: 6, spawnDelay: 1400 }] },
      { wave: 4,  clearReward: 240,  invaders: [{ type: 'void_assassin_elite', count: 1, spawnDelay: 1400 }, { type: 'undying_knight', count: 2, spawnDelay: 1400 }, { type: 'scarecrow_mage', count: 5, spawnDelay: 1400 }] },
      { wave: 5,  clearReward: 270,  invaders: [{ type: 'void_assassin_elite', count: 1, spawnDelay: 1300 }, { type: 'undying_knight', count: 2, spawnDelay: 1300 }, { type: 'venom_dancer', count: 2, spawnDelay: 1300 }, { type: 'soldier', count: 4, spawnDelay: 1300 }] },
      { wave: 6,  clearReward: 305,  invaders: [{ type: 'void_assassin_elite', count: 1, spawnDelay: 1300 }, { type: 'undying_knight', count: 2, spawnDelay: 1300 }, { type: 'void_assassin', count: 2, spawnDelay: 1300 }, { type: 'venom_dancer', count: 4, spawnDelay: 1300 }] },
      { wave: 7,  clearReward: 345,  invaders: [{ type: 'void_assassin_elite', count: 1, spawnDelay: 1200 }, { type: 'undying_knight', count: 2, spawnDelay: 1200 }, { type: 'venom_dancer', count: 2, spawnDelay: 1200 }, { type: 'void_assassin', count: 4, spawnDelay: 1200 }] },
      { wave: 8,  clearReward: 395,  invaders: [{ type: 'void_assassin_elite', count: 1, spawnDelay: 1150 }, { type: 'undying_knight', count: 2, spawnDelay: 1150 }, { type: 'void_assassin', count: 3, spawnDelay: 1150 }, { type: 'scarecrow_mage', count: 4, spawnDelay: 1150 }] },
      { wave: 9,  clearReward: 480,  invaders: [{ type: 'void_assassin_elite', count: 1, spawnDelay: 1100 }, { type: 'undying_knight', count: 2, spawnDelay: 1100 }, { type: 'venom_dancer', count: 3, spawnDelay: 1100 }, { type: 'soldier', count: 4, spawnDelay: 1100 }] },
      { wave: 10, clearReward: 1800, invaders: [{ type: 'void_assassin_elite', count: 1, spawnDelay: 1300 }, { type: 'undying_knight', count: 2, spawnDelay: 1300 }, { type: 'scarecrow_mage', count: 5, spawnDelay: 1300 }] },
    ],
  },
  // Stage 34 — three-legged crow intro
  {
    id: 34, chapter: 4, koreanName: '삼족오의 춤', gridCols: 4, startGold: 720, dungeonHp: 2600,
    waves: [
      { wave: 1,  clearReward: 170,  invaders: [{ type: 'venom_dancer', count: 7, spawnDelay: 1600 }] },
      { wave: 2,  clearReward: 195,  invaders: [{ type: 'void_assassin', count: 7, spawnDelay: 1600 }] },
      { wave: 3,  clearReward: 220,  invaders: [{ type: 'undying_knight', count: 2, spawnDelay: 1400 }, { type: 'scarecrow_mage', count: 6, spawnDelay: 1400 }] },
      { wave: 4,  clearReward: 250,  invaders: [{ type: 'void_assassin_elite', count: 1, spawnDelay: 1400 }, { type: 'undying_knight', count: 2, spawnDelay: 1400 }, { type: 'soldier', count: 5, spawnDelay: 1400 }] },
      { wave: 5,  clearReward: 280,  invaders: [{ type: 'void_assassin_elite', count: 1, spawnDelay: 1300 }, { type: 'undying_knight', count: 2, spawnDelay: 1300 }, { type: 'void_assassin', count: 2, spawnDelay: 1300 }, { type: 'venom_dancer', count: 4, spawnDelay: 1300 }] },
      { wave: 6,  clearReward: 315,  invaders: [{ type: 'void_assassin_elite', count: 1, spawnDelay: 1300 }, { type: 'undying_knight', count: 2, spawnDelay: 1300 }, { type: 'venom_dancer', count: 2, spawnDelay: 1300 }, { type: 'void_assassin', count: 4, spawnDelay: 1300 }] },
      { wave: 7,  clearReward: 355,  invaders: [{ type: 'void_assassin_elite', count: 1, spawnDelay: 1200 }, { type: 'undying_knight', count: 2, spawnDelay: 1200 }, { type: 'void_assassin', count: 2, spawnDelay: 1200 }, { type: 'scarecrow_mage', count: 4, spawnDelay: 1200 }] },
      { wave: 8,  clearReward: 405,  invaders: [{ type: 'void_assassin_elite', count: 1, spawnDelay: 1150 }, { type: 'undying_knight', count: 2, spawnDelay: 1150 }, { type: 'venom_dancer', count: 3, spawnDelay: 1150 }, { type: 'soldier', count: 4, spawnDelay: 1150 }] },
      { wave: 9,  clearReward: 490,  invaders: [{ type: 'void_assassin_elite', count: 1, spawnDelay: 1100 }, { type: 'undying_knight', count: 2, spawnDelay: 1100 }, { type: 'void_assassin', count: 3, spawnDelay: 1100 }, { type: 'venom_dancer', count: 4, spawnDelay: 1100 }] },
      { wave: 10, clearReward: 1900, invaders: [{ type: 'void_assassin_elite', count: 1, spawnDelay: 1300 }, { type: 'undying_knight', count: 2, spawnDelay: 1300 }, { type: 'soldier', count: 5, spawnDelay: 1300 }] },
    ],
  },
  // Stage 35 — scarecrow mage groups
  {
    id: 35, chapter: 4, koreanName: '허수아비 무리', gridCols: 4, startGold: 740, dungeonHp: 2700,
    waves: [
      { wave: 1,  clearReward: 180,  invaders: [{ type: 'void_assassin', count: 7, spawnDelay: 1600 }] },
      { wave: 2,  clearReward: 205,  invaders: [{ type: 'scarecrow_mage', count: 7, spawnDelay: 1600 }] },
      { wave: 3,  clearReward: 230,  invaders: [{ type: 'undying_knight', count: 2, spawnDelay: 1400 }, { type: 'soldier', count: 6, spawnDelay: 1400 }] },
      { wave: 4,  clearReward: 260,  invaders: [{ type: 'void_assassin_elite', count: 1, spawnDelay: 1400 }, { type: 'undying_knight', count: 2, spawnDelay: 1400 }, { type: 'venom_dancer', count: 5, spawnDelay: 1400 }] },
      { wave: 5,  clearReward: 290,  invaders: [{ type: 'void_assassin_elite', count: 1, spawnDelay: 1300 }, { type: 'undying_knight', count: 2, spawnDelay: 1300 }, { type: 'venom_dancer', count: 2, spawnDelay: 1300 }, { type: 'void_assassin', count: 4, spawnDelay: 1300 }] },
      { wave: 6,  clearReward: 325,  invaders: [{ type: 'void_assassin_elite', count: 1, spawnDelay: 1300 }, { type: 'undying_knight', count: 2, spawnDelay: 1300 }, { type: 'void_assassin', count: 2, spawnDelay: 1300 }, { type: 'scarecrow_mage', count: 4, spawnDelay: 1300 }] },
      { wave: 7,  clearReward: 370,  invaders: [{ type: 'void_assassin_elite', count: 1, spawnDelay: 1200 }, { type: 'undying_knight', count: 2, spawnDelay: 1200 }, { type: 'venom_dancer', count: 2, spawnDelay: 1200 }, { type: 'soldier', count: 4, spawnDelay: 1200 }] },
      { wave: 8,  clearReward: 420,  invaders: [{ type: 'void_assassin_elite', count: 1, spawnDelay: 1150 }, { type: 'undying_knight', count: 2, spawnDelay: 1150 }, { type: 'void_assassin', count: 3, spawnDelay: 1150 }, { type: 'venom_dancer', count: 4, spawnDelay: 1150 }] },
      { wave: 9,  clearReward: 510,  invaders: [{ type: 'void_assassin_elite', count: 1, spawnDelay: 1100 }, { type: 'undying_knight', count: 2, spawnDelay: 1100 }, { type: 'venom_dancer', count: 3, spawnDelay: 1100 }, { type: 'void_assassin', count: 4, spawnDelay: 1100 }] },
      { wave: 10, clearReward: 2000, invaders: [{ type: 'void_assassin_elite', count: 1, spawnDelay: 1300 }, { type: 'undying_knight', count: 2, spawnDelay: 1300 }, { type: 'venom_dancer', count: 5, spawnDelay: 1300 }] },
    ],
  },
  // Stage 36 — spirit altar + great serpent intro
  {
    id: 36, chapter: 4, koreanName: '구렁이의 영역', gridCols: 4, startGold: 760, dungeonHp: 2800,
    waves: [
      { wave: 1,  clearReward: 190,  invaders: [{ type: 'scarecrow_mage', count: 7, spawnDelay: 1600 }] },
      { wave: 2,  clearReward: 215,  invaders: [{ type: 'soldier', count: 7, spawnDelay: 1600 }] },
      { wave: 3,  clearReward: 240,  invaders: [{ type: 'undying_knight', count: 2, spawnDelay: 1400 }, { type: 'venom_dancer', count: 6, spawnDelay: 1400 }] },
      { wave: 4,  clearReward: 270,  invaders: [{ type: 'void_assassin_elite', count: 1, spawnDelay: 1400 }, { type: 'undying_knight', count: 2, spawnDelay: 1400 }, { type: 'void_assassin', count: 5, spawnDelay: 1400 }] },
      { wave: 5,  clearReward: 305,  invaders: [{ type: 'void_assassin_elite', count: 1, spawnDelay: 1300 }, { type: 'undying_knight', count: 2, spawnDelay: 1300 }, { type: 'void_assassin', count: 2, spawnDelay: 1300 }, { type: 'scarecrow_mage', count: 4, spawnDelay: 1300 }] },
      { wave: 6,  clearReward: 340,  invaders: [{ type: 'void_assassin_elite', count: 1, spawnDelay: 1300 }, { type: 'undying_knight', count: 2, spawnDelay: 1300 }, { type: 'venom_dancer', count: 2, spawnDelay: 1300 }, { type: 'soldier', count: 4, spawnDelay: 1300 }] },
      { wave: 7,  clearReward: 385,  invaders: [{ type: 'void_assassin_elite', count: 1, spawnDelay: 1200 }, { type: 'undying_knight', count: 2, spawnDelay: 1200 }, { type: 'void_assassin', count: 2, spawnDelay: 1200 }, { type: 'venom_dancer', count: 4, spawnDelay: 1200 }] },
      { wave: 8,  clearReward: 435,  invaders: [{ type: 'void_assassin_elite', count: 1, spawnDelay: 1150 }, { type: 'undying_knight', count: 2, spawnDelay: 1150 }, { type: 'venom_dancer', count: 3, spawnDelay: 1150 }, { type: 'void_assassin', count: 4, spawnDelay: 1150 }] },
      { wave: 9,  clearReward: 520,  invaders: [{ type: 'void_assassin_elite', count: 1, spawnDelay: 1100 }, { type: 'undying_knight', count: 2, spawnDelay: 1100 }, { type: 'void_assassin', count: 3, spawnDelay: 1100 }, { type: 'scarecrow_mage', count: 4, spawnDelay: 1100 }] },
      { wave: 10, clearReward: 2100, invaders: [{ type: 'void_assassin_elite', count: 1, spawnDelay: 1300 }, { type: 'undying_knight', count: 2, spawnDelay: 1300 }, { type: 'void_assassin', count: 5, spawnDelay: 1300 }] },
    ],
  },
  // Stage 37 — undying knight + high priest combos
  {
    id: 37, chapter: 4, koreanName: '불사의 기사', gridCols: 4, startGold: 780, dungeonHp: 2900,
    waves: [
      { wave: 1,  clearReward: 200,  invaders: [{ type: 'soldier', count: 8, spawnDelay: 1600 }] },
      { wave: 2,  clearReward: 225,  invaders: [{ type: 'venom_dancer', count: 8, spawnDelay: 1600 }] },
      { wave: 3,  clearReward: 250,  invaders: [{ type: 'undying_knight', count: 2, spawnDelay: 1400 }, { type: 'void_assassin', count: 7, spawnDelay: 1400 }] },
      { wave: 4,  clearReward: 280,  invaders: [{ type: 'void_assassin_elite', count: 1, spawnDelay: 1400 }, { type: 'undying_knight', count: 2, spawnDelay: 1400 }, { type: 'scarecrow_mage', count: 6, spawnDelay: 1400 }] },
      { wave: 5,  clearReward: 315,  invaders: [{ type: 'void_assassin_elite', count: 1, spawnDelay: 1300 }, { type: 'undying_knight', count: 2, spawnDelay: 1300 }, { type: 'venom_dancer', count: 3, spawnDelay: 1300 }, { type: 'soldier', count: 4, spawnDelay: 1300 }] },
      { wave: 6,  clearReward: 355,  invaders: [{ type: 'void_assassin_elite', count: 1, spawnDelay: 1300 }, { type: 'undying_knight', count: 2, spawnDelay: 1300 }, { type: 'void_assassin', count: 3, spawnDelay: 1300 }, { type: 'venom_dancer', count: 4, spawnDelay: 1300 }] },
      { wave: 7,  clearReward: 400,  invaders: [{ type: 'void_assassin_elite', count: 1, spawnDelay: 1200 }, { type: 'undying_knight', count: 2, spawnDelay: 1200 }, { type: 'venom_dancer', count: 3, spawnDelay: 1200 }, { type: 'void_assassin', count: 4, spawnDelay: 1200 }] },
      { wave: 8,  clearReward: 450,  invaders: [{ type: 'void_assassin_elite', count: 1, spawnDelay: 1150 }, { type: 'undying_knight', count: 2, spawnDelay: 1150 }, { type: 'void_assassin', count: 4, spawnDelay: 1150 }, { type: 'scarecrow_mage', count: 4, spawnDelay: 1150 }] },
      { wave: 9,  clearReward: 540,  invaders: [{ type: 'void_assassin_elite', count: 1, spawnDelay: 1100 }, { type: 'undying_knight', count: 2, spawnDelay: 1100 }, { type: 'venom_dancer', count: 4, spawnDelay: 1100 }, { type: 'soldier', count: 4, spawnDelay: 1100 }] },
      { wave: 10, clearReward: 2200, invaders: [{ type: 'void_assassin_elite', count: 1, spawnDelay: 1300 }, { type: 'undying_knight', count: 2, spawnDelay: 1300 }, { type: 'scarecrow_mage', count: 5, spawnDelay: 1300 }] },
    ],
  },
  // Stage 38 — moon rabbit + dragons lair intro
  {
    id: 38, chapter: 4, koreanName: '용의 소굴', gridCols: 4, startGold: 800, dungeonHp: 3000,
    waves: [
      { wave: 1,  clearReward: 210,  invaders: [{ type: 'venom_dancer', count: 8, spawnDelay: 1600 }] },
      { wave: 2,  clearReward: 235,  invaders: [{ type: 'void_assassin', count: 8, spawnDelay: 1600 }] },
      { wave: 3,  clearReward: 260,  invaders: [{ type: 'undying_knight', count: 3, spawnDelay: 1400 }, { type: 'scarecrow_mage', count: 6, spawnDelay: 1400 }] },
      { wave: 4,  clearReward: 295,  invaders: [{ type: 'void_assassin_elite', count: 1, spawnDelay: 1400 }, { type: 'undying_knight', count: 3, spawnDelay: 1400 }, { type: 'soldier', count: 5, spawnDelay: 1400 }] },
      { wave: 5,  clearReward: 330,  invaders: [{ type: 'void_assassin_elite', count: 1, spawnDelay: 1300 }, { type: 'undying_knight', count: 3, spawnDelay: 1300 }, { type: 'void_assassin', count: 2, spawnDelay: 1300 }, { type: 'venom_dancer', count: 4, spawnDelay: 1300 }] },
      { wave: 6,  clearReward: 370,  invaders: [{ type: 'void_assassin_elite', count: 1, spawnDelay: 1300 }, { type: 'undying_knight', count: 3, spawnDelay: 1300 }, { type: 'venom_dancer', count: 2, spawnDelay: 1300 }, { type: 'void_assassin', count: 4, spawnDelay: 1300 }] },
      { wave: 7,  clearReward: 415,  invaders: [{ type: 'void_assassin_elite', count: 1, spawnDelay: 1200 }, { type: 'undying_knight', count: 3, spawnDelay: 1200 }, { type: 'void_assassin', count: 2, spawnDelay: 1200 }, { type: 'scarecrow_mage', count: 4, spawnDelay: 1200 }] },
      { wave: 8,  clearReward: 465,  invaders: [{ type: 'void_assassin_elite', count: 2, spawnDelay: 1150 }, { type: 'undying_knight', count: 2, spawnDelay: 1150 }, { type: 'venom_dancer', count: 3, spawnDelay: 1150 }, { type: 'soldier', count: 4, spawnDelay: 1150 }] },
      { wave: 9,  clearReward: 555,  invaders: [{ type: 'void_assassin_elite', count: 2, spawnDelay: 1100 }, { type: 'undying_knight', count: 2, spawnDelay: 1100 }, { type: 'void_assassin', count: 3, spawnDelay: 1100 }, { type: 'venom_dancer', count: 4, spawnDelay: 1100 }] },
      { wave: 10, clearReward: 2300, invaders: [{ type: 'void_assassin_elite', count: 2, spawnDelay: 1300 }, { type: 'undying_knight', count: 2, spawnDelay: 1300 }, { type: 'soldier', count: 5, spawnDelay: 1300 }] },
    ],
  },
  // Stage 39 — venom dancer wide trail
  {
    id: 39, chapter: 4, koreanName: '독무의 행렬', gridCols: 4, startGold: 820, dungeonHp: 3100,
    waves: [
      { wave: 1,  clearReward: 220,  invaders: [{ type: 'void_assassin', count: 8, spawnDelay: 1600 }] },
      { wave: 2,  clearReward: 245,  invaders: [{ type: 'scarecrow_mage', count: 8, spawnDelay: 1600 }] },
      { wave: 3,  clearReward: 275,  invaders: [{ type: 'undying_knight', count: 3, spawnDelay: 1400 }, { type: 'soldier', count: 6, spawnDelay: 1400 }] },
      { wave: 4,  clearReward: 310,  invaders: [{ type: 'void_assassin_elite', count: 1, spawnDelay: 1400 }, { type: 'undying_knight', count: 3, spawnDelay: 1400 }, { type: 'venom_dancer', count: 5, spawnDelay: 1400 }] },
      { wave: 5,  clearReward: 345,  invaders: [{ type: 'void_assassin_elite', count: 1, spawnDelay: 1300 }, { type: 'undying_knight', count: 3, spawnDelay: 1300 }, { type: 'venom_dancer', count: 2, spawnDelay: 1300 }, { type: 'void_assassin', count: 4, spawnDelay: 1300 }] },
      { wave: 6,  clearReward: 385,  invaders: [{ type: 'void_assassin_elite', count: 1, spawnDelay: 1300 }, { type: 'undying_knight', count: 3, spawnDelay: 1300 }, { type: 'void_assassin', count: 2, spawnDelay: 1300 }, { type: 'scarecrow_mage', count: 4, spawnDelay: 1300 }] },
      { wave: 7,  clearReward: 435,  invaders: [{ type: 'void_assassin_elite', count: 1, spawnDelay: 1200 }, { type: 'undying_knight', count: 3, spawnDelay: 1200 }, { type: 'venom_dancer', count: 2, spawnDelay: 1200 }, { type: 'soldier', count: 4, spawnDelay: 1200 }] },
      { wave: 8,  clearReward: 480,  invaders: [{ type: 'void_assassin_elite', count: 2, spawnDelay: 1150 }, { type: 'undying_knight', count: 2, spawnDelay: 1150 }, { type: 'void_assassin', count: 3, spawnDelay: 1150 }, { type: 'venom_dancer', count: 4, spawnDelay: 1150 }] },
      { wave: 9,  clearReward: 570,  invaders: [{ type: 'void_assassin_elite', count: 2, spawnDelay: 1100 }, { type: 'undying_knight', count: 2, spawnDelay: 1100 }, { type: 'venom_dancer', count: 3, spawnDelay: 1100 }, { type: 'void_assassin', count: 4, spawnDelay: 1100 }] },
      { wave: 10, clearReward: 2400, invaders: [{ type: 'void_assassin_elite', count: 2, spawnDelay: 1300 }, { type: 'undying_knight', count: 2, spawnDelay: 1300 }, { type: 'venom_dancer', count: 5, spawnDelay: 1300 }] },
    ],
  },
  // Stage 40 — elite all-types mix
  {
    id: 40, chapter: 4, koreanName: '정예 혼성부대', gridCols: 4, startGold: 840, dungeonHp: 3200,
    waves: [
      { wave: 1,  clearReward: 230,  invaders: [{ type: 'scarecrow_mage', count: 8, spawnDelay: 1600 }] },
      { wave: 2,  clearReward: 260,  invaders: [{ type: 'soldier', count: 8, spawnDelay: 1600 }] },
      { wave: 3,  clearReward: 290,  invaders: [{ type: 'undying_knight', count: 3, spawnDelay: 1400 }, { type: 'venom_dancer', count: 6, spawnDelay: 1400 }] },
      { wave: 4,  clearReward: 325,  invaders: [{ type: 'void_assassin_elite', count: 1, spawnDelay: 1400 }, { type: 'undying_knight', count: 3, spawnDelay: 1400 }, { type: 'void_assassin', count: 5, spawnDelay: 1400 }] },
      { wave: 5,  clearReward: 360,  invaders: [{ type: 'void_assassin_elite', count: 1, spawnDelay: 1300 }, { type: 'undying_knight', count: 3, spawnDelay: 1300 }, { type: 'void_assassin', count: 2, spawnDelay: 1300 }, { type: 'scarecrow_mage', count: 4, spawnDelay: 1300 }] },
      { wave: 6,  clearReward: 400,  invaders: [{ type: 'void_assassin_elite', count: 1, spawnDelay: 1300 }, { type: 'undying_knight', count: 3, spawnDelay: 1300 }, { type: 'venom_dancer', count: 2, spawnDelay: 1300 }, { type: 'soldier', count: 4, spawnDelay: 1300 }] },
      { wave: 7,  clearReward: 450,  invaders: [{ type: 'void_assassin_elite', count: 1, spawnDelay: 1200 }, { type: 'undying_knight', count: 3, spawnDelay: 1200 }, { type: 'void_assassin', count: 2, spawnDelay: 1200 }, { type: 'venom_dancer', count: 4, spawnDelay: 1200 }] },
      { wave: 8,  clearReward: 500,  invaders: [{ type: 'void_assassin_elite', count: 2, spawnDelay: 1150 }, { type: 'undying_knight', count: 2, spawnDelay: 1150 }, { type: 'venom_dancer', count: 3, spawnDelay: 1150 }, { type: 'void_assassin', count: 4, spawnDelay: 1150 }] },
      { wave: 9,  clearReward: 590,  invaders: [{ type: 'void_assassin_elite', count: 2, spawnDelay: 1100 }, { type: 'undying_knight', count: 2, spawnDelay: 1100 }, { type: 'void_assassin', count: 3, spawnDelay: 1100 }, { type: 'scarecrow_mage', count: 4, spawnDelay: 1100 }] },
      { wave: 10, clearReward: 2500, invaders: [{ type: 'void_assassin_elite', count: 2, spawnDelay: 1300 }, { type: 'undying_knight', count: 2, spawnDelay: 1300 }, { type: 'void_assassin', count: 5, spawnDelay: 1300 }] },
    ],
  },
  // Stage 41 — survival (no gold vein, pure placement test)
  {
    id: 41, chapter: 4, koreanName: '황금 없는 시련', gridCols: 4, startGold: 860, dungeonHp: 3300,
    waves: [
      { wave: 1,  clearReward: 240,  invaders: [{ type: 'soldier', count: 9, spawnDelay: 1600 }] },
      { wave: 2,  clearReward: 270,  invaders: [{ type: 'venom_dancer', count: 9, spawnDelay: 1600 }] },
      { wave: 3,  clearReward: 300,  invaders: [{ type: 'undying_knight', count: 3, spawnDelay: 1400 }, { type: 'void_assassin', count: 7, spawnDelay: 1400 }] },
      { wave: 4,  clearReward: 335,  invaders: [{ type: 'void_assassin_elite', count: 1, spawnDelay: 1400 }, { type: 'undying_knight', count: 3, spawnDelay: 1400 }, { type: 'scarecrow_mage', count: 6, spawnDelay: 1400 }] },
      { wave: 5,  clearReward: 375,  invaders: [{ type: 'void_assassin_elite', count: 1, spawnDelay: 1300 }, { type: 'undying_knight', count: 3, spawnDelay: 1300 }, { type: 'venom_dancer', count: 3, spawnDelay: 1300 }, { type: 'soldier', count: 4, spawnDelay: 1300 }] },
      { wave: 6,  clearReward: 415,  invaders: [{ type: 'void_assassin_elite', count: 1, spawnDelay: 1300 }, { type: 'undying_knight', count: 3, spawnDelay: 1300 }, { type: 'void_assassin', count: 3, spawnDelay: 1300 }, { type: 'venom_dancer', count: 4, spawnDelay: 1300 }] },
      { wave: 7,  clearReward: 465,  invaders: [{ type: 'void_assassin_elite', count: 1, spawnDelay: 1200 }, { type: 'undying_knight', count: 3, spawnDelay: 1200 }, { type: 'venom_dancer', count: 3, spawnDelay: 1200 }, { type: 'void_assassin', count: 4, spawnDelay: 1200 }] },
      { wave: 8,  clearReward: 515,  invaders: [{ type: 'void_assassin_elite', count: 2, spawnDelay: 1150 }, { type: 'undying_knight', count: 2, spawnDelay: 1150 }, { type: 'void_assassin', count: 4, spawnDelay: 1150 }, { type: 'scarecrow_mage', count: 4, spawnDelay: 1150 }] },
      { wave: 9,  clearReward: 610,  invaders: [{ type: 'void_assassin_elite', count: 2, spawnDelay: 1100 }, { type: 'undying_knight', count: 2, spawnDelay: 1100 }, { type: 'venom_dancer', count: 4, spawnDelay: 1100 }, { type: 'soldier', count: 4, spawnDelay: 1100 }] },
      { wave: 10, clearReward: 2600, invaders: [{ type: 'void_assassin_elite', count: 2, spawnDelay: 1300 }, { type: 'undying_knight', count: 2, spawnDelay: 1300 }, { type: 'scarecrow_mage', count: 5, spawnDelay: 1300 }] },
    ],
  },
  // Stage 42 — BOSS: 저승왕 사자
  {
    id: 42, chapter: 4, koreanName: '저승왕 사자', gridCols: 4, startGold: 900, dungeonHp: 3500,
    waves: [
      { wave: 1,  clearReward: 250,  invaders: [{ type: 'venom_dancer', count: 9, spawnDelay: 1600 }] },
      { wave: 2,  clearReward: 280,  invaders: [{ type: 'void_assassin', count: 9, spawnDelay: 1600 }] },
      { wave: 3,  clearReward: 315,  invaders: [{ type: 'undying_knight', count: 3, spawnDelay: 1400 }, { type: 'scarecrow_mage', count: 7, spawnDelay: 1400 }] },
      { wave: 4,  clearReward: 350,  invaders: [{ type: 'void_assassin_elite', count: 1, spawnDelay: 1400 }, { type: 'undying_knight', count: 3, spawnDelay: 1400 }, { type: 'soldier', count: 6, spawnDelay: 1400 }] },
      { wave: 5,  clearReward: 390,  invaders: [{ type: 'void_assassin_elite', count: 1, spawnDelay: 1300 }, { type: 'undying_knight', count: 3, spawnDelay: 1300 }, { type: 'void_assassin', count: 3, spawnDelay: 1300 }, { type: 'venom_dancer', count: 4, spawnDelay: 1300 }] },
      { wave: 6,  clearReward: 435,  invaders: [{ type: 'void_assassin_elite', count: 1, spawnDelay: 1300 }, { type: 'undying_knight', count: 3, spawnDelay: 1300 }, { type: 'venom_dancer', count: 3, spawnDelay: 1300 }, { type: 'void_assassin', count: 4, spawnDelay: 1300 }] },
      { wave: 7,  clearReward: 480,  invaders: [{ type: 'void_assassin_elite', count: 1, spawnDelay: 1200 }, { type: 'undying_knight', count: 3, spawnDelay: 1200 }, { type: 'void_assassin', count: 3, spawnDelay: 1200 }, { type: 'scarecrow_mage', count: 4, spawnDelay: 1200 }] },
      { wave: 8,  clearReward: 530,  invaders: [{ type: 'void_assassin_elite', count: 2, spawnDelay: 1150 }, { type: 'undying_knight', count: 2, spawnDelay: 1150 }, { type: 'venom_dancer', count: 4, spawnDelay: 1150 }, { type: 'soldier', count: 4, spawnDelay: 1150 }] },
      { wave: 9,  clearReward: 625,  invaders: [{ type: 'void_assassin_elite', count: 2, spawnDelay: 1100 }, { type: 'undying_knight', count: 2, spawnDelay: 1100 }, { type: 'void_assassin', count: 4, spawnDelay: 1100 }, { type: 'venom_dancer', count: 4, spawnDelay: 1100 }] },
      { wave: 10, clearReward: 3000, invaders: [{ type: 'death_emissary', count: 1, spawnDelay: 0, isBoss: true }, { type: 'ghost_add', count: 3, spawnDelay: 1300 }, { type: 'soldier', count: 5, spawnDelay: 1300 }] },
    ],
  },
];
