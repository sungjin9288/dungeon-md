import { describe, expect, it } from 'vitest';
import { BLUEPRINT_DEFS } from './fusion';
import {
  ABYSS_BLUEPRINT_FLOORS,
  ADVENTURER_BLUEPRINT_POOL,
  adventurerBlueprintFor,
  abyssBlueprintFor,
  getBlueprintSource,
  grantBlueprint,
} from './blueprintSources';
import { clearAbyssFloor } from './abyssTransactions';
import { loadGameState } from './wisdom';

describe('설계도 획득처', () => {
  it('모든 설계도는 얻을 곳이 있다(13종이 획득처 없이 잠겨 있던 결함의 가드)', () => {
    const orphans = Object.keys(BLUEPRINT_DEFS).filter(id => getBlueprintSource(id) === null);
    expect(orphans).toEqual([]);
  });

  it('한 설계도는 한 곳에서만 나온다(표끼리 겹치지 않는다)', () => {
    const abyss = Object.values(ABYSS_BLUEPRINT_FLOORS);
    const adventurer = ADVENTURER_BLUEPRINT_POOL.map(entry => entry.id);
    expect(new Set([...abyss, ...adventurer]).size).toBe(abyss.length + adventurer.length);
    for (const id of [...abyss, ...adventurer]) expect(BLUEPRINT_DEFS[id], id).toBeDefined();
  });

  it('모험가 파티: 명성 단계에서 열린 것 중 아직 없는 첫 장, 다 가지면 없음', () => {
    expect(adventurerBlueprintFor({ blueprints: [] }, 1)).toBe('bp_herb_potion');
    expect(adventurerBlueprintFor({ blueprints: ['bp_herb_potion', 'bp_soul_ring'] }, 1)).toBeNull();
    expect(adventurerBlueprintFor({ blueprints: ['bp_herb_potion', 'bp_soul_ring'] }, 2)).toBe('bp_shadow_blade');
    const all = ADVENTURER_BLUEPRINT_POOL.map(entry => entry.id);
    expect(adventurerBlueprintFor({ blueprints: all }, 10)).toBeNull();
  });

  it('심연: 보스층 첫 정복에만 한 번, 이미 있으면 주지 않는다', () => {
    expect(abyssBlueprintFor({ blueprints: [] }, 10)).toBe('bp_fox_robe');
    expect(abyssBlueprintFor({ blueprints: [] }, 11)).toBeNull();
    expect(abyssBlueprintFor({ blueprints: ['bp_fox_robe'] }, 10)).toBeNull();
    const state = { ...loadGameState(), abyss: { ...loadGameState().abyss, highestFloor: 9 } };
    const first = clearAbyssFloor(state, 10, () => 0.5);
    expect(first.blueprint).toBe('bp_fox_robe');
    expect(first.state.blueprints).toContain('bp_fox_robe');
    const replay = clearAbyssFloor(first.state, 10, () => 0.5);
    expect(replay.blueprint).toBeNull();
    expect(replay.state.blueprints.filter(id => id === 'bp_fox_robe')).toHaveLength(1);
  });

  it('grantBlueprint는 중복을 만들지 않고 입력을 바꾸지 않는다', () => {
    const before = { blueprints: ['bp_iron_armor'] };
    expect(grantBlueprint(before, 'bp_iron_armor')).toBe(before);
    expect(grantBlueprint(before, 'bp_soul_ring').blueprints).toEqual(['bp_iron_armor', 'bp_soul_ring']);
    expect(before.blueprints).toEqual(['bp_iron_armor']);
  });
});
