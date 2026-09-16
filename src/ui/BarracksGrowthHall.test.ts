import { describe, expect, it, vi } from 'vitest';
import type { GameState } from '../data/wisdom';

vi.mock('phaser', () => ({ default: {} }));

import {
  computeBarracksDirective,
  type BarracksStats,
} from './BarracksGrowthHall';

describe('computeBarracksDirective', () => {
  it('routes an empty legion toward its first summon', () => {
    const state = { ownedMonsters: [] } as unknown as GameState;
    const stats: BarracksStats = {
      totalPower: 0,
      ownedCount: 0,
      spReady: 0,
      levelReady: 0,
      equippedCount: 0,
      deployedCount: 0,
      equipmentInventory: 0,
    };

    const directive = computeBarracksDirective(state, stats, null);
    expect(directive).toMatchObject({
      title: '군단이 비어 있음',
      cta: '소환',
    });
    expect(directive.targetMonster).toBeUndefined();
  });
});
