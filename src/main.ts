import Phaser from 'phaser';
import * as Tone from 'tone';
import { BootScene }             from './scenes/BootScene';
import { DungeonScene }          from './scenes/DungeonScene';
import { UIScene }               from './scenes/UIScene';
import { StageSelectScene }      from './scenes/StageSelectScene';
import { AncestralWisdomScene }  from './scenes/AncestralWisdomScene';
import { EndlessResultScene }    from './scenes/EndlessResultScene';
import { AbyssScene }            from './scenes/AbyssScene';
import { ProductionScene }       from './scenes/ProductionScene';
import { DecorationScene }        from './scenes/DecorationScene';
import { AchievementScene }      from './scenes/AchievementScene';
import { BarracksScene }         from './scenes/BarracksScene';
import { SummonScene }           from './scenes/SummonScene';
import { ShopScene }             from './scenes/ShopScene';
import { CinematicScene }        from './scenes/CinematicScene';
import { DungeonHomeScene }      from './scenes/DungeonHomeScene';
import { PreBattleScene }        from './scenes/PreBattleScene';
import { FusionScene }           from './scenes/FusionScene';
import { ForgeScene }            from './scenes/ForgeScene';
import { CodexScene }            from './scenes/CodexScene';
import { StageRewardOverlay }    from './scenes/StageRewardOverlay';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from './constants/layout';
import { applyCasualBackground } from './ui/AmbientBackground';
import { getReducedMotion } from './utils/reducedMotion';
import { getUnlockedSlots, loadGameState, type DungeonSlot, type GameState } from './data/wisdom';
import { calculateRoomMetrics } from './data/dungeonMetrics';
import { getDungeonActionQueue, getRoomActionRecommendation } from './data/roomActionRecommendations';

declare global {
  interface Window {
    __phaserGame?: Phaser.Game;
    __gameDpr?: number;
    render_game_to_text?: () => string;
    advanceTime?: (ms: number) => string;
  }
}

// ── iOS Web Audio unlock ─────────────────────────────────────────────────────
const unlockAudio = () => {
  Tone.start().catch(() => { /* ignore */ });
  document.removeEventListener('touchstart', unlockAudio, true);
  document.removeEventListener('pointerdown', unlockAudio, true);
};
document.addEventListener('touchstart', unlockAudio, { once: true, capture: true });
document.addEventListener('pointerdown', unlockAudio, { once: true, capture: true });

// ── Safe-area offset for notch / home indicator ──────────────────────────────
const safeTop    = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--sat') || '0');
const safeBottom = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--sab') || '0');
(window as unknown as Record<string, unknown>).__safeArea = { top: safeTop, bottom: safeBottom };

// ── Device Pixel Ratio — render at native resolution for crisp display ────────
// Phaser 3.60+ removed `resolution` from the game config.
// Strategy: render canvas at DPR × logical size, then apply camera zoom=DPR per
// scene so all game coordinates stay in 390×844 space. We enforce a minimum
// DPR of 2 so even low-DPI displays get supersampled rendering — eliminates
// blurry text and jagged UI edges that made the game look dated.
const RAW_DPR  = window.devicePixelRatio || 1;
const MIN_DPR  = 2;          // supersample floor for crisp rendering
const MAX_DPR  = 3;          // cap to avoid excessive GPU cost on retina
const dpr: number = Math.max(MIN_DPR, Math.min(RAW_DPR, MAX_DPR));

const config = {
  type: Phaser.AUTO,
  width:  CANVAS_WIDTH  * dpr,
  height: CANVAS_HEIGHT * dpr,
  backgroundColor: '#1a0f00',
  parent: 'game-root',
  render: {
    antialias:    true,
    antialiasGL:  true,
    pixelArt:     false,
    roundPixels:  false,  // smooth subpixel positioning
  },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width:  CANVAS_WIDTH  * dpr,
    height: CANVAS_HEIGHT * dpr,
    // min/max are CSS display bounds (not physical canvas) — do NOT multiply by dpr.
    // No max: on tablets FIT scales the portrait canvas to full height
    // (aspect-locked letterbox); phones are bounded by their own viewport.
    min: { width: 320, height: 568 },
  },
  scene: [BootScene, DungeonScene, UIScene, StageSelectScene, AncestralWisdomScene, EndlessResultScene, AbyssScene, ProductionScene, DecorationScene, AchievementScene, BarracksScene, SummonScene, ShopScene, CinematicScene, DungeonHomeScene, PreBattleScene, FusionScene, ForgeScene, CodexScene, StageRewardOverlay],
};

