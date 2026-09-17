import { describe, expect, it } from 'vitest';
import {
  applyNavigationContextOperation,
  CONTEXTUAL_BACK_TARGETS,
  createForgeFocusContext,
  GAME_ZONE_DEFINITIONS,
  GAME_ZONES,
  getActiveZone,
  getContextualBackTarget,
  getZoneDestination,
  NAVIGATION_CONTEXT_OPERATIONS,
  REGISTERED_SCENE_KEYS,
} from './navigationContract';

describe('navigationContract — four-zone inventory', () => {
  it('freezes the four global Home destinations', () => {
    expect(GAME_ZONES).toEqual(['dungeon', 'legion', 'forge', 'invasion']);
    expect(getZoneDestination('dungeon')).toBe('DungeonHomeScene');
    expect(getZoneDestination('legion')).toBe('BarracksScene');
    expect(getZoneDestination('forge')).toBe('ForgeScene');
    expect(getZoneDestination('invasion')).toBe('StageSelectScene');
  });

  it('keeps Summon inside Legion and maps active-zone membership without saved route state', () => {
    expect(GAME_ZONE_DEFINITIONS.legion.activeScenes).toContain('SummonScene');
    expect(getActiveZone('DungeonHomeScene')).toBe('dungeon');
    expect(getActiveZone('BarracksScene')).toBe('legion');
    expect(getActiveZone('SummonScene')).toBe('legion');
    expect(getActiveZone('ForgeScene')).toBe('forge');
    expect(getActiveZone('StageSelectScene')).toBe('invasion');
    expect(getActiveZone('PreBattleScene')).toBe('invasion');
    expect(getActiveZone('DungeonScene')).toBeNull();
  });

  it('retains registered direct-entry keys and contextual default back targets', () => {
    expect(REGISTERED_SCENE_KEYS).toEqual(expect.arrayContaining([
      'SummonScene', 'ForgeScene', 'StageSelectScene', 'PreBattleScene',
      'DungeonScene', 'UIScene', 'StageRewardOverlay',
    ]));
    expect(getContextualBackTarget('BarracksScene')).toBe('DungeonHomeScene');
    expect(getContextualBackTarget('SummonScene')).toBe('BarracksScene');
    expect(getContextualBackTarget('ForgeScene')).toBe('DungeonHomeScene');
    expect(getContextualBackTarget('StageSelectScene')).toBe('DungeonHomeScene');
    expect(CONTEXTUAL_BACK_TARGETS.PreBattleScene).toBe('DungeonHomeScene');
  });
});

