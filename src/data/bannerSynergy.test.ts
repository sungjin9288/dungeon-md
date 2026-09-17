import { describe, expect, it } from 'vitest';
import { SEASON_BANNERS } from './banners';
import { bannerTribe, getBannerSynergyOutlook } from './bannerSynergy';
import { loadGameState, type OwnedMonster } from './wisdom';

function owned(id: string): OwnedMonster {
  return { id, level: 1, xp: 0, skillPoints: 0, spentSkills: {}, equippedSkills: [], equipment: null };
}

describe('banner tribe synergy outlook', () => {
  it('every season banner resolves to one pickup tribe', () => {
    for (const banner of SEASON_BANNERS) expect(bannerTribe(banner), banner.id).not.toBeNull();
    expect(bannerTribe(SEASON_BANNERS[0])).toBe('gumiho');
  });

  it('counts owned guardians of the tribe and points at the next synergy tier', () => {
    const banner = SEASON_BANNERS[0];
    const none = getBannerSynergyOutlook(banner, { ...loadGameState(), ownedMonsters: [] });
    expect(none).toMatchObject({ tribe: 'gumiho', owned: 0 });
    expect(none?.next?.count).toBe(2);
    const three = getBannerSynergyOutlook(banner, { ownedMonsters: ['gumiho_guardian', 'five_tail_fox', 'ice_gumiho'].map(owned) });
    expect(three).toMatchObject({ owned: 3 });
    expect(three?.next?.count).toBe(4);
    const ids = ['gumiho_guardian', 'five_tail_fox', 'ice_gumiho', 'thunder_gumiho', 'gumiho_queen', 'one_tail_fox', 'three_tail_fox', 'fox_shaman'];
    const full = getBannerSynergyOutlook(banner, { ownedMonsters: ids.map(owned) });
    expect(full?.owned).toBeGreaterThanOrEqual(8);
    expect(full?.next).toBeNull();
  });
});
