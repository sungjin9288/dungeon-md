import type { StageConfig } from './stagesChapter1';

// ─── Chapter 9: 공허 너머 (Beyond the Void) ──────────────────────────────────
// The campaign's true finale. Reuses the Ch8 void/abyss roster as escalating
// grunts, brings back primordial_titan as a mid-chapter mini-boss (st87–89),
// and introduces two Ch9 invaders: abyss_reaver (signature elite) and the apex
// void_sovereign (st90 final boss). All clear rewards ramp monotonically so the
// boss wave always out-pays the opener; void_sovereign appears only in st90 so
// the finale is the chapter's difficulty peak.

export const CHAPTER_9: StageConfig[] = [
  // Stage 81 — 공허의 잔향: abyss_reaver 등장
  {
    id: 81, chapter: 9, koreanName: '공허의 잔향', gridCols: 4, dungeonHp: 11500,
    waves: [
      { wave: 1,  clearReward: 760,  invaders: [{ type: 'abyss_reaver',   count: 2, spawnDelay: 1300 }, { type: 'void_soldier',   count: 4, spawnDelay: 1400 }] },
      { wave: 2,  clearReward: 835,  invaders: [{ type: 'void_soldier',   count: 5, spawnDelay: 1400 }, { type: 'abyss_reaver',   count: 3, spawnDelay: 1300 }] },
      { wave: 3,  clearReward: 915,  invaders: [{ type: 'abyss_reaver',   count: 3, spawnDelay: 1300 }, { type: 'abyss_berserker', count: 4, spawnDelay: 1300 }] },
      { wave: 4,  clearReward: 1000, invaders: [{ type: 'void_soldier',   count: 6, spawnDelay: 1400 }, { type: 'abyss_reaver',   count: 4, spawnDelay: 1300 }] },
      { wave: 5,  clearReward: 1095, invaders: [{ type: 'abyss_reaver',   count: 4, spawnDelay: 1300 }, { type: 'divine_archer',  count: 4, spawnDelay: 1200 }] },
      { wave: 6,  clearReward: 1195, invaders: [{ type: 'abyss_berserker', count: 5, spawnDelay: 1300 }, { type: 'abyss_reaver',  count: 4, spawnDelay: 1300 }] },
      { wave: 7,  clearReward: 1305, invaders: [{ type: 'abyss_reaver',   count: 5, spawnDelay: 1300 }, { type: 'void_soldier',   count: 6, spawnDelay: 1400 }] },
      { wave: 8,  clearReward: 1420, invaders: [{ type: 'abyss_reaver',   count: 5, spawnDelay: 1300 }, { type: 'radiant_seraph', count: 4, spawnDelay: 1300 }] },
      { wave: 9,  clearReward: 1545, invaders: [{ type: 'abyss_berserker', count: 6, spawnDelay: 1300 }, { type: 'abyss_reaver',  count: 5, spawnDelay: 1300 }, { type: 'divine_archer', count: 4, spawnDelay: 1200 }] },
      { wave: 10, clearReward: 5800, invaders: [{ type: 'abyss_reaver',   count: 6, spawnDelay: 1300 }, { type: 'abyss_berserker', count: 6, spawnDelay: 1300 }, { type: 'radiant_seraph', count: 5, spawnDelay: 1300 }] },
    ],
  },
  // Stage 82 — 심연의 약탈: abyss_reaver 중심 압박
  {
    id: 82, chapter: 9, koreanName: '심연의 약탈', gridCols: 4, dungeonHp: 11700,
    waves: [
      { wave: 1,  clearReward: 785,  invaders: [{ type: 'abyss_reaver',   count: 3, spawnDelay: 1300 }, { type: 'void_soldier',   count: 4, spawnDelay: 1400 }] },
      { wave: 2,  clearReward: 862,  invaders: [{ type: 'abyss_berserker', count: 4, spawnDelay: 1300 }, { type: 'abyss_reaver',  count: 3, spawnDelay: 1300 }] },
      { wave: 3,  clearReward: 945,  invaders: [{ type: 'abyss_reaver',   count: 4, spawnDelay: 1300 }, { type: 'void_soldier',   count: 5, spawnDelay: 1400 }] },
      { wave: 4,  clearReward: 1035, invaders: [{ type: 'abyss_reaver',   count: 4, spawnDelay: 1300 }, { type: 'divine_archer',  count: 5, spawnDelay: 1200 }] },
      { wave: 5,  clearReward: 1130, invaders: [{ type: 'abyss_berserker', count: 5, spawnDelay: 1300 }, { type: 'abyss_reaver',  count: 5, spawnDelay: 1300 }] },
      { wave: 6,  clearReward: 1235, invaders: [{ type: 'abyss_reaver',   count: 5, spawnDelay: 1300 }, { type: 'radiant_seraph', count: 5, spawnDelay: 1300 }] },
      { wave: 7,  clearReward: 1345, invaders: [{ type: 'void_soldier',   count: 7, spawnDelay: 1400 }, { type: 'abyss_reaver',   count: 5, spawnDelay: 1300 }] },
      { wave: 8,  clearReward: 1465, invaders: [{ type: 'abyss_reaver',   count: 6, spawnDelay: 1300 }, { type: 'abyss_berserker', count: 6, spawnDelay: 1300 }] },
      { wave: 9,  clearReward: 1590, invaders: [{ type: 'abyss_reaver',   count: 6, spawnDelay: 1300 }, { type: 'divine_archer',  count: 5, spawnDelay: 1200 }, { type: 'radiant_seraph', count: 4, spawnDelay: 1300 }] },
      { wave: 10, clearReward: 5950, invaders: [{ type: 'abyss_reaver',   count: 7, spawnDelay: 1300 }, { type: 'abyss_berserker', count: 7, spawnDelay: 1300 }, { type: 'void_soldier', count: 6, spawnDelay: 1400 }] },
    ],
  },
  // Stage 83 — 무너진 성소: 천계 잔존 + 심연
  {
    id: 83, chapter: 9, koreanName: '무너진 성소', gridCols: 4, dungeonHp: 11900,
    waves: [
      { wave: 1,  clearReward: 810,  invaders: [{ type: 'radiant_seraph', count: 4, spawnDelay: 1300 }, { type: 'abyss_reaver',  count: 3, spawnDelay: 1300 }] },
      { wave: 2,  clearReward: 890,  invaders: [{ type: 'divine_archer',  count: 5, spawnDelay: 1200 }, { type: 'abyss_reaver',  count: 3, spawnDelay: 1300 }] },
      { wave: 3,  clearReward: 975,  invaders: [{ type: 'abyss_reaver',   count: 4, spawnDelay: 1300 }, { type: 'radiant_seraph', count: 5, spawnDelay: 1300 }] },
      { wave: 4,  clearReward: 1065, invaders: [{ type: 'abyss_berserker', count: 5, spawnDelay: 1300 }, { type: 'divine_archer', count: 5, spawnDelay: 1200 }] },
      { wave: 5,  clearReward: 1165, invaders: [{ type: 'abyss_reaver',   count: 5, spawnDelay: 1300 }, { type: 'radiant_seraph', count: 5, spawnDelay: 1300 }, { type: 'void_soldier', count: 5, spawnDelay: 1400 }] },
      { wave: 6,  clearReward: 1270, invaders: [{ type: 'abyss_reaver',   count: 5, spawnDelay: 1300 }, { type: 'abyss_berserker', count: 6, spawnDelay: 1300 }] },
      { wave: 7,  clearReward: 1385, invaders: [{ type: 'radiant_seraph', count: 6, spawnDelay: 1300 }, { type: 'abyss_reaver',  count: 6, spawnDelay: 1300 }] },
      { wave: 8,  clearReward: 1505, invaders: [{ type: 'abyss_reaver',   count: 6, spawnDelay: 1300 }, { type: 'divine_archer',  count: 6, spawnDelay: 1200 }, { type: 'void_soldier', count: 6, spawnDelay: 1400 }] },
      { wave: 9,  clearReward: 1635, invaders: [{ type: 'abyss_berserker', count: 7, spawnDelay: 1300 }, { type: 'abyss_reaver',  count: 6, spawnDelay: 1300 }] },
      { wave: 10, clearReward: 6100, invaders: [{ type: 'abyss_reaver',   count: 7, spawnDelay: 1300 }, { type: 'radiant_seraph', count: 6, spawnDelay: 1300 }, { type: 'divine_archer', count: 6, spawnDelay: 1200 }] },
    ],
  },
  // Stage 84 — 빛바랜 천계: 원거리 밀집
  {
    id: 84, chapter: 9, koreanName: '빛바랜 천계', gridCols: 4, dungeonHp: 12200,
    waves: [
      { wave: 1,  clearReward: 835,  invaders: [{ type: 'divine_archer',  count: 5, spawnDelay: 1200 }, { type: 'abyss_reaver',  count: 3, spawnDelay: 1300 }] },
      { wave: 2,  clearReward: 918,  invaders: [{ type: 'radiant_seraph', count: 5, spawnDelay: 1300 }, { type: 'abyss_reaver',  count: 4, spawnDelay: 1300 }] },
      { wave: 3,  clearReward: 1005, invaders: [{ type: 'abyss_reaver',   count: 4, spawnDelay: 1300 }, { type: 'divine_archer',  count: 6, spawnDelay: 1200 }] },
      { wave: 4,  clearReward: 1100, invaders: [{ type: 'abyss_berserker', count: 5, spawnDelay: 1300 }, { type: 'radiant_seraph', count: 6, spawnDelay: 1300 }] },
      { wave: 5,  clearReward: 1200, invaders: [{ type: 'abyss_reaver',   count: 5, spawnDelay: 1300 }, { type: 'divine_archer',  count: 6, spawnDelay: 1200 }, { type: 'void_soldier', count: 5, spawnDelay: 1400 }] },
      { wave: 6,  clearReward: 1310, invaders: [{ type: 'radiant_seraph', count: 6, spawnDelay: 1300 }, { type: 'abyss_reaver',  count: 6, spawnDelay: 1300 }] },
      { wave: 7,  clearReward: 1425, invaders: [{ type: 'abyss_reaver',   count: 6, spawnDelay: 1300 }, { type: 'divine_archer',  count: 7, spawnDelay: 1200 }] },
      { wave: 8,  clearReward: 1550, invaders: [{ type: 'abyss_berserker', count: 6, spawnDelay: 1300 }, { type: 'radiant_seraph', count: 6, spawnDelay: 1300 }, { type: 'abyss_reaver', count: 5, spawnDelay: 1300 }] },
      { wave: 9,  clearReward: 1685, invaders: [{ type: 'abyss_reaver',   count: 7, spawnDelay: 1300 }, { type: 'divine_archer',  count: 7, spawnDelay: 1200 }] },
      { wave: 10, clearReward: 6300, invaders: [{ type: 'radiant_seraph', count: 7, spawnDelay: 1300 }, { type: 'abyss_reaver',  count: 7, spawnDelay: 1300 }, { type: 'divine_archer', count: 7, spawnDelay: 1200 }] },
    ],
  },
  // Stage 85 — 원초의 잔병: primordial_guard 복귀
  {
    id: 85, chapter: 9, koreanName: '원초의 잔병', gridCols: 4, dungeonHp: 12500,
    waves: [
      { wave: 1,  clearReward: 865,  invaders: [{ type: 'primordial_guard', count: 1, spawnDelay: 2600 }, { type: 'abyss_reaver',  count: 4, spawnDelay: 1300 }] },
      { wave: 2,  clearReward: 950,  invaders: [{ type: 'abyss_reaver',   count: 4, spawnDelay: 1300 }, { type: 'primordial_guard', count: 2, spawnDelay: 2600 }] },
      { wave: 3,  clearReward: 1040, invaders: [{ type: 'primordial_guard', count: 2, spawnDelay: 2600 }, { type: 'abyss_berserker', count: 5, spawnDelay: 1300 }] },
      { wave: 4,  clearReward: 1135, invaders: [{ type: 'abyss_reaver',   count: 5, spawnDelay: 1300 }, { type: 'primordial_guard', count: 2, spawnDelay: 2600 }] },
      { wave: 5,  clearReward: 1240, invaders: [{ type: 'primordial_guard', count: 2, spawnDelay: 2600 }, { type: 'abyss_reaver',  count: 5, spawnDelay: 1300 }, { type: 'divine_archer', count: 5, spawnDelay: 1200 }] },
      { wave: 6,  clearReward: 1350, invaders: [{ type: 'abyss_berserker', count: 6, spawnDelay: 1300 }, { type: 'primordial_guard', count: 3, spawnDelay: 2600 }] },
      { wave: 7,  clearReward: 1470, invaders: [{ type: 'abyss_reaver',   count: 6, spawnDelay: 1300 }, { type: 'primordial_guard', count: 3, spawnDelay: 2600 }] },
      { wave: 8,  clearReward: 1600, invaders: [{ type: 'primordial_guard', count: 3, spawnDelay: 2600 }, { type: 'abyss_reaver',  count: 6, spawnDelay: 1300 }, { type: 'radiant_seraph', count: 5, spawnDelay: 1300 }] },
      { wave: 9,  clearReward: 1735, invaders: [{ type: 'abyss_berserker', count: 7, spawnDelay: 1300 }, { type: 'primordial_guard', count: 4, spawnDelay: 2600 }] },
      { wave: 10, clearReward: 6500, invaders: [{ type: 'primordial_guard', count: 4, spawnDelay: 2600 }, { type: 'abyss_reaver',  count: 7, spawnDelay: 1300 }, { type: 'abyss_berserker', count: 6, spawnDelay: 1300 }] },
    ],
  },
  // Stage 86 — 공허의 심장부: 고강도 혼합
  {
    id: 86, chapter: 9, koreanName: '공허의 심장부', gridCols: 4, dungeonHp: 12800,
    waves: [
      { wave: 1,  clearReward: 895,  invaders: [{ type: 'abyss_reaver',   count: 5, spawnDelay: 1300 }, { type: 'primordial_guard', count: 2, spawnDelay: 2600 }] },
      { wave: 2,  clearReward: 982,  invaders: [{ type: 'primordial_guard', count: 2, spawnDelay: 2600 }, { type: 'abyss_berserker', count: 6, spawnDelay: 1300 }] },
      { wave: 3,  clearReward: 1075, invaders: [{ type: 'abyss_reaver',   count: 6, spawnDelay: 1300 }, { type: 'divine_archer',  count: 6, spawnDelay: 1200 }] },
      { wave: 4,  clearReward: 1175, invaders: [{ type: 'primordial_guard', count: 3, spawnDelay: 2600 }, { type: 'abyss_reaver',  count: 6, spawnDelay: 1300 }] },
      { wave: 5,  clearReward: 1280, invaders: [{ type: 'abyss_berserker', count: 7, spawnDelay: 1300 }, { type: 'radiant_seraph', count: 6, spawnDelay: 1300 }, { type: 'primordial_guard', count: 2, spawnDelay: 2600 }] },
      { wave: 6,  clearReward: 1395, invaders: [{ type: 'abyss_reaver',   count: 7, spawnDelay: 1300 }, { type: 'primordial_guard', count: 3, spawnDelay: 2600 }] },
      { wave: 7,  clearReward: 1520, invaders: [{ type: 'primordial_guard', count: 3, spawnDelay: 2600 }, { type: 'abyss_reaver',  count: 7, spawnDelay: 1300 }, { type: 'divine_archer', count: 6, spawnDelay: 1200 }] },
      { wave: 8,  clearReward: 1650, invaders: [{ type: 'abyss_berserker', count: 8, spawnDelay: 1300 }, { type: 'primordial_guard', count: 4, spawnDelay: 2600 }] },
      { wave: 9,  clearReward: 1790, invaders: [{ type: 'abyss_reaver',   count: 8, spawnDelay: 1300 }, { type: 'radiant_seraph', count: 6, spawnDelay: 1300 }, { type: 'primordial_guard', count: 3, spawnDelay: 2600 }] },
      { wave: 10, clearReward: 6700, invaders: [{ type: 'primordial_guard', count: 4, spawnDelay: 2600 }, { type: 'abyss_reaver',  count: 8, spawnDelay: 1300 }, { type: 'abyss_berserker', count: 7, spawnDelay: 1300 }] },
    ],
  },
  // Stage 87 — 깨어난 원초신: primordial_titan 미니보스
  {
    id: 87, chapter: 9, koreanName: '깨어난 원초신', gridCols: 4, dungeonHp: 13200,
    waves: [
      { wave: 1,  clearReward: 925,  invaders: [{ type: 'abyss_reaver',   count: 5, spawnDelay: 1300 }, { type: 'primordial_guard', count: 2, spawnDelay: 2600 }] },
      { wave: 2,  clearReward: 1015, invaders: [{ type: 'primordial_guard', count: 3, spawnDelay: 2600 }, { type: 'abyss_berserker', count: 6, spawnDelay: 1300 }] },
      { wave: 3,  clearReward: 1110, invaders: [{ type: 'abyss_reaver',   count: 6, spawnDelay: 1300 }, { type: 'primordial_guard', count: 3, spawnDelay: 2600 }] },
      { wave: 4,  clearReward: 1215, invaders: [{ type: 'primordial_guard', count: 3, spawnDelay: 2600 }, { type: 'abyss_reaver',  count: 6, spawnDelay: 1300 }, { type: 'divine_archer', count: 6, spawnDelay: 1200 }] },
      { wave: 5,  clearReward: 1325, invaders: [{ type: 'abyss_berserker', count: 7, spawnDelay: 1300 }, { type: 'primordial_guard', count: 4, spawnDelay: 2600 }] },
      { wave: 6,  clearReward: 1445, invaders: [{ type: 'primordial_titan', count: 1, spawnDelay: 6000 }, { type: 'abyss_reaver',  count: 6, spawnDelay: 1300 }] },
      { wave: 7,  clearReward: 1570, invaders: [{ type: 'primordial_guard', count: 4, spawnDelay: 2600 }, { type: 'abyss_reaver',  count: 7, spawnDelay: 1300 }] },
      { wave: 8,  clearReward: 1705, invaders: [{ type: 'abyss_berserker', count: 8, spawnDelay: 1300 }, { type: 'primordial_guard', count: 4, spawnDelay: 2600 }, { type: 'radiant_seraph', count: 5, spawnDelay: 1300 }] },
      { wave: 9,  clearReward: 1850, invaders: [{ type: 'abyss_reaver',   count: 8, spawnDelay: 1300 }, { type: 'primordial_guard', count: 5, spawnDelay: 2600 }] },
      { wave: 10, clearReward: 2000, invaders: [{ type: 'primordial_titan', count: 1, spawnDelay: 6000 }, { type: 'abyss_berserker', count: 7, spawnDelay: 1300 }, { type: 'abyss_reaver', count: 6, spawnDelay: 1300 }] },
      { wave: 11, clearReward: 2160, invaders: [{ type: 'primordial_guard', count: 5, spawnDelay: 2600 }, { type: 'abyss_reaver',  count: 8, spawnDelay: 1300 }] },
      { wave: 12, clearReward: 6950, invaders: [{ type: 'primordial_titan', count: 1, spawnDelay: 6000, isBoss: true }, { type: 'primordial_guard', count: 3, spawnDelay: 2600 }, { type: 'abyss_reaver', count: 6, spawnDelay: 1300 }] },
    ],
  },
  // Stage 88 — 균열의 군세: 12웨이브 압박
  {
    id: 88, chapter: 9, koreanName: '균열의 군세', gridCols: 4, dungeonHp: 13600,
    waves: [
      { wave: 1,  clearReward: 960,  invaders: [{ type: 'abyss_reaver',   count: 6, spawnDelay: 1300 }, { type: 'primordial_guard', count: 2, spawnDelay: 2600 }] },
      { wave: 2,  clearReward: 1052, invaders: [{ type: 'primordial_guard', count: 3, spawnDelay: 2600 }, { type: 'abyss_berserker', count: 7, spawnDelay: 1300 }] },
      { wave: 3,  clearReward: 1150, invaders: [{ type: 'abyss_reaver',   count: 7, spawnDelay: 1300 }, { type: 'divine_archer',  count: 6, spawnDelay: 1200 }] },
      { wave: 4,  clearReward: 1258, invaders: [{ type: 'primordial_guard', count: 3, spawnDelay: 2600 }, { type: 'abyss_reaver',  count: 7, spawnDelay: 1300 }, { type: 'radiant_seraph', count: 5, spawnDelay: 1300 }] },
      { wave: 5,  clearReward: 1372, invaders: [{ type: 'primordial_titan', count: 1, spawnDelay: 6000 }, { type: 'abyss_berserker', count: 7, spawnDelay: 1300 }] },
      { wave: 6,  clearReward: 1495, invaders: [{ type: 'abyss_reaver',   count: 8, spawnDelay: 1300 }, { type: 'primordial_guard', count: 4, spawnDelay: 2600 }] },
      { wave: 7,  clearReward: 1625, invaders: [{ type: 'primordial_guard', count: 4, spawnDelay: 2600 }, { type: 'abyss_reaver',  count: 8, spawnDelay: 1300 }, { type: 'divine_archer', count: 6, spawnDelay: 1200 }] },
      { wave: 8,  clearReward: 1765, invaders: [{ type: 'abyss_berserker', count: 8, spawnDelay: 1300 }, { type: 'primordial_titan', count: 1, spawnDelay: 6000 }] },
      { wave: 9,  clearReward: 1915, invaders: [{ type: 'abyss_reaver',   count: 8, spawnDelay: 1300 }, { type: 'primordial_guard', count: 5, spawnDelay: 2600 }] },
      { wave: 10, clearReward: 2070, invaders: [{ type: 'primordial_guard', count: 5, spawnDelay: 2600 }, { type: 'abyss_berserker', count: 9, spawnDelay: 1300 }, { type: 'abyss_reaver', count: 7, spawnDelay: 1300 }] },
      { wave: 11, clearReward: 2235, invaders: [{ type: 'abyss_reaver',   count: 9, spawnDelay: 1300 }, { type: 'primordial_guard', count: 5, spawnDelay: 2600 }] },
      { wave: 12, clearReward: 7200, invaders: [{ type: 'primordial_titan', count: 1, spawnDelay: 6000, isBoss: true }, { type: 'abyss_reaver', count: 8, spawnDelay: 1300 }, { type: 'primordial_guard', count: 4, spawnDelay: 2600 }] },
    ],
  },
  // Stage 89 — 종말의 전조: 14웨이브 생존
  {
    id: 89, chapter: 9, koreanName: '종말의 전조', gridCols: 4, dungeonHp: 14200,
    waves: [
      { wave: 1,  clearReward: 1000, invaders: [{ type: 'abyss_reaver',   count: 6, spawnDelay: 1300 }, { type: 'primordial_guard', count: 3, spawnDelay: 2600 }] },
      { wave: 2,  clearReward: 1095, invaders: [{ type: 'primordial_guard', count: 3, spawnDelay: 2600 }, { type: 'abyss_berserker', count: 8, spawnDelay: 1300 }] },
      { wave: 3,  clearReward: 1198, invaders: [{ type: 'abyss_reaver',   count: 8, spawnDelay: 1300 }, { type: 'divine_archer',  count: 7, spawnDelay: 1200 }] },
      { wave: 4,  clearReward: 1310, invaders: [{ type: 'primordial_titan', count: 1, spawnDelay: 6000 }, { type: 'abyss_reaver',  count: 7, spawnDelay: 1300 }] },
      { wave: 5,  clearReward: 1430, invaders: [{ type: 'primordial_guard', count: 4, spawnDelay: 2600 }, { type: 'abyss_berserker', count: 8, spawnDelay: 1300 }, { type: 'radiant_seraph', count: 6, spawnDelay: 1300 }] },
      { wave: 6,  clearReward: 1558, invaders: [{ type: 'abyss_reaver',   count: 9, spawnDelay: 1300 }, { type: 'primordial_guard', count: 4, spawnDelay: 2600 }] },
      { wave: 7,  clearReward: 1695, invaders: [{ type: 'primordial_titan', count: 1, spawnDelay: 6000 }, { type: 'abyss_berserker', count: 8, spawnDelay: 1300 }, { type: 'divine_archer', count: 6, spawnDelay: 1200 }] },
      { wave: 8,  clearReward: 1840, invaders: [{ type: 'primordial_guard', count: 5, spawnDelay: 2600 }, { type: 'abyss_reaver',  count: 9, spawnDelay: 1300 }] },
      { wave: 9,  clearReward: 1995, invaders: [{ type: 'abyss_berserker', count: 9, spawnDelay: 1300 }, { type: 'primordial_guard', count: 5, spawnDelay: 2600 }, { type: 'abyss_reaver', count: 7, spawnDelay: 1300 }] },
      { wave: 10, clearReward: 2160, invaders: [{ type: 'primordial_titan', count: 1, spawnDelay: 6000 }, { type: 'primordial_guard', count: 4, spawnDelay: 2600 }, { type: 'abyss_reaver', count: 7, spawnDelay: 1300 }] },
      { wave: 11, clearReward: 2335, invaders: [{ type: 'abyss_reaver',   count: 10, spawnDelay: 1200 }, { type: 'primordial_guard', count: 5, spawnDelay: 2600 }] },
      { wave: 12, clearReward: 2520, invaders: [{ type: 'abyss_berserker', count: 10, spawnDelay: 1200 }, { type: 'primordial_titan', count: 1, spawnDelay: 6000 }] },
      { wave: 13, clearReward: 2715, invaders: [{ type: 'primordial_guard', count: 6, spawnDelay: 2600 }, { type: 'abyss_reaver',  count: 9, spawnDelay: 1300 }, { type: 'radiant_seraph', count: 6, spawnDelay: 1300 }] },
      { wave: 14, clearReward: 7600, invaders: [{ type: 'primordial_titan', count: 2, spawnDelay: 6000, isBoss: true }, { type: 'abyss_reaver', count: 8, spawnDelay: 1300 }, { type: 'primordial_guard', count: 4, spawnDelay: 2600 }] },
    ],
  },
  // Stage 90 — 공허 군주의 강림: 최종 보스 (void_sovereign)
  {
    id: 90, chapter: 9, koreanName: '공허 군주의 강림', gridCols: 4, dungeonHp: 15000,
    waves: [
      { wave: 1,  clearReward: 1050, invaders: [{ type: 'abyss_reaver',   count: 7, spawnDelay: 1300 }, { type: 'primordial_guard', count: 3, spawnDelay: 2600 }] },
      { wave: 2,  clearReward: 1150, invaders: [{ type: 'primordial_guard', count: 4, spawnDelay: 2600 }, { type: 'abyss_berserker', count: 8, spawnDelay: 1300 }] },
      { wave: 3,  clearReward: 1258, invaders: [{ type: 'primordial_titan', count: 1, spawnDelay: 6000 }, { type: 'abyss_reaver',  count: 7, spawnDelay: 1300 }] },
      { wave: 4,  clearReward: 1375, invaders: [{ type: 'abyss_reaver',   count: 9, spawnDelay: 1300 }, { type: 'primordial_guard', count: 4, spawnDelay: 2600 }, { type: 'divine_archer', count: 7, spawnDelay: 1200 }] },
      { wave: 5,  clearReward: 1500, invaders: [{ type: 'primordial_titan', count: 1, spawnDelay: 6000 }, { type: 'abyss_berserker', count: 9, spawnDelay: 1300 }] },
      { wave: 6,  clearReward: 1635, invaders: [{ type: 'primordial_guard', count: 5, spawnDelay: 2600 }, { type: 'abyss_reaver',  count: 9, spawnDelay: 1300 }] },
      { wave: 7,  clearReward: 1780, invaders: [{ type: 'abyss_berserker', count: 10, spawnDelay: 1200 }, { type: 'primordial_titan', count: 1, spawnDelay: 6000 }, { type: 'radiant_seraph', count: 6, spawnDelay: 1300 }] },
      { wave: 8,  clearReward: 1935, invaders: [{ type: 'primordial_guard', count: 5, spawnDelay: 2600 }, { type: 'abyss_reaver',  count: 10, spawnDelay: 1200 }] },
      { wave: 9,  clearReward: 2100, invaders: [{ type: 'primordial_titan', count: 2, spawnDelay: 6000 }, { type: 'abyss_berserker', count: 9, spawnDelay: 1300 }] },
      { wave: 10, clearReward: 2275, invaders: [{ type: 'abyss_reaver',   count: 10, spawnDelay: 1200 }, { type: 'primordial_guard', count: 6, spawnDelay: 2600 }, { type: 'divine_archer', count: 7, spawnDelay: 1200 }] },
      { wave: 11, clearReward: 2460, invaders: [{ type: 'primordial_titan', count: 2, spawnDelay: 6000 }, { type: 'abyss_reaver',  count: 9, spawnDelay: 1300 }] },
      { wave: 12, clearReward: 2655, invaders: [{ type: 'primordial_guard', count: 6, spawnDelay: 2600 }, { type: 'abyss_berserker', count: 10, spawnDelay: 1200 }, { type: 'abyss_reaver', count: 8, spawnDelay: 1300 }] },
      { wave: 13, clearReward: 2860, invaders: [{ type: 'primordial_titan', count: 2, spawnDelay: 6000 }, { type: 'primordial_guard', count: 5, spawnDelay: 2600 }, { type: 'abyss_reaver', count: 8, spawnDelay: 1300 }] },
      { wave: 14, clearReward: 3500, invaders: [{ type: 'primordial_titan', count: 2, spawnDelay: 6000, isBoss: true }, { type: 'abyss_reaver', count: 9, spawnDelay: 1300 }, { type: 'primordial_guard', count: 4, spawnDelay: 2600 }] },
      { wave: 15, clearReward: 9500, invaders: [{ type: 'void_sovereign', count: 1, spawnDelay: 8000, isBoss: true }, { type: 'primordial_titan', count: 1, spawnDelay: 6000 }, { type: 'abyss_reaver', count: 5, spawnDelay: 1300 }] },
    ],
  },
];
