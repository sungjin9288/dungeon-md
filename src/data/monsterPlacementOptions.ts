import {
  getMonstersForRoom,
  resolveOwnedMonsterProfile,
  type ElementId,
  type OwnedMonsterProfile,
} from './monsters';
import type { RoomType } from './rooms';
import type { GameState } from './wisdom';

/** Registry unlocks plus valid owned variants, deduplicated by concrete ID. */
export function getMonsterPlacementOptions(
  state: GameState,
  roomType: RoomType,
  unlockedStage: number,
  elementFilter?: ElementId,
): OwnedMonsterProfile[] {
  const registryCards = getMonstersForRoom(roomType, unlockedStage, elementFilter)
    .map(def => resolveOwnedMonsterProfile(def.id))
    .filter((def): def is OwnedMonsterProfile => def !== null);
  const visibleIds = new Set(registryCards.map(def => def.id));

  const ownedCards = state.ownedMonsters
    .map(monster => resolveOwnedMonsterProfile(monster.id))
    .reduce<OwnedMonsterProfile[]>((cards, def) => {
      if (!def
        || visibleIds.has(def.id)
        || (!def.roomTypes.includes(roomType) && !def.roomTypes.includes('any'))
        || (elementFilter && def.element !== elementFilter)) return cards;
      visibleIds.add(def.id);
      return [...cards, def];
    }, []);

  return [...registryCards, ...ownedCards];
}
