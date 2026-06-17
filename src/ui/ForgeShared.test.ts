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
  getBlueprintMaterialProgress,
  getForgeRarityStars,
  summarizeStatEffects,
  getForgeNeedLabel,
  buildForgeTargetCue,
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
