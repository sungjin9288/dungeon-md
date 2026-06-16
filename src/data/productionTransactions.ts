/**
 * GameState-level transactions for 생산 시설 (production facilities) — building
 * and upgrading. Immutable: every op returns a new GameState. Pure (no Phaser).
 */

import type { GameState } from './wisdom';
import { FACILITY_DEFS, facilityUpgradeCost } from './production';

export type FacilityBuildResult =
  | { ok: true; state: GameState; spent: number; newLevel: number }
  | { ok: false; reason: 'unknown' | 'maxed' | 'no_gold' };

/**
 * Build or upgrade a facility one level, spending gold. Validates the facility
 * exists, isn't maxed, and the player can afford the next-level cost.
 */
export function buildOrUpgradeFacility(state: Readonly<GameState>, facilityId: string): FacilityBuildResult {
  const def = FACILITY_DEFS[facilityId];
  if (!def) return { ok: false, reason: 'unknown' };

  const current = state.productionFacilities?.[facilityId] ?? 0;
  const cost = facilityUpgradeCost(def, current);
  if (cost === null) return { ok: false, reason: 'maxed' };
  if (state.homeGold < cost) return { ok: false, reason: 'no_gold' };

  const newLevel = current + 1;
  return {
    ok: true,
    spent: cost,
    newLevel,
    state: {
      ...state,
      homeGold: state.homeGold - cost,
      productionFacilities: { ...(state.productionFacilities ?? {}), [facilityId]: newLevel },
    },
  };
}