describe('navigationContract — transient context hand-offs', () => {
  const focusContext = {
    focusRoomSlotIdx: 2,
    focusMonsterId: 'dokkaebi_warrior',
    focusSourceLabel: '방 #3 수호자',
    forgeReturnScene: 'BarracksScene',
    previousScene: 'BarracksScene',
    preBattleEditReturn: true,
    returnTo: 'DungeonHomeScene',
  } as const;

  it('documents Barracks consumption, Forge focus preservation, and focused Home return cleanup', () => {
    expect(NAVIGATION_CONTEXT_OPERATIONS['barracks-entry']).toEqual({
      consume: ['focusMonsterId', 'focusSourceLabel', 'focusRoomSlotIdx'], preserve: [],
    });
    expect(NAVIGATION_CONTEXT_OPERATIONS['forge-entry']).toEqual({
      consume: ['forgeReturnScene'], preserve: ['focusMonsterId', 'focusSourceLabel', 'focusRoomSlotIdx'],
    });
    expect(applyNavigationContextOperation(focusContext, 'barracks-entry')).toMatchObject({
      forgeReturnScene: 'BarracksScene', previousScene: 'BarracksScene',
    });
    expect(applyNavigationContextOperation(focusContext, 'forge-entry')).toMatchObject({
      focusRoomSlotIdx: 2, focusMonsterId: 'dokkaebi_warrior', focusSourceLabel: '방 #3 수호자',
    });
    expect(applyNavigationContextOperation(focusContext, 'focused-room-return')).not.toHaveProperty('focusRoomSlotIdx');
  });

  it('freezes utility, pre-battle, and battle-return ownership without persistence', () => {
    expect(NAVIGATION_CONTEXT_OPERATIONS['utility-back']).toEqual({ consume: [], preserve: ['previousScene'] });
    expect(NAVIGATION_CONTEXT_OPERATIONS['prebattle-resume']).toEqual({
      consume: ['preBattleEditReturn'], preserve: [],
    });
    expect(NAVIGATION_CONTEXT_OPERATIONS['battle-result']).toEqual({ consume: ['returnTo'], preserve: [] });
    expect(applyNavigationContextOperation(focusContext, 'utility-back')).toEqual(focusContext);
    expect(applyNavigationContextOperation(focusContext, 'prebattle-resume')).not.toHaveProperty('preBattleEditReturn');
    expect(applyNavigationContextOperation(focusContext, 'battle-result')).not.toHaveProperty('returnTo');
  });

  it('drops every field the abyss climb hand-off owns on return', () => {
    // AbyssScene.climb() writes abyssPendingFloor + returnTo, the battle writes
    // battleResult back, and resolveReturnedBattle() settles the floor. Leaving
    // any of the three behind would misroute the next battle or re-settle a
    // floor that was never played, so the scene drives removal from this rule.
    expect(NAVIGATION_CONTEXT_OPERATIONS['abyss-return']).toEqual({
      consume: ['abyssPendingFloor', 'battleResult', 'returnTo'], preserve: [],
    });

    const returned = applyNavigationContextOperation(
      { ...focusContext, returnTo: 'AbyssScene', abyssPendingFloor: 7, battleResult: true },
      'abyss-return',
    );
    expect(returned).not.toHaveProperty('abyssPendingFloor');
    expect(returned).not.toHaveProperty('battleResult');
    expect(returned).not.toHaveProperty('returnTo');
    // Unrelated focus context survives an abyss return.
    expect(returned).toMatchObject({ focusMonsterId: 'dokkaebi_warrior', previousScene: 'BarracksScene' });

    // The generic battle return stays narrower: it must not silently clear
    // abyss ownership, otherwise the abyss floor would never be settled.
    expect(NAVIGATION_CONTEXT_OPERATIONS['battle-result'].consume).not.toContain('abyssPendingFloor');
  });

  it('drops every field the forecast card hand-off owns on return', () => {
    expect(NAVIGATION_CONTEXT_OPERATIONS['forecast-return']).toEqual({
      consume: ['forecastCardId', 'battleResult', 'returnTo'], preserve: [],
    });
    const returned = applyNavigationContextOperation(
      { ...focusContext, returnTo: 'DungeonHomeScene', forecastCardId: '2026-09-17-0', battleResult: true },
      'forecast-return',
    );
    expect(returned).not.toHaveProperty('forecastCardId');
    expect(returned).not.toHaveProperty('battleResult');
    expect(returned).not.toHaveProperty('returnTo');
    expect(returned).toMatchObject({ focusMonsterId: 'dokkaebi_warrior' });
    // The generic battle return must not swallow a forecast card either.
    expect(NAVIGATION_CONTEXT_OPERATIONS['battle-result'].consume).not.toContain('forecastCardId');
  });

  it('uses only a live assigned room for focused Forge return context', () => {
    expect(createForgeFocusContext('dokkaebi_warrior', 1)).toEqual({
      monsterId: 'dokkaebi_warrior', sourceLabel: '방 #2 수호자', roomSlotIdx: 1,
    });
    expect(createForgeFocusContext('skeleton_mage', null)).toEqual({
      monsterId: 'skeleton_mage', sourceLabel: null, roomSlotIdx: null,
    });
    expect(createForgeFocusContext(null, 4)).toEqual({
      monsterId: null, sourceLabel: null, roomSlotIdx: null,
    });
  });
});