// ── Global text resolution patch ─────────────────────────────────────────────
// Phaser.GameObjects.Text renders to a canvas-backed texture at resolution=1
// by default. When the camera later zooms by DPR, the 1× texture is stretched
// up and looks blurry / pixelated. We patch the factory so every add.text()
// call automatically applies setResolution(dpr), yielding crisp text across
// all 442+ text objects in the codebase without per-callsite changes.
const origTextFactory = Phaser.GameObjects.GameObjectFactory.prototype.text;
Phaser.GameObjects.GameObjectFactory.prototype.text = function patchedText(
  this: Phaser.GameObjects.GameObjectFactory,
  x: number, y: number, text: string | string[],
  style?: Phaser.Types.GameObjects.Text.TextStyle,
): Phaser.GameObjects.Text {
  const t = origTextFactory.call(this, x, y, text, style);
  t.setResolution(dpr);
  return t;
};

const game = new Phaser.Game(config);
window.__phaserGame = game;
window.__gameDpr = dpr;

// DEV-only: jump straight to a scene for screenshot/QA runs (?scene=SummonScene)
// Optional ?skipTutorial=1 marks the tutorial as done before the game boots.
if (import.meta.env.DEV) {
  const params = new URLSearchParams(window.location.search);
  if (params.get('skipTutorial')) {
    const raw = JSON.parse(localStorage.getItem('dungeonGameState') ?? '{}') as Record<string, unknown>;
    localStorage.setItem('dungeonGameState', JSON.stringify({ ...raw, tutorialStage: 99 }));
  }
  const targetScene = params.get('scene');
  if (targetScene) {
    // Wait for the normal Boot → Home flow to settle, then swap to the target.
    const jump = window.setInterval(() => {
      if (!game.scene.isActive('DungeonHomeScene')) return;
      window.clearInterval(jump);
      if (targetScene === 'DungeonHomeScene') return;
      game.scene.stop('DungeonHomeScene');
      game.scene.start(targetScene);
    }, 300);
  }
}

type RuntimeRecord = Record<string, unknown>;

function asRecord(value: unknown): RuntimeRecord {
  return value !== null && typeof value === 'object' ? value as RuntimeRecord : {};
}

function asNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function asBoolean(value: unknown, fallback = false): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function round(value: unknown): number {
  return Math.round(asNumber(value) * 100) / 100;
}

function getContainerTexts(container: unknown): string[] {
  const list = asRecord(container)['list'];
  if (!Array.isArray(list)) return [];
  return list
    .map(obj => asRecord(obj)['text'])
    .filter((text): text is string => typeof text === 'string' && text.length > 0);
}

function collectGameObjectTexts(value: unknown, texts: string[]): void {
  const record = asRecord(value);
  const text = record['text'];
  if (typeof text === 'string' && text.length > 0) texts.push(text);

  const childList = asRecord(record['children'])['list'] ?? record['list'];
  if (!Array.isArray(childList)) return;
  childList.forEach(child => collectGameObjectTexts(child, texts));
}

function getSceneTexts(scene: Phaser.Scene): string[] {
  const texts: string[] = [];
  collectGameObjectTexts(asRecord(scene)['children'], texts);
  return texts;
}

function getMonsterEquipmentId(gs: RuntimeRecord, monsterId: string): string | null {
  const monsters = Array.isArray(gs['ownedMonsters']) ? gs['ownedMonsters'] : [];
  const monster = monsters.map(asRecord).find(entry => asString(entry['id']) === monsterId);
  const equipment = monster ? monster['equipment'] : null;
  return typeof equipment === 'string' && equipment.length > 0 ? equipment : null;
}

