import type { InvaderType } from './invaders';

export interface WaveSpec {
  wave?: number;
  invaders: Array<{ type: InvaderType; count: number; spawnDelay: number; isBoss?: boolean }>;
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
  {
    id: 1, chapter: 1, koreanName: '버려진 던전', dungeonHp: 1000,
    waves: [
      // Wave 1 — 농민병사 ×5
      { wave: 1, clearReward: 50,
        invaders: [{ type: 'peasant', count: 5, spawnDelay: 2000 }] },
      // Wave 2 — 농민병사 ×5, 마을궁수 ×2
      { wave: 2, clearReward: 70,
        invaders: [{ type: 'peasant', count: 5, spawnDelay: 1800 }, { type: 'peasant', count: 2, spawnDelay: 1800 }] },
      // Wave 3 — 농민병사 ×6, 도둑 ×2 (shaman = fast/low hp)
      { wave: 3, clearReward: 90,
        invaders: [{ type: 'peasant', count: 6, spawnDelay: 1600 }, { type: 'shaman', count: 2, spawnDelay: 1600 }] },
      // Wave 4 — 농민병사 ×5, 도망상인 ×2
      { wave: 4, clearReward: 100,
        invaders: [{ type: 'peasant', count: 5, spawnDelay: 1500 }, { type: 'shaman', count: 2, spawnDelay: 1500 }] },
      // Wave 5 — 방패기사 ×3, 농민병사 ×5
      { wave: 5, clearReward: 130,
        invaders: [{ type: 'knight', count: 1, spawnDelay: 1500 }, { type: 'peasant', count: 7, spawnDelay: 1500 }] },
      // Wave 6 — 방패기사 ×4, 마을궁수 ×3
      { wave: 6, clearReward: 150,
        invaders: [{ type: 'knight', count: 2, spawnDelay: 1400 }, { type: 'peasant', count: 5, spawnDelay: 1400 }] },
      // Wave 7 — 야전치유사 ×2, 농민병사 ×8
      { wave: 7, clearReward: 160,
        invaders: [{ type: 'soldier', count: 2, spawnDelay: 1300 }, { type: 'peasant', count: 8, spawnDelay: 1300 }] },
      // Wave 8 — 방패기사 ×5, 야전치유사 ×2, 도둑 ×3
      { wave: 8, clearReward: 200,
        invaders: [{ type: 'knight', count: 3, spawnDelay: 1200 }, { type: 'soldier', count: 2, spawnDelay: 1200 }, { type: 'shaman', count: 3, spawnDelay: 1200 }] },
      // Wave 9 — 방패기사 ×6, 마을궁수 ×4, 야전치유사 ×3
      { wave: 9, clearReward: 250,
        invaders: [{ type: 'knight', count: 3, spawnDelay: 1100 }, { type: 'peasant', count: 4, spawnDelay: 1100 }, { type: 'soldier', count: 2, spawnDelay: 1100 }] },
      // Wave 10 — 도깨비대왕 ×1 BOSS (knight with isBoss flag)
      { wave: 10, clearReward: 500,
        invaders: [{ type: 'knight', count: 1, spawnDelay: 0, isBoss: true }] },
    ],
  },
  // ── Stage 2: 동굴 입구 ──────────────────────────────────────────────────────
  {
    id: 2, chapter: 1, koreanName: '동굴 입구', dungeonHp: 1050,
    waves: [
      { wave: 1, clearReward: 55,
        invaders: [{ type: 'peasant', count: 6, spawnDelay: 1800 }] },
      { wave: 2, clearReward: 80,
        invaders: [{ type: 'peasant', count: 7, spawnDelay: 1800 }] },
      { wave: 3, clearReward: 100,
        invaders: [{ type: 'peasant', count: 6, spawnDelay: 1550 }, { type: 'shaman', count: 2, spawnDelay: 1550 }] },
      { wave: 4, clearReward: 115,
        invaders: [{ type: 'peasant', count: 7, spawnDelay: 1550 }, { type: 'shaman', count: 2, spawnDelay: 1550 }] },
      { wave: 5, clearReward: 145,
        invaders: [{ type: 'knight', count: 1, spawnDelay: 1450 }, { type: 'peasant', count: 7, spawnDelay: 1450 }] },
      { wave: 6, clearReward: 170,
        invaders: [{ type: 'knight', count: 2, spawnDelay: 1450 }, { type: 'peasant', count: 5, spawnDelay: 1450 }] },
      { wave: 7, clearReward: 180,
        invaders: [{ type: 'soldier', count: 2, spawnDelay: 1350 }, { type: 'peasant', count: 8, spawnDelay: 1350 }] },
      { wave: 8, clearReward: 225,
        invaders: [{ type: 'knight', count: 2, spawnDelay: 1250 }, { type: 'soldier', count: 2, spawnDelay: 1250 }, { type: 'shaman', count: 2, spawnDelay: 1250 }] },
      { wave: 9, clearReward: 280,
        invaders: [{ type: 'knight', count: 3, spawnDelay: 1150 }, { type: 'peasant', count: 4, spawnDelay: 1150 }, { type: 'soldier', count: 2, spawnDelay: 1150 }] },
      { wave: 10, clearReward: 550,
        invaders: [{ type: 'knight', count: 1, spawnDelay: 0, isBoss: true }, { type: 'peasant', count: 3, spawnDelay: 1800 }] },
    ],
  },
  // ── Stage 3: 지하 통로 ──────────────────────────────────────────────────────
  {
    id: 3, chapter: 1, koreanName: '지하 통로', dungeonHp: 1100,
    waves: [
      { wave: 1, clearReward: 60,
        invaders: [{ type: 'peasant', count: 7, spawnDelay: 1800 }] },
      { wave: 2, clearReward: 85,
        invaders: [{ type: 'peasant', count: 8, spawnDelay: 1800 }] },
      { wave: 3, clearReward: 110,
        invaders: [{ type: 'peasant', count: 6, spawnDelay: 1550 }, { type: 'shaman', count: 2, spawnDelay: 1550 }] },
      { wave: 4, clearReward: 125,
        invaders: [{ type: 'peasant', count: 7, spawnDelay: 1550 }, { type: 'shaman', count: 1, spawnDelay: 1550 }] },
      { wave: 5, clearReward: 155,
        invaders: [{ type: 'knight', count: 1, spawnDelay: 1450 }, { type: 'peasant', count: 7, spawnDelay: 1450 }] },
      { wave: 6, clearReward: 180,
        invaders: [{ type: 'knight', count: 2, spawnDelay: 1450 }, { type: 'peasant', count: 5, spawnDelay: 1450 }] },
      { wave: 7, clearReward: 195,
        invaders: [{ type: 'soldier', count: 3, spawnDelay: 1350 }, { type: 'peasant', count: 7, spawnDelay: 1350 }] },
      { wave: 8, clearReward: 240,
        invaders: [{ type: 'knight', count: 2, spawnDelay: 1250 }, { type: 'soldier', count: 2, spawnDelay: 1250 }, { type: 'shaman', count: 2, spawnDelay: 1250 }] },
      { wave: 9, clearReward: 300,
        invaders: [{ type: 'knight', count: 3, spawnDelay: 1150 }, { type: 'soldier', count: 2, spawnDelay: 1150 }, { type: 'shaman', count: 1, spawnDelay: 1150 }] },
      { wave: 10, clearReward: 580,
        invaders: [{ type: 'knight', count: 1, spawnDelay: 0, isBoss: true }, { type: 'soldier', count: 3, spawnDelay: 1200 }] },
    ],
  },
  // ── Stage 4: 도깨비 시장 ────────────────────────────────────────────────────
  {
    id: 4, chapter: 1, koreanName: '도깨비 시장', dungeonHp: 1200,
    waves: [
      { wave: 1, clearReward: 65,
        invaders: [{ type: 'peasant', count: 7, spawnDelay: 1800 }] },
      { wave: 2, clearReward: 90,
        invaders: [{ type: 'peasant', count: 8, spawnDelay: 1800 }] },
      { wave: 3, clearReward: 115,
        invaders: [{ type: 'peasant', count: 6, spawnDelay: 1550 }, { type: 'shaman', count: 2, spawnDelay: 1550 }] },
      { wave: 4, clearReward: 130,
        invaders: [{ type: 'peasant', count: 7, spawnDelay: 1550 }, { type: 'shaman', count: 1, spawnDelay: 1550 }] },
      { wave: 5, clearReward: 165,
        invaders: [{ type: 'knight', count: 1, spawnDelay: 1450 }, { type: 'peasant', count: 5, spawnDelay: 1450 }, { type: 'shaman', count: 2, spawnDelay: 1450 }] },
      { wave: 6, clearReward: 190,
        invaders: [{ type: 'knight', count: 2, spawnDelay: 1450 }, { type: 'peasant', count: 4, spawnDelay: 1450 }, { type: 'shaman', count: 2, spawnDelay: 1450 }] },
      { wave: 7, clearReward: 210,
        invaders: [{ type: 'soldier', count: 2, spawnDelay: 1350 }, { type: 'peasant', count: 7, spawnDelay: 1350 }, { type: 'shaman', count: 1, spawnDelay: 1350 }] },
      { wave: 8, clearReward: 260,
        invaders: [{ type: 'knight', count: 2, spawnDelay: 1250 }, { type: 'soldier', count: 2, spawnDelay: 1250 }, { type: 'shaman', count: 2, spawnDelay: 1250 }] },
      { wave: 9, clearReward: 320,
        invaders: [{ type: 'knight', count: 3, spawnDelay: 1150 }, { type: 'soldier', count: 2, spawnDelay: 1150 }, { type: 'shaman', count: 2, spawnDelay: 1150 }] },
      { wave: 10, clearReward: 620,
        invaders: [{ type: 'knight', count: 1, spawnDelay: 0, isBoss: true }, { type: 'soldier', count: 3, spawnDelay: 1200 }, { type: 'shaman', count: 2, spawnDelay: 1200 }] },
    ],
  },
  // ── Stage 5: 불의 시련 ──────────────────────────────────────────────────────
  {
    id: 5, chapter: 1, koreanName: '불의 시련', dungeonHp: 1300,
    waves: [
      { wave: 1, clearReward: 70,
        invaders: [{ type: 'peasant', count: 6, spawnDelay: 1700 }] },
      { wave: 2, clearReward: 95,
        invaders: [{ type: 'peasant', count: 7, spawnDelay: 1700 }] },
      { wave: 3, clearReward: 120,
        invaders: [{ type: 'peasant', count: 6, spawnDelay: 1500 }, { type: 'shaman', count: 2, spawnDelay: 1500 }] },
      { wave: 4, clearReward: 140,
        invaders: [{ type: 'knight', count: 1, spawnDelay: 1500 }, { type: 'peasant', count: 6, spawnDelay: 1500 }] },
      { wave: 5, clearReward: 175,
        invaders: [{ type: 'knight', count: 1, spawnDelay: 1400 }, { type: 'peasant', count: 7, spawnDelay: 1400 }] },
      { wave: 6, clearReward: 200,
        invaders: [{ type: 'knight', count: 2, spawnDelay: 1400 }, { type: 'peasant', count: 5, spawnDelay: 1400 }] },
      { wave: 7, clearReward: 220,
        invaders: [{ type: 'knight', count: 2, spawnDelay: 1300 }, { type: 'soldier', count: 2, spawnDelay: 1300 }, { type: 'peasant', count: 5, spawnDelay: 1300 }] },
      { wave: 8, clearReward: 270,
        invaders: [{ type: 'knight', count: 2, spawnDelay: 1250 }, { type: 'soldier', count: 2, spawnDelay: 1250 }, { type: 'shaman', count: 2, spawnDelay: 1250 }] },
      { wave: 9, clearReward: 340,
        invaders: [{ type: 'knight', count: 3, spawnDelay: 1150 }, { type: 'soldier', count: 2, spawnDelay: 1150 }, { type: 'shaman', count: 2, spawnDelay: 1150 }] },
      { wave: 10, clearReward: 650,
        invaders: [{ type: 'knight', count: 1, spawnDelay: 0, isBoss: true }, { type: 'knight', count: 2, spawnDelay: 1200 }] },
    ],
  },
  // ── Stage 6: 얼음 감옥 ──────────────────────────────────────────────────────
  {
    id: 6, chapter: 1, koreanName: '얼음 감옥', dungeonHp: 1350,
    waves: [
      { wave: 1, clearReward: 75,
        invaders: [{ type: 'peasant', count: 8, spawnDelay: 1700 }] },
      { wave: 2, clearReward: 100,
        invaders: [{ type: 'peasant', count: 8, spawnDelay: 1700 }] },
      { wave: 3, clearReward: 125,
        invaders: [{ type: 'peasant', count: 6, spawnDelay: 1500 }, { type: 'shaman', count: 2, spawnDelay: 1500 }] },
      { wave: 4, clearReward: 145,
        invaders: [{ type: 'knight', count: 1, spawnDelay: 1500 }, { type: 'peasant', count: 6, spawnDelay: 1500 }] },
      { wave: 5, clearReward: 180,
        invaders: [{ type: 'knight', count: 2, spawnDelay: 1400 }, { type: 'peasant', count: 6, spawnDelay: 1400 }] },
      { wave: 6, clearReward: 210,
        invaders: [{ type: 'knight', count: 2, spawnDelay: 1400 }, { type: 'peasant', count: 5, spawnDelay: 1400 }, { type: 'shaman', count: 2, spawnDelay: 1400 }] },
      { wave: 7, clearReward: 230,
        invaders: [{ type: 'soldier', count: 2, spawnDelay: 1300 }, { type: 'peasant', count: 7, spawnDelay: 1300 }] },
      { wave: 8, clearReward: 280,
        invaders: [{ type: 'knight', count: 2, spawnDelay: 1250 }, { type: 'soldier', count: 2, spawnDelay: 1250 }, { type: 'shaman', count: 2, spawnDelay: 1250 }] },
      { wave: 9, clearReward: 350,
        invaders: [{ type: 'knight', count: 3, spawnDelay: 1150 }, { type: 'soldier', count: 2, spawnDelay: 1150 }, { type: 'shaman', count: 2, spawnDelay: 1150 }] },
      { wave: 10, clearReward: 680,
        invaders: [{ type: 'knight', count: 1, spawnDelay: 0, isBoss: true }, { type: 'soldier', count: 3, spawnDelay: 1200 }, { type: 'shaman', count: 3, spawnDelay: 1200 }] },
    ],
  },
  // ── Stage 7: 독의 늪 ───────────────────────────────────────────────────────
  {
    id: 7, chapter: 1, koreanName: '독의 늪', dungeonHp: 1450,
    waves: [
      { wave: 1, clearReward: 80,
        invaders: [{ type: 'shaman', count: 4, spawnDelay: 1700 }, { type: 'peasant', count: 5, spawnDelay: 1700 }] },
      { wave: 2, clearReward: 105,
        invaders: [{ type: 'shaman', count: 4, spawnDelay: 1700 }, { type: 'peasant', count: 5, spawnDelay: 1700 }] },
      { wave: 3, clearReward: 130,
        invaders: [{ type: 'shaman', count: 5, spawnDelay: 1500 }, { type: 'peasant', count: 4, spawnDelay: 1500 }] },
      { wave: 4, clearReward: 150,
        invaders: [{ type: 'shaman', count: 6, spawnDelay: 1500 }, { type: 'peasant', count: 3, spawnDelay: 1500 }] },
      { wave: 5, clearReward: 190,
        invaders: [{ type: 'knight', count: 1, spawnDelay: 1400 }, { type: 'shaman', count: 5, spawnDelay: 1400 }] },
      { wave: 6, clearReward: 220,
        invaders: [{ type: 'knight', count: 2, spawnDelay: 1400 }, { type: 'shaman', count: 5, spawnDelay: 1400 }] },
      { wave: 7, clearReward: 240,
        invaders: [{ type: 'shaman', count: 7, spawnDelay: 1300 }, { type: 'soldier', count: 2, spawnDelay: 1300 }] },
      { wave: 8, clearReward: 290,
        invaders: [{ type: 'knight', count: 2, spawnDelay: 1250 }, { type: 'shaman', count: 8, spawnDelay: 1250 }] },
      { wave: 9, clearReward: 360,
        invaders: [{ type: 'knight', count: 3, spawnDelay: 1150 }, { type: 'shaman', count: 8, spawnDelay: 1150 }] },
      { wave: 10, clearReward: 700,
        invaders: [{ type: 'knight', count: 1, spawnDelay: 0, isBoss: true }, { type: 'shaman', count: 6, spawnDelay: 1000 }] },
    ],
  },
  // ── Stage 8: 무기고 ────────────────────────────────────────────────────────
  {
    id: 8, chapter: 1, koreanName: '무기고', dungeonHp: 1550,
    waves: [
      { wave: 1, clearReward: 85,
        invaders: [{ type: 'peasant', count: 7, spawnDelay: 1600 }] },
      { wave: 2, clearReward: 110,
        invaders: [{ type: 'peasant', count: 8, spawnDelay: 1600 }] },
      { wave: 3, clearReward: 140,
        invaders: [{ type: 'peasant', count: 6, spawnDelay: 1450 }, { type: 'shaman', count: 2, spawnDelay: 1450 }] },
      { wave: 4, clearReward: 155,
        invaders: [{ type: 'knight', count: 1, spawnDelay: 1450 }, { type: 'peasant', count: 7, spawnDelay: 1450 }] },
      { wave: 5, clearReward: 195,
        invaders: [{ type: 'knight', count: 2, spawnDelay: 1350 }, { type: 'peasant', count: 6, spawnDelay: 1350 }] },
      { wave: 6, clearReward: 225,
        invaders: [{ type: 'knight', count: 2, spawnDelay: 1350 }, { type: 'peasant', count: 5, spawnDelay: 1350 }] },
      { wave: 7, clearReward: 250,
        invaders: [{ type: 'knight', count: 2, spawnDelay: 1350 }, { type: 'soldier', count: 2, spawnDelay: 1350 }, { type: 'peasant', count: 4, spawnDelay: 1350 }] },
      { wave: 8, clearReward: 300,
        invaders: [{ type: 'knight', count: 2, spawnDelay: 1250 }, { type: 'soldier', count: 2, spawnDelay: 1250 }, { type: 'shaman', count: 2, spawnDelay: 1250 }] },
      { wave: 9, clearReward: 380,
        invaders: [{ type: 'knight', count: 2, spawnDelay: 1150 }, { type: 'soldier', count: 3, spawnDelay: 1150 }, { type: 'shaman', count: 2, spawnDelay: 1150 }] },
      { wave: 10, clearReward: 730,
        invaders: [{ type: 'knight', count: 1, spawnDelay: 0, isBoss: true }, { type: 'knight', count: 2, spawnDelay: 1200 }, { type: 'soldier', count: 2, spawnDelay: 1200 }] },
    ],
  },
  // ── Stage 9: 왕의 방 ───────────────────────────────────────────────────────
  {
    id: 9, chapter: 1, koreanName: '왕의 방', dungeonHp: 1700,
    waves: [
      { wave: 1, clearReward: 90,
        invaders: [{ type: 'peasant', count: 8, spawnDelay: 1600 }] },
      { wave: 2, clearReward: 120,
        invaders: [{ type: 'peasant', count: 8, spawnDelay: 1600 }] },
      { wave: 3, clearReward: 145,
        invaders: [{ type: 'peasant', count: 7, spawnDelay: 1450 }, { type: 'shaman', count: 2, spawnDelay: 1450 }] },
      { wave: 4, clearReward: 165,
        invaders: [{ type: 'knight', count: 1, spawnDelay: 1450 }, { type: 'peasant', count: 6, spawnDelay: 1450 }, { type: 'shaman', count: 2, spawnDelay: 1450 }] },
      { wave: 5, clearReward: 200,
        invaders: [{ type: 'knight', count: 2, spawnDelay: 1350 }, { type: 'peasant', count: 7, spawnDelay: 1350 }] },
      { wave: 6, clearReward: 235,
        invaders: [{ type: 'knight', count: 2, spawnDelay: 1350 }, { type: 'peasant', count: 5, spawnDelay: 1350 }, { type: 'shaman', count: 1, spawnDelay: 1350 }] },
      { wave: 7, clearReward: 260,
        invaders: [{ type: 'knight', count: 2, spawnDelay: 1350 }, { type: 'soldier', count: 2, spawnDelay: 1350 }, { type: 'peasant', count: 5, spawnDelay: 1350 }] },
      { wave: 8, clearReward: 310,
        invaders: [{ type: 'knight', count: 2, spawnDelay: 1250 }, { type: 'soldier', count: 2, spawnDelay: 1250 }, { type: 'shaman', count: 2, spawnDelay: 1250 }] },
      { wave: 9, clearReward: 400,
        invaders: [{ type: 'knight', count: 3, spawnDelay: 1150 }, { type: 'soldier', count: 2, spawnDelay: 1150 }, { type: 'shaman', count: 2, spawnDelay: 1150 }] },
      { wave: 10, clearReward: 750,
        invaders: [{ type: 'knight', count: 1, spawnDelay: 0, isBoss: true }, { type: 'knight', count: 2, spawnDelay: 1200 }, { type: 'soldier', count: 3, spawnDelay: 1200 }] },
    ],
  },
  // ── Stage 10: 최종 결전 ─────────────────────────────────────────────────────
  {
    id: 10, chapter: 1, koreanName: '최종 결전', dungeonHp: 1800,
    waves: [
      { wave: 1, clearReward: 95,
        invaders: [{ type: 'peasant', count: 8, spawnDelay: 1600 }] },
      { wave: 2, clearReward: 125,
        invaders: [{ type: 'peasant', count: 8, spawnDelay: 1600 }] },
      { wave: 3, clearReward: 155,
        invaders: [{ type: 'peasant', count: 7, spawnDelay: 1450 }, { type: 'shaman', count: 2, spawnDelay: 1450 }] },
      { wave: 4, clearReward: 175,
        invaders: [{ type: 'knight', count: 1, spawnDelay: 1450 }, { type: 'peasant', count: 6, spawnDelay: 1450 }, { type: 'shaman', count: 2, spawnDelay: 1450 }] },
      { wave: 5, clearReward: 210,
        invaders: [{ type: 'knight', count: 2, spawnDelay: 1350 }, { type: 'peasant', count: 7, spawnDelay: 1350 }] },
      { wave: 6, clearReward: 245,
        invaders: [{ type: 'knight', count: 2, spawnDelay: 1350 }, { type: 'peasant', count: 5, spawnDelay: 1350 }, { type: 'shaman', count: 1, spawnDelay: 1350 }] },
      { wave: 7, clearReward: 270,
        invaders: [{ type: 'knight', count: 2, spawnDelay: 1400 }, { type: 'soldier', count: 2, spawnDelay: 1400 }, { type: 'peasant', count: 4, spawnDelay: 1400 }] },
      { wave: 8, clearReward: 320,
        invaders: [{ type: 'knight', count: 2, spawnDelay: 1300 }, { type: 'soldier', count: 2, spawnDelay: 1300 }, { type: 'shaman', count: 1, spawnDelay: 1300 }] },
      { wave: 9, clearReward: 420,
        invaders: [{ type: 'knight', count: 2, spawnDelay: 1200 }, { type: 'soldier', count: 2, spawnDelay: 1200 }, { type: 'shaman', count: 2, spawnDelay: 1200 }] },
      { wave: 10, clearReward: 800,
        invaders: [{ type: 'knight', count: 1, spawnDelay: 0, isBoss: true }, { type: 'soldier', count: 3, spawnDelay: 1200 }, { type: 'shaman', count: 2, spawnDelay: 1200 }] },
    ],
  },
];
