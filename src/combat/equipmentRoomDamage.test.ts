import { describe, expect, it, vi } from 'vitest';
import { applyRoomSlotDamage } from './RoomDurability';
import { triggerJudgment, type BossContext } from './BossBehaviors';
import { setupThreeGodDestroyer } from './LateBossBehaviors';
import type { Invader } from '../objects/Invader';
import type { DungeonSlot } from '../data/wisdom';
import { GRID_ROWS } from '../constants/layout';

vi.mock('phaser', () => ({ default: {} }));
vi.mock('../objects/Invader', () => ({ Invader: class {} }));
vi.mock('../objects/Room', () => ({ Room: class {} }));

function makeBossContext() {
  const visual = {
    setOrigin: vi.fn().mockReturnThis(), setDepth: vi.fn().mockReturnThis(),
    setAlpha: vi.fn().mockReturnThis(), lineStyle: vi.fn(), strokeCircle: vi.fn(),
  };
  const delayed: Array<() => void> = [];
  const events: Array<{ delay: number; callback: () => void }> = [];
  const damage = vi.fn();
  const data = { roomHp: 400, maxRoomHp: 400 };
  const roomGrid = Array.from({ length: GRID_ROWS }, (_, r) => [r === 0 ? data : null]);
  const rooms = Array.from({ length: GRID_ROWS }, () => [{ x: 0, y: 0, damageRoomHp: damage }]);
  const ctx = {
    roomGrid, rooms, effectiveCols: 1, activeInvaders: [],
    bossHud: { build: vi.fn() },
    scene: {
      add: { text: () => visual, graphics: () => visual },
      cameras: { main: { shake: vi.fn(), flash: vi.fn() } },
      tweens: { add: vi.fn() },
      time: {
        delayedCall: (_delay: number, callback: () => void) => delayed.push(callback),
        addEvent: (event: { delay: number; callback: () => void }) => events.push(event),
      },
    },
  } as unknown as BossContext;
  return { ctx, damage, data, delayed, events };
}

describe('room damage equipment adapters', () => {
  it('passes equipment into persistent breakthrough / reflect damage', () => {
    const slot = { hp: 200, maxHp: 200, monsterIds: ['extra'], trapIds: [], roomLevel: 1 } as DungeonSlot;
    applyRoomSlotDamage([slot], 0.5, new Map([['extra', { dmgReduction: 0.3 }]]));
    expect(slot.hp).toBe(130);
  });

  it('uses live occupants after element exclusions and swaps while preserving saved assignments', () => {
    const slot = { hp: 200, maxHp: 200, monsterIds: ['armored'], trapIds: [], roomLevel: 1 } as DungeonSlot;
    const other = { ...slot, monsterIds: ['unarmored'] };
    const equipment = new Map([['armored', { dmgReduction: 0.3 }]]);
    applyRoomSlotDamage([slot, other], 0.5, equipment, index => index === 0 ? [] : ['armored']);
    expect([slot.hp, other.hp]).toEqual([100, 130]);
    expect(slot.monsterIds).toEqual(['armored']);
    expect(other.monsterIds).toEqual(['unarmored']);
  });

  it('judgment delegates raw damage to the room instead of bypassing its armor and HP bar', () => {
    const { ctx, damage, data } = makeBossContext();
    triggerJudgment(ctx);
    expect(damage).toHaveBeenCalledExactlyOnceWith(200);
    expect(data.roomHp).toBe(400); // only the Room adapter may mutate structural HP
  });

  it('three-god venom delegates each occupied room to the same armor-aware damage path', () => {
    const { ctx, damage, data, delayed, events } = makeBossContext();
    const inv = { active: true, hp: 10, maxHp: 100, ch5BossPhase: 1, def: { radius: 10 } } as Invader;
    setupThreeGodDestroyer(ctx, inv); // phase 2
    delayed.shift()!(); // phase 3
    delayed.shift()!(); // phase 4
    events.find(event => event.delay === 20000)!.callback();
    expect(damage).toHaveBeenCalledExactlyOnceWith(40);
    expect(data.roomHp).toBe(400);
    inv.active = false;
    events.find(event => event.delay === 20000)!.callback();
    expect(damage).toHaveBeenCalledTimes(1);
  });
});
