import Phaser from 'phaser';
import * as Tone from 'tone';
import { BootScene }             from './scenes/BootScene';
import { DungeonScene }          from './scenes/DungeonScene';
import { UIScene }               from './scenes/UIScene';
import { StageSelectScene }      from './scenes/StageSelectScene';
import { AncestralWisdomScene }  from './scenes/AncestralWisdomScene';
import { EndlessResultScene }    from './scenes/EndlessResultScene';
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
import { applyAmbientBackground } from './ui/AmbientBackground';

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
  parent: document.body,
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
    // min/max are CSS display bounds (not physical canvas) — do NOT multiply by dpr
    min: { width: 320, height: 568 },
    max: { width: 430, height: 932 },
  },
  scene: [BootScene, DungeonScene, UIScene, StageSelectScene, AncestralWisdomScene, EndlessResultScene, AchievementScene, BarracksScene, SummonScene, ShopScene, CinematicScene, DungeonHomeScene, PreBattleScene, FusionScene, ForgeScene, CodexScene, StageRewardOverlay],
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
(window as unknown as Record<string, unknown>).__phaserGame = game;
(window as unknown as Record<string, unknown>).__gameDpr = dpr;

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
  if (!cam) return;
  cam.fadeIn(180, 0, 0, 0);
}

// ── Ambient atmosphere scene allow-list ──────────────────────────────────────
// Non-battle scenes get the warm-glow + vignette + dust treatment.
// Battle scenes (DungeonScene/UIScene) and cinematics own their atmosphere,
// so we skip them to avoid visual conflicts.
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
]);

game.events.once(Phaser.Core.Events.READY, () => {
  game.scene.scenes.forEach(scene => {
    // Apply immediately if scene was already created before READY fired.
    applyDprCamera(scene);
    if (AMBIENT_SCENES.has(scene.scene.key)) {
      applyAmbientBackground(scene);
    }
    scene.events.on(Phaser.Scenes.Events.CREATE, () => {
      applyDprCamera(scene);
      if (AMBIENT_SCENES.has(scene.scene.key)) {
        applyAmbientBackground(scene);
      }
      applySceneFadeIn(scene);
    });
  });
});
