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
// iOS requires a user gesture before AudioContext can run.
// Unlock on first touch/click anywhere so BGM starts correctly.
const unlockAudio = () => {
  Tone.start().catch(() => { /* ignore */ });
  document.removeEventListener('touchstart', unlockAudio, true);
  document.removeEventListener('pointerdown', unlockAudio, true);
};
document.addEventListener('touchstart', unlockAudio, { once: true, capture: true });
document.addEventListener('pointerdown', unlockAudio, { once: true, capture: true });

// ── Safe-area offset for notch / home indicator ──────────────────────────────
// Read CSS env() values and store for Phaser scene use if needed.
const safeTop    = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--sat') || '0');
const safeBottom = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--sab') || '0');
(window as unknown as Record<string, unknown>).__safeArea = { top: safeTop, bottom: safeBottom };

const dpr = Math.min(window.devicePixelRatio || 1, 3);

const config = {
  type: Phaser.AUTO,
  width:  CANVAS_WIDTH,
  height: CANVAS_HEIGHT,
  resolution: dpr,
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
    width:  390,
    height: 844,
    min: { width: 320, height: 568 },
    max: { width: 430, height: 932 },
  },
  scene: [BootScene, DungeonScene, UIScene, StageSelectScene, AncestralWisdomScene, EndlessResultScene, AchievementScene, BarracksScene, SummonScene, ShopScene, CinematicScene, DungeonHomeScene, PreBattleScene, FusionScene, ForgeScene, CodexScene],
};

const game = new Phaser.Game(config);
// Dev helper — allows console access and preview_eval verification
(window as unknown as Record<string, unknown>).__phaserGame = game;
