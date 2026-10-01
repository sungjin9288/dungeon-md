/**
 * Unit tests for ForgeShared.ts pure helpers.
 * No Phaser dependency — pure data logic only.
 */

import { describe, it, expect } from 'vitest';
import { BLUEPRINT_DEFS } from '../data/fusion';
import { defaultOwnedMonster } from '../data/barracks';
import { getMonsterDefForOwned } from '../data/forgeRecommendations';
import { loadGameState } from '../data/wisdom';
import {
  getForgeShortageSource,
  getBlueprintMaterialProgress,
  getForgeRarityStars,
  summarizeStatEffects,
  getForgeNeedLabel,
  buildForgeTargetCue,
  formatForgeMaterialStatus,
  getFocusMonsterDisplay,
} from './ForgeShared';
import type { GameState } from '../data/wisdom';
import type { OwnedMonster } from '../data/barracks';

function makeMonster(overrides: Partial<OwnedMonster> = {}): OwnedMonster {
  return { ...defaultOwnedMonster('dokkaebi_warrior'), ...overrides };
}

function makeGs(monsters: OwnedMonster[] = []): GameState {
  return { ...loadGameState(), ownedMonsters: monsters, dungeonSlots: [] };
}

describe('getBlueprintMaterialProgress', () => {
  const bp = Object.values(BLUEPRINT_DEFS)[0];

  it('reports ratio 0 with no materials', () => {
    const { have, need, ratio } = getBlueprintMaterialProgress(bp, {});
    expect(have).toBe(0);
    expect(need).toBeGreaterThan(0);
    expect(ratio).toBe(0);
  });

  it('reports ratio 1 when all materials are owned', () => {
    const full = { ...bp.materials };
    const { ratio } = getBlueprintMaterialProgress(bp, full);
    expect(ratio).toBe(1);
  });

  it('caps "have" at the needed quantity (surplus does not overflow)', () => {
    const surplus = Object.fromEntries(
      Object.entries(bp.materials).map(([id, qty]) => [id, qty + 99]),
    );
    const { have, need, ratio } = getBlueprintMaterialProgress(bp, surplus);
    expect(have).toBe(need);
    expect(ratio).toBe(1);
  });
});

describe('formatForgeMaterialStatus', () => {
  const material = {
    id: 'iron_shard', name: '철 조각', emoji: '⚙️', have: 2, need: 3, missing: 1,
  };

  it('labels a missing material with the exact deficit', () => {
    expect(formatForgeMaterialStatus(material)).toBe('철 조각 2/3 · 부족 1');
  });

  it('labels a fulfilled material without a false zero deficit', () => {
    expect(formatForgeMaterialStatus({ ...material, have: 3, missing: 0 }))
      .toBe('철 조각 3/3 · 충족');
  });
});

describe('getForgeRarityStars', () => {
  it('maps rarity index to a star string and clamps the range', () => {
    expect(getForgeRarityStars(0)).toBe('★');
    expect(getForgeRarityStars(2)).toBe('★★★');
    expect(getForgeRarityStars(-5)).toBe('★');         // clamps to min
    expect(getForgeRarityStars(99)).toBe('★★★★★★');     // clamps to max
  });
});

describe('summarizeStatEffects', () => {
  it('formats known stat keys into Korean labels', () => {
    expect(summarizeStatEffects({ atkMult: 1.2 }, 'x')).toEqual(['ATK +20%']);
    expect(summarizeStatEffects({ roomHpBonus: 50 }, 'x')).toEqual(['방 HP +50']);
  });

  it('falls back when there are no stats, and caps at 3 labels', () => {
    expect(summarizeStatEffects({}, '기본 장비')).toEqual(['기본 장비']);
    const many = summarizeStatEffects(
      { atkMult: 1.1, roomHpBonus: 10, goldBonus: 0.2, scEarnBonus: 0.3 },
      'x',
    );
    expect(many.length).toBe(3);
  });
});

describe('getForgeNeedLabel', () => {
  it('recommends gear type by monster role', () => {
    expect(getForgeNeedLabel(null)).toBe('무기 추천');
    expect(getForgeNeedLabel({ type: 'magic' } as never)).toBe('장신구 추천');
    expect(getForgeNeedLabel({ type: 'support' } as never)).toBe('방어구 추천');
    // A real melee-ish def resolves to the weapon recommendation.
    expect(getForgeNeedLabel(getMonsterDefForOwned('dokkaebi_warrior'))).toBe('무기 추천');
  });
});

describe('getFocusMonsterDisplay', () => {
  it('shows the resolved name and emoji for a fusion-only hybrid', () => {
    const monster = makeMonster({ id: 'storm_spirit', level: 9 });
    expect(getFocusMonsterDisplay(makeGs([monster]), monster.id)).toEqual({
      name: '폭풍 정령',
      emoji: '⚡',
      level: 9,
    });
  });
});

describe('buildForgeTargetCue', () => {
  it('ranks the focused monster above an identical non-focused one', () => {
    const monster = makeMonster({ level: 5 });
    const gs = makeGs([monster]);
    const focused = buildForgeTargetCue(gs, monster, monster.id);
    const unfocused = buildForgeTargetCue(gs, monster, null);
    expect(focused.priority).toBeGreaterThan(unfocused.priority);
    expect(focused.monsterId).toBe(monster.id);
  });
});

describe('getForgeShortageSource', () => {
  const material = (id: string, have: number, need: number) =>
    ({ id, name: id, emoji: '', have, need, missing: Math.max(0, need - have) });

  it('names where the first missing abyss material drops', () => {
    expect(getForgeShortageSource([material('iron_shard', 4, 2), material('dok_fragment', 1, 3)]))
      .toEqual({ materialId: 'dok_fragment', label: '심연 1층~' });
  });

  it('is null when nothing is missing or nothing missing drops in the abyss', () => {
    expect(getForgeShortageSource([material('iron_shard', 4, 2)])).toBeNull();
    expect(getForgeShortageSource([material('not_a_material', 0, 2)])).toBeNull();
  });
});
