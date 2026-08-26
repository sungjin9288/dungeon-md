import { describe, expect, it } from 'vitest';
import {
  calculateEquipmentImpactPower,
  cycleForgeTargetsByRoster,
  findMonsterRoom,
  findOpenMonsterRoom,
  getBlueprintMonsterFit,
  getBlueprintRecommendation,
  getForgeBlueprintProjection,
  getMonsterDefForOwned,
  getPreferredRoomSlotType,
  getRoomTypeName,
  hasOpenMonsterSlot,
  scoreBlueprintRecommendation,
  rankForgeBlueprints,
  rankForgeTargets,
} from './forgeRecommendations';
import { BLUEPRINT_DEFS } from './fusion';
import { applyCraftBlueprint } from './forgeTransactions';
import { equipMonsterEquipment } from './barracksTransactions';
import { createForgeFocusContext } from './navigationContract';
import {
  buildGrowthRecommendation,
  findAssignedRoom,
  projectRoomReinforcement,
  rankGrowthRecommendations,
} from './reinforcementRecommendations';
import { loadGameState, saveGameState } from './wisdom';
import type { GameState, DungeonSlot } from './wisdom';
import type { OwnedMonster } from './barracks';

function slot(over: Partial<DungeonSlot> = {}): DungeonSlot {
  return { roomType: 'combat', monsterIds: [undefined], trapIds: [undefined], roomLevel: 1, hp: 200, maxHp: 200, ...over };
}

function monster(over: Partial<OwnedMonster> = {}): OwnedMonster {
  return { id: 'dokkaebi_warrior', level: 5, xp: 0, skillPoints: 0, spentSkills: {}, ...over } as OwnedMonster;
}

function state(over: Partial<GameState> = {}): GameState {
  return { ownedMonsters: [monster()], dungeonSlots: [], ...over } as unknown as GameState;
}

const BP = BLUEPRINT_DEFS['bp_dokkaebi_club'];