function serializeDungeonScene(scene: DungeonScene): RuntimeRecord {
  const raw = scene as unknown as RuntimeRecord;
  const roomGrid = Array.isArray(raw['roomGrid']) ? raw['roomGrid'] : [];
  const roomObjects = Array.isArray(raw['rooms']) ? raw['rooms'] : [];
  const slots = Array.isArray(raw['dungeonTrapSlots']) ? raw['dungeonTrapSlots'] : [];
  const invaders = Array.isArray(raw['activeInvaders']) ? raw['activeInvaders'] : [];
  const persistedGs = asRecord(loadGameState());
  const rooms: RuntimeRecord[] = [];

  roomObjects.forEach((rowValue, rowIdx) => {
    if (!Array.isArray(rowValue)) return;
    rowValue.forEach((roomValue, colIdx) => {
      const room = asRecord(roomValue);
      const data = asRecord((roomGrid[rowIdx] as unknown[] | undefined)?.[colIdx]);
      rooms.push({
        row: rowIdx,
        col: colIdx,
        state: asString(room['state'], data['type'] ? 'occupied' : 'unknown'),
        x: round(room['x']),
        y: round(room['y']),
        type: asString(data['type'], ''),
        level: asNumber(data['level'], 0),
        hp: {
          current: asNumber(data['roomHp'], asNumber(data['hp'], 0)),
          max: asNumber(data['maxRoomHp'], asNumber(data['maxHp'], 0)),
        },
        monsterSlot: asString(data['monsterSlot'], ''),
        monsterSlots: Array.isArray(data['monsterSlots'])
          ? data['monsterSlots'].filter((id): id is string => typeof id === 'string')
          : [],
      });
    });
  });

  return {
    mode: 'battle',
    coordinateSystem: 'canvas world coordinates, origin top-left, x right, y down, size 390x844',
    wave: {
      current: asNumber(raw['wave'], 0),
      max: asNumber(raw['maxWave'], 0),
      active: asBoolean(raw['waveActive']),
      prepActive: asBoolean(raw['prepActive']),
    },
    resources: {
      gold: asNumber(raw['gold'], 0),
      gems: asNumber(raw['gems'], 0),
      hp: {
        current: asNumber(raw['dungeonHp'], 0),
        max: asNumber(raw['maxHp'], 0),
      },
    },
    speed: asNumber(raw['speedMult'], 1),
    selectedRoom: raw['selectedRoom']
      ? {
          row: asNumber(asRecord(raw['selectedRoom'])['row'], -1),
          col: asNumber(asRecord(raw['selectedRoom'])['col'], -1),
        }
      : null,
    commandStrip: getContainerTexts(raw['commandStrip']),
    slots: slots.map((slotValue, idx) => {
      const slot = asRecord(slotValue);
      const monsterIds = Array.isArray(slot['monsterIds']) ? slot['monsterIds'] : [];
      const monsters = monsterIds.filter((id): id is string => typeof id === 'string');
      const trapIds = Array.isArray(slot['trapIds']) ? slot['trapIds'] : [];
      const metrics = calculateRoomMetrics(
        persistedGs as unknown as GameState,
        slot as unknown as DungeonSlot,
      );
      return {
        index: idx,
        roomType: asString(slot['roomType'], ''),
        roomLevel: asNumber(slot['roomLevel'], 0),
        monsters,
        equipment: monsters.map(id => ({ monsterId: id, equipmentId: getMonsterEquipmentId(persistedGs, id) })),
        traps: trapIds.filter((id): id is string => typeof id === 'string'),
        hp: {
          current: asNumber(slot['hp'], 0),
          max: asNumber(slot['maxHp'], 0),
        },
        metrics: {
          threatScore: metrics.threatScore,
          equipmentPower: metrics.equipmentPower,
          readiness: metrics.readiness,
        },
        action: getRoomActionRecommendation(persistedGs as unknown as GameState, idx),
      };
    }),
    rooms,
    invaders: invaders.map(invaderValue => {
      const invader = asRecord(invaderValue);
      const def = asRecord(invader['def']);
      return {
        type: asString(def['type'], ''),
        name: asString(def['koreanName'], ''),
        x: round(invader['x']),
        y: round(invader['y']),
        hp: {
          current: asNumber(invader['hp'], 0),
          max: asNumber(invader['maxHp'], 0),
        },
        dead: asBoolean(invader['isDead']),
      };
    }),
  };
}

