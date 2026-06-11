import { addXp, type OwnedMonster, type SkillNode } from './barracks';
import { applyQuestObjectiveUpdate, tickSubQuestProgress } from './quests';
import type { GameState } from './wisdom';

export type BarracksTransactionFailureReason =
  | 'monster_not_found'
  | 'insufficient_gold'
  | 'skill_already_spent'
  | 'prerequisite_not_met'
  | 'insufficient_skill_points'
  | 'equipment_not_owned'
  | 'no_owned_active_skills'
  | 'invalid_skill_slot';

export type BarracksTransactionResult =
  | { ok: true; state: GameState; monster: OwnedMonster; changed: boolean }
  | { ok: false; state: GameState; reason: BarracksTransactionFailureReason };

export type ActiveSkillPurchaseResult =
  | { ok: true; state: GameState; changed: boolean }
  | { ok: false; state: GameState; reason: 'insufficient_gold' };

function replaceOwnedMonster(
  state: GameState,
  monsterId: string,
  update: (monster: OwnedMonster) => OwnedMonster,
): BarracksTransactionResult {
  const idx = state.ownedMonsters.findIndex(om => om.id === monsterId);
  if (idx < 0) return { ok: false, state, reason: 'monster_not_found' };
  const monster = update(state.ownedMonsters[idx]);
  return {
    ok: true,
    state: {
      ...state,
      ownedMonsters: state.ownedMonsters.map((om, i) => i === idx ? monster : om),
    },
    monster,
    changed: true,
  };
}

export function feedOwnedMonster(
  state: GameState,
  monsterId: string,
  goldCost: number,
  xpAmount: number,
): BarracksTransactionResult & { levelled?: boolean } {
  if ((state.homeGold ?? 0) < goldCost) {
    return { ok: false, state, reason: 'insufficient_gold' };
  }
  const idx = state.ownedMonsters.findIndex(om => om.id === monsterId);
  if (idx < 0) return { ok: false, state, reason: 'monster_not_found' };

  const currentMonster = state.ownedMonsters[idx];
  const monster: OwnedMonster = {
    ...currentMonster,
    spentSkills: { ...currentMonster.spentSkills },
    equippedSkills: [...(currentMonster.equippedSkills ?? [])],
  };
  const result = addXp(monster, xpAmount);
  const fedState: GameState = {
    ...state,
    homeGold: (state.homeGold ?? 0) - goldCost,
    ownedMonsters: state.ownedMonsters.map((om, i) => i === idx ? monster : om),
  };
  const [questUpdated] = applyQuestObjectiveUpdate(fedState, 'feed_monster');
  const nextState = tickSubQuestProgress(questUpdated, 'feed_monster');
  return {
    ok: true,
    state: nextState,
    monster,
    changed: true,
    levelled: result.levelled,
  };
}

export function spendMonsterSkillNode(
  state: GameState,
  monsterId: string,
  node: SkillNode,
): BarracksTransactionResult {
  const monster = state.ownedMonsters.find(om => om.id === monsterId);
  if (!monster) return { ok: false, state, reason: 'monster_not_found' };
  if ((monster.spentSkills[node.id] ?? 0) >= 1) {
    return { ok: false, state, reason: 'skill_already_spent' };
  }
  if (node.requires && (monster.spentSkills[node.requires] ?? 0) < 1) {
    return { ok: false, state, reason: 'prerequisite_not_met' };
  }
  if (monster.skillPoints < node.cost) {
    return { ok: false, state, reason: 'insufficient_skill_points' };
  }
  return replaceOwnedMonster(state, monsterId, current => ({
    ...current,
    spentSkills: { ...current.spentSkills, [node.id]: 1 },
    skillPoints: current.skillPoints - node.cost,
  }));
}

export function equipMonsterEquipment(
  state: GameState,
  monsterId: string,
  equipmentId: string,
): BarracksTransactionResult {
  const ownsEquipment = (state.ownedEquipment ?? []).includes(equipmentId)
    || (state.craftedEquipment ?? []).some(equipment => equipment.id === equipmentId);
  if (!ownsEquipment) {
    return { ok: false, state, reason: 'equipment_not_owned' };
  }
  return replaceOwnedMonster(state, monsterId, current => {
    if (current.equipment === equipmentId) return current;
    return { ...current, equipment: equipmentId };
  });
}

export function cycleMonsterActiveSkillSlot(
  state: GameState,
  monsterId: string,
  slotIndex: number,
): BarracksTransactionResult {
  if (slotIndex < 0 || slotIndex > 1) {
    return { ok: false, state, reason: 'invalid_skill_slot' };
  }
  const owned = state.ownedActiveSkills ?? [];
  if (owned.length === 0) {
    return { ok: false, state, reason: 'no_owned_active_skills' };
  }
  return replaceOwnedMonster(state, monsterId, current => {
    const currentSkills = [...(current.equippedSkills ?? [])];
    const currentSkillId = currentSkills[slotIndex];
    const nextIdx = currentSkillId ? (owned.indexOf(currentSkillId) + 1) % owned.length : 0;
    currentSkills[slotIndex] = owned[nextIdx];
    return { ...current, equippedSkills: currentSkills };
  });
}

export function purchaseActiveSkillWithGold(
  state: GameState,
  skillId: string,
  goldCost: number,
): ActiveSkillPurchaseResult {
  const owned = state.ownedActiveSkills ?? [];
  if (owned.includes(skillId)) {
    return { ok: true, state, changed: false };
  }
  if ((state.homeGold ?? 0) < goldCost) {
    return { ok: false, state, reason: 'insufficient_gold' };
  }
  return {
    ok: true,
    state: {
      ...state,
      homeGold: (state.homeGold ?? 0) - goldCost,
      ownedActiveSkills: [...owned, skillId],
    },
    changed: true,
  };
}
