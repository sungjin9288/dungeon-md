import { describe, expect, it } from 'vitest';
import {
  calculateEquipmentImpactPower,
  findMonsterRoom,
  findOpenMonsterRoom,
  getBlueprintMonsterFit,
  getBlueprintRecommendation,
  getMonsterDefForOwned,
  getPreferredRoomSlotType,
  getRoomTypeName,
  hasOpenMonsterSlot,
  scoreBlueprintRecommendation,
} from './forgeRecommendations';
import { BLUEPRINT_DEFS } from './fusion';
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
    expect(recFocus?.roomLabel).toBe('방 #1');
    const base = scoreBlueprintRecommendation(BP, monster(), recFocus!);
    const recBench = { ...recFocus!, kind: 'bench' as const };
    expect(base).toBeGreaterThan(scoreBlueprintRecommendation(BP, monster(), recBench));
  });

  it('getBlueprintRecommendation without focus ranks owned monsters and returns best', () => {
    const gs = state({ ownedMonsters: [monster(), monster({ id: 'dokkaebi_junior', level: 1 })] });
    const rec = getBlueprintRecommendation(gs, BP);
    expect(rec).not.toBeNull();
    expect(rec!.targetLine).toContain('장착 시 방 전력');
  });

  it('getBlueprintRecommendation returns null when no monsters owned', () => {
    expect(getBlueprintRecommendation(state({ ownedMonsters: [] }), BP)).toBeNull();
  });
});
