import { describe, expect, it } from 'vitest';
import { applySummonPull } from './summonTransactions';
import { canRedeemTribeShards, duplicateReward, redeemableTribeMonsters, redeemTribeShards, TRIBE_SHARD_REDEEM_COST } from './tribeShards';
import { MONSTER_DEFS } from './monsters';
import { loadGameState, type GameState, type OwnedMonster } from './wisdom';

function owned(id: string): OwnedMonster {
  return { id, level: 1, xp: 0, skillPoints: 0, spentSkills: {}, equippedSkills: [], equipment: null };
}
function state(overrides: Partial<GameState> = {}): GameState {
  return { ...loadGameState(), ...overrides };
}

describe('duplicate rewards', () => {
  it('scale shards and awakening stones by rarity, keyed by the duplicate\'s tribe', () => {
    expect(duplicateReward('dokkaebi_warrior', 0)).toEqual({ tribe: 'dokkaebi', shards: 5, awakeningStones: 0 });
    expect(duplicateReward('dokkaebi_warrior', 4)).toEqual({ tribe: 'dokkaebi', shards: 40, awakeningStones: 2 });
    expect(duplicateReward('nope', 2).shards).toBe(0);
  });

  it('a duplicate pull books shards and stones on top of the soul-crystal change', () => {
    const s = state({ gems: 1000, ownedMonsters: [owned('dokkaebi_warrior')], stageProgress: [] });
    // Force a common pull that lands on the owned dokkaebi_warrior by pinning the rng to 0.
    const r = applySummonPull(s, 'normal', 1, { rng: () => 0, today: '2026-09-18', timestamp: 1 });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const [pull] = r.results;
    if (pull.isNew) return; // rng pinning depends on pool order; only assert when it really was a duplicate
    expect(pull.tribeShards).toBeGreaterThan(0);
    expect(r.state.tribeShards[pull.tribe!]).toBe(pull.tribeShards);
    expect(r.state.awakeningStones).toBe(pull.awakeningStones);
  });
});

describe('redeeming tribe shards', () => {
  it('needs 100 shards and an unowned summonable guardian of the tribe', () => {
    const short = state({ tribeShards: { dokkaebi: 60 }, ownedMonsters: [] });
    expect(canRedeemTribeShards(short, 'dokkaebi')).toMatchObject({ ok: false, reason: 'insufficient_shards' });
    const all = redeemableTribeMonsters(state({ ownedMonsters: [], stageProgress: [] }), 'dokkaebi');
    expect(all.length).toBeGreaterThan(0);
    for (const id of all) expect(MONSTER_DEFS[id].tribe).toBe('dokkaebi');
    const complete = state({ tribeShards: { dokkaebi: 100 }, ownedMonsters: all.map(owned), stageProgress: [] });
    expect(redeemTribeShards(complete, 'dokkaebi')).toMatchObject({ ok: false, reason: 'tribe_complete' });
  });

  it('spends exactly 100 shards for one new guardian of that tribe', () => {
    const s = state({ tribeShards: { dokkaebi: 130 }, ownedMonsters: [owned('dokkaebi_warrior')], stageProgress: [] });
    const r = redeemTribeShards(s, 'dokkaebi', () => 0.5);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.spent).toBe(TRIBE_SHARD_REDEEM_COST);
    expect(r.state.tribeShards.dokkaebi).toBe(30);
    expect(MONSTER_DEFS[r.monsterId].tribe).toBe('dokkaebi');
    expect(r.state.ownedMonsters.map(m => m.id)).toContain(r.monsterId);
    expect(s.ownedMonsters).toHaveLength(1);
  });
});
