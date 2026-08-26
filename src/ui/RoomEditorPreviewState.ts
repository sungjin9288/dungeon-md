import { getRoomSlotCapacity, type DungeonSlot, type GameState } from '../data/wisdom';

export type RoomEditorSocketState = 'assigned' | 'available' | 'target' | 'disabled';
export type RoomEditorDirectiveTarget = 'type' | 'repair' | 'monster' | 'trap' | 'growth' | 'none';
export type RoomEditorPreviewAction = 'trap-picker' | 'monster-picker' | 'monster-growth' | 'forge';

export interface RoomEditorMonsterSocket {
  readonly kind: 'monster';
  readonly slotIndex: number;
  readonly monsterId?: string;
  readonly level?: number;
  readonly hasOwnedMetadata: boolean;
  readonly state: RoomEditorSocketState;
}

export interface RoomEditorTrapSocket {
  readonly kind: 'trap';
  readonly slotIndex: number;
  readonly trapId?: string;
  readonly state: Extract<RoomEditorSocketState, 'assigned' | 'available' | 'target'>;
}

export interface RoomEditorEquipmentSocket {
  readonly kind: 'equipment';
  readonly slotIndex: number;
  readonly monsterId?: string;
  readonly equipmentId?: string;
  readonly state: RoomEditorSocketState;
}

export interface RoomEditorNextTarget {
  readonly kind: 'monster' | 'trap' | 'equipment';
  readonly slotIndex: number;
}

export interface RoomEditorPreviewState {
  readonly capacity: { readonly monsters: number; readonly traps: number };
  readonly monsters: readonly RoomEditorMonsterSocket[];
  readonly traps: readonly RoomEditorTrapSocket[];
  readonly equipment: readonly RoomEditorEquipmentSocket[];
  readonly nextTarget: RoomEditorNextTarget | null;
  readonly monsterCount: number;
  readonly trapCount: number;
  readonly equippedCount: number;
}

export const ROOM_EDITOR_PREVIEW_HIT_SIZE = 44;

export interface RoomEditorPreviewLayoutInput {
  readonly chamberX: number;
  readonly chamberY: number;
  readonly chamberWidth: number;
  readonly chamberHeight: number;
}

export interface RoomEditorPreviewSocketLayout<TSocket> {
  readonly socket: TSocket;
  readonly x: number;
  readonly y: number;
}

export interface RoomEditorPreviewHitZone {
  readonly action: RoomEditorPreviewAction;
  readonly kind: 'trap' | 'monster' | 'equipment';
  readonly slotIndex: number;
  readonly x: number;
  readonly y: number;
  readonly width: typeof ROOM_EDITOR_PREVIEW_HIT_SIZE;
  readonly height: typeof ROOM_EDITOR_PREVIEW_HIT_SIZE;
}

export interface RoomEditorPreviewLayout {
  readonly traps: readonly RoomEditorPreviewSocketLayout<RoomEditorTrapSocket>[];
  readonly monsters: readonly RoomEditorPreviewSocketLayout<RoomEditorMonsterSocket>[];
  readonly hitZones: readonly RoomEditorPreviewHitZone[];
}

/**
 * The room slot remains the only occupancy authority. This projection only
 * normalizes its capacity-bounded sockets for the editor to render.
 */
export function deriveRoomEditorPreviewState(
  gameState: GameState,
  slot: DungeonSlot | null | undefined,
  directiveTarget: RoomEditorDirectiveTarget = 'none',
): RoomEditorPreviewState {
  if (!slot) {
    return {
      capacity: { monsters: 0, traps: 0 },
      monsters: [],
      traps: [],
      equipment: [],
      nextTarget: null,
      monsterCount: 0,
      trapCount: 0,
      equippedCount: 0,
    };
  }

  const capacity = getRoomSlotCapacity(slot.roomLevel, slot.roomType);
  const ownedById = new Map<string, { level: number; equipment: string | null | undefined }>();
  const ownedMonsters = Array.isArray(gameState.ownedMonsters) ? gameState.ownedMonsters : [];
  ownedMonsters.forEach(monster => {
    if (!ownedById.has(monster.id)) {
      ownedById.set(monster.id, { level: monster.level, equipment: monster.equipment });
    }
  });

  const monsters = Array.from({ length: capacity.monsters }, (_, slotIndex): RoomEditorMonsterSocket => {
    const monsterId = normalizeId(slot.monsterIds?.[slotIndex]);
    const owned = monsterId ? ownedById.get(monsterId) : undefined;
    return {
      kind: 'monster',
      slotIndex,
      monsterId,
      level: owned?.level,
      hasOwnedMetadata: Boolean(owned),
      state: monsterId ? 'assigned' : 'available',
    };
  });

  const traps = Array.from({ length: capacity.traps }, (_, slotIndex): RoomEditorTrapSocket => {
    const trapId = normalizeId(slot.trapIds?.[slotIndex]);
    return {
      kind: 'trap',
      slotIndex,
      trapId,
      state: trapId ? 'assigned' : 'available',
    };
  });

  const equipment = monsters.map((monster): RoomEditorEquipmentSocket => {
    const owned = monster.monsterId ? ownedById.get(monster.monsterId) : undefined;
    const equipmentId = normalizeId(owned?.equipment);
    return {
      kind: 'equipment',
      slotIndex: monster.slotIndex,
      monsterId: monster.monsterId,
      equipmentId,
      state: !monster.monsterId || !owned
        ? 'disabled'
        : equipmentId
          ? 'assigned'
          : 'available',
    };
  });

  const nextTarget = getNextTarget(directiveTarget, monsters, traps, equipment);

  return {
    capacity,
    monsters: markTarget(monsters, nextTarget, 'monster'),
    traps: markTarget(traps, nextTarget, 'trap'),
    equipment: markTarget(equipment, nextTarget, 'equipment'),
    nextTarget,
    monsterCount: monsters.filter(monster => Boolean(monster.monsterId)).length,
    trapCount: traps.filter(trap => Boolean(trap.trapId)).length,
    equippedCount: equipment.filter(socket => socket.state === 'assigned').length,
  };
}