function serializeHomeScene(scene: DungeonHomeScene): RuntimeRecord {
  const raw = scene as unknown as RuntimeRecord;
  const gs = asRecord(raw['gs']);
  const slots = Array.isArray(gs['dungeonSlots']) ? gs['dungeonSlots'] : [];
  const unlockedSlots = getUnlockedSlots(asNumber(gs['dmLevel'], 1));
  const slotCount = Math.max(slots.length, unlockedSlots);
  const actionQueue = getDungeonActionQueue(gs as unknown as GameState, unlockedSlots);
  const roomDetailState = asRecord(raw['roomDetailState']);
  const roomDetailSlotIdx = typeof roomDetailState['roomDetailSlotIdx'] === 'number'
    ? roomDetailState['roomDetailSlotIdx'] as number
    : null;
  const roomDetailAction = roomDetailSlotIdx !== null
    ? getRoomActionRecommendation(gs as unknown as GameState, roomDetailSlotIdx)
    : null;
  const roomDetailNextActionIndex = roomDetailSlotIdx !== null
    ? actionQueue.findIndex(action => action.slotIdx !== roomDetailSlotIdx)
    : -1;
  const roomDetailNextAction = roomDetailNextActionIndex >= 0
    ? { ...actionQueue[roomDetailNextActionIndex], rank: roomDetailNextActionIndex + 1 }
    : null;
  const primaryPinSlotIdx = Array.from({ length: slotCount }, (_, idx) => idx)
    .find(idx => getRoomActionRecommendation(gs as unknown as GameState, idx).kind !== 'ready');
  return {
    mode: 'home',
    dmLevel: asNumber(gs['dmLevel'], 0),
    homeGold: asNumber(gs['homeGold'], 0),
    gems: asNumber(gs['gems'], 0),
    openPanels: {
      roomDetail: Boolean(roomDetailState['roomDetailContainer']),
      roomDetailSlotIdx,
      roomDetailAction,
      roomDetailNextAction,
      roomDetailBattleReady: roomDetailAction?.kind === 'ready' && !roomDetailNextAction,
      preBattleEditReturn: Boolean(scene.registry.get('preBattleEditReturn')),
      monsterPicker: Boolean(roomDetailState['monsterPickerContainer']),
      trapPicker: Boolean(roomDetailState['trapPickerContainer']),
    },
    slots: Array.from({ length: slotCount }, (_, idx) => {
      const slotValue = slots[idx];
      const slot = asRecord(slotValue);
      const monsterIds = Array.isArray(slot['monsterIds']) ? slot['monsterIds'] : [];
      const monsters = monsterIds.filter((id): id is string => typeof id === 'string');
      const trapIds = Array.isArray(slot['trapIds']) ? slot['trapIds'] : [];
      const metrics = calculateRoomMetrics(
        gs as unknown as GameState,
        slotValue ? slot as unknown as DungeonSlot : undefined,
      );
      return {
        index: idx,
        roomType: asString(slot['roomType'], ''),
        roomLevel: asNumber(slot['roomLevel'], 0),
        monsters,
        equipment: monsters.map(id => ({ monsterId: id, equipmentId: getMonsterEquipmentId(gs, id) })),
        traps: trapIds.filter((id): id is string => typeof id === 'string'),
        hp: {
          current: asNumber(slot['hp'], 0),
          max: asNumber(slot['maxHp'], 0),
        },
        metrics: {
          threatScore: metrics.threatScore,
          equipmentPower: metrics.equipmentPower,
          readiness: metrics.readiness,
        },
        action: getRoomActionRecommendation(gs as unknown as GameState, idx),
      };
    }),
    actionQueue: actionQueue.slice(0, 5),
    actionMarkers: actionQueue.slice(0, 3).map((action, index) => ({
      rank: index + 1,
      slotIdx: action.slotIdx,
      kind: action.kind,
      label: action.label,
      accent: action.accent,
    })),
    maintenanceMarkers: actionQueue
      .filter((action, index) =>
        action.kind === 'growth'
        && index >= 3
        && action.slotIdx !== primaryPinSlotIdx,
      )
      .slice(0, 3)
      .map(action => ({
        slotIdx: action.slotIdx,
        kind: action.kind,
        label: action.label,
        statValue: action.statValue,
        accent: action.accent,
      })),
    visibleTexts: getSceneTexts(scene).slice(0, 160),
  };
}

