import { type OwnedMonster } from '../data/barracks';

export function reconcileCombinationSlots(
  slots: readonly (OwnedMonster | null)[],
  ownedMonsters: readonly OwnedMonster[],
): [OwnedMonster | null, OwnedMonster | null] {
  const remaining = [...ownedMonsters];

  return [0, 1].map(index => {
    const slot = slots[index] ?? null;
    if (!slot) return null;
    let ownedIndex = remaining.findIndex(monster =>
      monster.id === slot.id && monster.level === slot.level,
    );
    if (ownedIndex < 0) ownedIndex = remaining.findIndex(monster => monster.id === slot.id);
    if (ownedIndex < 0) return null;
    return remaining.splice(ownedIndex, 1)[0];
  }) as [OwnedMonster | null, OwnedMonster | null];
}