export function getRoomEditorPreviewLayout(
  preview: RoomEditorPreviewState,
  bounds: RoomEditorPreviewLayoutInput,
): RoomEditorPreviewLayout {
  const traps = preview.traps.map(socket => ({
    socket,
    ...getSocketPosition(
      socket.slotIndex,
      preview.traps.length,
      bounds.chamberX + 60,
      bounds.chamberY + Math.round(bounds.chamberHeight * 0.27),
      bounds.chamberWidth - 120,
      46,
      4,
    ),
  }));
  const monsters = preview.monsters.map(socket => ({
    socket,
    ...getSocketPosition(
      socket.slotIndex,
      preview.monsters.length,
      bounds.chamberX + 58,
      bounds.chamberY + Math.round(bounds.chamberHeight * 0.66),
      bounds.chamberWidth - 116,
      58,
      3,
    ),
  }));

  const hitZones: RoomEditorPreviewHitZone[] = [
    ...traps.map(({ socket, x, y }) => makeHitZone('trap-picker', 'trap', socket.slotIndex, x, y + 8)),
    ...monsters.flatMap(({ socket, x, y }) => {
      if (!socket.monsterId || !socket.hasOwnedMetadata) {
        return [makeHitZone('monster-picker', 'monster', socket.slotIndex, x, y + 10)];
      }
      const equipment = preview.equipment[socket.slotIndex];
      const zones = [makeHitZone('monster-growth', 'monster', socket.slotIndex, x - 23, y - 4)];
      if (equipment?.state !== 'disabled') {
        zones.push(makeHitZone('forge', 'equipment', socket.slotIndex, x + 23, y - 17));
      }
      return zones;
    }),
  ];

  return { traps, monsters, hitZones };
}

export function hasNonOverlappingRoomEditorPreviewHitZones(
  zones: readonly RoomEditorPreviewHitZone[],
): boolean {
  return zones.every((zone, index) => zones.slice(index + 1).every(other =>
    zone.x + zone.width <= other.x || other.x + other.width <= zone.x ||
    zone.y + zone.height <= other.y || other.y + other.height <= zone.y,
  ));
}

function normalizeId(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function getNextTarget(
  directiveTarget: RoomEditorDirectiveTarget,
  monsters: readonly RoomEditorMonsterSocket[],
  traps: readonly RoomEditorTrapSocket[],
  equipment: readonly RoomEditorEquipmentSocket[],
): RoomEditorNextTarget | null {
  switch (directiveTarget) {
    case 'monster': {
      const socket = monsters.find(candidate => candidate.state === 'available');
      return socket ? { kind: 'monster', slotIndex: socket.slotIndex } : null;
    }
    case 'trap': {
      const socket = traps.find(candidate => candidate.state === 'available');
      return socket ? { kind: 'trap', slotIndex: socket.slotIndex } : null;
    }
    case 'growth': {
      const socket = equipment.find(candidate => candidate.state === 'available');
      return socket ? { kind: 'equipment', slotIndex: socket.slotIndex } : null;
    }
    default:
      return null;
  }
}

function markTarget<TSocket extends { readonly kind: RoomEditorNextTarget['kind']; readonly slotIndex: number; readonly state: RoomEditorSocketState }>(
  sockets: readonly TSocket[],
  target: RoomEditorNextTarget | null,
  kind: RoomEditorNextTarget['kind'],
): readonly TSocket[] {
  if (!target || target.kind !== kind) return sockets;
  return sockets.map(socket => socket.slotIndex === target.slotIndex
    ? { ...socket, state: 'target' }
    : socket,
  ) as readonly TSocket[];
}

function getSocketPosition(
  index: number,
  total: number,
  x: number,
  y: number,
  width: number,
  rowGap: number,
  maxPerRow: number,
): { x: number; y: number } {
  const perRow = Math.min(maxPerRow, Math.max(1, total));
  const row = Math.floor(index / perRow);
  const column = index % perRow;
  const countInRow = Math.min(perRow, total - row * perRow);
  const gap = countInRow <= 1 ? 0 : Math.min(92, width / (countInRow - 1));
  const startX = x + width / 2 - gap * (countInRow - 1) / 2;
  return { x: startX + column * gap, y: y + row * rowGap };
}

function makeHitZone(
  action: RoomEditorPreviewAction,
  kind: RoomEditorPreviewHitZone['kind'],
  slotIndex: number,
  x: number,
  y: number,
): RoomEditorPreviewHitZone {
  return {
    action,
    kind,
    slotIndex,
    x,
    y,
    width: ROOM_EDITOR_PREVIEW_HIT_SIZE,
    height: ROOM_EDITOR_PREVIEW_HIT_SIZE,
  };
}
