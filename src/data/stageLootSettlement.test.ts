import { describe, expect, it } from 'vitest';
import { applyBattleReturnSettlement, STAGE_CLEAR_DM_XP, STAGE_DEFEAT_DM_XP } from './invasionTransactions';
import { loadGameState, type GameState } from './wisdom';

// Campaign stages entered from 침공 전선 have no `returnTo`, so their loot never
// reached Home: the clear screen showed "황금 965 · 낡은 천 ×3" while the save kept
// its old gold, DM XP and materials. Stage clears now settle through the same
// transaction, without counting as a story-invasion defense.
function mq3State(): GameState {
  return {
    ...loadGameState(),
    homeGold: 866, dmXP: 130, dmLevel: 3, materials: {},
    activeMainQuestId: 'MQ-003',
    questProgress: { 'MQ-003': { objectives: { O1: 0 }, completed: false } },
  };
}

describe('stage clear loot settlement', () => {
  it('credits loot gold, clear DM XP and run materials', () => {
    const settled = applyBattleReturnSettlement(
      mq3State(),
      { won: true, goldEarned: 965, dmXP: STAGE_CLEAR_DM_XP, materialsEarned: { old_cloth: 3 } },
      { defendInvasion: false },
    );
    expect(settled.state.homeGold).toBe(866 + 965);
    expect(settled.state.dmXP).toBe(280);
    expect(settled.state.materials).toEqual({ old_cloth: 3 });
  });

  it('does not tick the story-invasion objective for a campaign stage', () => {
    const stage = applyBattleReturnSettlement(mq3State(), { won: true, goldEarned: 0, dmXP: 0 }, { defendInvasion: false });
    expect(stage.defendUpdate).toBeNull();
    expect(stage.state.questProgress['MQ-003'].objectives.O1).toBe(0);
    const invasion = applyBattleReturnSettlement(mq3State(), { won: true, goldEarned: 0, dmXP: 0 });
    expect(invasion.defendUpdate?.questDone).toBe(true);
  });

  // A lost campaign stage had no exit but reset/revive. Retreating home pays
  // the loot gathered and the defeat DM XP, like a lost story invasion.
  it('settles a stage retreat with loot and defeat DM XP only', () => {
    const lost = applyBattleReturnSettlement(
      mq3State(),
      { won: false, goldEarned: 120, dmXP: STAGE_DEFEAT_DM_XP, materialsEarned: {} },
      { defendInvasion: false },
    );
    expect(lost.state.homeGold).toBe(866 + 120);
    expect(lost.state.dmXP).toBe(130 + STAGE_DEFEAT_DM_XP);
    expect(lost.defendUpdate).toBeNull();
  });
});