describe('forgeRecommendations — pure helpers', () => {
  it('calculateEquipmentImpactPower: atkMult contributes baseAtk-proportional power', () => {
    expect(calculateEquipmentImpactPower(100, { atkMult: 0.5 })).toBe(50);
  });

  it('calculateEquipmentImpactPower: roomHpBonus 200 → +10 (÷20)', () => {
    expect(calculateEquipmentImpactPower(0, { roomHpBonus: 200 })).toBe(10);
  });

  it('calculateEquipmentImpactPower: empty stats → 0', () => {
    expect(calculateEquipmentImpactPower(999, {})).toBe(0);
  });

  it('getMonsterDefForOwned resolves exact id and suffixed instance id', () => {
    expect(getMonsterDefForOwned('dokkaebi_warrior')?.name).toBeDefined();
    expect(getMonsterDefForOwned('dokkaebi_warrior_3')?.name)
      .toBe(getMonsterDefForOwned('dokkaebi_warrior')?.name);
    expect(getMonsterDefForOwned('no_such_monster_xyz')).toBeNull();
  });

  it('findMonsterRoom locates the slot containing the monster', () => {
    const gs = state({ dungeonSlots: [slot(), slot({ monsterIds: ['dokkaebi_warrior'] })] });
    expect(findMonsterRoom(gs, 'dokkaebi_warrior')?.index).toBe(1);
    expect(findMonsterRoom(gs, 'absent')).toBeNull();
  });

  it('hasOpenMonsterSlot: empty slot is open, fully-stuffed high slot is not', () => {
    expect(hasOpenMonsterSlot(slot({ monsterIds: [undefined] }))).toBe(true);
    // 충분히 많은 몬스터로 어떤 수용량이라도 초과시킴
    expect(hasOpenMonsterSlot(slot({ monsterIds: ['a', 'b', 'c', 'd', 'e', 'f'] }))).toBe(false);
  });

  it('findOpenMonsterRoom prefers the monster-type-matching room', () => {
    const gs = state({
      dungeonSlots: [
        slot({ roomType: 'support', monsterIds: [undefined] }),
        slot({ roomType: 'combat',  monsterIds: [undefined] }),
      ],
    });
    // dokkaebi_warrior는 전투형 → combat 슬롯(인덱스 1) 우선
    expect(findOpenMonsterRoom(gs, monster())?.index).toBe(1);
  });

  it('getPreferredRoomSlotType maps monster def type → room slot type', () => {
    expect(getPreferredRoomSlotType(monster())).toBe('combat');
  });

  it('getRoomTypeName falls back for unknown type', () => {
    expect(getRoomTypeName(undefined)).toBe('미지정 방');
  });

  it('getBlueprintMonsterFit: weapon favors attackers', () => {
    const def = getMonsterDefForOwned('dokkaebi_warrior');
    expect(getBlueprintMonsterFit({ ...BP, type: 'weapon' }, def)).toBe(18);
    expect(getBlueprintMonsterFit(BP, null)).toBe(0);
  });

  it('scoreBlueprintRecommendation: focus kind dominates (+80)', () => {
    const gs = state();
    const recFocus = getBlueprintRecommendation(gs, BP, { monsterId: 'dokkaebi_warrior', sourceLabel: '방 #1' });
    expect(recFocus?.kind).toBe('focus');
    expect(recFocus?.roomLabel).toBe('배치 대기');
    expect(recFocus?.powerDelta).toBeNull();
    const base = scoreBlueprintRecommendation(BP, monster(), recFocus!);
    const recBench = { ...recFocus!, kind: 'bench' as const };
    expect(base).toBeGreaterThan(scoreBlueprintRecommendation(BP, monster(), recBench));
  });

  it('getBlueprintRecommendation without focus ranks owned monsters and returns best', () => {
    const gs = state({ ownedMonsters: [monster(), monster({ id: 'dokkaebi_junior', level: 1 })] });
    const rec = getBlueprintRecommendation(gs, BP);
    expect(rec).not.toBeNull();
    expect(rec!.targetLine).toContain('배치 전 방 전력 추정 없음');
  });

  it('getBlueprintRecommendation returns null when no monsters owned', () => {
    expect(getBlueprintRecommendation(state({ ownedMonsters: [] }), BP)).toBeNull();
  });

  it('keeps exact per-material values and labels a non-improvement honestly', () => {
    const equipped = monster({ equipment: BP.resultId });
    const gs = state({
      ownedMonsters: [equipped],
      dungeonSlots: [slot({ monsterIds: [equipped.id] })],
      materials: { dok_fragment: 1, iron_shard: 2 },
    });

    const projection = getForgeBlueprintProjection(gs, BP, { monsterId: equipped.id, sourceLabel: null });

    expect(projection.materials).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'dok_fragment', have: 1, need: 3, missing: 2 }),
      expect.objectContaining({ id: 'iron_shard', have: 2, need: 2, missing: 0 }),
    ]));
    expect(projection.recommendation?.improvementLabel).toBe('개선 없음');
    expect(projection.recommendation?.powerDelta).toBe(0);
  });

  it('ranks actual craftability before assigned gain and preserves owned blueprint order on ties', () => {
    const gs = state({
      blueprints: ['bp_iron_armor', 'bp_dokkaebi_club'],
      materials: { dok_fragment: 3, iron_shard: 2 },
      dungeonSlots: [slot({ monsterIds: ['dokkaebi_warrior'] })],
    });

    const ranked = rankForgeBlueprints(gs, { monsterId: 'dokkaebi_warrior', sourceLabel: null });

    expect(ranked[0].blueprint.id).toBe('bp_dokkaebi_club');
    expect(ranked[0].craftable).toBe(true);
    expect(ranked[1].materialMissing).toBeGreaterThan(0);
  });

  it('focuses a selected forge target without changing the source state', () => {
    const first = monster();
    const second = monster({ id: 'dokkaebi_junior', level: 1 });
    const gs = state({ ownedMonsters: [first, second], blueprints: [BP.id] });
    const before = JSON.stringify(gs);

    expect(rankForgeTargets(gs, second.id)[0].monster.id).toBe(second.id);
    expect(JSON.stringify(gs)).toBe(before);
  });

  it('cycles all six roster targets one stable position at a time despite focused ranking', () => {
    const ids = [
      'dokkaebi_warrior',
      'dokkaebi_junior',
      'dokkaebi_warrior_2',
      'dokkaebi_junior_2',
      'dokkaebi_warrior_3',
      'dokkaebi_junior_3',
    ];
    const gs = state({
      ownedMonsters: ids.map((id, index) => monster({ id, level: index + 1 })),
      blueprints: [BP.id],
    });
    const before = JSON.stringify(gs);
    let current = ids[3];
    const visited: string[] = [];

    expect(rankForgeTargets(gs, current)[0].monster.id).toBe(current);
    for (let step = 0; step < ids.length; step += 1) {
      const cycle = cycleForgeTargetsByRoster(gs, current);
      visited.push(cycle[0].monster.id);
      current = cycle[1].monster.id;
    }

    expect(visited).toEqual([ids[3], ids[4], ids[5], ids[0], ids[1], ids[2]]);
    expect(JSON.stringify(gs)).toBe(before);
  });

  it('recomputes after a persisted craft and equip while restoring the exact storage value', () => {
    const storageKey = 'dungeonGameState';
    const rawBefore = localStorage.getItem(storageKey);

    try {
      const seeded = {
        ...loadGameState(),
        ownedMonsters: [monster()],
        ownedEquipment: [],
        craftedEquipment: [],
        blueprints: [BP.id],
        materials: { ...BP.materials },
        dungeonSlots: [slot({ monsterIds: ['dokkaebi_warrior'] })],
      };
      const crafted = applyCraftBlueprint(seeded, BP);
      expect(crafted.ok).toBe(true);
      if (!crafted.ok) return;
      saveGameState(crafted.state);

      const equipped = equipMonsterEquipment(loadGameState(), 'dokkaebi_warrior', BP.resultId);
      expect(equipped.ok).toBe(true);
      if (!equipped.ok) return;
      saveGameState(equipped.state);

      const restored = loadGameState();
      expect(restored.materials).toEqual({ dok_fragment: 0, iron_shard: 0 });
      expect(restored.craftedEquipment.some(equipment => equipment.id === BP.resultId)).toBe(true);
      expect(restored.ownedMonsters[0].equipment).toBe(BP.resultId);
      expect(getForgeBlueprintProjection(restored, BP, { monsterId: 'dokkaebi_warrior', sourceLabel: null })
        .recommendation?.improvementLabel).toBe('개선 없음');
    } finally {
      if (rawBefore === null) localStorage.removeItem(storageKey);
      else localStorage.setItem(storageKey, rawBefore);
    }
  });
});

