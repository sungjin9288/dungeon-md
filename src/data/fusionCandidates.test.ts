import { describe, expect, it } from 'vitest';
import { defaultOwnedMonster } from './barracks';
import { listEvolutionCandidates, pickEvolutionMaterials } from './fusionCandidates';
import { applyFusionEvolution } from './fusionTransactions';
import type { GameState } from './wisdom';

const monster = (id: string, level = 1) => ({ ...defaultOwnedMonster(id), level });

describe('진화 후보', () => {
  it('진화 가능한 종류만, 바로 가능한 것 먼저 · 많이 모은 순', () => {
    const owned = [
      monster('gumiho_guardian'), monster('gumiho_guardian'),
      monster('dokkaebi_warrior'), monster('dokkaebi_warrior'), monster('dokkaebi_warrior'),
    ];
    const list = listEvolutionCandidates(owned);
    expect(list.map(c => [c.id, c.count, c.ready])).toEqual([
      ['dokkaebi_warrior', 3, true],
      ['gumiho_guardian', 2, false],
    ]);
    expect(list[0].resultId).toBe('dokkaebi_warrior_unc');
  });

  it('재료 자동 선택: 최고 레벨 1체 + 최저 레벨 2체 — 결속 뒤 남는 복사본의 레벨이 가장 높다', () => {
    const owned = [monster('dokkaebi_warrior', 4), monster('dokkaebi_warrior', 9),
      monster('dokkaebi_warrior', 1), monster('dokkaebi_warrior', 2), monster('dokkaebi_warrior', 6)];
    const picked = pickEvolutionMaterials(owned, 'dokkaebi_warrior');
    expect(picked.map(m => m.level)).toEqual([9, 1, 2]);
    const result = applyFusionEvolution({ ownedMonsters: owned, totalFusions: 0 } as unknown as GameState, picked);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.monster.level).toBe(9);
    expect(result.state.ownedMonsters.filter(m => m.id === 'dokkaebi_warrior').map(m => m.level).sort()).toEqual([4, 6]);
    expect(pickEvolutionMaterials(owned.slice(0, 2), 'dokkaebi_warrior')).toEqual([]);
  });
});