function serializeBarracksScene(scene: BarracksScene): RuntimeRecord {
  const raw = scene as unknown as RuntimeRecord;
  const gs = asRecord(raw['gs']);
  const monsters = Array.isArray(gs['ownedMonsters']) ? gs['ownedMonsters'] : [];
  const slots = Array.isArray(gs['dungeonSlots']) ? gs['dungeonSlots'] : [];
  const deployedIds = new Set<string>();

  slots.forEach(slotValue => {
    const slot = asRecord(slotValue);
    const monsterIds = Array.isArray(slot['monsterIds']) ? slot['monsterIds'] : [];
    monsterIds.forEach(id => {
      if (typeof id === 'string' && id.length > 0) deployedIds.add(id);
    });
  });

  return {
    mode: 'barracks',
    focusMonsterId: asString(raw['focusMonsterId'], ''),
    focusSourceLabel: asString(raw['focusSourceLabel'], ''),
    focusRoomSlotIdx: raw['focusRoomSlotIdx'] ?? null,
    scroll: {
      y: asNumber(raw['scrollY'], 0),
      maxY: asNumber(raw['maxScrollY'], 0),
    },
    openPanels: {
      monsterDetail: Boolean(raw['detailOverlay']),
      skillShop: Boolean(raw['shopOverlay']),
    },
    visibleTexts: getSceneTexts(scene).slice(0, 140),
    roster: monsters.slice(0, 20).map(monsterValue => {
      const monster = asRecord(monsterValue);
      const id = asString(monster['id'], '');
      return {
        id,
        level: asNumber(monster['level'], 0),
        xp: asNumber(monster['xp'], 0),
        skillPoints: asNumber(monster['skillPoints'], 0),
        equipment: monster['equipment'] ?? null,
        deployed: deployedIds.has(id),
      };
    }),
  };
}

function serializeForgeScene(scene: ForgeScene): RuntimeRecord {
  const raw = scene as unknown as RuntimeRecord;
  const gs = loadGameState();
  const materials = gs.materials ?? {};
  const blueprints = gs.blueprints ?? [];
  const craftedEquipment = gs.craftedEquipment ?? [];

  return {
    mode: 'forge',
    activeTab: asString(raw['activeTab'], 'craft'),
    returnScene: asString(raw['returnScene'], ''),
    focusMonsterId: asString(raw['focusMonsterId'], ''),
    focusSourceLabel: asString(raw['focusSourceLabel'], ''),
    focusRoomSlotIdx: raw['focusRoomSlotIdx'] ?? null,
    selection: {
      blueprintId: raw['selectedBpId'] ?? null,
      equipmentIndex: raw['selectedEqIdx'] ?? null,
    },
    inventory: {
      blueprintCount: blueprints.length,
      craftedEquipmentCount: craftedEquipment.length,
      materialTypes: Object.values(materials).filter(qty => qty > 0).length,
    },
    visibleTexts: getSceneTexts(scene).slice(0, 140),
  };
}

