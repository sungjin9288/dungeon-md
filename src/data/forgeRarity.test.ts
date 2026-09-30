import { describe, expect, it } from 'vitest';
import {
  BLUEPRINT_DEFS,
  FORGE_RARITY_NAMES,
  RARITY_COLORS,
  RARITY_NAMES,
  forgeRarityCss,
  forgeRarityHex,
  forgeRarityName,
} from './fusion';
import { getForgeRarityHex } from './forgeRecommendations';
import { getForgeRarityStars, rarityHex } from '../ui/ForgeShared';

describe('제작 장비 등급', () => {
  it('0~4는 몬스터 등급표 그대로, 5는 원초 장비의 "특수"', () => {
    expect([0, 1, 2, 3, 4].map(forgeRarityName)).toEqual([...RARITY_NAMES]);
    expect([0, 1, 2, 3, 4].map(forgeRarityCss)).toEqual([...RARITY_COLORS]);
    expect(forgeRarityName(5)).toBe('특수');
    expect(FORGE_RARITY_NAMES).toHaveLength(6);
  });

  it('범위 밖 값은 가장 가까운 등급으로 — 표 밖으로 떨어져 "일반"·회색이 되지 않는다', () => {
    expect(forgeRarityName(9)).toBe('특수');
    expect(forgeRarityName(-1)).toBe('일반');
  });

  it('모든 설계도 등급은 이름·색·별을 가진다(원초의 보석 = 특수·별 6개)', () => {
    for (const bp of Object.values(BLUEPRINT_DEFS)) {
      expect(FORGE_RARITY_NAMES).toContain(forgeRarityName(bp.rarity));
      expect(getForgeRarityStars(bp.rarity)).toHaveLength(bp.rarity + 1);
    }
    expect(forgeRarityName(BLUEPRINT_DEFS.bp_primordial_gem.rarity)).toBe('특수');
    expect(forgeRarityName(BLUEPRINT_DEFS.bp_ember_reaver.rarity)).toBe('전설');
  });

  it('공방의 색 함수들이 같은 값을 준다', () => {
    for (let r = 0; r <= 5; r++) {
      expect(rarityHex(r)).toBe(forgeRarityHex(r));
      expect(getForgeRarityHex(r)).toBe(forgeRarityHex(r));
    }
  });
});
