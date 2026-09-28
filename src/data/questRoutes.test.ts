import { describe, expect, it } from 'vitest';
import { MAIN_QUESTS } from './questData';
import { FORECAST_ROUTE, questObjectiveDestination } from './questRoutes';

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
    expect(['build_room', 'assign_monster', 'upgrade_room', 'reach_dm_level', 'collect_gold']
      .map(type => questObjectiveDestination(type as never))).toEqual([null, null, null, null, null]);
  });
  it('routes defend_invasion to the 오늘의 손님 tray, whose battle wins count', () => {
    expect(questObjectiveDestination('defend_invasion')).toBe(FORECAST_ROUTE);
  });
  it('gives every main-quest summon objective a route', () => {
    const summons = MAIN_QUESTS.flatMap(q => q.objectives).filter(o => o.type === 'summon');
    expect(summons.length).toBeGreaterThan(0);
    expect(summons.every(o => questObjectiveDestination(o.type) === 'SummonScene')).toBe(true);
  });
});