function serializePreBattleScene(scene: PreBattleScene): RuntimeRecord {
  const cfg = asRecord(game.registry.get('invasionConfig'));
  const waves = Array.isArray(cfg['waves']) ? cfg['waves'] : [];
  const gs = asRecord(loadGameState());
  const slots = Array.isArray(gs['dungeonSlots']) ? gs['dungeonSlots'] : [];
  const visibleSlots = slots.map((slotValue, idx) => {
    const slot = asRecord(slotValue);
    const monsterIds = Array.isArray(slot['monsterIds']) ? slot['monsterIds'] : [];
    const monsters = monsterIds.filter((id): id is string => typeof id === 'string');
    const trapIds = Array.isArray(slot['trapIds']) ? slot['trapIds'] : [];
    return {
      index: idx,
      roomType: asString(slot['roomType'], ''),
      roomLevel: asNumber(slot['roomLevel'], 0),
      monsters,
      equipment: monsters.map(id => ({ monsterId: id, equipmentId: getMonsterEquipmentId(gs, id) })),
      traps: trapIds.filter((id): id is string => typeof id === 'string'),
    };
  }).filter(slot => slot.roomType || slot.monsters.length > 0 || slot.traps.length > 0);

  return {
    mode: 'prebattle',
    questId: asString(game.registry.get('questId'), ''),
    invasion: {
      name: asString(cfg['name'], ''),
      waveCount: waves.length,
      firstWaveInvaders: asRecord(waves[0])['invaders'] ?? [],
    },
    totals: {
      builtRooms: visibleSlots.filter(slot => slot.roomType).length,
      monsterCount: visibleSlots.reduce((sum, slot) => sum + slot.monsters.length, 0),
      equipmentCount: visibleSlots.reduce(
        (sum, slot) => sum + slot.equipment.filter(entry => entry.equipmentId).length,
        0,
      ),
      trapCount: visibleSlots.reduce((sum, slot) => sum + slot.traps.length, 0),
    },
    slots: visibleSlots,
    visibleTexts: getSceneTexts(scene).slice(0, 80),
  };
}

function renderGameToText(): string {
  const activeScenes = game.scene.getScenes(true).map(scene => scene.scene.key);
  const dungeonScene = game.scene.getScene('DungeonScene');
  const homeScene = game.scene.getScene('DungeonHomeScene');
  const preBattleScene = game.scene.getScene('PreBattleScene');
  const barracksScene = game.scene.getScene('BarracksScene');
  const forgeScene = game.scene.getScene('ForgeScene');
  const payload: RuntimeRecord = {
    activeScenes,
    topScene: activeScenes[activeScenes.length - 1] ?? '',
    canvas: { width: CANVAS_WIDTH, height: CANVAS_HEIGHT, dpr },
    registry: {
      gold: game.registry.get('gold') ?? null,
      gems: game.registry.get('gems') ?? null,
      hp: game.registry.get('hp') ?? null,
      wave: game.registry.get('wave') ?? null,
      status: game.registry.get('status') ?? '',
      remainingInvaders: game.registry.get('remainingInvaders') ?? null,
      battleSpeed: game.registry.get('battleSpeed') ?? 1,
      battlePaused: game.registry.get('battlePaused') ?? false,
    },
  };

  if (dungeonScene instanceof DungeonScene && game.scene.isActive('DungeonScene')) {
    payload['dungeon'] = serializeDungeonScene(dungeonScene);
  }
  if (homeScene instanceof DungeonHomeScene && game.scene.isActive('DungeonHomeScene')) {
    payload['home'] = serializeHomeScene(homeScene);
  }
  if (preBattleScene instanceof PreBattleScene && game.scene.isActive('PreBattleScene')) {
    payload['preBattle'] = serializePreBattleScene(preBattleScene);
  }
  if (barracksScene instanceof BarracksScene && game.scene.isActive('BarracksScene')) {
    payload['barracks'] = serializeBarracksScene(barracksScene);
  }
  if (forgeScene instanceof ForgeScene && game.scene.isActive('ForgeScene')) {
    payload['forge'] = serializeForgeScene(forgeScene);
  }

  return JSON.stringify(payload);
}