describe('reinforcementRecommendations', () => {
  it('projects assigned rooms through the existing metrics without changing readiness or state', () => {
    const gs = state({ dungeonSlots: [slot({ monsterIds: ['dokkaebi_warrior'] })] });
    const before = JSON.stringify(gs);

    const projection = projectRoomReinforcement(gs, 'dokkaebi_warrior', { equipment: BP.resultId });

    expect(projection.kind).toBe('assigned');
    expect(projection.readiness?.before).toBe(projection.readiness?.after);
    expect(projection.power?.delta).toBeGreaterThan(0);
    expect(JSON.stringify(gs)).toBe(before);
  });

  it('does not fabricate readiness or power for recommended or unassigned rooms', () => {
    const recommended = state({ dungeonSlots: [slot({ monsterIds: [] })] });
    const unassigned = state({ dungeonSlots: [] });

    expect(projectRoomReinforcement(recommended, 'dokkaebi_warrior').kind).toBe('recommended');
    expect(projectRoomReinforcement(recommended, 'dokkaebi_warrior').readiness).toBeNull();
    expect(projectRoomReinforcement(recommended, 'dokkaebi_warrior').power).toBeNull();
    expect(projectRoomReinforcement(unassigned, 'dokkaebi_warrior').kind).toBe('unassigned');
    expect(projectRoomReinforcement(unassigned, 'dokkaebi_warrior').power).toBeNull();
  });

  it('resolves the target’s live room instead of retaining a prior room assignment', () => {
    const second = monster({ id: 'dokkaebi_junior' });
    const roomA = state({
      ownedMonsters: [monster(), second],
      dungeonSlots: [
        slot({ monsterIds: ['dokkaebi_junior'] }),
        slot({ monsterIds: [] }),
      ],
    });
    const movedToRoomB = {
      ...roomA,
      dungeonSlots: [
        slot({ monsterIds: [] }),
        slot({ monsterIds: ['dokkaebi_junior'] }),
      ],
    };
    const unassigned = { ...movedToRoomB, dungeonSlots: [slot({ monsterIds: [] }), slot({ monsterIds: [] })] };

    expect(createForgeFocusContext(
      'dokkaebi_junior', findAssignedRoom(roomA, 'dokkaebi_junior')?.index ?? null,
    ).roomSlotIdx).toBe(0);
    expect(createForgeFocusContext(
      'dokkaebi_junior', findAssignedRoom(movedToRoomB, 'dokkaebi_junior')?.index ?? null,
    ).roomSlotIdx).toBe(1);
    expect(createForgeFocusContext(
      'dokkaebi_junior', findAssignedRoom(unassigned, 'dokkaebi_junior')?.index ?? null,
    )).toMatchObject({ sourceLabel: null, roomSlotIdx: null });
  });

  it('projects an affordable level-up as power only with live XP and gold copy', () => {
    const levelReady = monster({ level: 1, xp: 90 });
    const gs = state({
      ownedMonsters: [levelReady],
      homeGold: 200,
      dungeonSlots: [slot({ monsterIds: [levelReady.id] })],
    });
    const recommendation = buildGrowthRecommendation(gs, levelReady);

    expect(recommendation.action).toBe('level-up');
    expect(recommendation.whyNow).toContain('XP 90/100');
    expect(recommendation.costOrDeficit).toContain('보유 200');
    expect(recommendation.room.readiness?.before).toBe(recommendation.room.readiness?.after);
    expect(recommendation.estimatedPowerDelta).toBeGreaterThan(0);
  });

  it('uses live SP, XP, equipment, exact deficit, focus, and stable roster order without transactions', () => {
    const spReady = monster({ skillPoints: 1 });
    const blocked = monster({ id: 'dokkaebi_junior', xp: 90 });
    const gs = state({
      ownedMonsters: [spReady, blocked],
      homeGold: 23,
      ownedEquipment: ['dokkaebi_club'],
      dungeonSlots: [slot({ monsterIds: [] })],
    });
    const before = JSON.stringify(gs);
    const blockedRecommendation = buildGrowthRecommendation(gs, blocked, 1);

    expect(rankGrowthRecommendations(gs).map(item => item.monsterId)).toEqual([spReady.id, blocked.id]);
    expect(rankGrowthRecommendations(gs, blocked.id)[0].monsterId).toBe(blocked.id);
    expect(blockedRecommendation.action).toBe('equip');
    expect(blockedRecommendation.whyNow).toContain('보유 장비 1개');
    expect(blockedRecommendation.room.kind).toBe('recommended');
    expect(blockedRecommendation.estimatedPowerDelta).toBeNull();
    expect(JSON.stringify(gs)).toBe(before);

    const noEquipment = state({ ownedMonsters: [blocked], homeGold: 23 });
    const deficitRecommendation = buildGrowthRecommendation(noEquipment, blocked);
    expect(deficitRecommendation.action).toBe('blocked-feed');
    expect(deficitRecommendation.costOrDeficit).toContain('부족 27');
  });
});
