import { describe, expect, it } from 'vitest';
import { MAIN_QUESTS } from './questData';
import { questObjectiveDestination } from './questRoutes';

// MQ-005 "소환 1회 실행" sat unfinished through all of Chapter 1: the quest log
// named the objective but offered no way to the screen that completes it, and
// Home's directive is always taken by room work.
describe('quest objective routes', () => {
  it('routes screen-bound objectives to their scene', () => {
    expect(questObjectiveDestination('summon')).toBe('SummonScene');
    expect(questObjectiveDestination('fuse_monsters')).toBe('FusionScene');
    expect(questObjectiveDestination('feed_monster')).toBe('BarracksScene');
    expect(questObjectiveDestination('complete_stage')).toBe('StageSelectScene');
  });
  it('leaves Home-bound and passive objectives unrouted', () => {
    expect(['build_room', 'assign_monster', 'upgrade_room', 'defend_invasion', 'reach_dm_level', 'collect_gold']
      .map(type => questObjectiveDestination(type as never))).toEqual([null, null, null, null, null, null]);
  });
  it('gives every main-quest summon objective a route', () => {
    const summons = MAIN_QUESTS.flatMap(q => q.objectives).filter(o => o.type === 'summon');
    expect(summons.length).toBeGreaterThan(0);
    expect(summons.every(o => questObjectiveDestination(o.type) === 'SummonScene')).toBe(true);
  });
});
