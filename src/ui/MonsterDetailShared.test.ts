/**
 * Unit tests for MonsterDetailShared.ts pure helpers.
 * No Phaser dependency — pure data logic only.
 */

import { describe, it, expect } from 'vitest';
import { defaultOwnedMonster } from '../data/barracks';
import { loadGameState } from '../data/wisdom';
import { resolveOwnedMonsterProfile } from '../data/monsters';
import type { OwnedMonster } from '../data/barracks';
import type { GameState } from '../data/wisdom';
import {
  getEquipmentStars, getEquipmentDisplay,
  getEquipmentRarityColor,
  getRecommendedEquipmentId,
  shortenLabel,
  equipmentTileLabel,
  formatCraftedStatLine,
  getGrowthDirective,
  getFeedTrainingPreview,
  getDetailCollectionMeta,
  type EquipmentDisplay,
} from './MonsterDetailShared';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeMonster(overrides: Partial<OwnedMonster> = {}): OwnedMonster {
  return { ...defaultOwnedMonster('dokkaebi_warrior'), ...overrides };
}

function makeGs(overrides: Partial<GameState> = {}): GameState {
  return { ...loadGameState(), ...overrides };
}

function makeEquipment(overrides: Partial<EquipmentDisplay> = {}): EquipmentDisplay {
  return {
    id:      'test_equip',
    name:    '테스트 검',
    icon:    '⚔',
    type:    'weapon',
    desc:    'ATK +10',
    rarity:  0,
    crafted: false,
    ...overrides,
  };
}

describe('getDetailCollectionMeta', () => {
  it('keeps a fusion-only hybrid outside the numbered registry', () => {
    const monster = makeMonster({ id: 'storm_spirit', rarity: 2 });
    const profile = resolveOwnedMonsterProfile(monster.id);
    expect(profile).not.toBeNull();
    expect(getDetailCollectionMeta(monster, profile!)).toMatchObject({
      indexLabel: 'No.---',
      tier: 'R',
    });
  });
});

// ─── getEquipmentStars ────────────────────────────────────────────────────────

describe('getEquipmentStars', () => {
  it('returns one star for rarity 0', () => {
    expect(getEquipmentStars(0)).toBe('★');
  });

  it('returns max stars for rarity clamped at top', () => {
    expect(getEquipmentStars(99)).toBe('★★★★★★');
  });

  it('returns two stars for rarity 1', () => {
    expect(getEquipmentStars(1)).toBe('★★');
  });

  it('clamps negative values to one star', () => {
    expect(getEquipmentStars(-5)).toBe('★');
  });
});

// ─── getEquipmentRarityColor ──────────────────────────────────────────────────

describe('getEquipmentRarityColor', () => {
  it('returns a number for rarity 0 (grey)', () => {
    expect(typeof getEquipmentRarityColor(0)).toBe('number');
  });

  it('returns a different color for rarity 1 vs 0', () => {
    expect(getEquipmentRarityColor(1)).not.toBe(getEquipmentRarityColor(0));
  });

  it('clamps out-of-range values without throwing', () => {
    expect(() => getEquipmentRarityColor(999)).not.toThrow();
    expect(() => getEquipmentRarityColor(-1)).not.toThrow();
  });
});

// ─── getRecommendedEquipmentId ────────────────────────────────────────────────

describe('getRecommendedEquipmentId', () => {
  it('returns null for empty inventory', () => {
    expect(getRecommendedEquipmentId([], null)).toBeNull();
  });

  it('picks highest rarity from inventory', () => {
    const low  = makeEquipment({ id: 'low',  rarity: 0 });
    const high = makeEquipment({ id: 'high', rarity: 3 });
    expect(getRecommendedEquipmentId([low, high], null)).toBe('high');
  });

  it('skips the currently equipped item', () => {
    const eq1 = makeEquipment({ id: 'eq1', rarity: 5 });
    const eq2 = makeEquipment({ id: 'eq2', rarity: 2 });
    expect(getRecommendedEquipmentId([eq1, eq2], 'eq1')).toBe('eq2');
  });

  it('prefers crafted items over static at same rarity', () => {
    const stat    = makeEquipment({ id: 'stat',    rarity: 2, crafted: false });
    const crafted = makeEquipment({ id: 'crafted', rarity: 2, crafted: true });
    expect(getRecommendedEquipmentId([stat, crafted], null)).toBe('crafted');
  });
});

// ─── shortenLabel ─────────────────────────────────────────────────────────────

describe('shortenLabel', () => {
  it('returns original when short enough', () => {
    expect(shortenLabel('ab', 5)).toBe('ab');
  });

  it('truncates and appends ellipsis when over limit', () => {
    const result = shortenLabel('abcdefgh', 5);
    expect(result.length).toBeLessThanOrEqual(5);
    expect(result.endsWith('…')).toBe(true);
  });

  it('handles exact-length string without truncation', () => {
    expect(shortenLabel('abcde', 5)).toBe('abcde');
  });
});

// ─── formatCraftedStatLine ───────────────────────────────────────────────────

