import { describe, expect, it } from 'vitest';
import {
  adventurerLoot,
  adventurerStealAmount,
  findVisitorTarget,
  resolveWandererArrival,
  ELITE_DEN_RECRUIT_CHANCE,
  ELITE_DEN_RECRUIT_SHARDS,
  VISITOR_TARGET_BUILDINGS,
  WANDERER_RECRUIT_CHANCE,
  WANDERER_RECRUIT_SHARDS,
} from './visitors';
import { DROP_TABLE } from './fusion';

const room = (building: string, hp = 100) => ({ roomType: ['gold', 'grand_vault'].includes(building) ? 'support' : 'combat', building, hp }) as never;

describe('손님이 찾아갈 방', () => {
  const plan = { corridor: [0, 1, 2], sides: [{ slot: 3, anchor: 2, side: 'up' as const }, { slot: 4, anchor: 0, side: 'down' as const }] };

  it('토벌대는 목표 방이 없다(심장부로)', () => {
    expect(findVisitorTarget(plan, [room('gold')], 'raider')).toBeNull();
  });

  it('모험가는 황금 광맥, 떠돌이 몬스터는 용의 둥지를 찾는다', () => {
    expect(VISITOR_TARGET_BUILDINGS).toEqual({ adventurer: ['gold', 'grand_vault'], wanderer: ['dragons_lair', 'elite_den'] });
    const slots = [room('guardian'), room('guardian'), room('guardian'), room('gold'), room('dragons_lair')];
    expect(findVisitorTarget(plan, slots, 'adventurer')).toBe(3);
    expect(findVisitorTarget(plan, slots, 'wanderer')).toBe(4);
  });

  it('여럿이면 입구에서 가까운 것, 무너진 방은 제외, 없으면 null', () => {
    const slots = [room('guardian'), room('gold'), room('guardian'), room('gold'), room('gold')];
    expect(findVisitorTarget(plan, slots, 'adventurer')).toBe(4);          // 곁방(열 0)이 주 통로 열 1보다 앞
    const broken = [room('guardian'), room('gold'), room('guardian'), room('gold'), room('gold', 0)];
    expect(findVisitorTarget(plan, broken, 'adventurer')).toBe(1);
    expect(findVisitorTarget(plan, [room('guardian')], 'wanderer')).toBeNull();
  });

  it('보석 특수 방도 같은 손님의 목표 — 대형 보물고는 모험가, 고급 몬스터 굴은 떠돌이 몬스터', () => {
    const slots = [room('guardian'), room('grand_vault'), room('gold'), room('guardian'), room('elite_den')];
    expect(findVisitorTarget(plan, slots, 'adventurer')).toBe(1);   // 가까운 쪽(주 통로 2번째)
    expect(findVisitorTarget(plan, slots, 'wanderer')).toBe(4);
  });
});

describe('도착·처치 결과', () => {
  it('모험가는 처치 보상의 3배를 훔치되 가진 전리품까지만', () => {
    expect(adventurerStealAmount(35, 1000)).toBe(105);
    expect(adventurerStealAmount(35, 40.7)).toBe(40);
    expect(adventurerStealAmount(35, 0)).toBe(0);
  });

  it('모험가를 잡으면 짐의 재료가 확정으로 떨어진다', () => {
    expect(adventurerLoot('soldier')).toBe('iron_shard');
    expect(adventurerLoot('god_emperor')).toBe(DROP_TABLE.god_emperor?.[0]?.id ?? 'old_cloth');
  });

  it('떠돌이 몬스터 포섭: 확률 안이면 그 부족 조각, 부족 없는 침입자는 불가', () => {
    expect(resolveWandererArrival('fox_spirit', 0)).toEqual({ tribe: 'gumiho', shards: WANDERER_RECRUIT_SHARDS });
    expect(resolveWandererArrival('fox_spirit', WANDERER_RECRUIT_CHANCE)).toBeNull();
    expect(resolveWandererArrival('peasant', 0)).toBeNull();
  });

  it('고급 몬스터 굴은 더 잘 포섭하고 조각을 더 준다', () => {
    expect(ELITE_DEN_RECRUIT_CHANCE).toBeGreaterThan(WANDERER_RECRUIT_CHANCE);
    const roll = (WANDERER_RECRUIT_CHANCE + ELITE_DEN_RECRUIT_CHANCE) / 2;
    expect(resolveWandererArrival('fox_spirit', roll, 'dragons_lair')).toBeNull();
    expect(resolveWandererArrival('fox_spirit', roll, 'elite_den')).toEqual({ tribe: 'gumiho', shards: ELITE_DEN_RECRUIT_SHARDS });
  });
});
