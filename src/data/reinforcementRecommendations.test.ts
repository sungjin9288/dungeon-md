import { describe, expect, it } from 'vitest';
import { defaultOwnedMonster } from './barracks';
import { calculateRoomMetrics } from './dungeonMetrics';
import { projectRoomReinforcement, rankGrowthRecommendations } from './reinforcementRecommendations';
import type { DungeonSlot, GameState } from './wisdom';

function fixture(): GameState {
  const ids = ['dokkaebi_warrior', 'dokkaebi_warrior_high'];
  return {
    homeGold: 100, ownedEquipment: [], craftedEquipment: [],
    ownedMonsters: ids.map(id => ({ ...defaultOwnedMonster(id), xp: 80 })),
    dungeonSlots: ids.map((id, i): DungeonSlot => ({
      roomType: 'combat', roomLevel: i === 0 ? 1 : 5,
      hp: 450, maxHp: 450, monsterIds: [id], trapIds: [],
    })),
  } as unknown as GameState;
}

describe('방 레벨을 반영한 성장 추천', () => {
  it('같은 수호자 성장의 Lv5 방 기여를 Lv1보다 크게 평가한다', () => {
    const state = fixture();
    const low = projectRoomReinforcement(state, 'dokkaebi_warrior', { level: 2 });
    const high = projectRoomReinforcement(state, 'dokkaebi_warrior_high', { level: 2 });
    expect(low.power).toEqual({ before: 23, after: 24, delta: 1 });
    expect(high.power).toEqual({ before: 88, after: 92, delta: 4 });
    const ranked = rankGrowthRecommendations(state);
    expect(ranked.map(item => item.monsterId)).toEqual(['dokkaebi_warrior_high', 'dokkaebi_warrior']);
    expect(ranked[0].action).toBe('level-up');
    expect(ranked[0].estimatedPowerDelta).toBe(4);
    expect(ranked[0].score - ranked[1].score).toBe(3);
  });

  it('장비 미리보기와 실제 적용 후 점수가 같고 원본은 변경하지 않는다', () => {
    const state = fixture();
    const original = structuredClone(state);
    const projection = projectRoomReinforcement(state, 'dokkaebi_warrior_high', { equipment: 'eq_dokkaebi_club' });
    const next = { ...state, ownedMonsters: state.ownedMonsters.map(monster =>
      monster.id === 'dokkaebi_warrior_high' ? { ...monster, equipment: 'eq_dokkaebi_club' } : monster) };
    expect(projection.power?.after).toBe(calculateRoomMetrics(next, next.dungeonSlots[1]).threatScore);
    expect(projection.power!.delta).toBeGreaterThan(0);
    expect(state).toEqual(original);
  });

  it('배치되지 않은 수호자는 방 전력을 추측하지 않는다', () => {
    const state = fixture();
    state.dungeonSlots = [];
    expect(projectRoomReinforcement(state, 'dokkaebi_warrior', { level: 2 }).power).toBeNull();
  });
});