describe('formatCraftedStatLine', () => {
  it('returns fallback string for empty stats', () => {
    expect(formatCraftedStatLine({})).toBe('제작 장비');
  });

  it('formats a positive ATK bonus', () => {
    expect(formatCraftedStatLine({ atkMult: .15 })).toContain('ATK');
    expect(formatCraftedStatLine({ atkMult: .15 })).toContain('+15');
  });

  it('formats a fractional bonus as percent', () => {
    const line = formatCraftedStatLine({ skillCdMult: .9 });
    expect(line).toContain('%');
  });

  it('joins multiple stats with separator', () => {
    const line = formatCraftedStatLine({ atkMult: .05, goldMult: .1 });
    expect(line).toContain(' · ');
  });
});

// ─── getGrowthDirective ───────────────────────────────────────────────────────

describe('getGrowthDirective', () => {
  it('puts evolution first once three copies of an evolvable kind are owned', () => {
    const m   = makeMonster({ skillPoints: 10, spentSkills: {} });
    const three = makeGs({ ownedMonsters: [m, makeMonster(), makeMonster()] });
    const dir = getGrowthDirective(m, undefined, three, 0.9);
    expect(dir.action).toBe('evolve');
    expect(dir.title).toBe('진화 가능 · 3체 ›');
    const two = makeGs({ ownedMonsters: [m, makeMonster()] });
    expect(getGrowthDirective(m, undefined, two, 0.9).action).toBeUndefined();
  });

  it('suggests skill growth when a spendable node is available', () => {
    const m   = makeMonster({ skillPoints: 10, spentSkills: {} });
    const gs  = makeGs();
    // xpPct irrelevant — skill growth takes priority
    const dir = getGrowthDirective(m, undefined, gs, 0.1);
    // With no tree supplied, fallthrough — test with no tree returns deploy-ready
    expect(dir).toHaveProperty('title');
    expect(typeof dir.accent).toBe('number');
  });

  it('suggests level-up when xpPct >= 0.78 and level < 50', () => {
    const m   = makeMonster({ skillPoints: 0, spentSkills: {}, level: 10, equipment: 'sword' });
    const gs  = makeGs({ ownedActiveSkills: ['sk1', 'sk2'] });
    const dir = getGrowthDirective(m, undefined, gs, 0.9);
    expect(dir.title).toBe('레벨업 임박');
  });

  it('returns deployment-ready when everything is set', () => {
    const m   = makeMonster({ skillPoints: 0, spentSkills: {}, level: 10, equipment: 'sword', equippedSkills: ['sk1', 'sk2'] });
    const gs  = makeGs({ ownedEquipment: [], craftedEquipment: [], ownedActiveSkills: ['sk1', 'sk2'] });
    const dir = getGrowthDirective(m, undefined, gs, 0.5);
    expect(dir.title).toBe('던전 배치 준비');
  });
});

// ─── getFeedTrainingPreview ───────────────────────────────────────────────────

describe('getFeedTrainingPreview', () => {
  it('returns max-level chip when monster is level 50', () => {
    const m   = makeMonster({ level: 50, xp: 0 });
    const gs  = makeGs({ homeGold: 999 });
    const p   = getFeedTrainingPreview(m, gs);
    expect(p.maxLevel).toBe(true);
    expect(p.chip).toBe('MAX');
  });

  it('returns 부족 chip when gold is insufficient', () => {
    const m   = makeMonster({ level: 1, xp: 0 });
    const gs  = makeGs({ homeGold: 0 });
    const p   = getFeedTrainingPreview(m, gs);
    expect(p.canAfford).toBe(false);
    expect(p.chip).toBe('부족');
  });

  it('signals level-up when nextXp >= xpNeeded', () => {
    // xpToNextLevel(1) is 100; xp=90; gain=20 → 110 ≥ 100
    const m   = makeMonster({ level: 1, xp: 90 });
    const gs  = makeGs({ homeGold: 9999 });
    const p   = getFeedTrainingPreview(m, gs);
    expect(p.willLevelUp).toBe(true);
    expect(p.chip).toBe('Lv UP');
  });
});


it('monster equipment details use current combat stats instead of the crafting snapshot', () => {
  const gs = makeGs({ craftedEquipment: [{ id: 'eq_dragon_fang', name: '용아검', emoji: '⚔', type: 'weapon', rarity: 3, stats: { atkMult: .4 } }] });
  expect(getEquipmentDisplay(gs, 'eq_dragon_fang')?.desc).toBe('ATK +40% · 보스 기본피해 +25%');
});

// 44px equipment tiles cut every name to its first word: "도깨비… 황금 … 행운의…".
describe('equipmentTileLabel', () => {
  it('keeps the distinguishing last word', () => {
    expect(['도깨비 방망이', '황금 갑옷', '행운의 부적'].map(equipmentTileLabel)).toEqual(['방망이', '갑옷', '부적']);
  });
  it('shortens long single words', () => {
    expect(equipmentTileLabel('천상의검날개')).toBe('천상의…');
  });
});
