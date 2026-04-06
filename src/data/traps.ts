/**
 * Trap definitions used across dungeon room slots.
 */

export interface TrapDef {
  id: string;
  emoji: string;
  name: string;
  cost: number;
  desc: string;
  unlockLv: number;
}

export const TRAP_DEFS: ReadonlyArray<TrapDef> = [
  { id: 'spike_trap',  emoji: '🗡',  name: '가시 덫',   cost:  50, desc: '진입 시 20 피해',           unlockLv: 0  },
  { id: 'slow_trap',   emoji: '🕸',  name: '느림 덫',   cost:  80, desc: '이동속도 -40%, 2초',         unlockLv: 0  },
  { id: 'poison_trap', emoji: '☠️', name: '독 덫',     cost: 120, desc: '8 피해/초, 4초',             unlockLv: 6  },
  { id: 'stun_trap',   emoji: '⚡',  name: '감전 덫',   cost: 200, desc: '기절 1초',                   unlockLv: 10 },
];
