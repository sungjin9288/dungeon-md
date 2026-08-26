/**
 * Ephemeral scene-navigation contract.
 *
 * This inventory intentionally describes only Phaser scene keys and transient
 * registry hand-offs. Route selection is not player progression: it must not
 * be added to GameState, localStorage, or a persistent registry key. There is
 * no route analytics backend in this project, so this module records no events.
 */

export const REGISTERED_SCENE_KEYS = [
  'BootScene',
  'DungeonScene',
  'UIScene',
  'StageSelectScene',
  'AncestralWisdomScene',
  'EndlessResultScene',
  'AbyssScene',
  'ProductionScene',
  'DecorationScene',
  'AchievementScene',
  'BarracksScene',
  'SummonScene',
  'ShopScene',
  'CinematicScene',
  'DungeonHomeScene',
  'PreBattleScene',
  'FusionScene',
  'ForgeScene',
  'CodexScene',
  'StageRewardOverlay',
] as const;

export type RegisteredSceneKey = (typeof REGISTERED_SCENE_KEYS)[number];

export const GAME_ZONES = ['dungeon', 'legion', 'forge', 'invasion'] as const;
export type GameZone = (typeof GAME_ZONES)[number];

export interface GameZoneDefinition {
  readonly key: GameZone;
  readonly label: '던전' | '군단' | '공방' | '침공';
  readonly destination: RegisteredSceneKey;
  readonly activeScenes: readonly RegisteredSceneKey[];
}

/** The four global Home destinations; Summon remains a Legion-internal route. */
export const GAME_ZONE_DEFINITIONS: Readonly<Record<GameZone, GameZoneDefinition>> = {
  dungeon: {
    key: 'dungeon',
    label: '던전',
    destination: 'DungeonHomeScene',
    activeScenes: ['DungeonHomeScene'],
  },
  legion: {
    key: 'legion',
    label: '군단',
    destination: 'BarracksScene',
    activeScenes: ['BarracksScene', 'SummonScene', 'CodexScene', 'ShopScene', 'FusionScene'],
  },
  forge: {
    key: 'forge',
    label: '공방',
    destination: 'ForgeScene',
    activeScenes: ['ForgeScene'],
  },
  invasion: {
    key: 'invasion',
    label: '침공',
    destination: 'StageSelectScene',
    activeScenes: ['StageSelectScene', 'PreBattleScene'],
  },
};

export function getZoneDestination(zone: GameZone): RegisteredSceneKey {
  return GAME_ZONE_DEFINITIONS[zone].destination;
}

export function getActiveZone(sceneKey: string): GameZone | null {
  return GAME_ZONES.find(zone => GAME_ZONE_DEFINITIONS[zone].activeScenes.includes(sceneKey as RegisteredSceneKey)) ?? null;
}

/**
 * Back targets are contextual, not a copied global bottom bar. Registry return
 * overrides (for example forgeReturnScene) remain authoritative at their scene.
 */
export const CONTEXTUAL_BACK_TARGETS: Readonly<Partial<Record<RegisteredSceneKey, RegisteredSceneKey>>> = {
  DungeonHomeScene: 'DungeonHomeScene',
  BarracksScene: 'DungeonHomeScene',
  SummonScene: 'BarracksScene',
  CodexScene: 'BarracksScene',
  ForgeScene: 'DungeonHomeScene',
  StageSelectScene: 'DungeonHomeScene',
  PreBattleScene: 'DungeonHomeScene',
};

export function getContextualBackTarget(sceneKey: RegisteredSceneKey): RegisteredSceneKey {
  return CONTEXTUAL_BACK_TARGETS[sceneKey] ?? 'DungeonHomeScene';
}

export const NAVIGATION_CONTEXT_FIELDS = [
  'focusRoomSlotIdx',
  'focusMonsterId',
  'focusSourceLabel',
  'forgeReturnScene',
  'previousScene',
  'preBattleEditReturn',
  'returnTo',
] as const;

export type NavigationContextField = (typeof NAVIGATION_CONTEXT_FIELDS)[number];
export type NavigationContextOperation =
  | 'barracks-entry'
  | 'forge-entry'
  | 'focused-room-return'
  | 'utility-back'
  | 'prebattle-resume'
  | 'battle-result';

/**
 * Registry field ownership mirrors existing scene behavior. These are a testable
 * record of transient hand-offs, not a new registry schema or persistence layer.
 */
export const NAVIGATION_CONTEXT_OPERATIONS: Readonly<Record<
  NavigationContextOperation,
  Readonly<{ consume: readonly NavigationContextField[]; preserve: readonly NavigationContextField[] }>
>> = {
  'barracks-entry': {
    consume: ['focusMonsterId', 'focusSourceLabel', 'focusRoomSlotIdx'],
    preserve: [],
  },
  'forge-entry': {
    consume: ['forgeReturnScene'],
    preserve: ['focusMonsterId', 'focusSourceLabel', 'focusRoomSlotIdx'],
  },
  'focused-room-return': {
    consume: ['focusRoomSlotIdx', 'focusMonsterId', 'focusSourceLabel'],
    preserve: [],
  },
  'utility-back': {
    consume: [],
    preserve: ['previousScene'],
  },
  'prebattle-resume': {
    consume: ['preBattleEditReturn'],
    preserve: [],
  },
  'battle-result': {
    consume: ['returnTo'],
    preserve: [],
  },
};

export type NavigationContext = Partial<Record<NavigationContextField, string | number | boolean>>;

export interface ForgeFocusContext {
  readonly monsterId: string | null;
  readonly sourceLabel: string | null;
  readonly roomSlotIdx: number | null;
}

/**
 * Focused Forge targets can return to a room only when the target is actually
 * assigned there now. Recommended or unassigned targets intentionally clear
 * inherited room metadata rather than fabricating a return destination.
 */
export function createForgeFocusContext(
  monsterId: string | null,
  actualRoomSlotIdx: number | null,
): ForgeFocusContext {
  if (!monsterId) {
    return { monsterId: null, sourceLabel: null, roomSlotIdx: null };
  }
  const roomSlotIdx = Number.isInteger(actualRoomSlotIdx) && (actualRoomSlotIdx ?? -1) >= 0
    ? actualRoomSlotIdx
    : null;
  return {
    monsterId,
    sourceLabel: roomSlotIdx === null ? null : `방 #${roomSlotIdx + 1} 수호자`,
    roomSlotIdx,
  };
}

/** Pure model used by tests to freeze the registry consumption rules above. */
export function applyNavigationContextOperation(
  context: NavigationContext,
  operation: NavigationContextOperation,
): NavigationContext {
  const next = { ...context };
  NAVIGATION_CONTEXT_OPERATIONS[operation].consume.forEach(field => {
    delete next[field];
  });
  return next;
}
