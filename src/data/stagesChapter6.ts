import type { StageConfig } from './stagesChapter1';

// ─── Chapter 6: 영원의 왕좌 ──────────────────────────────────────────────────

export const CHAPTER_6: StageConfig[] = [
  // Stage 53 — 왕좌의 입구: mirror_knight introduced
  {
    id: 53, chapter: 6, koreanName: '왕좌의 입구', gridCols: 4, startGold: 1200, dungeonHp: 5000,
    waves: [
      { wave: 1,  clearReward: 270,  invaders: [{ type: 'mirror_knight',     count: 3, spawnDelay: 1400 }] },
      { wave: 2,  clearReward: 300,  invaders: [{ type: 'mirror_knight',     count: 4, spawnDelay: 1300 }, { type: 'undying_warrior', count: 3, spawnDelay: 1400 }] },
      { wave: 3,  clearReward: 335,  invaders: [{ type: 'void_invader',      count: 4, spawnDelay: 1200 }, { type: 'mirror_knight', count: 3, spawnDelay: 1400 }] },
      { wave: 4,  clearReward: 375,  invaders: [{ type: 'mirror_knight',     count: 5, spawnDelay: 1300 }, { type: 'void_assassin_elite', count: 3, spawnDelay: 1200 }] },
      { wave: 5,  clearReward: 415,  invaders: [{ type: 'undying_warrior',   count: 4, spawnDelay: 1400 }, { type: 'mirror_knight', count: 4, spawnDelay: 1300 }] },
      { wave: 6,  clearReward: 460,  invaders: [{ type: 'mirror_knight',     count: 5, spawnDelay: 1300 }, { type: 'scarecrow_mage', count: 4, spawnDelay: 900 }] },
      { wave: 7,  clearReward: 505,  invaders: [{ type: 'void_invader',      count: 5, spawnDelay: 1200 }, { type: 'mirror_knight', count: 4, spawnDelay: 1300 }] },
      { wave: 8,  clearReward: 555,  invaders: [{ type: 'mirror_knight',     count: 5, spawnDelay: 1300 }, { type: 'undying_warrior', count: 4, spawnDelay: 1400 }] },
      { wave: 9,  clearReward: 650,  invaders: [{ type: 'mirror_knight',     count: 6, spawnDelay: 1300 }, { type: 'void_assassin_elite', count: 4, spawnDelay: 1200 }] },
      { wave: 10, clearReward: 3200, invaders: [{ type: 'mirror_knight',     count: 6, spawnDelay: 1300 }, { type: 'undying_warrior', count: 5, spawnDelay: 1400 }, { type: 'void_invader', count: 4, spawnDelay: 1200 }] },
    ],
  },
  // Stage 54 — 군체의 둥지: swarm_larva introduced
  {
    id: 54, chapter: 6, koreanName: '군체의 둥지', gridCols: 4, startGold: 1220, dungeonHp: 5100,
    waves: [
      { wave: 1,  clearReward: 285,  invaders: [{ type: 'swarm_larva',       count: 2, spawnDelay: 1600 }] },
      { wave: 2,  clearReward: 320,  invaders: [{ type: 'swarm_larva',       count: 3, spawnDelay: 1500 }, { type: 'mirror_knight', count: 3, spawnDelay: 1400 }] },
      { wave: 3,  clearReward: 355,  invaders: [{ type: 'mirror_knight',     count: 4, spawnDelay: 1300 }, { type: 'swarm_larva', count: 2, spawnDelay: 1600 }] },
      { wave: 4,  clearReward: 395,  invaders: [{ type: 'swarm_larva',       count: 3, spawnDelay: 1500 }, { type: 'undying_warrior', count: 3, spawnDelay: 1400 }] },
      { wave: 5,  clearReward: 440,  invaders: [{ type: 'void_invader',      count: 4, spawnDelay: 1200 }, { type: 'swarm_larva', count: 3, spawnDelay: 1500 }] },
      { wave: 6,  clearReward: 485,  invaders: [{ type: 'swarm_larva',       count: 4, spawnDelay: 1500 }, { type: 'mirror_knight', count: 4, spawnDelay: 1300 }] },
      { wave: 7,  clearReward: 535,  invaders: [{ type: 'undying_warrior',   count: 5, spawnDelay: 1400 }, { type: 'swarm_larva', count: 3, spawnDelay: 1500 }] },
      { wave: 8,  clearReward: 585,  invaders: [{ type: 'swarm_larva',       count: 4, spawnDelay: 1500 }, { type: 'void_assassin_elite', count: 4, spawnDelay: 1200 }] },
      { wave: 9,  clearReward: 680,  invaders: [{ type: 'mirror_knight',     count: 5, spawnDelay: 1300 }, { type: 'swarm_larva', count: 4, spawnDelay: 1500 }] },
      { wave: 10, clearReward: 3300, invaders: [{ type: 'swarm_larva',       count: 5, spawnDelay: 1500 }, { type: 'mirror_knight', count: 5, spawnDelay: 1300 }, { type: 'undying_warrior', count: 4, spawnDelay: 1400 }] },
    ],
  },
  // Stage 55 — 망령의 회랑: shadow_wraith introduced
  {
    id: 55, chapter: 6, koreanName: '망령의 회랑', gridCols: 4, startGold: 1240, dungeonHp: 5200,
    waves: [
      { wave: 1,  clearReward: 300,  invaders: [{ type: 'shadow_wraith',     count: 3, spawnDelay: 1300 }] },
      { wave: 2,  clearReward: 335,  invaders: [{ type: 'shadow_wraith',     count: 3, spawnDelay: 1300 }, { type: 'mirror_knight', count: 3, spawnDelay: 1400 }] },
      { wave: 3,  clearReward: 375,  invaders: [{ type: 'swarm_larva',       count: 3, spawnDelay: 1500 }, { type: 'shadow_wraith', count: 3, spawnDelay: 1300 }] },
      { wave: 4,  clearReward: 415,  invaders: [{ type: 'shadow_wraith',     count: 4, spawnDelay: 1300 }, { type: 'undying_warrior', count: 3, spawnDelay: 1400 }] },
      { wave: 5,  clearReward: 460,  invaders: [{ type: 'mirror_knight',     count: 4, spawnDelay: 1400 }, { type: 'shadow_wraith', count: 4, spawnDelay: 1300 }] },
      { wave: 6,  clearReward: 510,  invaders: [{ type: 'shadow_wraith',     count: 5, spawnDelay: 1300 }, { type: 'swarm_larva', count: 3, spawnDelay: 1500 }] },
      { wave: 7,  clearReward: 560,  invaders: [{ type: 'void_invader',      count: 5, spawnDelay: 1200 }, { type: 'shadow_wraith', count: 4, spawnDelay: 1300 }] },
      { wave: 8,  clearReward: 615,  invaders: [{ type: 'shadow_wraith',     count: 5, spawnDelay: 1300 }, { type: 'mirror_knight', count: 4, spawnDelay: 1400 }] },
      { wave: 9,  clearReward: 710,  invaders: [{ type: 'swarm_larva',       count: 4, spawnDelay: 1500 }, { type: 'shadow_wraith', count: 5, spawnDelay: 1300 }] },
      { wave: 10, clearReward: 3400, invaders: [{ type: 'shadow_wraith',     count: 6, spawnDelay: 1300 }, { type: 'mirror_knight', count: 5, spawnDelay: 1400 }, { type: 'swarm_larva', count: 3, spawnDelay: 1500 }] },
    ],
  },
  // Stage 56 — 십자군 진영: celestial_crusader introduced
  {
    id: 56, chapter: 6, koreanName: '십자군 진영', gridCols: 4, startGold: 1260, dungeonHp: 5300,
    waves: [
      { wave: 1,  clearReward: 315,  invaders: [{ type: 'celestial_crusader', count: 3, spawnDelay: 1400 }] },
      { wave: 2,  clearReward: 355,  invaders: [{ type: 'celestial_crusader', count: 3, spawnDelay: 1400 }, { type: 'shadow_wraith', count: 3, spawnDelay: 1300 }] },
      { wave: 3,  clearReward: 395,  invaders: [{ type: 'mirror_knight',     count: 4, spawnDelay: 1400 }, { type: 'celestial_crusader', count: 3, spawnDelay: 1400 }] },
      { wave: 4,  clearReward: 440,  invaders: [{ type: 'celestial_crusader', count: 4, spawnDelay: 1400 }, { type: 'swarm_larva', count: 3, spawnDelay: 1500 }] },
      { wave: 5,  clearReward: 485,  invaders: [{ type: 'shadow_wraith',     count: 4, spawnDelay: 1300 }, { type: 'celestial_crusader', count: 4, spawnDelay: 1400 }] },
      { wave: 6,  clearReward: 535,  invaders: [{ type: 'celestial_crusader', count: 5, spawnDelay: 1400 }, { type: 'mirror_knight', count: 4, spawnDelay: 1400 }] },
      { wave: 7,  clearReward: 590,  invaders: [{ type: 'swarm_larva',       count: 4, spawnDelay: 1500 }, { type: 'celestial_crusader', count: 4, spawnDelay: 1400 }] },
      { wave: 8,  clearReward: 645,  invaders: [{ type: 'celestial_crusader', count: 5, spawnDelay: 1400 }, { type: 'shadow_wraith', count: 4, spawnDelay: 1300 }] },
      { wave: 9,  clearReward: 745,  invaders: [{ type: 'mirror_knight',     count: 5, spawnDelay: 1400 }, { type: 'celestial_crusader', count: 5, spawnDelay: 1400 }] },
      { wave: 10, clearReward: 3500, invaders: [{ type: 'celestial_crusader', count: 6, spawnDelay: 1400 }, { type: 'shadow_wraith', count: 5, spawnDelay: 1300 }, { type: 'swarm_larva', count: 3, spawnDelay: 1500 }] },
    ],
  },
  // Stage 57 — 역병의 정원: plague_herald introduced
  {
    id: 57, chapter: 6, koreanName: '역병의 정원', gridCols: 4, startGold: 1280, dungeonHp: 5400,
    waves: [
      { wave: 1,  clearReward: 330,  invaders: [{ type: 'plague_herald',     count: 3, spawnDelay: 1300 }] },
      { wave: 2,  clearReward: 370,  invaders: [{ type: 'plague_herald',     count: 3, spawnDelay: 1300 }, { type: 'celestial_crusader', count: 3, spawnDelay: 1400 }] },
      { wave: 3,  clearReward: 415,  invaders: [{ type: 'shadow_wraith',     count: 4, spawnDelay: 1300 }, { type: 'plague_herald', count: 3, spawnDelay: 1300 }] },
      { wave: 4,  clearReward: 460,  invaders: [{ type: 'plague_herald',     count: 4, spawnDelay: 1300 }, { type: 'mirror_knight', count: 4, spawnDelay: 1400 }] },
      { wave: 5,  clearReward: 510,  invaders: [{ type: 'swarm_larva',       count: 3, spawnDelay: 1500 }, { type: 'plague_herald', count: 4, spawnDelay: 1300 }] },
      { wave: 6,  clearReward: 565,  invaders: [{ type: 'plague_herald',     count: 5, spawnDelay: 1300 }, { type: 'celestial_crusader', count: 4, spawnDelay: 1400 }] },
      { wave: 7,  clearReward: 620,  invaders: [{ type: 'mirror_knight',     count: 5, spawnDelay: 1400 }, { type: 'plague_herald', count: 4, spawnDelay: 1300 }] },
      { wave: 8,  clearReward: 680,  invaders: [{ type: 'plague_herald',     count: 5, spawnDelay: 1300 }, { type: 'shadow_wraith', count: 5, spawnDelay: 1300 }] },
      { wave: 9,  clearReward: 780,  invaders: [{ type: 'swarm_larva',       count: 4, spawnDelay: 1500 }, { type: 'plague_herald', count: 5, spawnDelay: 1300 }] },
      { wave: 10, clearReward: 3600, invaders: [{ type: 'plague_herald',     count: 6, spawnDelay: 1300 }, { type: 'celestial_crusader', count: 5, spawnDelay: 1400 }, { type: 'mirror_knight', count: 4, spawnDelay: 1400 }] },
    ],
  },
  // Stage 58 — 거신의 문: void_colossus introduced
  {
    id: 58, chapter: 6, koreanName: '거신의 문', gridCols: 4, startGold: 1300, dungeonHp: 5500,
    waves: [
      { wave: 1,  clearReward: 350,  invaders: [{ type: 'void_colossus',     count: 1, spawnDelay: 2000 }, { type: 'plague_herald', count: 3, spawnDelay: 1300 }] },
      { wave: 2,  clearReward: 390,  invaders: [{ type: 'shadow_wraith',     count: 5, spawnDelay: 1300 }, { type: 'void_colossus', count: 1, spawnDelay: 2000 }] },
      { wave: 3,  clearReward: 435,  invaders: [{ type: 'void_colossus',     count: 2, spawnDelay: 2000 }, { type: 'mirror_knight', count: 4, spawnDelay: 1400 }] },
      { wave: 4,  clearReward: 480,  invaders: [{ type: 'celestial_crusader', count: 5, spawnDelay: 1400 }, { type: 'void_colossus', count: 1, spawnDelay: 2000 }] },
      { wave: 5,  clearReward: 535,  invaders: [{ type: 'void_colossus',     count: 2, spawnDelay: 2000 }, { type: 'swarm_larva', count: 4, spawnDelay: 1500 }] },
      { wave: 6,  clearReward: 590,  invaders: [{ type: 'plague_herald',     count: 5, spawnDelay: 1300 }, { type: 'void_colossus', count: 2, spawnDelay: 2000 }] },
      { wave: 7,  clearReward: 650,  invaders: [{ type: 'void_colossus',     count: 2, spawnDelay: 2000 }, { type: 'shadow_wraith', count: 5, spawnDelay: 1300 }] },
      { wave: 8,  clearReward: 715,  invaders: [{ type: 'mirror_knight',     count: 6, spawnDelay: 1400 }, { type: 'void_colossus', count: 2, spawnDelay: 2000 }] },
      { wave: 9,  clearReward: 820,  invaders: [{ type: 'void_colossus',     count: 3, spawnDelay: 2000 }, { type: 'celestial_crusader', count: 5, spawnDelay: 1400 }] },
      { wave: 10, clearReward: 3700, invaders: [{ type: 'void_colossus',     count: 3, spawnDelay: 2000 }, { type: 'plague_herald', count: 5, spawnDelay: 1300 }, { type: 'shadow_wraith', count: 4, spawnDelay: 1300 }] },
    ],
  },
  // Stage 59 — 파수꾼 요새: titan_sentinel introduced
  {
    id: 59, chapter: 6, koreanName: '파수꾼 요새', gridCols: 4, startGold: 1320, dungeonHp: 5600,
    waves: [
      { wave: 1,  clearReward: 365,  invaders: [{ type: 'titan_sentinel',    count: 1, spawnDelay: 2200 }, { type: 'mirror_knight', count: 4, spawnDelay: 1400 }] },
      { wave: 2,  clearReward: 410,  invaders: [{ type: 'void_colossus',     count: 2, spawnDelay: 2000 }, { type: 'titan_sentinel', count: 1, spawnDelay: 2200 }] },
      { wave: 3,  clearReward: 455,  invaders: [{ type: 'titan_sentinel',    count: 2, spawnDelay: 2200 }, { type: 'shadow_wraith', count: 4, spawnDelay: 1300 }] },
      { wave: 4,  clearReward: 505,  invaders: [{ type: 'plague_herald',     count: 5, spawnDelay: 1300 }, { type: 'titan_sentinel', count: 1, spawnDelay: 2200 }] },
      { wave: 5,  clearReward: 560,  invaders: [{ type: 'titan_sentinel',    count: 2, spawnDelay: 2200 }, { type: 'celestial_crusader', count: 5, spawnDelay: 1400 }] },
      { wave: 6,  clearReward: 620,  invaders: [{ type: 'swarm_larva',       count: 4, spawnDelay: 1500 }, { type: 'titan_sentinel', count: 2, spawnDelay: 2200 }] },
      { wave: 7,  clearReward: 685,  invaders: [{ type: 'titan_sentinel',    count: 2, spawnDelay: 2200 }, { type: 'void_colossus', count: 2, spawnDelay: 2000 }] },
      { wave: 8,  clearReward: 750,  invaders: [{ type: 'mirror_knight',     count: 6, spawnDelay: 1400 }, { type: 'titan_sentinel', count: 2, spawnDelay: 2200 }] },
      { wave: 9,  clearReward: 860,  invaders: [{ type: 'titan_sentinel',    count: 3, spawnDelay: 2200 }, { type: 'plague_herald', count: 5, spawnDelay: 1300 }] },
      { wave: 10, clearReward: 3800, invaders: [{ type: 'titan_sentinel',    count: 3, spawnDelay: 2200 }, { type: 'void_colossus', count: 2, spawnDelay: 2000 }, { type: 'shadow_wraith', count: 5, spawnDelay: 1300 }] },
    ],
  },
  // Stage 60 — 왕좌의 시련: full mix gauntlet
  {
    id: 60, chapter: 6, koreanName: '왕좌의 시련', gridCols: 4, startGold: 1350, dungeonHp: 5700,
    waves: [
      { wave: 1,  clearReward: 385,  invaders: [{ type: 'mirror_knight',     count: 5, spawnDelay: 1400 }, { type: 'shadow_wraith', count: 4, spawnDelay: 1300 }] },
      { wave: 2,  clearReward: 430,  invaders: [{ type: 'swarm_larva',       count: 4, spawnDelay: 1500 }, { type: 'celestial_crusader', count: 5, spawnDelay: 1400 }] },
      { wave: 3,  clearReward: 480,  invaders: [{ type: 'plague_herald',     count: 5, spawnDelay: 1300 }, { type: 'void_colossus', count: 2, spawnDelay: 2000 }] },
      { wave: 4,  clearReward: 530,  invaders: [{ type: 'titan_sentinel',    count: 2, spawnDelay: 2200 }, { type: 'mirror_knight', count: 5, spawnDelay: 1400 }] },
      { wave: 5,  clearReward: 590,  invaders: [{ type: 'shadow_wraith',     count: 6, spawnDelay: 1300 }, { type: 'swarm_larva', count: 4, spawnDelay: 1500 }] },
      { wave: 6,  clearReward: 650,  invaders: [{ type: 'celestial_crusader', count: 6, spawnDelay: 1400 }, { type: 'plague_herald', count: 5, spawnDelay: 1300 }] },
      { wave: 7,  clearReward: 715,  invaders: [{ type: 'void_colossus',     count: 3, spawnDelay: 2000 }, { type: 'titan_sentinel', count: 2, spawnDelay: 2200 }] },
      { wave: 8,  clearReward: 785,  invaders: [{ type: 'mirror_knight',     count: 6, spawnDelay: 1400 }, { type: 'shadow_wraith', count: 6, spawnDelay: 1300 }] },
      { wave: 9,  clearReward: 900,  invaders: [{ type: 'swarm_larva',       count: 5, spawnDelay: 1500 }, { type: 'celestial_crusader', count: 5, spawnDelay: 1400 }] },
      { wave: 10, clearReward: 3900, invaders: [{ type: 'titan_sentinel',    count: 3, spawnDelay: 2200 }, { type: 'void_colossus', count: 3, spawnDelay: 2000 }, { type: 'plague_herald', count: 5, spawnDelay: 1300 }] },
    ],
  },
  // Stage 61 — 영원의 전당: 15-wave survival, titan_sentinel mini-boss
  {
    id: 61, chapter: 6, koreanName: '영원의 전당', gridCols: 4, startGold: 1380, dungeonHp: 5800,
    waves: [
      { wave: 1,  clearReward: 400,  invaders: [{ type: 'mirror_knight',     count: 5, spawnDelay: 1400 }] },
      { wave: 2,  clearReward: 445,  invaders: [{ type: 'swarm_larva',       count: 4, spawnDelay: 1500 }, { type: 'shadow_wraith', count: 4, spawnDelay: 1300 }] },
      { wave: 3,  clearReward: 495,  invaders: [{ type: 'celestial_crusader', count: 5, spawnDelay: 1400 }, { type: 'plague_herald', count: 4, spawnDelay: 1300 }] },
      { wave: 4,  clearReward: 545,  invaders: [{ type: 'void_colossus',     count: 2, spawnDelay: 2000 }, { type: 'mirror_knight', count: 5, spawnDelay: 1400 }] },
      { wave: 5,  clearReward: 605,  invaders: [{ type: 'titan_sentinel',    count: 2, spawnDelay: 2200 }, { type: 'shadow_wraith', count: 5, spawnDelay: 1300 }] },
      { wave: 6,  clearReward: 670,  invaders: [{ type: 'swarm_larva',       count: 5, spawnDelay: 1500 }, { type: 'celestial_crusader', count: 5, spawnDelay: 1400 }] },
      { wave: 7,  clearReward: 740,  invaders: [{ type: 'plague_herald',     count: 6, spawnDelay: 1300 }, { type: 'void_colossus', count: 2, spawnDelay: 2000 }] },
      { wave: 8,  clearReward: 810,  invaders: [{ type: 'mirror_knight',     count: 6, spawnDelay: 1400 }, { type: 'titan_sentinel', count: 2, spawnDelay: 2200 }] },
      { wave: 9,  clearReward: 885,  invaders: [{ type: 'shadow_wraith',     count: 6, spawnDelay: 1300 }, { type: 'swarm_larva', count: 5, spawnDelay: 1500 }] },
      { wave: 10, clearReward: 960,  invaders: [{ type: 'celestial_crusader', count: 6, spawnDelay: 1400 }, { type: 'plague_herald', count: 5, spawnDelay: 1300 }] },
      { wave: 11, clearReward: 1030, invaders: [{ type: 'void_colossus',     count: 3, spawnDelay: 2000 }, { type: 'titan_sentinel', count: 3, spawnDelay: 2200 }] },
      { wave: 12, clearReward: 1105, invaders: [{ type: 'mirror_knight',     count: 7, spawnDelay: 1400 }, { type: 'shadow_wraith', count: 6, spawnDelay: 1300 }] },
      { wave: 13, clearReward: 1185, invaders: [{ type: 'swarm_larva',       count: 5, spawnDelay: 1500 }, { type: 'plague_herald', count: 6, spawnDelay: 1300 }] },
      { wave: 14, clearReward: 1270, invaders: [{ type: 'titan_sentinel',    count: 3, spawnDelay: 2200 }, { type: 'void_colossus', count: 3, spawnDelay: 2000 }, { type: 'celestial_crusader', count: 5, spawnDelay: 1400 }] },
      { wave: 15, clearReward: 4500, invaders: [{ type: 'titan_sentinel',    count: 1, spawnDelay: 3000, isBoss: true }, { type: 'mirror_knight', count: 5, spawnDelay: 1400 }, { type: 'shadow_wraith', count: 5, spawnDelay: 1300 }] },
    ],
  },
  // Stage 62 — 영원의 황제: FINAL BOSS (eternal_emperor)
  {
    id: 62, chapter: 6, koreanName: '영원의 황제', gridCols: 4, startGold: 1400, dungeonHp: 6000,
    waves: [
      { wave: 1,  clearReward: 420,  invaders: [{ type: 'mirror_knight',     count: 5, spawnDelay: 1400 }] },
      { wave: 2,  clearReward: 465,  invaders: [{ type: 'shadow_wraith',     count: 5, spawnDelay: 1300 }, { type: 'swarm_larva', count: 3, spawnDelay: 1500 }] },
      { wave: 3,  clearReward: 515,  invaders: [{ type: 'celestial_crusader', count: 5, spawnDelay: 1400 }, { type: 'plague_herald', count: 4, spawnDelay: 1300 }] },
      { wave: 4,  clearReward: 570,  invaders: [{ type: 'void_colossus',     count: 2, spawnDelay: 2000 }, { type: 'titan_sentinel', count: 2, spawnDelay: 2200 }] },
      { wave: 5,  clearReward: 635,  invaders: [{ type: 'mirror_knight',     count: 6, spawnDelay: 1400 }, { type: 'shadow_wraith', count: 5, spawnDelay: 1300 }] },
      { wave: 6,  clearReward: 700,  invaders: [{ type: 'swarm_larva',       count: 5, spawnDelay: 1500 }, { type: 'celestial_crusader', count: 5, spawnDelay: 1400 }] },
      { wave: 7,  clearReward: 775,  invaders: [{ type: 'plague_herald',     count: 6, spawnDelay: 1300 }, { type: 'void_colossus', count: 3, spawnDelay: 2000 }] },
      { wave: 8,  clearReward: 850,  invaders: [{ type: 'titan_sentinel',    count: 3, spawnDelay: 2200 }, { type: 'mirror_knight', count: 6, spawnDelay: 1400 }] },
      { wave: 9,  clearReward: 930,  invaders: [{ type: 'shadow_wraith',     count: 6, spawnDelay: 1300 }, { type: 'swarm_larva', count: 5, spawnDelay: 1500 }, { type: 'celestial_crusader', count: 5, spawnDelay: 1400 }] },
      { wave: 10, clearReward: 1010, invaders: [{ type: 'void_colossus',     count: 3, spawnDelay: 2000 }, { type: 'titan_sentinel', count: 3, spawnDelay: 2200 }, { type: 'plague_herald', count: 5, spawnDelay: 1300 }] },
      { wave: 11, clearReward: 1090, invaders: [{ type: 'mirror_knight',     count: 7, spawnDelay: 1400 }, { type: 'shadow_wraith', count: 6, spawnDelay: 1300 }] },
      { wave: 12, clearReward: 1170, invaders: [{ type: 'swarm_larva',       count: 6, spawnDelay: 1500 }, { type: 'celestial_crusader', count: 6, spawnDelay: 1400 }] },
      { wave: 13, clearReward: 1260, invaders: [{ type: 'titan_sentinel',    count: 3, spawnDelay: 2200 }, { type: 'void_colossus', count: 3, spawnDelay: 2000 }] },
      { wave: 14, clearReward: 1350, invaders: [{ type: 'plague_herald',     count: 6, spawnDelay: 1300 }, { type: 'mirror_knight', count: 6, spawnDelay: 1400 }, { type: 'shadow_wraith', count: 5, spawnDelay: 1300 }] },
      { wave: 15, clearReward: 5500, invaders: [{ type: 'eternal_emperor',   count: 1, spawnDelay: 4000 }, { type: 'titan_sentinel', count: 1, spawnDelay: 2200 }, { type: 'void_colossus', count: 1, spawnDelay: 2000 }] },
    ],
  },
];
