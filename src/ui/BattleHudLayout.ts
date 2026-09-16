import { CANVAS_WIDTH } from '../constants/layout';

export interface BattleHudRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface BattleHudSecondRowLayout {
  readonly wave: BattleHudRect;
  readonly speed: BattleHudRect;
  readonly pause: BattleHudRect;
  readonly hp: BattleHudRect;
  readonly remaining: BattleHudRect;
  readonly highScore: BattleHudRect;
}

export const BATTLE_HUD_CONTROL_SIZE = 50;

/**
 * Fixed 390px battle-HUD geometry. The 50px controls remain at least 44pt
 * after iPhone safe-area padding makes Phaser FIT scale the canvas down.
 */
export function getBattleHudSecondRowLayout(
  canvasWidth = CANVAS_WIDTH,
): BattleHudSecondRowLayout {
  const hpX = 208;

  return {
    wave:      { x: 12,  y: 58, width: 80, height: 26 },
    speed:     { x: 96,  y: 54, width: BATTLE_HUD_CONTROL_SIZE, height: BATTLE_HUD_CONTROL_SIZE },
    pause:     { x: 150, y: 54, width: BATTLE_HUD_CONTROL_SIZE, height: BATTLE_HUD_CONTROL_SIZE },
    hp:        { x: hpX, y: 68, width: canvasWidth - hpX - 8, height: 14 },
    remaining: { x: hpX, y: 86, width: 78, height: 18 },
    highScore: { x: 292, y: 86, width: canvasWidth - 300, height: 18 },
  };
}
