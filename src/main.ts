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
import { CANVAS_WIDTH, CANVAS_HEIGHT } from './constants/layout';

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
// Fix: render canvas at DPR × logical size, then apply camera zoom=DPR per scene
// so all game coordinates stay in 390×844 space.
const dpr = Math.min(window.devicePixelRatio || 1, 3);

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
  },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width:  CANVAS_WIDTH  * dpr,
    height: CANVAS_HEIGHT * dpr,
    min: { width: 320 * dpr, height: 568 * dpr },
    max: { width: 430 * dpr, height: 932 * dpr },
  },
  scene: [BootScene, DungeonScene, UIScene, StageSelectScene, AncestralWisdomScene, EndlessResultScene, AchievementScene, BarracksScene, SummonScene, ShopScene, CinematicScene, DungeonHomeScene, PreBattleScene, FusionScene, ForgeScene, CodexScene],
};

const game = new Phaser.Game(config);
(window as unknown as Record<string, unknown>).__phaserGame = game;

// ── Apply DPR zoom to every scene so 390×844 coordinates fill the canvas ─────
// The canvas is now CANVAS_WIDTH*dpr × CANVAS_HEIGHT*dpr pixels.
// camera.zoom = dpr makes the camera show exactly 390×844 world units,
// which maps 1:1 to the native screen pixels on high-DPI devices.
if (dpr > 1) {
  game.events.once(Phaser.Core.Events.READY, () => {
    game.scene.scenes.forEach(scene => {
      scene.events.on(Phaser.Scenes.Events.CREATE, () => {
        scene.cameras.main?.setZoom(dpr);
      });
    });
  });
}
