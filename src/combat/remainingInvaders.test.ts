import { describe, expect, it, vi } from 'vitest';
import { remainingInvaderCount } from './waveSpawnAccounting';

vi.mock('./ImpactVfx', () => ({ playDungeonHpHitReaction: vi.fn() }));
vi.mock('./VisualEffects', () => ({ showGoldFloat: vi.fn() }));
const { handleInvaderReachedEnd } = await import('./BattleEventHandlers');

// The HUD "잔여 N" pill. A killed invader stays `active` through its death
// animation, so counting before removal left "잔여 1" on every victory screen;
// a leak to the heart never updated the pill at all.
describe('remaining invader HUD count', () => {
  const inv = (active = true) => ({ active });

  it('excludes the invader that is leaving the field', () => {
    const dying = inv();
    expect(remainingInvaderCount([dying, inv(), inv(false)], dying)).toBe(1);
    expect(remainingInvaderCount([dying], dying)).toBe(0);
  });

  it('updates the pill when an invader reaches the heart', () => {
    const leaking = { active: true, def: { damage: 50 } };
    const other = { active: true, def: { damage: 50 } };
    let activeInvaders: unknown[] = [leaking, other];
    const setRemainingInvadersRegistry = vi.fn();
    const ctx = {
      scene: {}, wisdomBonuses: { monsterDmgMult: 1 }, maxHp: 2400, dungeonHp: 2400, breakthruCount: 0,
      get activeInvaders() { return activeInvaders; }, set activeInvaders(v: unknown[]) { activeInvaders = v; },
      hasSynergy: () => false, applyRoomSlotDamage: vi.fn(), triggerWaveFail: vi.fn(), updateLowHpVignette: vi.fn(),
      setHpRegistry: vi.fn(), setGoldRegistry: vi.fn(), setRemainingInvadersRegistry,
    };
    handleInvaderReachedEnd(ctx as never, leaking as never);
    expect(setRemainingInvadersRegistry).toHaveBeenLastCalledWith(1);
  });
});
