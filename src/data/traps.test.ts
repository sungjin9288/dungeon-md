import { describe, it, expect } from 'vitest';
import { TRAP_DEFS, type TrapDef } from './traps';

// ─── TRAP_DEFS — structural integrity ────────────────────────────────────────

describe('TRAP_DEFS — structural integrity', () => {
  it('defines exactly 4 traps', () => {
    expect(TRAP_DEFS).toHaveLength(4);
  });

  it('every trap has a non-empty id, emoji, name, desc', () => {
    for (const t of TRAP_DEFS) {
      expect(t.id.length,   `${t.id} id`  ).toBeGreaterThan(0);
      expect(t.emoji.length,`${t.id} emoji`).toBeGreaterThan(0);
      expect(t.name.length, `${t.id} name` ).toBeGreaterThan(0);
      expect(t.desc.length, `${t.id} desc` ).toBeGreaterThan(0);
    }
  });

  it('ids are unique', () => {
    const ids = TRAP_DEFS.map(t => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('all trap ids match the expected set', () => {
    const ids = TRAP_DEFS.map(t => t.id);
    expect(ids).toContain('spike_trap');
    expect(ids).toContain('slow_trap');
    expect(ids).toContain('poison_trap');
    expect(ids).toContain('stun_trap');
  });

  it('every cost is a positive integer', () => {
    for (const t of TRAP_DEFS) {
      expect(t.cost, `${t.id} cost`).toBeGreaterThan(0);
      expect(Number.isInteger(t.cost), `${t.id} cost integer`).toBe(true);
    }
  });

  it('every unlockLv is a non-negative integer', () => {
    for (const t of TRAP_DEFS) {
      expect(t.unlockLv, `${t.id} unlockLv`).toBeGreaterThanOrEqual(0);
      expect(Number.isInteger(t.unlockLv), `${t.id} unlockLv integer`).toBe(true);
    }
  });
});

// ─── TRAP_DEFS — cost ordering ────────────────────────────────────────────────

describe('TRAP_DEFS — cost ordering', () => {
  const get = (id: string): TrapDef => TRAP_DEFS.find(t => t.id === id)!;

  it('spike_trap (50) is the cheapest trap', () => {
    const minCost = Math.min(...TRAP_DEFS.map(t => t.cost));
    expect(get('spike_trap').cost).toBe(minCost);
    expect(get('spike_trap').cost).toBe(50);
  });

  it('stun_trap (200) is the most expensive trap', () => {
    const maxCost = Math.max(...TRAP_DEFS.map(t => t.cost));
    expect(get('stun_trap').cost).toBe(maxCost);
    expect(get('stun_trap').cost).toBe(200);
  });

  it('cost order is spike(50) < slow(80) < poison(120) < stun(200)', () => {
    expect(get('spike_trap').cost).toBeLessThan(get('slow_trap').cost);
    expect(get('slow_trap').cost).toBeLessThan(get('poison_trap').cost);
    expect(get('poison_trap').cost).toBeLessThan(get('stun_trap').cost);
  });

  it('stun_trap costs 4× spike_trap', () => {
    expect(get('stun_trap').cost / get('spike_trap').cost).toBe(4);
  });
});

// ─── TRAP_DEFS — unlock level gating ─────────────────────────────────────────

describe('TRAP_DEFS — unlock level gating', () => {
  const get = (id: string): TrapDef => TRAP_DEFS.find(t => t.id === id)!;

  it('spike_trap and slow_trap are available from the start (unlockLv 0)', () => {
    expect(get('spike_trap').unlockLv).toBe(0);
    expect(get('slow_trap').unlockLv).toBe(0);
  });

  it('poison_trap unlocks at level 6', () => {
    expect(get('poison_trap').unlockLv).toBe(6);
  });

  it('stun_trap unlocks at level 10', () => {
    expect(get('stun_trap').unlockLv).toBe(10);
  });

  it('higher-cost traps have higher or equal unlockLv', () => {
    // spike(50, lv0) ≤ slow(80, lv0) ≤ poison(120, lv6) ≤ stun(200, lv10)
    const sorted = [...TRAP_DEFS].sort((a, b) => a.cost - b.cost);
    for (let i = 1; i < sorted.length; i++) {
      expect(sorted[i].unlockLv, `${sorted[i].id} unlockLv ≥ ${sorted[i-1].id}`)
        .toBeGreaterThanOrEqual(sorted[i - 1].unlockLv);
    }
  });
});

// ─── TRAP_DEFS — per-trap spot-checks ────────────────────────────────────────

describe('TRAP_DEFS — per-trap spot-checks', () => {
  const get = (id: string): TrapDef => TRAP_DEFS.find(t => t.id === id)!;

  it('spike_trap: emoji=🗡, cost=50, unlockLv=0', () => {
    const t = get('spike_trap');
    expect(t.emoji).toBe('🗡');
    expect(t.cost).toBe(50);
    expect(t.unlockLv).toBe(0);
  });

  it('slow_trap: emoji=🕸, cost=80, unlockLv=0', () => {
    const t = get('slow_trap');
    expect(t.emoji).toBe('🕸');
    expect(t.cost).toBe(80);
    expect(t.unlockLv).toBe(0);
  });

  it('poison_trap: emoji=☠️, cost=120, unlockLv=6', () => {
    const t = get('poison_trap');
    expect(t.emoji).toBe('☠️');
    expect(t.cost).toBe(120);
    expect(t.unlockLv).toBe(6);
  });

  it('stun_trap: emoji=⚡, cost=200, unlockLv=10', () => {
    const t = get('stun_trap');
    expect(t.emoji).toBe('⚡');
    expect(t.cost).toBe(200);
    expect(t.unlockLv).toBe(10);
  });

  it('spike_trap name is "가시 덫"', () => {
    expect(get('spike_trap').name).toBe('가시 덫');
  });

  it('slow_trap name is "느림 덫"', () => {
    expect(get('slow_trap').name).toBe('느림 덫');
  });

  it('poison_trap name is "독 덫"', () => {
    expect(get('poison_trap').name).toBe('독 덫');
  });

  it('stun_trap name is "감전 덫"', () => {
    expect(get('stun_trap').name).toBe('감전 덫');
  });
});

// ─── TRAP_DEFS — per-trap desc spot-checks ────────────────────────────────────

describe('TRAP_DEFS — per-trap desc spot-checks', () => {
  const get = (id: string): TrapDef => TRAP_DEFS.find(t => t.id === id)!;

  it('spike_trap desc encodes 20 damage on entry', () => {
    expect(get('spike_trap').desc).toBe('진입 시 20 피해');
  });

  it('slow_trap desc encodes -40% speed for 2 seconds', () => {
    expect(get('slow_trap').desc).toBe('이동속도 -40%, 2초');
  });

  it('poison_trap desc encodes 8 damage per second for 4 seconds', () => {
    expect(get('poison_trap').desc).toBe('8 피해/초, 4초');
  });

  it('stun_trap desc encodes 1-second stun', () => {
    expect(get('stun_trap').desc).toBe('기절 1초');
  });
});
