import { describe, expect, it } from 'vitest';
import { CANVAS_WIDTH, TOP_BAR_HEIGHT } from '../constants/layout';
import { BATTLE_HUD_CONTROL_SIZE, getBattleHudSecondRowLayout } from './BattleHudLayout';

describe('battle HUD second row', () => {
  it('provides independent controls that remain at least 44pt on iPhone 12', () => {
    const layout = getBattleHudSecondRowLayout();
    const iphone12SafeFitScale = 763 / 844;

    expect(layout.speed.width).toBe(BATTLE_HUD_CONTROL_SIZE);
    expect(layout.speed.height).toBe(BATTLE_HUD_CONTROL_SIZE);
    expect(layout.pause.width).toBe(BATTLE_HUD_CONTROL_SIZE);
    expect(layout.pause.height).toBe(BATTLE_HUD_CONTROL_SIZE);
    expect(layout.speed.width * iphone12SafeFitScale).toBeGreaterThanOrEqual(44);
    expect(layout.pause.height * iphone12SafeFitScale).toBeGreaterThanOrEqual(44);
    expect(layout.speed.x + layout.speed.width).toBeLessThanOrEqual(layout.pause.x);
  });

  it('keeps controls and status regions separate inside the 390px header', () => {
    const layout = getBattleHudSecondRowLayout();
    const regions = Object.values(layout);

    expect(layout.wave.x + layout.wave.width).toBeLessThanOrEqual(layout.speed.x);
    expect(layout.pause.x + layout.pause.width).toBeLessThanOrEqual(layout.hp.x);
    expect(layout.remaining.x + layout.remaining.width).toBeLessThanOrEqual(layout.highScore.x);
    expect(regions.every(region => region.x >= 0 && region.x + region.width <= CANVAS_WIDTH)).toBe(true);
    expect(regions.every(region => region.y >= 0 && region.y + region.height <= TOP_BAR_HEIGHT)).toBe(true);
  });
});