let qaVirtualNow = 0;
window.render_game_to_text = renderGameToText;
window.advanceTime = (ms: number): string => {
  const frameMs = 1000 / 60;
  const safeMs = Math.max(0, Math.min(10000, Number.isFinite(ms) ? ms : 0));
  const steps = Math.max(1, Math.round(safeMs / frameMs));
  qaVirtualNow = qaVirtualNow || performance.now();
  for (let i = 0; i < steps; i++) {
    qaVirtualNow += frameMs;
    game.step(qaVirtualNow, frameMs);
  }
  return renderGameToText();
};

// ── Apply DPR zoom to every scene so 390×844 coordinates fill the canvas ─────
// The canvas is now CANVAS_WIDTH*dpr × CANVAS_HEIGHT*dpr pixels.
// camera.zoom = dpr makes the camera show exactly 390×844 world units,
// which maps 1:1 to the native screen pixels on high-DPI devices.
//
// IMPORTANT: Phaser's camera.zoom scales around the viewport CENTER (ignoring
// camera.origin which is only used for rotation pivot). With zoom=dpr and
// default scroll (0, 0), the visible world region becomes
// [-CANVAS_WIDTH/2, CANVAS_WIDTH/2] × [-CANVAS_HEIGHT/2, CANVAS_HEIGHT/2],
// which leaves all game content (drawn in positive coords) off-screen.
// Fix: centerOn(CANVAS_WIDTH/2, CANVAS_HEIGHT/2) sets scroll such that
// worldView = (0, 0, CANVAS_WIDTH, CANVAS_HEIGHT).
//
// We hook every scene's CREATE event — covers fresh starts AND restarts.
function applyDprCamera(scene: Phaser.Scene): void {
  const cam = scene.cameras.main;
  if (!cam) return;
  cam.setZoom(dpr);
  cam.centerOn(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);
}

// ── Auto fade-in on every scene create ──────────────────────────────────────
// Instead of hard scene cuts (scene.start() snaps the new scene in instantly),
// we run a short black fade-in via the camera API. This turns every scene
// transition into a soft 180ms dissolve without touching any scene file.
// Paired with the ambient layer at depth -1000, the fade smoothly reveals
// the atmosphere → UI layering in sequence.
function applySceneFadeIn(scene: Phaser.Scene): void {
  const cam = scene.cameras.main;
  if (!cam || getReducedMotion()) return;
  cam.fadeIn(180, 0, 0, 0);
}

// ── Ambient atmosphere scene allow-list ──────────────────────────────────────
// Non-battle scenes get the bright casual-toy backdrop (gradient + sun glow +
// polka dots). Idempotent: scenes that already call applyCasualBackground in
// their own create() win the first draw, so this is a no-op for them and a
// backdrop for the rest. Battle scenes/cinematics own their atmosphere.
const AMBIENT_SCENES = new Set<string>([
  'DungeonHomeScene',
  'StageSelectScene',
  'PreBattleScene',
  'BarracksScene',
  'SummonScene',
  'ShopScene',
  'AncestralWisdomScene',
  'FusionScene',
  'ForgeScene',
  'CodexScene',
  'AchievementScene',
  'EndlessResultScene',
  'AbyssScene',
  'ProductionScene',
  'DecorationScene',
]);

game.events.once(Phaser.Core.Events.READY, () => {
  game.scene.scenes.forEach(scene => {
    // Apply immediately if scene was already created before READY fired.
    applyDprCamera(scene);
    if (AMBIENT_SCENES.has(scene.scene.key)) {
      applyCasualBackground(scene);
    }
    scene.events.on(Phaser.Scenes.Events.CREATE, () => {
      applyDprCamera(scene);
      if (AMBIENT_SCENES.has(scene.scene.key)) {
        applyCasualBackground(scene);
      }
      applySceneFadeIn(scene);
    });
  });
});
