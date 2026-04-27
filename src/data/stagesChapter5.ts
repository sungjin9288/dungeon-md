import type { StageConfig } from './stagesChapter1';

export const CHAPTER_5: StageConfig[] = [
  // Stage 43 — Ch5 intro, CELESTIAL_SHIFT hazard
  {
    id: 43, chapter: 5, koreanName: '천계의 변동', gridCols: 4, startGold: 950, dungeonHp: 4000,
    waves: [
      { wave: 1,  clearReward: 250,  invaders: [{ type: 'soldier',             count: 6, spawnDelay: 900 }] },
      { wave: 2,  clearReward: 275,  invaders: [{ type: 'void_assassin_elite', count: 4, spawnDelay: 1200 }] },
      { wave: 3,  clearReward: 305,  invaders: [{ type: 'scarecrow_mage',      count: 5, spawnDelay: 900 }] },
      { wave: 4,  clearReward: 340,  invaders: [{ type: 'undying_knight',      count: 4, spawnDelay: 1300 }] },
      { wave: 5,  clearReward: 380,  invaders: [{ type: 'venom_dancer',        count: 5, spawnDelay: 1100 }] },
      { wave: 6,  clearReward: 420,  invaders: [{ type: 'void_assassin_elite', count: 5, spawnDelay: 1200 }, { type: 'scarecrow_mage', count: 4, spawnDelay: 900 }] },
      { wave: 7,  clearReward: 465,  invaders: [{ type: 'undying_knight',      count: 5, spawnDelay: 1300 }] },
      { wave: 8,  clearReward: 510,  invaders: [{ type: 'scarecrow_mage',      count: 6, spawnDelay: 900 }, { type: 'venom_dancer', count: 4, spawnDelay: 1100 }] },
      { wave: 9,  clearReward: 600,  invaders: [{ type: 'void_assassin_elite', count: 6, spawnDelay: 1200 }, { type: 'undying_knight', count: 4, spawnDelay: 1300 }] },
      { wave: 10, clearReward: 2800, invaders: [{ type: 'undying_knight',      count: 5, spawnDelay: 1300 }, { type: 'void_assassin_elite', count: 5, spawnDelay: 1200 }, { type: 'scarecrow_mage', count: 5, spawnDelay: 900 }] },
    ],
  },
  // Stage 44 — MOUNTAIN_WIND hazard
  {
    id: 44, chapter: 5, koreanName: '산신의 바람', gridCols: 4, startGold: 970, dungeonHp: 4100,
    waves: [
      { wave: 1,  clearReward: 260,  invaders: [{ type: 'void_assassin_elite', count: 5, spawnDelay: 1200 }] },
      { wave: 2,  clearReward: 290,  invaders: [{ type: 'scarecrow_mage',      count: 6, spawnDelay: 900 }] },
      { wave: 3,  clearReward: 320,  invaders: [{ type: 'undying_knight',      count: 5, spawnDelay: 1300 }] },
      { wave: 4,  clearReward: 355,  invaders: [{ type: 'venom_dancer',        count: 5, spawnDelay: 1100 }, { type: 'void_assassin_elite', count: 4, spawnDelay: 1200 }] },
      { wave: 5,  clearReward: 395,  invaders: [{ type: 'scarecrow_mage',      count: 6, spawnDelay: 900 }, { type: 'undying_knight', count: 4, spawnDelay: 1300 }] },
      { wave: 6,  clearReward: 440,  invaders: [{ type: 'void_assassin_elite', count: 6, spawnDelay: 1200 }, { type: 'venom_dancer', count: 4, spawnDelay: 1100 }] },
      { wave: 7,  clearReward: 485,  invaders: [{ type: 'undying_knight',      count: 6, spawnDelay: 1300 }, { type: 'scarecrow_mage', count: 4, spawnDelay: 900 }] },
      { wave: 8,  clearReward: 530,  invaders: [{ type: 'void_assassin_elite', count: 6, spawnDelay: 1200 }, { type: 'undying_knight', count: 5, spawnDelay: 1300 }] },
      { wave: 9,  clearReward: 620,  invaders: [{ type: 'scarecrow_mage',      count: 6, spawnDelay: 900 }, { type: 'venom_dancer', count: 5, spawnDelay: 1100 }] },
      { wave: 10, clearReward: 2900, invaders: [{ type: 'undying_knight',      count: 6, spawnDelay: 1300 }, { type: 'void_assassin_elite', count: 5, spawnDelay: 1200 }, { type: 'scarecrow_mage', count: 5, spawnDelay: 900 }] },
    ],
  },
  // Stage 45 — dual hazards
  {
    id: 45, chapter: 5, koreanName: '이중 위협', gridCols: 4, startGold: 990, dungeonHp: 4200,
    waves: [
      { wave: 1,  clearReward: 270,  invaders: [{ type: 'undying_knight',      count: 5, spawnDelay: 1300 }] },
      { wave: 2,  clearReward: 300,  invaders: [{ type: 'scarecrow_mage',      count: 6, spawnDelay: 900 }, { type: 'void_assassin_elite', count: 4, spawnDelay: 1200 }] },
      { wave: 3,  clearReward: 335,  invaders: [{ type: 'venom_dancer',        count: 6, spawnDelay: 1100 }] },
      { wave: 4,  clearReward: 370,  invaders: [{ type: 'undying_knight',      count: 6, spawnDelay: 1300 }, { type: 'scarecrow_mage', count: 4, spawnDelay: 900 }] },
      { wave: 5,  clearReward: 415,  invaders: [{ type: 'void_assassin_elite', count: 6, spawnDelay: 1200 }, { type: 'venom_dancer', count: 5, spawnDelay: 1100 }] },
      { wave: 6,  clearReward: 460,  invaders: [{ type: 'scarecrow_mage',      count: 7, spawnDelay: 900 }, { type: 'undying_knight', count: 4, spawnDelay: 1300 }] },
      { wave: 7,  clearReward: 510,  invaders: [{ type: 'void_assassin_elite', count: 7, spawnDelay: 1200 }, { type: 'scarecrow_mage', count: 4, spawnDelay: 900 }] },
      { wave: 8,  clearReward: 560,  invaders: [{ type: 'undying_knight',      count: 6, spawnDelay: 1300 }, { type: 'venom_dancer', count: 5, spawnDelay: 1100 }] },
      { wave: 9,  clearReward: 650,  invaders: [{ type: 'void_assassin_elite', count: 7, spawnDelay: 1200 }, { type: 'undying_knight', count: 5, spawnDelay: 1300 }] },
      { wave: 10, clearReward: 3000, invaders: [{ type: 'undying_knight',      count: 6, spawnDelay: 1300 }, { type: 'void_assassin_elite', count: 6, spawnDelay: 1200 }, { type: 'scarecrow_mage', count: 6, spawnDelay: 900 }] },
    ],
  },
  // Stage 46 — void_invader introduced
  {
    id: 46, chapter: 5, koreanName: '공허의 침입자', gridCols: 4, startGold: 1010, dungeonHp: 4300,
    waves: [
      { wave: 1,  clearReward: 280,  invaders: [{ type: 'void_invader',        count: 3, spawnDelay: 1200 }] },
      { wave: 2,  clearReward: 315,  invaders: [{ type: 'void_invader',        count: 4, spawnDelay: 1200 }, { type: 'scarecrow_mage', count: 4, spawnDelay: 900 }] },
      { wave: 3,  clearReward: 350,  invaders: [{ type: 'undying_knight',      count: 5, spawnDelay: 1300 }, { type: 'void_invader', count: 3, spawnDelay: 1200 }] },
      { wave: 4,  clearReward: 390,  invaders: [{ type: 'void_invader',        count: 5, spawnDelay: 1200 }, { type: 'venom_dancer', count: 4, spawnDelay: 1100 }] },
      { wave: 5,  clearReward: 435,  invaders: [{ type: 'void_assassin_elite', count: 5, spawnDelay: 1200 }, { type: 'void_invader', count: 4, spawnDelay: 1200 }] },
      { wave: 6,  clearReward: 480,  invaders: [{ type: 'scarecrow_mage',      count: 6, spawnDelay: 900 }, { type: 'void_invader', count: 4, spawnDelay: 1200 }] },
      { wave: 7,  clearReward: 530,  invaders: [{ type: 'undying_knight',      count: 5, spawnDelay: 1300 }, { type: 'void_invader', count: 5, spawnDelay: 1200 }] },
      { wave: 8,  clearReward: 580,  invaders: [{ type: 'void_invader',        count: 6, spawnDelay: 1200 }, { type: 'venom_dancer', count: 4, spawnDelay: 1100 }] },
      { wave: 9,  clearReward: 670,  invaders: [{ type: 'void_assassin_elite', count: 5, spawnDelay: 1200 }, { type: 'undying_knight', count: 5, spawnDelay: 1300 }, { type: 'void_invader', count: 4, spawnDelay: 1200 }] },
      { wave: 10, clearReward: 3100, invaders: [{ type: 'void_invader',        count: 6, spawnDelay: 1200 }, { type: 'undying_knight', count: 5, spawnDelay: 1300 }, { type: 'scarecrow_mage', count: 5, spawnDelay: 900 }] },
    ],
  },
  // Stage 47 — undying_warrior introduced
  {
    id: 47, chapter: 5, koreanName: '불사의 전사', gridCols: 4, startGold: 1030, dungeonHp: 4400,
    waves: [
      { wave: 1,  clearReward: 295,  invaders: [{ type: 'undying_warrior',     count: 3, spawnDelay: 1400 }] },
      { wave: 2,  clearReward: 330,  invaders: [{ type: 'undying_warrior',     count: 3, spawnDelay: 1400 }, { type: 'scarecrow_mage', count: 4, spawnDelay: 900 }] },
      { wave: 3,  clearReward: 365,  invaders: [{ type: 'void_invader',        count: 4, spawnDelay: 1200 }, { type: 'undying_warrior', count: 3, spawnDelay: 1400 }] },
      { wave: 4,  clearReward: 405,  invaders: [{ type: 'undying_warrior',     count: 4, spawnDelay: 1400 }, { type: 'venom_dancer', count: 4, spawnDelay: 1100 }] },
      { wave: 5,  clearReward: 450,  invaders: [{ type: 'undying_knight',      count: 4, spawnDelay: 1300 }, { type: 'undying_warrior', count: 3, spawnDelay: 1400 }] },
      { wave: 6,  clearReward: 500,  invaders: [{ type: 'void_assassin_elite', count: 5, spawnDelay: 1200 }, { type: 'undying_warrior', count: 4, spawnDelay: 1400 }] },
      { wave: 7,  clearReward: 550,  invaders: [{ type: 'scarecrow_mage',      count: 6, spawnDelay: 900 }, { type: 'undying_warrior', count: 4, spawnDelay: 1400 }] },
      { wave: 8,  clearReward: 600,  invaders: [{ type: 'void_invader',        count: 5, spawnDelay: 1200 }, { type: 'undying_warrior', count: 4, spawnDelay: 1400 }] },
      { wave: 9,  clearReward: 690,  invaders: [{ type: 'undying_warrior',     count: 5, spawnDelay: 1400 }, { type: 'undying_knight', count: 5, spawnDelay: 1300 }] },
      { wave: 10, clearReward: 3200, invaders: [{ type: 'undying_warrior',     count: 5, spawnDelay: 1400 }, { type: 'void_invader', count: 5, spawnDelay: 1200 }, { type: 'scarecrow_mage', count: 5, spawnDelay: 900 }] },
    ],
  },
  // Stage 48 — SPIRIT_BLESSING hazard added
  {
    id: 48, chapter: 5, koreanName: '정령의 가호', gridCols: 4, startGold: 1050, dungeonHp: 4500,
    waves: [
      { wave: 1,  clearReward: 310,  invaders: [{ type: 'undying_warrior',     count: 4, spawnDelay: 1400 }] },
      { wave: 2,  clearReward: 345,  invaders: [{ type: 'void_invader',        count: 5, spawnDelay: 1200 }, { type: 'undying_warrior', count: 3, spawnDelay: 1400 }] },
      { wave: 3,  clearReward: 380,  invaders: [{ type: 'scarecrow_mage',      count: 6, spawnDelay: 900 }, { type: 'venom_dancer', count: 4, spawnDelay: 1100 }] },
      { wave: 4,  clearReward: 420,  invaders: [{ type: 'undying_knight',      count: 5, spawnDelay: 1300 }, { type: 'undying_warrior', count: 4, spawnDelay: 1400 }] },
      { wave: 5,  clearReward: 465,  invaders: [{ type: 'void_assassin_elite', count: 6, spawnDelay: 1200 }, { type: 'void_invader', count: 4, spawnDelay: 1200 }] },
      { wave: 6,  clearReward: 515,  invaders: [{ type: 'undying_warrior',     count: 5, spawnDelay: 1400 }, { type: 'scarecrow_mage', count: 5, spawnDelay: 900 }] },
      { wave: 7,  clearReward: 570,  invaders: [{ type: 'void_invader',        count: 6, spawnDelay: 1200 }, { type: 'undying_knight', count: 5, spawnDelay: 1300 }] },
      { wave: 8,  clearReward: 620,  invaders: [{ type: 'undying_warrior',     count: 5, spawnDelay: 1400 }, { type: 'venom_dancer', count: 5, spawnDelay: 1100 }] },
      { wave: 9,  clearReward: 710,  invaders: [{ type: 'void_assassin_elite', count: 6, spawnDelay: 1200 }, { type: 'undying_warrior', count: 5, spawnDelay: 1400 }] },
      { wave: 10, clearReward: 3300, invaders: [{ type: 'undying_warrior',     count: 5, spawnDelay: 1400 }, { type: 'void_invader', count: 5, spawnDelay: 1200 }, { type: 'undying_knight', count: 5, spawnDelay: 1300 }] },
    ],
  },
  // Stage 49 — all hazards active
  {
    id: 49, chapter: 5, koreanName: '총체적 위기', gridCols: 4, startGold: 1070, dungeonHp: 4600,
    waves: [
      { wave: 1,  clearReward: 325,  invaders: [{ type: 'undying_warrior',     count: 5, spawnDelay: 1400 }] },
      { wave: 2,  clearReward: 360,  invaders: [{ type: 'void_invader',        count: 6, spawnDelay: 1200 }, { type: 'undying_warrior', count: 4, spawnDelay: 1400 }] },
      { wave: 3,  clearReward: 400,  invaders: [{ type: 'scarecrow_mage',      count: 7, spawnDelay: 900 }, { type: 'undying_knight', count: 5, spawnDelay: 1300 }] },
      { wave: 4,  clearReward: 440,  invaders: [{ type: 'void_assassin_elite', count: 6, spawnDelay: 1200 }, { type: 'undying_warrior', count: 5, spawnDelay: 1400 }] },
      { wave: 5,  clearReward: 490,  invaders: [{ type: 'venom_dancer',        count: 6, spawnDelay: 1100 }, { type: 'void_invader', count: 5, spawnDelay: 1200 }] },
      { wave: 6,  clearReward: 540,  invaders: [{ type: 'undying_warrior',     count: 6, spawnDelay: 1400 }, { type: 'scarecrow_mage', count: 5, spawnDelay: 900 }] },
      { wave: 7,  clearReward: 590,  invaders: [{ type: 'void_invader',        count: 7, spawnDelay: 1200 }, { type: 'undying_knight', count: 5, spawnDelay: 1300 }] },
      { wave: 8,  clearReward: 640,  invaders: [{ type: 'undying_warrior',     count: 6, spawnDelay: 1400 }, { type: 'void_assassin_elite', count: 5, spawnDelay: 1200 }] },
      { wave: 9,  clearReward: 730,  invaders: [{ type: 'scarecrow_mage',      count: 7, spawnDelay: 900 }, { type: 'venom_dancer', count: 6, spawnDelay: 1100 }] },
      { wave: 10, clearReward: 3400, invaders: [{ type: 'undying_warrior',     count: 6, spawnDelay: 1400 }, { type: 'void_invader', count: 6, spawnDelay: 1200 }, { type: 'undying_knight', count: 5, spawnDelay: 1300 }] },
    ],
  },
  // Stage 50 — all types ultimate gauntlet
  {
    id: 50, chapter: 5, koreanName: '최후의 관문', gridCols: 4, startGold: 1100, dungeonHp: 4800,
    waves: [
      { wave: 1,  clearReward: 340,  invaders: [{ type: 'void_assassin_elite', count: 5, spawnDelay: 1200 }, { type: 'undying_warrior', count: 4, spawnDelay: 1400 }] },
      { wave: 2,  clearReward: 380,  invaders: [{ type: 'scarecrow_mage',      count: 7, spawnDelay: 900 }, { type: 'void_invader', count: 5, spawnDelay: 1200 }] },
      { wave: 3,  clearReward: 420,  invaders: [{ type: 'undying_knight',      count: 6, spawnDelay: 1300 }, { type: 'undying_warrior', count: 5, spawnDelay: 1400 }] },
      { wave: 4,  clearReward: 460,  invaders: [{ type: 'venom_dancer',        count: 6, spawnDelay: 1100 }, { type: 'void_assassin_elite', count: 5, spawnDelay: 1200 }] },
      { wave: 5,  clearReward: 510,  invaders: [{ type: 'void_invader',        count: 7, spawnDelay: 1200 }, { type: 'undying_warrior', count: 5, spawnDelay: 1400 }] },
      { wave: 6,  clearReward: 560,  invaders: [{ type: 'scarecrow_mage',      count: 7, spawnDelay: 900 }, { type: 'undying_knight', count: 6, spawnDelay: 1300 }] },
      { wave: 7,  clearReward: 615,  invaders: [{ type: 'undying_warrior',     count: 6, spawnDelay: 1400 }, { type: 'void_invader', count: 6, spawnDelay: 1200 }] },
      { wave: 8,  clearReward: 670,  invaders: [{ type: 'void_assassin_elite', count: 7, spawnDelay: 1200 }, { type: 'venom_dancer', count: 6, spawnDelay: 1100 }] },
      { wave: 9,  clearReward: 760,  invaders: [{ type: 'undying_knight',      count: 7, spawnDelay: 1300 }, { type: 'undying_warrior', count: 6, spawnDelay: 1400 }] },
      { wave: 10, clearReward: 3500, invaders: [{ type: 'undying_warrior',     count: 6, spawnDelay: 1400 }, { type: 'void_invader', count: 6, spawnDelay: 1200 }, { type: 'undying_knight', count: 6, spawnDelay: 1300 }, { type: 'scarecrow_mage', count: 5, spawnDelay: 900 }] },
    ],
  },
  // Stage 51 — 15-wave survival
  {
    id: 51, chapter: 5, koreanName: '생존의 시험', gridCols: 4, startGold: 1130, dungeonHp: 5000,
    waves: [
      { wave: 1,  clearReward: 355,  invaders: [{ type: 'soldier',             count: 6, spawnDelay: 900 }] },
      { wave: 2,  clearReward: 390,  invaders: [{ type: 'void_assassin_elite', count: 5, spawnDelay: 1200 }] },
      { wave: 3,  clearReward: 430,  invaders: [{ type: 'undying_warrior',     count: 5, spawnDelay: 1400 }] },
      { wave: 4,  clearReward: 470,  invaders: [{ type: 'scarecrow_mage',      count: 7, spawnDelay: 900 }] },
      { wave: 5,  clearReward: 520,  invaders: [{ type: 'void_invader',        count: 6, spawnDelay: 1200 }, { type: 'undying_knight', count: 5, spawnDelay: 1300 }] },
      { wave: 6,  clearReward: 575,  invaders: [{ type: 'undying_warrior',     count: 6, spawnDelay: 1400 }, { type: 'venom_dancer', count: 5, spawnDelay: 1100 }] },
      { wave: 7,  clearReward: 630,  invaders: [{ type: 'void_assassin_elite', count: 7, spawnDelay: 1200 }, { type: 'scarecrow_mage', count: 5, spawnDelay: 900 }] },
      { wave: 8,  clearReward: 685,  invaders: [{ type: 'void_invader',        count: 7, spawnDelay: 1200 }, { type: 'undying_warrior', count: 5, spawnDelay: 1400 }] },
      { wave: 9,  clearReward: 740,  invaders: [{ type: 'undying_knight',      count: 7, spawnDelay: 1300 }, { type: 'void_assassin_elite', count: 5, spawnDelay: 1200 }] },
      { wave: 10, clearReward: 800,  invaders: [{ type: 'undying_warrior',     count: 6, spawnDelay: 1400 }, { type: 'scarecrow_mage', count: 6, spawnDelay: 900 }] },
      { wave: 11, clearReward: 860,  invaders: [{ type: 'void_invader',        count: 7, spawnDelay: 1200 }, { type: 'venom_dancer', count: 6, spawnDelay: 1100 }] },
      { wave: 12, clearReward: 925,  invaders: [{ type: 'void_assassin_elite', count: 7, spawnDelay: 1200 }, { type: 'undying_warrior', count: 6, spawnDelay: 1400 }] },
      { wave: 13, clearReward: 990,  invaders: [{ type: 'undying_knight',      count: 7, spawnDelay: 1300 }, { type: 'void_invader', count: 6, spawnDelay: 1200 }] },
      { wave: 14, clearReward: 1060, invaders: [{ type: 'undying_warrior',     count: 7, spawnDelay: 1400 }, { type: 'scarecrow_mage', count: 7, spawnDelay: 900 }, { type: 'void_assassin_elite', count: 5, spawnDelay: 1200 }] },
      { wave: 15, clearReward: 3700, invaders: [{ type: 'undying_warrior',     count: 7, spawnDelay: 1400 }, { type: 'void_invader', count: 7, spawnDelay: 1200 }, { type: 'undying_knight', count: 6, spawnDelay: 1300 }, { type: 'scarecrow_mage', count: 6, spawnDelay: 900 }] },
    ],
  },
  // Stage 52 — FINAL BOSS: 삼신 파괴자 (5-phase)
  {
    id: 52, chapter: 5, koreanName: '삼신 파괴자', gridCols: 4, startGold: 1150, dungeonHp: 5000,
    waves: [
      { wave: 1,  clearReward: 370,  invaders: [{ type: 'soldier',             count: 5, spawnDelay: 900 }] },
      { wave: 2,  clearReward: 405,  invaders: [{ type: 'void_assassin_elite', count: 5, spawnDelay: 1200 }] },
      { wave: 3,  clearReward: 445,  invaders: [{ type: 'undying_warrior',     count: 5, spawnDelay: 1400 }] },
      { wave: 4,  clearReward: 490,  invaders: [{ type: 'scarecrow_mage',      count: 6, spawnDelay: 900 }] },
      { wave: 5,  clearReward: 540,  invaders: [{ type: 'void_invader',        count: 5, spawnDelay: 1200 }] },
      { wave: 6,  clearReward: 595,  invaders: [{ type: 'undying_knight',      count: 5, spawnDelay: 1300 }] },
      { wave: 7,  clearReward: 650,  invaders: [{ type: 'undying_warrior',     count: 5, spawnDelay: 1400 }, { type: 'scarecrow_mage', count: 5, spawnDelay: 900 }] },
      { wave: 8,  clearReward: 710,  invaders: [{ type: 'void_invader',        count: 6, spawnDelay: 1200 }, { type: 'void_assassin_elite', count: 5, spawnDelay: 1200 }] },
      { wave: 9,  clearReward: 770,  invaders: [{ type: 'undying_knight',      count: 6, spawnDelay: 1300 }, { type: 'undying_warrior', count: 5, spawnDelay: 1400 }] },
      { wave: 10, clearReward: 830,  invaders: [{ type: 'death_emissary',      count: 1, spawnDelay: 3000 }] },
      { wave: 11, clearReward: 890,  invaders: [{ type: 'undying_warrior',     count: 6, spawnDelay: 1400 }, { type: 'void_invader', count: 6, spawnDelay: 1200 }] },
      { wave: 12, clearReward: 950,  invaders: [{ type: 'void_assassin_elite', count: 6, spawnDelay: 1200 }, { type: 'undying_knight', count: 6, spawnDelay: 1300 }] },
      { wave: 13, clearReward: 1020, invaders: [{ type: 'undying_warrior',     count: 7, spawnDelay: 1400 }, { type: 'scarecrow_mage', count: 6, spawnDelay: 900 }] },
      { wave: 14, clearReward: 1100, invaders: [{ type: 'void_invader',        count: 7, spawnDelay: 1200 }, { type: 'undying_warrior', count: 6, spawnDelay: 1400 }] },
      { wave: 15, clearReward: 4500, invaders: [{ type: 'three_god_destroyer', count: 1, spawnDelay: 4000 }, { type: 'ghost_add', count: 3, spawnDelay: 500 }] },
    ],
  },
];
