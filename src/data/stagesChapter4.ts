import type { StageConfig } from './stagesChapter1';

export const CHAPTER_4: StageConfig[] = [
  // Stage 33 — ch4 intro
  {
    id: 33, chapter: 4, gridCols: 4, startGold: 700, dungeonHp: 2500,
    waves: [
      { wave: 1,  clearReward: 160,  invaders: [{ type: 'peasant',             count: 5, spawnDelay: 1000 }] },
      { wave: 2,  clearReward: 185,  invaders: [{ type: 'soldier',             count: 4, spawnDelay: 1100 }] },
      { wave: 3,  clearReward: 210,  invaders: [{ type: 'void_assassin',       count: 3, spawnDelay: 1200 }] },
      { wave: 4,  clearReward: 240,  invaders: [{ type: 'void_assassin_elite', count: 2, spawnDelay: 1500 }, { type: 'soldier', count: 3, spawnDelay: 1000 }] },
      { wave: 5,  clearReward: 270,  invaders: [{ type: 'scarecrow_mage',      count: 3, spawnDelay: 1200 }] },
      { wave: 6,  clearReward: 305,  invaders: [{ type: 'venom_dancer',        count: 3, spawnDelay: 1200 }] },
      { wave: 7,  clearReward: 345,  invaders: [{ type: 'void_assassin_elite', count: 4, spawnDelay: 1300 }] },
      { wave: 8,  clearReward: 395,  invaders: [{ type: 'undying_knight',      count: 3, spawnDelay: 1400 }] },
      { wave: 9,  clearReward: 480,  invaders: [{ type: 'scarecrow_mage',      count: 4, spawnDelay: 1200 }, { type: 'void_assassin_elite', count: 2, spawnDelay: 1500 }] },
      { wave: 10, clearReward: 1800, invaders: [{ type: 'undying_knight',      count: 2, spawnDelay: 1500 }, { type: 'venom_dancer', count: 2, spawnDelay: 1200 }, { type: 'void_assassin_elite', count: 2, spawnDelay: 1500 }] },
    ],
  },
  // Stage 34 — three-legged crow intro
  {
    id: 34, chapter: 4, gridCols: 4, startGold: 720, dungeonHp: 2600,
    waves: [
      { wave: 1,  clearReward: 170,  invaders: [{ type: 'soldier',             count: 5, spawnDelay: 1000 }] },
      { wave: 2,  clearReward: 195,  invaders: [{ type: 'void_assassin_elite', count: 3, spawnDelay: 1300 }] },
      { wave: 3,  clearReward: 220,  invaders: [{ type: 'scarecrow_mage',      count: 4, spawnDelay: 1200 }] },
      { wave: 4,  clearReward: 250,  invaders: [{ type: 'venom_dancer',        count: 3, spawnDelay: 1200 }, { type: 'soldier', count: 3, spawnDelay: 1000 }] },
      { wave: 5,  clearReward: 280,  invaders: [{ type: 'undying_knight',      count: 3, spawnDelay: 1400 }] },
      { wave: 6,  clearReward: 315,  invaders: [{ type: 'void_assassin_elite', count: 4, spawnDelay: 1300 }] },
      { wave: 7,  clearReward: 355,  invaders: [{ type: 'scarecrow_mage',      count: 5, spawnDelay: 1100 }] },
      { wave: 8,  clearReward: 405,  invaders: [{ type: 'undying_knight',      count: 3, spawnDelay: 1400 }, { type: 'scarecrow_mage', count: 2, spawnDelay: 1200 }] },
      { wave: 9,  clearReward: 490,  invaders: [{ type: 'venom_dancer',        count: 4, spawnDelay: 1200 }, { type: 'void_assassin_elite', count: 3, spawnDelay: 1400 }] },
      { wave: 10, clearReward: 1900, invaders: [{ type: 'undying_knight',      count: 3, spawnDelay: 1400 }, { type: 'scarecrow_mage', count: 3, spawnDelay: 1200 }, { type: 'void_assassin_elite', count: 2, spawnDelay: 1500 }] },
    ],
  },
  // Stage 35 — scarecrow mage groups
  {
    id: 35, chapter: 4, gridCols: 4, startGold: 740, dungeonHp: 2700,
    waves: [
      { wave: 1,  clearReward: 180,  invaders: [{ type: 'scarecrow_mage',      count: 3, spawnDelay: 800 }] },
      { wave: 2,  clearReward: 205,  invaders: [{ type: 'scarecrow_mage',      count: 4, spawnDelay: 800 }] },
      { wave: 3,  clearReward: 230,  invaders: [{ type: 'void_assassin_elite', count: 3, spawnDelay: 1300 }, { type: 'scarecrow_mage', count: 2, spawnDelay: 900 }] },
      { wave: 4,  clearReward: 260,  invaders: [{ type: 'scarecrow_mage',      count: 5, spawnDelay: 800 }] },
      { wave: 5,  clearReward: 290,  invaders: [{ type: 'undying_knight',      count: 3, spawnDelay: 1400 }, { type: 'scarecrow_mage', count: 3, spawnDelay: 900 }] },
      { wave: 6,  clearReward: 325,  invaders: [{ type: 'venom_dancer',        count: 4, spawnDelay: 1200 }] },
      { wave: 7,  clearReward: 370,  invaders: [{ type: 'scarecrow_mage',      count: 6, spawnDelay: 800 }] },
      { wave: 8,  clearReward: 420,  invaders: [{ type: 'void_assassin_elite', count: 4, spawnDelay: 1300 }, { type: 'scarecrow_mage', count: 3, spawnDelay: 900 }] },
      { wave: 9,  clearReward: 510,  invaders: [{ type: 'undying_knight',      count: 4, spawnDelay: 1400 }, { type: 'venom_dancer', count: 3, spawnDelay: 1200 }] },
      { wave: 10, clearReward: 2000, invaders: [{ type: 'scarecrow_mage',      count: 5, spawnDelay: 800 }, { type: 'void_assassin_elite', count: 3, spawnDelay: 1300 }, { type: 'undying_knight', count: 2, spawnDelay: 1400 }] },
    ],
  },
  // Stage 36 — spirit altar + great serpent intro
  {
    id: 36, chapter: 4, gridCols: 4, startGold: 760, dungeonHp: 2800,
    waves: [
      { wave: 1,  clearReward: 190,  invaders: [{ type: 'soldier',             count: 5, spawnDelay: 1000 }] },
      { wave: 2,  clearReward: 215,  invaders: [{ type: 'void_assassin_elite', count: 4, spawnDelay: 1300 }] },
      { wave: 3,  clearReward: 240,  invaders: [{ type: 'scarecrow_mage',      count: 4, spawnDelay: 900 }] },
      { wave: 4,  clearReward: 270,  invaders: [{ type: 'undying_knight',      count: 3, spawnDelay: 1400 }, { type: 'venom_dancer', count: 2, spawnDelay: 1200 }] },
      { wave: 5,  clearReward: 305,  invaders: [{ type: 'void_assassin_elite', count: 5, spawnDelay: 1200 }] },
      { wave: 6,  clearReward: 340,  invaders: [{ type: 'scarecrow_mage',      count: 5, spawnDelay: 900 }, { type: 'soldier', count: 3, spawnDelay: 1000 }] },
      { wave: 7,  clearReward: 385,  invaders: [{ type: 'undying_knight',      count: 4, spawnDelay: 1400 }] },
      { wave: 8,  clearReward: 435,  invaders: [{ type: 'venom_dancer',        count: 5, spawnDelay: 1100 }, { type: 'void_assassin_elite', count: 3, spawnDelay: 1300 }] },
      { wave: 9,  clearReward: 520,  invaders: [{ type: 'scarecrow_mage',      count: 6, spawnDelay: 900 }, { type: 'undying_knight', count: 3, spawnDelay: 1400 }] },
      { wave: 10, clearReward: 2100, invaders: [{ type: 'void_assassin_elite', count: 4, spawnDelay: 1300 }, { type: 'scarecrow_mage', count: 4, spawnDelay: 900 }, { type: 'undying_knight', count: 3, spawnDelay: 1400 }] },
    ],
  },
  // Stage 37 — undying knight + high priest combos
  {
    id: 37, chapter: 4, gridCols: 4, startGold: 780, dungeonHp: 2900,
    waves: [
      { wave: 1,  clearReward: 200,  invaders: [{ type: 'undying_knight',      count: 3, spawnDelay: 1400 }] },
      { wave: 2,  clearReward: 225,  invaders: [{ type: 'undying_knight',      count: 3, spawnDelay: 1400 }, { type: 'scarecrow_mage', count: 2, spawnDelay: 1000 }] },
      { wave: 3,  clearReward: 250,  invaders: [{ type: 'void_assassin_elite', count: 4, spawnDelay: 1300 }, { type: 'undying_knight', count: 2, spawnDelay: 1400 }] },
      { wave: 4,  clearReward: 280,  invaders: [{ type: 'undying_knight',      count: 4, spawnDelay: 1300 }] },
      { wave: 5,  clearReward: 315,  invaders: [{ type: 'venom_dancer',        count: 4, spawnDelay: 1100 }, { type: 'undying_knight', count: 3, spawnDelay: 1400 }] },
      { wave: 6,  clearReward: 355,  invaders: [{ type: 'scarecrow_mage',      count: 5, spawnDelay: 900 }, { type: 'void_assassin_elite', count: 3, spawnDelay: 1300 }] },
      { wave: 7,  clearReward: 400,  invaders: [{ type: 'undying_knight',      count: 5, spawnDelay: 1300 }] },
      { wave: 8,  clearReward: 450,  invaders: [{ type: 'scarecrow_mage',      count: 4, spawnDelay: 900 }, { type: 'undying_knight', count: 4, spawnDelay: 1300 }] },
      { wave: 9,  clearReward: 540,  invaders: [{ type: 'void_assassin_elite', count: 5, spawnDelay: 1200 }, { type: 'venom_dancer', count: 3, spawnDelay: 1100 }] },
      { wave: 10, clearReward: 2200, invaders: [{ type: 'undying_knight',      count: 4, spawnDelay: 1300 }, { type: 'void_assassin_elite', count: 3, spawnDelay: 1300 }, { type: 'scarecrow_mage', count: 4, spawnDelay: 900 }] },
    ],
  },
  // Stage 38 — moon rabbit + dragons lair intro
  {
    id: 38, chapter: 4, gridCols: 4, startGold: 800, dungeonHp: 3000,
    waves: [
      { wave: 1,  clearReward: 210,  invaders: [{ type: 'soldier',             count: 6, spawnDelay: 900 }] },
      { wave: 2,  clearReward: 235,  invaders: [{ type: 'void_assassin_elite', count: 4, spawnDelay: 1300 }] },
      { wave: 3,  clearReward: 260,  invaders: [{ type: 'scarecrow_mage',      count: 5, spawnDelay: 900 }] },
      { wave: 4,  clearReward: 295,  invaders: [{ type: 'undying_knight',      count: 4, spawnDelay: 1300 }] },
      { wave: 5,  clearReward: 330,  invaders: [{ type: 'venom_dancer',        count: 5, spawnDelay: 1100 }, { type: 'void_assassin_elite', count: 3, spawnDelay: 1300 }] },
      { wave: 6,  clearReward: 370,  invaders: [{ type: 'scarecrow_mage',      count: 6, spawnDelay: 900 }, { type: 'undying_knight', count: 3, spawnDelay: 1300 }] },
      { wave: 7,  clearReward: 415,  invaders: [{ type: 'void_assassin_elite', count: 5, spawnDelay: 1200 }, { type: 'scarecrow_mage', count: 4, spawnDelay: 900 }] },
      { wave: 8,  clearReward: 465,  invaders: [{ type: 'undying_knight',      count: 5, spawnDelay: 1300 }, { type: 'venom_dancer', count: 4, spawnDelay: 1100 }] },
      { wave: 9,  clearReward: 555,  invaders: [{ type: 'void_assassin_elite', count: 5, spawnDelay: 1200 }, { type: 'scarecrow_mage', count: 5, spawnDelay: 900 }] },
      { wave: 10, clearReward: 2300, invaders: [{ type: 'undying_knight',      count: 5, spawnDelay: 1300 }, { type: 'void_assassin_elite', count: 4, spawnDelay: 1200 }, { type: 'scarecrow_mage', count: 4, spawnDelay: 900 }] },
    ],
  },
  // Stage 39 — venom dancer wide trail
  {
    id: 39, chapter: 4, gridCols: 4, startGold: 820, dungeonHp: 3100,
    waves: [
      { wave: 1,  clearReward: 220,  invaders: [{ type: 'venom_dancer',        count: 4, spawnDelay: 1100 }] },
      { wave: 2,  clearReward: 245,  invaders: [{ type: 'venom_dancer',        count: 4, spawnDelay: 1100 }, { type: 'scarecrow_mage', count: 3, spawnDelay: 900 }] },
      { wave: 3,  clearReward: 275,  invaders: [{ type: 'void_assassin_elite', count: 4, spawnDelay: 1200 }, { type: 'venom_dancer', count: 3, spawnDelay: 1100 }] },
      { wave: 4,  clearReward: 310,  invaders: [{ type: 'undying_knight',      count: 4, spawnDelay: 1300 }, { type: 'venom_dancer', count: 3, spawnDelay: 1100 }] },
      { wave: 5,  clearReward: 345,  invaders: [{ type: 'venom_dancer',        count: 5, spawnDelay: 1100 }, { type: 'void_assassin_elite', count: 3, spawnDelay: 1200 }] },
      { wave: 6,  clearReward: 385,  invaders: [{ type: 'scarecrow_mage',      count: 6, spawnDelay: 900 }, { type: 'venom_dancer', count: 4, spawnDelay: 1100 }] },
      { wave: 7,  clearReward: 435,  invaders: [{ type: 'undying_knight',      count: 5, spawnDelay: 1300 }, { type: 'scarecrow_mage', count: 3, spawnDelay: 900 }] },
      { wave: 8,  clearReward: 480,  invaders: [{ type: 'venom_dancer',        count: 5, spawnDelay: 1100 }, { type: 'void_assassin_elite', count: 4, spawnDelay: 1200 }] },
      { wave: 9,  clearReward: 570,  invaders: [{ type: 'scarecrow_mage',      count: 6, spawnDelay: 900 }, { type: 'undying_knight', count: 4, spawnDelay: 1300 }] },
      { wave: 10, clearReward: 2400, invaders: [{ type: 'venom_dancer',        count: 5, spawnDelay: 1100 }, { type: 'undying_knight', count: 4, spawnDelay: 1300 }, { type: 'void_assassin_elite', count: 4, spawnDelay: 1200 }] },
    ],
  },
  // Stage 40 — elite all-types mix
  {
    id: 40, chapter: 4, gridCols: 4, startGold: 840, dungeonHp: 3200,
    waves: [
      { wave: 1,  clearReward: 230,  invaders: [{ type: 'void_assassin_elite', count: 4, spawnDelay: 1200 }] },
      { wave: 2,  clearReward: 260,  invaders: [{ type: 'scarecrow_mage',      count: 5, spawnDelay: 900 }] },
      { wave: 3,  clearReward: 290,  invaders: [{ type: 'undying_knight',      count: 4, spawnDelay: 1300 }] },
      { wave: 4,  clearReward: 325,  invaders: [{ type: 'venom_dancer',        count: 5, spawnDelay: 1100 }] },
      { wave: 5,  clearReward: 360,  invaders: [{ type: 'void_assassin_elite', count: 5, spawnDelay: 1200 }, { type: 'scarecrow_mage', count: 4, spawnDelay: 900 }] },
      { wave: 6,  clearReward: 400,  invaders: [{ type: 'undying_knight',      count: 5, spawnDelay: 1300 }, { type: 'venom_dancer', count: 4, spawnDelay: 1100 }] },
      { wave: 7,  clearReward: 450,  invaders: [{ type: 'void_assassin_elite', count: 6, spawnDelay: 1200 }, { type: 'undying_knight', count: 3, spawnDelay: 1300 }] },
      { wave: 8,  clearReward: 500,  invaders: [{ type: 'scarecrow_mage',      count: 6, spawnDelay: 900 }, { type: 'venom_dancer', count: 4, spawnDelay: 1100 }] },
      { wave: 9,  clearReward: 590,  invaders: [{ type: 'undying_knight',      count: 5, spawnDelay: 1300 }, { type: 'void_assassin_elite', count: 5, spawnDelay: 1200 }] },
      { wave: 10, clearReward: 2500, invaders: [{ type: 'undying_knight',      count: 4, spawnDelay: 1300 }, { type: 'void_assassin_elite', count: 4, spawnDelay: 1200 }, { type: 'scarecrow_mage', count: 4, spawnDelay: 900 }, { type: 'venom_dancer', count: 4, spawnDelay: 1100 }] },
    ],
  },
  // Stage 41 — survival (no gold vein, pure placement test)
  {
    id: 41, chapter: 4, gridCols: 4, startGold: 860, dungeonHp: 3300,
    waves: [
      { wave: 1,  clearReward: 240,  invaders: [{ type: 'undying_knight',      count: 4, spawnDelay: 1300 }] },
      { wave: 2,  clearReward: 270,  invaders: [{ type: 'scarecrow_mage',      count: 5, spawnDelay: 900 }, { type: 'void_assassin_elite', count: 3, spawnDelay: 1200 }] },
      { wave: 3,  clearReward: 300,  invaders: [{ type: 'venom_dancer',        count: 5, spawnDelay: 1100 }] },
      { wave: 4,  clearReward: 335,  invaders: [{ type: 'undying_knight',      count: 5, spawnDelay: 1300 }, { type: 'scarecrow_mage', count: 4, spawnDelay: 900 }] },
      { wave: 5,  clearReward: 375,  invaders: [{ type: 'void_assassin_elite', count: 6, spawnDelay: 1200 }, { type: 'venom_dancer', count: 4, spawnDelay: 1100 }] },
      { wave: 6,  clearReward: 415,  invaders: [{ type: 'scarecrow_mage',      count: 6, spawnDelay: 900 }, { type: 'undying_knight', count: 4, spawnDelay: 1300 }] },
      { wave: 7,  clearReward: 465,  invaders: [{ type: 'void_assassin_elite', count: 6, spawnDelay: 1200 }, { type: 'scarecrow_mage', count: 5, spawnDelay: 900 }] },
      { wave: 8,  clearReward: 515,  invaders: [{ type: 'undying_knight',      count: 5, spawnDelay: 1300 }, { type: 'venom_dancer', count: 5, spawnDelay: 1100 }] },
      { wave: 9,  clearReward: 610,  invaders: [{ type: 'void_assassin_elite', count: 5, spawnDelay: 1200 }, { type: 'undying_knight', count: 5, spawnDelay: 1300 }, { type: 'scarecrow_mage', count: 4, spawnDelay: 900 }] },
      { wave: 10, clearReward: 2600, invaders: [{ type: 'undying_knight',      count: 5, spawnDelay: 1300 }, { type: 'void_assassin_elite', count: 5, spawnDelay: 1200 }, { type: 'venom_dancer', count: 5, spawnDelay: 1100 }, { type: 'scarecrow_mage', count: 5, spawnDelay: 900 }] },
    ],
  },
  // Stage 42 — BOSS: 저승왕 사자
  {
    id: 42, chapter: 4, gridCols: 4, startGold: 900, dungeonHp: 3500,
    waves: [
      { wave: 1,  clearReward: 250,  invaders: [{ type: 'soldier',             count: 5, spawnDelay: 1000 }] },
      { wave: 2,  clearReward: 280,  invaders: [{ type: 'void_assassin_elite', count: 4, spawnDelay: 1200 }] },
      { wave: 3,  clearReward: 315,  invaders: [{ type: 'scarecrow_mage',      count: 5, spawnDelay: 900 }] },
      { wave: 4,  clearReward: 350,  invaders: [{ type: 'undying_knight',      count: 4, spawnDelay: 1300 }] },
      { wave: 5,  clearReward: 390,  invaders: [{ type: 'venom_dancer',        count: 5, spawnDelay: 1100 }] },
      { wave: 6,  clearReward: 435,  invaders: [{ type: 'void_assassin_elite', count: 5, spawnDelay: 1200 }, { type: 'scarecrow_mage', count: 4, spawnDelay: 900 }] },
      { wave: 7,  clearReward: 480,  invaders: [{ type: 'undying_knight',      count: 5, spawnDelay: 1300 }, { type: 'venom_dancer', count: 4, spawnDelay: 1100 }] },
      { wave: 8,  clearReward: 530,  invaders: [{ type: 'void_assassin_elite', count: 5, spawnDelay: 1200 }, { type: 'undying_knight', count: 4, spawnDelay: 1300 }] },
      { wave: 9,  clearReward: 625,  invaders: [{ type: 'scarecrow_mage',      count: 6, spawnDelay: 900 }, { type: 'venom_dancer', count: 5, spawnDelay: 1100 }] },
      { wave: 10, clearReward: 3000, invaders: [{ type: 'death_emissary',      count: 1, spawnDelay: 3000 }, { type: 'ghost_add', count: 3, spawnDelay: 500 }] },
    ],
  },
];
