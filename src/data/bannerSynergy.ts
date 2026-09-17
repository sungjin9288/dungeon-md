// ─── Banner tribe synergy (P4 ③) ─────────────────────────────────────────────
// Season banners are already tribe pickups; this turns the featured list into
// "what you get if you collect now": the banner's tribe, how many of it the
// player fields, and the next synergy tier that collecting would unlock.
// Design: GAME_DESIGN_BENCHMARK.md §4.4 ③. Pure.

import type { SeasonBanner } from './banners';
import { resolveOwnedMonsterProfile } from './monsters';
import { TRIBE_SYNERGIES, type TribeSynergyTier } from './synergy';
import type { GameState } from './wisdom';

export interface BannerSynergyOutlook {
  readonly tribe: string;
  /** Guardians of that tribe the player owns (not just deployed). */
  readonly owned: number;
  /** The first synergy tier still above the owned count, or null when all are reached. */
  readonly next: TribeSynergyTier | null;
}

/** The tribe most of the banner's featured guardians belong to. */
export function bannerTribe(banner: Pick<SeasonBanner, 'featuredMonsters'>): string | null {
  const counts = new Map<string, number>();
  for (const id of banner.featuredMonsters) {
    const tribe = resolveOwnedMonsterProfile(id)?.tribe;
    if (tribe) counts.set(tribe, (counts.get(tribe) ?? 0) + 1);
  }
  let best: string | null = null;
  for (const [tribe, count] of counts) if (best === null || count > (counts.get(best) ?? 0)) best = tribe;
  return best;
}

export function getBannerSynergyOutlook(
  banner: Pick<SeasonBanner, 'featuredMonsters'>,
  state: Readonly<Pick<GameState, 'ownedMonsters'>>,
): BannerSynergyOutlook | null {
  const tribe = bannerTribe(banner);
  if (!tribe) return null;
  const owned = (state.ownedMonsters ?? []).filter(monster => resolveOwnedMonsterProfile(monster.id)?.tribe === tribe).length;
  const tiers = TRIBE_SYNERGIES.find(entry => entry.tribe === tribe)?.tiers ?? [];
  const next = tiers.find(tier => tier.count > owned) ?? null;
  return { tribe, owned, next };
}
